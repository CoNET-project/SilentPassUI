import { useDaemonContext } from "../../providers/DaemonProvider";
import { getExpirationDate, getPassportTitle } from "../../utils/utils";
import './index.css';
import Skeleton from "../Skeleton";
import { useNavigate } from "react-router-dom";

const PassportInfoPopup = () => {
  const { profiles, activePassport, isPassportInfoPopupOpen, setIsPassportInfoPopupOpen } = useDaemonContext();

  const navigate = useNavigate();


  return isPassportInfoPopupOpen ? (
    <div className="home-popup-backdrop" onClick={() => setIsPassportInfoPopupOpen(false)}>
      <div className="home-nft-info">
        <div className="home-main-card">
          <div style={{ display: "flex", flexDirection: 'column', textAlign: 'start', gap: '16px' }}>
            <span>Silent Pass Passport</span>
            {
              activePassport ? <p>{getPassportTitle(activePassport)}</p> : <Skeleton width="120px" height="32px" />
            }
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: '16px' }}>
            <span>Expiration date</span>
            {
              profiles?.[0]?.activePassport?.expires ?
                <p>{getExpirationDate(activePassport)}</p>
                : <Skeleton width='50px' height='20px' />
            }
          </div>
        </div>

        <div className="home-buttons">
          <button onClick={() => navigate('/wallet')}>
            <img src="./assets/conet-outline-blue.svg" />
            <span>Upgrade</span>
          </button>

          <button onClick={() => setIsPassportInfoPopupOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  ) : <></>
};

export default PassportInfoPopup;