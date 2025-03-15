import { useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import './index.css';
import AccountList from '../../components/AccountList';

import { ReactComponent as RecoverIcon } from './assets/recover-icon.svg';
import { useState } from 'react';
import AffiliateOptions from '../../components/AffiliateOptions';

export default function Wallet() {
  const [isAffiliate, setIsAffiliate] = useState<boolean>(true);
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <div className="wallet-heading">
        <h1>My Account</h1>
        {
          !isAffiliate && (
            <button>
              <RecoverIcon />
              <p>Recover</p>
            </button>
          )
        }
      </div>

      <AccountList />

      <AffiliateOptions isAffiliate={isAffiliate} />

      <Footer />
    </div>
  )
}