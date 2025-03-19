import { useState, useEffect } from 'react';
import Footer from '../../components/Footer';

import { ReactComponent as VisibilityOnIcon } from "./assets/visibility-on.svg";
import { ReactComponent as VisibilityOffIcon } from "./assets/visibility-off.svg";
import { ReactComponent as RefreshIcon } from "./assets/refresh-icon.svg";
import { ReactComponent as ArrowIcon } from "./assets/arrow.svg";

import {NFTsProcess, getNFTs, distributorNFTItem, distributorNFTObj, redeemProcess } from '../../services/wallets'
import './index.css';

type NFTCategory = "monthly" | "yearly";
type NFTFilter = "all" | "used" | "to be used" | "no redeem";

const ITEMS_PER_PAGE = 5;


export default function Management() {
  const [category, setCategory] = useState<NFTCategory>("monthly");
  const [filter, setFilter] = useState<NFTFilter>("all");
  const [generateQuantity, setGenerateQuantity] = useState<number>(5);
  const [isGetNFTs, setisGetNFTs] = useState(false);
  const [isReflashNFTs, setisReflashNFTs] = useState(false);
  const [allNFTs, setAllNFTs] = useState<distributorNFTObj|null>(null);
  const [clickRedeem, setClickRedeem] = useState(false);
  const [redeemProcessing, setRedeemProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hiddenCodes, setHiddenCodes] = useState<Record<string, boolean>>({});
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getNFTs().then(nfts => {
      if (!nfts) return;

      setAllNFTs(nfts)
      const plainNFTIDList = [...nfts?.monthly?.nfts, ...nfts?.yearly.nfts].map((nft) => nft.id);
      const hiddenCodesMapping: Record<string, boolean> = {};

      plainNFTIDList.forEach((nftId) => hiddenCodesMapping[nftId] = true);

      setHiddenCodes(hiddenCodesMapping);
    })
  }, [])

  useEffect(() => {
	const doRedeem = async () => {
		await getRedeem()

	}
	if (clickRedeem) {
		doRedeem()
	}
  }, [clickRedeem])

  const getRedeem = async () => {
    if (!allNFTs||!getAvailableRedeem()) {
      return
    }

    const _category = category
    const allItems = allNFTs[category].nfts.filter(n => !n.code && !n.showRedeemProcess)

    if (allItems.length === 0) {
      return
    }
    const item = allItems[0]
    const newItem: distributorNFTItem = {id: item.id, code: item.code, showRedeemProcess: true, used: false}

    setAllNFTs(currentItems => {
      if (!currentItems) {
        return currentItems
      }
      currentItems[_category].nfts = currentItems[_category].nfts.map(n => n.id === item.id ? newItem: n)
      return currentItems
    })
    setRedeemProcessing(true)
    const code = await redeemProcess(item.id, _category === 'monthly' ? true : false)

    if (code) {
      newItem.code = code
      newItem.showRedeemProcess = false
      setAllNFTs(currentItems => {
        if (!currentItems) {
          return currentItems
        }
        currentItems[_category].nfts = currentItems[_category].nfts.map(n => n.id === item.id ? newItem: n)
        return currentItems
      })
    }
    setRedeemProcessing(false)
    setClickRedeem(false)
  }

  const getAvailableRedeem = () => {
    const items = getFilteredNFTs()
    const availableItems = items.filter(n => !n.code && !n.showRedeemProcess)
    return availableItems.length > 0
  }

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

  console.log("NFTS: ", allNFTs);

  const getFilteredNFTs = (): distributorNFTItem[] => {
    if (!allNFTs || !allNFTs[category].nfts) {
      return []
    }
    if (filter === "all") {
      const ret = allNFTs[category].nfts

      return ret
    }

    if (filter === 'to be used') {
      const ret = allNFTs[category].nfts.filter(n => n.code && !n.used)

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

  console.log("ALL NFTS: ", allNFTs);

  const filteredNFTs = getFilteredNFTs();
  const totalPages = Math.ceil(filteredNFTs.length / ITEMS_PER_PAGE);
  const paginatedNFTs = filteredNFTs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="page-container">
      <div className="management-heading">
        <h1>Management</h1>
        <button onClick={() => reflashNftsProcess()}>
          <RefreshIcon />
          <p>{ isReflashNFTs ? "Refreshing... " : "Refresh"}</p>
        </button>
      </div>
      {/* {renderNewNFTsButton()} */}
      <div className="sub-heading">
        <h3>Your NFTs</h3>
        {
          filter === 'no redeem' && getAvailableRedeem() && !redeemProcessing &&
          <button className="generate-btn" onClick={() => setClickRedeem(true)}>
            Generate codes
          </button>
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
            className={filter === "to be used" ? "active" : ""}
            onClick={() => {
              setFilter('to be used')
            }}
          >
            To be used
          </button>
          <button
            className={filter === "no redeem" ? "active" : ""}
            onClick={() => {
              setFilter('no redeem')
            }}
          >
            To generate
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

        {/* <div className="nft-list">
          {getFilteredNFTs().map((n, index) => (
            <div key={n.id} className="nft-item">
            <div className="nft-info">
              <p className="nft-id">{n.id}</p>
            </div>
            <div className="nft-info">
              <p className="nft-id">{n.code}</p>
            </div>
            {
              n.showRedeemProcess ?
              <p className='refreshing'>Redeem...</p> :
              <p className='refreshing'></p>
            }
          </div>
          ))}
        </div> */}

        <div className="nft-list">
          {paginatedNFTs.map((nft) => (
            <div key={nft.id} className="nft-item">
              <div className="nft-info">
                <p className="nft-id">{nft.id}</p>
                {nft.code && <p className="redeem-text">Redeem code</p>}
                {nft.code && <p className="redeem-code">{hiddenCodes[nft.id] ? "••••••••••••••••" : nft.code}</p>}
              </div>
              {
                nft.showRedeemProcess && (
                  <p>Redeeming code...</p>
                )
              }
              {
                nft.code && (
                  <div className="nft-actions">
                    <button
                      className="icon-btn"
                      onClick={() => copyCode(String(nft.id), nft.code)}
                    >
                      {copiedStates[nft.id] ? <img src="/assets/check.svg" alt="Copy icon" /> : <img src="/assets/copy-purple.svg" alt="Copy icon" />}
                    </button>
                    <button className={`icon-btn ${hiddenCodes[nft.id] && 'hidden'}`} onClick={() => toggleVisibility(String(nft.id))}>
                      {hiddenCodes[nft.id] ? <VisibilityOffIcon /> : <VisibilityOnIcon />}
                    </button>
                  </div>
                )
              }
            </div>
          ))}
        </div>
      </div>
      {
        !!totalPages && (
          <div className="pagination-controls">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
              <ArrowIcon style={{ transform: "rotate(180deg)" }} />
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
              <ArrowIcon />
            </button>
          </div>
        )
      }
      <Footer />
    </div>
  )
}