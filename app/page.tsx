"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Car, LogOut, MapPin, Clock, CreditCard, QrCode,
  CheckCircle2, XCircle, RefreshCw, AlertCircle,
  ChevronDown, ChevronUp, Info, Search, CalendarCheck,
  Wallet, ScanLine, ArrowUp, ArrowDown, Radio,
  ShieldCheck, Zap,
} from "lucide-react"

import { ref, onValue } from "firebase/database"
import { db } from "@/lib/firebase"

const ParkingMap = dynamic(() => import("@/components/ParkingMap"), { ssr: false })

interface ParkingSlot {
  id: number
  name: string
  location: string
  price: number
  status: "available" | "reserved" | "occupied"
  reservedBy?: string
  reservedAt?: number
  paid?: boolean
  activeQrToken?: string
  checkedIn?: boolean
  bollardUp?: boolean
  activated?: boolean
}

const LOCATIONS = ["Session Road", "Harrison Road", "SM Baguio", "Cedar Peak", "Mabini"]

const DEFAULT_SLOTS: ParkingSlot[] = [
  { id: 1, name: "Slot 1", location: "Session Road", price: 50, status: "available" },
  { id: 2, name: "Slot 2", location: "Harrison Road", price: 45, status: "available" },
  { id: 3, name: "Slot 3", location: "SM Baguio", price: 60, status: "available" },
  { id: 4, name: "Slot 4", location: "Cedar Peak", price: 40, status: "available" },
  { id: 5, name: "Slot 5", location: "Mabini", price: 55, status: "available" },
]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [slots, setSlots] = useState<ParkingSlot[]>([])

  // 🔥 Convert Firebase object → array
  const formatSlots = (raw: any): ParkingSlot[] => {
    return Object.entries(raw || {}).map(([key, value]: any, index) => ({
      id: index + 1,
      name: `Slot ${index + 1}`,
      location: LOCATIONS[index],
      price: DEFAULT_SLOTS[index].price,
      ...value,
    }))
  }

  // 🔥 PATCH API (kept)
  const patchApi = async (slotId: number, patch: Partial<ParkingSlot>) => {
    try {
      await fetch(`/api/slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
    } catch {}
  }

  // 🔥 REAL-TIME FIREBASE SYNC (MAIN FIX)
  useEffect(() => {
    const userData = localStorage.getItem("surepark_user")
    if (!userData) {
      router.push("/login")
      return
    }

    setUser(JSON.parse(userData))

    const slotsRef = ref(db, "slots")

    const unsubscribe = onValue(slotsRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const formatted = formatSlots(data)
        setSlots(formatted)
      }
    })

    return () => unsubscribe()
  }, [router])

  // 🔥 RESERVE
  const handleReserve = async (slot: ParkingSlot) => {
    const patch = {
      status: "reserved" as const,
      reservedBy: user.email,
      reservedAt: Date.now(),
      bollardUp: true,
    }

    const updated = slots.map((s) =>
      s.id === slot.id ? { ...s, ...patch } : s
    )

    setSlots(updated)
    await patchApi(slot.id, patch)
  }

  // 🔥 BOLLARD CONTROL
  const handleBollardToggle = async (slot: ParkingSlot) => {
    const patch = { bollardUp: !slot.bollardUp }

    const updated = slots.map((s) =>
      s.id === slot.id ? { ...s, ...patch } : s
    )

    setSlots(updated)

    await fetch("/api/bollard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId: slot.id, bollardUp: patch.bollardUp }),
    })
  }

  if (!user) return <div>Loading...</div>

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <h1 className="text-2xl text-white mb-6">SurePark Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {slots.map((slot) => (
          <div key={slot.id} className="bg-slate-800 p-4 rounded-lg border">
            <h2 className="text-white font-bold">{slot.name}</h2>
            <p className="text-slate-400">{slot.location}</p>

            <p className="text-white mt-2">
              Status: <b>{slot.status}</b>
            </p>

            <p className="text-white">
              Bollard: <b>{slot.bollardUp ? "UP" : "DOWN"}</b>
            </p>

            <div className="flex gap-2 mt-3">
              {slot.status === "available" && (
                <button
                  onClick={() => handleReserve(slot)}
                  className="bg-blue-600 px-3 py-1 rounded text-white"
                >
                  Reserve
                </button>
              )}

              <button
                onClick={() => handleBollardToggle(slot)}
                className="bg-green-600 px-3 py-1 rounded text-white"
              >
                Toggle Bollard
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}