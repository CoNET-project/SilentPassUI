/**
 * Merchant program pass hero gradient + WCAG foreground palette.
 * Aligns Overview sticky pass / iOS ReadBalanceStandardPassHeroCard.
 */

export function normalizeNftBackgroundHex(input: string | undefined | null): string | null {
  if (input == null || typeof input !== 'string') return null
  const s = input.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const h = s.slice(1)
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
  }
  return null
}

export function tierBackgroundColorForPayload(raw: string): string | undefined {
  const s = raw.trim()
  if (!s) return undefined
  const withHash = s.startsWith('#') ? s : `#${s}`
  return normalizeNftBackgroundHex(withHash) ?? undefined
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeNftBackgroundHex(hex)
  if (!n) return null
  const h = n.slice(1)
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function relativeLuminanceFromRgb(rgb: { r: number; g: number; b: number }): number {
  const lin = (c: number) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b)
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const maxc = Math.max(rn, gn, bn)
  const minc = Math.min(rn, gn, bn)
  const delta = maxc - minc
  if (delta < 1e-5) return { h: 0, s: 0, v: maxc }
  let hDeg = 0
  if (Math.abs(maxc - rn) < 1e-5) {
    hDeg = 60 * ((gn - bn) / delta)
    if (hDeg < 0) hDeg += 360
  } else if (Math.abs(maxc - gn) < 1e-5) {
    hDeg = 60 * ((bn - rn) / delta + 2)
  } else {
    hDeg = 60 * ((rn - gn) / delta + 4)
  }
  const h = (((hDeg / 360) % 1) + 1) % 1
  const s = maxc === 0 ? 0 : delta / maxc
  return { h, s, v: maxc }
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = (((h * 6) % 6) + 6) % 6
  const i = Math.floor(hh)
  const f = hh - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)
  let rp = 0
  let gp = 0
  let bp = 0
  switch (i) {
    case 0:
      rp = v
      gp = t
      bp = p
      break
    case 1:
      rp = q
      gp = v
      bp = p
      break
    case 2:
      rp = p
      gp = v
      bp = t
      break
    case 3:
      rp = p
      gp = q
      bp = v
      break
    case 4:
      rp = t
      gp = p
      bp = v
      break
    default:
      rp = v
      gp = p
      bp = q
      break
  }
  return {
    r: Math.round(Math.min(1, Math.max(0, rp)) * 255),
    g: Math.round(Math.min(1, Math.max(0, gp)) * 255),
    b: Math.round(Math.min(1, Math.max(0, bp)) * 255),
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function wcagContrastRatio(luminanceA: number, luminanceB: number): number {
  const light = Math.max(luminanceA, luminanceB)
  const dark = Math.min(luminanceA, luminanceB)
  return (light + 0.05) / (dark + 0.05)
}

function preferDarkForegroundPerWcag(backgroundLuminance: number): boolean {
  const lb = clamp(backgroundLuminance, 0, 1)
  return wcagContrastRatio(lb, 0.0) > wcagContrastRatio(1.0, lb)
}

function gradientColorAlongDiagonal(
  sr: number,
  sg: number,
  sb: number,
  er: number,
  eg: number,
  eb: number,
  t: number
): { r: number; g: number; b: number } {
  const s = clamp(t, 0, 1)
  return {
    r: sr + (er - sr) * s,
    g: sg + (eg - sg) * s,
    b: sb + (eb - sb) * s,
  }
}

function cardDiagonalGradientT(u: number, v: number, aspectWidthOverHeight = 1.6): number {
  const a2 = aspectWidthOverHeight * aspectWidthOverHeight
  return (clamp(u, 0, 1) * a2 + clamp(v, 0, 1)) / (a2 + 1)
}

function preferDarkForegroundWcagRightSmallTextZone(
  startRgb: { r: number; g: number; b: number },
  endRgb: { r: number; g: number; b: number },
  aspectWidthOverHeight = 1.6
): boolean {
  const samples: Array<[number, number]> = [
    [0.93, 0.07],
    [0.94, 0.14],
    [0.91, 0.23],
    [0.89, 0.32],
    [0.86, 0.41],
  ]
  let minCrWhite = Number.POSITIVE_INFINITY
  let minCrBlack = Number.POSITIVE_INFINITY
  for (const [u, v] of samples) {
    const tt = cardDiagonalGradientT(u, v, aspectWidthOverHeight)
    const bg = gradientColorAlongDiagonal(
      startRgb.r,
      startRgb.g,
      startRgb.b,
      endRgb.r,
      endRgb.g,
      endRgb.b,
      tt
    )
    const lb = relativeLuminanceFromRgb(bg)
    minCrWhite = Math.min(minCrWhite, wcagContrastRatio(1.0, lb))
    minCrBlack = Math.min(minCrBlack, wcagContrastRatio(lb, 0.0))
  }
  if (!Number.isFinite(minCrWhite) || !Number.isFinite(minCrBlack)) {
    return preferDarkForegroundPerWcag(relativeLuminanceFromRgb(startRgb))
  }
  return minCrBlack > minCrWhite
}

function sameFamilyGradientEndRgb(startHex: string): { r: number; g: number; b: number } {
  const rgb = hexToRgb(startHex)
  if (!rgb) return { r: 0x15, g: 0x62, b: 0xf0 }
  const lum = relativeLuminanceFromRgb(rgb)
  const deepBackground = !preferDarkForegroundPerWcag(lum)
  const { h: ho, s: s0, v: v0 } = rgbToHsv(rgb.r, rgb.g, rgb.b)
  if (deepBackground) {
    const v1 = clamp(v0 + 0.38, 0.52, 0.97)
    const s1 = clamp(s0 * 0.9, 0.1, 1)
    return hsvToRgb(ho, s1, v1)
  }
  const v1 = clamp(v0 - 0.32, 0.1, 0.5)
  const s1 = clamp(s0 * 1.06, 0.12, 1)
  return hsvToRgb(ho, s1, v1)
}

export function cardIssuanceTierGradientStops(backgroundColorRaw: string): { start: string; end: string } {
  const start = tierBackgroundColorForPayload(backgroundColorRaw) ?? '#1562f0'
  const endRgb = sameFamilyGradientEndRgb(start)
  return { start, end: rgbToHex(endRgb.r, endRgb.g, endRgb.b) }
}

export function cardIssuanceTierRowGradientCss(backgroundColorRaw: string): string {
  const { start, end } = cardIssuanceTierGradientStops(backgroundColorRaw)
  return `linear-gradient(135deg, ${start} 0%, ${end} 100%)`
}

export type CardIssuanceTierGradientTheme = {
  isDarkStart: boolean
  primary: string
  secondary: string
  tertiary: string
  accent: string
  cardBorder: string
  iconOrbitBorder: string
  iconOrbitBg: string
  defaultBadgeBg: string
  defaultBadgeFg: string
}

export function cardIssuanceTierGradientTheme(backgroundColorRaw: string): CardIssuanceTierGradientTheme {
  const startHex = tierBackgroundColorForPayload(backgroundColorRaw) ?? '#1562f0'
  const startRgb = hexToRgb(startHex) ?? { r: 0x15, g: 0x62, b: 0xf0 }
  const endRgb = sameFamilyGradientEndRgb(startHex)
  const darkForeground = preferDarkForegroundWcagRightSmallTextZone(startRgb, endRgb, 1.6)
  const primaryOnLight = '#0f172a'
  const primary = darkForeground ? primaryOnLight : '#ffffff'
  const secondary = darkForeground ? 'rgba(15,23,42,0.88)' : 'rgba(255,255,255,0.88)'
  const tertiary = darkForeground ? 'rgba(15,23,42,0.78)' : 'rgba(255,255,255,0.78)'
  const cardBorder = darkForeground ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.22)'
  return {
    isDarkStart: !darkForeground,
    primary,
    secondary,
    tertiary,
    accent: tertiary,
    cardBorder,
    iconOrbitBorder: cardBorder,
    iconOrbitBg: darkForeground ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)',
    defaultBadgeBg: darkForeground ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.22)',
    defaultBadgeFg: darkForeground ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.95)',
  }
}

export type CardBackgroundImageFit = 'width' | 'height'

export function normalizeCardBackgroundImageFit(raw: unknown): CardBackgroundImageFit {
  return raw === 'height' ? 'height' : 'width'
}
