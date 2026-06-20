import { useEffect, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'
import { Loader2, Gift, Search, X } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { searchUsername } from '@/services/beamio'
import { fiatPrefix, formatAmount } from '@/services/currency'
import { postMerchantGiftAAtoEOA, signMerchantGiftOpenContainer } from '@/services/BeamioCard'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { IpfsImg } from '@/components/IpfsImg'
import {
	BeamioSearchResultRow,
	beamioSearchAvatarUrl,
	beamioSearchDisplayName,
	beamioSearchShortAddress,
	makeBeamioSearchAddressOnlyResult,
} from '@/components/Home/beamioSearchResultPresentation'
import type { KeyboardEvent, WheelEvent } from 'react'
import { tu } from '@/locale/beamioLocale'

function preventNumericInputStepKeys(e: KeyboardEvent<HTMLInputElement>): void {
	if (
		e.key === 'ArrowUp' ||
		e.key === 'ArrowDown' ||
		e.key === 'PageUp' ||
		e.key === 'PageDown' ||
		e.key === 'Home' ||
		e.key === 'End'
	) {
		e.preventDefault()
		e.stopPropagation()
	}
}

function preventNumericInputWheelStep(e: WheelEvent<HTMLInputElement>): void {
	e.preventDefault()
	e.stopPropagation()
}

function GiftRecipientSelectedCapsule({
	item,
	onClear,
}: {
	item: searchResult
	onClear: () => void
}) {
	const tag = (item.username ?? '').trim()
	const name = beamioSearchDisplayName(item)
	const seed = tag || item.address || '@Beamio'

	return (
		<div className="rounded-2xl border border-[#1562f0]/25 bg-white p-4 shadow-sm dark:border-[#6ba3ff]/30 dark:bg-slate-800">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-[#c3c6d8]/40 bg-white py-1 pl-1 pr-3 dark:border-slate-600 dark:bg-slate-900">
					<IpfsImg
						src={item.image?.trim() || beamioSearchAvatarUrl(seed)}
						alt=""
						className="h-9 w-9 shrink-0 rounded-full border border-slate-200/80 object-cover dark:border-slate-600"
					/>
					<div className="min-w-0 flex-1 leading-tight">
						<p className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">{name}</p>
						{tag ? (
							<p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
								@{tag} · {beamioSearchShortAddress(item.address)}
							</p>
						) : (
							<p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
								{beamioSearchShortAddress(item.address)}
							</p>
						)}
					</div>
				</div>
				<button
					type="button"
					className="rounded-full p-2 text-[#424655] hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
					onClick={onClear}
					aria-label="Clear selection"
				>
					<X className="h-5 w-5" aria-hidden />
				</button>
			</div>
		</div>
	)
}

export type MerchantGiftCardOption = {
	cardAddress: string
	title: string
	points: number
	currency: string
}

type Props = {
	onClose: () => void
	cards: MerchantGiftCardOption[]
	profile: { privateKeyArmor?: string | null; keyID?: string; aaAccount?: string } | null | undefined
	onSuccess?: () => void
}

export default function MerchantAssetGiftSheet({ onClose, cards, profile, onSuccess }: Props) {
	const [selectedCard, setSelectedCard] = useState('')
	const [amount, setAmount] = useState('')
	const [recipientQuery, setRecipientQuery] = useState('')
	const [results, setResults] = useState<searchResult[]>([])
	const [loading, setLoading] = useState(false)
	const [showDropdown, setShowDropdown] = useState(false)
	const [selectedRecipient, setSelectedRecipient] = useState<searchResult | null>(null)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const requestId = useRef(0)

	const myAddress = useMemo(() => {
		const addr = profile?.keyID?.trim() || profile?.aaAccount?.trim() || ''
		return addr && ethers.isAddress(addr) ? ethers.getAddress(addr).toLowerCase() : ''
	}, [profile?.keyID, profile?.aaAccount])

	const normalizedQuery = useMemo(() => recipientQuery.trim().replace('@', ''), [recipientQuery])
	const canSearch = normalizedQuery.length >= 2

	useEffect(() => {
		if (!selectedCard && cards.length > 0) {
			setSelectedCard(cards[0]!.cardAddress)
		}
	}, [cards, selectedCard])

	useEffect(() => {
		if (selectedRecipient) return

		if (!normalizedQuery) {
			setResults([])
			setLoading(false)
			setShowDropdown(false)
			return
		}

		if (!canSearch) {
			setResults([])
			setLoading(false)
			setShowDropdown(false)
			return
		}

		const id = ++requestId.current
		const timer = window.setTimeout(async () => {
			setLoading(true)
			const lower = normalizedQuery.toLowerCase()
			const data = await searchUsername(lower)
			const rows: searchResult[] = data?.results ?? []
			const filtered = rows.filter((n) => n.address.toLowerCase() !== myAddress)
			if (!filtered.length && ethers.isAddress(lower)) {
				filtered.push(makeBeamioSearchAddressOnlyResult(lower))
			}
			if (id !== requestId.current) return
			setResults(filtered)
			setLoading(false)
			setShowDropdown(true)
		}, 350)

		return () => window.clearTimeout(timer)
	}, [normalizedQuery, canSearch, myAddress, selectedRecipient])

	const selected = useMemo(
		() => cards.find((c) => c.cardAddress.toLowerCase() === selectedCard.toLowerCase()),
		[cards, selectedCard]
	)

	const amountNum = Number(amount)
	const amountValid =
		Number.isFinite(amountNum) && amountNum > 0 && selected != null && amountNum <= selected.points

	const recipientEoa = useMemo(() => {
		const addr = String(selectedRecipient?.address ?? '').trim()
		if (!addr || !ethers.isAddress(addr)) return ''
		return ethers.getAddress(addr)
	}, [selectedRecipient])

	const handleSelectRecipient = (item: searchResult) => {
		if (!item.address || !ethers.isAddress(item.address)) return
		setSelectedRecipient(item)
		setRecipientQuery('')
		setResults([])
		setShowDropdown(false)
	}

	const handleSubmit = async () => {
		setSubmitError(null)
		if (!selected || !amountValid) {
			setSubmitError('Enter a valid amount within your balance')
			return
		}
		if (!recipientEoa) {
			setSubmitError('Search and select a recipient')
			return
		}
		const senderEoa = profile?.keyID?.trim()
		if (senderEoa && ethers.isAddress(senderEoa) && recipientEoa.toLowerCase() === senderEoa.toLowerCase()) {
			setSubmitError('Cannot gift to yourself')
			return
		}
		const senderAA = (profile?.aaAccount ?? '').trim()
		if (!senderAA || !ethers.isAddress(senderAA)) {
			setSubmitError('Beamio account (AA) is required to send a gift')
			return
		}
		const pk = resolveSigningPrivateKeyArmor(profile)
		if (!pk) {
			setSubmitError('Unlock wallet to sign this gift')
			return
		}
		setSubmitting(true)
		try {
			const openContainerPayload = await signMerchantGiftOpenContainer({
				userPrivateKey: pk,
				senderAA,
				recipientEOA: recipientEoa,
				cardAddress: selected.cardAddress,
				amountHuman: String(amountNum),
				currencyCode: selected.currency,
			})
			const result = await postMerchantGiftAAtoEOA({
				openContainerPayload,
				currency: selected.currency.toUpperCase(),
				currencyAmount: String(amountNum),
				cardAddress: selected.cardAddress,
			})
			if (!result.success) {
				setSubmitError(result.error ?? 'Gift transfer failed')
				return
			}
			Toast.show({ icon: 'success', content: tu('gift_sent_successfully') })
			onSuccess?.()
			onClose()
		} catch (e) {
			setSubmitError((e as Error)?.message ?? 'Gift transfer failed')
		} finally {
			setSubmitting(false)
		}
	}

	const currencyCode = (selected?.currency ?? 'CAD').toUpperCase() as ICurrency
	const prefix = fiatPrefix(currencyCode) || currencyCode

	return (
		<div className="flex flex-col gap-5 px-5 pb-2">
			<div className="text-center">
				<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#b3c5ff]/30 text-[#004bc3] dark:bg-[#1562f0]/25 dark:text-[#6ba3ff]">
					<Gift size={24} strokeWidth={2} aria-hidden />
				</div>
			</div>

			<label className="block">
				<span className="text-xs font-bold uppercase tracking-wider text-[#424655] dark:text-slate-400">
					Merchant card
				</span>
				<select
					value={selectedCard}
					onChange={(e) => setSelectedCard(e.target.value)}
					className="mt-2 w-full rounded-lg border border-[#c3c6d8]/50 bg-white px-3 py-3 text-sm font-semibold text-[#191c1d] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
				>
					{cards.map((c) => (
						<option key={c.cardAddress} value={c.cardAddress}>
							{c.title} — {prefix}
							{formatAmount(c.points, c.currency as ICurrency)}
						</option>
					))}
				</select>
			</label>

			<label className="block">
				<span className="text-xs font-bold uppercase tracking-wider text-[#424655] dark:text-slate-400">
					Amount ({currencyCode})
				</span>
				<input
					type="number"
					inputMode="decimal"
					autoComplete="off"
					enterKeyHint="done"
					value={amount}
					onChange={(e) => setAmount(e.target.value)}
					onKeyDown={preventNumericInputStepKeys}
					onWheel={preventNumericInputWheelStep}
					placeholder={
						selected
							? `Max ${formatAmount(selected.points, selected.currency as ICurrency)}`
							: '0.00'
					}
					className="mt-2 w-full rounded-lg border border-[#c3c6d8]/50 bg-white px-3 py-3 text-sm font-semibold tabular-nums text-[#191c1d] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
				/>
			</label>

			<div>
				<span className="text-xs font-bold uppercase tracking-wider text-[#424655] dark:text-slate-400">
					Recipient
				</span>
				<div className="mt-2">
					{!selectedRecipient ? (
						<div className="relative">
							<div className="flex h-11 items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 shadow-sm ring-1 ring-transparent focus-within:ring-slate-300 dark:border-slate-600 dark:bg-slate-800">
								<Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
								<input
									value={recipientQuery}
									onChange={(e) => setRecipientQuery(e.currentTarget.value)}
									onFocus={() => {
										if (canSearch && (results.length > 0 || loading)) setShowDropdown(true)
									}}
									placeholder="Search for @BeamioTag or wallet address"
									autoComplete="off"
									inputMode="search"
									className="w-full min-w-0 bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
								/>
								{loading ? (
									<Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />
								) : null}
							</div>
							{showDropdown && canSearch ? (
								<div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
									<div className="max-h-72 overflow-y-auto py-1">
										{!loading &&
											results.map((item) => (
												<BeamioSearchResultRow
													key={item.address}
													item={item}
													onSelect={handleSelectRecipient}
												/>
											))}
										{!loading && results.length === 0 ? (
											<div className="px-3 py-2.5 text-[12px] text-slate-400">No results</div>
										) : null}
									</div>
								</div>
							) : null}
						</div>
					) : (
						<GiftRecipientSelectedCapsule
							item={selectedRecipient}
							onClear={() => {
								setSelectedRecipient(null)
								setRecipientQuery('')
								setShowDropdown(false)
							}}
						/>
					)}
				</div>
			</div>

			{submitError ? (
				<p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
					{submitError}
				</p>
			) : null}

			<button
				type="button"
				disabled={submitting || !amountValid || !recipientEoa}
				onClick={() => void handleSubmit()}
				className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#1562f0] px-6 py-4 text-base font-bold text-white shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
				Send gift
			</button>
		</div>
	)
}
