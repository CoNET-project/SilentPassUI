import { useState } from 'react';
import ClickableItem from '../ClickableItem';

import proxyInfoIcon from "./assets/proxy-information.svg";
import Separator from '../Separator';
import Skeleton from '../Skeleton';

import './index.css';

export default function ProxyInfo() {
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isProxyServerCopied, setIsProxyServerCopied] = useState<boolean>(false);
  const [isProxyPortCopied, setIsProxyPortCopied] = useState<boolean>(false);
  const [isPACCopied, setIsPACCopied] = useState<boolean>(false);

  const handleCopy = (text:string, setMethod: (val: boolean) => any) => {
    navigator.clipboard.writeText(text);

    setMethod(true);

    setTimeout(() => {
      setMethod(false);
    }, 2000);
  }

  return (
    <div className="option-group">
      <h3>Proxy</h3>
      <div className={`option-wrapper ${isDropdownOpen ? 'open' : ''}`}>
        <ClickableItem title="Proxy Information" icon={proxyInfoIcon} action={() => setIsDropdownOpen((prev) => !prev)} toggle={isDropdownOpen}></ClickableItem>
        <Separator />
        <ClickableItem title="Proxy server:" chevron={false}>
          {
            true ? (
              <button onClick={() => handleCopy("127.0.0.1", setIsProxyServerCopied)}>
                <p>127.0.0.1</p>
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
        </ClickableItem>
        <Separator />
        <ClickableItem title="Proxy Port:" chevron={false}>
          {
            true ? (
              <button onClick={() => handleCopy("8888", setIsProxyPortCopied)}>
                <p>8888</p>
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
        </ClickableItem>
        <Separator />
        <ClickableItem title="PAC:" chevron={false}>
          {
            true ? (
              <button onClick={() => handleCopy("http://127.0.0.1:8888/pac", setIsPACCopied)}>
                <p>http://127.0.0.1:8888/pac</p>
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
        </ClickableItem>
      </div>
    </div>
  )
}