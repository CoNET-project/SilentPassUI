// Vouchers.tsx
import React, { useMemo, useState, useEffect,useRef } from "react"
import { motion } from "framer-motion"
import { Coins, QrCode, Plus, Globe, ChevronLeft } from "lucide-react"

import { useDaemonContext } from "@/providers/DaemonProvider"
import PurchaseAccount from "./PurchaseAccount"
import BeamioNavBack from '@/components/Setting/BeamioNavBack'
import { createPortal } from 'react-dom'
import { AnimatePresence } from "framer-motion"
import CardDetail from "./CardDetail"
import CCSACardVisual from "./CardVisual"
import { getMyAssetsAggregated, signOfflineTransferERC3009 } from "@/services/BeamioCard"
import MerchantCardTopUpFlow from "@/pages/Vouchers/MerchantCardTopUpFlow"
import ShowPayQR from "@/pages/Vouchers/showPayQR"
import ActiveList from "./ActiveList"
import ActionItemDetail from "./ActionItemDetail"


// --- Theme & Helpers ---
const THEME = {
  blue: "#1652f0",
  bgTop: "#f7f9ff",
  bgBottom: "#f4f6fb",
}




// --- UI Primitives (match your coding style) ---
function AppShell({ children }: { children: React.ReactNode }) {
	return (
	  <div
		className="
		  mx-auto
		  w-full
		  max-w-[640px]
		  text-slate-900
		  font-sans
		  pt-safe-lg
		  pb-safe
		"
	  >
		<style>{`
		  :root { color-scheme: light; }
		  * {
			-webkit-font-smoothing: antialiased;
			-moz-osx-font-smoothing: grayscale;
		  }
  
		  /* ✅ Bottom safe area */
		  .pb-safe {
			padding-bottom: env(safe-area-inset-bottom);
		  }
  
		  /* ✅ Top safe area + extra breathing room */
		  .pt-safe-lg {
			padding-top: calc(env(safe-area-inset-top) + 20px);
		  }
		`}</style>
  
		{children}
	  </div>
	)
  }

function TopBar({
  title,
  sub,
  left,
  right,
}: {
  title: string
  sub?: React.ReactNode
  left?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="sticky top-0 z-30">
      <div className="backdrop-blur-xl bg-white/70 text-black transition-colors duration-300">
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between h-10">
            <div className="flex items-center gap-3">
              {left}
              <div className="min-w-0">
                <div className="text-[13px] font-semibold tracking-tight text-black/70">{title}</div>
                {sub ? <div className="mt-0.5 text-[11px] font-medium text-black/45">{sub}</div> : null}
              </div>
            </div>
            {right}
          </div>
          <div className="h-3" />
        </div>
        <div className="h-px w-full bg-black/[0.06]" />
      </div>
    </div>
  )
}

function LargeTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-4 pt-4 mb-4">
      <div className="min-w-0">
        <div className="text-[34px] font-extrabold tracking-tight text-black/90 leading-[1.08]">
          {title}
        </div>
        {subtitle ? <div className="mt-1 text-[16px] text-black/45">{subtitle}</div> : null}
      </div>
    </div>
  )
}


// --- Main: Vouchers page ---
export default function CardItem({cardItem}: {cardItem: MyCardAssets}) {
  // mock state (wire to your real acct later)
  const [hasMembershipPass, setHasMembershipPass] = useState(false)
  const [ccsaBalance, setCcsaBalance] = useState(100)

  const topRight = useMemo(() => {
    return (
      <div className="flex items-center gap-1 bg-black/[0.04] px-2.5 py-1.5 rounded-full">
        <Coins className="h-3.5 w-3.5 text-yellow-600" />
        <span className="text-xs font-semibold text-black/70">
          {hasMembershipPass ? ccsaBalance.toFixed(0) : "0"}
        </span>
      </div>
    )
  }, [hasMembershipPass, ccsaBalance])
  const {
	profiles,
	myAddress,
	setMyAddress,
	setUsdcbalance,
	usdcbalance,
	currencyData,
	setUsdcToUSD,
	setShowFooter,
	setNavigateLeftButtonArray,
	historyPayData,
	setSecureCode,
	beamio,
	redeemCode,
	setRedeemCode,
} = useDaemonContext()
  const [settingsOpen, setSettingsOpen] = useState<''|'PurchaseAccount'|'TopUP'|'showPayQR'>('')
  const [showAlphaHowItWorks, setShowAlphaHowItWorks] = useState<''|'cardDetail'>('')
  const [selectedActionItem, setSelectedActionItem] = useState<BeamioActionResponse | null>(null)
  const [detailTab, setDetailTab] = useState<"activity" | "perks">("activity")
  const [myAssets, setMyAssets] = useState<MyCardAssets>(cardItem)
  const [qrPayload, setQrPayload] = useState<string>("")

  const flash = async () => {
	if (profiles?.length) {
		await new Promise(resolve => setTimeout(resolve, 500))
		getMyAssetsAggregated(profiles[0]).then((res) => {
			if (res) setMyAssets(res)
		  
		}).catch(e => {
		  console.log(e)
		})
	  }
  }

  useEffect(() => {
    flash()
  }, [myAddress])

  useEffect(() => {
    if (settingsOpen !== "showPayQR") setQrPayload("")
  }, [settingsOpen])

  const numOfNfts = useMemo(() => {
	if (!myAssets) {
		return 0
	}
	const nft = myAssets.nfts[0]
	if (!nft) {
		return 0
	}
	return nft.tokenId
	
  }, [myAssets])

  const isMember = useMemo(() => {
	return myAssets?.nfts && myAssets.nfts.length > 0
  }, [myAssets])

  return (
    <AppShell>
      
      <div className="px-4 pb-24 mt-12">
       
	  <div className="px-4 pb-10 max-w-[420px] mx-auto">
        <CCSACardVisual
          balance={Number(myAssets?.points || 0)}
          hasPass={isMember}
          onTopUp={() => {
			setShowFooter(false)
			setSettingsOpen('TopUP')
		  }}
          onQR={async () => {
			setShowFooter(false)
			if (!profiles?.[0]?.privateKeyArmor || !myAssets?.cardAddress) return
			try {
				const pointsHuman = (myAssets?.points ?? 0).toString()
				const data = await signOfflineTransferERC3009(
					profiles[0].privateKeyArmor,
					pointsHuman,
					myAssets.cardAddress
				)
				setQrPayload(JSON.stringify(data))
				setSettingsOpen("showPayQR")
			} catch (e) {
				console.error("signOfflineTransferERC3009 failed", e)
			}
		  }}
		  memberNo={numOfNfts.toString()}
          showBuy= {myAssets?.nfts && myAssets.nfts.length > 0 ? '' : 'buy'}
          onBuy={() => {
			setShowFooter(false)
			if (isMember) {
				setSettingsOpen('TopUP')
				return
			}
			setShowAlphaHowItWorks('cardDetail')
			
          }}
        />
		</div>
		{/* Tab: Activity | Perks & Rules */}
		<div className="mt-6">
			<div className="flex gap-4 border-b border-black/[0.06]">
				<button
					type="button"
					onClick={() => setDetailTab("activity")}
					className={`pb-3 text-sm font-bold px-2 relative ${
						detailTab === "activity" ? "text-blue-600" : "text-slate-400"
					}`}
				>
					Activity
					{detailTab === "activity" && (
						<motion.div
							layoutId="carditem-tab-underline"
							className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
							transition={{ type: "spring", damping: 25, stiffness: 300 }}
						/>
					)}
				</button>
				<button
					type="button"
					onClick={() => setDetailTab("perks")}
					className={`pb-3 text-sm font-bold px-2 relative ${
						detailTab === "perks" ? "text-blue-600" : "text-slate-400"
					}`}
				>
					Perks & Rules
					{detailTab === "perks" && (
						<motion.div
							layoutId="carditem-tab-underline"
							className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
							transition={{ type: "spring", damping: 25, stiffness: 300 }}
						/>
					)}
				</button>
			</div>
			{detailTab === "activity" && (
				<ActiveList
					onItemClick={(item) => {
						setSelectedActionItem(item)
						setShowFooter(false)
					}}
					MyCardAssets={myAssets}
				/>
			)}
			{detailTab === "perks" && (
				<CardDetail
					isMember={isMember}
					beamio={myAssets.cardOwner}
					onPurchase={() => {
						setShowFooter(false)
						if (isMember) {
							setSettingsOpen("TopUP")
							return
						}
						setSettingsOpen("PurchaseAccount")
					}}
				/>
			)}
		</div>
      </div>


	  {(showAlphaHowItWorks || selectedActionItem) && ( 
			<AnimatePresence>
				<motion.div
					key="modal-overlay"
					className="
						fixed inset-0 z-[99] bg-white dark:bg-slate-900 flex flex-col
					"
					initial={{ x: "100%" }}
					animate={{ x: 0 }}
					exit={{ x: "100%" }}
					transition={{ duration: 0.28, ease: "easeOut" }}
					onTouchMove={(e) => e.stopPropagation()}
				>
				{/* 顶部 Header */}
				<BeamioNavBack
					title=''						
					onClose={() => {
						flash()
						setShowAlphaHowItWorks('')
						setSelectedActionItem(null)
						setShowFooter(true)
						flash()
					}}
					onMore={() => {}}
				/>

					{/* 内容区域 */}
					<div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
						{showAlphaHowItWorks === 'cardDetail' && (
							<CardDetail
								isMember={isMember}
								beamio={myAssets.cardOwner}
								onPurchase={() => {
									setShowFooter(false)
									if (isMember) {
										setSettingsOpen('TopUP')
										return
									}
									setSettingsOpen('PurchaseAccount')
								}}
							/>
						)}
						{selectedActionItem != null && (
							<ActionItemDetail
								item={selectedActionItem}
								memberNo={numOfNfts.toString()}
								onClose={() => {
									flash()
									setSelectedActionItem(null)
									setShowFooter(true)
									flash()
								}}
							/>
						)}
					</div>
				</motion.div>
			</AnimatePresence>
		)}

		{typeof document !== 'undefined' && profiles?.[0] && myAssets?.cardAddress
			? createPortal(
				<MerchantCardTopUpFlow
					open={settingsOpen === 'TopUP'}
					cardAddress={myAssets.cardAddress}
					storeCreditsPoints={String(myAssets.points ?? 0)}
					cardCurrency={String(myAssets.cardCurrency ?? 'USD')}
					profile={profiles[0]}
					onClose={() => {
						setSettingsOpen('')
						setShowFooter(true)
					}}
					onSuccess={(assets) => {
						if (assets) setMyAssets({ ...assets })
					}}
				/>,
				document.body,
			)
			: null}

		{/* Purchase / Pay QR bottom sheet */}
		<div
			className={[
				"fixed inset-0 z-[120]",
				(settingsOpen === 'PurchaseAccount' || settingsOpen === 'showPayQR') ? "pointer-events-auto" : "pointer-events-none"
			].join(" ")}
		>
			{/* 灰色遮罩：父页面不可用 */}
			<div
				className={[
				"absolute inset-0",
				"bg-black/50 transition-opacity duration-300 ease-out",
				(settingsOpen === 'PurchaseAccount' || settingsOpen === 'showPayQR') ? "opacity-100" : "opacity-0"
				].join(" ")}
				onClick={() => {
					setShowFooter(true)
					setSettingsOpen('')
					setSecureCode('')
					setRedeemCode('')
					setTimeout(() => {
						flash()
					}, 5000);


				}}
			/>

			{/* Bottom Sheet：全宽，从底部上来 */}
			<div
				className={[
				"absolute inset-x-0 bottom-0 z-[121]",
				
				"transition-transform duration-300 ease-out",
				(settingsOpen === 'PurchaseAccount' || settingsOpen === 'showPayQR') ? "translate-y-0" : "translate-y-full"
				].join(" ")}
				onTouchMove={(e) => e.stopPropagation()}
			>
				{/* Sheet 本体：h-auto 自适应内容高度 */}
				<div
				className={[
					"w-full",
					"bg-white dark:bg-slate-900",
					"rounded-t-[22px]",

					// ✅ 自适应高度，但最多不超过屏幕（避免顶到状态栏）
					// 你也可以改成 90dvh
					"max-h-[calc(100dvh-env(safe-area-inset-top)-12px)]",
					"h-auto",

					// ✅ 安全区：底部留出 Home indicator
					"pb-[env(safe-area-inset-bottom)]"
				].join(" ")}
				>
					{/* 顶部拖拽条（可选） */}
					<div className="pt-2 pb-1 flex justify-center">
						<div className="h-1 w-10 rounded-full bg-slate-300/70 dark:bg-white/15" />
					</div>


					{/* 内容区：内容少就不滚动；内容多才滚动 */}
					<div className="px-4 pb-4 overflow-y-auto">
						

						{
							settingsOpen === 'PurchaseAccount' && 
							
								<PurchaseAccount 
									flow="PURCHASE"
									beamioBalanceText={`Balance: ${usdcbalance.toFixed(2)} USDC`}
									defaultAmount={100}
									purchasePrice={0.01}
									cardOwner={myAssets?.cardOwner ?? null}
									purchaseTitle="CCSA Membership"
									onClose={(val) => {
										if (val) {
											setMyAssets({...val})
										}
										setTimeout(() => {
											flash()
										}, 3000)
										setShowAlphaHowItWorks('')
									setSettingsOpen('')
										setShowFooter(true)
									}}
								/>
							
						}
						{
							settingsOpen === "showPayQR" && (
								<ShowPayQR
									successUrl={"https://beamio.app?beamio=" + (beamio?.accountName || "")}
									beamio={beamio}
									qrValue={qrPayload || undefined}
								/>
							)
						}
						<div
							className="
							h-[24px]
							pb-[env(safe-area-inset-bottom)]
							pointer-events-none
							"
						/>
					</div>
				</div>
			</div>
		</div>
    </AppShell>
  )
}
