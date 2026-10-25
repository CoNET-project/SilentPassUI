import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
	AlertTriangle,
	BadgeCheck,
	Building2,
	Calculator,
	CalendarDays,
	Check,
	ChevronDown,
	ChevronRight,
	Copy,
	Eye,
	EyeOff,
	ExternalLink,
	FileText,
	KeyRound,
	Layers,
	Loader2,
	Lock,
	Pencil,
	Plus,
	QrCode,
	RefreshCw,
	Send,
	Share2,
	Store,
	UserRound,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { BeamioCircularBackButton } from '@/components/BeamioCircularBackButton'
import { useMerchantCardDatabase } from '@/providers/MerchantCardDatabaseProvider'
import { pickMerchantCardListTitle } from '@/utils/merchantCardDatabase'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { buildDiscoverMerchantShareUrl } from '@/utils/discoverMerchantShare'
import { buildAgentCardClaimUrlForTemp } from '@/utils/agentCardClaimDeepLink'
import { registerMerchantUnderAgent, registerTempUnderAgent } from '@/utils/agentReferrerRegistryClient'
import {
	isHiddenFromAgentInviteSheet,
	listTempMerchantCards,
	loadAgentTempAccounts,
	type AgentTempAccount,
	type AgentTempMerchantCard,
} from '@/utils/agentBusinessWorkspace'

const M_PURPLE = '#8b3e91'
const M_SOFT = '#f6edf9'
const MERCHANT_OS_AGENT_URL = 'https://biz.beamio.app/biz/'

type PanelView = 'main' | 'partnerPlan' | 'manage' | 'cardPreview' | 'handoff'
type EssentialsKey = 'fees' | 'packages' | 'calc' | null

type CardsState = {
	loading: boolean
	rows: AgentTempMerchantCard[]
	error?: string
}

const FEE_ROWS: { label: string; fee: string; note: string }[] = [
	{ label: 'Create Coupon', fee: '100 B-Units', note: 'per coupon creation' },
	{ label: 'Create Catalog', fee: '100 B-Units', note: 'per catalog creation' },
	{ label: 'Charge', fee: '5 B-Units', note: 'per charge' },
	{ label: 'Top-up', fee: '20 B-Units', note: 'per top-up' },
	{ label: 'Redeem / Burn', fee: '5 B-Units', note: 'per redeem or burn' },
]

/** Price + total B-Units only — no Paid/Free split (beamio-fuel-pack-display-no-paid-free). */
const PACKAGE_ROWS: { name: string; priceUsdc: string; totalBUnits: string; badge?: string }[] = [
	{ name: 'Start Kit', priceUsdc: '49', totalBUnits: '5,000', badge: 'First-time' },
	{ name: 'Growth', priceUsdc: '199', totalBUnits: '21,890', badge: 'Best value' },
	{ name: 'Scale', priceUsdc: '499', totalBUnits: '59,880' },
	{ name: 'Enterprise', priceUsdc: '999', totalBUnits: '129,870' },
]

function merchantOsUnlockUrl(
	beamioTag: string,
	accessPassword: string,
	flow?: 'business',
): string {
	const params = new URLSearchParams({
		tag: beamioTag.replace(/^@/, '').trim(),
		pin: accessPassword,
	})
	if (flow) params.set('flow', flow)
	return `${MERCHANT_OS_AGENT_URL}#/?${params.toString()}`
}

function merchantCardContractCodeUrl(cardAddress: string): string {
	const raw = cardAddress.trim()
	return `https://mainnet.conet.network/address/${encodeURIComponent(raw)}?tab=contract`
}

function shortAddress(address: string): string {
	const raw = address.trim()
	if (raw.length < 12) return raw
	return `${raw.slice(0, 6)}…${raw.slice(-4)}`
}

function visibleCards(rows: AgentTempMerchantCard[]): AgentTempMerchantCard[] {
	return rows.filter((row) => !isHiddenFromAgentInviteSheet(row.cardAddress))
}

function accountReady(rows: AgentTempMerchantCard[] | undefined): boolean {
	return visibleCards(rows ?? []).some((row) => !row.transferred)
}

function accountClaimed(rows: AgentTempMerchantCard[] | undefined): boolean {
	const list = visibleCards(rows ?? [])
	return list.length > 0 && list.every((row) => row.transferred)
}

function primaryManageableCard(rows: AgentTempMerchantCard[] | undefined): AgentTempMerchantCard | null {
	return visibleCards(rows ?? []).find((row) => !row.transferred) ?? null
}

export function MerchantsBusinessPanel({
	agentTag,
	agentEoa,
	tempsRefreshKey,
	onBack,
	onCreateTemporary,
}: {
	agentTag: string
	agentEoa: string
	/** Bump when AgentBusinessInviteSheet closes so the list reloads. */
	tempsRefreshKey: number
	onBack: () => void
	onCreateTemporary: () => void
}) {
	const [view, setView] = useState<PanelView>('main')
	const [essentialsOpen, setEssentialsOpen] = useState<EssentialsKey>(null)
	const [temps, setTemps] = useState<AgentTempAccount[]>([])
	const [selectedEoa, setSelectedEoa] = useState('')
	const [cardsByTemp, setCardsByTemp] = useState<Record<string, CardsState>>({})
	const [revealPw, setRevealPw] = useState(false)
	const [copiedKey, setCopiedKey] = useState('')
	const [claimBusy, setClaimBusy] = useState(false)
	const [claimError, setClaimError] = useState('')
	const [claimUrl, setClaimUrl] = useState('')
	const [previewUrl, setPreviewUrl] = useState('')
	const { resolveName, registerCardAddresses } = useMerchantCardDatabase()

	const reloadTemps = useCallback(() => {
		if (!agentEoa) {
			setTemps([])
			return
		}
		setTemps(loadAgentTempAccounts(agentEoa))
	}, [agentEoa])

	useEffect(() => {
		reloadTemps()
	}, [reloadTemps, tempsRefreshKey])

	const refreshCards = useCallback(async (temp: AgentTempAccount) => {
		const key = temp.eoa.toLowerCase()
		setCardsByTemp((prev) => ({
			...prev,
			[key]: { loading: true, rows: prev[key]?.rows ?? [] },
		}))
		try {
			const rows = await listTempMerchantCards(temp.eoa)
			setCardsByTemp((prev) => ({ ...prev, [key]: { loading: false, rows } }))
			for (const row of rows) {
				if (!row.transferred || !row.owner) continue
				void registerMerchantUnderAgent(row.owner, row.cardAddress, temp.eoa).catch(() => undefined)
			}
		} catch {
			setCardsByTemp((prev) => ({
				...prev,
				[key]: {
					loading: false,
					rows: prev[key]?.rows ?? [],
					error: 'Could not load merchant cards',
				},
			}))
		}
	}, [])

	useEffect(() => {
		if (!agentEoa || temps.length === 0) return
		let cancelled = false
		for (const temp of temps) {
			const key = temp.eoa.toLowerCase()
			void registerTempUnderAgent(temp.eoa).catch(() => undefined)
			setCardsByTemp((prev) => ({
				...prev,
				[key]: { loading: true, rows: prev[key]?.rows ?? [] },
			}))
			void listTempMerchantCards(temp.eoa)
				.then((rows) => {
					if (cancelled) return
					setCardsByTemp((prev) => ({ ...prev, [key]: { loading: false, rows } }))
					for (const row of rows) {
						if (!row.transferred || !row.owner) continue
						void registerMerchantUnderAgent(row.owner, row.cardAddress, temp.eoa).catch(
							() => undefined,
						)
					}
				})
				.catch(() => {
					if (cancelled) return
					setCardsByTemp((prev) => ({
						...prev,
						[key]: {
							loading: false,
							rows: prev[key]?.rows ?? [],
							error: prev[key]?.rows?.length ? undefined : 'Could not load merchant cards',
						},
					}))
				})
		}
		return () => {
			cancelled = true
		}
	}, [temps, agentEoa, tempsRefreshKey])

	const selectedTemp = useMemo(
		() => temps.find((t) => t.eoa.toLowerCase() === selectedEoa.toLowerCase()) ?? null,
		[temps, selectedEoa],
	)

	const selectedCards = selectedTemp
		? cardsByTemp[selectedTemp.eoa.toLowerCase()]
		: undefined
	const ready = accountReady(selectedCards?.rows)
	const claimed = accountClaimed(selectedCards?.rows)
	const manageable = primaryManageableCard(selectedCards?.rows)

	useEffect(() => {
		const addrs = Object.values(cardsByTemp).flatMap((s) => s.rows.map((r) => r.cardAddress))
		if (addrs.length === 0) return
		registerCardAddresses(addrs)
	}, [cardsByTemp, registerCardAddresses])

	const merchantCardTitle = (card: AgentTempMerchantCard): string =>
		pickMerchantCardListTitle({
			workerName: resolveName(card.cardAddress),
			metaName: card.name,
			fallback: 'Merchant card',
		})

	const businessDisplayName = useMemo(() => {
		if (!selectedTemp) return 'Temporary account'
		if (manageable) return merchantCardTitle(manageable)
		const transferred = visibleCards(selectedCards?.rows ?? []).find((r) => r.transferred)
		if (transferred) return merchantCardTitle(transferred)
		return `@${selectedTemp.beamioTag.replace(/^@/, '')}`
	}, [selectedTemp, manageable, selectedCards, resolveName])

	const agentLabel = useMemo(() => {
		const tag = agentTag.replace(/^@/, '').trim()
		return tag ? `Agent · @${tag}` : 'Agent'
	}, [agentTag])

	const toggleEssentials = (key: Exclude<EssentialsKey, null>) => {
		setEssentialsOpen((prev) => (prev === key ? null : key))
	}

	const copyText = async (key: string, value: string) => {
		try {
			await navigator.clipboard.writeText(value)
			setCopiedKey(key)
			window.setTimeout(() => setCopiedKey((current) => (current === key ? '' : current)), 2000)
		} catch {
			/* clipboard may be unavailable */
		}
	}

	const openManage = (temp: AgentTempAccount) => {
		setSelectedEoa(temp.eoa)
		setRevealPw(false)
		setClaimError('')
		setClaimUrl('')
		setPreviewUrl('')
		setView('manage')
		void refreshCards(temp)
	}

	const openCardPreview = () => {
		if (!manageable || !agentEoa) return
		setPreviewUrl(buildDiscoverMerchantShareUrl(manageable.cardAddress, agentEoa))
		setView('cardPreview')
	}

	const openHandoff = async () => {
		if (!selectedTemp || !manageable || !agentEoa) return
		setClaimBusy(true)
		setClaimError('')
		try {
			const built = await buildAgentCardClaimUrlForTemp({
				temp: selectedTemp,
				cardAddress: manageable.cardAddress,
				agentEoa,
			})
			if (!built.ok) {
				setClaimError(built.error)
				return
			}
			setClaimUrl(built.url)
			setView('handoff')
		} catch (err) {
			setClaimError(err instanceof Error ? err.message : 'Could not build the owner link.')
		} finally {
			setClaimBusy(false)
		}
	}

	const openBusinessOs = async (flow?: 'business') => {
		if (!selectedTemp) return
		try {
			await registerTempUnderAgent(selectedTemp.eoa)
		} catch {
			/* still open — local sponsored flag covers first create */
		}
		openExternalUrl(
			merchantOsUnlockUrl(selectedTemp.beamioTag, selectedTemp.accessPassword, flow),
		)
	}

	const panelBack = (
		title: string,
		onBackClick: () => void,
	) => (
		<div className="relative flex items-center justify-between">
			<BeamioCircularBackButton variant="onLight" onClick={onBackClick} aria-label="Back" />
			<h1 className="pointer-events-none absolute inset-x-12 truncate text-center text-[17px] font-semibold text-[#0F172A] dark:text-slate-100">
				{title}
			</h1>
			<span className="h-9 w-9 shrink-0" aria-hidden />
		</div>
	)

	if (view === 'partnerPlan') {
		return (
			<div className="space-y-4 pb-4">
				{panelBack('Partner reward plan', () => setView('main'))}
				<section className="rounded-[20px] border border-[#eadcf7] bg-white p-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
					<p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
						Qualifying locations and enrolled partners can earn one-time rewards for paid onboarding and
						the Day-60 milestone (up to 100 USDC each), plus recurring rewards from eligible paid Charge
						and Top-up usage.
					</p>
				</section>
				<section className="grid grid-cols-2 gap-3">
					<div className="rounded-[20px] border border-[#eadcf7] bg-white p-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
						<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6edf9] text-[#8b3e91]">
							<Store className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</span>
						<p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Paid onboarding</p>
						<p className="mt-1 text-[11px] text-slate-400">Up to</p>
						<p className="mt-0.5 text-[22px] font-extrabold tabular-nums leading-none text-[#8b3e91]">
							100 USDC
						</p>
					</div>
					<div className="rounded-[20px] border border-[#eadcf7] bg-white p-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
						<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6edf9] text-[#8b3e91]">
							<CalendarDays className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</span>
						<p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Day-60 milestone</p>
						<p className="mt-1 text-[11px] text-slate-400">One-time</p>
						<p className="mt-0.5 text-[22px] font-extrabold tabular-nums leading-none text-[#8b3e91]">
							100 USDC
						</p>
					</div>
				</section>
				<p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8b3e91]">
					<RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
					Plus recurring rewards from eligible paid usage
				</p>
			</div>
		)
	}

	if (view === 'cardPreview' && selectedTemp && manageable) {
		const title = merchantCardTitle(manageable)
		return (
			<div className="space-y-4 pb-4">
				{panelBack('Card preview', () => setView('manage'))}
				<div className="inline-flex items-center gap-1.5 rounded-full bg-[#eef2ff] px-3 py-1 text-[11px] font-semibold text-[#4338ca] dark:bg-indigo-950/40 dark:text-indigo-200">
					<Eye className="h-3.5 w-3.5" aria-hidden />
					Consumer app preview
				</div>
				<div>
					<h2 className="text-[20px] font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
					<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
						Scan to view this card in the Beamio app.
					</p>
				</div>
				<div className="rounded-[20px] border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
					<div className="flex items-center gap-3">
						<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f6edf9] text-[#8b3e91]">
							<Store className="h-6 w-6" strokeWidth={2} aria-hidden />
						</span>
						<div className="min-w-0">
							<p className="truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">{title}</p>
							<p className="mt-0.5 font-mono text-[11px] text-slate-500">
								{shortAddress(manageable.cardAddress)}
							</p>
						</div>
					</div>
				</div>
				{previewUrl ? (
					<div className="flex flex-col items-center rounded-[20px] border border-slate-200/90 bg-white px-4 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
						<QRCodeCanvas value={previewUrl} size={200} level="M" includeMargin />
						<p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
							<QrCode className="h-3.5 w-3.5" aria-hidden />
							View only · no ownership transfer
						</p>
					</div>
				) : (
					<div role="alert" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
						This card address cannot be shared.
					</div>
				)}
				<p className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-500">
					<Share2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
					Available by link before public listing.
				</p>
				{previewUrl ? (
					<div className="grid grid-cols-2 gap-2.5">
						<button
							type="button"
							onClick={() => void copyText('preview', previewUrl)}
							className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
						>
							{copiedKey === 'preview' ? (
								<Check className="h-4 w-4 text-emerald-500" aria-hidden />
							) : (
								<Copy className="h-4 w-4" aria-hidden />
							)}
							Copy link
						</button>
						<button
							type="button"
							onClick={() => {
								if (navigator.share) {
									void navigator.share({ url: previewUrl, title }).catch(() => undefined)
								} else {
									void copyText('preview', previewUrl)
								}
							}}
							className="inline-flex items-center justify-center gap-2 rounded-full px-3 py-3 text-sm font-semibold text-white"
							style={{ backgroundColor: M_PURPLE }}
						>
							<Share2 className="h-4 w-4" aria-hidden />
							Share
						</button>
					</div>
				) : null}
				<details className="rounded-[16px] border border-slate-200/90 bg-white open:pb-3 dark:border-slate-700 dark:bg-slate-900">
					<summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
						Preview link details
					</summary>
					<div className="space-y-2 px-4 pb-1">
						{previewUrl ? (
							<p className="break-all font-mono text-[11px] leading-relaxed text-slate-500">{previewUrl}</p>
						) : null}
						<p className="text-[12px] text-slate-400">
							This link opens the consumer card view. It cannot be used to take ownership.
						</p>
					</div>
				</details>
			</div>
		)
	}

	if (view === 'handoff' && selectedTemp && manageable) {
		const title = merchantCardTitle(manageable)
		return (
			<div className="space-y-4 pb-4">
				{panelBack('Owner onboarding', () => setView('manage'))}
				<div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
					<KeyRound className="h-3.5 w-3.5" aria-hidden />
					Transfer to the business owner
				</div>
				<div>
					<h2 className="text-[20px] font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
					<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
						The owner opens Business OS to create their BeamioTag and password, back up the Recovery Code
						and complete onboarding.
					</p>
				</div>
				<div
					role="alert"
					className="flex gap-3 rounded-[16px] border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
				>
					<Lock className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
					<div>
						<p className="font-semibold">Share only with the intended owner</p>
						<p className="mt-0.5 text-[12px] leading-relaxed opacity-90">
							Anyone with this link or QR can take control of the business account.
						</p>
					</div>
				</div>
				{claimUrl ? (
					<div className="flex flex-col items-center rounded-[20px] border border-slate-200/90 bg-white px-4 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
						<QRCodeCanvas value={claimUrl} size={200} level="M" includeMargin />
						<p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
							<Lock className="h-3.5 w-3.5" aria-hidden />
							Opens Business OS · owner access
						</p>
					</div>
				) : null}
				<div className="flex items-center justify-center gap-2 text-[12px] font-semibold text-slate-500">
					<span className="inline-flex items-center gap-1">
						<UserRound className="h-3.5 w-3.5" aria-hidden />
						Account
					</span>
					<span aria-hidden>→</span>
					<span className="inline-flex items-center gap-1">
						<Lock className="h-3.5 w-3.5" aria-hidden />
						Back up
					</span>
					<span aria-hidden>→</span>
					<span className="inline-flex items-center gap-1">
						<BadgeCheck className="h-3.5 w-3.5" aria-hidden />
						Complete
					</span>
				</div>
				{claimUrl ? (
					<div className="grid grid-cols-2 gap-2.5">
						<button
							type="button"
							onClick={() => void copyText('owner', claimUrl)}
							className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
						>
							{copiedKey === 'owner' ? (
								<Check className="h-4 w-4 text-emerald-500" aria-hidden />
							) : (
								<Copy className="h-4 w-4" aria-hidden />
							)}
							Copy link
						</button>
						<button
							type="button"
							onClick={() => {
								if (navigator.share) {
									void navigator.share({ url: claimUrl, title: 'Owner onboarding' }).catch(() => undefined)
								} else {
									void copyText('owner', claimUrl)
								}
							}}
							className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-600 px-3 py-3 text-sm font-semibold text-white"
						>
							<Send className="h-4 w-4" aria-hidden />
							Share
						</button>
					</div>
				) : null}
				<details className="rounded-[16px] border border-slate-200/90 bg-white open:pb-3 dark:border-slate-700 dark:bg-slate-900">
					<summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
						After the owner completes onboarding
					</summary>
					<div className="space-y-2 px-4 pb-1 text-[13px] leading-relaxed text-slate-500">
						<p>
							The owner manages business images, membership, promotions and rules. Your temporary access
							ends. You can continue viewing B-Units usage, balance and your referral income.
						</p>
						<p>
							Share the onboarding link rather than temporary credentials. Referral partners must not
							retain the owner’s password.
						</p>
					</div>
				</details>
			</div>
		)
	}

	if (view === 'manage' && selectedTemp) {
		const tagPlain = selectedTemp.beamioTag.replace(/^@/, '')
		const cardsLoading = !!selectedCards?.loading
		return (
			<div className="space-y-4 pb-4">
				{panelBack(claimed ? 'Business overview' : 'Manage business', () => setView('main'))}

				{claimed ? (
					<>
						<div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
							<div className="flex items-start gap-3">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
									<BadgeCheck className="h-5 w-5" strokeWidth={2.25} aria-hidden />
								</span>
								<div className="min-w-0">
									<h2 className="text-[17px] font-semibold text-emerald-950 dark:text-emerald-50">
										Onboarding complete
									</h2>
									<p className="mt-1 text-sm text-emerald-800/90 dark:text-emerald-200/90">
										{businessDisplayName} is managed by its owner.
									</p>
								</div>
							</div>
						</div>
						<div className="rounded-[20px] border border-slate-200/90 bg-white px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
							<p className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
								{businessDisplayName}
							</p>
							<p className="mt-0.5 text-xs text-slate-500">Business account</p>
						</div>
						<div className="flex gap-3 rounded-[16px] border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
							<Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
							<p>
								Temporary access and the owner onboarding link are no longer active. Your referral remains
								recorded.
							</p>
						</div>
						{visibleCards(selectedCards?.rows ?? []).map((card) => (
							<button
								key={card.cardAddress}
								type="button"
								onClick={() => openExternalUrl(merchantCardContractCodeUrl(card.cardAddress))}
								className="flex w-full items-center gap-3 rounded-[16px] border border-slate-200 bg-white px-3 py-3 text-left dark:border-slate-700 dark:bg-slate-900"
							>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
										{merchantCardTitle(card)}
									</p>
									<p className="mt-0.5 font-mono text-[11px] text-slate-500">
										{shortAddress(card.cardAddress)}
									</p>
								</div>
								<ExternalLink className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
							</button>
						))}
					</>
				) : (
					<>
						<div className="flex items-start gap-3 rounded-[20px] border border-slate-200/90 bg-white px-4 py-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
							<span
								className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
								style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
							>
								<Store className="h-5 w-5" strokeWidth={2.25} aria-hidden />
							</span>
							<div className="min-w-0 flex-1">
								<h2 className="truncate text-[17px] font-semibold text-slate-900 dark:text-slate-50">
									{businessDisplayName}
								</h2>
								<p className="mt-0.5 truncate text-xs text-slate-500">@{tagPlain}</p>
							</div>
							<span
								className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
									ready
										? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
										: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
								}`}
							>
								{ready ? 'Card ready' : 'Temporary'}
							</span>
						</div>

						<section className="rounded-[20px] border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
							<div className="flex items-start gap-3">
								<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
									<Pencil className="h-4 w-4" strokeWidth={2.25} aria-hidden />
								</span>
								<div className="min-w-0">
									<h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
										Prepare the business
									</h3>
									<p className="mt-0.5 text-[12px] text-slate-500">Profile, membership and promotions</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => void openBusinessOs(ready ? undefined : 'business')}
								className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white"
								style={{ backgroundColor: M_PURPLE }}
							>
								Open Business OS
								<ExternalLink className="h-3.5 w-3.5" aria-hidden />
							</button>
						</section>

						<section className="rounded-[20px] border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
							<div className="flex items-start gap-3">
								<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef2ff] text-[#4338ca] dark:bg-indigo-950/40 dark:text-indigo-200">
									<Eye className="h-4 w-4" strokeWidth={2.25} aria-hidden />
								</span>
								<div className="min-w-0 flex-1">
									<h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
										Consumer app preview
									</h3>
									<p className="mt-0.5 text-[12px] text-slate-500">
										See the card as customers will see it.
									</p>
								</div>
							</div>
							{cardsLoading ? (
								<p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
									<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
									Loading card
								</p>
							) : ready && manageable ? (
								<>
									<div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-800/60">
										<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f6edf9] text-[#8b3e91]">
											<Store className="h-5 w-5" aria-hidden />
										</span>
										<div className="min-w-0">
											<p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
												{merchantCardTitle(manageable)}
											</p>
											<p className="mt-0.5 font-mono text-[11px] text-slate-500">
												{shortAddress(manageable.cardAddress)}
											</p>
										</div>
									</div>
									<button
										type="button"
										onClick={openCardPreview}
										className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-4 py-3 text-sm font-semibold text-[#4338ca] dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
									>
										<QrCode className="h-4 w-4" aria-hidden />
										Preview card & QR
									</button>
								</>
							) : (
								<>
									<div className="mt-3 flex gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/60">
										<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 dark:bg-slate-900">
											<Store className="h-4 w-4" aria-hidden />
										</span>
										<div>
											<p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
												No business card yet
											</p>
											<p className="mt-0.5 text-[12px] text-slate-500">
												Create the card in Business OS, then refresh.
											</p>
										</div>
									</div>
									<button
										type="button"
										onClick={() => void refreshCards(selectedTemp)}
										disabled={cardsLoading}
										className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
									>
										{cardsLoading ? (
											<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
										) : (
											<RefreshCw className="h-4 w-4" aria-hidden />
										)}
										Refresh card
									</button>
								</>
							)}
							{selectedCards?.error ? (
								<p className="mt-2 text-sm text-amber-700" role="alert">
									{selectedCards.error}
								</p>
							) : null}
						</section>

						{ready ? (
							<section className="rounded-[20px] border border-amber-200/80 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
								<div className="flex items-start gap-3">
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
										<KeyRound className="h-4 w-4" strokeWidth={2.25} aria-hidden />
									</span>
									<div className="min-w-0">
										<h3 className="text-[15px] font-semibold text-amber-950 dark:text-amber-50">
											Hand over to the owner
										</h3>
										<p className="mt-0.5 text-[12px] text-amber-800/90 dark:text-amber-200/90">
											Account setup and recovery-code backup.
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => void openHandoff()}
									disabled={claimBusy}
									aria-busy={claimBusy}
									className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
								>
									{claimBusy ? (
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
									) : (
										<Send className="h-4 w-4" aria-hidden />
									)}
									Owner onboarding link & QR
								</button>
								<p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-amber-800/80 dark:text-amber-200/80">
									<Lock className="h-3 w-3" aria-hidden />
									Private · intended owner only
								</p>
								{claimError ? (
									<div
										role="alert"
										className="mt-2 flex gap-2 rounded-xl border border-amber-300 bg-white/80 px-3 py-2 text-sm text-amber-900"
									>
										<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
										<p>{claimError}</p>
									</div>
								) : null}
							</section>
						) : null}

						<details className="rounded-[16px] border border-slate-200/90 bg-white open:pb-3 dark:border-slate-700 dark:bg-slate-900">
							<summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
								<KeyRound className="h-4 w-4 text-[#8b3e91]" aria-hidden />
								<span className="flex-1">Temporary account details</span>
								<ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
							</summary>
							<div className="space-y-2.5 px-4 pb-1">
								<div className="flex flex-wrap gap-2">
									<button
										type="button"
										tabIndex={-1}
										onClick={() => void copyText('tag', selectedTemp.beamioTag)}
										className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#eadcf7] bg-[#f5ecff] px-3 py-1.5 text-[13px] font-semibold text-[#8d3a8b]"
										aria-label="Copy temporary BeamioTag"
									>
										<span className="truncate">@{tagPlain}</span>
										{copiedKey === 'tag' ? (
											<Check className="h-3 w-3 text-emerald-500" />
										) : (
											<Copy className="h-3 w-3" />
										)}
									</button>
									<button
										type="button"
										tabIndex={-1}
										onClick={() => void copyText('eoa', selectedTemp.eoa)}
										className="inline-flex items-center gap-1.5 rounded-full border border-[#dce2f7] bg-[#e9edff] px-3 py-1.5 font-mono text-[11px] text-[#424655]"
										aria-label="Copy account address"
									>
										{shortAddress(selectedTemp.eoa)}
										{copiedKey === 'eoa' ? (
											<Check className="h-3 w-3 text-emerald-500" />
										) : (
											<Copy className="h-3 w-3" />
										)}
									</button>
								</div>
								<p className="text-[11px] font-medium text-slate-400">Temporary password</p>
								<div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
									<span className="min-w-0 truncate">
										{revealPw ? selectedTemp.accessPassword : '••••••••••••'}
									</span>
									<button
										type="button"
										tabIndex={-1}
										aria-label={revealPw ? 'Hide password' : 'Show password'}
										onClick={() => setRevealPw((v) => !v)}
										className="inline-flex h-5 w-5 shrink-0 items-center justify-center"
									>
										{revealPw ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
									</button>
									<button
										type="button"
										tabIndex={-1}
										aria-label="Copy temporary password"
										onClick={() => void copyText('pw', selectedTemp.accessPassword)}
										className="inline-flex h-5 w-5 shrink-0 items-center justify-center"
									>
										{copiedKey === 'pw' ? (
											<Check className="h-3 w-3 text-emerald-500" />
										) : (
											<Copy className="h-3 w-3" />
										)}
									</button>
								</div>
								<p className="text-[12px] text-slate-400">
									Temporary access ends when the owner completes onboarding.
								</p>
							</div>
						</details>

						{ready && manageable ? (
							<details className="rounded-[16px] border border-slate-200/90 bg-white open:pb-3 dark:border-slate-700 dark:bg-slate-900">
								<summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
									<span className="flex-1">Card details</span>
									<ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
								</summary>
								<div className="space-y-2 px-4 pb-1">
									<div className="flex items-center justify-between gap-2 text-sm">
										<span className="text-slate-500">Card contract</span>
										<strong className="font-mono text-[12px] text-slate-800 dark:text-slate-100">
											{shortAddress(manageable.cardAddress)}
										</strong>
									</div>
									<button
										type="button"
										onClick={() => openExternalUrl(merchantCardContractCodeUrl(manageable.cardAddress))}
										className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8b3e91]"
									>
										View on CoNET Explorer
										<ExternalLink className="h-3.5 w-3.5" aria-hidden />
									</button>
								</div>
							</details>
						) : null}
					</>
				)}
			</div>
		)
	}

	return (
		<div className="space-y-5 pb-4">
			<div className="relative flex items-center justify-between">
				<BeamioCircularBackButton variant="onLight" onClick={onBack} aria-label="Back" />
				<h1 className="pointer-events-none absolute inset-x-12 truncate text-center text-[17px] font-semibold text-[#0F172A] dark:text-slate-100">
					Merchants Business
				</h1>
				<span className="h-9 w-9 shrink-0" aria-hidden />
			</div>

			<section className="overflow-hidden rounded-[22px] border border-[#eadcf7] bg-gradient-to-br from-[#faf5fc] via-white to-[#f3e8f8] p-4 shadow-sm dark:border-purple-900/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
				<div className="flex items-start gap-3">
					<span
						className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
						style={{ backgroundColor: M_PURPLE }}
					>
						<Building2 className="h-5 w-5" strokeWidth={2.25} aria-hidden />
					</span>
					<div className="min-w-0 flex-1">
						<p className="text-[11px] font-bold uppercase tracking-widest text-[#8b3e91]/80">
							{agentLabel}
						</p>
						<h2 className="mt-0.5 text-[18px] font-semibold leading-snug text-slate-900 dark:text-slate-50">
							Help merchants go live
						</h2>
						<p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
							Create a temporary account, prepare their business card, then hand ownership to the
							merchant.
						</p>
					</div>
				</div>
				<div className="mt-4 flex items-center justify-between gap-1 px-1">
					{(
						[
							{ Icon: UserRound, label: 'Temp account' },
							{ Icon: Store, label: 'Prepare card' },
							{ Icon: KeyRound, label: 'Hand over' },
							{ Icon: BadgeCheck, label: 'Rewards' },
						] as const
					).map((step, i) => (
						<React.Fragment key={step.label}>
							{i > 0 ? (
								<span className="mb-5 h-px min-w-[8px] flex-1 bg-[#eadcf7] dark:bg-purple-900/50" aria-hidden />
							) : null}
							<div className="flex min-w-0 flex-1 flex-col items-center text-center">
								<span
									className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#eadcf7] dark:bg-slate-800 dark:ring-purple-800"
									style={{ color: M_PURPLE }}
								>
									<step.Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
								</span>
								<p className="mt-2 text-[11px] font-semibold leading-snug text-slate-600 dark:text-slate-300">
									{step.label}
								</p>
							</div>
						</React.Fragment>
					))}
				</div>
				<button
					type="button"
					onClick={onCreateTemporary}
					className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(139,62,145,0.35)] transition active:scale-[0.99]"
					style={{ backgroundColor: M_PURPLE }}
				>
					<Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
					Create temporary account
				</button>
			</section>

			<section>
				<div className="mb-2.5 flex items-center justify-between gap-2">
					<h2 className="text-[17px] font-semibold text-slate-900 dark:text-slate-50">Business accounts</h2>
					<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
						{temps.length}
					</span>
				</div>
				{temps.length === 0 ? (
					<div className="flex flex-col items-center rounded-[20px] border border-dashed border-slate-200 bg-white px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900">
						<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f6edf9] text-[#8b3e91]">
							<Store className="h-6 w-6" strokeWidth={2} aria-hidden />
						</span>
						<p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
							No accounts yet. Create one to begin.
						</p>
					</div>
				) : (
					<ul className="space-y-2">
						{temps.map((temp) => {
							const key = temp.eoa.toLowerCase()
							const cardState = cardsByTemp[key]
							const readyRow = accountReady(cardState?.rows)
							const claimedRow = accountClaimed(cardState?.rows)
							const manageableRow = primaryManageableCard(cardState?.rows)
							const transferredRow = visibleCards(cardState?.rows ?? []).find((r) => r.transferred)
							const title = claimedRow
								? pickMerchantCardListTitle({
										workerName: transferredRow ? resolveName(transferredRow.cardAddress) : '',
										metaName: transferredRow?.name,
										fallback: `@${temp.beamioTag.replace(/^@/, '')}`,
									})
								: readyRow && manageableRow
									? pickMerchantCardListTitle({
											workerName: resolveName(manageableRow.cardAddress),
											metaName: manageableRow.name,
											fallback: `@${temp.beamioTag.replace(/^@/, '')}`,
										})
									: `@${temp.beamioTag.replace(/^@/, '')}`
							const subtitle = claimedRow
								? 'Onboarding complete'
								: readyRow
									? 'Card prepared · temporary account'
									: cardState?.loading
										? 'Loading…'
										: 'Temporary account · setup not started'
							return (
								<li key={key}>
									<button
										type="button"
										onClick={() => openManage(temp)}
										className="flex w-full items-center gap-3 rounded-[18px] border border-slate-200/90 bg-white px-3.5 py-3 text-left shadow-sm transition active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900"
									>
										<span
											className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
												claimedRow
													? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
													: 'bg-[#f6edf9] text-[#8b3e91]'
											}`}
										>
											{claimedRow ? (
												<BadgeCheck className="h-5 w-5" strokeWidth={2.25} aria-hidden />
											) : (
												<Store className="h-5 w-5" strokeWidth={2.25} aria-hidden />
											)}
										</span>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-[15px] font-semibold text-slate-900 dark:text-slate-50">
												{title}
											</span>
											<span className="mt-0.5 block truncate text-[12px] text-slate-500 dark:text-slate-400">
												{subtitle}
											</span>
										</span>
										<span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-[#8b3e91]">
											{claimedRow ? 'View' : 'Manage'}
											<ChevronRight className="h-4 w-4" aria-hidden />
										</span>
									</button>
								</li>
							)
						})}
					</ul>
				)}
			</section>

			<section>
				<div className="mb-2.5 flex items-end justify-between gap-2">
					<h2 className="text-[17px] font-semibold text-slate-900 dark:text-slate-50">Referral rewards</h2>
					<span className="text-[11px] font-medium text-slate-400">One-time · per location</span>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<div className="rounded-[20px] border border-[#eadcf7] bg-white p-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
						<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6edf9] text-[#8b3e91]">
							<Store className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</span>
						<p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Paid onboarding</p>
						<p className="mt-1 text-[11px] text-slate-400">Up to</p>
						<p className="mt-0.5 text-[22px] font-extrabold tabular-nums leading-none text-[#8b3e91]">100 USDC</p>
					</div>
					<div className="rounded-[20px] border border-[#eadcf7] bg-white p-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
						<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f6edf9] text-[#8b3e91]">
							<CalendarDays className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</span>
						<p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">Day-60 milestone</p>
						<p className="mt-1 text-[11px] text-slate-400">One-time</p>
						<p className="mt-0.5 text-[22px] font-extrabold tabular-nums leading-none text-[#8b3e91]">100 USDC</p>
					</div>
				</div>
				<p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[#8b3e91]">
					<RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
					Plus recurring rewards from eligible paid usage
				</p>
				<button
					type="button"
					onClick={() => setView('partnerPlan')}
					className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-full px-4 py-3 text-sm font-semibold transition active:scale-[0.99]"
					style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
				>
					View reward plan
					<span aria-hidden>→</span>
				</button>
				<p className="mt-2.5 text-center text-[11px] leading-relaxed text-slate-400">
					Qualifying locations and enrolled partners only. Conditions apply.
				</p>
			</section>

			<section>
				<h2 className="mb-2.5 text-[17px] font-semibold text-slate-900 dark:text-slate-50">Business essentials</h2>
				<div className="overflow-hidden rounded-[20px] border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
					{(
						[
							{ key: 'fees' as const, Icon: FileText, title: 'Service fees' },
							{ key: 'packages' as const, Icon: Layers, title: 'Business packages' },
							{ key: 'calc' as const, Icon: Calculator, title: 'Reward calculation' },
						] as const
					).map((row, idx) => {
						const open = essentialsOpen === row.key
						return (
							<div
								key={row.key}
								className={idx > 0 ? 'border-t border-slate-100 dark:border-slate-800' : undefined}
							>
								<button
									type="button"
									onClick={() => toggleEssentials(row.key)}
									className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
									aria-expanded={open}
								>
									<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
										<row.Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
									</span>
									<span className="min-w-0 flex-1 text-[15px] font-semibold text-slate-900 dark:text-slate-50">
										{row.title}
									</span>
									<ChevronDown
										className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
										aria-hidden
									/>
								</button>
								{open && row.key === 'fees' ? (
									<div className="space-y-2 px-4 pb-4">
										{FEE_ROWS.map((fee) => (
											<div
												key={fee.label}
												className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/80"
											>
												<div className="min-w-0">
													<p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{fee.label}</p>
													<p className="text-[11px] text-slate-400">{fee.note}</p>
												</div>
												<p className="shrink-0 text-sm font-bold tabular-nums text-[#8b3e91]">{fee.fee}</p>
											</div>
										))}
									</div>
								) : null}
								{open && row.key === 'packages' ? (
									<div className="space-y-2 px-4 pb-4">
										{PACKAGE_ROWS.map((pkg) => (
											<div
												key={pkg.name}
												className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/80"
											>
												<div className="flex items-center justify-between gap-2">
													<p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{pkg.name}</p>
													{pkg.badge ? (
														<span className="rounded-full bg-[#f6edf9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8b3e91]">
															{pkg.badge}
														</span>
													) : null}
												</div>
												<p className="mt-1 text-[15px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
													${pkg.priceUsdc} USDC
												</p>
												<p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
													{pkg.totalBUnits} B-Units
												</p>
											</div>
										))}
									</div>
								) : null}
								{open && row.key === 'calc' ? (
									<div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
										<p>
											One-time partner rewards are paid per qualifying location for paid onboarding and the Day-60
											milestone (up to 100 USDC each).
										</p>
										<p>
											Recurring rewards follow eligible paid Charge and Top-up usage at enrolled partner locations under
											the partner program rules.
										</p>
									</div>
								) : null}
							</div>
						)
					})}
				</div>
			</section>

			<p className="text-center text-[12px] leading-relaxed text-slate-400">
				Temporary accounts stay separate from your personal account.
			</p>
		</div>
	)
}
