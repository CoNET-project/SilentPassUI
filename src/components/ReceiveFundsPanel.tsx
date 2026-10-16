/**
 * Shared Receive USDC panel — Base network + USDC only.
 * Modes: Wallet QR (address-only) | Request amount (EIP-681 transfer QR).
 * Used by Home Fund sheet and /wallet Receive Funds.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Delete, Share2 } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { IpfsImg } from '@/components/IpfsImg'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { RELIABLE_TAP_BUTTON_CLASS, useReliableTapHandler } from '@/utils/reliableTap'
import { tu } from '@/locale/beamioLocale'
import {
	buildReceiveEoaQrUri,
	parseReceiveUsdcAmount6,
} from '@/utils/receiveFromWalletApps'
import baseIcon from '@/components/assets/base-logo.png'
import usdcIcon from '@/components/assets/usdc.png'

/** Transparent 1×1 GIF — excavate only; avatar is overlaid as a 50px circle. */
const QR_CENTER_EXCAVATE_PIXEL =
	'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='
const QR_CENTER_AVATAR_PX = 50

function ReceiveQrWithBeamioAvatar({
	value,
	size,
	bgColor,
	avatarSrc,
}: {
	value: string
	size: number
	bgColor: string
	avatarSrc: string
}) {
	const avatarPx = QR_CENTER_AVATAR_PX
	const src = String(avatarSrc || '').trim()
	/** DiceBear / http(s) can paint with plain <img>; IPFS fragments need IpfsImg. */
	const usePlainImg =
		Boolean(src) &&
		(src.startsWith('data:') ||
			src.startsWith('blob:') ||
			src.includes('api.dicebear.com') ||
			(/^https?:\/\//i.test(src) && !/ipfs\.conet\.network|beamio\.app\/api\/fragment/i.test(src)))
	return (
		<div className="relative h-full w-full max-w-full">
			<QRCodeCanvas
				key={`receive-qr:${value}:${src.slice(0, 64)}:${avatarPx}`}
				value={value}
				size={size}
				level="H"
				includeMargin={false}
				bgColor={bgColor}
				fgColor="#0f172a"
				className="h-full w-full max-w-full"
				style={{ height: size, width: size }}
				imageSettings={{
					src: QR_CENTER_EXCAVATE_PIXEL,
					height: avatarPx,
					width: avatarPx,
					excavate: true,
				}}
			/>
			<span
				className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full"
				style={{ width: avatarPx, height: avatarPx }}
				aria-hidden
			>
				{usePlainImg ? (
					<img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
				) : src ? (
					<IpfsImg
						src={src}
						alt=""
						className="h-full w-full object-cover"
						draggable={false}
					/>
				) : null}
			</span>
		</div>
	)
}

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

	const { beamio } = useDaemonContext()
	const {
		lookupByAddress,
		resolveTagPlain,
		avatarImgUrl,
		ensureProfilesForAddresses,
	} = useBeamioTagDatabase()

	const eoaTrim = (eoa ?? '').trim()

	useEffect(() => {
		if (!eoaTrim) return
		void ensureProfilesForAddresses([eoaTrim])
	}, [eoaTrim, ensureProfilesForAddresses])

	/** Center QR with BeamioTag avatar (profile image → DiceBear from @tag). */
	const beamioTagAvatarSrc = useMemo(() => {
		const fromProfile = beamio?.image != null ? String(beamio.image).trim() : ''
		const fromDb = (lookupByAddress(eoaTrim)?.image ?? '').trim()
		if (fromProfile) return fromProfile
		if (fromDb) return fromDb
		const tag =
			resolveTagPlain(eoaTrim) ||
			String(beamio?.accountName ?? '')
				.trim()
				.replace(/^@+/, '')
		return avatarImgUrl(tag || undefined, eoaTrim || undefined)
	}, [
		avatarImgUrl,
		beamio?.accountName,
		beamio?.image,
		eoaTrim,
		lookupByAddress,
		resolveTagPlain,
	])

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

	const sharePaymentLink = useCallback(async () => {
		const value = activeQrUri.trim()
		if (!value) return
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share({
					title: tu('receive_usdc_title'),
					text: tu('receive_share_payer_hint'),
					url: value,
				})
				return
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return
		}
		await copyText(value, 'uri')
	}, [activeQrUri, copyText])

	const createRequestTap = useReliableTapHandler(createRequest)
	const sharePaymentTap = useReliableTapHandler(() => {
		void sharePaymentLink()
	})

	const displayAmount = amount || '0'

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
					{!eoaTrim || !activeQrUri ? (
						<p className="py-8 text-center text-sm text-amber-600 dark:text-amber-400" role="alert">
							{tu('wallet_address_unavailable')}
						</p>
					) : mode === 'request-amount' && showRequestQr ? (
						<>
							<div className="mb-5 shrink-0 text-center">
								<p className="mb-1 text-[13px] font-medium text-slate-400 dark:text-slate-500">
									{tu('receive_requested_amount_label')}
								</p>
								<p className="text-[32px] font-bold leading-none tracking-tight text-slate-900 dark:text-slate-50">
									{tu('receive_wallet_usdc_preview', { amount: displayAmount })}
								</p>
							</div>

							<div className="mx-auto mb-4 flex aspect-square w-full max-w-[260px] items-center justify-center rounded-[28px] border border-slate-100 bg-[#f8fafc] p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
								<ReceiveQrWithBeamioAvatar
									value={activeQrUri}
									size={220}
									bgColor="#f8fafc"
									avatarSrc={beamioTagAvatarSrc}
								/>
							</div>

							<div className="mb-3 flex justify-center">
								<span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[13px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
									<img
										src={baseIcon}
										alt=""
										className="h-4 w-4 rounded-full object-contain"
										aria-hidden
									/>
									{tu('receive_base_network')}
								</span>
							</div>

							<p className="mb-5 shrink-0 text-center text-[13px] leading-snug text-slate-500 dark:text-slate-400">
								{tu('receive_share_payer_hint')}
							</p>

							<button
								type="button"
								tabIndex={-1}
								aria-label={
									copiedKind === 'uri'
										? tu('copied')
										: tu('receive_share_payment_link')
								}
								className={[
									'mt-auto flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[#0051d1] text-[16px] font-semibold text-white',
									'shadow-[0_8px_20px_rgba(0,81,209,0.28)]',
									RELIABLE_TAP_BUTTON_CLASS,
									'transition active:scale-[0.99]',
								].join(' ')}
								onPointerDown={sharePaymentTap.onPointerDown}
								onPointerUp={sharePaymentTap.onPointerUp}
								onClick={sharePaymentTap.onClick}
							>
								{copiedKind === 'uri' ? (
									<Check className="h-4 w-4 text-emerald-300" aria-hidden />
								) : (
									<Share2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
								)}
								{tu('receive_share_payment_link')}
							</button>
						</>
					) : (
						<>
							<div className="mx-auto mb-4 flex aspect-square w-full max-w-[240px] items-center justify-center rounded-2xl border border-slate-100 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950">
								<ReceiveQrWithBeamioAvatar
									value={activeQrUri}
									size={216}
									bgColor="#ffffff"
									avatarSrc={beamioTagAvatarSrc}
								/>
							</div>

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

							{showingQr ? (
								<button
									type="button"
									tabIndex={-1}
									aria-label={
										copiedKind === 'uri'
											? tu('copied')
											: tu('receive_share_payment_link')
									}
									className={[
										'flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0051d1] text-[16px] font-semibold text-white',
										'shadow-[0_8px_20px_rgba(0,81,209,0.28)]',
										RELIABLE_TAP_BUTTON_CLASS,
										'transition active:scale-[0.99]',
									].join(' ')}
									onPointerDown={sharePaymentTap.onPointerDown}
									onPointerUp={sharePaymentTap.onPointerUp}
									onClick={sharePaymentTap.onClick}
								>
									{copiedKind === 'uri' ? (
										<Check className="h-4 w-4 text-emerald-300" aria-hidden />
									) : (
										<Share2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
									)}
									{tu('receive_share_payment_link')}
								</button>
							) : null}
						</>
					)}
				</div>
			)}
		</div>
	)
}
