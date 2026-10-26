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
	Code2,
	Copy,
	CreditCard,
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
	UserRoundPlus,
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
	{ label: 'Direct USDC settlement', fee: '25', note: 'Per transaction' },
	{ label: 'Stored-value / membership top-up', fee: '20', note: 'Per transaction' },
	{ label: 'Spending, points exchange, coupon claim or redemption', fee: '5', note: 'Per transaction' },
	{ label: 'Coupon issuance', fee: '100', note: 'Per coupon' },
	{ label: 'Coupon redemption-code issuance', fee: '10', note: 'Per batch · up to 100 codes' },
	{ label: 'Social action', fee: '0.1', note: 'Per action' },
]

/** Price + total B-Units only — no Paid/Free split (beamio-fuel-pack-display-no-paid-free). */
const PACKAGE_ROWS: { name: string; priceUsdc: string; totalBUnits: string; badge?: string }[] = [
	{ name: 'Start Kit', priceUsdc: '49', totalBUnits: '5,145', badge: 'First-time' },
	{ name: 'Growth', priceUsdc: '199', totalBUnits: '21,890', badge: 'Best value' },
	{ name: 'Scale', priceUsdc: '999', totalBUnits: '114,885' },
	{ name: 'Enterprise', priceUsdc: '4,999', totalBUnits: '599,880' },
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
		// No card yet — match sample accountName(): "Temporary account"
		return 'Temporary account'
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
		const identityTitle = ready || claimed ? businessDisplayName : 'Temporary account'
		const cardInitial =
			(manageable ? merchantCardTitle(manageable) : 'B').trim().charAt(0).toUpperCase() || 'B'

		const temporaryAccountDetails = (
			<details className="rounded-[16px] border border-slate-200/90 bg-white open:pb-3 dark:border-slate-700 dark:bg-slate-900">
				<summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
					<KeyRound className="h-4 w-4 text-[#64748b]" aria-hidden />
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
					{!claimed ? (
						<>
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
						</>
					) : null}
				</div>
			</details>
		)

		return (
			<div className="space-y-3.5 pb-4">
				{panelBack(claimed ? 'Business overview' : 'Invite a business', () => setView('main'))}

				{/* Identity */}
				<div className="flex items-start gap-3">
					<span
						className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]"
						style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
					>
						{claimed ? (
							<BadgeCheck className="h-5 w-5" strokeWidth={2.25} aria-hidden />
						) : (
							<Store className="h-5 w-5" strokeWidth={2.25} aria-hidden />
						)}
					</span>
					<div className="min-w-0 flex-1">
						<h2 className="truncate text-[22px] font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-50">
							{identityTitle}
						</h2>
						<p className="mt-0.5 truncate text-[13px] text-slate-500">@{tagPlain}</p>
					</div>
					<span
						className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
							claimed || ready
								? 'bg-[#e7f8ef] text-[#0f7a45]'
								: 'bg-[#fff3d6] text-[#9a6b00]'
						}`}
					>
						{claimed ? 'Active' : ready ? 'Card ready' : 'Temporary'}
					</span>
				</div>

				{claimed ? (
					<>
						<section className="rounded-[20px] border border-[#b7ebd0] bg-gradient-to-br from-[#f3fff8] to-white p-4 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-slate-900">
							<div className="flex items-start gap-3">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e7f8ef] text-[#0f7a45]">
									<BadgeCheck className="h-5 w-5" strokeWidth={2.25} aria-hidden />
								</span>
								<div className="min-w-0">
									<h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-50">
										Onboarding complete
									</h3>
									<p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
										{businessDisplayName} is managed by its owner. Temporary access and the owner
										onboarding link are no longer active.
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => void openBusinessOs()}
								className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[13px] bg-[#0f172a] px-4 py-3.5 text-[15px] font-bold text-white"
							>
								Open Business OS
								<ExternalLink className="h-4 w-4 opacity-90" aria-hidden />
							</button>
						</section>

						{temporaryAccountDetails}

						{visibleCards(selectedCards?.rows ?? []).map((card) => (
							<details
								key={card.cardAddress}
								className="rounded-[16px] border border-slate-200/90 bg-white open:pb-3 dark:border-slate-700 dark:bg-slate-900"
							>
								<summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
									<Code2 className="h-4 w-4 shrink-0 text-[#64748b]" aria-hidden />
									<span className="min-w-0 flex-1 truncate">Card · {merchantCardTitle(card)}</span>
									<ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
								</summary>
								<div className="space-y-2 px-4 pb-1">
									<div className="flex items-center justify-between gap-2 text-sm">
										<span className="text-slate-500">Card contract</span>
										<strong className="font-mono text-[12px] text-slate-800 dark:text-slate-100">
											{shortAddress(card.cardAddress)}
										</strong>
									</div>
									<button
										type="button"
										onClick={() => openExternalUrl(merchantCardContractCodeUrl(card.cardAddress))}
										className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8b3e91]"
									>
										View on CoNET Explorer
										<ExternalLink className="h-3.5 w-3.5" aria-hidden />
									</button>
								</div>
							</details>
						))}
					</>
				) : (
					<>
						{/* Prepare — both no-card & has-card */}
						<section className="rounded-[20px] border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
							<div className="flex items-start gap-3">
								<span
									className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
									style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
								>
									<Pencil className="h-4 w-4" strokeWidth={2.25} aria-hidden />
								</span>
								<div className="min-w-0">
									<h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-50">
										Prepare the business
									</h3>
									<p className="mt-0.5 text-[13px] text-slate-500">
										Profile, membership and promotions
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => void openBusinessOs(ready ? undefined : 'business')}
								className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[13px] px-4 py-3.5 text-[15px] font-bold text-white"
								style={{ backgroundColor: M_PURPLE }}
							>
								Open Business OS
								<ExternalLink className="h-4 w-4 opacity-90" aria-hidden />
							</button>
						</section>

						{/* Consumer app preview */}
						<section className="rounded-[20px] border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
							<div className="flex items-start gap-3">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#eef3ff] text-[#165ce9] dark:bg-indigo-950/40 dark:text-indigo-200">
									<Eye className="h-4 w-4" strokeWidth={2.25} aria-hidden />
								</span>
								<div className="min-w-0 flex-1">
									<h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-50">
										Consumer app preview
									</h3>
									<p className="mt-0.5 text-[13px] text-slate-500">
										See the card as customers will see it.
									</p>
								</div>
							</div>

							{cardsLoading ? (
								<p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
									<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
									Loading card
								</p>
							) : ready && manageable ? (
								<>
									<button
										type="button"
										onClick={openCardPreview}
										className="mt-4 w-full overflow-hidden rounded-[18px] border border-white/25 text-left shadow-[0_14px_28px_rgba(15,23,42,0.12)]"
										style={{
											background:
												'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 42%, #7c3aed 100%)',
										}}
									>
										<div className="relative min-h-[132px] p-4 text-white">
											<div className="flex items-start gap-3">
												<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/20 text-[18px] font-bold backdrop-blur-sm">
													{cardInitial}
												</div>
												<div className="min-w-0 flex-1">
													<p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">
														Beamio Business
													</p>
													<p className="mt-1 truncate text-[17px] font-bold leading-tight">
														{merchantCardTitle(manageable)}
													</p>
													<p className="mt-1 text-[12px] font-medium text-white/80">
														Single Top-up
													</p>
												</div>
												<CreditCard
													className="mt-1 h-5 w-5 shrink-0 text-white/70"
													strokeWidth={1.75}
													aria-hidden
												/>
											</div>
										</div>
									</button>
									<button
										type="button"
										onClick={openCardPreview}
										className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[13px] border border-[#d7e4ff] bg-[#f5f8ff] px-4 py-3 text-[14px] font-bold text-[#165ce9] dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
									>
										<QrCode className="h-4 w-4" aria-hidden />
										Preview card & QR
									</button>
								</>
							) : (
								<div className="mt-4 rounded-[16px] bg-[#f1f3fa] px-4 py-7 text-center dark:bg-slate-800/60">
									<div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#94a3b8] shadow-sm dark:bg-slate-900">
										<CreditCard className="h-5 w-5" strokeWidth={1.75} aria-hidden />
									</div>
									<p className="mt-3 text-[14px] font-bold text-slate-900 dark:text-slate-50">
										No business card yet
									</p>
									<p className="mt-1 text-[12px] leading-snug text-slate-500">
										Create the card in Business OS, then refresh.
									</p>
									<button
										type="button"
										onClick={() => void refreshCards(selectedTemp)}
										disabled={cardsLoading}
										className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#165ce9] disabled:opacity-50"
									>
										{cardsLoading ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
										) : (
											<RefreshCw className="h-3.5 w-3.5" aria-hidden />
										)}
										Refresh card
									</button>
								</div>
							)}
							{selectedCards?.error ? (
								<p className="mt-2 text-sm text-amber-700" role="alert">
									{selectedCards.error}
								</p>
							) : null}
						</section>

						{ready ? (
							<section
								className="rounded-[20px] border border-[#f0dfb4] p-4 shadow-sm dark:border-amber-900/40"
								style={{
									background: 'linear-gradient(180deg, #fffaf0 0%, #fff6e5 100%)',
								}}
							>
								<div className="flex items-start gap-3">
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#fff1d2] text-[#9e742b]">
										<KeyRound className="h-4 w-4" strokeWidth={2.25} aria-hidden />
									</span>
									<div className="min-w-0">
										<h3 className="text-[15px] font-bold text-slate-900 dark:text-slate-50">
											Hand over to the owner
										</h3>
										<p className="mt-0.5 text-[13px] text-slate-600">
											Account setup and recovery-code backup.
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => void openHandoff()}
									disabled={claimBusy}
									aria-busy={claimBusy}
									className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[13px] px-4 py-3.5 text-[15px] font-bold text-white disabled:opacity-60"
									style={{ backgroundColor: M_PURPLE }}
								>
									{claimBusy ? (
										<Loader2 className="h-4 w-4 animate-spin" aria-hidden />
									) : (
										<Send className="h-4 w-4" aria-hidden />
									)}
									Owner onboarding link & QR
								</button>
								<p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#9a6b00]">
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

						{temporaryAccountDetails}

						{ready && manageable ? (
							<details className="rounded-[16px] border border-slate-200/90 bg-white open:pb-3 dark:border-slate-700 dark:bg-slate-900">
								<summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 [&::-webkit-details-marker]:hidden">
									<Code2 className="h-4 w-4 shrink-0 text-[#64748b]" aria-hidden />
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
									<button
										type="button"
										onClick={() => void refreshCards(selectedTemp)}
										disabled={cardsLoading}
										className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#165ce9] disabled:opacity-50"
									>
										{cardsLoading ? (
											<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
										) : (
											<RefreshCw className="h-3.5 w-3.5" aria-hidden />
										)}
										Refresh card
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
		<div className="space-y-0 pb-4">
			<div className="relative mb-[17px] flex items-center justify-between">
				<BeamioCircularBackButton variant="onLight" onClick={onBack} aria-label="Back" />
				<h1 className="pointer-events-none absolute inset-x-12 truncate text-center text-[19px] font-semibold tracking-tight text-[#0F172A] dark:text-slate-100">
					Business
				</h1>
				<span className="h-9 w-9 shrink-0" aria-hidden />
			</div>

			<div
				className="mb-3.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold"
				style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
			>
				<BadgeCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
				{agentLabel}
			</div>

			<section className="rounded-[23px] border border-[#eadcf7] bg-gradient-to-br from-white to-[#f6edf9] px-4 py-[19px] shadow-sm dark:border-purple-900/40 dark:from-slate-900 dark:to-[#392a45]/40">
				<h2 className="max-w-[280px] text-[20px] font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50">
					Help a business get started.
				</h2>
				<div
					className="mt-[22px] mb-[18px] grid grid-cols-3 gap-3"
					aria-label="Create a temporary account, set up the business in Business OS, then hand over to the owner"
				>
					{(
						[
							{ Icon: UserRoundPlus, label: 'Create account' },
							{ Icon: Store, label: 'Set up in OS' },
							{ Icon: KeyRound, label: 'Owner handover' },
						] as const
					).map((step, i) => (
						<div key={step.label} className="relative text-center">
							{i < 2 ? (
								<span
									className="pointer-events-none absolute right-[-11px] top-2.5 z-[1] text-[13px] text-slate-400 dark:text-slate-500"
									aria-hidden
								>
									→
								</span>
							) : null}
							<span
								className="mx-auto mb-2 grid h-[38px] w-[38px] place-items-center rounded-[13px] bg-white shadow-[0_3px_10px_rgba(15,23,42,0.08)] dark:bg-slate-800"
								style={{ color: M_PURPLE }}
							>
								<step.Icon className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden />
							</span>
							<strong className="block text-[11px] font-medium leading-snug text-slate-700 dark:text-slate-200">
								{step.label}
							</strong>
						</div>
					))}
				</div>
				<button
					type="button"
					onClick={onCreateTemporary}
					className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[15px] px-4 py-3 text-[13px] font-semibold text-white shadow-[0_7px_18px_rgba(139,62,145,0.18)] transition active:scale-[0.99]"
					style={{
						background: `linear-gradient(120deg, ${M_PURPLE}, #a04da1)`,
					}}
				>
					<Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
					Create temporary account
				</button>
			</section>

			<section className="mt-[23px]">
				<div className="mb-[11px] flex items-center justify-between gap-2">
					<h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">Business accounts</h2>
					<span className="grid h-[23px] min-w-[23px] place-items-center rounded-lg bg-slate-100 px-1.5 text-[11px] font-semibold tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
						{temps.length}
					</span>
				</div>
				{temps.length === 0 ? (
					<div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-[17px] dark:border-slate-700 dark:bg-slate-900">
						<span className="grid place-items-center text-slate-400 dark:text-slate-500">
							<Store className="h-5 w-5" strokeWidth={2} aria-hidden />
						</span>
						<p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
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

			<section className="mt-6">
				<div className="mb-3 flex items-end justify-between gap-2">
					<h2 className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">Referral rewards</h2>
					<span className="text-[11px] font-medium text-slate-400">One-time · per location</span>
				</div>
				<div className="grid grid-cols-2 gap-2.5">
					<div className="rounded-[18px] border border-[#eadcf7] bg-white px-3.5 py-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
						<span
							className="mb-2.5 grid h-9 w-9 place-items-center rounded-[12px]"
							style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
						>
							<Store className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</span>
						<p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Paid onboarding</p>
						<p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Up to</p>
						<p className="mt-0.5 text-[26px] font-extrabold tabular-nums leading-none text-[#8b3e91]">
							100 <span className="text-[12px] font-semibold">USDC</span>
						</p>
					</div>
					<div className="rounded-[18px] border border-[#eadcf7] bg-white px-3.5 py-4 shadow-sm dark:border-purple-900/40 dark:bg-slate-900">
						<span
							className="mb-2.5 grid h-9 w-9 place-items-center rounded-[12px]"
							style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
						>
							<CalendarDays className="h-4 w-4" strokeWidth={2.25} aria-hidden />
						</span>
						<p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">Day-60 milestone</p>
						<p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">One-time</p>
						<p className="mt-0.5 text-[26px] font-extrabold tabular-nums leading-none text-[#8b3e91]">
							100 <span className="text-[12px] font-semibold">USDC</span>
						</p>
					</div>
				</div>
				<p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[#8b3e91]">
					<RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
					Plus recurring rewards from eligible paid usage
				</p>
				<button
					type="button"
					onClick={() => setView('partnerPlan')}
					className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-2xl px-4 py-3 text-[13px] font-semibold transition active:scale-[0.99]"
					style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
				>
					View reward plan
					<span aria-hidden>→</span>
				</button>
				<p className="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
					Qualifying locations and enrolled partners only. Conditions apply.
				</p>
			</section>

			<section className="mt-6">
				<h2 className="mb-3 text-[13px] font-semibold text-slate-900 dark:text-slate-50">Business essentials</h2>
				<div className="space-y-2.5">
					{(
						[
							{ key: 'fees' as const, Icon: FileText, title: 'Service fees' },
							{ key: 'packages' as const, Icon: Layers, title: 'Business packages' },
							{ key: 'calc' as const, Icon: Calculator, title: 'Reward calculation' },
						] as const
					).map((row) => {
						const open = essentialsOpen === row.key
						return (
							<div
								key={row.key}
								className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
							>
								<button
									type="button"
									onClick={() => toggleEssentials(row.key)}
									className="flex min-h-[52px] w-full items-center gap-2.5 px-3.5 py-4 text-left"
									aria-expanded={open}
								>
									<span className="flex items-center gap-2.5 min-w-0 flex-1">
										<span className="text-[#0051d1] dark:text-sky-400">
											<row.Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
										</span>
										<span className="text-[12px] font-medium text-slate-900 dark:text-slate-50">
											{row.title}
										</span>
									</span>
									<ChevronDown
										className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
										aria-hidden
									/>
								</button>
								{open && row.key === 'fees' ? (
									<div className="border-t border-slate-100 px-3.5 pb-4 pt-3 dark:border-slate-800">
										<div
											className="mb-2 flex items-center gap-2 rounded-[11px] px-2.5 py-2.5 text-[11px] leading-snug"
											style={{ backgroundColor: M_SOFT, color: M_PURPLE }}
										>
											<Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
											1 B-Unit · 0.01 USDC nominal service credit
										</div>
										<div className="divide-y divide-slate-100 dark:divide-slate-800">
											{FEE_ROWS.map((fee) => (
												<div key={fee.label} className="flex items-center gap-2.5 py-3.5">
													<div className="min-w-0 flex-1">
														<p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">
															{fee.label}
														</p>
														<p className="text-[11px] text-slate-400">{fee.note}</p>
													</div>
													<div className="shrink-0 text-right">
														<p className="text-[15px] font-bold tabular-nums text-slate-900 dark:text-slate-50">
															{fee.fee}
														</p>
														<p className="text-[10px] font-medium text-slate-400">B-Units</p>
													</div>
												</div>
											))}
										</div>
									</div>
								) : null}
								{open && row.key === 'packages' ? (
									<div className="space-y-2 border-t border-slate-100 px-3.5 pb-4 pt-3 dark:border-slate-800">
										{PACKAGE_ROWS.map((pkg) => (
											<div
												key={pkg.name}
												className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/80"
											>
												<div className="flex items-center justify-between gap-2">
													<p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
														{pkg.name}
													</p>
													{pkg.badge ? (
														<span className="rounded-full bg-[#f6edf9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#8b3e91]">
															{pkg.badge}
														</span>
													) : null}
												</div>
												<p className="mt-1 text-[18px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
													{pkg.priceUsdc}{' '}
													<span className="text-[12px] font-semibold text-slate-500">USDC</span>
												</p>
												<p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
													{pkg.totalBUnits} B-Units
												</p>
											</div>
										))}
										<p className="pt-1 text-[11px] text-slate-400">
											The business chooses and pays in Business OS.
										</p>
										<a
											href={MERCHANT_OS_AGENT_URL}
											target="_blank"
											rel="noopener noreferrer"
											onClick={(e) => {
												e.preventDefault()
												openExternalUrl(MERCHANT_OS_AGENT_URL)
											}}
											className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
										>
											View Business OS
											<ExternalLink className="h-3.5 w-3.5" aria-hidden />
										</a>
									</div>
								) : null}
								{open && row.key === 'calc' ? (
									<div className="space-y-2 border-t border-slate-100 px-3.5 pb-4 pt-3 text-[12px] leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
										<p>
											One-time partner rewards are paid per qualifying location for paid onboarding and the
											Day-60 milestone (up to 100 USDC each).
										</p>
										<p>
											Recurring rewards follow eligible paid Charge and Top-up usage at enrolled partner
											locations under the partner program rules.
										</p>
									</div>
								) : null}
							</div>
						)
					})}
				</div>
			</section>

			<p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
				Temporary accounts stay separate from your personal account.
			</p>
		</div>
	)
}
