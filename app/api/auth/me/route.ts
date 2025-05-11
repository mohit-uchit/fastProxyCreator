import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { clientPromise, dbName } from "@/lib/db"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionId = cookieStore.get("session_id")?.value

    if (!sessionId) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
    }

    // Connect to MongoDB
    const client = await clientPromise
    const db = client.db(dbName)

    // Find session
    const session = await db.collection("sessions").findOne({ id: sessionId })
    if (!session) {
      await cookieStore.delete("session_id")
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 })
    }

    // Find user
    const user = await db.collection("users").findOne({ id: session.userId })
    if (!user) {
      await cookieStore.delete("session_id")
      return NextResponse.json({ message: "User not found" }, { status: 401 })
    }

    // Return user data (without password)
    const { password, ...userData } = user
    return NextResponse.json(userData)
  } catch (error) {
    console.error("Auth check error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
