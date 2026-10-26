import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, ChevronRight, Copy, Gift, Hexagon, Network, Settings2, Share2, Store, TicketPlus, Users, Wallet } from 'lucide-react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { QrWithBeamioTagAvatar } from '@/components/QrWithBeamioTagAvatar'
import { AgentBusinessInviteSheet } from '@/pages/BountyBoard/AgentBusinessInviteSheet'
import { AgentInviteRefereesSheet } from '@/pages/BountyBoard/AgentInviteRefereesSheet'
import { MerchantsBusinessPanel } from '@/pages/BountyBoard/MerchantsBusinessPanel'
import NetworkContributionRewardsPage from '@/pages/BountyBoard/NetworkContributionRewardsPage'
import { InvitedByIntroducerChip } from '@/components/InvitedByIntroducerChip'
import { buildAgentInviteAppUrl } from '@/utils/agentInviteIntroducerStash'
import { fetchRefereesOfLength } from '@/utils/agentReferrerRegistryClient'
import { useScrollCapsuleOpacity } from '@/hooks/useScrollCapsuleOpacity'
import { useConetAaWalletBalances, useConetWalletBalances } from '@/hooks/useConetUsdcBalance'
import { useDaemonValidatorWalletNodeProfile } from '@/hooks/useDaemonValidatorWalletNodeProfile'
import { useDaemonUnifiedIncomeStats } from '@/hooks/useDaemonUnifiedIncomeStats'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { formatWithThousands } from '@/services/beamio'
import { formatConetChainTokenBalance, formatConetChainTokenBalanceCompact } from '@/services/conetUsdcBalance'
import { formatGbDisplay } from '@/utils/formatGbDisplay'
import { formatDigitalAssetDisplay } from '@/utils/formatDigitalAssetDisplay'
import { fetchGenesisMemberSnapshot } from '@/services/genesisNodeReferral'
import { gbBandwidthProvidedParts } from '@/services/validatorWalletNodeProfile'

/**
 * Bounty Board — node rewards hub.
 * Top bar aligned with /wallet: fixed left title capsule, no right control / back.
 * Reached from the global bar's right-most tab (formerly /Pay).
 */

const BOUNTY_CAPSULE_ACCENT = '#1562f0'

const capsuleChrome =
	'rounded-full border border-slate-100/90 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-slate-800'

const cardChrome =
	'rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'

type RewardsHubView = 'overview' | 'referrals' | 'merchants' | 'nodes' | 'earnings'

const HUB_TABS: { id: Exclude<RewardsHubView, 'earnings'>; label: string }[] = [
	{ id: 'overview', label: 'Overview' },
	{ id: 'referrals', label: 'Referrals' },
	{ id: 'merchants', label: 'Business' },
	{ id: 'nodes', label: 'Node' },
]

const FALLBACK_RATES: Record<string, number> = { USD: 1, CAD: 1.35, JPY: 150, EUR: 0.92, CNY: 7.2, HKD: 7.8, TWD: 31, SGD: 1.35 }

function fxRateUsdcToCurrency(currency: ICurrency, currencyData: Record<string, number>): number {
	const usdcToUsd = (currencyData.USDC ?? 1) || 1
	if (currency === 'USD') return usdcToUsd
	if (currency === 'USDC') return 1
	const raw = currencyData[currency] ?? FALLBACK_RATES[currency] ?? 1
	const rate = usdcToUsd * (raw || (FALLBACK_RATES[currency] ?? 1))
	return rate > 0 ? rate : (FALLBACK_RATES[currency] ?? 1)
}

function formatConetUsdcFiatApprox(usdcAmount: string, currency: ICurrency, currencyData: Record<string, number>): string {
	const n = Math.max(0, Number(usdcAmount) || 0)
	const rate = fxRateUsdcToCurrency(currency, currencyData)
	const v = currency === 'USDC' ? n : n * rate
	switch (currency) {
		case 'EUR':
			return `≈ € ${formatWithThousands(v, 2)}`
		case 'TWD':
			return `≈ NT$ ${formatWithThousands(v, 2)}`
		case 'SGD':
			return `≈ SG$ ${formatWithThousands(v, 2)}`
		case 'HKD':
			return `≈ HK$ ${formatWithThousands(v, 2)}`
		case 'JPY':
			return `≈ JP¥ ${formatWithThousands(v, 0)}`
		case 'CNY':
			return `≈ RMB¥ ${formatWithThousands(v, 2)}`
		case 'CAD':
			return `≈ CA$ ${formatWithThousands(v, 2)}`
		case 'USDC':
			return `≈ ${formatWithThousands(n, 2)} USDC`
		case 'USD':
		default:
			return `≈ US$ ${formatWithThousands(v, 2)}`
	}
}

function formatConetUsdcDisplay(balance: string): string {
	return formatDigitalAssetDisplay(Math.max(0, Number(balance) || 0))
}

const REFERRAL_PROGRESS_COUNT_CACHE_PREFIX = 'beamio:agent-invite-referees-count:v1:'

function loadReferralProgressCountCache(eoa: string): number | null {
	const key = eoa.trim().toLowerCase()
	if (!key) return null
	try {
		const raw = localStorage.getItem(`${REFERRAL_PROGRESS_COUNT_CACHE_PREFIX}${key}`)
		if (raw == null) return null
		const n = Number(raw)
		return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
	} catch {
		return null
	}
}

function saveReferralProgressCountCache(eoa: string, count: number): void {
	const key = eoa.trim().toLowerCase()
	if (!key) return
	try {
		localStorage.setItem(`${REFERRAL_PROGRESS_COUNT_CACHE_PREFIX}${key}`, String(Math.max(0, Math.floor(count))))
	} catch {
		/* ignore quota */
	}
}

function ReferralProgressPanel({
	registeredCount,
	onOpen,
}: {
	registeredCount: number
	onOpen?: () => void
}) {
	const interactive = typeof onOpen === 'function'
	return (
		<section
			className={`${cardChrome} px-5 py-5${interactive ? ' cursor-pointer transition hover:border-slate-300 dark:hover:border-slate-600' : ''}`}
			aria-label="Referral progress"
			role={interactive ? 'button' : undefined}
			tabIndex={interactive ? 0 : undefined}
			onClick={interactive ? onOpen : undefined}
			onKeyDown={
				interactive
					? (e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault()
								onOpen()
							}
						}
					: undefined
			}
		>
			<div className="flex items-baseline justify-between gap-3">
				<p className="text-[15px] font-medium text-slate-500 dark:text-slate-400">
					Registered through your link
				</p>
				<div className="flex shrink-0 items-center gap-1.5">
					<p className="text-[22px] font-bold tabular-nums tracking-tight text-[#0F172A] dark:text-slate-50">
						{registeredCount.toLocaleString('en-US')}
					</p>
					{interactive ? (
						<ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600" aria-hidden />
					) : null}
				</div>
			</div>
			<div className="my-4 h-px w-full bg-slate-200/90 dark:bg-slate-700" aria-hidden />
			<p className="text-[13px] leading-snug text-slate-400 dark:text-slate-500">
				Registration alone does not create a reward. Eligibility follows each program&apos;s rules.
			</p>
		</section>
	)
}

function ReferToEarnBanner({ onExplore }: { onExplore: () => void }) {
	return (
		<section className="relative isolate overflow-hidden rounded-[26px] border border-white bg-[radial-gradient(ellipse_at_100%_100%,rgba(131,227,212,0.6),transparent_60%),radial-gradient(ellipse_at_90%_0%,rgba(140,200,255,0.69),transparent_64%),linear-gradient(120deg,#edf7ff,#e0efff)] shadow-[0_9px_27px_rgba(68,125,182,0.09)] dark:border-[#4e708e] dark:bg-[radial-gradient(ellipse_at_100%_100%,rgba(40,107,100,0.6),transparent_60%),radial-gradient(ellipse_at_90%_0%,rgba(53,92,146,0.6),transparent_64%),linear-gradient(120deg,#1d314a,#233e5d)] dark:shadow-[0_9px_27px_rgba(0,0,0,0.09)]">
			<div className="relative z-[1] flex items-end gap-1 px-3.5 py-5 sm:block sm:min-h-[278px] sm:px-[22px] sm:py-6 sm:pr-[168px]">
				<div className="min-w-0 flex-1 sm:max-w-[230px]">
					<h2 className="text-[28px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-slate-50">
						Refer to Earn
					</h2>
					<p className="mt-2 text-[15px] font-semibold leading-snug text-[#2563eb]">
						Connect friends.
						<br />
						Earn merchant rewards.
					</p>
					<p className="mt-2 text-sm leading-snug text-slate-500 dark:text-slate-400">
						Discover merchants offering referral tasks. Share an offer and earn when its conditions are met.
					</p>
					<button
						type="button"
						onClick={onExplore}
						className="mt-4 inline-flex items-center gap-1 rounded-full bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white"
					>
						Explore Offers
						<ArrowUpRight className="h-4 w-4" aria-hidden />
					</button>
				</div>
			<div
				className="pointer-events-none relative h-[134px] w-[112px] shrink-0 sm:absolute sm:bottom-6 sm:right-[-1px] sm:h-[186px] sm:w-[155px]"
				aria-hidden
			>
				<div className="absolute bottom-0 right-0 h-[186px] w-[155px] origin-bottom-right scale-[0.72] sm:scale-100">
				<div className="absolute right-[-10px] top-3 h-[157px] w-[157px] rounded-full bg-white/40 shadow-[0_0_35px_rgba(215,247,255,0.56)] dark:bg-[#a8d4ff]/[0.07] dark:shadow-[0_0_35px_rgba(181,227,255,0.03)]" />
				<div className="absolute right-[3px] top-[-1px] text-[29px] leading-none text-[#fffbea] dark:text-[#edecb0]">✦</div>
				<div className="absolute left-[9px] top-[23px] grid h-[43px] w-[39px] -rotate-[14deg] place-items-center rounded-full border-[3px] border-[#ffc94d] bg-[linear-gradient(135deg,#ffeeb0,#ffc344)] text-[22px] font-semibold text-[#d5940b] shadow-[4px_4px_0_#e6a71d,0_9px_15px_rgba(99,165,187,0.14)] dark:border-[#d5a74a] dark:bg-[linear-gradient(135deg,#ffdd8d,#c79a35)] dark:text-[#8c6012] dark:shadow-[4px_4px_0_#976f21,0_9px_15px_rgba(0,0,0,0.14)]">
					$
				</div>
				<div className="absolute bottom-[25px] left-[43px] h-[87px] w-[91px] -rotate-[9deg] rounded-xl bg-[linear-gradient(120deg,#faffff,#c7e5ff)] shadow-[10px_13px_18px_rgba(39,127,198,0.17),inset_-10px_-3px_13px_rgba(106,175,248,0.24)] dark:bg-[linear-gradient(120deg,#bad8f7,#7ea9d9)] dark:shadow-[10px_13px_18px_rgba(0,0,0,0.15),inset_-10px_-3px_13px_rgba(70,132,195,0.24)]">
					<div className="absolute bottom-0 left-[35px] top-0 w-[21px] bg-[linear-gradient(90deg,#3a96f7,#0766d8,#4ba5ff)] dark:bg-[linear-gradient(90deg,#3c88d8,#295f9d,#64a3df)]" />
					<div className="absolute left-1 top-[-36px] h-[30px] w-10 rotate-[17deg] rounded-[25px_26px_3px_24px] bg-[linear-gradient(125deg,#9edaff,#0870df)] shadow-[inset_0_-6px_8px_rgba(6,86,182,0.28)] dark:bg-[linear-gradient(125deg,#9bd0f8,#3472b4)] dark:shadow-[inset_0_-6px_8px_rgba(13,61,107,0.28)]" />
					<div className="absolute left-11 top-[-36px] h-[30px] w-10 -scale-x-100 rotate-[17deg] rounded-[25px_26px_3px_24px] bg-[linear-gradient(125deg,#9edaff,#0870df)] shadow-[inset_0_-6px_8px_rgba(6,86,182,0.28)] dark:bg-[linear-gradient(125deg,#9bd0f8,#3472b4)]" />
					<div className="absolute -left-1.5 -right-1.5 -top-[7px] h-[21px] rounded-[7px] bg-[linear-gradient(130deg,#ffffff,#c2e2ff)] shadow-[0_4px_5px_rgba(55,133,195,0.13)] dark:bg-[linear-gradient(130deg,#e7f4ff,#99bfe4)]">
						<div className="absolute left-[41px] top-0 h-[21px] w-[22px] bg-[linear-gradient(90deg,#3a96f7,#0766d8,#4ba5ff)] dark:bg-[linear-gradient(90deg,#3c88d8,#295f9d,#64a3df)]" />
					</div>
				</div>
				<div className="absolute bottom-[5px] right-0 grid h-[29px] w-[26px] rotate-[16deg] place-items-center rounded-full border-[3px] border-[#ffc94d] bg-[linear-gradient(135deg,#ffeeb0,#ffc344)] text-[15px] font-semibold text-[#d5940b] shadow-[4px_4px_0_#e6a71d,0_9px_15px_rgba(99,165,187,0.14)] dark:border-[#d5a74a] dark:text-[#8c6012]">
					$
				</div>
				<p className="absolute bottom-0 left-[22px] w-[132px] rotate-[5deg] rounded-[11px] border border-white bg-white/95 px-2.5 py-2 text-[10px] font-medium leading-[1.45] text-[#2666b2] shadow-[0_5px_15px_rgba(54,127,172,0.08)] dark:border-[#f1f8ff] dark:bg-[#edf5ff]/95 dark:text-[#1e588f]">
					Refer a friend.
					<br />
					Earn a reward.
				</p>
				</div>
			</div>
			</div>
		</section>
	)
}

export default function BountyBoard() {
	const navigate = useNavigate()
	const location = useLocation()
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(true)
	const { profiles, currencyData, beamio, setShowFooter } = useDaemonContext()
	const eoa = profiles?.[0]?.keyID?.trim() ?? ''
	const aaAccount = profiles?.[0]?.aaAccount?.trim() ?? ''
	const profileCurrency = (beamio?.currency ?? 'USD') as ICurrency
	const { balances: conetWalletBalances } = useConetWalletBalances(eoa)
	const { balances: aaWalletBalances } = useConetAaWalletBalances()
	const { profile: validatorProfile } = useDaemonValidatorWalletNodeProfile()
	const { stats: incomeStats } = useDaemonUnifiedIncomeStats()

	const usdcDisplay = useMemo(() => formatConetUsdcDisplay(conetWalletBalances.usdc), [conetWalletBalances.usdc])
	const fiatApprox = useMemo(
		() => formatConetUsdcFiatApprox(conetWalletBalances.usdc, profileCurrency, currencyData as Record<string, number>),
		[conetWalletBalances.usdc, profileCurrency, currencyData],
	)
	const bandwidthProvided = useMemo(() => gbBandwidthProvidedParts(incomeStats), [incomeStats])
	const miningGbDisplay = useMemo(
		() => formatGbDisplay(String(bandwidthProvided.totalGb)),
		[bandwidthProvided.totalGb],
	)
	const miningGbUsdcApprox = useMemo(() => {
		const gb = bandwidthProvided.totalGb
		const usdc = Number.isFinite(gb) && gb > 0 ? gb * 0.01 : 0
		return `≈ ${formatDigitalAssetDisplay(usdc)} USDC`
	}, [bandwidthProvided.totalGb])
	const miningCnetDisplay = useMemo(
		() => formatConetChainTokenBalanceCompact(incomeStats?.cnetBeneficiary.cumulative ?? '0'),
		[incomeStats?.cnetBeneficiary.cumulative],
	)
	const miningCnetUnitLabel = useMemo(() => {
		const d = miningCnetDisplay
		if (d.endsWith('K') || d.endsWith('M')) return ''
		return 'CNET'
	}, [miningCnetDisplay])
	const totalNodesDisplay = useMemo(() => {
		const staked = validatorProfile?.validatorNodeCount ?? 0
		const depin = validatorProfile?.gbMiningNodeCount ?? 0
		return Math.max(staked, depin).toLocaleString()
	}, [validatorProfile?.validatorNodeCount, validatorProfile?.gbMiningNodeCount])

	const capsulePointer = capsuleOpacity < 0.05 ? 'none' : 'auto'

	const [hubView, setHubView] = useState<RewardsHubView>('overview')
	const [inviteQrOpen, setInviteQrOpen] = useState(false)
	const [inviteQrEntered, setInviteQrEntered] = useState(false)
	const [inviteQrClosing, setInviteQrClosing] = useState(false)
	const [inviteQrEpoch, setInviteQrEpoch] = useState(0)
	const [inviteLinkCopied, setInviteLinkCopied] = useState(false)
	const [agentSheetOpen, setAgentSheetOpen] = useState(false)
	const [agentSheetEpoch, setAgentSheetEpoch] = useState(0)
	const [merchantsTempsRefreshKey, setMerchantsTempsRefreshKey] = useState(0)
	const [refereesSheetOpen, setRefereesSheetOpen] = useState(false)
	const [acrossNetworkOpen, setAcrossNetworkOpen] = useState(false)
	const inviteUrl = useMemo(() => (eoa ? buildAgentInviteAppUrl(eoa) : ''), [eoa])

	useEffect(() => {
		const st = location.state as { openAcrossTheNetwork?: boolean } | null
		if (!st?.openAcrossTheNetwork) return
		setAcrossNetworkOpen(true)
		navigate(location.pathname, { replace: true, state: {} })
	}, [location.state, location.pathname, navigate])
	const [registeredThroughLinkCount, setRegisteredThroughLinkCount] = useState(() =>
		eoa ? (loadReferralProgressCountCache(eoa) ?? 0) : 0,
	)
	const openRefereesSheet = useCallback(() => {
		if (!eoa) return
		setRefereesSheetOpen(true)
	}, [eoa])
	useEffect(() => {
		if (!eoa) {
			setRegisteredThroughLinkCount(0)
			return
		}
		const cached = loadReferralProgressCountCache(eoa)
		if (cached != null) setRegisteredThroughLinkCount(cached)
		let cancelled = false
		void (async () => {
			const n = await fetchRefereesOfLength(eoa)
			if (cancelled || n == null) return
			setRegisteredThroughLinkCount(n)
			saveReferralProgressCountCache(eoa, n)
		})()
		return () => {
			cancelled = true
		}
	}, [eoa])
	const agentTag = String((beamio as { accountName?: string } | null)?.accountName ?? '').replace(/^@/, '')
	const openAgentSheet = () => {
		setAgentSheetEpoch((n) => n + 1)
		setAgentSheetOpen(true)
	}
	const closeAgentSheet = () => {
		setAgentSheetOpen(false)
		setMerchantsTempsRefreshKey((n) => n + 1)
	}
	const closeInviteQr = () => {
		if (inviteQrClosing) return
		setInviteQrClosing(true)
		window.setTimeout(() => {
			setInviteQrOpen(false)
			setInviteQrClosing(false)
			setInviteQrEntered(false)
			setInviteLinkCopied(false)
		}, 300)
	}
	const copyInviteLink = useCallback(async () => {
		const value = inviteUrl.trim()
		if (!value) return
		try {
			await navigator.clipboard.writeText(value)
			setInviteLinkCopied(true)
		} catch {
			setInviteLinkCopied(false)
		}
	}, [inviteUrl])
	const shareInviteLink = useCallback(async () => {
		const value = inviteUrl.trim()
		if (!value) return
		try {
			if (typeof navigator.share === 'function') {
				await navigator.share({
					title: 'Invite friends to Beamio',
					text: 'Join Beamio with my invitation.',
					url: value,
				})
				return
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') return
		}
		await copyInviteLink()
	}, [copyInviteLink, inviteUrl])
	const openInviteQr = () => {
		setInviteQrClosing(false)
		setInviteQrEntered(false)
		setInviteQrOpen(true)
		setInviteQrEpoch((n) => n + 1)
	}
	const [isGenesisReferralAdmin, setIsGenesisReferralAdmin] = useState(false)
	const [isGenesisL0, setIsGenesisL0] = useState(false)
	const [isGenesisL1, setIsGenesisL1] = useState(false)

	// Main tab keeps the global Footer. Sheets cover it while open.
	useEffect(() => {
		if (agentSheetOpen || inviteQrOpen) {
			setShowFooter(false)
			return () => setShowFooter(true)
		}
		setShowFooter(true)
	}, [agentSheetOpen, inviteQrOpen, setShowFooter])

	useEffect(() => {
		if (!inviteQrOpen) return
		const frame = window.requestAnimationFrame(() => setInviteQrEntered(true))
		return () => window.cancelAnimationFrame(frame)
	}, [inviteQrOpen, inviteQrEpoch])

	useEffect(() => {
		if (!inviteLinkCopied) return
		const timer = window.setTimeout(() => setInviteLinkCopied(false), 2000)
		return () => window.clearTimeout(timer)
	}, [inviteLinkCopied])

	useEffect(() => {
		if (!eoa) {
			setIsGenesisReferralAdmin(false)
			setIsGenesisL0(false)
			setIsGenesisL1(false)
			return
		}
		let cancelled = false
		void fetchGenesisMemberSnapshot(eoa)
			.then((snap) => {
				if (cancelled || !snap) return
				setIsGenesisReferralAdmin(snap.isAdmin)
				setIsGenesisL0(snap.isL0)
				setIsGenesisL1(snap.isL1)
			})
			.catch(() => {
				// Keep last trusted role flags on RPC failure.
			})
		return () => {
			cancelled = true
		}
	}, [eoa])

	const merchantsMode = hubView === 'merchants'

	return (
		<div
			className={`flex h-full min-h-0 flex-1 flex-col text-slate-900 dark:bg-slate-950 dark:text-slate-50 ${
				merchantsMode ? 'bg-[#f7f5f8]' : 'bg-[#eef6ff]'
			}`}
			style={
				merchantsMode
					? undefined
					: {
							backgroundImage: 'radial-gradient(rgba(37,99,235,0.14) 1px, transparent 1px)',
							backgroundSize: '18px 18px',
						}
			}
		>
			{hubView !== 'merchants' ? (
				<div
					className="fixed left-4 right-4 z-40 flex items-center justify-between gap-2 transition-opacity duration-300"
					style={{
						top: 'max(1rem, env(safe-area-inset-top, 0px))',
						opacity: capsuleOpacity,
					}}
				>
					<div
						className={`flex items-center gap-2.5 py-2 pl-2 pr-4 ${capsuleChrome}`}
						style={{ pointerEvents: capsulePointer }}
					>
						<div
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
							style={{ backgroundColor: BOUNTY_CAPSULE_ACCENT }}
						>
							<Gift className="h-5 w-5" strokeWidth={2.25} aria-hidden />
						</div>
						<span className="text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">Rewards Hub</span>
					</div>
					{eoa ? (
						<div className="flex shrink-0 items-center gap-2" style={{ pointerEvents: capsulePointer }}>
							<button
								type="button"
								onClick={openInviteQr}
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-100/90 bg-white text-[#1562f0] shadow-[0_4px_24px_rgba(15,23,42,0.08)] transition active:scale-[0.96] hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
								aria-label="Share invite"
								title="Share invite"
								tabIndex={-1}
							>
								<Share2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
							</button>
							<button
								type="button"
								onClick={() => navigate('/BountyBoard/genesis-referral')}
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-100/90 bg-white text-[#1562f0] shadow-[0_4px_24px_rgba(15,23,42,0.08)] transition active:scale-[0.96] hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-slate-700"
								aria-label={
									isGenesisReferralAdmin || isGenesisL0 || isGenesisL1
										? 'Genesis Node referral'
										: 'Claim Genesis referral redeem code'
								}
								title={
									isGenesisReferralAdmin || isGenesisL0 || isGenesisL1
										? 'Genesis referral'
										: 'Claim Genesis code'
								}
								tabIndex={-1}
							>
								<TicketPlus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
							</button>
						</div>
					) : null}
				</div>
			) : null}

			<div
				ref={setScrollRef}
				onScroll={onCapsuleScroll}
				className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain pb-28"
				style={{ WebkitOverflowScrolling: 'touch', flex: '1 1 0%', minHeight: 0 }}
			>
				<div
					className="shrink-0"
					style={{
						minHeight:
							hubView === 'merchants'
								? 'calc(max(1rem, env(safe-area-inset-top, 0px)) + 0.75rem)'
								: 'calc(max(1rem, env(safe-area-inset-top, 0px)) + 5rem)',
					}}
				/>
				<main className="mx-auto w-full max-w-2xl space-y-5 px-6 pt-2">
					{hubView !== 'merchants' ? (
						<div
							className="flex gap-1 rounded-full bg-white/70 p-1 shadow-sm ring-1 ring-white/80 dark:bg-slate-900/80 dark:ring-slate-800"
							role="tablist"
							aria-label="Rewards Hub sections"
						>
							{HUB_TABS.map((tab) => {
								const selected = hubView === tab.id || (hubView === 'earnings' && tab.id === 'overview')
								return (
									<button
										key={tab.id}
										type="button"
										role="tab"
										aria-selected={selected}
										onClick={() => setHubView(tab.id)}
										className={`min-w-0 flex-1 rounded-full px-2 py-2 text-[13px] font-semibold transition ${
											selected
												? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50'
												: 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
										}`}
									>
										{tab.label}
									</button>
								)
							})}
						</div>
					) : null}

					{hubView === 'overview' || hubView === 'earnings' ? (
						<>
							<section className="overflow-hidden rounded-[28px] bg-gradient-to-br from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] text-white shadow-[0_16px_40px_rgba(37,99,235,0.28)]">
								<div className="px-6 pb-5 pt-6">
									<div className="flex items-center justify-between gap-3">
										<p className="text-sm font-medium text-white/90">Total rewards received</p>
										<span className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-semibold text-white">
											All time
										</span>
									</div>
									<p className="mt-4 text-[42px] font-extrabold leading-none tracking-tight tabular-nums">
										{usdcDisplay} <span className="text-[28px] font-bold">USDC</span>
									</p>
									<p className="mt-3 text-sm text-white/80">From referrals, network contributions and nodes</p>
								</div>
								<div className="flex items-center justify-between gap-3 border-t border-white/20 px-6 py-3.5">
									<p className="text-sm text-white/90">
										Pending · <span className="font-semibold tabular-nums">{miningGbUsdcApprox.replace(/^≈\s*/, '')}</span>
									</p>
									<button
										type="button"
										onClick={() => setHubView(hubView === 'earnings' ? 'overview' : 'earnings')}
										className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-white"
									>
										{hubView === 'earnings' ? 'Hide breakdown' : 'View breakdown'}
										<ChevronRight className="h-4 w-4" aria-hidden />
									</button>
								</div>
							</section>
							<button
								type="button"
								onClick={() => setAcrossNetworkOpen(true)}
								className="flex w-full items-center gap-3.5 rounded-[24px] border border-slate-200/80 bg-white px-4 py-3.5 text-left shadow-[0_4px_20px_rgba(15,23,42,0.06)] transition active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900"
								aria-label="How network rewards work — Across the network"
							>
								<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#dbeafe] text-[#1562f0] dark:bg-blue-950/60 dark:text-blue-300">
									<Network className="h-5 w-5" strokeWidth={2.25} aria-hidden />
								</span>
								<span className="min-w-0 flex-1">
									<span className="block text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
										How network rewards work
									</span>
									<span className="mt-0.5 block text-[12px] leading-snug text-slate-500 dark:text-slate-400">
										Funded at top-up. Distributed as activity settles.
									</span>
								</span>
								<ChevronRight className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
							</button>
						</>
					) : null}

					{hubView === 'earnings' ? (
						<section className={`${cardChrome} p-5`}>
							<h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Rewards breakdown</h2>
							<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
								Live wallet and node figures. Program referral payouts appear here after they settle.
							</p>
							<dl className="mt-4 space-y-3 text-sm">
								<div className="flex items-center justify-between gap-3">
									<dt className="text-slate-500 dark:text-slate-400">Wallet USDC</dt>
									<dd className="text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">
										{usdcDisplay} USDC
										<span className="mt-0.5 block text-xs font-medium text-slate-400">{fiatApprox}</span>
									</dd>
								</div>
								<div className="flex items-center justify-between gap-3">
									<dt className="text-slate-500 dark:text-slate-400">DePIN routing</dt>
									<dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{miningGbUsdcApprox}</dd>
								</div>
								<div className="flex items-center justify-between gap-3">
									<dt className="text-slate-500 dark:text-slate-400">L1 network</dt>
									<dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
										{miningCnetDisplay}
										{miningCnetUnitLabel ? ` ${miningCnetUnitLabel}` : ''}
									</dd>
								</div>
							</dl>
						</section>
					) : null}

					{hubView === 'overview' ? (
						<>
							<section>
								<h2 className="mb-3 text-[17px] font-semibold text-slate-900 dark:text-slate-50">Your next steps</h2>
								<div className="grid grid-cols-2 gap-3">
									<div className={`${cardChrome} flex flex-col p-4`}>
										<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef2ff] text-[#6366f1]">
											<Users className="h-4 w-4" strokeWidth={2.25} aria-hidden />
										</div>
										<h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-50">Invite friends</h3>
										<p className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
											Your personal QR and link, ready to share.
										</p>
										<button
											type="button"
											onClick={eoa ? openRefereesSheet : undefined}
											disabled={!eoa}
											className={`mt-3 flex w-full items-baseline justify-between gap-2 rounded-xl px-0 text-left ${
												eoa
													? 'cursor-pointer transition hover:opacity-80'
													: 'cursor-default'
											}`}
											aria-label={`${registeredThroughLinkCount.toLocaleString('en-US')} registered through your link`}
										>
											<span className="text-[11px] font-medium leading-snug text-slate-500 dark:text-slate-400">
												Registered through your link
											</span>
											<span className="shrink-0 text-lg font-bold tabular-nums tracking-tight text-[#0F172A] dark:text-slate-50">
												{registeredThroughLinkCount.toLocaleString('en-US')}
											</span>
										</button>
										<button
											type="button"
											onClick={openInviteQr}
											className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#2563eb] px-3 py-2.5 text-xs font-semibold text-white"
										>
											<Share2 className="h-3.5 w-3.5" aria-hidden />
											Share invite
										</button>
									</div>
									<div className={`${cardChrome} flex flex-col p-4`}>
										<div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f3e8ff] text-[#8d3a8b]">
											<Store className="h-4 w-4" strokeWidth={2.25} aria-hidden />
										</div>
										<h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-50">Business onboarding</h3>
										<p className="mt-1 flex-1 text-xs leading-snug text-slate-500 dark:text-slate-400">
											Invite a business and help them get started.
										</p>
										<button
											type="button"
											onClick={() => setHubView('merchants')}
											className="mt-4 inline-flex items-center justify-center gap-1 rounded-full bg-[#e8f1ff] px-3 py-2.5 text-xs font-semibold text-[#2563eb] dark:bg-blue-950/40"
										>
											Invite a business
											<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
										</button>
									</div>
								</div>
							</section>

							<section className="space-y-4">
								<ReferToEarnBanner
									onExplore={() => navigate('/discover', { state: { referrerRewardOnly: true } })}
								/>
							</section>
						</>
					) : null}

					{hubView === 'referrals' ? (
						<section className="space-y-4">
							<div>
								<h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Bring friends to Beamio</h2>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Share your invitation and see who joins.</p>
							</div>
							<InvitedByIntroducerChip refereeEoa={eoa || undefined} />
							<div className={`${cardChrome} p-4`}>
								<h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Your personal invitation</h3>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">One link to share. Registration follows each program’s rules.</p>
								<button
									type="button"
									onClick={openInviteQr}
									className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#1562f0] px-4 py-2 text-sm font-semibold text-white"
								>
									<Share2 className="h-4 w-4" aria-hidden />
									Show invite
								</button>
							</div>
							<ReferralProgressPanel
								registeredCount={registeredThroughLinkCount}
								onOpen={eoa ? openRefereesSheet : undefined}
							/>
							<ReferToEarnBanner
								onExplore={() => navigate('/discover', { state: { referrerRewardOnly: true } })}
							/>
							<div id="referral-offers" className={`${cardChrome} p-4`}>
								<h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Lao Nong Tang</h3>
								<p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
									5% <span className="text-sm font-medium text-slate-500">referral reward</span>
								</p>
								<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
									Example offer. Qualifying top-ups made through your referral can earn this merchant-funded reward.
								</p>
							</div>
						</section>
					) : null}

					{hubView === 'merchants' ? (
						<MerchantsBusinessPanel
							agentTag={agentTag}
							agentEoa={eoa}
							tempsRefreshKey={merchantsTempsRefreshKey}
							onBack={() => setHubView('overview')}
							onCreateTemporary={openAgentSheet}
							onViewAllocationRules={() => setAcrossNetworkOpen(true)}
						/>
					) : null}

					{hubView === 'nodes' ? (
						<>
							<div>
								<h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">CoNET node income</h2>
								<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your CNET balances and node rewards.</p>
							</div>

							<section className={`${cardChrome} p-5`}>
								<p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">CNET balances</p>
								<div className="mt-4 grid grid-cols-2 gap-3">
									<div className="rounded-xl border border-[#dce2f7] bg-[#e9edff] px-3 py-3 dark:border-[#0051d1]/30 dark:bg-[#0051d1]/15">
										<p className="flex items-center gap-1.5 text-xs font-semibold text-[#424655] dark:text-slate-300">
											<Wallet className="h-3.5 w-3.5 text-[#0051d1]" strokeWidth={2.25} aria-hidden />
											EOA Wallet
										</p>
										<p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
											{formatConetChainTokenBalance(conetWalletBalances.cnet)} CNET
										</p>
									</div>
									<div className="rounded-xl border border-[#eadcf7] bg-[#f5ecff] px-3 py-3 dark:border-[#8d3a8b]/30 dark:bg-[#8d3a8b]/15">
										<p className="flex items-center gap-1.5 text-xs font-semibold text-[#424655] dark:text-slate-300">
											<Hexagon className="h-3.5 w-3.5 text-[#8d3a8b]" strokeWidth={2.25} aria-hidden />
											Smart Wallet
										</p>
										<p className="mt-1 text-lg font-extrabold tabular-nums text-slate-900 dark:text-slate-50">
											{aaAccount ? `${formatConetChainTokenBalance(aaWalletBalances.cnet)} CNET` : 'Not connected'}
										</p>
									</div>
								</div>
							</section>

							<section className={`${cardChrome} p-5`}>
								<div className="flex items-center justify-between gap-2">
									<p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Node rewards</p>
									<button
										type="button"
										onClick={() => navigate('/BountyBoard/conet-mining')}
										aria-label="CoNET Mining settings"
										className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-[#1562f0] transition active:scale-[0.96] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
									>
										<Settings2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
									</button>
								</div>
								<div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
									<div className="col-span-2 min-w-0 sm:col-span-1">
										<p className="text-xs font-medium text-slate-500 dark:text-slate-400">DePIN Routing</p>
										<div className="mt-1 flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-stretch sm:justify-start sm:gap-0">
											<p className="min-w-0 break-words text-lg font-extrabold tabular-nums leading-none text-slate-900 sm:text-xl dark:text-slate-50">
												{miningGbDisplay}
												<span className="ml-1 text-sm font-bold text-slate-400 dark:text-slate-500">GB</span>
											</p>
											<p className="shrink-0 text-[11px] font-medium tabular-nums text-slate-400 sm:mt-0.5 dark:text-slate-500">
												{miningGbUsdcApprox}
											</p>
										</div>
										<div className="mt-2 flex justify-end sm:justify-start">
											<button
												type="button"
												disabled
												aria-disabled="true"
												title="Claim USDC is not available yet"
												className="inline-flex max-w-full items-center justify-center rounded-full bg-[#e9edff] px-3 py-1.5 text-xs font-bold text-[#1562f0] disabled:cursor-not-allowed disabled:opacity-60"
											>
												Claim USDC
											</button>
										</div>
									</div>
									<div className="min-w-0 border-t border-slate-100 pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0 dark:border-slate-800">
										<p className="text-xs font-medium text-slate-500 dark:text-slate-400">L1 Network</p>
										<p className="mt-1 break-words text-lg font-extrabold tabular-nums leading-none text-slate-900 sm:text-xl dark:text-slate-50">
											{miningCnetDisplay}
											{miningCnetUnitLabel ? (
												<span className="ml-1 text-sm font-bold text-slate-400 dark:text-slate-500">{miningCnetUnitLabel}</span>
											) : null}
										</p>
									</div>
									<div className="min-w-0 border-t border-l border-slate-100 pl-3 pt-3 sm:border-t-0 sm:pt-0 dark:border-slate-800">
										<p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Nodes</p>
										<p className="mt-1 break-words text-lg font-extrabold tabular-nums leading-none text-slate-900 sm:text-xl dark:text-slate-50">
											{totalNodesDisplay}
										</p>
									</div>
								</div>
							</section>
						</>
					) : null}
				</main>
			</div>
			{inviteQrOpen ? (
				<div className="fixed inset-0 z-[140] flex items-end">
					<button
						type="button"
						aria-label="Close invite"
						className="absolute inset-0 bg-slate-950/40"
						onClick={closeInviteQr}
						tabIndex={-1}
					/>
					<div
						className="relative z-10 flex max-h-[min(92dvh,720px)] w-full flex-col overflow-y-auto rounded-t-[28px] bg-[#F2F2F7] shadow-2xl transition-transform duration-300 ease-out dark:bg-slate-950"
						style={{
							transform: inviteQrClosing || !inviteQrEntered ? 'translateY(100%)' : 'translateY(0)',
							paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
						}}
						role="dialog"
						aria-modal="true"
						aria-labelledby="invite-qr-title"
					>
						<div className="flex justify-center pt-3" aria-hidden>
							<span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
						</div>
						<div className="relative flex items-center px-4 pt-2">
							<BeamioCircularBackButton variant="onLight" onClick={closeInviteQr} aria-label="Back" />
						</div>
						<div className="px-5 pb-2 pt-4">
							<h2 id="invite-qr-title" className="text-[22px] font-semibold tracking-tight text-[#0F172A] dark:text-slate-50">
								Invite friends to Beamio
							</h2>
							<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
								Let friends scan your QR or open your referral link.
							</p>
							{inviteUrl ? (
								<div className="mt-5 rounded-[28px] bg-white px-5 py-6 shadow-[0_8px_30px_rgba(15,23,42,0.08)] dark:bg-slate-900">
									{agentTag ? (
										<p className="text-center text-lg font-semibold text-[#0F172A] dark:text-slate-50">@{agentTag}</p>
									) : null}
									<div className={`flex justify-center ${agentTag ? 'mt-4' : ''}`}>
										<QrWithBeamioTagAvatar
											value={inviteUrl}
											size={220}
											eoa={eoa}
											accountName={agentTag}
											includeMargin
										/>
									</div>
									<p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">Your personal invitation</p>
									<p
										className="mt-3 truncate rounded-xl bg-[#f3f4f6] px-3 py-2.5 text-center text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400"
										title={inviteUrl}
									>
										{inviteUrl}
									</p>
									<div className="mt-4 grid grid-cols-2 gap-3">
										<button
											type="button"
											onClick={() => void copyInviteLink()}
											className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#e8f1ff] text-sm font-semibold text-[#1562f0]"
											aria-label="Copy link"
										>
											{inviteLinkCopied ? (
												<Check className="h-4 w-4 text-emerald-500" strokeWidth={2.5} aria-hidden />
											) : (
												<Copy className="h-4 w-4" strokeWidth={2.25} aria-hidden />
											)}
											Copy link
										</button>
										<button
											type="button"
											onClick={() => void shareInviteLink()}
											className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2563eb] text-sm font-semibold text-white"
											aria-label="Share"
										>
											<Share2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
											Share
										</button>
									</div>
								</div>
							) : (
								<div role="alert" className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
									Sign in with your wallet before sharing an invite.
								</div>
							)}
							<p className="mt-4 text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500">
								New users are attributed to your invitation. Rewards depend on qualified activity and the applicable program.
							</p>
						</div>
					</div>
				</div>
			) : null}
			<AgentBusinessInviteSheet
				open={agentSheetOpen}
				epoch={agentSheetEpoch}
				agentEoa={eoa}
				agentTag={agentTag}
				onClose={closeAgentSheet}
			/>
			{refereesSheetOpen && eoa ? (
				<AgentInviteRefereesSheet
					introducerEoa={eoa}
					onClose={() => setRefereesSheetOpen(false)}
				/>
			) : null}
			{acrossNetworkOpen ? (
				<NetworkContributionRewardsPage onClose={() => setAcrossNetworkOpen(false)} />
			) : null}
		</div>
	)
}
