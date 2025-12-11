import ScreenShell from './ScreenShell'
import { AppButton } from '../button/AppButton'
import { useDaemonContext } from '@/providers/DaemonProvider'
import React, { useState, useEffect } from 'react'

type prof = {
	colse: () => void
}

const GhostButton: React.FC<{ label: string }> = ({ label }) => (
  <button className="h-9 rounded-xl border border-slate-200 text-[12px] text-slate-700 bg-slate-50 flex items-center justify-center px-3 active:bg-slate-100">
    {label}
  </button>
);

const RecoveryQRDetailScreen: React.FC<prof> = ({colse}) => {
	const { beamio} = useDaemonContext()
	const [beamioData, setBeamioData] = useState()
	

	return (
		 <ScreenShell
      title="Recovery QR"
      subtitle="Use this QR together with your PIN to restore your Beamio wallet on a new device."
    >
      <div className="flex flex-col items-center gap-3 mt-1">
        <div className="w-40 h-40 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
          <div className="w-28 h-28 bg-slate-300" />
        </div>
        <div className="text-[11px] text-slate-500 text-center px-4">
          Save this QR somewhere safe — printed on paper or stored in a secure
          place. Do not share it with anyone. Combined with your PIN, it can
          fully restore this wallet.
        </div>

        {/* Recovery code 片段显示 */}
        <div className="w-full mt-2">
          <label className="text-[11px] font-medium text-slate-600">
            Recovery code (S)
          </label>
          <div className="mt-1 h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-600 truncate">
              S: beamio_7K3X-9P2Q-...{/* 只展示部分 */}
            </span>
            <span className="text-[10px] text-slate-500">Read-only</span>
          </div>
          <p className="text-[10px] text-slate-500 leading-snug mt-1">
            This is a text representation of the QR content. You can copy it as
            a backup, but do not paste it into chat apps or email.
          </p>
        </div>

        <div className="w-full mt-2 flex flex-col gap-2">
          <GhostButton label="Save QR image" />
          <GhostButton label="Copy recovery code (S)" />
        </div>

        <div className="w-full mt-3 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-700">
              Regenerate Recovery QR
            </span>
            <span className="text-[10px] text-slate-400">
              Old QR will stop working
            </span>
          </div>
          <p className="text-[10px] text-slate-500 leading-snug mb-2">
            Generate a new Recovery QR if you think the old one might be
            exposed. After regeneration, only the new QR + your PIN can restore
            this wallet.
          </p>
          <GhostButton label="Regenerate Recovery QR" />
        </div>
      </div>
    </ScreenShell>
	)
}
	

   



export default RecoveryQRDetailScreen