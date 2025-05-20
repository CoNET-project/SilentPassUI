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
import { startSilentPass, stopSilentPass } from "../../api";
import PassportInfoPopup from "../../components/PassportInfoPopup";
import { getServerIpAddress } from "../../api"
import bannaer from './assets/banner-1.png'
import {checkFreePassportProcess} from '../../services/wallets'
import {airDropForSP, getirDropForSP} from '../../services/subscription'
import airdrop from './assets/airdrop_swing_SP.gif'
import airdropReff from './assets/airdropReff.gif'
import SimpleLoadingRing from '../../components/SimpleLoadingRing'
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
  if (isConnectionLoading)
    return (
      <div className="button-wrapper">
        <BlobWrapper>
          <button
            className="power"
          >
            <img src="/assets/loading-ring.png" className="loading-spinning power-icon" alt="" />
          </button>
        </BlobWrapper>

        <p className="connected" style={{ zIndex: 10 }}>Loading...</p>
      </div>
    )

  if (power)
    return (
      <div className="button-wrapper">
        <BlobWrapper>
          <button
            className="power"
            onClick={handleTogglePower}
          >
            <img src="/assets/power.png" className="power-icon" alt="" />
          </button>
        </BlobWrapper>
      </div>
    )

  return (
    <>
      <div className="button-wrapper">
        <BlobWrapper>
          <button
            className="power"
            onClick={handleTogglePower}
          >
            <img src="/assets/not-power.png" className="power-icon" alt="" />
          </button>
        </BlobWrapper>
      </div>

      {errorMessage && <span style={{ color: '#bf3b37', fontSize: '12px' }}>{errorMessage}</span>}
    </>
  )
}

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

const Home = () => {
  const { power, setPower, profiles, sRegion, setSRegion, setAllRegions, allRegions, setIsRandom, getAllNodes, closestRegion, _vpnTimeUsedInMin, isLocalProxy, setIsLocalProxy, setServerIpAddress, setAirdropProcess, setAirdropSuccess, setAirdropTokens, setAirdropProcessReff} = useDaemonContext();
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isConnectionLoading, setIsConnectionLoading] = useState<boolean>(false)
  const [initPercentage, setInitPercentage] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const vpnTimeTimeout = useRef<NodeJS.Timeout>();
  const [isAirDropForSP, setIsAirDropForSP] = useState(false)
  const [isReadyForReferees, setIsReadyForReferees] = useState(false)
  const [isProcessAirDrop, setIsProcessAirDrop] = useState(false)


  const navigate = useNavigate();
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

    clearInterval(vpnTimeTimeout.current);

    if (power) {
      countMinutes()
    }
  }, [power]);

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    _getAllRegions()
  }, []);


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
	setIsInitialLoading(false);
	init()
  }, [closestRegion])

const handleTogglePower = async () => {
    setIsConnectionLoading(true)
    let error = false;
    setErrorMessage('');
    let selectedCountryIndex = -1
	try {
		const response = await getServerIpAddress();
        const tmpIpAddress = response.data;
        setServerIpAddress(tmpIpAddress?.ip || "");
		setIsLocalProxy(true)
	} catch (ex) {
		setIsLocalProxy(false)
	}

	
    if (power) {

		//		iOS
      if (window?.webkit) {
        window?.webkit?.messageHandlers["stopVPN"].postMessage(null)
        setPower(false);
      }
	  	//	@ts-ignore		Android
		if (window.AndroidBridge && AndroidBridge.receiveMessageFromJS) {
			
			const base = btoa(JSON.stringify({cmd: 'stopVPN', data: ""}))
			//	@ts-ignore
			AndroidBridge.receiveMessageFromJS(base)
			setPower(false);
		} else {
			//	@ts-ignore
			console.log(`window.AndroidBridge Error! typeof window.AndroidBridge = ${typeof window?.AndroidBridge}`)
		}
	  
		//			Desktop
		try {
			const response = await stopSilentPass();
			if (response.status === 200) {
			setPower(false);
			}
		} catch (ex) { }

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

    if (sRegion === -1) {
      selectedCountryIndex = Math.floor(Math.random() * allRegions.length)
      setSRegion(selectedCountryIndex);
    } else {
      selectedCountryIndex = sRegion
    }

    const allNodes = getAllNodes
	if (!allNodes.length) {
		setTimeout(() => {
			setIsConnectionLoading(false)
			setErrorMessage(WAIT_PASSPORT_LOAD_ERROR);
		  }, 1000)
		return
	}
    const exitRegion = allRegions[selectedCountryIndex].code
    const exitNodes = allNodes.filter((n: any) => n.country === exitRegion)

    const randomExitIndex = Math.floor(Math.random() * (exitNodes.length - 1));

    const _exitNode = [exitNodes[randomExitIndex]]

    let _entryNodes = closestRegion

    const entryNodes = _entryNodes.map(n => {
      return {
        country: n.country,
        ip_addr: n.ip_addr,
        region: n.region,
        armoredPublicKey: n.armoredPublicKey,
        nftNumber: n.nftNumber.toString()
      }
    })
    const exitNode = _exitNode.map(n => {
      return {
        country: n.country,
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
    if (window?.webkit) {
      window?.webkit?.messageHandlers["startVPN"].postMessage(base64VPNMessage)
    }

	//	@ts-ignore
	if (window.AndroidBridge && AndroidBridge.receiveMessageFromJS) {
		
		const base = btoa(JSON.stringify({cmd: 'startVPN', data: base64VPNMessage}))
		//	@ts-ignore
		AndroidBridge.receiveMessageFromJS(base)
	} else {
		//	@ts-ignore
		console.log(`window.AndroidBridge Error! typeof window.AndroidBridge = ${typeof window?.AndroidBridge}`)
	}


    try {
      await startSilentPass(startVPNMessageObject);
    } catch (ex) {
      // error = true
      // setErrorMessage(GENERIC_ERROR);
    }

    setTimeout(() => {
      setIsConnectionLoading(false)

      if (!error) {
        setPower(true);
      }

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
            <button
              className="power"
            >
              <img className="loading-spinning" src="/assets/silent-pass-logo-grey.png" style={{ width: '85px', height: '85px' }} alt="" />
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p className="not-connected">Welcome to Silent Pass {initPercentage} %</p>
              {/* <p className="not-connected">{initPercentage}%</p> */}
            </div>
          </>
        ) : (
          <>
            <div>
              <img src="/assets/header-title.svg"></img>
			  {
				
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

				 	
			  }
			  
			  
            </div>

			<div>
				<button onClick={() => navigate("/wallet")}>
					<img className="bannaer" src={bannaer} style={{width:"25rem",height: "5rem"}}></img>
				</button>
				
			</div>

            <RenderButton profile={profiles?.[0]} errorMessage={errorMessage} isConnectionLoading={isConnectionLoading} power={power} handleTogglePower={handleTogglePower} _vpnTimeUsedInMin={_vpnTimeUsedInMin.current} />

            <CopyProxyInfo />

            {
              isLocalProxy && power && (
                <SystemSettingsButton />
              )
            }

            {!isConnectionLoading &&
              <RegionSelector
                title={allRegions?.[sRegion]?.country}
                regionCode={allRegions?.[sRegion]?.code}
                showArrow={!power}
                action={() => !power && navigate("/regions")}
              />
            }
          </>
        )}
      </div>

      <Footer />

      <PassportInfoPopup />
    </>
  );
};

export default Home;
