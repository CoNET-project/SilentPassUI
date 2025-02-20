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
  isPassportInfoOpen: boolean
  setIsPassportInfoOpen: (val: boolean) => void
  activePassportUpdated: boolean
  setActivePassportUpdated: (val: boolean) => void
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
  isPassportInfoOpen: false,
  setIsPassportInfoOpen: () => { },
  activePassportUpdated: false,
  setActivePassportUpdated: () => { }
};

const Daemon = createContext<DaemonContext>(defaultContextValue);

export function useDaemonContext() {
  const context = useContext(Daemon);
  return context;
}

export function DaemonProvider({ children }: DaemonProps) {
  const [power, setPower] = useState<boolean>(false);
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
  const [isPassportInfoOpen, setIsPassportInfoOpen] = useState<boolean>(false);
  const [activePassportUpdated, setActivePassportUpdated] = useState<boolean>(false);

  useEffect(() => {
    {
      const pac = `http://${serverIpAddress}:${serverPort}/pac`
      setServerPac(pac)
    }
  }, [serverIpAddress, serverPort])


  return (
    <Daemon.Provider value={{ power, setPower, sRegion, setSRegion, allRegions, setAllRegions, closestRegion, setClosestRegion, isRandom, setIsRandom, miningData, setMiningData, profiles, setProfiles, isMiningUp, setIsMiningUp, getAllNodes, setaAllNodes, serverIpAddress, setServerIpAddress, serverPort, setServerPort, serverPac, setServerPac, _vpnTimeUsedInMin, isPassportInfoOpen, setIsPassportInfoOpen, activePassportUpdated, setActivePassportUpdated }}>
      {children}
    </Daemon.Provider>
  );
}
