/**
 * Semi-permanent local ledger of Charge rows' `fees.bServiceUnits6` (display units).
 * Chain / indexer facts are immutable; we upsert by `indexerTxId` and persist for Overview rollups across sessions.
 */

/** Must match `BIZ_CACHE_PREFIX` in biz.tsx */
const BIZ_CACHE_PREFIX = 'beamio:biz-example:'

export const CHARGE_BUINT_LEDGER_SCHEMA = 1 as const
/** Cap persisted Charge rows (oldest dropped first). */
export const CHARGE_BUINT_LEDGER_MAX_ENTRIES = 4000

export type ChargeBUnitLedgerEntry = {
  indexerTxId: string
  timestampSec: number
  bUnits: number
  terminal: string
  displayId: string
  hash: string
  beamioTag: string | null
  /** Merged TX_TIP child id (lowercase), for search parity with Transactions table */
  tipIndexerTxIdLower: string
}

/** Mirrors `BizTxTableFilterCtx` in biz.tsx (avoid circular imports). */
export type ChargeLedgerFilterCtx = {
  activeLedger: '全部' | 'AA' | 'EOA'
  txSearchTerm: string
  txFilterType: string
  txFilterTerminal: string
  hasAaAccount: boolean
}

/**
 * Key must NOT match `localStorage` cleanup `startsWith(\`${BIZ_CACHE_PREFIX}eoa:${oldEoa}:\`)` on EOA switch,
 * so per-EOA Charge ledgers survive account changes and can be restored when switching back.
 */
export function chargeBUnitLedgerStorageKey(eoaLower: string): string {
  return `${BIZ_CACHE_PREFIX}charge-buint-ledger:v${CHARGE_BUINT_LEDGER_SCHEMA}:by-address:${eoaLower}`
}

/** Pre-fix key (was removed on EOA change); migrated once on read. */
function chargeBUnitLedgerLegacyStorageKey(eoaLower: string): string {
  return `${BIZ_CACHE_PREFIX}eoa:${eoaLower}:charge-buint-ledger:v${CHARGE_BUINT_LEDGER_SCHEMA}`
}

function indexerTxIdBodyPrefix6(indexerTxId: string | undefined): string {
  if (!indexerTxId || typeof indexerTxId !== 'string') return '------'
  const body = indexerTxId.startsWith('0x') ? indexerTxId.slice(2) : indexerTxId
  const hexOnly = body.replace(/[^0-9a-fA-F]/g, '')
  if (hexOnly.length === 0) return '------'
  return hexOnly.slice(0, 6).toLowerCase()
}

/** Same semantics as `bizTxMatchesTransactionTableFilters` for Charge-only ledger rows (B-Unit ledger rows never ingested). */
export function chargeLedgerEntryMatchesFilters(e: ChargeBUnitLedgerEntry, ctx: ChargeLedgerFilterCtx): boolean {
  if (ctx.activeLedger === 'AA' && !ctx.hasAaAccount) return false
  const isVaultTx = e.terminal.toLowerCase().includes('vault') || e.terminal === 'The Vault'
  const matchLedger =
    ctx.activeLedger === '全部' || (ctx.activeLedger === 'EOA' && isVaultTx) || (ctx.activeLedger === 'AA' && !isVaultTx)
  const q = ctx.txSearchTerm.toLowerCase()
  const topUpShortLabel: string = ''
  const tipRawId = e.tipIndexerTxIdLower
  const matchSearch =
    !ctx.txSearchTerm.trim() ||
    e.displayId.toLowerCase().includes(q) ||
    e.indexerTxId.toLowerCase().includes(q) ||
    indexerTxIdBodyPrefix6(e.indexerTxId).includes(q.replace(/^0x/, '')) ||
    (tipRawId && (tipRawId.includes(q) || indexerTxIdBodyPrefix6(tipRawId).includes(q.replace(/^0x/, '')))) ||
    (topUpShortLabel && topUpShortLabel.includes(q)) ||
    e.hash.toLowerCase().includes(q) ||
    (e.beamioTag && e.beamioTag.toLowerCase().includes(q))
  const matchType = ctx.txFilterType === '全部' || ctx.txFilterType === 'Charge'
  const matchTerminal =
    ctx.txFilterTerminal === '全部' ||
    e.terminal === ctx.txFilterTerminal ||
    (ctx.txFilterTerminal === 'The Vault' && e.terminal.toLowerCase().includes('vault'))
  return Boolean(matchLedger && matchSearch && matchType && matchTerminal)
}

export function sumChargeLedgerBUnitsInWindow(
  map: Map<string, ChargeBUnitLedgerEntry>,
  ctx: ChargeLedgerFilterCtx,
  startSec: number,
  endSec: number
): number {
  let sum = 0
  for (const e of map.values()) {
    if (e.timestampSec < startSec || e.timestampSec > endSec) continue
    if (!chargeLedgerEntryMatchesFilters(e, ctx)) continue
    sum += e.bUnits
  }
  return sum
}

/** `YYYY-MM-DD` in the browser's local timezone (for matching "today" without UTC drift). */
function formatLocalYmdFromUnixSec(unixSec: number): string {
  const d = new Date(unixSec * 1000)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * "Today's Consumption" (B-Units): sum ledger rows whose **local calendar date** equals `localYmd` (client TZ).
 */
export function sumChargeLedgerBUnitsForLocalCalendarDay(
  map: Map<string, ChargeBUnitLedgerEntry>,
  ctx: ChargeLedgerFilterCtx,
  localYmd: string
): number {
  let sum = 0
  for (const e of map.values()) {
    if (formatLocalYmdFromUnixSec(e.timestampSec) !== localYmd) continue
    if (!chargeLedgerEntryMatchesFilters(e, ctx)) continue
    sum += e.bUnits
  }
  return sum
}

type StoredLedgerV1 = { v: 1; items: ChargeBUnitLedgerEntry[] }

function parseStoredLedgerPayload(raw: string, out: Map<string, ChargeBUnitLedgerEntry>): void {
  const parsed = JSON.parse(raw) as StoredLedgerV1
  if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.items)) return
  for (const it of parsed.items) {
    if (!it || typeof it.indexerTxId !== 'string') continue
    const k = it.indexerTxId.toLowerCase()
    out.set(k, { ...it, indexerTxId: k })
  }
}

export function loadChargeBUnitLedgerMap(eoaLower: string): Map<string, ChargeBUnitLedgerEntry> {
  const out = new Map<string, ChargeBUnitLedgerEntry>()
  if (typeof window === 'undefined') return out
  try {
    const key = chargeBUnitLedgerStorageKey(eoaLower)
    let raw = window.localStorage.getItem(key)
    if (!raw) {
      const legacyKey = chargeBUnitLedgerLegacyStorageKey(eoaLower)
      const legacyRaw = window.localStorage.getItem(legacyKey)
      if (legacyRaw) {
        parseStoredLedgerPayload(legacyRaw, out)
        try {
          window.localStorage.removeItem(legacyKey)
          if (out.size > 0) saveChargeBUnitLedgerMapImmediate(eoaLower, out)
        } catch {
          /* ignore */
        }
        return out
      }
      return out
    }
    parseStoredLedgerPayload(raw, out)
  } catch {
    /* ignore */
  }
  return out
}

export function saveChargeBUnitLedgerMapImmediate(eoaLower: string, map: Map<string, ChargeBUnitLedgerEntry>): void {
  if (typeof window === 'undefined') return
  try {
    const payload: StoredLedgerV1 = { v: 1, items: [...map.values()] }
    window.localStorage.setItem(chargeBUnitLedgerStorageKey(eoaLower), JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

const debounceByEoa = new Map<string, ReturnType<typeof setTimeout>>()

export function saveChargeBUnitLedgerMapDebounced(eoaLower: string, map: Map<string, ChargeBUnitLedgerEntry>, ms = 450): void {
  if (typeof window === 'undefined') return
  const prev = debounceByEoa.get(eoaLower)
  if (prev) clearTimeout(prev)
  const t = setTimeout(() => {
    debounceByEoa.delete(eoaLower)
    saveChargeBUnitLedgerMapImmediate(eoaLower, map)
  }, ms)
  debounceByEoa.set(eoaLower, t)
}

/** Returns true if any insert/update. */
export function mergeChargeBUnitLedgerEntries(
  map: Map<string, ChargeBUnitLedgerEntry>,
  incoming: ChargeBUnitLedgerEntry[]
): boolean {
  let changed = false
  for (const row of incoming) {
    const k = row.indexerTxId.toLowerCase()
    const prev = map.get(k)
    if (
      !prev ||
      prev.bUnits !== row.bUnits ||
      prev.timestampSec !== row.timestampSec ||
      prev.terminal !== row.terminal ||
      prev.displayId !== row.displayId ||
      prev.hash !== row.hash ||
      prev.beamioTag !== row.beamioTag ||
      prev.tipIndexerTxIdLower !== row.tipIndexerTxIdLower
    ) {
      map.set(k, { ...row, indexerTxId: k })
      changed = true
    }
  }
  return changed
}

/** Cap storage size: drop oldest by `timestampSec` (then by id). */
export function trimChargeBUnitLedgerMap(
  map: Map<string, ChargeBUnitLedgerEntry>,
  maxEntries: number = CHARGE_BUINT_LEDGER_MAX_ENTRIES
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
