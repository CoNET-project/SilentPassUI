
import React, { useState, useEffect } from 'react'
import usdcIcon from '@/components/assets/usdc.png'
import baseIcon from '@/components/assets/base-logo.png'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { Popup } from 'antd-mobile'
import { CoNET_Data } from '../../utils/globals'
import Privatekey from './PrivateKey/PrivateKey'
import { Copy,Check, Bell, Settings, QrCode, Sun, Moon } from 'lucide-react'
import {getBalance} from '@/services/beamio'
import BeamioSettingsScreen from './setup'
import BeamioReceiveScreen from './BeamioReceiveScreen'
import styles from './setting.module.scss'

//	https://beamio.app?amount=0.03&code=0x36a6200cec2fe34edb2f3b075af1d46645c54bb54a0abe0e97a265068773b3c4&note=test&address=0xc8f855ff966f6be05cd659a5c5c7495a66c5c015
type prof = {
  wallet: string
}
const formatMoney = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')
const defaultName = 'Beamio'

export default function BeamioMeMainScreen() {
	const { darkModle, setDarkModle, setProfiles, beamio, setBeamio, profiles } = useDaemonContext()

	const [avatarSeed, setAvatarSeed] = useState('NY')
	const [avatarName, setAvatarName] = useState('')
	const [avatarImageData, setAvatarImageData] = useState<string | null>(null)
	const [avatarImageDataTemp, setAvatarImageDataTemp] = useState<string | null>(null)

	const [privatekeyVisible, setPrivatekeyVisible] = useState(false)
	const [avatarEditorVisible, setAvatarEditorVisible] = useState(false)
	const [walletAddress, setWalletAddress] = useState<string>('')
	const [usdcAmount, setUsdcAmount] = useState(0)
	const [usdcToUSD, setUsdcToUSD] = useState(0)

	const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

	const displayName = avatarName || defaultName

	const currentAvatarSrc = beamio?.image

	const [settingsOpen, setSettingsOpen] = useState(false)
	const [receiveOpen, setReceiveOpen] = useState(false)     // 控制 Receive 全屏页


	const getBa = async () => {
		const temp = profiles?.[0]

		if (!temp?.keyID) return

		setWalletAddress(temp.keyID)
		const _ba = await getBalance(temp.keyID)
		if (!_ba) return
		const ba = _ba
		const eth = Number(ba.eth)
		const ethUsd = eth * Number(ba.oracle.eth.eth)

		const usdc = Number(ba.usdc)
		setUsdcAmount(usdc)
		const usdcToUSD = usdc * Number(ba.oracle.eth.usdc)
		setUsdcToUSD(usdcToUSD)
	}

	useEffect(() => {
		if (!currentAvatarSrc) {
		return
		}

		if (!beamio) return

		if (beamio.accountName) {
			setAvatarName(beamio.accountName)
			setAvatarSeed(beamio.accountName)
		}
		setDarkModle(beamio.darkTheme)

		if (beamio.image && !/^http/.test(beamio.image)) {
		setAvatarImageData(beamio.image)
		}
	}, [receiveOpen, beamio])

	

	useEffect(() => {
		getBa()
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
		if (!walletAddress) return

		await navigator.clipboard.writeText(walletAddress)
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
			<span className="font-mono">{fmtAddr(walletAddress)}</span>

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

	return (
		<div className="relative">
			<div className="">

				{/* Content */}
				<div className="flex flex-col h-[calc(100%-2.5rem)] px-5 pb-4">
					{/* Top blue header with avatar (Venmo-style) */}
					<div className="relative mb-6">
						{/* Blue wave background */}
						<div className="-mx-5 h-32 rounded-b-[40px] bg-gradient-to-r from-[#1652F0] to-[#2F7BFF] flex items-start justify-between px-5 pt-3">
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

								{/* 🌗 Light/Dark Toggle */}
								<button
									className="w-9 h-9 rounded-full bg-white/10 border border-white/30 flex items-center justify-center text-white shadow-sm"
									onClick={() => {
									// 本地状态
									setDarkModle(!darkModle)

									// 切换 <html> class="dark"
									if (!darkModle) {
										document.documentElement.classList.add("dark")
									} else {
										document.documentElement.classList.remove("dark")
									}

									// 可选：保存到 localStorage
									localStorage.setItem("beamio-theme", !darkModle ? "dark" : "light")
									}}
								>
									{darkModle ? (
									<Sun className="w-4 h-4" /> // dark → 显示 Sun（可切换到 light）
									) : (
									<Moon className="w-4 h-4" /> // light → 显示 Moon（可切换到 dark）
									)}
								</button>
							</div>
						</div>

						{/* Avatar and handle, overlapping the blue area */}
						<div className="absolute left-1/2 -translate-x-1/2 top-10 flex flex-col items-center">
							{/* ⭐ 点击头像 / 小 QR 打开 Receive 全屏页 */}
								<button
									type="button"
									onClick={() => setReceiveOpen(true)}
									className="relative focus:outline-none"
								>
								<div className="w-20 h-20 rounded-full bg-fuchsia-500 flex items-center justify-center text-4xl shadow-lg ring-4 ring-white overflow-hidden">
									<img src={currentAvatarSrc} className="w-full h-full object-cover" />
								</div>

								{/* Small QR badge */}
								<div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow flex items-center justify-center border border-slate-200">
									<QrCode className="w-4 h-4 text-slate-700" />
								</div>
								</button>

							<span className="mt-2 text-sm font-semibold text-slate-900">
								{displayName}
							</span>
							<WalletAddrButton />
						</div>
					</div>

					{/* Main wallet summary (similar to Venmo "In Beamio") */}
					<div className="mb-4">
						<p className="text-[13px] font-medium text-slate-900">In Beamio</p>
						<div className="flex items-baseline justify-between mt-1 mb-1">
							<p className="text-[28px] leading-none font-semibold text-slate-900">
								${formatMoney(usdcToUSD)}
							</p>
							<p className="text-[11px] text-slate-500">USDC on Base</p>
						</div>
						<button
							onClick={() => {
								if (!walletAddress) return
								window.open(
								`https://basescan.org/address/${walletAddress}`,
								"_blank"
								)
							}}
							className="text-[11px] font-medium text-[#1652F0] underline underline-offset-2"
						>
							Crypto assets
						</button>

						{/* Primary USDC row */}
							<div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 flex items-center justify-between">
							
								{/* 左侧 USDC + Base 叠加图标 */}
								<div className="relative w-7 h-7">
									{/* USDC 主图 */}
									<img
										src={usdcIcon}
										alt="USDC"
										className="w-7 h-7 rounded-full"
									/>

									{/* Base 右下角叠加 */}
									<img
										src={baseIcon}
										alt="Base"
										className="
											absolute
											w-3.5 h-3.5
											bottom-[-2px] right-[-2px]
											rounded-full
											border border-white dark:border-slate-900
											bg-white
										"
									/>
								</div>

								{/* 右侧金额 */}
								<div className="text-right">
									<p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
										${formatMoney(usdcToUSD)}
									</p>
									<p className="text-[11px] text-slate-500 dark:text-slate-400">
										{formatMoney(usdcAmount)} USDC
									</p>
								</div>

							</div>


					</div>
				</div>
			</div>

			{/* Settings full-screen slide-over */}
			<div
				className={[
					"fixed inset-0 z-40 bg-slate-50",
					"transition-transform duration-300 ease-out",
					settingsOpen ? "translate-x-0" : "translate-x-full",
				].join(" ")}
			>
				<BeamioSettingsScreen onClose={() => setSettingsOpen(false)} />
			</div>

			{/* ⭐ Receive full-screen slide-over（从右向左滑入） */}
			<div
				className={[
					"fixed inset-0 z-50 bg-white dark:bg-slate-900",
					"transition-transform duration-300 ease-out",
					receiveOpen ? "translate-x-0" : "translate-x-full",
				].join(" ")}
			>
				{/* 关闭按钮：右上角 iOS 毛玻璃风格 */}
				<button
					onClick={() => setReceiveOpen(false)}
					className="
						absolute top-4 right-4
						w-8 h-8 rounded-full
						bg-white/70 dark:bg-slate-800/70
						backdrop-blur-md shadow
						flex items-center justify-center
						text-slate-700 dark:text-slate-300
					"
				>
					✕
				</button>

				{/* 真正的 Receive 内容 */}
				<div className="w-full h-full">
					<BeamioReceiveScreen />
				</div>
			</div>
			
			{showPrivateKeyPopup()}
			
		</div>
	)
}
