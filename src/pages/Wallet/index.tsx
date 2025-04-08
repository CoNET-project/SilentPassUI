import { useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import './index.css';
import AccountList from '../../components/AccountList';
import RedeemPassport from '../../components/RedeemPassport';
import { useDaemonContext } from '../../providers/DaemonProvider';

import { ReactComponent as RecoverIcon } from './assets/recover-icon.svg';

export default function Wallet() {
  const navigate = useNavigate();
  const { profiles } = useDaemonContext();

  return (
    <div className="page-container">
      <div className="wallet-heading">
        <h1>My Account</h1>
        <button onClick={() => navigate("/recover")}>
          <RecoverIcon />
          <p>Recover</p>
        </button>
      </div>

      <AccountList />

      <RedeemPassport />

      {/* <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '40px' }}>
        <SpClub />
        <ReferralProgram />
      </div> */}


      <Footer />
    </div>
  )
}