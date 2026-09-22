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
		setShowFooter,
		setMessageCount,
		allNodes, chatHomeItem, setChatHomeItem,
  	} = useDaemonContext()
	const { resolveTagPlain, avatarImgUrl } = useBeamioTagDatabase()
	const [chatData, setChatData] = useState<chatData> ()
	const [autoVoiceCallAction, setAutoVoiceCallAction] = useState<'accept' | 'reject' | null>(null)
	const [privateKey, setPrivate] = useState('')
	const didInitRef = useRef(false)
	const {
		onScroll: onCapsuleScroll,
		setRef: setScrollRef,
		setLayerRef: setChatCapsuleLayerRef,
	} = useScrollCapsuleOpacity(!chatData)
	const ownEoa = profiles?.[0]?.keyID?.trim() ?? ''
	const resolvedOwnTag = resolveTagPlain(ownEoa)
	const ownTag = resolvedOwnTag || '@Beamio'
	const ownAvatar = avatarImgUrl(undefined, ownEoa)



	// 初始化：设置 profile、显示 footer
	useEffect(() => {
		const profile: profile | undefined = profiles?.[0]
		if (!profile) return
		if (didInitRef.current) return
		didInitRef.current = true
		setPrivate(profile.privateKeyArmor)
		setShowFooter(true)
	}, [profiles, setShowFooter])

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
		{/* ✅ 当没选中聊天对象时：固定胶囊 + ChatList */}
		{!chatData && (
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
							// User picked another thread from the list — drop Discover return target.
							const state = location.state as ChatRouteLocationState
							if (state?.chatBackToDiscoverMerchantCard) {
								navigate(location.pathname, { replace: true, state: {} })
							}
							setAutoVoiceCallAction(options?.autoVoiceCallAction ?? null)
							setChatData(item)      // ✅ 打开某个会话
							setShowFooter(false)
						}}
					/>
				</div>
			</>
		)}

		{/* ✅ 选中后：Chat 全屏浮层 */}
		{chatData && (
			<Chat
				onBack={() => {
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
				chatData={chatData}
				allNodes={allNodes}
				privateKey={privateKey}
				autoVoiceCallAction={autoVoiceCallAction}
			/>
		)}
		</div>
	)
}

export default Home
