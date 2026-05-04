import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { ref, update } from "firebase/database"

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const body = await req.json()

    // 🔥 convert 2 → slot2
    const slotKey = `slot${id}`

    await update(ref(db, `slots/${slotKey}`), body)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}