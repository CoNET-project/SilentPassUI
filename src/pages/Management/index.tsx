import { useState, useEffect } from 'react';
import Footer from '../../components/Footer';

import { ReactComponent as VisibilityOnIcon } from "./assets/visibility-on.svg";
import { ReactComponent as VisibilityOffIcon } from "./assets/visibility-off.svg";
import {NFTsProcess, getNFTs, distributorNFTItem, distributorNFTObj } from '../../services/wallets'
import './index.css';
import NFT_item from './NFT_item'
type NFT = {
  id: string;
  redeemCode: string;
};

type NFTCategory = "monthly" | "yearly";
type NFTFilter = "all" | "used" | "no Redeem";

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
  const [isGetNFTs, setisGetNFTs] = useState(false);
  const [isReflashNFTs, setisReflashNFTs] = useState(false);
  const [allNFTs, setAllNFTs] = useState<distributorNFTObj|null>(null);
  const [showRedeemProcess, setShowRedeemProcess] = useState<boolean[]>([])
  const [redeemProcess, setRedeemProcess] = useState<number[]>([])

  const getRedeemCode = async () => {
	const items = getFilteredNFTsV2()
	let currentItem = items[0]
	if (redeemProcess.length > 0) {
		const currentID = redeemProcess[redeemProcess.length-1]
		const index = items.findIndex(n => n.id === currentID) + 1
		if (index >= items.length) {
			return
		}
		currentItem = items[index]
	}

	const allredeemProcess = [...redeemProcess]
	allredeemProcess.push(currentItem.id)
	setRedeemProcess(allredeemProcess)
	setTimeout(() => {
		const allredeemProcess1 = [...redeemProcess]
		const indexAll = allredeemProcess1.findIndex(n => n === currentItem.id)
		allredeemProcess1.splice(indexAll, 1)
		setRedeemProcess(allredeemProcess1)
	}, 10000)
  }

  const initialHiddenCodes = Object.fromEntries(
    Object.values(nftData).flatMap((cat) =>
      Object.values(cat).flatMap((nfts) => nfts.map((nft) => [nft.id, true]))
    )
  );
  const [hiddenCodes, setHiddenCodes] = useState<Record<string, boolean>>(initialHiddenCodes);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  
  const makeRedeemProcess = (items:distributorNFTItem[]) => {
	
	if (!items?.length) {
		return
	}

	const redeemProcessArray: boolean[] = []

	items.forEach((n, indexItem) => {
		const index = redeemProcess.findIndex(nn => nn === n.id)
		if (index > -1) {
			redeemProcessArray.push(true)
		} else {
			redeemProcessArray.push(false)
		}

	})
	
	setShowRedeemProcess(redeemProcessArray)
  }

  useEffect(() => {
	const items = getFilteredNFTsV2()
	makeRedeemProcess(items)

  }, [category, filter, redeemProcess])

  useEffect(() => {

	getNFTs().then(nfts => {
		setAllNFTs(nfts)
	})

  }, [])

  const newNFTsProcessUI = async () => {
	if (isGetNFTs) {
		return
	}
	setisGetNFTs(true)
	await NFTsProcess()
	setisGetNFTs(false)
  }


  const renderNewNFTsButton = () => {

    if (isGetNFTs) {
      return <p className='refreshing'>new NFTs...</p>
    }

    return <p className='refresh' onClick={() => newNFTsProcessUI()}>get new NFTs</p>
  }

  const reflashNftsProcess = async () => {
	if (isReflashNFTs) {
		return
	}
	setisReflashNFTs(true)
	const result = await getNFTs ()

	setAllNFTs(result)
	setisReflashNFTs(false)
  }

  const renderReflashNFTsButton = () => {
	if (isReflashNFTs) {
		return <p className='refreshing'>Reflash NFTs...</p>
	}
  
	return <p className='refresh' onClick={() => reflashNftsProcess()}>Reflash NFTs</p>
  }


  const getFilteredNFTsV2 = (): distributorNFTItem[] => {
	if (!allNFTs || !allNFTs[category].nfts) {
		return []
	}
	if (filter === "all") {
		const ret = allNFTs[category].nfts

		return ret
	}

	if (filter === 'used') {
		const ret = allNFTs[category].nfts.filter(n => n.used)

		return ret
	}

	const ret = allNFTs[category].nfts.filter(n => !n.code)

	return ret
  }

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
	  {renderNewNFTsButton()}
	  {renderReflashNFTsButton()}
      <div className="sub-heading">
        <h3>Your NFTs</h3>
		{
			filter === 'no Redeem' && redeemProcess.length < getFilteredNFTsV2().length ?
			<button className="generate-btn" onClick={getRedeemCode}>
				Generate codes
			</button> : ''
		}
        
      </div>

      <div className="main-content-wrapper">
	  
        <div className="category-switch">
          <button
            className={category === "monthly" ? "active" : ""}
            onClick={() => {
				setCategory("monthly")
			}}
          >
            Monthly
          </button>
          <button
            className={category === "yearly" ? "active" : ""}
            onClick={() => {
				setCategory("yearly")
			}}
          >
            Yearly
          </button>
        </div>

        <div className="filters">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => {
				setFilter("all")
			}}
          >
            All
          </button>
          <button
            className={filter === "used" ? "active" : ""}
            onClick={() => {
				setFilter("used")
			}}
          >
            Used
          </button>
          <button
            className={filter === "no Redeem" ? "active" : ""}
            onClick={() => {
				setFilter('no Redeem')
			}}
          >
            no Redeem
          </button>
        </div>

        {/* <div className="quantity-selector">
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
        </div> */}

		<div className="nft-list">
		<div className="nft-item">
		<div className="nft-info">
			Total {getFilteredNFTsV2().length} NFTs
		</div>
		<div className="nft-actions">
			Pages 1 
		</div>
		</div>
			
		  {getFilteredNFTsV2().map((n, index) => (
			NFT_item(n, showRedeemProcess[index])
		  ))}
		</div>

        {/* <div className="nft-list">
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
        </div> */}
      </div>
      <Footer />
    </div>
  )
}