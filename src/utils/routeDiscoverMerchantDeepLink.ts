import type { NavigateFunction } from 'react-router-dom'
import { stashDiscoverShareReferrer } from '@/utils/discoverShareReferrerStash'
import { bindStashedShareRefereesIfNeeded } from '@/utils/discoverShareClickEvent'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { stripDiscoverMerchantDeepLinkParams } from '@/utils/discoverMerchantShare'

/**
 * Single hand-off for a Discover merchant deep link
 * (`?beamiocard=…[&discover=open][&ref=…]`, also wrapped by `/app-download?target=`).
 *
 * Used by the global search bar paste, the cold-start URL effect, and first-launch
 * onboarding so that all three entries run the same workflow:
 * stash `ref=` → try the referee bind → hide the footer → open the merchant detail
 * page on `/discover` → strip the deep-link params. Visitors without a local wallet
 * first finish onboarding (own @beamioTag + password), then land on that detail page.
 */
export function routeDiscoverMerchantDeepLink(opts: {
	cardAddress: string
	referrerEoa?: string | null
	profile?: { privateKeyArmor?: string | null } | null
	navigate: NavigateFunction
	setShowFooter?: (show: boolean) => void
	replace?: boolean
}): void {
	const referrerEoa = opts.referrerEoa ?? null
	stashDiscoverShareReferrer(opts.cardAddress, referrerEoa)
	const privateKeyArmor = resolveSigningPrivateKeyArmor(opts.profile)
	if (privateKeyArmor) {
		void bindStashedShareRefereesIfNeeded(privateKeyArmor)
	}
	opts.setShowFooter?.(false)
	opts.navigate('/discover', {
		replace: opts.replace,
		state: {
			openDiscoverMerchantCard: opts.cardAddress,
			discoverShareReferrerEoa: referrerEoa,
		},
	})
	stripDiscoverMerchantDeepLinkParams()
}
