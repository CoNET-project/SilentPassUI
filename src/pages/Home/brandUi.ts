/**
 * bizSite Home / onboarding — brand tokens aligned with Merchant OS `biz.tsx`.
 */
export const BIZ_BRAND_HEX = '#1562f0'

/** `public/logo512.png` — use for headers / QR center; honors CRA `homepage` (`PUBLIC_URL`, e.g. `/biz`). */
export const BIZ_PUBLIC_LOGO512 = `${process.env.PUBLIC_URL ?? ''}/logo512.png`

/** Keyboard-visible focus ring on light backgrounds */
export const bizBrandFocusRingClass =
	'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white'

/** Primary filled CTA (Merchant login, solid actions) */
export const bizBrandPrimarySolidClass =
	'bg-[#1562f0] text-white hover:bg-[#2b74f5] active:bg-[#0d4ec4] shadow-[0_14px_32px_rgba(21,98,240,0.38)] active:shadow-[0_10px_24px_rgba(21,98,240,0.28)]'

/** Onboarding AppButton-style primary (full rounded) */
export const bizBrandOnboardingPrimaryBtnClass =
	'bg-[#1562f0] text-white hover:bg-[#2b74f5] active:bg-[#0d4ec4] shadow-[0_12px_30px_rgba(21,98,240,0.3)]'

/** Error / invalid field: keep orange border; keyboard ring stays visible */
export const bizBrandInvalidFieldRingClass =
	'border-orange-200 ring-4 ring-orange-50 focus:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white'
