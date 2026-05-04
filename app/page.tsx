"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Car, LogOut, MapPin, Clock, CreditCard, QrCode, CheckCircle2,
  XCircle, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Info,
  Search, CalendarCheck, Wallet, ArrowUp, ArrowDown, Radio,
  ShieldCheck, Zap
} from "lucide-react"

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
  id: number;
  name: string;
  location: string;
  price: number;
  status: "available" | "reserved" | "occupied";
  reservedBy?: string;
  reservedAt?: number;
  paid?: boolean;
  activeQrToken?: string;
  checkedIn?: boolean;
  bollardUp?: boolean;
  activated?: boolean;
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

  const syncSlots = (updated: ParkingSlot[]) => {
    setSlots(updated)
    localStorage.setItem("surepark_slots", JSON.stringify(updated))
  }

  const patchApi = async (slotId: number, patch: Partial<ParkingSlot>) => {
    try {
      await fetch(`/api/slots/${slotId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
    } catch { /* Offline Fallback */ }
  }

  useEffect(() => {
    const userData = localStorage.getItem("surepark_user")
    if (!userData) { router.push("/login"); return }
    setUser(JSON.parse(userData))

    fetch("/api/slots")
      .then((r) => r.json())
      .then((apiSlots: ParkingSlot[]) => {
        setSlots(apiSlots)
        localStorage.setItem("surepark_slots", JSON.stringify(apiSlots))
      })
      .catch(() => {
        const saved = localStorage.getItem("surepark_slots")
        setSlots(saved ? JSON.parse(saved) : DEFAULT_SLOTS)
      })
  }, [router])

  const selectedSlotRef = useRef<ParkingSlot | null>(null)
  selectedSlotRef.current = selectedSlot

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/slots", { cache: "no-store" })
        const fresh = (await res.json()) as ParkingSlot[]
        setSlots((prev) => {
          if (JSON.stringify(fresh) === JSON.stringify(prev)) return prev
          localStorage.setItem("surepark_slots", JSON.stringify(fresh))
          const sel = selectedSlotRef.current
          if (sel) {
            const updated = fresh.find((s) => s.id === sel.id)
            if (updated) setSelectedSlot(updated)
          }
          return fresh
        })
      } catch { /* API Unreachable */ }
    }, 500)
    return () => clearInterval(poll)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setSlots((prev) => {
        const now = Date.now()
        const next = prev.map((s) => {
          if (s.status === "reserved" && !s.checkedIn && s.reservedAt && now - s.reservedAt > 15 * 60 * 1000) {
            const reset: ParkingSlot = { id: s.id, name: s.name, location: s.location, price: s.price, status: "available" }
            patchApi(s.id, reset)
            return reset
          }
          return s
        })
        if (JSON.stringify(next) !== JSON.stringify(prev)) {
          localStorage.setItem("surepark_slots", JSON.stringify(next))
          return next
        }
        return prev
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleReserve = async (slot: ParkingSlot) => {
    if (slot.status !== "available") return
    const patch = { status: "reserved" as const, reservedBy: user.email, reservedAt: Date.now(), bollardUp: true }
    const updated = slots.map((s) => s.id === slot.id ? { ...s, ...patch } : s)
    syncSlots(updated)
    setSelectedSlot(updated.find((s) => s.id === slot.id) || null)
    await patchApi(slot.id, patch)
  }

  const handlePayment = async (slot: ParkingSlot) => {
    if (!slot.reservedBy || slot.reservedBy !== user.email) return
    const qrToken = `SP-${slot.id}-${Date.now().toString(36).toUpperCase()}`
    const patch = { paid: true, activeQrToken: qrToken }
    const updated = slots.map((s) => s.id === slot.id ? { ...s, ...patch } : s)
    syncSlots(updated)
    setSelectedSlot(updated.find((s) => s.id === slot.id) || null)
    await patchApi(slot.id, patch)
  }

  const handleBollardToggle = async (slot: ParkingSlot) => {
    if (!slot.paid || slot.status !== "reserved") return
    const newBollardUp = !slot.bollardUp
    const patch = { bollardUp: newBollardUp }
    const updated = slots.map((s) => s.id === slot.id ? { ...s, ...patch } : s)
    syncSlots(updated)
    setSelectedSlot(updated.find((s) => s.id === slot.id) || null)
    try {
      await fetch("/api/bollard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId: slot.id, bollardUp: newBollardUp }),
      })
    } catch { /* Offline */ }
  }

  const handleLogout = () => {
    localStorage.removeItem("surepark_user")
    router.push("/login")
  }

  const handleReset = async () => {
    try { await fetch("/api/slots/reset", { method: "POST" }) } catch { /* Offline */ }
    setSlots(DEFAULT_SLOTS)
    localStorage.setItem("surepark_slots", JSON.stringify(DEFAULT_SLOTS))
    setSelectedSlot(null)
    setScanResult(null)
  }

  const filteredSlots = selectedLocation === "All" ? slots : slots.filter((s) => s.location === selectedLocation)
  const stats = {
    available: filteredSlots.filter((s) => s.status === "available").length,
    reserved: filteredSlots.filter((s) => s.status === "reserved").length,
    occupied: filteredSlots.filter((s) => s.status === "occupied").length,
  }

  const getTimeRemaining = (reservedAt: number) => {
    const remaining = 15 * 60 * 1000 - (Date.now() - reservedAt)
    if (remaining <= 0) return "Expired"
    const mins = Math.floor(remaining / 60000)
    const secs = Math.floor((remaining % 60000) / 1000)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg"><Car className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">SurePark Baguio</h1>
              <p className="text-slate-400 text-sm">Welcome, {user.name || user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowScanner(!showScanner)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"><QrCode size={16}/> Scanner</button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"><RefreshCw size={16}/> Reset</button>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"><LogOut size={16}/> Logout</button>
          </div>
        </div>

        {/* How to Use */}
        <div className="mb-6 rounded-xl border border-blue-800/60 bg-blue-950/40 overflow-hidden">
          <button onClick={() => setShowTips(!showTips)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-blue-900/20 transition-colors">
            <div className="flex items-center gap-2.5">
              <Info className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 font-semibold text-sm tracking-wide uppercase">How to Use SurePark</span>
            </div>
            {showTips ? <ChevronUp size={16} className="text-blue-400" /> : <ChevronDown size={16} className="text-blue-400" />}
          </button>
          {showTips && (
            <div className="px-5 pb-5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { step: "1", icon: <Search size={16} className="text-blue-400"/>, title: "Find a Slot", desc: "Use the Filter by Location dropdown or click a map pin below to browse parking slots. Green pins mean the slot is available.", color: "bg-blue-600/30 border-blue-500/40" },
                  { step: "2", icon: <CalendarCheck size={16} className="text-green-400"/>, title: "Reserve the Slot", desc: "Click View on any Available (green) slot card, then press Reserve. The slot turns yellow (Reserved). You have 15 minutes to complete payment.", color: "bg-green-600/20 border-green-500/40" },
                  { step: "3", icon: <Wallet size={16} className="text-yellow-400"/>, title: "Pay the Ticket", desc: "Inside the slot details, select your payment method then press Pay Now. A unique QR token is generated and the slot stays Reserved.", color: "bg-yellow-600/20 border-yellow-500/40" },
                  { step: "4", icon: <Zap size={16} className="text-orange-400"/>, title: "Control the Bollard", desc: "After payment, the Bollard Control panel unlocks. Press Lower Bollard to allow your vehicle to enter the slot.", color: "bg-orange-600/20 border-orange-500/40" },
                  { step: "5", icon: <Radio size={16} className="text-purple-400"/>, title: "Car Detected — Occupied", desc: "Once your vehicle enters the slot, the ultrasonic sensor detects it and automatically updates the status to Occupied.", color: "bg-purple-600/20 border-purple-500/40" },
                  { step: "6", icon: <Car size={16} className="text-slate-400"/>, title: "Exit & Free the Slot", desc: "When your vehicle leaves, the sensor detects the empty space and automatically resets the slot back to Available.", color: "bg-slate-600/30 border-slate-500/40" },
                ].map((s) => (
                  <div key={s.step} className="flex gap-3 bg-slate-800/60 rounded-lg p-4 border border-slate-700/50">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center ${s.color}`}><span className="text-xs font-bold text-white">{s.step}</span></div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">{s.icon}<span className="text-white text-sm font-semibold">{s.title}</span></div>
                      <p className="text-slate-400 text-xs leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Updated Status Legend */}
              <div className="mt-4 pt-3 border-t border-slate-700/60">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">Slot Status Colors</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    Green — Available, ready to reserve
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    Yellow — Reserved, awaiting vehicle or payment
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-900/30 border border-green-700 rounded-xl p-6 flex items-center justify-between shadow-lg">
            <div><p className="text-green-400 text-sm font-medium">Available</p><p className="text-4xl font-bold text-white mt-1">{stats.available}</p></div>
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-6 flex items-center justify-between shadow-lg">
            <div><p className="text-yellow-400 text-sm font-medium">Reserved</p><p className="text-4xl font-bold text-white mt-1">{stats.reserved}</p></div>
            <Clock className="w-10 h-10 text-yellow-500" />
          </div>
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 flex items-center justify-between shadow-lg">
            <div><p className="text-red-400 text-sm font-medium">Occupied</p><p className="text-4xl font-bold text-white mt-1">{stats.occupied}</p></div>
            <Car className="w-10 h-10 text-red-500" />
          </div>
        </div>

        {/* Filters & Grid */}
        <div className="mb-6">
          <div className="relative w-full sm:w-72">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full appearance-none bg-slate-800 border border-slate-600 text-white rounded-xl pl-9 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Locations</option>
              {LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className={`rounded-lg p-6 border transition-colors ${slot.status === "available" ? "bg-slate-800 border-green-700/60" : slot.status === "reserved" ? "bg-slate-800 border-yellow-700/60" : "bg-red-950/30 border-red-700/60"}`}>
              <div className="flex justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{slot.name}</h3>
                  <p className="text-slate-400 text-sm">{slot.location}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${slot.status === "available" ? "bg-green-900/50 text-green-400" : slot.status === "reserved" ? "bg-yellow-900/50 text-yellow-400" : "bg-red-900/50 text-red-400"}`}>{slot.status.toUpperCase()}</span>
              </div>
              <p className="text-2xl font-bold text-white mb-4">₱{slot.price}<span className="text-sm font-normal text-slate-400">/hour</span></p>
              <div className="flex gap-2">
                <button onClick={() => setSelectedSlot(slot)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">View</button>
                {slot.status === "available" && <button onClick={() => handleReserve(slot)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Reserve</button>}
              </div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="mt-10">
          <button onClick={() => setShowMap(!showMap)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg mb-4"><MapPin size={16}/> {showMap ? "Hide Map" : "Show Map"}</button>
          {showMap && <ParkingMap slots={slots} onLocationClick={setSelectedLocation} selectedLocation={selectedLocation} />}
        </div>

        {/* Modal */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[2000]">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between mb-6">
                <div><h3 className="text-2xl font-bold text-white">{selectedSlot.name}</h3><p className="text-slate-400">{selectedSlot.location}</p></div>
                <button onClick={() => setSelectedSlot(null)}><XCircle className="text-slate-400 hover:text-white" /></button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900 p-4 rounded-lg"><p className="text-slate-400 text-sm mb-1">Status</p><span className="text-yellow-400 font-bold">{selectedSlot.status.toUpperCase()}</span></div>
                <div className="bg-slate-900 p-4 rounded-lg"><p className="text-slate-400 text-sm mb-1">Price</p><p className="text-2xl font-bold text-white">₱{selectedSlot.price}/hour</p></div>

                {selectedSlot.reservedBy === user.email && !selectedSlot.paid && (
                  <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-700">
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-slate-900 text-white p-2 rounded-lg mb-3 border border-slate-700">
                      <option value="GCash">GCash</option><option value="Maya">Maya</option><option value="Card">Card</option>
                    </select>
                    <button onClick={() => handlePayment(selectedSlot)} className="w-full bg-blue-600 py-3 text-white rounded-lg font-bold">Pay Now</button>
                  </div>
                )}

                {selectedSlot.paid && (
                  <div className="space-y-4">
                    <div className="bg-green-900/30 p-4 rounded-lg border border-green-700">
                      <p className="text-white text-sm font-bold mb-2">Your QR Token</p>
                      <p className="text-lg font-mono text-white bg-slate-900 p-2 rounded select-all">{selectedSlot.activeQrToken}</p>
                      {selectedSlot.reservedAt && <p className="text-xs text-yellow-400 mt-2">Time remaining: {getTimeRemaining(selectedSlot.reservedAt)}</p>}
                    </div>

                    <div className="bg-slate-900/80 p-4 rounded-lg border border-slate-600">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-white font-bold text-sm">Bollard Control</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${selectedSlot.bollardUp ? "bg-red-600 text-white" : "bg-green-600 text-white"}`}>{selectedSlot.bollardUp ? "RAISED" : "LOWERED"}</span>
                      </div>
                      <div className="flex justify-center mb-4">
                        <div className={`w-8 rounded-t transition-all duration-500 ${selectedSlot.bollardUp ? "h-16 bg-red-600" : "h-4 bg-green-600"}`} />
                      </div>
                      <button onClick={() => handleBollardToggle(selectedSlot)} className={`w-full py-2.5 rounded-lg font-bold text-sm ${selectedSlot.bollardUp ? "bg-green-600" : "bg-red-600"} text-white`}>
                        {selectedSlot.bollardUp ? "Lower Bollard" : "Raise Bollard"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}