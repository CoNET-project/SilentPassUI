import { useNavigate } from "react-router-dom";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getRemainingTime } from "../../utils/utils";
import Skeleton from "../Skeleton";

const ActivePassportInfo = () => {
  const navigate = useNavigate();
  const { profiles } = useDaemonContext();

  return (
    <div className="main-card">
      <div style={{ textAlign: 'start' }}>
        <span>Silent Pass Passport</span>
        <p>Freemium</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
        <span>Expiration date</span>
        {
          profiles?.[0]?.activePassport?.expires ?
            <p>{getRemainingTime(profiles?.[0]?.activePassport?.expires)}</p>
            : <Skeleton width='50px' height='20px' />
        }
      </div>
    </div>
  );
};

export default ActivePassportInfo;