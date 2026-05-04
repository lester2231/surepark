"use client"
import { ref, onValue, update } from "firebase/database"
import { db } from "@/lib/firebase"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Car, LogOut, MapPin, Clock, CheckCircle2,
  XCircle, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Info,
  Search, CalendarCheck, Wallet, Zap, ArrowUp, ArrowDown, Radio, ShieldCheck, ScanLine
} from "lucide-react"

const ParkingMap = dynamic(() => import("@/components/ParkingMap"), {
  ssr: false,
  loading: () => <div className="w-full h-[440px] rounded-xl bg-slate-800 animate-pulse" />,
})

interface ParkingSlot {
  id: number; name: string; location: string; price: number;
  status: "available" | "reserved" | "occupied";
  bollardUp?: boolean;
}

const LOCATIONS = ["Session Road", "Harrison Road", "SM Baguio", "Cedar Peak", "Mabini"]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [slots, setSlots] = useState<ParkingSlot[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("All Locations")
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null)
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
        location: LOCATIONS[index] || "Baguio",
        price: 50,
        ...data[key],
      }))
      setSlots(formatted)
    })
    return () => unsubscribe()
  }, [router])

  const handleReset = async () => {
    const resetData: Record<string, any> = {};
    [1, 2, 3, 4, 5].forEach((id) => {
      resetData[`slot${id}`] = { status: "available", bollardUp: true }
    })
    await update(ref(db, "slots"), resetData)
  }

  const handleBollardToggle = async (slot: ParkingSlot) => {
    if (slot.status === 'occupied') return;
    await update(ref(db, `slots/slot${slot.id}`), { bollardUp: !slot.bollardUp })
  }

  const filteredSlots = selectedLocation === "All Locations" ? slots : slots.filter((s) => s.location === selectedLocation)
  const stats = {
    available: slots.filter((s) => s.status === "available").length,
    reserved: slots.filter((s) => s.status === "reserved").length,
    occupied: slots.filter((s) => s.status === "occupied").length,
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">SurePark Baguio</h1>
              <p className="text-slate-400 text-xs font-medium text-opacity-70">Welcome, {user.email.split('@')[0]}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-green-500 rounded-lg text-sm font-bold hover:bg-green-400 transition-colors"><ScanLine size={18}/> Scanner</button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg text-sm font-bold hover:bg-slate-600 transition-colors"><RefreshCw size={18}/> Reset</button>
            <button onClick={() => { localStorage.removeItem("surepark_user"); router.push("/login") }} className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg text-sm font-bold hover:bg-red-500 transition-colors"><LogOut size={18}/> Logout</button>
          </div>
        </div>

        {/* How to Use Section */}
        <div className="mb-8 rounded-xl border border-blue-900/50 bg-[#1e293b]/40 overflow-hidden shadow-lg">
          <button onClick={() => setShowTips(!showTips)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-blue-900/10 transition-colors">
            <div className="flex items-center gap-3 text-blue-400 font-bold text-xs uppercase tracking-widest">
              <Info size={16}/> How to use SurePark
            </div>
            {showTips ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
          </button>
          
          {showTips && (
            <div className="px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                  { id: 1, title: "Find a Slot", desc: "Use the filter or map pins. Green means available.", icon: <Search size={20}/> },
                  { id: 2, title: "Reserve the Slot", desc: "Click View. You have 15 minutes to pay.", icon: <CalendarCheck size={20}/> },
                  { id: 3, title: "Pay the Ticket", desc: "Pay via GCash or Maya to generate a token.", icon: <Wallet size={20}/> },
                  { id: 4, title: "Control the Bollard", desc: "Lower the bollard to enter the slot.", icon: <Zap size={20}/> },
                  { id: 5, title: "Car Detected", desc: "Sensor updates status to Occupied automatically.", icon: <Radio size={20}/> },
                  { id: 6, title: "Exit & Free", desc: "When you leave, the slot resets to Available.", icon: <Car size={20}/> },
                ].map((step) => (
                  <div key={step.id} className="bg-[#0f172a]/50 p-5 rounded-lg border border-slate-700/50 flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold text-[10px] shrink-0">{step.id}</div>
                    <div>
                      <h4 className="text-white text-xs font-bold mb-1 flex items-center gap-2">{step.icon} {step.title}</h4>
                      <p className="text-slate-400 text-[10px] leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Slot Status Colors */}
              <div className="pt-4 border-t border-slate-700/50 flex items-center gap-6">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Slot Status Colors</span>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300"><div className="w-2 h-2 rounded-full bg-green-500"/> Green — Available</div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300"><div className="w-2 h-2 rounded-full bg-yellow-500"/> Yellow — Reserved</div>
              </div>
            </div>
          )}
        </div>

        {/* Filter by Location */}
        <div className="mb-6 max-w-xs">
          <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block tracking-widest">Filter by Location</label>
          <div className="relative">
            <select 
              value={selectedLocation} 
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full bg-[#1e293b] border border-slate-700 text-white rounded-lg px-10 py-2.5 text-sm appearance-none focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
            >
              <option>All Locations</option>
              {LOCATIONS.map(loc => <option key={loc}>{loc}</option>)}
            </select>
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" size={16}/>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16}/>
          </div>
        </div>

        {/* Horizontal Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-900/10 border border-green-500/20 p-6 rounded-xl flex items-center justify-between">
            <div><p className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-1">Available</p><p className="text-4xl font-bold">{stats.available}</p></div>
            <div className="w-12 h-12 rounded-full border-2 border-green-500/30 flex items-center justify-center text-green-500"><CheckCircle2 size={24}/></div>
          </div>
          <div className="bg-yellow-900/10 border border-yellow-500/20 p-6 rounded-xl flex items-center justify-between">
            <div><p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest mb-1">Reserved</p><p className="text-4xl font-bold">{stats.reserved}</p></div>
            <div className="w-12 h-12 rounded-full border-2 border-yellow-500/30 flex items-center justify-center text-yellow-500"><Clock size={24}/></div>
          </div>
          <div className="bg-red-900/10 border border-red-500/20 p-6 rounded-xl flex items-center justify-between">
            <div><p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1">Occupied</p><p className="text-4xl font-bold">{stats.occupied}</p></div>
            <div className="w-12 h-12 rounded-full border-2 border-red-500/30 flex items-center justify-center text-red-500"><Car size={24}/></div>
          </div>
        </div>

        {/* Slot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className="bg-[#1e293b]/50 border border-slate-700/50 rounded-2xl p-6 hover:shadow-lg transition-all">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold">{slot.name}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                  slot.status === 'available' ? 'bg-green-500/10 text-green-500' : 
                  slot.status === 'reserved' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                }`}>{slot.status}</span>
              </div>
              <p className="text-slate-400 text-xs flex items-center gap-1.5 mb-4"><MapPin size={14} className="text-blue-500"/> {slot.location}</p>
              <div className="text-2xl font-black mb-6">₱{slot.price} <span className="text-xs text-slate-500 font-normal">/hour</span></div>
              <button onClick={() => setSelectedSlot(slot)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-lg">View Details</button>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl mb-12">
          <ParkingMap slots={slots} onLocationClick={setSelectedLocation} selectedLocation={selectedLocation} />
        </div>

        {/* Detail Modal */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <div><h2 className="text-xl font-bold">{selectedSlot.name}</h2><p className="text-slate-400 text-xs">{selectedSlot.location}</p></div>
                <button onClick={() => setSelectedSlot(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors"><XCircle size={24}/></button>
              </div>
              <div className="bg-[#0f172a] p-5 rounded-2xl border border-blue-500/20 space-y-4">
                 <div className="flex justify-between items-center px-2">
                    <p className="text-xs font-bold text-slate-400 flex items-center gap-2"><Zap size={14} className={selectedSlot.status === 'occupied' ? "text-slate-600" : "text-yellow-400"}/> Bollard Status</p>
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
                   {selectedSlot.status === 'occupied' ? <><ShieldCheck size={18}/> Safety Locked</> : (selectedSlot.bollardUp ? <><ArrowDown size={18}/> Lower Bollard</> : <><ArrowUp size={18}/> Raise Bollard</>)}
                 </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}