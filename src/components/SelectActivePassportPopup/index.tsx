import { useEffect, useMemo, useState } from 'react';
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getExpirationDate, getPassportTitle } from '../../utils/utils';
import './index.css';
import Separator from '../Separator';
import { changeActiveNFT, estimateChangeNFTGasFee } from '../../services/wallets';
import Skeleton from '../Skeleton';
import { useTranslation } from 'react-i18next'

const SelectActivePassportPopup = ({ newPassport }: any) => {
	const { t, i18n } = useTranslation()
  const { profiles, setActivePassport, activePassport, setIsSelectPassportPopupOpen } = useDaemonContext();

  const currentPassportName = useMemo(() => getPassportTitle(activePassport, t('passport_Freemium'), t('passport_Guardian'), t('passport_Annually'),t('passport_Quarter'),t('passport_Monthly'), t('passport_Infinite')) + ' Passport', [activePassport])
  const newPassportName = getPassportTitle(newPassport, t('passport_Freemium'), t('passport_Guardian'), t('passport_Annually'),t('passport_Quarter'),t('passport_Monthly'), t('passport_Infinite')) + ' Passport';
  const newPassportExpiration = getExpirationDate(newPassport, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour'));

  const [isChangeLoading, setIsChangeLoading] = useState(false);
  const [estimatedGasFee, setEstimatedGasFee] = useState('');

  async function handleChangeActiveNFT() {
    try {
      setIsChangeLoading(true);

      const result = await changeActiveNFT(newPassport.nftID)
	  if (!result) {
		 return 
	  }
	  setActivePassport(profiles.activePassport)
      await new Promise((resolve) => setTimeout(resolve, 6000));

      setIsSelectPassportPopupOpen(false);
	  setIsChangeLoading(false);
      setEstimatedGasFee('');
    } catch (ex) {
      console.log(ex)
    }
  }

  useEffect(() => {
    if (!newPassport?.nftID) return;

    (async () => {
		setEstimatedGasFee('0')
    //   try {
    //     const gasFeeValues = await estimateChangeNFTGasFee('mainnet', newPassport.nftID)

    //     if (!gasFeeValues) return;

    //     setEstimatedGasFee(gasFeeValues.gasFee)
    //   } catch (ex) {
    //     console.log(ex);
    //   }
    })()
  }, [newPassport?.nftID])

  return (
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
                  <p style={{ textAlign: 'right', fontSize: '16px' }}> {getExpirationDate(activePassport, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour'))}</p>
                </div>
              </div>

              <div style={{ width: '100%' }}>
                <div style={{ width: '100%' }}>
                  <p style={{ textAlign: 'left', fontSize: '14px', color: '#989899' }}>To</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                  <p style={{ textAlign: 'left', fontSize: '16px' }}>{newPassportName}</p>
                  <p style={{ textAlign: 'right', fontSize: '16px' }}>{newPassportExpiration}</p>
                </div>
              </div>
            </div>
            <Separator />
            {/* <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <p style={{ textAlign: 'left', fontSize: '16px', width: 'fit-content' }}>GAS fee</p>
                {
                  estimatedGasFee ? (
                    <p style={{ textAlign: 'right', fontSize: '16px', width: 'fit-content' }}>{estimatedGasFee} $ETH</p>
                  ) : (
                    <Skeleton width="210px" height="21px" />
                  )
                }
              </div>
            </div> */}
          </div>
        </div>

        <div className="home-buttons">
          <button style={{ height: '47px', }} disabled={!estimatedGasFee || profiles?.[0]?.tokens?.conet_eth?.balance < Number(estimatedGasFee)} onClick={handleChangeActiveNFT}>
            {
              isChangeLoading ? <img className="loading-spinning" src="/assets/loading-ring.png" style={{ width: '24px', height: '24px' }} alt="" /> : (
                <span>{estimatedGasFee && profiles?.[0]?.tokens?.conet_eth?.balance < Number(estimatedGasFee) ? 'No funds' : 'Change'}</span>
              )
            }
          </button>

          <button onClick={() => setIsSelectPassportPopupOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  )
};

export default SelectActivePassportPopup;