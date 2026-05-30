/**
 * IPFS image helpers for card / avatar uploads (same behavior as `pages/cardManager/index.tsx`).
 * Base64 payload stays under gateway limits via resize / JPEG fallback.
 * SVG uploads are rasterized to PNG before IPFS so native clients (iOS AsyncImage, etc.) receive bitmap URLs.
 */

/** Target file size 37MB so base64 (~49MB) stays under server 50MB limit */
export const IPFS_UPLOAD_TARGET_MAX_BYTES = 37 * 1024 * 1024
/** When 413, retry with JPEG under this size */
export const IPFS_UPLOAD_JPEG_RETRY_MAX_BYTES = 700 * 1024

export const IPFS_GET_FRAGMENT = 'https://ipfs.conet.network/api/getFragment?hash='

/** Catalog item background media picker — images, video, PDF. */
export const IPFS_PRODUCTION_BACKGROUND_ACCEPT =
  'image/*,video/*,application/pdf,.pdf'

export function inferProductionBackgroundMimeFromFile(file: File): string {
  const mime = (file.type || '').trim().toLowerCase()
  if (mime) return mime
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.mp4')) return 'video/mp4'
  if (name.endsWith('.webm')) return 'video/webm'
  if (name.endsWith('.mov')) return 'video/quicktime'
  if (name.endsWith('.m4v')) return 'video/x-m4v'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}

export function fileLooksLikeProductionBackgroundMedia(file: File): boolean {
  const mime = inferProductionBackgroundMimeFromFile(file)
  if (mime.startsWith('image/')) return true
  if (mime.startsWith('video/')) return true
  if (mime === 'application/pdf') return true
  return file.name.toLowerCase().endsWith('.pdf')
}

/** Images use resize/SVG rasterization; PDF uses byte cap; video uses duration cap elsewhere (≤60s). */
export async function uploadMediaFileToIpfsWithRetry(
  file: File,
  postToIPFS: (dataUrl: string) => Promise<string | null>
): Promise<string | null> {
  const mime = inferProductionBackgroundMimeFromFile(file)
  if (mime.startsWith('image/')) {
    return uploadImageFileToIpfsWithRetry(file, postToIPFS)
  }
  if (mime.startsWith('video/')) {
    // Catalog background video is standardized to ≤60s before upload; do not gate on file size.
    const dataUrl = await blobToDataUrl(file)
    return postToIPFS(dataUrl)
  }
  if (file.size > IPFS_UPLOAD_TARGET_MAX_BYTES) {
    throw new Error(
      `File is too large. Maximum upload size is ${Math.round(IPFS_UPLOAD_TARGET_MAX_BYTES / (1024 * 1024))} MB.`
    )
  }
  const dataUrl = await blobToDataUrl(file)
  return postToIPFS(dataUrl)
}

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

/** SVG (or `.svg` filename) is rasterized so IPFS + iOS/Android bitmap pipelines stay consistent. */
export function fileLooksLikeSvg(file: File): boolean {
  const mime = (file.type || '').toLowerCase()
  if (mime === 'image/svg+xml') return true
  return file.name.toLowerCase().endsWith('.svg')
}

/**
 * Converts local SVG to PNG via canvas (browser-decoded bitmap). Other image types pass through unchanged.
 * @param maxDimension max width/height after preserve-aspect downscale (intrinsic SVG size may be huge)
 */
export async function prepareImageFileForIpfsUpload(file: File, maxDimension = 2048): Promise<File> {
  if (!fileLooksLikeSvg(file)) return file
  const img = await loadImageFromBlob(file)
  if (typeof img.decode === 'function') {
    try {
      await img.decode()
    } catch {
      /* decode is best-effort; naturalWidth may still populate after onload */
    }
  }
  let w = img.naturalWidth || img.width || 0
  let h = img.naturalHeight || img.height || 0
  if (w <= 0 || h <= 0) {
    w = 512
    h = 512
  }
  let dw = w
  let dh = h
  const m = Math.max(dw, dh)
  if (m > maxDimension) {
    const s = maxDimension / m
    dw = Math.max(1, Math.round(dw * s))
    dh = Math.max(1, Math.round(dh * s))
  }
  const canvas = document.createElement('canvas')
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available for SVG conversion')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, dw, dh)
  ctx.drawImage(img, 0, 0, dw, dh)
  const pngBlob = await new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b), 'image/png'))
  if (!pngBlob) throw new Error('Failed to convert SVG to PNG')
  let baseName = file.name.replace(/\.svg$/i, '').trim()
  if (!baseName) baseName = 'image'
  return new File([pngBlob], `${baseName}.png`, { type: 'image/png', lastModified: Date.now() })
}

/** Resize (if needed) → data URL → post; on 413, JPEG-compress and retry once. Applies SVG→PNG first. */
export async function uploadImageFileToIpfsWithRetry(
  file: File,
  postToIPFS: (dataUrl: string) => Promise<string | null>
): Promise<string | null> {
  const prepared = await prepareImageFileForIpfsUpload(file)
  let blob: Blob = prepared
  if (blob.size > IPFS_UPLOAD_TARGET_MAX_BYTES) {
    blob = await resizeToFitLimit(prepared, IPFS_UPLOAD_TARGET_MAX_BYTES)
  }
  let dataUrl = await blobToDataUrl(blob)
  try {
    return await postToIPFS(dataUrl)
  } catch (err: unknown) {
    const msg = (err as Error)?.message ?? String(err)
    if (typeof msg === 'string' && msg.includes('413')) {
      blob = await compressToJpeg(blob, IPFS_UPLOAD_JPEG_RETRY_MAX_BYTES)
      dataUrl = await blobToDataUrl(blob)
      return await postToIPFS(dataUrl)
    }
    throw err
  }
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
