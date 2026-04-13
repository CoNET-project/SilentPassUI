/**
 * Card Configurator (pre-issuance) draft — localStorage per EOA.
 * Lets users leave via Cancel / tab switch and resume later.
 */

const STORAGE_PREFIX = 'verra_card_configurator_draft_v1:'

export type CardConfiguratorDraftTierRuleV1 = 'single' | 'cumulative' | 'balance'

export type CardConfiguratorDraftTierPresetV1 = 'silver' | 'gold' | 'platinum' | 'custom'

export type CardConfiguratorDraftBonusRuleV1 = {
  id: string
  paymentAmount: string
  bonusValue: string
}

export type CardConfiguratorDraftTierV1 = {
  id: string
  name: string
  preset: CardConfiguratorDraftTierPresetV1
  threshold: string
  discountPercent: string
  tierDescription: string
  tierDescriptionOpen: boolean
  backgroundColor: string
}

export type CardConfiguratorDraftV1 = {
  version: 1
  programName?: string
  currencySymbol?: string
  storeDisplayName?: string
  bonusRules?: CardConfiguratorDraftBonusRuleV1[]
  bonusRulePaymentAmount?: string
  bonusRuleBonusValue?: string
  minTopup?: string
  maxTopup?: string
  tierRule?: CardConfiguratorDraftTierRuleV1
  tiers?: CardConfiguratorDraftTierV1[]
  shareImageUrl?: string
  categoryId?: string
  description?: string
  mobileStep?: number
  configuratorPreviewMode?: 'app' | 'physical'
  previewTierId?: string | null
  updatedAt?: number
}

export function cardConfiguratorDraftStorageKey(eoaLower: string): string {
  return `${STORAGE_PREFIX}${eoaLower.trim().toLowerCase()}`
}

const TIER_RULES: CardConfiguratorDraftTierRuleV1[] = ['single', 'cumulative', 'balance']
const TIER_PRESETS: CardConfiguratorDraftTierPresetV1[] = ['silver', 'gold', 'platinum', 'custom']

function normalizeTierRule(raw: unknown): CardConfiguratorDraftTierRuleV1 | undefined {
  return typeof raw === 'string' && (TIER_RULES as string[]).includes(raw)
    ? (raw as CardConfiguratorDraftTierRuleV1)
    : undefined
}

function normalizeTierPreset(raw: unknown): CardConfiguratorDraftTierPresetV1 {
  return typeof raw === 'string' && (TIER_PRESETS as string[]).includes(raw)
    ? (raw as CardConfiguratorDraftTierPresetV1)
    : 'custom'
}

function normalizeBonusRules(raw: unknown): CardConfiguratorDraftBonusRuleV1[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: CardConfiguratorDraftBonusRuleV1[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `bonus-rule-${out.length}`
    const paymentAmount = typeof r.paymentAmount === 'string' ? r.paymentAmount : String(r.paymentAmount ?? '')
    const bonusValue = typeof r.bonusValue === 'string' ? r.bonusValue : String(r.bonusValue ?? '')
    out.push({ id, paymentAmount, bonusValue })
  }
  return out.length ? out : undefined
}

function normalizeTiers(raw: unknown): CardConfiguratorDraftTierV1[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: CardConfiguratorDraftTierV1[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const id = typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `tier-${out.length}`
    const name = typeof r.name === 'string' ? r.name : ''
    const threshold = typeof r.threshold === 'string' ? r.threshold : String(r.threshold ?? '')
    const discountPercent = typeof r.discountPercent === 'string' ? r.discountPercent : String(r.discountPercent ?? '')
    const tierDescription = typeof r.tierDescription === 'string' ? r.tierDescription : ''
    const tierDescriptionOpen = r.tierDescriptionOpen === true
    const backgroundColor = typeof r.backgroundColor === 'string' ? r.backgroundColor : '#94a3b8'
    out.push({
      id,
      name,
      preset: normalizeTierPreset(r.preset),
      threshold,
      discountPercent,
      tierDescription,
      tierDescriptionOpen,
      backgroundColor,
    })
  }
  return out.length ? out : undefined
}

export function loadCardConfiguratorDraftForEoa(eoaLower: string): CardConfiguratorDraftV1 | null {
  if (!eoaLower.trim()) return null
  try {
    const raw = localStorage.getItem(cardConfiguratorDraftStorageKey(eoaLower))
    if (!raw) return null
    const p = JSON.parse(raw) as Record<string, unknown>
    if (!p || typeof p !== 'object' || p.version !== 1) return null
    const mobileRaw = p.mobileStep
    let mobileStep: number | undefined
    if (typeof mobileRaw === 'number' && Number.isFinite(mobileRaw)) {
      mobileStep = Math.min(2, Math.max(1, Math.round(mobileRaw)))
    }
    const previewMode = p.configuratorPreviewMode === 'physical' ? 'physical' : p.configuratorPreviewMode === 'app' ? 'app' : undefined
    let previewTierId: string | null | undefined
    if (p.previewTierId === null) previewTierId = null
    else if (typeof p.previewTierId === 'string') previewTierId = p.previewTierId

    const draft: CardConfiguratorDraftV1 = {
      version: 1,
      programName: typeof p.programName === 'string' ? p.programName : undefined,
      currencySymbol: typeof p.currencySymbol === 'string' ? p.currencySymbol : undefined,
      storeDisplayName: typeof p.storeDisplayName === 'string' ? p.storeDisplayName : undefined,
      bonusRules: normalizeBonusRules(p.bonusRules),
      bonusRulePaymentAmount: typeof p.bonusRulePaymentAmount === 'string' ? p.bonusRulePaymentAmount : undefined,
      bonusRuleBonusValue: typeof p.bonusRuleBonusValue === 'string' ? p.bonusRuleBonusValue : undefined,
      minTopup: typeof p.minTopup === 'string' ? p.minTopup : undefined,
      maxTopup: typeof p.maxTopup === 'string' ? p.maxTopup : undefined,
      tierRule: normalizeTierRule(p.tierRule),
      tiers: normalizeTiers(p.tiers),
      shareImageUrl: typeof p.shareImageUrl === 'string' ? p.shareImageUrl : undefined,
      categoryId: typeof p.categoryId === 'string' ? p.categoryId : undefined,
      description: typeof p.description === 'string' ? p.description : undefined,
      mobileStep,
      configuratorPreviewMode: previewMode,
      previewTierId,
    }
    return draft
  } catch {
    return null
  }
}

export function saveCardConfiguratorDraftForEoa(eoaLower: string, draft: Omit<CardConfiguratorDraftV1, 'version' | 'updatedAt'>): void {
  if (!eoaLower.trim()) return
  try {
    const payload: CardConfiguratorDraftV1 = {
      version: 1,
      ...draft,
      updatedAt: Date.now(),
    }
    localStorage.setItem(cardConfiguratorDraftStorageKey(eoaLower), JSON.stringify(payload))
  } catch {
    /* quota */
  }
}

export function clearCardConfiguratorDraftForEoa(eoaLower: string): void {
  if (!eoaLower.trim()) return
  try {
    localStorage.removeItem(cardConfiguratorDraftStorageKey(eoaLower))
  } catch {
    /* */
  }
}
