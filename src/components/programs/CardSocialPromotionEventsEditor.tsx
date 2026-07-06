import {
	CARD_SOCIAL_PROMOTION_EVENT_KEYS,
	cardSocialPromotionEventLabel,
	type CardSocialPromotionEventKey,
	type SocialPromotionDraft,
} from '@/utils/programSocialPromotion'
import {
	preventNumericInputStepKeys,
	preventNumericInputWheelStep,
} from '@/utils/numericInputStepKeys'
import { useTu } from '@/locale/beamioLocale'

const bizFocusRingClass =
	'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1562f0]/30 focus-visible:ring-offset-2'
const bizNumericNoSpinnerClass =
	'[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]'

type Props = {
	draft: SocialPromotionDraft
	onChange: (updater: (prev: SocialPromotionDraft) => SocialPromotionDraft) => void
	validationError?: string
}

function cardEventHintKey(eventKey: CardSocialPromotionEventKey): string {
	switch (eventKey) {
		case 'linkClick':
			return 'programs_social_promotion_event_click_hint'
		case 'like':
			return 'programs_social_promotion_event_like_hint'
		case 'topup':
			return 'programs_social_promotion_event_topup_hint'
		default:
			return 'programs_social_promotion_event_click_hint'
	}
}

function cardEventLabelKey(eventKey: CardSocialPromotionEventKey): string {
	switch (eventKey) {
		case 'linkClick':
			return 'programs_social_promotion_event_click'
		case 'like':
			return 'programs_social_promotion_event_like'
		case 'topup':
			return 'programs_social_promotion_event_topup'
		default:
			return 'programs_social_promotion_event_click'
	}
}

export function CardSocialPromotionEventsEditor({ draft, onChange, validationError }: Props) {
	const { tu } = useTu()

	return (
		<div className="space-y-4">
			<p className="text-[11px] leading-relaxed text-[#747779]">
				{tu('programs_social_promotion_parallel_hint')}
			</p>
			{CARD_SOCIAL_PROMOTION_EVENT_KEYS.map((eventKey) => {
				const eventDraft = draft.events[eventKey]
				const eventActive = eventDraft.user.enabled || eventDraft.ref.enabled
				return (
					<div
						key={eventKey}
						className={`rounded-2xl border p-3 ${
							eventActive
								? 'border-[#1562f0]/10 bg-white shadow-sm'
								: 'border-[#e5e9eb] bg-[#eef1f3]/60'
						}`}
					>
						<div className="mb-3">
							<p className="text-sm font-bold text-[#2c2f31]">{tu(cardEventLabelKey(eventKey))}</p>
							<p className="mt-1 text-[10px] leading-snug text-[#595c5e]">
								{tu(cardEventHintKey(eventKey))}
							</p>
						</div>
						{(['user', 'ref'] as const).map((role) => {
							const roleDraft = eventDraft[role]
							const roleLabel =
								role === 'user'
									? tu('programs_social_promotion_user_label')
									: tu('programs_social_promotion_ref_label')
							return (
								<div key={role} className="mb-2 last:mb-0">
									<label className="mb-2 flex cursor-pointer items-center gap-2">
										<input
											type="checkbox"
											checked={roleDraft.enabled}
											onChange={(e) =>
												onChange((p) => ({
													...p,
													enabled: true,
													events: {
														...p.events,
														[eventKey]: {
															...p.events[eventKey],
															[role]: {
																...p.events[eventKey][role],
																enabled: e.target.checked,
															},
														},
													},
												}))
											}
											className="h-4 w-4 rounded border-[#0051d1]/30"
										/>
										<span className="text-xs font-bold uppercase tracking-wide text-[#595c5e]">
											{roleLabel}
										</span>
									</label>
									<input
										type="number"
										inputMode="numeric"
										autoComplete="off"
										min={1}
										step={1}
										disabled={!roleDraft.enabled}
										value={roleDraft.points13}
										onKeyDown={preventNumericInputStepKeys}
										onWheel={preventNumericInputWheelStep}
										onChange={(e) =>
											onChange((p) => ({
												...p,
												enabled: true,
												events: {
													...p.events,
													[eventKey]: {
														...p.events[eventKey],
														[role]: {
															...p.events[eventKey][role],
															points13: e.target.value.replace(/[^\d]/g, ''),
														},
													},
												},
											}))
										}
										aria-label={`${cardSocialPromotionEventLabel(eventKey)} ${roleLabel}`}
										className={`block w-full rounded-xl border-none bg-[#eef1f3] px-4 py-3 text-sm font-bold text-[#2c2f31] disabled:opacity-50 ${bizFocusRingClass} ${bizNumericNoSpinnerClass}`}
									/>
								</div>
							)
						})}
						{eventActive ? (
							<p className="mt-2 text-[10px] font-semibold text-[#0051d1]">
								{tu('programs_social_promotion_event_active')}
							</p>
						) : null}
					</div>
				)
			})}
			<p className="ml-2 text-[11px] leading-relaxed text-[#747779]">
				{tu('programs_social_promotion_points_hint')}
			</p>
			{validationError ? (
				<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
					<p>{validationError}</p>
				</div>
			) : null}
		</div>
	)
}
