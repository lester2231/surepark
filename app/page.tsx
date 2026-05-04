"use client"
import { ref, onValue, update } from "firebase/database"
import { db } from "@/lib/firebase"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Car, LogOut, MapPin, Clock, CreditCard, QrCode, CheckCircle2,
  XCircle, RefreshCw, Info, Search, CalendarCheck, Wallet,
  ScanLine, ArrowUp, ArrowDown, Radio, Zap, ChevronDown, ChevronUp
} from "lucide-react"

const ParkingMap = dynamic(() => import("@/components/ParkingMap"), { ssr: false })

interface ParkingSlot {
  id: number; name: string; location: string; price: number;
  status: "available" | "reserved" | "occupied";
  reservedBy?: string; reservedAt?: number; paid?: boolean;
  activeQrToken?: string; checkedIn?: boolean; bollardUp?: boolean;
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
  const [selectedLocation, setSelectedLocation] = useState("All")
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null)
  const [paymentMethod, setPaymentMethod] = useState("GCash")
  const [qrInput, setQrInput] = useState("")
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [showTips, setShowTips] = useState(true)

  // ── FIREBASE REALTIME SYNC ──
  useEffect(() => {
    const userData = localStorage.getItem("surepark_user")
    if (!userData) { router.push("/login"); return }
    setUser(JSON.parse(userData))

    // Listen to the entire "slots" node
    const unsubscribe = onValue(ref(db, "slots"), (snapshot) => {
      const data = snapshot.val()
      if (!data) return

      const formatted = Object.keys(data).map((key, index) => {
        const slotData = data[key]
        return {
          id: index + 1,
          name: `Slot ${index + 1}`,
          location: LOCATIONS[index],
          price: DEFAULT_SLOTS[index].price,
          ...slotData,
          // Safety: Available slots should always have bollards UP
          bollardUp: slotData.status === "available" ? true : slotData.bollardUp
        }
      })
      setSlots(formatted)
      
      // Update the modal if it's open
      if (selectedSlot) {
        const up = formatted.find(s => s.id === selectedSlot.id)
        if (up) setSelectedSlot(up)
      }
    })
    return () => unsubscribe()
  }, [router, selectedSlot?.id])

  // ── HANDLERS ──
  const handleReserve = async (slot: ParkingSlot) => {
    if (!user) return
    await update(ref(db, `slots/slot${slot.id}`), {
      status: "reserved",
      reservedBy: user.email,
      reservedAt: Date.now(),
      bollardUp: true,
      paid: false
    })
  }

  const handlePayment = async (slot: ParkingSlot) => {
    const token = `SP-${slot.id}-${Date.now().toString(36).toUpperCase()}`
    await update(ref(db, `slots/slot${slot.id}`), { paid: true, activeQrToken: token })
  }

  const handleBollardToggle = async (slot: ParkingSlot) => {
    if (!slot.paid) return
    await update(ref(db, `slots/slot${slot.id}`), { bollardUp: !slot.bollardUp })
  }

  const handleReset = async () => {
    const resetObj: any = {}
    DEFAULT_SLOTS.forEach(s => {
      resetObj[`slot${s.id}`] = { 
        status: "available", bollardUp: true, paid: false, 
        reservedBy: null, activeQrToken: null 
      }
    })
    await update(ref(db, "slots"), resetObj)
  }

  const getTimeRemaining = (start: number) => {
    const diff = 15 * 60 * 1000 - (Date.now() - start)
    if (diff <= 0) return "Expired"
    return `${Math.floor(diff / 60000)}:${Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')}`
  }

  const filteredSlots = selectedLocation === "All" ? slots : slots.filter(s => s.location === selectedLocation)
  const stats = {
    available: filteredSlots.filter(s => s.status === "available").length,
    reserved: filteredSlots.filter(s => s.status === "reserved").length,
    occupied: filteredSlots.filter(s => s.status === "occupied").length
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-500/20">
              <Car className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight italic">SUREPARK <span className="text-blue-500">BAGUIO</span></h1>
              <p className="text-slate-400 text-xs font-mono uppercase tracking-widest">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowScanner(!showScanner)} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95">
              <QrCode size={18}/> Scanner
            </button>
            <button onClick={handleReset} className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold flex items-center gap-2 transition-all">
              <RefreshCw size={18}/> Reset
            </button>
            <button onClick={() => { localStorage.removeItem("surepark_user"); router.push("/login") }} className="px-5 py-2.5 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-600/30 rounded-xl font-bold transition-all">
              <LogOut size={18}/>
            </button>
          </div>
        </header>

        {/* Status Dashboard */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Available", val: stats.available, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
            { label: "Reserved", val: stats.reserved, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
            { label: "Occupied", val: stats.occupied, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" }
          ].map(s => (
            <div key={s.label} className={`${s.bg} ${s.border} border p-6 rounded-3xl text-center backdrop-blur-md`}>
              <p className={`text-[10px] font-black uppercase tracking-tighter ${s.color} mb-1`}>{s.label}</p>
              <p className="text-4xl font-black">{s.val}</p>
            </div>
          ))}
        </div>

        {/* Slot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className="bg-slate-800/40 border border-slate-700/50 rounded-[2rem] p-8 hover:border-blue-500/50 transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black tracking-tight">{slot.name}</h3>
                  <p className="text-slate-500 text-sm flex items-center gap-1 mt-1"><MapPin size={14}/> {slot.location}</p>
                </div>
                <div className={`w-3 h-3 rounded-full animate-pulse ${slot.status === 'available' ? 'bg-emerald-500' : slot.status === 'reserved' ? 'bg-amber-500' : 'bg-rose-500'}`} />
              </div>
              
              <div className="text-4xl font-black mb-8">₱{slot.price}<span className="text-xs text-slate-600 font-medium uppercase ml-1 tracking-widest">/hr</span></div>

              <div className="flex gap-3">
                <button onClick={() => setSelectedSlot(slot)} className="flex-1 bg-slate-700 hover:bg-slate-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Details</button>
                {slot.status === 'available' && (
                  <button onClick={() => handleReserve(slot)} className="flex-1 bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20">Reserve</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Modal */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-[3rem] w-full max-w-md overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-slate-800 flex justify-between items-center">
                <h2 className="text-2xl font-black italic">SLOT <span className="text-blue-500">{selectedSlot.id}</span></h2>
                <button onClick={() => setSelectedSlot(null)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl transition-all"><XCircle/></button>
              </div>
              
              <div className="p-8 space-y-6">
                {selectedSlot.paid ? (
                  <div className="space-y-6">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl text-center">
                      <Zap className="mx-auto mb-3 text-emerald-400" size={32} />
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-1">Access Granted</p>
                      <p className="text-xl font-mono font-bold tracking-tighter text-white">{selectedSlot.activeQrToken}</p>
                    </div>
                    
                    <div className="bg-slate-800/50 p-8 rounded-3xl border border-slate-700/50">
                      <div className="flex justify-between items-center mb-8">
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Bollard</span>
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${selectedSlot.bollardUp ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                          {selectedSlot.bollardUp ? 'Locked' : 'Open'}
                        </span>
                      </div>
                      <button onClick={() => handleBollardToggle(selectedSlot)} className={`w-full py-6 rounded-2xl font-black text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${selectedSlot.bollardUp ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20' : 'bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20'}`}>
                        {selectedSlot.bollardUp ? <><ArrowDown size={20}/> Unlock</> : <><ArrowUp size={20}/> Lock</>}
                      </button>
                    </div>
                  </div>
                ) : (
                  selectedSlot.status === 'reserved' && selectedSlot.reservedBy === user.email ? (
                    <div className="space-y-4">
                      <div className="bg-slate-800 p-6 rounded-3xl">
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Pending Payment</p>
                        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 font-bold outline-none focus:border-blue-500">
                          <option>GCash</option>
                          <option>Maya</option>
                        </select>
                      </div>
                      <button onClick={() => handlePayment(selectedSlot)} className="w-full bg-blue-600 py-6 rounded-[2rem] font-black text-lg uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all active:scale-95">Pay ₱{selectedSlot.price}</button>
                    </div>
                  ) : null
                )}
                
                {selectedSlot.status === 'occupied' && (
                  <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-3xl flex items-center gap-4">
                    <Radio className="text-rose-500 animate-ping" size={24}/>
                    <div>
                      <p className="text-xs font-black text-rose-500 uppercase">Sensor Active</p>
                      <p className="text-slate-400 text-xs mt-1">Vehicle detected in slot.</p>
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