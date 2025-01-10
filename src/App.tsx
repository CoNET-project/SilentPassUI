import React, { useContext, useEffect } from "react";
import "./App.css";
import { HashRouter as Router, Route, Routes } from "react-router-dom";

import { Home, Region } from "./pages";
import About from './pages/About';
import { DaemonProvider, useDaemonContext } from "./providers/DaemonProvider";
import { createOrGetWallet } from "./services/wallets";
import { getAllNodes, startMiningV2 } from "./services/mining";
import { CoNET_Data } from "./utils/globals";
import { listenProfileVer } from "./services/listeners";

global.Buffer = require('buffer').Buffer;

function App() {

  const { setProfile, setMiningData, allRegions, setClosestRegion } = useDaemonContext();

  useEffect(() => {
    if (allRegions.length === 0) return

    const init = async () => {
      await createOrGetWallet();
      listenProfileVer(setProfile);

      if (!CoNET_Data || !CoNET_Data?.profiles) return

      await getAllNodes(allRegions, setClosestRegion);

      await startMiningV2(CoNET_Data?.profiles?.[0], allRegions, setMiningData);
    };

    init();
  }, [allRegions]);

  return (
    <div className="App">
      <Router>
        <Routes>
          <Route path="/regions" element={<Region />}></Route>
          <Route path="/about" element={<About />}></Route>
          <Route path="/" element={<Home />}></Route>
        </Routes>
      </Router>
    </div>
  );
}

export default App;
