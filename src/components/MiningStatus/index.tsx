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

  }, [miningData])

  return (
    <div className="mining-status">
      <div className="miners">
        <div className={`circle ${isMiningUp ? "green" : "red"}`}></div>
        Miners: {miningData?.online ? miningData.online : <Skeleton height="14px" width="45px" />}
      </div>

      <div className="users">Users: {miningData?.totalUsers ? miningData.totalUsers : <Skeleton height="14px" width="45px" />}</div>
    </div>
  );
};

export default MiningStatus;
