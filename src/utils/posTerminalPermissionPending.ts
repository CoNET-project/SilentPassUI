/**
 * POS terminal workspace permission requests (`beamio_pos_terminal_permission_v1`) — local queue for MerchantOS Staff.
 * Inbound chat messages are recorded in App.tsx `addNewMessage`; MerchantOS reads/writes the same localStorage key.
 */

export type PosTerminalPermissionPendingV1 = {
  sendId: string
  createdAt: number
  childEoa: string
  childBeamioTag: string
  parentBeamioTag: string
  receivedAt: number
}

const STORAGE_PREFIX = 'beamio_pos_terminal_permission_pending_v1:'
export const POS_TERMINAL_PERMISSION_PENDING_EVENT = 'beamio-pos-terminal-permission-pending'

function normEoa(a: string | undefined | null): string {
  const t = (a ?? '').trim().toLowerCase()
  return t.startsWith('0x') && t.length === 42 ? t : ''
}

export function posTerminalPermissionStorageKey(merchantEoa: string): string | null {
  const e = normEoa(merchantEoa)
  return e ? `${STORAGE_PREFIX}${e}` : null
}

/** Same identity may appear as EOA (`keyID`) and AA (`aaAccount`) — mirror pending queue to every partition. */
export function merchantPosPermissionPartitionAddresses(
  p: { keyID?: string; aaAccount?: string } | null | undefined,
  myAddr?: string | null,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of [p?.keyID, p?.aaAccount, myAddr]) {
    const e = normEoa(s ?? '')
    if (e && !seen.has(e)) {
      seen.add(e)
      out.push(e)
    }
  }
  return out
}

export function loadMergedPosTerminalPermissionPendingList(addresses: string[]): PosTerminalPermissionPendingV1[] {
  const bySend = new Map<string, PosTerminalPermissionPendingV1>()
  for (const raw of addresses) {
    const e = normEoa(raw)
    if (!e) continue
    for (const row of loadPosTerminalPermissionPendingList(e)) {
      const prev = bySend.get(row.sendId)
      if (!prev || (row.receivedAt ?? 0) > (prev.receivedAt ?? 0)) bySend.set(row.sendId, row)
    }
  }
  return [...bySend.values()].sort((a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0))
}

/** Append to each partition so Staff can load merged EOA+AA keys. @returns true if any partition gained a new row */
export function appendPosTerminalPermissionPendingForMerchantPartitions(
  addresses: string[],
  payload: Omit<PosTerminalPermissionPendingV1, 'receivedAt'>,
): boolean {
  let anyAdded = false
  for (const raw of addresses) {
    const e = normEoa(raw)
    if (!e) continue
    if (appendPosTerminalPermissionPending(e, payload)) anyAdded = true
  }
  return anyAdded
}

/**
 * Parse iOS / SilentPassUI-style POS permission from chat `displayText`.
 *
 * May be wrapped in several JSON layers:
 * 1. `{ timestamp, text, from, signMessage }` — gossip envelope; `text` = pending-line JSON
 * 2. `{ from, sendId, text, createdAt }` — chat pending line; `text` = permission JSON string
 * 3. `{ type: beamio_pos_terminal_permission_v1, ... }` — payload
 *
 * `App.tsx` may set `displayText` to (2) or (3) depending on which segment passed `checkSign`.
 */
export function parsePosTerminalPermissionV1FromChatDisplayText(
  displayText: string,
): Omit<PosTerminalPermissionPendingV1, 'receivedAt'> | null {
  try {
    let trimmed = (displayText ?? '').trim()
    if (!trimmed.startsWith('{')) return null
    let obj: Record<string, unknown> = JSON.parse(trimmed) as Record<string, unknown>
    const maxUnwrap = 8
    for (let hop = 0; hop < maxUnwrap; hop++) {
      if (obj?.type === 'beamio_pos_terminal_permission_v1') {
        const inner = obj as {
          type?: string
          sendId?: unknown
          createdAt?: unknown
          childEoa?: unknown
          childBeamioTag?: unknown
          parentBeamioTag?: unknown
        }
        const childEoa = String(inner.childEoa ?? '')
          .trim()
          .toLowerCase()
        if (!childEoa.startsWith('0x') || childEoa.length !== 42) return null
        const tag = String(inner.childBeamioTag ?? '').trim()
        if (!tag) return null
        const sendId =
          String(inner.sendId ?? '').trim() || `${childEoa}:${inner.createdAt ?? 0}`
        return {
          sendId,
          createdAt: Number.isFinite(Number(inner.createdAt)) ? Number(inner.createdAt) : 0,
          childEoa,
          childBeamioTag: tag,
          parentBeamioTag: String(inner.parentBeamioTag ?? '').trim(),
        }
      }
      const nested = obj?.text
      if (typeof nested !== 'string') return null
      const next = nested.trim()
      if (!next.startsWith('{')) return null
      obj = JSON.parse(next) as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

export function loadPosTerminalPermissionPendingList(merchantEoa: string): PosTerminalPermissionPendingV1[] {
  if (typeof window === 'undefined') return []
  const key = posTerminalPermissionStorageKey(merchantEoa)
  if (!key) return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: PosTerminalPermissionPendingV1[] = []
    for (const x of parsed) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const childEoa = normEoa(String(o.childEoa ?? ''))
      if (!childEoa) continue
      out.push({
        sendId: String(o.sendId ?? ''),
        createdAt: Number(o.createdAt) || 0,
        childEoa,
        childBeamioTag: String(o.childBeamioTag ?? ''),
        parentBeamioTag: String(o.parentBeamioTag ?? ''),
        receivedAt: Number(o.receivedAt) || 0,
      })
    }
    return out
  } catch {
    return []
  }
}

function saveList(merchantEoa: string, list: PosTerminalPermissionPendingV1[]): void {
  const key = posTerminalPermissionStorageKey(merchantEoa)
  if (!key || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(list))
  } catch {
    /* ignore quota */
  }
}

export function notifyPosTerminalPermissionPendingUpdate(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(POS_TERMINAL_PERMISSION_PENDING_EVENT))
}

/** @returns true if a new row was added */
export function appendPosTerminalPermissionPending(
  merchantEoa: string,
  payload: Omit<PosTerminalPermissionPendingV1, 'receivedAt'>,
): boolean {
  const e = normEoa(merchantEoa)
  if (!e) return false
  const sendId = (payload.sendId || '').trim() || `${payload.childEoa}:${payload.createdAt}`
  const list = loadPosTerminalPermissionPendingList(e)
  if (list.some((x) => x.sendId === sendId)) return false
  const next: PosTerminalPermissionPendingV1[] = [
    ...list,
    { ...payload, childEoa: normEoa(payload.childEoa) || payload.childEoa, sendId, receivedAt: Date.now() },
  ]
  saveList(e, next)
  return true
}

export function removePosTerminalPermissionPending(merchantEoa: string, sendId: string): void {
  const e = normEoa(merchantEoa)
  if (!e) return
  const id = (sendId || '').trim()
  const list = loadPosTerminalPermissionPendingList(e).filter((x) => x.sendId !== id)
  saveList(e, list)
  notifyPosTerminalPermissionPendingUpdate()
}

export function removePosTerminalPermissionPendingByChildEoa(merchantEoa: string, childEoa: string): void {
  const e = normEoa(merchantEoa)
  const c = normEoa(childEoa)
  if (!e || !c) return
  const list = loadPosTerminalPermissionPendingList(e).filter((x) => x.childEoa.toLowerCase() !== c)
  saveList(e, list)
  notifyPosTerminalPermissionPendingUpdate()
}

export function removePosTerminalPermissionPendingFromPartitions(addresses: string[], sendId: string): void {
  const id = (sendId || '').trim()
  for (const raw of addresses) {
    const e = normEoa(raw)
    if (!e) continue
    const list = loadPosTerminalPermissionPendingList(e).filter((x) => x.sendId !== id)
    saveList(e, list)
  }
  notifyPosTerminalPermissionPendingUpdate()
}

export function removePosTerminalPermissionPendingByChildEoaFromPartitions(addresses: string[], childEoa: string): void {
  const c = normEoa(childEoa)
  if (!c) return
  for (const raw of addresses) {
    const e = normEoa(raw)
    if (!e) continue
    const list = loadPosTerminalPermissionPendingList(e).filter((x) => x.childEoa.toLowerCase() !== c)
    saveList(e, list)
  }
  notifyPosTerminalPermissionPendingUpdate()
}
