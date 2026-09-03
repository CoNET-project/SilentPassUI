/**
 * Card Configurator (pre-issuance) draft — localStorage per EOA.
 * Lets users leave via Cancel / tab switch and resume later.
 */

import { normalizeCardPreviewLogoDisplayTier, type CardPreviewLogoDisplayTier } from '@/utils/cardPreviewLogoDisplayTier'

const STORAGE_PREFIX = 'verra_card_configurator_draft_v1:'

export type CardConfiguratorDraftTierRuleV1 = 'single' | 'cumulative' | 'balance'

export type CardConfiguratorDraftTierPresetV1 = 'silver' | 'gold' | 'platinum' | 'custom'

export type CardConfiguratorDraftBonusRuleV1 = {
  id: string
  paymentAmount: string
  bonusValue: string
  /** When true, bonus = top-up × (bonusValue / paymentAmount). */
  bonusProportional?: boolean
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

export type CardConfiguratorDraftRewardsPresetV1 = 'default' | 'custom' | 'salesManagement'

export type CardConfiguratorDraftTopupPromotionFixedTierV1 = {
  id: string
  topupAmount: string
  bonusAmount: string
}

export type CardConfiguratorDraftTopupPromotionV1 = {
  enabled?: boolean
  validityPeriodEnabled?: boolean
  validFrom?: string
  validTo?: string
  minimumTopupAmount: string
  rewardType: 'percent' | 'fixed'
  rewardValue: string
  fixedTiers?: CardConfiguratorDraftTopupPromotionFixedTierV1[]
}

export type CardConfiguratorDraftUnifiedRewardTopupV1 = {
  enabled?: boolean
  percent?: string
}

export type CardConfiguratorDraftV1 = {
  version: 1
  programName?: string
  currencySymbol?: string
  storeDisplayName?: string
  /** @deprecated Legacy recharge bonus rules — read compat only. */
  bonusRules?: CardConfiguratorDraftBonusRuleV1[]
  bonusRulePaymentAmount?: string
  bonusRuleBonusValue?: string
  /** Global top-up promotion (single). */
  topupPromotion?: CardConfiguratorDraftTopupPromotionV1
  /** Unified #13 Reward PT for top-up (percent of top-up). */
  unifiedRewardTopup?: CardConfiguratorDraftUnifiedRewardTopupV1
  minTopup?: string
  maxTopup?: string
   tierRule?: CardConfiguratorDraftTierRuleV1
  /** Per loyalty rule type; takes precedence over legacy `tiers` when present. */
  tiersByLoyaltyRule?: Partial<Record<CardConfiguratorDraftTierRuleV1, CardConfiguratorDraftTierV1[]>>
  tiers?: CardConfiguratorDraftTierV1[]
  shareImageUrl?: string
  /** IPFS URL for `shareTokenMetadata.merchantImage` (wide / hero; distinct from logo `image`). */
  merchantImageUrl?: string
  /** 0–3 hero logo scale; persisted to shareTokenMetadata.logoDisplayTier on publish */
  logoDisplayTier?: CardPreviewLogoDisplayTier
  categoryId?: string
  description?: string
  mobileStep?: number
  configuratorPreviewMode?: 'app' | 'physical'
  previewTierId?: string | null
  /** New issuance only: legacy quick default vs full wizard (UI removed; kept for draft compat). */
  rewardsPreset?: CardConfiguratorDraftRewardsPresetV1
  /** Rewards setup: membership-fee mode switch. */
  rewardsMembershipFeeEnabled?: boolean
  /** Rewards setup: membership fee or tier-qualify amount (card currency human string). */
  rewardsSetupAmount?: string
  updatedAt?: number
}

export function cardConfiguratorDraftStorageKey(eoaLower: string): string {
  return `${STORAGE_PREFIX}${eoaLower.trim().toLowerCase()}`
}

const TIER_RULES: CardConfiguratorDraftTierRuleV1[] = ['single', 'cumulative', 'balance']
const TIER_PRESETS: CardConfiguratorDraftTierPresetV1[] = ['silver', 'gold', 'platinum', 'custom']

function normalizeRewardsPreset(raw: unknown): CardConfiguratorDraftRewardsPresetV1 | undefined {
  return raw === 'default' || raw === 'custom' || raw === 'salesManagement' ? raw : undefined
}

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

function normalizeUnifiedRewardTopup(raw: unknown): CardConfiguratorDraftUnifiedRewardTopupV1 | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const percent =
    typeof r.percent === 'string' ? r.percent : r.percent != null ? String(r.percent) : undefined
  if (r.enabled !== true && r.enabled !== false && !percent?.trim()) return undefined
  return {
    enabled: r.enabled === true,
    ...(percent != null ? { percent } : {}),
  }
}

function normalizeTopupPromotionFixedTiers(
  raw: unknown
): CardConfiguratorDraftTopupPromotionFixedTierV1[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: CardConfiguratorDraftTopupPromotionFixedTierV1[] = []
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]
    if (!row || typeof row !== 'object') continue
    const t = row as Record<string, unknown>
    const topupAmount =
      typeof t.topupAmount === 'string' ? t.topupAmount : t.topupAmount != null ? String(t.topupAmount) : ''
    const bonusAmount =
      typeof t.bonusAmount === 'string' ? t.bonusAmount : t.bonusAmount != null ? String(t.bonusAmount) : ''
    if (!topupAmount.trim() && !bonusAmount.trim()) continue
    const id =
      typeof t.id === 'string' && t.id.trim() ? t.id.trim() : `fixed-tier-${out.length + 1}`
    out.push({ id, topupAmount, bonusAmount })
  }
  return out.length > 0 ? out : undefined
}

function normalizeTopupPromotion(raw: unknown): CardConfiguratorDraftTopupPromotionV1 | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const minimumTopupAmount =
    typeof r.minimumTopupAmount === 'string'
      ? r.minimumTopupAmount
      : r.minimumTopupAmount != null
        ? String(r.minimumTopupAmount)
        : ''
  const rewardValue =
    typeof r.rewardValue === 'string' ? r.rewardValue : r.rewardValue != null ? String(r.rewardValue) : ''
  const rewardTypeRaw = String(r.rewardType ?? '').trim().toLowerCase()
  const rewardType: 'percent' | 'fixed' = rewardTypeRaw === 'fixed' ? 'fixed' : 'percent'
  const fixedTiers = normalizeTopupPromotionFixedTiers(r.fixedTiers)
  if (
    !minimumTopupAmount.trim() &&
    !rewardValue.trim() &&
    !(fixedTiers && fixedTiers.length > 0) &&
    r.enabled !== true
  ) {
    return undefined
  }
  return {
    enabled: r.enabled === false ? false : r.enabled === true ? true : undefined,
    validityPeriodEnabled:
      typeof r.validityPeriodEnabled === 'boolean'
        ? r.validityPeriodEnabled
        : Boolean(
            (typeof r.validFrom === 'string' && r.validFrom.trim()) ||
              (typeof r.validTo === 'string' && r.validTo.trim())
          )
        ? true
        : undefined,
    validFrom: typeof r.validFrom === 'string' ? r.validFrom : undefined,
    validTo: typeof r.validTo === 'string' ? r.validTo : undefined,
    minimumTopupAmount,
    rewardType,
    rewardValue,
    ...(fixedTiers ? { fixedTiers } : {}),
  }
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
    const bonusProportional =
      r.bonusProportional === true ||
      r.bonusIsProportional === true ||
      r.percentBased === true ||
      r.bonusProportional === 1
    out.push({
      id,
      paymentAmount,
      bonusValue,
      ...(bonusProportional ? { bonusProportional: true } : {}),
    })
  }
  return out.length ? out : undefined
}

function normalizeTiersByLoyaltyRule(
  raw: unknown
): Partial<Record<CardConfiguratorDraftTierRuleV1, CardConfiguratorDraftTierV1[]>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const src = raw as Record<string, unknown>
  const out: Partial<Record<CardConfiguratorDraftTierRuleV1, CardConfiguratorDraftTierV1[]>> = {}
  for (const key of TIER_RULES) {
    const tiers = normalizeTiers(src[key])
    if (tiers?.length) out[key] = tiers
  }
  return Object.keys(out).length ? out : undefined
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

    const logoDisplayTier = normalizeCardPreviewLogoDisplayTier(p.logoDisplayTier)

    const draft: CardConfiguratorDraftV1 = {
      version: 1,
      programName: typeof p.programName === 'string' ? p.programName : undefined,
      currencySymbol: typeof p.currencySymbol === 'string' ? p.currencySymbol : undefined,
      storeDisplayName: typeof p.storeDisplayName === 'string' ? p.storeDisplayName : undefined,
      bonusRules: normalizeBonusRules(p.bonusRules),
      bonusRulePaymentAmount: typeof p.bonusRulePaymentAmount === 'string' ? p.bonusRulePaymentAmount : undefined,
      bonusRuleBonusValue: typeof p.bonusRuleBonusValue === 'string' ? p.bonusRuleBonusValue : undefined,
      topupPromotion: normalizeTopupPromotion(p.topupPromotion),
      unifiedRewardTopup: normalizeUnifiedRewardTopup(p.unifiedRewardTopup),
      minTopup: typeof p.minTopup === 'string' ? p.minTopup : undefined,
      maxTopup: typeof p.maxTopup === 'string' ? p.maxTopup : undefined,
      tierRule: normalizeTierRule(p.tierRule),
      tiersByLoyaltyRule: normalizeTiersByLoyaltyRule(p.tiersByLoyaltyRule),
      tiers: normalizeTiers(p.tiers),
      shareImageUrl: typeof p.shareImageUrl === 'string' ? p.shareImageUrl : undefined,
      ...(logoDisplayTier !== undefined ? { logoDisplayTier } : {}),
      categoryId: typeof p.categoryId === 'string' ? p.categoryId : undefined,
      description: typeof p.description === 'string' ? p.description : undefined,
      mobileStep,
      configuratorPreviewMode: previewMode,
      previewTierId,
      rewardsPreset: normalizeRewardsPreset(p.rewardsPreset),
      rewardsMembershipFeeEnabled:
        typeof p.rewardsMembershipFeeEnabled === 'boolean' ? p.rewardsMembershipFeeEnabled : undefined,
      rewardsSetupAmount: typeof p.rewardsSetupAmount === 'string' ? p.rewardsSetupAmount : undefined,
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
