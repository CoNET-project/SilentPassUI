import { useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import './index.css';
import AccountList from '../../components/AccountList';
import SpClub from '../../components/AccountList/SpClub';
import ReferralProgram from '../../components/AccountList/ReferralProgram';
import RedeemPassport from '../../components/RedeemPassport';
import RewardPoint from '../../components/AccountList/RewardPoint'
import { ReactComponent as GoldBadge } from './assets/gold-badge.svg';
import { ReactComponent as BlueBadge } from './assets/blue-badge.svg';
import { useDaemonContext } from '../../providers/DaemonProvider'
import { useEffect, useRef, useState } from "react";
import { useTranslation } from 'react-i18next'
import crown from './assets/crown_icon.gif'

export default function Wallet() {
  const navigate = useNavigate()
  const { profiles, isIOS } = useDaemonContext()
  const [openClub, setOpenClub] = useState(true)
  const hasGuardianActive = Number(profiles?.[0]?.activePassport?.expires) > 32503690800000;
  const hasCrownActive = Number(profiles?.[0]?.activePassport?.expires) > 4900000000;
  const freePassportActive = profiles?.[0]?.activePassport?.nftID && Number(profiles[0].activePassport.expiresDays) <= 7;
  const { t, i18n } = useTranslation()

  return (
    <div className="page-container">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h1>{t('wallet_title')}</h1>
        { profiles?.[0]?.activePassport?.nftID && (
          hasGuardianActive ? <GoldBadge /> : hasCrownActive ? <img src={crown} width="40rem"/> : !freePassportActive && <BlueBadge />
        )}
      </div>

      <AccountList />
	  <RewardPoint />
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
	  {
		<div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '20px' }}>
			{SpClub(openClub, setOpenClub)}
			<ReferralProgram />
		</div>
	  }
      

      <Footer />
    </div>
  )
}