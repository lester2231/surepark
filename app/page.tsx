"use client"
import { ref, onValue, update } from "firebase/database"
import { db } from "@/lib/firebase"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Car, LogOut, MapPin, Clock, CreditCard, QrCode, CheckCircle2,
  XCircle, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Info,
  Search, CalendarCheck, Wallet, Zap, ArrowUp, ArrowDown, Radio, ShieldCheck
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
  id: number; name: string; location: string; price: number;
  status: "available" | "reserved" | "occupied";
  reservedBy?: string; reservedAt?: number; paid?: boolean;
  activeQrToken?: string; bollardUp?: boolean;
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
  const [showScanner, setShowScanner] = useState(false)
  const [showTips, setShowTips] = useState(true)

  // 1. AUTH & REAL-TIME FIREBASE SYNC
  useEffect(() => {
    const userData = localStorage.getItem("surepark_user")
    if (!userData) { router.push("/login"); return }
    setUser(JSON.parse(userData))

    // Real-time listener: This detects the car instantly when ESP32 updates Firebase
    const unsubscribe = onValue(ref(db, "slots"), (snapshot) => {
      const data = snapshot.val()
      if (!data) { setSlots(DEFAULT_SLOTS); return }

      const formatted = Object.keys(data).map((key, index) => ({
        id: index + 1,
        name: `Slot ${index + 1}`,
        location: LOCATIONS[index] || "Baguio",
        price: DEFAULT_SLOTS[index]?.price || 50,
        ...data[key],
      }))

      setSlots(formatted)
      
      // Update the modal if it's currently open for a specific slot
      if (selectedSlot) {
        const updated = formatted.find((s) => s.id === selectedSlot.id)
        if (updated) setSelectedSlot(updated)
      }
    })

    return () => unsubscribe()
  }, [router, selectedSlot?.id])

  // 2. ACTIONS (Updating Firebase directly)
  const handleReserve = async (slot: ParkingSlot) => {
    if (!user || slot.status !== "available") return
    await update(ref(db, `slots/slot${slot.id}`), {
      status: "reserved",
      reservedBy: user.email,
      reservedAt: Date.now(),
      bollardUp: true,
    })
  }

  const handlePayment = async (slot: ParkingSlot) => {
    const qrToken = `SP-${slot.id}-${Date.now().toString(36).toUpperCase()}`
    await update(ref(db, `slots/slot${slot.id}`), { paid: true, activeQrToken: qrToken })
  }

  const handleBollardToggle = async (slot: ParkingSlot) => {
    await update(ref(db, `slots/slot${slot.id}`), { bollardUp: !slot.bollardUp })
  }

  const handleReset = async () => {
    const resetData: any = {}
    [1,2,3,4,5].forEach((id) => {
      resetData[`slot${id}`] = { status: "available", bollardUp: true, paid: false, reservedBy: null }
    })
    await update(ref(db, "slots"), resetData)
  }

  const getTimeRemaining = (reservedAt: number) => {
    const remaining = 15 * 60 * 1000 - (Date.now() - reservedAt)
    if (remaining <= 0) return "Expired"
    const mins = Math.floor(remaining / 60000)
    const secs = Math.floor((remaining % 60000) / 1000)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const filteredSlots = selectedLocation === "All" ? slots : slots.filter((s) => s.location === selectedLocation)
  const stats = {
    available: filteredSlots.filter((s) => s.status === "available").length,
    reserved: filteredSlots.filter((s) => s.status === "reserved").length,
    occupied: filteredSlots.filter((s) => s.status === "occupied").length,
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Car className="w-10 h-10 text-blue-500" />
            <h1 className="text-2xl font-bold">SurePark Dashboard</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={handleReset} className="px-4 py-2 bg-slate-700 rounded-lg flex items-center gap-2"><RefreshCw size={16}/> Reset</button>
            <button onClick={() => {localStorage.removeItem("surepark_user"); router.push("/login")}} className="px-4 py-2 bg-red-600 rounded-lg flex items-center gap-2"><LogOut size={16}/> Logout</button>
          </div>
        </div>

        {/* Filters and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <label className="text-xs text-slate-400 uppercase font-bold">Filter Location</label>
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full bg-transparent outline-none mt-1">
              <option value="All">All Locations</option>
              {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl text-center">
            <p className="text-xs text-green-400 font-bold">AVAILABLE: {stats.available}</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-center">
            <p className="text-xs text-yellow-400 font-bold">RESERVED: {stats.reserved}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-center">
            <p className="text-xs text-red-400 font-bold">OCCUPIED: {stats.occupied}</p>
          </div>
        </div>

        {/* Slots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className={`p-6 rounded-2xl border bg-slate-800/50 ${slot.status === 'available' ? 'border-green-500/30' : slot.status === 'reserved' ? 'border-yellow-500/30' : 'border-red-500/30'}`}>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">{slot.name}</h3>
                <span className={`px-2 py-1 rounded text-[10px] font-bold ${slot.status === 'available' ? 'bg-green-500/20 text-green-400' : slot.status === 'reserved' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{slot.status.toUpperCase()}</span>
              </div>
              <p className="text-slate-400 text-sm mb-4">{slot.location}</p>
              <div className="flex gap-2">
                <button onClick={() => setSelectedSlot(slot)} className="flex-1 py-2 bg-slate-700 rounded-lg text-sm">View</button>
                {slot.status === 'available' && <button onClick={() => handleReserve(slot)} className="flex-1 py-2 bg-blue-600 rounded-lg text-sm">Reserve</button>}
              </div>
            </div>
          ))}
        </div>

        {/* Map */}
        <ParkingMap slots={slots} onLocationClick={setSelectedLocation} selectedLocation={selectedLocation} />

        {/* Modal */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50] flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">{selectedSlot.name}</h2>
                <button onClick={() => setSelectedSlot(null)}><XCircle/></button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-slate-900 p-4 rounded-xl flex justify-between">
                  <span className="text-slate-400">Current Status</span>
                  <span className="font-bold text-blue-400 uppercase">{selectedSlot.status}</span>
                </div>

                {selectedSlot.status === 'reserved' && !selectedSlot.paid && selectedSlot.reservedBy === user.email && (
                  <button onClick={() => handlePayment(selectedSlot)} className="w-full py-4 bg-blue-600 rounded-xl font-bold">Pay ₱{selectedSlot.price}</button>
                )}

                {selectedSlot.paid && (
                  <div className="p-4 border border-slate-700 rounded-xl space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Bollard Status</span>
                      <span className={`text-xs font-bold ${selectedSlot.bollardUp ? 'text-red-400' : 'text-green-400'}`}>{selectedSlot.bollardUp ? 'RAISED' : 'LOWERED'}</span>
                    </div>
                    <button onClick={() => handleBollardToggle(selectedSlot)} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${selectedSlot.bollardUp ? 'bg-green-600' : 'bg-red-600'}`}>
                      {selectedSlot.bollardUp ? <><ArrowDown size={18}/> Lower Bollard</> : <><ArrowUp size={18}/> Raise Bollard</>}
                    </button>
                    {selectedSlot.status === 'occupied' && (
                      <p className="text-[10px] text-center text-slate-500 uppercase tracking-widest"><ShieldCheck className="inline w-3 h-3"/> Car Detected by Hardware</p>
                    )}
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