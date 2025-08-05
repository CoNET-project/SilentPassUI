import { useTranslation } from 'react-i18next'

export default function Declined(tx: string) {
	const { t, i18n } = useTranslation()
  return (
    <>
      <span style={{ display: 'block' }}></span>

      <div className="step-container">
        <div className="declined-wrapper">
          <img src="/assets/decline.svg" alt="X" />
        </div>
        <div className="declined-description" style={{wordBreak: 'break-all'}}>
          <p>{t('comp-comm-declined')}</p>
		  
		  <p>{t('comp-comm-txHash')}</p>
		  <p>{tx}</p>
          <p>{t('comp-comm-contactUs')}</p>
        </div>
      </div>
    </>
  )
}