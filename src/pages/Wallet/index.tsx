import { useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import './index.css';
import AccountList from '../../components/AccountList';
import RedeemPassport from '../../components/RedeemPassport';
import { ReactComponent as RecoverIcon } from './assets/recover-icon.svg';
import { useEffect } from 'react';

import { useDaemonContext } from "../../providers/DaemonProvider";

export default function Wallet() {
  const { profiles } = useDaemonContext();
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <div className="wallet-heading">
        <h1>My Account</h1>
        {/* <button onClick={() => navigate("/recover")}>
          <RecoverIcon />
          <p>Recover</p>
        </button> */}
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
      

      <Footer />
    </div>
  )
}