import { useState, useRef, useEffect, useMemo } from 'react';
import styles from '@/components/Home/RenderButton/renderButton.module.scss';
import { LuCirclePower } from 'react-icons/lu';
import type { IconBaseProps } from 'react-icons';
import { ReactComponent as LoadingRing } from '@/components/Home/assets/loading-ring.svg';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { startSilentPass, stopSilentPass } from "@/api";
import {Bridge} from '@/bridge/webview-bridge';
import { isPassportValid } from "@/utils/utils";
import { CoNET_Data } from '@/utils/globals';
import { getAllRegions } from "@/services/regions";
import BlobWrapper from '@/components/Home/BlobWrapper';
const PowerIcon = LuCirclePower  as React.ComponentType<IconBaseProps>;

const GENERIC_ERROR = 'Error Starting Silent Pass. Please try using our iOS App or our desktop Proxy program.';
const PASSPORT_EXPIRED_ERROR = 'Passport has expired. Please renew your passport and try again.';
const WAIT_PASSPORT_LOAD_ERROR = 'Passport info is loading. Please wait a few seconds and try again.';

const RenderButton = ({}) => {
    const [isConnectionLoading, setIsConnectionLoading] = useState<boolean>(false);
    const [showConnected, setShowConnected] = useState(false);
    const { power, setPower, isLocalProxy, switchValue, isIOS, profiles, getAllNodes, sRegion, setSRegion, setAllRegions, allRegions, closestRegion } = useDaemonContext();
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        if (power && !isConnectionLoading) {
            setShowConnected(true);
            const timer = window.setTimeout(() => {
                setShowConnected(false);
            }, 2000);
            return () => clearTimeout(timer);
        }
        setShowConnected(false);
    }, [power, isConnectionLoading]);

    const handleTogglePower = async () => {
        let error = false;
        setErrorMessage('');
        let selectedCountryIndex = -1

        if (power) {
            setIsConnectionLoading(true)
            if (isLocalProxy) {
                //          Desktop
                const response = await stopSilentPass();
                if (switchValue) {
                    Bridge.send('stopVPN',{},(res:any)=>{});
                }
            } else if (isIOS ) {
                window?.webkit?.messageHandlers["stopVPN"].postMessage(null)
                //  @ts-ignore
            } else if (window.AndroidBridge && AndroidBridge.receiveMessageFromJS) {
                const base = btoa(JSON.stringify({cmd: 'stopVPN', data: ""}))
                //  @ts-ignore
                AndroidBridge.receiveMessageFromJS(base)
            }
            setPower(false);
            setTimeout(() => setIsConnectionLoading(false), 1000)
            return ;
        }
        if (!profiles?.[0]?.activePassport?.expires) {
            setTimeout(() => {
                setIsConnectionLoading(false)
                setErrorMessage(WAIT_PASSPORT_LOAD_ERROR);
            }, 1000)
            return
        }

        if (!isPassportValid(profiles?.[0]?.activePassport?.expires)) {
            setTimeout(() => {
                setIsConnectionLoading(false)
                setErrorMessage(PASSPORT_EXPIRED_ERROR);
            }, 1000)
            return
        }

        const conetProfile = CoNET_Data?.profiles[0];
        const privateKey = conetProfile?.privateKeyArmor

        if (!privateKey) {
            return
        }

        setIsConnectionLoading(true)
        await getAllRegions()
        const allNodes = getAllNodes
        
        if (!allNodes.length) {
            setTimeout(() => {
                setIsConnectionLoading(false)
                setErrorMessage(WAIT_PASSPORT_LOAD_ERROR);
            }, 1000)
            return
        }

        if (sRegion === -1) {
            selectedCountryIndex = Math.floor(Math.random() * allRegions.length)
            setSRegion(selectedCountryIndex);
        } else {
            selectedCountryIndex = sRegion
        }

        
        const exitRegion = allRegions[selectedCountryIndex].code
        const exitNodes = allNodes.filter((n: any) => {
            const region: string = n.region
            const regionName = region.split('.')[1]
            return regionName === exitRegion
        })

        const randomExitIndex = Math.floor(Math.random() * (exitNodes.length - 1));

        const _exitNode = [exitNodes[randomExitIndex]]

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

        const exitNode = _exitNode.map(n => {
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
            exitNode,
            privateKey
        }
        const stringifiedVPNMessageObject = JSON.stringify(startVPNMessageObject)
        const base64VPNMessage = btoa(stringifiedVPNMessageObject)


        if (isLocalProxy) {
            await startSilentPass(startVPNMessageObject);
            if (switchValue) {
                Bridge.send('startVPN',{data:base64VPNMessage},(res:any)=>{});
            }   
        } else {
            if (isIOS) {
                window?.webkit?.messageHandlers["startVPN"].postMessage(base64VPNMessage)
                //  @ts-ignore
            } else if (window?.AndroidBridge && AndroidBridge?.receiveMessageFromJS) {
                const base = btoa(JSON.stringify({cmd: 'startVPN', data: base64VPNMessage}))
                //  @ts-ignore
                AndroidBridge.receiveMessageFromJS(base)
            }
        }
        setTimeout(() => {
             setIsConnectionLoading(false)
            setPower(true)
        }, 1000)

        return ;
    };
    const state = useMemo(
        () => (isConnectionLoading ? 'connecting' : power ? 'on' : 'off'),
        [isConnectionLoading, power]
    );

    return (
        <div className={styles.renderButton}>
            <BlobWrapper state={state}>
                <div
                    className={power ? `${styles.power} ${styles.powerOn}` : `${styles.power} ${styles.powerOff}`}
                    onClick={!isConnectionLoading ? handleTogglePower : undefined}
                >
                    {isConnectionLoading ? (
                        <LoadingRing className={ `${styles.powerIcon} ${styles.loadingSpinning}`} />
                    ) : (
                        power ?<PowerIcon className={ `${styles.powerIcon} ${styles.powerIconOn}`} /> :<PowerIcon className={ `${styles.powerIcon} ${styles.powerIconOff}`} />
                    )}
                </div>
            </BlobWrapper>
            {isConnectionLoading && <div className={styles.loadingText}>Loading...</div>}
            {showConnected && <div className={styles.connected}>Connected</div>}
            {!isConnectionLoading && !power && errorMessage && (<div className={styles.errorConnected}>{errorMessage}</div>)}
        </div>
    );
};

export default RenderButton;