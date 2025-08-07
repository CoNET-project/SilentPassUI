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
import { CSSTransition, SwitchTransition } from 'react-transition-group';
import QuickLinks from "@/components/QuickLinks/QuickLinks";

const Home = ({}) => {
    const { t, i18n } = useTranslation();
    const { power, setPower, profiles, sRegion, setSRegion, setAllRegions, allRegions, setIsRandom, getAllNodes, closestRegion, _vpnTimeUsedInMin,switchValue, isLocalProxy, setAirdropProcess, setAirdropSuccess, setAirdropTokens, setAirdropProcessReff, isIOS, version, isInitialLoading, setIsInitialLoading} = useDaemonContext();
    const vpnTimeTimeout = useRef<NodeJS.Timeout>();
    const initPercentageRef=useRef(0);
	const [globalCount, setGlobalCount] = useState(2)
    let first = 0;

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
        const _initpercentage = maxNodes ? currentScanNodeNumber * 100 / (maxNodes+200) : 0;
        const _status = Math.round(_initpercentage);
        const status = _status <= first ? first + 2 : _status;
        first = status;
		setGlobalCount(status)

        if (status > 100) {
            initPercentageRef.current=98;
        } else {
            initPercentageRef.current=status;
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
            <SwitchTransition mode="out-in">
                <CSSTransition
                    key={isInitialLoading ? 'init' : 'content'}
                    timeout={200}
                    classNames={{
                        enter: styles.fadeEnter,
                        enterActive: styles.fadeEnterActive,
                        exit: styles.fadeExit,
                        exitActive: styles.fadeExitActive,
                    }}
                    unmountOnExit
                >
                    <div className={styles.bd}>
                        {isInitialLoading?<>
                            <InitModule initPercentage={globalCount} />
                        </>:<>
                            <Content />
                        </>}
                    </div>
                </CSSTransition>
            </SwitchTransition>
            {!isInitialLoading?<QuickLinks />:''}
        </div>
    );
};

export default Home;