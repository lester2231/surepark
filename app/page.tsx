{/* Modal Logic */}
        {selectedSlot && (
          <div className="fixed inset-0 bg-[#000]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-[#1e293b] border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold">{selectedSlot.name}</h2>
                  <p className="text-slate-400 text-xs">{selectedSlot.location}</p>
                </div>
                <button onClick={() => setSelectedSlot(null)} className="p-2 hover:bg-slate-800 rounded-full">
                  <XCircle size={24}/>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="flex-1 bg-[#0f172a] p-4 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Status</p>
                    <p className="text-sm font-bold text-blue-400 uppercase">{selectedSlot.status}</p>
                  </div>
                  <div className="flex-1 bg-[#0f172a] p-4 rounded-xl border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Price</p>
                    <p className="text-sm font-bold text-white uppercase">₱{selectedSlot.price}</p>
                  </div>
                </div>

                {selectedSlot.reservedBy === user.email && !selectedSlot.paid && (
                  <button onClick={() => handlePayment(selectedSlot)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold shadow-lg transition-all">
                    Pay ₱{selectedSlot.price} Now
                  </button>
                )}

                {selectedSlot.paid && (
                  <div className="bg-[#0f172a] p-5 rounded-2xl border border-blue-500/20 space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-slate-400 flex items-center gap-2">
                        <Zap size={14} className={selectedSlot.status === 'occupied' ? "text-slate-500" : "text-yellow-400"}/> 
                        Bollard Control
                      </p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedSlot.bollardUp ? 'bg-red-500' : 'bg-green-500'}`}>
                        {selectedSlot.bollardUp ? 'RAISED' : 'LOWERED'}
                      </span>
                    </div>

                    {/* BOLLARD BUTTON WITH SAFETY LOCK */}
                    <button 
                      disabled={selectedSlot.status === 'occupied'}
                      onClick={() => handleBollardToggle(selectedSlot)} 
                      className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                        selectedSlot.status === 'occupied' 
                          ? 'bg-slate-700 cursor-not-allowed opacity-50' 
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
                      <p className="text-[9px] text-center text-red-400 font-bold uppercase tracking-widest animate-pulse">
                        <AlertCircle className="inline mb-0.5" size={10}/> Vehicle detected: Control disabled for safety
                      </p>
                    ) : (
                      <p className="text-[9px] text-center text-blue-400 font-bold uppercase tracking-widest">
                        <ShieldCheck className="inline mb-0.5" size={10}/> Manual Control Enabled
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}