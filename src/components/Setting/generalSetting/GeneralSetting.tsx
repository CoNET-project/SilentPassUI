import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './generalSetting.module.scss'
import { useTranslation } from 'react-i18next'
import { List, Badge, Dialog, Toast } from 'antd-mobile'
import { GlobalOutlined, CloudSyncOutlined } from '@ant-design/icons'
import Languages from './../../Languages'
import { getLocalServerVersion } from '@/api'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { Bridge } from '@/bridge/webview-bridge'

const GeneralSetting = ({}) => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const { isLocalProxy, isIOS, power, switchValue, setSwitchValue, hasNewVersion, setHasNewVersion, version, darkModle } =
    useDaemonContext()

  const handleChangeSwitch = (val: boolean) => {
    setSwitchValue(val)
    if (val && power) {
      if (window?.webkit) {
        window?.webkit?.messageHandlers['startProxy'].postMessage('')
      }
    } else {
      if (window?.webkit) {
        window?.webkit?.messageHandlers['stopProxy'].postMessage('')
      }
    }
  }

  const compairVersionNew = async () => {
    const remoteVer = await getLocalServerVersion()
    if (isNewerVersion(version, remoteVer)) {
      setHasNewVersion(remoteVer)
      Dialog.show({
        content: t('home-newversion') + hasNewVersion,
        closeOnAction: true,
        actions: [
          [
            { key: 'cancel', text: t('cancel') },
            { key: 'confirm', text: t('confirm'), onClick: () => refresh() },
          ],
        ],
      })
    } else {
      Toast.show({
        content: t('hasNoUpdate'),
      })
    }
  }

  const isNewerVersion = (oldVer: string, newVer: string): boolean => {
    if (!oldVer || !newVer) return false
    const oldParts = oldVer.split('.').map(Number)
    const newParts = newVer.split('.').map(Number)

    for (let i = 0; i < oldParts.length; i++) {
      if (newParts[i] > oldParts[i]) return true
      if (newParts[i] < oldParts[i]) return false
    }
    return false
  }

  const refresh = async () => {
    if (isLocalProxy) {
      await Bridge.send('stopVPN', {}, (res: any) => {})
      window.location.reload()
    } else if (isIOS) {
      window?.webkit?.messageHandlers['updateVPNUI'].postMessage(null)
    } else if ((window as any).AndroidBridge && (window as any).AndroidBridge.receiveMessageFromJS) {
      const base = btoa(JSON.stringify({ cmd: 'updateVPNUI', data: '' }))
      ;(window as any).AndroidBridge.receiveMessageFromJS(base)
    }
  }

  return (
    <>
      <div className={styles.general}>
        <List header={t('Settings_General')}>
          <List.Item
            prefix={
              <span className={styles.icon}>
                <GlobalOutlined />
              </span>
            }
            extra={t(i18n.language)}
            onClick={() => setVisible(true)}
          >
            {t('language')}
          </List.Item>

          <List.Item
            prefix={
              <span className={styles.icon}>
                <CloudSyncOutlined />
              </span>
            }
            onClick={() => compairVersionNew()}
          >
            {t('checkUpdate')} {hasNewVersion ? <Badge content='1' /> : ''}
          </List.Item>
        </List>
      </div>

      <Languages visible={visible} setVisible={setVisible} />
    </>
  )
}

export default GeneralSetting
