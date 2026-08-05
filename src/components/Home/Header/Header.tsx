import styles from '@/components/Home/Header/header.module.scss';
import { useDaemonContext } from '@/providers/DaemonProvider';
import { ReactComponent as ConetToken } from '@/components/Home/assets/conet-token.svg';
import gbTokenIcon from '@/components/Home/assets/gb-token.jpg';
import { formatGbDisplay } from '@/utils/formatGbDisplay';
import { Skeleton } from 'antd-mobile';

const Header = ({}) => {
    const { miningData, profiles } = useDaemonContext();
    const gbBalance = profiles?.[0]?.tokens?.sGB?.balance;

    return (
        <div className={styles.header}>
            <div className={styles.onlineNum}>
                <ConetToken /> {miningData?.online ? miningData.online : <Skeleton animated className={styles.customSkeleton} />}
            </div>
            <div className={styles.gbBalance}>
                {gbBalance !== undefined && gbBalance !== ''
                    ? (
                        <>
                            <img src={gbTokenIcon} alt="GB" />
                            <span>{formatGbDisplay(gbBalance)}</span>
                            <span className={styles.gbSuffix}> GB</span>
                        </>
                    )
                    : <Skeleton animated className={styles.customSkeleton} />}
            </div>
        </div>    
    );
};

export default Header;
