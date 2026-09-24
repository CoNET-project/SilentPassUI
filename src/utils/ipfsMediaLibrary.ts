import {
  IPFS_GET_FRAGMENT_BASE,
  normalizeFragmentHash,
  parseFragmentHashFromUrl,
} from '@/utils/ipfsImageLibrary'

const DB_NAME = 'beamio_ipfs_media_library_v1'
const DB_VERSION = 1
const STORE = 'fragments'
const BEAMIO_FRAGMENT_PROXY_BASE = 'https://beamio.app/api/fragment?hash='

export type IpfsMediaLibraryRecord = {
  hash: string
  blob: Blob
  mime: string
  savedAt: number
  byteLength: number
}

const inflightByHash = new Map<string, Promise<IpfsMediaLibraryRecord | null>>()

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'hash' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getLocalIpfsMediaRecord(
  hash: string,
): Promise<IpfsMediaLibraryRecord | null> {
  const normalized = normalizeFragmentHash(hash)
  if (!normalized) return null
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readonly')
    const request = transaction.objectStore(STORE).get(normalized)
    request.onsuccess = () => {
      db.close()
      const record = request.result as IpfsMediaLibraryRecord | undefined
      resolve(record?.blob && record.blob.size > 0 ? record : null)
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

export async function putLocalIpfsMedia(
  hash: string,
  blob: Blob,
  mime?: string,
): Promise<void> {
  const normalized = normalizeFragmentHash(hash)
  if (!normalized || !blob || blob.size <= 0) return
  const resolvedMime = (mime || blob.type || 'application/octet-stream').trim()
  const record: IpfsMediaLibraryRecord = {
    hash: normalized,
    blob,
    mime: resolvedMime || 'application/octet-stream',
    savedAt: Date.now(),
    byteLength: blob.size,
  }
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    const request = transaction.objectStore(STORE).put(record)
    request.onsuccess = () => {
      db.close()
      resolve()
    }
    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

async function sniffMediaMime(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
  if (
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) return 'video/mp4'
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) return 'video/webm'
  if (
    bytes[0] === 0x4f &&
    bytes[1] === 0x67 &&
    bytes[2] === 0x67 &&
    bytes[3] === 0x53
  ) return 'video/ogg'
  return ''
}

async function parseMediaResponse(
  response: Response,
): Promise<{ blob: Blob; mime: string } | null> {
  if (!response.ok) return null
  const contentType = (response.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase()

  if (
    contentType.startsWith('video/') ||
    contentType.startsWith('audio/') ||
    contentType === 'application/octet-stream'
  ) {
    const blob = await response.blob()
    if (blob.size <= 0) return null
    const mime =
      (contentType !== 'application/octet-stream' ? contentType : '') ||
      (await sniffMediaMime(blob))
    if (!mime.startsWith('video/') && !mime.startsWith('audio/')) return null
    return {
      blob: blob.type === mime ? blob : new Blob([blob], { type: mime }),
      mime,
    }
  }

  const text = (await response.text()).trim()
  const dataUrl = /^data:((?:video|audio)\/[^;]+);base64,(.+)$/i.exec(text)
  if (dataUrl) {
    const blob = base64ToBlob(dataUrl[2], dataUrl[1])
    return { blob, mime: dataUrl[1] }
  }
  if (/^[A-Za-z0-9+/]+=*$/.test(text) && text.length > 128) {
    const untyped = base64ToBlob(text, 'application/octet-stream')
    const mime = await sniffMediaMime(untyped)
    if (!mime) return null
    return { blob: new Blob([untyped], { type: mime }), mime }
  }
  return null
}

async function fetchIpfsMediaFromNetwork(
  hash: string,
): Promise<IpfsMediaLibraryRecord | null> {
  const normalized = normalizeFragmentHash(hash)
  if (!normalized) return null
  const urls = [
    `${IPFS_GET_FRAGMENT_BASE}${normalized}`,
    `${BEAMIO_FRAGMENT_PROXY_BASE}${encodeURIComponent(normalized)}`,
  ]
  for (const url of urls) {
    const response = await fetch(url, { cache: 'force-cache' }).catch(() => null)
    if (!response?.ok) continue
    const parsed = await parseMediaResponse(response).catch(() => null)
    if (!parsed) continue
    return {
      hash: normalized,
      blob: parsed.blob,
      mime: parsed.mime,
      savedAt: Date.now(),
      byteLength: parsed.blob.size,
    }
  }
  return null
}

export async function resolveIpfsMediaRecord(
  hash: string,
): Promise<IpfsMediaLibraryRecord | null> {
  const normalized = normalizeFragmentHash(hash)
  if (!normalized) return null
  const local = await getLocalIpfsMediaRecord(normalized).catch(() => null)
  if (local) return local
  const inflight = inflightByHash.get(normalized)
  if (inflight) return inflight

  const task = (async () => {
    try {
      const remote = await fetchIpfsMediaFromNetwork(normalized)
      if (!remote) return null
      await putLocalIpfsMedia(normalized, remote.blob, remote.mime).catch(() => {})
      return remote
    } finally {
      inflightByHash.delete(normalized)
    }
  })()
  inflightByHash.set(normalized, task)
  return task
}

export async function resolveIpfsMediaUrlToObjectUrl(url: string): Promise<string> {
  const trimmed = String(url || '').trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return trimmed
  const hash = parseFragmentHashFromUrl(trimmed)
  if (!hash) return trimmed
  const record = await resolveIpfsMediaRecord(hash)
  if (!record) return trimmed
  const blob =
    record.blob.type === record.mime
      ? record.blob
      : new Blob([record.blob], { type: record.mime })
  return URL.createObjectURL(blob)
}

export function warmIpfsMediaUrls(urls: Array<string | undefined | null>): void {
  const seen = new Set<string>()
  for (const raw of urls) {
    const hash = raw ? parseFragmentHashFromUrl(raw) : null
    if (!hash || seen.has(hash)) continue
    seen.add(hash)
    void resolveIpfsMediaRecord(hash)
  }
}
