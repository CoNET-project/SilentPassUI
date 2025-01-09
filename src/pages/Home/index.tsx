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
import { getEntryNodes, testClosestRegion } from '../../services/mining';
import { CoNET_Data } from '../../utils/globals';

const Home = () => {
  const { profile, sRegion, setSRegion, setAllRegions, allRegions, isRandom, setIsRandom } = useDaemonContext();
  const [power, setPower] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isConnectionLoading, setIsConnectionLoading] = useState<boolean>(false)
  const [isMenuVisible, setIsMenuVisible] = useState<boolean>(false)
  const [isWalletCopied, setIsWalletCopied] = useState<boolean>(false);
  const [isPrivateKeyCopied, setIsPrivateKeyCopied] = useState<boolean>(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (allRegions && allRegions.length > 0) {
      setIsInitialLoading(false);
      return;
    }

    const _getAllRegions = async () => {
      const tmpRegions = await getAllRegions();

      const treatedRegions = Array.from(new Set(tmpRegions.map((region: string) => {
        const separatedRegion = region.split(".");
        const code = separatedRegion[1];
        const country = mappedCountryCodes[code];

        return JSON.stringify({ code, country }); // Convert the object to a string for Set comparison
      }))).map((regionStr: any) => JSON.parse(regionStr)); // Convert the string back to an object

      const unitedStatesIndex = treatedRegions.findIndex((region: any) => region.code === 'US')
      setSRegion(unitedStatesIndex)
      setIsRandom(false);

      setAllRegions(treatedRegions);
    };

    _getAllRegions()

    setTimeout(() => setIsInitialLoading(false), 3000);
  }, [allRegions, setAllRegions]);

  const toggleMenu = () => {
    setIsMenuVisible(prevState => !prevState);
  }

  const handleTogglePower = async () => {
    let selectedCountryIndex = -1

    if (power) {
      setPower(false);
      window?.webkit?.messageHandlers["stopVPN"].postMessage(null)
      return
    }

    try {
      setIsConnectionLoading(true)
      if (sRegion === -1) {
        selectedCountryIndex = Math.floor(Math.random() * allRegions.length)
        setSRegion(selectedCountryIndex);
      } else {
        selectedCountryIndex = sRegion
      }

      const selectedCountryCode = allRegions[selectedCountryIndex].code

      const nodeList = await getEntryNodes();

      const closestRegion = await testClosestRegion(allRegions);

      const nodeListFilteredByClosestRegion = nodeList!.filter((n) => n.region === closestRegion.node.region)
      const nodeListFilteredBySelectedRegion = nodeList!.filter((n) => n.region.endsWith(selectedCountryCode));

      const randomNodeIndex = Math.floor(Math.random() * nodeListFilteredBySelectedRegion!.length);

      const exitNode = nodeListFilteredBySelectedRegion?.[randomNodeIndex];

      let entryNodes: any[] = [];

      if (nodeListFilteredByClosestRegion.length < 5) {
        entryNodes = nodeListFilteredByClosestRegion;
      } else {
        do {
          const randomNodeIndex = Math.floor(Math.random() * nodeListFilteredByClosestRegion!.length)
          const choosenNode = nodeListFilteredByClosestRegion[randomNodeIndex];

          if (!!entryNodes.find((item: any) => item.ip_addr === choosenNode.ip_addr)) continue;

          entryNodes.push(choosenNode)
        } while (entryNodes.length < 5);
      }

      const conetProfile = CoNET_Data?.profiles[1];

      const startVPNMessageObject = {
        entryNodes,
        exitNode,
        privateKey: conetProfile?.privateKeyArmor,
      }

      const stringifiedVPNMessageObject = JSON.stringify(startVPNMessageObject);

      const base64VPNMessage = btoa(stringifiedVPNMessageObject);

      window?.webkit?.messageHandlers["startVPN"].postMessage(base64VPNMessage)

      // startVpnMining()

      setTimeout(() => {
        setIsConnectionLoading(false)
        setPower(true);
      }, 5000)
      return
    } catch (error) {
      setPower(false);
    }
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
              <img src="/assets/loading-ring.png" className="loading-spinning" width={85} height={85} alt="" />
            </button>
          </BlobWrapper>

          <p className="connected">Loading...</p>
        </>
      )

    if (power)
      return (
        <>
          <p className="connection">Your connection is <span>protected!</span></p>

          <BlobWrapper>
            <button
              className="power"
              onClick={handleTogglePower}
            >
              <img src="/assets/power.png" width={85} height={85} alt="" />
            </button>
          </BlobWrapper>

          <div className="current-mined">
            {profile?.tokens?.cCNTP?.balance ? <p>{profile.tokens.cCNTP.balance}</p> : <Skeleton width="127px" height="43px" />}
            <p>CNTP</p>
          </div>
        </>
      )

    return (
      <>
        <p className="connection">Your connection is not protected!</p>

        <BlobWrapper>
          <button
            className="power"
            onClick={handleTogglePower}
          >
            <img src="/assets/not-power.png" width={65} height={65} alt="" />
          </button>
        </BlobWrapper>

        <div className="current-mined">
          {profile?.tokens?.cCNTP?.balance ? <p>{profile.tokens.cCNTP.balance}</p> : <Skeleton width="127px" height="43px" />}
          <p>CNTP</p>
        </div>
      </>
    )
  }

  const renderRegionSelector = () => {
    if (isConnectionLoading) return;

    return (
      <div className="rs-wrapper">
        {
          !power && <p>Connect via Auto-Select or pick your region</p>
        }
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
                <p className="home-location">Selected Location</p>
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

            <p className="not-connected">Welcome to Silent Pass</p>
          </>
        ) : (
          <>
            {renderButton()}
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
      </div >

      <div className="footer">
        <div className="footer-content">
          © {new Date().getFullYear()} CoNET.network. All rights reserved
        </div>
      </div>
    </>
  );
};

export default Home;
