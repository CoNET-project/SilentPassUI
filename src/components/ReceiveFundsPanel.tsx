/**
 * Shared Receive USDC panel — Base network + USDC only.
 * Modes: Wallet QR (address-only) | Request amount (EIP-681 transfer QR).
 * Used by Home Fund sheet and /wallet Receive Funds.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Delete } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { RELIABLE_TAP_BUTTON_CLASS, useReliableTapHandler } from '@/utils/reliableTap'
import { tu } from '@/locale/beamioLocale'
import {
	buildReceiveEoaQrUri,
	parseReceiveUsdcAmount6,
} from '@/utils/receiveFromWalletApps'
import baseIcon from '@/components/assets/base-logo.png'
import usdcIcon from '@/components/assets/usdc.png'

export type ReceiveFundsMode = 'wallet-qr' | 'request-amount'

type AmountPadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back'

const AMOUNT_PAD_KEYS: AmountPadKey[] = [
	'1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back',
]

const DEFAULT_AMOUNT = '2'

function applyAmountPadKey(current: string, key: AmountPadKey): string {
	if (key === 'back') return current.slice(0, -1)
	if (key === '.') {
		if (!current) return '0.'
		if (current.includes('.')) return current
		return `${current}.`
	}
	const next = !current || current === '0' ? key : `${current}${key}`
	const [intPart, frac] = next.split('.')
	if (intPart.length > 9) return current
	if (frac !== undefined && frac.length > 2) return current
	return next
}

function shortAddress(address: string): string {
	const a = address.trim()
	if (a.length < 12) return a
	return `${a.slice(0, 6)}…${a.slice(-4)}`
}

type ReceiveFundsPanelProps = {
	eoa: string
	onBack: () => void
	/** Initial tab when the panel opens. */
	initialMode?: ReceiveFundsMode
	className?: string
}

export default function ReceiveFundsPanel({
	eoa,
	onBack,
	initialMode = 'request-amount',
	className = '',
}: ReceiveFundsPanelProps) {
	const [mode, setMode] = useState<ReceiveFundsMode>(initialMode)
	const [amount, setAmount] = useState(DEFAULT_AMOUNT)
	const [showRequestQr, setShowRequestQr] = useState(false)
	const [amountError, setAmountError] = useState('')
	const [copiedKind, setCopiedKind] = useState<'address' | 'uri' | null>(null)

	const addressOnlyUri = useMemo(() => buildReceiveEoaQrUri(eoa), [eoa])
	const requestQrUri = useMemo(() => {
		const parsed = parseReceiveUsdcAmount6(amount.replace(/\.$/, ''))
		return buildReceiveEoaQrUri(eoa, parsed.ok ? parsed.amount6 : undefined)
	}, [amount, eoa])

	const activeQrUri = mode === 'wallet-qr' ? addressOnlyUri : requestQrUri
	const showingQr = mode === 'wallet-qr' || showRequestQr

	useEffect(() => {
		if (!copiedKind) return
		const t = window.setTimeout(() => setCopiedKind(null), 2000)
		return () => window.clearTimeout(t)
	}, [copiedKind])

	const selectMode = useCallback((next: ReceiveFundsMode) => {
		setMode(next)
		setAmountError('')
		if (next === 'wallet-qr') {
			setShowRequestQr(false)
		}
	}, [])

	const applyPad = useCallback((key: AmountPadKey) => {
		if (showRequestQr) return
		setAmount((prev) => applyAmountPadKey(prev, key))
		if (amountError) setAmountError('')
	}, [amountError, showRequestQr])

	const createRequest = useCallback(() => {
		const parsed = parseReceiveUsdcAmount6(amount.replace(/\.$/, ''))
		if (!parsed.ok) {
			setAmountError(parsed.error)
			return
		}
		if (!eoa?.trim()) {
			setAmountError(tu('wallet_address_unavailable'))
			return
		}
		setAmountError('')
		setShowRequestQr(true)
	}, [amount, eoa])

	const backFromRequestQr = useCallback(() => {
		setShowRequestQr(false)
	}, [])

	const handleHeaderBack = useCallback(() => {
		if (mode === 'request-amount' && showRequestQr) {
			backFromRequestQr()
			return
		}
		onBack()
	}, [backFromRequestQr, mode, onBack, showRequestQr])

	const copyText = useCallback(async (text: string, kind: 'address' | 'uri') => {
		const value = text.trim()
		if (!value) return
		try {
			await navigator.clipboard.writeText(value)
			setCopiedKind(kind)
		} catch {
			/* ignore */
		}
	}, [])

	const createRequestTap = useReliableTapHandler(createRequest)

	const displayAmount = amount || '0'
	const eoaTrim = eoa?.trim() ?? ''

	return (
		<div className={`flex min-h-0 w-full max-w-md flex-1 flex-col px-5 ${className}`.trim()}>
			<div className="relative mb-3 flex min-h-11 shrink-0 items-center justify-center">
				<BeamioCircularBackButton
					variant="onLight"
					ariaLabel={tu('back')}
					className="absolute left-0 top-1/2 z-10 -translate-y-1/2"
					onClick={handleHeaderBack}
				/>
				<h2 className="pointer-events-none px-14 text-center text-[17px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
					{tu('receive_usdc_title')}
				</h2>
			</div>

			{!(mode === 'request-amount' && showRequestQr) ? (
				<div
					className="mx-auto mb-3 flex w-full max-w-sm shrink-0 rounded-full bg-slate-100 p-1 dark:bg-slate-800"
					role="tablist"
					aria-label={tu('receive_usdc_title')}
				>
					{(
						[
							{ id: 'wallet-qr' as const, label: tu('receive_wallet_qr_tab') },
							{ id: 'request-amount' as const, label: tu('receive_request_amount_tab') },
						] as const
					).map((tab) => {
						const active = mode === tab.id
						return (
							<button
								key={tab.id}
								type="button"
								role="tab"
								aria-selected={active}
								tabIndex={-1}
								className={[
									'flex-1 rounded-full px-3 py-2.5 text-[13px] font-semibold transition',
									RELIABLE_TAP_BUTTON_CLASS,
									active
										? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
										: 'text-slate-500 dark:text-slate-400',
								].join(' ')}
								onClick={() => selectMode(tab.id)}
							>
								{tab.label}
							</button>
						)
					})}
				</div>
			) : null}

			{mode === 'request-amount' && !showRequestQr ? (
				<>
					<p className="mb-4 shrink-0 text-center text-[13px] leading-snug text-slate-500 dark:text-slate-400">
						{tu('receive_request_amount_hint')}
					</p>

					<div className="mb-2 flex min-h-0 flex-1 flex-col items-center justify-center">
						<p className="mb-1 text-[13px] font-medium text-slate-400 dark:text-slate-500">
							{tu('receive_amount_label')}
						</p>
						<p className="text-[48px] font-bold leading-none tracking-tight text-slate-900 dark:text-slate-50">
							{displayAmount}
						</p>
						<div className="mt-2 flex items-center gap-1.5">
							<img src={baseIcon} alt="" className="h-4 w-4 rounded-full object-contain" aria-hidden />
							<span className="text-[15px] font-semibold text-slate-600 dark:text-slate-300">USDC</span>
							<img src={usdcIcon} alt="" className="h-4 w-4 rounded-full object-contain" aria-hidden />
						</div>
						{amountError ? (
							<p className="mt-3 max-w-sm text-center text-[13px] font-medium text-amber-600 dark:text-amber-400" role="alert">
								{amountError}
							</p>
						) : null}
					</div>

					<div className="mb-3 grid w-full shrink-0 grid-cols-3 gap-2">
						{AMOUNT_PAD_KEYS.map((key) => (
							<button
								key={key}
								type="button"
								tabIndex={-1}
								aria-label={
									key === 'back'
										? tu('coinbase_keypad_delete')
										: key === '.'
											? tu('coinbase_keypad_decimal')
											: key
								}
								className={[
									'flex h-12 items-center justify-center rounded-xl bg-slate-100 text-[22px] font-semibold text-slate-900',
									'dark:bg-slate-800 dark:text-slate-100',
									RELIABLE_TAP_BUTTON_CLASS,
									'transition active:scale-[0.98]',
								].join(' ')}
								onClick={() => applyPad(key)}
							>
								{key === 'back' ? <Delete className="h-5 w-5" strokeWidth={2.25} aria-hidden /> : key}
							</button>
						))}
					</div>

					<button
						type="button"
						tabIndex={-1}
						aria-label={tu('receive_create_request')}
						className={[
							'flex h-12 w-full shrink-0 items-center justify-center rounded-2xl bg-[#0051d1] text-[16px] font-semibold text-white',
							'shadow-[0_8px_20px_rgba(0,81,209,0.28)]',
							RELIABLE_TAP_BUTTON_CLASS,
							'transition active:scale-[0.99] disabled:opacity-50',
						].join(' ')}
						disabled={!eoaTrim}
						onPointerDown={createRequestTap.onPointerDown}
						onPointerUp={createRequestTap.onPointerUp}
						onClick={createRequestTap.onClick}
					>
						{tu('receive_create_request')}
					</button>
				</>
			) : (
				<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-1">
					{mode === 'wallet-qr' ? (
						<p className="mb-3 shrink-0 text-center text-[13px] leading-snug text-slate-500 dark:text-slate-400">
							{tu('receive_wallet_qr_hint')}
						</p>
					) : (
						<p className="mb-3 shrink-0 text-center text-[13px] leading-snug text-slate-500 dark:text-slate-400">
							{tu('receive_qr_hint')}
						</p>
					)}

					{!eoaTrim || !activeQrUri ? (
						<p className="py-8 text-center text-sm text-amber-600 dark:text-amber-400" role="alert">
							{tu('wallet_address_unavailable')}
						</p>
					) : (
						<>
							<div className="mx-auto mb-4 flex aspect-square w-full max-w-[240px] items-center justify-center rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950">
								<QRCodeCanvas
									value={activeQrUri}
									size={216}
									level="M"
									includeMargin={false}
									bgColor="#ffffff"
									fgColor="#0f172a"
									className="h-full w-full max-w-full"
								/>
							</div>

							{mode === 'request-amount' && showRequestQr ? (
								<div className="mb-3 text-center">
									<p className="text-[28px] font-bold tracking-tight text-slate-900 dark:text-slate-50">
										${displayAmount}
									</p>
									<p className="mt-0.5 text-[14px] font-medium text-slate-500 dark:text-slate-400">
										{tu('receive_wallet_usdc_preview', { amount: displayAmount })}
									</p>
								</div>
							) : null}

							<div className="mb-3 flex justify-center">
								<button
									type="button"
									tabIndex={-1}
									aria-label={
										copiedKind === 'address'
											? tu('copied')
											: tu('copy_wallet_address')
									}
									className={[
										'inline-flex max-w-full items-center gap-2 rounded-full border border-[#dce2f7] bg-[#e9edff] px-3 py-2',
										'font-mono text-[13px] font-medium text-[#424655]',
										'dark:border-[#0051d1]/35 dark:bg-[#0051d1]/15 dark:text-slate-200',
										RELIABLE_TAP_BUTTON_CLASS,
										'transition active:scale-[0.98]',
									].join(' ')}
									onClick={() => void copyText(eoaTrim, 'address')}
								>
									<img
										src={baseIcon}
										alt=""
										className="h-3.5 w-3.5 shrink-0 rounded-full object-contain"
										aria-hidden
									/>
									<span className="truncate">{shortAddress(eoaTrim)}</span>
									{copiedKind === 'address' ? (
										<Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
									) : (
										<Copy className="h-3.5 w-3.5 shrink-0 text-[#0051d1]" aria-hidden />
									)}
								</button>
							</div>

							{showingQr && activeQrUri ? (
								<button
									type="button"
									tabIndex={-1}
									aria-label={tu('copy_payment_link')}
									className={[
										'flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-[14px] font-semibold text-slate-700',
										'dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200',
										RELIABLE_TAP_BUTTON_CLASS,
										'transition active:scale-[0.99]',
									].join(' ')}
									onClick={() => void copyText(activeQrUri, 'uri')}
								>
									{copiedKind === 'uri' ? (
										<Check className="h-4 w-4 text-emerald-500" aria-hidden />
									) : (
										<Copy className="h-4 w-4" aria-hidden />
									)}
									{tu('copy_payment_link')}
								</button>
							) : null}
						</>
					)}
				</div>
			)}
		</div>
	)
}
