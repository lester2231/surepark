"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Car, MapPin
} from "lucide-react"

import { ref, onValue, update } from "firebase/database"
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
  bollardUp?: boolean
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
        setSlots(formatSlots(data))
      }
    })

    return () => unsubscribe()
  }, [router])

  // 🔥 RESERVE (DIRECT FIREBASE WRITE)
  const handleReserve = async (slot: ParkingSlot) => {
    await update(ref(db, `slots/slot${slot.id}`), {
      status: "reserved",
      reservedBy: user.email,
      reservedAt: Date.now(),
      bollardUp: true,
    })
  }

  // 🔥 BOLLARD CONTROL (DIRECT FIREBASE WRITE)
  const handleBollardToggle = async (slot: ParkingSlot) => {
    await update(ref(db, `slots/slot${slot.id}`), {
      bollardUp: !slot.bollardUp,
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