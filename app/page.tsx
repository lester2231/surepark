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
    await update(ref(db, `slots/slot${slot.id}`), { 
      paid: true, 
      activeQrToken: qrToken 
    })
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
    setScanResult({ success: true, message: `Check-in successful for ${slot.name}!` })
    setQrInput("")
  }

  const filteredSlots = selectedLocation === "All" ? slots : slots.filter((s) => s.location === selectedLocation)
  const stats = {
    available: slots.filter((s) => s.status === "available").length,
    reserved: slots.filter((s) => s.status === "reserved").length,
    occupied: slots.filter((s) => s.status === "occupied").length,
  }
  const myReservations = slots.filter(s => s.reservedBy === user?.email && s.status === "reserved")

  const getTimeRemaining = (reservedAt: number) => {
    const remaining = 15 * 60 * 1000 - (Date.now() - reservedAt)
    if (remaining <= 0) return "Expired"
    const mins = Math.floor(remaining / 60000)
    const secs = Math.floor((remaining % 60000) / 1000)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8 text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg"><Car className="w-6 h-6 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold">SurePark Baguio</h1>
              <p className="text-slate-400 text-sm font-medium">Welcome, {user.email.split('@')[0]}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowScanner(!showScanner)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-bold transition-all"><QrCode size={18}/> Scanner</button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-bold transition-all"><RefreshCw size={18}/> Reset</button>
            <button onClick={() => { localStorage.removeItem("surepark_user"); router.push("/login") }} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-bold transition-all"><LogOut size={18}/> Logout</button>
          </div>
        </div>

        {/* QR Scanner Panel */}
        {showScanner && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8 shadow-2xl">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-400"><QrCode size={20}/> QR Validator</h2>
            <div className="flex gap-2">
              <input type="text" value={qrInput} onChange={(e) => setQrInput(e.target.value)} placeholder="Paste QR Token..." className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-green-500"/>
              <button onClick={handleScanQr} className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-lg font-bold">Validate</button>
            </div>
            {scanResult && <p className={`mt-3 text-sm font-bold ${scanResult.success ? 'text-green-400' : 'text-red-400'}`}>{scanResult.message}</p>}
          </div>
        )}

        {/* How to Use */}
        <div className="mb-8 rounded-xl border border-blue-800/40 bg-blue-950/20 overflow-hidden">
          <button onClick={() => setShowTips(!showTips)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-blue-900/10">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-widest"><Info size={16}/> Guide</div>
            {showTips ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
          </button>
          {showTips && (
            <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
               {[
                  { step: "1", title: "Find", desc: "Browse available slots below.", icon: <Search size={16}/> },
                  { step: "2", title: "Reserve", desc: "Reserve and pay within 15 mins.", icon: <CalendarCheck size={16}/> },
                  { step: "3", title: "Control", desc: "Lower bollard after payment.", icon: <Zap size={16}/> },
               ].map(s => (
                <div key={s.step} className="bg-slate-800/40 p-4 rounded-lg border border-slate-700/50 flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-xs">{s.step}</div>
                  <div><h4 className="font-bold text-sm flex items-center gap-1">{s.icon} {s.title}</h4><p className="text-slate-400 text-xs mt-1">{s.desc}</p></div>
                </div>
               ))}
            </div>
          )}
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-900/20 border border-green-700/50 p-6 rounded-xl flex items-center justify-between">
            <div><p className="text-green-400 text-xs font-bold uppercase tracking-wider">Available</p><p className="text-4xl font-bold mt-1">{stats.available}</p></div>
            <CheckCircle2 className="w-10 h-10 text-green-500 opacity-50" />
          </div>
          <div className="bg-yellow-900/20 border border-yellow-700/50 p-6 rounded-xl flex items-center justify-between">
            <div><p className="text-yellow-400 text-xs font-bold uppercase tracking-wider">Reserved</p><p className="text-4xl font-bold mt-1">{stats.reserved}</p></div>
            <Clock className="w-10 h-10 text-yellow-500 opacity-50" />
          </div>
          <div className="bg-red-900/20 border border-red-700/50 p-6 rounded-xl flex items-center justify-between">
            <div><p className="text-red-400 text-xs font-bold uppercase tracking-wider">Occupied</p><p className="text-4xl font-bold mt-1">{stats.occupied}</p></div>
            <Car className="w-10 h-10 text-red-500 opacity-50" />
          </div>
        </div>

        {/* Active Reservation Alert */}
        {myReservations.length > 0 && (
          <div className="bg-blue-900/20 border border-blue-700 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-2 mb-4 text-blue-400"><AlertCircle size={20}/><h2 className="font-bold">Active Reservation</h2></div>
            {myReservations.map(s => (
              <div key={s.id} className="bg-slate-800/80 p-4 rounded-lg flex justify-between items-center border border-slate-700">
                <p className="font-bold">{s.name} — {s.location}</p>
                <button onClick={() => setSelectedSlot(s)} className="bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold">Manage</button>
              </div>
            ))}
          </div>
        )}

        {/* Location Filter */}
        <div className="mb-6 max-w-xs">
          <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-widest">Filter Location</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16}/>
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none appearance-none focus:ring-2 focus:ring-blue-500">
              <option value="All">All Locations</option>
              {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
          </div>
        </div>

        {/* Slot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className={`rounded-2xl p-6 border transition-all ${slot.status === 'available' ? 'bg-slate-800/60 border-green-700/40 hover:border-green-600' : 'bg-slate-800/60 border-slate-700'}`}>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold tracking-tight">{slot.name}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${slot.status === 'available' ? 'bg-green-500/20 text-green-400' : slot.status === 'reserved' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{slot.status}</span>
              </div>
              <p className="text-slate-500 text-xs flex items-center gap-1.5 mb-6 font-bold"><MapPin size={14} className="text-blue-500"/> {slot.location}</p>
              <div className="text-3xl font-black mb-8">₱{slot.price}<span className="text-xs text-slate-600 font-bold italic"> /hour</span></div>
              <div className="flex gap-2">
                <button onClick={() => setSelectedSlot(slot)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-black uppercase tracking-widest transition-all">View</button>
                {slot.status === "available" && <button onClick={() => handleReserve(slot)} className="flex-[1.5] py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20">Reserve</button>}
              </div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2"><MapPin className="text-blue-500"/> Interactive Map</h2>
            <button onClick={() => setShowMap(!showMap)} className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest">{showMap ? 'Hide Map' : 'Show Map'}</button>
          </div>
          {showMap && <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl"><ParkingMap slots={slots} onLocationClick={setSelectedLocation} selectedLocation={selectedLocation} /></div>}
        </div>

        {/* Restore: Detail Modal with Bollard Animation */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <div><h2 className="text-2xl font-black tracking-tight">{selectedSlot.name}</h2><p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{selectedSlot.location}</p></div>
                <button onClick={() => setSelectedSlot(null)} className="p-2 hover:bg-slate-900 rounded-full text-slate-500 hover:text-white"><XCircle size={28}/></button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Status</p>
                    <p className={`font-bold uppercase text-sm ${selectedSlot.status === 'available' ? 'text-green-400' : 'text-yellow-400'}`}>{selectedSlot.status}</p>
                  </div>
                  <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700/50">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Price</p>
                    <p className="font-bold text-sm">₱{selectedSlot.price}/hr</p>
                  </div>
                </div>

                {/* Payment Logic */}
                {selectedSlot.reservedBy === user.email && !selectedSlot.paid && (
                  <div className="bg-blue-900/20 border border-blue-700/50 p-5 rounded-xl space-y-4">
                    <h4 className="text-sm font-bold flex items-center gap-2"><CreditCard size={18}/> Select Payment</h4>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-sm font-bold">
                      <option value="GCash">GCash</option><option value="Maya">Maya</option><option value="Card">Card</option>
                    </select>
                    <button onClick={() => handlePayment(selectedSlot)} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-xl font-bold uppercase text-xs tracking-widest">Pay Now</button>
                  </div>
                )}

                {/* Bollard Section */}
                {selectedSlot.paid && (
                  <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-5 space-y-5">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-bold flex items-center gap-2"><Zap size={16} className="text-yellow-400"/> Bollard Control</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${selectedSlot.bollardUp ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>{selectedSlot.bollardUp ? 'RAISED' : 'LOWERED'}</span>
                    </div>

                    <p className={`text-[10px] font-bold p-3 rounded-lg border flex items-center gap-2 ${selectedSlot.bollardUp ? 'bg-yellow-900/20 border-yellow-800 text-yellow-500' : 'bg-green-900/20 border-green-800 text-green-500'}`}>
                      <span className={`w-2 h-2 rounded-full animate-pulse ${selectedSlot.bollardUp ? 'bg-yellow-500' : 'bg-green-500'}`}/>
                      {selectedSlot.bollardUp ? "Bollard is raised. Press Lower to enter." : "Gate is open. Drive in now."}
                    </p>

                    {/* Visual Animation */}
                    <div className="flex justify-center items-end h-24">
                       <div className={`w-10 rounded-t-lg transition-all duration-700 ${selectedSlot.bollardUp ? 'h-16 bg-gradient-to-b from-red-500 to-red-800' : 'h-3 bg-gradient-to-b from-green-500 to-green-800'}`}/>
                       <div className="w-16 h-3 bg-slate-700 rounded absolute translate-y-2"/>
                    </div>

                    <button onClick={() => handleBollardToggle(selectedSlot)} className={`w-full py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${selectedSlot.bollardUp ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}>
                      {selectedSlot.bollardUp ? <><ArrowDown size={18} className="inline mr-2"/> Lower Bollard</> : <><ArrowUp size={18} className="inline mr-2"/> Raise Bollard</>}
                    </button>
                  </div>
                )}

                {selectedSlot.status === "available" && <button onClick={() => { handleReserve(selectedSlot); setSelectedSlot(null); }} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-black uppercase text-xs tracking-widest">Reserve Now</button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}