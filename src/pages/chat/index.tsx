import { useDaemonContext } from "@/providers/DaemonProvider"
import {
	initMessage, dedupeChatsByAddress
} from '@/services/chat'

import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useScrollCapsuleOpacity } from "@/hooks/useScrollCapsuleOpacity"
import Chat from './chat'

import ChatList from './components/ChatList'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'

type ChatRouteLocationState = {
	chatBackToDiscoverMerchantCard?: string
	discoverDetailReturnTo?: string
	autoVoiceCallAction?: 'accept' | 'reject'
} | null

const Home = () => {
	const navigate = useNavigate()
	const location = useLocation()
	const {
		profiles,
		beamio,
		setShowFooter,
		setMessageCount,
		allNodes, chatHomeItem, setChatHomeItem,
  	} = useDaemonContext()
	const { resolveTagPlain, avatarImgUrl } = useBeamioTagDatabase()
	const [chatData, setChatData] = useState<chatData> ()
	const [autoVoiceCallAction, setAutoVoiceCallAction] = useState<'accept' | 'reject' | null>(null)
	const [voiceCallActive, setVoiceCallActive] = useState(false)
	const [threadHidden, setThreadHidden] = useState(false)
	const [privateKey, setPrivate] = useState('')
	const didInitRef = useRef(false)
	const {
		onScroll: onCapsuleScroll,
		setRef: setScrollRef,
		setLayerRef: setChatCapsuleLayerRef,
	} = useScrollCapsuleOpacity(!chatData || threadHidden)
	const ownEoa = profiles?.[0]?.keyID?.trim() ?? ''
	// The signed-in tag lives on the wallet profile. The tag database is only a
	// lookup for other addresses and is empty until that address has been searched.
	const accountTag = (beamio?.accountName ?? '').trim().replace(/^@+/, '')
	const resolvedOwnTag = resolveTagPlain(ownEoa).replace(/^@+/, '')
	const plainTag = accountTag || resolvedOwnTag
	const ownTag = plainTag ? `@${plainTag}` : '@Beamio'
	const profileImage = beamio?.image != null ? String(beamio.image).trim() : ''
	const ownAvatar = profileImage || avatarImgUrl(plainTag || undefined, ownEoa)



	// 初始化：设置 profile、显示 footer
	useEffect(() => {
		const profile: profile | undefined = profiles?.[0]
		if (!profile) return
		if (didInitRef.current) return
		didInitRef.current = true
		setPrivate(profile.privateKeyArmor)
	}, [profiles])

	useEffect(() => {
		if (location.pathname.toLowerCase() !== '/chat' || chatData) return
		setShowFooter(true)
	}, [chatData, location.pathname, setShowFooter])

	useEffect(() => {
		if (voiceCallActive || !threadHidden) return
		setThreadHidden(false)
		setChatData(undefined)
		setShowFooter(true)
	}, [setShowFooter, threadHidden, voiceCallActive])

	// 从全局 Search 选中用户后：chatHomeItem 由 App 设置并 navigate('/chat')，此处统一处理
	useEffect(() => {
		const profile: profile | undefined = profiles?.[0]
		if (!profile || !chatHomeItem) return
		selectedItemProcess(chatHomeItem)
		setChatHomeItem(null)
	}, [chatHomeItem])

	const selectedItemProcess = async (item11: searchResult) => {
		const profile: profile = profiles?.[0]
		if (!profile||chatData?.address) {
			return
		}

		const chatData1 = await initMessage(profile, item11)
		if (!chatData1) return

		setAutoVoiceCallAction((location.state as ChatRouteLocationState)?.autoVoiceCallAction ?? null)
		setChatData({...chatData1})
		setShowFooter(false)
	}


  return (
		<div className="w-full h-full min-h-0 h-screen bg-[#F1F8ED] overflow-hidden relative flex flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
		{/* ✅ 当没选中聊天对象时：固定胶囊 + ChatList。通话进行中返回列表时仍保留会话，避免卸掉通话。 */}
		{(!chatData || threadHidden) && (
			<>
				{/* 与 Home / Wallet / Discover：Footer 同款图标 + 胶囊样式，随滚动渐隐 */}
				<div
					ref={setChatCapsuleLayerRef}
					className="fixed left-4 right-4 z-40 flex items-center justify-start transition-opacity duration-300"
					style={{
						top: 'max(1rem, env(safe-area-inset-top, 0px))',
					}}
					aria-hidden
				>
					<div className="flex items-center gap-2.5 rounded-full border border-slate-100/90 bg-white py-2 pl-2 pr-4 shadow-[0_4px_24px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-slate-800">
						<img
							src={ownAvatar}
							alt=""
							className="h-10 w-10 shrink-0 rounded-full object-cover"
						/>
						<span className="max-w-[12rem] truncate text-[15px] font-bold tracking-tight text-[#0F172A] dark:text-slate-100">
							{ownTag.startsWith('@') ? ownTag : `@${ownTag}`}
						</span>
					</div>
				</div>

				{/* 滚动容器：与 Home / Wallet 一致 */}
				<div
					ref={setScrollRef}
					onScroll={onCapsuleScroll}
					className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[#F1F8ED] pb-[env(safe-area-inset-bottom)]"
					style={{ WebkitOverflowScrolling: 'touch', flex: '1 1 0%', minHeight: 0 }}
				>
					<div
						className="shrink-0"
						style={{ minHeight: 'calc(max(1rem, env(safe-area-inset-top, 0px)) + 5rem)' }}
					/>
					<ChatList
						title="" // 你如果不要 tu('messages') 大标题就留空
						onOpen={(item, options) => {
							if (voiceCallActive) {
								setThreadHidden(false)
								setShowFooter(false)
								return
							}
							// User picked another thread from the list — drop Discover return target.
							const state = location.state as ChatRouteLocationState
							if (state?.chatBackToDiscoverMerchantCard) {
								navigate(location.pathname, { replace: true, state: {} })
							}
							setAutoVoiceCallAction(options?.autoVoiceCallAction ?? null)
							setChatData(item)
							setThreadHidden(false)
							setShowFooter(false)
						}}
					/>
				</div>
			</>
		)}

		{/* ✅ 选中后：Chat 全屏浮层 */}
		{chatData && (
			<div className={threadHidden ? 'hidden' : 'contents'} aria-hidden={threadHidden}>
			<Chat
				onBack={() => {
					if (voiceCallActive) {
						setThreadHidden(true)
						setShowFooter(true)
						return
					}
					const state = location.state as ChatRouteLocationState
					setAutoVoiceCallAction(null)
					const backCard = state?.chatBackToDiscoverMerchantCard?.trim() ?? ''
					const returnTo = state?.discoverDetailReturnTo?.trim()
					setChatData(undefined)
					setMessageCount(0)
					if (backCard) {
						navigate('/discover', {
							replace: true,
							state: {
								openDiscoverMerchantCard: backCard,
								...(returnTo && returnTo.startsWith('/')
									? { discoverDetailReturnTo: returnTo }
									: {}),
							},
						})
						return
					}
					setShowFooter(true)
				}}
				onVoiceCallActive={setVoiceCallActive}
				onShowThread={() => {
					setThreadHidden(false)
					setShowFooter(false)
				}}
				threadHidden={threadHidden}
				chatData={chatData}
				allNodes={allNodes}
				privateKey={privateKey}
				autoVoiceCallAction={autoVoiceCallAction}
			/>
			</div>
		)}
		</div>
	)
}

export default Home
