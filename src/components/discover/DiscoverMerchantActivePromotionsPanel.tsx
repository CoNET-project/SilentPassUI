import { Loader2 } from 'lucide-react'
import { type DiscoverActivePromotionsPanelModel } from '../../utils/discoverMerchantPromotions'
import { DiscoverMerchantShareProfilePromotionCard } from './DiscoverMerchantShareProfilePromotionCard'

const ACCENT = '#8d3a8b'

export function DiscoverMerchantActivePromotionsPanel(props: {
	model: DiscoverActivePromotionsPanelModel | null
	loading?: boolean
	merchantName: string
	cardAddress: string
	getPrivateKeyArmor?: () => string | undefined
}) {
	const { model, loading, merchantName, cardAddress, getPrivateKeyArmor } = props

	if (loading && !model) {
		return (
			<div className="rounded-[22px] bg-white px-6 py-8 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800">
				<div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
					<Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} aria-hidden />
					<span className="text-sm">Loading promotions…</span>
				</div>
			</div>
		)
	}

	if (!model?.socialMissions) return null

	const { activeCount, socialMissions } = model
	const showCardSocial = socialMissions.user || socialMissions.referrer
	if (!showCardSocial) return null

	return (
		<div className="rounded-[22px] bg-white px-5 py-5 shadow-[0_8px_22px_rgba(15,23,42,0.06)] ring-1 ring-[#e8ecf0] dark:bg-slate-900 dark:ring-slate-800 sm:px-6">
			<header className="mb-4 flex items-center justify-between gap-2">
				<h3 className="text-base font-bold text-[#1f2328] dark:text-slate-100">Active promotions</h3>
				<span
					className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
					style={{ backgroundColor: `${ACCENT}18`, color: ACCENT }}
				>
					{activeCount.toLocaleString('en-US')} active
				</span>
			</header>

			<DiscoverMerchantShareProfilePromotionCard
				cardAddress={cardAddress}
				merchantName={merchantName}
				sharerMetrics={socialMissions.referrer}
				fallbackYouMetrics={socialMissions.user}
				getPrivateKeyArmor={getPrivateKeyArmor}
			/>
		</div>
	)
}
