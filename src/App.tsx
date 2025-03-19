import { useEffect } from "react";
import "./App.css";
import { HashRouter as Router, Route, Routes } from "react-router-dom";
import { useDaemonContext } from "./providers/DaemonProvider";
import { createOrGetWallet, tryToRequireFreePassport } from "./services/wallets";
import { getAllNodes, startMiningV2 } from "./services/mining";
import { CoNET_Data, setCoNET_Data } from "./utils/globals";
import { listenProfileVer } from "./services/listeners";
import Wallet from './pages/Wallet';
import { getServerIpAddress } from "./api";
import { parseQueryParams } from "./utils/utils";
import Subscription from './pages/Subscription';
import Management from './pages/Management';
import Recover from './pages/Recover';

global.Buffer = require('buffer').Buffer;

function App() {
  const { setProfiles, setMiningData, allRegions, setClosestRegion, setaAllNodes, setServerIpAddress, setServerPort, _vpnTimeUsedInMin, setActivePassportUpdated } = useDaemonContext();

  useEffect(() => {
    const init = async () => {
      const vpnTimeUsedInMin = parseInt(localStorage.getItem("vpnTimeUsedInMin") || "0");
      _vpnTimeUsedInMin.current = vpnTimeUsedInMin;

      const queryParams = parseQueryParams(window.location.search);
      let secretPhrase: string | null = null;

      if (window.location.search && queryParams) {
        secretPhrase = queryParams.get("secretPhrase");
        secretPhrase = secretPhrase ? secretPhrase.replaceAll("-", " ") : null;
      }

      await createOrGetWallet(secretPhrase);
      listenProfileVer(setProfiles);

      await getAllNodes(allRegions, setClosestRegion, (allNodes: nodes_info[]) => {
        setaAllNodes(allNodes)

        if (!CoNET_Data || !CoNET_Data?.profiles) {
          return
        }

        startMiningV2(CoNET_Data?.profiles?.[0], allRegions, setMiningData);
      });
    };

    init();
  }, []);

  return (
    <div className="App">
      <Router>
        <Routes>
          {/* <Route path="/regions" element={<Region />}></Route>
          <Route path="/faq" element={<FAQ />}></Route>
          <Route path="/config-device" element={<ConfigDevice />}></Route>
          <Route path="/vip" element={<Vip />}></Route> */}
          <Route path="/" element={<Wallet />}></Route>
          {/* <Route path="/settings" element={<Settings />}></Route>
          <Route path="/passcode/new" element={<Passcode new />}></Route>
          <Route path="/passcode/change" element={<Passcode />}></Route>
          <Route path="/languages" element={<Languages />}></Route>
          <Route path="/applications" element={<Applications />}></Route> */}
          <Route path="/subscription" element={<Subscription />}></Route>
          <Route path="/management" element={<Management />}></Route>
          <Route path="/recover" element={<Recover />}></Route>
           {/* <Route path="/support" element={<Support />}></Route>
          <Route path="/ww" element={<Home />}></Route> */}
        </Routes>
      </Router>
    </div>
  );
}

export default App;
