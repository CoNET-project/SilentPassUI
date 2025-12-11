
import React, { useState, useEffect } from 'react'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { Popup } from 'antd-mobile'
import { CoNET_Data } from '../../utils/globals'
import Privatekey from './PrivateKey/PrivateKey'
import { Copy,Check, Bell, Settings, QrCode, Sun, Moon } from 'lucide-react'
import BeamioSettingsScreen from './setup'
import BeamioReceiveScreen from './BeamioReceiveScreen'
import { getBalanceProcess, getMyFollowStatus } from '@/services/beamio'
import styles from './setting.module.scss'
import { AppButton } from '../button/AppButton'

import { BuyWithCoinbaseButton } from './BuyWithCoinbaseButton'
import {SellWithCoinbaseButton} from './SellWithCoinbaseButton'

const getImg = (avatarSeed: string|undefined) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed||'@Beamio').toString()}`

//	https://beamio.app?amount=0.03&code=0x36a6200cec2fe34edb2f3b075af1d46645c54bb54a0abe0e97a265068773b3c4&note=test&address=0xc8f855ff966f6be05cd659a5c5c7495a66c5c015
type prof = {
  	wallet: string
}
const formatMoney = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')
const defaultName = 'Beamio'

const buildCreatedAtLabel = (created_at?: number | string) => {
	if (!created_at) return ""

	// 统一转换成 number
	const num = Number(created_at)
	if (!Number.isFinite(num)) return ""

	// 秒 → 毫秒
	const ts = (String(created_at).length === 10)
		? num * 1000
		: num

	const d = new Date(ts)
	if (Number.isNaN(d.getTime())) return ""

	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	})
}

const shortenAddress = (addr: string) => {
	if (!addr) return ""
	if (addr.length <= 10) return addr
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}


export default function BeamioMeMainScreen() {
	const { darkModle, setDarkModle, setProfiles, beamio, setBeamio, profiles, payTag, setPayTag, usdcbalance, usdcToUSD, myAddress, setMyAddress, setListenningProcess, listenningProcess, setUsdcbalance, setUsdcToUSD } = useDaemonContext()

	const [avatarSeed, setAvatarSeed] = useState('NY')
	const [avatarName, setAvatarName] = useState('')
	const [avatarImageData, setAvatarImageData] = useState<string | null>(null)
	const [avatarImageDataTemp, setAvatarImageDataTemp] = useState<string | null>(null)

	const [privatekeyVisible, setPrivatekeyVisible] = useState(false)
	const [avatarEditorVisible, setAvatarEditorVisible] = useState(false)

	const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

	const displayName = avatarName || defaultName

	const currentAvatarSrc = beamio?.image

	const [settingsOpen, setSettingsOpen] = useState(false)
	const [coinbaseOpen, setCoinbaseOpen] = useState<'buy'|'sale'|''>()
	const [receiveOpen, setReceiveOpen] = useState(false)     // 控制 Receive 全屏页
	const [copied, setCopied] = React.useState(false)
	const [followingCount, setFollowingCount] = useState(0)
	const [followerCount, setFollowerCount] = useState(0)
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [createAt, setCreatedAt] = useState(0)

	useEffect(() => {
		if (!currentAvatarSrc||!beamio) {
			return
		}


		if (beamio.accountName) {
			setAvatarName(beamio.accountName)
			setAvatarSeed(beamio.accountName)
			setFirstName(beamio.firstName || '')
			setLastName(beamio.lastName || '')
			setCreatedAt(beamio.createdAt || 0)
		}
		setDarkModle(beamio.darkTheme)

		if (beamio.image && !/^http/.test(beamio.image)) {
			setAvatarImageData(beamio.image)
		}

		

	}, [receiveOpen, beamio])

	
	let init = false

	useEffect(() => {
		if (init) return
		init = true
		if (payTag === 'receive') {
			setReceiveOpen(true)
		}
		if (!profiles?.length) {
			return
		}
		const profile: profile = profiles[0]

		if (!myAddress) {
			setMyAddress(profile.keyID)
			if (!listenningProcess) {
				getBalanceProcess(profile.keyID, setUsdcbalance, setUsdcToUSD)
			}
		}
		if (beamio) {
			setAvatarName(beamio.accountName)
			setFirstName(beamio.firstName || '')
			setLastName(beamio.lastName || '')
			setCreatedAt(beamio.createdAt || 0)
		}

		getFollowerStatus(profile.keyID)
	}, [])

	const getPrivatekey = (): string => {
		const profile = CoNET_Data?.profiles?.[0]
		if (!profile || !profile?.privateKeyArmor) return ''
		const ret = profile.privateKeyArmor.replace(/^0x/i, '')
		return ret
	}

	const handleSaveAvatar = () => {
		setAvatarEditorVisible(false)
		setAvatarName(avatarSeed || defaultName)
		if (avatarImageDataTemp !== avatarImageData) {
			setAvatarImageData(avatarImageDataTemp)
		}
	}

			

	function WalletAddrButton({}) {
		const [copied, setCopied] = useState(false)

		const handleCopy = async () => {
		if (!myAddress) return

		await navigator.clipboard.writeText(myAddress)
		setCopied(true)

		setTimeout(() => setCopied(false), 1200)
		}

		return (
			<button
				onClick={handleCopy}
				className="
				mt-0.5 inline-flex items-center gap-1
				text-[10px] text-slate-500 
				bg-white/80 px-2 py-1 rounded-full 
				border border-slate-200 shadow-sm
				"
			>
				<span className="font-mono">{fmtAddr(myAddress)}</span>

				<span
				className="
					flex items-center justify-center
					px-1.5 py-0.5 rounded-full 
					border border-slate-200 text-[9px] 
					text-slate-500 bg-slate-50
				"
				>
				{copied ? (
					<Check className="w-3 h-3 text-emerald-600" />
				) : (
					<Copy className="w-3 h-3" />
				)}
				</span>
			</button>
			)
	}

	const showPrivateKeyPopup = () => {
		return (
			<Popup
				position="right"
				visible={privatekeyVisible}
				onMaskClick={() => setPrivatekeyVisible(false)}
				bodyStyle={{
					width: '80vw',
					maxWidth: 360,
					padding: 0,
					boxSizing: 'border-box',
					background: 'transparent',
				}}
			>
				<Privatekey
					privateKey={getPrivatekey()}
					onClose={() => setPrivatekeyVisible(false)}
				/>
			</Popup>
		)
	}

	const getFollowerStatus = async (wallet: string) => {
		if (!myAddress) return

		
		const res = await getMyFollowStatus(wallet)
		if (res) {
			setFollowingCount(res.followingCount)
			setFollowerCount(res.followerCount)
		}
		
	}

	const ProfileInformation = () => {
		const info = {
			title: 'Your Beamio profile',
			description1: 'Manage account, security and payment settings from the gear icon in the top right.',
			description2: 'Tap Following or Followers to see your connections.',
		}
		return (
			<div className="rounded-2xl bg-white shadow-sm p-4 text-slate-800 leading-snug">
				<div className="text-[17px] font-semibold mb-1">
				{info.title}
				</div>

				<p className="text-[14px] text-slate-500 mb-1">
				{info.description1}
				</p>

				<p className="text-[14px] text-slate-500">
				{info.description2}
				</p>
			</div>
		)
	}

	const HeadArea = () => (
		<div className="relative w-full h-11">
			{/* 顶部蓝色区域：头像 + 名字 */}
			<div 
				className="
					relative z-10
					bg-gradient-to-r from-sky-500 to-blue-600 text-white
					px-5 pt-3 pb-10
					rounded-b-[28px]
					shadow-[0_8px_24px_rgba(15,23,42,0.35)]
				"
			>

					
								{/* Blue wave background */}
				<div className="-mx-5 flex items-start justify-between px-5">
					{/* Placeholder for future account switcher */}
					<button 
						onClick={() => {
							setPrivatekeyVisible(true)
						}}
						className="mt-4 text-[11px] font-medium text-white/90 px-2 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm"
					>
						Personal
					</button>

					<div className="flex items-center gap-2 mt-2">
						{/* Notifications */}
						<button className="w-9 h-9 rounded-full bg-white/10 border border-white/30 flex items-center justify-center text-white shadow-sm">
							<Bell className="w-4 h-4" />
						</button>

						{/* Settings */}
						<button
							className="w-9 h-9 rounded-full bg-white/10 border border-white/30 flex items-center justify-center text-white shadow-sm"
							onClick={() => setSettingsOpen(true)}
						>
							<Settings className="w-4 h-4" />
						</button>
					</div>
				</div>
				{/* 头像 + 名字 + username + Add friend */}
				<div className="flex flex-col items-center text-center">
					{/* 头像 */}
					{beamio?.image ? (
						<img
							src={beamio.image}
							alt={beamio.accountName}
							className="w-20 h-20 rounded-full object-cover mr-2 flex-shrink-0"
						/>
						) : (
						<img
							src={getImg(beamio?.accountName)}
							alt={beamio?.accountName}
							className="w-20 h-20 rounded-full object-cover mr-2 flex-shrink-0 bg-slate-200"
						/>
					)}

				
						
						
					{/* @username */}
					<div className="mt-4 text-[18px] font-semibold tracking-tight">
						@{beamio?.accountName || 'Beamio'}
					</div>

					{/* createdAtLabel */}
						
					<div className="mt-1 text-[11px] text-white/75">
						{firstName} {lastName} since {buildCreatedAtLabel(createAt)}
					</div>
						

					{/* 地址 pill + 复制按钮 */}
					{beamio && (
						<button
							type="button"
							className={`
							mt-3 inline-flex items-center gap-2
							px-4 py-1.5 rounded-full
							bg-white/20 text-[12px] font-medium text-white/95
							backdrop-blur-sm
							transition-transform duration-150 ease-out
							${copied ? "scale-95" : "hover:scale-[1.02] active:scale-95"}
							`}
							onClick={() => {
							if (!navigator?.clipboard || !myAddress) return

							navigator.clipboard
								.writeText(myAddress)
								.then(() => {
								setCopied(true)
								setTimeout(() => setCopied(false), 2000)
								})
								.catch(() => {
								// 失败就不切换状态，必要时可以加 toast
								})
							}}
						>
							<span className="tracking-wide">
							{shortenAddress(myAddress)}
							</span>

							<span
							className={`
								w-6 h-6 rounded-full flex items-center justify-center
								transition-colors duration-150
								${copied ? "bg-emerald-500" : "bg-white/20"}
							`}
							>
							{copied ? (
								<Check className="w-3.5 h-3.5 text-white" strokeWidth={2} />
							) : (
								<Copy className="w-3.5 h-3.5 text-white/95" strokeWidth={2} />
							)}
							</span>
						</button>
					)}


					
						
					

					{/* Following / Followers */}


					<div
						className="
							mt-4
							flex items-center
							rounded-full border border-white/30
							overflow-hidden
							text-white
							h-[56px]
							min-w-[240px]              /* ⭐ 加宽：关键代码 */
							px-4                       /* ⭐ 两侧增加 padding，使视觉更宽 */
						"
					>
						{/* Following */}
						<div className="flex flex-1 flex-col items-center justify-center">
							<span className="text-[15px] font-semibold">{followingCount}</span>
							<span className="uppercase tracking-[0.16em] text-[10px] text-white/75">
								Following
							</span>
						</div>

						{/* Divider */}
						<div className="w-px h-8 bg-white/30" />

						{/* Followers */}
						<div className="flex flex-1 flex-col items-center justify-center">
							<span className="text-[15px] font-semibold">{followerCount}</span>
							<span className="uppercase tracking-[0.16em] text-[10px] text-white/75">
								Followers
							</span>
						</div>
					</div>
				</div>
			</div>
			<div 
				className="
					relative z-0
					flex-1
					-mt-12           /* 让白色卡片往上贴住蓝色 */
					px-5 pt-20 pb-5 /* 用更大的 pt 把内容往下推开，避免和 Add friend 重叠 */
					flex flex-col gap-4
					rounded-t-[28px]
					
				"
			>
					
			<ProfileInformation />
			</div>		
		</div>	
	)

	return (
		<div className="relative">
			<div className="">
				<HeadArea />
				{/* Content */}
				
			</div>
			
			{/* Settings full-screen slide-over */}
			<div
				className={[
					"fixed inset-0 z-40 flex-1 overflow-y-auto",
					"transition-transform duration-300 ease-out",
					settingsOpen ? "translate-x-0" : "translate-x-full",
				].join(" ")}
			>
				<div className="flex-1">
					<BeamioSettingsScreen onClose={() => setSettingsOpen(false)} />
				</div>
				
			</div>

			{/* ⭐ Receive full-screen slide-over（从右向左滑入） */}
			<div
				className={[
					"fixed inset-0 z-50 bg-white dark:bg-slate-900",
					"transition-transform duration-300 ease-out flex flex-col",
					receiveOpen ? "translate-x-0" : "translate-x-full",
				].join(" ")}
			>
				{/* 关闭按钮：右上角 iOS 毛玻璃风格 */}
				<button
					onClick={() => {
						setPayTag('')
						setReceiveOpen(false)
					}}
					className="
						    absolute top-4 right-4
						w-8 h-8 rounded-full
						bg-sky-200/60 dark:bg-sky-900/40   /* ⭐ 淡蓝色透明背景 */
						backdrop-blur-md shadow
						flex items-center justify-center
						text-sky-700 dark:text-sky-200    /* ⭐ 让叉号跟着蓝色系 */
					"
				>
					✕
				</button>

				{/* 真正的 Receive 内容 */}
				<div className="flex-1 overflow-y-auto">
					<BeamioReceiveScreen />
				</div>
			</div>

			{showPrivateKeyPopup()}

			
		</div>
	)
}
