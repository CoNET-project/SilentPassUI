import { useState } from 'react'
import {
	COUPON_SOCIAL_PROMOTION_EVENT_KEYS,
	couponSocialPromotionEventLabel,
	sanitizePoints13Input,
	type CouponSocialPromotionDraft,
	type CouponSocialPromotionEventKey,
	type SocialPromotionEventDraft,
} from '@/utils/programSocialPromotion'
import {
	preventNumericInputStepKeys,
	preventNumericInputWheelStep,
} from '@/utils/numericInputStepKeys'
import { useTu } from '@/locale/beamioLocale'
import {
	socialPromotionEventIcon,
	socialPromotionEventIconClassName,
	socialPromotionEventIsConfigured,
	socialPromotionEventPanelClassName,
	socialPromotionEventTabClassName,
} from './socialPromotionEventChrome'

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

function CouponSocialPromotionEventRoleFields({
	eventKey,
	eventDraft,
	onChange,
	accentBorder,
	tu,
}: {
	eventKey: CouponSocialPromotionEventKey
	eventDraft: SocialPromotionEventDraft
	onChange: Props['onChange']
	accentBorder: string
	tu: ReturnType<typeof useTu>['tu']
}) {
	return (
		<div className="grid grid-cols-2 gap-2 sm:gap-3">
			{(['user', 'ref'] as const).map((role) => {
				const roleDraft = eventDraft[role]
				const roleLabel =
					role === 'user'
						? tu('programs_social_promotion_user_label')
						: tu('programs_social_promotion_ref_label')
				return (
					<div key={role} className="flex min-w-0 items-center gap-2">
						<label className="flex shrink-0 cursor-pointer items-center gap-1.5">
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
							<span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-[#595c5e] sm:text-xs">
								{roleLabel}
							</span>
						</label>
						<input
							type="number"
							inputMode="decimal"
							autoComplete="off"
							enterKeyHint="done"
							min={0.01}
							step={0.01}
							disabled={!roleDraft.enabled}
							value={roleDraft.points13}
							onKeyDown={preventNumericInputStepKeys}
							onKeyDownCapture={preventNumericInputStepKeys}
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
												points13: sanitizePoints13Input(e.target.value),
											},
										},
									},
								}))
							}
							aria-label={`${couponSocialPromotionEventLabel(eventKey)} ${roleLabel}`}
							className={`min-w-0 flex-1 rounded-xl border-none bg-white/80 px-3 py-2.5 text-sm font-bold text-[#2c2f31] disabled:opacity-50 sm:px-4 sm:py-3 ${bizFocusRingClass} ${bizNumericNoSpinnerClass}`}
						/>
					</div>
				)
			})}
		</div>
	)
}

export function CouponSocialPromotionEventsEditor({
	draft,
	onChange,
	validationError,
	variant = 'blue',
}: Props) {
	const { tu } = useTu()
	const [activeEventKey, setActiveEventKey] = useState<CouponSocialPromotionEventKey>('linkClick')
	const accentBorder = variant === 'purple' ? 'border-[#8d3a8b]/30' : 'border-[#1562f0]/30'
	const activeAccentText = variant === 'purple' ? 'text-[#8d3a8b]' : 'text-[#0051d1]'

	const activeEventDraft = draft.events[activeEventKey]
	const activeConfigured = socialPromotionEventIsConfigured(
		activeEventDraft.user.enabled,
		activeEventDraft.ref.enabled,
	)
	const ActiveIcon = socialPromotionEventIcon(activeEventKey)

	return (
		<div className="space-y-4">
			<p className="text-[11px] leading-relaxed text-[#747779]">
				{tu('programs_social_promotion_coupon_parallel_hint')}
			</p>

			<div
				className="flex flex-wrap gap-1.5 sm:gap-2"
				role="tablist"
				aria-label={tu('programs_social_promotion_coupon_title')}
			>
				{COUPON_SOCIAL_PROMOTION_EVENT_KEYS.map((eventKey) => {
					const eventDraft = draft.events[eventKey]
					const configured = socialPromotionEventIsConfigured(
						eventDraft.user.enabled,
						eventDraft.ref.enabled,
					)
					const isActive = activeEventKey === eventKey
					const Icon = socialPromotionEventIcon(eventKey)
					return (
						<button
							key={eventKey}
							type="button"
							role="tab"
							id={`coupon-social-promo-tab-${eventKey}`}
							aria-selected={isActive}
							aria-controls={`coupon-social-promo-panel-${eventKey}`}
							onClick={() => setActiveEventKey(eventKey)}
							className={`${socialPromotionEventTabClassName(eventKey, configured, isActive)} min-w-[calc(50%-0.375rem)] sm:min-w-0 sm:flex-1 ${bizFocusRingClass}`}
						>
							<Icon
								className={`h-4 w-4 shrink-0 sm:h-[1.05rem] sm:w-[1.05rem] ${socialPromotionEventIconClassName(eventKey, configured)}`}
								strokeWidth={isActive ? 2.25 : 2}
								aria-hidden
								{...(eventKey === 'like' && configured ? { fill: 'currentColor' } : {})}
							/>
							<span className="min-w-0 truncate">{tu(couponEventLabelKey(eventKey))}</span>
						</button>
					)
				})}
			</div>

			<div
				id={`coupon-social-promo-panel-${activeEventKey}`}
				role="tabpanel"
				aria-labelledby={`coupon-social-promo-tab-${activeEventKey}`}
				className={`rounded-2xl border p-3 sm:p-4 ${socialPromotionEventPanelClassName(activeEventKey, activeConfigured)}`}
			>
				<div className="mb-3 flex items-start gap-2.5">
					<div
						className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 ${socialPromotionEventIconClassName(activeEventKey, activeConfigured)}`}
					>
						<ActiveIcon
							className="h-4 w-4"
							strokeWidth={2.25}
							aria-hidden
							{...(activeEventKey === 'like' && activeConfigured ? { fill: 'currentColor' } : {})}
						/>
					</div>
					<div className="min-w-0">
						<p className="text-sm font-bold text-[#2c2f31]">{tu(couponEventLabelKey(activeEventKey))}</p>
						<p className="mt-1 text-[10px] leading-snug text-[#595c5e]">
							{tu(couponEventHintKey(activeEventKey))}
						</p>
					</div>
				</div>

				<CouponSocialPromotionEventRoleFields
					eventKey={activeEventKey}
					eventDraft={activeEventDraft}
					onChange={onChange}
					accentBorder={accentBorder}
					tu={tu}
				/>

				{activeConfigured ? (
					<p className={`mt-2 text-[10px] font-semibold ${activeAccentText}`}>
						{tu('programs_social_promotion_coupon_event_active')}
					</p>
				) : (
					<p className="mt-2 text-[10px] font-medium text-[#747779]">
						{tu('programs_social_promotion_event_not_set')}
					</p>
				)}
			</div>

			{validationError ? (
				<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
					<p>{validationError}</p>
				</div>
			) : null}
		</div>
	)
}
