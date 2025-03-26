import { useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import './index.css';
import AccountList from '../../components/AccountList';

import { ReactComponent as RecoverIcon } from './assets/recover-icon.svg';
import { useEffect } from 'react';
import AffiliateOptions from '../../components/AffiliateOptions';
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getNFTs} from '../../services/wallets'
export default function Wallet() {
  const { profiles } = useDaemonContext();
  const navigate = useNavigate();
  useEffect(() => {
    getNFTs().then(nfts => {
      if (!nfts) {
        return
      }
      const total = nfts.monthly.total + nfts.yearly.total
    })
  }, [profiles])

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

      <AffiliateOptions />

      <Footer />
    </div>
  )
}