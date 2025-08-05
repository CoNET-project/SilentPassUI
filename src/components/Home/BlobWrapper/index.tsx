import { ReactNode } from 'react'
import Blob from '../Blob';
import "./index.css";

type BlobWrapperProps = {
  state: 'off' | 'connecting' | 'on';
  children: ReactNode;
};

export default function BlobWrapper({ state, children}: BlobWrapperProps) {
  return (
    <div className={`blob-wrapper ${state}`}>
      <Blob className={"blob blob--back" }
              color="#0d111a"
        style={{}}/>
      <Blob className={"blob blob--front"} 
              color="#07080C"
        style={{}}/>
      {children}
    </div>
  );
}