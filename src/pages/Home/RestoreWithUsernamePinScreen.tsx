import { FormEvent, useState, useEffect } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { restoreWithUserPin } from '@/services/beamio'

type RestoreWithUsernamePinScreenProps = {
  onRestore: (temp: encrypt_keys_object) => Promise<void> | void
}

const RestoreWithUsernamePinScreen = ({ onRestore }: RestoreWithUsernamePinScreenProps) => {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('') // ✅ 继续沿用 pin 变量名，最小改动（它现在承载 password）
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 4000)
    return () => clearTimeout(t)
  }, [error])

  const formatBeamioName = () => {
    setError('')
    const trimmed = username.trim()
    if (!trimmed) {
      setError('Please enter a username')
      return ''
    }

    if (!/^[a-zA-Z0-9_\.]{3,20}$/.test(trimmed)) {
      setError('Use 3–20 letters, numbers or dots')
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

    // ✅ Password: 至少 6 个字符（不限制数字）
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
      className="flex flex-col gap-4 text-[13px] text-slate-900 flex-1 px-6 pt-8 pb-10"
    >
      <div className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
        Restore · Method 2
      </div>

      <h1 className="text-[26px] font-semibold text-slate-900">
        Restore via CoNET backup
      </h1>

      <p className="mt-1 text-[14px] text-slate-500 leading-snug">
        We&apos;ll fetch your encrypted backup using your @BeamioTag, then decrypt
        it locally with your password.
      </p>

      {/* Username */}
      <div className="flex flex-col gap-1.5 mt-2">
        <label className="text-[12px] font-medium text-slate-700">@BeamioTag</label>
        <input
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="
            w-full rounded-[18px] border border-slate-200 bg-white
            px-3 py-2.5 text-[13px] text-slate-900
            placeholder:text-slate-400 outline-none
            focus:border-sky-400 focus:ring-2 focus:ring-sky-100
          "
          placeholder="Your Beamio username"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5 mt-2">
        <label className="text-[12px] font-medium text-slate-700">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="
            w-full rounded-[18px] border border-slate-200 bg-white
            px-3 py-2.5 text-[13px] text-slate-900
            placeholder:text-slate-400 outline-none
            focus:border-sky-400 focus:ring-2 focus:ring-sky-100
          "
          placeholder="At least 6 characters"
          value={pin}
          onChange={e => setPin(e.target.value)}
        />
      </div>

      {/* How it works */}
      <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="text-[12px] font-semibold text-amber-900 mb-1">
          How this works
        </div>
        <p className="text-[11px] leading-snug text-amber-900/90">
          We read an encrypted blob bound to your @BeamioTag from CoNET. Your
          password, processed with scrypt, is used locally to unlock it. We never see
          your private key.
        </p>
      </div>

      {error && (
        <div
          className="
            mt-4 mb-2 px-3 py-2
            rounded-[12px]
            text-[12px]
            text-red-700
            bg-red-50
            border border-red-200
          "
        >
          {error}
        </div>
      )}

      <div className="mt-4">
        <AppButton
          type="submit"
          fullWidth
          disabled={loading}
          className="rounded-[999px] py-3 text-[15px] font-semibold"
        >
          {loading ? 'Restoring…' : 'Restore wallet'}
        </AppButton>
      </div>
    </form>
  )
}

export default RestoreWithUsernamePinScreen
