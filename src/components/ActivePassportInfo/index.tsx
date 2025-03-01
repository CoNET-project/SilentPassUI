import { useNavigate } from "react-router-dom";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getRemainingTime } from "../../utils/utils";
import Skeleton from "../Skeleton";

const ActivePassportInfo = () => {
  const navigate = useNavigate();
  const { profiles, activePassport } = useDaemonContext();

  const activePassportName = activePassport?.premium ? "Premium" : "Freemium";

  return (
    <div className="main-card">
      <div style={{ textAlign: 'start' }}>
        <span>Silent Pass Passport</span>
        {activePassport ? <p>{activePassportName}</p> : <Skeleton width="120px" height="32px" />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
        <span>Expiration date</span>
        {
          profiles?.[0]?.activePassport?.expires ?
            <p>{getRemainingTime(profiles?.[0]?.activePassport?.expires)}</p>
            : <Skeleton width='140px' height='32px' />
        }
      </div>
    </div>
  );
};

export default ActivePassportInfo;