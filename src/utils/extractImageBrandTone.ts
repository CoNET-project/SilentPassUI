/**
 * Sample an image blob and return a mid-tone brand hex for merchant chrome.
 * Skips near-transparent, near-white, and near-black pixels so card art / photos
 * yield a usable accent rather than paper or void.
 */

const SAMPLE_MAX = 48

function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
	return `#${[clamp(r), clamp(g), clamp(b)]
		.map((n) => n.toString(16).padStart(2, '0'))
		.join('')
		.toUpperCase()}`
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
			reject(new Error('Failed to decode image for brand tone'))
		}
		img.src = url
	})
}

/**
 * @returns `#RRGGBB` or `null` when no usable mid-tone pixels exist
 */
export async function extractImageBrandTone(blob: Blob): Promise<string | null> {
	if (typeof document === 'undefined') return null
	if (!blob || blob.size <= 0) return null
	if (typeof blob.type === 'string' && blob.type && !blob.type.startsWith('image/')) return null

	const img = await loadImageFromBlob(blob)
	const w = img.naturalWidth || img.width
	const h = img.naturalHeight || img.height
	if (!w || !h) return null

	const scale = Math.min(1, SAMPLE_MAX / Math.max(w, h))
	const cw = Math.max(1, Math.round(w * scale))
	const ch = Math.max(1, Math.round(h * scale))

	const canvas = document.createElement('canvas')
	canvas.width = cw
	canvas.height = ch
	const ctx = canvas.getContext('2d', { willReadFrequently: true })
	if (!ctx) return null
	ctx.drawImage(img, 0, 0, cw, ch)

	let data: ImageData
	try {
		data = ctx.getImageData(0, 0, cw, ch)
	} catch {
		return null
	}

	const px = data.data
	let sumR = 0
	let sumG = 0
	let sumB = 0
	let count = 0

	for (let i = 0; i < px.length; i += 4) {
		const a = px[i + 3] ?? 0
		if (a < 32) continue
		const r = px[i] ?? 0
		const g = px[i + 1] ?? 0
		const b = px[i + 2] ?? 0
		const max = Math.max(r, g, b)
		const min = Math.min(r, g, b)
		const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
		// Skip paper / void; keep mid-tone and chroma.
		if (luma > 245 && max - min < 18) continue
		if (luma < 18) continue
		sumR += r
		sumG += g
		sumB += b
		count += 1
	}

	if (count < 8) return null
	return rgbToHex(sumR / count, sumG / count, sumB / count)
}
