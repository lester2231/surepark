"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { ref, onValue, update } from "firebase/database"
import { db } from "@/lib/firebase"
import {
  Car, LogOut, MapPin, Clock, CreditCard, QrCode, CheckCircle2,
  XCircle, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Info,
  Search, CalendarCheck, Wallet, Radio, Zap
} from "lucide-react"

const ParkingMap = dynamic(() => import("@/components/ParkingMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[440px] rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-sans">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-sans">Loading map...</p>
      </div>
    </div>
  ),
})

interface ParkingSlot {
  id: number; name: string; location: string; price: number;
  status: "available" | "reserved" | "occupied";
  reservedBy?: string; reservedAt?: number;
  paid?: boolean; activeQrToken?: string; bollardUp?: boolean;
  sensorActive?: boolean;
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
      resetData[`slot${id}`] = { 
        status: "available", 
        bollardUp: true, 
        reservedBy: null, 
        paid: false,
        sensorActive: false // Disable sensor on reset
      }
    })
    await update(ref(db, "slots"), resetData)
  }

  const handleReserve = async (slot: ParkingSlot) => {
    await update(ref(db, `slots/slot${slot.id}`), { 
      status: "reserved", 
      reservedBy: user.email,
      reservedAt: Date.now(),
      bollardUp: true,
      sensorActive: false // Ensure sensor is off during reservation
    })
  }

  const handlePayment = async (slot: ParkingSlot) => {
    const qrToken = `SP-${slot.id}-${Date.now().toString(36).toUpperCase()}`
    await update(ref(db, `slots/slot${slot.id}`), { 
        paid: true, 
        activeQrToken: qrToken,
        sensorActive: false // Still off until bollard is lowered
    })
  }

  const handleBollardToggle = async (slot: ParkingSlot) => {
    if (slot.status === 'occupied') return
    const newBollardState = !slot.bollardUp
    
    // THE LOGIC: Sensor only works if Paid AND Bollard is Lowered (newBollardState is false)
    const isSensorNowActive = slot.paid && newBollardState === false

    await update(ref(db, `slots/slot${slot.id}`), { 
        bollardUp: newBollardState,
        sensorActive: isSensorNowActive 
    })
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
    <div className="min-h-screen bg-[#0f172a] p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">SurePark Baguio</h1>
              <p className="text-slate-400 text-sm">Welcome, {user.email.split('@')[0]}</p>
            </div>
          </div>
          <div className="flex gap-2 font-sans">
            <button onClick={() => setShowScanner(!showScanner)} className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-[#059669] rounded-lg text-sm font-semibold transition-colors"><QrCode size={18}/> Scanner</button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-[#334155] hover:bg-[#475569] rounded-lg text-sm font-semibold transition-colors"><RefreshCw size={18}/> Reset</button>
            <button onClick={() => { localStorage.removeItem("surepark_user"); router.push("/login") }} className="flex items-center gap-2 px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] rounded-lg text-sm font-semibold transition-colors"><LogOut size={18}/> Logout</button>
          </div>
        </div>

        {/* Descriptive Guide */}
        <div className="mb-6 rounded-xl border border-blue-800/60 bg-[#082f49]/40 overflow-hidden font-sans">
          <button onClick={() => setShowTips(!showTips)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-blue-900/20 transition-colors">
            <div className="flex items-center gap-2.5">
              <Info className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 font-semibold text-sm tracking-wide uppercase">System Operation Guide</span>
            </div>
            {showTips ? <ChevronUp size={16} className="text-blue-400" /> : <ChevronDown size={16} className="text-blue-400" />}
          </button>
          {showTips && (
            <div className="px-5 pb-5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { step: "1", icon: <Search size={16} className="text-blue-400"/>, title: "Find a Slot", desc: "Browse available slots marked with green pins.", color: "bg-blue-600/30 border-blue-500/40" },
                  { step: "2", icon: <CalendarCheck size={16} className="text-green-400"/>, title: "Reserve", desc: "Reserve your slot. The bollard stays UP to protect your space.", color: "bg-green-600/20 border-green-500/40" },
                  { step: "3", icon: <Wallet size={16} className="text-yellow-400"/>, title: "Payment", desc: "Pay via GCash/Maya to unlock the bollard controls.", color: "bg-yellow-600/20 border-yellow-500/40" },
                  { step: "4", icon: <Zap size={16} className="text-orange-400"/>, title: "Lower Bollard", desc: "The sensor is DISABLED while the bollard is up to prevent false triggers.", color: "bg-orange-600/20 border-orange-500/40" },
                  { step: "5", icon: <Radio size={16} className="text-purple-400"/>, title: "Sensor Active", desc: "The HC-SR04 activates ONLY after the bollard is lowered by a paid user.", color: "bg-purple-600/20 border-purple-500/40" },
                  { step: "6", icon: <Car size={16} className="text-slate-400"/>, title: "Auto-Occupied", desc: "Drive in; the sensor detects your car and marks the slot as Occupied.", color: "bg-slate-600/30 border-slate-500/40" },
                ].map((s) => (
                  <div key={s.step} className="flex gap-3 bg-[#1e293b]/60 rounded-lg p-4 border border-slate-700/50">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center ${s.color}`}><span className="text-xs font-bold">{s.step}</span></div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">{s.icon}<span className="text-white text-sm font-semibold">{s.title}</span></div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 font-sans">
          <div className="bg-[#064e3b]/30 border border-[#065f46] rounded-lg p-6 flex items-center justify-between">
            <div><p className="text-[#4ade80] text-sm font-medium">Available</p><p className="text-4xl font-bold mt-1">{stats.available}</p></div>
            <CheckCircle2 className="w-10 h-10 text-[#22c55e]" />
          </div>
          <div className="bg-[#422006]/30 border border-[#713f12] rounded-lg p-6 flex items-center justify-between">
            <div><p className="text-[#fbbf24] text-sm font-medium">Reserved</p><p className="text-4xl font-bold mt-1">{stats.reserved}</p></div>
            <Clock className="w-10 h-10 text-[#eab308]" />
          </div>
          <div className="bg-[#450a0a]/30 border border-[#7f1d1d] rounded-lg p-6 flex items-center justify-between">
            <div><p className="text-[#f87171] text-sm font-medium">Occupied</p><p className="text-4xl font-bold mt-1">{stats.occupied}</p></div>
            <Car className="w-10 h-10 text-[#ef4444]" />
          </div>
        </div>

        {/* Slots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12 font-sans">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className={`rounded-xl p-6 border transition-all ${slot.status === 'available' ? 'bg-[#1e293b]/60 border-green-700/60' : 'bg-[#1e293b] border-slate-700'}`}>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold tracking-tight">{slot.name}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${slot.status === 'available' ? 'bg-green-500/20 text-green-400 border border-green-700/50' : slot.status === 'reserved' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-700/50' : 'bg-red-500/20 text-red-400 border border-red-700/50'}`}>{slot.status}</span>
              </div>
              <p className="text-slate-500 text-sm flex items-center gap-1.5 mb-6 font-medium"><MapPin size={14} className="text-blue-500"/> {slot.location}</p>
              <div className="text-3xl font-bold mb-8">₱{slot.price}<span className="text-sm text-slate-500 font-normal"> /hour</span></div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedSlot(slot)} className="flex-1 py-2.5 bg-[#334155] hover:bg-[#475569] rounded-lg text-sm font-bold transition-colors">View Details</button>
                {slot.status === "available" && <button onClick={() => handleReserve(slot)} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold shadow-lg">Reserve</button>}
              </div>
            </div>
          ))}
        </div>

        {/* Map Section */}
        <div className="mb-12">
            <div className="flex justify-between items-center mb-4 font-sans">
                <h2 className="font-bold text-lg flex items-center gap-2"><MapPin className="text-blue-500"/> Interactive Map</h2>
                <button onClick={() => setShowMap(!showMap)} className="text-sm font-bold text-slate-400 hover:text-white uppercase tracking-widest">{showMap ? 'Hide Map' : 'Show Map'}</button>
            </div>
            {showMap && <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl"><ParkingMap slots={slots} onLocationClick={setSelectedLocation} selectedLocation={selectedLocation} /></div>}
        </div>

        {/* Modal with Sensor and Bollard Logic */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 font-sans">
            <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <div><h2 className="text-2xl font-bold">{selectedSlot.name}</h2><p className="text-slate-400 text-sm">{selectedSlot.location}</p></div>
                <button onClick={() => setSelectedSlot(null)} className="text-slate-500 hover:text-white"><XCircle size={28}/></button>
              </div>

              <div className="space-y-4">
                <div className="bg-[#0f172a] p-4 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Current Status</p>
                  <span className={`text-sm font-bold uppercase ${selectedSlot.status === 'available' ? 'text-green-400' : 'text-yellow-400'}`}>{selectedSlot.status}</span>
                </div>

                {selectedSlot.reservedBy === user.email && !selectedSlot.paid && (
                  <div className="bg-[#1e3a8a]/20 border border-blue-700/50 p-5 rounded-xl space-y-4">
                    <p className="text-sm font-bold flex items-center gap-2 text-blue-300"><CreditCard size={18}/> Payment Required</p>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 font-bold text-sm">
                      <option value="GCash">GCash</option><option value="Maya">Maya</option>
                    </select>
                    <button onClick={() => handlePayment(selectedSlot)} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold uppercase text-xs tracking-widest">Pay ₱{selectedSlot.price}.00</button>
                  </div>
                )}

                {selectedSlot.paid && (
                  <div className="space-y-4">
                    {/* Bollard Section */}
                    <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-5 space-y-5">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold text-white"><Zap size={16} className="inline mr-2 text-yellow-400"/> Bollard Control</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedSlot.bollardUp ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>{selectedSlot.bollardUp ? 'RAISED' : 'LOWERED'}</span>
                      </div>
                      <div className="flex justify-center items-end h-24 relative overflow-hidden">
                        <div className={`w-10 rounded-t-lg transition-all duration-700 shadow-2xl ${selectedSlot.bollardUp ? 'h-16 bg-red-600' : 'h-4 bg-green-600'}`}/>
                        <div className="w-16 h-3 bg-slate-700 rounded absolute translate-y-3"/>
                      </div>
                      <button onClick={() => handleBollardToggle(selectedSlot)} className={`w-full py-4 rounded-xl font-bold text-xs tracking-widest uppercase transition-all shadow-lg ${selectedSlot.bollardUp ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}>
                        {selectedSlot.bollardUp ? "Lower Bollard" : "Raise Bollard"}
                      </button>
                    </div>

                    {/* Hardware Sensor Status Section */}
                    <div className={`p-4 rounded-xl border transition-all ${selectedSlot.sensorActive ? 'bg-blue-900/20 border-blue-800 animate-pulse' : 'bg-slate-800/40 border-slate-700 opacity-60'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Radio className={`w-4 h-4 ${selectedSlot.sensorActive ? 'text-blue-400' : 'text-slate-500'}`} />
                        <h4 className={`font-semibold text-sm ${selectedSlot.sensorActive ? 'text-white' : 'text-slate-500'}`}>Parking Sensor (HC-SR04)</h4>
                        <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${selectedSlot.sensorActive ? 'text-blue-400 border-blue-800 bg-blue-900/40' : 'text-slate-500 border-slate-700'}`}>
                          {selectedSlot.sensorActive ? 'LISTENING' : 'DISABLED'}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        {selectedSlot.sensorActive 
                          ? "The hardware sensor is now active. It will automatically detect your vehicle arrival." 
                          : "Sensor is disabled. You must pay and lower the bollard to activate detection."}
                      </p>
                    </div>
                  </div>
                )}

                {selectedSlot.status === "available" && <button onClick={() => handleReserve(selectedSlot)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg">Reserve Now</button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}