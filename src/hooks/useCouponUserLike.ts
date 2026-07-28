import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { ethers } from 'ethers'
import { Toast } from 'antd-mobile'
import { postCardRecordUserLikeWithCurrentWallet } from '@/services/BeamioCard'
import { checkStorage } from '@/services/beamio'
import { tu } from '@/locale/beamioLocale'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { resolveDiscoverShareReferrerEoa } from '@/utils/beamioDeepLinkParams'
import {
	DISCOVER_USER_LIKE_TARGET,
	invalidateCouponLikeCountCache,
	invalidateDiscoverUserLikeBalanceCache,
	readDiscoverUserLikedLocalSeed,
	resolveDiscoverUserHasLiked,
} from '@/utils/discoverUserLike'
import { saveDiscoverUserLikeLocalCache } from '@/utils/discoverUserLikeLocalCache'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { pickCouponSocialStatFromMap } from '@/utils/couponSocialStatsLocalCache'

export type UseCouponUserLikeOptions = {
	cardAddress: string
	tokenId: string
	enabled?: boolean
	/** Sharer EOA from share URL `ref=`; falls back to URL + router state when omitted. */
	referrerEoa?: string | null
	getPrivateKeyArmor?: () => string | undefined
	onWalletUnlock?: () => void
}

export function useCouponUserLike({
	cardAddress,
	tokenId,
	enabled = true,
	referrerEoa: referrerEoaProp,
	getPrivateKeyArmor,
	onWalletUnlock,
}: UseCouponUserLikeOptions) {
	const location = useLocation()
	const {
		couponSocialStatByKey,
		registerCouponSocialFeedTargets,
		applyCouponSocialLikeCountDelta,
	} = useDaemonContext()

	const referrerEoa = useMemo(() => {
		if (referrerEoaProp !== undefined) return referrerEoaProp
		const stateRef = (location.state as { discoverShareReferrerEoa?: string | null } | null)
			?.discoverShareReferrerEoa
		return resolveDiscoverShareReferrerEoa({ stateReferrer: stateRef ?? null })
	}, [referrerEoaProp, location.state])

	const [userLiked, setUserLiked] = useState<boolean | null>(null)
	const [likeLoading, setLikeLoading] = useState(false)

	const daemonStat = useMemo(
		() =>
			enabled
				? pickCouponSocialStatFromMap(couponSocialStatByKey, cardAddress, tokenId)
				: null,
		[enabled, couponSocialStatByKey, cardAddress, tokenId],
	)
	const likeCount =
		typeof daemonStat?.likeCount === 'number' && Number.isFinite(daemonStat.likeCount)
			? Math.trunc(daemonStat.likeCount)
			: null
	const shareClickCount =
		typeof daemonStat?.shareClickCount === 'number' && Number.isFinite(daemonStat.shareClickCount)
			? Math.trunc(daemonStat.shareClickCount)
			: null

	const resolveUserEoa = useCallback((): string | null => {
		const privateKeyArmor = getPrivateKeyArmor?.()?.trim() ?? ''
		if (!privateKeyArmor) return null
		try {
			return ethers.getAddress(new ethers.Wallet(privateKeyArmor).address)
		} catch {
			return null
		}
	}, [getPrivateKeyArmor])

	useEffect(() => {
		if (!enabled || !cardAddress?.trim() || !tokenId?.trim()) return
		registerCouponSocialFeedTargets([
			{ cardAddress: cardAddress.trim(), tokenId: tokenId.trim() },
		])
	}, [enabled, cardAddress, tokenId, registerCouponSocialFeedTargets])

	useEffect(() => {
		if (!enabled || !cardAddress?.trim() || !tokenId?.trim()) {
			setUserLiked(null)
			return
		}
		let cancelled = false
		const eoa = resolveUserEoa()
		if (eoa) {
			void resolveDiscoverUserHasLiked(
				cardAddress,
				eoa,
				DISCOVER_USER_LIKE_TARGET.ISSUED_COUPON,
				tokenId,
			).then((liked) => {
				if (cancelled) return
				if (liked != null) {
					setUserLiked(liked)
					return
				}
				const localSeed = readDiscoverUserLikedLocalSeed(
					eoa,
					cardAddress,
					DISCOVER_USER_LIKE_TARGET.ISSUED_COUPON,
					tokenId,
				)
				if (localSeed != null) setUserLiked(localSeed)
			})
		} else {
			setUserLiked(null)
		}
		return () => {
			cancelled = true
		}
	}, [enabled, cardAddress, tokenId, resolveUserEoa])

	const submitLike = useCallback(async () => {
		if (!enabled || likeLoading || !cardAddress?.trim() || !tokenId?.trim()) return
		let privateKeyArmor = getPrivateKeyArmor?.()?.trim() ?? ''
		if (!privateKeyArmor) {
			const stored = await checkStorage()
			if (stored?.profiles?.length) {
				privateKeyArmor = resolveSigningPrivateKeyArmor(stored.profiles[0]) ?? ''
			}
		}
		if (!privateKeyArmor) {
			Toast.show({
				content: tu('unlock_your_wallet_with_your_access_password_to_claim_coupons'),
				position: 'top',
			})
			onWalletUnlock?.()
			return
		}
		setLikeLoading(true)
		try {
			const cardNorm = ethers.getAddress(cardAddress)
			const ret = await postCardRecordUserLikeWithCurrentWallet({
				cardAddress: cardNorm,
				privateKeyArmor,
				liked: true,
				targetKind: DISCOVER_USER_LIKE_TARGET.ISSUED_COUPON,
				issuedParentId: tokenId,
				referrerEoa,
			})
			if (!ret.success) {
				Toast.show({ content: ret.error ?? 'Like update failed', position: 'top' })
				return
			}
			const eoa = resolveUserEoa()
			if (eoa) {
				saveDiscoverUserLikeLocalCache(
					eoa,
					cardNorm,
					DISCOVER_USER_LIKE_TARGET.ISSUED_COUPON,
					tokenId,
					true,
				)
				invalidateDiscoverUserLikeBalanceCache(
					eoa,
					cardNorm,
					DISCOVER_USER_LIKE_TARGET.ISSUED_COUPON,
					tokenId,
				)
			}
			setUserLiked(true)
			invalidateCouponLikeCountCache(cardNorm, tokenId)
			applyCouponSocialLikeCountDelta(cardNorm, tokenId, 1)
			Toast.show({ content: 'Liked', position: 'top' })
		} finally {
			setLikeLoading(false)
		}
	}, [
		enabled,
		likeLoading,
		cardAddress,
		tokenId,
		getPrivateKeyArmor,
		onWalletUnlock,
		resolveUserEoa,
		referrerEoa,
		applyCouponSocialLikeCountDelta,
	])

	const onHeartClick = useCallback(
		(e?: MouseEvent) => {
			e?.stopPropagation()
			if (likeLoading || userLiked) return
			void submitLike()
		},
		[likeLoading, userLiked, submitLike],
	)

	return {
		userLiked,
		likeLoading,
		likeCount,
		shareClickCount,
		onHeartClick,
	}
}
