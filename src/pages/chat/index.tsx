import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { useDaemonContext } from "@/providers/DaemonProvider"

import {
	initBeamioPGPKeys,
	regiestChatRoute,
	getKeysFromCoNETPGPSC,
	connectToGossipNode,
	getRandomNode

} from '@/services/chat'

import { useEffect, useRef, useState } from "react"
import SearchInputWithDropdown from '@/components/Home/SearchBarWithResults'
import ScanBtn from '@/components/scanBtn/ScanButton'
import Chat from './chat'
import {checkSign} from '@/services/chat' 

import ChatList from './components/ChatList'

const initMessage = async (profile: profile, beamioer: searchResult): Promise<chatData|null> => {
	
	const address = beamioer.address.toLowerCase()
		
	if (!profile?.chats?.length) {
		profile.chats = []
	}
	
	const index = profile.chats.findIndex(n => n.address.toLowerCase() === address)
	let chatData: chatData|null = null

	if (index < 0) {
		const kk = await getKeysFromCoNETPGPSC (address, profile.privateKeyArmor)
		if (!kk?.publicArmored) {
			return null
		}
		
		chatData = {
			address: address,
			messages: [],
			chatData: kk,
			beamio: beamioer,
			pin: false,
			hide: false,
			muted: false,
			tag: 'grey',
			unreadCount: 1
		}
		profile.chats.push(chatData)

	} else {
		chatData = profile.chats[index]

	}
	return chatData
}


const Home = () => {
	const {
		profiles,
		setProfiles,
		setShowFooter,
		allNodes,
		setGossip,
		gossip
  	} = useDaemonContext()
	const [chatData, setChatData] = useState<chatData> ()
	const [privateKey, setPrivate] = useState('')


	useEffect(() => {
		const profile: profile = profiles?.[0]
		if (!profile || privateKey ) return
		setPrivate(profile.privateKeyArmor)
		setShowFooter(true)
	}, [])

	


	const selectedItemProcess = async (item: searchResult) => {
		const profile: profile = profiles?.[0]
		if (!profile) {
			return
		}

		const chatData = await initMessage(profile, item)
		if (!chatData) return

		setChatData(chatData)

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
            close={item => {
              if (typeof item !== "string") {
                selectedItemProcess(item)
              }
            }}
            showBackIcon={false}
            select={true}
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
