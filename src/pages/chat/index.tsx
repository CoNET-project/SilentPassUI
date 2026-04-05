import { useDaemonContext } from "@/providers/DaemonProvider"
import { initMessage } from '@/services/chat'

import { useEffect, useRef, useState } from "react"
import { useScrollCapsuleOpacity } from "@/hooks/useScrollCapsuleOpacity"
import Chat from './chat'

import ChatList from './components/ChatList'

const Home = () => {
	const {
		profiles,
		setShowFooter,
		setMessageCount,
		allNodes, chatHomeItem, setChatHomeItem,
  	} = useDaemonContext()
	const [chatData, setChatData] = useState<chatData> ()
	const [privateKey, setPrivate] = useState('')
	const didInitRef = useRef(false)
	const { opacity: capsuleOpacity, onScroll: onCapsuleScroll, setRef: setScrollRef } = useScrollCapsuleOpacity(!chatData)



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

		setChatData({...chatData1})
		setShowFooter(false)
	}


  return (
		<div className="w-full h-full min-h-0 h-screen bg-[#F2F2F7] overflow-hidden relative flex flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
		{/* ✅ 当没选中聊天对象时：固定胶囊 + ChatList */}
		{!chatData && (
			<>
				{/* 固定独立胶囊：Title，与 Home/History 一致，随滚动渐隐 */}
				<div
					className="fixed left-0 right-0 z-30 flex items-center justify-between px-5 transition-opacity duration-300"
					style={{ top: 'max(1rem, env(safe-area-inset-top))', opacity: capsuleOpacity, pointerEvents: capsuleOpacity < 0.05 ? 'none' : 'auto' }}
				>
					<div className="px-4 py-2 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full shadow-sm border border-gray-200/80 dark:border-slate-600/50">
						<h1 className="text-lg font-bold text-black dark:text-slate-100 tracking-tight">Chat</h1>
					</div>
				</div>

				{/* 滚动容器：与 Home 一致，flex-1 直接子元素，ref+onScroll 绑定此处 */}
				<div ref={setScrollRef} onScroll={onCapsuleScroll} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#F2F2F7] pb-[env(safe-area-inset-bottom)]">
					{/* 顶部留白：刘海 + 5rem，统一各页首内容距顶距离 */}
					<div className="shrink-0" style={{ minHeight: 'calc(env(safe-area-inset-top) + 4rem)' }} />
					<ChatList
						title=""
						onOpen={item => {
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
					setChatData(undefined)
					setShowFooter(true)
					setMessageCount(0)
				}}
				chatData={chatData}
				allNodes={allNodes}
				privateKey={privateKey}
			/>
		)}
		</div>
  )
}

export default Home
