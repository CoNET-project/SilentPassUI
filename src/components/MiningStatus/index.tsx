import { useEffect, useState } from 'react';
import "./index.css";
import { useDaemonContext } from '../../providers/DaemonProvider';
import Skeleton from '../Skeleton';

const MiningStatus = () => {
  const { miningData } = useDaemonContext();
  const [isMiningUp, setIsMiningUp] = useState<boolean>(false);

  useEffect(() => {
    setIsMiningUp(miningData?.status === 200)
  }, miningData)

  return (
    <div className="mining-status">
      <div className="mining">
        <div className={`circle ${isMiningUp ? "green" : "red"}`}></div>
        <p>Mining {isMiningUp ? "UP" : "DOWN"}</p>
      </div>
      <div className="rate">Mining Rate: {miningData?.rate ? miningData.rate : <Skeleton height="14px" width="45px" />}</div>
      <div className="miners">Online Miners: {miningData?.online ? miningData.rate : <Skeleton height="14px" width="45px" />}</div>
    </div>
  );
};

export default MiningStatus;
