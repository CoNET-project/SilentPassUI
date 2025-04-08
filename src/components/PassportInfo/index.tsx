import { getExpirationDate, getPassportTitle } from "../../utils/utils";
import Radio from '@mui/material/Radio';

const PassportInfo = ({ passportInfo, selectedValue, onChange }: any) => {
  const title = getPassportTitle(passportInfo);

  if (title === "Freemium") return <></>

  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
        <Radio
          checked={selectedValue?.nftID?.toString() === passportInfo?.nftID?.toString()}
          onChange={onChange}
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
        <p style={{ width: 'auto', fontSize: '12px', color: '#B1B1B2', textAlign: 'left', fontWeight: 700, paddingTop: 1 }}>#{passportInfo.nftID} - {title}</p>
      </div>
      <p style={{ fontSize: '10px', color: '#B1B1B2', textAlign: 'right', fontWeight: 500, paddingBottom: 1 }}>{getExpirationDate(passportInfo)}</p>
    </div>
  );
};

export default PassportInfo;