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

import { ref, onValue, update } from "firebase/database"
import { db } from "@/lib/firebase"

const ParkingMap = dynamic(() => import("@/components/ParkingMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[440px] rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading map...</p>
      </div>
    </div>
  ),
})

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
  const [selectedLocation, setSelectedLocation] = useState<string>("All")
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string>("GCash")
  const [qrInput, setQrInput] = useState("")
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [showMap, setShowMap] = useState(true)
  const [showTips, setShowTips] = useState(true)

  // 🔥 REAL-TIME FIREBASE (replaces API + polling)
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
      console.log("🔥 Firebase data:", data)

      if (data) {
        const formatted = Object.entries(data).map(([key, value]: any, index) => ({
          id: index + 1,
          name: `Slot ${index + 1}`,
          location: LOCATIONS[index],
          price: DEFAULT_SLOTS[index].price,
          ...value,
        }))
        setSlots(formatted)
      } else {
        setSlots(DEFAULT_SLOTS)
      }
    })

    return () => unsubscribe()
  }, [router])

  // ── actions now write directly to Firebase ────────────────────────────────
  const handleReserve = async (slot: ParkingSlot) => {
    if (slot.status !== "available") return
    await update(ref(db, `slots/slot${slot.id}`), {
      status: "reserved",
      reservedBy: user.email,
      reservedAt: Date.now(),
      bollardUp: true,
    })
  }

  const handlePayment = async (slot: ParkingSlot) => {
    if (!slot.reservedBy || slot.reservedBy !== user.email) return
    const qrToken = `SP-${slot.id}-${Date.now().toString(36).toUpperCase()}`
    await update(ref(db, `slots/slot${slot.id}`), {
      paid: true,
      activeQrToken: qrToken,
    })
  }

  const handleScanQr = async () => {
    setScanResult(null)
    if (!qrInput.trim()) {
      setScanResult({ success: false, message: "Please enter a QR token" })
      return
    }
    const slot = slots.find((s) => s.activeQrToken === qrInput.trim())
    if (!slot) {
      setScanResult({ success: false, message: "Invalid QR token" })
      return
    }
    if (slot.status !== "reserved") {
      setScanResult({ success: false, message: "Slot is not reserved" })
      return
    }
    if (!slot.paid) {
      setScanResult({ success: false, message: "Payment not completed" })
      return
    }
    if (slot.reservedAt && Date.now() - slot.reservedAt > 15 * 60 * 1000) {
      setScanResult({ success: false, message: "Reservation expired" })
      return
    }

    await update(ref(db, `slots/slot${slot.id}`), {
      status: "occupied",
      checkedIn: true,
    })

    setScanResult({ success: true, message: `Check-in successful! ${slot.name} is now occupied.` })
    setQrInput("")
  }

  const handleReset = async () => {
    const updates: any = {}
    DEFAULT_SLOTS.forEach((s) => {
      updates[`slot${s.id}`] = {
        status: "available",
        reservedBy: null,
        reservedAt: null,
        paid: false,
        activeQrToken: null,
        checkedIn: false,
        bollardUp: true,
      }
    })
    await update(ref(db, "slots"), updates)
    setSelectedSlot(null)
    setScanResult(null)
  }

  const handleBollardToggle = async (slot: ParkingSlot) => {
    if (!slot.paid || slot.status !== "reserved") return
    await update(ref(db, `slots/slot${slot.id}`), {
      bollardUp: !slot.bollardUp,
    })
  }

  const handleCarLeft = async (slot: ParkingSlot) => {
    if (slot.status !== "occupied") return
    await update(ref(db, `slots/slot${slot.id}`), {
      status: "available",
      reservedBy: null,
      reservedAt: null,
      paid: false,
      activeQrToken: null,
      checkedIn: false,
      bollardUp: true,
    })
    setSelectedSlot(null)
  }

  const handleCarDetected = async (slot: ParkingSlot) => {
    if (slot.status !== "reserved" || !slot.paid) return
    await update(ref(db, `slots/slot${slot.id}`), {
      status: "occupied",
      checkedIn: true,
      bollardUp: true,
    })
  }

  const handleLogout = () => {
    localStorage.removeItem("surepark_user")
    router.push("/login")
  }

  const filteredSlots =
    selectedLocation === "All"
      ? slots
      : slots.filter((s) => s.location === selectedLocation)

  const stats = {
    available: filteredSlots.filter((s) => s.status === "available").length,
    reserved: filteredSlots.filter((s) => s.status === "reserved").length,
    occupied: filteredSlots.filter((s) => s.status === "occupied").length,
  }

  const myReservations = slots.filter(
    (s) => s.reservedBy === user?.email && s.status === "reserved"
  )

  const getTimeRemaining = (reservedAt: number) => {
    const elapsed = Date.now() - reservedAt
    const remaining = 15 * 60 * 1000 - elapsed
    if (remaining <= 0) return "Expired"
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">SurePark Baguio</h1>
              <p className="text-slate-400 text-sm">Welcome, {user.name || user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowScanner(!showScanner)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <QrCode className="w-4 h-4" />
              Scanner
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {/* QR Scanner Panel */}
        {showScanner && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <QrCode className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-bold text-white">QR Code Scanner</h2>
            </div>
            <div className="space-y-4">
              <input
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
                placeholder="Paste QR Token"
              />
              <button onClick={handleScanQr} className="w-full bg-green-600 py-3 rounded-lg text-white">
                Validate & Check In
              </button>
              {scanResult && <p className="text-sm">{scanResult.message}</p>}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-white">Available: {stats.available}</div>
          <div className="text-white">Reserved: {stats.reserved}</div>
          <div className="text-white">Occupied: {stats.occupied}</div>
        </div>

        {/* Slots */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className="bg-slate-800 p-6 rounded-lg">
              <h3 className="text-white font-bold">{slot.name}</h3>
              <p className="text-slate-400">{slot.location}</p>
              <p className="text-white">{slot.status}</p>

              <div className="flex gap-2 mt-4">
                {slot.status === "available" && (
                  <button onClick={() => handleReserve(slot)} className="bg-blue-600 px-3 py-1 text-white">
                    Reserve
                  </button>
                )}
                {slot.status === "reserved" && (
                  <button onClick={() => handlePayment(slot)} className="bg-yellow-600 px-3 py-1 text-white">
                    Pay
                  </button>
                )}
                <button onClick={() => handleBollardToggle(slot)} className="bg-green-600 px-3 py-1 text-white">
                  Toggle Bollard
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}