import { useState } from 'react';
import { useNavigate } from "react-router-dom";

import Menu from '../../components/Menu';
import "./index.css";

const Vip = () => {
  const [isMenuVisible, setIsMenuVisible] = useState<boolean>(false)

  const toggleMenu = () => {
    setIsMenuVisible(prevState => !prevState);
  }
  const navigate = useNavigate();

  return (
    <>
      <div className="header">
        <div className="header-content">
          <div className="menu-icon" onClick={toggleMenu}>
            <img src="/assets/menu.svg"></img>
          </div>

          <div>
            <img src="/assets/header-title.svg"></img>
          </div>

          <div style={{ visibility: 'hidden' }}>
            lang
          </div>
        </div>
      </div>

      <Menu isMenuVisible={isMenuVisible} toggleMenu={toggleMenu} />

      <div className="vip">
        <h1>Silent Pass Users: Free vs VIP</h1>
        <p><strong>Free Users</strong> are required to share their computing resources while using Silent Pass VPN basic service. </p>
        <p><strong>VIP Users</strong> can enjoy advanced service and are free from computing resources sharing.</p>
        <ul>
          <li style={{padding:"8px", marginBottom:"16px"}}><strong>Premium Users</strong> - Enjoy advanced service on <strong style={{color:"#9FBFE5FE"}}>One Single Device</strong></li>
          <li style={{padding:"8px", marginBottom:"16px"}}><strong>Platinum Users</strong> - Enjoy advanced service on up to <strong style={{color:"#9FBFE5FE"}}>5 devices</strong></li>
        </ul>
        <h2>Why Upgrade to VIP?</h2>
        <p>As a VIP User, you'll enjoy a range of exclusive features designed to enhance your experience:</p>
        <ul>
          <li>Higher Performance</li>
          <li>More Regions</li>
          <li>Enhanced Security</li>
          <li>Split-Tunnelling configurations</li>
          <li>Personalize which apps get VPN protection</li>
          <li>Ad-block Feature</li>
          <li>Extra $CONET Token Reward</li>
        </ul>
        <p>3 ways to upgrade your silent pass service:</p>
        <ol style={{listStyle: "none"}}>
          <li style={{marginBottom:"16px"}}>
            <div>
              <h3 style={{marginBottom:"8px"}}>1.  Guardians NFT owner</h3>
              <p style={{padding:"8px"}}><strong>Platinum Users</strong> Permanently. Visit <a target="_blank" rel="noreferrer" href="https://conet.network/guardian/">Guardian Plan</a> for details.</p>
            </div>
          </li>
          <li style={{marginBottom:"16px"}}>
            <div>
              <h3 style={{marginBottom:"16px"}}>2.  CoNETian NFT owner</h3>
              <p style={{padding:"8px"}}><strong>Platinum Users</strong> 1 year. Visit <a target="_blank" rel="noreferrer" href="https://conet.network/conetian/">CoNETian Plan</a> for details.</p>
            </div>
          </li>
          <li style={{marginBottom:"16px"}}>
            <div>
              <div>
                <h3>3.  Subscription Users</h3>
                <table style={{marginTop: '16px', borderRadius:'8px'}}>
                  <thead>
                    <tr>
                      <th>Subscription</th>
                      <th>Monthly</th>
                      <th>Anually</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Premium User</td>
                      <td>$2.49</td>
                      <td>$24.99</td>
                    </tr>
                    <tr>
                      <td>Platinum User</td>
                      <td>$9.99</td>
                      <td>$99.99</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </li>
        </ol>

        <button className="vip-button" onClick={() => navigate("/")}>
          Go Back to Homepage
        </button>

      </div>

  
    </>
  );
};

export default Vip;