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
  activated?: boolean
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

  // ── AUTH + REALTIME FIREBASE LISTENER ─────────────────────────────────────
  useEffect(() => {
    const userData = localStorage.getItem("surepark_user")
    if (!userData) {
      router.push("/login")
      return
    }
    setUser(JSON.parse(userData))

    const slotsRef = ref(db, "slots")

    // Listen for changes across ALL slots in realtime
    const unsubscribe = onValue(slotsRef, (snapshot) => {
      const data = snapshot.val()

      if (!data) {
        setSlots(DEFAULT_SLOTS)
        return
      }

      const formatted = Object.keys(data).map((key, index) => {
        // Find corresponding default data for price/location info
        const defaultInfo = DEFAULT_SLOTS[index] || DEFAULT_SLOTS[0]
        return {
          id: index + 1,
          name: `Slot ${index + 1}`,
          location: LOCATIONS[index] || "Unknown",
          price: defaultInfo.price,
          ...data[key],
        }
      })

      setSlots(formatted)
      
      // Sync selected slot if modal is open
      if (selectedSlot) {
        const updated = formatted.find((s) => s.id === selectedSlot.id)
        if (updated) setSelectedSlot(updated)
      }
    })

    return () => unsubscribe()
  }, [router, selectedSlot?.id])

  // ── RESERVATION EXPIRY (STILL CLIENT SIDE AUTO-RESET) ────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      slots.forEach((s) => {
        if (s.status === "reserved" && !s.checkedIn && s.reservedAt && now - s.reservedAt > 15 * 60 * 1000) {
          update(ref(db, `slots/slot${s.id}`), {
            status: "available",
            reservedBy: null,
            reservedAt: null,
            paid: false,
            activeQrToken: null,
            bollardUp: false
          })
        }
      })
    }, 5000)
    return () => clearInterval(timer)
  }, [slots])

  const handleLogout = () => {
    localStorage.removeItem("surepark_user")
    router.push("/login")
  }

  const handleReserve = async (slot: ParkingSlot) => {
    if (!user) return
    if (slot.status !== "available") return

    await update(ref(db, `slots/slot${slot.id}`), {
      status: "reserved",
      reservedBy: user.email,
      reservedAt: Date.now(),
      bollardUp: true,
    })
  }

  const handlePayment = async (slot: ParkingSlot) => {
    if (!slot.reservedBy || slot.reservedBy !== user.email) return
    const qrToken = `SP-${slot.id}-${Date.now().toString(36).toUpperCase()}`
    
    await update(ref(db, `slots/slot${slot.id}`), {
      paid: true,
      activeQrToken: qrToken
    })
  }

  const handleBollardToggle = async (slot: ParkingSlot) => {
    if (!slot.paid || slot.status !== "reserved") return
    
    await update(ref(db, `slots/slot${slot.id}`), {
      bollardUp: !slot.bollardUp,
    })
  }

  const handleScanQr = async () => {
    setScanResult(null)
    if (!qrInput.trim()) { setScanResult({ success: false, message: "Please enter a QR token" }); return }
    const slot = slots.find((s) => s.activeQrToken === qrInput.trim())
    
    if (!slot) { setScanResult({ success: false, message: "Invalid QR token" }); return }
    if (slot.status !== "reserved") { setScanResult({ success: false, message: "Slot is not reserved" }); return }
    if (!slot.paid) { setScanResult({ success: false, message: "Payment not completed" }); return }

    await update(ref(db, `slots/slot${slot.id}`), {
      status: "occupied",
      checkedIn: true,
      bollardUp: true
    })
    
    setScanResult({ success: true, message: `Check-in successful! ${slot.name} is now occupied.` })
    setQrInput("")
  }

  const handleReset = async () => {
    // Reset all slots in Firebase to default
    const resetData: any = {}
    DEFAULT_SLOTS.forEach((slot) => {
      resetData[`slot${slot.id}`] = {
        status: "available",
        bollardUp: false,
        paid: false
      }
    })
    await update(ref(db, "slots"), resetData)
    setSelectedSlot(null)
    setScanResult(null)
  }

  // Filter and Stats logic
  const filteredSlots = selectedLocation === "All" ? slots : slots.filter((s) => s.location === selectedLocation)
  const stats = {
    available: filteredSlots.filter((s) => s.status === "available").length,
    reserved: filteredSlots.filter((s) => s.status === "reserved").length,
    occupied: filteredSlots.filter((s) => s.status === "occupied").length,
  }
  const myReservations = slots.filter((s) => s.reservedBy === user?.email && s.status === "reserved")

  const getTimeRemaining = (reservedAt: number) => {
    const elapsed = Date.now() - reservedAt
    const remaining = 15 * 60 * 1000 - elapsed
    if (remaining <= 0) return "Expired"
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">SurePark Baguio</h1>
              <p className="text-slate-400 text-sm">Welcome, {user.name || user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowScanner(!showScanner)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
              <QrCode className="w-4 h-4" /> Scanner
            </button>
            <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" /> Reset
            </button>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>

        {/* QR Scanner Panel */}
        {showScanner && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <QrCode className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-bold text-white">QR Code Scanner</h2>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="e.g., SP-3-ABC123"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white"
              />
              <button onClick={handleScanQr} className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg">
                Validate & Check In
              </button>
              {scanResult && (
                <div className={`flex items-start gap-3 p-4 rounded-lg ${scanResult.success ? "bg-green-900/50 border-green-700" : "bg-red-900/50 border-red-700"}`}>
                  <p className={`text-sm ${scanResult.success ? "text-green-200" : "text-red-200"}`}>{scanResult.message}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tips Section (Condensed for brevity) */}
        <div className="mb-6 rounded-xl border border-blue-800/60 bg-blue-950/40 overflow-hidden">
          <button onClick={() => setShowTips((v) => !v)} className="w-full flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2.5">
              <Info className="w-4 h-4 text-blue-400" />
              <span className="text-blue-300 font-semibold text-sm uppercase">Real-Time Parking Guide</span>
            </div>
            {showTips ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
          </button>
          {showTips && (
            <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-xs text-slate-400"><b className="text-blue-400">1. Reserve:</b> Pick a slot and reserve it.</div>
              <div className="text-xs text-slate-400"><b className="text-green-400">2. Pay:</b> Complete payment to unlock bollard control.</div>
              <div className="text-xs text-slate-400"><b className="text-yellow-400">3. Park:</b> Lower the bollard and drive in. Sensor does the rest.</div>
            </div>
          )}
        </div>

        {/* Filters and Stats */}
        <div className="mb-6">
          <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="bg-slate-800 text-white p-2 rounded-lg border border-slate-600">
            <option value="All">All Locations</option>
            {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-900/30 border border-green-700 p-6 rounded-lg">
            <p className="text-green-400 text-sm">Available</p>
            <p className="text-3xl font-bold text-white">{stats.available}</p>
          </div>
          <div className="bg-yellow-900/30 border border-yellow-700 p-6 rounded-lg">
            <p className="text-yellow-400 text-sm">Reserved</p>
            <p className="text-3xl font-bold text-white">{stats.reserved}</p>
          </div>
          <div className="bg-red-900/30 border border-red-700 p-6 rounded-lg">
            <p className="text-red-400 text-sm">Occupied</p>
            <p className="text-3xl font-bold text-white">{stats.occupied}</p>
          </div>
        </div>

        {/* Slot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSlots.map((slot) => (
            <div key={slot.id} className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-white">{slot.name}</h3>
                <span className={`px-2 py-1 rounded text-xs ${slot.status === "available" ? "bg-green-500/20 text-green-400" : slot.status === "reserved" ? "bg-yellow-500/20 text-yellow-400" : "bg-red-500/20 text-red-400"}`}>
                  {slot.status.toUpperCase()}
                </span>
              </div>
              <p className="text-white text-2xl font-bold mb-4">₱{slot.price}<span className="text-sm text-slate-400 font-normal">/hr</span></p>
              <div className="flex gap-2">
                <button onClick={() => setSelectedSlot(slot)} className="flex-1 bg-slate-700 py-2 rounded-lg text-white text-sm">View</button>
                {slot.status === "available" && (
                  <button onClick={() => handleReserve(slot)} className="flex-1 bg-blue-600 py-2 rounded-lg text-white text-sm">Reserve</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="mt-10">
          <ParkingMap slots={slots} onLocationClick={setSelectedLocation} selectedLocation={selectedLocation} />
        </div>

        {/* Detail Modal */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[2000]">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-white">{selectedSlot.name}</h3>
                <button onClick={() => setSelectedSlot(null)}><XCircle className="text-slate-400" /></button>
              </div>

              {selectedSlot.reservedBy === user.email && !selectedSlot.paid && (
                <div className="space-y-4">
                   <p className="text-slate-300 text-sm">To secure this slot, please complete payment.</p>
                   <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-slate-900 text-white p-3 rounded-lg border border-slate-700">
                     <option value="GCash">GCash</option>
                     <option value="Maya">Maya</option>
                   </select>
                   <button onClick={() => handlePayment(selectedSlot)} className="w-full bg-blue-600 py-3 rounded-lg text-white font-bold">Pay ₱{selectedSlot.price}</button>
                </div>
              )}

              {selectedSlot.paid && (
                <div className="space-y-4">
                  <div className="bg-green-900/20 p-4 border border-green-800 rounded-lg text-center">
                    <p className="text-green-400 font-bold">Payment Confirmed</p>
                    <p className="text-white font-mono mt-2">{selectedSlot.activeQrToken}</p>
                  </div>
                  
                  <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-white text-sm">Bollard Gate</span>
                        <span className={`text-xs px-2 py-1 rounded font-bold ${selectedSlot.bollardUp ? "bg-red-500 text-white" : "bg-green-500 text-white"}`}>
                            {selectedSlot.bollardUp ? "LOCKED" : "OPEN"}
                        </span>
                    </div>
                    <button 
                        onClick={() => handleBollardToggle(selectedSlot)}
                        className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 ${selectedSlot.bollardUp ? "bg-green-600" : "bg-red-600"}`}
                    >
                        {selectedSlot.bollardUp ? <><ArrowDown size={18}/> Lower Bollard</> : <><ArrowUp size={18}/> Raise Bollard</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}