import { NextResponse } from "next/server"
import { clientPromise, dbName } from "@/lib/db"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { v4 as uuidv4 } from "uuid"

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 })
    }

    // Connect to MongoDB
    const client = await clientPromise
    const db = client.db(dbName)
    const usersCollection = db.collection("users")

    // Find user
    const user = await usersCollection.findOne({ email })
    if (!user) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 })
    }

    // Set session cookie
    const sessionId = uuidv4()

    // Create the response first
    const response = NextResponse.json({ 
      success: true,
      message: "Login successful" 
    })

    // Set the cookie in the response
    const cookieStore = await cookies()
    cookieStore.set({
      name: "session_id",
      value: sessionId,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/'
    })

    // Store session
    await db.collection("sessions").insertOne({
      id: sessionId,
      userId: user.id,
      createdAt: new Date(),
    })

    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
