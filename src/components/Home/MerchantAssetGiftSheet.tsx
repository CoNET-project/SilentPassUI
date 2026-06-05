import { useEffect, useMemo, useRef, useState } from 'react'
import { ethers } from 'ethers'
import { Loader2, Gift, Search, ChevronRight, X } from 'lucide-react'
import { Toast } from 'antd-mobile'
import { searchUsername } from '@/services/beamio'
import { fiatPrefix, formatAmount } from '@/services/currency'
import {
	postCardOpenTransfer,
	postCardOpenTransferPreCheck,
	signOfflineTransferERC3009,
} from '@/services/BeamioCard'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { IpfsImg } from '@/components/IpfsImg'
import type { KeyboardEvent, WheelEvent } from 'react'

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

const avatarImgUrl = (seed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(seed || '@Beamio')}`

function displayNameFromSearch(row: searchResult): string {
	const last = (row.last_name ?? '').split('\r\n')[0]?.trim() ?? ''
	const first = (row.first_name ?? '').trim() ?? ''
	const full = `${first} ${/^\{/.test(last) ? '' : last}`.trim()
	return full || row.username || row.address
}

function makeAddressOnlyResult(address: string): searchResult {
	return {
		username: '',
		image: '',
		address: ethers.getAddress(address),
		created_at: 0,
		first_name: '',
		last_name: '',
		follow_count: '',
		follower_count: '',
	}
}

function GiftRecipientSearchResultRow({
	item,
	onSelect,
}: {
	item: searchResult
	onSelect: () => void
}) {
	const tag = (item.username ?? '').trim()
	const name = displayNameFromSearch(item)
	const seed = tag || item.address || '@Beamio'

	return (
		<div
			role="button"
			tabIndex={0}
			className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
			onClick={onSelect}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault()
					onSelect()
				}
			}}
		>
			<div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-[#c3c6d8]/40 bg-white py-1 pl-1 pr-3 dark:border-slate-600 dark:bg-slate-800">
				<IpfsImg
					src={item.image?.trim() || avatarImgUrl(seed)}
					alt=""
					className="h-9 w-9 shrink-0 rounded-full border border-slate-200/80 object-cover dark:border-slate-600"
				/>
				<div className="min-w-0 flex-1 leading-tight">
					{name && tag ? (
						<p className="truncate text-xs font-semibold text-[#191c1d] dark:text-slate-100">{name}</p>
					) : null}
					{tag ? (
						<p
							className={`truncate font-medium text-[#424655] dark:text-slate-400 ${
								name ? 'text-[10px]' : 'text-xs font-semibold text-[#191c1d] dark:text-slate-100'
							}`}
						>
							@{tag}
						</p>
					) : (
						<p className="truncate font-mono text-xs font-semibold text-[#191c1d] dark:text-slate-100">
							{item.address ? `${item.address.slice(0, 6)}…${item.address.slice(-4)}` : '—'}
						</p>
					)}
				</div>
			</div>
			<ChevronRight className="h-4 w-4 shrink-0 text-[#c3c6d8] dark:text-slate-500" aria-hidden />
		</div>
	)
}

function GiftRecipientSelectedCapsule({
	item,
	onClear,
}: {
	item: searchResult
	onClear: () => void
}) {
	const tag = (item.username ?? '').trim()
	const name = displayNameFromSearch(item)
	const seed = tag || item.address || '@Beamio'

	return (
		<div className="rounded-2xl border border-[#1562f0]/25 bg-white p-4 shadow-sm dark:border-[#6ba3ff]/30 dark:bg-slate-800">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-[#c3c6d8]/40 bg-white py-1 pl-1 pr-3 dark:border-slate-600 dark:bg-slate-900">
					<IpfsImg
						src={item.image?.trim() || avatarImgUrl(seed)}
						alt=""
						className="h-9 w-9 shrink-0 rounded-full border border-slate-200/80 object-cover dark:border-slate-600"
					/>
					<div className="min-w-0 flex-1 leading-tight">
						{name && tag ? (
							<p className="truncate text-xs font-semibold text-[#191c1d] dark:text-slate-100">{name}</p>
						) : null}
						{tag ? (
							<p
								className={`truncate font-medium text-[#424655] dark:text-slate-400 ${
									name ? 'text-[10px]' : 'text-xs font-semibold text-[#191c1d] dark:text-slate-100'
								}`}
							>
								@{tag}
							</p>
						) : (
							<p className="truncate font-mono text-xs font-semibold text-[#191c1d] dark:text-slate-100">
								{item.address ? `${item.address.slice(0, 6)}…${item.address.slice(-4)}` : '—'}
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
	profile: { privateKeyArmor?: string | null; keyID?: string } | null | undefined
	onSuccess?: () => void
}

export default function MerchantAssetGiftSheet({ onClose, cards, profile, onSuccess }: Props) {
	const [selectedCard, setSelectedCard] = useState('')
	const [amount, setAmount] = useState('')
	const [recipientQuery, setRecipientQuery] = useState('')
	const [results, setResults] = useState<searchResult[]>([])
	const [loading, setLoading] = useState(false)
	const [selectedRecipient, setSelectedRecipient] = useState<searchResult | null>(null)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const requestId = useRef(0)

	const keyword = useMemo(
		() => recipientQuery.trim().replace(/^@+/, '').toLowerCase(),
		[recipientQuery],
	)

	useEffect(() => {
		if (!selectedCard && cards.length > 0) {
			setSelectedCard(cards[0]!.cardAddress)
		}
	}, [cards, selectedCard])

	useEffect(() => {
		if (selectedRecipient) return
		if (keyword.length < 2) {
			setResults([])
			return
		}
		const id = ++requestId.current
		const timer = window.setTimeout(async () => {
			setLoading(true)
			let rows: searchResult[] = []
			if (ethers.isAddress(keyword)) {
				rows = [makeAddressOnlyResult(keyword)]
			} else {
				const data = await searchUsername(keyword)
				rows = data?.results ?? []
				if (!rows.length && ethers.isAddress(keyword)) {
					rows = [makeAddressOnlyResult(keyword)]
				}
			}
			if (id !== requestId.current) return
			setResults(rows)
			setLoading(false)
		}, 350)
		return () => window.clearTimeout(timer)
	}, [keyword, selectedRecipient])

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
		const pk = resolveSigningPrivateKeyArmor(profile)
		if (!pk) {
			setSubmitError('Unlock wallet to sign this gift')
			return
		}
		setSubmitting(true)
		try {
			const signed = await signOfflineTransferERC3009(
				pk,
				String(amountNum),
				selected.cardAddress,
				recipientEoa
			)
			const pre = await postCardOpenTransferPreCheck(signed)
			if (!pre.success) {
				setSubmitError(pre.error ?? 'Pre-check failed')
				return
			}
			const result = await postCardOpenTransfer(signed)
			if (!result.success) {
				setSubmitError(result.error ?? 'Gift transfer failed')
				return
			}
			Toast.show({ icon: 'success', content: 'Gift sent successfully' })
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
				<h2 className="text-lg font-bold text-[#191c1d] dark:text-slate-100">Gift merchant balance</h2>
				<p className="mt-1 text-sm text-[#424655] dark:text-slate-400">
					Send program points from a merchant card to another registered Beamio user.
				</p>
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
							<div className="flex items-center gap-2 rounded-2xl border border-[#c3c6d8]/60 bg-white px-4 py-3 shadow-sm dark:border-slate-600 dark:bg-slate-800">
								<Search className="h-5 w-5 shrink-0 text-[#424655] dark:text-slate-400" aria-hidden />
								<input
									value={recipientQuery}
									onChange={(e) => setRecipientQuery(e.target.value.replace(/^@+/, ''))}
									placeholder="Search @beamioTag or wallet address"
									autoComplete="off"
									inputMode="text"
									className="w-full min-w-0 bg-transparent text-base text-[#191c1d] outline-none placeholder:text-[#424655]/70 dark:text-slate-100 dark:placeholder:text-slate-500"
								/>
								{loading ? (
									<span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#1562f0] border-t-transparent" />
								) : null}
							</div>
							{results.length > 0 && keyword.length >= 2 ? (
								<ul className="absolute z-20 mt-2 max-h-40 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-600 dark:bg-slate-800">
									{results.map((row) => {
										const key = `${row.address ?? ''}-${row.username ?? ''}`
										return (
											<li key={key}>
												<GiftRecipientSearchResultRow
													item={row}
													onSelect={() => {
														if (!row.address || !ethers.isAddress(row.address)) return
														setSelectedRecipient(row)
														setResults([])
													}}
												/>
											</li>
										)
									})}
								</ul>
							) : null}
						</div>
					) : (
						<GiftRecipientSelectedCapsule
							item={selectedRecipient}
							onClear={() => {
								setSelectedRecipient(null)
								setRecipientQuery('')
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
