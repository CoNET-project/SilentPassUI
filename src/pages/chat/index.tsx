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
import {onGossipEvent, GOSSIP_MESSAGE} from '@/services/eventBus'
import {checkSign} from '@/services/chat' 
import {searchUsername} from '@/services/beamio'


type message = {
	from: string
	signMessage: string
	text: string
	timestamp: number
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


	const [selectItem, setSelectItem] = useState<searchResult | null>(null)
	const [chatItempublicArmored, setChatItempublicArmored] = useState('')
	const [online, setOnline] = useState(false)
	const [privateKey, setPrivate] = useState('')
	const [messages, setMessages] = useState<ChatMessage[]>()
	const [openID, setOpenID] = useState(0)


	const gotMessage = async (data: string) => {
		if (!profiles) return
		const profile = profiles[0]
		try {
			const message: message = JSON.parse(data)
			if (message?.from && message?.text && message?.signMessage) {
				const sign = checkSign(message.text, message.signMessage, message.from)
				if (sign) {
					const _account = await searchUsername(message.from)
					if (_account?.results?.length) {
						const acc: searchResult = _account.results[0]
						const kk = await getKeysFromCoNETPGPSC (acc.address, profile.privateKeyArmor)
						if (!kk?.publicArmored) {
							return
						}
						
							setChatItempublicArmored(kk.publicArmored)
							setSelectItem(acc)
						
						
						
						setOnline(kk.online)
						
						setOpenID(openID+1)

						const chat: ChatMessage = {
							from: 'them',
							id: openID.toString(),
							text: message.text,
							createdAt: message.timestamp
						}
						setMessages(prof => prof ? [...prof, chat] : [chat])
						if (unsubscribeRef.current) {
							unsubscribeRef.current()
							unsubscribeRef.current = null
						}
					}
				} else {
					console.log(`Sign Error!`, message )
				}
			}
			
		} catch (ex: any) {
			console.log(`gotMessage Error`)
		}
	}
	const unsubscribeRef = useRef<(() => void) | null>(null)

	useEffect(() => {
		// ✅ 立即注册监听器，不要延迟
		if (!unsubscribeRef.current) {
			unsubscribeRef.current = onGossipEvent(GOSSIP_MESSAGE, (payload) => {
				console.log('Received payload:', payload)
				if (payload?.raw) {
					gotMessage(payload.raw)

				}
			})
		}

		// 清理函数
		return () => {
			if (unsubscribeRef.current) {
				unsubscribeRef.current()
				unsubscribeRef.current = null
			}
		}
	}, []) // 空数组确保只运行一次

	useEffect(() => {
		// 你原逻辑保持：进入 chat 隐藏 footer
		setShowFooter(!selectItem)
	}, [selectItem, setShowFooter])



	const selectedItemProcess = async (item: searchResult) => {
		const profile: profile = profiles?.[0]
		if (!profile) {
			return
		}

		setPrivate(profile.privateKeyArmor)
		const kk = await getKeysFromCoNETPGPSC (item.address, profile.privateKeyArmor)
		if (!kk?.publicArmored) {
			return
		}
		setChatItempublicArmored(kk.publicArmored)
		setSelectItem(item)
		if (kk.online) {
			setOnline(true)
		}
		

	}

	const sendMessage = (text: string ) => {
		const node = getRandomNode(allNodes)
		if (!node) {

		}
	}


  return (
    <div className="pt-[calc(env(safe-area-inset-top)+0.2rem)]">
      {/* ✅ 当没选中聊天对象时，显示搜索页 */}
      {!selectItem && (
        <div className="h-full flex flex-col text-slate-900">
          <div className="flex-1 px-5 pb-3">
            <div className="relative mb-4 mt-4">
              <SearchInputWithDropdown
                showHistory={false}
                close={item => {
                  if (typeof item !== 'string') {
                    selectedItemProcess(item)
                  }
                }}
                showBackIcon={false}
                select={true}
              />

              {/* 扫码按钮：浮在右侧 */}
              <div
                className="
                  absolute
                  top-1/2 -translate-y-1/2
                  right-2
                  h-9 w-9
                  rounded-full
                  bg-slate-100
                  flex items-center justify-center
                  text-slate-500
                  text-xs
                "
              >
                <ScanBtn />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ 选中后：Chat 全屏浮层（Chat 内部要 fixed inset-0） */}
      {selectItem && (
			<Chat
				beamioer={selectItem}
				onBack={() => {
					setSelectItem(null)
					setOnline(false)
				}}
				pgpPublickey={chatItempublicArmored}
				allNodes={allNodes}
				online={online}
				privateKey={privateKey}
				chats={messages}
			/>
      )}
    </div>
  )
}

export default Home
