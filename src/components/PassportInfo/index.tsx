import { useNavigate } from "react-router-dom";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getRemainingTime } from "../../utils/utils";
import Skeleton from "../Skeleton";
import Radio from '@mui/material/Radio';

const PassportInfo = ({ passportInfo, selectedValue }: any) => {

  const getPassportTitle = () => {
    if (passportInfo?.expiresDays?.toString() === '7')
      return <p style={{ fontSize: '12px', color: '#B1B1B2', textAlign: 'left', fontWeight: 700, paddingTop: 1 }}>Freemium Passport</p>

    if (passportInfo?.expiresDays && passportInfo?.expiresDays > 365)
      return <p style={{ fontSize: '12px', color: '#B1B1B2', textAlign: 'left', fontWeight: 700, paddingTop: 1 }}>Unlimited Passport</p>

    if (passportInfo?.premium)
      return <p style={{ fontSize: '12px', color: '#B1B1B2', textAlign: 'left', fontWeight: 700, paddingTop: 1 }}>Premium Passport</p>

    return <p style={{ fontSize: '12px', color: '#B1B1B2', textAlign: 'left', fontWeight: 700, paddingTop: 1 }}>Standard Passport</p>
  }

  const renderExpirationDate = () => {
    if (passportInfo?.expires && passportInfo?.expires > 31536000000) {
      return <p style={{ fontSize: '10px', color: '#B1B1B2', textAlign: 'right', fontWeight: 500, paddingBottom: 1 }}>Unlimited</p>
    }

    if (passportInfo?.expires === 0) {
      return <p style={{ fontSize: '10px', color: '#B1B1B2', textAlign: 'right', fontWeight: 500, paddingBottom: 1 }}>Not started</p>
    }

    if (passportInfo?.expires)
      return <p style={{ fontSize: '10px', color: '#B1B1B2', textAlign: 'right', fontWeight: 500, paddingBottom: 1 }}>Expires in {getRemainingTime(passportInfo?.expires)}</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', width: '100%', gap: '8px' }}>
      <Radio
        checked={selectedValue?.nftID?.toString() === passportInfo?.nftID?.toString()}
        // onChange={handleChange}
        value="a"
        name="radio-buttons"
        inputProps={{ 'aria-label': 'A' }}
        sx={{
          padding: "0px",
          color: "#9FBFE5FE",
          '&.Mui-checked': {
            color: "#9FBFE5FE",
          },
        }}

      />
      {getPassportTitle()}
      {renderExpirationDate()}
    </div>
  );
};

export default PassportInfo;