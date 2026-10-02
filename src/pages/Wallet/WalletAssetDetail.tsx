/**
 * Asset detail opened from the Wallet grid.
 * Themes: usdc, credits, points, units.
 */

import React, { useEffect, useState } from 'react'
import storeCreditsLogo from '@/assets/store-credits-logo.png'
import rewardPtLogo from '@/assets/reward-pt-logo.png'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { getBUnitLedgerFromIndexer, type BUnitLedgerEntry } from '@/services/BeamioCard'
import type { TxView } from '@/pages/History/recentActivityIndexerMerge'

export type WalletAssetKind = 'usdc' | 'credits' | 'points' | 'units'

export type WalletAssetActionId =
	| 'buy-card'
	| 'buy-coinbase'
	| 'from-wallet'
	| 'receive-usdc'
	| 'topup-pay'
	| 'discover'
	| 'store-cards'
	| 'offers'
	| 'redeem-pt'
	| 'earn-pt'
	| 'my-rewards'
	| 'bunit-topup'
	| 'bunit-learn'
	| 'more-activity'

type ActivityRow = {
	id: string
	title: string
	date: string
	value: string
	positive: boolean
	icon: string
}

const ASSET_LOGO_WASH_STYLE = {
	background: 'linear-gradient(145deg, rgba(255,255,255,.95) 0%, rgba(255,255,255,.42) 34%, transparent 62%)',
}

function AssetLogoWash({ className, children }: { className: string; children: React.ReactNode }) {
	return (
		<span className={`relative z-[5] -translate-y-1 ${className}`}>
			{children}
			<span className="pointer-events-none absolute inset-0 rounded-full" style={ASSET_LOGO_WASH_STYLE} aria-hidden />
		</span>
	)
}

const THEME: Record<WalletAssetKind, { accent: string; soft: string; glow: string; pageA: string; pageB: string }> = {
	usdc: { accent: '#0875f9', soft: '#e4f3ff', glow: 'rgba(34, 139, 255, .28)', pageA: '#f6fbff', pageB: '#e6f5ff' },
	credits: { accent: '#00b981', soft: '#e2fff3', glow: 'rgba(0, 218, 155, .23)', pageA: '#f5fffb', pageB: '#e4fff5' },
	points: { accent: '#ffad00', soft: '#fff5d9', glow: 'rgba(255, 185, 20, .28)', pageA: '#fffdf5', pageB: '#fff6dc' },
	units: { accent: '#8a32ef', soft: '#f1e5ff', glow: 'rgba(151, 73, 255, .26)', pageA: '#fcf9ff', pageB: '#f2eaff' },
}

function formatWhen(ms: number): string {
	if (!Number.isFinite(ms) || ms <= 0) return ''
	return new Date(ms).toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	})
}

function formatSignedFiat(tx: TxView, positive: boolean): string {
	const code = (tx.currencyCode || 'CAD').toUpperCase()
	const prefix =
		code === 'CAD' ? 'CA$'
		: code === 'USD' || code === 'USDC' ? '$'
		: code === 'EUR' ? '€'
		: code === 'JPY' ? 'JP¥'
		: code === 'CNY' ? 'CN¥'
		: code === 'HKD' ? 'HK$'
		: code === 'SGD' ? 'SG$'
		: code === 'TWD' ? 'NT$'
		: `${code} `
	const amount = Math.abs(Number(tx.amountFiat) || 0)
	const body = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
	return `${positive ? '+' : '-'}${prefix} ${body}`
}

function rewardPtFromTx(tx: TxView): number {
	const raw = Number(tx.merchantChargeRewardPoint6 ?? 0)
	if (!Number.isFinite(raw) || raw <= 0) return 0
	return raw / 1_000_000
}

function rowsFromTx(kind: WalletAssetKind, items: TxView[]): ActivityRow[] {
	const out: ActivityRow[] = []
	for (const tx of items) {
		if (kind === 'usdc') {
			const allowed = tx.type === 'transfer_in' || tx.type === 'transfer_out' || tx.type === 'request_fulfilled' || tx.type === 'internal_transfer' || tx.type === 'fuel_yield'
			const amount = Math.abs(Number(tx.amountUSDC) || 0)
			if (!allowed || amount < 0.00005) continue
			const body = amount.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
			out.push({
				id: tx.id,
				title: tx.title || (tx.isInbound ? 'Received' : 'Sent'),
				date: formatWhen(tx.timestampMs),
				value: `${tx.isInbound ? '+' : '-'}${body} USDC`,
				positive: tx.isInbound,
				icon: tx.isInbound ? '↓' : '◉',
			})
		} else if (kind === 'credits') {
			const allowed = tx.type === 'topup' || tx.type === 'merchant_pay' || tx.type === 'merchant_gift' || tx.type === 'voucher_burn'
			const amount = Math.abs(Number(tx.amountFiat) || 0)
			if (!allowed || amount <= 0) continue
			const positive =
				tx.type === 'topup' ? true
				: tx.type === 'merchant_pay' || tx.type === 'voucher_burn' ? false
				: tx.isInbound
			out.push({
				id: tx.id,
				title: tx.title || (tx.type === 'topup' ? 'Top up' : 'Payment'),
				date: formatWhen(tx.timestampMs),
				value: formatSignedFiat(tx, positive),
				positive,
				icon: positive ? '↑' : '▦',
			})
		} else if (kind === 'points') {
			const pt = rewardPtFromTx(tx)
			if (pt <= 0) continue
			const body = pt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
			out.push({
				id: tx.id,
				title: 'Earned',
				date: formatWhen(tx.timestampMs),
				value: `+${body} PT`,
				positive: true,
				icon: '★',
			})
		}
		if (out.length >= 4) break
	}
	return out
}

function rowsFromBUnits(entries: BUnitLedgerEntry[]): ActivityRow[] {
	return entries.slice(0, 4).map((entry) => {
		const positive = entry.amount > 0
		const body = Math.abs(entry.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
		const title = entry.title === 'BUnit Claim' && entry.subtitle === 'Free claim' ? 'Network Welcome Grant' : entry.title
		return {
			id: entry.id,
			title: title || (positive ? 'Issued' : 'Used'),
			date: formatWhen(entry.timestamp) || entry.time,
			value: `${positive ? '+' : '-'}${body} B-Units`,
			positive,
			icon: positive ? '↓' : '◉',
		}
	})
}

export default function WalletAssetDetail({
	kind,
	onClose,
	onAction,
	account,
	activity,
	usdcBalance,
	usdcFiat,
	usdcRateLabel,
	storeBalance,
	merchantCount,
	rewardBalance,
	rewardMerchantCount,
	bUnitBalance,
	bUnitFiat,
}: {
	kind: WalletAssetKind
	onClose: () => void
	onAction: (id: WalletAssetActionId) => void
	account: string
	activity: TxView[]
	usdcBalance: string
	usdcFiat: string
	usdcRateLabel: string
	storeBalance: string
	merchantCount: number
	rewardBalance: string
	rewardMerchantCount: number
	bUnitBalance: string
	bUnitFiat: string
}) {
	const theme = THEME[kind]
	const [entered, setEntered] = useState(false)
	const [closing, setClosing] = useState(false)
	const [bUnitRows, setBUnitRows] = useState<ActivityRow[] | null>(null)

	useEffect(() => {
		const frame = requestAnimationFrame(() => setEntered(true))
		return () => cancelAnimationFrame(frame)
	}, [])

	useEffect(() => {
		if (kind !== 'units' || !account) return
		let cancelled = false
		void getBUnitLedgerFromIndexer(account)
			.then((entries) => {
				if (!cancelled) setBUnitRows(rowsFromBUnits(entries))
			})
			.catch(() => {})
		return () => {
			cancelled = true
		}
	}, [kind, account])

	const requestClose = () => {
		if (closing) return
		setClosing(true)
		window.setTimeout(onClose, 300)
	}

	const copy = kind === 'usdc'
		? {
			title: 'USDC',
			eyebrow: 'Your digital dollars',
			balance: usdcBalance,
			subBalance: usdcFiat,
			symbol: '$',
			statLabel1: 'Fiat value (CAD)',
			statValue1: usdcFiat.replace(/^≈\s*/, ''),
			statLabel2: usdcRateLabel,
			statValue2: '',
			actions: [
				['buy-card', 'Buy with\nBank Card'],
				['buy-coinbase', 'Buy with\nCoinbase'],
				['from-wallet', 'From Another\nWallet'],
				['receive-usdc', 'Receive\nUSDC'],
			] as const,
		}
		: kind === 'credits'
			? {
				title: 'Store Credits',
				eyebrow: 'Shop more, spend smarter',
				balance: storeBalance,
				subBalance: '',
				symbol: '▰',
				statLabel1: 'Total Merchants',
				statValue1: String(merchantCount),
				statLabel2: 'Active Credits',
				statValue2: storeBalance,
				actions: [
					['topup-pay', 'Top up & Pay'],
					['discover', 'Discover\nMerchants'],
					['store-cards', 'My Store\nCards'],
					['offers', 'Offers'],
				] as const,
			}
			: kind === 'points'
				? {
					title: 'Reward PT',
					eyebrow: 'Earn. Redeem. Enjoy.',
					balance: rewardBalance,
					subBalance: '',
					symbol: '★',
					statLabel1: 'Reward PT',
					statValue1: rewardBalance,
					statLabel2: 'Merchants',
					statValue2: String(rewardMerchantCount),
					actions: [
						['redeem-pt', 'Redeem\nReward PT'],
						['earn-pt', 'Discover Ways\nto Earn'],
						['my-rewards', 'My Rewards'],
						['offers', 'Special Offers'],
					] as const,
				}
				: {
					title: 'B-Units',
					eyebrow: 'Power more possibilities',
					balance: bUnitBalance,
					subBalance: bUnitFiat,
					symbol: '⬡',
					statLabel1: 'Total Value (USD)',
					statValue1: bUnitFiat.replace(/^≈\s*/, ''),
					statLabel2: 'Unit Value',
					statValue2: '$0.01',
					actions: [
						['bunit-topup', 'Top Up'],
						['bunit-learn', 'How to Use'],
						['bunit-learn', 'Supported\nFeatures'],
						['bunit-learn', 'Learn More'],
					] as const,
				}

	const rows = kind === 'units' ? (bUnitRows ?? []) : rowsFromTx(kind, activity)
	const shifted = closing || !entered
	const pageBackground = `radial-gradient(circle at 95% 22%, ${theme.glow}, transparent 27%), radial-gradient(circle at 15% 75%, rgba(255,255,255,.95), transparent 35%), linear-gradient(150deg, ${theme.pageA}, ${theme.pageB})`

	return (
		<div className="fixed inset-0 z-[120] overflow-hidden">
			<div
				className="absolute inset-0 overflow-y-auto text-[#080b3b] transition-transform duration-300 ease-out will-change-transform"
				style={{
					background: pageBackground,
					transform: shifted ? 'translate3d(100%, 0, 0)' : 'translate3d(0, 0, 0)',
				}}
			>
			<div
				className="relative mx-auto min-h-[100dvh] w-full max-w-[480px] overflow-hidden bg-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-[calc(env(safe-area-inset-top)+16px)]"
				style={{
					['--accent' as string]: theme.accent,
					['--accent-soft' as string]: theme.soft,
				}}
			>
				<header className="relative z-10 grid h-11 grid-cols-[44px_1fr_44px] items-center">
					<BeamioCircularBackButton variant="onLight" onClick={requestClose} />
					<h1 className="m-0 text-center text-[22px] font-extrabold tracking-[-0.5px]">{copy.title}</h1>
					<span className="flex h-[42px] w-[42px] items-center justify-center gap-1" aria-hidden>
						<span className="h-1 w-1 rounded-full bg-[#080b3b]" />
						<span className="h-1 w-1 rounded-full bg-[#080b3b]" />
						<span className="h-1 w-1 rounded-full bg-[#080b3b]" />
					</span>
				</header>

				<section className="relative flex min-h-[178px] px-2 pb-3 pt-9">
					<div className="relative z-[3] w-[67%]">
						<div className="mb-[15px] text-[16px] font-medium opacity-70" style={{ color: theme.accent }}>
							{copy.eyebrow}
						</div>
						<div className="whitespace-nowrap text-[clamp(29px,8.3vw,38px)] font-extrabold leading-none tracking-[-1.5px]">
							{copy.balance}
						</div>
						<div className="mt-[13px] min-h-6 text-[15px] text-[#6672bd]">{copy.subBalance}</div>
					</div>
					<div className="absolute right-[-3px] top-[17px] flex h-[155px] w-[155px] items-center justify-center">
						{kind === 'credits' || kind === 'points' ? (
							<AssetLogoWash className="grid h-[132px] w-[132px] place-items-center">
								<img
									src={kind === 'credits' ? storeCreditsLogo : rewardPtLogo}
									alt=""
									className="h-full w-full object-contain"
								/>
							</AssetLogoWash>
						) : kind === 'units' ? (
							<AssetLogoWash className="grid h-[120px] w-[120px] place-items-center overflow-hidden rounded-full">
								<img
									src="https://mainnet.conet.network/bunit/erc20/BUNIT-256.png"
									alt=""
									className="h-full w-full origin-center scale-[1.65] object-cover"
								/>
							</AssetLogoWash>
						) : (
							<>
								<div
									className="absolute h-[140px] w-[140px] rounded-full blur-[4px]"
									style={{ background: `radial-gradient(circle, ${theme.glow}, transparent 70%)` }}
									aria-hidden
								/>
								<div
									className="relative z-[2] h-[92px] w-[92px] -translate-y-2.5 -rotate-[5deg] overflow-hidden rounded-full"
									style={{ boxShadow: `0 18px 25px ${theme.glow}` }}
								>
									<img
										src="https://mainnet.conet.network/usdc/erc20/USDC.svg"
										alt=""
										className="h-full w-full object-cover"
									/>
									<div className="pointer-events-none absolute inset-0" style={ASSET_LOGO_WASH_STYLE} aria-hidden />
								</div>
							</>
						)}
						<div
							className="absolute bottom-[5px] h-[42px] w-[118px] rounded-[50%_50%_10px_10px]"
							style={{
								background: 'linear-gradient(to bottom, rgba(255,255,255,.95), rgba(255,255,255,.45))',
								boxShadow: `0 10px 30px ${theme.glow}`,
							}}
							aria-hidden
						/>
					</div>
				</section>

				<section className="relative z-[4] grid h-[84px] grid-cols-[1fr_1px_1.15fr] items-center gap-[18px] rounded-[18px] border border-white/80 bg-white/75 px-[18px] py-[15px] shadow-[0_8px_25px_rgba(56,78,150,0.045)] backdrop-blur-[18px]">
					<div className="flex min-w-0 flex-col gap-[7px]">
						<span className="whitespace-nowrap text-[14px] text-[#6871b7]">{copy.statLabel1}</span>
						<strong className="whitespace-nowrap text-[19px] text-[#0a0d43]">{copy.statValue1}</strong>
					</div>
					<div className="h-12 bg-[rgba(92,105,181,0.28)]" />
					<div className="flex min-w-0 flex-col gap-[7px]">
						<span className="whitespace-nowrap text-[14px] text-[#6871b7]">{copy.statLabel2}</span>
						{copy.statValue2 ? (
							<strong className="whitespace-nowrap text-[19px] text-[#0a0d43]">{copy.statValue2}</strong>
						) : (
							<svg viewBox="0 0 120 30" className="block h-6 w-full" aria-hidden>
								<polyline
									points="0,19 10,22 20,16 30,20 40,17 50,19 60,10 70,12 80,11 90,8 100,10 110,5 120,7"
									fill="none"
									stroke={theme.accent}
									strokeWidth="2"
								/>
							</svg>
						)}
					</div>
				</section>

				<section className="mt-3.5 grid grid-cols-2 gap-[7px]">
					{copy.actions.map(([id, label]) => (
						<button
							key={`${id}-${label}`}
							type="button"
							onClick={() => onAction(id)}
							className="flex min-h-[107px] flex-col items-center justify-center rounded-[17px] border border-white/80 bg-white/75 px-2 py-[11px] text-[#08105a] shadow-[0_8px_25px_rgba(56,78,150,0.045)] backdrop-blur-[18px] active:scale-[0.975]"
						>
							<span
								className="mb-[3px] grid h-[54px] w-[54px] place-items-center rounded-full text-[27px] font-extrabold"
								style={{
									color: theme.accent,
									background: `linear-gradient(145deg, rgba(255,255,255,.7), ${theme.soft})`,
								}}
								aria-hidden
							>
								{actionMark(id, label)}
							</span>
							<span className="flex min-h-9 items-center whitespace-pre-line text-center text-[15px] font-medium leading-[17px]">
								{label}
							</span>
						</button>
					))}
				</section>

				<section className="mt-[26px]">
					<h2 className="mx-[5px] mb-2.5 mt-0 text-[20px] tracking-[-0.4px]">Recent Activity</h2>
					<div className="flex flex-col gap-[7px]">
						{rows.length === 0 ? (
							<p className="m-0 px-3 py-6 text-center text-[14px] text-[#7784ca]">No activity yet</p>
						) : rows.map((row) => (
							<div
								key={row.id}
								className="grid min-h-[70px] grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[17px] border border-white/80 bg-white/75 px-3 py-[9px] text-left shadow-[0_8px_25px_rgba(56,78,150,0.045)] backdrop-blur-[18px]"
							>
								<div
									className="grid h-[43px] w-[43px] place-items-center rounded-full text-[21px] font-extrabold"
									style={{
										color: row.positive ? theme.accent : '#ff2448',
										background: row.positive ? theme.soft : '#ffe7eb',
									}}
									aria-hidden
								>
									{row.icon}
								</div>
								<div className="flex min-w-0 flex-col gap-1">
									<strong className="truncate text-[14px]">{row.title}</strong>
									<span className="whitespace-nowrap text-[12px] text-[#7784ca]">{row.date}</span>
								</div>
								<div className={`whitespace-nowrap text-[14px] font-bold ${row.positive ? 'text-[#00aa7a]' : 'text-[#ff183c]'}`}>
									{row.value}
								</div>
							</div>
						))}
					</div>
					<button
						type="button"
						onClick={() => onAction('more-activity')}
						className="mx-auto mt-4 block h-[39px] w-[175px] rounded-full border-0 text-[15px] text-[#10219a]"
						style={{ background: `linear-gradient(90deg, ${theme.soft}, rgba(255,255,255,.8))` }}
					>
						More
					</button>
				</section>
			</div>
			</div>
		</div>
	)
}

function actionMark(id: WalletAssetActionId, label: string): string {
	if (label.startsWith('Supported')) return '▦'
	if (label.startsWith('Learn More')) return 'i'
	switch (id) {
		case 'buy-card':
			return '▰'
		case 'buy-coinbase':
			return '●'
		case 'from-wallet':
		case 'topup-pay':
			return '▱'
		case 'receive-usdc':
			return '▦'
		case 'discover':
		case 'bunit-learn':
			return '▥'
		case 'store-cards':
			return '▰'
		case 'offers':
			return '◆'
		case 'redeem-pt':
			return '♁'
		case 'earn-pt':
			return '★'
		case 'my-rewards':
			return '▰'
		case 'bunit-topup':
			return '+'
		default:
			return '●'
	}
}
