import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clientPromise, dbName } from '@/lib/db';

export async function GET() {
  try {
    // Get session from cookie
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id');

    if (!sessionId?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db(dbName);

    // Get user from session
    const session = await db.collection('sessions').findOne({
      id: sessionId.value,
    });

    if (!session?.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get user details to verify account
    const user = await db.collection('users').findOne({
      id: session.userId,
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch proxies with proper query
    const proxies = await db
      .collection('proxies')
      .find({
        user_id: user.id,
        status: 'success',
      })
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json(proxies);
  } catch (error) {
    console.error('Error fetching proxies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proxies' },
      { status: 500 }
    );
  }
}