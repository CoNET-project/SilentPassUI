import React, { useState, useMemo } from 'react'
import { Fuel, Plus, Minus, ChevronRight, RefreshCw, Filter, Link2 } from 'lucide-react'

const REFUEL_GAS_COST = 2

const generateExtendedLogs = () => {
  const baseLogs = [
    { id: "LOG-892A", title: "Service Fee (0.8%)", subtitle: "Payment Request #892", amount: -80, time: "Feb 21, 14:22", type: "fee", status: "Completed", linkedUsdc: "100.00 USDC", txHash: "0x8f2a...4b1c", network: "Base 主网" },
    { id: "LOG-891B", title: "Network Gas", subtitle: "P2P Send to @Simon", amount: -2, time: "2h ago", type: "gas", status: "Completed", linkedUsdc: "1.00 USDC", txHash: "0x1c9d...9e2f", network: "Base 主网" },
    { id: "LOG-890C", title: "Manual Refuel Gain", subtitle: "Swap $5.00 USDC", amount: 498, time: "5h ago", type: "refuel", status: "Completed", linkedUsdc: "-5.00 USDC", txHash: "0x4a1b...2c3d", network: "Base 主网" },
    { id: "LOG-889D", title: "Reward Backfill", subtitle: "CashTree Card Claim #102", amount: 100, time: "昨天", type: "reward", status: "Completed", linkedUsdc: "N/A", txHash: "0x9e8f...1a2b", network: "CoNET L1" }
  ]
  const extraLogs = Array.from({ length: 10 }).map((_, i) => ({
    id: `LOG-EXT-${i}`,
    title: i % 3 === 0 ? "Auto-Refuel" : i % 3 === 1 ? "Service Fee (0.8%)" : "Network Gas",
    subtitle: `Historical Txn #${500 - i}`,
    amount: i % 3 === 0 ? 98 : i % 3 === 1 ? -45 : -2,
    time: `Feb ${20 - Math.floor(i / 3)}, 10:00`,
    type: i % 3 === 0 ? "refuel" : i % 3 === 1 ? "fee" : "gas",
    status: "Completed",
    linkedUsdc: "N/A",
    txHash: "0x" + Math.random().toString(16).substr(2, 8) + "...",
    network: "Base 主网"
  }))
  return [...baseLogs, ...extraLogs]
}

type LogEntry = { id: string; title: string; subtitle: string; amount: number; time: string; type: string; status: string; linkedUsdc: string; txHash: string; network: string }

interface FuelViewProps {
  onClose: () => void
}

const FuelView: React.FC<FuelViewProps> = ({ onClose }) => {
  const [bUnits, setBUnits] = useState(852)
  const [refuelAmount, setRefuelAmount] = useState(5)
  const [isRefueling, setIsRefueling] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [ledgerFilter, setLedgerFilter] = useState('all')
  const [visibleLogs, setVisibleLogs] = useState(5)
  const [bUnitsLedger, setBUnitsLedger] = useState(generateExtendedLogs)

  const fuelStatus = useMemo(() => {
    if (bUnits > 50) return { label: 'Optimal', bar: 'bg-orange-500', width: '85%' }
    if (bUnits >= 10) return { label: 'Warning', bar: 'bg-amber-500', width: '30%' }
    if (bUnits >= 0) return { label: 'Critical', bar: 'bg-red-500', width: '5%' }
    return { label: 'Overdraft', bar: 'bg-purple-600', width: '0%' }
  }, [bUnits])

  const filteredLedger = useMemo(() => {
    if (ledgerFilter === 'all') return bUnitsLedger
    return bUnitsLedger.filter((log: LogEntry) => log.type === ledgerFilter)
  }, [bUnitsLedger, ledgerFilter])

  const handleRefuel = () => {
    setIsRefueling(true)
    setTimeout(() => {
      setBUnits(prev => prev + (refuelAmount * 100) - REFUEL_GAS_COST)
      setBUnitsLedger(prev => [{
        id: `LOG-${Math.floor(Math.random() * 10000)}`,
        title: "Manual Refuel Gain",
        subtitle: `Swap $${refuelAmount.toFixed(2)} USDC`,
        amount: (refuelAmount * 100) - REFUEL_GAS_COST,
        time: "刚刚",
        type: "refuel",
        status: "Completed",
        linkedUsdc: `-${refuelAmount.toFixed(2)} USDC`,
        txHash: "0x" + Math.random().toString(16).substr(2, 8),
        network: "Base 主网"
      }, ...prev])
      setIsRefueling(false)
    }, 1200)
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fdfdff] dark:bg-slate-900 pb-32">
      <div className="px-6 pt-10 flex items-center gap-4 shrink-0">
        <button onClick={onClose} className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <ChevronRight size={22} className="rotate-180" />
        </button>
        <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Fuel Center</h2>
      </div>

      <div className="px-6 pt-8 space-y-6 flex-1 overflow-y-auto">
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none border border-slate-50 dark:border-slate-700">
          <div className="flex justify-between items-center mb-1">
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Network Fuel Balance</p>
            <div className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase bg-orange-100 dark:bg-orange-900/30 text-slate-600 dark:text-slate-300">
              {fuelStatus.label}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-[4.5rem] leading-none font-black tracking-tighter ${bUnits < 10 ? 'text-red-500' : 'text-orange-500'}`}>{bUnits}</span>
            <span className="text-orange-500 font-bold text-xl uppercase">B-Units</span>
          </div>
          <div className="mt-8 h-2.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
            <div style={{ width: fuelStatus.width }} className={`${fuelStatus.bar} h-full rounded-full transition-all duration-1000`} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none border border-slate-50 dark:border-slate-700 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Select Amount</h3>
            <div className="bg-[#E1F5FE] dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-700/50 px-4 py-2 rounded-full flex items-center gap-2">
              <Link2 size={14} className="text-[#3498DB]" strokeWidth={2.5} />
              <span className="text-base font-black text-[#3498DB]">${refuelAmount}</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase">USDC</span>
            </div>
          </div>

          <div className="flex items-center gap-4 px-1">
            <button onClick={() => setRefuelAmount(Math.max(1, refuelAmount - 1))} className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all">
              <Minus size={20} strokeWidth={2.5} />
            </button>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={refuelAmount}
              onChange={e => setRefuelAmount(Number(e.target.value))}
              className="flex-1 h-3 bg-slate-200 dark:bg-slate-600 rounded-lg cursor-pointer accent-[#3498DB]"
            />
            <button onClick={() => setRefuelAmount(Math.min(100, refuelAmount + 1))} className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all">
              <Plus size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-[13px] font-bold">
              <span className="text-slate-500 dark:text-slate-400">燃料收益 (1:100)</span>
              <span className="text-green-600 font-black">+{refuelAmount * 100} B-Units</span>
            </div>
            <div className="flex justify-between text-[13px] font-bold">
              <span className="text-slate-500 dark:text-slate-400 tracking-tight">Refuel Fee (Shadow Gas)</span>
              <span className="text-red-500 font-black">-{REFUEL_GAS_COST} B-Units</span>
            </div>
            <div className="border-t border-slate-300 dark:border-slate-600 pt-4 flex justify-between items-center">
              <span className="text-[14px] font-black text-slate-700 dark:text-slate-200">Net Deposit</span>
              <span className="text-[22px] font-black text-orange-500 leading-none">
                +{refuelAmount * 100 - REFUEL_GAS_COST} <span className="text-[11px] font-bold opacity-80 uppercase">B-Units</span>
              </span>
            </div>
          </div>

          <button
            onClick={handleRefuel}
            disabled={isRefueling}
            className="w-full bg-orange-500 hover:bg-orange-600 py-4 rounded-[1.5rem] text-white font-black text-[15px] uppercase tracking-wide shadow-[0_8px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:shadow-none transition-all flex items-center justify-center gap-2"
          >
            {isRefueling ? <RefreshCw size={20} className="animate-spin" /> : <><Fuel size={20} fill="currentColor" strokeWidth={1.5} /> Refuel Now</>}
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-[13px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">B-Units Ledger</h3>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`text-[11px] font-bold flex items-center gap-1 px-2.5 py-1 rounded-full transition-colors ${showFilters ? 'bg-orange-500 text-white' : 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30'}`}
            >
              <Filter size={12} /> Filter
            </button>
          </div>

          {showFilters && (
            <div className="flex gap-2 px-2 overflow-x-auto pb-1">
              {['all', 'fee', 'gas', 'refuel', 'reward'].map(f => (
                <button
                  key={f}
                  onClick={() => setLedgerFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold capitalize whitespace-nowrap transition-colors ${ledgerFilter === f ? 'bg-slate-800 dark:bg-slate-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                >
                  {f === 'all' ? '全部' : f === 'fee' ? 'Service Fees' : f === 'gas' ? 'Network Gas' : f === 'refuel' ? 'Refuels' : 'Rewards'}
                </button>
              ))}
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-[2rem] overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-50 dark:border-slate-700">
            <div className="divide-y divide-slate-50 dark:divide-slate-700">
              {filteredLedger.slice(0, visibleLogs).map((log: LogEntry) => (
                <div key={log.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm bg-orange-50 dark:bg-orange-900/20 text-orange-500">
                      {log.type === 'refuel' ? <Plus size={18} strokeWidth={3} /> : <Fuel size={16} fill="currentColor" />}
                    </div>
                    <div>
                      <p className="text-[14px] font-black text-slate-800 dark:text-slate-100 leading-tight">{log.title}</p>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">{log.subtitle}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[15px] font-black ${log.amount > 0 ? 'text-orange-500' : 'text-slate-900 dark:text-slate-100'}`}>
                      {log.amount > 0 ? '+' : ''}{log.amount}
                    </p>
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wide">B-Units</p>
                  </div>
                </div>
              ))}
            </div>
            {visibleLogs < filteredLedger.length && (
              <button
                onClick={() => setVisibleLogs(prev => prev + 5)}
                className="w-full py-4 text-[12px] font-bold text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
              >
                Load More Records...
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FuelView
