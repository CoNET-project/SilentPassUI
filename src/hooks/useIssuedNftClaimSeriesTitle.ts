import { useEffect, useState } from 'react'
import type { TxView } from '@/pages/History/recentActivityIndexerMerge'
import {
	classifyIndexerIssuedNftRedeemProductKind,
	fetchBeamioSeriesSharedMetadata,
	indexerRouteMaxPositiveTokenId,
	indexerRouteCardAddress,
	issuedNftClaimNeedsSeriesTitleResolve,
	readSeriesMetadataDisplayTitle,
} from '@/utils/indexerCatalogRedeemClaim'

/** Resolve `Claim {beamioProduction.name}` / `Claim {coupon name}` when row still has generic Claim Coupon/Catalog. */
export function useIssuedNftClaimSeriesTitle(tx: TxView, enabled: boolean): string | undefined {
	const [resolved, setResolved] = useState<string | undefined>(undefined)

	useEffect(() => {
		if (!enabled) {
			setResolved(undefined)
			return
		}
		if (!issuedNftClaimNeedsSeriesTitleResolve(tx.title)) {
			setResolved(undefined)
			return
		}
		const raw = tx.rawTransaction
		const card = tx.merchantCardAddress ?? indexerRouteCardAddress(raw?.route) ?? ''
		const tokenId =
			tx.issuedNftClaimTokenId ??
			(indexerRouteMaxPositiveTokenId(raw?.route)?.toString() ?? '')
		if (!card || !tokenId) return

		let cancelled = false
		void (async () => {
			const meta = await fetchBeamioSeriesSharedMetadata(card, tokenId)
			if (cancelled || !meta) return
			const product = classifyIndexerIssuedNftRedeemProductKind({
				displayJson: raw?.displayJson,
				seriesMetadata: meta,
			})
			if (!product) return
			setResolved(readSeriesMetadataDisplayTitle(meta, product))
		})()

		return () => {
			cancelled = true
		}
	}, [
		enabled,
		tx.id,
		tx.title,
		tx.merchantCardAddress,
		tx.issuedNftClaimTokenId,
		tx.rawTransaction,
	])

	return resolved
}
