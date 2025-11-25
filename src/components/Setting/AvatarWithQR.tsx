import { useState } from 'react'
import BeamioReceiveScreen from './BeamioReceiveScreen'
import { useDaemonContext } from '@/providers/DaemonProvider'

const AvatarWithQR = () => {
  const [open, setOpen] = useState(false)
	 const { darkModle, setDarkModle, setProfiles, beamio, setBeamio, profiles } = useDaemonContext()

  return (
    <>
      {/* Avatar */}
      <div
        className="relative"
        onClick={() => setOpen(true)}     // ⭐ 点击触发全屏滑入
      >
        <div className="w-20 h-20 rounded-full bg-fuchsia-500 flex items-center justify-center text-4xl shadow-lg ring-4 ring-white">
          <span role="img" aria-label="avatar">😌</span>
        </div>

        {/* Small QR badge like Venmo */}
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow flex items-center justify-center text-[14px] text-slate-700 border border-slate-200">
          ▢
        </div>
      </div>

      {/* ---------------- FULLSCREEN SLIDE-IN OVERLAY ---------------- */}
      <div
        className={`
          fixed inset-0 z-[9999]
          bg-white dark:bg-slate-900
          transition-transform duration-300 ease-out
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Close button */}
        <button
          onClick={() => setOpen(false)}
          className="
            absolute top-4 right-4
            w-8 h-8 rounded-full
            bg-white/70 dark:bg-slate-800/70
            backdrop-blur-md shadow
            flex items-center justify-center
            text-slate-700 dark:text-slate-300
          "
        >
          ✕
        </button>

        {/* Receive screen content */}
        <BeamioReceiveScreen />
      </div>
    </>
  )
}

export default AvatarWithQR
