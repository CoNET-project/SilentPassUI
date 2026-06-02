import { IpfsImg } from '@/components/IpfsImg';
import { useEffect, useMemo, useState, useRef } from "react"
import { Copy, Check, MessageCircle, Share2, Plus, Wallet, CreditCard, Loader, XCircle, Fuel } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { ethers } from "ethers"
import AmountCurrency from '@/components/input/AmountCurrency'
import { fiatPrefix, formatAmount } from '@/services/currency'
import {AuthorizationSign, getBalanceProcess, generateCODE, generateRequestHash} from '@/services/beamio'
import { getBUnitBalanceFromConetRpc } from '@/services/BeamioCard'
import { baseEndpoint } from '@/utils/constants'
import bIcon from '@/components/assets/logo512.png'
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
/** B-Unit fee: 0.8% of amount in USDC, 100 B-Units = 1 USDC. Min 2, max 200 B-Units; >=5000 USDC → 500 B-Units */
const calcFeeBUnits = (amountUsdc: number) => {
	if (!isFinite(amountUsdc) || amountUsdc <= 0) return 0
	if (amountUsdc >= 5000) return 500
	const raw = Math.ceil(amountUsdc * 0.8)
	return Math.min(Math.max(raw, 2), 200)
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
	/** B-Unit 不足时点击「Go to Fuel Center」的回调，用于跳转显示 Fuel Center 供用户 topup */
	onShowFuelCenter?: () => void
	/**
	 * 嵌入 Receive 底栏等：不展示 EOA 切换，仅使用 Smart Account（无 AA 时仍用 EOA 地址与链接，但不出现「Main Vault (EOA)」选项）
	 */
	hideEoaReceivingToggle?: boolean
	/** 嵌入场景：不展示「Express Pay (Smart Account)」/「Main Vault (EOA)」标题行，仅保留地址胶囊 */
	hideReceivingWalletHeading?: boolean
	/** Home Receive 等：主操作/次操作按钮使用 CashTrees 青柠绿，与全站主色一致 */
	receivePanelLimeButtons?: boolean
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
	hideOuterFrame = false,
	onShowFuelCenter,
	hideEoaReceivingToggle = false,
	hideReceivingWalletHeading = false,
	receivePanelLimeButtons = false,
  } = props

	const limePrimaryBtn =
		'w-full rounded-xl border border-[#96EB3C]/50 bg-gradient-to-r from-[#8AE131] to-[#67AD0F] py-2.5 px-4 font-semibold text-sm text-gray-900 shadow-sm transition hover:opacity-95 active:scale-[0.98] sm:py-3 dark:border-[#65A30D]/40 dark:from-[#6fb828] dark:to-[#4f9410]'
	const defaultPrimaryBtn =
		'w-full rounded-xl bg-[var(--beamio-brand,#2F78FF)] py-2.5 px-4 font-semibold text-sm text-white transition hover:opacity-90 active:scale-[0.98] sm:py-3'
	const limeSecondaryBtn =
		'flex w-full items-center justify-center gap-2 rounded-xl bg-[#96EB3C]/25 px-3 py-2.5 font-semibold text-sm text-[#3f6212] transition hover:bg-[#96EB3C]/35 active:scale-[0.98] sm:px-4 sm:py-3 dark:bg-[#65A30D]/20 dark:text-[#BEF264] dark:hover:bg-[#65A30D]/30'
	const defaultSecondaryBtn =
		'w-full rounded-xl bg-sky-100 px-3 py-2.5 font-semibold text-sm text-blue-600 transition-colors hover:bg-sky-200 sm:px-4 sm:py-3 dark:bg-sky-900/40 dark:text-blue-400 dark:hover:bg-sky-900/60'
	const limeShareBtn =
		'flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#96EB3C]/50 bg-gradient-to-r from-[#8AE131] to-[#67AD0F] py-2.5 px-3 font-semibold text-sm text-gray-900 shadow-sm transition hover:opacity-95 active:scale-[0.98] sm:gap-2 sm:px-4 sm:py-3 dark:border-[#65A30D]/40 dark:from-[#6fb828] dark:to-[#4f9410]'
	const defaultShareBtn =
		'flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-black py-2.5 px-3 font-semibold text-sm text-white transition hover:opacity-90 active:scale-[0.98] sm:gap-2 sm:px-4 sm:py-3 dark:bg-slate-100 dark:text-slate-900'

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
	/** 等待服务器确认的 paymentUrl；成功后才写入 billPaymentUrl */
	const [pendingPaymentUrl, setPendingPaymentUrl] = useState<string | null>(null)
	/** requestAccounting 失败时的错误信息（如 B-Unit 不足） */
	const [accountingError, setAccountingError] = useState<string | null>(null)
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

	useEffect(() => {
		if (hideEoaReceivingToggle) setReceivingMode('aa')
	}, [hideEoaReceivingToggle])

	
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
	const handleDoneAmount = async () => {
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
		setAccountingError(null)
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
		setPendingPaymentUrl(url)
		setShowAmountInput(false)

		// UI 自检（客户端直接从 CoNET 查余额）：0.8% 费用，min 2 max 200 B-Units，>=5000 USDC 时 500
		try {
			const amt = Number(billAmount)
			const usdcToUSD = Number(currencyData?.USDC) ?? 1
			const curToUSD = billCurrency === 'USDC' ? 1 : (Number((currencyData as Record<string, number>)?.[billCurrency]) ?? 1)
			const amountUSDC = billCurrency === 'USDC' ? amt : amt / curToUSD / usdcToUSD
			let feeBUnits = Math.ceil(amountUSDC * 0.8)
			if (amountUSDC >= 5000) feeBUnits = 500
			else feeBUnits = Math.min(Math.max(feeBUnits, 2), 200)

			let payerEOA: string
			const code = await baseEndpoint.getCode(toAddress)
			if (code && code !== '0x' && code.length > 2) {
				const aaRead = new ethers.Contract(toAddress, ['function owner() view returns (address)'], baseEndpoint)
				const owner = await aaRead.owner()
				if (!owner || owner === ethers.ZeroAddress) {
					setAccountingError('Cannot determine payee owner for B-Unit fee check')
					setAccountingStatus('error')
					return
				}
				payerEOA = ethers.getAddress(owner)
			} else {
				payerEOA = ethers.getAddress(toAddress)
			}

			const { total } = await getBUnitBalanceFromConetRpc(payerEOA)
			if (total < feeBUnits) {
				setAccountingError(`Insufficient B-Units: payee needs ${feeBUnits} B-Units for requestAccounting (balance: ${total} B-Units)`)
				setAccountingStatus('error')
				return
			}
		} catch (e) {
			setAccountingError((e as Error)?.message ?? 'B-Unit balance check failed')
			setAccountingStatus('error')
			return
		}

		fetch(`${showPaylinkSite}/api/requestAccounting`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json;charset=UTF-8' },
			body: JSON.stringify({
				requestHash,
				payee: toAddress,
				amount: billAmount,
				currency: billCurrency,
				forText: billForText.trim() || undefined,
				validDays: Math.max(1, Math.floor(billValidDays)),
			}),
		})
			.then(async (res) => {
				const data = res.ok ? await res.json().catch(() => null) : await res.json().catch(() => ({}))
				if (res.ok && data && typeof data === 'object' && data.indexed && data.syncTx) {
					setBillPaymentUrl(url)
					setPendingPaymentUrl(null)
					setAccountingStatus('success')
					setAccountingSyncTx(data.syncTx)
				} else {
					const errMsg = (data && typeof data === 'object' && typeof data.error === 'string') ? data.error : (res.ok ? 'Failed to record' : 'Request failed')
					setAccountingError(errMsg)
					setAccountingStatus('error')
				}
			})
			.catch((err) => {
				setAccountingError(err instanceof Error ? err.message : 'Network error')
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
							const canToggle =
								!hideEoaReceivingToggle &&
								!!(merchantAA && ethers.isAddress(merchantAA) && myAddress && ethers.isAddress(myAddress))
							const label = showAA ? 'Express Pay (Smart Account)' : 'Main Vault (EOA)'
							const content = (
								<>
									{!hideReceivingWalletHeading && (
										<span className="text-[11px] font-medium tracking-wider text-slate-500 dark:text-slate-400 uppercase mr-2 self-center">
											{label}
										</span>
									)}
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

						{/* QR Card - 金额输入展开时隐藏，小屏紧凑；创建 paymentRequest 时先 loading，成功才显示 QR，B-Unit 不足等错误明确展示 */}
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

								{/* Loading：等待 requestAccounting 服务器确认 */}
								{pendingPaymentUrl && accountingStatus === 'loading' && (
									<div className="relative z-10 flex flex-col items-center justify-center rounded-[20px] sm:rounded-[28px] bg-white p-8 sm:p-12 shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)] min-w-[200px] min-h-[200px]">
										<Loader
											className={`h-12 w-12 animate-spin ${receivePanelLimeButtons ? 'text-[#65A30D]' : 'text-sky-500'}`}
											strokeWidth={2}
										/>
										<p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Creating payment request…</p>
									</div>
								)}

								{/* Error：B-Unit 不足等，明确展示错误；支持 Go to Fuel Center 跳转 topup */}
								{pendingPaymentUrl && accountingStatus === 'error' && (
									<div className="relative z-10 flex flex-col items-center rounded-[20px] sm:rounded-[28px] bg-white dark:bg-slate-800 p-6 sm:p-8 shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)] max-w-[280px]">
										<XCircle className="w-12 h-12 text-amber-500 dark:text-amber-400 shrink-0" />
										<p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100 text-center">
											{accountingError && /insufficient b-units/i.test(accountingError) ? 'Insufficient B-Units' : 'Request failed'}
										</p>
										<p className="mt-1 text-xs text-slate-600 dark:text-slate-400 text-center break-words">{accountingError ?? 'Unknown error'}</p>
										<div className="mt-4 w-full flex flex-col gap-2">
											{accountingError && /insufficient b-units/i.test(accountingError) && onShowFuelCenter && (
												<button
													type="button"
													onClick={() => {
														setPendingPaymentUrl(null)
														setAccountingError(null)
														setAccountingStatus('idle')
														onShowFuelCenter()
													}}
													className="w-full py-2.5 px-4 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold text-sm hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors flex items-center justify-center gap-2"
												>
													<Fuel className="w-4 h-4" strokeWidth={2.5} />
													Go to Fuel Center
												</button>
											)}
											<button
												type="button"
												onClick={() => {
													setPendingPaymentUrl(null)
													setAccountingError(null)
													setAccountingStatus('idle')
													setShowAmountInput(true)
												}}
												className={
													receivePanelLimeButtons
														? limeSecondaryBtn
														: 'w-full rounded-xl bg-sky-100 px-4 py-2.5 text-sm font-semibold text-blue-600 transition-colors hover:bg-sky-200 dark:bg-sky-900/40 dark:text-blue-400 dark:hover:bg-sky-900/60'
												}
											>
												Try again
											</button>
										</div>
									</div>
								)}

								{/* QR 白底板：服务器成功后才显示 */}
								{!(pendingPaymentUrl && (accountingStatus === 'loading' || accountingStatus === 'error')) && (
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
												src: bIcon,
												height: 56,
												width: 56,
												excavate: true,
											}}
											className="block"
										/>
									</div>
								</div>
								)}
								
								{/* <div className="mt-6 text-center">
									<div className="mt-3 text-[18px] font-semibold text-slate-500">
										Scan to pay (Any amount)
									</div>
								</div> */}
								{/* <TaxSwitch value={isUSDC} onChange={setIsUSDC} taxRate={getBeamio?.tax ? Number(getBeamio.tax):0} /> */}
							</div>
							</div>
						)}

						{/* 费率计算卡片：指定金额时显示在 QR 下方，Requesting 使用用户输入的 currency；Fee 对齐 B-Unit 费率 */}
						{billPaymentUrl && billAmount && (() => {
							const amtOrig = Number(billAmount)
							const usdcRate = Number(currencyData?.USDC) ?? 1
							const usdToCur = billCurrency === 'USDC' ? 1 : (Number((currencyData as any)?.[billCurrency]) ?? 1)
							const amtUsdc = billCurrency === 'USDC' ? amtOrig : amtOrig / (usdToCur * usdcRate)
							const feeBUnits = calcFeeBUnits(amtUsdc)
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
											<span className="text-slate-500 dark:text-slate-400">- {feeBUnits} B-Units</span>
										</div>
										<div className="border-t border-slate-200 dark:border-slate-600 pt-2">
											<div className="flex justify-between items-start">
												<span className="font-semibold text-green-600 dark:text-green-400 text-sm">Est. Receive</span>
												<div className="text-right">
													<span className="font-semibold text-green-600 dark:text-green-400">{formatAmount(amtUsdc, 'USDC')} USDC</span>
													{billCurrency !== 'USDC' && currencyData?.USDC != null && currencyData?.[billCurrency] != null && (() => {
														const estReceiveFiat = amtUsdc * usdcToUSD * usdToFiat
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


						{/* Actions - 金额输入期间隐藏；创建 paymentRequest 的 loading/error 期间也隐藏 */}
						{!showAmountInput && !(pendingPaymentUrl && (accountingStatus === 'loading' || accountingStatus === 'error')) && (
						<div className="mt-3 sm:mt-10 flex gap-2 sm:gap-3">
							<button
								type="button"
								onClick={onCopyPayLink}
								className={[
									'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 px-3 font-semibold text-sm transition sm:gap-2 sm:px-4 sm:py-3',
									'bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-[0.98] dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
									copied
										? receivePanelLimeButtons
											? 'ring-2 ring-[#96EB3C]'
											: 'ring-2 ring-blue-400'
										: '',
								].join(' ')}
							>
								{copied ? (
									<Check
										className={`h-5 w-5 shrink-0 ${receivePanelLimeButtons ? 'text-[#65A30D]' : 'text-blue-600'}`}
									/>
								) : (
									<Copy className="h-5 w-5 shrink-0 text-slate-600 dark:text-slate-400" />
								)}
								<span>Copy</span>
							</button>
							<button
								type="button"
								onClick={onShare}
								className={receivePanelLimeButtons ? limeShareBtn : defaultShareBtn}
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
