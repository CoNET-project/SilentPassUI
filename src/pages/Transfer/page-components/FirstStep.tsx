import { CoNET_Data } from "../../../utils/globals";
import { getExpirationDate, getPassportTitle, getPlanDuration } from '../../../utils/utils';

interface FirstStepProps {
  to: string;
  setTo: (text: string) => void;
  selectedNftId: string;
  setSelectedNFtId: (nftId: string) => void;
}

export default function FirstStep({ to, setTo, selectedNftId, setSelectedNFtId }: FirstStepProps) {
  return (
    <div className="step-container" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div className="input-container">
        <p>To</p>
        <input placeholder="Paste receiver Silent Pass Account" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <div className="passport-list">
        {
          (CoNET_Data?.profiles?.[0].silentPassPassports && CoNET_Data?.profiles?.[0].activePassport)
            ? CoNET_Data.profiles[0].silentPassPassports?.filter((passport) => passport.nftID !== Number(CoNET_Data?.profiles[0].activePassport?.nftID)).map((passport) => (
              <div className={`passport-button ${Number(passport.nftID) === Number(selectedNftId) ? 'selected' : ''}`} onClick={() => setSelectedNFtId(String(passport.nftID))}>
                <div className="heading" style={{ alignItems: 'center' }}>
                  <h3>{getPassportTitle(passport)} Passport</h3>
                  <p>{getPlanDuration(passport)}</p>
                </div>
                <div className="info" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                  <div><p>Expiration date: <strong>{getExpirationDate(passport)}</strong></p></div>
                  <div><p>NFT ID: <strong>{passport.nftID}</strong></p></div>
                </div>
              </div>
            ))
            : <></>
        }
      </div>
    </div>
  )
}