/**
 * QR 码点阵颜色对比度保护：浅色品牌色在白底上会让 iOS 相机/扫码器难以识别。
 * 若品牌色与白底的 WCAG 对比度低于阈值，则沿同一色相按比例压暗，直到达标。
 */

/** 二维码点阵与白底的最低对比度（WCAG 比值）。扫码器普遍更偏好高对比，取 7。 */
export const QR_MIN_CONTRAST_RATIO = 7

const QR_FALLBACK_COLOR = '#1562f0'

function parseHexColor(raw: string): [number, number, number] | null {
	const s = raw.trim().replace(/^#/, '')
	if (/^[0-9a-fA-F]{3}$/.test(s)) {
		return [0, 1, 2].map((i) => parseInt(s[i] + s[i], 16)) as [number, number, number]
	}
	if (/^[0-9a-fA-F]{6}$/.test(s)) {
		return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number]
	}
	return null
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
	const lin = (c: number) => {
		const v = c / 255
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
	}
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrastAgainstWhite(rgb: [number, number, number]): number {
	return 1.05 / (relativeLuminance(rgb) + 0.05)
}

function toHex([r, g, b]: [number, number, number]): string {
	return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

/**
 * 返回可安全用于白底二维码的前景色：保持品牌色相，必要时压暗到对比度 >= minRatio。
 * 无法解析的颜色（如 rgb()/命名色）回退为默认品牌蓝。
 */
export function ensureQrForegroundContrast(
	brandColor: string,
	minRatio: number = QR_MIN_CONTRAST_RATIO,
): string {
	const rgb = parseHexColor(brandColor || '') ?? parseHexColor(QR_FALLBACK_COLOR)!
	if (contrastAgainstWhite(rgb) >= minRatio) return toHex(rgb)

	// 二分查找最大的亮度系数 k（0..1），使 rgb*k 对比度达标，尽量保留品牌色。
	let lo = 0
	let hi = 1
	for (let i = 0; i < 20; i++) {
		const mid = (lo + hi) / 2
		const scaled = rgb.map((c) => c * mid) as [number, number, number]
		if (contrastAgainstWhite(scaled) >= minRatio) lo = mid
		else hi = mid
	}
	return toHex(rgb.map((c) => c * lo) as [number, number, number])
}
