import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clientPromise, dbName } from '@/lib/db';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    if (sessionId) {
      // Delete session from database
      const client = await clientPromise;
      const db = client.db(dbName);
      await db.collection('sessions').deleteOne({ id: sessionId });

      // Clear cookie
      await cookieStore.delete('session_id');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
