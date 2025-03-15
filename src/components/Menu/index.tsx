import { useLocation, useNavigate } from 'react-router-dom';
import './index.css';

import { ReactComponent as WalletIconGrey } from "./assets/wallet-icon-grey.svg";
import { ReactComponent as WalletBlueIcon } from "./assets/wallet-icon-blue.svg";
import { ReactComponent as ManagementIconGrey } from "./assets/management-grey.svg";
import { ReactComponent as ManagementBlueIcon } from "./assets/management-blue.svg";

export default function Menu({ disableManagement }: any) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="menu">
      <button className={location.pathname === "/" ? "active" : ""} onClick={() => navigate("/")}>
        {location.pathname === "/" ? <WalletBlueIcon /> : <WalletIconGrey />}
        <p>My Account</p>
      </button>
      <button className={location.pathname === "/management" ? "active" : ""} onClick={() => navigate("/management")} disabled={disableManagement}>
        {location.pathname === "/management" ? <ManagementBlueIcon /> : <ManagementIconGrey />}
        <p>Management</p>
      </button>
    </div>
  )
}