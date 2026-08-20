import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'
import { filterDisplayUserCards, type UserCardInfo } from '@/services/BeamioCard'
import type { MyBrandCardFeedDetailsMap } from '@/utils/myBrandsFeedState'
import { loadMyBrandsFeedLocalCache } from '@/utils/myBrandsFeedLocalCache'
import {
	filterExcludedCardAddresses,
	filterExcludedCardDetailKeys,
	loadApiExcludedUserCards,
} from '@/utils/apiExcludedUserCards'
import {
	loadWalletMerchantPassStackOrder,
	mergeWalletMerchantPassStackOrder,
	saveWalletMerchantPassStackOrder,
} from '@/utils/walletMerchantPassStackCache'
import { clearWalletMerchantPassStackDisplayCache } from '@/pages/Wallet/walletMerchantPassDisplayCache'
import { recentActivityMerchantProgramCardAddress } from '@/pages/History/recentActivityIndexerMerge'
import type { TxView } from '@/pages/History/recentActivityIndexerMerge'

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
		const inc = incoming[k]
		if (inc === undefined) continue
		const prevRow = prev[k]
		// 不可信/未就绪的 assets:null 不得覆盖上次可信持仓，避免叠卡被误隐藏。
		if (prevRow?.assets != null && inc.assets == null) {
			next[k] = { ...inc, assets: prevRow.assets }
			continue
		}
		next[k] = inc
	}
	return next
}

function buildStackCards(
	cards: UserCardInfo[],
	stackOrder: string[],
	latestEventMsByCard: ReadonlyMap<string, number>
): UserCardInfo[] {
	const stackRank = new Map(stackOrder.map((address, index) => [address, index]))
	return [...cards]
		.sort((a, b) => {
			const eventDelta =
				(latestEventMsByCard.get(b.cardAddress.toLowerCase()) ?? 0) -
				(latestEventMsByCard.get(a.cardAddress.toLowerCase()) ?? 0)
			if (eventDelta !== 0) return eventDelta
			return (stackRank.get(a.cardAddress.toLowerCase()) ?? Number.MAX_SAFE_INTEGER) -
				(stackRank.get(b.cardAddress.toLowerCase()) ?? Number.MAX_SAFE_INTEGER)
		})
		.slice(0, 5)
}

function hasPositivePoints(pointsRaw: unknown): boolean {
	if (pointsRaw == null || String(pointsRaw).trim() === '') return false
	const n = Number(pointsRaw)
	return Number.isFinite(n) && n > 0
}

function hasPositiveChargeRewardPoints(raw: unknown): boolean {
	if (raw == null || String(raw).trim() === '') return false
	const n = Number(raw)
	return Number.isFinite(n) && n > 0
}

/** 任意 tokenId > 0 的 ERC-1155 持仓（含已过期会员 NFT / issued coupon）。 */
function hasAnyMerchantNftHolding(nftsRaw: unknown): boolean {
	if (!Array.isArray(nftsRaw)) return false
	return nftsRaw.some((n) => {
		const tokenId = Number((n as { tokenId?: string | number })?.tokenId ?? 0)
		return tokenId > 0
	})
}

function myBrandRowHasMerchantHoldings(row: MyBrandCardFeedDetailsMap[string]): boolean {
	if (hasPositivePoints(row.assets?.points)) return true
	if (hasPositiveChargeRewardPoints(row.assets?.chargeRewardPoints)) return true
	if (hasPositiveChargeRewardPoints(row.assets?.socialRewardPoints)) return true
	if (hasAnyMerchantNftHolding(row.assets?.nfts)) return true
	if ((row.claimableCoupons?.count ?? 0) > 0) return true
	if ((row.ownedCatalogs?.count ?? 0) > 0) return true
	return false
}

function isDisplayableMerchantPass(card: UserCardInfo, details: MyBrandCardFeedDetailsMap): boolean {
	const row = details[card.cardAddress.toLowerCase()]
	// Detail 未就绪时暂时保留，等可信资产详情回来后再决定是否展示。
	if (row === undefined) return true
	if (row.assets == null) return true
	return myBrandRowHasMerchantHoldings(row)
}

/**
 * Wallet Merchant Passes 展示用粘性状态：以 localStorage 与上次可信数据为准，
 * daemon 瞬时空列表 / 未就绪 details 不得触发「No merchant passes yet」或空白叠卡。
 */
export function useWalletMerchantPassesStickyDisplay(
	eoaLower: string,
	liveCards: UserCardInfo[],
	liveDetails: MyBrandCardFeedDetailsMap,
	feedLoading: boolean,
	recentActivityItems: TxView[],
	recentActivitySettled: boolean,
	recentActivityLoading: boolean
): WalletMerchantPassesStickyView {
	const [stickyCards, setStickyCards] = useState<UserCardInfo[]>([])
	const [stickyDetails, setStickyDetails] = useState<MyBrandCardFeedDetailsMap>({})
	const [stackOrder, setStackOrder] = useState<string[]>([])
	const [hasEverHadCards, setHasEverHadCards] = useState(false)
	const [feedSettled, setFeedSettled] = useState(false)
	const lastEoaRef = useRef('')

	/** 黑名单加载后重滤 sticky / stackOrder（本地缓存可能在 exclude 就绪前 hydrate）。 */
	useEffect(() => {
		void loadApiExcludedUserCards().then(() => {
			setStickyCards((prev) => filterDisplayUserCards(prev))
			setStickyDetails((prev) => filterExcludedCardDetailKeys(prev))
			setStackOrder((prev) => filterExcludedCardAddresses(prev))
		})
	}, [])

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

		let cancelled = false
		void (async () => {
			await loadApiExcludedUserCards()
			if (cancelled) return

			const pinned = loadWalletMerchantPassStackOrder(eoaLower)
			if (pinned?.length) setStackOrder(pinned)

			const brands = loadMyBrandsFeedLocalCache(eoaLower)
			if (brands?.cards?.length) {
				const cards = filterDisplayUserCards(brands.cards)
				const details = filterExcludedCardDetailKeys(brands.details)
				setHasEverHadCards(true)
				setFeedSettled(true)
				setStickyCards(cards)
				setStickyDetails(details)
				const order = pinned?.length
					? mergeWalletMerchantPassStackOrder(
							pinned,
							cards.map((c) => c.cardAddress.toLowerCase())
						)
					: cards.map((c) => c.cardAddress.toLowerCase())
				setStackOrder(order)
				if (!pinned?.length) saveWalletMerchantPassStackOrder(eoaLower, order)
			}
		})()

		return () => {
			cancelled = true
		}
	}, [eoaLower])

	useEffect(() => {
		if (!eoaLower || !ethers.isAddress(eoaLower)) return

		const safeLiveCards = filterDisplayUserCards(liveCards)
		const safeLiveDetails = filterExcludedCardDetailKeys(liveDetails)

		if (safeLiveCards.length > 0) {
			setHasEverHadCards(true)
			setFeedSettled(true)
			setStickyCards(safeLiveCards)
			setStickyDetails((prev) =>
				filterExcludedCardDetailKeys(
					mergeDetailsTrusted(prev, safeLiveDetails, safeLiveCards.map((c) => c.cardAddress))
				)
			)
			setStackOrder((prev) => {
				const next = mergeWalletMerchantPassStackOrder(
					prev,
					safeLiveCards.map((c) => c.cardAddress.toLowerCase())
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
		const safeStickyCards = filterDisplayUserCards(stickyCards)
		const safeStickyDetails = filterExcludedCardDetailKeys(stickyDetails)
		const latestEventMsByCard = new Map<string, number>()
		for (const tx of recentActivityItems) {
			const cardAddress = recentActivityMerchantProgramCardAddress(tx)
			if (!cardAddress) continue
			const key = cardAddress.toLowerCase()
			const timestampMs = Number(tx.timestampMs)
			if (!Number.isFinite(timestampMs)) continue
			latestEventMsByCard.set(key, Math.max(latestEventMsByCard.get(key) ?? 0, timestampMs))
		}
		const holdingsCards = safeStickyCards.filter((c) =>
			isDisplayableMerchantPass(c, safeStickyDetails)
		)
		const displayableCards =
			recentActivitySettled && !recentActivityLoading
				? holdingsCards.filter((c) => latestEventMsByCard.has(c.cardAddress.toLowerCase()))
				: []
		const stackCards = buildStackCards(displayableCards, stackOrder, latestEventMsByCard)
		const allStickyDetailsKnown =
			safeStickyCards.length > 0 &&
			safeStickyCards.every((c) => safeStickyDetails[c.cardAddress.toLowerCase()] !== undefined)
		const detailsReady =
			stackCards.length > 0 &&
			stackCards.every((c) => safeStickyDetails[c.cardAddress.toLowerCase()] !== undefined)
		/**
		 * 若本地仍记得叠卡顺序，说明该 EOA 曾经有过 Merchant Pass。
		 * 即便本轮 liveCards 瞬时为空，也不能显示 "No merchant passes yet."。
		 */
		const hasRememberedStack = stackOrder.length > 0
		const knownNoPass =
			recentActivitySettled &&
			!recentActivityLoading &&
			safeStickyCards.length > 0 &&
			displayableCards.length === 0 &&
			allStickyDetailsKnown
		const showEmpty =
			knownNoPass ||
			(displayableCards.length === 0 &&
				!hasRememberedStack &&
				feedSettled &&
				!feedLoading &&
				recentActivitySettled &&
				!recentActivityLoading &&
				!hasEverHadCards)
		const showSkeleton =
			(displayableCards.length > 0 && !detailsReady) ||
			!recentActivitySettled ||
			recentActivityLoading
		const showStack = detailsReady

		return {
			stackCards,
			details: safeStickyDetails,
			badgeCount: stackCards.length,
			showEmpty,
			showSkeleton,
			showStack,
		}
	}, [
		stickyCards,
		stickyDetails,
		stackOrder,
		feedLoading,
		feedSettled,
		hasEverHadCards,
		recentActivityItems,
		recentActivitySettled,
		recentActivityLoading,
	])
}
