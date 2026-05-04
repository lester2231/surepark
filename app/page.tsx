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
  const [showTips, setShowTips] = useState(true)
  const [showScanner, setShowScanner] = useState(false)

  useEffect(() => {
    const userData = localStorage.getItem("surepark_user")
    if (!userData) { router.push("/login"); return }
    setUser(JSON.parse(userData))

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
    if (slot.status === 'occupied') return; // Safety check
    await update(ref(db, `slots/slot${slot.id}`), { bollardUp: !slot.bollardUp })
  }

  const handleReset = async () => {
    const resetData: Record<string, any> = {};
    [1, 2, 3, 4, 5].forEach((id) => {
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
    <div className="min-h-screen bg-[#0f172a] p-4 md:p-8 text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">SurePark Baguio</h1>
              <p className="text-slate-400 text-xs">Welcome, {user.email.split('@')[0]}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowScanner(!showScanner)} className="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg text-sm font-medium hover:bg-green-500 transition-colors"><QrCode size={16}/> Scanner</button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"><RefreshCw size={16}/> Reset</button>
            <button onClick={() => { localStorage.removeItem("surepark_user"); router.push("/login") }} className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg text-sm font-medium hover:bg-red-500 transition-colors"><LogOut size={16}/> Logout</button>
          </div>
        </div>

        {/* Tips Section */}
        <div className="mb-8 rounded-xl border border-blue-900/50 bg-[#1e293b]/40 overflow-hidden">
          <button onClick={() => setShowTips(!showTips)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-blue-900/20 transition-colors">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
              <Info size={16}/> How to Use SurePark
            </div>
            {showTips ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          </button>
          {showTips && (
            <div className="px-5 pb-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {[
                  { id: 1, title: "Find a Slot", desc: "Use the filter or map pins. Green means available.", icon: <Search size={14}/> },
                  { id: 2, title: "Reserve the Slot", desc: "Click Reserve. You have 15 minutes to pay.", icon: <CalendarCheck size={14}/> },
                  { id: 3, title: "Pay the Ticket", desc: "Pay via GCash or Maya to generate a QR token.", icon: <Wallet size={14}/> },
                  { id: 4, title: "Control the Bollard", desc: "Lower the bollard to enter the slot.", icon: <Zap size={14}/> },
                  { id: 5, title: "Car Detected", desc: "Sensor updates status to Occupied automatically.", icon: <Radio size={14}/> },
                  { id: 6, title: "Exit & Free", desc: "When you leave, the slot resets to Available.", icon: <Car size={14}/> },
                ].map((step) => (
                  <div key={step.id} className="bg-[#0f172a]/50 p-4 rounded-lg border border-slate-700 flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-[10px] font-bold shrink-0">{step.id}</div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1 text-white text-xs font-bold">{step.icon} {step.title}</div>
                      <p className="text-slate-400 text-[10px] leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 text-[10px] font-bold pt-3 border-t border-slate-800">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"/> Green — Available</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500"/> Yellow — Reserved</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"/> Red — Occupied</span>
              </div>
            </div>
          )}
        </div>

        {/* Filter & Stats */}
        <div className="mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase mb-2">Filter by Location</p>
          <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full md:w-64 bg-[#1e293b] border border-slate-700 rounded-lg px-4 py-2 text-sm outline-none focus:border-blue-500">
            <option value="All">All Locations</option>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-900/20 border border-green-500/30 p-6 rounded-xl flex items-center justify-between">
            <div><p className="text-xs font-bold text-green-400 uppercase mb-1">Available</p><p className="text-4xl font-bold">{stats.available}</p></div>
            <CheckCircle2 className="text-green-500 w-10 h-10 opacity-80"/>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-500/30 p-6 rounded-xl flex items-center justify-between">
            <div><p className="text-xs font-bold text-yellow-400 uppercase mb-1">Reserved</p><p className="text-4xl font-bold">{stats.reserved}</p></div>
            <Clock className="text-yellow-500 w-10 h-10 opacity-80"/>
          </div>
          <div className="bg-red-900/20 border border-red-500/30 p-6 rounded-xl flex items-center justify-between">
            <div><p className="text-xs font-bold text-red-400 uppercase mb-1">Occupied</p><p className="text-4xl font-bold">{stats.occupied}</p></div>
            <Car className="text-red-500 w-10 h-10 opacity-80"/>
          </div>
        </div>

        {/* Slot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className={`bg-[#1e293b]/50 border rounded-2xl p-6 transition-all ${
              slot.status === 'available' ? 'border-green-500/20' : slot.status === 'reserved' ? 'border-yellow-500/20' : 'border-red-500/20'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">{slot.name}</h3>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                  slot.status === 'available' ? 'bg-green-500/20 text-green-400' : 
                  slot.status === 'reserved' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                }`}>{slot.status}</span>
              </div>
              <p className="text-slate-400 text-xs flex items-center gap-1 mb-4"><MapPin size={12}/> {slot.location}</p>
              <div className="text-2xl font-bold mb-6">₱{slot.price} <span className="text-xs text-slate-500 font-normal">/hour</span></div>
              
              <div className="flex gap-2">
                <button onClick={() => setSelectedSlot(slot)} className="flex-1 py-2.5 bg-slate-700/50 hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors">View</button>
                {slot.status === 'available' && <button onClick={() => handleReserve(slot)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-colors">Reserve</button>}
              </div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="rounded-3xl overflow-hidden border border-slate-800 shadow-2xl mb-12">
          <ParkingMap slots={slots} onLocationClick={setSelectedLocation} selectedLocation={selectedLocation} />
        </div>

        {/* Modal Logic with Safety Lock */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-[#000]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <div><h2 className="text-xl font-bold">{selectedSlot.name}</h2><p className="text-slate-400 text-xs">{selectedSlot.location}</p></div>
                <button onClick={() => setSelectedSlot(null)} className="p-2 hover:bg-slate-800 rounded-full"><XCircle size={24}/></button>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 bg-[#0f172a] p-4 rounded-xl border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Status</p>
                    <p className="text-sm font-bold text-blue-400 uppercase">{selectedSlot.status}</p>
                  </div>
                  <div className="flex-1 bg-[#0f172a] p-4 rounded-xl border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Price</p>
                    <p className="text-sm font-bold text-white uppercase">₱{selectedSlot.price}</p>
                  </div>
                </div>

                {selectedSlot.reservedBy === user.email && !selectedSlot.paid && (
                  <button onClick={() => handlePayment(selectedSlot)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all">Pay ₱{selectedSlot.price} Now</button>
                )}

                {selectedSlot.paid && (
                  <div className="bg-[#0f172a] p-5 rounded-2xl border border-blue-500/20 space-y-4 text-center">
                    <div className="flex justify-between items-center px-2">
                      <p className="text-xs font-bold text-slate-400 flex items-center gap-2"><Zap size={14} className={selectedSlot.status === 'occupied' ? "text-slate-600" : "text-yellow-400"}/> Bollard</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedSlot.bollardUp ? 'bg-red-500' : 'bg-green-500'}`}>{selectedSlot.bollardUp ? 'RAISED' : 'LOWERED'}</span>
                    </div>

                    <button 
                      disabled={selectedSlot.status === 'occupied'}
                      onClick={() => handleBollardToggle(selectedSlot)} 
                      className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        selectedSlot.status === 'occupied' 
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' 
                          : selectedSlot.bollardUp ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
                      }`}
                    >
                      {selectedSlot.status === 'occupied' ? (
                        <><ShieldCheck size={18}/> Safety Locked</>
                      ) : (
                        selectedSlot.bollardUp ? <><ArrowDown size={18}/> Lower Bollard</> : <><ArrowUp size={18}/> Raise Bollard</>
                      )}
                    </button>

                    {selectedSlot.status === 'occupied' ? (
                      <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2 animate-pulse">
                        <AlertCircle size={12}/> Vehicle detected: Control Locked
                      </p>
                    ) : (
                      <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                        <ShieldCheck size={12}/> Manual Control Enabled
                      </p>
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