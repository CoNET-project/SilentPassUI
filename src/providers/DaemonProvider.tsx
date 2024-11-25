import React, { createContext, useContext, ReactNode, useState } from "react";

type DaemonContext = {
  sRegion: number;
  setSRegion: (region: number) => void;
  allRegions: Region[];
  setAllRegions: (regions: Region[]) => void;
  isRandom: boolean;
  setIsRandom: (val: boolean) => void;
  miningData: any;
  setMiningData: (data: any) => void;
  profile: any;
  setProfile: (profile: any) => void;
  isMiningUp: boolean;
  setIsMiningUp: (val: boolean) => void;
};

type DaemonProps = {
  children: ReactNode;
};

const defaultContextValue: DaemonContext = {
  sRegion: -1,
  setSRegion: () => { },
  allRegions: [],
  setAllRegions: () => { },
  isRandom: true,
  setIsRandom: () => { },
  miningData: null,
  setMiningData: () => { },
  profile: null,
  setProfile: () => { },
  isMiningUp: false,
  setIsMiningUp: () => { },
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
  const [miningData, setMiningData] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isMiningUp, setIsMiningUp] = useState<boolean>(false);

  return (
    <Daemon.Provider value={{ sRegion, setSRegion, allRegions, setAllRegions, isRandom, setIsRandom, miningData, setMiningData, profile, setProfile, isMiningUp, setIsMiningUp }}>
      {children}
    </Daemon.Provider>
  );
}
