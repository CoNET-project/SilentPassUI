import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ArrowUp, FileText, Image, Loader2, Paperclip, X } from 'lucide-react'
import { useTu } from '@/locale/beamioLocale'
import { onboardingCountryLabel } from '@/pages/Home/onboardingCountries'
import {
	ONBOARDING_LOOKUP_FILE_ACCEPT,
	ONBOARDING_LOOKUP_MAX_FILES,
	ONBOARDING_LOOKUP_MAX_TOTAL_BYTES,
	canSendOnboardingLookup,
	classifyOnboardingLookupFile,
	fileToOnboardingLookupBase64,
	isOnboardingLookupImageFile,
	lookupOnboardingBusinesses,
	type OnboardingBusinessLookupCandidate,
	type OnboardingLookupFilePayload,
} from '@/utils/onboardingBusinessLookup'

function lookupCandidatePlaceLine(c: OnboardingBusinessLookupCandidate): string {
	const parts: string[] = []
	if (c.city.trim()) parts.push(c.city.trim())
	if (c.province.trim()) parts.push(c.province.trim())
	if (c.country.trim()) parts.push(onboardingCountryLabel(c.country))
	return parts.join(', ')
}

function lookupErrorKey(error: string): string {
	if (error === 'rate_limited') return 'onb_lookup_rate_limited'
	if (error === 'ai_unavailable') return 'onb_lookup_ai_unavailable'
	if (error === 'file_too_many') return 'onb_lookup_file_too_many'
	if (error === 'file_too_large') return 'onb_lookup_file_too_large'
	if (error === 'file_unsupported') return 'onb_lookup_file_unsupported'
	if (error === 'file_invalid') return 'onb_lookup_file_invalid'
	if (error === 'file_legacy_word') return 'onb_lookup_file_legacy_word'
	return 'onb_lookup_error'
}

function classifyErrorKey(kind: ReturnType<typeof classifyOnboardingLookupFile>): string {
	if (kind === 'legacy_word') return 'onb_lookup_file_legacy_word'
	if (kind === 'too_large') return 'onb_lookup_file_too_large'
	if (kind === 'unsupported') return 'onb_lookup_file_unsupported'
	return ''
}

function fileMimeType(file: File): string {
	const t = file.type.trim()
	if (t) return t
	if (/\.pdf$/i.test(file.name)) return 'application/pdf'
	if (/\.docx$/i.test(file.name)) {
		return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	}
	if (/\.png$/i.test(file.name)) return 'image/png'
	if (/\.gif$/i.test(file.name)) return 'image/gif'
	if (/\.webp$/i.test(file.name)) return 'image/webp'
	if (/\.jpe?g$/i.test(file.name)) return 'image/jpeg'
	return 'application/octet-stream'
}

function filesFingerprint(files: File[]): string {
	return files.map((f) => `${f.name}:${f.size}`).join('|')
}

/** Clickable sample queries: own site, third-party listing, or a business name. */
const LOOKUP_SAMPLE_QUERIES = [
	'https://maysense.com/?sca_ref=11391220.9bVWBdc5TI5X6MF',
	'https://www.ubereats.com/store/starbucks',
	'Blue Bottle Coffee',
] as const

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
	inputClassName: _inputClassName,
	onSelectCandidate,
	skipLookupValue = '',
	hintFilled = false,
	hintLocationMissing: _hintLocationMissing = false,
}: Props): React.ReactElement {
	const { tu } = useTu()
	const listboxId = useId()
	const wrapRef = useRef<HTMLDivElement | null>(null)
	const taRef = useRef<HTMLTextAreaElement | null>(null)
	const fileRef = useRef<HTMLInputElement | null>(null)
	const inFlightRef = useRef(false)
	const seqRef = useRef(0)
	const skipLookupForValueRef = useRef('')
	const lastCandidatesRef = useRef<OnboardingBusinessLookupCandidate[]>([])

	const [open, setOpen] = useState(false)
	const [loading, setLoading] = useState(false)
	const [errorKey, setErrorKey] = useState('')
	const [candidates, setCandidates] = useState<OnboardingBusinessLookupCandidate[]>([])
	const [files, setFiles] = useState<File[]>([])
	const [lastSubmittedKey, setLastSubmittedKey] = useState('')
	const [attachArmed, setAttachArmed] = useState(false)
	const attachArmCleanupRef = useRef<(() => void) | null>(null)

	const currentKey = `${value.trim()}\0${filesFingerprint(files)}`
	const canSend = canSendOnboardingLookup(value, files.length) && !loading
	const showSamples = !hintFilled && !value.trim() && files.length === 0 && !loading

	const resizeComposer = useCallback(() => {
		const el = taRef.current
		if (!el) return
		el.style.height = 'auto'
		el.style.height = `${Math.min(Math.max(el.scrollHeight, 80), 160)}px`
	}, [])

	useEffect(() => {
		resizeComposer()
	}, [value, files.length, resizeComposer])

	useEffect(() => {
		return () => {
			attachArmCleanupRef.current?.()
			attachArmCleanupRef.current = null
		}
	}, [])

	useEffect(() => {
		const onPointer = (e: PointerEvent) => {
			if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
		}
		document.addEventListener('pointerdown', onPointer)
		return () => document.removeEventListener('pointerdown', onPointer)
	}, [])

	const reopenLookupPanel = () => {
		if (lastCandidatesRef.current.length === 0) return
		if (candidates.length === 0) setCandidates(lastCandidatesRef.current)
		setOpen(true)
	}

	const sendLookup = useCallback(async (queryOverride?: string) => {
		if (inFlightRef.current) return
		const q = (queryOverride ?? value).trim()
		const submittedKey = `${q}\0${filesFingerprint(files)}`
		const skipHit =
			files.length === 0 &&
			((skipLookupValue && skipLookupValue === q) ||
				(skipLookupForValueRef.current !== '' && skipLookupForValueRef.current === q))
		if (skipHit) {
			reopenLookupPanel()
			return
		}
		if (!canSendOnboardingLookup(q, files.length)) return

		inFlightRef.current = true
		const seq = ++seqRef.current
		setAttachArmed(false)
		attachArmCleanupRef.current?.()
		attachArmCleanupRef.current = null
		setLoading(true)
		setErrorKey('')
		setCandidates([])
		setOpen(true)
		setLastSubmittedKey(submittedKey)
		try {
			let payload: OnboardingLookupFilePayload[] | undefined
			if (files.length > 0) {
				payload = await Promise.all(
					files.map(async (file) => ({
						filename: file.name,
						mimeType: fileMimeType(file),
						dataBase64: await fileToOnboardingLookupBase64(file),
					})),
				)
			}
			const res = await lookupOnboardingBusinesses(q, payload)
			if (seq !== seqRef.current) return
			setLoading(false)
			if (!res.ok) {
				setCandidates([])
				setErrorKey(lookupErrorKey(res.error))
				return
			}
			setCandidates(res.candidates)
			lastCandidatesRef.current = res.candidates
			setErrorKey('')
		} catch {
			if (seq !== seqRef.current) return
			setLoading(false)
			setCandidates([])
			setErrorKey('onb_lookup_error')
		} finally {
			if (seq === seqRef.current) inFlightRef.current = false
		}
	}, [files, skipLookupValue, value])

	const applySample = (query: string) => {
		skipLookupForValueRef.current = ''
		setAttachArmed(false)
		attachArmCleanupRef.current?.()
		attachArmCleanupRef.current = null
		onChange(query)
		setErrorKey('')
		void sendLookup(query)
	}

	const openAttachPicker = () => {
		if (loading || files.length >= ONBOARDING_LOOKUP_MAX_FILES) return
		setAttachArmed(true)
		fileRef.current?.click()
		attachArmCleanupRef.current?.()
		const disarm = () => {
			attachArmCleanupRef.current?.()
			attachArmCleanupRef.current = null
			window.setTimeout(() => setAttachArmed(false), 80)
		}
		const onWinFocus = () => disarm()
		const fallback = window.setTimeout(disarm, 12_000)
		window.addEventListener('focus', onWinFocus)
		attachArmCleanupRef.current = () => {
			window.removeEventListener('focus', onWinFocus)
			window.clearTimeout(fallback)
		}
	}

	const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
		setAttachArmed(false)
		attachArmCleanupRef.current?.()
		attachArmCleanupRef.current = null
		const picked = Array.from(e.target.files ?? [])
		e.target.value = ''
		if (!picked.length) return
		if (files.length + picked.length > ONBOARDING_LOOKUP_MAX_FILES) {
			setErrorKey('onb_lookup_file_too_many')
			return
		}
		let extra = 0
		for (const file of picked) {
			const kind = classifyOnboardingLookupFile(file)
			const err = classifyErrorKey(kind)
			if (err) {
				setErrorKey(err)
				return
			}
			extra += file.size
		}
		const existing = files.reduce((sum, f) => sum + f.size, 0)
		if (existing + extra > ONBOARDING_LOOKUP_MAX_TOTAL_BYTES) {
			setErrorKey('onb_lookup_file_too_large')
			return
		}
		const next = [...files]
		for (const file of picked) {
			if (next.some((f) => f.name === file.name && f.size === file.size)) continue
			next.push(file)
		}
		setFiles(next)
		setErrorKey('')
	}

	const showEmpty =
		open && !loading && !errorKey && lastSubmittedKey === currentKey && candidates.length === 0
	const showPanel = open && (loading || candidates.length > 0 || showEmpty)

	const samplePills = showSamples ? (
		<div
			role="group"
			aria-label={tu('onb_lookup_samples_label')}
			className="mb-3 flex flex-col items-start gap-2"
		>
			{LOOKUP_SAMPLE_QUERIES.map((query) => (
				<button
					key={query}
					type="button"
					disabled={loading}
					aria-label={tu('onb_lookup_sample_aria', { query })}
					className="max-w-full rounded-full bg-[#f0f2f7] px-4 py-2.5 text-left text-[15px] leading-snug text-[#1a1b1f] transition hover:bg-[#e4e8f0] disabled:opacity-50"
					onMouseDown={(e) => e.preventDefault()}
					onClick={(e) => {
						e.preventDefault()
						e.stopPropagation()
						applySample(query)
					}}
				>
					<span className="block truncate">{query}</span>
				</button>
			))}
		</div>
	) : null

	return (
		<div ref={wrapRef}>
			{samplePills}
			<div className="relative">
				<div className="rounded-[24px] border border-[#e3e2e7] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.06)]">
					{files.length > 0 ? (
						<div className="flex flex-wrap gap-2 px-3 pt-3">
							{files.map((file, i) => (
								<div
									key={`${file.name}-${file.size}-${i}`}
									className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#f4f3f8] py-1 pl-2 pr-1"
								>
									{isOnboardingLookupImageFile(file) ? (
										<Image className="h-3.5 w-3.5 shrink-0 text-[#424655]" aria-hidden />
									) : (
										<FileText className="h-3.5 w-3.5 shrink-0 text-[#424655]" aria-hidden />
									)}
									<span className="max-w-[10rem] truncate text-[13px] text-[#1a1b1f]">{file.name}</span>
									<button
										type="button"
										tabIndex={-1}
										disabled={loading}
										aria-label={tu('onb_lookup_remove_file', { name: file.name })}
										className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#424655] hover:bg-white disabled:opacity-50"
										onClick={() => {
											setFiles((prev) => prev.filter((_, idx) => idx !== i))
											setErrorKey('')
										}}
									>
										<X className="h-3.5 w-3.5" aria-hidden />
									</button>
								</div>
							))}
						</div>
					) : null}
					<div className="flex items-end gap-1.5 px-2 pb-2 pt-1">
						<button
							type="button"
							tabIndex={-1}
							disabled={loading || files.length >= ONBOARDING_LOOKUP_MAX_FILES}
							aria-label={tu('onb_lookup_attach_label')}
							aria-pressed={attachArmed}
							data-armed={attachArmed ? 'true' : undefined}
							className={[
								'group relative isolate mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0',
								'text-[#2c2f31] transition duration-200 active:scale-[0.96] disabled:opacity-40',
								'focus:outline-none',
								'focus-visible:text-[#1562f0] focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_5px_#1562f0,0_8px_20px_rgba(21,98,240,0.14)]',
								'data-[armed=true]:text-[#1562f0] data-[armed=true]:shadow-[0_0_0_2px_#fff,0_0_0_5px_#1562f0,0_8px_20px_rgba(21,98,240,0.14)]',
							].join(' ')}
							onClick={openAttachPicker}
						>
							<span
								className={[
									'pointer-events-none absolute inset-0 rounded-full border border-white/80 bg-[#f5f7f9]/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_14px_rgba(15,23,42,0.07),0_1px_3px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.08] backdrop-blur-md',
									'group-hover:bg-white/75',
									attachArmed
										? 'border-white bg-white shadow-none ring-0'
										: '',
								].join(' ')}
								aria-hidden
							/>
							<Paperclip className="relative z-[1] h-[18px] w-[18px]" aria-hidden />
						</button>
						<input
							ref={fileRef}
							type="file"
							multiple
							accept={ONBOARDING_LOOKUP_FILE_ACCEPT}
							className="hidden"
							onChange={onPickFiles}
						/>
						<textarea
							id={id}
							ref={taRef}
							rows={3}
							role="combobox"
							aria-autocomplete="list"
							aria-expanded={showPanel}
							aria-controls={listboxId}
							value={value}
							onChange={(e) => {
								skipLookupForValueRef.current = ''
								onChange(e.target.value)
								setErrorKey('')
							}}
							onFocus={reopenLookupPanel}
							onClick={reopenLookupPanel}
							onKeyDown={(e) => {
								if (e.key === 'Escape') {
									setOpen(false)
									return
								}
								if (e.key === 'Enter' && !e.shiftKey) {
									e.preventDefault()
									void sendLookup()
								}
							}}
							placeholder={placeholder}
							aria-label={tu('onb_lookup_composer_aria')}
							autoComplete="off"
							enterKeyHint="send"
							className="min-h-[80px] w-full min-w-0 flex-1 resize-none border-0 bg-transparent px-1 pb-1 pt-2 text-[17px] leading-[22px] text-[#1a1b1f] placeholder:text-[#424655]/50 focus:outline-none"
						/>
						<button
							type="button"
							aria-label={tu('onb_lookup_send_label')}
							aria-busy={loading}
							disabled={!canSend}
							className="mb-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1562f0] text-white transition disabled:cursor-not-allowed disabled:opacity-40"
							onClick={() => void sendLookup()}
						>
							{loading ? (
								<Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
							) : (
								<ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
							)}
						</button>
					</div>
				</div>
				{showPanel ? (
					<div
						id={listboxId}
						role="listbox"
						aria-label={tu('onb_lookup_results_label')}
						className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-64 overflow-y-auto rounded-xl border border-[#e3e2e7] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
					>
							{loading && candidates.length === 0 ? (
								<p
									className="onboarding-lookup-loading-text px-4 py-3 text-[15px]"
									aria-live="polite"
								>
									{files.length > 0 ? tu('onb_lookup_analyzing') : tu('onb_lookup_searching')}
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
			{errorKey ? (
				<p role="alert" className="mt-1.5 text-[13px] leading-snug text-[#92400e]">
					{tu(errorKey)}
				</p>
			) : null}
		</div>
	)
}
