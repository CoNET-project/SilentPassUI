import { useState } from 'react';
import Footer from '../../components/Footer';

import { ReactComponent as VisibilityOnIcon } from "./assets/visibility-on.svg";
import { ReactComponent as VisibilityOffIcon } from "./assets/visibility-off.svg";

import './index.css';

type NFT = {
  id: string;
  redeemCode: string;
};

type NFTCategory = "monthly" | "yearly";
type NFTFilter = "all" | "used" | "notUsed";

const nftData: Record<NFTCategory, { used: NFT[]; notUsed: NFT[] }> = {
  monthly: {
    used: [
      { id: "NFT-001", redeemCode: "NFT-USED-001" },
      { id: "NFT-002", redeemCode: "NFT-USED-002" },
      { id: "NFT-003", redeemCode: "NFT-USED-003" },
    ],
    notUsed: [
      { id: "NFT-004", redeemCode: "NFT-UNUSED-004" },
      { id: "NFT-005", redeemCode: "NFT-UNUSED-005" },
      { id: "NFT-006", redeemCode: "NFT-UNUSED-006" },
    ],
  },
  yearly: {
    used: [
      { id: "NFT-007", redeemCode: "NFT-USED-007" },
      { id: "NFT-008", redeemCode: "NFT-USED-008" },
      { id: "NFT-009", redeemCode: "NFT-USED-009" },
    ],
    notUsed: [
      { id: "NFT-010", redeemCode: "NFT-UNUSED-010" },
      { id: "NFT-011", redeemCode: "NFT-UNUSED-011" },
      { id: "NFT-012", redeemCode: "NFT-UNUSED-012" },
    ],
  },
};

export default function Management() {
  const [category, setCategory] = useState<NFTCategory>("monthly");
  const [filter, setFilter] = useState<NFTFilter>("all");
  const [generateQuantity, setGenerateQuantity] = useState<number>(5);

  const initialHiddenCodes = Object.fromEntries(
    Object.values(nftData).flatMap((cat) =>
      Object.values(cat).flatMap((nfts) => nfts.map((nft) => [nft.id, true]))
    )
  );
  const [hiddenCodes, setHiddenCodes] = useState<Record<string, boolean>>(initialHiddenCodes);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  const getFilteredNFTs = (): NFT[] => {
    if (filter === "all") {
      return [...nftData[category].used, ...nftData[category].notUsed];
    }
    return nftData[category][filter];
  };

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedStates((prev) => ({ ...prev, [id]: true }));

    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const toggleVisibility = (id: string) => {
    setHiddenCodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="page-container">
      <h1>Management</h1>

      <div className="sub-heading">
        <h2>Your assets</h2>

        <button className="generate-btn">
          Generate {generateQuantity} codes
        </button>
      </div>

      <div className="main-content-wrapper">
        <div className="category-switch">
          <button
            className={category === "monthly" ? "active" : ""}
            onClick={() => setCategory("monthly")}
          >
            Monthly
          </button>
          <button
            className={category === "yearly" ? "active" : ""}
            onClick={() => setCategory("yearly")}
          >
            Yearly
          </button>
        </div>

        <div className="filters">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            className={filter === "used" ? "active" : ""}
            onClick={() => setFilter("used")}
          >
            Used
          </button>
          <button
            className={filter === "notUsed" ? "active" : ""}
            onClick={() => setFilter("notUsed")}
          >
            Not Used
          </button>
        </div>

        <div className="quantity-selector">
          <p>Select quantity</p>
          <div>
            <button
              onClick={() => setGenerateQuantity((prev) => Math.max(1, prev - 1))}
            >
              -
            </button>
            <span>{generateQuantity}</span>
            <button onClick={() => setGenerateQuantity((prev) => prev + 1)}>+</button>
          </div>
        </div>

        <div className="nft-list">
          {getFilteredNFTs().map((nft) => (
            <div key={nft.id} className="nft-item">
              <div className="nft-info">
                <p className="nft-id">{nft.id}</p>
                <p className="redeem-text">Redeem code</p>
                {hiddenCodes[nft.id] ? "••••••••••••••••" : nft.redeemCode}
              </div>
              <div className="nft-actions">
              <button
                className="icon-btn"
                onClick={() => copyCode(nft.id, nft.redeemCode)}
              >
                {copiedStates[nft.id] ? <img src="/assets/check.svg" alt="Copy icon" /> : <img src="/assets/copy-purple.svg" alt="Copy icon" />}
              </button>
                <button className={`icon-btn ${hiddenCodes[nft.id] && 'hidden'}`} onClick={() => toggleVisibility(nft.id)}>
                  {hiddenCodes[nft.id] ? <VisibilityOffIcon /> : <VisibilityOnIcon />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}