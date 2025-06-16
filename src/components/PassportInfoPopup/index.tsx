import { useDaemonContext } from "../../providers/DaemonProvider";
import { getExpirationDate, getPassportTitle, isInfinite } from "../../utils/utils";
import './index.css';
import Skeleton from "../Skeleton";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next'

const PassportInfoPopup = () => {
  	const { profiles, activePassport, isPassportInfoPopupOpen, setIsPassportInfoPopupOpen } = useDaemonContext();
	const { t, i18n } = useTranslation()
  	const navigate = useNavigate()
  	

  	const passportTitle = getPassportTitle(activePassport, t('passport_Freemium'), t('passport_Guardian'), t('passport_Annually'),t('passport_Quarter'),t('passport_Monthly'), t('passport_Infinite'));

  return isPassportInfoPopupOpen ? (
    <div className="home-popup-backdrop" onClick={() => setIsPassportInfoPopupOpen(false)}>
      <div className="home-nft-info">
        <div className="home-main-card">
          <div style={{ display: "flex", flexDirection: 'column', textAlign: 'start', gap: '16px' }}>
            <span>{t('comp-PassportInfoPopup-1')}</span>
            {
              activePassport ? <p style={{color: isInfinite(activePassport) ? 'gold' : ''}}>{passportTitle}</p> : <Skeleton width="120px" height="32px" />
            }
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: '16px' }}>
            <span>{t('comp-PassportInfoPopup-2')}</span>
            {
              profiles?.[0]?.activePassport?.expires ?
                <p>{getExpirationDate(activePassport, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour'))}</p>
                : <Skeleton width='50px' height='20px' />
            }
          </div>
        </div>

        <div className="home-buttons">
          {/* <button disabled={(passportTitle !== 'Annually' && passportTitle !== 'Guardian') ? false : true} onClick={() => navigate('/wallet')}>
            <img src="./assets/conet-outline-blue.svg" />
            <span>Upgrade</span>
          </button> */}

          <button onClick={() => setIsPassportInfoPopupOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  ) : <></>
};

export default PassportInfoPopup;