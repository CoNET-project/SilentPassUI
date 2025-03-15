import { useEffect, useState } from 'react';
import "./index.css";
import { useDaemonContext } from '../../providers/DaemonProvider';
import Skeleton from '../Skeleton';

const OneDayInSeconds = 86400;

const MiningStatus = () => {
  const { miningData, profiles, activePassportUpdated } = useDaemonContext();
  const [isMiningUp, setIsMiningUp] = useState<boolean>(false);
  const [passportTimeLeft, setPassportTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (miningData) {
      setIsMiningUp(miningData?.status === 200)
    }
  }, [miningData])

  useEffect(() => {
    const passportExpiration = profiles?.[0]?.activeFreePassport?.expires
    if (passportExpiration) {
      const timeLeft = passportExpiration - Math.floor(Date.now() / 1000)
      setPassportTimeLeft(timeLeft)
    }
  }, [activePassportUpdated, profiles])


  return (
    <div className="mining-status">
      <div className="miners">
        Miners: {miningData?.online ? miningData.online : <Skeleton height="14px" width="45px" />}
      </div>

      <div className="users">Users: {miningData?.totalUsers ? miningData.totalUsers : <Skeleton height="14px" width="45px" />}</div>
    </div>
  );
};

export default MiningStatus;
