import { useDaemonContext } from "../../providers/DaemonProvider";
import { getRemainingTime } from "../../utils/utils";
import './index.css';
import Skeleton from "../Skeleton";

const SelectActivePassportPopup = ({ isOpen, setIsOpen, currentPassportName, currentPassportExpiration, newPassportName, newPassportExpirationDays }: any) => {
  const { profiles } = useDaemonContext();

  return isOpen ? (
    <div className="home-popup-backdrop" onClick={() => setIsOpen(false)}>
      <div className="home-nft-info">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '100%' }}>
            <p style={{ fontSize: '20px', fontWeight: 400, textAlign: 'left' }}>Change Passport?</p>
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ width: '100%' }}>
              <div style={{ width: '100%' }}>
                <p style={{ textAlign: 'left', fontSize: '14px', color: '#989899' }}>From</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <p style={{ textAlign: 'left', fontSize: '16px' }}>{currentPassportName}</p>
                <p style={{ textAlign: 'right', fontSize: '16px' }}>until {currentPassportExpiration}</p>
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <div style={{ width: '100%' }}>
                <p style={{ textAlign: 'left', fontSize: '14px', color: '#989899' }}>To</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <p style={{ textAlign: 'left', fontSize: '16px' }}>{newPassportName}</p>
                <p style={{ textAlign: 'right', fontSize: '16px' }}>{newPassportExpirationDays} days</p>
              </div>
            </div>
          </div>


        </div>

        <div className="home-buttons">
          <button>
            <span>Change</span>
          </button>

          <button onClick={() => setIsOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  ) : <></>
};

export default SelectActivePassportPopup;