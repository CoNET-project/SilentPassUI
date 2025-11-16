import React from 'react'
import styles from './index.module.scss'
import { useTranslation } from 'react-i18next'
import { NavBar, Popup, CheckList, setDefaultConfig } from 'antd-mobile'
import type { CheckListValue } from 'antd-mobile/es/components/check-list'
import zhCN from 'antd-mobile/es/locales/zh-CN'
import enUS from 'antd-mobile/es/locales/en-US'
import jaJP from 'antd-mobile/es/locales/ja-JP'
import { useDaemonContext } from '@/providers/DaemonProvider'

interface LanguagesProps {
  visible: boolean
  setVisible: React.Dispatch<React.SetStateAction<boolean>>
}

const languageList = [
  { name: 'English', value: 'en' },
  { name: '中文', value: 'zh' },
  { name: '日本語', value: 'jp' },
]

const Languages = ({ visible, setVisible }: LanguagesProps) => {
  const { t, i18n } = useTranslation()
  const { darkModle } = useDaemonContext()

  const handleBack = () => {
    setVisible(false)
  }

  const handleChange = async (value: CheckListValue[]) => {
    type AntdLocale = {
      en: typeof enUS
      zh: typeof zhCN
      jp: typeof jaJP
    }
    const antdMLang: AntdLocale = { en: enUS, zh: zhCN, jp: jaJP }

    const selected = (value[0] as string) || 'en'

    // 本地保存语言
    localStorage.lang = selected

    // i18n 切换
    await i18n.changeLanguage(selected)

    // antd-mobile 切换 locale，同时保留当前深浅模式
    setDefaultConfig({
      locale: antdMLang[selected as keyof typeof antdMLang]
    })

    setVisible(false)
  }

  return (
    <Popup
      visible={visible}
      onMaskClick={() => {
        setVisible(false)
      }}
      position='right'
      bodyStyle={{ width: '100%' }} // 不再写死背景颜色
      className={styles.languagePopup}
    >
      <div className={styles.languageCont}>
        <NavBar onBack={handleBack} style={{ '--height': '70px' } as any}>
          {t('language')}
        </NavBar>
        <div className={styles.languageMain}>
          <div className={styles.list}>
            <CheckList value={[i18n.language]} onChange={handleChange}>
              {languageList.map((item, index) => (
                <CheckList.Item key={index} value={item.value}>
                  {item.name}
                </CheckList.Item>
              ))}
            </CheckList>
          </div>
        </div>
      </div>
    </Popup>
  )
}

export default Languages
