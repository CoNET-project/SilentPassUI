import React, { useMemo, useCallback, useRef, useState, useEffect } from "react"
import {getBalanceProcess, formatWithThousands, aesGcmDecrypt, searchUsername} from '@/services/beamio'
import {
  Check,
  Shield,
  Image as ImageIcon,
  ChevronRight,
  Copy,
  ExternalLink,
  Repeat2,
  MessageCircle
} from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {urlToObjectUrl, useObjectImgSrc} from '@/components/card/useObjectImgSrc'
import giftEnvelope from '@/components/card/assets/giftEnvelope.svg'
import {ethers} from 'ethers'
import ShowCard from '@/components/card/ShowCard'
import baseIcon from '@/components/assets/base-logo.png'

type Mode = "pay" | "request" | 'cashcode'
const baseIconImg = (
  <img
    src={baseIcon} 
    alt="Base"
    className="inline-block w-4 h-4 align-text-bottom"
  />
)

type Props = {
	tx: TransferHistork
	localMode?: Mode
	chainLabel?: string // default "On Base"
	sponsoredByLabel?: string // default "Sponsored by Beamio"
	onProfile?: (address: string) => void
	onSendAgain?: (tx: TransferHistork) => void
	onMessage?: (address: string) => void
	onCopyTx?: (hash: string) => void
	onOpenExplorer?: (hash: string) => void
}

const shortHash = (h: string) => (h ? `${h.slice(0, 6)}…${h.slice(-4)}` : "")
const shortAddress = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "")
const displayName = (item: searchResult|undefined) => {
	if (!item) return ''
	const lastname = item?.last_name?.split('\r\n')||[]
	const fullName = `${item?.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}
function toMs(ts: number) {
	// 秒/毫秒兼容
	return ts < 10_000_000_000 ? ts * 1000 : ts
}

function formatTimeDetail(ts: number) {
	const d = new Date(toMs(ts))
	if (isNaN(d.getTime())) return ""
	// 例：Dec 30, 2025 · 7:24 PM
	const date = d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
	const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
	return `${date} · ${time}`
}

const CURRENCY_META: Record<
  ICurrency,
  { flag: string; symbol: string; label: string }
> = {
  USD: { flag: "🇺🇸", symbol: "$", label: "USD" },
  CAD: { flag: "🇨🇦", symbol: "$", label: "CAD" },
  EUR: { flag: "🇪🇺", symbol: "€", label: "EUR" },
  JPY: { flag: "🇯🇵", symbol: "¥", label: "JPY" },
  CNY: { flag: "🇨🇳", symbol: "¥", label: "CNY" },
  HKD: { flag: "🇭🇰", symbol: "$", label: "HKD" },
  TWD: { flag: "🇹🇼", symbol: "$", label: "TWD" },
  SGD: { flag: "🇸🇬", symbol: "$", label: "SGD" },
  USDC: {flag:"", symbol: "", label: ""}
};

function fiatPrefix(ccy: ICurrency) {
	if (ccy === "CAD") return "CA$"
	if (ccy === "USD") return "$"
	if (ccy === "EUR") return "€"
	if (ccy === "JPY") return "JP¥"
	if (ccy==='TWD') return "NT$"
	if (ccy==='CNY') return 'CN¥'
	if (ccy==='HKD') return 'HK$'
	if (ccy==='SGD') return 'SG$'

  return CURRENCY_META[ccy].symbol;
}

function formatUSDC(v: number) {
	if (!isFinite(v)) return "0.0000"
	return v.toLocaleString("en-US", {
		minimumFractionDigits: 4,
		maximumFractionDigits: 4
	})
}

function formatUSD(v: number) {
	if (!isFinite(v)) return "$0"
	return v.toLocaleString("en-US", { style: "currency", currency: "USD" })
}

const buildCreatedAtLabel = (created_at?: number | string) => {
	if (!created_at) return ""

	// 统一转换成 number
	const num = Number(created_at)
	if (!Number.isFinite(num)) return ""

	// 秒 → 毫秒
	const ts = (String(created_at).length === 10)
		? num * 1000
		: num

	const d = new Date(ts)
	if (Number.isNaN(d.getTime())) return ""

	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	})
}

const statusStyleMap: Record<
	HistoryFilter,
	{
		container: string
		iconBg: string
		icon: string
		text: string
	}
	> = {
	sent: {
		container: "bg-rose-100",
		iconBg: "bg-rose-200",
		icon: "text-rose-700",
		text: "text-rose-600",
	},
	received: {
		container: "bg-emerald-100",
		iconBg: "bg-emerald-200",
		icon: "text-emerald-700",
		text: "text-emerald-600",
	},
	pending: {
		container: "bg-amber-100",
		iconBg: "bg-amber-200",
		icon: "text-amber-700",
		text: "text-amber-200",
	},
	paid: {
		container: "bg-fuchsia-100",
		iconBg: "bg-fuchsia-200",
		icon: "text-fuchsia-700",
		text: "text-fuchsia-800",
	},
	completed: {
		container: "bg-sky-100",
		iconBg: "bg-sky-200",
		icon: "text-sky-700",
		text: "text-sky-800",
	},
	deposited: {
		container: "bg-indigo-100",
		iconBg: "bg-indigo-200",
		icon: "text-indigo-700",
		text: "text-indigo-800",
	},

	// 兜底（all / reject / 其他）
	all: {
		container: "bg-slate-100",
		iconBg: "bg-slate-200",
		icon: "text-slate-500",
		text: "text-slate-500",
	},
	reject: {
		container: "bg-slate-100",
		iconBg: "bg-slate-200",
		icon: "text-slate-500",
		text: "text-slate-500",
	},
}
const fmtAddr = (a = "") => ((a && a !== ethers.ZeroAddress) ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—")

const unknowAcc = (address: string):searchResult => {
	const ret: searchResult = {
		address,
		created_at: 0,
		first_name: '',
		last_name: '',
		follow_count: '',
		follower_count: '',
		username: 'Unknow',
		image: ''
	}
	return ret
}

	function formatAmount(v: number, c: ICurrency) {
		if (!isFinite(v)) return "0"

		const decimals =
			c === "TWD" || c === "JPY"
				? 0
				: c === "USDC"
				? 4
				: 2

		return v.toLocaleString("en-US", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		})
	}

export function TransactionsItemDetail({
	tx,
	localMode = "pay",
	chainLabel = "On Base",
	sponsoredByLabel = "Sponsored by Beamio",
	onProfile,
	onSendAgain,
	onMessage,
	onCopyTx,
	onOpenExplorer
}: Props) {
	const isSponsored = (tx.fee || 0) <= 0
	const timeText = useMemo(() => formatTimeDetail(tx.date), [tx.date])
	const [fromBeamio, setfromBeamio] = useState<searchResult|undefined> ()
	const {setUsdcbalance, usdcbalance, myAddress, setUsdcToUSD, beamioUsers, setbBeamioUsers, currencyData,} = useDaemonContext()
	const [userImg, setUserImg] = useState('')
	const amountText = useMemo(() => formatUSDC(tx.preAmount ?? tx.amount), [tx.preAmount, tx.amount])
	const [copied, setCopied] = useState(false)
	const [currency, setCurrency] = useState<ICurrency> ('USDC')

	// ≈ $1.00：这里简单用 1:1 估算

	const approxFiatText = useMemo(() => `≈ ${fiatPrefix(currency)} ${formatAmount(usdcToCurrencyAmount(tx.amount, currency), currency)}`, [tx.amount, currency])

	const statusText: HistoryFilter = useMemo(() => {
		return tx.type
	}, [localMode])
		const style = statusStyleMap[statusText] ?? statusStyleMap.all
	const findingRef = useRef(false)
	const [showGiftCard, setShowGiftCard] = useState<IImageCard|null>(null)

	const cardSrc = tx?.card
	
	const findUser = useCallback(async () => {
		if (findingRef.current) return
		if (fromBeamio) return
		const address = tx.address
		findingRef.current = true
		try {
			let account = beamioUsers.find(n => (n?.address || '').toLowerCase() === address.toLowerCase())

			if (!account) {
			const _account = await searchUsername(address)
			if (_account?.results?.[0]) account = _account.results[0]
			}

			if (!account) {
				account = unknowAcc(address) 
			}
			//@ts-ignore
			setbBeamioUsers(prev => {
				const addr = (account?.address || '').toLowerCase()
				//@ts-ignore
				if (prev.some(u => (u.address || '').toLowerCase() === addr)) return prev
				return [...prev, account!]
			})

			setfromBeamio(account)
			const _currency= tx?.note?.split('\r\n')
			const _currency1: ICurrency = tx?.card?.currency as ICurrency||_currency[1]||'USDC'
			setCurrency(_currency1)
			account.image && setUserImg(await urlToObjectUrl(account.image))
		} finally {
			findingRef.current = false
		}
	}, [ beamioUsers, fromBeamio, setbBeamioUsers])

	useEffect(() => {
		findUser()
	}, [findUser])

	const amountColor =
		tx.type === "sent" || tx.type === "paid"
			? "text-rose-600"
			: "text-emerald-600"

	
	const copyTxHash = async (hash: string) => {
		if (!hash) return

		try {
			// ✅ 现代浏览器（https / PWA）
			await navigator.clipboard.writeText(hash)
			setCopied(true)
			setTimeout(() => setCopied(false), 1200)
		} catch {
			// 🔁 fallback（iOS / 老 WebView）
			const textarea = document.createElement("textarea")
			textarea.value = hash
			textarea.setAttribute("readonly", "")
			textarea.style.position = "absolute"
			textarea.style.left = "-9999px"
			document.body.appendChild(textarea)
			textarea.select()
			document.execCommand("copy")
			document.body.removeChild(textarea)
		}
		navigator.vibrate?.(10)
	}

	function fxRateUSDCToCurrency(currency: ICurrency): number {
		// 1 USDC = ? USD
		const usdcToUSD = currencyData.USDC ?? 1

		if (currency === 'USD') return usdcToUSD

		const usdToCurrency = currencyData[currency]
		if (typeof usdToCurrency !== 'number') return usdcToUSD

		return usdcToUSD * usdToCurrency
	}

	function usdcToCurrencyAmount(usdc: number, c: ICurrency) {
		const rate = fxRateUSDCToCurrency(c)
		return usdc * rate
	}

	return (
		<div className="min-h-screen">
		<div className="mx-auto max-w-[520px] px-4 py-4">
			<div className="rounded-[28px] bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
			<div className="px-5 pt-5">
				{/* 顶部：状态 + Gas sponsored */}
				<div className="flex items-center justify-between gap-3">
				<div
					className={[
						"inline-flex items-center gap-2 rounded-full px-3 py-1",
						style.container,
					].join(" ")}
					>
					<span
						className={[
						"inline-flex h-5 w-5 items-center justify-center rounded-full",
						style.iconBg,
						].join(" ")}
					>
						<Check
						className={["h-3.5 w-3.5", style.icon].join(" ")}
						strokeWidth={2.5}
						/>
					</span>

					<span
						className={[
						"text-[13px] font-semibold capitalize",
						style.text,
						].join(" ")}
					>
						{statusText}
					</span>
					</div>

				{isSponsored && (
					<div className="inline-flex items-center gap-2 text-[13px] text-slate-500">
					<Shield className="h-4 w-4" />
					<span>Gas sponsored</span>
					</div>
				)}
				</div>

				{/* 金额 */}
				<div className="mt-5">
				<div className="flex items-baseline gap-2">
					<span
						className={[
						"text-[44px] leading-none font-semibold tracking-tight tabular-nums",
						amountColor,
						].join(" ")}
					>
						{amountText}
					</span>

					<span
						className={[
						"text-[28px] leading-none font-semibold",
						amountColor,
						].join(" ")}
					>
						USDC
					</span>
				</div>


				<div className="mt-2 text-[16px] text-slate-500">
					{approxFiatText}
				</div>
				</div>

				{/* 收款人/对方信息 */}
				<div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3 min-w-0">
						<div className="h-16 w-16 rounded-full flex items-center justify-center text-white font-semibold">
							{fromBeamio?.username !== 'Unknow' ? (
							
							<img
								src={userImg}
								className="w-14 h-14 rounded-full object-cover flex-shrink-0 bg-slate-200"
							/>
						) : (
							<div
							className="
								w-10 h-10
								rounded-full
								flex items-center justify-center
								flex-shrink-0
								bg-slate-200
								text-slate-400
								font-semibold
								text-base
							"
							aria-label="Default avatar"
							>
							?
							</div>
						)}
						</div>

						<div className="min-w-0">
							<div className="text-[16px] font-semibold text-slate-900 truncate">
								{
									tx.type === 'sent' || tx.type === 'paid' ? `To ${displayName(fromBeamio)}` : `From ${displayName(fromBeamio)}`
								}
								
							</div>
							<div className="text-[13px] text-slate-500 truncate">
								{fmtAddr(tx.address)}
							</div>
							<div className="text-[13px] text-slate-500 truncate">
								Since {buildCreatedAtLabel(fromBeamio?.created_at)}
							</div>
						</div>

					</div>

					<button
						type="button"
						onClick={() => onProfile?.(tx.address)}
						className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
					>
					
					<ChevronRight className="h-4 w-4" />
					</button>
				</div>
				</div>

				{/* Note */}
				{!!tx.note && (
					<div className="mt-4 text-[15px] text-slate-600">
						<span className="text-slate-400">Note:</span>{" "}
						<span className="text-slate-700">{tx?.note?.split('\r\n')[0]}</span>
					</div>
				)}

				
				{/* Card image preview */}
				<div className="mt-4 rounded-2xl overflow-hidden flex justify-center">
					{cardSrc && (
						<button
						type="button"
						onClick={() => {
							setShowGiftCard(cardSrc)
						}} 
						className="
							group
							flex items-center justify-center
							p-2
							rounded-xl
							hover:bg-slate-100
							active:scale-95
							transition
						"
						aria-label="Open gift"
						>
						<img
							src={giftEnvelope}
							className="
							w-14
							block
							transition
							group-hover:opacity-90
							group-active:opacity-80
							"
							alt="Gift Envelope"
						/>
						</button>
					)}
				</div>

				{/* Network fee / Time */}
				<div className="mt-4 rounded-2xl border border-slate-100 overflow-hidden">
				<div className="flex items-center justify-between px-4 py-3 bg-white">
					<span className="text-[15px] text-slate-500">Network fee</span>
					<div className="flex items-center gap-3">
					<span className="text-[15px] font-semibold text-slate-900 tabular-nums">
						{isSponsored ? "$0" : formatUSD(tx.fee)}
					</span>
					<span className="text-[15px] text-slate-400">
						{isSponsored ? sponsoredByLabel : ""}
					</span>
					</div>
				</div>

				<div className="h-px bg-slate-100" />

				<div className="flex items-center justify-between px-4 py-3 bg-white">
					<span className="text-[15px] text-slate-500">Time</span>
					<span className="text-[15px] font-semibold text-slate-900">
					{timeText}
					</span>
				</div>
				</div>

				{/* On Base · Tx */}
				<div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
					<div className="flex items-center justify-between gap-3">
						<div className="min-w-0 text-[15px] text-slate-600 truncate inline-flex items-center">
							

							<span className="inline-flex items-center mx-1">
								<img
								src={baseIcon}
								alt="Base"
								className="w-4 h-4 relative top-[0.5px]"
								/>
							</span>

							<span 
								className="font-semibold text-slate-700"
								style={{ color: "rgb(0 0 255)" }}
							>
								Base
							</span>

							<span className="mx-1 text-slate-400">·</span>

							<span className="text-slate-500">Tx</span>

							<span className="ml-1 font-semibold text-slate-700">
								{shortHash(tx.hash)}
							</span>
						</div>

						<div className="flex items-center gap-2 shrink-0">
							<button
								type="button"
								onClick={() => copyTxHash(tx.hash)}
								className="
									h-7	 w-7
									rounded-full
									hover:bg-black/5
									active:scale-[0.98]
									transition
									flex items-center justify-center
								"
								aria-label="Copy transaction hash"
								title="Copy"
								>
								{copied ? (
								<Check className="h-4.5 w-4.5 text-emerald-600" />
								) : (
								<Copy className="h-4.5 w-4.5 text-slate-500" />
								)}
							</button>

							<button
								type="button"
								onClick={() => {
									window.open(`https://basescan.org/tx/${tx.hash}`, "_blank", "noopener,noreferrer")
								}}
								className="h-7 w-7 rounded-full hover:bg-black/5 active:scale-[0.98] transition flex items-center justify-center"
								aria-label="Open in explorer"
								title="Open"
							>
								<ExternalLink className="h-4.5 w-4.5 text-slate-500" />
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* 底部按钮 */}
			<div className="px-5 pb-5 pt-5">
				<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => onSendAgain?.(tx)}
					className="
						flex-1 h-12
						rounded-2xl
						bg-slate-900 text-white
						font-semibold
						flex items-center justify-center gap-2
						shadow-sm
						active:scale-[0.99] transition
					"
				>
					<Repeat2 className="h-5 w-5" />
					<span>
						{
							tx.type === 'sent' || tx.type === 'paid' ? 'Send again' : 'Send back'
						}
					</span>
				</button>

				<button
					type="button"
					onClick={() => onMessage?.(tx.address)}
					className="
					flex-1 h-12
					rounded-2xl
					border border-slate-200
					bg-white
					font-semibold text-slate-900
					flex items-center justify-center gap-2
					active:scale-[0.99] transition
					"
				>
					<MessageCircle className="h-5 w-5 text-slate-600" />
					<span>Message</span>
				</button>
				</div>
			</div>
			</div>
		</div>
		{
			showGiftCard && (
				<ShowCard card={showGiftCard} address={tx.address} usdcAmount={amountText} cancel={() => {
					setShowGiftCard (null)
				}} /> 
			)
		}
		</div>
	)
}
