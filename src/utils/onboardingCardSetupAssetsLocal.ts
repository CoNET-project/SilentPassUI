/**
 * Card Setup brand assets prepared after the merchant picks a lookup result.
 * Independent session key so a late AI response is not wiped when onboarding
 * session merges into the EOA business-profile draft.
 */

import {
	loadBusinessProfileDraftForEoa,
	patchBusinessProfileDraftForEoa,
} from '@/utils/verraBusinessProfileLocal'
import {
	loadCardConfiguratorDraftForEoa,
	patchCardConfiguratorDraftForEoa,
} from '@/utils/cardConfiguratorDraftLocal'

export const ONBOARDING_CARD_SETUP_SESSION_KEY = 'verra_onboarding_card_setup_v1'
export const ONBOARDING_CARD_SETUP_EVENT = 'verra-onboarding-card-setup'

export type OnboardingCardSetupAssets = {
	logoUrl: string
	backgroundUrl: string
	brandColor: string
	discoverCopy: string
}

function trimAsset(raw: unknown): string {
	return typeof raw === 'string' ? raw.trim() : ''
}

export function normalizeOnboardingCardSetupAssets(
	raw: unknown,
): OnboardingCardSetupAssets | null {
	if (!raw || typeof raw !== 'object') return null
	const o = raw as Record<string, unknown>
	const assets: OnboardingCardSetupAssets = {
		logoUrl: trimAsset(o.logoUrl),
		backgroundUrl: trimAsset(o.backgroundUrl),
		brandColor: trimAsset(o.brandColor),
		discoverCopy: trimAsset(o.discoverCopy),
	}
	if (!assets.logoUrl && !assets.backgroundUrl && !assets.brandColor && !assets.discoverCopy) {
		return null
	}
	return assets
}

/** Latest pick always overwrites this key. */
export function persistOnboardingCardSetupAssets(assets: OnboardingCardSetupAssets): void {
	try {
		sessionStorage.setItem(ONBOARDING_CARD_SETUP_SESSION_KEY, JSON.stringify(assets))
	} catch {
		/* quota */
	}
}

export function loadOnboardingCardSetupAssets(): OnboardingCardSetupAssets | null {
	try {
		const raw = sessionStorage.getItem(ONBOARDING_CARD_SETUP_SESSION_KEY)
		if (!raw) return null
		return normalizeOnboardingCardSetupAssets(JSON.parse(raw) as unknown)
	} catch {
		return null
	}
}

/** Latest pick, including an all-empty successful prepare. `null` = never prepared. */
export function loadOnboardingCardSetupAssetsRecord(): OnboardingCardSetupAssets | null {
	try {
		const raw = sessionStorage.getItem(ONBOARDING_CARD_SETUP_SESSION_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as unknown
		if (!parsed || typeof parsed !== 'object') return null
		const o = parsed as Record<string, unknown>
		return {
			logoUrl: trimAsset(o.logoUrl),
			backgroundUrl: trimAsset(o.backgroundUrl),
			brandColor: trimAsset(o.brandColor),
			discoverCopy: trimAsset(o.discoverCopy),
		}
	} catch {
		return null
	}
}

export function clearOnboardingCardSetupAssets(): void {
	try {
		sessionStorage.removeItem(ONBOARDING_CARD_SETUP_SESSION_KEY)
	} catch {
		/* */
	}
}

export function dispatchOnboardingCardSetupReady(): void {
	if (typeof window === 'undefined') return
	window.dispatchEvent(new CustomEvent(ONBOARDING_CARD_SETUP_EVENT))
}

export function pickEmptyOnly(current: string, incoming: string): string {
	const c = current.trim()
	if (c) return c
	return incoming.trim()
}

export function applyOnboardingCardSetupAssetsToEoa(
	eoa: string,
	assets: OnboardingCardSetupAssets,
): void {
	const key = eoa.trim()
	if (!key) return
	const prev = loadBusinessProfileDraftForEoa(key) ?? {}
	patchBusinessProfileDraftForEoa(key, {
		logoUrl: pickEmptyOnly(prev.logoUrl ?? '', assets.logoUrl),
		merchantImageUrl: pickEmptyOnly(prev.merchantImageUrl ?? '', assets.backgroundUrl),
		brandHex: pickEmptyOnly(prev.brandHex ?? '', assets.brandColor),
		publicBio: pickEmptyOnly(prev.publicBio ?? '', assets.discoverCopy),
	})
	const cfg = loadCardConfiguratorDraftForEoa(key)
	patchCardConfiguratorDraftForEoa(key, {
		shareImageUrl: pickEmptyOnly(cfg?.shareImageUrl ?? '', assets.logoUrl),
		merchantImageUrl: pickEmptyOnly(cfg?.merchantImageUrl ?? '', assets.backgroundUrl),
		brandColor: pickEmptyOnly(cfg?.brandColor ?? '', assets.brandColor),
		description: pickEmptyOnly(cfg?.description ?? '', assets.discoverCopy),
	})
}
