import { useDaemonContext } from "../../providers/DaemonProvider";
import { getRemainingTime } from "../../utils/utils";
import './index.css';
import Skeleton from "../Skeleton";

const PassportInfoPopup = () => {
  const { profiles, isPassportInfoOpen, setIsPassportInfoOpen } = useDaemonContext();

  return isPassportInfoOpen ? (
    <div className="home-popup-backdrop" onClick={() => setIsPassportInfoOpen(false)}>
      <div className="home-nft-info">
        <div className="home-main-card">
          <div style={{ display: "flex", flexDirection: 'column', textAlign: 'start', gap: '16px' }}>
            <span>Silent Pass Passport</span>
            <p>Freemium</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: '16px' }}>
            <span>Expiration date</span>
            {
              profiles?.[0]?.activePassport?.expires ?
                <p>{getRemainingTime(profiles?.[0]?.activePassport?.expires)}</p>
                : <Skeleton width='50px' height='20px' />
            }
          </div>
        </div>

        <div className="home-buttons">
          <button className="home-disabled">
            <img src="./assets/conet-outline-gray.svg" />
            <span>Upgrade</span>
          </button>

          <button onClick={() => setIsPassportInfoOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  ) : <></>
};

export default PassportInfoPopup;