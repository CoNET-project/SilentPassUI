import { useState } from 'react'
import {
	CARD_SOCIAL_PROMOTION_EDITABLE_EVENT_KEYS,
	cardSocialPromotionEventLabel,
	type CardSocialPromotionEventKey,
	type SocialPromotionDraft,
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

function SocialPromotionEventRoleFields({
	eventKey,
	eventDraft,
	onChange,
	tu,
}: {
	eventKey: CardSocialPromotionEventKey
	eventDraft: SocialPromotionEventDraft
	onChange: Props['onChange']
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
							<span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-[#595c5e] sm:text-xs">
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
							className={`min-w-0 flex-1 rounded-xl border-none bg-white/80 px-3 py-2.5 text-sm font-bold text-[#2c2f31] disabled:opacity-50 sm:px-4 sm:py-3 ${bizFocusRingClass} ${bizNumericNoSpinnerClass}`}
						/>
					</div>
				)
			})}
		</div>
	)
}

export function CardSocialPromotionEventsEditor({ draft, onChange, validationError }: Props) {
	const { tu } = useTu()
	const [activeEventKey, setActiveEventKey] = useState<CardSocialPromotionEventKey>('linkClick')

	const activeEventDraft = draft.events[activeEventKey]
	const activeConfigured = socialPromotionEventIsConfigured(
		activeEventDraft.user.enabled,
		activeEventDraft.ref.enabled,
	)
	const ActiveIcon = socialPromotionEventIcon(activeEventKey)

	return (
		<div className="space-y-4">
			<p className="text-[11px] leading-relaxed text-[#747779]">
				{tu('programs_social_promotion_parallel_hint')}
			</p>

			<div
				className="flex gap-1.5 sm:gap-2"
				role="tablist"
				aria-label={tu('programs_social_promotion_title')}
			>
				{CARD_SOCIAL_PROMOTION_EDITABLE_EVENT_KEYS.map((eventKey) => {
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
							id={`card-social-promo-tab-${eventKey}`}
							aria-selected={isActive}
							aria-controls={`card-social-promo-panel-${eventKey}`}
							onClick={() => setActiveEventKey(eventKey)}
							className={`${socialPromotionEventTabClassName(eventKey, configured, isActive)} ${bizFocusRingClass}`}
						>
							<Icon
								className={`h-4 w-4 shrink-0 sm:h-[1.05rem] sm:w-[1.05rem] ${socialPromotionEventIconClassName(eventKey, configured)}`}
								strokeWidth={isActive ? 2.25 : 2}
								aria-hidden
								{...(eventKey === 'like' && configured ? { fill: 'currentColor' } : {})}
							/>
							<span className="min-w-0 truncate">{tu(cardEventLabelKey(eventKey))}</span>
						</button>
					)
				})}
			</div>

			<div
				id={`card-social-promo-panel-${activeEventKey}`}
				role="tabpanel"
				aria-labelledby={`card-social-promo-tab-${activeEventKey}`}
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
						<p className="text-sm font-bold text-[#2c2f31]">{tu(cardEventLabelKey(activeEventKey))}</p>
						<p className="mt-1 text-[10px] leading-snug text-[#595c5e]">
							{tu(cardEventHintKey(activeEventKey))}
						</p>
					</div>
				</div>

				<SocialPromotionEventRoleFields
					eventKey={activeEventKey}
					eventDraft={activeEventDraft}
					onChange={onChange}
					tu={tu}
				/>

				{activeConfigured ? (
					<p className="mt-2 text-[10px] font-semibold text-[#0051d1]">
						{tu('programs_social_promotion_event_active')}
					</p>
				) : (
					<p className="mt-2 text-[10px] font-medium text-[#747779]">
						{tu('programs_social_promotion_event_not_set')}
					</p>
				)}
			</div>

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
