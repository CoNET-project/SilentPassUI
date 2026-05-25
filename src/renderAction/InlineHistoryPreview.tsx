/**
 * Inline history preview: fetches from BeamioIndexerDiamond and displays first N transactions.
 * Used when AI returns history with params.limit (e.g. "顯示前5條 歷史記錄").
 */

import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ethers } from "ethers"
import { ArrowUpRight, ArrowDownLeft, Loader2, History } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { conetDepinProvider } from "@/utils/constants"
import contracts from "@/utils/contracts"

const BEAMIO_INDEXER = contracts.BeamioDiamond?.address ?? "0x0DBDF27E71f9c89353bC5e4dC27c9C5dAe0cc612"
const INDEXER_ABI = [
  "function getAccountTransactionsByMonthOffsetPaged(address account, uint256 periodOffset, uint256 pageOffset, uint256 pageLimit, bytes32 txCategoryFilter) view returns (uint256 total, uint256 periodStart, uint256 periodEnd, (bytes32 id, bytes32 originalPaymentHash, uint256 chainId, bytes32 txCategory, string displayJson, uint64 timestamp, address payer, address payee, uint256 finalRequestAmountFiat6, uint256 finalRequestAmountUSDC6, bool isAAAccount, (uint16 gasChainType, uint256 gasWei, uint256 gasUSDC6, uint256 serviceUSDC6, uint256 bServiceUSDC6, uint256 bServiceUnits6, address feePayer) fees, (uint256 requestAmountFiat6, uint256 requestAmountUSDC6, uint8 currencyFiat, uint256 discountAmountFiat6, uint16 discountRateBps, uint256 taxAmountFiat6, uint16 taxRateBps, string afterNotePayer, string afterNotePayee) meta, bool exists, address topAdmin, address subordinate)[] page)",
] as const

type TxItem = {
  id: string
  title: string
  amountUSDC: number
  timestamp: string
  timestampMs: number
  isInbound: boolean
}

function parseDisplayJson(displayJson: string): { title: string } {
  try {
    const j = JSON.parse(displayJson || "{}")
    return { title: j.title ?? "Transaction" }
  } catch {
    return { title: "Transaction" }
  }
}

function formatTime(ts: bigint): string {
  const ms = Number(ts) < 10_000_000_000 ? Number(ts) * 1000 : Number(ts)
  const d = new Date(ms)
  if (!isFinite(d.getTime())) return ""
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function InlineHistoryPreview({
  limit = 5,
  onOpenFull,
}: {
  limit?: number
  onOpenFull?: () => void
}) {
  const navigate = useNavigate()
  const { profiles, myAddress } = useDaemonContext()
  const [items, setItems] = useState<TxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const eoa = profiles?.[0]?.keyID?.trim()
    const aa = profiles?.[0]?.aaAccount?.trim()
    const accounts: string[] = []
    if (eoa && ethers.isAddress(eoa)) accounts.push(ethers.getAddress(eoa))
    if (aa && ethers.isAddress(aa) && aa.toLowerCase() !== eoa?.toLowerCase())
      accounts.push(ethers.getAddress(aa))
    if (accounts.length === 0 && myAddress && ethers.isAddress(myAddress))
      accounts.push(ethers.getAddress(myAddress))

    if (accounts.length === 0) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const indexer = new ethers.Contract(BEAMIO_INDEXER, INDEXER_ABI, conetDepinProvider)
      const TX_FILTER = ethers.ZeroHash
      const results = await Promise.all(
        accounts.map((account) =>
          indexer.getAccountTransactionsByMonthOffsetPaged(account, 0, 0, limit, TX_FILTER)
        )
      )

      const seen = new Set<string>()
      const merged: TxItem[] = []

      for (const res of results) {
        const page = (res as [bigint, bigint, bigint, unknown[]])[3] ?? []
        for (const tx of page) {
          const t = tx as { id?: unknown; exists?: boolean; displayJson?: string; timestamp?: bigint; payer?: string; payee?: string; finalRequestAmountUSDC6?: bigint }
          if (!t?.exists) continue
          const id = typeof t.id === "string" ? t.id : t.id != null ? ethers.hexlify(t.id as ethers.BytesLike) : ethers.ZeroHash
          if (seen.has(id)) continue
          seen.add(id)

          const { title } = parseDisplayJson(t.displayJson ?? "")
          const amountUSDC = Number(ethers.formatUnits(t.finalRequestAmountUSDC6 ?? 0n, 6))
          const amPayee = accounts.some((a) => a.toLowerCase() === (t.payee ?? "").toLowerCase())
          const isInbound = amPayee
          const tsRaw = t.timestamp ?? 0n
          const tsMs = Number(tsRaw) < 10_000_000_000 ? Number(tsRaw) * 1000 : Number(tsRaw)
          merged.push({
            id,
            title,
            amountUSDC,
            timestamp: formatTime(tsRaw),
            timestampMs: tsMs,
            isInbound,
          })
        }
      }

      merged.sort((a, b) => b.timestampMs - a.timestampMs)
      setItems(merged.slice(0, limit))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [profiles, myAddress, limit])

  useEffect(() => {
    load()
  }, [load])

  const handleOpenHistory = () => {
    onOpenFull?.()
    navigate("/History")
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3 border border-slate-100 dark:border-slate-600 flex items-center justify-center gap-2">
        <Loader2 size={18} className="animate-spin text-slate-500" />
        <span className="text-sm text-slate-600 dark:text-slate-300">Loading history…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 border border-amber-200 dark:border-amber-800">
        <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
        <button
          onClick={handleOpenHistory}
          className="mt-2 text-sm font-bold text-amber-600 dark:text-amber-400"
        >
          Open History
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3 border border-slate-100 dark:border-slate-600">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
          <History size={16} />
          Last {limit} transactions
        </span>
        <button
          onClick={handleOpenHistory}
          className="text-xs font-bold text-[#1562f0] hover:underline"
        >
          View all
        </button>
      </div>
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No transactions yet</p>
        ) : (
          items.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-1.5 rounded-lg px-2 bg-white/50 dark:bg-slate-700/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                {tx.isInbound ? (
                  <ArrowDownLeft size={14} className="text-emerald-600 shrink-0" />
                ) : (
                  <ArrowUpRight size={14} className="text-orange-500 shrink-0" />
                )}
                <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
                  {tx.title || "Transaction"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-sm font-bold ${tx.isInbound ? "text-emerald-600" : "text-slate-700 dark:text-slate-200"}`}
                >
                  {tx.isInbound ? "+" : "-"}${tx.amountUSDC.toFixed(2)}
                </span>
                <span className="text-xs text-slate-500">{tx.timestamp}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
