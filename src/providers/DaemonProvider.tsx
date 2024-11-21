import React, { createContext, useContext, ReactNode, useState } from "react";

type DaemonContext = {
  sRegion: number;
  setSRegion: (region: number) => void;
  allRegions: Region[];
  setAllRegions: (regions: Region[]) => void;
};

type DaemonProps = {
  children: ReactNode;
};

const defaultContextValue: DaemonContext = {
  sRegion: -1,
  setSRegion: () => { },
  allRegions: [],
  setAllRegions: () => { },
};

const Daemon = createContext<DaemonContext>(defaultContextValue);

export function useDaemonContext() {
  const context = useContext(Daemon);
  return context;
}

export function DaemonProvider({ children }: DaemonProps) {
  const [sRegion, setSRegion] = useState<number>(-1);
  const [allRegions, setAllRegions] = useState<Region[]>([]);

  return (
    <Daemon.Provider value={{ sRegion, setSRegion, allRegions, setAllRegions }}>
      {children}
    </Daemon.Provider>
  );
}
