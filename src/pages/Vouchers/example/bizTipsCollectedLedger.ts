/**
 * Semi-permanent local ledger of TX_TIP / legacy tip rows for Overview "Tips Collected".
 * Amounts follow indexer `交易`: `finalRequestAmountFiat6` / `finalRequestAmountUSDC6` + `TransactionMeta.currencyFiat`.
 * Storage key avoids `eoa:${addr}:` so EOA switch cleanup does not wipe ledgers.
 */

/** Must match `BIZ_CACHE_PREFIX` in biz.tsx */
const BIZ_CACHE_PREFIX = 'beamio:biz-example:'

export const TIPS_COLLECTED_LEDGER_SCHEMA = 2 as const
export const TIPS_COLLECTED_LEDGER_MAX_ENTRIES = 4000

export type TipsCollectedLedgerEntry = {
  indexerTxId: string
  timestampSec: number
  /** Human: `Transaction.finalRequestAmountFiat6` / 1e6 (readme TX_TIP root). */
  finalRequestFiat6Human: number
  /** Human: `Transaction.finalRequestAmountUSDC6` / 1e6 */
  finalRequestUsdc6Human: number
  /** `TransactionMeta.currencyFiat` (BeamioCurrency.CurrencyType). `-1` = unknown (legacy v1). */
  currencyFiat: number
  /**
   * Single-number display for Transactions filter parity (`usdcAmount` / `total` style).
   * Prefer USDC6 when &gt; 0 else fiat6 else legacy.
   */
  usdcAmount: number
  terminal: string
  displayId: string
  hash: string
  beamioTag: string | null
  /** Lowercase hex; empty if orphan tip (no parent Charge) */
  parentChargeIndexerTxLower: string
}

export function tipsCollectedLedgerStorageKey(eoaLower: string): string {
  return `${BIZ_CACHE_PREFIX}tips-collected-ledger:v${TIPS_COLLECTED_LEDGER_SCHEMA}:by-address:${eoaLower}`
}

function tipsCollectedLedgerStorageKeyV1ByAddress(eoaLower: string): string {
  return `${BIZ_CACHE_PREFIX}tips-collected-ledger:v1:by-address:${eoaLower}`
}

function tipsCollectedLedgerLegacyStorageKey(eoaLower: string): string {
  return `${BIZ_CACHE_PREFIX}eoa:${eoaLower}:tips-collected-ledger:v${TIPS_COLLECTED_LEDGER_SCHEMA}`
}

/** v1 file used schema 1 key segment; still migrate payload shape if found under v2 path. */
const TIPS_LEDGER_V1_SCHEMA = 1

function formatLocalYmdFromUnixSec(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function sumTipsCollectedLedgerValuesInWindow(
  map: Map<string, TipsCollectedLedgerEntry>,
  startSec: number,
  endSec: number,
  includeEntry: (e: TipsCollectedLedgerEntry) => boolean,
  amountFor: (e: TipsCollectedLedgerEntry) => number
): number {
  let sum = 0
  for (const e of map.values()) {
    if (e.timestampSec < startSec || e.timestampSec > endSec) continue
    if (!includeEntry(e)) continue
    const v = amountFor(e)
    if (Number.isFinite(v)) sum += v
  }
  return sum
}

export function sumTipsCollectedLedgerValuesForLocalCalendarDay(
  map: Map<string, TipsCollectedLedgerEntry>,
  localYmd: string,
  includeEntry: (e: TipsCollectedLedgerEntry) => boolean,
  amountFor: (e: TipsCollectedLedgerEntry) => number
): number {
  let sum = 0
  for (const e of map.values()) {
    if (formatLocalYmdFromUnixSec(e.timestampSec) !== localYmd) continue
    if (!includeEntry(e)) continue
    const v = amountFor(e)
    if (Number.isFinite(v)) sum += v
  }
  return sum
}

type StoredTipsLedgerV2 = { v: 2; items: TipsCollectedLedgerEntry[] }
type StoredTipsLedgerV1 = { v: 1; items: Array<TipsCollectedLedgerEntry & { usdcAmount?: number }> }

function migrateV1Item(it: StoredTipsLedgerV1['items'][0]): TipsCollectedLedgerEntry | null {
  if (!it || typeof it.indexerTxId !== 'string') return null
  const k = it.indexerTxId.toLowerCase()
  const legacyUsdc = Number.isFinite(it.usdcAmount) ? (it.usdcAmount as number) : 0
  return {
    indexerTxId: k,
    timestampSec: it.timestampSec,
    finalRequestFiat6Human: typeof it.finalRequestFiat6Human === 'number' ? it.finalRequestFiat6Human : 0,
    finalRequestUsdc6Human: typeof it.finalRequestUsdc6Human === 'number' ? it.finalRequestUsdc6Human : legacyUsdc,
    currencyFiat: typeof it.currencyFiat === 'number' ? it.currencyFiat : -1,
    usdcAmount: typeof it.usdcAmount === 'number' ? it.usdcAmount : legacyUsdc,
    terminal: it.terminal,
    displayId: it.displayId,
    hash: it.hash,
    beamioTag: it.beamioTag,
    parentChargeIndexerTxLower: it.parentChargeIndexerTxLower,
  }
}

function parseStoredTipsPayload(raw: string, out: Map<string, TipsCollectedLedgerEntry>): void {
  const parsed = JSON.parse(raw) as StoredTipsLedgerV2 | StoredTipsLedgerV1
  if (!parsed || !Array.isArray(parsed.items)) return
  if (parsed.v === TIPS_LEDGER_V1_SCHEMA) {
    for (const it of parsed.items) {
      const m = migrateV1Item(it)
      if (m) out.set(m.indexerTxId, m)
    }
    return
  }
  if (parsed.v !== 2) return
  for (const it of parsed.items) {
    if (!it || typeof it.indexerTxId !== 'string') continue
    const k = it.indexerTxId.toLowerCase()
    const legacyUsdc = typeof (it as { usdcAmount?: number }).usdcAmount === 'number' ? (it as { usdcAmount: number }).usdcAmount : 0
    out.set(k, {
      ...it,
      indexerTxId: k,
      finalRequestFiat6Human: typeof it.finalRequestFiat6Human === 'number' ? it.finalRequestFiat6Human : 0,
      finalRequestUsdc6Human:
        typeof it.finalRequestUsdc6Human === 'number' ? it.finalRequestUsdc6Human : legacyUsdc,
      currencyFiat: typeof it.currencyFiat === 'number' ? it.currencyFiat : -1,
      usdcAmount: typeof it.usdcAmount === 'number' ? it.usdcAmount : legacyUsdc,
    })
  }
}

export function loadTipsCollectedLedgerMap(eoaLower: string): Map<string, TipsCollectedLedgerEntry> {
  const out = new Map<string, TipsCollectedLedgerEntry>()
  if (typeof window === 'undefined') return out
  try {
    const keyV2 = tipsCollectedLedgerStorageKey(eoaLower)
    let raw = window.localStorage.getItem(keyV2)
    if (!raw) {
      const keyV1 = tipsCollectedLedgerStorageKeyV1ByAddress(eoaLower)
      const rawV1 = window.localStorage.getItem(keyV1)
      if (rawV1) {
        parseStoredTipsPayload(rawV1, out)
        try {
          window.localStorage.removeItem(keyV1)
          if (out.size > 0) saveTipsCollectedLedgerMapImmediate(eoaLower, out)
        } catch {
          /* ignore */
        }
        return out
      }
    }
    if (!raw) {
      const legacyKey = tipsCollectedLedgerLegacyStorageKey(eoaLower)
      const legacyRaw = window.localStorage.getItem(legacyKey)
      if (legacyRaw) {
        parseStoredTipsPayload(legacyRaw, out)
        try {
          window.localStorage.removeItem(legacyKey)
          if (out.size > 0) saveTipsCollectedLedgerMapImmediate(eoaLower, out)
        } catch {
          /* ignore */
        }
        return out
      }
      return out
    }
    parseStoredTipsPayload(raw, out)
  } catch {
    /* ignore */
  }
  return out
}

export function saveTipsCollectedLedgerMapImmediate(eoaLower: string, map: Map<string, TipsCollectedLedgerEntry>): void {
  if (typeof window === 'undefined') return
  try {
    const payload: StoredTipsLedgerV2 = { v: 2, items: [...map.values()] }
    window.localStorage.setItem(tipsCollectedLedgerStorageKey(eoaLower), JSON.stringify(payload))
  } catch {
    /* quota */
  }
}

const debounceTipsByEoa = new Map<string, ReturnType<typeof setTimeout>>()

export function saveTipsCollectedLedgerMapDebounced(
  eoaLower: string,
  map: Map<string, TipsCollectedLedgerEntry>,
  ms = 450
): void {
  if (typeof window === 'undefined') return
  const prev = debounceTipsByEoa.get(eoaLower)
  if (prev) clearTimeout(prev)
  const t = setTimeout(() => {
    debounceTipsByEoa.delete(eoaLower)
    saveTipsCollectedLedgerMapImmediate(eoaLower, map)
  }, ms)
  debounceTipsByEoa.set(eoaLower, t)
}

export function mergeTipsCollectedLedgerEntries(
  map: Map<string, TipsCollectedLedgerEntry>,
  incoming: TipsCollectedLedgerEntry[]
): boolean {
  let changed = false
  for (const row of incoming) {
    const k = row.indexerTxId.toLowerCase()
    const prev = map.get(k)
    if (
      !prev ||
      prev.usdcAmount !== row.usdcAmount ||
      prev.finalRequestFiat6Human !== row.finalRequestFiat6Human ||
      prev.finalRequestUsdc6Human !== row.finalRequestUsdc6Human ||
      prev.currencyFiat !== row.currencyFiat ||
      prev.timestampSec !== row.timestampSec ||
      prev.terminal !== row.terminal ||
      prev.displayId !== row.displayId ||
      prev.hash !== row.hash ||
      prev.beamioTag !== row.beamioTag ||
      prev.parentChargeIndexerTxLower !== row.parentChargeIndexerTxLower
    ) {
      map.set(k, { ...row, indexerTxId: k })
      changed = true
    }
  }
  return changed
}

export function trimTipsCollectedLedgerMap(
  map: Map<string, TipsCollectedLedgerEntry>,
  maxEntries: number = TIPS_COLLECTED_LEDGER_MAX_ENTRIES
): void {
  if (map.size <= maxEntries) return
  const ranked = [...map.entries()].sort((a, b) => {
    const ta = a[1].timestampSec
    const tb = b[1].timestampSec
    if (ta !== tb) return ta - tb
    return a[0].localeCompare(b[0])
  })
  const drop = ranked.length - maxEntries
  for (let i = 0; i < drop; i++) {
    map.delete(ranked[i][0])
  }
}
