import { useEffect, useMemo, useState } from "react"
import { Copy, MessageCircle, Printer, Share2 } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {AuthorizationSign, getBalanceProcess, generateCODE} from '@/services/beamio'
import bIcon from '@/components/assets/logo512.png'
import { QRCodeCanvas } from 'qrcode.react'
import PaymentLink from './PaymentLink'
import {ShowPrint} from './ShowPrint'

const showPaylinkSite = 'https://beamio.app'

const aptEndpoint = 'https://api.settleonbase.xyz'
type BeamioPayMeProps = {
 
  payLink: string // https://beamio.app/pay/@BeamioDemo
  // 你也可以直接传入现成的 QR 图片（优先使用）
  qrImageUrl?: string
  // tab 控制（如果你需要外部路由）
  activeTab?: "payme" | "invoice"
  onTabChange?: (v: "payme" | "invoice") => void
}

const displayName = (item: beamio|null) => {
	if (!item) return ''
	const lastname = item.lastName?.split('\r\n')||[]
	const fullName = `${item.firstName || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.accountName || item.address
}

export default function BeamioPayMe(props: BeamioPayMeProps) {
  const {
    payLink,
    qrImageUrl,
    activeTab = "payme",
    onTabChange,
  } = props

  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [getBeamio, setGetBeamio] = useState<beamio|null>(null)
  	const [successUrl, setSuccessUrl] = useState("")
	const [showMode, setShowMode] = useState<'Print'|'main'|'PaymentLink'>('main')

	
  const {profiles, setUsdcbalance, usdcbalance, myAddress, setUsdcToUSD, usdcToUSD, setMyAddress, setShowFooter, currencyData, beamio, setBeamio} = useDaemonContext()
	useEffect(() => {
		if (!beamio||getBeamio||!profiles?.length) return
		setGetBeamio({...beamio})
		if (!beamio?.payme) {
			const code = generateCODE ('')
			const showparams = new URLSearchParams({code: code.code}).toString()
			const showUrl = `${showPaylinkSite}?${showparams}`
			setSuccessUrl(showUrl)
			beamio.payme = code.code
			setBeamio(beamio)
			issueRequestLink(code, profiles[0], beamio)
		} else {
			const showparams = new URLSearchParams({code: beamio.payme}).toString()
			const showUrl = `${showPaylinkSite}?${showparams}`
			setSuccessUrl(showUrl)
		}
	},[])

  const effectiveQr = useMemo(() => qrImageUrl || qrDataUrl, [qrImageUrl, qrDataUrl])

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

  	const issueRequestLink = async (code: {hash: string, code: string}, profile: profile, beamioData: beamio) => {
		const currency = beamioData.currency
		
			/**
			 * 
			 * 		UI test
			 * 
			 */
	
		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setProcessError('RPC ERROR!')
		// }, 3000)

		const note = 'Please Pay me with Beamio'
		const showNote = note + `\r\n` + currency

		const params = new URLSearchParams({amount: '0', code: code.hash, note:showNote, address: profile.keyID }).toString()
		const requestUrl = `${aptEndpoint}/api/BeamioPaymentLink?${params}`
		

		/**
			 * 
			 * 		UI test
			 * 
			 */
		// setTimeout(() => {
		// 	setProcessing(false)
		// 	setSuccessUrl(showUrl)
		// }, 1000)


		try {
			const res = await fetch(requestUrl, {method: 'GET'})

			
			if (res.status !== 200) {
				return console.log(`Beamio RPC Error!`)

			}
			

			

		} catch (ex) {
			
			return console.log(`Beamio RPC Error!`)
		}
		
	}

  const onPrint = () => {
    	setShowMode('Print')
  }

  const onMessage = async () => {
    // iOS/Android 上如果支持 share，会走系统消息/分享面板
    if (navigator.share) {
      try {
        await navigator.share({ title: "Beamio PayMe", text: payLink, url: payLink })
        return
      } catch {
        // ignore
      }
    }
    await copyText(payLink)
  }

  const onShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Beamio PayMe", text: payLink, url: payLink })
        return
      } catch {
        // ignore
      }
    }
    await copyText(payLink)
  }

  return (
    <div className="min-h-screen bg-white flex justify-center overflow-y-auto">
      <div className="w-full max-w-[540px] px-4 py-4">
        {/* Segmented */}
        <div className="rounded-[18px] bg-slate-100 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-black/5">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setShowMode('main')}
              className={[
                "h-12 rounded-[18px] text-[16px] font-semibold transition",
                showMode === 'main'
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                  : "text-slate-500",
              ].join(" ")}
            >
              Any amount (PayMe)
            </button>

            <button
              type="button"
              onClick={() => setShowMode('PaymentLink')}
              className={[
                "h-12 rounded-[18px] text-[16px] font-semibold transition",
                showMode === 'PaymentLink'
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                  : "text-slate-500",
              ].join(" ")}
            >
              Fixed amount (Invoice)
            </button>
          </div>
        </div>

        {/* Main Card */}
        {
				showMode === 'main' && (
				<div className="mt-6 rounded-[22px] bg-white shadow-[0_12px_35px_rgba(15,23,42,0.08)] ring-1 ring-black/10 overflow-hidden">
					<div className="px-6 pt-4 pb-6">
						<div className="text-center">
						<div className="text-[20px] font-extrabold tracking-tight text-slate-900">
							{displayName(beamio)}
						</div>
						<div className="mt-1 text-[20px] font-semibold text-slate-500">@{beamio?.accountName}</div>
						</div>

						{/* QR Card */}
						<div className="mt-4 flex justify-center">
						<div className="w-[420px] max-w-full rounded-[22px] bg-white ring-1 ring-black/10 shadow-sm px-4 pt-5 pb-4">
							<div className="relative flex justify-center">
							<div className="relative">
								<QRCodeCanvas
									value={successUrl}
										size={240}
										level="H"
										includeMargin
										bgColor="white"
										fgColor="#000000"
										imageSettings={{
											src: bIcon,
											height: 88,
											width: 88,
											excavate: true,
										}}
										className="rounded-lg inline-block"
								/>

								{/* 中间 BE 徽章 */}
								
							</div>
							</div>

							<div className="mt-0 text-center">
							<div className="text-[0px] font-black italic tracking-tight text-[rgb(0_0_255)]">
								beamio
							</div>
							<div className="mt-3 text-[18px] font-semibold text-slate-500">
								Scan to pay (Any amount)
							</div>
							</div>
						</div>
						</div>

						{/* Actions */}
						<div className="mt-10 flex items-center justify-center gap-16">
						<button type="button" onClick={onPrint} className="group flex flex-col items-center">
							<div className="w-[42px] h-[42px] rounded-full bg-white shadow-sm ring-1 ring-black/10 flex items-center justify-center group-active:scale-[0.98] transition">
							<Printer className="h-7 w-7 text-slate-600" />
							</div>
							<div className="mt-3 text-[18px] font-semibold text-slate-600">Print</div>
						</button>

						<button type="button" onClick={onMessage} className="group flex flex-col items-center">
							<div className="w-[42px] h-[42px] rounded-full bg-white shadow-sm ring-1 ring-black/10 flex items-center justify-center group-active:scale-[0.98] transition">
							<MessageCircle className="h-7 w-7 text-slate-600" />
							</div>
							<div className="mt-3 text-[18px] font-semibold text-slate-600">Message</div>
						</button>

						<button type="button" onClick={onShare} className="group flex flex-col items-center">
							<div className="w-[42px] h-[42px] rounded-full bg-white shadow-sm ring-1 ring-black/10 flex items-center justify-center group-active:scale-[0.98] transition">
							<Share2 className="h-7 w-7 text-slate-600" />
							</div>
							<div className="mt-3 text-[18px] font-semibold text-slate-600">Share</div>
						</button>
						</div>

						{/* Payment link */}
						<div className="mt-10">
						<div className="rounded-[14px] bg-slate-50 ring-1 ring-black/10 shadow-sm px-4 py-3 flex items-center justify-between gap-4">
							<div className="min-w-0">
							<div className="text-[14px] font-extrabold text-slate-700">Payment link</div>
							<div className="mt-2 text-[12px] text-slate-700 break-all">{successUrl}</div>
							</div>

							<button
							type="button"
							onClick={() => copyText(successUrl)}
							className="shrink-0 w-[36px] h-[36px] rounded-[18px] bg-white ring-1 ring-black/10 shadow-sm flex items-center justify-center active:scale-[0.98] transition"
							aria-label="Copy payment link"
							title="Copy"
							>
							<Copy className="h-5 w-5 text-slate-700" />
							</button>
						</div>

						<div className="mt-4 text-center text-[12px] font-semibold text-slate-400">
							Opens in browser or Beamio app
						</div>
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
				payLink={successUrl || payLink}
				qrValue={successUrl || payLink}
				onDone={() => setShowMode('main')}
				onBack={() => setShowMode('main')}
				onPrint={() => window.print()}
			/>
		)}
		
    </div>
  )
}
