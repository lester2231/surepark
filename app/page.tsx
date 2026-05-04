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
        sensorActive: false 
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
      sensorActive: false 
    })
  }

  const handlePayment = async (slot: ParkingSlot) => {
    const qrToken = `SP-${slot.id}-${Date.now().toString(36).toUpperCase()}`
    await update(ref(db, `slots/slot${slot.id}`), { 
      paid: true, 
      activeQrToken: qrToken,
      sensorActive: false 
    })
  }

  const handleBollardToggle = async (slot: ParkingSlot) => {
    if (slot.status === 'occupied') return
    const nextBollardState = !slot.bollardUp
    
    // CRITICAL LOGIC: Sensor activates ONLY if Paid AND Bollard is being lowered (false)
    const shouldSensorBeActive = slot.paid && nextBollardState === false

    await update(ref(db, `slots/slot${slot.id}`), { 
      bollardUp: nextBollardState,
      sensorActive: shouldSensorBeActive 
    })
  }

  const filteredSlots = selectedLocation === "All" ? slots : slots.filter((s) => s.location === selectedLocation)
  const stats = {
    available: slots.filter((s) => s.status === "available").length,
    reserved: slots.filter((s) => s.status === "reserved").length,
    occupied: slots.filter((s) => s.status === "occupied").length,
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 md:p-8 text-white font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">SurePark Baguio</h1>
              <p className="text-slate-400 text-sm">Hardware Control Dashboard</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-[#334155] hover:bg-[#475569] rounded-lg text-sm font-semibold transition-colors"><RefreshCw size={18}/> Reset System</button>
            <button onClick={() => { localStorage.removeItem("surepark_user"); router.push("/login") }} className="flex items-center gap-2 px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] rounded-lg text-sm font-semibold transition-colors"><LogOut size={18}/> Logout</button>
          </div>
        </div>

        {/* Slot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className="bg-[#1e293b] border border-slate-700 rounded-xl p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold">{slot.name}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${slot.status === 'available' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{slot.status}</span>
              </div>
              <div className="space-y-3 mb-6">
                 <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                    <span className="text-slate-500">Bollard:</span>
                    <span className={slot.bollardUp ? "text-red-500" : "text-green-500"}>{slot.bollardUp ? "UP" : "DOWN"}</span>
                 </div>
                 <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                    <span className="text-slate-500">Sensor Power:</span>
                    <span className={slot.sensorActive ? "text-blue-400 animate-pulse" : "text-slate-600"}>{slot.sensorActive ? "ON (Listening)" : "OFF"}</span>
                 </div>
              </div>
              <button onClick={() => setSelectedSlot(slot)} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-bold transition-all shadow-lg">Manage Slot</button>
            </div>
          ))}
        </div>

        {/* Modal */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold">{selectedSlot.name} Control</h2>
                <button onClick={() => setSelectedSlot(null)} className="text-slate-500 hover:text-white"><XCircle size={28}/></button>
              </div>

              <div className="space-y-4">
                {!selectedSlot.paid && (
                  <button onClick={() => handlePayment(selectedSlot)} className="w-full bg-yellow-600 hover:bg-yellow-500 py-4 rounded-xl font-bold uppercase text-xs">Simulate Payment</button>
                )}

                {selectedSlot.paid && (
                  <>
                    <div className="bg-[#0f172a] border border-slate-700 rounded-xl p-5 text-center">
                        <p className="text-[10px] text-slate-500 font-bold uppercase mb-4">Bollard Physical State</p>
                        <div className="flex justify-center items-end h-20 mb-4">
                            <div className={`w-8 rounded-t transition-all duration-1000 ${selectedSlot.bollardUp ? 'h-16 bg-red-500' : 'h-2 bg-green-500'}`} />
                        </div>
                        <button onClick={() => handleBollardToggle(selectedSlot)} className={`w-full py-3 rounded-lg font-bold text-xs uppercase ${selectedSlot.bollardUp ? 'bg-green-600' : 'bg-red-600'}`}>
                            {selectedSlot.bollardUp ? "Lower Bollard" : "Raise Bollard"}
                        </button>
                    </div>

                    <div className={`p-4 rounded-xl border ${selectedSlot.sensorActive ? 'bg-blue-900/20 border-blue-800' : 'bg-slate-800/40 border-slate-700 opacity-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Radio className={`w-4 h-4 ${selectedSlot.sensorActive ? 'text-blue-400' : 'text-slate-500'}`} />
                            <span className="text-sm font-bold">Hardware Sensor Logic</span>
                        </div>
                        <p className="text-xs text-slate-400">
                            {selectedSlot.sensorActive 
                                ? "SENSOR IS ACTIVE. The ESP32 is now allowed to detect cars." 
                                : "SENSOR IS LOCKED. The ESP32 will ignore all car detections until bollard is lowered."}
                        </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}