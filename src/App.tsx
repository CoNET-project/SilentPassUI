import React, { useEffect } from "react";
import "./App.css";
import { HashRouter as Router, Route, Routes } from "react-router-dom";

import { Home, Region } from "./pages";
import About from './pages/About';
import { DaemonProvider } from "./providers/DaemonProvider";
import { createOrGetWallet } from "./services/wallets";
import { startMiningV2 } from "./services/mining";
import { CoNET_Data } from "./utils/globals";
import { listenProfileVer } from "./services/listeners";

global.Buffer = require('buffer').Buffer;

function App() {
  useEffect(() => {
    const init = async () => {
      await createOrGetWallet();
      listenProfileVer();

      if (!CoNET_Data || !CoNET_Data?.profiles) return

      await startMiningV2(CoNET_Data?.profiles?.[0]);
    };

    init();
  }, []);

  return (
    <div className="App">
      <DaemonProvider>
        <Router>
          <Routes>
            <Route path="/regions" element={<Region />}></Route>
            <Route path="/about" element={<About />}></Route>
            <Route path="/" element={<Home />}></Route>
          </Routes>
        </Router>
      </DaemonProvider>
    </div>
  );
}

export default App;
