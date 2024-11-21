import React from "react";
import "./App.css";
import { HashRouter as Router, Route, Routes } from "react-router-dom";

import { Home, Region } from "./pages";
import { DaemonProvider } from "./providers/DaemonProvider";

function App() {
  return (
    <div className="App">
      <DaemonProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />}></Route>
            <Route path="/regions" element={<Region />}></Route>
          </Routes>
        </Router>
      </DaemonProvider>
    </div>
  );
}

export default App;
