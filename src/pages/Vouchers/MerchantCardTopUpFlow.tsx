import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Loader2, SlidersHorizontal, Sparkles } from 'lucide-react'
import { ethers } from 'ethers'
import {
	BeamioCircularBackButton,
	BEAMIO_CIRCULAR_BACK_ROW_CLASS,
} from '@/components/BeamioCircularBackButton'
import { IpfsImg } from '@/components/IpfsImg'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { useMerchantCardDatabase } from '@/providers/MerchantCardDatabaseProvider'
import { getCardMetadataFromApi, postBuyCardPoints } from '@/services/BeamioCard'
import { isGenericMerchantCardDisplayName } from '@/utils/isGenericMerchantCardDisplayName'
import { pickNonFactoryMerchantAssetUrl } from '@/utils/isFactoryDefaultMerchantAssetUrl'
import { CONET_MAINNET_CHAIN_ID } from '@/config/chainAddresses'
import { beamioApi } from '@/utils/constants'
import { getCardFactoryGatewayForEip712 } from '@/utils/beamioUserCardChain'
import { resolveSigningPrivateKeyArmor } from '@/utils/resolveSigningPrivateKeyArmor'
import { displayFiatPrefixFromCode } from '@/services/currency'
import {
	CoverLeg,
	formatPtsHuman,
	loadReward13RowsForAa,
	planAutoCoverUsdc,
	planManualCoverUsdc,
	quoteFiat6ToUsdc6,
	readEoaConetUsdc6,
	REDEEM_REWARD13_EIP712_TYPES,
	Reward13Row,
	sumUsdc6,
} from '@/utils/topupReward13Plan'

const SPINNER_CLASS =
	'[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]'

const QUICK = ['10', '20', '50', '100'] as const

type Step = 'amount' | 'pay' | 'select' | 'confirm' | 'success'

type Props = {
	open: boolean
	onClose: () => void
	cardAddress: string
	storeCreditsPoints: string
	cardCurrency: string
	profile: profile
	initialAmount?: string
	onSuccess?: (assets?: MyCardAssets) => void
}

function preventStepKeys(e: React.KeyboardEvent<HTMLInputElement>) {
	if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
		e.preventDefault()
		e.stopPropagation()
	}
}

function formatUsdc(usdc6: bigint): string {
	return Number(ethers.formatUnits(usdc6, 6)).toFixed(2)
}

function merchantInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean)
	if (parts.length >= 2) {
		return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
	}
	const alnum = name.replace(/[^a-zA-Z0-9]/g, '')
	return (alnum.slice(0, 2) || 'M').toUpperCase()
}

function formatFiatHero(n: number): string {
	if (!Number.isFinite(n)) return '0'
	return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

function formatPrefixedFiat(prefix: string, amount: string): string {
	return `${prefix} ${amount}`
}

function formatPtsShort(points6: bigint): string {
	const s = formatPtsHuman(points6)
	return s.endsWith('.00') ? s.slice(0, -3) : s
}

export default function MerchantCardTopUpFlow({
	open,
	onClose,
	cardAddress,
	storeCreditsPoints,
	cardCurrency,
	profile,
	initialAmount,
	onSuccess,
}: Props) {
	const { setShowFooter } = useDaemonContext()
	const { resolveName, resolveImage, registerCardAddresses } = useMerchantCardDatabase()
	const [isEntered, setIsEntered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const [step, setStep] = useState<Step>('amount')
	const [amountInput, setAmountInput] = useState('50.00')
	const [smartPay, setSmartPay] = useState(true)
	const [rows, setRows] = useState<Reward13Row[]>([])
	const [rowsLoading, setRowsLoading] = useState(false)
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const [quotedUsdc6, setQuotedUsdc6] = useState(0n)
	const [eoaUsdc6, setEoaUsdc6] = useState<bigint | null>(null)
	const [merchantName, setMerchantName] = useState('Store')
	const [merchantIcon, setMerchantIcon] = useState<string | undefined>()
	const [payBusy, setPayBusy] = useState(false)
	const [payError, setPayError] = useState('')
	const [mintedLabel, setMintedLabel] = useState('0.00')
	const [usedManual, setUsedManual] = useState(false)
	const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

	const prefix = displayFiatPrefixFromCode(cardCurrency, 'USD')
	const fiatHuman = amountInput.replace(/,/g, '').trim() || '0'

	const close = useCallback(() => {
		if (isClosing || payBusy) return
		setIsClosing(true)
		closeTimer.current = setTimeout(() => {
			onClose()
		}, 300)
	}, [isClosing, onClose, payBusy])

	useEffect(() => {
		if (!open) return
		setShowFooter(false)
		setIsEntered(false)
		setIsClosing(false)
		setStep('amount')
		setAmountInput(initialAmount?.trim() || '50.00')
		setSmartPay(true)
		setUsedManual(false)
		setSelected(new Set())
		setPayError('')
		setPayBusy(false)
		const frame = requestAnimationFrame(() => setIsEntered(true))
		return () => {
			cancelAnimationFrame(frame)
			setShowFooter(true)
			if (closeTimer.current) clearTimeout(closeTimer.current)
		}
	}, [open, initialAmount, setShowFooter])

	useEffect(() => {
		if (!open || !cardAddress) return
		registerCardAddresses([cardAddress])
		void getCardMetadataFromApi(cardAddress)
			.then((meta) => {
				if (meta?.name && !isGenericMerchantCardDisplayName(meta.name)) {
					setMerchantName(meta.name)
				}
				setMerchantIcon(pickNonFactoryMerchantAssetUrl(meta?.icon, meta?.image))
			})
			.catch(() => undefined)
	}, [open, cardAddress, registerCardAddresses])

	const loadQuoteAndRows = useCallback(async () => {
		if (!cardAddress || Number(fiatHuman) <= 0) {
			setQuotedUsdc6(0n)
			return
		}
		try {
			const q = await quoteFiat6ToUsdc6(cardAddress, String(cardCurrency || 'USD'), fiatHuman)
			setQuotedUsdc6(q.usdc6)
		} catch {
			setQuotedUsdc6(0n)
		}
		const eoa = profile.keyID
		if (eoa) {
			const bal = await readEoaConetUsdc6(eoa)
			if (bal !== null) setEoaUsdc6(bal)
		}
		setRowsLoading(true)
		try {
			const list = await loadReward13RowsForAa(profile, profile.aaAccount)
			setRows(list)
		} catch {
			/* keep last trusted rows */
		} finally {
			setRowsLoading(false)
		}
	}, [cardAddress, cardCurrency, fiatHuman, profile])

	useEffect(() => {
		if (!open) return
		if (step === 'pay' || step === 'select' || step === 'confirm') {
			void loadQuoteAndRows()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- reload on step enter only
	}, [open, step])

	const autoLegs = useMemo(
		() => (smartPay ? planAutoCoverUsdc(rows, quotedUsdc6) : []),
		[smartPay, rows, quotedUsdc6],
	)
	const manualLegs = useMemo(
		() => (smartPay ? planManualCoverUsdc(rows, selected, quotedUsdc6) : []),
		[smartPay, rows, selected, quotedUsdc6],
	)
	const legs: CoverLeg[] = !smartPay ? [] : usedManual ? manualLegs : autoLegs
	const coveredUsdc6 = sumUsdc6(legs)
	const cashUsdc6 = quotedUsdc6 > coveredUsdc6 ? quotedUsdc6 - coveredUsdc6 : 0n
	const usableRows = rows.filter((r) => r.redeemableUsdc6 > 0n)
	const fiatN = Number(fiatHuman)
	const coveredFiat =
		quotedUsdc6 > 0n ? (fiatN * Number(coveredUsdc6)) / Number(quotedUsdc6) : 0
	const cashFiat = Math.max(0, fiatN - coveredFiat)
	const availablePts6 = usableRows.reduce((sum, row) => sum + row.pointsBalance6, 0n)
	const merchantCount = usableRows.length

	const goPay = () => {
		if (Number(fiatHuman) <= 0) return
		setStep('pay')
	}

	const toggleSelect = (addr: string) => {
		const key = addr.toLowerCase()
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	const redeemLegsThenBuy = async () => {
		if (payBusy) return
		setPayBusy(true)
		setPayError('')
		try {
			const armor = resolveSigningPrivateKeyArmor(profile)
			if (!armor) throw new Error('Wallet key is required')
			const wallet = new ethers.Wallet(armor)
			const userEOA = wallet.address
			for (const leg of legs) {
				const verifying = await getCardFactoryGatewayForEip712(leg.cardAddress)
				const deadline = Math.floor(Date.now() / 1000) + 600
				const nonce = ethers.hexlify(ethers.randomBytes(32))
				const userSignature = await wallet.signTypedData(
					{
						name: 'BeamioUserCard',
						version: '1',
						chainId: CONET_MAINNET_CHAIN_ID,
						verifyingContract: verifying,
					},
					REDEEM_REWARD13_EIP712_TYPES,
					{
						card: ethers.getAddress(leg.cardAddress),
						userEOA,
						pointsCost: leg.pointsCost,
						usdcReward6: leg.usdcReward6,
						deadline: BigInt(deadline),
						nonce,
					},
				)
				const res = await fetch(`${beamioApi}/api/redeemReward13ForUsdc`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						cardAddress: ethers.getAddress(leg.cardAddress),
						userEOA,
						pointsCost: leg.pointsCost.toString(),
						usdcReward6: leg.usdcReward6.toString(),
						deadline,
						nonce,
						userSignature,
					}),
				})
				const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string }
				if (!res.ok || data.success === false) {
					throw new Error(data.error || 'Reward PT redemption failed')
				}
			}
			const buy = await postBuyCardPoints(
				ethers.formatUnits(quotedUsdc6, 6),
				{ ...profile, privateKeyArmor: armor },
				cardAddress,
			)
			if (!buy?.success) {
				throw new Error(buy?.error || 'Store credit purchase failed')
			}
			setMintedLabel(Number(fiatHuman).toFixed(2))
			setStep('success')
			onSuccess?.(buy.assets ?? undefined)
		} catch (e: unknown) {
			setPayError(e instanceof Error ? e.message : String(e))
		} finally {
			setPayBusy(false)
		}
	}

	if (!open) return null

	const dbName = resolveName(cardAddress)
	const displayMerchantName =
		dbName && !isGenericMerchantCardDisplayName(dbName) ? dbName : merchantName
	const displayMerchantIcon =
		resolveImage(cardAddress) || pickNonFactoryMerchantAssetUrl(merchantIcon) || ''
	const amountMatchesQuick = (q: string) => {
		const n = Number(amountInput.replace(/,/g, '').trim())
		return Number.isFinite(n) && n === Number(q)
	}
	const storeCreditsLabel = `${prefix}${Number(storeCreditsPoints || 0).toFixed(2)}`
	const heroDigitsWidth = Math.max(amountInput.replace(/,/g, '').trim().length, 4)

	const back = () => {
		if (payBusy) return
		if (step === 'amount') close()
		else if (step === 'pay') {
			setUsedManual(false)
			setStep('amount')
		}
		else if (step === 'select') setStep('pay')
		else if (step === 'confirm') setStep(usedManual ? 'select' : 'pay')
		else close()
	}

	const title =
		step === 'amount'
			? 'Top Up'
			: step === 'pay'
				? 'Payment'
				: step === 'select'
					? 'Select Points'
					: step === 'confirm'
						? 'Confirm Top-Up'
						: 'Top-Up Successful'

	return (
		<div
			className="fixed inset-0 z-[130] bg-[#F9F9FB] dark:bg-slate-950"
			style={{
				transform: isClosing || !isEntered ? 'translateX(100%)' : 'translateX(0)',
				transition: 'transform 300ms ease-out',
			}}
		>
			<div
				className="flex h-full flex-col overflow-y-auto"
				style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))' }}
			>
				<div className={`${BEAMIO_CIRCULAR_BACK_ROW_CLASS} px-4`}>
					<BeamioCircularBackButton variant="onLight" onClick={back} className="absolute left-4 top-0" />
				</div>
				{step !== 'amount' && step !== 'pay' ? (
					<header className="px-5 pb-6 pt-2">
						<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Store credits</p>
						<h1 className="mt-1 text-3xl font-semibold text-[#0F172A] dark:text-slate-100">{title}</h1>
					</header>
				) : null}

				<div className="flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
					{step === 'amount' && (
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="flex flex-1 flex-col items-center pt-8">
								{displayMerchantIcon ? (
									<IpfsImg
										src={displayMerchantIcon}
										alt=""
										className="h-20 w-20 rounded-full object-cover"
									/>
								) : (
									<div
										className="flex h-20 w-20 items-center justify-center rounded-full bg-[#eceef2] text-2xl font-bold text-slate-500"
										aria-hidden
									>
										{(displayMerchantName || 'M').trim().slice(0, 1).toUpperCase()}
									</div>
								)}
								<p className="mt-4 text-[22px] font-bold leading-tight text-[#111827] dark:text-slate-100">
									{displayMerchantName}
								</p>
								<p className="mt-1.5 text-[15px] font-medium text-[#8b919c]">
									Store Credits: {storeCreditsLabel}
								</p>
								<label htmlFor="merchant-topup-amount" className="sr-only">
									Amount
								</label>
								<div className="mt-12 inline-flex items-baseline justify-center border-b-2 border-[#9ec0ff] pb-1.5">
									<span className="shrink-0 text-[34px] font-bold text-[#9aa3b2]">{prefix}</span>
									<input
										id="merchant-topup-amount"
										type="number"
										inputMode="decimal"
										autoComplete="off"
										enterKeyHint="done"
										min={0}
										step="0.01"
										value={amountInput}
										onChange={(e) => setAmountInput(e.target.value)}
										onKeyDown={preventStepKeys}
										onWheel={(e) => {
											e.preventDefault()
											e.stopPropagation()
										}}
										className={`ml-1.5 bg-transparent p-0 text-[40px] font-bold leading-none tracking-tight text-[#111827] outline-none dark:text-slate-100 ${SPINNER_CLASS}`}
										style={{ width: `${heroDigitsWidth}ch` }}
									/>
								</div>
								<div className="mt-12 w-full max-w-md">
									<p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9aa3b2]">
										Quick amount
									</p>
									<div className="mt-3 grid grid-cols-2 gap-3">
										{QUICK.map((q) => {
											const selected = amountMatchesQuick(q)
											return (
												<button
													key={q}
													type="button"
													onClick={() => setAmountInput(Number(q).toFixed(2))}
													className={`rounded-2xl py-3.5 text-[16px] font-semibold transition ${
														selected
															? 'border border-[#3B66F5] bg-[#e8eeff] text-[#3B66F5]'
															: 'border border-transparent bg-[#f0f1f3] text-[#111827]'
													}`}
												>
													${q}
												</button>
											)
										})}
									</div>
								</div>
							</div>
							<button
								type="button"
								disabled={Number(fiatHuman) <= 0}
								onClick={goPay}
								className="mt-auto w-full rounded-2xl bg-[#3B66F5] py-4 text-[17px] font-bold text-white disabled:opacity-40"
							>
								Next
							</button>
						</div>
					)}

					{step === 'pay' && (
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="flex flex-col items-center pt-2">
								{displayMerchantIcon ? (
									<IpfsImg
										src={displayMerchantIcon}
										alt=""
										className="h-16 w-16 rounded-full object-cover"
									/>
								) : (
									<div
										className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eceef2] text-[20px] font-bold text-[#3B66F5]"
										aria-hidden
									>
										{merchantInitials(displayMerchantName)}
									</div>
								)}
								<p className="mt-3 text-[17px] font-semibold text-[#4b5563]">{displayMerchantName}</p>
								<p className="mt-1 text-[34px] font-bold tracking-tight text-[#111827]">
									{formatPrefixedFiat(prefix, formatFiatHero(fiatN))}
								</p>
							</div>

							<p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9aa3b2]">
								Payment Method
							</p>

							<div className="mt-3 overflow-hidden rounded-[22px] bg-gradient-to-b from-[#3B82F6] to-[#1D4ED8] p-4 text-white shadow-[0_12px_28px_rgba(29,78,216,0.28)]">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<Sparkles className="h-4 w-4 text-[#86efac]" strokeWidth={2.25} aria-hidden />
										<p className="text-[16px] font-bold">Smart Pay</p>
									</div>
									<span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold">
										<Check className="h-3 w-3" strokeWidth={2.75} aria-hidden />
										Active
									</span>
								</div>

								<div className="mt-4 flex items-center justify-between rounded-2xl border border-white/20 bg-black/15 px-3.5 py-3">
									<div>
										<p className="text-[15px] font-bold">Use Points</p>
										<p className="mt-0.5 text-[12px] text-white/75">
											{smartPay ? 'Toggle off for pure USDC' : 'Toggle on to use Reward PT'}
										</p>
									</div>
									<button
										type="button"
										role="switch"
										aria-checked={smartPay}
										aria-label="Use Points"
										disabled={payBusy}
										onClick={() => {
											setSmartPay((v) => !v)
											setUsedManual(false)
										}}
										className={`relative h-8 w-14 shrink-0 rounded-full transition ${
											smartPay ? 'bg-[#34C759]' : 'bg-white/30'
										}`}
									>
										<span
											className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${
												smartPay ? 'left-7' : 'left-1'
											}`}
										/>
									</button>
								</div>

								<p className="mt-3 text-[13px] leading-relaxed text-white/90">
									{smartPay
										? 'Points + USDC. Use available points, cover the rest with cash.'
										: 'Pay the full amount with USDC.'}
								</p>

								<div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-black/20 px-4 py-3">
									<div>
										<p className="text-[12px] text-white/70">Points Covered</p>
										<p className="mt-1 text-[18px] font-bold">
											{formatPrefixedFiat(prefix, coveredFiat.toFixed(2))}
										</p>
									</div>
									<div className="border-l border-white/15 pl-3">
										<p className="text-[12px] text-white/70">Cash Required</p>
										<p className="mt-1 text-[18px] font-bold">
											{formatPrefixedFiat(prefix, cashFiat.toFixed(2))}
										</p>
									</div>
								</div>
							</div>

							{smartPay ? (
								<button
									type="button"
									onClick={() => {
										setUsedManual(true)
										setStep('select')
									}}
									disabled={payBusy || rowsLoading || usableRows.length === 0}
									className="mt-3 flex w-full items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-3.5 py-3.5 text-left disabled:opacity-40"
								>
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8eeff] text-[#3B66F5]">
										<SlidersHorizontal className="h-5 w-5" strokeWidth={2.2} aria-hidden />
									</span>
									<span className="min-w-0 flex-1">
										<span className="block text-[15px] font-bold text-[#111827]">
											Choose Points Manually
										</span>
										<span className="mt-0.5 block text-[13px] text-[#8b919c]">
											{rowsLoading
												? 'Loading available points…'
												: `Available: ${formatPtsShort(availablePts6)} Pts (from ${merchantCount} merchant${
														merchantCount === 1 ? '' : 's'
													})`}
										</span>
									</span>
									<ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
								</button>
							) : null}

							{payError ? (
								<div
									role="alert"
									className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800"
								>
									<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
									<p>{payError}</p>
								</div>
							) : null}

							<button
								type="button"
								disabled={payBusy || quotedUsdc6 <= 0n}
								aria-busy={payBusy}
								onClick={() => void redeemLegsThenBuy()}
								className="mt-auto w-full rounded-2xl bg-[#3B66F5] py-4 text-[17px] font-bold text-white disabled:opacity-40"
							>
								{payBusy ? (
									<span className="inline-flex items-center justify-center gap-2">
										<Loader2 className="h-5 w-5 animate-spin" aria-hidden />
										Confirm Top Up
									</span>
								) : (
									'Confirm Top Up'
								)}
							</button>
						</div>
					)}

					{step === 'select' && (
						<>
							<p className="mb-3 text-sm text-slate-500">
								Only Reward PT that this program can pay out in CONET-USDC is listed.
							</p>
							<div className="space-y-2">
								{usableRows.map((row) => {
									const key = row.cardAddress.toLowerCase()
									const on = selected.has(key)
									return (
										<label
											key={row.cardAddress}
											className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
										>
											<input
												type="checkbox"
												checked={on}
												onChange={() => toggleSelect(row.cardAddress)}
												className="h-4 w-4"
											/>
											{row.icon ? (
												<IpfsImg src={row.icon} alt="" className="h-10 w-10 rounded-full object-cover" />
											) : (
												<div className="h-10 w-10 rounded-full bg-slate-200" />
											)}
											<div className="min-w-0 flex-1">
												<p className="truncate font-semibold">{row.name}</p>
												<p className="text-xs text-slate-500">
													{formatPtsHuman(row.pointsBalance6)} PT · up to ${formatUsdc(row.redeemableUsdc6)}
												</p>
											</div>
										</label>
									)
								})}
								{usableRows.length === 0 && (
									<p className="text-sm text-slate-500">No redeemable Reward PT is available yet.</p>
								)}
							</div>
							<button
								type="button"
								onClick={() => {
									setUsedManual(true)
									setStep('pay')
								}}
								className="mt-6 w-full rounded-full bg-[#0051d1] py-3.5 text-base font-semibold text-white"
							>
								Next
							</button>
						</>
					)}

					{step === 'confirm' && (
						<>
							<div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
								<div className="flex justify-between">
									<span className="text-slate-500">Top-Up Value</span>
									<span className="font-semibold">
										{prefix}
										{Number(fiatHuman).toFixed(2)}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-500">Selected Points</span>
									<span className="font-semibold">${formatUsdc(coveredUsdc6)}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-500">USDC Required</span>
									<span className="font-semibold">${formatUsdc(cashUsdc6)}</span>
								</div>
								{eoaUsdc6 !== null && (
									<div className="flex justify-between text-xs text-slate-400">
										<span>EOA CONET-USDC</span>
										<span>${formatUsdc(eoaUsdc6)}</span>
									</div>
								)}
							</div>
							{payError ? <p className="mt-3 text-sm text-red-600">{payError}</p> : null}
							<button
								type="button"
								disabled={payBusy || quotedUsdc6 <= 0n}
								aria-busy={payBusy}
								onClick={() => void redeemLegsThenBuy()}
								className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#0051d1] py-3.5 text-base font-semibold text-white disabled:opacity-40"
							>
								{payBusy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
								Pay
							</button>
						</>
					)}

					{step === 'success' && (
						<div className="flex flex-1 flex-col items-center pt-8 text-center">
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
								<Check className="h-8 w-8" strokeWidth={2.5} />
							</div>
							<p className="mt-6 text-2xl font-semibold">Top-Up Successful</p>
							<p className="mt-2 text-slate-600">
								+{mintedLabel} Store Credits Minted
							</p>
							<div className="mt-auto w-full space-y-3 pb-4">
								<button
									type="button"
									className="w-full rounded-full border border-slate-200 bg-white py-3.5 text-base font-semibold"
									onClick={() => {
										void navigator.share?.({ title: 'Beamio', text: 'Share & Earn' }).catch(() => undefined)
									}}
								>
									Share & Earn
								</button>
								<button
									type="button"
									onClick={close}
									className="w-full rounded-full bg-[#0051d1] py-3.5 text-base font-semibold text-white"
								>
									Done
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
