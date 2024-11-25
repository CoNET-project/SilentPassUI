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

const Home = () => {
  const { sRegion, setSRegion, setAllRegions, allRegions } = useDaemonContext();
  const [serverIpAddress, setServerIpAddress] = useState<string>('')
  const [power, setPower] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isConnectionLoading, setIsConnectionLoading] = useState<boolean>(false)
  const [isMenuVisible, setIsMenuVisible] = useState<boolean>(false)
  const [isWalletCopied, setIsWalletCopied] = useState<boolean>(false);
  const [isAutoSelect, setIsAutoSelect] = useState<boolean>(false);

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
          <p className="connection">Your connection is <span>protected!</span></p >

          <BlobWrapper>
            <button
              className="power"
              onClick={handleTogglePower}
            >
              <img src="/assets/power.png" width={85} height={85} alt="" />
            </button>
          </BlobWrapper>

          <div className="current-mined">
            <p>1.00456</p>
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
            <img src="/assets/not-power.png" width={85} height={85} alt="" />
          </button>
        </BlobWrapper>

        <div className="current-mined">
          <p>1.00456</p>
          <p>CNTP</p>
        </div>
      </>
    )
  }

  const renderRegionSelector = () => {
    if (isConnectionLoading) return

    return (
      <div className="rs-wrapper">
        <p>Connect via Auto-Select or pick your region</p>
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
                        aria-label="United States"
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
            power ? (
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
            ) : (
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
    navigator.clipboard.writeText("S");

    setIsWalletCopied(true);

    setTimeout(() => {
      setIsWalletCopied(false);
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
            <div className="current-wallet">
              <p>Current Wallet</p>
              <button onClick={copyWallet}>
                <p>0x412FJK...B3AB46</p>
                {
                  isWalletCopied ? (
                    <img src="/assets/check.svg" alt="Copy icon" />
                  ) : (
                    <img src="/assets/copy.svg" alt="Copy icon" />
                  )
                }
              </button>
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
