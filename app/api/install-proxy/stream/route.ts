import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clientPromise, dbName } from '@/lib/db';
import { setupSquidProxy } from '@/lib/ssh-utils';

export const runtime = 'nodejs';

// Store active installations
const activeInstallations = new Map();

// Function to send log immediately
const sendLog = (installationId: string, message: string) => {
  const controller = activeInstallations.get(installationId);
  if (controller) {
    try {
      const encoder = new TextEncoder();
      const logMessage = `data: ${JSON.stringify({
        type: 'log',
        message,
      })}\n\n`;
      controller.enqueue(encoder.encode(logMessage));
    } catch (error) {
      console.error(
        `SSE: Error sending log for installation ${installationId}:`,
        error,
      );
    }
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get('id');

  if (!installationId) {
    return new Response('Missing installation ID', { status: 400 });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

      // Store the controller for this installation
      activeInstallations.set(installationId, controller);
    },
    cancel() {
      // Clean up when the connection is closed
      activeInstallations.delete(installationId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable proxy buffering
    },
  });
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 },
      );
    }

    const client = await clientPromise;
    const db = client.db(dbName);

    const session = await db.collection('sessions').findOne({ id: sessionId });
    if (!session) {
      return NextResponse.json({ message: 'Invalid session' }, { status: 401 });
    }

    const user = await db.collection('users').findOne({ id: session.userId });
    if (!user || !user.subscription?.active) {
      return NextResponse.json(
        { message: 'Active subscription required' },
        { status: 403 },
      );
    }

    const {
      ipAddress,
      username,
      authMethod,
      password,
      sshKeyFile,
      proxyPort,
      proxyUsername,
      proxyPassword,
      telegramChatId,
    } = await request.json();

    // Generate unique installation ID
    const installationId = Math.random().toString(36).substring(7);

    // Start installation in background
    setupSquidProxy({
      host: ipAddress,
      username,
      password: authMethod === 'password' ? password : undefined,
      privateKey: authMethod === 'ssh' ? sshKeyFile : undefined,
      proxyPort,
      proxyUsername,
      proxyPassword,
      telegramChatId,
      userId: user.id, // Add userId here
      onLog: (log: string) => {
        // Send log immediately
        sendLog(installationId, log);
      },
    })
      .then(async result => {
        // Log installation in database
        await db.collection('installations').insertOne({
          userId: user.id,
          ipAddress,
          proxyPort: result.proxy?.split(':')[1],
          proxyUsername: result.username,
          telegramChatId,
          createdAt: new Date(),
          logs: result.logs,
          status: result.status,
        });

        // Send final result
        const controller = activeInstallations.get(installationId);
        if (controller) {
          try {
            const encoder = new TextEncoder();
            const message = `data: ${JSON.stringify({
              type: 'complete',
              success: result.status === 'success',
              details: {
                proxy: result.proxy,
                username: result.username,
                password: result.password,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(message));
            controller.close();
          } catch (error) {
            console.error(
              `SSE: Error sending completion for installation ${installationId}:`,
              error,
            );
          }
          activeInstallations.delete(installationId);
        }
      })
      .catch(error => {
        const controller = activeInstallations.get(installationId);
        if (controller) {
          try {
            const encoder = new TextEncoder();
            const message = `data: ${JSON.stringify({
              type: 'error',
              message: error.message,
            })}\n\n`;
            controller.enqueue(encoder.encode(message));
            controller.close();
          } catch (error) {
            console.error(
              `SSE: Error sending error for installation ${installationId}:`,
              error,
            );
          }
          activeInstallations.delete(installationId);
        }
      });

    return NextResponse.json({
      success: true,
      installationId,
    });
  } catch (error) {
    console.error('SSE: Proxy installation error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Installation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
