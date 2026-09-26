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
import { useBeamioTagDatabase } from "@/providers/BeamioTagDatabaseProvider"
import { dedupeChatsByAddress, refreshChatRoutes } from '@/services/chat' 
import {storeSystemData} from '@/services/beamio'
import { tu } from '@/locale/beamioLocale'
import { chatShareLinkListPreview } from '@/utils/chatShareLinkPreview'
import { chatGenericLinkListPreview } from '@/utils/chatGenericLinkPreview'
import { isVoiceCallOfferActive, parseVoiceCallSignal } from '@/utils/voiceCallSession'
import { isCashTreesNativeWebView } from '@/utils/cashTreesNativeNfc'

// 注意：不再接受 `list` prop。ChatList 内部直接从 useDaemonContext().profiles[0].chats
// 读取并通过 useMemo 派生 items，避免与 profile.chats 出现两个数据源不一致的风险
// （历史 bug：index.tsx 错传 `list={profiles[0]?.chat}` typo 导致死代码）。
type ChatListProps = {
  onOpen?: (item: chatData, options?: { autoVoiceCallAction?: 'accept' | 'reject' }) => void
  onEdit?: () => void
  onMenu?: () => void
  title?: string
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
  if (diff === oneDay) return tu('yesterday')

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

/** Prefer @beamioTag; never show a raw 42-char address as the primary chat title. */
const formatChatListTitle = (beamio: searchResult | undefined | null, address: string): string => {
	const u = (beamio?.username || '').trim()
	if (u && u !== '未知') return u.startsWith('@') ? u : `@${u}`
	const lastname = beamio?.last_name?.split('\r\n') || []
	const fullName = `${beamio?.first_name || ''} ${/^\{/.test(lastname[0] || '') ? '' : lastname[0] || ''}`.trim()
	if (fullName) return fullName
	return fmtAddr(address)
}

const unknowAcc = (address: string):searchResult => {
	const ret: searchResult = {
		address,
		created_at: 0,
		first_name: '',
		last_name: '',
		follow_count: '',
		follower_count: '',
		username: '未知',
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
	beamio: beamioProp,
	online = false,
}: {
	address: string
	beamio?: searchResult
	online?: boolean
}) {
	const {beamioUsers, setbBeamioUsers} = useDaemonContext()
	const { resolvePeerSearchResult, ensureProfilesForAddresses } = useBeamioTagDatabase()
	const [fromBeamio, setfromBeamio] = useState<searchResult|undefined> (beamioProp)
	const [userImg, setUserImg] = useState('')

	const avatarSrc = useMemo(() => {
		if (!fromBeamio) return ""
		const img = (fromBeamio.image || "").trim()
		if (img) return img
		const seed = (fromBeamio.username || fromBeamio.address || "beamio").trim()
		return getImg(seed)
	  }, [fromBeamio])

	const findingRef = useRef(false)
	const profileUsername = beamioProp?.username || ""
	const profileImage = (beamioProp?.image || "").trim()
	const tagApiRef = useRef({
		ensureProfilesForAddresses,
		resolvePeerSearchResult,
		beamioUsers,
		setbBeamioUsers,
		beamioProp,
	})
	tagApiRef.current = {
		ensureProfilesForAddresses,
		resolvePeerSearchResult,
		beamioUsers,
		setbBeamioUsers,
		beamioProp,
	}

	useEffect(() => {
		if (!address) return
		let cancelled = false
		const run = async () => {
			if (findingRef.current) return
			findingRef.current = true
			try {
				const api = tagApiRef.current
				const seeded =
					api.beamioProp &&
					(api.beamioProp.address || "").toLowerCase() === address.toLowerCase()
						? api.beamioProp
						: undefined
				if (seeded) {
					setfromBeamio((prev) =>
						prev?.username === seeded.username && (prev?.image || "") === (seeded.image || "")
							? prev
							: seeded,
					)
					const seededImg = (seeded.image || "").trim()
					setUserImg(seededImg || getImg(seeded.username || seeded.address || "beamio"))
				}
				const known = api.resolvePeerSearchResult(address)
				if (!known?.username?.trim()) {
					await api.ensureProfilesForAddresses([address])
				}
				if (cancelled) return
				const latest = tagApiRef.current
				const account =
					latest.resolvePeerSearchResult(address) ??
					latest.beamioUsers.find(n => (n?.address || "").toLowerCase() === address.toLowerCase()) ??
					seeded ??
					unknowAcc(address)
				const setUsers = latest.setbBeamioUsers as unknown as React.Dispatch<React.SetStateAction<searchResult[]>>
				setUsers(prev => {
					const addr = (account.address || "").toLowerCase()
					if (prev.some(u => (u.address || "").toLowerCase() === addr)) return prev
					return [...prev, account]
				})
				setfromBeamio((prev) =>
					prev?.username === account.username && (prev?.image || "") === (account.image || "")
						? prev
						: account,
				)
				const img = (account.image || "").trim()
				setUserImg(img || getImg(account.username || account.address || "beamio"))
			} finally {
				findingRef.current = false
			}
		}
		void run()
		return () => {
			cancelled = true
		}
	}, [address, profileUsername, profileImage])
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


export default function ChatList({
	title = "",
	onOpen
}: ChatListProps) {
	const { profiles, setProfiles } = useDaemonContext()
	const { resolvePeerSearchResult, ensureProfilesForAddresses, profileMap } = useBeamioTagDatabase()
	const routeRefreshAtRef = useRef(0)
	const tagEnrichAtRef = useRef(0)
	const [browserCallMuted, setBrowserCallMuted] = useState(false)
	const touchGestureRef = useRef<{
		address: string
		x: number
		y: number
		cancelled: boolean
	} | null>(null)
	const suppressSyntheticClickUntilRef = useRef(0)

	const applyChatDataPatches = useCallback(
		async (patchByAddr: Map<string, NonNullable<chatData["chatData"]>>) => {
			if (patchByAddr.size === 0) return

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
		},
		[setProfiles],
	)

	// 进入 /chat：只刷新链上路由。在线状态读全局 BeamioTag 记录（本地优先，180 秒补网）。
	// ⚠️ 数据竞态：只合并 chatData patch，不得用整表覆盖 messages/unreadCount。
	useEffect(() => {
		const p0 = profiles?.[0]
		if (!p0?.chats?.length || !p0.privateKeyArmor) return
		let cancelled = false
		;(async () => {
			const now = Date.now()
			if (now - routeRefreshAtRef.current > 20_000) {
				routeRefreshAtRef.current = now
				const updated = await refreshChatRoutes({ ...p0 })
				if (cancelled) return
				if (updated?.chats && updated.chats !== p0.chats) {
					const patchByAddr = new Map<string, NonNullable<chatData["chatData"]>>()
					for (const c of updated.chats) {
						const addr = String(c?.address || "").toLowerCase()
						if (!addr || !c?.chatData) continue
						patchByAddr.set(addr, c.chatData)
					}
					await applyChatDataPatches(patchByAddr)
				}
			}
		})()
		return () => {
			cancelled = true
		}
	}, [profiles, setProfiles, applyChatDataPatches])

	const items = useMemo(() => {
		const profile: profile = profiles?.[0]
		if (!profile) return []

		// ✅ profile.chats 可能不是数组，先规范化成 chatData[]
		const list: chatData[] = Array.isArray(profile.chats)
			? profile.chats
			: profile.chats
				? (Object.values(profile.chats as Record<string, unknown>).filter(Boolean) as chatData[])
				: []

		// 过滤：有效、未隐藏、有 address
		const filtered = list.filter(
			x => x && !x.hide && typeof x.address === "string" && x.address.trim().length > 0
		)

		// 与 chat.ts 一致：按 address 去重（小写、每地址只保留一项）
		const deduped = dedupeChatsByAddress(filtered)

		// 排序：置顶优先，再按最后一条消息时间倒序
		const sorted = deduped
			.slice()
			.sort((a, b) => {
				const pa = a.pin ? 1 : 0
				const pb = b.pin ? 1 : 0
				if (pa !== pb) return pb - pa
				const ta = a.messages?.[a.messages.length - 1]?.createdAt ?? a.beamio?.created_at ?? 0
				const tb = b.messages?.[b.messages.length - 1]?.createdAt ?? b.beamio?.created_at ?? 0
				return tb - ta
			})

		return sorted
	}, [profiles])

	const browserIncomingCall = useMemo(() => {
		if (isCashTreesNativeWebView()) return null
		for (const item of items) {
			const last = item.messages?.[item.messages.length - 1]
			const signal = last?.from === 'them' && last.text ? parseVoiceCallSignal(last.text) : null
			if (signal?.type === 'voice_call_offer_v1' && isVoiceCallOfferActive(signal)) {
				return { item, signal }
			}
		}
		return null
	}, [items])

	// After recover / history restore, chats often only have EOA stubs — hydrate @beamioTag from Tag DB + remote.
	useEffect(() => {
		if (!items.length) return
		const addrs = items
			.map(c => String(c.address || '').trim())
			.filter(a => /^0x[a-fA-F0-9]{40}$/i.test(a))
		if (!addrs.length) return
		const needFetch = addrs.filter(a => {
			const peer = resolvePeerSearchResult(a)
			const u = (peer?.username || '').trim()
			return !u || u === '未知'
		})
		if (!needFetch.length) return
		const now = Date.now()
		if (now - tagEnrichAtRef.current < 8_000) return
		tagEnrichAtRef.current = now
		void ensureProfilesForAddresses(needFetch, { maxPerTick: 28 }).catch(() => {})
	}, [items, ensureProfilesForAddresses, resolvePeerSearchResult, profileMap])

	// Sync Tag DB → chat.beamio so list titles / Avatars keep @tag after refresh.
	useEffect(() => {
		if (!items.length || !profileMap) return
		setProfiles(prev => {
			if (!prev?.length) return prev
			const cur = prev[0]
			const chats = Array.isArray(cur?.chats) ? cur.chats : []
			if (!chats.length) return prev
			let changed = false
			const nextChats = chats.map(c => {
				const addr = String(c?.address || '').trim()
				if (!/^0x[a-fA-F0-9]{40}$/i.test(addr)) return c
				const peer = resolvePeerSearchResult(addr)
				const u = (peer?.username || '').trim()
				if (!u || u === '未知') return c
				const curU = (c.beamio?.username || '').trim()
				if (curU === u || curU === `@${u}` || `@${curU}` === u) {
					const needName =
						(!(c.beamio?.first_name || '').trim() && (peer?.first_name || '').trim()) ||
						(!(c.beamio?.last_name || '').trim() && (peer?.last_name || '').trim())
					if (!needName && (c.beamio?.image || '') === (peer?.image || c.beamio?.image || '')) {
						return c
					}
				}
				changed = true
				return {
					...c,
					beamio: {
						...(c.beamio || {}),
						...peer,
						address: addr,
						username: u.startsWith('@') ? u.slice(1) : u,
					},
				}
			})
			if (!changed) return prev
			const nextProfiles = [...prev]
			nextProfiles[0] = { ...cur, chats: nextChats }
			const temp = CoNET_Data
			if (temp) {
				temp.profiles = nextProfiles
				setCoNET_Data(temp)
			}
			void storeSystemData().catch(() => {})
			return nextProfiles
		})
	}, [items, profileMap, resolvePeerSearchResult, setProfiles])

	


	const openConversation = useCallback((item: chatData) => {
		const ps = Array.isArray(profiles) ? profiles : []
		const p0: profile = ps[0]
		const addr = String(item.address || "").toLowerCase()
		let shouldPersistReadState = false

		if (p0 && Array.isArray(p0.chats)) {
			const idx = p0.chats.findIndex(c => String(c?.address || "").toLowerCase() === addr)
			if (idx >= 0) {
				const nextChats = [...p0.chats]
				nextChats[idx] = { ...nextChats[idx], unreadCount: 0, lastReadTs: Date.now() }

				const nextProfiles = [...ps]
				nextProfiles[0] = { ...p0, chats: nextChats }
				setProfiles(nextProfiles)

				const temp = CoNET_Data
				if (temp) {
					temp.profiles = nextProfiles
					setCoNET_Data(temp)
				}
				shouldPersistReadState = true
			}
		}

		// Navigation is the tap's synchronous result. Persistence stays off the critical path.
		onOpen?.(item)

		if (shouldPersistReadState) {
			void storeSystemData().catch(error => {
				console.warn('[ChatList] Failed to persist read state', error)
			})
		}
	}, [onOpen, profiles, setProfiles])

  return (
    <div className="min-h-full min-w-0 bg-[#F1F8ED]">
      {browserIncomingCall ? (
        <div className="pointer-events-none fixed inset-x-4 top-[max(5rem,calc(env(safe-area-inset-top)+4.5rem))] z-[130] mx-auto max-w-lg">
          <div className="pointer-events-auto rounded-3xl border border-[#dce2f7] bg-white/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.22)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Avatar address={browserIncomingCall.item.address} beamio={browserIncomingCall.item.beamio} online />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {formatChatListTitle(browserIncomingCall.item.beamio, browserIncomingCall.item.address)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">Incoming voice call</p>
              </div>
              <button
                type="button"
                onClick={() => setBrowserCallMuted((value) => !value)}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                aria-pressed={browserCallMuted}
              >
                {browserCallMuted ? 'Unmute' : 'Mute'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onOpen?.(browserIncomingCall.item, { autoVoiceCallAction: 'reject' })}
                className="rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => onOpen?.(browserIncomingCall.item, { autoVoiceCallAction: 'accept' })}
                className="rounded-full bg-[#1562f0] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {/* 顶部栏（贴近 iOS 列表页风格；父级已提供 刘海+3.5rem 留白，此处不再重复 safe-area） */}
      <div
        className="sticky top-0 z-20 bg-[#F1F8ED]/90 backdrop-blur-xl"
      >
        {/* <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onEdit}
            className="h-10 px-4 rounded-full bg-slate-100 text-slate-900 text-[18px] font-medium active:scale-[0.98] transition"
          >{tu('edit')}</button>

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
      <div className="px-4 pt-2 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-[820px] min-w-0">
          {items.map((it, idx) => {
            const last = it.messages?.[it.messages.length - 1]
			const dir = last ? (last.from === "me" ? "out" : "in") : null
            const timeText = fmtListTime(
				last?.createdAt || it.beamio?.created_at || 0
			)
            const name = formatChatListTitle(
				(() => {
					const fromDb = resolvePeerSearchResult(it.address)
					if (fromDb) return fromDb
					return it.beamio
				})(),
				it.address,
			)
            const listBeamio =
				resolvePeerSearchResult(it.address) || it.beamio || undefined

            const unread = Math.max(0, Number(it.unreadCount || 0))
            const muted = !!it.muted
            const noRoute = !(it.chatData?.routersArmoreds?.trim())

            const isFailed = last?.from === "me" && last?.status === "failed"
            const rawLast = last?.text?.trim() || ""
            const voiceSignal = rawLast ? parseVoiceCallSignal(rawLast) : null
            const voicePreview = voiceSignal
              ? voiceSignal.type === 'voice_call_offer_v1'
                ? 'Incoming voice call'
                : voiceSignal.type === 'voice_call_accept_v1'
                  ? 'Voice call answered'
                  : voiceSignal.type === 'voice_call_reject_v1'
                    ? 'Voice call declined'
                    : 'Voice call ended'
              : null
            const sharePreview = !voicePreview && rawLast ? chatShareLinkListPreview(rawLast) : null
            const genericPreview =
              !voicePreview && !sharePreview && rawLast ? chatGenericLinkListPreview(rawLast) : null
            const subtitle = isFailed
              ? "Message Send Failure"
              : voicePreview || sharePreview || genericPreview || rawLast

            return (
              <button
                key={it.address}
                type="button"
				onTouchStart={event => {
					const touch = event.changedTouches[0]
					if (!touch || event.touches.length !== 1) {
						touchGestureRef.current = null
						return
					}
					// WKWebView can defer or drop the synthetic click inside a momentum scroll view.
					// Handle a stationary touch on touchend and suppress its later synthetic click.
					suppressSyntheticClickUntilRef.current = Date.now() + 1_200
					touchGestureRef.current = {
						address: String(it.address || "").toLowerCase(),
						x: touch.clientX,
						y: touch.clientY,
						cancelled: false,
					}
				}}
				onTouchMove={event => {
					const gesture = touchGestureRef.current
					const touch = event.changedTouches[0]
					if (!gesture || !touch) return
					if (
						Math.abs(touch.clientX - gesture.x) > 10 ||
						Math.abs(touch.clientY - gesture.y) > 10
					) {
						gesture.cancelled = true
					}
				}}
				onTouchCancel={() => {
					touchGestureRef.current = null
				}}
				onTouchEnd={event => {
					const gesture = touchGestureRef.current
					touchGestureRef.current = null
					const address = String(it.address || "").toLowerCase()
					if (!gesture || gesture.cancelled || gesture.address !== address) return
					event.preventDefault()
					openConversation(it)
				}}
                onClick={() => {
					if (Date.now() < suppressSyntheticClickUntilRef.current) return
					openConversation(it)
				}}
                className={[
                  "w-full min-w-0 max-w-full touch-manipulation select-none text-left transition-[transform,background-color] duration-150 overflow-hidden",
                  "mb-3 rounded-2xl bg-white shadow-sm",
                  "active:scale-[0.98] active:bg-slate-50/80",
                  noRoute ? "ring-2 ring-amber-400/50" : ""
                ].filter(Boolean).join(" ")}
              >
                <div className="px-4 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-3 py-3.5">
                    <Avatar
						address={it.address}
						beamio={listBeamio}
						online={typeof profileMap[String(it.address || '').toLowerCase()]?.online === 'boolean'
							? !!profileMap[String(it.address || '').toLowerCase()]?.online
							: !!it.chatData?.online}
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
