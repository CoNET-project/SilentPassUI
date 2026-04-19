/**
 * Card hero logo display scale (Card Configurator + shareTokenMetadata.logoDisplayTier).
 * Four Tailwind size steps for image vs icon placeholders.
 */

export type CardPreviewLogoDisplayTier = 0 | 1 | 2 | 3

export const CARD_PREVIEW_LOGO_DISPLAY_TIER_COUNT = 4

export const CARD_PREVIEW_LOGO_IMG_TIER_CLASSES: readonly string[] = [
  'h-8 w-8',
  'h-12 w-12',
  'h-16 w-16',
  'h-24 w-24',
]

export const CARD_PREVIEW_LOGO_ICON_TIER_CLASSES: readonly string[] = [
  'h-6 w-6',
  'h-9 w-9',
  'h-12 w-12',
  'h-24 w-24',
]

export const CARD_PREVIEW_LOGO_SIZE_LABELS = ['small', 'medium', 'large', 'extra large'] as const

export function normalizeCardPreviewLogoDisplayTier(raw: unknown): CardPreviewLogoDisplayTier | undefined {
  if (raw == null) return undefined
  let n: number
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    n = Math.trunc(raw)
  } else if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return undefined
    n = Number.parseInt(t, 10)
    if (!Number.isFinite(n)) return undefined
  } else {
    return undefined
  }
  if (n < 0 || n > 3) return undefined
  return n as CardPreviewLogoDisplayTier
}

export function clampCardPreviewLogoDisplayTier(raw: unknown): CardPreviewLogoDisplayTier {
  return normalizeCardPreviewLogoDisplayTier(raw) ?? 0
}
