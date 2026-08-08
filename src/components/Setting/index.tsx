
import React, { useState, useEffect, useMemo } from 'react'
import { ethers } from 'ethers'
import { useNavigate } from 'react-router-dom'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { Popup } from 'antd-mobile'
import { CoNET_Data } from '../../utils/globals'
import Privatekey from './PrivateKey/PrivateKey'
import { Copy, Check, Bell, Settings, Sun, Moon, X } from 'lucide-react'
import { ProfileWalletPanels } from './ProfileWalletPanels'
import BeamioSettingsScreen from './setup'
import BeamioReceiveScreen from './BeamioReceiveScreen'
import { getBalanceProcess, getMyFollowStatus, postBeamio } from '@/services/beamio'
import { motion, AnimatePresence } from 'framer-motion'
import FollowListContainer from './followList/FollowListContainer'
import CoinbaseRamps from './CoinbaseRamps'
import { ChevronRight, User, Globe, Shield, HelpCircle, ArrowDownToLine } from 'lucide-react'
import { openExternalUrl } from '@/utils/cashTreesNativeNfc'
import { buildWalletUsdcDepositUrl } from '@/utils/discoverUsdcTopupSession'
import BeamioRegionCurrencyScreen from "./BeamioRegionCurrencyScreen"
import NavigateLeftButton from '@/components/navigate'
import BeamioAccountScreen from "./BeamioAccountScreen"
import BeamioNotificationsSettingsScreen from "./BeamioNotificationsSettingsScreen";
import { IpfsImg } from '@/components/IpfsImg';
import BeamioGetHelpSettingsScreen from "./BeamioGetHelpSettingsScreen";
import Security from './Security'
import packageJson from '../../../package.json'
import { tu } from '@/locale/beamioLocale'
import {
	loadSettingsFollowCounts,
	saveSettingsFollowCounts,
	loadSettingsCurrencyLabel,
	saveSettingsCurrencyLabel,
} from '@/utils/settingsScreenLocalCache'

const version = `Version ${(packageJson as { version?: string }).version ?? ''}`


const getImg = (avatarSeed: string|undefined) => `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed||'@Beamio').toString()}`

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

const displayName = (item: beamio) => {
	const lastname = item?.lastName?.split('\r\n')||[]
	const fullName = `${item?.firstName || ''} ${/^\{/.test(lastname[0]) ? '': lastname[0] || ''}`.trim()
	return fullName || ''
}

const RowIcon = ({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode
  tone?: 'slate' | 'blue' | 'orange'
}) => {
  const toneCls =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-600'
      : tone === 'orange'
        ? 'bg-orange-50 text-orange-600'
        : 'bg-slate-100 text-slate-600'

  return (
    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${toneCls}`}>
      {children}
    </div>
  )
}

const SettingRow = ({
	icon,
	title,
	right,
	onClick,
}: {
	icon: React.ReactNode
	title: string
	right?: React.ReactNode
	onClick?: () => void
}) => {
	return (
		<button
		type="button"
		onClick={onClick}
		className="w-full flex items-center gap-4 px-5 py-4 active:opacity-80"
		>
		{icon}

		<div className="flex-1 flex items-center justify-between min-w-0">
			<div className="text-[17px] font-semibold text-slate-900 truncate">{title}</div>

			<div className="flex items-center gap-2 shrink-0">
			{right}
			<ChevronRight className="w-5 h-5 text-slate-300" />
			</div>
		</div>
		</button>
	)
}

export default function BeamioMeMainScreen() {
	const navigate = useNavigate()
	const { darkModle, setDarkModle, setProfiles, beamio, setBeamio, 
		profiles, payTag, setPayTag, myAddress, 
		setMyAddress, setListenningProcess, listenningProcess, setUsdcbalance, setUsdcToUSD, setShowFooter, setNavigateLeftButtonArray,
		conetWalletBalances, conetAaWalletBalances } = useDaemonContext()

	const [avatarSeed, setAvatarSeed] = useState('')
	const [avatarName, setAvatarName] = useState('')
	const [avatarImageData, setAvatarImageData] = useState<string | null>(null)
	const [avatarImageDataTemp, setAvatarImageDataTemp] = useState<string | null>(null)

	const [privatekeyVisible, setPrivatekeyVisible] = useState(false)
	const [avatarEditorVisible, setAvatarEditorVisible] = useState(false)

	const [settingsOpen, setSettingsOpen] = useState<''|'BeamioSettings'|'FollowList'|'CoinbaseRamp'|'Region'|'Account'|'通知'|'Help'|'RecoveryBackupScreen'>('')
	const [setFollowOpen, setSetFollowOpen] = useState<'following' | 'followers'|''>('')
	const [receiveOpen, setReceiveOpen] = useState(false)     // 控制 Receive 全屏页
	const [followingCount, setFollowingCount] = useState(0)
	const [followerCount, setFollowerCount] = useState(0)
	/** Language & Currency 行：本地缓存优先，beamio 到达后再对齐并落盘 */
	const [currencyDisplay, setCurrencyDisplay] = useState('USDC')
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [createAt, setCreatedAt] = useState(0)
	const [copiedUsername, setCopiedUsername] = useState(false)

	const closeProfileScreen = () => {
		setSettingsOpen('')
		setReceiveOpen(false)
		setNavigateLeftButtonArray([])
		setShowFooter(true)
		navigate('/')
	}

	const eoaCapsuleAddress = useMemo(() => {
		const raw = myAddress?.trim() ?? profiles?.[0]?.keyID?.trim() ?? ''
		if (!raw || !ethers.isAddress(raw)) return ''
		try {
			return ethers.getAddress(raw)
		} catch {
			return ''
		}
	}, [myAddress, profiles?.[0]?.keyID])

	const aaCapsuleAddress = useMemo(() => {
		const raw = profiles?.[0]?.aaAccount?.trim() ?? ''
		if (!raw || !ethers.isAddress(raw)) return ''
		try {
			return ethers.getAddress(raw)
		} catch {
			return ''
		}
	}, [profiles?.[0]?.aaAccount])

	// 头像：优先使用 beamio.image（自定义/IPFS/DiceBear URL），否则用 accountName 生成 DiceBear
	const displayAvatarSrc = beamio?.image?.trim()
		? beamio.image
		: getImg(beamio?.accountName || defaultName)
	const handleCopyUsername = async () => {
		const username = beamio?.accountName
		if (!username) return

		try {
			await navigator.clipboard.writeText(`@${username}`)
			setCopiedUsername(true)
			setTimeout(() => setCopiedUsername(false), 2000) // 2 秒后恢复
		} catch (e) {
			console.error('copy username failed', e)
		}
	}

	useEffect(() => {
		if (!beamio) return
		if (beamio.accountName) {
			setAvatarName(beamio.accountName)
			setAvatarSeed(beamio.accountName)
			setFirstName(beamio.firstName || '')
			const _lastName = beamio.lastName?.split('\r\n')[0]
			setLastName(_lastName || '')
			const img = beamio.image?.trim()
			setAvatarImageDataTemp(img || getImg(beamio.accountName))
			setCreatedAt(beamio.createdAt || 0)
		}
		setDarkModle(beamio.darkTheme)
		if (beamio.image && !/^http/.test(beamio.image)) {
			setAvatarImageData(beamio.image)
		}
	}, [receiveOpen, beamio])

	
	let init = false

	const initProcess = () => {
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
			setAvatarSeed(beamio.accountName)
			setFirstName(beamio.firstName || '')
			const _last = beamio.lastName || ''
			const img = beamio.image?.trim()
			setAvatarImageDataTemp(img || getImg(beamio.accountName))
			setCreatedAt(beamio.createdAt || 0)
		}

	}

	useEffect(() => {
		if (init) return
		init = true

		initProcess()
		
	}, [])

	/** Follow 数量：先读 localStorage，再拉 API；失败保留缓存。按 EOA 隔离。 */
	useEffect(() => {
		const eoa = profiles?.[0]?.keyID?.trim()
		if (!eoa || !ethers.isAddress(eoa)) {
			setFollowingCount(0)
			setFollowerCount(0)
			return
		}
		const hit = loadSettingsFollowCounts(eoa)
		if (hit) {
			setFollowingCount(hit.followingCount)
			setFollowerCount(hit.followerCount)
		}
		const curHit = loadSettingsCurrencyLabel(eoa)
		if (curHit) setCurrencyDisplay(curHit)

		let cancelled = false
		;(async () => {
			try {
				const res = await getMyFollowStatus(eoa)
				if (cancelled || !res) return
				setFollowingCount(res.followingCount)
				setFollowerCount(res.followerCount)
				saveSettingsFollowCounts(eoa, res.followingCount, res.followerCount)
			} catch {
				/* 保留已展示的本地缓存 */
			}
		})()
		return () => {
			cancelled = true
		}
	}, [profiles?.[0]?.keyID])

	useEffect(() => {
		const cur = beamio?.currency?.trim()
		if (!cur) return
		setCurrencyDisplay(cur)
		const eoa = profiles?.[0]?.keyID?.trim()
		if (eoa && ethers.isAddress(eoa)) saveSettingsCurrencyLabel(eoa, cur)
	}, [beamio?.currency, profiles?.[0]?.keyID])

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

	const ProfileInformation = () => {
		const info = {
			title: tu('your_beamio_profile'),
			description1: tu('manage_account_security_and_payment_settings_from_the_gear_icon_in_the_t'),
			description2: tu('tap_following_or_followers_to_see_your_connections'),
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
		<div className="relative w-full">
			{/* ✅ 填满刘海顶部那条区域（PWA/standalone 更稳定） */}
			<div className="fixed left-0 right-0 top-0 z-0 h-[env(safe-area-inset-top)] bg-gradient-to-r from-sky-500 to-blue-600" />

			{/* 顶部蓝色区域 */}
			<div
			className="
				relative z-10
				bg-gradient-to-r from-sky-500 to-blue-600 text-white
				px-5 pb-10
				pt-[calc(env(safe-area-inset-top)+12px)]
				rounded-b-[28px]
				shadow-[0_8px_24px_rgba(15,23,42,0.35)]
			"
			>
			<div className="-mx-5 flex items-start justify-between gap-3 px-5 min-w-0">
				<button
					type="button"
					tabIndex={-1}
					onClick={closeProfileScreen}
					aria-label={tu('close')}
					className="
						mt-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full
						border border-white/40 bg-white/20 text-white/80 backdrop-blur-md
						shadow-[0_1px_3px_rgba(0,0,0,0.12)]
						transition active:scale-[0.96] hover:bg-white/30
					"
				>
					<X className="h-[17px] w-[17px] stroke-[2.5]" aria-hidden />
				</button>
				<div className="flex items-center gap-2 mt-2 min-w-0 max-w-[50%]">
					<span className="text-white/15 text-right break-all">{version}</span>
				</div>
			</div>

			{/* 头像 + username + address + follow */}
			<div className="flex flex-col items-center text-center">
				<div className="mr-2 flex-shrink-0">
				{displayAvatarSrc && (
					<IpfsImg
						key={displayAvatarSrc}
						src={displayAvatarSrc}
						alt={beamio?.accountName}
						className="h-20 w-20 rounded-full object-cover"
					/>
				)}
				</div>

				{/* @username + copy */}
				<div className="mt-4 flex flex-col items-center gap-1">
					<div className="flex items-center gap-3 rounded-full bg-black/0 px-5 py-1">
						<span className="text-[18px] font-semibold tracking-tight text-white leading-none flex items-center">
							@{beamio?.accountName || 'Beamio'}
						</span>
						

						<motion.button
							type="button"
							onClick={handleCopyUsername}
							className="
								flex items-center justify-center
								h-6 w-6 rounded-full
								bg-black/20 backdrop-blur-sm
								leading-none
							"
							whileTap={{ scale: 0.9 }}
							transition={{ duration: 0.12 }}
						>
							<AnimatePresence initial={false} mode="wait">
								{copiedUsername ? (
								<motion.span
									key="check-username"
									initial={{ opacity: 0, scale: 0.6 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.6 }}
									className="flex items-center justify-center"
								>
									<Check className="block w-4 h-4 text-emerald-400" />
								</motion.span>
								) : (
								<motion.span
									key="copy-username"
									initial={{ opacity: 0, scale: 0.6 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.6 }}
									className="flex items-center justify-center"
								>
									<Copy className="block w-3.5 h-3.5 text-white/95" />
								</motion.span>
								)}
							</AnimatePresence>
						</motion.button>
					</div>

					{
						beamio && <span className="text-[16px] font-semibold tracking-tight text-white leading-none flex items-center">
							{displayName(beamio)} since {buildCreatedAtLabel(createAt)}
					
						</span>
					}
						

				</div>

				{/* following / followers */}
				<div
				className="
					mt-4 flex items-center
					overflow-hidden text-white
					h-[56px] min-w-[240px] px-4
					backdrop-blur-sm
				"
				>
				<button
					type="button"
					onClick={() => {
						setNavigateLeftButtonArray([{
							title: '',
							action: [
								() => setSettingsOpen(''),
								() => setShowFooter(true)
								
							]

						}])
											
						setShowFooter(false)
						setSettingsOpen('FollowList')
					}}
					className="flex flex-1 flex-col items-center justify-center active:opacity-70"
				>
					<span className="text-[15px] font-semibold">{followingCount}</span>
					<span className="uppercase tracking-[0.16em] text-[10px] text-white/75">{tu('following')}</span>
				</button>

				<div className="w-px h-8 bg-white/30" />

				<button
					type="button"
					onClick={() => {
						setNavigateLeftButtonArray([{
							title: '',
							action: [
								() => setSettingsOpen(''),
								() => setShowFooter(true)
							]

						}])
											
						setShowFooter(false)
						setSettingsOpen('FollowList')
					}}
					className="flex flex-1 flex-col items-center justify-center active:opacity-70"
				>
					<span className="text-[15px] font-semibold">{followerCount}</span>
					<span className="uppercase tracking-[0.16em] text-[10px] text-white/75">{tu('followers')}</span>
				</button>
				</div>
			</div>
			</div>
		</div>
		)

		return (
			<div className="w-full min-h-screen bg-white text-slate-900 dark:bg-white dark:text-slate-900">
			{
				!settingsOpen && (
					<>
						<HeadArea />

							{/* ✅ 这块就是图里蓝色下方的两张白卡 */}
							<div className="relative z-10 -mt-5 px-4 pb-10">
							<ProfileWalletPanels
								eoaAddress={eoaCapsuleAddress}
								aaAddress={aaCapsuleAddress}
								eoaBalanceUsdc={conetWalletBalances.usdc}
								aaBalanceUsdc={conetAaWalletBalances.usdc}
							/>

							{/* Settings list */}
							<div className="mt-5 rounded-[26px] bg-white shadow-[0_14px_40px_rgba(15,23,42,0.08)] overflow-hidden">
								<SettingRow
								icon={
									<RowIcon tone="blue">
									<ArrowDownToLine className="w-5 h-5" />
									</RowIcon>
								}
								title={tu('deposit_usdc')}
								onClick={() => {
									if (!eoaCapsuleAddress) return
									openExternalUrl(buildWalletUsdcDepositUrl({ beneficiary: eoaCapsuleAddress }))
								}}
								/>

								<div className="h-px bg-slate-100 mx-5" />

								<SettingRow
								icon={
									<RowIcon>
									<User className="w-5 h-5" />
									</RowIcon>
								}
								title={tu('account_details')}
								onClick={() => {

									setSettingsOpen('Account')
									setShowFooter(false)
									setNavigateLeftButtonArray([{
										title: 'Account',
										action: [
											// () => navigate('/History'),
											() => setSettingsOpen(''),
											() => setShowFooter(true)
											
										]

									}])
								}}
								/>

								<div className="h-px bg-slate-100 mx-5" />

								<SettingRow
									icon={
										<RowIcon>
										<Globe className="w-5 h-5" />
										</RowIcon>
									}
									title={tu('language_currency')}
									right={<span className="text-[15px] font-semibold text-slate-400">
										{currencyDisplay}
									</span>}
									onClick={() => {
										setNavigateLeftButtonArray([{
											titleKey: 'language_currency',
											title: tu('language_currency'),
											action: [
												// () => navigate('/History'),
												() => setSettingsOpen(''),
												() => setShowFooter(true)
												
											]

										}])
										setSettingsOpen('Region')
										setShowFooter(false)
									}}
								/>

								<div className="h-px bg-slate-100 mx-5" />

								<SettingRow
									icon={
										<RowIcon tone="orange">
										<Shield className="w-5 h-5" />
										</RowIcon>
									}
									title={tu('backup_wallet')}
									right={<span className="text-[15px] font-bold text-orange-500">{tu('high_priority')}</span>}
									onClick={() => {
										setNavigateLeftButtonArray([{
											title: tu('recovery_backup'),
											action: [
												// () => navigate('/History'),
												() => setSettingsOpen(''),
												() => setShowFooter(true)
												
											]

										}])
										setSettingsOpen('RecoveryBackupScreen')
										setShowFooter(false)
									}}
									/>

									{/* <div className="h-px bg-slate-100 mx-5" />

									<SettingRow
									icon={
										<RowIcon>
										<Bell className="w-5 h-5" />
										</RowIcon>
									}
									title={tu('notifications')}
									right={<span className="text-[15px] font-semibold text-slate-400">{tu('on')}</span>}
									onClick={() => {
										setNavigateLeftButtonArray([{
											title: tu('notifications'),
											action: [
												// () => navigate('/History'),
												() => setSettingsOpen(''),
												() => setShowFooter(true)
												
											]

										}])
										setSettingsOpen('通知')
										setShowFooter(false)
									}}
								/> */}
{/* 
								<div className="h-px bg-slate-100 mx-5" />

								<SettingRow
								icon={
									<RowIcon>
									<HelpCircle className="w-5 h-5" />
									</RowIcon>
								}
								title={tu('help_support')}
								onClick={() => {
									setNavigateLeftButtonArray([{
											title: '帮助与支持',
											action: [
												// () => navigate('/History'),
												() => setSettingsOpen(''),
												() => setShowFooter(true)
												
											]

										}])
										setSettingsOpen('Help')
										setShowFooter(false)
								}}
								/> */}
							</div>
							</div>
					
					</>
				)
			}
			
			
    		

					{/* Settings full-screen slide-over（你原样） */}
					<div
						className={[
							"pt-[env(safe-area-inset-top)]",
							'pb-[env(safe-area-inset-bottom)]',
							'pl-[env(safe-area-inset-left)]',
							'pr-[env(safe-area-inset-right)]',
							"fixed inset-0 z-40 flex-1 overflow-y-auto bg-white",
							"transition-transform duration-300 ease-out",
							(!!settingsOpen) ? "translate-x-0" : "translate-x-full",
						].join(" ")}
					>

						{/* Header：返回 + 居中标题 */}
						<div
							className="
								absolute
								top-[env(safe-area-inset-top)]
								left-0 right-0
								h-14
								flex items-center
								px-4
								z-50
								bg-transparent
								pointer-events-none
							"
						>
							<div className="
							fixed
							top-0 left-0 right-0
							z-50
							bg-transparent
							pointer-events-none
							">
								<div className="
								px-4
								pt-[calc(env(safe-area-inset-top)+8px)]
								pb-2
								pointer-events-auto
								">
									<NavigateLeftButton />
								</div>
							</div>

							
						</div>
						<div className="flex-1 mt-14">
							{settingsOpen === 'BeamioSettings' && (
							<BeamioSettingsScreen onClose={() => {
								setSettingsOpen('')
								setShowFooter(true)
							}} />
							)}

							{
								settingsOpen === 'FollowList' && (
								<FollowListContainer tab={setFollowOpen || 'following'} onClose={() => {
									setSettingsOpen('')
									setShowFooter(true)
								}} />
								)
							}

							{
								settingsOpen === 'Account' && <BeamioAccountScreen colse={(bo: beamio) => {
									setSettingsOpen('')
									setShowFooter(true)
								}} />
							}

							{
								settingsOpen === '通知' && <BeamioNotificationsSettingsScreen colse={() => {
									setSettingsOpen('')
									setShowFooter(true)
								}} />
							}

							{
								settingsOpen === 'Region' && <BeamioRegionCurrencyScreen colse={() => {
									setSettingsOpen('')
									setShowFooter(true)
								}} />
							}

							{
								settingsOpen === 'Help' && <BeamioGetHelpSettingsScreen colse={() => {
									setSettingsOpen('')
									setShowFooter(true)
								}} />
							}
							{
								settingsOpen === 'RecoveryBackupScreen' && <Security />
							}

							{settingsOpen === 'CoinbaseRamp' && <CoinbaseRamps />}
						</div>
					</div>

					{/* Receive slide-over（你原样） */}
					<div
						className={[
							'fixed inset-0 z-50 bg-white dark:bg-slate-900',
							'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]',
							'transition-transform duration-300 ease-out flex flex-col',
							receiveOpen ? 'translate-x-0' : 'translate-x-full',
						].join(' ')}
					>
						<button
							onClick={() => {
							setPayTag('')
							setReceiveOpen(false)
							}}
							className="
							absolute top-4 right-4
							w-8 h-8 rounded-full
							bg-sky-200/60 dark:bg-sky-900/40
							backdrop-blur-md shadow
							flex items-center justify-center
							text-sky-700 dark:text-sky-200
							"
						>
							✕
						</button>

						<div className="flex-1 overflow-y-auto">
							<BeamioReceiveScreen />
						</div>
					</div>

					{showPrivateKeyPopup()}
  			</div>

		)
}
