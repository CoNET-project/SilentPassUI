import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@/components/Home/home.module.scss';
import Header from '@/components/Home/Header/Header';
import InitModule from '@/components/Home/InitModule/InitModule';
import Content from '@/components/Home/Content/Content';
import { useDaemonContext } from "@/providers/DaemonProvider";
import { getAllRegions } from "@/services/regions";
import { maxNodes, currentScanNodeNumber } from '@/services/mining';
import { mappedCountryCodes } from "@/utils/regions"; 

const Home = ({}) => {
    const { t, i18n } = useTranslation();
    const { power, setPower, profiles, sRegion, setSRegion, setAllRegions, allRegions, setIsRandom, getAllNodes, closestRegion, _vpnTimeUsedInMin,switchValue, isLocalProxy, setAirdropProcess, setAirdropSuccess, setAirdropTokens, setAirdropProcessReff, isIOS, version, isInitialLoading, setIsInitialLoading} = useDaemonContext();
    const [initPercentage, setInitPercentage] = useState<number>(0);
    const vpnTimeTimeout = useRef<NodeJS.Timeout>();

    useEffect(() => {
        if (!closestRegion?.length) {
            return
        }
        setIsInitialLoading(false);
    }, [closestRegion])

    useEffect(() => {
        _getAllRegions();
        listenGetAllNodes();
    }, [])

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


    const listenGetAllNodes = () => {
        let first = 0;
        const _initpercentage = maxNodes ? currentScanNodeNumber * 100 / (maxNodes+200) : 0;
        const _status = Math.round(_initpercentage);
        const status = _status <= first ? first + 2 : _status;
        first = status;
        if (status > 100) {
            setInitPercentage(98);
        } else {
            setInitPercentage(status);
        }
        if (status < 99 ) {
            return setTimeout(() => {
                listenGetAllNodes()
            }, 1000)
        }
    }
    const _getAllRegions = async () => {
        const [tmpRegions] = await Promise.all([getAllRegions()]);
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
    }


    return (
        <div className={styles.home}>
            <Header />
            <div className={styles.bd}>
                {isInitialLoading?<>
                    <InitModule initPercentage={initPercentage} setInitPercentage={setInitPercentage} />
                </>:<>
                    <Content />
                </>}
            </div>
        </div>
    );
};

export default Home;