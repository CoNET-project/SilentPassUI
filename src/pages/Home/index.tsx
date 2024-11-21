import "./index.css";
import { mappedCountryCodes } from "../../utils/regions";
import { useEffect, useState } from "react";
import ReactCountryFlag from "react-country-flag";
import { useNavigate } from "react-router-dom";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { getAllRegions, getServerIpAddress, startSilentPass } from "../../api";

const Home = () => {
  const { sRegion, setSRegion, setAllRegions, allRegions } = useDaemonContext();
  const [serverIpAddress, setServerIpAddress] = useState<string>('')
  const [power, setPower] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isConnectionLoading, setIsConnectionLoading] = useState<boolean>(false)

  const navigate = useNavigate();

  useEffect(() => {
    const _getAllRegions = async () => {
      const response = await getAllRegions();
      const tmpRegions = response.data;

      const treatedRegions = Array.from(new Set(tmpRegions.map((region: string) => {
        const separatedRegion = region.split(".");
        const code = separatedRegion[1];
        const country = mappedCountryCodes[code];

        return JSON.stringify({ code, country }); // Convert the object to a string for Set comparison
      }))).map((regionStr: any) => JSON.parse(regionStr)); // Convert the string back to an object

      setAllRegions(treatedRegions);
    };

    const _getServerIpAddress = async () => {
      const response = await getServerIpAddress();
      const tmpIpAddress = response.data;

      setServerIpAddress(tmpIpAddress?.ip);
    };

    _getAllRegions()
    _getServerIpAddress()

    setTimeout(() => setIsInitialLoading(false), 3000);
  }, []);

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

      const selectedCountryCode = allRegions[selectedCountryIndex].code

      await startSilentPass(selectedCountryCode)
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

          <button
            className="power"
          >
            <img src="/assets/loading-ring.png" className="loading-spinning" width={85} height={85} alt="" />
          </button>

          <p className="connected">Loading...</p>
        </>
      )

    if (power)
      return (
        <>
          <p className="connection">Your connection is <span>protected!</span></p >

          <button
            className="power"
            onClick={handleTogglePower}
          >
            <img src="/assets/power.png" width={85} height={85} alt="" />
          </button>

          <p className="connected">Connected</p>
        </>
      )

    return (
      <>
        <p className="connection">Your connection is not protected!</p>

        <button
          className="power"
          onClick={handleTogglePower}
        >
          <img src="/assets/not-power.png" width={85} height={85} alt="" />
        </button>

        <p className="not-connected">Not Connected</p>
      </>
    )
  }

  const renderRegionSelector = () => {
    if (isConnectionLoading) return

    return <>
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
    </>
  }

  return (
    <>
      <div className="home">
        <div className="stats-container">
          <div>Online Miners: </div>
          <div>Online Users: </div>
        </div>

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
          </>
        )}

      </div >
      <div className="footer">
        <div className="footer-content">
          © 2024 CoNET.network. All rights reserved
        </div>
      </div>
    </>
  );
};

export default Home;
