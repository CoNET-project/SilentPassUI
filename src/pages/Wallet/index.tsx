import { useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import SuccessModal from './SuccessModal';
import './index.css';
import { getPassportTitle } from '../../utils/utils';
import { setCoNET_Data, CoNET_Data } from '../../utils/globals';
import { useState, useEffect } from "react";
import AccountList from '../../components/AccountList';
import RedeemPassport from '../../components/RedeemPassport';
import SpClub from '../../components/AccountList/SpClub'
import { useDaemonContext } from "../../providers/DaemonProvider"
import SimpleLoadingRing from '../../components/SimpleLoadingRing'

export default function Wallet() {
  const navigate = useNavigate()
    const { successNFTID, setSuccessNFTID, activePassport} = useDaemonContext();
	const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false)
	const [showRestorePurchases, setShowRestorePurchases] = useState (false)
	const [isLoading, setIsLoading] = useState (false)
	useEffect(() => {
		if (successNFTID > 100) {
			setIsSuccessModalOpen(true);
		}
	}, [successNFTID])

	useEffect(() => {
		if (!CoNET_Data) {
			return
		}
		const restoreSTatus = CoNET_Data?.restorePurchases
		const active = getPassportTitle(activePassport)
		if (active === 'Freemium' && !restoreSTatus) {
			setShowRestorePurchases(true)
		}

	}, [activePassport])

	const startRestorePurchases = () => {
		if (!CoNET_Data || isLoading) {
			return
		}

		setIsLoading(true)

		if (window?.webkit?.messageHandlers) {
			window?.webkit?.messageHandlers["RestorePurchases"]?.postMessage('')
			
		}
		
		setTimeout(() => {
			if (CoNET_Data) {
				
				CoNET_Data.restorePurchases = true
				setCoNET_Data(CoNET_Data)
			}
			
			setIsLoading(false)
		}, 6000)

	}

  return (
	
    <div className="page-container">
      <h1>My Account</h1>
	  {
		showRestorePurchases &&
		<button style={{ margin: '2rem 0'}} className="buttonPay" onClick={startRestorePurchases}>
			{isLoading ? <SimpleLoadingRing /> :
				<p>Restore Purchases</p>
			}
			
		</button>
	  }
      <AccountList />

      <div className="cta-buttons">
        {/* <div>
          <button className='disabled'>
            <img src="/assets/conet-gray.svg" alt="Platform" />
            <p>Open CONET Platform</p>
          </button>
          <p>*Open CoNET Platform - Redeem Silent Pass passport and transfer Silent Pass passport to Silent Pass Account (public wallet address) if user has guardian NFT or CoNETian NFT.</p>
        </div> */}
        <RedeemPassport />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '40px' }}>
        <SpClub />
        {/* <ReferralProgram /> */}
      </div>
	
      <Footer />
	  {isSuccessModalOpen && <SuccessModal nftID= {successNFTID} onClose={() => {setIsSuccessModalOpen(false); setSuccessNFTID(0)}} />}
    </div>
  )
}