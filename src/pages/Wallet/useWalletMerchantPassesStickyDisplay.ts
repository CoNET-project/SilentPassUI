import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'
import type { UserCardInfo } from '@/services/BeamioCard'
import type { MyBrandCardFeedDetailsMap } from '@/utils/myBrandsFeedState'
import { loadMyBrandsFeedLocalCache } from '@/utils/myBrandsFeedLocalCache'
import {
	loadWalletMerchantPassStackOrder,
	mergeWalletMerchantPassStackOrder,
	saveWalletMerchantPassStackOrder,
} from '@/utils/walletMerchantPassStackCache'
import { clearWalletMerchantPassStackDisplayCache } from '@/pages/Wallet/walletMerchantPassDisplayCache'

export type WalletMerchantPassesStickyView = {
	stackCards: UserCardInfo[]
	details: MyBrandCardFeedDetailsMap
	badgeCount: number
	/** 从未有过卡且首轮已结束 */
	showEmpty: boolean
	/** 有卡但详情未齐（仅骨架，不画空白叠卡、不显示空态文案） */
	showSkeleton: boolean
	showStack: boolean
}

function mergeDetailsTrusted(
	prev: MyBrandCardFeedDetailsMap,
	incoming: MyBrandCardFeedDetailsMap,
	cardAddresses: string[]
): MyBrandCardFeedDetailsMap {
	const next: MyBrandCardFeedDetailsMap = { ...prev }
	for (const c of cardAddresses) {
		const k = c.toLowerCase()
		if (incoming[k] !== undefined) next[k] = incoming[k]!
	}
	return next
}

function buildStackCards(
	cards: UserCardInfo[],
	stackOrder: string[]
): UserCardInfo[] {
	const byAddr = new Map(cards.map((c) => [c.cardAddress.toLowerCase(), c]))
	const order =
		stackOrder.length > 0 ? stackOrder : cards.map((c) => c.cardAddress.toLowerCase())
	const out: UserCardInfo[] = []
	for (const addr of order) {
		const c = byAddr.get(addr)
		if (!c) continue
		out.push(c)
		if (out.length >= 3) break
	}
	return out
}

function hasPositivePoints(pointsRaw: unknown): boolean {
	if (pointsRaw == null || String(pointsRaw).trim() === '') return false
	const n = Number(pointsRaw)
	return Number.isFinite(n) && n > 0
}

function hasActivePassNft(nftsRaw: unknown): boolean {
	if (!Array.isArray(nftsRaw)) return false
	return nftsRaw.some((n) => {
		const tokenId = Number((n as { tokenId?: string | number })?.tokenId ?? 0)
		const expired = Boolean((n as { isExpired?: boolean })?.isExpired)
		return tokenId > 0 && !expired
	})
}

function isDisplayableMerchantPass(card: UserCardInfo, details: MyBrandCardFeedDetailsMap): boolean {
	const row = details[card.cardAddress.toLowerCase()]
	// Detail 未就绪时暂时保留，等可信资产详情回来后再决定是否展示。
	if (row === undefined) return true
	if (!row.assets) return false
	return hasPositivePoints(row.assets.points) || hasActivePassNft(row.assets.nfts)
}

/**
 * Wallet Merchant Passes 展示用粘性状态：以 localStorage 与上次可信数据为准，
 * daemon 瞬时空列表 / 未就绪 details 不得触发「No merchant passes yet」或空白叠卡。
 */
export function useWalletMerchantPassesStickyDisplay(
	eoaLower: string,
	liveCards: UserCardInfo[],
	liveDetails: MyBrandCardFeedDetailsMap,
	feedLoading: boolean
): WalletMerchantPassesStickyView {
	const [stickyCards, setStickyCards] = useState<UserCardInfo[]>([])
	const [stickyDetails, setStickyDetails] = useState<MyBrandCardFeedDetailsMap>({})
	const [stackOrder, setStackOrder] = useState<string[]>([])
	const [hasEverHadCards, setHasEverHadCards] = useState(false)
	const [feedSettled, setFeedSettled] = useState(false)
	const lastEoaRef = useRef('')

	useLayoutEffect(() => {
		if (!eoaLower || !ethers.isAddress(eoaLower)) {
			lastEoaRef.current = ''
			setHasEverHadCards(false)
			setFeedSettled(false)
			setStickyCards([])
			setStickyDetails({})
			setStackOrder([])
			clearWalletMerchantPassStackDisplayCache()
			return
		}
		if (lastEoaRef.current !== eoaLower) {
			lastEoaRef.current = eoaLower
			setHasEverHadCards(false)
			setFeedSettled(false)
			clearWalletMerchantPassStackDisplayCache()
		}

		const pinned = loadWalletMerchantPassStackOrder(eoaLower)
		if (pinned?.length) setStackOrder(pinned)

		const brands = loadMyBrandsFeedLocalCache(eoaLower)
		if (brands?.cards?.length) {
			setHasEverHadCards(true)
			setFeedSettled(true)
			setStickyCards(brands.cards)
			setStickyDetails(brands.details)
			const order = pinned?.length
				? mergeWalletMerchantPassStackOrder(pinned, brands.cards.map((c) => c.cardAddress.toLowerCase()))
				: brands.cards.map((c) => c.cardAddress.toLowerCase())
			setStackOrder(order)
			if (!pinned?.length) saveWalletMerchantPassStackOrder(eoaLower, order)
		}
	}, [eoaLower])

	useEffect(() => {
		if (!eoaLower || !ethers.isAddress(eoaLower)) return

		if (liveCards.length > 0) {
			setHasEverHadCards(true)
			setFeedSettled(true)
			setStickyCards(liveCards)
			setStickyDetails((prev) => mergeDetailsTrusted(prev, liveDetails, liveCards.map((c) => c.cardAddress)))
			setStackOrder((prev) => {
				const next = mergeWalletMerchantPassStackOrder(
					prev,
					liveCards.map((c) => c.cardAddress.toLowerCase())
				)
				if (next.join('|') !== prev.join('|')) {
					saveWalletMerchantPassStackOrder(eoaLower, next)
				}
				return next
			})
			return
		}

		if (feedLoading) return

		if (hasEverHadCards) {
			return
		}

		setFeedSettled(true)
		setStickyCards([])
		setStickyDetails({})
	}, [eoaLower, liveCards, liveDetails, feedLoading, hasEverHadCards])

	useEffect(() => {
		if (!feedLoading && eoaLower) {
			setFeedSettled(true)
		}
	}, [feedLoading, eoaLower])

	return useMemo(() => {
		const displayableCards = stickyCards.filter((c) => isDisplayableMerchantPass(c, stickyDetails))
		const stackCards = buildStackCards(displayableCards, stackOrder)
		const allStickyDetailsKnown =
			stickyCards.length > 0 &&
			stickyCards.every((c) => stickyDetails[c.cardAddress.toLowerCase()] !== undefined)
		const detailsReady =
			stackCards.length > 0 &&
			stackCards.every((c) => stickyDetails[c.cardAddress.toLowerCase()] !== undefined)
		/**
		 * 若本地仍记得叠卡顺序，说明该 EOA 曾经有过 Merchant Pass。
		 * 即便本轮 liveCards 瞬时为空，也不能显示 "No merchant passes yet."。
		 */
		const hasRememberedStack = stackOrder.length > 0
		const knownNoPass =
			stickyCards.length > 0 &&
			displayableCards.length === 0 &&
			allStickyDetailsKnown
		const showEmpty =
			knownNoPass ||
			(displayableCards.length === 0 &&
				!hasRememberedStack &&
				feedSettled &&
				!feedLoading &&
				!hasEverHadCards)
		const showSkeleton =
			(displayableCards.length > 0 && !detailsReady) ||
			(displayableCards.length === 0 && hasRememberedStack && stickyCards.length === 0)
		const showStack = detailsReady

		return {
			stackCards,
			details: stickyDetails,
			badgeCount: displayableCards.length,
			showEmpty,
			showSkeleton,
			showStack,
		}
	}, [stickyCards, stickyDetails, stackOrder, feedLoading, feedSettled, hasEverHadCards])
}
