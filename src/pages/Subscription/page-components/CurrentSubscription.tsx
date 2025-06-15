import { useDaemonContext } from "../../../providers/DaemonProvider";
import { getExpirationDate, getPassportTitle, getPlanDuration } from "../../../utils/utils";
import { useTranslation } from 'react-i18next'

export default function CurrentSubscription() {
  const { activePassport } = useDaemonContext();
  const { t, i18n } = useTranslation()
  return (
    <div className="current">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h4 style={{ fontSize: '20px' }}>{t(getPassportTitle(activePassport))} Passport</h4>
        <p>{getPlanDuration(activePassport)}</p>
      </div>
      <p>Expiration date: <strong>{getExpirationDate(activePassport, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour'))}</strong></p>
    </div>
  )
}