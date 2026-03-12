import React, { useEffect, useMemo, useRef, useState } from "react"
import { ethers } from "ethers"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Crown, Info, RefreshCw, Wallet, X } from "lucide-react"
import { AppButton } from "@/components/button/AppButton"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {
	getCardMetadataFromApi,
	getCardMetadataFromUri,
	getCardTiersFromContract,
	getEOAUSDCBalance,
	getMyAssets,
	postUSDCUserCardTopup,
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
	/** Override quick amount buttons. id 201: [100] only; id 202: default [25, 50, 100]. Default when not from Market: [25, 50, 100] */
	quickOptions?: number[]
	/** Item id when opened from Market (201/202) - used to customize loadMoreHint: 201→Unlock VIP, 202→Top-up */
	itemId?: number
	/** When user has no card: initial tier to select. 201→max (Black VIP), 202→min (Green). */
	initialTierPreference?: "min" | "max"
	/** When true, do not pre-fill amount (e.g. from Reload flow). */
	presetAmountEmpty?: boolean
}

const MIN_TOPUP_USDC6 = 100_000n // 0.1 USDC

const CARD_METADATA_STORAGE_PREFIX = "beamio_card_metadata_"

type CachedCardMetadata = {
	tiers: { index: number; minUsdc6: string; name: string; description?: string; image?: string; backgroundColor?: string; upgradeByBalance?: boolean }[]
	cardName: string
}

function loadCardMetadataFromStorage(cardAddress: string): CachedCardMetadata | null {
	try {
		const key = `${CARD_METADATA_STORAGE_PREFIX}${cardAddress.toLowerCase()}`
		const raw = localStorage.getItem(key)
		if (!raw) return null
		const parsed = JSON.parse(raw) as CachedCardMetadata
		if (!parsed?.tiers || !Array.isArray(parsed.tiers) || typeof parsed.cardName !== "string") return null
		return parsed
	} catch {
		return null
	}
}

function saveCardMetadataToStorage(cardAddress: string, data: CachedCardMetadata) {
	try {
		const key = `${CARD_METADATA_STORAGE_PREFIX}${cardAddress.toLowerCase()}`
		localStorage.setItem(key, JSON.stringify(data))
	} catch {}
}

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

/** Returns 'white' or 'black' for readable contrast on the given hex background */
const getContrastTextColor = (hexBg: string): "white" | "black" => {
	const s = hexBg.replace(/^#/, "").slice(0, 6)
	if (!/^[0-9a-fA-F]{6}$/.test(s)) return "black"
	const r = parseInt(s.slice(0, 2), 16) / 255
	const g = parseInt(s.slice(2, 4), 16) / 255
	const b = parseInt(s.slice(4, 6), 16) / 255
	const luminance = 0.299 * r + 0.587 * g + 0.114 * b
	return luminance > 0.5 ? "black" : "white"
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

export default function USDCUserCardTopupControl({ cardAddress, onClose, quickOptions: quickOptionsProp, itemId, initialTierPreference, presetAmountEmpty }: Props) {
	const navigate = useNavigate()
	const { profiles } = useDaemonContext()
	const profile = profiles?.[0]

	const [loading, setLoading] = useState(true)
	const [submitting, setSubmitting] = useState(false)
	const [error, setError] = useState("")
	const [topupSuccessTxHash, setTopupSuccessTxHash] = useState<string | null>(null)
	const [successAmountDisplay, setSuccessAmountDisplay] = useState<string>("")
	const [tiers, setTiers] = useState<TierItem[]>([])
	const [assets, setAssets] = useState<any | null>(null)
	const [cardName, setCardName] = useState<string>("")
	const [topupIntent, setTopupIntent] = useState<USDCUserCardTopupIntent>("topup")
	const [amount, setAmount] = useState("")
	const [selectedTierIndex, setSelectedTierIndex] = useState<number | null>(null)
	const [usdcPerCurrencyUnit, setUsdcPerCurrencyUnit] = useState<number>(1)
	const [insufficientUsdcBalance, setInsufficientUsdcBalance] = useState(false)
	const [balanceCheckLoading, setBalanceCheckLoading] = useState(false)
	const [liveUsdcBalance, setLiveUsdcBalance] = useState<string>("0")
	const [upgradeSuccessModal, setUpgradeSuccessModal] = useState<{
		show: boolean
		currentTier: TierItem | null
		nextTier: TierItem | null
	}>({ show: false, currentTier: null, nextTier: null })
	const amountInputRef = useRef<HTMLInputElement>(null)

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
				const cached = loadCardMetadataFromStorage(cardAddress)
				if (cached && cached.tiers.length > 0) {
					const merged: TierItem[] = cached.tiers.map((t) => ({
						index: t.index,
						minUsdc6: BigInt(t.minUsdc6 ?? "0"),
						name: t.name,
						description: t.description,
						image: t.image,
						backgroundColor: normalizeHexColor(t.backgroundColor),
						upgradeByBalance: t.upgradeByBalance,
					}))
					if (!alive) return
					setTiers(merged)
					setCardName(cached.cardName)
					const [myAssets, eoaUsdc] = await Promise.all([
						getMyAssets(profile, cardAddress),
						getEOAUSDCBalance(profile),
					])
					if (!alive) return
					setAssets(myAssets)
					setLiveUsdcBalance(String(eoaUsdc ?? "0"))
					return
				}
				const [metaApi, metaUri, contractTiers, myAssets, eoaUsdc] = await Promise.all([
					getCardMetadataFromApi(cardAddress),
					getCardMetadataFromUri(cardAddress),
					getCardTiersFromContract(cardAddress),
					getMyAssets(profile, cardAddress),
					getEOAUSDCBalance(profile),
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
				setLiveUsdcBalance(String(eoaUsdc ?? "0"))
				const name = (metaApi?.name ?? metaUri?.name ?? "").trim()
				setCardName(name)
				saveCardMetadataToStorage(cardAddress, {
					tiers: merged.map((t) => ({
						index: t.index,
						minUsdc6: t.minUsdc6.toString(),
						name: t.name,
						description: t.description,
						image: t.image,
						backgroundColor: t.backgroundColor,
						upgradeByBalance: t.upgradeByBalance,
					})),
					cardName: name,
				})
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
			const idx = getNumericTier(nft?.tier ?? (nft as any)?.tierIndexOrMax?.toString?.())
			if (idx >= 0) maxIdx = Math.max(maxIdx, idx)
		}
		return maxIdx
	}, [assets?.nfts])
	/** Current tier from NFT; fallback to points6-based derivation when NFT tier is Default/Max or missing.
	 *  Allow ~0.1% tolerance (points6 >= minUsdc6 * 999/1000) for rounding when user has points but no NFT. */
	const effectiveCurrentTier = useMemo(() => {
		if (currentTierIndex >= 0) {
			const t = tiers.find((x) => x.index === currentTierIndex)
			if (t) return t
		}
		if (tiers.length === 0) return null
		let best: TierItem | null = null
		let bestMin = 0n
		const TOLERANCE = 999n
		const SCALE = 1000n
		for (const t of tiers) {
			const threshold = (t.minUsdc6 * TOLERANCE) / SCALE
			if (points6 >= threshold && t.minUsdc6 > bestMin) {
				bestMin = t.minUsdc6
				best = t
			}
		}
		return best
	}, [currentTierIndex, tiers, points6])
	const currentTierName = useMemo(() => {
		const t = effectiveCurrentTier
		return t?.name?.trim() || (t ? `Tier ${t.index + 1}` : "")
	}, [effectiveCurrentTier])

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

	/** For first_purchase/upgrade pre-fill: ceiling as integer, no decimals */
	const points6ToCardAmountInt = (points6: bigint) => {
		const raw = Number(ethers.formatUnits(points6, 6))
		if (!Number.isFinite(raw)) return "0"
		return String(Math.ceil(raw - 1e-9))
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

	/**
	 * Convert card currency amount to USDC via oracle, add 0.005 buffer, round to 2dp (half-up).
	 * Ensures safe card issuance when first purchase has currency→USDC conversion rounding errors.
	 * Returns USDC6 in 2-decimal precision (no raw 6-decimal amounts sent).
	 */
	const cardAmountToSafeUsdc6 = async (human: string): Promise<bigint> => {
		const normalized = human.replace(/,/g, "").trim()
		if (!normalized || Number(normalized) <= 0) return 0n
		const { usdc6 } = await quoteCurrencyAmountInUSDC(cardAddress, cardCurrency, normalized)
		const BUFFER_USDC6 = 5_000n // 0.005 USDC
		const CENT_USDC6 = 10_000n
		const ROUND_HALF_USDC6 = 5_000n
		const buffered = usdc6 + BUFFER_USDC6
		return ((buffered + ROUND_HALF_USDC6) / CENT_USDC6) * CENT_USDC6
	}

	const minTier = tiers[0]
	const maxTier = tiers.length > 0 ? tiers[tiers.length - 1] : null
	const nextTier = useMemo(() => tiers.find((t) => t.minUsdc6 > points6), [tiers, points6])
	const selectedTier = useMemo(
		() => (selectedTierIndex == null ? null : tiers.find((t) => t.index === selectedTierIndex) ?? null),
		[selectedTierIndex, tiers]
	)

	/** User effectively has a tier: from NFT or from points6 (fallback when NFT tier is Default/Max) */
	const hasEffectiveMembership = useMemo(
		() => hasMembership || effectiveCurrentTier != null,
		[hasMembership, effectiveCurrentTier]
	)

	/** When user has no card: min tier → [50, 75, 99]; non-min tier → [100, 200, 500]. Otherwise use prop or default. */
	const quickOptions = useMemo(() => {
		if (quickOptionsProp != null) return quickOptionsProp
		if (!hasEffectiveMembership && minTier) {
			const effectiveTier = selectedTier ?? minTier
			const isMinTier = effectiveTier.minUsdc6 === minTier.minUsdc6
			return isMinTier ? [50, 75, 99] : [100, 200, 500]
		}
		return [25, 50, 100]
	}, [quickOptionsProp, hasEffectiveMembership, minTier, selectedTier])

	const applyTierSelection = (tier: TierItem) => {
		setSelectedTierIndex(tier.index)
		if (!hasEffectiveMembership) {
			setTopupIntent("first_purchase")
			setAmount(points6ToCardAmountInt(tier.minUsdc6))
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
			setAmount(points6ToCardAmountInt(delta))
			return
		}
		setAmount(points6ToCardAmountInt(tier.minUsdc6))
	}

	useEffect(() => {
		if (loading) return
		if (selectedTier) return
		if (presetAmountEmpty) {
			setTopupIntent("topup")
			setAmount("")
			return
		}
		if (!hasEffectiveMembership) {
			setTopupIntent("first_purchase")
			const tier = initialTierPreference === "max" && maxTier ? maxTier : minTier
			const min6 = tier?.minUsdc6 ?? 1_000_000n
			setAmount(points6ToCardAmountInt(min6))
			if (initialTierPreference && tier) {
				setSelectedTierIndex(tier.index)
			}
			return
		}
		if (nextTier) {
			setTopupIntent("upgrade")
			const delta = nextTier.minUsdc6 > points6 ? nextTier.minUsdc6 - points6 : MIN_TOPUP_USDC6
			setAmount(points6ToCardAmountInt(delta))
			return
		}
		setTopupIntent("topup")
		setAmount("")
	}, [loading, hasEffectiveMembership, minTier?.minUsdc6, maxTier, nextTier, points6, selectedTier, cardCurrency, usdcPerCurrencyUnit, initialTierPreference, presetAmountEmpty])

	const requiredMinPoints6ForUi = useMemo(() => {
		if (!hasEffectiveMembership) {
			return selectedTier?.minUsdc6 ?? minTier?.minUsdc6 ?? 1_000_000n
		}
		if (selectedTier && selectedTier.minUsdc6 > points6) {
			return selectedTier.upgradeByBalance ? (selectedTier.minUsdc6 - points6) : selectedTier.minUsdc6
		}
		return MIN_TOPUP_USDC6
	}, [hasEffectiveMembership, minTier?.minUsdc6, points6, selectedTier])

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

	/**
	 * Load more hint: when user has card, amount > current tier threshold, amount < next tier threshold.
	 * Two upgrade modes (per nextTier.upgradeByBalance):
	 * - upgradeByBalance=true:  next tier by total balance; amountNeeded = nextTier.minUsdc6 - points6
	 * - upgradeByBalance=false: next tier by single topup amount; amountNeeded = nextTier.minUsdc6
	 * Note: minUsdc6 is points-based (semantic: minPointsDelta6), use points6ToCardAmount for conversion.
	 */
	const loadMoreHint = useMemo(() => {
		if (!hasEffectiveMembership || !nextTier) return null
		const currentTier = effectiveCurrentTier
		if (!currentTier) return null
		let inputPoints6: bigint
		try {
			inputPoints6 = ethers.parseUnits(String(amount?.replace(/,/g, "") || "0"), 6)
		} catch {
			return null
		}
		if (inputPoints6 <= 0n) return null
		const amountNeededPoints6 = nextTier.upgradeByBalance
			? (nextTier.minUsdc6 > points6 ? nextTier.minUsdc6 - points6 : 0n)
			: nextTier.minUsdc6
		if (amountNeededPoints6 <= 0n) return null
		if (inputPoints6 >= amountNeededPoints6) return null
		if (inputPoints6 <= currentTier.minUsdc6) return null
		const moreNeededPoints6 = amountNeededPoints6 - inputPoints6
		if (moreNeededPoints6 <= 0n) return null
		const moreNeeded = Number(ethers.formatUnits(moreNeededPoints6, 6))
		const { prefix, amount: moreText, suffix } = formatBalanceWithCurrencyProtocol(moreNeeded, cardCurrency)
		return { moreDisplay: `${prefix}${moreText}${suffix}`.trim(), nextTierName: nextTier.name }
	}, [hasEffectiveMembership, nextTier, effectiveCurrentTier, amount, points6, cardCurrency])

	/** Upgrade unlocked: when input amount reaches or exceeds next tier threshold */
	const upgradeUnlockedHint = useMemo(() => {
		if (!hasEffectiveMembership || !nextTier) return null
		const currentTier = effectiveCurrentTier
		if (!currentTier) return null
		let inputPoints6: bigint
		try {
			inputPoints6 = ethers.parseUnits(String(amount?.replace(/,/g, "") || "0"), 6)
		} catch {
			return null
		}
		if (inputPoints6 <= 0n) return null
		const amountNeededPoints6 = nextTier.upgradeByBalance
			? (nextTier.minUsdc6 > points6 ? nextTier.minUsdc6 - points6 : 0n)
			: nextTier.minUsdc6
		if (amountNeededPoints6 <= 0n) return null
		if (inputPoints6 < amountNeededPoints6) return null
		if (inputPoints6 < currentTier.minUsdc6) return null
		const bg = nextTier.backgroundColor ?? "#2C5535"
		return { nextTierName: nextTier.name, backgroundColor: bg, textColor: getContrastTextColor(bg) }
	}, [hasEffectiveMembership, nextTier, effectiveCurrentTier, amount, points6, cardCurrency])

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

	// Focus amount input when entering (after loading, not in success state)
	useEffect(() => {
		if (loading || topupSuccessTxHash) return
		const t = setTimeout(() => amountInputRef.current?.focus(), 100)
		return () => clearTimeout(t)
	}, [loading, topupSuccessTxHash])

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
				const usdcSafe6 = await cardAmountToSafeUsdc6(raw)
				if (!alive) return
				setInsufficientUsdcBalance(usdcSafe6 > userUsdcBalance6)
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
			amount6 = await cardAmountToSafeUsdc6(amount || "0")
			// Upgrade: only bump when user's input is close to threshold (intended upgrade, rounding may undercut)
			// If amount6 << threshold, user wants normal topup - do not bump
			if (nextTier && effectiveCurrentTier) {
				const amountNeededPoints6 = nextTier.upgradeByBalance
					? (nextTier.minUsdc6 > points6 ? nextTier.minUsdc6 - points6 : 0n)
					: nextTier.minUsdc6
				const CLOSE_THRESHOLD = 95n // 95% - within 5% of threshold
				if (amountNeededPoints6 > 0n && amount6 < amountNeededPoints6 && amount6 * 100n >= amountNeededPoints6 * CLOSE_THRESHOLD) {
					amount6 = amountNeededPoints6
				}
			}
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
			const amountUSDC = Number(ethers.formatUnits(amount6, 6)).toFixed(2)
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
			const amtNum = Number(amount?.replace(/,/g, "") || "0")
			const { prefix, amount: amtText, suffix } = formatBalanceWithCurrencyProtocol(amtNum, cardCurrency)
			setSuccessAmountDisplay(`${prefix}${prefix ? " " : ""}${amtText}${suffix}`.trim())
			// Show upgrade modal when the USDC sent met the tier threshold (UI ensures amount6 >= amountNeededPoints6 for upgrade)
			if (nextTier && effectiveCurrentTier) {
				const amountNeededPoints6 = nextTier.upgradeByBalance
					? (nextTier.minUsdc6 > points6 ? nextTier.minUsdc6 - points6 : 0n)
					: nextTier.minUsdc6
				if (amountNeededPoints6 > 0n && amount6 >= amountNeededPoints6) {
					setUpgradeSuccessModal({ show: true, currentTier: effectiveCurrentTier, nextTier })
				}
			}
		} finally {
			setSubmitting(false)
		}
	}

	const resetTopupState = () => {
		setError("")
		setTopupSuccessTxHash(null)
		setSuccessAmountDisplay("")
		setUpgradeSuccessModal({ show: false, currentTier: null, nextTier: null })
	}

	const handleUpgradeModalDone = () => {
		setUpgradeSuccessModal({ show: false, currentTier: null, nextTier: null })
		onClose?.(assets)
	}

	const handleOpenWallet = () => {
		onClose?.(assets)
		navigate("/History")
	}

	if (loading) {
		return (
			<div className="p-6 space-y-4">
				<div className="relative flex items-center justify-center py-1">
					<div className="h-6 w-48 rounded bg-slate-200 animate-pulse" />
					<button
						className="absolute right-0 w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
						onClick={() => onClose?.()}
						aria-label="Close"
					>
						<X size={22} strokeWidth={2.5} />
					</button>
				</div>
				<div className="rounded-xl bg-white p-4 space-y-3">
					<div className="flex flex-col items-center py-10 gap-4">
						<div className="h-14 w-32 rounded-lg bg-slate-200 animate-pulse" />
						<div className="flex gap-2">
							<div className="h-10 w-20 rounded-full bg-slate-200 animate-pulse" />
							<div className="h-10 w-20 rounded-full bg-slate-200 animate-pulse" />
							<div className="h-10 w-20 rounded-full bg-slate-200 animate-pulse" />
						</div>
					</div>
					<div className="h-11 rounded-full bg-slate-200 animate-pulse" />
				</div>
			</div>
		)
	}

	return (
		<>
			<AnimatePresence>
				{upgradeSuccessModal.show && upgradeSuccessModal.currentTier && upgradeSuccessModal.nextTier && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
						onClick={(e) => e.target === e.currentTarget && handleUpgradeModalDone()}
					>
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0.95 }}
							className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex justify-end mb-4">
								<button
									onClick={handleUpgradeModalDone}
									className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all"
									aria-label="Close"
								>
									<X size={22} strokeWidth={2.5} />
								</button>
							</div>
							<div className="flex flex-col items-center gap-4">
								<div className="relative flex h-44 w-full items-center justify-center overflow-visible py-3" style={{ perspective: "1200px" }}>
									<motion.div
										className="relative h-32 w-48 shrink-0"
										style={{ transformStyle: "preserve-3d" }}
										initial={{ rotateY: 0 }}
										animate={{ rotateY: 180 }}
										transition={{ duration: 1.5, ease: "easeInOut" }}
									>
										<div
											className="absolute inset-0 rounded-xl bg-cover bg-center shadow-lg"
											style={{
												backfaceVisibility: "hidden",
												WebkitBackfaceVisibility: "hidden",
												backgroundImage: upgradeSuccessModal.currentTier.image
													? `url(${upgradeSuccessModal.currentTier.image})`
													: undefined,
												backgroundColor: upgradeSuccessModal.currentTier.backgroundColor ?? "#1a1a1a",
											}}
										/>
										<div
											className="absolute inset-0 rounded-xl bg-cover bg-center shadow-lg"
											style={{
												backfaceVisibility: "hidden",
												WebkitBackfaceVisibility: "hidden",
												transform: "rotateY(180deg)",
												backgroundImage: upgradeSuccessModal.nextTier.image
													? `url(${upgradeSuccessModal.nextTier.image})`
													: undefined,
												backgroundColor: upgradeSuccessModal.nextTier.backgroundColor ?? "#1a1a1a",
											}}
										/>
									</motion.div>
								</div>
								<h4 className="text-center text-xl font-bold text-slate-900">
									{upgradeSuccessModal.nextTier.name} Unlocked!
								</h4>
								<p className="text-center text-sm text-slate-500 leading-relaxed">
									Your card is now {upgradeSuccessModal.nextTier.name}. You will enjoy{" "}
									{upgradeSuccessModal.nextTier.description ?? "benefits"} on all future orders.
								</p>
							</div>
							<button
								onClick={handleUpgradeModalDone}
								className="mt-6 w-full h-11 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-colors"
							>
								Done
							</button>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
			<div className="p-6 space-y-4 relative">
				<button
					className="absolute right-0 top-4 w-10 h-10 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
					onClick={() => onClose?.(assets)}
					aria-label="Close"
				>
					<X size={22} strokeWidth={2.5} />
				</button>
			<div className="flex items-center justify-center py-1">
				<h3 className="text-lg font-bold text-slate-900 text-center">Add credits to CashTrees Card</h3>
			</div>
			<div className="rounded-xl bg-white p-4 space-y-3">
				{submitting ? (
					<div className="flex flex-col items-center justify-center py-10 gap-3">
						<RefreshCw size={40} className="animate-spin text-blue-600" />
						<p className="text-sm font-semibold text-slate-600">Processing top-up...</p>
						<p className="text-xs text-slate-500">Please wait</p>
					</div>
				) : topupSuccessTxHash !== null ? (
					<div className="flex flex-col items-center py-6 gap-4">
						<div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center">
							<Check size={44} strokeWidth={3} className="text-white" />
						</div>
						<p className="text-xl font-bold text-slate-900">Credits Added!</p>
						<p className="text-center text-slate-600 text-sm leading-relaxed px-2">
							{topupIntent === "first_purchase" && successAmountDisplay
								? `${successAmountDisplay} has been securely added to your new pass.`
								: successAmountDisplay
									? `${successAmountDisplay} has been securely added to your pass.`
									: "Your top-up has been completed successfully."}
						</p>
						<button
							onClick={handleOpenWallet}
							className="w-full h-11 mt-4 rounded-full bg-blue-600 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-[0.98] transition-colors"
						>
							<Wallet size={20} strokeWidth={2.5} />
							Open Wallet
						</button>
					</div>
				) : (
					<>
						<div className="flex flex-col items-center mb-6">
							<div className="flex items-baseline justify-center gap-2 mb-8">
								<span className="text-2xl font-semibold text-slate-400 shrink-0">
									{formatBalanceWithCurrencyProtocol(0, cardCurrency).prefix}
								</span>
								<input
									ref={amountInputRef}
									value={amount}
									onChange={(e) => {
										const raw = e.target.value.replace(/,/g, "")
										// Allow digits and one decimal point; limit decimal places by currency
										let cleaned = raw.replace(/[^\d.]/g, "")
										const dotIdx = cleaned.indexOf(".")
										if (dotIdx >= 0) {
											const intPart = cleaned.slice(0, dotIdx)
											const decPart = cleaned.slice(dotIdx + 1).replace(/\./g, "").slice(0, cardCurrencyDecimals)
											cleaned = decPart.length > 0 ? `${intPart}.${decPart}` : intPart
										}
										setAmount(cleaned)
									}}
									type="text"
									inputMode="numeric"
									pattern="[0-9]*"
									className="w-56 min-w-[180px] bg-transparent text-5xl leading-none font-bold text-slate-900 outline-none border-b-2 border-slate-300 pt-4 pb-0 focus:border-[#1562f0] text-center"
								/>
							</div>
							<div className="flex items-center justify-center gap-2 flex-wrap">
								{quickOptions.map((opt, idx) => {
									const optStr = cardCurrencyDecimals === 0 ? String(Math.round(opt)) : (Number.isInteger(opt) ? String(opt) : opt.toFixed(2))
									const amtNum = Number(amount)
									const isActive = Number.isFinite(amtNum) && Math.abs(amtNum - opt) < 0.01
									return (
										<button
											key={`${opt}-${idx}`}
											type="button"
											onClick={() => setAmount(optStr)}
											className={[
												"min-w-[72px] px-4 py-2.5 rounded-full text-[15px] font-bold transition-colors",
												isActive
													? "bg-[#0A1540] text-white shadow-sm"
													: "bg-slate-100 text-slate-600 hover:bg-slate-200",
											].join(" ")}
										>
											{formatBalanceWithCurrencyProtocol(opt, cardCurrency).prefix}
											{cardCurrencyDecimals === 0 ? Math.round(opt) : (Number.isInteger(opt) ? opt : opt.toFixed(2))}
										</button>
									)
								})}
							</div>
						</div>
						<div className="min-h-11 flex items-center justify-center">
							{upgradeUnlockedHint ? (
								<div
									className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold"
									style={{
										backgroundColor: upgradeUnlockedHint.backgroundColor,
										color: upgradeUnlockedHint.textColor,
									}}
								>
									<Crown size={18} className="shrink-0" strokeWidth={2.5} />
									<span>{upgradeUnlockedHint.nextTierName} Upgrade Unlocked!</span>
								</div>
							) : loadMoreHint ? (
								<div className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-sm text-slate-600">
									<Info size={18} className="shrink-0 text-slate-500" />
									<span>{itemId === 201 ? "Unlock VIP" : itemId === 202 ? "Top-up" : `Load ${loadMoreHint.moreDisplay} more for ${loadMoreHint.nextTierName}`}</span>
								</div>
							) : null}
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
						{error ? (
							<div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
								{error}
							</div>
						) : null}
						<AppButton
							fullWidth
							onClick={submit}
							loading={submitting}
							disabled={amountBelowRequirement || insufficientUsdcBalance || balanceCheckLoading}
						>
							Confirm
						</AppButton>
					</>
				)}
			</div>
		</div>
		</>
	)
}

