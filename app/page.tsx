"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { ref, onValue, update } from "firebase/database"
import { db } from "@/lib/firebase"
import {
  Car, LogOut, MapPin, Clock, CreditCard, QrCode, CheckCircle2,
  XCircle, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Info,
  Search, CalendarCheck, Wallet, ScanLine, ArrowUp, ArrowDown,
  Radio, ShieldCheck, Zap
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
  reservedBy?: string; reservedAt?: number;
  paid?: boolean; activeQrToken?: string;
  bollardUp?: boolean;
}

const LOCATIONS = ["Session Road", "Harrison Road", "SM Baguio", "Cedar Peak", "Mabini"]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [slots, setSlots] = useState<ParkingSlot[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("All")
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string>("GCash")
  const [showScanner, setShowScanner] = useState(false)
  const [showMap, setShowMap] = useState(true)
  const [showTips, setShowTips] = useState(true)
  const [qrInput, setQrInput] = useState("")
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    const userData = localStorage.getItem("surepark_user")
    if (!userData) { router.push("/login"); return }
    setUser(JSON.parse(userData))

    const unsubscribe = onValue(ref(db, "slots"), (snapshot) => {
      const data = snapshot.val()
      if (!data) return
      const formatted = Object.keys(data).map((key, index) => ({
        id: index + 1,
        name: `Slot ${index + 1}`,
        location: LOCATIONS[index] || "Baguio City",
        price: 50,
        ...data[key],
      }))
      setSlots(formatted)
      if (selectedSlot) {
        const updated = formatted.find(s => s.id === selectedSlot.id)
        if (updated) setSelectedSlot(updated)
      }
    })
    return () => unsubscribe()
  }, [router, selectedSlot?.id])

  const handleReset = async () => {
    const resetData: Record<string, any> = {};
    [1, 2, 3, 4, 5].forEach((id) => {
      resetData[`slot${id}`] = { status: "available", bollardUp: true, reservedBy: null, paid: false, activeQrToken: null }
    })
    await update(ref(db, "slots"), resetData)
  }

  const handleReserve = async (slot: ParkingSlot) => {
    await update(ref(db, `slots/slot${slot.id}`), { 
      status: "reserved", 
      reservedBy: user.email,
      reservedAt: Date.now(),
      bollardUp: true
    })
  }

  const handlePayment = async (slot: ParkingSlot) => {
    const qrToken = `SP-${slot.id}-${Date.now().toString(36).toUpperCase()}`
    await update(ref(db, `slots/slot${slot.id}`), { paid: true, activeQrToken: qrToken })
  }

  const handleBollardToggle = async (slot: ParkingSlot) => {
    if (slot.status === 'occupied') return
    await update(ref(db, `slots/slot${slot.id}`), { bollardUp: !slot.bollardUp })
  }

  const handleScanQr = async () => {
    setScanResult(null)
    const slot = slots.find((s) => s.activeQrToken === qrInput.trim())
    if (!slot || slot.status !== "reserved" || !slot.paid) {
      setScanResult({ success: false, message: "Invalid or unpaid QR token" })
      return
    }
    await update(ref(db, `slots/slot${slot.id}`), { status: "occupied", bollardUp: true })
    setScanResult({ success: true, message: `Check-in successful!` })
    setQrInput("")
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
    available: slots.filter((s) => s.status === "available").length,
    reserved: slots.filter((s) => s.status === "reserved").length,
    occupied: slots.filter((s) => s.status === "occupied").length,
  }
  const myReservations = slots.filter(s => s.reservedBy === user?.email && s.status === "reserved")

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg"><Car className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold">SurePark Baguio</h1>
              <p className="text-slate-400 text-sm">Welcome, {user.email.split('@')[0]}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowScanner(!showScanner)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition-colors"><QrCode size={18}/> Scanner</button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors"><RefreshCw size={18}/> Reset</button>
            <button onClick={() => { localStorage.removeItem("surepark_user"); router.push("/login") }} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition-colors"><LogOut size={18}/> Logout</button>
          </div>
        </div>

        {/* Complete Guide Section */}
        <div className="mb-6 rounded-xl border border-blue-800/60 bg-blue-950/40 overflow-hidden">
          <button onClick={() => setShowTips(!showTips)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-blue-900/20 transition-colors">
            <div className="flex items-center gap-2.5">
              <Info className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 font-semibold text-sm tracking-wide uppercase">How to Use SurePark</span>
            </div>
            {showTips ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showTips && (
            <div className="px-5 pb-5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { step: "1", icon: <Search size={16}/>, title: "Find a Slot", desc: "Use the filter or map pins. Green means available.", color: "bg-blue-600/30 border-blue-500/40" },
                  { step: "2", icon: <CalendarCheck size={16}/>, title: "Reserve the Slot", desc: "Click Reserve. You have 15 minutes to pay.", color: "bg-green-600/20 border-green-500/40" },
                  { step: "3", icon: <Wallet size={16}/>, title: "Pay the Ticket", desc: "Pay via GCash or Maya to generate a token.", color: "bg-yellow-600/20 border-yellow-500/40" },
                  { step: "4", icon: <Zap size={16}/>, title: "Control the Bollard", desc: "Lower the bollard to enter the slot.", color: "bg-orange-600/20 border-orange-500/40" },
                  { step: "5", icon: <Radio size={16}/>, title: "Car Detected", desc: "Sensor updates status to Occupied automatically.", color: "bg-purple-600/20 border-purple-500/40" },
                  { step: "6", icon: <Car size={16}/>, title: "Exit & Free", desc: "When you leave, the slot resets to Available.", color: "bg-slate-600/30 border-slate-500/40" },
                ].map((s) => (
                  <div key={s.step} className="flex gap-3 bg-slate-800/60 rounded-lg p-4 border border-slate-700/50">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center ${s.color}`}><span className="text-xs font-bold">{s.step}</span></div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">{s.icon}<span className="text-white text-sm font-semibold">{s.title}</span></div>
                      <p className="text-slate-400 text-xs leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-wrap gap-x-6 gap-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Green — Available</div>
                <div className="flex items-center gap-2 text-xs text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Yellow — Reserved</div>
                <div className="flex items-center gap-2 text-xs text-slate-400"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Red — Occupied</div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-6 flex items-center justify-between">
            <div><p className="text-green-400 text-sm font-medium">Available</p><p className="text-3xl font-bold mt-1">{stats.available}</p></div>
            <CheckCircle2 className="w-8 h-8 text-green-500 opacity-50" />
          </div>
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6 flex items-center justify-between">
            <div><p className="text-yellow-400 text-sm font-medium">Reserved</p><p className="text-3xl font-bold mt-1">{stats.reserved}</p></div>
            <Clock className="w-8 h-8 text-yellow-500 opacity-50" />
          </div>
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 flex items-center justify-between">
            <div><p className="text-red-400 text-sm font-medium">Occupied</p><p className="text-3xl font-bold mt-1">{stats.occupied}</p></div>
            <Car className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>

        {/* My Reservations */}
        {myReservations.length > 0 && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-2 mb-4 font-bold text-lg"><AlertCircle size={20} className="text-blue-400"/> My Active Reservations</div>
            {myReservations.map(s => (
              <div key={s.id} className="bg-slate-800 p-4 rounded-lg flex justify-between items-center border border-slate-700 mb-2">
                <div><p className="font-semibold">{s.name} — {s.location}</p><p className="text-xs text-yellow-400">Ends in: {getTimeRemaining(s.reservedAt!)}</p></div>
                <button onClick={() => setSelectedSlot(s)} className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold">View</button>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="mb-6 w-full sm:w-72">
          <label className="block text-sm font-medium text-slate-300 mb-2">Filter by Location</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16}/>
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold outline-none appearance-none focus:ring-2 focus:ring-blue-500">
              <option value="All">All Locations</option>
              {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
          </div>
        </div>

        {/* Slot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className={`rounded-xl p-6 border transition-all ${slot.status === 'available' ? 'bg-slate-800/60 border-green-700/60' : 'bg-slate-800 border-slate-700'}`}>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">{slot.name}</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${slot.status === 'available' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'}`}>{slot.status}</span>
              </div>
              <div className="text-2xl font-bold mb-6">₱{slot.price}<span className="text-xs text-slate-500"> /hr</span></div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedSlot(slot)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-bold">View</button>
                {slot.status === "available" && <button onClick={() => handleReserve(slot)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold">Reserve</button>}
              </div>
            </div>
          ))}
        </div>

        {/* Map Section */}
        <div className="mt-10 mb-12">
          <div className="flex items-center justify-between mb-3 font-bold">
            <div className="flex items-center gap-2"><MapPin className="text-blue-500"/> Parking Map</div>
            <button onClick={() => setShowMap(!showMap)} className="text-sm text-slate-400">{showMap ? "Hide" : "Show"}</button>
          </div>
          {showMap && <ParkingMap slots={slots} onLocationClick={setSelectedLocation} selectedLocation={selectedLocation} />}
        </div>

        {/* Modal with restored Bollard UI */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <div><h2 className="text-2xl font-bold">{selectedSlot.name}</h2><p className="text-slate-400">{selectedSlot.location}</p></div>
                <button onClick={() => setSelectedSlot(null)} className="text-slate-500 hover:text-white"><XCircle size={24}/></button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                  <p className="text-xs text-slate-500 uppercase font-bold mb-1">Current Status</p>
                  <span className={`text-sm font-bold uppercase ${selectedSlot.status === 'available' ? 'text-green-400' : 'text-yellow-400'}`}>{selectedSlot.status}</span>
                </div>

                {selectedSlot.reservedBy === user.email && !selectedSlot.paid && (
                  <div className="bg-blue-900/20 border border-blue-700 p-4 rounded-xl space-y-4">
                    <p className="text-sm font-bold flex items-center gap-2"><CreditCard size={18}/> Select Payment Method</p>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-bold text-sm">
                      <option value="GCash">GCash</option><option value="Maya">Maya</option><option value="Card">Credit Card</option>
                    </select>
                    <button onClick={() => handlePayment(selectedSlot)} className="w-full bg-blue-600 py-3 rounded-lg font-bold">Pay ₱{selectedSlot.price}</button>
                  </div>
                )}

                {selectedSlot.paid && (
                  <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-5">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-bold flex items-center gap-2"><Zap size={16} className="text-yellow-400"/> Bollard Control</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedSlot.bollardUp ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>{selectedSlot.bollardUp ? 'RAISED' : 'LOWERED'}</span>
                    </div>

                    <p className={`text-xs p-3 rounded-lg border font-medium ${selectedSlot.bollardUp ? 'bg-yellow-900/20 border-yellow-800 text-yellow-500' : 'bg-green-900/20 border-green-800 text-green-500'}`}>
                      {selectedSlot.bollardUp ? "Bollard is raised. Lower it to park." : "Entry is clear. Please drive in."}
                    </p>

                    <div className="flex justify-center items-end h-20">
                       <div className={`w-8 rounded-t-lg transition-all duration-500 ${selectedSlot.bollardUp ? 'h-16 bg-red-600' : 'h-3 bg-green-600'}`}/>
                       <div className="w-12 h-3 bg-slate-700 rounded absolute translate-y-2"/>
                    </div>

                    <button onClick={() => handleBollardToggle(selectedSlot)} className={`w-full py-3 rounded-xl font-bold transition-all ${selectedSlot.bollardUp ? 'bg-green-600' : 'bg-red-600'}`}>
                      {selectedSlot.bollardUp ? "Lower Bollard" : "Raise Bollard"}
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