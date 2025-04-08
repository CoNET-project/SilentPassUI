import { useLocation, useNavigate } from 'react-router-dom';
import './index.css';

import { ReactComponent as HomeIconGrey } from "./assets/home-icon-grey.svg"
import { ReactComponent as HomeBlueIcon } from "./assets/home-icon-blue.svg"
import { ReactComponent as WalletIconGrey } from "./assets/wallet-icon-grey.svg"
import { ReactComponent as WalletBlueIcon } from "./assets/wallet-icon-blue.svg"
import { ReactComponent as SettingsIconBlue } from "./assets/settings-icon-blue.svg"
import { ReactComponent as SettingsIconGrey } from "./assets/settings-icon-grey.svg"
import { ReactComponent as SupportIconGrey } from "./assets/support-icon-grey.svg"
import { ReactComponent as SupportIconBlue } from "./assets/support-icon-blue.svg"
import { ReactComponent as SwapBlueIcon } from "./assets/swap-icon-blue.svg"
import { ReactComponent as SwapIconGrey } from "./assets/swap-icon-grey.svg"

export default function Menu() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="menu">
      <button className={location.pathname === "/" ? "active" : ""} onClick={() => navigate("/")}>
        {location.pathname === "/" ? <WalletBlueIcon /> : <WalletIconGrey />}
        <p>My Wallet</p>
      </button>
    </div>
  )
}