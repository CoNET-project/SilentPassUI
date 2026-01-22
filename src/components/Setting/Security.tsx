
import React, { useState, useEffect } from 'react'
import { ChevronRight, RefreshCcw, KeyRound } from "lucide-react"
import NavigateLeftButton from '@/components/navigate'
import Privatekey from './PrivateKey/PrivateKey'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { restoreWithUserPin } from '@/services/beamio'
import RecoverQRReveal from './PrivateKey/recoverQR'


type SecurityProps = {
  onRegenerateRecoveryQR?: () => void
  onViewPrivateKey?: () => void
  className?: string
}

type ItemProps = {
  icon: React.ReactNode
  title: string
  subtitle: string
  onClick?: () => void
}

function WaterDropIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-12 w-12">
      {/* 水滴底 */}
      <div
        className="
          absolute inset-0 rounded-[18px]
          bg-white/18
          ring-1 ring-white/35
          shadow-[0_10px_30px_rgba(15,23,42,0.10)]
          backdrop-blur-[6px]
        "
      />
      {/* 高光：左上角一小片 */}
      <div
        className="
          absolute left-[7px] top-[7px]
          h-5 w-7
          rounded-full
          bg-white/35
          blur-[0.2px]
          opacity-70
          rotate-[-12deg]
        "
      />
      {/* 内部柔光 */}
      <div
        className="
          absolute inset-[7px]
          rounded-[14px]
          bg-white/10
        "
      />
      {/* icon */}
      <div className="relative z-10 h-full w-full flex items-center justify-center text-slate-900">
        {children}
      </div>
    </div>
  )
}

function SecurityItem({ icon, title, subtitle, onClick }: ItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        w-full text-left
        px-5 py-4
        flex items-center justify-between gap-4
        active:scale-[0.99]
        transition
      "
    >
      <div className="flex items-center gap-4">
        {icon}

        <div className="min-w-0">
          <div className="text-[18px] font-semibold text-slate-900 leading-tight">
            {title}
          </div>
          <div className="text-[13px] text-slate-500 leading-snug mt-0.5">
            {subtitle}
          </div>
        </div>
      </div>

      <ChevronRight className="h-5 w-5 text-slate-300 shrink-0" strokeWidth={2.5} />
    </button>
  )
}

export default function Security({
	
  	className = ""
}: SecurityProps) {
	const { darkModle, setDarkModle, setProfiles, beamio, setBeamio, profiles, setShowFooter, setNavigateLeftButtonArray } = useDaemonContext()
	const [settingsOpen, setSettingsOpen] = useState<''|'Recovery'|'recoverQR'>('')
	const [loading, setLoading] = useState(false)
	const [privateKey, setPrivateKey] = useState('')



  return (
    <div className={`w-full bg-white ${className}`}>
      <div className="mx-auto w-full max-w-[560px] px-5 py-6">
        <div
          className="
            rounded-3xl
            bg-white
            ring-1 ring-slate-200
            shadow-[0_18px_55px_rgba(15,23,42,0.08)]
            overflow-hidden
          "
        >
          <SecurityItem
            onClick={() => {
				setSettingsOpen('recoverQR')
				setShowFooter(false)
				setNavigateLeftButtonArray([{
					title: '',
					action: [
						// () => navigate('/History'),
						() => setSettingsOpen(''),
						() => setShowFooter(true)
					]
				}])
			}}
            icon={
              <WaterDropIcon>
                <RefreshCcw className="h-5 w-5" strokeWidth={2.4} />
              </WaterDropIcon>
            }
            title="Regenerate Recovery QR"
            subtitle="Rotate your backup keys"
          />

          <div className="h-px bg-slate-200/70" />

          <SecurityItem
            onClick={() => {
				setSettingsOpen('Recovery')
				setShowFooter(false)
				setNavigateLeftButtonArray([{
					title: '',
					action: [
						// () => navigate('/History'),
						() => setSettingsOpen(''),
						() => setShowFooter(true)
					]
				}])
			}}
            icon={
              <WaterDropIcon>
                <KeyRound className="h-5 w-5" strokeWidth={2.4} />
              </WaterDropIcon>
            }
            title="View Private Key"
            subtitle="Advanced users only"
          />
        </div>
      </div>
	  		<div
			className={[
				"pt-[env(safe-area-inset-top)]",
				'pb-[env(safe-area-inset-bottom)]',
				'pl-[env(safe-area-inset-left)]',
				'pr-[env(safe-area-inset-right)]',
				"fixed inset-0 z-40 flex-1 overflow-y-auto",
				"transition-transform duration-300 ease-out",
				(!!settingsOpen) ? "translate-x-0" : "translate-x-full",
			].join(" ")}
		>

			{/* Header：返回 + 居中标题 */}
			<div
				className="
					absolute
					top-[env(safe-area-inset-top)]
					left-0 right-0
					h-14
					flex items-center
					px-4
					z-50
					bg-transparent
					pointer-events-none
				"
			>
				<div className="
					fixed
					top-0 left-0 right-0
					z-50
					bg-transparent
					pointer-events-none
				">
					<div className="
						px-4
						pt-[calc(env(safe-area-inset-top)+8px)]
						pb-2
						pointer-events-auto
					">
						<NavigateLeftButton />
					</div>
				</div>

				
			</div>
			<div className="flex-1 mt-14">
				
				{
					settingsOpen === 'Recovery' && 
					<Privatekey
						privateKey={privateKey}
						onClose={() => {
							
						}}
					/>
				}

				{
					settingsOpen === 'recoverQR' && 
					<RecoverQRReveal
					/>
				}

				

			</div>
		</div>
    </div>
  )
}
