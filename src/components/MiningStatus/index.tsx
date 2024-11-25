import { useState } from 'react';
import "./index.css";

const MiningStatus = () => {
  const [isMiningUp, setIsMiningUp] = useState<boolean>(true);

  return (
      <div className="mining-status">
        <div className="mining">
          <div className={`circle ${isMiningUp ? "green" : "red"}`}></div>
          <p>Mining {isMiningUp ? "UP" : "DOWN"}</p>
        </div>
        <div className="rate">Mining Rate: 0.0004594345</div>
        <div className="miners">Online Miners: 6358</div>
      </div>
  );
};

export default MiningStatus;
