import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { clientPromise, dbName } from "@/lib/db"

export async function POST() {
  try {
    const sessionId = (await cookies()).get("session_id")?.value

    if (!sessionId) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
    }

    // Connect to MongoDB
    const client = await clientPromise
    const db = client.db(dbName)

    // Find session
    const session = await db.collection("sessions").findOne({ id: sessionId })
    if (!session) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
    }

    // Find user
    const user = await db.collection("users").findOne({ id: session.userId })
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    // Update subscription status
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + 1) // 1 month subscription

    await db.collection("users").updateOne(
      { id: user.id },
      {
        $set: {
          "subscription.active": true,
          "subscription.expiresAt": expiresAt,
          "subscription.updatedAt": new Date(),
        },
      },
    )

    return NextResponse.json({
      success: true,
      subscription: {
        active: true,
        expiresAt,
      },
    })
  } catch (error) {
    console.error("Subscription error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
