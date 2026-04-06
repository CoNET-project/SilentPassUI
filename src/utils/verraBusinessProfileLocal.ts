/**
 * Verra Business Profile draft: merges onboarding ("live commerce") fields with Business Profile editor.
 * - Pre-wallet: sessionStorage (refresh-safe mid-onboarding)
 * - After EOA exists: localStorage key `verra_business_profile_draft_v1:<eoaLower>`
 */

export const VERRA_BUSINESS_PROFILE_SESSION_KEY = 'verra_business_profile_onboarding_session_v1'

const STORAGE_PREFIX = 'verra_business_profile_draft_v1:'

export type VerraBusinessProfileBusinessType = 'solo' | 'chain' | 'ngo'

export type VerraBusinessProfileDraft = {
  businessType?: VerraBusinessProfileBusinessType
  /** Cover checkbox state while onboarding */
  onboardingTermsAccepted?: boolean
  storeName?: string
  category?: string
  country?: string
  city?: string
  province?: string
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
