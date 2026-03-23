import { FormEvent, useState, useEffect } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { restoreWithUserPin } from '@/services/beamio'
import { Eye, EyeOff, AlertCircle } from "lucide-react"

/** 与 LoadingPage 主色一致 */
export const CASHTREES_PRIMARY_LIME = '#96EB3C'
export const CASHTREES_PRIMARY_INK = '#0F172A'

type RestoreWithUsernamePinScreenProps = {
  onRestore: (temp: encrypt_keys_object) => Promise<void> | void
}

const RestoreWithUsernamePinScreen = ({ onRestore }: RestoreWithUsernamePinScreenProps) => {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('') 
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [peekPin, setPeekPin] = useState(false)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 4000)
    return () => clearTimeout(t)
  }, [error])

  const formatBeamioName = () => {
    setError('')
    let trimmed = username.trim()
    trimmed = trimmed.replace(/^@+/, '')

    if (!trimmed) {
      setError('Please enter a username')
      return ''
    }

    if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(trimmed)) {
      setError('Use 3–20 letters, numbers, dots, _ or -')
      return ''
    }

    return trimmed
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const trimmed = formatBeamioName()
    if (!trimmed) return

    setError('')

    const password = pin.trim()
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const canRestore = await restoreWithUserPin(trimmed, password)
    setLoading(false)

    if (!canRestore || typeof canRestore === 'boolean') {
      setError('Something went wrong while restoring your wallet.')
      return
    }

    onRestore(canRestore)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col h-full px-6 pt-6 pb-6 bg-white"
    >
      <div className="flex-1">
        {/* 标题 */}
        <h1 className="text-[32px] md:text-[40px] leading-[1.05] font-extrabold tracking-[-0.02em] text-slate-900">
          Decrypt Backup
        </h1>
        
        {/* 输入框区域 */}
        <div className="mt-8 flex flex-col gap-4">
          
          {/* Username Input */}
          <div className="relative">
            {/* 固定前缀 @ */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[20px] font-bold text-slate-300 select-none pointer-events-none">
              @
            </div>

            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`
                w-full h-[72px] pl-12 pr-6 rounded-[24px]
                border border-slate-100 bg-white shadow-sm
                text-[20px] font-bold text-slate-900
                placeholder:text-slate-300 placeholder:font-bold
                outline-none transition-all
                focus:border-[#96EB3C]/50 focus:ring-4 focus:ring-[#96EB3C]/12
                ${error && !username ? 'border-red-200 ring-4 ring-red-50' : ''}
              `}
              placeholder="beamio" // 对应截图中的 placeholder
              value={username}
              onChange={e => {
                // 自动移除用户输入的 @
                setUsername(e.target.value.replace(/@/g, ''))
                setError('')
              }}
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <input
              type={peekPin ? "text" : "password"}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={`
                w-full h-[72px] pl-6 pr-16 rounded-[24px]
                border border-slate-100 bg-white shadow-sm
                text-[20px] font-bold text-slate-900
                placeholder:text-slate-300 placeholder:font-bold placeholder:tracking-widest
                outline-none transition-all
                focus:border-[#96EB3C]/50 focus:ring-4 focus:ring-[#96EB3C]/12
                ${error && !pin ? 'border-red-200 ring-4 ring-red-50' : ''}
              `}
              placeholder="......" // 对应截图中的 dots
              value={pin}
              onChange={e => {
                setPin(e.target.value)
                setError('')
              }}
            />

            {/* Eye Icon Button */}
            <button
              type="button"
              tabIndex={-1}
              className="
                absolute right-4 top-1/2 -translate-y-1/2
                w-12 h-12 rounded-full
                flex items-center justify-center
                text-slate-400 hover:text-slate-600
                active:bg-slate-100 transition
              "
              onPointerDown={e => {
                e.preventDefault()
                setPeekPin(true)
              }}
              onPointerUp={() => setPeekPin(false)}
              onPointerLeave={() => setPeekPin(false)}
              onClick={() => {
                  // 移动端兼容点击切换
                  if(typeof window !== 'undefined' && 'ontouchstart' in window) {
                      setPeekPin(!peekPin)
                  }
              }}
            >
              {peekPin ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-2 flex items-center gap-2 text-red-600 animate-in fade-in slide-in-from-top-1 px-1">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-[14px] font-semibold leading-snug">{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="pb-[env(safe-area-inset-bottom)] pt-4">
        <AppButton
          type="submit"
          fullWidth
          disabled={loading}
          loading={loading}
          className="
            h-[64px] rounded-full text-[20px] font-bold
            !bg-[#96EB3C] hover:!bg-[#8ADC32] active:!bg-[#7ECF28] disabled:!opacity-90
            !text-[#0F172A] !shadow-[0_12px_30px_rgba(150,235,60,0.42)] active:!shadow-[0_10px_24px_rgba(150,235,60,0.32)]
            focus-visible:!ring-2 focus-visible:!ring-[#96EB3C]/50
          "
        >
          Restore
        </AppButton>
      </div>
    </form>
  )
}

export default RestoreWithUsernamePinScreen