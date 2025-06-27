import {useState,useRef,useEffect} from 'react';
import { LockFill,DownFill } from 'antd-mobile-icons';
import { Button,Ellipsis,Empty,Toast } from 'antd-mobile';
import styles from './inviters.module.css';
import { useTranslation } from 'react-i18next';
import { useDaemonContext } from './../../../providers/DaemonProvider';

const Inviters=({  })=> {
    const { t, i18n } = useTranslation();
    const { profiles, setAirdropSuccess, setAirdropTokens, setAirdropProcess, setAirdropProcessReff } = useDaemonContext();
    const [pageNo, setPageNo] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    
    const paginateArray = (array: any[]) => {
        const totalItems = array.length;
        const totalPages = Math.ceil(totalItems / pageSize);
        // 边界校验
        if (pageNo < 1 || pageNo > totalPages) {
          return [];
        }
        const startIndex = (pageNo - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalItems);
        return array.slice(startIndex, endIndex);
    }
    const showAddress = (address: string) => {
        const link = document.createElement('a');
        link.href = `https://mainnet.conet.network/address/${address}`
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }
    const list=()=>{
        return paginateArray(profiles?.[0]?.spClub?.referees);
    }
    const handlePreviousPage = async () => {
        if (pageNo > 1) {
            setPageNo(pageNo - 1);
        }
    }
    const handleNextPage = async () => {
        if (pageNo < Math.ceil(profiles?.[0]?.spClub?.totalReferees / pageSize)) {
            setPageNo(pageNo + 1)
        }
    }

    return (
        <div className={styles.inviters}>
            <div className={styles.hd}>
                {t('comp-accountlist-Referral-Invitees')}<span className={styles.num}>{profiles?.[0].spClub?.totalReferees}</span>
            </div>
            <div className={styles.bd}>
                {profiles?.[0]?.spClub?.totalReferees > 0 ?<>
                    {list()?.map((referee,index)=>{
                        return <div key={index} className={styles.item} onClick={() => showAddress(referee.walletAddress)}><Ellipsis direction='middle' content={referee?.walletAddress} /></div>
                    })}
                </>:<Empty
                    style={{ padding: '20px 0 0' }}
                    image={
                        <div className={styles.empty}>
                            <LockFill style={{color: '#f1943f',fontSize: 14,marginRight:2}} />
                            {t('comp-accountlist-Referral-noInvitees')}
                        </div>
                    }
                />}
            </div>
            {profiles?.[0]?.spClub?.totalReferees > 0 ?<div className={styles.ft}>
                <Button className={styles.prevBtn} fill='none' onClick={handlePreviousPage} disabled={pageNo === 1}>
                    <DownFill />
                </Button>
                <div className={styles.showBox}>{pageNo} / {Math.ceil(profiles?.[0]?.spClub?.totalReferees / pageSize)}</div>
                <Button className={styles.nextBtn} fill='none' onClick={handleNextPage} disabled={pageNo >= Math.ceil(profiles?.[0]?.spClub?.totalReferees / pageSize)}>
                    <DownFill />
                </Button>
            </div>:''}
        </div>
    );
}


export default Inviters;