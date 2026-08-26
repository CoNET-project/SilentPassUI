/**
 * Verra Business Profile draft: merges onboarding ("live commerce") fields with Business Profile editor.
 * - Pre-wallet: sessionStorage (refresh-safe mid-onboarding)
 * - After EOA exists: localStorage key `verra_business_profile_draft_v1:<eoaLower>`
 */

export const VERRA_BUSINESS_PROFILE_SESSION_KEY = 'verra_business_profile_onboarding_session_v1'

const STORAGE_PREFIX = 'verra_business_profile_draft_v1:'

export type VerraBusinessProfileBusinessType = 'solo' | 'chain' | 'ngo'

/** Discover onboarding channel (Physical / Digital / App). */
export type VerraBusinessChannelKind = 'physical' | 'digital' | 'app'

export type VerraBusinessProfileDraft = {
  businessType?: VerraBusinessProfileBusinessType
  /** Cover checkbox state while onboarding */
  onboardingTermsAccepted?: boolean
  storeName?: string
  category?: string
  country?: string
  city?: string
  province?: string
  /** Business channel from discovery form (physical / digital / app). */
  channelKind?: VerraBusinessChannelKind
  publicBio?: string
  legalBusinessName?: string
  taxId?: string
  website?: string
  streetAddress?: string
  postalCode?: string
  supportEmail?: string
  timezone?: string
  merchantRemarks?: string
  brandHex?: string
  updatedAt?: number
}

export function businessProfileDraftStorageKey(eoa: string): string {
  return `${STORAGE_PREFIX}${eoa.trim().toLowerCase()}`
}

export function loadBusinessProfileDraftForEoa(eoa: string): VerraBusinessProfileDraft | null {
  if (!eoa.trim()) return null
  try {
    const raw = localStorage.getItem(businessProfileDraftStorageKey(eoa))
    if (!raw) return null
    const p = JSON.parse(raw) as VerraBusinessProfileDraft
    return p && typeof p === 'object' ? p : null
  } catch {
    return null
  }
}

export function saveBusinessProfileDraftForEoa(eoa: string, draft: VerraBusinessProfileDraft): void {
  try {
    localStorage.setItem(
      businessProfileDraftStorageKey(eoa),
      JSON.stringify({ ...draft, updatedAt: Date.now() })
    )
  } catch {
    /* quota */
  }
}

export function patchBusinessProfileDraftForEoa(
  eoa: string,
  patch: Partial<VerraBusinessProfileDraft>
): VerraBusinessProfileDraft {
  const prev = loadBusinessProfileDraftForEoa(eoa) ?? {}
  const merged: VerraBusinessProfileDraft = { ...prev, ...patch, updatedAt: Date.now() }
  saveBusinessProfileDraftForEoa(eoa, merged)
  return merged
}

export function loadSessionOnboardingBusinessDraft(): VerraBusinessProfileDraft | null {
  try {
    const raw = sessionStorage.getItem(VERRA_BUSINESS_PROFILE_SESSION_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as VerraBusinessProfileDraft
    return p && typeof p === 'object' ? p : null
  } catch {
    return null
  }
}

export function saveSessionOnboardingBusinessDraft(patch: Partial<VerraBusinessProfileDraft>): void {
  try {
    const prev = loadSessionOnboardingBusinessDraft() ?? {}
    const merged = { ...prev, ...patch, updatedAt: Date.now() }
    sessionStorage.setItem(VERRA_BUSINESS_PROFILE_SESSION_KEY, JSON.stringify(merged))
  } catch {
    /* */
  }
}

export function clearSessionOnboardingBusinessDraft(): void {
  try {
    sessionStorage.removeItem(VERRA_BUSINESS_PROFILE_SESSION_KEY)
  } catch {
    /* */
  }
}

/** After wallet creation / restore: merge session onboarding into EOA-scoped local draft, then clear session. */
export function mergeSessionOnboardingDraftIntoEoa(eoa: string): void {
  const raw = eoa.trim()
  if (!raw) {
    clearSessionOnboardingBusinessDraft()
    return
  }
  const sess = loadSessionOnboardingBusinessDraft()
  if (!sess || Object.keys(sess).length === 0) {
    clearSessionOnboardingBusinessDraft()
    return
  }
  const key = businessProfileDraftStorageKey(raw)
  let prev: VerraBusinessProfileDraft = {}
  try {
    const ls = localStorage.getItem(key)
    if (ls) prev = JSON.parse(ls) as VerraBusinessProfileDraft
  } catch {
    prev = {}
  }
  const merged: VerraBusinessProfileDraft = {
    ...prev,
    ...sess,
    updatedAt: Date.now(),
  }
  try {
    localStorage.setItem(key, JSON.stringify(merged))
  } catch {
    /* */
  }
  clearSessionOnboardingBusinessDraft()
}

/** Default Business Category on mobile Lite onboarding (“Local business” → `local-services`). */
export const VERRA_LITE_DEFAULT_CATEGORY_VALUE = 'local-services'

const LITE_CHAIN_ACK_PREFIX = 'verra_lite_business_chain_ack_v1:'

export function liteBusinessChainAckStorageKey(eoa: string): string {
  return `${LITE_CHAIN_ACK_PREFIX}${eoa.trim().toLowerCase()}`
}

/** Mark that business fields are backed by on-chain recover (restore, create, or explicit push). */
export function setLiteBusinessChainAck(eoa: string): void {
  try {
    localStorage.setItem(liteBusinessChainAckStorageKey(eoa), JSON.stringify({ at: Date.now() }))
  } catch {
    /* */
  }
}

export function clearLiteBusinessChainAck(eoa: string): void {
  try {
    localStorage.removeItem(liteBusinessChainAckStorageKey(eoa))
  } catch {
    /* */
  }
}

export function hasLiteBusinessChainAck(eoa: string): boolean {
  if (!eoa.trim()) return false
  try {
    return Boolean(localStorage.getItem(liteBusinessChainAckStorageKey(eoa)))
  } catch {
    return false
  }
}

/** Lite / recover parity: must all be non-empty (trimmed) to skip Business OS mobile gate. */
export function hasVerraLiteBusinessRequiredFields(d: VerraBusinessProfileDraft | null | undefined): boolean {
  if (!d || typeof d !== 'object') return false
  for (const key of ['storeName', 'category', 'country', 'city', 'province'] as const) {
    const v = d[key]
    if (typeof v !== 'string' || !v.trim()) return false
  }
  return true
}

/**
 * Flatten on-chain / restore `recoverData` (and optional `onboardingFormJson` snapshot) into profile draft fields.
 */
export function pickVerraBusinessFieldsFromRecover(recovered: unknown): Partial<VerraBusinessProfileDraft> {
  if (!recovered || typeof recovered !== 'object') return {}
  const r = recovered as Record<string, unknown>
  const next: Partial<VerraBusinessProfileDraft> = {}

  if (r.businessType === 'solo' || r.businessType === 'chain' || r.businessType === 'ngo') {
    next.businessType = r.businessType
  }
  if (typeof r.onboardingTermsAccepted === 'boolean') {
    next.onboardingTermsAccepted = r.onboardingTermsAccepted
  }
  const pull = (key: keyof VerraBusinessProfileDraft) => {
    const v = r[key as string]
    if (typeof v === 'string' && v.trim()) (next as any)[key] = v.trim()
  }
  for (const k of ['storeName', 'category', 'country', 'city', 'province'] as const) {
    pull(k)
  }
  if (r.channelKind === 'physical' || r.channelKind === 'digital' || r.channelKind === 'app') {
    next.channelKind = r.channelKind
  }

  const formJson = r.onboardingFormJson
  if (typeof formJson === 'string' && formJson.trim()) {
    try {
      const j = JSON.parse(formJson) as Record<string, unknown>
      const fillMissing = (key: keyof VerraBusinessProfileDraft) => {
        if ((next as any)[key]) return
        const v = j[key as string]
        if (typeof v === 'string' && v.trim()) (next as any)[key] = v.trim()
      }
      for (const k of ['storeName', 'category', 'country', 'city', 'province'] as const) {
        fillMissing(k)
      }
      if (!next.businessType && (j.businessType === 'solo' || j.businessType === 'chain' || j.businessType === 'ngo')) {
        next.businessType = j.businessType
      }
    } catch {
      /* ignore */
    }
  }
  return next
}
