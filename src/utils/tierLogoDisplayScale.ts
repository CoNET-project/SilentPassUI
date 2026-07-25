/**
 * Per-tier pass card top-left logo scale (TierMetadata.logoDisplayScale).
 * UI labels: 2x / 4x / 6x / 8x / Hidden.
 */

export type TierLogoDisplayScale = '2x' | '4x' | '6x' | '8x' | 'hidden'

export const TIER_LOGO_DISPLAY_SCALE_OPTIONS: readonly TierLogoDisplayScale[] = [
  '2x',
  '4x',
  '6x',
  '8x',
  'hidden',
] as const

export const TIER_LOGO_DISPLAY_SCALE_DEFAULT: TierLogoDisplayScale = '4x'

/** Image logo sizes (relative to ~16px base). */
export const TIER_LOGO_IMG_SCALE_CLASSES: Record<Exclude<TierLogoDisplayScale, 'hidden'>, string> = {
  '2x': 'h-8 w-8',
  '4x': 'h-16 w-16',
  '6x': 'h-24 w-24',
  '8x': 'h-32 w-32',
}

/** Placeholder Store icon sizes. */
export const TIER_LOGO_ICON_SCALE_CLASSES: Record<Exclude<TierLogoDisplayScale, 'hidden'>, string> = {
  '2x': 'h-6 w-6',
  '4x': 'h-12 w-12',
  '6x': 'h-20 w-20',
  '8x': 'h-28 w-28',
}

export const TIER_LOGO_DISPLAY_SCALE_LABELS: Record<TierLogoDisplayScale, string> = {
  '2x': '2×',
  '4x': '4×',
  '6x': '6×',
  '8x': '8×',
  hidden: 'Hidden',
}

export function normalizeTierLogoDisplayScale(raw: unknown): TierLogoDisplayScale | undefined {
  if (raw == null) return undefined
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase()
    if (t === '2x' || t === '2') return '2x'
    if (t === '4x' || t === '4') return '4x'
    if (t === '6x' || t === '6') return '6x'
    if (t === '8x' || t === '8') return '8x'
    if (t === 'hidden' || t === 'hide' || t === 'none' || t === '0') return 'hidden'
    return undefined
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.trunc(raw)
    if (n === 2) return '2x'
    if (n === 4) return '4x'
    if (n === 6) return '6x'
    if (n === 8) return '8x'
    if (n === 0) return 'hidden'
  }
  return undefined
}

export function clampTierLogoDisplayScale(raw: unknown): TierLogoDisplayScale {
  return normalizeTierLogoDisplayScale(raw) ?? TIER_LOGO_DISPLAY_SCALE_DEFAULT
}

export function tierLogoImgClassForScale(scale: TierLogoDisplayScale): string | null {
  if (scale === 'hidden') return null
  return TIER_LOGO_IMG_SCALE_CLASSES[scale]
}

export function tierLogoIconClassForScale(scale: TierLogoDisplayScale): string | null {
  if (scale === 'hidden') return null
  return TIER_LOGO_ICON_SCALE_CLASSES[scale]
}
