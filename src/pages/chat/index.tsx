
import { useDaemonContext } from "@/providers/DaemonProvider"
import {
	initMessage
} from '@/services/chat'

import { useEffect, useRef, useState } from "react"
import SearchInputWithDropdown from '@/components/Home/SearchBarWithResults'
import ScanBtn from '@/components/scanBtn/ScanButton'
import Chat from './chat'

import ChatList from './components/ChatList'

const Home = () => {
	const {
		profiles,
		setShowFooter,
		allNodes, chatHomeItem,setChatHomeItem,
  	} = useDaemonContext()
	const [chatData, setChatData] = useState<chatData> ()
	const [privateKey, setPrivate] = useState('')
	const didInitRef = useRef(false)


useEffect(() => {
	if (didInitRef.current) return

	const profile: profile | undefined = profiles?.[0]
	if (!profile) return

	didInitRef.current = true

	setPrivate(profile.privateKeyArmor)
	setShowFooter(true)

	if (chatHomeItem) {
		selectedItemProcess(chatHomeItem)
		setChatHomeItem(null)
	}
}, [profiles, chatHomeItem, setShowFooter])

	const selectedItemProcess = async (item11: searchResult) => {
		const profile: profile = profiles?.[0]
		if (!profile||chatData?.address) {
			return
		}

		const chatData1 = await initMessage(profile, item11)
		if (!chatData1) return

		setChatData({...chatData1})

	}


  return (
		<div className="pt-[calc(env(safe-area-inset-top)+1rem)] h-full">
		{/* ✅ 当没选中聊天对象时：搜索 + ChatList */}
		{!chatData && (
			<div className="h-full flex flex-col text-slate-900">
				{/* 顶部：Search */}
				<div className="px-5 pb-2">
					<div className="relative mb-4 mt-4">
					<SearchInputWithDropdown
						showHistory={false}
						closeWindow={item => {
						if (typeof item !== "string") {
							selectedItemProcess(item)
							setShowFooter(false)
						}
						}}
						showBackIcon={false}
						select={true}
						focus={true}
					/>


					{/* 扫码按钮：浮在右侧 */}
					<div
						className="
						absolute top-1/2 -translate-y-1/2 right-2
						h-9 w-9 rounded-full bg-slate-100
						flex items-center justify-center
						text-slate-500 text-xs
						"
					>
						<ScanBtn />
					</div>
					</div>
				</div>

				{/* ✅ 列表：占满剩余高度 */}
				<div className="flex-1 min-h-0 overflow-hidden">
					<div className="h-full overflow-y-auto">
						<ChatList
						// 这里你传你维护的 chat list（通常是 profile.chat）
						list={profiles?.[0]?.chat || []}
						title="" // 你如果不要 “Messages” 大标题就留空
						onOpen={item => {
							setChatData(item)      // ✅ 打开某个会话
							setShowFooter(false)
						}}
						/>
					</div>
				</div>
			</div>
		)}

		{/* ✅ 选中后：Chat 全屏浮层 */}
		{chatData && (
			<Chat
				onBack={() => {
					setChatData(undefined)
					setShowFooter(true)
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
