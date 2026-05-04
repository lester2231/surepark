"use client"
import { ref, onValue, update } from "firebase/database"
import { db } from "@/lib/firebase"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import {
  Car,
  LogOut,
  MapPin,
  Clock,
  CreditCard,
  QrCode,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Search,
  CalendarCheck,
  Wallet,
  ScanLine,
  ArrowUp,
  ArrowDown,
  Radio,
  ShieldCheck,
  Zap,
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
  id: number
  name: string
  location: string
  price: number
  status: "available" | "reserved" | "occupied"
  reservedBy?: string
  reservedAt?: number
  paid?: boolean
  activeQrToken?: string
  checkedIn?: boolean
  bollardUp?: boolean
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
  const [qrInput, setQrInput] = useState("")
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [showMap, setShowMap] = useState(true)
  const [showTips, setShowTips] = useState(true)

  // ── FIREBASE REALTIME SYNC ──
  useEffect(() => {
    const userData = localStorage.getItem("surepark_user")
    if (!userData) {
      router.push("/login")
      return
    }
    setUser(JSON.parse(userData))

    const slotsRef = ref(db, "slots")
    const unsubscribe = onValue(slotsRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) {
        setSlots(DEFAULT_SLOTS)
        return
      }

      const formatted = Object.keys(data).map((key, index) => ({
        id: index + 1,
        name: `Slot ${index + 1}`,
        location: LOCATIONS[index],
        price: DEFAULT_SLOTS[index].price,
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

  // ── CORE ACTIONS ──
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
    await update(ref(db, `slots/slot${slot.id}`), {
      paid: true,
      activeQrToken: qrToken,
    })
  }

  const handleBollardToggle = async (slot: ParkingSlot) => {
    await update(ref(db, `slots/slot${slot.id}`), {
      bollardUp: !slot.bollardUp,
    })
  }

  const handleScanQr = async () => {
    const slot = slots.find((s) => s.activeQrToken === qrInput.trim())
    if (!slot || !slot.paid) {
      setScanResult({ success: false, message: "Invalid or unpaid QR token" })
      return
    }
    await update(ref(db, `slots/slot${slot.id}`), {
      status: "occupied",
      checkedIn: true,
    })
    setScanResult({ success: true, message: `Checked in to ${slot.name}` })
    setQrInput("")
  }

  const handleReset = async () => {
    const resetData: any = {}
    DEFAULT_SLOTS.forEach((s) => {
      resetData[`slot${s.id}`] = { status: "available", bollardUp: false, paid: false, reservedBy: null }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8 text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">SurePark Baguio</h1>
              <p className="text-slate-400 text-sm">Active Session: {user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowScanner(!showScanner)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-all">
              <QrCode className="w-4 h-4" /> Scanner
            </button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all">
              <RefreshCw className="w-4 h-4" /> Reset
            </button>
            <button onClick={() => { localStorage.removeItem("surepark_user"); router.push("/login") }} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-all">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>

        {/* Scanner Panel */}
        {showScanner && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8 animate-in fade-in slide-in-from-top-4">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><ScanLine className="text-green-500" /> Digital Check-in</h2>
            <div className="flex gap-2">
              <input value={qrInput} onChange={(e) => setQrInput(e.target.value)} placeholder="Enter QR Token" className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2" />
              <button onClick={handleScanQr} className="bg-green-600 px-6 py-2 rounded-lg font-bold">Validate</button>
            </div>
            {scanResult && <p className={`mt-2 text-sm ${scanResult.success ? "text-green-400" : "text-red-400"}`}>{scanResult.message}</p>}
          </div>
        )}

        {/* How to Use Section (Matches image_9b7a91.png) */}
        <div className="mb-8 rounded-xl border border-blue-800/40 bg-slate-800/40 backdrop-blur-sm overflow-hidden">
          <button onClick={() => setShowTips(!showTips)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-700/30 transition-colors">
            <div className="flex items-center gap-2 font-bold text-sm tracking-wider uppercase text-blue-400">
              <Info className="w-4 h-4" /> How to use SurePark
            </div>
            {showTips ? <ChevronUp /> : <ChevronDown />}
          </button>
          {showTips && (
            <div className="p-6 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { step: 1, icon: <Search className="text-blue-400" />, title: "Find a Slot", desc: "Use the filter or map to find green pins." },
                  { step: 2, icon: <CalendarCheck className="text-green-400" />, title: "Reserve", desc: "Select a slot and reserve. You have 15 mins to pay." },
                  { step: 3, icon: <Wallet className="text-yellow-400" />, title: "Pay", desc: "Pay via GCash or Maya to get your QR code." },
                  { step: 4, icon: <Zap className="text-orange-400" />, title: "Bollard", desc: "After payment, lower the bollard to enter." },
                  { step: 5, icon: <Radio className="text-purple-400" />, title: "Auto-Detect", desc: "ESP32 sensor detects your car and updates status." },
                  { step: 6, icon: <Car className="text-slate-400" />, title: "Exit", desc: "When you leave, the slot resets to Available." },
                ].map((s) => (
                  <div key={s.step} className="flex gap-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-blue-400 border border-slate-700">{s.step}</div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 font-semibold">{s.icon} {s.title}</div>
                      <p className="text-xs text-slate-400 leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-6 text-xs border-t border-slate-700 pt-4">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500" /> Available</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500" /> Reserved</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500" /> Occupied</div>
              </div>
            </div>
          )}
        </div>

        {/* Filters and Stats */}
        <div className="flex flex-col md:flex-row gap-6 mb-8 items-end">
          <div className="w-full md:w-72">
            <label className="block text-sm font-medium text-slate-400 mb-2">Filter by Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
              <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 appearance-none focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="All">All Locations</option>
                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-4 w-full">
            <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl text-center">
              <p className="text-xs text-green-400 font-bold uppercase">Available</p>
              <p className="text-2xl font-bold">{stats.available}</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-center">
              <p className="text-xs text-yellow-400 font-bold uppercase">Reserved</p>
              <p className="text-2xl font-bold">{stats.reserved}</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-center">
              <p className="text-xs text-red-400 font-bold uppercase">Occupied</p>
              <p className="text-2xl font-bold">{stats.occupied}</p>
            </div>
          </div>
        </div>

        {/* Slot Grid (Matches image_9b7a59.png) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className={`bg-slate-800/80 border rounded-2xl p-6 transition-all hover:translate-y-[-4px] ${slot.status === 'available' ? 'border-green-500/30' : slot.status === 'reserved' ? 'border-yellow-500/30' : 'border-red-500/30'}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold">{slot.name}</h3>
                  <div className="flex items-center gap-1 text-slate-400 text-sm mt-1"><MapPin size={14}/> {slot.location}</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${slot.status === 'available' ? 'bg-green-500/20 text-green-400' : slot.status === 'reserved' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                  {slot.status}
                </span>
              </div>
              <div className="text-3xl font-bold mb-4">₱{slot.price}<span className="text-sm text-slate-500 font-normal"> /hour</span></div>
              
              {slot.reservedBy && (
                <div className="bg-slate-900/80 rounded-xl p-4 mb-4 border border-slate-700">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Reserved By</p>
                  <p className="text-sm font-medium truncate">{slot.reservedBy}</p>
                  {slot.reservedAt && slot.status === 'reserved' && (
                    <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
                      <Clock size={12}/> Time left: {getTimeRemaining(slot.reservedAt)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setSelectedSlot(slot)} className="flex-1 bg-slate-700 hover:bg-slate-600 py-2.5 rounded-xl text-sm font-bold transition-all">View</button>
                {slot.status === 'available' && (
                  <button onClick={() => handleReserve(slot)} className="flex-1 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-xl text-sm font-bold transition-all">Reserve</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {showMap && <ParkingMap slots={slots} onLocationClick={setSelectedLocation} selectedLocation={selectedLocation} />}

        {/* Detailed Modal */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <h2 className="text-2xl font-bold">{selectedSlot.name} Details</h2>
                <button onClick={() => setSelectedSlot(null)} className="p-2 hover:bg-slate-700 rounded-full"><XCircle/></button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl">
                  <span className="text-slate-400">Current Status</span>
                  <span className="font-bold uppercase text-blue-400">{selectedSlot.status}</span>
                </div>

                {selectedSlot.reservedBy === user.email && !selectedSlot.paid && (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-400">Please complete payment to access the bollard control.</p>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3">
                      <option>GCash</option>
                      <option>Maya</option>
                    </select>
                    <button onClick={() => handlePayment(selectedSlot)} className="w-full bg-blue-600 py-4 rounded-2xl font-bold text-lg">Pay ₱{selectedSlot.price}</button>
                  </div>
                )}

                {selectedSlot.paid && (
                  <div className="space-y-6">
                    <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-2xl text-center">
                      <CheckCircle2 className="mx-auto mb-2 text-green-500" />
                      <p className="text-xs text-green-400 font-bold uppercase">Payment Confirmed</p>
                      <p className="text-lg font-mono mt-1">{selectedSlot.activeQrToken}</p>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-700">
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-slate-400">Bollard Position</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedSlot.bollardUp ? 'bg-red-500' : 'bg-green-500'}`}>
                          {selectedSlot.bollardUp ? 'RAISED (LOCKED)' : 'LOWERED (OPEN)'}
                        </span>
                      </div>
                      <button onClick={() => handleBollardToggle(selectedSlot)} className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${selectedSlot.bollardUp ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}>
                        {selectedSlot.bollardUp ? <><ArrowDown size={18}/> Lower Bollard</> : <><ArrowUp size={18}/> Raise Bollard</>}
                      </button>
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