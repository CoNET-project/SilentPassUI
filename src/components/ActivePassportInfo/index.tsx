import { useNavigate } from "react-router-dom";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getExpirationDate, getPassportTitle } from "../../utils/utils";
import Skeleton from "../Skeleton";

const ActivePassportInfo = () => {
  const navigate = useNavigate();
  const { profiles, activePassport } = useDaemonContext();

  return (
    <div className="main-card">
      <div style={{ textAlign: 'start' }}>
        <span>Silent Pass Passport</span>
        {activePassport ? <p>{getPassportTitle(activePassport)}</p> : <Skeleton width="120px" height="32px" />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
        <span>Expiration date</span>
        {
          profiles?.[0]?.activePassport?.expires ?
            <p>{getExpirationDate(activePassport)}</p>
            : <Skeleton width='140px' height='32px' />
        }
      </div>
    </div>
  );
};

export default ActivePassportInfo;