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
    }, [])



    return (
        <div className={styles.home}>
           
        </div>
    );
};

export default Home;