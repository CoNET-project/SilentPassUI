import { FormEvent, useState, useEffect } from 'react'
import { AppButton } from '@/components/button/AppButton'
import { restoreWithUserPin } from '@/services/beamio'
import { Eye } from "lucide-react"

type RestoreWithUsernamePinScreenProps = {
  onRestore: (temp: encrypt_keys_object) => Promise<void> | void
}

const RestoreWithUsernamePinScreen = ({ onRestore }: RestoreWithUsernamePinScreenProps) => {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('') // ✅ 继续沿用 pin 变量名，最小改动（它现在承载 password）
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

		// 1️⃣ trim 空格
		let trimmed = username.trim()

		// 2️⃣ 允许 @username / @@username → 去掉所有前导 @
		trimmed = trimmed.replace(/^@+/, '')

		if (!trimmed) {
			setError('Please enter a username')
			return ''
		}

		// 3️⃣ 校验规则（不包含 @）
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
        RESTORE · METHOD 2
      </div>

      <h1 className="text-[26px] font-semibold text-slate-900">
        Restore with @BeamioTag
      </h1>

      <p className="mt-1 text-[14px] text-slate-500 leading-snug">
        Unlock your encrypted backup locally with your password.
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

		<div className="relative">
			<input
			type={peekPin ? "text" : "password"}
			autoComplete="current-password"
			autoCapitalize="none"
			autoCorrect="off"
			spellCheck={false}
			className="
				w-full rounded-[18px] border border-slate-200 bg-white
				px-3 py-2.5 pr-11 text-[13px] text-slate-900
				placeholder:text-slate-400 outline-none
				focus:border-sky-400 focus:ring-2 focus:ring-sky-100
			"
			placeholder="At least 6 characters"
			value={pin}
			onChange={e => setPin(e.target.value)}
			/>

			{/* 👁 press-to-peek */}
			<button
			type="button"
			tabIndex={-1}
			aria-label="Press and hold to peek password"
			className="
				absolute right-2 top-1/2 -translate-y-1/2
				h-8 w-8 rounded-full
				flex items-center justify-center
				text-slate-400 hover:text-slate-600
				active:bg-slate-100
				transition
				touch-manipulation select-none
			"
			onPointerDown={e => {
				e.preventDefault()
				e.stopPropagation()
				setPeekPin(true)
				try {
				e.currentTarget.setPointerCapture(e.pointerId)
				} catch {}
			}}
			onPointerUp={e => {
				setPeekPin(false)
				try {
				e.currentTarget.releasePointerCapture(e.pointerId)
				} catch {}
			}}
			onPointerCancel={() => setPeekPin(false)}
			onPointerLeave={() => setPeekPin(false)}
			>
			<Eye className="w-4 h-4" />
			</button>
		</div>
		</div>

      {/* How it works */}
      <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="text-[12px] font-semibold text-amber-900 mb-1">
          How this works
        </div>
        <p className="text-[11px] leading-snug text-amber-900/90">
          Your password decrypts the encrypted backup stored on-chain locally on your device. Beamio never sees your password or keys.
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
