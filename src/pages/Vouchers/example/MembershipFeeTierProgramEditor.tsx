/**
 * Programs → Loyalty Logic → Membership Fee tier editor.
 * Chrome aligns with Consumption Points (handle + Promotion badge + circular X).
 * Live Card Preview uses MerchantProgramPassFace (global merchant pass render).
 * Card Style = Color XOR Image (same product model as Basic Info → Card background).
 */
import React, { type Ref, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  AlignVerticalSpaceAround,
  Crown,
  Gem,
  Gift,
  ImagePlus,
  Info,
  Loader2,
  Palette,
  RectangleHorizontal,
  Shield,
  Star,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { MerchantProgramPassFace } from '@/components/programs/MerchantProgramPassFace'
import {
  preventNumericInputStepKeys,
  preventNumericInputWheelStep,
} from '@/utils/numericInputStepKeys'

export type MembershipFeeTierBackgroundMode = 'color' | 'image'
export type MembershipFeeTierBackgroundImageFit = 'width' | 'height'

export function normalizeMembershipFeeTierBackgroundImageFit(
  raw: unknown,
): MembershipFeeTierBackgroundImageFit {
  return raw === 'height' ? 'height' : 'width'
}

export const MEMBERSHIP_FEE_TIER_THEME_PRESETS = [
  { id: 'beamio', hex: '#1562F0', label: 'Beamio' },
  { id: 'obsidian', hex: '#111827', label: 'Obsidian' },
  { id: 'champagne', hex: '#D97706', label: 'Champagne' },
  { id: 'emerald', hex: '#059669', label: 'Emerald' },
] as const

export type MembershipFeeTierEmblem = 'crown' | 'star' | 'gem' | 'shield'

export const MEMBERSHIP_FEE_TIER_EMBLEMS: Array<{
  id: MembershipFeeTierEmblem
  label: string
  Icon: LucideIcon
}> = [
  { id: 'crown', label: 'Crown', Icon: Crown },
  { id: 'star', label: 'Star', Icon: Star },
  { id: 'gem', label: 'Gem', Icon: Gem },
  { id: 'shield', label: 'Shield', Icon: Shield },
]

export type MembershipFeeTierEditorDraft = {
  name: string
  /** Color XOR Image — same as Basic Info Card background. */
  backgroundMode: MembershipFeeTierBackgroundMode
  backgroundColor: string
  /** Tier pass background image (blob preview or IPFS URL). Maps to `TierMetadata.image`. */
  backgroundImage: string
  backgroundImageFit: MembershipFeeTierBackgroundImageFit
  discountPercent: string
  membershipFee: string
  membershipDurationKind: number
  emblem: MembershipFeeTierEmblem
  welcomeGiftEnabled: boolean
  welcomeGiftAmount: string
}

export function normalizeMembershipFeeTierHexColor(raw: string, fallback = '#1562F0'): string {
  const s = raw.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toUpperCase()}`
  if (/^[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`.toUpperCase()
  }
  return fallback
}

type DurationOption = { value: number; label: string }

export type MembershipFeeTierProgramEditorProps = {
  open: boolean
  draft: MembershipFeeTierEditorDraft
  hexDraft: string
  publishing: boolean
  canSave: boolean
  feeLocked: boolean
  validationError: string
  serverError: string
  moneyPrefix: string
  brandName: string
  /** Merchant share / program logo — same source as Overview Live Card Preview */
  brandLogoSrc?: string | null
  /** Base membership (index 0) vs higher Add-tier membership. */
  isBaseTier?: boolean
  /** Render loyalty terminology when editing a non-membership-fee rule. */
  loyaltyMode?: boolean
  /**
   * When false (published charge / top-up base with no membership fee),
   * hide Unlock Fee + Valid for — those fields do not apply.
   */
  showMembershipFeeFields?: boolean
  focusRingClassName?: string
  numericNoSpinnerClass?: string
  durationOptions: DurationOption[]
  feeWheelRef: Ref<HTMLInputElement>
  discountWheelRef: Ref<HTMLInputElement>
  welcomeGiftWheelRef: Ref<HTMLInputElement>
  backgroundImageFileRef: RefObject<HTMLInputElement | null>
  backgroundImageUploading: boolean
  backgroundImageDropActive: boolean
  /** Baseline still had an image — warn when saving as Color. */
  baselineHadBackgroundImage?: boolean
  tu: (key: string, vars?: Record<string, string | number>) => string
  onDraftChange: (patch: Partial<MembershipFeeTierEditorDraft>) => void
  onHexDraftChange: (hexWithoutHash: string) => void
  onBackgroundImageFileChange: React.ChangeEventHandler<HTMLInputElement>
  onBackgroundImageClear: () => void
  onBackgroundImageDragEnter: (e: React.DragEvent) => void
  onBackgroundImageDragOver: (e: React.DragEvent) => void
  onBackgroundImageDragLeave: (e: React.DragEvent) => void
  onBackgroundImageDrop: (e: React.DragEvent) => void
  onClose: () => void
  onSave: () => void
}

export function MembershipFeeTierProgramEditor({
  open,
  draft,
  hexDraft,
  publishing,
  canSave,
  feeLocked,
  validationError,
  serverError,
  moneyPrefix,
  brandName,
  brandLogoSrc = null,
  isBaseTier = true,
  loyaltyMode = false,
  showMembershipFeeFields = true,
  focusRingClassName = '',
  numericNoSpinnerClass = '',
  durationOptions,
  feeWheelRef,
  discountWheelRef,
  welcomeGiftWheelRef,
  backgroundImageFileRef,
  backgroundImageUploading,
  backgroundImageDropActive,
  baselineHadBackgroundImage = false,
  tu,
  onDraftChange,
  onHexDraftChange,
  onBackgroundImageFileChange,
  onBackgroundImageClear,
  onBackgroundImageDragEnter,
  onBackgroundImageDragOver,
  onBackgroundImageDragLeave,
  onBackgroundImageDrop,
  onClose,
  onSave,
}: MembershipFeeTierProgramEditorProps) {
  const themeHex = normalizeMembershipFeeTierHexColor(draft.backgroundColor)
  const styleImage = (draft.backgroundImage ?? '').trim()
  const hasStyleImage = styleImage.length > 0
  const styleMode: MembershipFeeTierBackgroundMode =
    hasStyleImage || draft.backgroundMode === 'image' ? 'image' : 'color'
  const styleImageFit = normalizeMembershipFeeTierBackgroundImageFit(draft.backgroundImageFit)
  const showStyleTabs = !hasStyleImage
  const discountNum = Number(String(draft.discountPercent).replace(/,/g, '').trim())
  const discountPercentWhole =
    Number.isFinite(discountNum) && discountNum > 0 ? Math.floor(discountNum) : 0
  const feeDisplay = String(draft.membershipFee).replace(/,/g, '').trim() || '0'
  const giftDisplay = String(draft.welcomeGiftAmount).replace(/,/g, '').trim() || '0'
  const passBrandName = brandName.trim() || tu('programs_membership_fee_tier_brand_fallback')
  const passTierName =
    draft.name.trim() || tu('programs_membership_fee_tier_name_placeholder')
  const feeNum = Number(feeDisplay)
  const showStartingFrom =
    showMembershipFeeFields && Number.isFinite(feeNum) && feeNum > 0
  const startingFromAmount = showStartingFrom ? `${moneyPrefix}${feeDisplay}` : ''
  const chromeBusy = publishing || backgroundImageUploading

  const applyTheme = (hex: string) => {
    const next = normalizeMembershipFeeTierHexColor(hex)
    onDraftChange({ backgroundMode: 'color', backgroundColor: next })
    onHexDraftChange(next.replace(/^#/, ''))
  }

  const setStyleMode = (mode: MembershipFeeTierBackgroundMode) => {
    if (mode === 'color') {
      onDraftChange({ backgroundMode: 'color' })
      return
    }
    onDraftChange({ backgroundMode: 'image' })
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label={tu('programs_membership_fee_tier_editor_close_aria')}
            className="fixed inset-0 z-[92] bg-[#2c2f31]/35 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            disabled={chromeBusy}
            onClick={() => {
              if (!chromeBusy) onClose()
            }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-membership-fee-tier-editor-title"
            className="fixed inset-x-0 bottom-0 z-[93] mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-[0_-24px_64px_rgba(0,0,0,0.12)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="shrink-0 px-6 pt-6">
              <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-[#d9dde0]" aria-hidden />
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="rounded-full bg-[#0051d1]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#0051d1]">
                    {loyaltyMode
                      ? tu('programs_loyalty_tier_editor_badge')
                      : tu('programs_membership_fee_tier_editor_badge')}
                  </span>
                    <h3
                      id="card-membership-fee-tier-editor-title"
                      className="mt-3 font-manrope text-2xl font-extrabold tracking-tight text-[#2c2f31] sm:text-3xl"
                    >
                      {loyaltyMode
                        ? isBaseTier
                          ? tu('programs_loyalty_tier_editor_title')
                          : tu('programs_loyalty_tier_editor_title_higher')
                        : isBaseTier
                          ? tu('programs_membership_fee_tier_editor_title')
                          : tu('programs_membership_fee_tier_editor_title_higher')}
                    </h3>
                    <p className="mt-3 max-w-lg text-sm leading-relaxed text-[#595c5e]">
                      {loyaltyMode
                        ? isBaseTier
                          ? tu('programs_loyalty_tier_editor_desc')
                          : tu('programs_loyalty_tier_editor_desc_higher')
                        : isBaseTier
                          ? tu('programs_membership_fee_tier_editor_desc')
                          : tu('programs_membership_fee_tier_editor_desc_higher')}
                    </p>
                </div>
                <button
                  type="button"
                  disabled={chromeBusy}
                  onClick={() => {
                    if (!chromeBusy) onClose()
                  }}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef1f3] text-[#595c5e] transition-colors hover:bg-[#dfe3e6] disabled:opacity-50 ${focusRingClassName}`}
                  aria-label={tu('programs_membership_fee_tier_editor_close_aria')}
                >
                  <X className="h-5 w-5" strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <div className="space-y-5">
                {/* Live preview */}
                <section className="space-y-2.5" aria-labelledby="mf-tier-live-preview-label">
                  <div className="flex items-center justify-between px-1">
                    <span
                      id="mf-tier-live-preview-label"
                      className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400"
                    >
                      {tu('programs_membership_fee_tier_live_preview')}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      {tu('programs_membership_fee_tier_simulated_pass')}
                    </span>
                  </div>
                  <MerchantProgramPassFace
                    brandName={passBrandName}
                    tierName={passTierName}
                    backgroundColor={themeHex}
                    backgroundImage={hasStyleImage ? styleImage : null}
                    backgroundImageFit={styleImageFit}
                    logoSrc={brandLogoSrc}
                    discountPercent={discountPercentWhole}
                    upToLabel={tu('programs_overview_up_to')}
                    memberPricingLabel={tu('programs_overview_member_pricing')}
                    startingFromLabel={
                      showStartingFrom ? tu('programs_overview_starting_from_label') : ''
                    }
                    startingFromAmount={startingFromAmount}
                    className="shadow-[0_12px_32px_-4px_rgba(21,98,240,0.28),0_4px_12px_-2px_rgba(0,0,0,0.08)]"
                  />
                  <p className="flex items-center justify-center gap-1.5 px-2 text-center text-[11px] leading-relaxed text-slate-500">
                    <Info className="h-3.5 w-3.5 shrink-0 text-[#1562f0]" strokeWidth={2} aria-hidden />
                    {tu('programs_membership_fee_tier_live_preview_hint')}
                  </p>
                </section>

                {/* Card appearance */}
                <section className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-5">
                  <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#1562f0]">
                      <Palette className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </div>
                    <h3 className="text-sm font-bold tracking-tight text-slate-900">
                      {tu('programs_membership_fee_tier_appearance_title')}
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700" htmlFor="mf-tier-name-input">
                      {tu('programs_membership_fee_tier_name_label')}
                    </label>
                    <input
                      id="mf-tier-name-input"
                      type="text"
                      value={draft.name}
                      disabled={chromeBusy}
                      onChange={(e) => onDraftChange({ name: e.target.value })}
                      placeholder={tu('programs_membership_fee_tier_name_placeholder')}
                      className={`h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-slate-800 outline-none transition-all focus:border-[#1562f0] focus:ring-2 focus:ring-[#1562f0]/25 disabled:opacity-60 ${focusRingClassName}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">
                        {tu('programs_membership_fee_tier_theme_label')}
                      </span>
                      {styleMode === 'color' && !hasStyleImage ? (
                        <span className="font-mono text-[11px] font-medium text-slate-400">
                          HEX {themeHex}
                        </span>
                      ) : null}
                    </div>

                    {showStyleTabs ? (
                      <div
                        className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[#eef1f3] p-1"
                        role="tablist"
                        aria-label={tu('programs_membership_fee_tier_style_type_aria')}
                      >
                        <button
                          type="button"
                          role="tab"
                          aria-selected={styleMode === 'color'}
                          disabled={chromeBusy}
                          onClick={() => setStyleMode('color')}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-bold transition disabled:opacity-60 ${
                            styleMode === 'color'
                              ? 'bg-white text-[#0051d1] shadow-sm'
                              : 'text-[#595c5e] hover:text-[#2c2f31]'
                          } ${focusRingClassName}`}
                        >
                          <Palette className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
                          {tu('programs_membership_fee_tier_style_color')}
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={styleMode === 'image'}
                          disabled={chromeBusy}
                          onClick={() => setStyleMode('image')}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2.5 text-xs font-bold transition disabled:opacity-60 ${
                            styleMode === 'image'
                              ? 'bg-white text-[#0051d1] shadow-sm'
                              : 'text-[#595c5e] hover:text-[#2c2f31]'
                          } ${focusRingClassName}`}
                        >
                          <ImagePlus className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
                          {tu('programs_membership_fee_tier_style_image')}
                        </button>
                      </div>
                    ) : null}

                    <input
                      ref={backgroundImageFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={onBackgroundImageFileChange}
                    />

                    {styleMode === 'color' && !hasStyleImage ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {MEMBERSHIP_FEE_TIER_THEME_PRESETS.map((preset) => {
                            const active =
                              normalizeMembershipFeeTierHexColor(preset.hex) === themeHex
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                disabled={chromeBusy}
                                onClick={() => applyTheme(preset.hex)}
                                className={`flex items-center space-x-2 rounded-xl p-2 text-left transition-all ${
                                  active
                                    ? 'border-2 border-[#1562f0] bg-blue-50/50'
                                    : 'border border-slate-200 bg-white hover:border-slate-300'
                                }`}
                              >
                                <div
                                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] text-white shadow-sm"
                                  style={{ backgroundColor: preset.hex }}
                                >
                                  {active ? '✓' : null}
                                </div>
                                <span
                                  className={`truncate text-xs ${
                                    active ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'
                                  }`}
                                >
                                  {preset.label}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                        <div className="mt-2 flex items-center space-x-2">
                          <div className="relative flex-1">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                              <span className="font-mono text-xs text-slate-400">#</span>
                            </div>
                            <input
                              type="text"
                              maxLength={6}
                              value={hexDraft}
                              disabled={chromeBusy}
                              onChange={(e) => {
                                const next = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
                                onHexDraftChange(next)
                                if (next.length === 3 || next.length === 6) {
                                  onDraftChange({
                                    backgroundMode: 'color',
                                    backgroundColor: normalizeMembershipFeeTierHexColor(next),
                                  })
                                }
                              }}
                              onBlur={() => {
                                const next = normalizeMembershipFeeTierHexColor(hexDraft || themeHex)
                                onDraftChange({ backgroundMode: 'color', backgroundColor: next })
                                onHexDraftChange(next.replace(/^#/, ''))
                              }}
                              className={`h-9 w-full rounded-lg border border-slate-200 pl-7 pr-3 font-mono text-xs font-semibold uppercase text-slate-800 outline-none focus:border-[#1562f0] focus:ring-1 focus:ring-[#1562f0] disabled:opacity-60 ${focusRingClassName}`}
                              aria-label={tu('programs_membership_fee_tier_theme_hex_aria')}
                            />
                          </div>
                          <div
                            className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 shadow-inner"
                            style={{ backgroundColor: themeHex }}
                            aria-hidden
                          />
                        </div>
                        {baselineHadBackgroundImage ? (
                          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            {tu('programs_membership_fee_tier_style_color_clears_image')}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {hasStyleImage ? (
                          <div
                            className={`relative overflow-hidden rounded-2xl border bg-[#f7f8f9] transition ${
                              backgroundImageDropActive
                                ? 'border-[#1562f0] ring-2 ring-[#1562f0]/25'
                                : 'border-[#e8ecf0]'
                            }`}
                            onDragEnter={onBackgroundImageDragEnter}
                            onDragOver={onBackgroundImageDragOver}
                            onDragLeave={onBackgroundImageDragLeave}
                            onDrop={onBackgroundImageDrop}
                          >
                            <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#0f172a]">
                              <MerchantProgramPassFace
                                brandName={passBrandName}
                                tierName={passTierName}
                                backgroundColor={themeHex}
                                backgroundImage={styleImage}
                                backgroundImageFit={styleImageFit}
                                logoSrc={brandLogoSrc}
                                discountPercent={discountPercentWhole}
                                upToLabel={tu('programs_overview_up_to')}
                                memberPricingLabel={tu('programs_overview_member_pricing')}
                                startingFromLabel=""
                                startingFromAmount=""
                                className="!shadow-none h-full w-full rounded-none"
                              />
                            </div>
                            <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5">
                              <button
                                type="button"
                                title={tu('programs_membership_fee_tier_style_fit_width')}
                                aria-label={tu('programs_membership_fee_tier_style_fit_width')}
                                aria-pressed={styleImageFit === 'width'}
                                disabled={chromeBusy}
                                onClick={() =>
                                  onDraftChange({
                                    backgroundMode: 'image',
                                    backgroundImageFit: 'width',
                                  })
                                }
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md ring-1 backdrop-blur-[2px] transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  styleImageFit === 'width'
                                    ? 'bg-[#0051d1]/90 ring-white/50'
                                    : 'bg-[#2c2f31]/45 ring-white/35 hover:bg-[#2c2f31]/60'
                                } ${focusRingClassName}`}
                              >
                                <RectangleHorizontal className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                              </button>
                              <button
                                type="button"
                                title={tu('programs_membership_fee_tier_style_fit_height')}
                                aria-label={tu('programs_membership_fee_tier_style_fit_height')}
                                aria-pressed={styleImageFit === 'height'}
                                disabled={chromeBusy}
                                onClick={() =>
                                  onDraftChange({
                                    backgroundMode: 'image',
                                    backgroundImageFit: 'height',
                                  })
                                }
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md ring-1 backdrop-blur-[2px] transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  styleImageFit === 'height'
                                    ? 'bg-[#0051d1]/90 ring-white/50'
                                    : 'bg-[#2c2f31]/45 ring-white/35 hover:bg-[#2c2f31]/60'
                                } ${focusRingClassName}`}
                              >
                                <AlignVerticalSpaceAround
                                  className="h-3.5 w-3.5"
                                  strokeWidth={2.25}
                                  aria-hidden
                                />
                              </button>
                            </div>
                            <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => backgroundImageFileRef.current?.click()}
                                disabled={backgroundImageUploading}
                                aria-busy={backgroundImageUploading}
                                aria-label={
                                  backgroundImageUploading
                                    ? tu('programs_membership_fee_tier_style_preparing')
                                    : tu('programs_membership_fee_tier_style_replace')
                                }
                                className={`flex h-8 w-8 items-center justify-center rounded-full bg-[#2c2f31]/45 text-white shadow-md ring-1 ring-white/35 backdrop-blur-[2px] transition hover:bg-[#2c2f31]/60 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClassName}`}
                              >
                                {backgroundImageUploading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden />
                                ) : (
                                  <ImagePlus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={onBackgroundImageClear}
                                disabled={chromeBusy}
                                aria-label={tu('programs_membership_fee_tier_style_remove')}
                                className={`flex h-8 w-8 items-center justify-center rounded-full bg-[#2c2f31]/45 text-white shadow-md ring-1 ring-white/35 backdrop-blur-[2px] transition hover:bg-red-600/80 disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClassName}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={chromeBusy}
                            onClick={() => backgroundImageFileRef.current?.click()}
                            onDragEnter={onBackgroundImageDragEnter}
                            onDragOver={onBackgroundImageDragOver}
                            onDragLeave={onBackgroundImageDragLeave}
                            onDrop={onBackgroundImageDrop}
                            className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition disabled:opacity-60 ${
                              backgroundImageDropActive
                                ? 'border-[#1562f0] bg-blue-50/60 ring-2 ring-[#1562f0]/20'
                                : 'border-slate-300 bg-[#f7f8f9] hover:border-slate-400'
                            } ${focusRingClassName}`}
                          >
                            {backgroundImageUploading ? (
                              <Loader2
                                className="h-6 w-6 animate-spin text-[#1562f0]"
                                strokeWidth={2}
                                aria-hidden
                              />
                            ) : (
                              <ImagePlus className="h-6 w-6 text-[#1562f0]" strokeWidth={2} aria-hidden />
                            )}
                            <span className="text-sm font-bold text-slate-800">
                              {tu('programs_membership_fee_tier_style_upload_title')}
                            </span>
                            <span className="max-w-xs text-[11px] leading-snug text-slate-500">
                              {tu('programs_membership_fee_tier_style_upload_hint')}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5 pt-1">
                    <label className="text-xs font-semibold text-slate-700">
                      {tu('programs_membership_fee_tier_emblem_label')}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {MEMBERSHIP_FEE_TIER_EMBLEMS.map(({ id, label, Icon }) => {
                        const active = draft.emblem === id
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={publishing}
                            onClick={() => onDraftChange({ emblem: id })}
                            className={`flex h-11 items-center justify-center space-x-1 rounded-xl text-sm transition ${
                              active
                                ? 'border-2 border-[#1562f0] bg-blue-50/60 font-semibold text-[#1562f0] shadow-sm'
                                : 'border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                            <span className="text-xs">{label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </section>

                {/* Tier rules */}
                <section className="space-y-5 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:p-5">
                  <div className="flex items-center space-x-2.5 border-b border-slate-100 pb-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <Gift className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight text-slate-900">
                        {tu('programs_membership_fee_tier_rules_title')}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {tu('programs_membership_fee_tier_rules_subtitle')}
                      </p>
                    </div>
                  </div>

                  {showMembershipFeeFields ? (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-1">
                          <label
                            className="text-xs font-bold text-slate-800"
                            htmlFor="mf-tier-unlock-fee"
                          >
                            {tu('programs_membership_fee_tier_unlock_fee_label')}
                          </label>
                          {feeLocked ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              {tu('programs_membership_fee_tier_locked')}
                            </span>
                          ) : null}
                        </div>
                        <div
                          className={`relative rounded-xl border bg-slate-50/50 transition-all ${
                            feeLocked
                              ? 'border-slate-200 opacity-80'
                              : 'border-slate-200 focus-within:border-[#1562f0] focus-within:ring-2 focus-within:ring-[#1562f0]/20'
                          }`}
                        >
                          <div className="flex items-center px-3.5 py-2.5">
                            <span className="mr-2 text-base font-extrabold text-slate-500">
                              {moneyPrefix}
                            </span>
                            <input
                              id="mf-tier-unlock-fee"
                              ref={feeWheelRef}
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              value={draft.membershipFee}
                              disabled={publishing || feeLocked}
                              onChange={(e) => onDraftChange({ membershipFee: e.target.value })}
                              onKeyDown={preventNumericInputStepKeys}
                              onKeyDownCapture={preventNumericInputStepKeys}
                              onWheel={preventNumericInputWheelStep}
                              className={`w-full border-0 bg-transparent p-0 text-xl font-black tracking-tight text-slate-900 outline-none focus:ring-0 disabled:cursor-not-allowed ${numericNoSpinnerClass}`}
                            />
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              {tu('programs_membership_fee_tier_one_time')}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] leading-normal text-slate-500">
                          {tu('programs_membership_fee_tier_unlock_fee_hint')}
                        </p>
                      </div>

                      <div className="space-y-2 border-t border-slate-100 pt-2">
                        <label
                          className="text-xs font-bold text-slate-800"
                          htmlFor="mf-tier-valid-for"
                        >
                          {tu('programs_membership_fee_tier_valid_for_label')}
                        </label>
                        <select
                          id="mf-tier-valid-for"
                          value={draft.membershipDurationKind || 3}
                          disabled={publishing || feeLocked}
                          onChange={(e) =>
                            onDraftChange({ membershipDurationKind: Number(e.target.value) || 3 })
                          }
                          className={`h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-900 outline-none focus:border-[#1562f0] focus:ring-2 focus:ring-[#1562f0]/20 disabled:cursor-not-allowed disabled:opacity-70 ${focusRingClassName}`}
                        >
                          {durationOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-500">
                          {tu('programs_membership_fee_tier_valid_for_hint')}
                        </p>
                      </div>
                    </>
                  ) : null}

                  <div
                    className={`space-y-2 ${
                      showMembershipFeeFields ? 'border-t border-slate-100 pt-2' : ''
                    }`}
                  >
                    <label className="text-xs font-bold text-slate-800" htmlFor="mf-tier-discount">
                      {tu('programs_membership_fee_tier_discount_label')}
                    </label>
                    <div className="flex items-center space-x-2">
                      <div className="relative flex-1">
                        <input
                          id="mf-tier-discount"
                          ref={discountWheelRef}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={90}
                          step={1}
                          value={draft.discountPercent}
                          disabled={publishing}
                          onChange={(e) => onDraftChange({ discountPercent: e.target.value })}
                          onKeyDown={preventNumericInputStepKeys}
                          onKeyDownCapture={preventNumericInputStepKeys}
                          onWheel={preventNumericInputWheelStep}
                          className={`h-11 w-full rounded-xl border border-slate-200 px-3.5 pr-8 text-base font-bold text-slate-900 outline-none focus:border-[#1562f0] focus:ring-2 focus:ring-[#1562f0]/25 disabled:opacity-60 ${numericNoSpinnerClass} ${focusRingClassName}`}
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-sm font-bold text-slate-400">
                          %
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        {[5, 10, 15].map((n) => {
                          const active = String(draft.discountPercent).replace(/,/g, '').trim() === String(n)
                          return (
                            <button
                              key={n}
                              type="button"
                              disabled={publishing}
                              onClick={() => onDraftChange({ discountPercent: String(n) })}
                              className={`h-11 px-3 rounded-xl text-xs transition ${
                                active
                                  ? 'border-2 border-[#1562f0] bg-blue-50 font-extrabold text-[#1562f0]'
                                  : 'border border-slate-200 font-medium text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {n}%
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {tu('programs_membership_fee_tier_discount_hint')}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Gift className="h-5 w-5 text-[#1562f0]" strokeWidth={2} aria-hidden />
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              {tu('programs_membership_fee_tier_welcome_gift_title')}
                            </p>
                            <p className="text-[10px] font-semibold text-emerald-600">
                              {tu('programs_membership_fee_tier_welcome_gift_subtitle')}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={draft.welcomeGiftEnabled}
                          aria-label={tu('programs_membership_fee_tier_welcome_gift_title')}
                          disabled={publishing}
                          onClick={() =>
                            onDraftChange({ welcomeGiftEnabled: !draft.welcomeGiftEnabled })
                          }
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            draft.welcomeGiftEnabled ? 'bg-[#1562f0]' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              draft.welcomeGiftEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                      {draft.welcomeGiftEnabled ? (
                        <>
                          <div className="mt-1 flex items-center justify-between border-t border-slate-200/60 pt-2 text-xs">
                            <span className="font-medium text-slate-600">
                              {tu('programs_membership_fee_tier_welcome_gift_amount')}
                            </span>
                            <div className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5">
                              <span className="font-bold text-slate-500">{moneyPrefix}</span>
                              <input
                                ref={welcomeGiftWheelRef}
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={draft.welcomeGiftAmount}
                                disabled={publishing}
                                onChange={(e) => onDraftChange({ welcomeGiftAmount: e.target.value })}
                                onKeyDown={preventNumericInputStepKeys}
                                onKeyDownCapture={preventNumericInputStepKeys}
                                onWheel={preventNumericInputWheelStep}
                                className={`w-16 border-0 bg-transparent p-0 text-right text-xs font-bold text-slate-900 outline-none focus:ring-0 ${numericNoSpinnerClass}`}
                                aria-label={tu('programs_membership_fee_tier_welcome_gift_amount')}
                              />
                            </div>
                          </div>
                          <p className="text-[11px] leading-snug text-slate-500">
                            {tu('programs_membership_fee_tier_welcome_gift_hint', {
                              amount: `${moneyPrefix}${giftDisplay}`,
                            })}
                          </p>
                          <p className="text-[10px] italic text-slate-400">
                            {tu('programs_membership_fee_tier_welcome_gift_preview_only')}
                          </p>
                        </>
                      ) : null}
                    </div>
                  </div>
                </section>

                <div className="flex items-start space-x-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#1562f0]" strokeWidth={2} aria-hidden />
                  <p className="text-[11px] leading-tight text-slate-600">
                    <span className="font-bold text-slate-800">
                      {tu('programs_membership_fee_tier_settlement_title')}
                    </span>{' '}
                    {tu('programs_membership_fee_tier_settlement_body')}
                  </p>
                </div>

                {(validationError || serverError) && !publishing ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    <p>{validationError || serverError}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200/80 bg-white/95 px-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-md">
              <button
                type="button"
                onClick={() => void onSave()}
                disabled={!canSave}
                aria-busy={publishing}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1562f0] text-sm font-bold text-white shadow-lg shadow-[#1562f0]/25 transition active:scale-[0.985] hover:bg-[#0F4FC2] disabled:cursor-not-allowed disabled:opacity-60 ${focusRingClassName}`}
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} aria-hidden />
                ) : null}
                <span>
                  {publishing
                    ? tu('programs_membership_fee_tier_saving')
                    : tu('programs_membership_fee_tier_save')}
                </span>
              </button>
              <div className="mt-2 flex items-center justify-center space-x-1.5 text-center text-[10px] font-semibold tracking-tight text-slate-400">
                <span>{tu('programs_membership_fee_tier_footer_non_custodial')}</span>
                <span>•</span>
                <span>{tu('programs_membership_fee_tier_footer_chain')}</span>
                <span>•</span>
                <span className="text-slate-500">{tu('programs_membership_fee_tier_footer_no_cut')}</span>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}
