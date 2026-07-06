import type { LucideIcon } from 'lucide-react'
import { Flame, Gift, Heart, Landmark, Share2 } from 'lucide-react'
import type {
	CardSocialPromotionEventKey,
	CouponSocialPromotionEventKey,
} from '@/utils/programSocialPromotion'

export type SocialPromotionEventKey = CardSocialPromotionEventKey | CouponSocialPromotionEventKey

/** Icons aligned with Programs overview + wallet activity (Share2 / Heart / Landmark / Gift). */
export function socialPromotionEventIcon(key: SocialPromotionEventKey): LucideIcon {
	switch (key) {
		case 'linkClick':
			return Share2
		case 'like':
			return Heart
		case 'topup':
			return Landmark
		case 'claim':
			return Gift
		case 'burn':
			return Flame
		default:
			return Share2
	}
}

type EventTone = {
	iconConfigured: string
	tabConfigured: string
	tabConfiguredActive: string
	panelConfigured: string
	tabUnset: string
	tabUnsetActive: string
	panelUnset: string
}

const EVENT_TONES: Record<SocialPromotionEventKey, EventTone> = {
	linkClick: {
		iconConfigured: 'text-sky-600',
		tabConfigured:
			'border-sky-200/90 bg-sky-50/95 text-sky-800 hover:border-sky-300',
		tabConfiguredActive: 'border-sky-300 bg-sky-100/95 ring-2 ring-sky-200/80 ring-offset-1',
		panelConfigured: 'border-sky-200/80 bg-sky-50/50',
		tabUnset: 'border-slate-200/90 bg-[#eef1f3]/70 text-slate-500 hover:bg-[#e8ecef]',
		tabUnsetActive: 'border-slate-300 bg-white ring-2 ring-slate-200/80 ring-offset-1',
		panelUnset: 'border-[#e5e9eb] bg-[#eef1f3]/60',
	},
	like: {
		iconConfigured: 'text-rose-600',
		tabConfigured:
			'border-rose-200/90 bg-rose-50/95 text-rose-800 hover:border-rose-300',
		tabConfiguredActive: 'border-rose-300 bg-rose-100/95 ring-2 ring-rose-200/80 ring-offset-1',
		panelConfigured: 'border-rose-200/80 bg-rose-50/50',
		tabUnset: 'border-slate-200/90 bg-[#eef1f3]/70 text-slate-500 hover:bg-[#e8ecef]',
		tabUnsetActive: 'border-slate-300 bg-white ring-2 ring-slate-200/80 ring-offset-1',
		panelUnset: 'border-[#e5e9eb] bg-[#eef1f3]/60',
	},
	topup: {
		iconConfigured: 'text-emerald-600',
		tabConfigured:
			'border-emerald-200/90 bg-emerald-50/95 text-emerald-800 hover:border-emerald-300',
		tabConfiguredActive:
			'border-emerald-300 bg-emerald-100/95 ring-2 ring-emerald-200/80 ring-offset-1',
		panelConfigured: 'border-emerald-200/80 bg-emerald-50/50',
		tabUnset: 'border-slate-200/90 bg-[#eef1f3]/70 text-slate-500 hover:bg-[#e8ecef]',
		tabUnsetActive: 'border-slate-300 bg-white ring-2 ring-slate-200/80 ring-offset-1',
		panelUnset: 'border-[#e5e9eb] bg-[#eef1f3]/60',
	},
	claim: {
		iconConfigured: 'text-fuchsia-600',
		tabConfigured:
			'border-fuchsia-200/90 bg-fuchsia-50/95 text-fuchsia-800 hover:border-fuchsia-300',
		tabConfiguredActive:
			'border-fuchsia-300 bg-fuchsia-100/95 ring-2 ring-fuchsia-200/80 ring-offset-1',
		panelConfigured: 'border-fuchsia-200/80 bg-fuchsia-50/50',
		tabUnset: 'border-slate-200/90 bg-[#eef1f3]/70 text-slate-500 hover:bg-[#e8ecef]',
		tabUnsetActive: 'border-slate-300 bg-white ring-2 ring-slate-200/80 ring-offset-1',
		panelUnset: 'border-[#e5e9eb] bg-[#eef1f3]/60',
	},
	burn: {
		iconConfigured: 'text-amber-700',
		tabConfigured:
			'border-amber-200/90 bg-amber-50/95 text-amber-900 hover:border-amber-300',
		tabConfiguredActive:
			'border-amber-300 bg-amber-100/95 ring-2 ring-amber-200/80 ring-offset-1',
		panelConfigured: 'border-amber-200/80 bg-amber-50/50',
		tabUnset: 'border-slate-200/90 bg-[#eef1f3]/70 text-slate-500 hover:bg-[#e8ecef]',
		tabUnsetActive: 'border-slate-300 bg-white ring-2 ring-slate-200/80 ring-offset-1',
		panelUnset: 'border-[#e5e9eb] bg-[#eef1f3]/60',
	},
}

export function socialPromotionEventTabClassName(
	key: SocialPromotionEventKey,
	configured: boolean,
	active: boolean,
): string {
	const tone = EVENT_TONES[key]
	const base = 'inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition-colors sm:px-3 sm:py-2.5 sm:text-sm'
	if (configured) {
		return `${base} ${active ? tone.tabConfiguredActive : tone.tabConfigured}`
	}
	return `${base} ${active ? tone.tabUnsetActive : tone.tabUnset}`
}

export function socialPromotionEventIconClassName(
	key: SocialPromotionEventKey,
	configured: boolean,
): string {
	const tone = EVENT_TONES[key]
	return configured ? tone.iconConfigured : 'text-slate-400'
}

export function socialPromotionEventPanelClassName(
	key: SocialPromotionEventKey,
	configured: boolean,
): string {
	const tone = EVENT_TONES[key]
	return configured ? tone.panelConfigured : tone.panelUnset
}

export function socialPromotionEventIsConfigured(
	userEnabled: boolean,
	refEnabled: boolean,
): boolean {
	return userEnabled || refEnabled
}
