import { useState } from 'react';
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getRemainingTime } from '../../utils/utils';
import './index.css';
import Separator from '../Separator';

const SelectActivePassportPopup = ({ currentPassport, newPassport }: any) => {
  console.log("CURRENT PASSPORT: ", currentPassport);
  console.log("NEW PASSPORT: ", newPassport);

  const currentPassportName = currentPassport?.premium !== "false" ? 'Premium Passport' : 'Freemium Passport';
  const currentPassportExpiration = getRemainingTime(currentPassport?.expires)
  const newPassportName = newPassport?.premium ? 'Premium Passport' : 'Freemium Passport';
  const newPassportExpiration = getRemainingTime(newPassport?.expires)

  const [isChangeLoading, setIsChangeLoading] = useState(false);

  const { isSelectPassportPopupOpen, setIsSelectPassportPopupOpen } = useDaemonContext();

  async function handleChangeActiveNFT() {
    setIsChangeLoading(true);

    setIsSelectPassportPopupOpen(false);
    setIsChangeLoading(false);
  }

  return isSelectPassportPopupOpen ? (
    <div className="home-popup-backdrop" onClick={() => setIsSelectPassportPopupOpen(false)}>
      <div className="home-nft-info" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '100%' }}>
            <p style={{ fontSize: '20px', fontWeight: 400, textAlign: 'left' }}>Change Passport?</p>
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                  <p style={{ textAlign: 'right', fontSize: '16px' }}>{newPassportExpiration} days</p>
                </div>
              </div>
            </div>
            <Separator />
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <p style={{ textAlign: 'left', fontSize: '16px' }}>GAS fee</p>
                <p style={{ textAlign: 'right', fontSize: '16px' }}>{0.001} $ETH</p>
              </div>
            </div>
          </div>
        </div>

        <div className="home-buttons">
          <button style={{ height: '47px' }} onClick={handleChangeActiveNFT}>
            {
              isChangeLoading ? <img className="loading-spinning" src="/assets/loading-ring.png" style={{ width: '24px', height: '24px' }} alt="" /> : <span>Change</span>
            }
          </button>

          <button onClick={() => setIsSelectPassportPopupOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  ) : <></>
};

export default SelectActivePassportPopup;