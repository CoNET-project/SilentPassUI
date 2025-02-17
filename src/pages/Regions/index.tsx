import ReactCountryFlag from "react-country-flag";
import "./index.css";
import { useDaemonContext } from "../../providers/DaemonProvider";
import { useNavigate } from "react-router-dom";

const Region = () => {
  const { setSRegion, allRegions, setIsRandom } = useDaemonContext();
  const navigate = useNavigate();

  const handleRegion = (code: number) => {
    if (code === -1) setIsRandom(true);
    else setIsRandom(false);

    setSRegion(code);
    navigate("/");
  };

  return (
    <div className="regions">
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', cursor: 'pointer' }} onClick={() => navigate("/")}>
          <button className="back">
            <img style={{ width: "32px", height: "32px" }} src="/assets/left.svg" />
          </button>

          <h1 style={{ paddingBottom: '10px' }}>Select Region</h1>
        </div>
      </div>

      <div className="board">
        <div className="areas">
          <div style={{ display: "flex", flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
            <p className="location">Locations</p>
            <div style={{ display: "flex", flexDirection: 'column', gap: '20px', width: '80%', alignItems: 'center' }}>
              {allRegions.map((region, index) => {
                return (
                  <button style={{ margin: 0 }} onClick={() => handleRegion(index)}>
                    <div>
                      <ReactCountryFlag
                        countryCode={region.code}
                        svg
                        aria-label="United States"
                        style={{
                          fontSize: "2em",
                          lineHeight: "2em",
                        }}
                      />
                      <div className="region">
                        <p>{region.country}</p>
                      </div>
                    </div>
                    <p className="status">
                      <span></span>
                      <span></span>
                      <span></span>
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Region;
