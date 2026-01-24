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
	Info,
	MessageCircle,
	ShieldCheck,
	Receipt,
	Sparkles,
	MoreVertical,
	QrCode, Link as LinkIcon
} from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import giftEnvelope from '@/components/card/assets/giftEnvelope.svg'
import {ethers} from 'ethers'
import ShowCard from '@/components/card/ShowCard'
import baseIcon from '@/components/assets/base-logo.png'
import { ReactComponent as ChatBlueIcon } from '@/components/Footer/assets/chat-blue.svg'
import FeeInline from './payLinkFeeInline'
import { QRCodeCanvas } from 'qrcode.react'
import bIcon from '@/components/assets/32x32.svg'
import {fiatPrefix, formatTimeDetail, statusStyleMap, formatAmount} from '@/services/currency'
import PaymentReceipt from '@/pages/Pay/components/paymentReceipt'
import BeamioFee from './BeamioFee'
import FXDetail from './components/FXDetail'

type Mode = "pay" | "request" | 'cashcode'


type Props = {
	tx: TransferHistork
	localMode?: Mode
	onProfile?: (address: string) => void
	onSendAgain?: (tx: TransferHistork) => void
	onMessage?: (address: string) => void
}
const showPaylinkSite = 'https://beamio.app'
const shortHash = (h: string) => (h ? `${h.slice(0, 6)}…${h.slice(-4)}` : "")
const shortAddress = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "")


const displayName = (item: searchResult|undefined) => {
	if (!item) return ''
	const lastname = item?.last_name?.split('\r\n')||[]
	const fullName = `${item?.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}


function formatUSDC(v: number) {
	if (!isFinite(v)) return "0.0000"
	return v.toLocaleString("en-US", {
		minimumFractionDigits: 4,
		maximumFractionDigits: 4
	})
}

const getImg = (avatarSeed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

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


export function TransactionsItemDetail({
	tx,
	localMode = "pay",
	onProfile,
	onSendAgain,
	onMessage,
}: Props) {
	const isSponsored = true
	const timeText = useMemo(() => formatTimeDetail(tx.date), [tx.date])
	const [fromBeamio, setfromBeamio] = useState<searchResult|undefined> ()
	const {setUsdcbalance, usdcbalance, myAddress, setUsdcToUSD, beamioUsers, setbBeamioUsers, currencyData, profiles, setNavigateLeftButtonArray} = useDaemonContext()
	const [feeOpen, setFeeopen] = useState(false)
	const amountText = useMemo(() => formatUSDC(tx.amount), [tx.amount])
	const [payUrl, setPayUrl] = useState('')
	const [txDetail, setTxDetail] = useState<IRequestCurrencyDetail|undefined>(tx?.requestDetail)
	const [fxOpen, setFxOpen] = useState(false)
	const [userImg, setUserImg] = useState('')
	const [openReceipt, setOpenReceipt] = useState(false)
	
	

	const receivedCurrency = useMemo(() => {
		const detail = tx?.requestDetail
		if (!detail) return 'USDC'
		return detail.requestCurrency
	},[tx])

	const fiatText = useMemo(() => {
		return fiatPrefix (receivedCurrency)
	},[receivedCurrency])


	const AmountText = () => {
		
		const detail = tx?.requestDetail
		if (detail) {
			const kkk = tx.type === 'pending' ? detail.requestCurrencyAmount||0 : (tx.type === 'sent' ? detail.totalPayCurrency||0 : detail.receivedCurrency||0)
			const amt = formatAmount(kkk , receivedCurrency)
			return (
				<div className="flex items-baseline gap-2">
					<span
						className={[
						"text-[28px] leading-none font-semibold",
							amountColor,
						].join(" ")}
					>
						{fiatText}
					</span>
					<span
						className={[
						"text-[44px] leading-none font-semibold tracking-tight tabular-nums",
						amountColor,
						].join(" ")}
					>
						{amt}
					</span>

					
				</div>
			)
		}
		

		const amt = formatUSDC(tx.amount)
		const textColor = tx.type1 === 'sent' ? statusStyleMap['sent'].text : statusStyleMap['received'].text
		return (
			<div className="flex items-baseline gap-2">
				<span
					className={[
					"text-[44px] leading-none font-semibold tracking-tight tabular-nums",
					textColor,
					].join(" ")}
				>
					{amt}
				</span>

				<span
					className={[
					"text-[28px] leading-none font-semibold",
						textColor,
					].join(" ")}
				>
					USDC
				</span>
			</div>
		)
	}

	const d = tx?.requestDetail

	const [copied, setCopied] = useState(false)
	const [currency, setCurrency] = useState<ICurrency> ('USDC')
	
	const usdcUsd = useMemo(() => Number((currencyData as any)?.USDC ?? 1), [currencyData])
	const usdToCur = (c: ICurrency) => (c === "USD" ? 1 : Number((currencyData as any)?.[c] ?? 1))

	// ≈ $1.00：这里简单用 1:1 估算
	const currencyToUsdcAmount = (cur: number, c: ICurrency) => {
		const u2u = usdcUsd || 1
		const u2c = usdToCur(c) || 1
		if (!u2u || !u2c) return 0
		return cur / u2c / u2u
	}

	const txHashShort = useMemo(() => shortHash(tx.hash), [tx.hash])

	const successUrl = useMemo(() => {
		const params = new URLSearchParams({code: tx.hash}).toString()
		return `${showPaylinkSite}?${params}`
	}, [tx.hash])

	const approxFiatText = useMemo(() => {
		const d = tx?.requestDetail
		//		USDC 时不表示
		if (!d || tx.requestCurrency === 'USDC') return ''

		const am = tx.type1 === 'paid' ? d.totalPayUSDC :  tx.type === 'pending' ? d.requestUSDAmount ||0 : d.receivedUSDC
		return `${ am.toFixed(4)} USDC`
		

	}, [tx])

	const title = useMemo(() => {
		if (!d) return ''
		return d?.title
	}, [d])

	const note = useMemo(() => {
		if (!d) return ''
		return d?.textNote
	}, [d])

	const approxTip = useMemo(() => {
		
		const detail = tx?.requestDetail
		if (!detail || !tx?.requestCurrency || !detail?.currencyTip) return ''

		return `Tip: ${fiatPrefix(detail.requestCurrency)} ${formatAmount( detail.currencyTip, detail.requestCurrency)} ≈ ${ detail.USDCTip.toFixed(4)} USDC`
		

	}, [tx.amount, currency])


	const subtotal = useMemo(() => {
		if (!tx || !tx?.requestDetail) return 0
		const d = tx.requestDetail
		const requestAmount = tx.type === 'sent' ? d.totalPayCurrency : d.receivedCurrency
		
		return requestAmount
	}, [tx])


	const statusText: HistoryFilter = useMemo(() => {
		if (localMode === 'pay') {
			return tx.type
		}

		return tx.type
		
	}, [localMode])

	const style = statusStyleMap[statusText] ?? statusStyleMap.all

	const findingRef = useRef(false)
	const [showGiftCard, setShowGiftCard] = useState<IImageCard|null>(null)

	const cardSrc = tx?.card
	
	const findUser = useCallback(async () => {
		if (findingRef.current||!profiles) return
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
			const _currency1: ICurrency = tx?.card?.currency as ICurrency||tx?.requestDetail?.requestCurrency||_currency[1]||'USDC'
			setCurrency(_currency1)
			setUserImg(account.image||getImg(account.username))

			if (tx.type === 'pending') {
				if (tx.mode === 'request') {
					const showparams = new URLSearchParams({code: tx.hash}).toString()
					const showUrl = `${showPaylinkSite}?${showparams}`
					setPayUrl(showUrl)
					return
				}
				const codeString = tx.note.split('\r\n')
				const encryptedText = codeString[1]
				const profile: profile = profiles[0]
				if (encryptedText && tx?.redeemHash) {
					const _data = await aesGcmDecrypt(encryptedText, profile.privateKeyArmor)
					try {
						const data = JSON.parse(_data)
						const showparams = new URLSearchParams({cashcode: data.secureCode, secureCode:tx.redeemHash}).toString()
						const showUrl = `${showPaylinkSite}?${showparams}`
						setPayUrl(showUrl)
						console.log (data)
					} catch (ex: any) {
						console.log(`error`, ex.message)
						return
					}
				}


			}
		} finally {
			findingRef.current = false
		}

	}, [ beamioUsers, fromBeamio, setbBeamioUsers])

	useEffect(() => {
		findUser()
	}, [findUser])

	const amountColor = style.text
	
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
		<div className="pt-[calc(env(safe-area-inset-top)+2rem)]">
		{openReceipt && fromBeamio && (
			<div className=""> {/* mt-14 -> mt-10 */}
			<PaymentReceipt
				data={tx}
				open={true}
				onClose={() => setOpenReceipt(false)}
				fromBeamio={fromBeamio}
			/>
			</div>
		)}

		<div className="w-full rounded-3xl border-zinc-200"> {/* py-4 -> py-3 */}
			<div
				className="
					
					bg-white
					overflow-hidden
					text-[14px]  /* ✅ 全局字体小一号 */
				"
			>
			{!openReceipt && (
				<>
				{/** content 底部 + 2rem = 8 × 0.25rem */}
				<div className="pb-7"> {/* pb-8 -> pb-7 */}
					<div className="px-4 pt-4"> {/* px-5 pt-5 -> px-4 pt-4 */}
						
{/* 中部：时间 + 金额 + 对方信息 */}
<div className="mt-4 flex items-stretch justify-between gap-3">
  {/* 金额（左） */}
  <div className="min-w-0">
    <AmountText />
    <button
      type="button"
      onClick={() => setFxOpen(true)}
      className={[
        "mt-1.5",
        "inline-flex items-center gap-2",
        "text-[14px] text-slate-500",
        "rounded-md",
        "px-1 py-0.5",
        "hover:bg-slate-100 active:bg-slate-200",
        "transition",
      ].join(" ")}
      aria-label="FX details"
      title="FX details"
    >
      <span className="truncate text-left">{approxFiatText}</span>

      <span
        aria-hidden
        className="
          h-7 w-7
          rounded-full
          flex items-center justify-center
          shrink-0
        "
      >
        <Info className="h-4 w-4 text-yellow-500/90" strokeWidth={2} />
      </span>
    </button>
  </div>

  {/* 右侧：状态 + Receipt（整体在垂直方向向下对齐） */}
  <div className="flex flex-col justify-end self-stretch gap-3">
    {/* 顶部：状态 + Title + Gas sponsored */}
    <div className="relative flex items-center justify-between gap-3">
      {/* 左侧：状态 */}
      <div
        className={[
          "inline-flex items-center gap-2 rounded-full px-3 py-1",
          "bg-transparent border",
          style.container.replace("bg-", "border-"),
        ].join(" ")}
      >
        <span
          className={[
            "inline-flex h-5 w-5 items-center justify-center rounded-full",
            style.iconBg,
          ].join(" ")}
        >
          <Check className={["h-3.5 w-3.5", style.icon].join(" ")} strokeWidth={2.5} />
        </span>

        <span className={["text-[12px] font-semibold capitalize", style.text].join(" ")}>
          {statusText}
        </span>

        {localMode === "pay" && tx.mode !== "pay" && (
          <span
            className={[
              "inline-flex items-center justify-center",
              "w-6 h-6",
              tx.mode === "cashcode"
                ? "text-sky-600 dark:text-sky-300"
                : "text-fuchsia-600 dark:text-fuchsia-300",
            ].join(" ")}
          >
            {tx.mode === "cashcode" ? (
              <QrCode className="w-3.5 h-3.5" strokeWidth={2} />
            ) : (
              <LinkIcon className="w-3.5 h-3.5" strokeWidth={2} />
            )}
          </span>
        )}
      </div>

      {/* 右侧：Gas sponsored */}
      {/* {isSponsored ? (
        <div className="inline-flex items-center gap-2 text-[12px] text-blue-600">
          <ShieldCheck className="h-4 w-4 text-blue-700" strokeWidth={2.25} />
          <span>Gas sponsored</span>
        </div>
      ) : (
        <div className="w-[110px]" />
      )} */}
    </div>

    {/* iOS 透明水滴 · Receipt */}
    {tx.mode === "request" && (tx.type1 === "paid" || tx.type1 === "received") && (
      <button
        type="button"
        onClick={() => {
          setNavigateLeftButtonArray(prof => [
            ...prof,
            {
              title: "Receipt",
              action: [() => setOpenReceipt(false)],
            },
          ])
          setOpenReceipt(true)
        }}
        aria-label="Open receipt"
        title="Receipt"
        className="
          shrink-0 relative
          h-10 w-10
          rounded-full
          bg-white/30
          backdrop-blur-xl
          ring-2 ring-white/100
          transition
          active:scale-[0.96]
          hover:bg-white/40
          flex items-center justify-center
          text-[rgb(0_122_255)]
        "
      >
        <span
          aria-hidden
          className="
            pointer-events-none
            absolute inset-[3px]
            rounded-full
            bg-gradient-to-b
            from-white/80
            to-white/10
          "
        />
        <Receipt className="relative h-5 w-5" />
      </button>
    )}
  </div>
</div>

						{/* 收款人/对方信息 */}
						{tx.type !== "pending" && (
							<div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
								<div className="flex items-center justify-between gap-3">
								
								{/* 左侧：头像 + 信息 */}
								<div className="flex items-center gap-3 min-w-0">
									<div className="h-16 w-16 rounded-full flex items-center justify-center text-white font-semibold">
									{fromBeamio?.username !== "Unknow" ? (
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
											text-[14px]
										"
										aria-label="Default avatar"
										>
										?
										</div>
									)}
									</div>

									<div className="min-w-0">
									<div className="text-[15px] font-semibold text-slate-900 truncate">
										{tx.type === 'sent'
										? `To ${displayName(fromBeamio)}`
										: tx.type === 'received'
										? `From ${displayName(fromBeamio)}`
										: ''}
									</div>
									<div className="text-[12px] text-slate-500 truncate">
										@{fromBeamio?.username} {fmtAddr(tx.address)}
									</div>
									<div className="text-[12px] text-slate-500 truncate">
										{timeText}
									</div>
									</div>
								</div>

								{/* ✅ 右侧：时间（右对齐 + 垂直居中） */}
								

								</div>
							</div>
							)}

						{/* Note */}

						{
						title && (
							
								<div className="pt-4 pb-3">
									<div className="text-[16px] font-extrabold text-slate-900">{title}</div>
								</div>

							
						)
					}

					
										
						{
							note && 
								<div className="mt-4 pb-4">
									<div
										className="
										rounded-2xl
										bg-yellow-50/60
										backdrop-blur-sm
										ring-1 ring-yellow-200/40
										px-4 py-3
										"
									>
										<div className="flex items-start gap-2 text-[14px] leading-relaxed">
										<span className="shrink-0 text-yellow-700/60 font-medium">
											Note
										</span>

										<span className="text-slate-700 break-words">
											{note}
										</span>
										</div>
									</div>
								</div>
						}

						{/* Card image preview */}
						<div className="mt-3 rounded-2xl overflow-hidden flex justify-center"> {/* mt-4 -> mt-3 */}
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
											w-12   /* w-14 -> w-12 */
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
						
						<div className="mt-3 rounded-2xl border border-slate-100 overflow-hidden"> {/* mt-4 -> mt-3 */}

							{
								tx.mode !== 'pay' && tx.type !== 'pending' && (<>
								{/* Breakdown */}
								<div className="px-5 py-4 bg-white">
									<div className="text-[15px] font-semibold text-slate-900 mb-3">
										Breakdown
									</div>

									<div className="space-y-2">
									{/* Subtotal */}
									<div className="flex items-center justify-between">
										<span className="text-[14px] text-slate-500">
											Subtotal
										</span>
										<span className="text-[15px] font-semibold text-slate-900">
											{fiatText} {formatAmount(subtotal, receivedCurrency)} 
										</span>
									</div>

									{/* Tax */}
									<div className="flex items-center justify-between">
										<span className="text-[14px] text-slate-500">
											Tax
										</span>
										<span className="text-[15px] font-semibold text-slate-900">
											{fiatText} {formatAmount(tx?.requestDetail?.taxCurrency||0, receivedCurrency)}
										</span>
									</div>

									{/* Tip */}
									<div className="flex items-center justify-between">
										<span className="text-[14px] text-slate-500">
											Tip
										</span>
										<span className="text-[15px] font-semibold text-slate-900">
											{fiatText} {formatAmount(tx?.requestDetail?.currencyTip||0, receivedCurrency)}
										</span>
									</div>
									</div>
								</div>

							{/* Divider */}
							<div className="h-px bg-slate-100" />
							{
								tx?.requestDetail && tx.type1 === 'received' && <BeamioFee
									grossUSDC={tx.requestDetail.totalPayUSDC||0}
									feeUSDC={tx.requestDetail.feeUSDC||0}
									netUSDC={tx.requestDetail.receivedUSDC||0}
								/>
							}
							

								</>)
							}
							

							
							{/* Network fee */}
							{
								tx.type !== "pending" && (
									<>
										<div className="h-px bg-slate-100" />

											<div className="flex items-center justify-between px-5 py-2.5 bg-white"> {/* py-3 -> 2.5 */}
												<span className="text-[14px] text-slate-500">Network fee</span>

													<div className="flex flex-col items-end">
														<div
															className={[
																"inline-flex items-center gap-2",
																"h-9 px-3 rounded-full",
																"bg-blue-50",
																"ring-1 ring-blue-200/70",
																"text-blue-600",
																"font-semibold text-[14px]",
																"shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
																"flex-shrink-0",
																"min-w-0"
															].join(" ")}
															>
															<Sparkles className="w-5 h-5 shrink-0" />
															<span className="inline max-w-[110px] truncate">
																Sponsored
															</span>
														</div>

														{/* {isSponsored && (
														<span className="text-[12px] text-[rgb(0_122_255)] leading-tight">
															Sponsored By @{fromBeamio?.username}
														</span>
														)} */}
													</div>
											</div>
									</>
								)
							}
							

							<div className="h-px bg-slate-100" />

							{/* {(tx.type === "received" || tx.type === "completed" || tx.type === "pending") && tx.requestCurrency && (
							<div
								className={[
								"flex items-center px-4 py-2.5 bg-white",
								feeOpen ? "justify-center" : "justify-between",
								].join(" ")}
							>
								{!feeOpen && <span className="text-[14px] text-slate-500">Beamio Fee</span>}

								<div className={["flex items-center", feeOpen ? "w-full justify-center" : "gap-3"].join(" ")}>
								<div className={feeOpen ? "w-full" : ""}>
									<FeeInline
									payUsdc={tx.type === "pending" ? currencyToUsdcAmount(tx.amount, tx.requestCurrency) : tx.preAmount}
									currentCurrency={tx.requestCurrency}
									detailOpen={val => setFeeopen(val)}
									txDetail={txDetail}
									/>
								</div>
								</div>
							</div>

							
							)} */}


							{
								tx.type !== "pending" ? (
									<div className="px-5 py-3 flex items-center justify-between gap-3">
										<div className="text-[14px] text-slate-500">Tx hash</div>

										<div className="flex items-center gap-2">
											<div className="text-[14px]  text-slate-900 tabular-nums">{txHashShort || "—"}</div>

												<button
													type="button"
													onClick={async () => {
													try {
														await navigator.clipboard.writeText(tx.hash || "")
														setCopied(true)
														window.setTimeout(() => setCopied(false), 900)
													} catch {}
													}}
													className={`
														w-6 h-6 rounded-full flex items-center justify-center
														transition-colors duration-150
														${copied ? "bg-emerald-500" : "bg-black/20"}   /* ⬅️ 同样改为黑色透明度 */
													`}
													aria-label="Copy tx hash"
													title={copied  ? "Copied" : "Copy"}
												>
													{copied ? (
														<Check className="w-3.5 h-3.5 text-white" strokeWidth={2} />
													) : (
														<Copy className="w-3.5 h-3.5 text-white/95" strokeWidth={2} />
													)}
												</button>
												{/* Open icon button */}
												<button
													type="button"
													onClick={() => {
														if (!tx.hash) return
														window.open(`https://basescan.org/tx/${tx.hash}`, '_blank', 'noopener,noreferrer')
														
													}}
													className="
														w-6 h-6 rounded-full
														flex items-center justify-center
														bg-slate-200/70 text-slate-700 
														dark:bg-slate-800/80 dark:text-slate-200
														hover:bg-slate-300/80 dark:hover:bg-slate-700
														transition
													"
													title="Open link"
												>
													<ExternalLink className="w-3.5 h-3.5" />
												</button>
										</div>
									</div>
								) : (
									<div className="mt-3 overflow-hidden flex flex-col items-center gap-3">
										<div
										className="
										rounded-[28px]
										bg-white
										p-[18px]
										shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]
										"
									>
										<QRCodeCanvas
											value={payUrl}
											size={160}
											level="H"
											includeMargin
											bgColor="transparent"
											fgColor="#000000"
											imageSettings={{
												src: bIcon,
												height: 40,
												width: 40,
												excavate: true,
											}}
											className="rounded-lg inline-block"
										/>
										</div>
										<div className="px-4 py-3 flex items-center justify-between gap-3">
										<div className="text-[14px] text-slate-500">Url</div>

										<div className="flex items-center gap-2">
											<div className="text-[14px] font-extrabold text-slate-900 tabular-nums truncate max-w-[220px]">
											{payUrl}
											</div>

												<button
													type="button"
													onClick={async () => {
													try {
														await navigator.clipboard.writeText(payUrl)
														setCopied(true)
														window.setTimeout(() => setCopied(false), 900)
													} catch {}
													}}
													className={`
														w-6 h-6 rounded-full flex items-center justify-center
														transition-colors duration-150
														${copied ? "bg-emerald-500" : "bg-black/20"}   /* ⬅️ 同样改为黑色透明度 */
													`}
													aria-label="Copy tx hash"
													title={copied  ? "Copied" : "Copy"}
												>
													{copied ? (
														<Check className="w-3.5 h-3.5 text-white" strokeWidth={2} />
													) : (
														<Copy className="w-3.5 h-3.5 text-white/95" strokeWidth={2} />
													)}
												</button>
												
										</div>
									</div>
									</div>
								)
							}
							
						</div>

						{/* On Base · Tx / Pending Url */}
						{/* 这里你可以继续用同样套路：mt-4 -> mt-3, text-15 -> 14, py-3 -> 2.5 */}
					              
					</div>

					{/* 底部按钮 */}
					{false && (
					<div className="px-4 pb-4 pt-4"> {/* px-5 pb-5 pt-5 -> 4 */}
						<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => onSendAgain?.(tx)}
							className="
							flex-1 h-11   /* h-12 -> h-11 */
							rounded-2xl
							bg-blue-600 hover:bg-blue-700
							text-white
							font-semibold
							flex items-center justify-center gap-2
							shadow-sm
							active:scale-[0.99]
							transition
							text-[14px] /* ✅ 按钮文字更紧 */
							"
						>
							<Repeat2 className="h-5 w-5" />
							<span>{tx.type === "sent" || tx.type === "paid" ? "Send again" : "Send back"}</span>
						</button>

						<button
							type="button"
							onClick={() => onMessage?.(tx.address)}
							className="
							flex-1 h-11
							rounded-2xl
							border border-slate-200
							bg-white
							font-semibold text-slate-900
							flex items-center justify-center gap-2
							active:scale-[0.99] transition
							text-[14px]
							"
						>
							<ChatBlueIcon className="h-5 w-5 text-slate-600" /> {/* 6->5 更紧 */}
							<span>Message</span>
						</button>
						</div>
					</div>
					)}
				</div>
				</>
			)}
			</div>
		</div>

		{showGiftCard && (
			<ShowCard
				card={showGiftCard}
				address={tx.address}
				usdcAmount={amountText}
				cancel={() => {
					setShowGiftCard(null)
				}}
			/>
		)}

		<FXDetail
			open={fxOpen}
			onClose={() => setFxOpen(false)}
			fiatCurrency={tx.requestDetail?.requestCurrency||'USDC'}
			usdcToFiatRate={tx.requestDetail?.rate||0}
			quotedAt={tx.date}
		/>
		</div>
	)
}
