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

    // This listener makes car detection instant
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
      
      if (selectedSlot) {
        const updated = formatted.find((s) => s.id === selectedSlot.id)
        if (updated) setSelectedSlot(updated)
      }
    })

    return () => unsubscribe()
  }, [router, selectedSlot?.id])

  // 2. ACTIONS
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
    const resetData: Record<string, any> = {} // Fixed TypeScript build error
    const ids = [1, 2, 3, 4, 5]
    ids.forEach((id) => {
      resetData[`slot${id}`] = { 
        status: "available", 
        bollardUp: true, 
        paid: false, 
        reservedBy: null 
      }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">SurePark Baguio</h1>
              <p className="text-slate-400 text-sm">Welcome, {user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all text-sm font-medium">
              <RefreshCw className="w-4 h-4" /> Reset
            </button>
            <button onClick={() => { localStorage.removeItem("surepark_user"); router.push("/login") }} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-all text-sm font-medium">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-900/30 border border-green-700/50 p-6 rounded-2xl text-center">
            <p className="text-xs text-green-400 font-bold uppercase tracking-wider mb-1">Available</p>
            <p className="text-3xl font-bold">{stats.available}</p>
          </div>
          <div className="bg-yellow-900/30 border border-yellow-700/50 p-6 rounded-2xl text-center">
            <p className="text-xs text-yellow-400 font-bold uppercase tracking-wider mb-1">Reserved</p>
            <p className="text-3xl font-bold">{stats.reserved}</p>
          </div>
          <div className="bg-red-900/30 border border-red-700/50 p-6 rounded-2xl text-center">
            <p className="text-xs text-red-400 font-bold uppercase tracking-wider mb-1">Occupied</p>
            <p className="text-3xl font-bold">{stats.occupied}</p>
          </div>
        </div>

        {/* Slot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className={`bg-slate-800/80 backdrop-blur border rounded-2xl p-6 transition-all hover:translate-y-[-4px] ${
              slot.status === 'available' ? 'border-green-500/30' : 
              slot.status === 'reserved' ? 'border-yellow-500/30' : 'border-red-500/30'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{slot.name}</h3>
                  <div className="flex items-center gap-1 text-slate-400 text-sm mt-1">
                    <MapPin size={14}/> {slot.location}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  slot.status === 'available' ? 'bg-green-500/20 text-green-400' : 
                  slot.status === 'reserved' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {slot.status}
                </span>
              </div>
              <div className="text-3xl font-bold mb-6 text-white">₱{slot.price}<span className="text-sm text-slate-500 font-normal"> /hour</span></div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedSlot(slot)} className="flex-1 bg-slate-700 hover:bg-slate-600 py-3 rounded-xl text-sm font-bold transition-all text-white">View</button>
                {slot.status === 'available' && (
                  <button onClick={() => handleReserve(slot)} className="flex-1 bg-blue-600 hover:bg-blue-500 py-3 rounded-xl text-sm font-bold transition-all text-white">Reserve</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="rounded-3xl overflow-hidden border border-slate-700 shadow-2xl">
          <ParkingMap slots={slots} onLocationClick={setSelectedLocation} selectedLocation={selectedLocation} />
        </div>

        {/* Slot Detail Modal */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">{selectedSlot.name}</h2>
                <button onClick={() => setSelectedSlot(null)} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
                  <XCircle className="text-slate-400 hover:text-white" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Status</p>
                    <p className="font-bold text-blue-400 uppercase">{selectedSlot.status}</p>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Price</p>
                    <p className="font-bold text-white">₱{selectedSlot.price}</p>
                  </div>
                </div>

                {selectedSlot.paid && (
                  <div className="bg-slate-900 p-6 rounded-2xl border border-blue-500/20 space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-bold text-white uppercase">Bollard Control</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${selectedSlot.bollardUp ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                        {selectedSlot.bollardUp ? 'RAISED' : 'LOWERED'}
                      </span>
                    </div>
                    <button onClick={() => handleBollardToggle(selectedSlot)} className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                      selectedSlot.bollardUp ? 'bg-green-600 hover:bg-green-500 shadow-green-900/20' : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                    }`}>
                      {selectedSlot.bollardUp ? <><ArrowDown size={18}/> Lower Bollard</> : <><ArrowUp size={18}/> Raise Bollard</>}
                    </button>
                    {selectedSlot.status === 'occupied' && (
                       <p className="text-[10px] text-center text-green-400 flex items-center justify-center gap-1.5 font-bold uppercase tracking-widest">
                         <ShieldCheck className="w-3.5 h-3.5"/> Car Detected by Sensor
                       </p>
                    )}
                  </div>
                )}
                
                {selectedSlot.status === 'reserved' && !selectedSlot.paid && selectedSlot.reservedBy === user.email && (
                  <div className="space-y-4">
                     <p className="text-xs text-yellow-400 text-center font-medium bg-yellow-400/10 py-2 rounded-lg border border-yellow-400/20">
                       Time left: {getTimeRemaining(selectedSlot.reservedAt!)}
                     </p>
                     <button onClick={() => handlePayment(selectedSlot)} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold text-lg text-white shadow-xl shadow-blue-900/20 transition-all">
                       Pay ₱{selectedSlot.price} Now
                     </button>
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