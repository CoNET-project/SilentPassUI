import { type ReactNode } from 'react'
import { HelpCircle, Loader2, Share2 } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { type DiscoverActivePromotionsPanelModel } from '../../utils/discoverMerchantPromotions'
import { DiscoverSocialMissionEarnColumns } from './DiscoverSocialMissionEarnColumns'

const ACCENT = '#8d3a8b'
const ACCENT_SURFACE = '#f5ecff'

/** Plain string + pre-wrap for antd-mobile Toast; React inline-block caused top ascender clip. */
function formatPromotionHelpText(detailText: string): string {
	const trimmed = detailText.trim()
	if (!trimmed) return ''
	const questionSplit = trimmed.match(/^(.+\?)\s+(.+)$/)
	if (questionSplit) {
		return `${questionSplit[1]}\n${questionSplit[2]}`
	}
	if (!trimmed.includes('. ')) return trimmed
	return trimmed.replace(/\.\s+/g, '.\n').replace(/\.\n$/, '.')
}

function PromotionHelpButton(props: { detailText: string; ariaLabel: string }) {
	const { detailText, ariaLabel } = props
	const helpText = formatPromotionHelpText(detailText)
	if (!helpText) return null
	return (
		<button
			type="button"
			className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
			aria-label={ariaLabel}
			onClick={() =>
				Toast.show({
					content: helpText,
					duration: 4000,
					position: 'center',
					maskClassName: 'beamio-promotion-help-toast',
				})
			}
		>
			<HelpCircle className="h-4 w-4" strokeWidth={2} aria-hidden />
		</button>
	)
}

function SectionIcon(props: { children: ReactNode }) {
	return (
		<div
			className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
			style={{ backgroundColor: ACCENT_SURFACE, color: ACCENT }}
		>
			{props.children}
		</div>
	)
}

export function DiscoverMerchantActivePromotionsPanel(props: {
	model: DiscoverActivePromotionsPanelModel | null
	loading?: boolean
}) {
	const { model, loading } = props

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
	const helpText = [socialMissions.userDetailText, socialMissions.referrer ? 'Want more? Become a referrer.' : '']
		.map((s) => s.trim())
		.filter(Boolean)
		.join(' ')

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

			<div className="space-y-3">
				{showCardSocial ? (
					<div className="rounded-2xl border border-slate-100 px-4 py-3.5 dark:border-slate-800">
						<div className="flex items-start gap-3">
							<SectionIcon>
								<Share2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
							</SectionIcon>
							<div className="min-w-0 flex-1">
								<div className="mb-3 flex items-center justify-between gap-2">
									<p className="text-sm font-semibold text-[#1f2328] dark:text-slate-100">Social Missions</p>
									{helpText ? (
										<PromotionHelpButton detailText={helpText} ariaLabel="Social mission details" />
									) : null}
								</div>
								<DiscoverSocialMissionEarnColumns
									user={socialMissions.user}
									referrer={socialMissions.referrer}
								/>
							</div>
						</div>
					</div>
				) : null}
			</div>
		</div>
	)
}
