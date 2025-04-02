import { useEffect } from "react";
import "./App.css";
import { HashRouter as Router, Route, Routes } from "react-router-dom";
import { Home, Region } from "./pages";
import { useDaemonContext } from "./providers/DaemonProvider";
import { createOrGetWallet, getCurrentPassportInfo, tryToRequireFreePassport, checkFreePassport } from "./services/wallets";
import { getAllNodes } from "./services/mining";
import { checkCurrentRate } from "./services/passportPurchase";
import { CoNET_Data, setCoNET_Data, setGlobalAllNodes } from "./utils/globals";
import { listenProfileVer } from "./services/listeners";
import Vip from './pages/Vip';
import Wallet from './pages/Wallet';
import Swap from './pages/Swap';
import Settings from './pages/Settings';
import Languages from './pages/Languages';
import Applications from './pages/Applications';
import Subscription from './pages/Subscription';
import Support from './pages/Support';
import FAQ from './pages/FAQ';
import ConfigDevice from './pages/ConfigDevice';
import Passcode from './pages/Passcode';
import { getServerIpAddress } from "./api";
import { parseQueryParams } from "./utils/utils";
import Transfer from './pages/Transfer';

global.Buffer = require('buffer').Buffer;

function App() {
  const { setProfiles, setMiningData, allRegions, setClosestRegion, setaAllNodes, setServerIpAddress, setServerPort, _vpnTimeUsedInMin, setActivePassportUpdated, setActivePassport, setRandomSolanaRPC, setIsLocalProxy, setIsIOS } = useDaemonContext();
  const setSOlanaRPC = (allNodes: nodes_info[]) => {
    const randomIndex = Math.floor(Math.random() * (allNodes.length - 1))
    setRandomSolanaRPC(allNodes[randomIndex])
  }
  
  useEffect(() => {
    const handlePassport = async () => {
      if (!CoNET_Data?.profiles[0]?.keyID) return

      await tryToRequireFreePassport();

      const info = await getCurrentPassportInfo(CoNET_Data?.profiles[0]?.keyID);

      const tmpData = CoNET_Data;

      if (!tmpData) {
        return;
      }

      tmpData.profiles[0] = {
        ...tmpData?.profiles[0],
        activePassport: {
          nftID: info[0].toString(),
          expires: info[1].toString(),
          expiresDays: info[2].toString(),
          premium: info[3]
        },
      };

      if (tmpData.profiles[0].activePassport?.expiresDays !== '7')
        tmpData.profiles[0].silentPassPassports = tmpData.profiles[0].silentPassPassports?.filter(passport => passport.expiresDays !== 7)

      setActivePassport(tmpData.profiles[0].activePassport);

      setCoNET_Data(tmpData);

      if (!CoNET_Data) return;

      setProfiles(CoNET_Data?.profiles);
      setActivePassportUpdated(true);
    }

    const init = async () => {
      let vpnTimeUsedInMin = 0
      try {
        const ss = await localStorage.getItem("vpnTimeUsedInMin")
        if (ss) {
          vpnTimeUsedInMin = parseInt(ss)
        }
      } catch (ex) {

      }
      _vpnTimeUsedInMin.current = vpnTimeUsedInMin;

      const queryParams = parseQueryParams(window.location.search);
      let secretPhrase: string | null = null;

      if (window.location.search && queryParams) {
        secretPhrase = queryParams.get("secretPhrase");
        secretPhrase = secretPhrase ? secretPhrase.replaceAll("-", " ") : null;
      }

      const profiles = await createOrGetWallet(secretPhrase);
      setProfiles(profiles);

      listenProfileVer(setProfiles, setActivePassport, setMiningData);

      checkCurrentRate(setMiningData);
	  checkFreePassport()
      getAllNodes(allRegions, setClosestRegion, (allNodes: nodes_info[]) => {
        setSOlanaRPC(allNodes)
        setaAllNodes(allNodes)
        setGlobalAllNodes(allNodes)
        const randomIndex = Math.floor(Math.random() * (allNodes.length - 1))
        setRandomSolanaRPC(allNodes[randomIndex])
        if (!CoNET_Data || !CoNET_Data?.profiles) {
          return
        }

      });

      handlePassport();
    };

    init();
  }, []);

  useEffect(() => {
    const _getServerIpAddress = async () => {
      try {
        const response = await getServerIpAddress();
        const tmpIpAddress = response.data;

        setServerIpAddress(tmpIpAddress?.ip || "");
        setServerPort('3002');
		setIsLocalProxy(true)
      } catch (ex) {
		if (window?.webkit) {
			setIsIOS(true)
		}
		setIsLocalProxy(false)
      }
    };
    //if (!window?.webkit && !window?.Android) {
      _getServerIpAddress();
    
  }, []);

  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/regions" element={<Region />}></Route>
          <Route path="/faq" element={<FAQ />}></Route>
          <Route path="/config-device" element={<ConfigDevice />}></Route>
          <Route path="/vip" element={<Vip />}></Route>
          <Route path="/wallet" element={<Wallet />}></Route>
          <Route path="/swap" element={<Swap />}></Route>
          <Route path="/settings" element={<Settings />}></Route>
          <Route path="/passcode/new" element={<Passcode new />}></Route>
          <Route path="/passcode/change" element={<Passcode />}></Route>
          <Route path="/languages" element={<Languages />}></Route>
          <Route path="/applications" element={<Applications />}></Route>
          <Route path="/subscription" element={<Subscription />}></Route>
          <Route path="/transfer" element={<Transfer />}></Route>
          <Route path="/support" element={<Support />}></Route>
          <Route path="/" element={<Home />}></Route>
        </Routes>
      </Router>
    </div>
  );
}

export default App;
