import { IpfsImg } from '@/components/IpfsImg';
import React, { useMemo, useEffect, useRef, useCallback, useState } from "react"
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import {ethers} from 'ethers'
import {
	ChevronRight,
	Menu,
	Pin as PinIcon,
	BellOff,
	ArrowUpRight,
	ArrowDownLeft,
	AlertTriangle
} from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { checkSign, getKeysFromCoNETPGPSC, makeMessage, dedupeChatsByAddress, refreshChatRoutes } from '@/services/chat' 
import {searchUsername, storeSystemData} from '@/services/beamio'

type ChatListProps = {
  onOpen?: (item: chatData) => void
  onEdit?: () => void
  onMenu?: () => void
  title?: string
  /** Merchant Messages inbox: filter threads by display name / @tag / address */
  searchQuery?: string
  categoryFilter?: 'all' | 'members' | 'partners' | 'support'
  selectedAddress?: string | null
  variant?: 'ios' | 'merchant'
  /** All non-hidden chat threads (before category/search) — for empty-inbox / day-zero UI */
  onInboxTotalThreadCountChange?: (count: number) => void
}

const fmtAddr = (a = "") => ((a && a !== ethers.ZeroAddress) ? `${a.slice(0, 6)}…${a.slice(-4)}` : "")

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

const getImg = (avatarSeed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

const displayName = (item: searchResult) => {
	const lastname = item?.last_name?.split('\r\n')||[]
	const fullName = `${item?.first_name || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || item.username || item.address
}

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



function tagColor(tag: chatData["tag"]) {
	if (tag === "red") return "bg-rose-500"
	if (tag === "green") return "bg-emerald-500"
	return "bg-[#1652f0]"
}

function Avatar({
	address,
	beamio: beamioProp
}: {
	address: string
	beamio?: searchResult
	online?: boolean
}) {
	const {beamioUsers, setbBeamioUsers} = useDaemonContext()
	const [fromBeamio, setfromBeamio] = useState<searchResult|undefined> (beamioProp)
	const [userImg, setUserImg] = useState('')
	const [online, setOnline] = useState(false)

	const avatarSrc = useMemo(() => {
		if (!fromBeamio) return ""
		const img = (fromBeamio.image || "").trim()
		if (img) return img
		const seed = (fromBeamio.username || fromBeamio.address || "beamio").trim()
		return getImg(seed)
	  }, [fromBeamio])

	const findingRef = useRef(false)
	const findUser = useCallback(async () => {
		if (findingRef.current || !address) return
		findingRef.current = true
		try {
			// 与 Chat 一致：始终从 searchUsername 获取最新，不依赖 beamioUsers 缓存
			let account: searchResult|undefined
			const _account = await searchUsername(address)
			if (_account?.results?.[0]) {
				account = _account.results[0]
			} else {
				account = beamioUsers.find(n => (n?.address || '').toLowerCase() === address.toLowerCase()) ?? beamioProp ?? unknowAcc(address)
			}
			if (!account) account = unknowAcc(address)

			//@ts-ignore
			setbBeamioUsers(prev => {
				const addr = (account!.address || '').toLowerCase()
				//@ts-ignore
				if (prev.some(u => (u.address || '').toLowerCase() === addr)) return prev
				return [...prev, account!]
			})

			setfromBeamio(account)
			const img = (account.image || "").trim()
			setUserImg(img || getImg(account.username || account.address || "beamio"))
		} finally {
			findingRef.current = false
		}
	}, [address, beamioProp])

	useEffect(() => {
		if (beamioProp && (beamioProp.address || '').toLowerCase() === (address || '').toLowerCase()) {
			setfromBeamio(beamioProp)
			const img = (beamioProp.image || "").trim()
			setUserImg(img || getImg(beamioProp.username || beamioProp.address || "beamio"))
		}
		findUser()
	}, [address, findUser, beamioProp])
	return (
		<div className="relative h-12 w-12 flex-shrink-0">
		{avatarSrc ? (
			<IpfsImg
				key={avatarSrc}
				src={avatarSrc}
				alt=""
				className="h-12 w-12 rounded-full object-cover ring-1 ring-black/5"
			/>
		) : (
			<div className="h-12 w-12 rounded-full bg-[linear-gradient(180deg,#9db3d9_0%,#6f88be_100%)] grid place-items-center ring-1 ring-black/5">
			<span className="text-white font-semibold text-[16px] tracking-wide">
				{displayName(fromBeamio||unknowAcc(address))}
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


function categoryChipMatches(it: chatData, category: ChatListProps['categoryFilter']) {
	if (!category || category === 'all') return true
	if (category === 'members') return it.tag === 'green'
	if (category === 'partners') return it.tag === 'blue'
	if (category === 'support') return it.tag === 'red'
	return true
}

function searchMatchesThread(it: chatData, qRaw: string) {
	const q = (qRaw || '').trim().toLowerCase()
	if (!q) return true
	const addr = (it.address || '').toLowerCase()
	if (addr.includes(q)) return true
	const un = (it.beamio?.username || '').toLowerCase()
	if (un.includes(q)) return true
	const disp = `${it.beamio?.first_name || ''} ${it.beamio?.last_name || ''}`.toLowerCase()
	return disp.includes(q)
}

export default function ChatList({
	title = "",
	onOpen,
	searchQuery = '',
	categoryFilter = 'all',
	selectedAddress = null,
	variant = 'ios',
	onInboxTotalThreadCountChange,
}: ChatListProps) {
	const { profiles, setProfiles } = useDaemonContext()

	const allSortedThreads = useMemo(() => {
		const profile: profile = profiles?.[0]
		if (!profile) return []

		const list: chatData[] = Array.isArray(profile.chats)
			? profile.chats
			: profile.chats
				? (Object.values(profile.chats as Record<string, unknown>).filter(Boolean) as chatData[])
				: []

		const filtered = list.filter(
			x => x && !x.hide && typeof x.address === "string" && x.address.trim().length > 0
		)

		const deduped = dedupeChatsByAddress(filtered)

		return deduped
			.slice()
			.sort((a, b) => {
				const pa = a.pin ? 1 : 0
				const pb = b.pin ? 1 : 0
				if (pa !== pb) return pb - pa
				const ta = a.messages?.[a.messages.length - 1]?.createdAt ?? a.beamio?.created_at ?? 0
				const tb = b.messages?.[b.messages.length - 1]?.createdAt ?? b.beamio?.created_at ?? 0
				return tb - ta
			})
	}, [profiles])

	const items = useMemo(() => {
		return allSortedThreads
			.filter((it) => categoryChipMatches(it, categoryFilter))
			.filter((it) => searchMatchesThread(it, searchQuery))
	}, [allSortedThreads, categoryFilter, searchQuery])

	useEffect(() => {
		onInboxTotalThreadCountChange?.(allSortedThreads.length)
	}, [allSortedThreads.length, onInboxTotalThreadCountChange])

	// 每次进入时刷新每个 chat 的链上路由信息
	// ⚠️ 数据竞态修复：refreshChatRoutes 是 N 条 chat × RPC 的长耗时异步操作，
	// 期间 App.tsx::addNewMessage 可能 mutation 写入新 messages（参考用户 22 Apr 故障：
	// storage 有 4 条 messages 但 chat 窗口空白）。绝不能用 refreshChatRoutes 拍照
	// 出来的 updated.chats 整体覆盖 profile.chats —— 那会把 messages/unreadCount 回滚。
	// 正确做法：只提取 per-address 的 chatData patch，再用函数式 setProfiles 合并到最新 state。
	useEffect(() => {
		const p0 = profiles?.[0]
		if (!p0?.chats?.length || !p0.privateKeyArmor) return
		;(async () => {
			const updated = await refreshChatRoutes({ ...p0 })
			// changed=false（同引用）或 chats 异常缺失 → 直接退出
			if (!updated?.chats || updated.chats === p0.chats) return

			// 1) 收集 per-address 的 chatData patch
			const patchByAddr = new Map<string, NonNullable<chatData["chatData"]>>()
			for (const c of updated.chats) {
				const addr = String(c?.address || "").toLowerCase()
				if (!addr || !c?.chatData) continue
				patchByAddr.set(addr, c.chatData)
			}
			if (patchByAddr.size === 0) return

			// 2) 把 patch 应用到给定 chats 数组上（只改 chatData，保留 messages/unreadCount/tag/pin/...）
			const applyPatch = (chats: chatData[]): { next: chatData[]; changed: boolean } => {
				let changed = false
				const next = chats.map(c => {
					const addr = String(c?.address || "").toLowerCase()
					const newCd = patchByAddr.get(addr)
					if (!newCd) return c
					const oldCd = c.chatData
					if (
						oldCd &&
						oldCd.routersArmoreds === newCd.routersArmoreds &&
						oldCd.routePgpKeyID === newCd.routePgpKeyID &&
						oldCd.online === newCd.online &&
						oldCd.publicArmored === newCd.publicArmored
					) {
						return c
					}
					changed = true
					return { ...c, chatData: { ...(oldCd || {}), ...newCd } }
				})
				return { next, changed }
			}

			// 3) ✅ React state：函数式 setProfiles，基于最新 prev 应用 patch
			let appliedToReact = false
			setProfiles(prev => {
				if (!prev?.length) return prev
				const cur = prev[0]
				const chats = Array.isArray(cur?.chats) ? cur.chats : []
				const { next, changed } = applyPatch(chats)
				if (!changed) return prev
				appliedToReact = true
				const nextProfiles = [...prev]
				nextProfiles[0] = { ...cur, chats: next }
				return nextProfiles
			})

			// 4) ✅ CoNET_Data 快照：同样基于最新 base 应用 patch（storeSystemData 读这个）
			const temp = CoNET_Data
			if (temp?.profiles?.length) {
				const cur = temp.profiles[0]
				const chats = Array.isArray(cur?.chats) ? cur.chats : []
				const { next, changed } = applyPatch(chats)
				if (changed) {
					const nextProfiles = [...temp.profiles]
					nextProfiles[0] = { ...cur, chats: next }
					temp.profiles = nextProfiles
					setCoNET_Data(temp)
					await storeSystemData()
				}
			} else if (appliedToReact) {
				await storeSystemData()
			}
		})()
	}, [profiles, setProfiles])

	


  return (
    <div className={variant === 'merchant' ? 'min-h-0 min-w-0 bg-transparent' : 'min-h-full min-w-0 bg-[#F2F2F7]'}>
      {/* 顶部栏（贴近 iOS 列表页风格；父级已提供 刘海+3.5rem 留白，此处不再重复 safe-area） */}
      <div
        className={variant === 'merchant' ? 'hidden' : 'sticky top-0 z-20 bg-[#F2F2F7]/90 backdrop-blur-xl'}
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
      <div className={variant === 'merchant' ? 'pb-2' : 'px-4 pt-2 pb-[env(safe-area-inset-bottom)]'}>
        <div className={variant === 'merchant' ? 'mx-auto w-full min-w-0' : 'mx-auto w-full max-w-[820px] min-w-0'}>
          {items.map((it, idx) => {
            const last = it.messages?.[it.messages.length - 1]
			const dir = last ? (last.from === "me" ? "out" : "in") : null
            const timeText = fmtListTime(
				last?.createdAt || it.beamio?.created_at || 0
			)
            const name = it.beamio ? displayName(it.beamio) : `${it.address.slice(0, 6)}…${it.address.slice(-4)}`

            const unread = Math.max(0, Number(it.unreadCount || 0))
            const muted = !!it.muted
            const noRoute = !(it.chatData?.routersArmoreds?.trim())

            const isFailed = last?.from === "me" && last?.status === "failed"
            const subtitle = isFailed ? "Message Send Failure" : (last?.text?.trim() || "")
            const isSelected =
              !!selectedAddress &&
              String(it.address || '').toLowerCase() === String(selectedAddress).toLowerCase()

            return (
              <button
                key={it.address}
                type="button"
                onClick={async () => {
					const ps = Array.isArray(profiles) ? profiles : []
					const p0: profile = ps[0]
					const addr = String(it.address || "").toLowerCase()

					if (p0 && Array.isArray(p0.chats)) {
						const idx2 = p0.chats.findIndex(c => String(c?.address || "").toLowerCase() === addr)
						if (idx2 >= 0) {
							const nextChats = [...p0.chats]
							nextChats[idx2] = { ...nextChats[idx2], unreadCount: 0, lastReadTs: Date.now() }

							const nextProfile = { ...p0, chats: nextChats }
							const nextProfiles = [...ps]
							nextProfiles[0] = nextProfile

							// 1) UI state
							setProfiles(nextProfiles)

							// 2) ✅ 同步全局快照（storeSystemData 读这个）
							const temp = CoNET_Data
							if (temp) {
								temp.profiles = nextProfiles
								setCoNET_Data(temp)
							}

							// 3) 持久化
							await storeSystemData()
						}
					}

					onOpen?.(it)
				}}
                className={[
                  "w-full min-w-0 max-w-full text-left transition overflow-hidden",
                  variant === 'merchant'
                    ? [
                        'relative mb-4 rounded-lg border p-5 shadow-sm',
                        isSelected
                          ? 'border-[#1562f0]/20 bg-slate-50'
                          : 'border-transparent bg-white hover:bg-slate-50 dark:bg-slate-900/40 dark:hover:bg-slate-800/60',
                        noRoute ? 'ring-2 ring-amber-400/50' : '',
                      ].filter(Boolean).join(' ')
                    : [
                        'mb-3 rounded-2xl bg-white shadow-sm',
                        'active:scale-[0.98] active:bg-slate-50/80',
                        noRoute ? 'ring-2 ring-amber-400/50' : '',
                      ].filter(Boolean).join(' '),
                ].filter(Boolean).join(" ")}
              >
                {variant === 'merchant' && isSelected ? (
                  <div className="absolute left-0 top-0 h-full w-1 bg-[#1562f0]" aria-hidden />
                ) : null}
                <div className={variant === 'merchant' ? 'min-w-0 overflow-hidden' : 'px-4 min-w-0 overflow-hidden'}>
                  <div className={`flex items-center gap-3 ${variant === 'merchant' ? 'py-0' : 'py-3.5'}`}>
                    <Avatar
						address={it.address}
						beamio={it.beamio}
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

                            {/* ✅ 无路由信息：黄色警告 */}
                            {noRoute && (
                              <span
                                className="inline-flex items-center text-amber-500 flex-shrink-0"
                                aria-label="No route"
                                title="No route info – message may not be delivered"
                              >
                                <AlertTriangle className="h-4 w-4" strokeWidth={2.4} />
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`${variant === 'merchant' ? 'text-[10px] font-bold uppercase tracking-wide text-[#1562f0]' : 'text-[12px] text-slate-400'}`}>{timeText}</span>
                          {variant === 'ios' ? <ChevronRight className="h-5 w-5 text-slate-300" strokeWidth={2.6} /> : null}
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
						{dir && (
							<span className="flex-shrink-0 ml-2">
								{dir === "in" ? (
								<ArrowDownLeft className="h-4 w-4 text-[#1652f0]" strokeWidth={2.6} />
								) : (
								<ArrowUpRight className="h-4 w-4 text-slate-300" strokeWidth={2.6} />
								)}
							</span>
						)}
					</div>
					</div>
                    </div>
                  </div>
                </div>
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
