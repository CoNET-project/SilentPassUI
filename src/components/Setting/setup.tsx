import {
  ArrowLeft,
  ChevronRight,
  User,
  Lock,
  Bell,
  CreditCard,
  Shield,
  HelpCircle,
  Globe2,
  Smartphone,
  FileText,
} from "lucide-react";
import BeamioNavBack from './BeamioNavBack'
import {motion, AnimatePresence } from "framer-motion"
import React, { useState, useEffect } from 'react'
import BeamioAccountScreen from "./BeamioAccountScreen"
import BeamioRegionCurrencyScreen from "./BeamioRegionCurrencyScreen"
import BeamioPaymentMethodsScreen from "./BeamioPaymentMethodsScreen"
import BeamioCashcodesLinksSettingsScreen from "./BeamioCashcodesLinksSettingsScreen";
import BeamioPasskeyFaceIDSettingsScreen from "./BeamioPasskeyFaceIDSettingsScreen";
import BeamioPrivacySettingsScreen from "./BeamioPrivacySettingsScreen";
import BeamioNotificationsSettingsScreen from "./BeamioNotificationsSettingsScreen";
import BeamioStatementsReportingScree from "./BeamioStatementsReportingScreen";
import BeamioGetHelpSettingsScreen from "./BeamioGetHelpSettingsScreen";
import PrivateKey from './PrivateKey/PrivateKey'
import { useDaemonContext } from '@/providers/DaemonProvider'
import RecoveryBackupScreen from './RecoveryBackupScreen'
import { tu } from '@/locale/beamioLocale'


export type IMenu = ''|'Account'|'Region'|'支付'|'Cashcodes'|'Passkey'|'隐私'|'通知'|'Statement'|'Help'|'privateKey'|'backup'|'RecoveryBackupScreen'|'RecoveryQRDetailScreen'|'ChangePIN'

export default function BeamioSettingsScreen({
  	onClose,
}: {
  	onClose: () => void
}) {

	const { darkModle, setDarkModle, setProfiles, beamio, setBeamio, profiles } = useDaemonContext()
	const [settingsOpen, setSettingsOpen] = useState<IMenu>('')

	const sectionTitleClass =
		"px-4 pt-6 pb-2 text-xs font-semibold text-slate-400 tracking-[0.12em] uppercase"
	const rowClass =
		"w-full flex items-center justify-between px-4 py-3 active:bg-slate-50 transition"
	const leftClass = "flex items-center gap-3"
	const iconWrapperClass =
		"flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500"

	const getPrivatekey = (): string => {
		const profile = profiles[0]
		if (!profile || !profile?.privateKeyArmor) return ''
		const ret = profile.privateKeyArmor.replace(/^0x/i, '')
		return ret
	}

  	return (
		<div className="h-full flex flex-col bg-slate-50 text-slate-900">
			{
				!settingsOpen && (
					<>
						{/* Top nav */}
						<header className="">
							<BeamioNavBack 
							title={tu('settings')} onClose={() => onClose()}
							onMore={() => {

							}}
							 />
						</header>

						{/* 👇 这里是可以滚动的内容区域 */}
						<div className="flex-1 min-h-0 overflow-y-auto">
							{/* Brand strip */}
							<section className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
								<div>
									<p className="text-sm font-semibold">Beamio · 0-gas USDC on Base</p>
									<p className="text-xs text-slate-500">
										Non-custodial passkey wallet · no centralized user database
									</p>
								</div>
								<div className="flex flex-col items-end text-right text-[10px] text-slate-400 leading-tight">
									<span>Version 0.3.7 · MVP</span>
									<span>早期体验 · 测试中</span>
								</div>
							</section>


							{/* Preferences */}
							<h2 className={sectionTitleClass}>Preferences</h2>
							<div className="bg-white border-y border-slate-100">
								<button 
									className={rowClass}
									onClick={() => {
										setSettingsOpen('Account')
									}}
								>
									<div className={leftClass}>
										<span className={iconWrapperClass}>
											<User className="h-4 w-4" />
										</span>
										<div className="flex flex-col items-start">
											<span className="text-sm font-medium">Account</span>
											<span className="text-xs text-slate-500">
												Name, @handle, profile photo
											</span>
										</div>
									</div>
									<ChevronRight className="h-4 w-4 text-slate-300" />
								</button>

								<button 
									className={rowClass}
									onClick={() => {
										setSettingsOpen('Region')
									}}
								>
									<div className={leftClass}>
										<span className={iconWrapperClass}>
										<Globe2 className="h-4 w-4" />
										</span>
										<div className="flex flex-col items-start">
										<span className="text-sm font-medium">Region &amp; currency</span>
										<span className="text-xs text-slate-500">
											Country, language, default stablecoin
										</span>
										</div>
									</div>
									<ChevronRight className="h-4 w-4 text-slate-300" />
								</button>

								<button className={rowClass}
									onClick={() => {
										setSettingsOpen('支付')
									}}
								>
									<div className={leftClass}>
										<span className={iconWrapperClass}>
										<CreditCard className="h-4 w-4" />
										</span>
										<div className="flex flex-col items-start">
											<span className="text-sm font-medium">支付方式</span>
											<span className="text-xs text-slate-500">
												Connect Coinbase, bank or cards
											</span>
										</div>
									</div>
									<ChevronRight className="h-4 w-4 text-slate-300" />
								</button>

								<button className={rowClass}
									onClick={() => {
										setSettingsOpen('Cashcodes')
									}}
								
								>
									<div className={leftClass}>
										<span className={iconWrapperClass}>
											<Smartphone className="h-4 w-4" />
										</span>
										<div className="flex flex-col items-start">
											<span className="text-sm font-medium">Cashcodes &amp; links</span>
											<span className="text-xs text-slate-500">
												Default for links
											</span>
										</div>
									</div>
									<ChevronRight className="h-4 w-4 text-slate-300" />
								</button>
							</div>

						{/* Security & BACKUP */}
						<h2 className={sectionTitleClass}>SECURITY &amp; BACKUP</h2>
						<div className="bg-white border-y border-slate-100">
							<button className={rowClass}
								onClick={() => {
									setSettingsOpen('Passkey')
								}}
							>
								<div className={leftClass}>
									<span className={iconWrapperClass}>
									<Lock className="h-4 w-4" />
									</span>
									<div className="flex flex-col items-start">
									<span className="text-sm font-medium">Passkey &amp; Face ID</span>
									<span className="text-xs text-slate-500">
										Sign-in, session timeout
									</span>
									</div>
								</div>
								<ChevronRight className="h-4 w-4 text-slate-300" />
							</button>
							
							<button className={rowClass}
								onClick={() => {
									setSettingsOpen('RecoveryBackupScreen')
								}}
							>
								<div className={leftClass}>
									<span className={iconWrapperClass}>
										<Shield className="h-4 w-4" />
									</span>
									<div className="flex flex-col items-start">
										<span className="text-sm font-medium">Backup & export</span>
										<span className="text-xs text-slate-500">
											Recovery QR, code (S), change PIN
										</span>
									</div>
								</div>
								<ChevronRight className="h-4 w-4 text-slate-300" />
							</button>


							<button className={rowClass}
								onClick={() => {
									setSettingsOpen('privateKey')
								}}
							>
								<div className={leftClass}>
									<span className={iconWrapperClass}>
									<Shield className="h-4 w-4" />
									</span>
									<div className="flex flex-col items-start">
									<span className="text-sm font-medium">private key</span>
									<span className="text-xs text-slate-500">
										export your private key (advanced)
									</span>
									</div>
								</div>
								<ChevronRight className="h-4 w-4 text-slate-300" />
							</button>
						</div>


						{/* PRIVACY & NOTIFICATIONS */}
						<h2 className={sectionTitleClass}>privacy &amp; notifications</h2>
						<div className="bg-white border-y border-slate-100">

							<button className={rowClass}
								onClick={() => {
									setSettingsOpen('隐私')
								}}
							>
								<div className={leftClass}>
									<span className={iconWrapperClass}>
									<Shield className="h-4 w-4" />
									</span>
									<div className="flex flex-col items-start">
									<span className="text-sm font-medium">Legal &amp; Privacy</span>
									<span className="text-xs text-slate-500">
										What Beamio can see, documents
									</span>
									</div>
								</div>
								<ChevronRight className="h-4 w-4 text-slate-300" />
							</button>

							<button className={rowClass}
								onClick={() => {
									setSettingsOpen('通知')
								}}
							>
								<div className={leftClass}>
									<span className={iconWrapperClass}>
									<Bell className="h-4 w-4" />
									</span>
									<div className="flex flex-col items-start">
									<span className="text-sm font-medium">通知</span>
									<span className="text-xs text-slate-500">
										Payment alerts, security alerts
									</span>
									</div>
								</div>
								<ChevronRight className="h-4 w-4 text-slate-300" />
							</button>
						</div>

						{/* Reporting */}
						<h2 className={sectionTitleClass}>Reporting</h2>
						<div className="bg-white border-y border-slate-100">
							<button className={rowClass}
								onClick={() => {
									setSettingsOpen('Statement')
								}}
							>
							
							<div className={leftClass}>
								<span className={iconWrapperClass}>
								<FileText className="h-4 w-4" />
								</span>
								<div className="flex flex-col items-start">
								<span className="text-sm font-medium">Statements</span>
								<span className="text-xs text-slate-500">
									Export wallet statements (planned)
								</span>
								</div>
							</div>
							<ChevronRight className="h-4 w-4 text-slate-300" />
							</button>
						</div>

						{/* Support */}
						<h2 className={sectionTitleClass}>Support</h2>
						<div className="bg-white border-y border-slate-100 mb-10">
							<button className={rowClass}
								onClick={() => {
									setSettingsOpen('Help')
								}}
							>
							<div className={leftClass}>
								<span className={iconWrapperClass}>
								<HelpCircle className="h-4 w-4" />
								</span>
								<div className="flex flex-col items-start">
								<span className="text-sm font-medium">获取帮助</span>
								<span className="text-xs text-slate-500">
									Help center, contact support, report an issue
								</span>
								</div>
							</div>
							<ChevronRight className="h-4 w-4 text-slate-300" />
							</button>
						</div>
						</div>
					</>
				)
			}
			
			<AnimatePresence>
				{settingsOpen && (
					<motion.div
						className="
							fixed inset-0 z-[60]      /* ⬅️ increase z-index */
							bg-white dark:bg-slate-900
							flex flex-col
						"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{ duration: 0.28, ease: "easeOut" }}
					>
						{/* 顶部 Header */}
						<BeamioNavBack
							title={settingsOpen === 'Account' ? 'Account' : ''}
							onClose={() => {
								setSettingsOpen('')
							}}
							onMore={() => {
								
							}}
						/>

					{/* 内容区域：放你的 BeamioAccountScreen */}
						<div className="flex-1 overflow-y-auto ">
							
							{/* {
								settingsOpen === 'RecoveryQRDetailScreen' && <RecoveryQRDetailScreen colse={() => setSettingsOpen('')} />
							} */}
							{
								settingsOpen === 'RecoveryBackupScreen' && <RecoveryBackupScreen colse={(val) => {
									setSettingsOpen(val)
								}} />
							}
							{
								settingsOpen === 'Account' && <BeamioAccountScreen colse={(bo: beamio) => {
									setSettingsOpen('')
								}} />
							}
							{
								settingsOpen === 'Region' && <BeamioRegionCurrencyScreen colse={() => {
									setSettingsOpen('')
								}} />
							}
							{
								settingsOpen === '支付' && <BeamioPaymentMethodsScreen colse={() => setSettingsOpen('')} />
							}
							{
								settingsOpen === 'Cashcodes' && <BeamioCashcodesLinksSettingsScreen colse={() => setSettingsOpen('')} />
							}
							{
								settingsOpen === 'Passkey' && <BeamioPasskeyFaceIDSettingsScreen colse={() => setSettingsOpen('')} />
							}
							{
								settingsOpen === '隐私' && <BeamioPrivacySettingsScreen colse={() => setSettingsOpen('')} />
							}
							{
								settingsOpen === '通知' && <BeamioNotificationsSettingsScreen colse={() => setSettingsOpen('')} />
							}

							{
								settingsOpen === 'Statement' && <BeamioStatementsReportingScree colse={() => setSettingsOpen('')} />
							}
							{
								settingsOpen === 'Help' && <BeamioGetHelpSettingsScreen colse={() => setSettingsOpen('')} />
							}
							{
								settingsOpen === 'privateKey' && <PrivateKey privateKey={getPrivatekey()} onClose={() => setSettingsOpen('')}  />
							}


							
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	)
}