import { IpfsImg } from '@/components/IpfsImg';
// @/components/Setting.tsx

import React, { useState, useEffect } from 'react'
import styles from './setting.module.scss'
import { ReactComponent as SettingsIconBlue } from "@/components/Footer/assets/settings-icon-grey.svg"
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import { useDaemonContext } from '@/providers/DaemonProvider'
import { Popup, Toast } from 'antd-mobile'

import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { storeSystemData } from '@/services/beamio'
import CryptoAssetsCard from './CryptoAssetsCard/CryptoAssetsCard'
import Privatekey from './PrivateKey/PrivateKey'
import { tu } from '@/locale/beamioLocale'

const defaultName = 'Beamio'
const Setting = ({}) => {

	const { darkModle, setDarkModle, setProfiles, beamio, setBeamio } = useDaemonContext()


	const [avatarSeed, setAvatarSeed] = useState('NY')
	const [avatarName, setAvatarName] = useState('')
	const [avatarFileUrl, setAvatarFileUrl] = useState<string | null>(null)
	const [avatarImageData, setAvatarImageData] = useState<string | null>(null)
	const [avatarImageDataTemp, setAvatarImageDataTemp] = useState<string | null>(null)

	const [privatekeyVisible, setPrivatekeyVisible] = useState(false)
	const [avatarEditorVisible, setAvatarEditorVisible] = useState(false)
	const [avatarFileName, setAvatarFileName] = useState<string>('')

	const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

	const displayName = avatarName || defaultName

	const currentAvatarSrc = avatarImageData || avatarUrl
	const currentAvatarSrcTemp = avatarImageDataTemp || avatarFileUrl || avatarUrl

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
	}, [])

	useEffect(() => {
		storageSetup()
	}, [ darkModle, avatarName, avatarImageData ])



	const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		const url = URL.createObjectURL(file)
		setAvatarFileUrl(prev => {
		if (prev) URL.revokeObjectURL(prev)
		return url
		})
		setAvatarFileName(file.name)

		const reader = new FileReader()
		reader.onloadend = () => {
		const dataUrl = reader.result as string
		setAvatarImageDataTemp(dataUrl)
		}
		reader.readAsDataURL(file)
	}

	const storageSetup = () => {
		const tmpData = CoNET_Data
		let _beamio = beamio
		if (!tmpData || avatarSeed === 'NY'||!_beamio) {
		return
		}
		
		

		_beamio.accountName= avatarName || defaultName
		_beamio.image = avatarImageData || currentAvatarSrc
		_beamio.darkTheme = darkModle
		tmpData.beamio = _beamio
		setCoNET_Data(tmpData)
		if (CoNET_Data?.profiles) {
			setProfiles(CoNET_Data.profiles)
			storeSystemData()
		}
		
		
		setBeamio({..._beamio})
	}

		const getPrivatekey = (): string => {
			const profile = CoNET_Data?.profiles?.[0]
			if (!profile || !profile?.privateKeyArmor) return ''
			const ret = profile.privateKeyArmor.replace(/^0x/i, '')
			return ret
		}


	const handleSaveAvatar = () => {
		setAvatarEditorVisible(false)
		setAvatarName(avatarSeed||defaultName)
		if (avatarImageDataTemp !== avatarImageData) {
			setAvatarImageData(avatarImageDataTemp)
		}
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
		<div className={styles.settingWrapper}>
		{/* 顶部大圆弧背景 */}
		<div className={styles.headerCircle} />

		{/* 右上角按钮区 */}
		<div className={styles.headerActions}>
				<button
					type="button"
					className={styles.headerBtn}
					aria-label={tu('toggle_theme')}
					onClick={() => setDarkModle(!darkModle)}
				>
					<span className={styles.headerBtnIcon}>
						{darkModle ? <LightDrakMode /> : <LightDrakModeBlue />}
					</span>
				</button>

				{/* ✅ 点击设置按钮，打开私钥 Popup */}
				<button
					type="button"
					className={styles.headerBtn}
					aria-label={tu('settings')}
					onClick={() => setPrivatekeyVisible(true)}
				>
					<span className={styles.headerBtnIcon}>
						<SettingsIconBlue />
					</span>
				</button>
		</div>

		{/* 中间圆形头像：点击弹出右侧滑入表单 */}
		<div
			className={styles.avatarBubble}
			onClick={() => {
				if (avatarImageData) {
					setAvatarImageDataTemp(avatarImageData)
				}
				setAvatarEditorVisible(true)
			}}
		>
			<IpfsImg
			src={currentAvatarSrc}
			alt={tu('ai_avatar')}
			className={styles.avatarImage}
			/>
		</div>

		{/* 头像下方显示名称 */}
		<div className={styles.avatarName}>
			@{displayName}
		</div>

		{/* 主体内容区域（白色 body） */}
		<div className={styles.contentArea}>
			<CryptoAssetsCard
			onKeyClick={() => {
				console.log('key clicked')
			}}
			/>
			{/* 其他 Setting 内容 */}
		</div>

		{/* 右侧滑入的头像编辑表单 */}
		<Popup
			position="right"
			visible={avatarEditorVisible}
			onMaskClick={() => setAvatarEditorVisible(false)}
			bodyStyle={{
			width: '80vw',
			maxWidth: 360,
			padding: 0,
			boxSizing: 'border-box',
			background: 'transparent',
			}}
		>
			<div className={styles.avatarEditorPanel}>
			<div className={styles.avatarEditorHeader}>
				<h3 className={styles.avatarEditorTitle}>{tu('beamio_settings')}</h3>
				<button
				type="button"
				className={styles.avatarEditorClose}
				onClick={() => setAvatarEditorVisible(false)}
				>
				✕
				</button>
			</div>

			<div className={styles.avatarEditorPreview}>
				<div className={styles.avatarWrapper}>
				<IpfsImg
					src={currentAvatarSrcTemp}
					alt={tu('avatar_preview')}
					className={styles.avatarEditorImage}
				/>

				{avatarImageDataTemp && (
					<button
						type="button"
						onClick={() => {
							setAvatarImageDataTemp(null)
							setAvatarFileUrl(null)
							setAvatarFileName('')
						}}
						className={styles.avatarDeleteBadge}
					>
						<span className="font-bold text-lg leading-none">×</span>
					</button>
					)}
				</div>
			</div>

			<div className={styles.avatarEditorField}>
				<label className={styles.avatarEditorLabel}>{tu('beamio_name')}</label>
				<input
				type="text"
				value={avatarSeed}
				onChange={e => {

					setAvatarSeed(e.target.value)
				}}

				className={styles.avatarEditorInput}
				placeholder={tu('let_other_beamioers_can_you')}
				/>
			</div>

			<div className={styles.avatarEditorField}>
				<label className={styles.avatarEditorLabel}>{tu('choose_from_photos')}</label>

				<label
				className={`${styles.avatarEditorUploadBtn} ${
					darkModle ? styles.darkBtn : styles.lightBtn
				}`}
				>{tu('choose_photo')}<input
					id="avatarFileInput"
					type="file"
					accept="image/*"
					capture="environment"
					onChange={handleAvatarFileChange}
					className={styles.avatarEditorFileInput}
				/>
				</label>
			</div>

			<div className={styles.avatarEditorActions}>
				<button
					type="button"
					className={styles.avatarEditorCancel}
					onClick={() => setAvatarEditorVisible(false)}
				>{tu('cancel')}</button>
				<button
					type="button"
					className={styles.avatarEditorSave}
					onClick={handleSaveAvatar}
				>{tu('save')}</button>
			</div>
			</div>
		</Popup>

		{/* ✅ 私钥 Popup：始终挂在根组件下，由 privatekeyVisible 控制显示 */}
		{showPrivateKeyPopup()}
		</div>
	)
}

export default Setting
