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
	hintLocationMissing = false,
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

	const currentKey = `${value.trim()}\0${filesFingerprint(files)}`
	const canSend = canSendOnboardingLookup(value, files.length) && !loading

	const resizeComposer = useCallback(() => {
		const el = taRef.current
		if (!el) return
		el.style.height = 'auto'
		el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 160)}px`
	}, [])

	useEffect(() => {
		resizeComposer()
	}, [value, files.length, resizeComposer])

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

	const sendLookup = async () => {
		if (inFlightRef.current) return
		const q = value.trim()
		const skipHit =
			files.length === 0 &&
			((skipLookupValue && skipLookupValue === q) ||
				(skipLookupForValueRef.current !== '' && skipLookupForValueRef.current === q))
		if (skipHit) {
			reopenLookupPanel()
			return
		}
		if (!canSendOnboardingLookup(value, files.length)) return

		inFlightRef.current = true
		const seq = ++seqRef.current
		setLoading(true)
		setErrorKey('')
		setCandidates([])
		setOpen(true)
		setLastSubmittedKey(currentKey)
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
			const res = await lookupOnboardingBusinesses(value, payload)
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
	}

	const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
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
	const hintKey = hintFilled
		? hintLocationMissing
			? 'onb_lookup_hint_filled_location_missing'
			: 'onb_lookup_hint_filled'
		: 'onb_lookup_hint'

	return (
		<div ref={wrapRef}>
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
					<textarea
						id={id}
						ref={taRef}
						rows={1}
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
						autoComplete="off"
						enterKeyHint="send"
						className="w-full resize-none border-0 bg-transparent px-4 pb-1 pt-3 text-[17px] leading-[22px] text-[#1a1b1f] placeholder:text-[#424655]/50 focus:outline-none"
					/>
					<div className="flex items-center justify-between px-2 pb-2">
						<button
							type="button"
							tabIndex={-1}
							disabled={loading || files.length >= ONBOARDING_LOOKUP_MAX_FILES}
							aria-label={tu('onb_lookup_attach_label')}
							className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#424655] transition hover:bg-[#f4f3f8] disabled:opacity-40"
							onClick={() => fileRef.current?.click()}
						>
							<Paperclip className="h-[18px] w-[18px]" aria-hidden />
						</button>
						<input
							ref={fileRef}
							type="file"
							multiple
							accept={ONBOARDING_LOOKUP_FILE_ACCEPT}
							className="hidden"
							onChange={onPickFiles}
						/>
						<button
							type="button"
							aria-label={tu('onb_lookup_send_label')}
							aria-busy={loading}
							disabled={!canSend}
							className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1562f0] text-white transition disabled:cursor-not-allowed disabled:opacity-40"
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
							<p className="px-4 py-3 text-[15px] text-[#424655]">
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
			) : (
				<p className="mt-1.5 text-[13px] leading-snug text-[#747779]">{tu(hintKey)}</p>
			)}
		</div>
	)
}
