import { ReactNode } from 'react'
import Blob from '../Blob';
import "./index.css";

type BlobWrapperProps = {
  children: ReactNode;
}

export default function BlobWrapper({ children }: BlobWrapperProps) {
  return (
    <div className="blob-wrapper">
      <Blob
        color="#0d111a"
        style={{ width: "220%", opacity: .8, position: "absolute", top: "50%", left: 0, transform: "translate(-18%, -40%)" }}
      />
      <Blob
        color="#07080C"
        style={{ width: "180%", position: "absolute", top: "50%", left: 0, transform: "translate(-12%, -40%)" }}
      />
      {children}
    </div>
  )
}