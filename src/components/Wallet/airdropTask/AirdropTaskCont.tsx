import { useState, useRef, useEffect } from 'react';
import styles from './airdropTaskCont.module.scss';
import { useTranslation } from 'react-i18next';
import { Popup,NavBar,Button,Space,Collapse,ProgressBar,Tag,Tabs } from 'antd-mobile';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { ExclamationCircleOutline,GiftOutline } from 'antd-mobile-icons';
import Mine from './mine';
import Ranking from './ranking';

interface AirdropTaskContParams {
    setRuleVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const AirdropTaskCont = ({setRuleVisible}:AirdropTaskContParams) => {
    const { t, i18n } = useTranslation();
	const { successNFTID, setSuccessNFTID, isIOS, isLocalProxy, setSubscriptionVisible, profiles, airdropVisible, setAirdropVisible, currentBlock} = useDaemonContext()
	const [isGenesis, setIsGenesis] = useState(false)
	const [subscription, setSubscription] = useState(0)
	const [currectThreshold, setCurrectThreshold] = useState('')
	const [endTimestamp, setEndTimestamp] = useState(new Date())

	useEffect(() => {
		const airdrop: IAirdrop = profiles[0]?.airdropEvent
		if (airdrop) {
			setSubscription(airdrop.currectPassport)
			if (airdrop.isGenesis) {
				setIsGenesis(true)
			}
			let threshold = airdrop.currectThreshold > 200 ? 200 : airdrop.currectThreshold
			threshold = threshold /100
			// const threshold = parseFloat((airdrop.currectThreshold/100).toFixed(2))
			setCurrectThreshold(threshold.toFixed(2))
			setEndTimestamp(airdrop.stopTimestamp)

		}
  	}, [currentBlock])

    return (
        <>
            <div className={styles.progress}>
                <div className={styles.progressHd}>
                    <label className={styles.label}>{t('integral-airdrop-progress-1')}</label>
                    <div className={styles.warnText}>{t('integral-airdrop-progress-2')}</div>
                </div>
                <div className={styles.progressBd}>
                    <ProgressBar percent={100} />
                    <div className={styles.progressBdText}>
                        <span>0</span>
                        <span>Soft-cap 100,000 GB</span>
                    </div>
                </div>
                <div className={styles.progressFt}>{t('integral-airdrop-progress-3')}：{t('integral-airdrop-progress-4')}（{t('integral-airdrop-progress-5')}：{endTimestamp.toLocaleDateString()}）</div>
            </div>
            
            <div className={styles.waysList}>
                <div className={styles.waysBox}>
                    <Space wrap>
						{
							subscription &&
							<Tag round color='#347858'>{t('integral-airdrop-way-1')}×1.00</Tag>
						}
                        
						{
							isGenesis &&
							<Tag round color='#347858'>Genesis×1.55</Tag>
						}
                        
                        <Tag round color='#347858'>{t('integral-airdrop-way-2')}×1.15</Tag>
                    </Space>
                </div>
                <div className={styles.waysTotal}>{t('integral-airdrop-way-3')} ≤ {currectThreshold}×</div>
            </div>

            <div className={styles.tabWrap}>
                <Tabs className={styles.parentTab}>
                    <Tabs.Tab title={t('integral-airdrop-parent-tab-1')} key='1'>
                        <Mine />
                    </Tabs.Tab>
                    <Tabs.Tab title={t('integral-airdrop-parent-tab-2')} key='2'>
                        <Ranking />
                    </Tabs.Tab>
                </Tabs>
            </div>

            
        </>
    );
};

export default AirdropTaskCont;