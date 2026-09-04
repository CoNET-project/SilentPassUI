/**
 * Canonical merchant program pass face — aligns Overview sticky Live Card Preview
 * (aspect 408/260, tier gradient/scrim, logo top-left, discount top-right,
 * brand + tier bottom-left, Starting from bottom-right).
 */
import React from 'react'
import { Store } from 'lucide-react'
import { IpfsImg } from '@/components/IpfsImg'
import {
  clampTierLogoDisplayScale,
  tierLogoIconClassForScale,
  tierLogoImgClassForScale,
  type TierLogoDisplayScale,
} from '@/utils/tierLogoDisplayScale'
import {
  cardIssuanceTierGradientTheme,
  cardIssuanceTierRowGradientCss,
  normalizeCardBackgroundImageFit,
  type CardBackgroundImageFit,
} from '@/utils/merchantProgramPassTheme'

function PassBackgroundImage({ src, fit }: { src: string; fit: CardBackgroundImageFit }) {
  const isLocal = src.startsWith('blob:') || src.startsWith('data:')
  const fitWidth = fit === 'width'
  const mediaClass = fitWidth
    ? 'absolute left-0 top-1/2 z-[1] h-auto w-full max-h-none -translate-y-1/2 object-contain'
    : 'absolute left-1/2 top-0 z-[1] h-full w-auto max-w-none -translate-x-1/2 object-contain'
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {fitWidth ? (
        <>
          <div
            className="absolute inset-x-0 top-0 h-1/2 scale-110 bg-cover bg-top bg-no-repeat blur-xl"
            style={{ backgroundImage: `url("${src}")` }}
            aria-hidden
          />
          <div
            className="absolute inset-x-0 bottom-0 h-1/2 scale-110 bg-cover bg-bottom bg-no-repeat blur-xl"
            style={{ backgroundImage: `url("${src}")` }}
            aria-hidden
          />
        </>
      ) : (
        <>
          <div
            className="absolute inset-y-0 left-0 w-1/2 scale-110 bg-cover bg-left bg-no-repeat blur-xl"
            style={{ backgroundImage: `url("${src}")` }}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 right-0 w-1/2 scale-110 bg-cover bg-right bg-no-repeat blur-xl"
            style={{ backgroundImage: `url("${src}")` }}
            aria-hidden
          />
        </>
      )}
      {isLocal ? (
        <img src={src} alt="" className={mediaClass} draggable={false} />
      ) : (
        <IpfsImg key={`${src}:${fit}`} src={src} alt="" className={mediaClass} draggable={false} />
      )}
    </div>
  )
}

export type MerchantProgramPassFaceProps = {
  brandName: string
  tierName: string
  backgroundColor: string
  backgroundImage?: string | null
  backgroundImageFit?: CardBackgroundImageFit | string
  logoSrc?: string | null
  logoDisplayScale?: TierLogoDisplayScale
  /** Whole-number discount percent; 0 / invalid → member pricing label */
  discountPercent?: number | null
  upToLabel: string
  memberPricingLabel: string
  startingFromLabel: string
  /** Amount only after prefix, e.g. `CA$10` or `10` (caller applies moneyPrefix) */
  startingFromAmount: string
  footerSummary?: string | null
  brandNameFontSizePx?: number
  className?: string
  showDiscount?: boolean
}

export function MerchantProgramPassFace({
  brandName,
  tierName,
  backgroundColor,
  backgroundImage,
  backgroundImageFit = 'width',
  logoSrc,
  logoDisplayScale,
  discountPercent,
  upToLabel,
  memberPricingLabel,
  startingFromLabel,
  startingFromAmount,
  footerSummary,
  brandNameFontSizePx = 18,
  className = '',
  showDiscount = true,
}: MerchantProgramPassFaceProps) {
  const theme = cardIssuanceTierGradientTheme(backgroundColor)
  const gradientCss = cardIssuanceTierRowGradientCss(backgroundColor)
  const fit = normalizeCardBackgroundImageFit(backgroundImageFit)
  const hasImage = Boolean(backgroundImage && String(backgroundImage).trim())
  const scale = clampTierLogoDisplayScale(logoDisplayScale)
  const logoImgClass = tierLogoImgClassForScale(scale)
  const logoIconClass = tierLogoIconClassForScale(scale)
  const discountWhole =
    discountPercent != null && Number.isFinite(discountPercent) && discountPercent > 0
      ? Math.floor(discountPercent)
      : 0

  return (
    <div
      className={`relative flex aspect-[408/260] w-full flex-col justify-between overflow-hidden rounded-xl border p-4 sm:rounded-2xl sm:p-5 ${className}`}
      style={{
        color: theme.primary,
        borderColor: theme.cardBorder,
      }}
    >
      {hasImage && backgroundImage ? <PassBackgroundImage src={backgroundImage} fit={fit} /> : null}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: hasImage
            ? 'linear-gradient(165deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.28) 45%, rgba(0,0,0,0.2) 100%)'
            : gradientCss,
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-white/5 backdrop-blur-[1px]" aria-hidden />
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full blur-3xl"
        style={{
          backgroundColor: theme.isDarkStart ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
        }}
        aria-hidden
      />

      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div className="shrink-0">
          {logoImgClass ? (
            logoSrc ? (
              <IpfsImg
                key={logoSrc}
                src={logoSrc}
                alt=""
                className={`object-contain ${logoImgClass}`}
              />
            ) : (
              <Store
                className={logoIconClass ?? undefined}
                strokeWidth={2}
                aria-hidden
                style={{ color: theme.primary }}
              />
            )
          ) : null}
        </div>
        {showDiscount ? (
          <div className="text-right">
            <p className="text-lg font-black leading-tight tracking-tight sm:text-xl">
              {discountWhole > 0 ? `${upToLabel} ${discountWhole}%` : memberPricingLabel}
            </p>
          </div>
        ) : null}
      </div>

      <div className="relative z-[1] flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className="max-w-full truncate whitespace-nowrap font-manrope font-extrabold leading-tight tracking-tight"
            style={{ fontSize: `${brandNameFontSizePx}px` }}
          >
            {brandName}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider">{tierName}</p>
        </div>
        <div className="shrink-0 text-right">
          {startingFromLabel.trim() || startingFromAmount.trim() ? (
            <div
              className="text-[10px] font-bold uppercase tracking-wider opacity-80"
              style={{ color: theme.tertiary }}
            >
              {`${startingFromLabel} ${startingFromAmount}`.trim()}
            </div>
          ) : null}
          {footerSummary ? (
            <p
              className="mt-0.5 font-manrope text-base font-bold leading-tight sm:text-lg"
              style={{ color: theme.tertiary }}
            >
              {footerSummary}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
