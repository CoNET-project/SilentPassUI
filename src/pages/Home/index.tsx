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
import { formatMinutesToHHMM } from "../../utils/utils";
import { startSilentPass, stopSilentPass } from "../../api";
import PassportInfo from "../../components/PassportInfo";
import { conetProvider } from "../../utils/constants";

interface RenderButtonProps {
  errorStartingSilentPass: boolean;
  isConnectionLoading: boolean;
  power: boolean;
  profile: any;
  _vpnTimeUsedInMin: number;
  handleTogglePower: () => void;
}

const RenderButton = ({ errorStartingSilentPass, handleTogglePower, isConnectionLoading, power, profile, _vpnTimeUsedInMin }: RenderButtonProps) => {
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

        <p className="connected">Loading...</p>
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

        <div className="current-mined">
          <strong>Total time used</strong>
          {/* <p>{formatMinutesToHHMM(parseInt(profile?.vpnTimeUsedInMin) || 0)}</p> */}
          <p>{formatMinutesToHHMM(_vpnTimeUsedInMin)}</p>
        </div>
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

        <div className="current-mined">
          <strong>Total time used</strong>
          {/* <p>{formatMinutesToHHMM(parseInt(profile?.vpnTimeUsedInMin) || 0)}</p> */}
          <p>{formatMinutesToHHMM(_vpnTimeUsedInMin)}</p>
        </div>
      </div>

      {errorStartingSilentPass && <span style={{ color: '#bf3b37', fontSize: '12px' }}>Error Starting Silent Pass. Please try using our iOS App or our desktop Proxy program.</span>}
    </>
  )
}


const Home = () => {
  const { profile, sRegion, setSRegion, setAllRegions, allRegions, setIsRandom, getAllNodes, closestRegion, _vpnTimeUsedInMin } = useDaemonContext();
  const [power, setPower] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isConnectionLoading, setIsConnectionLoading] = useState<boolean>(false)
  const [initPercentage, setInitPercentage] = useState<number>(0);
  const [errorStartingSilentPass, setErrorStartingSilentPass] = useState<boolean>(false);
  const vpnTimeTimeout = useRef<NodeJS.Timeout>();

  const navigate = useNavigate();


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
    const listenGetAllNodes = () => {
      const initpercentage = maxNodes ? currentScanNodeNumber * 100 / maxNodes : 0
      const status = Math.round(initpercentage)
      setInitPercentage(status)

      if (initpercentage < 90) {
        return setTimeout(() => {
          listenGetAllNodes()
        }, 1000)
      } else {
        setIsInitialLoading(false);
      }
    }

    listenGetAllNodes()
  }, [])

  useEffect(() => {
    const _getAllRegions = async () => {
      const tmpRegions = await getAllRegions();

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

    _getAllRegions()
  }, [allRegions]);

  const handleTogglePower = async () => {
    setIsConnectionLoading(true)
    let error = false;
    setErrorStartingSilentPass(false);
    let selectedCountryIndex = -1

    if (power) {
      if (window?.webkit) {
        window?.webkit?.messageHandlers["stopVPN"].postMessage(null)
        setPower(false);
      } else {
        try {
          const response = await stopSilentPass();
          if (response.status === 200) {
            setPower(false);
          }
        } catch (ex) { }
      }
      setTimeout(() => setIsConnectionLoading(false), 1000)
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

    if (window?.webkit) {
      const stringifiedVPNMessageObject = JSON.stringify(startVPNMessageObject);
      const base64VPNMessage = btoa(stringifiedVPNMessageObject);
      window?.webkit?.messageHandlers["startVPN"].postMessage(base64VPNMessage)
    } else {
      try {
        await startSilentPass(startVPNMessageObject);
      } catch (ex) {
        error = true
        setErrorStartingSilentPass(true);
      }
    }

    setTimeout(() => {
      setIsConnectionLoading(false)

      if (!error)
        setPower(true);
    }, 1000)

    return
  };

  return (
    <>
      <Header />
      <div className="home">
        {isInitialLoading ? (
          <>
            <button
              className="power"
            >
              <img className="loading-spinning" src="/assets/silent-pass-logo-grey.png" style={{ width: '85px', height: '85px' }} alt="" />
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p className="not-connected">Welcome to Silent Pass</p>
              <p className="not-connected">{initPercentage}%</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <img src="/assets/header-title.svg"></img>
            </div>

            <RenderButton profile={profile} errorStartingSilentPass={errorStartingSilentPass} isConnectionLoading={isConnectionLoading} power={power} handleTogglePower={handleTogglePower} _vpnTimeUsedInMin={_vpnTimeUsedInMin.current} />

            <CopyProxyInfo />

            {/* <PassportInfo /> */}

            {!power && !isConnectionLoading &&
              <RegionSelector
                title={allRegions?.[sRegion]?.country}
                regionCode={allRegions?.[sRegion]?.code}
                action={() => navigate("/regions")}
              />
            }
          </>
        )}
      </div>

      <Footer />
    </>
  );
};

export default Home;
