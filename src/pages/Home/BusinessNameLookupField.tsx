import React, { useEffect, useId, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTu } from '@/locale/beamioLocale'
import { onboardingCountryLabel } from '@/pages/Home/onboardingCountries'
import {
	lookupOnboardingBusinesses,
	shouldLookupOnboardingBusiness,
	type OnboardingBusinessLookupCandidate,
} from '@/utils/onboardingBusinessLookup'

const LOOKUP_DEBOUNCE_MS = 450

function lookupCandidatePlaceLine(c: OnboardingBusinessLookupCandidate): string {
	const parts: string[] = []
	if (c.city.trim()) parts.push(c.city.trim())
	if (c.province.trim()) parts.push(c.province.trim())
	if (c.country.trim()) parts.push(onboardingCountryLabel(c.country))
	return parts.join(', ')
}

type Props = {
	id: string
	value: string
	onChange: (v: string) => void
	placeholder: string
	inputClassName: string
	onSelectCandidate: (candidate: OnboardingBusinessLookupCandidate) => void
	skipLookupValue?: string
	/** After a candidate hydrates the form, swap the lookup hint. */
	hintFilled?: boolean
	/** Filled hint when Country is still blank (no invented location). */
	hintLocationMissing?: boolean
}

export function BusinessNameLookupField({
	id,
	value,
	onChange,
	placeholder,
	inputClassName,
	onSelectCandidate,
	skipLookupValue = '',
	hintFilled = false,
	hintLocationMissing = false,
}: Props): React.ReactElement {
	const { tu } = useTu()
	const listboxId = useId()
	const wrapRef = useRef<HTMLDivElement | null>(null)
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const [open, setOpen] = useState(false)
	const [loading, setLoading] = useState(false)
	const [errorKey, setErrorKey] = useState('')
	const [candidates, setCandidates] = useState<OnboardingBusinessLookupCandidate[]>([])
	const [activeQuery, setActiveQuery] = useState('')
	const skipLookupForValueRef = useRef('')
	const lastCandidatesRef = useRef<OnboardingBusinessLookupCandidate[]>([])

	const reopenLookupPanel = () => {
		if (lastCandidatesRef.current.length > 0) {
			if (candidates.length === 0) setCandidates(lastCandidatesRef.current)
			setOpen(true)
			return
		}
		const q = value.trim()
		if (!shouldLookupOnboardingBusiness(q)) return
		setOpen(true)
		if (candidates.length > 0) return
		setLoading(true)
		setErrorKey('')
		setActiveQuery(q)
		void lookupOnboardingBusinesses(q).then((res) => {
			setLoading(false)
			if (!res.ok) {
				setErrorKey(
					res.error === 'rate_limited'
						? 'onb_lookup_rate_limited'
						: res.error === 'ai_unavailable'
							? 'onb_lookup_ai_unavailable'
							: 'onb_lookup_error',
				)
				return
			}
			setCandidates(res.candidates)
			lastCandidatesRef.current = res.candidates
			setErrorKey('')
		})
	}

	useEffect(() => {
		if (timerRef.current !== undefined) clearTimeout(timerRef.current)
		let cancelled = false
		const q = value.trim()
		const skipHit =
			(skipLookupValue && skipLookupValue === q) ||
			(skipLookupForValueRef.current !== '' && skipLookupForValueRef.current === q)
		if (skipHit) {
			setLoading(false)
			return
		}
		if (!shouldLookupOnboardingBusiness(q)) {
			setLoading(false)
			setCandidates([])
			setErrorKey('')
			setActiveQuery('')
			setOpen(false)
			return
		}
		timerRef.current = setTimeout(() => {
			setLoading(true)
			setErrorKey('')
			setActiveQuery(q)
			setOpen(true)
			void lookupOnboardingBusinesses(q).then((res) => {
				if (cancelled) return
				setLoading(false)
				if (!res.ok) {
					setCandidates([])
					setErrorKey(
						res.error === 'rate_limited'
							? 'onb_lookup_rate_limited'
							: res.error === 'ai_unavailable'
								? 'onb_lookup_ai_unavailable'
								: 'onb_lookup_error',
					)
					return
				}
				setCandidates(res.candidates)
				lastCandidatesRef.current = res.candidates
				setErrorKey('')
			})
		}, LOOKUP_DEBOUNCE_MS)
		return () => {
			cancelled = true
			if (timerRef.current !== undefined) clearTimeout(timerRef.current)
		}
	}, [value, skipLookupValue])

	useEffect(() => {
		const onPointer = (e: PointerEvent) => {
			if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('pointerdown', onPointer)
		return () => document.removeEventListener('pointerdown', onPointer)
	}, [])

	const showPanel = open && (shouldLookupOnboardingBusiness(value) || candidates.length > 0)
	const showEmpty = showPanel && !loading && !errorKey && activeQuery === value.trim() && candidates.length === 0
	const hintKey = hintFilled
		? hintLocationMissing
			? 'onb_lookup_hint_filled_location_missing'
			: 'onb_lookup_hint_filled'
		: 'onb_lookup_hint'

	return (
		<div ref={wrapRef}>
			<div className="relative">
				<input
					id={id}
					type="text"
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={showPanel}
					aria-controls={listboxId}
					value={value}
					onChange={(e) => {
						skipLookupForValueRef.current = ''
						onChange(e.target.value)
					}}
					onFocus={reopenLookupPanel}
					onClick={reopenLookupPanel}
					onKeyDown={(e) => {
						if (e.key === 'Escape') setOpen(false)
					}}
					placeholder={placeholder}
					autoComplete="organization"
					className={`${inputClassName} ${loading ? 'pr-11' : ''}`}
				/>
				{loading ? (
					<span
						className="pointer-events-none absolute inset-y-0 right-3 flex items-center justify-center"
						aria-hidden
					>
						<Loader2 className="h-5 w-5 animate-spin text-[#1562f0]" />
					</span>
				) : null}
				{showPanel ? (
					<div
						id={listboxId}
						role="listbox"
						aria-label={tu('onb_lookup_results_label')}
						className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#e3e2e7] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
					>
						{loading && candidates.length === 0 && !errorKey ? (
							<p className="px-4 py-3 text-[15px] text-[#424655]">{tu('onb_lookup_searching')}</p>
						) : null}
						{errorKey ? (
							<p role="alert" className="px-4 py-3 text-[15px] text-[#92400e]">
								{tu(errorKey)}
							</p>
						) : null}
						{showEmpty ? (
							<p className="px-4 py-3 text-[15px] text-[#424655]">{tu('onb_lookup_empty')}</p>
						) : null}
						{candidates.map((c) => {
							const host = (() => {
								try {
									return c.website ? new URL(c.website).hostname : ''
								} catch {
									return ''
								}
							})()
							const place = lookupCandidatePlaceLine(c)
							const selected =
								(skipLookupValue && skipLookupValue === c.name.trim()) ||
								skipLookupForValueRef.current === c.name.trim()
							return (
								<button
									key={`${c.id}-${c.name}-${c.website}`}
									type="button"
									role="option"
									aria-selected={selected}
									className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left ${
										selected ? 'bg-[#e9edff]' : 'hover:bg-[#f4f3f8]'
									}`}
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => {
										skipLookupForValueRef.current = c.name.trim()
										setOpen(false)
										onSelectCandidate(c)
									}}
								>
									<span className="text-[15px] font-semibold text-[#1a1b1f]">{c.name}</span>
									{c.snippet ? (
										<span className="line-clamp-2 text-[13px] leading-snug text-[#424655]">{c.snippet}</span>
									) : null}
									{place ? <span className="text-[13px] leading-snug text-[#424655]">{place}</span> : null}
									{host ? <span className="text-[12px] text-[#1562f0]">{host}</span> : null}
								</button>
							)
						})}
					</div>
				) : null}
			</div>
			<p className="mt-1.5 text-[13px] leading-snug text-[#747779]">{tu(hintKey)}</p>
		</div>
	)
}
