import {
	COUPON_SOCIAL_PROMOTION_EVENT_KEYS,
	couponSocialPromotionEventLabel,
	type CouponSocialPromotionDraft,
	type CouponSocialPromotionEventKey,
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
	draft: CouponSocialPromotionDraft
	onChange: (updater: (prev: CouponSocialPromotionDraft) => CouponSocialPromotionDraft) => void
	validationError?: string
	/** Purple for standalone sheet; blue for inline coupon editor. */
	variant?: 'purple' | 'blue'
}

function couponEventHintKey(eventKey: CouponSocialPromotionEventKey): string {
	switch (eventKey) {
		case 'linkClick':
			return 'programs_social_promotion_event_click_hint'
		case 'like':
			return 'programs_social_promotion_event_like_hint'
		case 'claim':
			return 'programs_social_promotion_coupon_event_claim_hint'
		case 'burn':
			return 'programs_social_promotion_coupon_event_burn_hint'
		default:
			return 'programs_social_promotion_event_click_hint'
	}
}

function couponEventLabelKey(eventKey: CouponSocialPromotionEventKey): string {
	switch (eventKey) {
		case 'linkClick':
			return 'programs_social_promotion_event_click'
		case 'like':
			return 'programs_social_promotion_event_like'
		case 'claim':
			return 'programs_social_promotion_coupon_event_claim'
		case 'burn':
			return 'programs_social_promotion_coupon_event_burn'
		default:
			return 'programs_social_promotion_event_click'
	}
}

export function CouponSocialPromotionEventsEditor({
	draft,
	onChange,
	validationError,
	variant = 'blue',
}: Props) {
	const { tu } = useTu()
	const accentBorder = variant === 'purple' ? 'border-[#8d3a8b]/30' : 'border-[#1562f0]/30'
	const accentSurface = variant === 'purple' ? 'border-[#8d3a8b]/10 bg-[#f5ecff]/40' : 'border-[#1562f0]/10 bg-white'

	return (
		<div className="space-y-4">
			<p className="text-[11px] leading-relaxed text-[#747779]">
				{tu('programs_social_promotion_coupon_parallel_hint')}
			</p>
			{COUPON_SOCIAL_PROMOTION_EVENT_KEYS.map((eventKey) => {
				const eventDraft = draft.events[eventKey]
				const eventActive = eventDraft.user.enabled || eventDraft.ref.enabled
				return (
					<div
						key={eventKey}
						className={`rounded-2xl border p-3 ${eventActive ? accentSurface : 'border-[#e5e9eb] bg-[#eef1f3]/60'}`}
					>
						<div className="mb-3">
							<p className="text-sm font-bold text-[#2c2f31]">{tu(couponEventLabelKey(eventKey))}</p>
							<p className="mt-1 text-[10px] leading-snug text-[#595c5e]">
								{tu(couponEventHintKey(eventKey))}
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
													events: {
														...p.events,
														[eventKey]: {
															...p.events[eventKey],
															[role]: { ...p.events[eventKey][role], enabled: e.target.checked },
														},
													},
												}))
											}
											className={`h-4 w-4 rounded ${accentBorder}`}
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
										aria-label={`${couponSocialPromotionEventLabel(eventKey)} ${roleLabel}`}
										className={`block w-full rounded-xl border-none bg-[#eef1f3] px-4 py-3 text-sm font-bold text-[#2c2f31] disabled:opacity-50 ${bizFocusRingClass} ${bizNumericNoSpinnerClass}`}
									/>
								</div>
							)
						})}
						{eventActive ? (
							<p className={`mt-2 text-[10px] font-semibold ${variant === 'purple' ? 'text-[#8d3a8b]' : 'text-[#0051d1]'}`}>
								{tu('programs_social_promotion_coupon_event_active')}
							</p>
						) : null}
					</div>
				)
			})}
			{validationError ? (
				<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
					<p>{validationError}</p>
				</div>
			) : null}
		</div>
	)
}
