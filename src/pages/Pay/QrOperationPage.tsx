import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { X, CreditCard, Gift, UserPlus, Share2, Copy, Check, Loader2, Lock } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen } from "@/services/AAaccount"
import type { OpenContainerRelayPayload } from "@/services/AAaccount"
import bIcon from "@/components/assets/logo512.png"

const QR_SIZE = 200
const QR_LOGO_SIZE = 40

const showPaylinkSite = "https://beamio.app"

function displayName(item: beamio | null): string {
  if (!item) return ""
  const lastname = item.lastName?.split("\r\n") || []
  const fullName = `${item.firstName || ""} ${/^\{/.test(lastname[0] ?? "") ? "" : lastname[0] || ""}`.trim()
  return fullName || item.accountName || item.address || ""
}

type TabId = "scan" | "mycode"
type MyCodeSubTab = "merchants" | "friends"
type ScanMode = "pay" | "gift" | "add"

async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t)
    return true
  } catch {
    return false
  }
}

export default function QrOperationPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<TabId>("scan")
  const [myCodeSubTab, setMyCodeSubTab] = useState<MyCodeSubTab>("friends")
  const [copied, setCopied] = useState(false)
  const [merchantPayload, setMerchantPayload] = useState<OpenContainerRelayPayload | null>(null)
  const [merchantSigning, setMerchantSigning] = useState(false)
  const [merchantError, setMerchantError] = useState<string | null>(null)
  const [merchantExpireSec, setMerchantExpireSec] = useState(0)
  const { beamio, myAddress, profiles, scanRef, setScanIntent } = useDaemonContext()

  const handleClose = () => {
    setMerchantPayload(null)
    navigate(-1)
  }

  /** 调用全局 openPayWorkflow，由监听全局负责后续 workflow */
  const startScan = (mode: ScanMode) => {
    if (mode === "pay") setScanIntent("payBill")
    else if (mode === "gift") setScanIntent("voucherPay")
    else setScanIntent("")
    scanRef.current?.start()
    handleClose()
  }

  const payMeUrl = beamio?.accountName ? `${showPaylinkSite}?beamio=${encodeURIComponent(beamio.accountName)}` : ""

  // For Merchants: 自动签名获取 relay payload（不用 merchantSigning 作 deps，避免 effect 重跑导致 cancelled 阻断 payload 设置）
  useEffect(() => {
    if (tab !== "mycode" || myCodeSubTab !== "merchants") return
    if (!profiles?.[0]?.aaAccount || !profiles[0].privateKeyArmor || merchantPayload) return
    let cancelled = false
    setMerchantError(null)
    setMerchantSigning(true)
    signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen(profiles[0], "10000", { deadlineSeconds: 3 * 60 })
      .then((payload) => {
        if (!cancelled) {
          setMerchantPayload(payload)
          const deadline = parseInt(String(payload.deadline ?? 0), 10)
          if (deadline) {
            setMerchantExpireSec(Math.max(0, deadline - Math.floor(Date.now() / 1000)))
          }
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMerchantError(err?.message ?? "Sign failed")
          console.error("Pay Code sign failed", err)
        }
      })
      .finally(() => {
        if (!cancelled) setMerchantSigning(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, myCodeSubTab, profiles, merchantPayload])

  useEffect(() => {
    if (merchantExpireSec <= 0) return
    const t = setInterval(() => setMerchantExpireSec((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [merchantExpireSec])

  const onCopy = async (value: string) => {
    const ok = await copyText(value)
    if (ok) setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const onShare = (urlOrValue: string) => {
    if (navigator.share) {
      navigator.share({
        title: "Beamio PayMe",
        text: urlOrValue,
        url: urlOrValue.startsWith("http") ? urlOrValue : undefined,
      }).catch(() => {})
    } else {
      window.open(urlOrValue.startsWith("http") ? urlOrValue : "#", "_blank")
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 25%, #0f3460 50%, #e94560 100%)",
      }}
    >
      {/* 安全区 */}
      <div className="flex-1 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleClose}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <div className="flex p-1 rounded-full bg-white/10">
              <button
                type="button"
                onClick={() => setTab("scan")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                  tab === "scan" ? "bg-white text-slate-800" : "text-white/80"
                }`}
              >
                Scan
              </button>
              <button
                type="button"
                onClick={() => setTab("mycode")}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                  tab === "mycode" ? "bg-white text-slate-800" : "text-white/80"
                }`}
              >
                My Code
              </button>
            </div>
            <div className="w-10" />
          </div>
          {/* Beamio firstname/lastname 白色，@BeamioTag 保持品牌色 */}
          {(displayName(beamio) || beamio?.accountName) && (
            <div className="flex items-baseline justify-center gap-2 mt-3 text-lg font-semibold">
              {displayName(beamio) && <span className="text-white truncate">{displayName(beamio)}</span>}
              {beamio?.accountName && (
                <span className="font-semibold text-[var(--beamio-brand,#2F78FF)]">@{beamio.accountName}</span>
              )}
            </div>
          )}
        </div>

        {/* Scanner / My Code 区域 */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {tab === "scan" ? (
            <div className="w-full flex flex-col items-center">
              <div className="relative w-full max-w-[280px] aspect-square">
                {/* 占位：按下 Pay / Gift / Add 将调用全局 scanRef.start() 打开相机 */}
                <div className="relative w-full h-full rounded-2xl bg-black/50 flex flex-col items-center justify-center border-2 border-white/20">
                  <p className="text-white/70 text-sm text-center px-6">按下方 Pay / Gift / Add 开始扫描</p>
                  {/* 四角白框 */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute left-4 top-4 w-12 h-12 border-l-4 border-t-4 border-white/60 rounded-tl-lg" />
                    <div className="absolute right-4 top-4 w-12 h-12 border-r-4 border-t-4 border-white/60 rounded-tr-lg" />
                    <div className="absolute left-4 bottom-4 w-12 h-12 border-l-4 border-b-4 border-white/60 rounded-bl-lg" />
                    <div className="absolute right-4 bottom-4 w-12 h-12 border-r-4 border-b-4 border-white/60 rounded-br-lg" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-[300px] flex flex-col items-center gap-4">
              {/* My Code 子选项 */}
              <div className="flex p-1 rounded-lg bg-black/30">
                <button
                  type="button"
                  onClick={() => { setMyCodeSubTab("merchants"); setMerchantPayload(null); setMerchantError(null) }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    myCodeSubTab === "merchants" ? "bg-blue-500 text-white" : "text-white/80 hover:text-white"
                  }`}
                >
                  For Merchants
                </button>
                <button
                  type="button"
                  onClick={() => setMyCodeSubTab("friends")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    myCodeSubTab === "friends" ? "bg-white/20 text-white" : "text-white/80 hover:text-white"
                  }`}
                >
                  For Friends
                </button>
              </div>

              {/* QR 卡片：For Friends / For Merchants 使用相同大小展示 */}
              <div className="w-full rounded-2xl bg-slate-900/80 border border-white/10 p-5 min-h-[320px] flex flex-col items-center justify-center">
                {myCodeSubTab === "friends" ? (
                  /* For Friends: MAIN WALLET, 静态 EOA */
                  myAddress ? (
                    <div className="flex flex-col items-center w-full">
                      <div className="flex items-center gap-2 self-start mb-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs font-semibold text-white/90">MAIN WALLET</span>
                      </div>
                      <div className="relative">
                        <QRCodeCanvas
                          value={myAddress}
                          size={QR_SIZE}
                          level="H"
                          includeMargin
                          bgColor="#ffffff"
                          fgColor="#000000"
                          imageSettings={{
                            src: bIcon,
                            height: QR_LOGO_SIZE,
                            width: QR_LOGO_SIZE,
                            excavate: true,
                          }}
                        />
                      </div>
                      <p className="mt-3 text-xs text-white/60">Static EOA Address • Permanent</p>
                      <p className="mt-2 text-lg font-bold text-white">@{beamio?.accountName}</p>
                      <button
                        type="button"
                        onClick={() => onCopy(myAddress)}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-mono hover:bg-white/20"
                      >
                        {`${myAddress.slice(0, 6)}...${myAddress.slice(-4)}`}
                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-white/60 text-sm">Connect wallet to show EOA</div>
                  )
                ) : (
                  /* For Merchants: EXPRESS PAY，内联实现，与 Friends 相同 QR 尺寸 */
                  merchantSigning ? (
                    <div className="flex flex-col items-center justify-center w-full" style={{ minHeight: QR_SIZE + 80 }}>
                      <Loader2 className="w-10 h-10 text-blue-400 animate-spin" strokeWidth={2} />
                      <p className="mt-3 text-sm text-white/70">Generating Pay Code...</p>
                    </div>
                  ) : merchantError ? (
                    <div className="flex flex-col items-center justify-center w-full" style={{ minHeight: QR_SIZE + 80 }}>
                      <p className="text-sm text-red-400">Failed: {merchantError}</p>
                      <button
                        type="button"
                        onClick={() => { setMerchantError(null); setMerchantPayload(null) }}
                        className="mt-4 px-4 py-2 rounded-lg bg-white/20 text-white text-sm"
                      >
                        Retry
                      </button>
                    </div>
                  ) : merchantPayload ? (
                    <div className="flex flex-col items-center w-full">
                      <div className="flex items-center justify-between w-full mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                          <span className="text-xs font-semibold text-white/90">EXPRESS PAY</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-white/70">
                          <Lock size={12} />
                          <span className="text-xs">Secure</span>
                        </div>
                      </div>
                      <div className="relative">
                        <QRCodeCanvas
                          value={JSON.stringify({ ...merchantPayload, validBefore: merchantPayload.deadline })}
                          size={QR_SIZE}
                          level="H"
                          includeMargin
                          bgColor="#ffffff"
                          fgColor="#000000"
                          imageSettings={{
                            src: bIcon,
                            height: QR_LOGO_SIZE,
                            width: QR_LOGO_SIZE,
                            excavate: true,
                          }}
                        />
                        {merchantExpireSec <= 0 && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
                            <span className="text-lg font-bold text-slate-700">Expired</span>
                          </div>
                        )}
                      </div>
                      <p className="mt-3 text-xs text-white/60">
                        Auto-refresh in {Math.floor(merchantExpireSec / 60)}:{String(merchantExpireSec % 60).padStart(2, "0")}s
                      </p>
                      <p className="mt-2 text-lg font-bold text-white">@{beamio?.accountName}</p>
                      <button
                        type="button"
                        onClick={() => onCopy(profiles?.[0]?.aaAccount ?? "")}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/90 text-xs font-mono hover:bg-white/20"
                      >
                        aa:{`${(profiles?.[0]?.aaAccount ?? "").slice(0, 6)}...${(profiles?.[0]?.aaAccount ?? "").slice(-4)}`}
                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-white/60 text-sm">Activate AA wallet to use Pay Code</div>
                  )
                )}
              </div>

              {/* Share / Copy 底部按钮 */}
              <div className="flex justify-center gap-6">
                <button
                  type="button"
                  onClick={() => onShare(myCodeSubTab === "friends" ? myAddress : (merchantPayload ? JSON.stringify(merchantPayload) : payMeUrl))}
                  className="flex flex-col items-center text-white/80 hover:text-white transition-colors disabled:opacity-50"
                  disabled={myCodeSubTab === "friends" ? !myAddress : !merchantPayload}
                >
                  <Share2 className="w-8 h-8 mb-1" strokeWidth={2} />
                  <span className="text-xs">Share</span>
                </button>
                <button
                  type="button"
                  onClick={() => onCopy(myCodeSubTab === "friends" ? myAddress : (merchantPayload ? JSON.stringify(merchantPayload) : payMeUrl))}
                  className="flex flex-col items-center text-white/80 hover:text-white transition-colors disabled:opacity-50"
                  disabled={myCodeSubTab === "friends" ? !myAddress : !merchantPayload}
                >
                  {copied ? <Check className="w-8 h-8 mb-1 text-emerald-400" strokeWidth={2} /> : <Copy className="w-8 h-8 mb-1" strokeWidth={2} />}
                  <span className="text-xs">Copy</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 底部操作按钮：按下后才打开相机开始扫描 */}
        <div className="px-6 pb-6 grid grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => startScan("pay")}
            className="flex flex-col items-center justify-center py-4 rounded-2xl bg-black/30 text-white hover:bg-black/40 active:scale-95 transition-all"
          >
            <CreditCard className="w-8 h-8 text-blue-400 mb-2" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase">Pay</span>
          </button>
          <button
            type="button"
            onClick={() => startScan("gift")}
            className="flex flex-col items-center justify-center py-4 rounded-2xl bg-black/30 text-white hover:bg-black/40 active:scale-95 transition-all"
          >
            <Gift className="w-8 h-8 text-purple-400 mb-2" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase">Gift</span>
          </button>
          <button
            type="button"
            onClick={() => startScan("add")}
            className="flex flex-col items-center justify-center py-4 rounded-2xl bg-black/30 text-white hover:bg-black/40 active:scale-95 transition-all"
          >
            <UserPlus className="w-8 h-8 text-emerald-400 mb-2" strokeWidth={2} />
            <span className="text-xs font-semibold uppercase">Add</span>
          </button>
        </div>
      </div>
    </div>
  )
}
