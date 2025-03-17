import { useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import './index.css';
import AccountList from '../../components/AccountList';
import SpClub from '../../components/AccountList/SpClub';
import ReferralProgram from '../../components/AccountList/ReferralProgram';
import RedeemPassport from '../../components/RedeemPassport';

export default function Wallet() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <h1>My Account</h1>

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

      {/* <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '40px' }}>
        <SpClub />
        <ReferralProgram />
      </div> */}


      <Footer />
    </div>
  )
}