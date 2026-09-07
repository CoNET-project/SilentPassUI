import { IpfsImg } from '@/components/IpfsImg';
import React, { useMemo } from "react"
import { ethers } from "ethers"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"

export type searchResult = {
  address: string
  created_at: number
  first_name: string
  image: string
  last_name: string
  username: string
  follow_count: string
  follower_count: string
  
}

const fmtAddr = (a = "") =>
  a && a !== ethers.ZeroAddress ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—"

export function ChatHeaderIOS({
  beamioer,
  onBack,
  onCenterClick,
  online,
  avatarSrc,
  embedded = false,
}: {
  beamioer?: searchResult
  onBack?: () => void
  onCenterClick?: () => void
  online: boolean
  avatarSrc: string
  /** Merchant Messages pane: position relative to chat root, not the viewport. */
  embedded?: boolean
}) {
  const isUnknown = !beamioer || beamioer.username === "未知"

  const tagText = useMemo(() => {
    if (!beamioer) return ""
    if (!isUnknown && beamioer.username) return beamioer.username
    return fmtAddr(beamioer.address)
  }, [beamioer, isUnknown])

  return (
    <div
      className={[
        embedded ? "absolute top-0 left-0 right-0 z-[80]" : "fixed top-0 left-0 right-0 z-[80]",
        "pointer-events-none",
      ].join(" ")}
    >
      <div className={embedded ? "pt-1" : "pt-[calc(env(safe-area-inset-top)+4px)]"}>
        {/* Back：玻璃圆 */}
        <div className="px-4 h-14 flex items-center">
          <button
            type="button"
            onClick={onBack}
            tabIndex={-1}
            className={[
              "pointer-events-auto",
              "h-11 w-11 rounded-full grid place-items-center",
              "bg-white/50 backdrop-blur-xl",
              "ring-1 ring-white/60",
              "shadow-[0_18px_38px_rgba(15,23,42,0.14)]",
              "active:scale-[0.98] transition"
            ].join(" ")}
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6 text-slate-900" strokeWidth={2.6} />
          </button>
        </div>

			<div className="relative -mt-[54px] flex justify-center">
			<motion.div
				initial={{ opacity: 0, y: -6, scale: 0.985 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ type: "spring", stiffness: 520, damping: 42 }}
				className="pointer-events-none"
			>
				<div className="flex flex-col items-center">
					<div className="relative z-10">
						{beamioer?.address ? (
							<IpfsImg
							src={avatarSrc}
							alt="avatar"
							className="
								w-[44px] h-[44px]
								rounded-full
								object-cover
								bg-slate-200
								shadow-[0_10px_24px_rgba(15,23,42,0.18)]
							"
							/>
						) : (
							<div
							className="
								w-[44px] h-[44px]
								rounded-full
								bg-slate-200
								shadow-[0_10px_24px_rgba(15,23,42,0.18)]
							"
							/>
						)}

						{online && (
							<span
							className="
								absolute
								bottom-0 right-0
								w-[11px] h-[11px]
								rounded-full
								bg-emerald-500
								ring-2 ring-white
							"
							aria-label="online"
							/>
						)}
					</div>

					<button
						type="button"
						onClick={onCenterClick}
						tabIndex={-1}
						className={[
							"pointer-events-auto",
							"-mt-1",
							"inline-flex items-center gap-1",
							"px-1 py-1",
							"rounded-full",
							"bg-white/60 backdrop-blur-xl",
							"ring-1 ring-white/70",
							"shadow-[0_14px_30px_rgba(15,23,42,0.12)]",
							"active:scale-[0.99] transition"
						].join(" ")}
						aria-label="Open profile"
					>
						<span
							className="text-[15px] font-semibold"
							style={{ color: "rgba(22,82,240,0.6)" }}
							>
							@{tagText}
						</span>

						<ChevronRight
							className="w-4 h-4"
							strokeWidth={2.6}
							style={{ color: "rgba(22,82,240,0.6)" }}
						/>
					</button>
				</div>
			</motion.div>
			</div>
      </div>
    </div>
  )
}
