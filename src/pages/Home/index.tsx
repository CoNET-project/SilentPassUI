import "./index.css";
import { mappedCountryCodes } from "../../utils/regions";
import { useEffect, useRef, useState } from "react";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getAllRegions } from "../../services/regions";
import BlobWrapper from '../../components/BlobWrapper';
import { maxNodes, currentScanNodeNumber } from '../../services/mining';
import { CoNET_Data } from '../../utils/globals';
import Header from '../../components/Header';
import CopyProxyInfo from '../../components/CopyProxyInfo';
import Footer from '../../components/Footer';
import RegionSelector from '../../components/RegionSelector';
import { useNavigate } from 'react-router-dom';
import { formatMinutesToHHMM, isPassportValid } from "../../utils/utils";
import { startSilentPass, stopSilentPass, getLocalServerVersion } from "../../api";
import PassportInfoPopup from "../../components/PassportInfoPopup";
import QuickLinks from "../../components/QuickLinks/QuickLinks";
import { getServerIpAddress } from "../../api"
import bannaer from './assets/bannerv1_en.gif'
import bannaer_cn from './assets/bannerv1_cn.gif'
import {airDropForSP, getirDropForSP} from '../../services/subscription'
import airdrop from './assets/airdrop_swing_SP.gif'
import airdropReff from './assets/airdropReff.gif'
import { useTranslation } from 'react-i18next'
import { useMemo } from "react";
import { LuCirclePower } from 'react-icons/lu';
import type { IconBaseProps } from 'react-icons';
import {Bridge} from './../../bridge/webview-bridge';

const PowerIcon = LuCirclePower  as React.ComponentType<IconBaseProps>;



const GENERIC_ERROR = 'Error Starting Silent Pass. Please try using our iOS App or our desktop Proxy program.';
const PASSPORT_EXPIRED_ERROR = 'Passport has expired. Please renew your passport and try again.';
const WAIT_PASSPORT_LOAD_ERROR = 'Passport info is loading. Please wait a few seconds and try again.';


const VPN_URLS = ['vpn', 'vpn-beta'];

interface RenderButtonProps {
  errorMessage: string;
  isConnectionLoading: boolean;
  power: boolean;
  profile: any;
  _vpnTimeUsedInMin: number;
  handleTogglePower: () => void;
}

const RenderButton = ({ errorMessage, handleTogglePower, isConnectionLoading, power, profile, _vpnTimeUsedInMin }: RenderButtonProps) => {
  
    const [showConnected, setShowConnected] = useState(false);

  // Show "Connected" message for 2 seconds after connection
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

  const state = useMemo(
    () => (isConnectionLoading ? 'connecting' : power ? 'on' : 'off'),
    [isConnectionLoading, power]
  );
  
  return (
    <div className="button-wrapper">
      <BlobWrapper state={state}>
      {/* <BlobWrapper state={'on'}> */}

        <button
          className={power ? 'power power-on' : 'power power-off'}
          onClick={!isConnectionLoading ? handleTogglePower : undefined}
        >
          {isConnectionLoading ? (
            <img src={'/assets/loading-ring.png'} className={"power-icon loading-spinning"}alt="" />
          ) : (power ? 
            <PowerIcon className="power-icon power-icon-on" /> :
            <PowerIcon className="power-icon power-icon-off" />
          )}
        </button>
      </BlobWrapper>

      {isConnectionLoading && <p className="connected">Loading...</p>}
      {showConnected && <p className="connected">Connected</p>}
      {state === 'off' && errorMessage && (
        <p className="error-connected" style={{ color: '#bf3b37', fontSize: '12px' }}>
          {errorMessage}
        </p>
      )}
    </div>
  );
};


const SystemSettingsButton = () => {
    const {globalProxy, setGlobalProxy } = useDaemonContext();

  return (
    <button
      className={`system-settings-button ${globalProxy ? "checked" : ""}`}
      onClick={() => {
        if (globalProxy) {
            if (window?.webkit) {
                window?.webkit?.messageHandlers["stopProxy"].postMessage("")
            }
            return setGlobalProxy(false)
        }
        if (window?.webkit) {
            window?.webkit?.messageHandlers["startProxy"].postMessage("")
        }
        return setGlobalProxy(true)
      }}
    >
      <span className="circle">{globalProxy && "✔"}</span>
      Enable for System Settings
    </button>
  )
}

const refresh= () => {
	window.location.reload()
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

const Home = () => {
  const { power, setPower, profiles, sRegion, setSRegion, setAllRegions, allRegions, setIsRandom, getAllNodes, closestRegion, _vpnTimeUsedInMin,switchValue, isLocalProxy, setAirdropProcess, setAirdropSuccess, setAirdropTokens, setAirdropProcessReff, isIOS, version} = useDaemonContext();
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isConnectionLoading, setIsConnectionLoading] = useState<boolean>(false)
  const [initPercentage, setInitPercentage] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const vpnTimeTimeout = useRef<NodeJS.Timeout>();
  const [isAirDropForSP, setIsAirDropForSP] = useState(false)
  const [isReadyForReferees, setIsReadyForReferees] = useState(false)
  const [isProcessAirDrop, setIsProcessAirDrop] = useState(false)
  const { t, i18n } = useTranslation()
  const navigate = useNavigate();
  const [hasNewVersion, setHasNewVersion]= useState('')


  const _getAllRegions = async () => {
    
    const [tmpRegions] = await
    Promise.all([
        getAllRegions()
    ])

    const treatedRegions = Array.from(new Set(tmpRegions.map((region: string) => {
        const separatedRegion = region.split(".");
        const code = separatedRegion[1];

        const country = mappedCountryCodes[code];

        return JSON.stringify({ code, country }); // Convert the object to a string for Set comparison
    }))).map((regionStr: any) => JSON.parse(regionStr)); // Convert the string back to an object

    const unitedStatesIndex = treatedRegions.findIndex((region: any) => region.code === 'US')

    if (sRegion < 0) {
        setSRegion(unitedStatesIndex)
        setIsRandom(false);
    }

    setAllRegions(treatedRegions);
    
  };


  useEffect(() => {
    const countMinutes = () => {
      const timeout = setTimeout(() => {
        _vpnTimeUsedInMin.current = (_vpnTimeUsedInMin.current) + 1;
        localStorage.setItem("vpnTimeUsedInMin", (_vpnTimeUsedInMin.current).toString());
        countMinutes();
      }, 60000)

      vpnTimeTimeout.current = timeout;
    }

    clearTimeout(vpnTimeTimeout.current);

    if (power) {
      countMinutes()
    }
  }, [power]);

  const compairVersion = async () => {
	let remoteVer = await getLocalServerVersion()
	if (isNewerVersion(version, remoteVer)) {
		setHasNewVersion(remoteVer)
	}
		
  }

  useEffect(() => {
    _getAllRegions()
    let first = 0
    const listenGetAllNodes = () => {
        
        const _initpercentage = maxNodes ? currentScanNodeNumber * 100 / (maxNodes+200) : 0
        const _status = Math.round(_initpercentage)
        const status = _status <= first ? first + 2 : _status
        first = status
      if (status > 100) {
          setInitPercentage(98)
      } else {
          setInitPercentage(status)
      }
  
        if (status < 99 ) {
          return setTimeout(() => {
            listenGetAllNodes()
          }, 1000)
        }
    }

    listenGetAllNodes()
	compairVersion()

  }, [])


  const init = async () => {
    const status = await airDropForSP()
    if (status !== false) {
        setIsAirDropForSP(status.isReadyForSP)
        setIsReadyForReferees(status.isReadyForReferees)
    }
    
  }

  const airdropProcess = async () => {

    setIsProcessAirDrop(true)
    setAirdropProcess(true)
    if (isAirDropForSP) {
        const kk = await getirDropForSP()
        setIsAirDropForSP(false)
        
        if (typeof kk === 'number') {
            
            setAirdropSuccess(true)
            setAirdropTokens(kk)
            navigate('/wallet')
        }
        return
    }
    setAirdropProcessReff(true)
    navigate('/wallet')
  }

  useEffect(() => {
    if (!closestRegion?.length) {
        return
    }
    setIsInitialLoading(false)
    init()
  }, [closestRegion])


const handleTogglePower = async () => {
    let error = false;
    setErrorMessage('');
    let selectedCountryIndex = -1

    if (power) {
        setIsConnectionLoading(true)

        if (isLocalProxy) {
         //          Desktop
         try {
             const response = await stopSilentPass();
             if (response.status === 200) {
                    
             }
         } catch (ex) { }
         if (switchValue) {
            Bridge.send('stopVPN',{},(res:any)=>{});
         }
            
        } else if (isIOS ) {
            
         window?.webkit?.messageHandlers["stopVPN"].postMessage(null)
            
        } else 
            //   @ts-ignore      Android
        if (window.AndroidBridge && AndroidBridge.receiveMessageFromJS) {
            
         const base = btoa(JSON.stringify({cmd: 'stopVPN', data: ""}))
         //  @ts-ignore
         AndroidBridge.receiveMessageFromJS(base)
            
        }

        setPower(false);
        setTimeout(() => setIsConnectionLoading(false), 1000)
        return
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
    console.log(_entryNodes)
    console.log(_exitNode)
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
     try {
         await startSilentPass(startVPNMessageObject);
     } catch (ex) {

     }

     if (switchValue) {
          Bridge.send('startVPN',{data:base64VPNMessage},(res:any)=>{});
     }   
    } else {
     if (isIOS) {
         window?.webkit?.messageHandlers["startVPN"].postMessage(base64VPNMessage)
     } else
     //  @ts-ignore
     if (window?.AndroidBridge && AndroidBridge?.receiveMessageFromJS) {
            
         const base = btoa(JSON.stringify({cmd: 'startVPN', data: base64VPNMessage}))
         //  @ts-ignore
         AndroidBridge.receiveMessageFromJS(base)
     }
    }

    setTimeout(() => {
         setIsConnectionLoading(false)
        setPower(true)
    }, 1000)

    return
};
  
  const isSilentPassVPN = VPN_URLS.some(url => window.location.href.includes(url));
  const isDevelopment = window.location.href.includes('localhost');

  return (
    <>
      <Header />
      <div className="home" style={{ overflowX: 'hidden' }}>
        {isInitialLoading ? (
          <>
          <div style={{ display: 'absolute', flexDirection: 'column', gap: '8px' }}>
            <button
              className="power"
            >
            
              <img className="loading-spinning" src="/assets/silent-pass-logo-grey.png" style={{ width: '85px', height: '85px' }} alt="" />
            </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '400px' }}>
              <p className="not-connected">Welcome to Silent Pass {initPercentage} %</p>
              </div>
              {/* <p className="not-connected">{initPercentage}%</p> */}
            </div>
          </>
        ) : (
          <>
		  	
            <div>
              
              <img src="/assets/header-title.svg" style={{minWidth: '150px', minHeight: '75x'}}></img>
              {/* {
                
                !isProcessAirDrop && 
                <>
                    {
                        isAirDropForSP &&
                            <img src={airdrop} style={{height:"4rem", cursor: "pointer"}} onClick={airdropProcess}/> 
                    }
                    {
                        !isAirDropForSP && isReadyForReferees &&
                            <img src={airdropReff} style={{height:"4rem", cursor: "pointer"}} onClick={airdropProcess}/>
                        
                    }
                </>
                    
              } */}
              
            </div>
			{
				hasNewVersion && <>
					<a style={{textAlign:'center', color: '#97bbee', zIndex: '99999', fontWeight: '500'}} onClick={refresh}>
						{t('home-newversion')}{hasNewVersion}
					</a>
				</>
			}
            {/* <div>
                <button onClick={() => navigate("/wallet")}>
                    <img className="bannaer" src={i18n.language === 'zh' ? bannaer_cn : bannaer} style={{width:"25rem",height: "5rem"}}></img>
                </button>
                
            </div> */}

            <RenderButton profile={profiles?.[0]} errorMessage={errorMessage} isConnectionLoading={isConnectionLoading} power={power} handleTogglePower={handleTogglePower} _vpnTimeUsedInMin={_vpnTimeUsedInMin.current} />
              {
                isLocalProxy &&
                <CopyProxyInfo />
              }
            

            {/*{
              isLocalProxy && power && (
                <SystemSettingsButton />
              )
            }*/}

            {
              <RegionSelector
                ios={isIOS}
                title={allRegions?.[sRegion]?.country}
                regionCode={allRegions?.[sRegion]?.code}
                showArrow={!power}
                isLocalServer={isLocalProxy}
                action={() => !power && navigate("/regions")}
              />
            }
          </>
        )}
      </div>

      <QuickLinks />

      <Footer />

      <PassportInfoPopup />
    </>
  );
};

export default Home;
