import { useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import './index.css';
import AccountList from '../../components/AccountList';
import SpClub from '../../components/AccountList/SpClub';
import ReferralProgram from '../../components/AccountList/ReferralProgram';
import RedeemPassport from '../../components/RedeemPassport';

import { ReactComponent as GoldBadge } from './assets/gold-badge.svg';
import { ReactComponent as BlueBadge } from './assets/blue-badge.svg';
import { useDaemonContext } from '../../providers/DaemonProvider';

export default function Wallet() {
  const navigate = useNavigate();
  const { profiles } = useDaemonContext();

  console.log("PROFILES: ", profiles);

  const hasGuardian = profiles?.[0].silentPassPassports?.some((passport: any) => passport.expires > 32503690800000);
  const hasSPClub = !!profiles?.spClub?.memberId;

  return (
    <div className="page-container">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h1>My Account</h1>
        { hasGuardian && (hasSPClub ? <GoldBadge /> : <BlueBadge />) }
      </div>

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
        <ReferralProgram />
      </div>


      <Footer />
    </div>
  )
}