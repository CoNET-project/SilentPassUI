import { useNavigate } from "react-router-dom";
import { useDaemonContext } from "./../../../../providers/DaemonProvider";
import { getExpirationDate, getPassportTitle } from "./../../../../utils/utils";
import styles from './passportItem.module.css';
import { useTranslation } from 'react-i18next';
import { Radio } from 'antd-mobile';

const PassportItem = ({ passportInfo, selectedValue, onChange }: any) => {
    const { t, i18n } = useTranslation();

    return (
        <div className={styles.item}>
            <Radio 
                checked={selectedValue?.nftID?.toString() === passportInfo?.nftID?.toString()}
                onChange={onChange}
                style={{
                    '--icon-size': '18px',
                    '--font-size': '14px',
                }}
            >
                #{passportInfo.nftID} - {t(getPassportTitle(passportInfo))}
            </Radio>
            <div>{getExpirationDate(passportInfo, t('passport_unlimit'),t('passport_notUsed'), t('passport_day'),t('passport_hour'))}</div>
        </div>
    );
};

export default PassportItem;