import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clientPromise, dbName } from '@/lib/db';
import { setupSquidProxy } from '@/lib/ssh-utils';

export const runtime = 'nodejs'; // Add this line to use Node.js runtime

interface SSHConfig {
  host: string;
  username: string;
  password?: string;
  privateKey?: string;
  port?: number;
  proxyPort: string;
  proxyUsername: string;
  proxyPassword: string;
  telegramChatId: string;
  userId: string; // Add userId to the interface
}

export async function POST(request: Request) {
  try {
    // Check authentication first
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 },
      );
    }

    // Verify subscription
    const client = await clientPromise;
    const db = client.db(dbName);

    // Find session and user
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

    // Get installation parameters
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

    // Pass userId to setupSquidProxy
    const result = await setupSquidProxy({
      host: ipAddress,
      username,
      password: authMethod === 'password' ? password : undefined,
      privateKey: authMethod === 'ssh' ? sshKeyFile : undefined,
      proxyPort,
      proxyUsername,
      proxyPassword,
      telegramChatId,
      userId: user.id, // Pass userId here
    });

    // Log installation in database
    await db.collection('installations').insertOne({
      userId: user.id,
      ipAddress,
      proxyPort: result.proxy.split(':')[1],
      proxyUsername: result.username,
      telegramChatId,
      createdAt: new Date(),
      logs: result.logs,
      status: result.status,
      });

    if (result.status === 'error') {
      return NextResponse.json(
        {
          success: false,
          message: 'Proxy installation failed',
          details: {
            proxy: result.proxy,
            username: result.username,
            password: result.password,
          },
          logs: result.logs,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({
      success: true,
      message: 'Proxy installation successful',
      details: {
        proxy: result.proxy,
        username: result.username,
        password: result.password,
      },
      logs: result.logs,
    });
  } catch (error) {
    console.error('Proxy installation error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Installation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        logs:
          error instanceof Error && 'logs' in error ? error.logs : undefined,
      },
      { status: 500 },
    );
  }
}
