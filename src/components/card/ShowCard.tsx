import BeamioDetail from "./beamioForShow"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {getBalanceProcess, formatWithThousands, aesGcmDecrypt, searchUsername} from '@/services/beamio'
import {useObjectImgSrc} from './useObjectImgSrc'
import { X } from "lucide-react"

import {
  useState,
  useEffect,
} from "react"

type Props = {
  card: IImageCard
  address: string
  usdcAmount: string
  cancel: () => void
}

const NAV_TOP = "env(safe-area-inset-top)"
const HEADER_H = 120
const TOP_OFFSET = `calc(env(safe-area-inset-top) + ${HEADER_H}px)`
const TEXT_MAX_W = 420
const TEXT_PAD_X = 20
  /* ================== 样式 ================== */
  const TITLE_CLASS = [
    "font-extrabold",
    "text-[34px]",
    "leading-tight",
    "tracking-tight",
    "text-yellow-400",
    "drop-shadow-[0_3px_2px_rgba(0,0,0,0.55)]"
  ].join(" ")
    const DETAIL_CLASS = [
    "text-[24px]",
    "leading-[1.6]",
    "font-semibold",
    "text-white/95",
    "drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]",
    "mt-10"
  ].join(" ")



  // base64 → Blob → objectURL（iOS 更稳）
function dataUrlToObjectUrl(dataUrl: string) {
	const [meta, b64] = dataUrl.split(",")
	const mime = meta.match(/:(.*?);/)?.[1] || "image/webp"
	const bin = atob(b64)
	const arr = new Uint8Array(bin.length)
	for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
	return URL.createObjectURL(new Blob([arr], { type: mime }))
}

export default function ShowCard({ card, address, usdcAmount, cancel }: Props) {
 
	const [fromBeamio, setfromBeamio] =  useState<searchResult|undefined> ()
	const {setUsdcbalance, usdcbalance, myAddress, setUsdcToUSD, beamioUsers, setbBeamioUsers} = useDaemonContext()

		const findUser = async () => {
			if (fromBeamio) return
	
			let account = beamioUsers.find(n => n?.address === address)
			if (!account) {
				const _account = await searchUsername(address)
				if (_account) {
					const acc = _account.results
					setbBeamioUsers([...beamioUsers, acc[0]])
					setfromBeamio({...acc[0]})
				}
				return
			}
			setfromBeamio({...account})
			
		}
		
		useEffect(() => {
			findUser()
			
		}, [])

		const imgSrc = useObjectImgSrc(card?.image)
	return (
		<div className="fixed inset-0 overflow-hidden">
			{/* ===== 全屏背景 ===== */}
			<div className="absolute inset-0">
				<div className="absolute inset-0">
					{imgSrc && (
						<img
						src={imgSrc}
						alt="card-bg"
						className="w-full h-full object-cover"
						draggable={false}
						decoding="async"
						/>
					)}
				</div>

				<div
					className="absolute inset-0 bg-black/20"
					style={{
						WebkitBackdropFilter: "blur(1px)",
						backdropFilter: "blur(1px)"
					}}
				/>
			</div>

			{/* ✅ iOS 顶部：左 Cancel(X) */}
			<button
				type="button"
				onClick={cancel}
				className="
					absolute left-3 z-30
					w-10 h-10 rounded-full
					bg-white/20
					backdrop-blur-md
					border border-white/20
					shadow-[0_6px_16px_rgba(0,0,0,0.06)]
					hover:bg-white/20
					active:scale-95
					transition
					mt-8
				"
				style={{ top: NAV_TOP }}
				aria-label="Cancel"
			>
				<X className="w-5 h-5 mx-auto text-white/40 translate-y-[2px]" />
			</button>

			{/* ===== 展示层 ===== */}
			<div className="absolute inset-0 z-20">
				{/* Title / Detail */}
				<div
				className="absolute"
				style={{
					top: `calc(${TOP_OFFSET} + 12px)`,
					left: "50%",
					transform: "translateX(-50%)",
					width: `min(${TEXT_MAX_W}px, calc(100vw - ${TEXT_PAD_X * 2}px))`
				}}
				>
				<div className={TITLE_CLASS} style={{ whiteSpace: "pre-wrap" }}>
					{card?.title || " "}
				</div>

				<div className="mt-2">
					<div className={DETAIL_CLASS} style={{ whiteSpace: "pre-wrap" }}>
					{card?.detail || " "}
					</div>
				</div>
				</div>

				{/* 底部 Beamio */}
				<div
				className="
					absolute
					left-1/2
					-translate-x-1/2
					bottom-[calc(env(safe-area-inset-bottom)+120px)]
					z-50
				"
				>
				{fromBeamio && (
					<BeamioDetail
					item={fromBeamio}
					currencyText={card.currencyAmount}
					usdcAmount={usdcAmount}
					/>
				)}
				</div>
			</div>
		</div>
	)
}
