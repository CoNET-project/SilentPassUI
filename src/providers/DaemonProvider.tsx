import React, { createContext, useContext, ReactNode, useState, useEffect, useRef } from "react";

type DaemonContext = {
  power: boolean;
  setPower: (val: boolean) => void;
  sRegion: number;
  setSRegion: (region: number) => void;
  allRegions: Region[];
  setAllRegions: (regions: Region[]) => void;
  closestRegion: nodes_info[];
  setClosestRegion: (region: nodes_info[]) => void;
  isRandom: boolean;
  setIsRandom: (val: boolean) => void;
  miningData: any;
  setMiningData: (data: any) => void;
  profiles: any;
  setProfiles: (profiles: any) => void;
  isMiningUp: boolean;
  setIsMiningUp: (val: boolean) => void;
  setaAllNodes: (data: nodes_info[]) => void
  getAllNodes: nodes_info[]
  serverIpAddress: string
  setServerIpAddress: (ip: string) => void
  serverPort: string
  setServerPort: (port: string) => void
  serverPac: string
  setServerPac: (pac: string) => void
  _vpnTimeUsedInMin: React.MutableRefObject<number>
  isPassportInfoPopupOpen: boolean
  setIsPassportInfoPopupOpen: (val: boolean) => void
  activePassportUpdated: boolean
  setActivePassportUpdated: (val: boolean) => void
  activePassport: any
  setActivePassport: (val: any) => void
  isSelectPassportPopupOpen: any
  setIsSelectPassportPopupOpen: (val: any) => void
  purchasingPlan: string
  setPurchasingPlan: (val: string) => void
  purchasingPlanPaymentTime: string
  setPurchasingPlanPaymentTime: (val: string) => void
  randomSolanaRPC: nodes_info | null
  setRandomSolanaRPC: (val: nodes_info) => void;
  isIOS: boolean
  setIsIOS: (val: boolean) => void
  isLocalProxy: boolean
  setIsLocalProxy: (val: boolean)=> void
  globalProxy: boolean,
  setGlobalProxy: (val: boolean)=> void
};

type DaemonProps = {
  children: ReactNode;
};

const defaultContextValue: DaemonContext = {
  power: false,
  setPower: () => { },
  sRegion: -1,
  setSRegion: () => { },
  allRegions: [],
  setAllRegions: () => { },
  closestRegion: [],
  setClosestRegion: () => { },
  isRandom: true,
  setIsRandom: () => { },
  miningData: null,
  setMiningData: () => { },
  profiles: null,
  setProfiles: () => { },
  isMiningUp: false,
  setIsMiningUp: () => { },
  setaAllNodes: () => { },
  getAllNodes: [],
  serverIpAddress: "127.0.0.1",
  setServerIpAddress: () => { },
  serverPort: "8888",
  setServerPort: () => { },
  serverPac: "",
  setServerPac: () => { },
  _vpnTimeUsedInMin: { current: 0 },
  isPassportInfoPopupOpen: false,
  setIsPassportInfoPopupOpen: () => { },
  activePassportUpdated: false,
  setActivePassportUpdated: () => { },
  activePassport: null,
  setActivePassport: () => { },
  isSelectPassportPopupOpen: false,
  setIsSelectPassportPopupOpen: () => { },
  purchasingPlan: "premium",
  setPurchasingPlan: () => { },
  purchasingPlanPaymentTime: "monthly",
  setPurchasingPlanPaymentTime: () => { },
  setRandomSolanaRPC: () => { },
  randomSolanaRPC: null,
  isIOS: false,
  setIsIOS: () => {},
  isLocalProxy: false,
  setIsLocalProxy(val) {},
  globalProxy: false,
  setGlobalProxy: () => {}

};

const Daemon = createContext<DaemonContext>(defaultContextValue);

export function useDaemonContext() {
  const context = useContext(Daemon);
  return context;
}

export function DaemonProvider({ children }: DaemonProps) {
  const [power, setPower] = useState<boolean>(false);
  const [globalProxy, setGlobalProxy] = useState(false)
  const [isRandom, setIsRandom] = useState<boolean>(true);
  const [sRegion, setSRegion] = useState<number>(-1);
  const [allRegions, setAllRegions] = useState<Region[]>([]);
  const [closestRegion, setClosestRegion] = useState<any>(null);
  const [miningData, setMiningData] = useState<any>(null);
  const [profiles, setProfiles] = useState<any>(null);
  const [isMiningUp, setIsMiningUp] = useState<boolean>(false);
  const [getAllNodes, setaAllNodes] = useState<nodes_info[]>([]);
  const [serverIpAddress, setServerIpAddress] = useState<string>(defaultContextValue.serverIpAddress);
  const [serverPort, setServerPort] = useState<string>(defaultContextValue.serverPort);
  const [serverPac, setServerPac] = useState<string>("");
  const _vpnTimeUsedInMin = useRef<number>(0);
  const [isPassportInfoPopupOpen, setIsPassportInfoPopupOpen] = useState<boolean>(false);
  const [isSelectPassportPopupOpen, setIsSelectPassportPopupOpen] = useState<boolean>(false);
  const [activePassportUpdated, setActivePassportUpdated] = useState<boolean>(false);
  const [activePassport, setActivePassport] = useState<any>(null);
  const [purchasingPlan, setPurchasingPlan] = useState<string>("premium");
  const [purchasingPlanPaymentTime, setPurchasingPlanPaymentTime] = useState<string>("monthly");
  const [randomSolanaRPC, setRandomSolanaRPC] = useState<nodes_info | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isLocalProxy, setIsLocalProxy] = useState(false);

  useEffect(() => {
    {
      const pac = `http://${serverIpAddress}:${serverPort}/pac`
      setServerPac(pac)
    }
  }, [serverIpAddress, serverPort])


  return (
    <Daemon.Provider value={{ power, setPower, sRegion, setSRegion, allRegions, setAllRegions, 
				closestRegion, setClosestRegion, isRandom, setIsRandom, miningData, setMiningData, 
				profiles, setProfiles, isMiningUp, setIsMiningUp, getAllNodes, setaAllNodes, serverIpAddress, 
				setServerIpAddress, serverPort, setServerPort, serverPac, setServerPac, _vpnTimeUsedInMin, 
				isPassportInfoPopupOpen, setIsPassportInfoPopupOpen, activePassportUpdated, setActivePassportUpdated, 
				activePassport, setActivePassport, isSelectPassportPopupOpen, setIsSelectPassportPopupOpen, 
				purchasingPlan, setPurchasingPlan, purchasingPlanPaymentTime, setPurchasingPlanPaymentTime, 
				setRandomSolanaRPC, randomSolanaRPC, isIOS, setIsIOS, isLocalProxy, setIsLocalProxy, globalProxy, setGlobalProxy }}>,
				
      {children}
    </Daemon.Provider>
  );
}
