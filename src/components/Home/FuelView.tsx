import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Fuel, Plus, ChevronRight, RefreshCw, Filter, X, Check, ExternalLink, Code, Calculator } from 'lucide-react'
import { getBUnitLedgerFromIndexer, signBUnitRefuel3009, type BUnitLedgerEntry } from '@/services/BeamioCard'
import { purchaseBUnitFromBase, getUsdcBalanceFromApi } from '@/services/beamio'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import VscodeJsonBlock from '@/components/VscodeJsonBlock'
import { tu } from '@/locale/beamioLocale'

const MIN_PURCHASE_USD = 1  // Minimum $1, no purchase below $1

type LogEntry = BUnitLedgerEntry & { type: string }

const isBuintClaim = (log: LogEntry) => log.title === 'BUnit Claim' && log.subtitle === 'Free claim'
const isRefuel = (log: LogEntry) => log.type === 'refuel'
const hasBaseTxHash = (log: LogEntry) => !!(log as BUnitLedgerEntry & { baseTxHash?: string }).baseTxHash
const hasOriginalPaymentHash = (log: LogEntry) => !!(log as BUnitLedgerEntry & { originalPaymentHash?: string }).originalPaymentHash
const displayTitle = (log: LogEntry) => (isBuintClaim(log) ? 'Network Welcome Grant' : log.title)
/** Subtitle hidden for Network Welcome Grant and Fuel Yield (1:100) */
const showSubtitle = (log: LogEntry) => !isBuintClaim(log) && log.title !== tu('fuel_yield_1_100')
const BUNIT_LEDGER_CACHE_KEY_PREFIX = 'beamio:bunit-ledger:v3:'
const BUNIT_LEDGER_RENDER_BATCH = 12
const BUNIT_LEDGER_BATCH_INTERVAL_MS = 120
const BUNIT_LEDGER_CACHE_MAX_ITEMS = 60

const getLedgerCacheKey = (account: string) => `${BUNIT_LEDGER_CACHE_KEY_PREFIX}${account.toLowerCase()}`

const normalizeLedger = (entries: LogEntry[]) => {
  const dedup = new Map<string, LogEntry>()
  for (const entry of entries) {
    if (!entry?.id) continue
    dedup.set(entry.id, entry)
  }
  return Array.from(dedup.values()).sort((a, b) => b.timestamp - a.timestamp)
}

const minimizeRawTxForCache = (rawTx: Record<string, unknown> | undefined): Record<string, unknown> => {
  if (!rawTx || typeof rawTx !== 'object') return {}
  return {
    id: rawTx.id,
    originalPaymentHash: rawTx.originalPaymentHash,
    chainId: rawTx.chainId,
    txCategory: rawTx.txCategory,
    timestamp: rawTx.timestamp,
    payer: rawTx.payer,
    payee: rawTx.payee,
    finalRequestAmountFiat6: rawTx.finalRequestAmountFiat6,
    finalRequestAmountUSDC6: rawTx.finalRequestAmountUSDC6,
    exists: rawTx.exists,
  }
}

const readLedgerCache = (account: string): LogEntry[] => {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const raw = window.localStorage.getItem(getLedgerCacheKey(account))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return normalizeLedger(
      parsed.filter((item): item is LogEntry => !!item && typeof item === 'object' && 'id' in (item as object))
    )
  } catch {
    return []
  }
}

const writeLedgerCache = (account: string, entries: LogEntry[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const compact = normalizeLedger(entries)
      .slice(0, BUNIT_LEDGER_CACHE_MAX_ITEMS)
      .map((entry) => ({
        ...entry,
        rawTx: minimizeRawTxForCache(entry.rawTx as Record<string, unknown> | undefined),
      }))
    window.localStorage.setItem(getLedgerCacheKey(account), JSON.stringify(compact))
  } catch {}
}

const getDataStateBadge = (state: 'cached' | 'synced' | 'stale') => {
  if (state === 'cached') return { text: 'Cached', cls: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300' }
  if (state === 'stale') return { text: 'Refresh failed', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300' }
  return { text: 'Synced', cls: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300' }
}

const formatBUnits = (value: number, withSign = false) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return withSign ? '0.00' : '0.00'
  const abs = Math.abs(n).toFixed(2)
  if (!withSign) return abs
  if (n > 0) return `+${abs}`
  if (n < 0) return `-${abs}`
  return '0.00'
}

interface FuelViewProps {
  onClose: () => void
  bUnitBalance?: { total: number; free: number; paid: number } | null
  onRefresh?: () => void
  account?: string | null
}

const FuelView: React.FC<FuelViewProps> = ({ onClose, bUnitBalance, onRefresh, account }) => {
  const { profiles } = useDaemonContext()
  const bUnits = bUnitBalance?.total ?? 0
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null)
  const [refuelAmount, setRefuelAmount] = useState(5)
  const [refuelAmountStr, setRefuelAmountStr] = useState('5')
  const [isRefueling, setIsRefueling] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [ledgerFilter, setLedgerFilter] = useState('all')
  const [visibleLogs, setVisibleLogs] = useState(5)
  const [bUnitsLedger, setBUnitsLedger] = useState<LogEntry[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(true)
  const [selectedDetail, setSelectedDetail] = useState<LogEntry | null>(null)
  const [showJson, setShowJson] = useState(false)
  const [refuelError, setRefuelError] = useState<string | null>(null)
  const [refuelSuccess, setRefuelSuccess] = useState<string | null>(null)
  const [calcAmount, setCalcAmount] = useState(100)
  const [ledgerDataState, setLedgerDataState] = useState<'cached' | 'synced' | 'stale'>('synced')
  const ledgerFetchSeqRef = useRef(0)

  const fetchLedger = () => {
    if (!account) {
      ledgerFetchSeqRef.current += 1
      setBUnitsLedger([])
      setLedgerLoading(false)
      setLedgerDataState('synced')
      return
    }
    const fetchSeq = ++ledgerFetchSeqRef.current
    const cached = readLedgerCache(account)
    if (cached.length > 0) {
      setBUnitsLedger(cached)
      setLedgerLoading(false)
      setLedgerDataState('cached')
    } else {
      setLedgerLoading(true)
    }

    getBUnitLedgerFromIndexer(account, { throwOnError: true })
      .then((fresh) => {
        if (fetchSeq !== ledgerFetchSeqRef.current) return
        const normalized = normalizeLedger(fresh as LogEntry[])

        // Chain returned successfully: trust source-of-truth, including "no record" case.
        if (normalized.length === 0) {
          setBUnitsLedger([])
          writeLedgerCache(account, [])
          setLedgerLoading(false)
          setLedgerDataState('synced')
          return
        }

        // Prioritize new records first, then batch-apply remaining history.
        const firstBatchSize = Math.min(BUNIT_LEDGER_RENDER_BATCH, normalized.length)
        let rendered = normalized.slice(0, firstBatchSize)
        setBUnitsLedger(rendered)
        writeLedgerCache(account, normalized)
        setLedgerLoading(false)
        setLedgerDataState('synced')

        const applyNextBatch = () => {
          if (fetchSeq !== ledgerFetchSeqRef.current) return
          if (rendered.length >= normalized.length) return
          const nextSize = Math.min(rendered.length + BUNIT_LEDGER_RENDER_BATCH, normalized.length)
          rendered = normalized.slice(0, nextSize)
          setBUnitsLedger(rendered)
          window.setTimeout(applyNextBatch, BUNIT_LEDGER_BATCH_INTERVAL_MS)
        }
        window.setTimeout(applyNextBatch, BUNIT_LEDGER_BATCH_INTERVAL_MS)
      })
      .catch(() => {
        // Chain access failed: keep cached records; do not clear permanent history by network fault.
        if (fetchSeq !== ledgerFetchSeqRef.current) return
        if (cached.length === 0) setBUnitsLedger([])
        setLedgerLoading(false)
        setLedgerDataState('stale')
      })
  }

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      fetchLedger()
    })
    return () => window.cancelAnimationFrame(id)
  }, [account])

  useEffect(() => {
    if (!account) {
      setUsdcBalance(null)
      return
    }
    setUsdcBalance(null)
    getUsdcBalanceFromApi(account)
      .then(s => setUsdcBalance(s != null ? Number(s) : 0))
      .catch(() => setUsdcBalance(null))
  }, [account])

  const amountConfig = useMemo(() => {
    if (usdcBalance == null) return { step: 1, min: MIN_PURCHASE_USD, max: 100, disabled: true }
    if (usdcBalance < MIN_PURCHASE_USD) return { step: 1, min: MIN_PURCHASE_USD, max: 0, disabled: true }
    const max = Math.min(100, usdcBalance)
    return { step: 1, min: MIN_PURCHASE_USD, max, disabled: false }
  }, [usdcBalance])

  useEffect(() => {
    if (amountConfig.disabled && amountConfig.max === 0) {
      setRefuelAmount(MIN_PURCHASE_USD)
      setRefuelAmountStr(String(MIN_PURCHASE_USD))
    } else if (!amountConfig.disabled && refuelAmount > amountConfig.max) {
      const v = amountConfig.max
      setRefuelAmount(v)
      setRefuelAmountStr(v % 1 === 0 ? String(v) : v.toFixed(2))
    } else if (!amountConfig.disabled && refuelAmount < amountConfig.min) {
      const v = amountConfig.min
      setRefuelAmount(v)
      setRefuelAmountStr(String(v))
    }
  }, [amountConfig, refuelAmount])

  const fuelStatus = useMemo(() => {
    if (bUnits > 50) return { label: 'Optimal', bar: 'bg-orange-500', barShadow: 'shadow-[0_0_10px_rgba(249,115,22,0.2)]', badge: 'bg-orange-500 text-white', width: '85%' }
    if (bUnits >= 10) return { label: 'Warning', bar: 'bg-amber-500', barShadow: 'shadow-[0_0_10px_rgba(245,158,11,0.2)]', badge: 'bg-amber-500 text-white', width: '30%' }
    if (bUnits >= 0) return { label: 'Critical', bar: 'bg-red-500', barShadow: 'shadow-[0_0_10px_rgba(239,68,68,0.2)]', badge: 'bg-red-500 text-white', width: '5%' }
    return { label: 'Overdraft', bar: 'bg-purple-600', barShadow: 'shadow-[0_0_10px_rgba(147,51,234,0.2)]', badge: 'bg-purple-600 text-white', width: '0%' }
  }, [bUnits])

  const filteredLedger = useMemo(() => {
    if (ledgerFilter === 'all') return bUnitsLedger
    return bUnitsLedger.filter((log: LogEntry) => log.type === ledgerFilter)
  }, [bUnitsLedger, ledgerFilter])

  const effectiveRefuelAmount = useMemo(() => {
    const v = parseFloat(refuelAmountStr)
    if (!Number.isFinite(v) || v <= 0) return 0
    return Math.min(amountConfig.max, Math.max(amountConfig.min, Math.round(v * 100) / 100))
  }, [refuelAmountStr, amountConfig.min, amountConfig.max])

  /** Fee Estimator: 0.8% of receive amount (USDC), min 2 max 200 B-Units; >=5000 USDC → 500 B-Units */
  const estimatedServiceFee = useMemo(() => {
    const amt = Number(calcAmount)
    if (!Number.isFinite(amt) || amt <= 0) return 2
    if (amt >= 5000) return 500
    const rawFee = Math.ceil(amt * 0.8)
    return Math.min(Math.max(rawFee, 2), 200)
  }, [calcAmount])

  const handleRefuel = async () => {
    const pk = profiles?.[0]?.privateKeyArmor
    if (!pk || !account) {
      setRefuelError('Wallet not ready. Please unlock or sign in.')
      return
    }
    setRefuelError(null)
    setRefuelSuccess(null)
    setIsRefueling(true)
    try {
      const usdcAmount = String(effectiveRefuelAmount)
      const payload = await signBUnitRefuel3009(pk, usdcAmount)
      const result = await purchaseBUnitFromBase(payload)
      if (result.success) {
        setRefuelSuccess(result.txHash ?? '')
        onRefresh?.()
        fetchLedger()
        // Miner vote on CoNET can take 1–3 min. Poll in background for up to 2 min to pick up minted balance.
        const pollMs = 5000
        const pollCount = 24
        const pollBalance = () => {
          for (let i = 0; i < pollCount; i++) {
            setTimeout(() => {
              onRefresh?.()
              fetchLedger()
            }, (i + 1) * pollMs)
          }
        }
        pollBalance()
      } else {
        setRefuelError(result.error ?? 'Refuel failed')
      }
    } catch (e) {
      setRefuelError((e as Error)?.message ?? 'Refuel failed')
    } finally {
      setIsRefueling(false)
    }
  }

  const resetRefuelState = () => {
    setRefuelSuccess(null)
    setRefuelError(null)
  }

  const handleRefresh = () => {
    onRefresh?.()
    fetchLedger()
    if (account) {
      getUsdcBalanceFromApi(account)
        .then(s => setUsdcBalance(s != null ? Number(s) : 0))
        .catch(() => setUsdcBalance(null))
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#fdfdff] dark:bg-slate-900 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pb-[calc(8rem+env(safe-area-inset-bottom))]">
      {/* Use fixed top spacing to keep Browser/PWA aligned */}
      <div className="px-6 flex items-center gap-4 shrink-0 pt-4">
        <button onClick={onClose} className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <ChevronRight size={22} className="rotate-180" />
        </button>
        <h2 className="text-lg font-bold text-black dark:text-slate-100 tracking-tight">Fuel Center</h2>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
        <div className="px-6 pt-6 mt-4 space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none border border-slate-50 dark:border-slate-700">
          <div className="flex justify-between items-center mb-1">
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Network Fuel Balance</p>
            <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase ${fuelStatus.badge}`}>
              {fuelStatus.label}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-[3.375rem] leading-none font-black tracking-tighter ${bUnits < 10 ? 'text-red-500' : 'text-orange-500'}`}>
              {bUnitBalance != null ? formatBUnits(bUnits) : "—"}
            </span>
            <span className="text-orange-500 font-bold text-xl">B-Units</span>
          </div>
          <div className="mt-8 h-2 bg-slate-100 dark:bg-slate-600 rounded-full overflow-hidden">
            <div style={{ width: fuelStatus.width }} className={`${fuelStatus.bar} ${fuelStatus.barShadow} h-full rounded-full transition-all duration-1000`} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none border border-slate-50 dark:border-slate-700 space-y-6">
          {isRefueling ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <RefreshCw size={48} className="animate-spin text-orange-500" />
              <p className="text-[15px] font-semibold text-slate-600 dark:text-slate-300">Processing refuel...</p>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">Please wait</p>
            </div>
          ) : refuelSuccess !== null ? (
            <div className="flex flex-col items-center py-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check size={32} strokeWidth={3} className="text-green-500" />
              </div>
              <p className="text-[18px] font-black text-green-600 dark:text-green-400">Success</p>
              {refuelSuccess.startsWith('0x') && (
                <button
                  type="button"
                  onClick={() => openExternalUrl(`https://basescan.org/tx/${refuelSuccess}`)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[12px] font-mono text-[#1562f0] hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  {refuelSuccess.slice(0, 10)}...{refuelSuccess.slice(-8)}
                  <ExternalLink size={14} strokeWidth={2.5} />
                </button>
              )}
              <button
                onClick={resetRefuelState}
                className="mt-2 text-[13px] font-semibold text-orange-500 hover:text-orange-600"
              >
                Refuel Again
              </button>
            </div>
          ) : (
            <>
              
              <p className="text-[11px] text-slate-500 dark:text-slate-400 -mt-1">Minimum refuel amount: 1 USDC</p>

              {amountConfig.disabled ? (
                <div className="rounded-xl bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 px-4 py-4 text-center text-[13px] font-medium text-slate-500 dark:text-slate-400">
                  {usdcBalance === null ? 'Loading USDC balance...' : usdcBalance < MIN_PURCHASE_USD ? 'Minimum purchase is $1. Add USDC on Base to refuel.' : 'No USDC on Base. Add USDC to refuel.'}
                </div>
              ) : (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-600 focus-within:border-orange-500 transition-colors">
                <span className="text-2xl font-bold text-orange-400">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={refuelAmountStr}
                  onFocus={e => {
                    const input = e.target
                    requestAnimationFrame(() => {
                      const len = input.value.length
                      input.setSelectionRange(len, len)
                    })
                  }}
                  onChange={e => {
                    const raw = e.target.value
                      .replace(/,/g, '.')
                      .replace(/[^0-9.]/g, '')
                      .replace(/(\..*)\./g, '$1')
                    setRefuelAmountStr(raw)
                  }}
                  onBlur={e => {
                    const raw = (e.target as HTMLInputElement).value.replace(/,/g, '.')
                    const v = parseFloat(raw)
                    if (!Number.isFinite(v) || v <= 0) {
                      const clamped = amountConfig.min
                      setRefuelAmount(clamped)
                      setRefuelAmountStr(String(clamped))
                      return
                    }
                    const clamped = Math.min(amountConfig.max, Math.max(amountConfig.min, Math.round(v * 100) / 100))
                    setRefuelAmount(clamped)
                    setRefuelAmountStr(clamped % 1 === 0 ? String(clamped) : clamped.toFixed(2))
                  }}
                  disabled={amountConfig.disabled}
                  className="bg-transparent border-none outline-none text-[28px] font-black w-full text-slate-800 dark:text-slate-100 leading-none"
                />
                <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase">USDC</span>
              </div>
              )}

              {!amountConfig.disabled && (
              <div className="bg-[#f8f9fc] dark:bg-slate-700/30 p-5 rounded-[1.5rem]">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] font-black text-slate-800 dark:text-slate-200">You receive</span>
                  <span className="text-[22px] font-black text-orange-500 leading-none">
                    +{(effectiveRefuelAmount * 100).toFixed(2)} <span className="text-[10px] font-bold opacity-60">B-Units</span>
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">$1 = 100 B-Units (no fee)</p>
              </div>
              )}

              {refuelError && (
                <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-2 text-[13px] font-medium text-red-600 dark:text-red-400">
                  {refuelError}
                </div>
              )}

              <button
                onClick={handleRefuel}
                disabled={amountConfig.disabled || effectiveRefuelAmount <= 0}
                className="w-full bg-orange-500 hover:bg-orange-600 py-4 rounded-[1.2rem] text-white font-black text-[15px] uppercase tracking-wide shadow-[0_8px_20px_rgba(249,115,22,0.3)] active:scale-[0.98] disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                <Fuel size={20} fill="currentColor" strokeWidth={1.5} /> Refuel Now
              </button>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">B-Units Ledger</h3>
              {(() => {
                const badge = getDataStateBadge(ledgerDataState)
                return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}>{badge.text}</span>
              })()}
            </div>
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
                  {f === 'all' ? 'All' : f === 'fee' ? 'Service Fees' : f === 'gas' ? 'Network Gas' : f === 'refuel' ? 'Refuels' : 'Rewards'}
                </button>
              ))}
            </div>
          )}

          <div className="bg-transparent">
            {ledgerLoading ? (
              <div className="p-8 flex items-center justify-center text-slate-400">
                <RefreshCw size={24} className="animate-spin mr-2" />
                <span className="text-sm font-medium">Loading ledger...</span>
              </div>
            ) : filteredLedger.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No B-Unit transactions yet. Claim or refuel to see history.
              </div>
            ) : (
            <div className="space-y-2 pb-3">
              {filteredLedger.slice(0, visibleLogs).map((log: LogEntry) => (
                <div
                  key={log.id}
                  onClick={() => setSelectedDetail(log)}
                  className="relative flex items-center justify-between py-2.5 px-3 bg-white dark:bg-slate-800/80 rounded-[15px] shadow-[0_2px_9px_rgba(0,0,0,0.03)] active:scale-[0.98] transition-all duration-200 cursor-pointer border border-gray-100/50 dark:border-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shadow-sm shrink-0 bg-orange-50 dark:bg-orange-900/20 text-orange-500">
                      {(log.type === 'refuel' || log.type === 'reward') ? <Plus size={16} strokeWidth={2} /> : <Fuel size={16} fill="currentColor" />}
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <h3 className="text-[12px] font-semibold tracking-tight truncate text-black dark:text-white">
                        {displayTitle(log)}
                      </h3>
                      {showSubtitle(log) && log.subtitle && (
                        <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium truncate max-w-[105px]">
                          {log.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end shrink-0">
                    <div className={`text-[12px] font-semibold tracking-tight ${log.amount > 0 ? 'text-[#34C759]' : 'text-black dark:text-white'}`}>
                      {formatBUnits(log.amount, true)}
                    </div>
                    <span className="text-[9px] font-medium text-gray-400 dark:text-slate-500">B-Units</span>
                  </div>
                </div>
              ))}
            </div>
            )}
            {!ledgerLoading && filteredLedger.length > 0 && visibleLogs < filteredLedger.length && (
              <div className="pt-2 pb-1 text-center">
                <button
                  onClick={() => setVisibleLogs(prev => prev + 5)}
                  className="text-[12px] font-medium text-orange-500 hover:text-orange-600 transition-colors"
                >
                  Load More Records...
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none border border-slate-50 dark:border-slate-700 space-y-6">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-orange-400" />
            <h3 className="font-bold text-[15px] text-slate-800 dark:text-slate-100">Fee Estimator</h3>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold ml-1 tracking-widest">Receive Amount (USDC)</label>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 mt-2 border border-slate-100 dark:border-slate-600 focus-within:border-orange-500 transition-colors">
              <span className="text-2xl font-bold text-orange-400">$</span>
              <input
                type="number"
                value={calcAmount}
                onChange={e => setCalcAmount(Number(e.target.value) || 0)}
                min={0}
                step={1}
                className="bg-transparent border-none outline-none text-[28px] font-black w-full text-slate-800 dark:text-slate-100 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
          <div className="space-y-2.5 px-1">
            <div className="flex justify-between text-[13px] text-slate-500 dark:text-slate-400 font-medium items-center">
              <span>Service Fee (0.8%)</span>
              <div className="flex items-center gap-1.5 bg-orange-500/10 px-2 py-0.5 rounded text-orange-500">
                <Fuel size={12} fill="currentColor" />
                <span className="font-bold">{estimatedServiceFee.toFixed(2)} B-Units</span>
              </div>
            </div>
            <div className="flex justify-between text-[13px] text-slate-500 dark:text-slate-400 font-medium">
              <span>Network Gas</span>
              <span className="text-green-500 dark:text-green-400 font-bold">Waived</span>
            </div>
            <div className="pt-4 border-t border-slate-200 dark:border-slate-600 flex justify-between items-end mt-2">
              <span className="text-[14px] font-bold text-slate-800 dark:text-slate-100">Total Fuel Cost</span>
              <span className="text-[24px] font-black text-orange-500 leading-none">{estimatedServiceFee.toFixed(2)} <span className="text-[11px] text-orange-500/70">B-Units</span></span>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Detail 底部滑出面板 */}
      {selectedDetail && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 transition-opacity"
            onClick={() => { setSelectedDetail(null); setShowJson(false) }}
            aria-hidden="true"
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-[2rem] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] overflow-hidden h-[85vh] max-h-[85vh] flex flex-col"
            style={{ animation: 'slideUp 0.3s ease-out forwards' }}
          >
            <style>{`
              @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            `}</style>
            <div className="pt-3 pb-1 flex items-center justify-center relative shrink-0">
              <div className="w-12 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
                <button
                onClick={() => { setSelectedDetail(null); setShowJson(false) }}
                className="absolute right-4 top-3 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="px-6 pb-10 pt-2 overflow-y-auto flex-1">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-500 mb-3 shrink-0 overflow-hidden">
                  {(selectedDetail.type === 'refuel' || selectedDetail.type === 'reward') ? (
                    <Plus size={22} strokeWidth={3} />
                  ) : (
                    <Fuel size={20} fill="currentColor" />
                  )}
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{displayTitle(selectedDetail)}</h3>
                <p className={`text-2xl font-black mt-2 ${selectedDetail.amount > 0 ? 'text-orange-500' : 'text-slate-800 dark:text-slate-100'}`}>
                  {formatBUnits(selectedDetail.amount, true)} <span className="text-base font-medium text-slate-500 dark:text-slate-400">B-Units</span>
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center px-4 py-3 border-b border-dashed border-slate-200 dark:border-slate-600">
                  <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400">Status</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500 text-white text-[11px] font-bold">
                    <Check size={12} strokeWidth={3} /> {selectedDetail.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between items-center px-4 py-3 border-b border-dashed border-slate-200 dark:border-slate-600">
                  <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400">Time</span>
                  <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{selectedDetail.time}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3 border-b border-dashed border-slate-200 dark:border-slate-600">
                  <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400">Linked USDC</span>
                  <span className="text-[13px] font-bold text-blue-500">{selectedDetail.linkedUsdc}</span>
                </div>
                <div className={`flex justify-between items-center px-4 py-3 ${(hasBaseTxHash(selectedDetail) || hasOriginalPaymentHash(selectedDetail)) ? 'border-b border-dashed border-slate-200 dark:border-slate-600' : ''}`}>
                  <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400">{tu('network')}</span>
                  <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
                    {hasBaseTxHash(selectedDetail) ? tu('base_mainnet') : hasOriginalPaymentHash(selectedDetail) ? 'CoNET L1' : selectedDetail.network}
                  </span>
                </div>
                {hasBaseTxHash(selectedDetail) && (
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400">TxHash</span>
                  <button
                    type="button"
                    onClick={() => openExternalUrl(`https://basescan.org/tx/${(selectedDetail as LogEntry & { baseTxHash: string }).baseTxHash}`)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-mono font-semibold text-[#1562f0] hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    {(selectedDetail as LogEntry & { baseTxHash: string }).baseTxHash!.slice(0, 10)}...{(selectedDetail as LogEntry & { baseTxHash: string }).baseTxHash!.slice(-8)}
                    <ExternalLink size={12} strokeWidth={2.5} />
                  </button>
                </div>
                )}
                {hasOriginalPaymentHash(selectedDetail) && !hasBaseTxHash(selectedDetail) && (
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400">TxHash</span>
                  <button
                    type="button"
                    onClick={() =>
                      openExternalUrl(
                        `https://mainnet.conet.network/tx/${(selectedDetail as LogEntry & { originalPaymentHash: string }).originalPaymentHash}`,
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-[11px] font-mono font-semibold text-[#1562f0] hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    {(selectedDetail as LogEntry & { originalPaymentHash: string }).originalPaymentHash!.slice(0, 10)}...{(selectedDetail as LogEntry & { originalPaymentHash: string }).originalPaymentHash!.slice(-8)}
                    <ExternalLink size={12} strokeWidth={2.5} />
                  </button>
                </div>
                )}
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowJson(!showJson)}
                  className="w-full py-3 border border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 rounded-[16px] text-[13px] font-semibold flex items-center justify-center gap-2 active:bg-gray-50 dark:active:bg-slate-700 transition-colors"
                >
                  <Code size={16} /> {showJson ? tu('hide_raw_data') : tu('view_smart_receipt')}
                </button>
                {showJson && (
                  <VscodeJsonBlock
                    className="mt-4"
                    data={(selectedDetail as LogEntry & { rawTx?: Record<string, unknown> }).rawTx ?? selectedDetail}
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default FuelView
