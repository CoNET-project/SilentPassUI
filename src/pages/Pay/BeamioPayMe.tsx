import { useEffect, useMemo, useState, useRef } from "react"
import { Copy, Check, MessageCircle, Printer, Share2 } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {AuthorizationSign, getBalanceProcess, generateCODE} from '@/services/beamio'
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
	onClose
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
		const ok = await copyText(successUrl)
		if (ok) setCopied(true)
	}

  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [getBeamio, setGetBeamio] = useState<beamio|null>(null)
  	const [successUrl, setSuccessUrl] = useState("")
	const [showMode, setShowMode] = useState<Mode>(activeTab)
	const [isUSDC, setIsUSDC] = useState(true)

	
  const {profiles, setUsdcbalance, usdcbalance, myAddress, setUsdcToUSD, usdcToUSD, setMyAddress, setShowFooter, currencyData, beamio, setBeamio} = useDaemonContext()
	useEffect(() => {
		if (!beamio||getBeamio||!profiles?.length) return
		setGetBeamio({...beamio})
		
		const showparams = new URLSearchParams({beamio: beamio.accountName}).toString()
		const showUrl = `${showPaylinkSite}?${showparams}`
		setSuccessUrl(showUrl)
		
	},[])


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

  

  const onPrint = () => {
    	window.print()
  }

  const onMessage = async () => {
    // iOS/Android 上如果支持 share，会走系统消息/分享面板
    if (navigator.share) {
      try {
        await navigator.share({ title: "Beamio PayMe", text: successUrl, url: successUrl })
        return
      } catch {
        // ignore
      }
    }
    await copyText(successUrl)
  }

  const onShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Beamio PayMe", text: successUrl, url: successUrl })
        return
      } catch {
        // ignore
      }
    }
    await copyText(successUrl)
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[540px] px-4 py-4 relative">

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
					/>
				) : showMode === 'main' && (
				<div className="mt-6 rounded-[22px] bg-white shadow-[0_12px_35px_rgba(15,23,42,0.08)] ring-1 ring-black/10 overflow-hidden">
					<div className="px-6 pt-4 pb-6">
					<div className="text-center">
						<div className="flex items-baseline justify-center gap-2 text-[20px] font-extrabold tracking-tight text-slate-900">
							<span className="truncate">
							{displayName(beamio)}
							</span>

							<span className="font-semibold text-beamio">@{beamio?.accountName}</span>
						</div>
						</div>

						{/* QR Card */}
							<div className="mt-4 flex justify-center">
							<div className="relative isolate">
								{/* glow：强制放到最底层 */}
								<div
								aria-hidden
								className="
									absolute inset-[-12px]
									-z-10
									rounded-[36px]
									bg-[radial-gradient(60%_60%_at_50%_40%,rgba(132,120,255,0.18),rgba(132,120,255,0.05)_60%,transparent_75%)]
									blur-xl
									pointer-events-none
								"
								/>

								{/* QR 白底板：强制放到上层 */}
								<div className="relative z-10 flex justify-center">
									<div
										className="
										rounded-[28px]
										bg-white
										p-[18px]
										shadow-[0_26px_50px_rgba(132,120,255,0.22),0_10px_22px_rgba(0,0,0,0.08)]
										"
									>
										<QRCodeCanvas
											value={successUrl}
											size={264}
											level="H"
											includeMargin={false}
											bgColor="white"
											fgColor="#000000"
											imageSettings={{
												src: bIcon,
												height: 95,
												width: 95,
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



						{/* Payment link */}
						<div className="mt-10">
						<div className="rounded-[14px] bg-slate-50 ring-1 ring-black/10 shadow-sm px-4 py-3 flex items-center justify-between gap-4">
  
							{/* 左侧文字：真正上下居中 */}
							<div className="min-w-0 flex flex-col justify-center">
								<div className="text-[12px] leading-snug text-slate-700 break-all">
								{successUrl}
								</div>
							</div>

							{/* 右侧按钮 */}
							<button
								type="button"
								onClick={onCopyPayLink}
								className={[
								"shrink-0 w-[36px] h-[36px] rounded-[18px]",
								"bg-white/85 backdrop-blur-md",
								"ring-1 ring-black/10 shadow-sm",
								"flex items-center justify-center",
								"active:scale-[0.96] transition-transform duration-150",
								copied
									? "ring-[rgba(0,0,255,0.25)] shadow-[0_10px_24px_rgba(0,0,255,0.12)]"
									: "",
								].join(" ")}
								aria-label="Copy payment link"
								title={copied ? "Copied" : "Copy"}
							>
								{/* icon 容器：严格几何居中 */}
								<span className="relative w-5 h-5 leading-none">
								
								{/* Copy */}
								<span
									className={[
									"absolute inset-0 flex items-center justify-center leading-none",
									"transition-all duration-200 ease-out",
									copied ? "opacity-0 scale-75" : "opacity-100 scale-100",
									].join(" ")}
									aria-hidden={copied}
								>
									<Copy className="w-5 h-5 text-slate-700 leading-none" />
								</span>

								{/* Check */}
								<span
									className={[
									"absolute inset-0 flex items-center justify-center leading-none",
									"transition-all duration-200 ease-out",
									copied ? "opacity-100 scale-100" : "opacity-0 scale-75",
									].join(" ")}
									aria-hidden={!copied}
								>
									<Check className="w-5 h-5 text-[rgb(0_0_255)] leading-none" />
								</span>
								</span>
							</button>
							</div>

						{/* <div className="mt-4 text-center text-[12px] font-semibold text-slate-400">
							Opens in browser or Beamio app
						</div> */}
						</div>
						{/* Actions */}
						<div className="mt-10 flex items-center justify-center gap-16">
						<button type="button" onClick={onPrint} className="group flex flex-col items-center">
							<div className="w-[42px] h-[42px] rounded-full bg-white shadow-sm ring-1 ring-black/10 flex items-center justify-center group-active:scale-[0.98] transition">
							<Printer className="h-7 w-7 text-slate-600" />
							</div>
							<div className="mt-3 text-[18px] font-semibold text-slate-600">Print</div>
						</button>

					

						<button type="button" onClick={onShare} className="group flex flex-col items-center">
							<div className="w-[42px] h-[42px] rounded-full bg-white shadow-sm ring-1 ring-black/10 flex items-center justify-center group-active:scale-[0.98] transition">
							<Share2 className="h-7 w-7 text-slate-600" />
							</div>
							<div className="mt-3 text-[18px] font-semibold text-slate-600">Share</div>
						</button>
						</div>

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
