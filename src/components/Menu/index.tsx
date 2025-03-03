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
import { ReactComponent as SwapIconGrey } from "./assets/swap-icon-grey.svg"
import { ReactComponent as SwapIconBlue } from "./assets/swap-icon-blue.svg"


export default function Menu() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="menu">
      <button className={location.pathname === "/" ? "active" : ""} onClick={() => navigate("/")}>
        {location.pathname === "/" ? <HomeBlueIcon /> : <HomeIconGrey />}
        <p>Home</p>
      </button>
      <button className={location.pathname === "/wallet" ? "active" : ""} onClick={() => navigate("/wallet")}>
        {location.pathname === "/wallet" ? <WalletBlueIcon /> : <WalletIconGrey />}
        <p>My Account</p>
      </button>
      <button className={location.pathname === "/swap" ? "active" : ""} onClick={() => navigate("/swap")}>
        {location.pathname === "/swap" ? <SwapIconBlue /> : <SwapIconGrey />}
        <p>Swap</p>
      </button>
      <button className={location.pathname === "/settings" ? "active" : ""} onClick={() => navigate("/settings")}>
        {location.pathname === "/settings" ? <SettingsIconBlue /> : <SettingsIconGrey />}
        <p>Settings</p>
      </button>
      <button className={location.pathname === "/support" ? "active" : ""} onClick={() => navigate("/support")}>
        {location.pathname === "/support" ? <SupportIconBlue /> : <SupportIconGrey />}
        <p>Support</p>
      </button>
    </div>
  )
}