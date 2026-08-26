import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { ethers } from 'ethers'
import {
	BeamioCircularBackButton,
	BEAMIO_CIRCULAR_BACK_ROW_CLASS,
} from '@/components/BeamioCircularBackButton'
import { IpfsImg } from '@/components/IpfsImg'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { getCardMetadataFromApi, postBuyCardPoints } from '@/services/BeamioCard'
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
	const [isEntered, setIsEntered] = useState(false)
	const [isClosing, setIsClosing] = useState(false)
	const [step, setStep] = useState<Step>('amount')
	const [amountInput, setAmountInput] = useState('20')
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
		setAmountInput(initialAmount?.trim() || '20')
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
		void getCardMetadataFromApi(cardAddress)
			.then((meta) => {
				if (meta?.name) setMerchantName(meta.name)
				setMerchantIcon(meta?.icon || meta?.image)
			})
			.catch(() => undefined)
	}, [open, cardAddress])

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
			className="fixed inset-0 z-[130] bg-[#f4f6f8] dark:bg-slate-950"
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
				<header className="px-5 pb-6 pt-2">
					<p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Store credits</p>
					<h1 className="mt-1 text-3xl font-semibold text-[#0F172A] dark:text-slate-100">{title}</h1>
				</header>

				<div className="flex flex-1 flex-col px-5 pb-8">
					{step === 'amount' && (
						<>
							<div className="flex items-center gap-3">
								{merchantIcon ? (
									<IpfsImg src={merchantIcon} alt="" className="h-12 w-12 rounded-full object-cover" />
								) : (
									<div className="h-12 w-12 rounded-full bg-slate-200" />
								)}
								<div>
									<p className="text-base font-semibold">{merchantName}</p>
									<p className="text-sm text-slate-500">
										Store Credits {Number(storeCreditsPoints || 0).toFixed(2)}
									</p>
								</div>
							</div>
							<p className="mt-10 text-center text-5xl font-semibold tracking-tight">
								{prefix}
								{Number(fiatHuman || 0).toFixed(2)}
							</p>
							<label htmlFor="merchant-topup-amount" className="sr-only">
								Amount
							</label>
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
								className={`mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-lg ${SPINNER_CLASS}`}
							/>
							<p className="mt-6 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
								Quick amount
							</p>
							<div className="mt-3 grid grid-cols-4 gap-2">
								{QUICK.map((q) => (
									<button
										key={q}
										type="button"
										onClick={() => setAmountInput(q)}
										className={`rounded-full border py-2 text-sm font-semibold ${
											amountInput === q
												? 'border-[#0051d1] bg-[#e9edff] text-[#0051d1]'
												: 'border-slate-200 bg-white text-slate-700'
										}`}
									>
										{prefix}
										{q}
									</button>
								))}
							</div>
							<button
								type="button"
								disabled={Number(fiatHuman) <= 0}
								onClick={goPay}
								className="mt-10 w-full rounded-full bg-[#0051d1] py-3.5 text-base font-semibold text-white disabled:opacity-40"
							>
								Next
							</button>
						</>
					)}

					{step === 'pay' && (
						<>
							<div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4">
								<div>
									<p className="text-sm font-semibold">Smart Pay</p>
									<p className="text-xs text-slate-500">Use Reward PT (#13) plus CONET-USDC</p>
								</div>
								<button
									type="button"
									role="switch"
									aria-checked={smartPay}
									onClick={() => {
										setSmartPay((v) => !v)
										setUsedManual(false)
									}}
									className={`relative h-8 w-14 rounded-full ${smartPay ? 'bg-[#8d3a8b]' : 'bg-slate-300'}`}
								>
									<span
										className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
											smartPay ? 'left-7' : 'left-1'
										}`}
									/>
								</button>
							</div>
							<div className="mt-4 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
								<div className="flex justify-between">
									<span className="text-slate-500">Points Covered</span>
									<span className="font-semibold">${formatUsdc(coveredUsdc6)}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-500">Cash Required</span>
									<span className="font-semibold">${formatUsdc(cashUsdc6)}</span>
								</div>
							</div>
							{smartPay && (
								<button
									type="button"
									onClick={() => {
										setUsedManual(true)
										setStep('select')
									}}
									disabled={rowsLoading || usableRows.length === 0}
									className="mt-4 w-full rounded-full border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-800 disabled:opacity-40"
								>
									Choose Points Manually
								</button>
							)}
							<button
								type="button"
								onClick={() => setStep('confirm')}
								className="mt-6 w-full rounded-full bg-[#0051d1] py-3.5 text-base font-semibold text-white"
							>
								Next
							</button>
						</>
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
									setStep('confirm')
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
