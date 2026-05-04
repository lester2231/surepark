import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { ref, update } from "firebase/database"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const { slotId, bollardUp } = body

    // 🔥 FIX: use value from frontend (NOT hardcoded)
    await update(ref(db, `slots/slot${slotId}`), {
      bollardUp: bollardUp,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to update bollard" }, { status: 500 })
  }
}