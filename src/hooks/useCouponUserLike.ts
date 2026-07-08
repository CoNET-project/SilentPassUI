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
	fetchCouponLikeCount,
	invalidateCouponLikeCountCache,
	invalidateDiscoverUserLikeBalanceCache,
	readDiscoverUserLikedLocalSeed,
	resolveDiscoverUserHasLiked,
} from '@/utils/discoverUserLike'
import { saveDiscoverUserLikeLocalCache } from '@/utils/discoverUserLikeLocalCache'

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
	const referrerEoa = useMemo(() => {
		if (referrerEoaProp !== undefined) return referrerEoaProp
		const stateRef = (location.state as { discoverShareReferrerEoa?: string | null } | null)
			?.discoverShareReferrerEoa
		return resolveDiscoverShareReferrerEoa({ stateReferrer: stateRef ?? null })
	}, [referrerEoaProp, location.state])

	const [userLiked, setUserLiked] = useState<boolean | null>(null)
	const [likeLoading, setLikeLoading] = useState(false)
	const [likeCount, setLikeCount] = useState<number | null>(null)

	const resolveUserEoa = useCallback((): string | null => {
		const privateKeyArmor = getPrivateKeyArmor?.()?.trim() ?? ''
		if (!privateKeyArmor) return null
		try {
			return ethers.getAddress(new ethers.Wallet(privateKeyArmor).address)
		} catch {
			return null
		}
	}, [getPrivateKeyArmor])

	const refreshLikeCount = useCallback(async () => {
		if (!enabled || !cardAddress || !tokenId) return
		const count = await fetchCouponLikeCount(cardAddress, tokenId)
		if (count != null) setLikeCount(count)
	}, [enabled, cardAddress, tokenId])

	useEffect(() => {
		if (!enabled || !cardAddress?.trim() || !tokenId?.trim()) {
			setUserLiked(null)
			setLikeCount(null)
			return
		}
		let cancelled = false
		void refreshLikeCount()
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
	}, [enabled, cardAddress, tokenId, resolveUserEoa, refreshLikeCount])

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
			await refreshLikeCount()
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
		refreshLikeCount,
		referrerEoa,
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
		onHeartClick,
	}
}
