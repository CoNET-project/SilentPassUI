import React from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar, List, SearchBar, Badge, TabBar, Avatar, Input, Ellipsis } from 'antd-mobile'
import { LockFill } from 'antd-mobile-icons'
import styles from "./chats.module.scss"

const chats = [
  	{ id: '1', name: 'Peter okamoto', avatar:'https://api.dicebear.com/8.x/fun-emoji/svg?seed=%40Beamio', last: "Got it, I'll send the Beamio link later.", time: '10:21', unread: 2 },
  	{ id: '2', name: 'Jing Luo', avatar:'', last: 'Thanks! I received 1.00 USDC.', time: 'Yesterday', unread: 3 },
  	{ id: '3', name: 'Alto Swim Club', avatar:'', last: "Let's test the new payment flow this week.", time: 'Fri', unread: 0 },
  	{ id: '4', name: 'Beamio Official', avatar:'', last: 'Welcome to Beamio Alpha — gasless USDCWelcome to Beamio Alpha — gasless USDCWelcome to Beamio Alpha — gasless USDC.', time: 'Mon', unread: 0 },
  	{ id: '5', name: 'Peter okamoto', avatar:'https://api.dicebear.com/8.x/fun-emoji/svg?seed=%40Beamio', last: "Got it, I'll send the Beamio link later.", time: '10:21', unread: 2 },
  	{ id: '6', name: 'Jing Luo', avatar:'', last: 'Thanks! I received 1.00 USDC.', time: 'Yesterday', unread: 3 },
  	{ id: '7', name: 'Alto Swim Club', avatar:'', last: "Let's test the new payment flow this week.", time: 'Fri', unread: 0 },
  	{ id: '8', name: 'Beamio Official', avatar:'', last: 'Welcome to Beamio Alpha — gasless USDCWelcome to Beamio Alpha — gasless USDCWelcome to Beamio Alpha — gasless USDC.', time: 'Mon', unread: 0 },
  	{ id: '9', name: 'Peter okamoto', avatar:'https://api.dicebear.com/8.x/fun-emoji/svg?seed=%40Beamio', last: "Got it, I'll send the Beamio link later.", time: '10:21', unread: 2 },
  	{ id: '10', name: 'Jing Luo', avatar:'', last: 'Thanks! I received 1.00 USDC.', time: 'Yesterday', unread: 3 },
  	{ id: '11', name: 'Alto Swim Club', avatar:'', last: "Let's test the new payment flow this week.", time: 'Fri', unread: 0 },
  	{ id: '12', name: 'Beamio Official', avatar:'', last: 'Welcome to Beamio Alpha — gasless USDCWelcome to Beamio Alpha — gasless USDCWelcome to Beamio Alpha — gasless USDC.', time: 'Mon', unread: 0 },
  	{ id: '13', name: 'Peter okamoto', avatar:'https://api.dicebear.com/8.x/fun-emoji/svg?seed=%40Beamio', last: "Got it, I'll send the Beamio link later.", time: '10:21', unread: 2 },
  	{ id: '14', name: 'Jing Luo', avatar:'', last: 'Thanks! I received 1.00 USDC.', time: 'Yesterday', unread: 3 },
  	{ id: '15', name: 'Alto Swim Club', avatar:'', last: "Let's test the new payment flow this week.", time: 'Fri', unread: 0 },
  	{ id: '16', name: 'Beamio Official', avatar:'', last: 'Welcome to Beamio Alpha — gasless USDCWelcome to Beamio Alpha — gasless USDCWelcome to Beamio Alpha — gasless USDC.', time: 'Mon', unread: 0 },
  	{ id: '17', name: 'Peter okamoto', avatar:'https://api.dicebear.com/8.x/fun-emoji/svg?seed=%40Beamio', last: "Got it, I'll send the Beamio link later.", time: '10:21', unread: 2 },
  	{ id: '18', name: 'Jing Luo', avatar:'', last: 'Thanks! I received 1.00 USDC.', time: 'Yesterday', unread: 3 },
  	{ id: '19', name: 'Alto Swim Club', avatar:'', last: "Let's test the new payment flow this week.", time: 'Fri', unread: 0 },
  	{ id: '20', name: 'Beamio Official', avatar:'', last: 'Welcome to Beamio Alpha — gasless USDCWelcome to Beamio Alpha — gasless USDCWelcome to Beamio Alpha — gasless USDC.', time: 'Mon', unread: 0 },
]

const ChatList=()=> {
  	const navigate = useNavigate()

  	return (

		
    	<div className={styles.wrap}>
			<h1>This is sample data & come soon.</h1>
      		<div className={styles.tip}><LockFill className={styles.icon} />Your personal messages are end-to-end encrypted.</div>
      		<div className={styles.list}>
	      		<List style={{ '--border-top': 'none', '--border-bottom': 'none' }}>
	        		{chats.map(item => (
	          			<List.Item
	            			key={item.id}
	            			prefix={<Avatar src={item.avatar} style={{ '--border-radius': '50%' }} />}
	            			description={<Ellipsis direction='end' content={item.last} />}
	            			extra={
	              				<div className={styles.extra}>
	                				<div className={styles.time}>{item.time}</div>
	                				{item.unread > 0 && <Badge content={item.unread} color='#1652f0' />}
	              				</div>
	            			}
	            			arrowIcon={false}
	            			onClick={() => navigate(`/chat/${item.id}`)}
	          			>
	            			<span className={styles.name}>{item.name}</span>
	          			</List.Item>
	        		))}
	      		</List>
      		</div>
    	</div>
  	)
}

export default ChatList