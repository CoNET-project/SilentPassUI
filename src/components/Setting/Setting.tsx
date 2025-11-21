// @/components/Setting.tsx
import { useTranslation } from 'react-i18next'
import React, { useState, useEffect } from 'react'
import styles from './setting.module.scss'
import { ReactComponent as SettingsIconBlue } from "@/components/Footer/assets/settings-icon-grey.svg"
import { ReactComponent as LightDrakMode } from "@/components/Footer/assets/dark-light-mode-grey.svg"
import { ReactComponent as LightDrakModeBlue } from "@/components/Footer/assets/dark-light-mode-blue.svg"
import { useDaemonContext } from '@/providers/DaemonProvider'
import { Popup, Toast } from 'antd-mobile'
import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { storeSystemData } from '../../services/wallets'
import CryptoAssetsCard from './CryptoAssetsCard/CryptoAssetsCard'
import Privatekey from './PrivateKey/PrivateKey'

const Setting = ({}) => {
  const { t } = useTranslation()
  const { darkModle, setDarkModle, setProfiles } = useDaemonContext()


  const [avatarSeed, setAvatarSeed] = useState('NY')
  const [avatarName, setAvatarName] = useState('')
  const [avatarFileUrl, setAvatarFileUrl] = useState<string | null>(null)
  const [avatarImageData, setAvatarImageData] = useState<string | null>(null)

  const [privatekeyVisible, setPrivatekeyVisible] = useState(false)
  const [avatarEditorVisible, setAvatarEditorVisible] = useState(false)
  const [avatarFileName, setAvatarFileName] = useState<string>('')

  const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(
    	avatarSeed
  )}`

  const displayName = avatarName || 'Beamio'

  const currentAvatarSrc = avatarImageData || avatarFileUrl || avatarUrl

  useEffect(() => {
	if (!currentAvatarSrc) {
		return
	}
    const beamio = CoNET_Data?.beamio
    if (!beamio) return

    if (beamio.accountName) {
      setAvatarName(beamio.accountName)
      setAvatarSeed(beamio.accountName)
    }
	setDarkModle(beamio.darkTheme)


    if (beamio.image) {
      setAvatarImageData(beamio.image)
    }
  }, [])

  useEffect(() => {
    storageSetup()
  }, [darkModle, currentAvatarSrc ])



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
      setAvatarImageData(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  const storageSetup = () => {
    const tmpData = CoNET_Data
    if (!tmpData || !avatarName) {
      return
    }

	const beamio = tmpData.beamio
	beamio.accountName= avatarName
	beamio.image = avatarImageData || currentAvatarSrc
	beamio.darkTheme = darkModle

    setCoNET_Data(tmpData)
    setProfiles(CoNET_Data?.profiles)
    storeSystemData()
  }

  const getPrivatekey = (): string => {
		const profile = CoNET_Data?.profiles?.[0]
		if (!profile || !profile?.privateKeyArmor) return ''
		const ret = profile.privateKeyArmor.replace(/^0x/i, '')
		return ret
  }

  useEffect(() => {
    if (avatarName) {
      setAvatarSeed(avatarName)
    }
  }, [avatarName])

  const handleSaveAvatar = () => {

    Toast.show({
      content: 'Avatar settings saved',
      duration: 1500,
    })
    setAvatarEditorVisible(false)
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
          aria-label="Toggle theme"
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
          aria-label="Settings"
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
        onClick={() => setAvatarEditorVisible(true)}
      >
        <img
          src={currentAvatarSrc}
          alt="AI avatar"
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
            <h3 className={styles.avatarEditorTitle}>
              Beamio settings
            </h3>
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
              <img
                src={currentAvatarSrc}
                alt="Avatar preview"
                className={styles.avatarEditorImage}
              />

              {avatarImageData?.startsWith('data:image') && (
				<button
					type="button"
					onClick={() => {
						setAvatarImageData(null)
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
            <label className={styles.avatarEditorLabel}>
              Beamio name
            </label>
            <input
              type="text"
              value={avatarName}
              onChange={e => setAvatarName(e.target.value)}
              className={styles.avatarEditorInput}
              placeholder='Let other beamioers can @ you'
            />
          </div>

          <div className={styles.avatarEditorField}>
            <label className={styles.avatarEditorLabel}>
              Choose from photos
            </label>

            <label
              className={`${styles.avatarEditorUploadBtn} ${
                darkModle ? styles.darkBtn : styles.lightBtn
              }`}
            >
              Choose photo
              <input
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
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.avatarEditorSave}
              onClick={handleSaveAvatar}
            >
              Save
            </button>
          </div>
        </div>
      </Popup>

      {/* ✅ 私钥 Popup：始终挂在根组件下，由 privatekeyVisible 控制显示 */}
      {showPrivateKeyPopup()}
    </div>
  )
}

export default Setting
