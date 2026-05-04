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
  bollardUp?: boolean;
}

const LOCATIONS = ["Session Road", "Harrison Road", "SM Baguio", "Cedar Peak", "Mabini"]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [slots, setSlots] = useState<ParkingSlot[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("All")
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null)
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
      resetData[`slot${id}`] = { status: "available", bollardUp: true, reservedBy: null }
    })
    await update(ref(db, "slots"), resetData)
  }

  const handleReserve = async (slot: ParkingSlot) => {
    await update(ref(db, `slots/slot${slot.id}`), { 
      status: "reserved", 
      reservedBy: user.email,
      reservedAt: Date.now()
    })
  }

  const handleBollardToggle = async (slot: ParkingSlot) => {
    if (slot.status === 'occupied') return
    await update(ref(db, `slots/slot${slot.id}`), { bollardUp: !slot.bollardUp })
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8 text-white">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center"><Car className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold">SurePark Baguio</h1>
              <p className="text-slate-400 text-sm">Welcome, {user.email.split('@')[0]}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowScanner(!showScanner)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"><QrCode size={18}/> Scanner</button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"><RefreshCw size={18}/> Reset</button>
            <button onClick={() => { localStorage.removeItem("surepark_user"); router.push("/login") }} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"><LogOut size={18}/> Logout</button>
          </div>
        </div>

        {/* How to Use Section */}
        <div className="mb-6 rounded-xl border border-blue-800/60 bg-blue-950/40 overflow-hidden">
          <button onClick={() => setShowTips(!showTips)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-blue-900/20 transition-colors">
            <div className="flex items-center gap-2.5"><Info className="w-4 h-4 text-blue-400"/><span className="text-blue-300 font-semibold text-sm uppercase tracking-wide">How to Use SurePark</span></div>
            {showTips ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
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
                    <div><div className="flex items-center gap-1.5 mb-1">{s.icon}<span className="text-white text-sm font-semibold">{s.title}</span></div><p className="text-slate-400 text-xs leading-relaxed">{s.desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-6 flex items-center justify-between">
            <div><p className="text-green-400 text-sm font-medium">Available</p><p className="text-3xl font-bold mt-1">{stats.available}</p></div>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-6 flex items-center justify-between">
            <div><p className="text-yellow-400 text-sm font-medium">Reserved</p><p className="text-3xl font-bold mt-1">{stats.reserved}</p></div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-6 flex items-center justify-between">
            <div><p className="text-red-400 text-sm font-medium">Occupied</p><p className="text-3xl font-bold mt-1">{stats.occupied}</p></div>
            <Car className="w-8 h-8 text-red-500" />
          </div>
        </div>

        {/* My Active Reservations */}
        {myReservations.length > 0 && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-6 mb-8">
            <div className="flex items-center gap-2 mb-4"><AlertCircle className="w-5 h-5 text-blue-400"/><h2 className="text-lg font-bold">Your Active Reservations</h2></div>
            <div className="space-y-3">
              {myReservations.map((slot) => (
                <div key={slot.id} className="bg-slate-800 rounded-lg p-4 flex items-center justify-between">
                  <div><p className="font-medium">{slot.name} - {slot.location}</p></div>
                  <button onClick={() => setSelectedSlot(slot)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors">View Details</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Location Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-300 mb-2">Filter by Location</label>
          <div className="relative w-full sm:w-72">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full appearance-none bg-slate-800 border border-slate-600 rounded-xl pl-9 pr-10 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="All">All Locations</option>
              {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>

        {/* Parking Slots Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className={`rounded-lg p-6 transition-colors border ${slot.status === "available" ? "bg-slate-800 border-green-700/60" : slot.status === "reserved" ? "bg-slate-800 border-yellow-700/60" : "bg-red-950/30 border-red-700/60"}`}>
              <div className="flex items-start justify-between mb-4">
                <div><h3 className="text-xl font-bold">{slot.name}</h3><div className="flex items-center gap-1 text-slate-400 text-sm mt-1"><MapPin className="w-4 h-4" />{slot.location}</div></div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${slot.status === 'available' ? 'bg-green-900/50 text-green-400' : slot.status === 'reserved' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>{slot.status}</span>
              </div>
              <div className="text-2xl font-bold mb-4">₱{slot.price}<span className="text-slate-400 text-sm font-normal">/hour</span></div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedSlot(slot)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">View</button>
                {slot.status === "available" && (
                  <button onClick={() => handleReserve(slot)} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors">Reserve</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Map Section */}
        <div className="mt-10 mb-12">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-400"/><h2 className="text-lg font-bold">Parking Locations Map</h2></div>
            <button onClick={() => setShowMap(!showMap)} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">{showMap ? "Hide Map" : "Show Map"}</button>
          </div>
          {showMap && <ParkingMap slots={slots} onLocationClick={setSelectedLocation} selectedLocation={selectedLocation} />}
        </div>

        {/* Detail Modal */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[2000]">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-start mb-4">
                <div><h3 className="text-2xl font-bold">{selectedSlot.name}</h3><p className="text-slate-400">{selectedSlot.location}</p></div>
                <button onClick={() => setSelectedSlot(null)} className="text-slate-400 hover:text-white"><XCircle size={24}/></button>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-slate-400 text-sm mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium uppercase ${selectedSlot.status === "available" ? "bg-green-900/50 text-green-400" : "bg-yellow-900/50 text-yellow-400"}`}>{selectedSlot.status}</span>
                </div>
                {selectedSlot.status === "available" ? (
                  <button onClick={() => { handleReserve(selectedSlot); setSelectedSlot(null); }} className="w-full bg-blue-600 hover:bg-blue-700 font-medium py-3 rounded-lg transition-colors">Reserve This Slot</button>
                ) : (
                  <div className="bg-slate-900 p-4 rounded-lg space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-bold text-slate-400 flex items-center gap-2"><Zap size={14} className="text-yellow-400"/> Bollard Control</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedSlot.bollardUp ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>{selectedSlot.bollardUp ? 'RAISED' : 'LOWERED'}</span>
                    </div>
                    <button 
                      disabled={selectedSlot.status === 'occupied'}
                      onClick={() => handleBollardToggle(selectedSlot)}
                      className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${selectedSlot.status === 'occupied' ? 'bg-slate-800 text-slate-600' : selectedSlot.bollardUp ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                      {selectedSlot.status === 'occupied' ? <ShieldCheck size={18}/> : selectedSlot.bollardUp ? <><ArrowDown size={18}/> Lower Bollard</> : <><ArrowUp size={18}/> Raise Bollard</>}
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