// CardManager - Form for creating BeamioUserCard
// Key params: cardOwner, currency, unitPriceHuman (human-readable, backend converts to priceInCurrencyE6), initCode (built by backend)
import React, { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, ImagePlus, X, Plus } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { createBeamioCard, type CreateBeamioCardParams, type TierMetadata } from "@/services/BeamioCard"
import { postToIPFS } from "@/services/beamio"
import { Toast } from "antd-mobile"
import CurrencyPicker from "@/components/input/SelectCurrent"
import usdcIcon from "@/components/assets/usdc.png"
import baseIcon from "@/components/assets/base-logo.png"

const CURRENCY_META: Record<CreateBeamioCardParams["currency"], { flag: string; sym: string }> = {
	USD: { flag: "🇺🇸", sym: "$" },
	CAD: { flag: "🇨🇦", sym: "$" },
	USDC: { flag: "🪙", sym: "$" },
	EUR: { flag: "🇪🇺", sym: "€" },
	JPY: { flag: "🇯🇵", sym: "¥" },
	CNY: { flag: "🇨🇳", sym: "¥" },
	HKD: { flag: "🇭🇰", sym: "$" },
	TWD: { flag: "🇹🇼", sym: "NT$" },
	SGD: { flag: "🇸🇬", sym: "$" },
}

/** Target file size 37MB so base64 (~49MB) stays under server 50MB limit */
const TARGET_MAX_BYTES = 37 * 1024 * 1024
/** When 413, retry with JPEG under this size (base64 ~1.3x; nginx default 1MB) */
const JPEG_RETRY_MAX_BYTES = 700 * 1024
const IPFS_GET_FRAGMENT = "https://ipfs.conet.network/api/getFragment?hash="

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob)
		const img = new Image()
		img.onload = () => {
			URL.revokeObjectURL(url)
			resolve(img)
		}
		img.onerror = () => {
			URL.revokeObjectURL(url)
			reject(new Error("Failed to load image"))
		}
		img.src = url
	})
}

/** MIME → canvas.toBlob format, keep original (PNG→png, JPEG→jpeg) */
function toBlobFormat(mime: string): "image/png" | "image/jpeg" | "image/webp" {
	if (mime === "image/png") return "image/png"
	if (mime === "image/webp") return "image/webp"
	return "image/jpeg"
}

/**
 * Compress blob to JPEG to reduce size (e.g. when 413). Tries quality steps, then scales down if needed.
 */
async function compressToJpeg(blob: Blob, maxRawBytes: number): Promise<Blob> {
	const img = await loadImageFromBlob(blob)
	const w = img.naturalWidth || img.width
	const h = img.naturalHeight || img.height
	const canvas = document.createElement("canvas")
	canvas.width = w
	canvas.height = h
	const ctx = canvas.getContext("2d")
	if (!ctx) return blob
	ctx.imageSmoothingEnabled = true
	ctx.imageSmoothingQuality = "high"
	ctx.drawImage(img, 0, 0, w, h)
	for (const q of [0.85, 0.75, 0.65, 0.5, 0.35]) {
		const out = await new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b), "image/jpeg", q))
		if (out && out.size <= maxRawBytes) return out
	}
	const scale = Math.sqrt((maxRawBytes * 0.9) / (blob.size || 1))
	const tw = Math.max(1, Math.round(w * scale))
	const th = Math.max(1, Math.round(h * scale))
	canvas.width = tw
	canvas.height = th
	ctx.drawImage(img, 0, 0, tw, th)
	const out = await new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b), "image/jpeg", 0.7))
	return out || blob
}

/**
 * Resize image to ≤37MB in one shot (base64 stays under server 50MB limit). Use original format; scale = sqrt(target/original).
 * Maintain aspect ratio (no distortion). No iteration.
 */
async function resizeToFitLimit(file: File, targetBytes: number): Promise<Blob> {
	const img = await loadImageFromBlob(file)
	const w = img.naturalWidth || img.width
	const h = img.naturalHeight || img.height
	const format = toBlobFormat(file.type || "image/jpeg")
	const quality = format === "image/png" ? undefined : 0.92
	if (file.size <= targetBytes) {
		// Already under limit; pass through canvas to normalize (keep format)
		const canvas = document.createElement("canvas")
		canvas.width = w
		canvas.height = h
		const ctx = canvas.getContext("2d")
		if (!ctx) return file as Blob
		ctx.imageSmoothingEnabled = true
		ctx.imageSmoothingQuality = "high"
		ctx.drawImage(img, 0, 0, w, h)
		const out = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob((b) => resolve(b), format, quality)
		)
		return out || (file as Blob)
	}
	// scale^2 ≈ targetBytes/file.size (file size ∝ pixels for same format/quality)
	const scale = Math.sqrt((targetBytes * 0.98) / file.size)
	const tw = Math.max(1, Math.round(w * scale))
	const th = Math.max(1, Math.round(h * scale))
	const canvas = document.createElement("canvas")
	canvas.width = tw
	canvas.height = th
	const ctx = canvas.getContext("2d")
	if (!ctx) return file as Blob
	ctx.imageSmoothingEnabled = true
	ctx.imageSmoothingQuality = "high"
	ctx.drawImage(img, 0, 0, tw, th)
	const out = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob((b) => resolve(b), format, quality)
	)
	return out || (file as Blob)
}

const shortAddress = (addr: string) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—")
const getImg = (avatarSeed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed || "@Beamio").toString()}`

type CardManagerProps = {
	/** Embedded: when onClose provided, back button calls onClose instead of navigate */
	onClose?: () => void
	/** Embedded: do not render top header (provided by parent drawer) */
	embedded?: boolean
	/** Called when card is created successfully (parent can refetch My BeamioUserCards list) */
	onCreated?: () => void
}

export default function CardManager({ onClose, embedded, onCreated }: CardManagerProps = {}) {
	const navigate = useNavigate()
	const { profiles, beamio } = useDaemonContext()
	const [cardOwner, setCardOwner] = useState("")

	// cardOwner from profile[0] (prefer AA, else EOA) — read-only, no user input
	useEffect(() => {
		const p = profiles?.[0]
		if (p) {
			setCardOwner((p.aaAccount ?? p.keyID ?? "").trim())
		}
	}, [profiles])
	const [currency, setCurrency] = useState<CreateBeamioCardParams["currency"]>("CAD")
	const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
	const [priceHuman, setPriceHuman] = useState("1")
	const [metaName, setMetaName] = useState("")
	const [metaDescription, setMetaDescription] = useState("")
	const [metaImage, setMetaImage] = useState("")
	const [uploadingImage, setUploadingImage] = useState(false)
	const [loading, setLoading] = useState(false)
	const [result, setResult] = useState<{ cardAddress: string; hash?: string } | null>(null)
	const [error, setError] = useState("")
	const fileInputRef = useRef<HTMLInputElement>(null)

	/** Tier form row; attr derived from tier order (chain uses for entitlements/redeem, default to index). upgradeByBalance: true=按余额升级，false=按单次 topup/redeem 金额升级 */
	type TierFormRow = { minHuman: string; name: string; description: string; image: string; backgroundColor: string; upgradeByBalance: boolean }
	const [tiers, setTiers] = useState<TierFormRow[]>([])
	const [tierImageUploading, setTierImageUploading] = useState<number | null>(null)
	const tierFileInputRef = useRef<HTMLInputElement>(null)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError("")
		setResult(null)

		const ownerTrimmed = cardOwner.trim()
		if (!ownerTrimmed) {
			setError("Owner not loaded. Please ensure your account is ready.")
			return
		}
		if (!/^0x[a-fA-F0-9]{40}$/.test(ownerTrimmed)) {
			setError("Owner address invalid.")
			return
		}

		const priceNum = parseFloat(priceHuman)
		if (isNaN(priceNum) || priceNum <= 0) {
			setError("Unit price must be greater than 0")
			return
		}

		if (!metaName.trim()) {
			setError("Card name is required")
			return
		}

		const tiersPayload: TierMetadata[] | undefined =
			tiers.length > 0
				? (() => {
						const valid = tiers
							.filter((t) => t.name.trim() !== "")
							.map((t, idx) => {
								const minVal = t.minHuman.trim()
								const minUnits = minVal ? parseFloat(minVal) : idx + 1
								return {
									minUsdc6: Math.round((Number.isFinite(minUnits) ? minUnits : idx + 1) * 1e6),
									name: t.name.trim(),
									description: t.description.trim() || undefined,
									image: t.image.trim() || undefined,
									backgroundColor: t.backgroundColor.trim() || undefined,
									upgradeByBalance: t.upgradeByBalance,
								}
							})
						valid.sort((a, b) => b.minUsdc6 - a.minUsdc6)
						return valid.map((t, idx) => ({
							index: idx,
							minUsdc6: String(t.minUsdc6),
							attr: idx,
							name: t.name,
							...(t.description && { description: t.description }),
							...(t.image && { image: t.image }),
							...(t.backgroundColor && { backgroundColor: t.backgroundColor }),
							upgradeByBalance: t.upgradeByBalance,
						}))
					})()
				: undefined

		if (tiers.length > 0 && (!tiersPayload || tiersPayload.length === 0)) {
			setError("Each tier needs a name")
			return
		}

		setLoading(true)
		try {
			const res = await createBeamioCard({
				cardOwner: ownerTrimmed,
				currency,
				unitPriceHuman: priceHuman,
				shareTokenMetadata: {
					name: metaName.trim(),
					description: metaDescription.trim() || undefined,
					image: metaImage.trim() || undefined,
				},
				...(tiersPayload && tiersPayload.length > 0 && { tiers: tiersPayload }),
			})
			if (res.success && res.cardAddress) {
				setResult({ cardAddress: res.cardAddress, hash: res.hash })
				Toast.show({ content: "Card created successfully", icon: "success" })
				onCreated?.()
			} else {
				setError(res.error ?? "Create failed")
				Toast.show({ content: res.error ?? "Create failed", icon: "fail" })
			}
		} catch (e: any) {
			const msg = e?.message ?? String(e)
			setError(msg)
			Toast.show({ content: msg, icon: "fail" })
		} finally {
			setLoading(false)
		}
	}

	const handleBack = () => (onClose ? onClose() : navigate(-1))

	const addTier = () => {
		setTiers((prev) => [...prev, { minHuman: String(prev.length + 1), name: "", description: "", image: "", backgroundColor: "#6366f1", upgradeByBalance: true }])
	}
	const removeTier = (i: number) => {
		setTiers((prev) => prev.filter((_, idx) => idx !== i))
	}
	const updateTier = (i: number, field: keyof TierFormRow, value: string | boolean) => {
		setTiers((prev) => {
			const next = [...prev]
			next[i] = { ...next[i], [field]: value }
			return next
		})
	}
	const triggerTierImageUpload = (tierIndex: number) => {
		setTierImageUploading(tierIndex)
		tierFileInputRef.current?.click()
	}
	const handleTierImagePick: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
		const input = e.currentTarget
		const file = input.files?.[0]
		const tierIndex = tierImageUploading
		input.value = ""
		setTierImageUploading(null)
		if (tierIndex == null || !file || !file.type.startsWith("image/")) return
		const isSvg = file.type === "image/svg+xml"
		const profile = profiles?.[0]
		if (!profile?.privateKeyArmor) {
			setError("Profile not available for upload")
			return
		}
		setError("")
		try {
			let blob: Blob = file
			if (!isSvg && file.size > TARGET_MAX_BYTES) {
				blob = await resizeToFitLimit(file, TARGET_MAX_BYTES)
				Toast.show({ content: "Image resized to <37MB", icon: "success" })
			}
			const toDataUrl = (b: Blob) =>
				new Promise<string>((resolve, reject) => {
					const r = new FileReader()
					r.onload = () => resolve(String(r.result))
					r.onerror = () => reject(r.error)
					r.readAsDataURL(b)
				})
			let dataUrl = await toDataUrl(blob)
			let hash: string | null = null
			try {
				hash = await postToIPFS(profile, dataUrl)
			} catch (err: any) {
				if (err?.message?.includes?.("413") && !isSvg) {
					Toast.show({ content: "Compressing to JPEG…", icon: "loading" })
					blob = await compressToJpeg(blob, JPEG_RETRY_MAX_BYTES)
					dataUrl = await toDataUrl(blob)
					hash = await postToIPFS(profile, dataUrl)
				} else {
					throw err
				}
			}
			if (hash) {
				const url = `${IPFS_GET_FRAGMENT}${hash}&t=${Date.now()}`
				updateTier(tierIndex, "image", url)
				Toast.show({ content: "Tier image uploaded", icon: "success" })
			} else {
				setError("Tier image upload failed")
				Toast.show({ content: "Upload failed", icon: "fail" })
			}
		} catch (err: any) {
			setError(err?.message ?? "Upload failed")
			Toast.show({ content: err?.message ?? "Upload failed", icon: "fail" })
		}
	}

	const handleImagePick: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
		const input = e.currentTarget
		const file = input.files?.[0]
		if (!file || !file.type.startsWith("image/")) return
		const isSvg = file.type === "image/svg+xml"
		const profile = profiles?.[0]
		if (!profile?.privateKeyArmor) {
			setError("Profile not available for upload")
			input.value = ""
			return
		}
		setError("")
		setUploadingImage(true)
		try {
			let blob: Blob = file
			if (!isSvg && file.size > TARGET_MAX_BYTES) {
				blob = await resizeToFitLimit(file, TARGET_MAX_BYTES)
				Toast.show({ content: "Image resized to <37MB", icon: "success" })
			}
			const toDataUrl = (b: Blob) =>
				new Promise<string>((resolve, reject) => {
					const r = new FileReader()
					r.onload = () => resolve(String(r.result))
					r.onerror = () => reject(r.error)
					r.readAsDataURL(b)
				})
			let dataUrl = await toDataUrl(blob)
			let hash: string | null = null
			try {
				hash = await postToIPFS(profile, dataUrl)
			} catch (err: any) {
				if (err?.message?.includes?.("413") && !isSvg) {
					Toast.show({ content: "Compressing to JPEG…", icon: "loading" })
					blob = await compressToJpeg(blob, JPEG_RETRY_MAX_BYTES)
					dataUrl = await toDataUrl(blob)
					hash = await postToIPFS(profile, dataUrl)
				} else {
					throw err
				}
			}
			if (hash) {
				setMetaImage(`${IPFS_GET_FRAGMENT}${hash}&t=${Date.now()}`)
				Toast.show({ content: "Image uploaded", icon: "success" })
			} else {
				setError("Upload failed")
				Toast.show({ content: "Upload failed", icon: "fail" })
			}
		} catch (err: any) {
			setError(err?.message ?? "Upload failed")
			Toast.show({ content: err?.message ?? "Upload failed", icon: "fail" })
		} finally {
			setUploadingImage(false)
			input.value = ""
		}
	}

	return (
		<div className={`${embedded ? '' : 'min-h-screen'} bg-[#0f0f12] text-white`} style={embedded ? {} : { paddingTop: "env(safe-area-inset-top)" }}>
			<header className={`sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-[#0f0f12] border-b border-white/10 ${embedded ? 'flex-row-reverse' : ''}`}>
				<button
					type="button"
					onClick={handleBack}
					className={`p-1 rounded-lg hover:bg-white/10 transition-colors ${embedded ? '' : '-ml-1'}`}
				>
					<ArrowLeft size={24} className={embedded ? 'rotate-180' : ''} />
				</button>
				<h1 className={`text-lg font-semibold ${embedded ? 'mr-auto' : 'flex-1'}`}>Create BeamioUserCard</h1>
			</header>

			<div className="px-4 py-6 max-w-md mx-auto">
				<form onSubmit={handleSubmit} className="space-y-5">
					<div>
						{/* ChatHeaderIOS-style: avatar + pill with @tagText */}
						<div
							className="flex flex-col items-center gap-2 py-3 pointer-events-none select-none"
							aria-readonly
						>
							<div className="relative">
								{cardOwner ? (
									<img
										src={beamio?.image || getImg(beamio?.accountName ?? cardOwner)}
										alt="owner"
										className="w-11 h-11 rounded-full object-cover bg-white/10 shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
									/>
								) : (
									<div className="w-11 h-11 rounded-full bg-white/10" />
								)}
							</div>
							<div
								className={[
									"inline-flex items-center gap-1 px-3 py-1.5 rounded-full",
									"bg-white/10 backdrop-blur-xl ring-1 ring-white/10"
								].join(" ")}
							>
								<span
									className="text-[15px] font-semibold"
									style={{ color: "rgba(22,82,240,0.85)" }}
								>
									@{beamio?.accountName ?? (cardOwner ? shortAddress(cardOwner) : "—")}
								</span>
							</div>
						</div>
					</div>

					<div className="flex items-center gap-2 flex-wrap">
						<button
							type="button"
							onClick={() => setShowCurrencyPicker(true)}
							className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white/90 shrink-0 hover:bg-white/15 focus:outline-none focus:border-[#6f4de7] transition-colors"
						>
							{currency === "USDC" ? (
								<div className="relative flex-shrink-0 w-4 h-4">
									<img src={usdcIcon} alt="" className="block w-4 h-4 rounded-full object-contain" />
									<img src={baseIcon} alt="" className="block w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 rounded-full border border-white/20 bg-white" />
								</div>
							) : (
								<span className="text-lg">{CURRENCY_META[currency]?.flag}</span>
							)}
							<span className="font-medium">1 {currency}</span>
						</button>

						{showCurrencyPicker && (
							<div
								className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
								onClick={() => setShowCurrencyPicker(false)}
								aria-hidden
							>
								<div
									className="rounded-2xl p-4 max-w-sm w-[90vw] bg-[#1a1a1e] border border-white/20 shadow-2xl dark"
									onClick={(e) => e.stopPropagation()}
								>
									<CurrencyPicker
										currentCurrency={currency}
										setCurrentCurrency={(c) => {
											setCurrency(c as CreateBeamioCardParams["currency"])
											setShowCurrencyPicker(false)
										}}
									/>
								</div>
							</div>
						)}

						<span className="text-white/60">=</span>
						<input
							type="text"
							inputMode="decimal"
							value={priceHuman}
							onChange={(e) => setPriceHuman(e.target.value)}
							placeholder="1"
							className="min-w-[4rem] w-24 px-3 py-3 rounded-xl bg-white/10 border border-white/20 text-white text-center placeholder-white/40 focus:outline-none focus:border-[#6f4de7]"
						/>
						<span className="text-white/60 text-sm shrink-0">point(s)</span>
					</div>

					<div className="p-4 rounded-xl bg-white/5 border border-white/10">
						<h3 className="text-sm font-medium text-white/80 mb-3">CARD Information</h3>
						<div className="space-y-3">
							<div>
								<label className="block text-xs text-white/60 mb-1">name *</label>
								<input
									type="text"
									value={metaName}
									onChange={(e) => setMetaName(e.target.value)}
									placeholder="e.g. Beamio CCSA Card"
									className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#6f4de7] text-sm"
								/>
							</div>
							<div>
								<label className="block text-xs text-white/60 mb-1">description</label>
								<textarea
									value={metaDescription}
									onChange={(e) => setMetaDescription(e.target.value)}
									placeholder="Card description for explorers"
									rows={2}
									className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#6f4de7] text-sm resize-none"
								/>
							</div>
							<div>
								<label className="block text-xs text-white/60 mb-1">image</label>
								<div className="flex gap-2 items-center">
									<input
										ref={fileInputRef}
										type="file"
										accept="image/*"
										className="hidden"
										onChange={handleImagePick}
									/>
									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
										disabled={uploadingImage}
										className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/15 focus:outline-none focus:border-[#6f4de7] disabled:opacity-60 text-sm"
									>
										{uploadingImage ? (
											<Loader2 className="w-4 h-4 animate-spin" />
										) : (
											<ImagePlus className="w-4 h-4" />
										)}
										{uploadingImage ? "Uploading…" : "Add image"}
									</button>
									{metaImage && (
										<div className="relative flex-1 min-w-0">
											<img src={metaImage} alt="preview" className="h-10 w-10 rounded-lg object-cover border border-white/20" />
											<button
												type="button"
												onClick={() => setMetaImage("")}
												className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/90 flex items-center justify-center hover:bg-red-500"
												aria-label="Remove image"
											>
												<X className="w-3 h-3 text-white" />
											</button>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>

					<div className="p-4 rounded-xl bg-white/5 border border-white/10">
						<h3 className="text-sm font-medium text-white/80 mb-1">Card Tiers</h3>
						<p className="text-xs text-white/50 mb-3">
							No tiers by default = all cards are normal. Tap + to add tiers (e.g. Gold Card / Silver Card). Per-tier image (IPFS) and background color are used in NFT metadata.
						</p>
						<input
							ref={tierFileInputRef}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={handleTierImagePick}
						/>
						<div className="space-y-3">
							{tiers.map((t, i) => (
								<div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
									<div className="flex justify-between items-center">
										<span className="text-xs text-white/60">Tier {i + 1}</span>
										<button
											type="button"
											onClick={() => removeTier(i)}
											className="p-1 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400"
											aria-label="Remove tier"
										>
											<X className="w-4 h-4" />
										</button>
									</div>
									<div>
										<label className="block text-[10px] text-white/50 mb-0.5">min {currency}</label>
										<input
											type="text"
											inputMode="decimal"
											value={t.minHuman}
											onChange={(e) => updateTier(i, "minHuman", e.target.value)}
											placeholder={String(i + 1)}
											className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#6f4de7]"
										/>
									</div>
									<div>
										<label className="block text-[10px] text-white/50 mb-0.5">name *</label>
										<input
											type="text"
											value={t.name}
											onChange={(e) => updateTier(i, "name", e.target.value)}
											placeholder="e.g. Gold Card"
											className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#6f4de7]"
										/>
									</div>
									<div>
										<label className="block text-[10px] text-white/50 mb-0.5">description</label>
										<input
											type="text"
											value={t.description}
											onChange={(e) => updateTier(i, "description", e.target.value)}
											placeholder="e.g. Highest tier"
											className="w-full px-2 py-1.5 rounded bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#6f4de7]"
										/>
									</div>
									<div>
										<label className="block text-[10px] text-white/50 mb-0.5">image (IPFS)</label>
										<div className="flex gap-2 items-center">
											<button
												type="button"
												onClick={() => triggerTierImageUpload(i)}
												disabled={tierImageUploading !== null}
												className="inline-flex items-center gap-2 px-2 py-1.5 rounded bg-white/10 border border-white/20 hover:bg-white/15 focus:outline-none focus:border-[#6f4de7] disabled:opacity-60 text-xs"
											>
												{tierImageUploading === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
												{tierImageUploading === i ? "Uploading…" : "Upload"}
											</button>
											{t.image && (
												<>
													<img src={t.image} alt={`Tier ${i + 1}`} className="h-8 w-8 rounded object-cover border border-white/20" />
													<button type="button" onClick={() => updateTier(i, "image", "")} className="p-0.5 rounded bg-red-500/80 hover:bg-red-500 text-white" aria-label="Remove"><X className="w-3 h-3" /></button>
												</>
											)}
										</div>
									</div>
									<div>
										<label className="block text-[10px] text-white/50 mb-0.5">background color</label>
										<div className="flex gap-2 items-center">
											<input
												type="color"
												value={t.backgroundColor || "#6366f1"}
												onChange={(e) => updateTier(i, "backgroundColor", e.target.value)}
												className="h-8 w-10 rounded border border-white/20 cursor-pointer bg-transparent"
											/>
											<input
												type="text"
												value={t.backgroundColor}
												onChange={(e) => updateTier(i, "backgroundColor", e.target.value)}
												placeholder="#6366f1"
												className="flex-1 px-2 py-1.5 rounded bg-white/10 border border-white/20 text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#6f4de7] font-mono"
											/>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<input
											type="checkbox"
											id={`tier-${i}-upgradeByBalance`}
											checked={t.upgradeByBalance}
											onChange={(e) => updateTier(i, "upgradeByBalance", e.target.checked)}
											className="rounded border-white/30 bg-white/10 text-[#6f4de7] focus:ring-[#6f4de7]"
										/>
										<label htmlFor={`tier-${i}-upgradeByBalance`} className="text-xs text-white/70">
											Upgrade by balance (uncheck = upgrade by single topup/redeem amount)
										</label>
									</div>
								</div>
							))}
							<button
								type="button"
								onClick={addTier}
								className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/15 focus:outline-none focus:border-[#6f4de7] text-sm text-white/70"
							>
								<Plus className="w-4 h-4" />
								Add Tier
							</button>
						</div>
					</div>

					{error && (
						<div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm">
							{error}
						</div>
					)}

					{result && (
						<div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40">
							<p className="text-emerald-300 font-medium mb-1">✅ Card created</p>
							<p className="text-sm text-white/80 font-mono break-all">{result.cardAddress}</p>
							{result.hash && (
								<a
									href={`https://basescan.org/tx/${result.hash}`}
									target="_blank"
									rel="noopener noreferrer"
									className="mt-2 inline-block text-sm text-emerald-400 hover:underline"
								>
									View transaction on Basescan →
								</a>
							)}
						</div>
					)}

					{!result && (
						<button
							type="submit"
							disabled={loading || !cardOwner}
							className="w-full py-4 rounded-xl bg-[#6f4de7] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-[#7f5df7] transition-colors"
						>
							{loading ? (
								<>
									<Loader2 size={20} className="animate-spin" />
									Creating…
								</>
							) : (
								"Create BeamioUserCard"
							)}
						</button>
					)}
				</form>
			</div>
		</div>
	)
}
