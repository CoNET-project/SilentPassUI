import { IpfsImg } from '@/components/IpfsImg';
import { useEffect, useMemo, useState, useRef } from "react"
import { Copy, Check, MessageCircle, Share2, Plus, Wallet, CreditCard } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { ethers } from "ethers"
import AmountCurrency from '@/components/input/AmountCurrency'
import { fiatPrefix, formatAmount } from '@/services/currency'
import {AuthorizationSign, getBalanceProcess, generateCODE, generateRequestHash} from '@/services/beamio'
import { postToEndpoint } from '@/utils/utils'
import { BIZ_PUBLIC_LOGO512 } from '@/pages/Home/brandUi'
import { QRCodeCanvas } from 'qrcode.react'
import PaymentLink from './PaymentLink'
import {ShowPrint} from './ShowPrint'
import { motion, useMotionValue, animate } from 'framer-motion'
import { QrCode, Link } from 'lucide-react'
import { BeamioSegmentedDrag } from './components/beamioSegmented'
import type { OpenContainerRelayPayload } from '@/services/AAaccount'
import { X } from 'lucide-react'
import ShowPayQR from '@/pages/Vouchers/showPayQR'

const showPaylinkSite = 'https://beamio.app'
/** 0.8% fee, min 0.02, max 2 USDC */
const calcFeeUsdc = (amountUsdc: number) => {
	if (!isFinite(amountUsdc) || amountUsdc <= 0) return 0
	const raw = amountUsdc * 0.008
	return Number((Math.min(Math.max(raw, 0.02), 2)).toFixed(4))
}
const getImg = (avatarSeed: string|undefined) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed || '@Beamio').toString()}`
const shortAddress = (addr: string) =>
	addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''
type Mode = 'main' | 'PaymentLink'|'Print'

const aptEndpoint = 'https://api.settleonbase.xyz'
type BeamioPayMeProps = {

	// tab 控制（如果你需要外部路由）
	activeTab?: Mode
	showActiveTab?: boolean
	/** Smart Account 发行的 3 分钟 Open Relay 签名，在此页展示 */
	relayPayload?: OpenContainerRelayPayload | null
	/** 从弹窗关闭时回调（如从 MyWalletDashboard 底部 sheet 打开） */
	onClose?: () => void
	/** 是否隐藏 displayName 和 @accountName */
	hideName?: boolean
	/** 是否隐藏主卡片外框（shadow/ring），用于底部滑出面板等嵌入场景 */
	hideOuterFrame?: boolean
}

const displayName = (item: beamio|null) => {
	if (!item) return ''
	const lastname = item.lastName?.split('\r\n')||[]
	const fullName = `${item.firstName || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.accountName || item.address
}

export default function BeamioPayMe(props: BeamioPayMeProps) {
  const {
    activeTab = "main",
	showActiveTab = true,
	relayPayload = null,
	onClose,
	hideName = false,
	hideOuterFrame = false
  } = props

	const [copied, setCopied] = useState(false)
	const [copiedSig, setCopiedSig] = useState(false)
		useEffect(() => {
		if (!copied) return
		const t = window.setTimeout(() => setCopied(false), 3000)
		return () => window.clearTimeout(t)
	}, [copied])
	useEffect(() => {
		if (!copiedSig) return
		const t = window.setTimeout(() => setCopiedSig(false), 3000)
		return () => window.clearTimeout(t)
	}, [copiedSig])

	const onCopyPayLink = async () => {
		const ok = await copyText(qrValue)
		if (ok) setCopied(true)
	}

	const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [getBeamio, setGetBeamio] = useState<beamio|null>(null)
	const [showMode, setShowMode] = useState<Mode>(activeTab)
	const [isUSDC, setIsUSDC] = useState(true)
	/** 是否展开金额输入：false 显示「输入金额」按钮，true 显示 AmountCurrency + 完成 */
	const [showAmountInput, setShowAmountInput] = useState(false)
	/** 指定金额的 paymentUrl（类似 TenKeyInput 的 bill），为 null 时 QR 显示 successUrl（任意金额） */
	const [billPaymentUrl, setBillPaymentUrl] = useState<string | null>(null)
	/** 请求金额（所选 currency 的原生数量，不换算 USDC） */
	const [billAmount, setBillAmount] = useState("")
	const [billCurrency, setBillCurrency] = useState<ICurrency>('USD')
	const [billForText, setBillForText] = useState("")
	const [billValidDaysInput, setBillValidDaysInput] = useState('1')
	const billValidDays = billValidDaysInput === '' ? 1 : Math.max(1, parseInt(billValidDaysInput, 10) || 1)
	const [amountError, setAmountError] = useState("")
	/** 记账状态：idle | loading | success | error；成功时 syncTx 为 CoNET 链 hash */
	const [accountingStatus, setAccountingStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
	const [accountingSyncTx, setAccountingSyncTx] = useState<string | null>(null)
	/** 收款地址显示：'aa' 优先 AA，'eoa' 为 EOA；有 AA 时点击胶囊可切换 */
	const [receivingMode, setReceivingMode] = useState<'aa' | 'eoa'>('aa')

	
  const {profiles, setUsdcbalance, usdcbalance, myAddress, setUsdcToUSD, usdcToUSD, setMyAddress, setShowFooter, currencyData, beamio, setBeamio} = useDaemonContext()
	const merchantAA = profiles?.[0]?.aaAccount
	/** 任意金额收款链接：含 wallet= 随 receivingMode 切换 */
	const successUrl = useMemo(() => {
		if (!beamio?.accountName) return ''
		const params = new URLSearchParams({ beamio: beamio.accountName })
		const walletAddr = (receivingMode === 'aa' && merchantAA && ethers.isAddress(merchantAA)) ? merchantAA : (myAddress && ethers.isAddress(myAddress) ? myAddress : null)
		if (walletAddr) params.set('wallet', walletAddr)
		return `${showPaylinkSite}?${params.toString()}`
	}, [beamio?.accountName, receivingMode, merchantAA, myAddress])
	const qrValue = billPaymentUrl ?? successUrl
	const handleDoneAmount = () => {
		const amt = Number(billAmount)
		if (!amt || amt <= 0) {
			setAmountError("Please enter a valid amount")
			return
		}
		const toAddress = (receivingMode === 'aa' && merchantAA && ethers.isAddress(merchantAA)) ? merchantAA : myAddress
		if (!toAddress || !ethers.isAddress(toAddress)) {
			setAmountError("No receiving address found")
			return
		}
		setAmountError("")
		setAccountingStatus('loading')
		setAccountingSyncTx(null)
		const requestHash = generateRequestHash()
		const params = new URLSearchParams({
			Amount: billAmount,
			currency: billCurrency,
			acceptTokens: 'USDC,CCSA',
			to: toAddress,
			wallet: toAddress,
			requestHash,
		})
		if (billForText.trim()) params.set('forText', billForText.trim())
		if (billValidDays >= 1) params.set('validDays', String(Math.floor(billValidDays)))
		const url = `https://beamio.app/Vouchers?${params.toString()}`
		setBillPaymentUrl(url)
		setShowAmountInput(false)
		postToEndpoint<{ success?: boolean; indexed?: boolean; syncTx?: string }>(`${showPaylinkSite}/api/requestAccounting`, true, {
			requestHash,
			payee: toAddress,
			amount: billAmount,
			currency: billCurrency,
			forText: billForText.trim() || undefined,
			validDays: Math.max(1, Math.floor(billValidDays)),
		})
			.then((res) => {
				if (res && typeof res === 'object' && res.indexed && res.syncTx) {
					setAccountingStatus('success')
					setAccountingSyncTx(res.syncTx)
				} else {
					setAccountingStatus('error')
				}
			})
			.catch(() => {
				setAccountingStatus('error')
			})
	}
	useEffect(() => {
		if (!beamio||getBeamio||!profiles?.length) return
		setGetBeamio({...beamio})
	}, [])


  const copyText = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t)
      return true
    } catch {
      try {
        const ta = document.createElement("textarea")
        ta.value = t
        ta.style.position = "fixed"
        ta.style.left = "-9999px"
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        const ok = document.execCommand("copy")
        document.body.removeChild(ta)
        return ok
      } catch {
        return false
      }
    }
  }

  

  const onMessage = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Beamio PayMe", text: qrValue, url: qrValue })
        return
      } catch {
        // ignore
      }
    }
    await copyText(qrValue)
  }

  const onShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Beamio PayMe", text: qrValue, url: qrValue })
        return
      } catch {
        // ignore
      }
    }
    await copyText(qrValue)
  }

  return (
    <div className="flex justify-center min-h-0">
      <div className="w-full max-w-[540px] px-3 sm:px-4 py-0 pb-2 relative">

        {/* Segmented */}
		{
			showActiveTab && <BeamioSegmentedDrag
				value={showMode}
				onChange={val => {
					setShowMode(val)
				}}
			/>
		}
			

        {/* Main Card：有 relayPayload 时用带倒计时的 ShowPayQR */}
        {
				showMode === 'main' && relayPayload ? (
					<ShowPayQR
						successUrl={successUrl}
						beamio={beamio}
						qrValue={JSON.stringify({ ...relayPayload, validBefore: relayPayload.deadline })}
						hideActions
						hideUrl
						hideName={hideName}
					/>
				) : showMode === 'main' && (
				<div className={hideOuterFrame ? " overflow-hidden" : "mt-1 sm:mt-2 rounded-[22px] bg-white shadow-[0_12px_35px_rgba(15,23,42,0.08)] ring-1 ring-black/10 overflow-hidden"}>
					<div className="px-3 sm:px-6 pt-1 sm:pt-4 pb-2 sm:pb-6">
					<div className="text-center">
						{!hideName && (
							<div className="flex flex-col items-center gap-0">
								<IpfsImg
									src={beamio?.image || getImg(beamio?.accountName)}
									alt=""
									className="w-10 h-10 sm:w-14 sm:h-14 rounded-full object-cover ring-2 ring-slate-200 dark:ring-slate-600 shrink-0"
								/>
								<div className="text-center mt-0.5 sm:mt-0">
									<div className="text-[16px] sm:text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-slate-100 truncate max-w-[180px] sm:max-w-[240px] leading-tight">
										{displayName(beamio)}
									</div>
									<div className="text-[13px] sm:text-[16px] font-semibold text-beamio">
										@{beamio?.accountName}
									</div>
								</div>
							</div>
						)}
						</div>

						{/* 收款钱包 - 优先 AA，无则 EOA；有 AA 时胶囊整体可点击切换 */}
						{!showAmountInput && (() => {
							const showAA = receivingMode === 'aa' && merchantAA && ethers.isAddress(merchantAA)
							const displayAddr = showAA ? merchantAA : myAddress
							const canToggle = !!(merchantAA && ethers.isAddress(merchantAA) && myAddress && ethers.isAddress(myAddress))
							const label = showAA ? 'Express Pay (Smart Account)' : 'Main Vault (EOA)'
							const content = (
								<>
									<span className="text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase mr-2 self-center">
										{label}
									</span>
									{displayAddr && (
										<span className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${showAA ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'}`}>
											{showAA ? <CreditCard className="w-4 h-4 shrink-0" strokeWidth={2.2} /> : <Wallet className="w-4 h-4 shrink-0" strokeWidth={2.2} />}
											{shortAddress(displayAddr)}
										</span>
									)}
								</>
							)
							return (
								<div className="mt-2 sm:mt-4 flex justify-center">
									{canToggle ? (
										<button
											type="button"
											onClick={() => setReceivingMode(prev => prev === 'aa' ? 'eoa' : 'aa')}
											className="flex items-center cursor-pointer hover:opacity-90 active:scale-[0.98] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:focus-visible:ring-violet-500 rounded-lg"
										>
											{content}
										</button>
									) : (
										<div className="flex items-center">{content}</div>
									)}
								</div>
							)
						})()}

						{/* QR Card - 金额输入展开时隐藏，小屏紧凑 */}
						{!showAmountInput && (
							<div className="mt-1.5 sm:mt-3 flex justify-center">
							<div className="relative isolate">
								{/* glow：强制放到最底层 */}
								<div
								aria-hidden
								className="
									absolute inset-[-8px] sm:inset-[-12px]
									-z-10
									rounded-[28px] sm:rounded-[36px]
									bg-[radial-gradient(60%_60%_at_50%_40%,rgba(132,120,255,0.18),rgba(132,120,255,0.05)_60%,transparent_75%)]
									blur-xl
									pointer-events-none
								"
								/>

								{/* QR 白底板：小屏 200px，大屏 264px */}
								<div className="relative z-10 flex justify-center">
									<div
										className="
										rounded-[20px] sm:rounded-[28px]
										bg-white
										p-2 sm:p-[18px]
										shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]
										"
									>
										<QRCodeCanvas
											value={qrValue}
											size={180}
											level="H"
											includeMargin={false}
											bgColor="white"
											fgColor="#000000"
											imageSettings={{
												src: BIZ_PUBLIC_LOGO512,
												height: 56,
												width: 56,
												excavate: true,
											}}
											className="block"
										/>
									</div>
								</div>
								
								{/* <div className="mt-6 text-center">
									<div className="mt-3 text-[18px] font-semibold text-slate-500">
										Scan to pay (Any amount)
									</div>
								</div> */}
								{/* <TaxSwitch value={isUSDC} onChange={setIsUSDC} taxRate={getBeamio?.tax ? Number(getBeamio.tax):0} /> */}
							</div>
							</div>
						)}

						{/* 费率计算卡片：指定金额时显示在 QR 下方，Requesting 使用用户输入的 currency */}
						{billPaymentUrl && billAmount && (() => {
							const amtOrig = Number(billAmount)
							const usdcRate = Number(currencyData?.USDC) ?? 1
							const usdToCur = billCurrency === 'USDC' ? 1 : (Number((currencyData as any)?.[billCurrency]) ?? 1)
							const amt = billCurrency === 'USDC' ? amtOrig : amtOrig / (usdToCur * usdcRate)
							const fee = calcFeeUsdc(amt)
							const estReceive = amt - fee
							const usdcToUSD = Number(currencyData?.USDC) ?? 1
							const usdToFiat = billCurrency === 'USDC' ? 1 : (Number((currencyData as any)?.[billCurrency]) ?? 1)
							const requestingDisplay = billCurrency === 'USDC'
								? `${formatAmount(amtOrig, 'USDC')} USDC`
								: `${fiatPrefix(billCurrency)} ${formatAmount(amtOrig, billCurrency)}`
							return (
								<div className="mt-2 sm:mt-6 rounded-2xl bg-white dark:bg-slate-800/80 shadow-sm ring-1 ring-slate-200 dark:ring-slate-600 overflow-hidden">
									<div className="px-3 sm:px-4 py-2 sm:py-2.5 space-y-1 sm:space-y-1.5">
										<div className="flex justify-between items-center">
											<span className="text-slate-500 dark:text-slate-400 text-sm">Requesting</span>
											<span className="font-semibold text-slate-900 dark:text-slate-100">{requestingDisplay}</span>
										</div>
										<div className="flex justify-between items-center">
											<span className="text-slate-500 dark:text-slate-400 text-sm">Fee (0.8%)</span>
											<span className="text-slate-500 dark:text-slate-400">- {formatAmount(fee, 'USDC')} USDC</span>
										</div>
										<div className="border-t border-slate-200 dark:border-slate-600 pt-2">
											<div className="flex justify-between items-start">
												<span className="font-semibold text-green-600 dark:text-green-400 text-sm">Est. Receive</span>
												<div className="text-right">
													<span className="font-semibold text-green-600 dark:text-green-400">{formatAmount(estReceive, 'USDC')} USDC</span>
													{billCurrency !== 'USDC' && currencyData?.USDC != null && currencyData?.[billCurrency] != null && (() => {
														const estReceiveFiat = estReceive * usdcToUSD * usdToFiat
														return (
															<div className="text-xs text-slate-500 dark:text-slate-400 mt-0">
																≈ {fiatPrefix(billCurrency)} {formatAmount(estReceiveFiat, billCurrency)}
															</div>
														)
													})()}
												</div>
											</div>
										</div>
										{accountingStatus !== 'idle' && (
											<div className="border-t border-slate-200 dark:border-slate-600 pt-2">
												<div className="flex justify-between items-center">
													<span className="text-slate-500 dark:text-slate-400 text-sm">Recorded</span>
													{accountingStatus === 'loading' && (
														<span className="text-amber-600 dark:text-amber-400 text-sm animate-pulse">Recording…</span>
													)}
													{accountingStatus === 'success' && accountingSyncTx && (
														<a
															href={`https://mainnet.conet.network/tx/${accountingSyncTx}`}
															target="_blank"
															rel="noopener noreferrer"
															className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium truncate max-w-[180px] sm:max-w-[220px]"
															title={accountingSyncTx}
														>
															{accountingSyncTx.slice(0, 10)}…{accountingSyncTx.slice(-8)}
														</a>
													)}
													{accountingStatus === 'error' && (
														<span className="text-slate-400 dark:text-slate-500 text-xs">Failed to record</span>
													)}
												</div>
											</div>
										)}
									</div>
								</div>
							)
						})()}

						{/* 输入金额：按钮区上方；收款账号为 EOA 时不展示 Set Specific Amount */}
						{!billPaymentUrl && receivingMode === 'aa' && merchantAA && ethers.isAddress(merchantAA) && (
							<div className="mt-3 sm:mt-10">
								{!showAmountInput ? (
									<button
										type="button"
										onClick={() => setShowAmountInput(true)}
										className="w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-blue-600 dark:text-blue-400 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-sky-200 dark:hover:bg-sky-900/60 transition-colors"
									>
										<Plus className="w-5 h-5" strokeWidth={2.5} />
										Set Specific Amount
									</button>
								) : (
									<div className="space-y-1.5 sm:space-y-2">
										<AmountCurrency
											amount={billAmount}
											setAmount={setBillAmount}
											autoEntry={true}
											readOnly={false}
											showLimit={0}
											sendError={amountError}
											setSendError={setAmountError}
											showMax={false}
											needBalance={false}
											currencyChange={setBillCurrency}
											outputNativeCurrency
										/>
										<input
											type="text"
											value={billForText}
											onChange={(e) => setBillForText(e.target.value.replace(/[\r\n]/g, ''))}
											onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
											placeholder="What's this for?"
											className="w-full rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600"
										/>
										<div className="flex items-center gap-2">
											<label htmlFor="billValidDays" className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Valid for</label>
											<input
												id="billValidDays"
												type="number"
												min={1}
												step={1}
												value={billValidDaysInput}
												onChange={(e) => {
													const v = e.target.value
													if (v === '') {
														setBillValidDaysInput('')
														return
													}
													const n = parseInt(v, 10)
													if (!Number.isNaN(n) && n >= 0) setBillValidDaysInput(String(Math.floor(n)))
												}}
												onBlur={() => {
													if (billValidDaysInput === '' || parseInt(billValidDaysInput, 10) < 1) setBillValidDaysInput('1')
												}}
												className="w-20 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-300 dark:focus:ring-sky-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
											/>
											<span className="text-sm text-slate-500 dark:text-slate-400">days</span>
										</div>
										<button
											type="button"
											onClick={handleDoneAmount}
											className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-[var(--beamio-brand,#2F78FF)] text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition"
										>
											Generate request
										</button>
									</div>
								)}
							</div>
						)}

						{/* Actions - 金额输入期间隐藏，Copy 左 Share 右，图标在文字左侧 */}
						{!showAmountInput && (
						<div className="mt-3 sm:mt-10 flex gap-2 sm:gap-3">
							<button
								type="button"
								onClick={onCopyPayLink}
								className={[
									"flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-semibold text-sm",
									"bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
									"hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition",
									copied ? "ring-2 ring-blue-400" : ""
								].join(" ")}
							>
								{copied ? (
									<Check className="w-5 h-5 text-blue-600 shrink-0" />
								) : (
									<Copy className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0" />
								)}
								<span>Copy</span>
							</button>
							<button
								type="button"
								onClick={onShare}
								className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-semibold text-sm bg-black dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 active:scale-[0.98] transition"
							>
								<Share2 className="w-5 h-5 shrink-0" />
								<span>Share</span>
							</button>
						</div>
						)}

					</div>
					</div>
			)
		}
		{
			showMode === 'PaymentLink' && (
				<PaymentLink close={() => setShowMode('main')} />
			)
		}
		
      </div>
	  
	  {showMode === 'Print' && (
			<ShowPrint
				title="Your Beamio QR Kit"
				merchantName={displayName(beamio) || "Demo"}
				handle={`@${beamio?.accountName || "BeamioDemo"}`}
				payTitle="Beamio PayMe"
				paySubtitle="USDC · Any amount"
				payLink={successUrl}
				qrValue={successUrl}
				onDone={() => setShowMode('main')}
				onBack={() => setShowMode('main')}
				onPrint={() => window.print()}
			/>
		)}
		
    </div>
  )
}
