import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from "react";
import { useTranslation } from 'react-i18next'

import AccountList from '../../components/AccountList';
import ActivePassportInfo from '../../components/ActivePassportInfo';
import Footer from '../../components/Footer';
import './index.css';
import ReferralProgram from '../../components/AccountList/ReferralProgram';
import RedeemPassport from '../../components/RedeemPassport';
import RewardPoint from '../../components/AccountList/RewardPoint'

import { ReactComponent as GoldBadge } from './assets/gold-badge.svg';
import { ReactComponent as BlueBadge } from './assets/blue-badge.svg';
import { useDaemonContext } from '../../providers/DaemonProvider'
import crown from './assets/crown_icon.gif'
import goldBadge from './assets/GC.png'

import crownIcon from './assets/crown_icon.gif'

export default function Wallet() {
  const navigate = useNavigate()
  const { profiles, isIOS } = useDaemonContext()
  const [openClub, setOpenClub] = useState(true)

  const [redeemPassportOpen, setRedeemPassportOpenOpen] = useState<boolean>(false);
  const hasGuardianActive = Number(profiles?.[0]?.activePassport?.expires) > 32503690800000;
  const hasCrownActive = Number(profiles?.[0]?.activePassport?.expires) > 4900000000;
  const freePassportActive = profiles?.[0]?.activePassport?.nftID && Number(profiles[0].activePassport.expiresDays) <= 7;

  const { t, i18n } = useTranslation()
  const redeemRef = useRef<HTMLDivElement>(null);

  const passport = profiles?.[0]?.activePassport;
  const expires = Number(passport?.expires);
  const isGuardian = !!passport?.nftID && expires > 32503690800000;
  const isCrownHolder = !!passport?.nftID && expires > 4900000000;
  const isFreePassport = !!passport?.nftID && Number(passport.expiresDays) <= 7;


    //Renders badge based on the user's passport status
    const renderBadge = () => {
    if (!passport?.nftID) return null;
    if (isGuardian) return <GoldBadge className="badge" />;
    if (isCrownHolder) return <img src={crownIcon} alt="Crown" className="crown" />;
    if (!isFreePassport) return <BlueBadge className="badge" />;
    return null;
  };

  return (
    <div className="page-container">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h1>{t('wallet_title')}</h1>

        { profiles?.[0]?.activePassport?.nftID && (
          hasGuardianActive ? <GoldBadge /> : hasCrownActive ? <img src={goldBadge} width="30rem"/> : !freePassportActive && <BlueBadge />
        )}
      </div>

      <AccountList />
	  {/* <RewardPoint /> */}

      <div className="cta-buttons">
        {/* <div>
          <button className='disabled'>
            <img src="/assets/conet-gray.svg" alt="Platform" />
            <p>Open CONET Platform</p>
          </button>
          <p>*Open CoNET Platform - Redeem Silent Pass passport and transfer Silent Pass passport to Silent Pass Account (public wallet address) if user has guardian NFT or CoNETian NFT.</p>
        </div> */}
        <RedeemPassport isOpen={redeemPassportOpen} setIsOpen={setRedeemPassportOpenOpen} redeemRef={redeemRef} />
      </div>
	  {
		<div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '20px' }}>
			<ReferralProgram />
		</div>
	  }
      <Footer />
    </div>
  )
}