import { useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import './index.css';
import AccountList from '../../components/AccountList';

import { ReactComponent as RecoverIcon } from './assets/recover-icon.svg';
import { useState } from 'react';
import AffiliateOptions from '../../components/AffiliateOptions';

export default function Wallet() {
  const [isAffiliate, setIsAffiliate] = useState<boolean>(false);
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <button className="toggle-button" onClick={() => setIsAffiliate((prev) => !prev)}>Toggle</button>
      <div className="wallet-heading">
        <h1>My Account</h1>
        {
          !isAffiliate && (
            <button onClick={() => navigate("/recover")}>
              <RecoverIcon />
              <p>Recover</p>
            </button>
          )
        }
      </div>

      <AccountList />

      <AffiliateOptions isAffiliate={isAffiliate} />

      <Footer disableManagement={!isAffiliate} />
    </div>
  )
}