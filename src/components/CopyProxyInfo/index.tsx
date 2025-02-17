import { useState } from 'react';
import Skeleton from '../Skeleton';

import { ReactComponent as ChevronArrow } from "./assets/right-chevron.svg";
import { PROXY_PAC, PROXY_PORT, PROXY_SERVER } from '../../utils/constants';

type CopyProxyInfoProps = {

}

export default function CopyProxyInfo({ }: CopyProxyInfoProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isProxyServerCopied, setIsProxyServerCopied] = useState<boolean>(false);
  const [isProxyPortCopied, setIsProxyPortCopied] = useState<boolean>(false);
  const [isPACCopied, setIsPACCopied] = useState<boolean>(false);

  const handleCopy = (text: string, setMethod: (val: boolean) => any) => {
    navigator.clipboard.writeText(text);

    setMethod(true);

    setTimeout(() => {
      setMethod(false);
    }, 2000);
  }

  return (
    <div className={`wallet-info-container ${isOpen ? 'open' : ''}`}>
      <div className="wallet-info-heading" onClick={() => setIsOpen((prev) => !prev)}>
        <p>Proxy Information</p>
        <ChevronArrow />
      </div>
      <hr />
      <div className="wallet-info">
        <p>Proxy server:</p>
        {
          true ? (
            <button onClick={() => handleCopy(PROXY_SERVER, setIsProxyServerCopied)}>
              <p>{PROXY_SERVER}</p>
              {
                isProxyServerCopied ? (
                  <img src="/assets/check.svg" alt="Copy icon" />
                ) : (
                  <img src="/assets/copy-purple.svg" alt="Copy icon" />
                )
              }
            </button>
          ) : (
            <Skeleton width="100px" height="24px" />
          )
        }
      </div>

      <div className="wallet-info">
        <p>Proxy port:</p>
        {
          true ? (
            <button onClick={() => handleCopy(PROXY_PORT, setIsProxyPortCopied)}>
              <p>{PROXY_PORT}</p>
              {
                isProxyPortCopied ? (
                  <img src="/assets/check.svg" alt="Copy icon" />
                ) : (
                  <img src="/assets/copy-purple.svg" alt="Copy icon" />
                )
              }
            </button>
          ) : (
            <Skeleton width="100px" height="24px" />
          )
        }
      </div>

      <div className="wallet-info">
        <p>PAC:</p>
        {
          true ? (
            <button onClick={() => handleCopy(PROXY_PAC, setIsPACCopied)}>
              <p>{PROXY_PAC}</p>
              {
                isPACCopied ? (
                  <img src="/assets/check.svg" alt="Copy icon" />
                ) : (
                  <img src="/assets/copy-purple.svg" alt="Copy icon" />
                )
              }
            </button>
          ) : (
            <Skeleton width="100px" height="24px" />
          )
        }
      </div>
    </div>
  )
}