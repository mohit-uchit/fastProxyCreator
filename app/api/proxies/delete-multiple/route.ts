import { NextResponse } from 'next/server'
import { clientPromise } from '@/lib/db'
import { ObjectId } from 'mongodb'

export async function POST(request: Request) {
  try {
    const { proxyIds } = await request.json()

    if (!Array.isArray(proxyIds)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB || 'squidProxy')

    const result = await db.collection('proxies').deleteMany({
      _id: { $in: proxyIds.map(id => new ObjectId(id)) }
    })

    return NextResponse.json({
      success: true,
      deletedCount: result.deletedCount
    })

  } catch (error) {
    console.error('Failed to delete proxies:', error)
    return NextResponse.json(
      { error: 'Failed to delete proxies' },
      { status: 500 }
    )
  }
}