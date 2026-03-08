import React, { useEffect, useMemo, useState } from "react"
import { ethers } from "ethers"
import { Check, ExternalLink, RefreshCw } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {
	getCardMetadataFromApi,
	getCardMetadataFromUri,
	getCardTiersFromContract,
	getEOAUSDCBalance,
	getMyAssets,
	postUSDCUserCardTopup,
	quoteUSDCForPoints,
	quoteCurrencyAmountInUSDC,
	type USDCUserCardTopupIntent,
} from "@/services/BeamioCard"

type TierItem = {
	index: number
	minUsdc6: bigint
	name: string
	description?: string
	image?: string
	backgroundColor?: string
	upgradeByBalance?: boolean
}

type Props = {
	cardAddress: string
	onClose?: (assets?: any) => void
}

const MIN_TOPUP_USDC6 = 100_000n // 0.1 USDC

const getCurrencyDecimals = (currency: string) => {
	const c = (currency || "USDC").toUpperCase()
	if (c === "JPY" || c === "TWD") return 0
	return 2
}

const fmtUsdc = (v: bigint) => {
	const num = Number(ethers.formatUnits(v, 6))
	return Number.isFinite(num) ? num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : "0.00"
}

const getNumericTier = (raw: unknown): number => {
	if (typeof raw !== "string") return -1
	const n = Number(raw)
	return Number.isFinite(n) ? n : -1
}

const normalizeHexColor = (raw?: string): string | undefined => {
	if (!raw) return undefined
	const s = raw.trim().replace(/^#/, "")
	if (!/^[0-9a-fA-F]{6}$/.test(s) && !/^[0-9a-fA-F]{8}$/.test(s)) return undefined
	return `#${s}`
}

const formatBalanceWithCurrencyProtocol = (amount: number, currency: string): { prefix: string; amount: string; suffix: string } => {
	const amt = Number.isFinite(amount) ? amount : 0
	const decimals = getCurrencyDecimals(currency)
	const amountText = amt.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
	const ccy = (currency || "USDC").toUpperCase()
	const prefix = (() => {
		switch (ccy) {
			case "CAD":
				return "CA$"
			case "USD":
				return "$"
			case "EUR":
				return "EUR"
			case "JPY":
				return "JP¥"
			case "CNY":
				return "CN¥"
			case "HKD":
				return "HK$"
			case "SGD":
				return "SG$"
			case "TWD":
				return "NT$"
			default:
				return ""
		}
	})()
	const suffix = ccy === "USDC" ? " USDC" : ""
	return { prefix, amount: amountText, suffix }
}

export default function USDCUserCardTopupControl({ cardAddress, onClose }: Props) {
	const { profiles } = useDaemonContext()
	const profile = profiles?.[0]

	const [loading, setLoading] = useState(true)
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState("")
	const [topupSuccessTxHash, setTopupSuccessTxHash] = useState<string | null>(null)
	const [tiers, setTiers] = useState<TierItem[]>([])
	const [assets, setAssets] = useState<any | null>(null)
	const [topupIntent, setTopupIntent] = useState<USDCUserCardTopupIntent>("topup")
	const [amount, setAmount] = useState("1")
	const [selectedTierIndex, setSelectedTierIndex] = useState<number | null>(null)
	const [usdcPerCurrencyUnit, setUsdcPerCurrencyUnit] = useState<number>(1)
	const [insufficientUsdcBalance, setInsufficientUsdcBalance] = useState(false)
	const [balanceCheckLoading, setBalanceCheckLoading] = useState(false)
	const [liveUsdcBalance, setLiveUsdcBalance] = useState<string>("0")

	useEffect(() => {
		let alive = true
		const run = async () => {
			if (!profile?.keyID) {
				setError("Wallet profile is not ready.")
				setLoading(false)
				return
			}
			try {
				setLoading(true)
				const [metaApi, metaUri, contractTiers, myAssets] = await Promise.all([
					getCardMetadataFromApi(cardAddress),
					getCardMetadataFromUri(cardAddress),
					getCardTiersFromContract(cardAddress),
					getMyAssets(profile, cardAddress),
				])
				if (!alive) return
				const metaTiers = metaApi?.tiers ?? metaUri?.tiers ?? []
				const merged: TierItem[] = contractTiers
					.map((t, idx) => {
						const mt = metaTiers.find((x) => Number(x?.index) === idx)
						return {
							index: idx,
							minUsdc6: BigInt(t.minUsdc6 ?? "0"),
							name: mt?.name?.trim() || `Tier ${idx + 1}`,
							description: mt?.description?.trim(),
							image: mt?.image?.trim(),
							backgroundColor: normalizeHexColor(mt?.backgroundColor),
							upgradeByBalance: Boolean(t.upgradeByBalance),
						}
					})
					.sort((a, b) => (a.minUsdc6 < b.minUsdc6 ? -1 : 1))
				setTiers(merged)
				setAssets(myAssets)
				setLiveUsdcBalance(String(myAssets?.usdcBalance ?? "0"))
			} catch (e: any) {
				if (!alive) return
				setError(e?.message ?? "Failed to load card information.")
			} finally {
				if (alive) setLoading(false)
			}
		}
		run()
		return () => {
			alive = false
		}
	}, [cardAddress, profile])

	const points6 = useMemo(() => {
		try {
			return ethers.parseUnits(String(assets?.points ?? "0"), 6)
		} catch {
			return 0n
		}
	}, [assets?.points])

	const hasMembership = useMemo(() => {
		const nfts = assets?.nfts
		return Array.isArray(nfts) && nfts.length > 0
	}, [assets?.nfts])

	const currentTierIndex = useMemo(() => {
		const nfts = assets?.nfts
		if (!Array.isArray(nfts)) return -1
		let maxIdx = -1
		for (const nft of nfts) {
			const idx = getNumericTier(nft?.tier)
			if (idx >= 0) maxIdx = Math.max(maxIdx, idx)
		}
		return maxIdx
	}, [assets?.nfts])
	const currentTierName = useMemo(() => {
		if (currentTierIndex < 0) return ""
		const t = tiers.find((x) => x.index === currentTierIndex)
		return t?.name?.trim() || `Tier ${currentTierIndex + 1}`
	}, [tiers, currentTierIndex])

	const currentPointsDisplay = useMemo(() => {
		const amount = Number(assets?.points ?? "0")
		const currency = String(assets?.cardCurrency ?? "USDC")
		const { prefix, amount: text, suffix } = formatBalanceWithCurrencyProtocol(amount, currency)
		return `${prefix}${text}${suffix}`
	}, [assets?.points, assets?.cardCurrency])
	const cardCurrency = useMemo(() => String(assets?.cardCurrency ?? "USDC").toUpperCase(), [assets?.cardCurrency])
	const cardCurrencyDecimals = useMemo(() => getCurrencyDecimals(cardCurrency), [cardCurrency])

	useEffect(() => {
		let alive = true
		const run = async () => {
			if (cardCurrency === "USDC") {
				setUsdcPerCurrencyUnit(1)
				return
			}
			try {
				const q = await quoteCurrencyAmountInUSDC(cardAddress, cardCurrency, "1")
				if (!alive) return
				const rate = Number(q.usdc)
				setUsdcPerCurrencyUnit(Number.isFinite(rate) && rate > 0 ? rate : 1)
			} catch {
				if (!alive) return
				setUsdcPerCurrencyUnit(1)
			}
		}
		run()
		return () => {
			alive = false
		}
	}, [cardAddress, cardCurrency])

	const usdc6ToCardAmount = (usdc6: bigint) => {
		if (cardCurrency === "USDC") {
			const usdc = Number(ethers.formatUnits(usdc6, 6))
			return Number.isFinite(usdc)
				? usdc.toLocaleString("en-US", { minimumFractionDigits: cardCurrencyDecimals, maximumFractionDigits: cardCurrencyDecimals })
				: "0.00"
		}
		const usdc = Number(ethers.formatUnits(usdc6, 6))
		const value = usdcPerCurrencyUnit > 0 ? usdc / usdcPerCurrencyUnit : usdc
		return Number.isFinite(value)
			? value.toLocaleString("en-US", { minimumFractionDigits: cardCurrencyDecimals, maximumFractionDigits: cardCurrencyDecimals })
			: "0.00"
	}

	const usdc6ToCardAmountCeil = (usdc6: bigint) => {
		if (usdc6 <= 0n) {
			return (0).toLocaleString("en-US", {
				minimumFractionDigits: cardCurrencyDecimals,
				maximumFractionDigits: cardCurrencyDecimals,
			})
		}
		const usdc = Number(ethers.formatUnits(usdc6, 6))
		const raw = cardCurrency === "USDC" ? usdc : (usdcPerCurrencyUnit > 0 ? usdc / usdcPerCurrencyUnit : usdc)
		if (!Number.isFinite(raw)) return "0.00"
		const factor = 10 ** cardCurrencyDecimals
		const ceiled = Math.ceil((raw - 1e-12) * factor) / factor
		return ceiled.toLocaleString("en-US", {
			minimumFractionDigits: cardCurrencyDecimals,
			maximumFractionDigits: cardCurrencyDecimals,
		})
	}

	const points6ToCardAmount = (points6: bigint) => {
		const value = Number(ethers.formatUnits(points6, 6))
		return Number.isFinite(value)
			? value.toLocaleString("en-US", { minimumFractionDigits: cardCurrencyDecimals, maximumFractionDigits: cardCurrencyDecimals })
			: "0.00"
	}

	const points6ToCardAmountCeil = (points6: bigint) => {
		const raw = Number(ethers.formatUnits(points6, 6))
		if (!Number.isFinite(raw)) return "0.00"
		const factor = 10 ** cardCurrencyDecimals
		const ceiled = Math.ceil((raw - 1e-12) * factor) / factor
		return ceiled.toLocaleString("en-US", {
			minimumFractionDigits: cardCurrencyDecimals,
			maximumFractionDigits: cardCurrencyDecimals,
		})
	}

	const cardAmountToUsdc6 = async (human: string): Promise<bigint> => {
		const normalized = human.replace(/,/g, "").trim()
		const q = await quoteUSDCForPoints(cardAddress, normalized)
		const points6 = BigInt(q.points6)
		const unitPriceUSDC6 = BigInt(q.unitPriceUSDC6)
		const POINTS_ONE = 1_000_000n
		// Keep frontend conversion conservative and aligned with backend min checks (ceil division).
		return (points6 * unitPriceUSDC6 + (POINTS_ONE - 1n)) / POINTS_ONE
	}

	// Non-USDC currencies: +0.005 USDC then round to 2dp (standard half-up rounding).
	const toBufferedUsdc6 = (rawUsdc6: bigint) => {
		if (cardCurrency === "USDC") return rawUsdc6
		const CENT_USDC6 = 10_000n
		const ROUND_HALF_USDC6 = 5_000n // 0.005 USDC
		const rounded2 = ((rawUsdc6 + ROUND_HALF_USDC6) / CENT_USDC6) * CENT_USDC6
		return rounded2
	}

	const minTier = tiers[0]
	const nextTier = useMemo(() => tiers.find((t) => t.minUsdc6 > points6), [tiers, points6])
	const selectedTier = useMemo(
		() => (selectedTierIndex == null ? null : tiers.find((t) => t.index === selectedTierIndex) ?? null),
		[selectedTierIndex, tiers]
	)

	const applyTierSelection = (tier: TierItem) => {
		setSelectedTierIndex(tier.index)
		if (!hasMembership) {
			setTopupIntent("first_purchase")
			setAmount(points6ToCardAmount(tier.minUsdc6))
			return
		}
		const shouldUpgrade = tier.minUsdc6 > points6
		if (!shouldUpgrade) {
			setTopupIntent("topup")
			setAmount(points6ToCardAmount(MIN_TOPUP_USDC6))
			return
		}
		setTopupIntent("upgrade")
		if (tier.upgradeByBalance) {
			const delta = tier.minUsdc6 > points6 ? tier.minUsdc6 - points6 : MIN_TOPUP_USDC6
			setAmount(points6ToCardAmount(delta))
			return
		}
		setAmount(points6ToCardAmount(tier.minUsdc6))
	}

	useEffect(() => {
		if (loading) return
		if (selectedTier) return
		if (!hasMembership) {
			setTopupIntent("first_purchase")
			setAmount(points6ToCardAmount(minTier?.minUsdc6 ?? 1_000_000n))
			return
		}
		if (nextTier) {
			setTopupIntent("upgrade")
			const delta = nextTier.minUsdc6 > points6 ? nextTier.minUsdc6 - points6 : MIN_TOPUP_USDC6
			setAmount(points6ToCardAmount(delta))
			return
		}
		setTopupIntent("topup")
		setAmount("1")
	}, [loading, hasMembership, minTier?.minUsdc6, nextTier, points6, selectedTier, cardCurrency, usdcPerCurrencyUnit])

	const requiredMinPoints6ForUi = useMemo(() => {
		if (!hasMembership) {
			return selectedTier?.minUsdc6 ?? minTier?.minUsdc6 ?? 1_000_000n
		}
		if (selectedTier && selectedTier.minUsdc6 > points6) {
			return selectedTier.upgradeByBalance ? (selectedTier.minUsdc6 - points6) : selectedTier.minUsdc6
		}
		return MIN_TOPUP_USDC6
	}, [hasMembership, minTier?.minUsdc6, points6, selectedTier])

	const userUsdcBalance6 = useMemo(() => {
		try {
			return ethers.parseUnits(String(liveUsdcBalance || "0"), 6)
		} catch {
			return 0n
		}
	}, [liveUsdcBalance])

	const amountBelowRequirement = useMemo(() => {
		const raw = amount?.replace(/,/g, "").trim()
		if (!raw) return false
		try {
			const inputPoints6 = ethers.parseUnits(raw, 6)
			return inputPoints6 < requiredMinPoints6ForUi
		} catch {
			return false
		}
	}, [amount, requiredMinPoints6ForUi])

	const amountToPoints6 = (human: string): bigint => {
		const normalized = human.replace(/,/g, "").trim()
		return ethers.parseUnits(normalized || "0", 6)
	}

	useEffect(() => {
		let alive = true
		let timer: ReturnType<typeof setTimeout> | null = null
		const run = async () => {
			if (!profile?.keyID) return
			timer = setTimeout(async () => {
				try {
					const latestUsdc = await getEOAUSDCBalance(profile)
					if (!alive) return
					setLiveUsdcBalance(String(latestUsdc ?? "0"))
				} catch {
					// keep previous live balance on transient fetch error
				}
			}, 300)
		}
		void run()
		return () => {
			alive = false
			if (timer) clearTimeout(timer)
		}
	}, [amount, cardAddress, profile?.keyID])

	useEffect(() => {
		let alive = true
		const run = async () => {
			const raw = amount?.replace(/,/g, "").trim()
			if (!raw) {
				if (!alive) return
				setInsufficientUsdcBalance(false)
				setBalanceCheckLoading(false)
				return
			}
			setBalanceCheckLoading(true)
			try {
				const usdcRaw6 = await cardAmountToUsdc6(raw)
				const usdcBuffered6 = toBufferedUsdc6(usdcRaw6)
				if (!alive) return
				setInsufficientUsdcBalance(usdcBuffered6 > userUsdcBalance6)
			} catch {
				if (!alive) return
				setInsufficientUsdcBalance(false)
			} finally {
				if (alive) setBalanceCheckLoading(false)
			}
		}
		void run()
		return () => {
			alive = false
		}
	}, [amount, cardAddress, cardCurrency, usdcPerCurrencyUnit, userUsdcBalance6])

	const submit = async () => {
		setError("")
		setTopupSuccessTxHash(null)
		if (!profile?.privateKeyArmor) {
			setError("Profile private key is missing.")
			return
		}
		let amount6 = 0n
		let amountPoints6 = 0n
		try {
			amountPoints6 = amountToPoints6(amount || "0")
			if (amountPoints6 < requiredMinPoints6ForUi) {
				setError(`Minimum required is ${points6ToCardAmountCeil(requiredMinPoints6ForUi)} ${cardCurrency}.`)
				return
			}
			const rawUsdc6 = await cardAmountToUsdc6(amount || "0")
			amount6 = toBufferedUsdc6(rawUsdc6)
			let finalBalance6 = userUsdcBalance6
			try {
				const latestUsdc = await getEOAUSDCBalance(profile)
				setLiveUsdcBalance(latestUsdc)
				finalBalance6 = ethers.parseUnits(latestUsdc, 6)
			} catch {
				// fallback to latest cached live balance
			}
			if (amount6 > finalBalance6) {
				setError("Insufficient USDC balance.")
				return
			}
		} catch {
			setError(`Invalid ${cardCurrency} amount.`)
			return
		}
		setSubmitting(true)
		try {
			const amountUSDC = ethers.formatUnits(amount6, 6)
			const ret = await postUSDCUserCardTopup({
				profile,
				cardAddress,
				usdcAmount: amountUSDC,
				intent: topupIntent,
			})
			if (!ret.success) {
				setError(ret.error ?? "Top-up failed.")
				return
			}
			if (ret.assets) setAssets(ret.assets)
			setTopupSuccessTxHash(ret.txHash ?? "")
		} finally {
			setSubmitting(false)
		}
	}

	const resetTopupState = () => {
		setError("")
		setTopupSuccessTxHash(null)
	}

	if (loading) {
		return <div className="p-6 text-sm text-slate-500">Loading card tiers...</div>
	}

	return (
		<div className="p-6 space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-bold text-slate-900">USDC Top Up</h3>
				<button className="text-sm text-slate-500 hover:text-slate-700" onClick={() => onClose?.(assets)}>Close</button>
			</div>
			{!submitting ? (
				<div className="rounded-xl border border-slate-200 bg-white p-4">
					<div className="flex items-center justify-between mb-3">
						<div />
						<div className="text-xs text-slate-500">
							Current points: <span className="font-semibold text-slate-700">{currentPointsDisplay}</span>
						</div>
					</div>
					<div className="space-y-3">
						{tiers.map((t) => {
							const isCurrent = currentTierIndex === t.index
							const isNext = nextTier?.index === t.index
							const isSelected = selectedTierIndex === t.index
							return (
								<div
									key={t.index}
									className={`relative overflow-hidden rounded-2xl border p-4 ${
										isSelected
											? "cursor-pointer border-amber-300 ring-2 ring-amber-100"
											: isCurrent
												? "cursor-pointer border-emerald-300 ring-2 ring-emerald-100"
												: isNext
													? "cursor-pointer border-blue-300 ring-2 ring-blue-100"
													: "cursor-pointer border-slate-200"
									}`}
									style={{ backgroundColor: t.backgroundColor || "#2C5535" }}
									onClick={() => applyTierSelection(t)}
								>
									{t.image ? (
										<img
											src={t.image}
											alt={t.name}
											className="pointer-events-none absolute left-4 top-4 h-[calc(100%-2rem)] w-52 rounded-xl object-contain object-left opacity-95"
										/>
									) : null}
									<div className="relative z-10">
										<div className="flex items-center justify-end">
											<div className="text-right text-sm font-bold text-white">{t.name}</div>
										</div>
										{t.description ? <div className="mt-1 text-right text-xs text-white/85">{t.description}</div> : null}
										<div className="mt-3 flex items-end justify-end">
											<div className="text-sm font-semibold text-emerald-200">{points6ToCardAmount(t.minUsdc6)} {cardCurrency}</div>
										</div>
									</div>
								</div>
							)
						})}
						{tiers.length === 0 && <div className="text-sm text-slate-500">No tier configured.</div>}
					</div>
					<div className="mt-1 text-xs text-slate-500">
						Membership: <span className="font-semibold text-slate-700">{hasMembership ? "Yes" : "No"}</span>
						{currentTierName ? ` | Current tier: ${currentTierName}` : ""}
					</div>
				</div>
			) : null}
			<div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
				{submitting ? (
					<div className="flex flex-col items-center justify-center py-10 gap-3">
						<RefreshCw size={40} className="animate-spin text-[#1D5BFF]" />
						<p className="text-sm font-semibold text-slate-600">Processing top-up...</p>
						<p className="text-xs text-slate-500">Please wait</p>
					</div>
				) : topupSuccessTxHash !== null ? (
					<div className="flex flex-col items-center py-4 gap-3">
						<div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
							<Check size={28} strokeWidth={3} className="text-emerald-500" />
						</div>
						<p className="text-base font-bold text-emerald-600">Success</p>
						{topupSuccessTxHash.startsWith("0x") ? (
							<a
								href={`https://basescan.org/tx/${topupSuccessTxHash}`}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-mono text-[#1D5BFF] hover:bg-slate-100"
							>
								{topupSuccessTxHash.slice(0, 10)}...{topupSuccessTxHash.slice(-8)}
								<ExternalLink size={14} strokeWidth={2.5} />
							</a>
						) : null}
						<button
							onClick={resetTopupState}
							className="mt-1 text-sm font-semibold text-[#1D5BFF] hover:text-[#1549cc]"
						>
							Top Up Again
						</button>
					</div>
				) : (
					<>
						<div>
							<div className="text-xs text-slate-500 mb-1">{cardCurrency} Amount</div>
							<input
								value={amount}
								onChange={(e) => {
									const raw = e.target.value
									const cleaned = raw.replace(/[^\d.]/g, "")
									const firstDot = cleaned.indexOf(".")
									const normalized = firstDot >= 0
										? `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, "")}`
										: cleaned
									setAmount(normalized)
								}}
								type="text"
								inputMode={cardCurrencyDecimals === 0 ? "numeric" : "decimal"}
								pattern={cardCurrencyDecimals === 0 ? "[0-9]*" : "[0-9]*[.,]?[0-9]*"}
								className="w-full h-10 rounded-lg border border-slate-300 px-3 text-sm"
							/>
							<div className="mt-1 text-xs text-slate-500">
								Minimum required: {points6ToCardAmountCeil(requiredMinPoints6ForUi)} {cardCurrency}
							</div>
							<div className="mt-1 min-h-[1.25rem] text-xs">
								{amountBelowRequirement ? (
									<div className="text-rose-600">Amount is below requirement.</div>
								) : insufficientUsdcBalance ? (
									<div className="text-rose-600">Insufficient USDC balance.</div>
								) : balanceCheckLoading ? (
									<div className="text-slate-400">Checking USDC balance...</div>
								) : (
									<div className="invisible">Amount is below requirement.</div>
								)}
							</div>
						</div>
						{error ? (
							<div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
								{error}
							</div>
						) : null}
						<button
							onClick={submit}
							disabled={submitting || amountBelowRequirement || insufficientUsdcBalance || balanceCheckLoading}
							className="w-full h-11 rounded-lg bg-[#1D5BFF] text-white font-semibold disabled:opacity-60"
						>
							Top Up with Offline Signature
						</button>
					</>
				)}
			</div>
		</div>
	)
}

