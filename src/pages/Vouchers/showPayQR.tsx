import { QRCodeCanvas } from "qrcode.react"
import bIcon from "@/components/assets/logo512.png"
import { Copy, Check, Printer, Share2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"


const displayName = (item: beamio|null) => {
	if (!item) return ''
	const lastname = item.lastName?.split('\r\n')||[]
	const fullName = `${item.firstName || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.accountName || item.address
}

function cx(...v: Array<string | false | undefined | null>) {
	return v.filter(Boolean).join(" ")
  }
  
export default function ShowPayQR({ successUrl, beamio }: { successUrl: string, beamio: beamio|null }) {
	const [copied, setCopied] = useState(false)
	
	const onCopyPayLink = async () => {
		const ok = await copyText(successUrl)
		if (ok) setCopied(true)
	}

	const copyText = async (t: string) => {
		try {
			await navigator.clipboard.writeText(t)
			return true
		} catch {
			return false
		}
	}
	const onPrint = () => {
		window.print()
	}
	const onShare = () => {
		window.open(successUrl, '_blank')
	}

	useEffect(() => {
		if (!copied) return
		const t = window.setTimeout(() => setCopied(false), 3000)
		return () => window.clearTimeout(t)
	}, [copied])

	return (
		<>
			<div
		className="flex
		justify-center
		sm:items-center"
	
	>
	{/* Backdrop */}
	

	{/* Sheet - 保持 max-w-[560px] 保证全宽观感 */}
	<div
	  className={cx(
		"relative w-full max-w-[560px] mx-auto",
    	"",
	  )}
	 
	>

			<div className="mt-6">
					<div className="px-6 pt-4 pb-6">
						<div className="text-center">
						<div className="text-[20px] font-extrabold tracking-tight text-slate-900">
							{displayName(beamio)}
						</div>
						<div className="mt-1 text-[20px] font-semibold text-slate-500">@{beamio?.accountName}</div>
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
					</div>
					</div>
		</>

	)
}