import { useEffect, useState } from 'react';
import "./index.css";
import { useDaemonContext } from '../../providers/DaemonProvider';
import Skeleton from '../Skeleton';

const MiningStatus = () => {
  const { miningData } = useDaemonContext();
  const [isMiningUp, setIsMiningUp] = useState<boolean>(false);

  useEffect(() => {
	if (miningData) {
		setIsMiningUp(miningData?.status === 200)
	}
    
  }, miningData)

  return (
    <div style={{width:"80%"}}>
		<div className="mining-status">
			<div className="mining">
			<div className={`circle ${isMiningUp ? "green" : "red"}`}></div>
			<p>Mining {isMiningUp ? "UP" : "DOWN"}</p>
			</div>
			<div className="rate">Mining Rate: {miningData?.rate ? miningData.rate : <Skeleton height="14px" width="45px" />}</div>
			<div className="miners">Online Miners: {miningData?.online ? miningData.online : <Skeleton height="14px" width="45px" />}</div>
			<div className="miners">Online VPN Users: {miningData?.totalUsers ? miningData.totalUsers : <Skeleton height="14px" width="45px" />}</div>

		</div>
    </div>
  );
};

export default MiningStatus;
