import { useState, useRef, useEffect } from 'react';
import styles from './addition.module.scss';
import { useTranslation } from 'react-i18next';

const Addition = ({}) => {
    const { t, i18n } = useTranslation();
    const [current, setCurrent] = useState(0);
    const [list, setList] = useState([
        {name:t('integral-airdrop-addition-2'),desc:t('integral-airdrop-addition-6'),val:'1.00'},
        {name:t('integral-airdrop-addition-3'),desc:t('integral-airdrop-addition-7'),val:'1.10'},
        {name:t('integral-airdrop-addition-4'),desc:t('integral-airdrop-addition-8'),val:'1.15'},
        {name:t('integral-airdrop-addition-5'),desc:t('integral-airdrop-addition-9'),val:'1.30'}
    ]);

    // 🔁 当语言变化时，重新构建文案
    useEffect(() => {
        setList([
            {name:t('integral-airdrop-addition-2'),desc:t('integral-airdrop-addition-6'),val:'1.00'},
            {name:t('integral-airdrop-addition-3'),desc:t('integral-airdrop-addition-7'),val:'1.10'},
            {name:t('integral-airdrop-addition-4'),desc:t('integral-airdrop-addition-8'),val:'1.15'},
            {name:t('integral-airdrop-addition-5'),desc:t('integral-airdrop-addition-9'),val:'1.30'}
        ]);
    }, [i18n.language, t]);

    return (
        <div className={styles.addition}>
            <div className={styles.hd}>
                <div className={styles.title}>{t('integral-airdrop-addition-1')}</div>
                <span className={styles.additionNum}>× {list[current]['val']}</span>
            </div>
            <ul className={styles.tabWrap}>
                {list.map((item,i)=>{
                    return <li key={i} className={current==i?styles.cur:''} onClick={()=>{setCurrent(i)}}>{item.name}</li>
                })}
            </ul>
            <div className={styles.desc}>
                {list[current]['desc']}
            </div>
        </div>
    );
};

export default Addition;