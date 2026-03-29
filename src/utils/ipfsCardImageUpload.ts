/**
 * IPFS image helpers for card / avatar uploads (same behavior as `pages/cardManager/index.tsx`).
 * Base64 payload stays under gateway limits via resize / JPEG fallback.
 */

/** Target file size 37MB so base64 (~49MB) stays under server 50MB limit */
export const IPFS_UPLOAD_TARGET_MAX_BYTES = 37 * 1024 * 1024
/** When 413, retry with JPEG under this size */
export const IPFS_UPLOAD_JPEG_RETRY_MAX_BYTES = 700 * 1024

export const IPFS_GET_FRAGMENT = 'https://ipfs.conet.network/api/getFragment?hash='

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

function toBlobFormat(mime: string): 'image/png' | 'image/jpeg' | 'image/webp' {
  if (mime === 'image/png') return 'image/png'
  if (mime === 'image/webp') return 'image/webp'
  return 'image/jpeg'
}

export async function compressToJpeg(blob: Blob, maxRawBytes: number): Promise<Blob> {
  const img = await loadImageFromBlob(blob)
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return blob
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  for (const q of [0.85, 0.75, 0.65, 0.5, 0.35]) {
    const out = await new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b), 'image/jpeg', q))
    if (out && out.size <= maxRawBytes) return out
  }
  const scale = Math.sqrt((maxRawBytes * 0.9) / (blob.size || 1))
  const tw = Math.max(1, Math.round(w * scale))
  const th = Math.max(1, Math.round(h * scale))
  canvas.width = tw
  canvas.height = th
  ctx.drawImage(img, 0, 0, tw, th)
  const out = await new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b), 'image/jpeg', 0.7))
  return out || blob
}

export async function resizeToFitLimit(file: File, targetBytes: number): Promise<Blob> {
  const img = await loadImageFromBlob(file)
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const format = toBlobFormat(file.type || 'image/jpeg')
  const quality = format === 'image/png' ? undefined : 0.92
  if (file.size <= targetBytes) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file as Blob
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, w, h)
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), format, quality)
    )
    return out || (file as Blob)
  }
  const scale = Math.sqrt((targetBytes * 0.98) / file.size)
  const tw = Math.max(1, Math.round(w * scale))
  const th = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')
  if (!ctx) return file as Blob
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, tw, th)
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), format, quality)
  )
  return out || (file as Blob)
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}
