import { useNavigate } from "react-router-dom";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getExpirationDate, getPassportTitle } from "../../utils/utils";
import Skeleton from "../Skeleton";
import { useTranslation } from 'react-i18next'

const ActivePassportInfo = () => {
  const navigate = useNavigate();
  const { profiles, activePassport } = useDaemonContext();
  const { t, i18n } = useTranslation();

  return (
    <div className="main-card">
      <div style={{textAlign: 'start', display: 'flex', flexDirection: 'column'}}>
        <span>{t('comp-PassportInfoPopup-1')}</span>
        
        {<p>{t(getPassportTitle(activePassport))}</p>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
        <span>{t('comp-PassportInfoPopup-2')}</span>
        {
          profiles?.[0]?.activePassport?.expires ?
            <p>{getExpirationDate(activePassport, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour'))}</p>
            : <Skeleton width='140px' height='32px' />
        }
      </div>
    </div>
  );
};

export default ActivePassportInfo;