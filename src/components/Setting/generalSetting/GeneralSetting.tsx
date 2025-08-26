import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './generalSetting.module.scss';
import { useTranslation } from 'react-i18next';
import { List,Switch,Badge,Dialog } from 'antd-mobile';
import { GlobalOutlined,CustomerServiceOutlined,QuestionCircleOutlined,ApiOutlined,CloudSyncOutlined } from '@ant-design/icons';
import Languages from './../../Languages';
import {openWebLinkNative,getLocalServerVersion} from '@/api';
import { useDaemonContext } from '@/providers/DaemonProvider';
import Faq from './../faq/Faq';
import {Bridge} from '@/bridge/webview-bridge';
import { getAllRegions } from "@/services/regions"

const GeneralSetting = ({}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [visible, setVisible] = useState(false);
    const [faqVisible, setFaqVisible] = useState(false);
    const { isLocalProxy, isIOS, power, switchValue, setSwitchValue, hasNewVersion, setHasNewVersion, version, getAllNodes, sRegion, allRegions, closestRegion } = useDaemonContext();

    const handleChangeSwitch=(val:boolean)=>{
        setSwitchValue(val)
        if(val && power){
            if (window?.webkit) {
                window?.webkit?.messageHandlers["startProxy"].postMessage("")
            }
        }else{
            if (window?.webkit) {
                window?.webkit?.messageHandlers["stopProxy"].postMessage("")
            }
        }
    }

	const checkUpdate = async () => {
		await getAllRegions()
		const allNodes = getAllNodes
		let selectedCountryIndex = -1
		if (!allNodes.length) {
			return
		}

		if (sRegion === -1) {
			selectedCountryIndex = Math.floor(Math.random() * allRegions.length)

		} else {
			selectedCountryIndex = sRegion
		}


		let _entryNodes = closestRegion

		const entryNodes = _entryNodes.map(n => {
			return {
				country: '',
				ip_addr: n.ip_addr,
				region: n.region,
				armoredPublicKey: n.armoredPublicKey,
				nftNumber: n.nftNumber.toString()
			}
		})


		const startVPNMessageObject: Native_StartVPNObj = {
			entryNodes,
			exitNode: [],
			privateKey: ''
		}
		const stringifiedVPNMessageObject = JSON.stringify(startVPNMessageObject)
		const base64VPNMessage = btoa(stringifiedVPNMessageObject)


		if (isLocalProxy) {
			// await startSilentPass(startVPNMessageObject);
			// if (switchValue) {
			// 	Bridge.send('startVPN',{data:base64VPNMessage},(res:any)=>{});
			// }   
		} else {
			if (isIOS) {
				window?.webkit?.messageHandlers["startCheckUpdate"].postMessage(base64VPNMessage)
				//  @ts-ignore
			} else if (window?.AndroidBridge && AndroidBridge?.receiveMessageFromJS) {
				const base = btoa(JSON.stringify({cmd: 'startCheckUpdate', data: base64VPNMessage}))
				//  @ts-ignore
				AndroidBridge.receiveMessageFromJS(base)
			}
		}
	}


    const compairVersionNew = async () => {
        let remoteVer = await getLocalServerVersion();
        if (isNewerVersion(version, remoteVer)) {
            setHasNewVersion(remoteVer);
            Dialog.show({
                content: (t('home-newversion')+ hasNewVersion),
                closeOnAction: true,
                actions: [
                    [
                        {key: 'cancel',text: '取消'},
                        {key: 'confirm',text: '确认',onClick:()=>{refresh()}}
                    ],
                ],
            })
        }
    }

    /**
     * 比较两个语义化版本号。
     * @param oldVer 旧版本号，如 "0.18.0"
     * @param newVer 新版本号，如 "0.18.1"
     * @returns 如果 newVer 比 oldVer 新，则返回 true；否则返回 false。
     */
    const isNewerVersion = (oldVer: string, newVer: string): boolean => {
        if (!oldVer||!newVer) {
            return false
        }
        const oldParts = oldVer.split('.').map(Number)
        const newParts = newVer.split('.').map(Number)

        for (let i = 0; i < oldParts.length; i++) {
            if (newParts[i] > oldParts[i]) {
                return true
            }
            if (newParts[i] < oldParts[i]) {
                return false
            }
        }
        return false // 如果版本号完全相同，则不是更新的版本
    }
    const refresh= async () => {
        if (isLocalProxy) {
            //          Desktop
            await Bridge.send('stopVPN',{},(res:any)=>{});
            window.location.reload();
        } else if (isIOS ) {
            window?.webkit?.messageHandlers["updateVPNUI"].postMessage(null)
            //  @ts-ignore
        } else if (window.AndroidBridge && AndroidBridge.receiveMessageFromJS) {
            const base = btoa(JSON.stringify({cmd: 'updateVPNUI', data: ""}))
            //  @ts-ignore
            AndroidBridge.receiveMessageFromJS(base)
        }
    }

    return (
        <>
            <div className={styles.general}>
                <List header={t('Settings_General')} style={{'--active-background-color':'#323131'}}>
                    <List.Item 
                        prefix={<span className={styles.icon}><GlobalOutlined /></span>} 
                        extra={t(i18n.language)} 
                        onClick={() => {setVisible(true)}}
                    >
                        {t('language')}
                    </List.Item>
                    <List.Item 
                        prefix={<span className={styles.icon}><QuestionCircleOutlined /></span>} 
                        onClick={() => {setFaqVisible(true)}}
                    >
                        {t('faq')}
                    </List.Item>
                    <List.Item 
                        prefix={<span className={styles.icon}><CustomerServiceOutlined /></span>} 
                        onClick={() => {openWebLinkNative('https://vue.comm100.com/chatwindow.aspx?siteId=90007504&planId=efd822ce-7299-4fda-9fc1-252dd2f01fc5#',isIOS,isLocalProxy)}}
                    >
                        {t('customer-service')}
                    </List.Item>

                    { isLocalProxy ?<List.Item 
                        prefix={<span className={styles.icon}><ApiOutlined /></span>} 
                        extra={<Switch disabled={power} checked={switchValue} onChange={handleChangeSwitch} style={{'--height': '18px','--width': '38px'}} />}
                    >
                        {t('system-proxy')}
                    </List.Item>:''}
                    <List.Item 
                        prefix={<span className={styles.icon}><CloudSyncOutlined /></span>} 
                        onClick={() => {compairVersionNew()}}
                    >
                        {t('Settings_softwareUpdate')} {hasNewVersion?<Badge content='1'></Badge>:''}
                    </List.Item>
                </List>
            </div>
            <Languages visible={visible} setVisible={setVisible} />
            <Faq visible={faqVisible} setVisible={setFaqVisible} />
        </>
    );
};

export default GeneralSetting;