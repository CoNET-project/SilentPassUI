import React, { createContext, useContext, ReactNode, useState } from "react";

type DaemonContext = {
  sRegion: number;
  setSRegion: (region: number) => void;
  allRegions: Region[];
  setAllRegions: (regions: Region[]) => void;
  closestRegion: any;
  setClosestRegion: (region: ClosestRegion) => void;
  isRandom: boolean;
  setIsRandom: (val: boolean) => void;
  miningData: any;
  setMiningData: (data: any) => void;
  profile: any;
  setProfile: (profile: any) => void;
  isMiningUp: boolean;
  setIsMiningUp: (val: boolean) => void;
  setaAllNodes: (data: nodes_info[]) => void
  getAllNodes: nodes_info[]
};

type DaemonProps = {
  children: ReactNode;
};

const defaultContextValue: DaemonContext = {
  sRegion: -1,
  setSRegion: () => { },
  allRegions: [],
  setAllRegions: () => { },
  closestRegion: null,
  setClosestRegion: () => { },
  isRandom: true,
  setIsRandom: () => { },
  miningData: null,
  setMiningData: () => { },
  profile: null,
  setProfile: () => { },
  isMiningUp: false,
  setIsMiningUp: () => { },
  setaAllNodes: () => {},
  getAllNodes: []
};

const Daemon = createContext<DaemonContext>(defaultContextValue);

export function useDaemonContext() {
  const context = useContext(Daemon);
  return context;
}

export function DaemonProvider({ children }: DaemonProps) {
  const [isRandom, setIsRandom] = useState<boolean>(true);
  const [sRegion, setSRegion] = useState<number>(-1);
  const [allRegions, setAllRegions] = useState<Region[]>([]);
  const [closestRegion, setClosestRegion] = useState<any>(null);
  const [miningData, setMiningData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isMiningUp, setIsMiningUp] = useState<boolean>(false);
  const [getAllNodes, setaAllNodes] = useState<nodes_info[]>([]);

  return (
    <Daemon.Provider value={{ sRegion, setSRegion, allRegions, setAllRegions, closestRegion, setClosestRegion, isRandom, setIsRandom, miningData, setMiningData, profile, setProfile, isMiningUp, setIsMiningUp, getAllNodes, setaAllNodes }}>
      {children}
    </Daemon.Provider>
  );
}
