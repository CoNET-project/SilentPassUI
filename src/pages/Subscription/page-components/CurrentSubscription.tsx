import { useDaemonContext } from "../../../providers/DaemonProvider";
import { getExpirationDate, getPassportTitle, getPlanDuration } from "../../../utils/utils";

export default function CurrentSubscription() {
  const { activePassport } = useDaemonContext();

  return (
    <div className="current">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h4 style={{ fontSize: '20px' }}>{getPassportTitle(activePassport)} Passport</h4>
        <p>{getPlanDuration(activePassport)}</p>
      </div>
      <p>Expiration date: <strong>{getExpirationDate(activePassport)}</strong></p>
    </div>
  )
}