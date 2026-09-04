import { ChevronDown, ChevronUp, Info } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import {
	CARD_SOCIAL_PROMOTION_EDITABLE_EVENT_KEYS,
	cardSocialPromotionEventLabel,
	formatSocialPromotionEventCollapsedSummary,
	sanitizePoints13Input,
	type CardSocialPromotionEventKey,
	type SocialPromotionDraft,
	type SocialPromotionEventDraft,
	type SocialPromotionRewardDraft,
} from '@/utils/programSocialPromotion'
import {
	createNumericInputWheelNonPassiveRefCallback,
	preventNumericInputStepKeys,
	preventNumericInputWheelStep,
} from '@/utils/numericInputStepKeys'
import { socialPromotionEventIcon } from '@/components/programs/socialPromotionEventChrome'
import { useTu } from '@/locale/beamioLocale'

const NUMERIC_SPINNER_CLASS =
	'[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]'

type Props = {
	draft: SocialPromotionDraft
	onChange: (next: SocialPromotionDraft) => void
	disabled?: boolean
	/** Shown by the parent editor panel; accepted so the call site type-checks. */
	validationError?: string
	/** Kept for call-site compatibility; labels now come from `useTu`. */
	lang?: string
}

function RewardPtsRow({
	label,
	reward,
	disabled,
	onToggle,
	onPtsChange,
}: {
	label: string
	reward: SocialPromotionRewardDraft
	disabled?: boolean
	onToggle: (enabled: boolean) => void
	onPtsChange: (pts: string) => void
}) {
	const wheelRef = useMemo(() => createNumericInputWheelNonPassiveRefCallback(), [])
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3">
				<label className="text-[17px] font-normal leading-[22px] tracking-[-0.01em] text-[#1a1b1f]">
					{label}
				</label>
				<button
					type="button"
					role="switch"
					aria-checked={reward.enabled}
					disabled={disabled}
					onClick={() => onToggle(!reward.enabled)}
					className={[
						'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
						'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004bc3] focus-visible:ring-offset-2',
						'disabled:cursor-not-allowed disabled:opacity-50',
						reward.enabled ? 'bg-[#004bc3]' : 'bg-[#c3c6d8]',
					].join(' ')}
				>
					<span
						aria-hidden
						className={[
							'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
							reward.enabled ? 'translate-x-5' : 'translate-x-0',
						].join(' ')}
					/>
				</button>
			</div>
			{reward.enabled ? (
				<div className="relative flex items-center overflow-hidden rounded-lg border border-[#c3c6d8]/60 bg-white transition-shadow focus-within:border-[#004bc3] focus-within:ring-1 focus-within:ring-[#004bc3]">
					<input
						ref={wheelRef}
						type="number"
						inputMode="decimal"
						autoComplete="off"
						enterKeyHint="done"
						min={0.01}
						step={0.01}
						disabled={disabled}
						value={reward.points13}
						onChange={(e) => onPtsChange(sanitizePoints13Input(e.target.value))}
						onKeyDown={preventNumericInputStepKeys}
						onKeyDownCapture={preventNumericInputStepKeys}
						onWheel={preventNumericInputWheelStep}
						className={[
							'block w-full border-0 bg-transparent py-3 pl-4 pr-12 text-[17px] leading-[22px] tracking-[-0.01em] text-[#1a1b1f]',
							'placeholder:text-[#5d5e63]/50 focus:ring-0 disabled:opacity-60',
							NUMERIC_SPINNER_CLASS,
						].join(' ')}
						aria-label={`${label} points`}
					/>
					<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
						<span className="text-[15px] leading-5 text-[#5d5e63]">Pts</span>
					</div>
				</div>
			) : null}
		</div>
	)
}

export function CardSocialPromotionEventsEditor({ draft, onChange, disabled }: Props) {
	const { tu } = useTu()
	const [expandedKey, setExpandedKey] = useState<CardSocialPromotionEventKey | null>('linkClick')

	const patchEvent = useCallback(
		(key: CardSocialPromotionEventKey, nextEvent: SocialPromotionEventDraft) => {
			onChange({
				...draft,
				events: { ...draft.events, [key]: nextEvent },
			})
		},
		[draft, onChange],
	)

	const patchReward = useCallback(
		(
			key: CardSocialPromotionEventKey,
			side: 'user' | 'ref',
			patch: Partial<SocialPromotionRewardDraft>,
		) => {
			const ev = draft.events[key]
			patchEvent(key, { ...ev, [side]: { ...ev[side], ...patch } })
		},
		[draft.events, patchEvent],
	)

	return (
		<div className="flex flex-col gap-4">
			{CARD_SOCIAL_PROMOTION_EDITABLE_EVENT_KEYS.map((key) => {
				const ev = draft.events[key]
				const expanded = expandedKey === key
				const Icon = socialPromotionEventIcon(key)
				const title = cardSocialPromotionEventLabel(key)
				const summary = formatSocialPromotionEventCollapsedSummary(ev)
				const userLabel = tu('programs_social_promotion_user_label')
				const refLabel = tu('programs_social_promotion_ref_label')

				return (
					<div
						key={key}
						className={[
							'overflow-hidden rounded-xl border bg-[#faf9fe] transition-colors',
							expanded
								? 'border-[#004bc3]/20 shadow-sm ring-1 ring-[#004bc3]/5'
								: 'border-[#c3c6d8]/50 hover:border-[#c3c6d8]',
						].join(' ')}
					>
						<button
							type="button"
							disabled={disabled}
							aria-expanded={expanded}
							onClick={() => setExpandedKey(expanded ? null : key)}
							className={[
								'flex w-full items-center gap-3 px-4 py-3.5 text-left',
								expanded ? 'border-b border-[#c3c6d8]/30' : '',
								'disabled:cursor-not-allowed disabled:opacity-60',
							].join(' ')}
						>
							<div
								className={[
									'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
									expanded ? 'bg-[#1562f0]/10 text-[#004bc3]' : 'bg-[#eeedf3] text-[#004bc3]',
								].join(' ')}
							>
								<Icon className="h-5 w-5" aria-hidden strokeWidth={2} />
							</div>
							<div className="min-w-0 flex-1">
								<h3 className="text-[17px] font-normal leading-[22px] tracking-[-0.01em] text-[#1a1b1f]">
									{title}
								</h3>
							</div>
							<div className="flex max-w-[55%] items-center gap-2 sm:max-w-none">
								{!expanded && summary ? (
									<span className="truncate text-[15px] leading-5 text-[#5d5e63]">{summary}</span>
								) : null}
								{expanded ? (
									<ChevronUp className="h-5 w-5 flex-shrink-0 text-[#004bc3]" aria-hidden />
								) : (
									<ChevronDown className="h-5 w-5 flex-shrink-0 text-[#5d5e63]" aria-hidden />
								)}
							</div>
						</button>

						{expanded ? (
							<div className="flex flex-col gap-6 bg-[#faf9fe] p-4">
								<RewardPtsRow
									label={userLabel}
									reward={ev.user}
									disabled={disabled}
									onToggle={(enabled) => patchReward(key, 'user', { enabled })}
									onPtsChange={(points13) => patchReward(key, 'user', { points13 })}
								/>
								<RewardPtsRow
									label={refLabel}
									reward={ev.ref}
									disabled={disabled}
									onToggle={(enabled) => patchReward(key, 'ref', { enabled })}
									onPtsChange={(points13) => patchReward(key, 'ref', { points13 })}
								/>
							</div>
						) : null}
					</div>
				)
			})}

			<div className="flex items-start gap-3 rounded-lg bg-[#f4f3f8] p-4">
				<Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#5d5e63]" aria-hidden />
				<p className="text-[15px] leading-5 text-[#5d5e63]">
					{tu('programs_social_promotion_bunit_note')}
				</p>
			</div>
		</div>
	)
}
