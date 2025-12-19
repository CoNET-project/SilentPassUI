import React,{ useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar, List, SearchBar, Badge, TabBar, Avatar, Input, Ellipsis } from 'antd-mobile'
import { MoreOutline,AddOutline } from 'antd-mobile-icons'
import styles from "./chatDetail.module.scss"


const messageList = [
  	{
    	id: '1',
    	from: 'other',
    	avatar: '',
    	content: "Hi, can we try Beamio for next month's training fee?",
    	timestamp: Date.now() - 1000 * 60 * 60 * 5, // 今天
  	},
  	{
    	id: '2',
    	from: 'me',
    	avatar:'https://api.dicebear.com/8.x/fun-emoji/svg?seed=%40Beamio',
    	content:"Sure! I'll send USDC directly from Beamio. Gas is sponsored so you receive the full amount.",
    	timestamp: Date.now() - 1000 * 60 * 60 * 4,
  	},
  	{
    	id: '3',
    	from: 'other',
    	avatar: '',
    	content:"Great, I’ll let you know once it arrives in my Beamio wallet.",
    	timestamp: Date.now() - 1000 * 60 * 60 * 3,
  	},
  	{
    	id: '4',
    	from: 'me',
    	avatar:'https://api.dicebear.com/8.x/fun-emoji/svg?seed=%40Beamio',
    	content: 'Perfect. 🚀',
    	timestamp: Date.now() - 1000 * 60 * 60 * 2,
  	},
  	{
    	id: '5',
    	from: 'other',
    	avatar: '',
    	content: 'This is a message from yesterday',
    	timestamp: Date.now() - 1000 * 60 * 60 * 26, // 昨天
  	},
  	{
    	id: '6',
    	from: 'other',
    	avatar: '',
    	content: "Hi, can we try Beamio for next month's training fee?",
    	timestamp: Date.now() - 1000 * 60 * 60 * 26, 
  	},
  	{
    	id: '7',
    	from: 'me',
    	avatar:'https://api.dicebear.com/8.x/fun-emoji/svg?seed=%40Beamio',
    	content:"Sure! I'll send USDC directly from Beamio. Gas is sponsored so you receive the full amount.",
    	timestamp: Date.now() - 1000 * 60 * 60 * 28,
  	},
  	{
    	id: '8',
    	from: 'other',
    	avatar: '',
    	content:"Great, I’ll let you know once it arrives in my Beamio wallet.",
    	timestamp: Date.now() - 1000 * 60 * 60 * 29,
  	},
  	{
    	id: '9',
    	from: 'me',
    	avatar:'https://api.dicebear.com/8.x/fun-emoji/svg?seed=%40Beamio',
    	content: 'Perfect. 🚀',
    	timestamp: Date.now() - 1000 * 60 * 60 * 130,
  	},
  	{
    	id: '10',
    	from: 'other',
    	avatar: '',
    	content: 'This is a message from yesterday',
    	timestamp: Date.now() - 1000 * 60 * 60 * 130, 
  	},
]


const formatDay=(timestamp: number): string => {
  	const date = new Date(timestamp)
  	const now = new Date()

  	const isToday =
    	date.getFullYear() === now.getFullYear() &&
    	date.getMonth() === now.getMonth() &&
    	date.getDate() === now.getDate()

  	if (isToday) return 'Today'

  	const y = date.getFullYear()
	const m = String(date.getMonth() + 1).padStart(2, '0')
	const d = String(date.getDate()).padStart(2, '0')

  	return `${y}-${m}-${d}`
}

const ChatDetail=()=> {
  	const navigate = useNavigate()
  	const bottomRef = useRef<HTMLDivElement | null>(null)
  	const isAtBottomRef = useRef(true)	//防止用户在看历史时被拉回

  	useEffect(() => {
	  	if (isAtBottomRef.current) {
		    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
		 }
	}, [messageList.length])

	const sortedMessageList = React.useMemo(() => {
  		return [...messageList].sort(
    		(a, b) => a.timestamp - b.timestamp
  		)
	}, [messageList])

  	return (
    	<div className={styles.wrap}>
    		<div className={styles.navBox}>
	    		<NavBar onBack={() => navigate(-1)} right={<div className={styles.more}><MoreOutline /></div>}>
	    			<div className={styles.titleBox}>
	    				<Avatar src={'https://api.dicebear.com/8.x/fun-emoji/svg?seed=%40Beamio'} style={{ '--size': '40px','--border-radius': '50%' }} />
			          	<div className={styles.text}>
				          	<div className={styles.name}>Jing Luo</div>
				          	<div className={styles.sub}>Encrypted · Beamio + CoNET</div>
				        </div>
			        </div>
	    		</NavBar>
	    	</div>
	    	{/* 消息区域 */}
      		<div className={styles.cont} onScroll={e => {
			    const el = e.currentTarget
			    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
			}}>
			  	{(() => {
			    	let lastDay = ''

			    	return sortedMessageList.map(msg => {
			      		const dayLabel = formatDay(msg.timestamp)
			      		const showDay = dayLabel !== lastDay
			      		lastDay = dayLabel

			      		return (
			        		<React.Fragment key={msg.id}>
			          			{/* 日期分割 */}
			          			{showDay && (
			            			<div className={styles.time}>{dayLabel}</div>
			          			)}

			          			{/* 消息本体 */}
			          			{msg.from === 'other' ? (
			            			<div className={styles.msgLeft}>
				              			<Avatar src={msg.avatar} style={{ '--size': '40px','--border-radius': '50%' }} />
				              			<div className={styles.bubbleLeft}>
				                			{msg.content}
				              			</div>
			            			</div>
			          			) : (
			            			<div className={styles.msgRight}>
			              				<div className={styles.bubbleRight}>
			                				{msg.content}
			              				</div>
			            			</div>
			          			)}
			        		</React.Fragment>
			      		)
			    	})
			  	})()}
			  	<div ref={bottomRef} />
			</div>

      		{/* 底部输入框 */}
      		<div className={styles.sendBox}>
        		<div className={styles.add}>
          			<AddOutline />
        		</div>
        		<Input
          			className={styles.input}
          			placeholder="Message @jingluo"
        		/>
        		<div className={styles.sendBtn}>➤</div>
      		</div>
    	</div>
  	)
}

export default ChatDetail