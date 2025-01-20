import "./index.css";
import { mappedCountryCodes } from "../../utils/regions";
import { useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag";
import { useNavigate } from "react-router-dom";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getAllRegions } from "../../services/regions";
import MiningStatus from '../../components/MiningStatus';
import BlobWrapper from '../../components/BlobWrapper';
import Menu from '../../components/Menu';
import Skeleton from '../../components/Skeleton';
import {maxNodes, currentScanNodeNumber } from '../../services/mining';
import { CoNET_Data } from '../../utils/globals';



const Home = () => {
  const { profile, sRegion, setSRegion, setAllRegions, allRegions, isRandom, setIsRandom, getAllNodes, closestRegion} = useDaemonContext();
  const [power, setPower] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isConnectionLoading, setIsConnectionLoading] = useState<boolean>(false)
  const [isMenuVisible, setIsMenuVisible] = useState<boolean>(false)
  const [isWalletCopied, setIsWalletCopied] = useState<boolean>(false);
  const [isPrivateKeyCopied, setIsPrivateKeyCopied] = useState<boolean>(false);

  const [isPortCopied, setIsPortCopied] = useState<boolean>(false);
  const [isServerCopied, setIsServerCopied] = useState<boolean>(false);
  const [isPACCopied, setIsPACCopied] = useState<boolean>(false);
  const [initPercentage, setInitPercentage] = useState<number>(0);

  const navigate = useNavigate();

  useEffect(() => {
	const listenGetAllNodes = () => {
		
		const initpercentage = maxNodes ? currentScanNodeNumber*100/maxNodes : 0
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
  },[])

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
	  if (sRegion<0) {
		setSRegion(unitedStatesIndex)
		setIsRandom(false);
	  }


      setAllRegions(treatedRegions);
    };



    _getAllRegions()

    // setTimeout(() => setIsInitialLoading(false), 3000);
  }, []);

//   useEffect(() => {
// 	if (sRegion > -1) {
// 		console.log(`sRegion = ${sRegion}`)
// 	}
//   },[sRegion])

  const toggleMenu = () => {
    setIsMenuVisible(prevState => !prevState);
  }

type Native_node = {
	country: string
	ip_addr: string
	region: string
	armoredPublicKey: string
	nftNumber: string
}


type Native_StartVPNObj = {
	entryNodes: Native_node[]
	privateKey: string
	exitNode: Native_node[]
}
  const handleTogglePower = async () => {
    let selectedCountryIndex = -1

    if (power) {
      setPower(false);
      window?.webkit?.messageHandlers["stopVPN"].postMessage(null)
      return
    }
	const conetProfile = CoNET_Data?.profiles[1];
	const privateKey = conetProfile?.privateKeyArmor
	if (!privateKey) {
		return 
	}

    
      setIsConnectionLoading(true)
      if (sRegion === -1) {
        selectedCountryIndex = Math.floor(Math.random() * allRegions.length)
        setSRegion(selectedCountryIndex);
      } else {
        selectedCountryIndex = sRegion
      }

	  const allNodes = getAllNodes
	  const exitRegion = allRegions[selectedCountryIndex].code
	  const exitNodes =  allNodes.filter((n: any) => n.country === exitRegion)

    //   const selectedCountryCode = allRegions[selectedCountryIndex].code

      const entryNodeRegion = closestRegion.node.country
      const __entryNodes = allNodes.filter((n: any) => n.country === entryNodeRegion);

      const randomExitIndex = Math.floor(Math.random() * (exitNodes.length-1));

      const _exitNode = [exitNodes[randomExitIndex]]

	  let _entryNodes = __entryNodes

      if (_entryNodes.length > 5) {
		_entryNodes = []
        do {
          const randomNodeIndex = Math.floor(Math.random() * (__entryNodes.length-1))
          const choosenNode = __entryNodes[randomNodeIndex]
          _entryNodes.push(choosenNode)
		  __entryNodes.splice(randomNodeIndex, 1)
        } while (_entryNodes.length < 5);
      }

      
	  const entryNodes: Native_node[] = _entryNodes.map(n => {
		return {
			country: n.country, 
			ip_addr: n.ip_addr, 
			region: n.region, 
			armoredPublicKey: n.armoredPublicKey, 
			nftNumber: n.nftNumber.toString()
		}})
	  const exitNode = _exitNode.map(n => {
		return {
			country: n.country, 
			ip_addr: n.ip_addr, 
			region: n.region, 
			armoredPublicKey: n.armoredPublicKey, 
			nftNumber: n.nftNumber.toString()
		}})

      const startVPNMessageObject: Native_StartVPNObj = {
        entryNodes,
        exitNode,
        privateKey
      }

      const stringifiedVPNMessageObject = JSON.stringify(startVPNMessageObject);

      const base64VPNMessage = btoa(stringifiedVPNMessageObject);

      window?.webkit?.messageHandlers["startVPN"].postMessage(base64VPNMessage)

      setTimeout(() => {
        setIsConnectionLoading(false)
        setPower(true);
      }, 1000)

      return
    
  };

  const renderButton = () => {
    if (isConnectionLoading)
      return (
        <>
          <p className="connection">Connecting <span> Silent Pass </span></p >

          <BlobWrapper>
            <button
              className="power"
            >
              <img src="/assets/loading-ring.png" className="loading-spinning power-icon" alt="" />
            </button>
          </BlobWrapper>

          <p className="connected">Loading...</p>
        </>
      )

    if (power)
      return (
        <>
		<div className="current-mined">
            {profile?.tokens?.cCNTP?.balance ? <p>{profile.tokens.cCNTP.balance}</p> : <Skeleton width="127px" height="43px" />}
            <p>CNTP</p>
          </div>
          <p className="connection">Your connection is <span>protected!</span></p>

          <BlobWrapper>
            <button
              className="power"
              onClick={handleTogglePower}
            >
              <img src="/assets/power.png" className="power-icon" alt="" />
            </button>
          </BlobWrapper>

          
        </>
      )

    return (
      <>
	  <div className="current-mined">
          {profile?.tokens?.cCNTP?.balance ? <p>{profile.tokens.cCNTP.balance}</p> : <Skeleton width="127px" height="43px" />}
          <p>CNTP</p>
        </div>
        <p className="connection">Your connection is not protected!</p>

        <BlobWrapper>
          <button
            className="power"
            onClick={handleTogglePower}
          >
            <img src="/assets/not-power.png" className="power-icon" alt="" />
          </button>
        </BlobWrapper>

        
      </>
    )
  }

  const renderRegionSelector = () => {
    if (isConnectionLoading) return;

    return (
      <div className="rs-wrapper">
		
        {/* {
          !power && <p>Connect via Auto-Select or pick your region</p>
        } */}
        <div className="region-selector">
          {
            !power && (
              <div>
                <button
                  className="auto-btn"
                  onClick={() => {
                    if (sRegion === -1)
                      setSRegion(Math.floor(Math.random() * allRegions.length));
                  }}
                >
                  {sRegion === -1 ? (
                    <>
                      <img src="/assets/auto.png" width={24} height={24} alt="" />
                      Auto Select
                    </>
                  ) : (
                    <>
                      <ReactCountryFlag
                        countryCode={allRegions[sRegion].code}
                        svg
                        aria-label={allRegions[sRegion].country}
                        style={{
                          fontSize: "2em",
                          lineHeight: "2em",
                        }}
                      />
                      {allRegions[sRegion].country}
                    </>
                  )}
                </button>
                {/* <p className="home-location">Selected Location</p> */}
              </div>
            )
          }

          {
            power
              ? isRandom
                ? (
                  <div className="auto-rs-power">
                    <div>
                      <p>Auto Select</p>
                      <p>{allRegions[sRegion].country}</p>
                    </div>
                    <img src="/assets/auto.png" width={48} height={48} alt="" />
                  </div>
                ) : (
                  <div>
                    <ReactCountryFlag
                      countryCode={allRegions[sRegion].code}
                      svg
                      aria-label="United States"
                      style={{
                        fontSize: "2em",
                        lineHeight: "2em",
                        marginRight: ".5em",
                      }}
                    />
                    {allRegions[sRegion].country}
                  </div>
                )
              : (
                <button className="region-btn" onClick={() => navigate("/regions")}>
                  <div>
                    <img src="/assets/global.png" width={22} height={22} alt="" />
                    <p>Select Region</p>
                  </div>
                  <img src="/assets/right.png" width={4} height={8} alt="" />
                </button>
              )
          }
        </div>
      </div>
    )
  }


  const copyPort = () => {
	navigator.clipboard.writeText("8888")
	setIsPortCopied(true);

    setTimeout(() => {
		setIsPortCopied(false);
    }, 2000);
  }

  const copyServer = () => {
	navigator.clipboard.writeText("127.0.0.1")
	setIsServerCopied(true);

    setTimeout(() => {
		setIsServerCopied(false);
    }, 2000);
  }

  const copyPAC = () => {
	navigator.clipboard.writeText("http://127.0.0.1:8888/pac")
	setIsPACCopied(true);

    setTimeout(() => {
		setIsPACCopied(false);
    }, 2000);
  }

  const proxyInfo = () => {
	return (
		<>
			<div className="wallet-info-container">
				<div className="wallet-info">
					<p>Proxy Server:</p>
					<button onClick={copyServer}>
						<p>127.0.0.1</p>
						{isServerCopied ? (
							<img src="/assets/check.svg" alt="Copy icon" />
						) : (
							<img src="/assets/copy-purple.svg" alt="Copy icon" />
						)}
					</button>
				</div>
				<div className="wallet-info">
					<p>Proxy Port:</p>
					<button onClick={copyPort}>
						<p>8888</p>
						{isPortCopied ? (
							<img src="/assets/check.svg" alt="Copy icon" />
						) : (
							<img src="/assets/copy-purple.svg" alt="Copy icon" />
						)}
					</button>
				</div>
				<div className="wallet-info">
					<p>PAC:</p>
					<button onClick={copyPAC}>
						<p>http://127.0.0.1:8888/pac</p>
						{isPACCopied ? (
							<img src="/assets/check.svg" alt="Copy icon" />
						) : (
							<img src="/assets/copy-purple.svg" alt="Copy icon" />
						)}
					</button>
					
				</div>
			</div>
		</>
	)
  }

  const copyWallet = () => {
    navigator.clipboard.writeText(profile.keyID);

    setIsWalletCopied(true);

    setTimeout(() => {
      setIsWalletCopied(false);
    }, 2000);
  }

  const copyPrivateKey = () => {
    navigator.clipboard.writeText(profile.privateKeyArmor);

    setIsPrivateKeyCopied(true);

    setTimeout(() => {
      setIsPrivateKeyCopied(false);
    }, 2000);
  }

  return (
    <>
      <div className="header">
        <div className="header-content">
          <div className="menu-icon" onClick={toggleMenu}>
            <img src="/assets/menu.svg"></img>
          </div>

          <div>
            <img src="/assets/header-title.svg"></img>
          </div>

          <div style={{ visibility: 'hidden' }}>
            lang
          </div>
        </div>
      </div>

      <Menu isMenuVisible={isMenuVisible} toggleMenu={toggleMenu} />

      <div className="home">
        <MiningStatus />

        {isInitialLoading ? (
          <>
            <button
              className="power"
            >
              <img className="loading-spinning" src="/assets/silent-pass-logo-grey.png" width={85} height={85} alt="" />
            </button>
			<p className="not-connected">
			Initializing {initPercentage}%
			</p>
            <p className="not-connected">Welcome to Silent Pass</p>
          </>
        ) : (
          <>
            {renderButton()}
			{power && proxyInfo()}
            {renderRegionSelector()}

            <div className="wallet-info-container">
              <div className="wallet-info">
                <p>Current Wallet</p>
                {
                  profile?.keyID ? (
                    <button onClick={copyWallet}>
                      <p>{profile?.keyID.slice(0, 4)}...{profile?.keyID.slice(-4)}</p>
                      {
                        isWalletCopied ? (
                          <img src="/assets/check.svg" alt="Copy icon" />
                        ) : (
                          <img src="/assets/copy-purple.svg" alt="Copy icon" />
                        )
                      }
                    </button>
                  ) : (
                    <Skeleton width="100px" height="24px" />
                  )
                }
              </div>

              <div className="wallet-info">
                <p>Private Key</p>
                {
                  profile?.privateKeyArmor ? (
                    <button onClick={copyPrivateKey}>
                      <p>{profile?.privateKeyArmor.slice(0, 4)}...{profile?.privateKeyArmor.slice(-4)}</p>
                      {
                        isPrivateKeyCopied ? (
                          <img src="/assets/check.svg" alt="Copy icon" />
                        ) : (
                          <img src="/assets/copy-purple.svg" alt="Copy icon" />
                        )
                      }
                    </button>
                  ) : (
                    <Skeleton width="100px" height="24px" />
                  )
                }
              </div>
            </div>
          </>
        )}

        <button className="vip-button" onClick={() => navigate("/vip")} style={{width: "80%"}}>
          VIP Service
        </button>
      </div>

      <div className="footer">
        <div className="footer-content">
          © {new Date().getFullYear()} CoNET.network. All rights reserved
        </div>
      </div>
    </>
  );
};

export default Home;
