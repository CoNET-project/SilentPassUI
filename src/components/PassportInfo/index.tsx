import { useNavigate } from "react-router-dom";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getRemainingTime } from "../../utils/utils";
import Skeleton from "../Skeleton";

const PassportInfo = () => {
  const navigate = useNavigate();
  const { profile } = useDaemonContext();

  return (
    <div className="main-card">
      <div style={{ textAlign: 'start' }}>
        <span>Silent Pass Passport</span>
        <p>Freemium</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
        <span>Expiration date</span>
        {
          profile?.activeFreePassport?.expires ?
            <p>{getRemainingTime(profile?.activeFreePassport?.expires)}</p>
            : <Skeleton width='50px' height='20px' />
        }
      </div>
    </div>
  );
};

export default PassportInfo;