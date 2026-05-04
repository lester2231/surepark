import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { ref, update } from "firebase/database"

export async function POST() {
  try {
    // 🔥 reset ALL slots
    const resetData = {
      slot1: { status: "available", bollardUp: true, paid: false, reservedBy: "" },
      slot2: { status: "available", bollardUp: true, paid: false, reservedBy: "" },
      slot3: { status: "available", bollardUp: true, paid: false, reservedBy: "" },
      slot4: { status: "available", bollardUp: true, paid: false, reservedBy: "" },
      slot5: { status: "available", bollardUp: true, paid: false, reservedBy: "" },
    }

    await update(ref(db, "slots"), resetData)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Reset failed" }, { status: 500 })
  }
}