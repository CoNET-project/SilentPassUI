import { useNavigate } from "react-router-dom";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getExpirationDate, getPassportTitle } from "../../utils/utils";
import Skeleton from "../Skeleton";
import Radio from '@mui/material/Radio';
import { useTranslation } from 'react-i18next'

const PassportInfo = ({ passportInfo, selectedValue, onChange }: any) => {
	const { t, i18n } = useTranslation()
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
        <p style={{ width: 'auto', fontSize: '12px', color: '#B1B1B2', textAlign: 'left', fontWeight: 700, paddingTop: 1 }}>#{passportInfo.nftID} - {getPassportTitle(passportInfo, t('passport_Freemium'), t('passport_Guardian'), t('passport_Annually'),t('passport_Quarter'),t('passport_Monthly'))}</p>
      </div>
      <p style={{ fontSize: '10px', color: '#B1B1B2', textAlign: 'right', fontWeight: 500, paddingBottom: 1 }}>{getExpirationDate(passportInfo, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour'))}</p>
    </div>
  );
};

export default PassportInfo;