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

import React, { useState, useEffect } from 'react'


export default function BeamioSettingsScreen({
  onClose,
}: {
  onClose: () => void
}) {


	const [settingsOpen, setReceiveOpen] = useState(false)

	const sectionTitleClass =
		"px-4 pt-6 pb-2 text-xs font-semibold text-slate-400 tracking-[0.12em] uppercase"
	const rowClass =
		"flex items-center justify-between px-4 h-12 bg-white active:bg-slate-50 border-b border-slate-100"
	const leftClass = "flex items-center gap-3"
	const iconWrapperClass =
		"flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500"

  	return (
		<div className="h-full flex flex-col bg-slate-50 text-slate-900">
      {/* Top nav */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-white/95 backdrop-blur border-b border-slate-100">
        <BeamioNavBack title="Settings" onClose={() => onClose()} />
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
            <span>Version 0.1.0 · MVP</span>
            <span>Early access · in testing</span>
          </div>
        </section>


			{/* Preferences */}
			<h2 className={sectionTitleClass}>Preferences</h2>
			<div className="bg-white border-y border-slate-100">
				<button className={rowClass}>
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

				<button className={rowClass}>
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

				<button className={rowClass}>
				<div className={leftClass}>
					<span className={iconWrapperClass}>
					<CreditCard className="h-4 w-4" />
					</span>
					<div className="flex flex-col items-start">
					<span className="text-sm font-medium">Payment methods</span>
					<span className="text-xs text-slate-500">
						Connect Coinbase, bank or cards
					</span>
					</div>
				</div>
				<ChevronRight className="h-4 w-4 text-slate-300" />
				</button>

				<button className={rowClass}>
				<div className={leftClass}>
					<span className={iconWrapperClass}>
					<Smartphone className="h-4 w-4" />
					</span>
					<div className="flex flex-col items-start">
					<span className="text-sm font-medium">Cashcodes &amp; links</span>
					<span className="text-xs text-slate-500">
						Default memo &amp; expiry for links
					</span>
					</div>
				</div>
				<ChevronRight className="h-4 w-4 text-slate-300" />
				</button>
			</div>

			{/* Security & privacy */}
			<h2 className={sectionTitleClass}>Security &amp; privacy</h2>
			<div className="bg-white border-y border-slate-100">
				<button className={rowClass}>
				<div className={leftClass}>
					<span className={iconWrapperClass}>
					<Lock className="h-4 w-4" />
					</span>
					<div className="flex flex-col items-start">
					<span className="text-sm font-medium">Passkey &amp; Face ID</span>
					<span className="text-xs text-slate-500">
						Sign-in passkey, Face ID, session timeout
					</span>
					</div>
				</div>
				<ChevronRight className="h-4 w-4 text-slate-300" />
				</button>

				<button className={rowClass}>
				<div className={leftClass}>
					<span className={iconWrapperClass}>
					<Shield className="h-4 w-4" />
					</span>
					<div className="flex flex-col items-start">
					<span className="text-sm font-medium">Legal &amp; Privacy</span>
					<span className="text-xs text-slate-500">
						What Beamio can see, and legal documents
					</span>
					</div>
				</div>
				<ChevronRight className="h-4 w-4 text-slate-300" />
				</button>

				<button className={rowClass}>
				<div className={leftClass}>
					<span className={iconWrapperClass}>
					<Bell className="h-4 w-4" />
					</span>
					<div className="flex flex-col items-start">
					<span className="text-sm font-medium">Notifications</span>
					<span className="text-xs text-slate-500">
						Payment alerts, security alerts, email
					</span>
					</div>
				</div>
				<ChevronRight className="h-4 w-4 text-slate-300" />
				</button>
			</div>

			{/* Reporting */}
			<h2 className={sectionTitleClass}>Reporting</h2>
			<div className="bg-white border-y border-slate-100">
				<button className={rowClass}>
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
				<button className={rowClass}>
				<div className={leftClass}>
					<span className={iconWrapperClass}>
					<HelpCircle className="h-4 w-4" />
					</span>
					<div className="flex flex-col items-start">
					<span className="text-sm font-medium">Get help</span>
					<span className="text-xs text-slate-500">
						Help center, contact support, report an issue
					</span>
					</div>
				</div>
				<ChevronRight className="h-4 w-4 text-slate-300" />
				</button>
			</div>
			</div>
		</div>
	)
}