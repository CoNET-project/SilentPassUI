import React, { useMemo, useEffect, useRef } from "react"

import {
	ChevronRight,
	Menu,
	Pin as PinIcon,
	BellOff,
	ArrowUpRight,
	ArrowDownLeft

} from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import {checkSign, getKeysFromCoNETPGPSC, makeMessage} from '@/services/chat' 
import {searchUsername, storeSystemData} from '@/services/beamio'

type ChatListProps = {
  list: chatData[]
  onOpen?: (item: chatData) => void
  onEdit?: () => void
  onMenu?: () => void
  title?: string
}


function fmtListTime(ts?: number) {
  if (!ts) return ""
  const d = new Date(ts)
  if (!isFinite(d.getTime())) return ""

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

  const oneDay = 24 * 60 * 60 * 1000
  const diff = startOfToday - startOfThatDay

  if (diff === 0) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  }
  if (diff === oneDay) return "Yesterday"

  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const displayName = (item: searchResult) => {
	const lastname = item.last_name.split('\r\n')
	const fullName = `${item.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}



function initialLetters(b: searchResult) {
	const n = displayName(b)
	const parts = n.split(" ").filter(Boolean)
	const a = (parts[0]?.[0] || n[0] || "U").toUpperCase()
	const b2 = (parts[1]?.[0] || n[1] || "").toUpperCase()
	return (a + b2).slice(0, 2)
}

function tagColor(tag: chatData["tag"]) {
	if (tag === "red") return "bg-rose-500"
	if (tag === "green") return "bg-emerald-500"
	return "bg-[#1652f0]"
}

function Avatar({
	beamio,
	online
}: {
	beamio: searchResult
	online?: boolean
}) {
	const img = beamio.image?.trim()
	const initials = initialLetters(beamio)

	return (
		<div className="relative h-12 w-12 flex-shrink-0">
		{img ? (
			<img
			src={img}
			alt={displayName(beamio)}
			className="h-12 w-12 rounded-full object-cover ring-1 ring-black/5"
			/>
		) : (
			<div className="h-12 w-12 rounded-full bg-[linear-gradient(180deg,#9db3d9_0%,#6f88be_100%)] grid place-items-center ring-1 ring-black/5">
			<span className="text-white font-semibold text-[16px] tracking-wide">
				{initials}
			</span>
			</div>
		)}

		{/* online 点 */}
		{online && (
			<span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
		)}
		</div>
	)
}

function Badge({
  n,
  muted
}: {
  n: number
  muted?: boolean
}) {
  const text = n > 99 ? "99+" : String(n)

  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        "min-w-[22px] h-[22px] px-2",
        "rounded-full",
        muted
          ? "bg-slate-300 text-white"              // 🔕 静音：灰色
          : "bg-[#1652f0] text-white",              // 🔵 正常：Beamio Blue
        "text-[12px] font-bold tabular-nums",
        muted
          ? "shadow-none"
          : "shadow-[0_6px_18px_rgba(22,82,240,0.22)]",
        "ring-1 ring-white/70"
      ].join(" ")}
      aria-label={`${n} unread`}
    >
      {text}
    </span>
  )
}


export default function ChatList({
	title = "",
	onOpen
}: ChatListProps) {
		const 
		{
		profiles,
		setProfiles,
		setShowFooter,
		allNodes,
		setGossip,
		gossip,
		charts,
		setCharts
  	} = useDaemonContext()

	const items = useMemo(() => {
		const profile: profile = profiles?.[0]
		if (!profile) return []

		// ✅ profile.chat 可能不是数组，先规范化成 chatData[]
		const list: chatData[] = Array.isArray(profile.chats)
			? profile.chats
			: profile.chats
			? Object.values(profile.chats as any)
			: []

		const filtered = list.filter(
			x => x && !x.hide && typeof x.address === "string" && x.address.length > 0
		)

		return filtered
			.slice()
			.sort((a, b) => {
			const pa = a.pin ? 1 : 0
			const pb = b.pin ? 1 : 0
			if (pa !== pb) return pb - pa

			const ta = a.messages?.[a.messages.length - 1]?.createdAt || a.beamio?.created_at || 0
			const tb = b.messages?.[b.messages.length - 1]?.createdAt || b.beamio?.created_at || 0
			return tb - ta
			})
	}, [profiles])


	



	const onEdit = () => {
		
	}

  return (
    <div className="bg-white">
      {/* 顶部栏（贴近 iOS 列表页风格） */}
      <div
        className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {/* <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onEdit}
            className="h-10 px-4 rounded-full bg-slate-100 text-slate-900 text-[18px] font-medium active:scale-[0.98] transition"
          >
            Edit
          </button>

          <button
            type="button"
            
            className="h-10 w-10 rounded-full bg-slate-100 grid place-items-center active:scale-[0.98] transition"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5 text-slate-800" strokeWidth={2.4} />
          </button>
        </div> */}

        {title ? (
          <div className="px-5 pb-2">
            <div className="text-[28px] font-extrabold text-slate-900">{title}</div>
          </div>
        ) : null}
      </div>

      {/* 列表 */}
      <div className="px-0 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-[820px]">
          {items.map((it, idx) => {
            const last = it.messages?.[it.messages.length - 1]
			const dir = last?.from === "me" ? "out" : "in"
            const timeText = fmtListTime(
			last?.createdAt || it.beamio?.created_at || 0
			)
            const name = it.beamio ? displayName(it.beamio) : `${it.address.slice(0, 6)}…${it.address.slice(-4)}`

            const unread = Math.max(0, Number(it.unreadCount || 0))
            const muted = !!it.muted

            const isFailed = last?.from === "me" && last?.status === "failed"
            const subtitle = isFailed ? "Message Send Failure" : (last?.text?.trim() || "")

            return (
              <button
                key={it.address}
                type="button"
                onClick={() => onOpen?.(it)}
                className="w-full text-left active:bg-slate-50 transition"
              >
                <div className="px-4">
                  <div className="flex items-center gap-3 py-3.5">
                    <Avatar
					beamio={
						it.beamio || {
						address: it.address,
						created_at: 0,
						first_name: "",
						last_name: "",
						username: "",
						image: "",
						follow_count: "0",
						follower_count: "0"
						}
					}
					online={it.chatData?.online}
					/>

                    <div className="min-w-0 flex-1">
                      {/* 第一行：名字 + 时间 + chevron */}
                      <div className="flex items-center gap-2">
                        {/* tag 点 */}
                        <span
						className={[
							"h-2.5 w-2.5 rounded-full flex-shrink-0",
							unread > 0 ? tagColor(it.tag) : "bg-slate-300",
							muted ? "opacity-70" : ""
						].join(" ")}
						/>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
							className={[
								"truncate text-[16px] text-slate-900",
								unread > 0
								? "font-black"        // ✅ 未读：更重（iOS 行为）
								: "font-extrabold"    // 已读：正常
							].join(" ")}
							>
							{name}
							</div>

                            {/* ✅ muted 图标（iOS 类似小铃铛斜杠） */}
                            {muted && (
                              <span
                                className="inline-flex items-center text-slate-400 flex-shrink-0"
                                aria-label="Muted"
                                title="Muted"
                              >
                                <BellOff className="h-4 w-4" strokeWidth={2.4} />
                              </span>
                            )}

                            {/* ✅ pin */}
                            {it.pin && (
                              <span className="inline-flex items-center text-slate-400 flex-shrink-0" title="Pinned">
                                <PinIcon className="h-4 w-4" strokeWidth={2.6} />
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[12px] text-slate-400">{timeText}</span>
                          <ChevronRight className="h-5 w-5 text-slate-300" strokeWidth={2.6} />
                        </div>
                      </div>

                      {/* 第二行：预览 + 未读 badge */}
                      <div
					className={[
						"min-w-0 flex-1 text-[12px]",
						unread > 0 ? "text-slate-600" : "text-slate-500"
					].join(" ")}
					>
					<div className="flex items-center min-w-0">
						<span className="min-w-0 flex-1 truncate">
						{subtitle || " "}
						</span>

						{/* ✅ 方向箭头：对方(in)=↙，自己(out)=↗ */}
						<span className="flex-shrink-0 ml-2 ">
						{dir === "in" ? (
							<ArrowDownLeft className="h-4 w-4 text-[#1652f0]" strokeWidth={2.6} />
						) : (
							<ArrowUpRight className="h-4 w-4 text-slate-300" strokeWidth={2.6}  />
						)}
						</span>
					</div>
					</div>
                    </div>
                  </div>

                  {/* 分割线（模仿 iOS） */}
                  <div className="h-px bg-slate-200/80" />
                </div>

                {idx === items.length - 1 ? <div className="h-2" /> : null}
              </button>
            )
          })}

          {!items.length && (
            <div className="px-5 py-10 text-center text-slate-400 text-[14px]">
              No conversations yet
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
