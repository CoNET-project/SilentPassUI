import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	ArrowLeft,
	X,
	ChevronRight,
	Copy,
	QrCode,
	Check,  
	ShieldCheck,
	AlertTriangle,
	RefreshCcw,
	User,
	Wallet,
	Building2,
	DollarSign,
	XCircle
} from "lucide-react";
import { useDaemonContext } from "@/providers/DaemonProvider"
import { QRCodeCanvas } from "qrcode.react"
import bIcon from '@/components/assets/32x32.svg'
import StepAmount,{RampMode} from './StepAmount'
import { AppButton } from "../button/AppButton";
const remote = 'https://beamio.app'


type Screen = "hub" | "coinbase" | "coinbase_error" | "transfer" | "receive" | "profile_qr" | 'coinbase_next'

const fmtAddr = (a = '') => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

type BeamioAddUSDCFlowProps = {
	/** 来自 BankingBridge Add Cash：挂载后直接执行 Add funds via Coinbase 流程 */
	autoStartCoinbase?: boolean
	/** 底部 sheet 嵌入模式：仅显示 Coinbase 确认内容 (204-221)，无 Header/hub */
	embedInSheet?: boolean
	/** embedInSheet 时 Cancel 的回调 */
	onCancel?: () => void
}

export default function BeamioAddUSDCFlow({ autoStartCoinbase, embedInSheet, onCancel }: BeamioAddUSDCFlowProps = {}) {
	const [screen, setScreen] = useState<Screen>("hub");
	const { setDarkModle, profiles,
		power, setProfiles, setBeamio, setPaymentLink, setSecureCode,  secureCode, ignoreUrl, setMyAddress, myAddress, beamio,
		setPayTag, setSendToMemo, setUsdcbalance, listenningProcess, setListenningProcess, setUsdcToUSD, usdcToUSD, usdcbalance, setPaymentLinkCode
	} = useDaemonContext()
	// Mock data (replace with real)
	const balance = usdcbalance
	const username = beamio?.accountName||''
	const address = myAddress
	const shortAddress = fmtAddr(myAddress)
	const [mode, setMode] = useState<RampMode>('onramp')
	const [amount, setAmount] = useState('0')
	const [coinbaseUrl, setCoinbaseUrl] = useState('')
	const [loading, setLoading] = useState(false)

	// Fee policy (only mention once, where it matters)
	const feeText = "0.8% (min 0.02 USDC / max 2 USDC)";

	const title = useMemo(() => {
		if (screen === "hub") return "Add USDC";
		if (screen === "coinbase") return "Finish via Coinbase";
		if (screen === "coinbase_error") return "Something went wrong";
		if (screen === "transfer") return "Transfer to Beamio";
		if (screen === "receive") return "Receive USDC";
		if (screen === "profile_qr") return "Profile QR";
		if (screen === 'coinbase_next') return "Add funds (Coinbase)";
		return "Add USDC";
	}, [screen])

	const back = () => {
		if (screen === "hub") return;
		if (screen === "coinbase_error") return setScreen("coinbase");
		return setScreen("hub");
	}

	const clickNext = async () => {
		if (!myAddress) return
		setLoading(true)
		await new Promise(executor => setTimeout(() => executor(true), 500))
		
		const params = new URLSearchParams({address: myAddress}).toString()

		try {
			const res = mode === 'onramp' ? await fetch(`${remote}/api/coinbase-token?${params}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			}) : await fetch(`${remote}/api/coinbase-token?${params}`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			})
			
			if (!res.ok) {
				setLoading(false)
				console.error('Failed to create onramp session', await res.text())
				setScreen('coinbase_error')
				return 
			}

			const { onrampUrl } = await res.json() as { onrampUrl: string }
			setLoading(false)
			if (!onrampUrl) {
				console.error('No onrampUrl in response')
				setScreen('coinbase_error')
				return 
			}
			setCoinbaseUrl(onrampUrl)
			setScreen('coinbase')
			// ⭐ 直接打开 Coinbase 返回的安全 URL（已包含 sessionToken）
			
			
		} catch (e) {
			setLoading(false)
			console.error('open coinbase onramp error', e)
			setScreen('coinbase_error')
			return 
		}
	}

	// 来自 BankingBridge Add Cash：挂载后直接执行 Add funds via Coinbase 流程
	const hasAutoStarted = useRef(false)
	useEffect(() => {
		if ((!autoStartCoinbase && !embedInSheet) || !myAddress || hasAutoStarted.current) return
		hasAutoStarted.current = true
		clickNext()
	}, [autoStartCoinbase, embedInSheet, myAddress])

	const openUrl = () => {
		const a = document.createElement('a')
		a.href = coinbaseUrl
		a.target = '_blank'
		a.rel = 'noopener noreferrer'
		document.body.appendChild(a)
		a.click()
		a.remove()
	}

	// embedInSheet：仅显示 Coinbase 确认 (204-221)，无 Header/hub
	if (embedInSheet) {
		return (
			<div className="px-4 pt-4 pb-4">
				{!myAddress && (
					<div className="flex items-center justify-center py-12 text-sm text-slate-500">Loading...</div>
				)}
				{myAddress && loading && (
					<div className="flex items-center justify-center py-12">
						<div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
					</div>
				)}
				{screen === "coinbase" && !loading && (
					<Card>
						<div className="text-sm text-slate-600">
							You’ll complete checkout with Coinbase. Verification may be required.
						</div>
						<div className="mt-4 grid grid-cols-2 gap-3">
							<ButtonSecondary onClick={() => onCancel?.()}>Cancel</ButtonSecondary>
							<ButtonPrimary onClick={openUrl}>Open Coinbase</ButtonPrimary>
						</div>
						<div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
							If Coinbase fails, you can still add USDC by transferring from another wallet/exchange.
						</div>
					</Card>
				)}
				{screen === "coinbase_error" && !loading && (
					<Card>
						<div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900">
							<AlertTriangle className="h-5 w-5 mt-0.5" />
							<div className="text-sm">Coinbase couldn’t complete this step. Try again, or use another method.</div>
						</div>
						<div className="mt-4 grid grid-cols-2 gap-3">
							<ButtonSecondary onClick={() => onCancel?.()}>Back</ButtonSecondary>
							<ButtonPrimary onClick={() => { hasAutoStarted.current = false; clickNext() }}>Try again</ButtonPrimary>
						</div>
					</Card>
				)}
			</div>
		)
	}

  return (
    <div className="mt-6">
      <div className="">
        <Header
			title={title}
			balance={balance}
			onBack={screen === "hub" ? undefined : back}
			onClose={() => setScreen("hub")}
        />

        {screen === "hub" && (
          <div className="px-4 pt-4 space-y-4">
            {/* Top highlight card (match your gradient vibe, but kept subtle) */}
            <div className="rounded-[28px] overflow-hidden border border-black/5 shadow-sm">
              <div className="bg-gradient-to-br from-[#235BFF] via-[#6A5CFF] to-[#D84CFF] p-5">
                <div className="text-white/90 text-sm font-semibold">Beamio Balance</div>
                <div className="mt-2 text-white text-[44px] font-semibold leading-none">{format2(balance)}</div>
                <div className="text-white/80 text-sm mt-1">USDC</div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-white text-xs font-semibold">
                    <span className="h-2 w-2 rounded-full bg-white/90" />
                    Gas sponsored
                  </div>
                  <div className="text-white/80 text-xs font-semibold">Base</div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <PrimaryPill
				  	loading={loading}
				   onClick={() => {
						clickNext()
				   }} label="Add funds" sub="via Coinbase" 
				   />
                  <SecondaryPill onClick={() => setScreen("receive")} label="Receive" sub="from someone" />
                </div>
              </div>
            </div>

            {/* Simple options list */}
            <div className="rounded-[28px] border border-black/5 shadow-sm bg-white">
              <div className="p-4">
                <div className="text-sm font-semibold text-slate-900">Other ways</div>

                <div className="mt-3 space-y-2">
                  <OptionRow
                    icon={<Building2 className="h-5 w-5" />}
                    title="Transfer from another wallet / exchange"
                    desc="Withdraw or send USDC on Base to your address"
                    tag="0 fee"
                    onClick={() => setScreen("transfer")}
                  />

                  <OptionRow
                    icon={<User className="h-5 w-5" />}
                    title="Ask a friend to send"
                    desc="Share @BeamioTag (direct send is 0 fee)"
                    tag="0 fee"
                    onClick={() => setScreen("receive")}
                  />

                  <OptionRow
                    icon={<QrCode className="h-5 w-5" />}
                    title="Get paid by QR"
                    desc={`Scan & Pay • Fee applies (${feeText})`}
                    tag="Fee"
                    onClick={() => setScreen("profile_qr")}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {screen === "coinbase" && (
			<div className="px-4 pt-4">
				<Card>
					<div className="text-sm text-slate-600">
						You’ll complete checkout with Coinbase. Verification may be required.
					</div>

					<div className="mt-4 grid grid-cols-2 gap-3">
						<ButtonSecondary onClick={() => setScreen("hub")}>Cancel</ButtonSecondary>
						<ButtonPrimary onClick={() => {
							openUrl()
						}}>Open Coinbase</ButtonPrimary>
					</div>

					<div className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
							If Coinbase fails, you can still add USDC by transferring from another wallet/exchange.
					</div>
				</Card>
			</div>
        )}

		{
			screen === 'coinbase_next' && (<>
				 <div className="px-4 pt-4">
					<Card>
						<StepAmount mode={mode} onBack={() => setScreen('hub')} myAddress={myAddress} onNext={(url) => {
							if (!url) {
								return setScreen('coinbase_error')
							}
							setCoinbaseUrl(url)
							setScreen('coinbase')

						}} />
					</Card>
				</div>
			</>)
		}

        {screen === "coinbase_error" && (
          <div className="px-4 pt-4">
            <Card>
              <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900">
                <AlertTriangle className="h-5 w-5 mt-0.5" />
                <div className="text-sm">
                  Coinbase couldn’t complete this step. Try again, or use another method.
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <MiniCopy label="Copy @BeamioTag" value={username} onCopy={() => copyText(username)} />
                <MiniCopy label="Copy address" value={shortAddress} onCopy={() => copyText(address)} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <ButtonSecondary onClick={() => setScreen("coinbase")}>
                  <span className="inline-flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4" /> Try again
                  </span>
                </ButtonSecondary>
                <ButtonPrimary onClick={() => setScreen("transfer")}>Transfer instead</ButtonPrimary>
              </div>
            </Card>
          </div>
        )}

        {screen === "transfer" && (
          <div className="px-4 pt-4">
            <Card>
              <div className="text-sm text-slate-600">
                Send or withdraw <b>USDC</b> on <b>Base</b> to your Beamio address.
              </div>

              <div className="mt-4 space-y-2">
                <InfoLine label="Asset" value="USDC" />
                <InfoLine label="Network" value="Base" />
                <div className="rounded-2xl bg-slate-50 p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500">Address</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{shortAddress}</div>
                  </div>
                  <button
                    className="h-10 px-3 rounded-xl border border-black/10 bg-white text-slate-900 font-semibold shadow-sm active:scale-[0.99]"
                    onClick={() => copyText(address)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Copy className="h-4 w-4" /> Copy
                    </span>
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                Make sure you select <b>Base</b> network. Sending on a different network may lose funds.
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <ButtonSecondary onClick={() => setScreen("hub")}>Done</ButtonSecondary>
                <ButtonPrimary onClick={() => copyText(address)}>Copy address</ButtonPrimary>
              </div>
            </Card>
          </div>
        )}

        {screen === "receive" && (
          <div className="px-4 pt-4">
            <Card>
              <div className="text-sm text-slate-600">
                Share your <b>@BeamioTag</b> for direct send (0 fee), or share address for other wallets.
              </div>

              <div className="mt-4 space-y-2">
                <MiniCopy label="Your @BeamioTag (Beamio direct send)" value={username} onCopy={() => copyText(username)} />
                <MiniCopy label="Your address (other wallets/exchanges)" value={shortAddress} onCopy={() => copyText(address)} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <ButtonSecondary onClick={() => setScreen("hub")}>Done</ButtonSecondary>
                <ButtonPrimary onClick={() => setScreen("profile_qr")}>Show QR</ButtonPrimary>
              </div>
            </Card>
          </div>
        )}

      {screen === "profile_qr" && (
  <div className="px-4 pt-4">
    <Card>
      <div className="text-sm text-slate-600">
        Scan to pay you. Gas is sponsored. Fee is deducted from what you receive.
      </div>

      <div className="mt-4 rounded-[28px] border border-black/5 bg-white p-4">
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900">{username}</div>
          <div className="mt-1 text-xs text-slate-500">{shortAddress}</div>
        </div>

        				{/* QR Code */}
							<div className="flex justify-center">
							<div
								className="
								w-40 h-40 rounded-2xl
								bg-slate-200 dark:bg-slate-700
								flex items-center justify-center mb-1
								md:w-48 md:h-48 md:rounded-3xl
								"
							>
								<QRCodeCanvas
								value={myAddress}
								size={160}
								level="H"
								includeMargin
								bgColor="transparent"
								fgColor="#000000"
								imageSettings={{
									src: bIcon,
									height: 40,
									width: 40,
									excavate: true,
								}}
								className="rounded-lg inline-block"
								/>
							</div>
							</div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">Fee</div>
          <div className="mt-1">{feeText} • deducted from your received amount.</div>
        </div>

        <div className="mt-4">
          <ButtonPrimary onClick={() => setScreen("hub")}>Done</ButtonPrimary>
        </div>
      </div>
    </Card>
  </div>
)}

      </div>
    </div>
  );
}





/* ---------------- UI blocks (closer to your screenshots) ---------------- */

function Header({
  title,
  balance,
  onBack,
  onClose,
}: {
	title: string;
	balance: number;
	onBack?: () => void;
	onClose: () => void;
}) {
  return (
    <div className="">
		<div className="px-4 pt-4">
			<div className="relative flex items-center justify-between">

				{/* 中间标题 */}
				<div className="absolute left-1/2 -translate-x-1/2 text-center">
					<div className="text-xs tracking-widest text-slate-300">BEAMIO</div>
					<div className="text-[20px] font-semibold text-slate-900">
						{title}
					</div>
				</div>

			</div>
		</div>

		<div className="px-4 pt-3">
			<div className="h-[1px]" />
		</div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
	return (
		<div className="rounded-[28px] border border-black/5 shadow-sm bg-white p-4">
		{children}
		</div>
	);
}

function OptionRow({
  icon,
  title,
  desc,
  tag,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tag?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-[22px] border border-black/5 bg-white hover:bg-slate-50 transition shadow-sm p-4 text-left active:scale-[0.995]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-white border border-black/5 shadow-sm grid place-items-center text-slate-700">
            {icon}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="mt-0.5 text-sm text-slate-500">{desc}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tag ? (
            <span className="rounded-full bg-white border border-black/5 px-2 py-1 text-[11px] font-semibold text-slate-600">
              {tag}
            </span>
          ) : null}
          <ChevronRight className="h-5 w-5 text-slate-300" />
        </div>
      </div>
    </button>
  );
}

function MiniCopy({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-slate-50 p-4 flex items-center justify-between gap-3">
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
      </div>
      <button
        className="h-10 px-3 rounded-xl border border-black/10 bg-white text-slate-900 font-semibold shadow-sm active:scale-[0.99]"
        onClick={onCopy}
      >
        <span className="inline-flex items-center gap-2">
          <Copy className="h-4 w-4" /> Copy
        </span>
      </button>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-slate-50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ButtonPrimary({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={`h-[50px] w-full rounded-[18px] bg-[#1877FF] text-white font-semibold shadow-sm active:scale-[0.99] ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}


function ButtonSecondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className="h-[50px] rounded-[18px] border border-black/10 bg-white text-slate-900 font-semibold shadow-sm active:scale-[0.99]"
      onClick={onClick}
    >
      {children}
    </button>
  );
}


function PrimaryPill({
  label,
  sub,
  loading = false,
  onClick
}: {
  label: string
  sub: string
  loading?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={!loading ? onClick : undefined}
      disabled={loading}
      className={`
        h-[54px]
        rounded-[18px]
        bg-white
        text-slate-900
        font-semibold
        shadow-sm
        flex flex-col
        items-center
        justify-center
        transition
        active:scale-[0.99]
        ${loading ? 'opacity-80 cursor-not-allowed' : ''}
      `}
    >
      {loading ? (
        /* Loading spinner */
        <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
      ) : (
        <>
          <div className="text-[15px]">{label}</div>
          <div className="text-[11px] text-slate-500 -mt-0.5">{sub}</div>
        </>
      )}
    </button>
  )
}

function SecondaryPill({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-[54px] rounded-[18px] border border-white/30 bg-white/15 text-white font-semibold shadow-sm active:scale-[0.99] flex flex-col items-center justify-center"
    >
      <div className="text-[15px]">{label}</div>
      <div className="text-[11px] text-white/80 -mt-0.5">{sub}</div>
    </button>
  );
}

/* ---------------- helpers ---------------- */

function format2(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return (Math.round(v * 100) / 100).toFixed(2);
}

function copyText(text: string) {
  try {
    navigator.clipboard?.writeText(text);
  } catch {}
}
