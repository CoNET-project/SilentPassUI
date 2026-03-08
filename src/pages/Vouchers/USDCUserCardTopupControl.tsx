import React, { useEffect, useMemo, useState } from "react"
import { ethers } from "ethers"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {
	getCardMetadataFromApi,
	getCardMetadataFromUri,
	getCardTiersFromContract,
	getMyAssets,
	postUSDCUserCardTopupPreview,
	postUSDCUserCardTopup,
	quoteCurrencyAmountInUSDC,
	type USDCUserCardTopupIntent,
	type USDCUserCardTopupPreviewPayload,
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
	const [success, setSuccess] = useState("")
	const [tiers, setTiers] = useState<TierItem[]>([])
	const [assets, setAssets] = useState<any | null>(null)
	const [topupIntent, setTopupIntent] = useState<USDCUserCardTopupIntent>("topup")
	const [amount, setAmount] = useState("1")
	const [selectedTierIndex, setSelectedTierIndex] = useState<number | null>(null)
	const [previewLoading, setPreviewLoading] = useState(false)
	const [preview, setPreview] = useState<USDCUserCardTopupPreviewPayload | null>(null)
	const [amountCheckOk, setAmountCheckOk] = useState<boolean | null>(null)
	const [usdcPerCurrencyUnit, setUsdcPerCurrencyUnit] = useState<number>(1)

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

	const fetchPreview = async (intent: "auto" | USDCUserCardTopupIntent, usdcHuman?: string) => {
		if (!profile?.keyID) return null
		let usdc6: string | undefined
		if (typeof usdcHuman === "string" && usdcHuman.trim() !== "") {
			try {
				usdc6 = (await cardAmountToUsdc6(usdcHuman.trim())).toString()
			} catch {
				usdc6 = "0"
			}
		}
		setPreviewLoading(true)
		const ret = await postUSDCUserCardTopupPreview({
			cardAddress,
			from: profile.keyID,
			intent,
			usdcAmount: usdc6,
		})
		setPreviewLoading(false)
		if (!ret.success || !ret.preview) {
			setError(ret.error ?? "Failed to preview top-up requirements.")
			return null
		}
		setPreview(ret.preview)
		if (ret.amountCheck) setAmountCheckOk(ret.amountCheck.ok)
		return ret
	}

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

	const cardAmountToUsdc6 = async (human: string): Promise<bigint> => {
		const normalized = human.replace(/,/g, "").trim()
		if (cardCurrency === "USDC") return ethers.parseUnits(normalized, 6)
		const q = await quoteCurrencyAmountInUSDC(cardAddress, cardCurrency, normalized)
		return q.usdc6
	}

	const minTier = tiers[0]
	const nextTier = useMemo(() => tiers.find((t) => t.minUsdc6 > points6), [tiers, points6])
	const selectedTier = useMemo(
		() => (selectedTierIndex == null ? null : tiers.find((t) => t.index === selectedTierIndex) ?? null),
		[selectedTierIndex, tiers]
	)

	const applyTierSelection = (tier: TierItem) => {
		setSelectedTierIndex(tier.index)
		setAmountCheckOk(null)
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

	useEffect(() => {
		if (loading || !profile?.keyID) return
		if (selectedTier) return
		fetchPreview("auto").then((ret) => {
			if (!ret?.preview) return
			try {
				const recommended = usdc6ToCardAmount(BigInt(ret.preview.recommendedUsdc6 || ret.preview.requiredMinUsdc6))
				if (!amount || Number(amount) <= 0) setAmount(recommended)
			} catch {
				// ignore
			}
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loading, profile?.keyID, cardAddress, selectedTier])

	useEffect(() => {
		if (loading || !profile?.keyID || !amount) return
		const timer = setTimeout(() => {
			fetchPreview("auto", amount).catch(() => {})
		}, 350)
		return () => clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [amount, loading, profile?.keyID, cardAddress])

	const requiredMinPoints6ForUi = useMemo(() => {
		if (!hasMembership) {
			return selectedTier?.minUsdc6 ?? minTier?.minUsdc6 ?? 1_000_000n
		}
		if (selectedTier && selectedTier.minUsdc6 > points6) {
			return selectedTier.upgradeByBalance ? (selectedTier.minUsdc6 - points6) : selectedTier.minUsdc6
		}
		return MIN_TOPUP_USDC6
	}, [hasMembership, minTier?.minUsdc6, points6, selectedTier])

	const submit = async () => {
		setError("")
		setSuccess("")
		if (!profile?.privateKeyArmor) {
			setError("Profile private key is missing.")
			return
		}
		let amount6 = 0n
		try {
			amount6 = await cardAmountToUsdc6(amount || "0")
		} catch {
			setError(`Invalid ${cardCurrency} amount.`)
			return
		}
		const previewRet = await fetchPreview("auto", amount)
		if (!previewRet?.preview) return
		if (previewRet.amountCheck && !previewRet.amountCheck.ok) {
			const min6 = BigInt(previewRet.amountCheck.requiredMinUsdc6)
			setError(`Minimum required is ${usdc6ToCardAmountCeil(min6)} ${cardCurrency}.`)
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
			setSuccess(`Top-up submitted${ret.txHash ? `: ${ret.txHash.slice(0, 10)}...` : ""}`)
		} finally {
			setSubmitting(false)
		}
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
					{currentTierIndex >= 0 ? ` | Current tier: ${currentTierIndex + 1}` : ""}
				</div>
			</div>
			<div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
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
						Minimum required: {preview?.requiredMinUsdc6 ? usdc6ToCardAmountCeil(BigInt(preview.requiredMinUsdc6)) : points6ToCardAmount(requiredMinPoints6ForUi)} {cardCurrency}
					</div>
					<div className="mt-1 min-h-[1.25rem] text-xs">
						{previewLoading ? (
							<div className="text-slate-500">Checking requirements...</div>
						) : amountCheckOk === false ? (
							<div className="text-rose-600">Amount is below requirement.</div>
						) : (
							<div className="invisible">Amount is below requirement.</div>
						)}
					</div>
				</div>
				<button
					onClick={submit}
					disabled={submitting || previewLoading || amountCheckOk === false}
					className="w-full h-11 rounded-lg bg-[#1D5BFF] text-white font-semibold disabled:opacity-60"
				>
					{submitting ? "Submitting..." : "Top Up with Offline Signature"}
				</button>
			</div>
			{error && <div className="text-sm text-rose-600">{error}</div>}
			{success && <div className="text-sm text-emerald-600">{success}</div>}
		</div>
	)
}

