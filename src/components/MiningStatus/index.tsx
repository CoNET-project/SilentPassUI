import { useEffect, useState } from 'react';
import "./index.css";
import { useDaemonContext } from '../../providers/DaemonProvider';
import Skeleton from '../Skeleton'

import { getPassportTitle, isInfinite } from '../../utils/utils';
import { ReactComponent as ConetToken } from './assets/conet-token.svg';
import { ReactComponent as SpToken } from './assets/sp-token.svg';
import { useTranslation } from 'react-i18next'

const OneDayInSeconds = 86400;

const MiningStatus = () => {
  const { miningData, profiles, setIsPassportInfoPopupOpen, activePassportUpdated, activePassport } = useDaemonContext();
  const [isMiningUp, setIsMiningUp] = useState<boolean>(false);
  const [passportTimeLeft, setPassportTimeLeft] = useState<number>(0);
  const { t, i18n } = useTranslation()

  useEffect(() => {
    if (miningData) {
      setIsMiningUp(miningData?.status === 200)
    }
  }, [miningData])

  useEffect(() => {
    const passportExpiration = profiles?.[0]?.activePassport?.expires
    if (passportExpiration) {
      const timeLeft = passportExpiration - Math.floor(Date.now() / 1000)
      setPassportTimeLeft(timeLeft)
    }
  }, [activePassportUpdated, profiles])

  const openPassportInfo = () => {
    setIsPassportInfoPopupOpen(true)
  }

  return (
    <div className="mining-status">
      <div className="miners">
        <ConetToken /> {miningData?.online ? miningData.online : <Skeleton height="14px" width="45px" />}
      </div>

      <div className='passport-status' onClick={openPassportInfo}>
        <div className={`circle ${passportTimeLeft < OneDayInSeconds ? passportTimeLeft <= 0 ? "red" : "yellow" : isInfinite(activePassport) ? 'gold' : "green"}`}></div>
        {
          profiles?.[0]?.activePassport ? <p style={{'width': 'unset'}}>{t(getPassportTitle(activePassport))}</p> : <Skeleton width="40px" height="15px" />
        }
        <img src="/assets/info.svg" alt="Info icon" />
      </div>

      <div className="users"><SpToken width={20} height={20}/>{miningData?.totalUsers ? miningData.totalUsers : <Skeleton height="14px" width="45px" />}</div>
    </div>
  );
};

export default MiningStatus;
