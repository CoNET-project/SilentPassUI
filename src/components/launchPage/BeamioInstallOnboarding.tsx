import React, { useState, useEffect } from "react";
import beamioIcon from '@/components/assets/32x32.svg'
// Beamio onboarding: "Install before using" screen
// Optimized UI for guiding users to install Beamio as a web app or use Chrome on desktop
import {isStandalone, MobileType, checkStorage } from '@/services/beamio'
import BeamioOnboardingModal from '@/pages/Home/LoadingPage'
import { useDaemonContext } from "@/providers/DaemonProvider"
import {AppButton} from '../button/AppButton'

import {Route,Routes,useNavigate,useLocation,MemoryRouter as Router} from 'react-router-dom';
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{
	outcome: 'accepted' | 'dismissed'
	platform: string
  }>
}

const BeamioInstallOnboarding: React.FC = () => {
	const { profiles, setDarkModle, darkModle, beamio, power, setProfiles, setBeamio, setPaymentLink, paymentLink, beamioAppInstalled} = useDaemonContext()
  	const [activeTab, setActiveTab] = useState<"ios" | "android" | "desktop">(MobileType())
	const [installed, setInstalled] = useState(MobileType() === 'desktop' ? true : false)
	const [canInstall, setCanInstall] = useState(false)
	    const [showPostInstallTips, setShowPostInstallTips] = useState(MobileType() === 'desktop' ? true : false)
	const navigate = useNavigate()
	const [installPromptEvent, setInstallPromptEvent] = 
		useState<BeforeInstallPromptEvent | null>(null)
		  // 平台判断，只用于文案
	const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
	const platform = typeof navigator !== 'undefined' ? navigator.platform : ''

	const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/i.test(platform)
	const isWindows = /Win/i.test(platform)
	const isAndroid = /Android/i.test(ua)
	const isIOS = /iPhone|iPad|iPod/i.test(ua)

	const checkLocal= async () => {
		const CoNETData: encrypt_keys_object = await checkStorage()
		if ( CoNETData && CoNETData?.beamio) {
			return navigate('/')
		}
	}

	useEffect(() => {
		checkLocal()
		
		if (isStandalone) {
			
			setInstalled(true)
			
			return 
		}


		const handleBeforeInstallPrompt = (e: Event) => {
			e.preventDefault()
			setInstalled(false)
			
			const event = e as BeforeInstallPromptEvent
			setInstallPromptEvent(event)
			
		}

		const handleAppInstalled = () => {
			
			setInstalled(true)
			
			setInstallPromptEvent(null)
			
		}

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
		window.addEventListener('appinstalled', handleAppInstalled)

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
			window.removeEventListener('appinstalled', handleAppInstalled)
		}
	}, [])

	const handleInstallClick = async () => {
		if (!installPromptEvent) return
	
		const event = installPromptEvent
		setInstallPromptEvent(null)
		setCanInstall(false)
	
		await event.prompt()
		const choice = await event.userChoice
	
		console.log('User choice', choice.outcome)
	
		if (choice.outcome === 'accepted') {
			// 用户点了安装，一般也会触发 appinstalled 事件
			setInstalled(true)
			setShowPostInstallTips(true)
		}
	}

	return (
		<>
			{

				installed ? <BeamioOnboardingModal home={() => {
					if (MobileType() === 'desktop') {
						navigate('/')
					}
				}}/> : 
				<div className="flex justify-center px-4 py-8">
					{/* 滚动容器：限制最大高度 + 内部滚动 */}
					<div className="w-full max-w-lg max-h-[calc(100vh-4rem)] overflow-y-auto p-6 md:p-8 
						/* ⭐ 给 Footer 留出空间 */
					">
						{/* Title + subtitle */}
						<h1 className="text-2xl md:text-3xl font-semibold text-slate-900 mb-2">
						Install Beamio before you start
						</h1>
						<p className="text-sm md:text-base text-slate-600 mb-5 md:mb-6 leading-relaxed">
						To keep your wallet stable and avoid different wallet addresses, please install Beamio
						on mobile or use Google Chrome on desktop. On mobile, your wallet will only be created
						inside the installed Beamio app.
						</p>

						{/* Tabs for iOS / Android / Desktop instructions */}
						<div className="mb-4">
						<div className="inline-flex rounded-full bg-slate-100 p-1 text-xs md:text-sm mb-4">
							<button
							type="button"
							onClick={() => setActiveTab("ios")}
							className={`px-3.5 md:px-4 py-1.5 rounded-full transition font-medium ${
								activeTab === "ios" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
							}`}
							>
							iPhone
							</button>
							<button
							type="button"
							onClick={() => setActiveTab("android")}
							className={`px-3.5 md:px-4 py-1.5 rounded-full transition font-medium ${
								activeTab === "android" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
							}`}
							>
							Android
							</button>
							<button
								type="button"
								onClick={() => setActiveTab("desktop")}
								className={`px-3.5 md:px-4 py-1.5 rounded-full transition font-medium ${
									activeTab === "desktop" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
								}`}
							>
							Desktop
							</button>
						</div>

						{/* Instruction card */}
						<div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 md:px-5 md:py-4 text-sm text-slate-700 leading-relaxed min-h-[152px]">
							{activeTab === "ios" && (
							<ol className="list-decimal list-inside space-y-1.5">
								<li>
								Open <span className="font-medium">beamio.app</span> in{" "}
								<span className="font-medium">Safari</span> on your iPhone.
								</li>
								<li>
								Tap the <span className="font-medium">Share</span> button at the bottom of Safari.
								</li>
								<li>
								Choose <span className="font-medium">“Add to Home Screen”.</span>
								</li>
								<li>
								Tap <span className="font-medium">Add</span>, then find the Beamio icon on your Home
								Screen and open it to finish setup.
								</li>
							</ol>
							)}

							{activeTab === "android" && (
							<ol className="list-decimal list-inside space-y-1.5">
								<li>
								Open <span className="font-medium">beamio.app</span> in{" "}
								<span className="font-medium">Chrome</span> on your Android phone.
								</li>
								<li>
								Tap the <span className="font-medium">⋮</span> menu in the top-right corner.
								</li>
								<li>
								Tap <span className="font-medium">“Add to Home screen”.</span>
								</li>
								<li>
								When prompted, choose <span className="font-medium">“Install”</span> (recommended).
								Avoid <span className="font-medium"> “Create shortcut”</span>, which only opens Beamio
								inside Chrome.
								</li>
								<li>
								After installing, open Beamio from the new icon to finish setup.
								</li>
							</ol>
							)}

							{activeTab === "desktop" && (
							<ol className="list-decimal list-inside space-y-1.5">
								<li>
								Open <span className="font-medium">beamio.app</span> on your computer.
								</li>
								<li>
								In <span className="font-medium">Google Chrome (recommended)</span>, you can click the
								<span className="font-medium"> “Install app”</span> button to open Beamio in its own
								window.
								</li>
								<li>
								In <span className="font-medium">Safari on macOS</span>, you can use
								<span className="font-medium"> Share → “Add to Dock”</span> to create a Beamio web app
								icon.
								</li>
								<li>
								To pay with a third-party wallet, open
								<span className="font-medium"> Beamio payment links</span> directly in Google Chrome
								and use a wallet extension (e.g. Coinbase Wallet, MetaMask). Third-party wallets are
								only supported for payment links in the browser, not inside any Beamio app window.
								</li>
								<li>
								Cashcodes can only be redeemed with your{" "}
								<span className="font-medium">Beamio wallet</span>, on mobile or desktop. Third-party
								wallets cannot redeem Cashcodes.
								</li>
							</ol>
							)}
						</div>
						</div>

						{/* Info + warnings */}
						<div className="space-y-2 mb-6 text-xs md:text-sm text-slate-600">
						<div className="flex items-start gap-2">
							<span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400 text-[11px] font-semibold text-emerald-600">
							✓
							</span>
							<p>
							Your Beamio wallet is <span className="font-medium">self-custodial</span>. We never take
							custody of your funds.
							</p>
						</div>
						<div className="flex items-start gap-2">
							<span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-400 text-[11px] font-semibold text-amber-600">
							!
							</span>
							<p>
							To avoid creating multiple wallets on mobile, always open Beamio from the
							<span className="font-medium"> Home Screen / installed app icon</span> after installing.
							</p>
						</div>
						</div>
						{
							MobileType() !== 'ios' && <AppButton
								onClick={handleInstallClick}
								fullWidth
								className="
									inline-flex items-center px-3 py-1.5 rounded-full
									bg-blue-600 text-white text-xs font-semibold
									active:scale-95 transition-transform
								"
								>
								Install Beamio App
								</AppButton>
						}
						

						<p className="mt-3 text-[11px] md:text-xs text-center text-slate-400">
						During the Beamio alpha, you can also continue in the browser without installing, but we
						recommend these setups for the most stable wallet experience.
						</p>
							{/* ⬇⬇⬇ 关键：为固定 Footer 预留可滚动空间 ⬇⬇⬇ */}
						<div className="h-24 md:h-28" aria-hidden="true" />
					</div>
				</div>
			}

		{/* 安装后提示弹窗 */}
		{showPostInstallTips && (
			<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto">
				<div className="w-[90%] max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-xl p-4">
				<div className="flex justify-between items-center mb-2">
					<h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
					Beamio installed 🎉
					</h2>
					<button
					className="text-xs text-slate-400 hover:text-slate-600"
					onClick={() => setShowPostInstallTips(false)}
					>
					Close
					</button>
				</div>

				{isMac && (
					<div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 space-y-1">
					<p>To keep Beamio in your Dock:</p>
					<ol className="list-decimal list-inside space-y-1">
						<li>Open Beamio from Launchpad or Chrome Apps.</li>
						<li>Right-click the Beamio icon in the Dock.</li>
						<li>Select “Options” → “Keep in Dock”.</li>
					</ol>
					</div>
				)}

				{isWindows && (
					<div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 space-y-1">
					<p>To add Beamio as a desktop shortcut:</p>
					<ol className="list-decimal list-inside space-y-1">
						<li>Open the Start Menu and search “Beamio”.</li>
						<li>Right-click → “Pin to taskbar” or “More → Open file location”.</li>
						<li>Right-click the app → “Send to → Desktop (create shortcut)”.</li>
					</ol>
					</div>
				)}

				{isAndroid && (
					<div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 space-y-1">
					<p>Beamio has been added to your Home Screen.</p>
					<p>You can long-press the icon and move it to your favorite dock area.</p>
					</div>
				)}

				{isIOS && (
					<div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 space-y-1">
					<p>Beamio has been added to your Home Screen.</p>
					<p>Long-press the icon → “Edit Home Screen” to move it to the Dock.</p>
					</div>
				)}

				{!isMac && !isWindows && !isAndroid && !isIOS && (
					<p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
					Beamio is installed. You can find it in your installed apps and pin it to your Home Screen, Dock, or taskbar.
					</p>
				)}

				<div className="mt-3 flex justify-end">
					<button
					onClick={() => setShowPostInstallTips(false)}
					className="px-3 py-1.5 text-xs rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
					>
					OK
					</button>
				</div>
				</div>
			</div>
			)}
		</>
	)
}

export default BeamioInstallOnboarding;
