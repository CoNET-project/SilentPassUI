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
import CryptoAssetsCard from './CryptoAssetsCard/CryptoAssetsCard'   // ✅ 新增

const Setting = ({}) => {
  const { t } = useTranslation()
  const { darkModle, setDarkModle, setProfiles } = useDaemonContext()

  // 这里先写死，之后你可以用真实钱包数据替换
  const walletAddress = '0x775C...Acdd'
  const usdcFiat = '$0.39'
  const usdcAmount = '0.39 USDC'

  // ✅ 用 state 保存当前头像的 seed
  const [avatarSeed, setAvatarSeed] = useState('NY')

  // ✅ 头像名称
  const [avatarName, setAvatarName] = useState('')

  // ✅ 本次会话中新上传的头像预览（objectURL）
  const [avatarFileUrl, setAvatarFileUrl] = useState<string | null>(null)

  // ✅ 已持久化的头像（dataURL 或 URL），用于跨重启显示
  const [avatarImageData, setAvatarImageData] = useState<string | null>(null)

  // ✅ 控制右侧滑入表单是否显示
  const [avatarEditorVisible, setAvatarEditorVisible] = useState(false)
  const [avatarFileName, setAvatarFileName] = useState<string>('')

  const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(
    avatarSeed
  )}`

  const displayName = avatarName || 'Beamio'

  // 当前实际显示的头像：本地新上传 > 持久化图片 > DiceBear
  const currentAvatarSrc = avatarFileUrl || avatarImageData || avatarUrl

  // 启动时，从 CoNET_Data.beamio 恢复
  useEffect(() => {
    const beamio = CoNET_Data?.beamio
    if (!beamio) return

    if (beamio.accountName) {
      setAvatarName(beamio.accountName)
      setAvatarSeed(beamio.accountName)
    }

    if (beamio.image) {
      setAvatarImageData(beamio.image)
    }
  }, [])

  // 处理从手机/电脑选择图片
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
      storageSetup(dataUrl)

      Toast.show({
        content: 'Avatar updated',
        duration: 1500,
      })
    }
    reader.readAsDataURL(file)
  }

  const storageSetup = (imageOverride?: string) => {
    const tmpData = CoNET_Data
    if (!tmpData) {
      return
    }

    if (!tmpData.beamio) {
      tmpData.beamio = {
        accountName: '',
        image: ''
      }
    }

    tmpData.beamio.accountName = avatarName
    tmpData.beamio.image = imageOverride ?? currentAvatarSrc

    setCoNET_Data(tmpData)
    setProfiles(CoNET_Data?.profiles)
    storeSystemData()
  }

  useEffect(() => {
    if (avatarName) {
      setAvatarSeed(avatarName)
    }
  }, [avatarName])

  const handleSaveAvatar = () => {
    storageSetup()
    Toast.show({
      content: 'Avatar settings saved',
      duration: 1500,
    })
    setAvatarEditorVisible(false)
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

        <button
          type="button"
          className={styles.headerBtn}
          aria-label="Settings"
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

	  {/* ✅ 头像下方显示名称 */}
      <div className={styles.avatarName}>
        @{displayName}
      </div>

      {/* 主体内容区域（白色 body） */}
      <div className={styles.contentArea}>
        {/* ✅ 独立的 CryptoAssetsCard 控件 */}
        <CryptoAssetsCard
          fiatAmount={usdcFiat}
          tokenAmount={usdcAmount}
          tokenSymbol="USDC"
          subtitle="Free to send"
          onKeyClick={() => {
            // TODO: 打开 key 管理页面
            console.log('key clicked')
          }}
        />

        {/* 这里继续放原来的 Setting 内容 */}
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
              Account settings
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
            <img
              src={currentAvatarSrc}
              alt="Avatar preview"
              className={styles.avatarEditorImage}
            />
          </div>

          <div className={styles.avatarEditorField}>
            <label className={styles.avatarEditorLabel}>
              Account name
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

            <label className={`${styles.avatarEditorUploadBtn} ${
					darkModle ? styles.darkBtn : styles.lightBtn
				}`}>
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

            {avatarFileName && (
              <div className={styles.avatarEditorFileName}>
                {avatarFileName}
              </div>
            )}
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
    </div>
  )
}

export default Setting
