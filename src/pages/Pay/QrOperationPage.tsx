import React, { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { X, CreditCard, Share2, Copy, Check, Loader2 } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { signAAtoEOA_USDC_with_BeamioContainerMainRelayedOpen } from "@/services/AAaccount"
import type { OpenContainerRelayPayload } from "@/services/AAaccount"
import bIcon from "@/components/assets/logo512.png"

const QR_SIZE = 320
const QR_LOGO_SIZE = 64

const showPaylinkSite = "https://beamio.app"
const shortAddress = (addr: string) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "")

const getImg = (avatarSeed: string | undefined) =>
  `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed || "@Beamio").toString()}`

function displayName(item: beamio | null): string {
  if (!item) return ""
  const lastname = item.lastName?.split("\r\n") || []
  const fullName = `${item.firstName || ""} ${/^\{/.test(lastname[0] ?? "") ? "" : lastname[0] || ""}`.trim()
  return fullName || item.accountName || item.address || ""
}

type TabId = "scan" | "mycode"

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
  const location = useLocation()
  const [tab, setTab] = useState<TabId>(() => (location.state as { tab?: TabId })?.tab ?? "scan")
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedQr, setCopiedQr] = useState(false)
  const [merchantPayload, setMerchantPayload] = useState<OpenContainerRelayPayload | null>(null)
  const [merchantSigning, setMerchantSigning] = useState(false)
  const [merchantError, setMerchantError] = useState<string | null>(null)
  const [merchantExpireSec, setMerchantExpireSec] = useState(0)
  const { beamio, profiles } = useDaemonContext()

  const handleClose = () => {
    setMerchantPayload(null)
    navigate(-1)
  }

  const payMeUrl = beamio?.accountName ? `${showPaylinkSite}?beamio=${encodeURIComponent(beamio.accountName)}` : ""

  // 自动签名获取 relay payload（My Code 即 For Merchants）
  useEffect(() => {
    if (tab !== "mycode") return
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
  }, [tab, profiles, merchantPayload])

  useEffect(() => {
    if (merchantExpireSec <= 0) return
    const t = setInterval(() => setMerchantExpireSec((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [merchantExpireSec])

  const onCopyAddress = async (value: string) => {
    const ok = await copyText(value)
    if (ok) {
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 3000)
    }
  }

  const onCopyQr = async (value: string) => {
    const ok = await copyText(value)
    if (ok) {
      setCopiedQr(true)
      setTimeout(() => setCopiedQr(false), 3000)
    }
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
            <div className="flex flex-1 min-w-[240px] max-w-[320px] p-1 rounded-full bg-white/10 gap-1">
              <button
                type="button"
                onClick={() => setTab("scan")}
                className={`flex-1 min-w-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  tab === "scan" ? "bg-white text-slate-800" : "text-white/80"
                }`}
              >
                Scan
              </button>
              <button
                type="button"
                onClick={() => setTab("mycode")}
                className={`flex-1 min-w-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  tab === "mycode" ? "bg-white text-slate-800" : "text-white/80"
                }`}
              >
                Show to pay
              </button>
            </div>
            <div className="w-10" />
          </div>
          {/* Beamio 头像 + 下一行 name + @beamioTag 标准格式 */}
          {(displayName(beamio) || beamio?.accountName) && (
            <div className="flex flex-col items-center mt-3 gap-1">
              <img
                src={beamio?.image?.trim() || getImg(beamio?.accountName)}
                alt={beamio?.accountName ?? ""}
                className="w-12 h-12 rounded-full object-cover border-2 border-white/30 shadow-lg"
                draggable={false}
              />
              <div className="flex flex-col items-center text-center">
                {displayName(beamio) && (
                  <span className="text-white font-semibold text-base truncate max-w-[200px]">{displayName(beamio)}</span>
                )}
                {beamio?.accountName && (
                  <span className="font-semibold text-[var(--beamio-brand,#2F78FF)] text-sm">@{beamio.accountName}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scanner / My Code 区域 */}
        <div className="flex-1 flex items-center justify-center px-6 min-h-0">
          <div className="-translate-y-16 w-full flex flex-col items-center">
          {tab === "scan" ? (
            <div className="w-full flex flex-col items-center">
              <div className="relative w-full max-w-[280px] aspect-square">
                {/* 占位：从 Html5QrcodePlugin 或外部调用 scanRef.start() 打开相机 */}
                <div className="relative w-full h-full rounded-2xl bg-black/50 flex flex-col items-center justify-center border-2 border-white/20">
                  <p className="text-white/70 text-sm text-center px-6">选择 Scan 打开相机开始扫描</p>
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
            <div className="w-full max-w-[400px] rounded-2xl bg-slate-900/80 border border-white/10 p-5 flex flex-col items-center">
              {/* QR + Copy/Share 整体，上下居中对齐 */}
              {merchantSigning ? (
                <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] w-full">
                  <Loader2 className="w-10 h-10 text-blue-400 animate-spin" strokeWidth={2} />
                  <p className="mt-3 text-sm text-white/70">Generating Pay Code...</p>
                </div>
              ) : merchantError ? (
                <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] w-full">
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
                  <div className="flex items-center justify-center w-full mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-xs font-semibold text-white/90">Express Pay (Smart Account)</span>
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
                  <button
                    type="button"
                    onClick={() => onCopyAddress(profiles?.[0]?.aaAccount ?? "")}
                    className="mt-2 flex items-center justify-center gap-1 px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/70 active:scale-[0.98] transition cursor-pointer w-fit mx-auto"
                    aria-label="Copy address"
                  >
                    <CreditCard className="w-4 h-4 shrink-0" strokeWidth={2.2} />
                    <span>{shortAddress(profiles?.[0]?.aaAccount ?? "")}</span>
                    {copiedAddress ? <Check size={14} className="text-emerald-500 shrink-0" /> : <Copy size={14} className="shrink-0 opacity-80" />}
                  </button>
                  {/* Share / Copy 底部按钮 - 对齐 BeamioPayMe 样式 */}
                  <div className="mt-6 sm:mt-8 w-full flex gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => onCopyQr(merchantPayload ? JSON.stringify(merchantPayload) : payMeUrl)}
                      disabled={!merchantPayload}
                      className={[
                        "flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-semibold text-sm",
                        "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
                        "hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition",
                        "disabled:opacity-50 disabled:pointer-events-none",
                        copiedQr ? "ring-2 ring-blue-400" : ""
                      ].join(" ")}
                    >
                      {copiedQr ? (
                        <Check className="w-5 h-5 text-blue-600 shrink-0" />
                      ) : (
                        <Copy className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0" />
                      )}
                      <span>Copy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onShare(merchantPayload ? JSON.stringify(merchantPayload) : payMeUrl)}
                      disabled={!merchantPayload}
                      className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-semibold text-sm bg-black dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Share2 className="w-5 h-5 shrink-0" />
                      <span>Share</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 min-h-[400px] text-center">
                  <p className="text-white/60 text-sm">Activate AA wallet to use Pay Code</p>
                </div>
              )}
            </div>
          )}
          </div>
        </div>

      </div>
    </div>
  )
}
