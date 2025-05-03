import { useEffect } from "react";
import "./App.css";
import { HashRouter as Router, Route, Routes } from "react-router-dom";
import { useDaemonContext } from "./providers/DaemonProvider";
import { createOrGetWallet, getCurrentPassportInfo, tryToRequireFreePassport, checkFreePassport } from "./services/wallets";
import { getAllNodes } from "./services/mining";
import { checkCurrentRate } from "./services/passportPurchase";
import { CoNET_Data, setCoNET_Data, setGlobalAllNodes } from "./utils/globals";
import { listenProfileVer } from "./services/listeners";
import Wallet from './pages/Wallet';
import Swap from './pages/Swap';
import Applications from './pages/Applications';
import Subscription from './pages/Subscription';
import { getServerIpAddress } from "./api";
import { parseQueryParams } from "./utils/utils";

import Management from './pages/Management';
import Recover from './pages/Recover';
import Transfer from './pages/Transfer';
import Cryptopay from './pages/CryptoPay'
import QRCode from './pages/QRCode'
global.Buffer = require('buffer').Buffer;

function App() {
  const { setProfiles, setMiningData, allRegions, setClosestRegion, setaAllNodes, setServerIpAddress, setServerPort, _vpnTimeUsedInMin, setActivePassportUpdated, setActivePassport, setRandomSolanaRPC, setIsLocalProxy, setIsIOS } = useDaemonContext();
  const setSOlanaRPC = (allNodes: nodes_info[]) => {
    const randomIndex = Math.floor(Math.random() * (allNodes.length - 1))
    setRandomSolanaRPC(allNodes[randomIndex])
  }
  return (
    <div className="App">
      <Router>
        <Routes>
          {/* <Route path="/regions" element={<Region />}></Route>
          <Route path="/faq" element={<FAQ />}></Route>
          <Route path="/config-device" element={<ConfigDevice />}></Route>
          <Route path="/vip" element={<Vip />}></Route> */}
          <Route path="/" element={<Cryptopay />}></Route>
          <Route path="/swap" element={<Swap />}></Route>
		  <Route path="/qrcode" element={<QRCode />}></Route>
          {/* <Route path="/settings" element={<Settings />}></Route>
          <Route path="/passcode/new" element={<Passcode new />}></Route>
          <Route path="/passcode/change" element={<Passcode />}></Route>
          <Route path="/languages" element={<Languages />}></Route> */}
          <Route path="/applications" element={<Applications />}></Route>
          {/* <Route path="/subscription" element={<Subscription />}></Route> */}
          <Route path="/subscription" element={<Subscription />}></Route>
          <Route path="/management" element={<Management />}></Route>
          <Route path="/recover" element={<Recover />}></Route>
          <Route path="/transfer" element={<Transfer />}></Route>

          {/* <Route path="/support" element={<Support />}></Route>
          <Route path="/" element={<Home />}></Route> */}
        </Routes>
      </Router>
    </div>
  );
}

export default App;
