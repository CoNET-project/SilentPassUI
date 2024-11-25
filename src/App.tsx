import "./App.css";
import { HashRouter as Router, Route, Routes } from "react-router-dom";

import { Home, Region } from "./pages";
import { DaemonProvider } from "./providers/DaemonProvider";
import About from './pages/About';

function App() {
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
