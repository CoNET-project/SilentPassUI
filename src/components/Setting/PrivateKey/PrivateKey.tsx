// @/components/Setting/PrivateKey/PrivateKey.tsx
import { useMemo, useState } from 'react'
import { Eye, EyeOff, Copy, Check, AlertTriangle } from 'lucide-react'
import { AppButton } from '@/components/button/AppButton'
import { restoreWithUserPin } from '@/services/beamio'
import { useDaemonContext } from '@/providers/DaemonProvider'

type Props = {
  privateKey: string // 仍保留：可作为 fallback，但真正展示以解锁后的为准
  onClose: () => void
}

function maskKey(s: string) {
  if (!s) return ''
  return '•'.repeat(18)
}

export default function PrivateKeyReveal({ privateKey, onClose }: Props) {
  const { beamio, profiles } = useDaemonContext()

  const [step, setStep] = useState<'locked' | 'revealed'>('locked')
  const [password, setPassword] = useState('')
  const [pwVisible, setPwVisible] = useState(false)

  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')

  const [copied, setCopied] = useState(false)
  const [keyVisible, setKeyVisible] = useState(true)

  // ✅ 解锁后真正要展示的私钥
  const [revealedKey, setRevealedKey] = useState<string>('')

  const canReveal = password.trim().length > 0 && !loading

  const onCopy = async () => {
    const k = revealedKey || privateKey || ''
    if (!k) return
    try {
      await navigator.clipboard.writeText(k)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const getPrivatekey = async () => {
    setErrorText('')
    if (!beamio?.accountName) {
      setErrorText('Account not ready.')
      return null
    }
    if (!profiles?.[0]?.privateKeyArmor) {
      setErrorText('No local key found.')
      return null
    }

    setLoading(true)
    try {
      const ok = await restoreWithUserPin(beamio.accountName, password)
      if (!ok) {
        setErrorText('Wrong password. Please try again.')
        return null
      }

      // ✅ 你的逻辑：从 profiles[0].privateKeyArmor 取出并去掉 0x
      const ret = profiles[0].privateKeyArmor.replace(/^0x/i, '')
      return ret
    } catch (e: any) {
      setErrorText(e?.message || 'Failed to verify password.')
      return null
    } finally {
      setLoading(false)
    }
  }

  const displayedKey = revealedKey || privateKey || ''

  const revealPrivateKey = async () => {
    if (!password.trim() || loading) return
    const k = await getPrivatekey()
    if (!k) return
    setRevealedKey(k)
    setKeyVisible(true)
    setStep('revealed')
  }

  const keyText = useMemo(() => {
    if (!displayedKey) return 'No private key found.'
    return keyVisible ? displayedKey : maskKey(displayedKey)
  }, [displayedKey, keyVisible])

  return (
    <div className="w-full bg-transparent">
      <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-2 sm:px-6">
        {step === 'locked' ? (
          <>
            {/* Danger Zone */}
            <div>
              <div className="text-[30px] font-extrabold tracking-[-0.02em] text-red-600">
                Danger Zone
              </div>
              <div className="mt-2 text-[16px] text-slate-500 leading-relaxed">
                Never share your private key. Anyone with this key can steal your funds.
              </div>
            </div>

            {/* Password input */}
            <div className="mt-6">
              <div
                className={`
                  w-full rounded-2xl bg-white
                  ring-1 ${errorText ? 'ring-red-300' : 'ring-slate-200'}
                  shadow-[0_10px_40px_rgba(15,23,42,0.06)]
                  px-5 py-4
                  flex items-center justify-between gap-4
                `}
              >
                <input
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value)
                    if (errorText) setErrorText('')
                  }}
                  onKeyDown={e => {
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    void revealPrivateKey()
                  }}
                  type={pwVisible ? 'text' : 'password'}
                  placeholder="Enter Wallet Password"
                  className="
                    w-full bg-transparent outline-none
                    text-[18px] font-semibold text-slate-900
                    placeholder:text-slate-300
                  "
                />

                <button
                  type="button"
                  onClick={() => setPwVisible(v => !v)}
                  className="
                    h-10 w-10 rounded-full
                    grid place-items-center
                    text-slate-400 hover:text-slate-600
                    hover:bg-slate-100
                    active:scale-95
                    transition
                  "
                  aria-label={pwVisible ? 'Hide password' : 'Show password'}
                >
                  {pwVisible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {errorText ? (
                <div className="mt-3 text-[13px] font-medium text-red-600">
                  {errorText}
                </div>
              ) : null}
            </div>

            {/* Bottom Reveal button */}
            <div className="mt-8">
              <AppButton
                fullWidth
                variant="danger"
                loading={loading}
                disabled={!canReveal}
                onClick={revealPrivateKey}
                className={`
                  ${!password.trim() ? 'bg-slate-300 hover:bg-slate-300 shadow-none' : ''}
                  rounded-2xl h-14 text-[18px]
                `}
              >
                Reveal Key
              </AppButton>
            </div>

            
          </>
        ) : (
          <>
            {/* Handle with Care */}
            <div className="mt-2 flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-red-50 ring-1 ring-red-100 grid place-items-center">
                <AlertTriangle className="h-7 w-7 text-red-500" strokeWidth={2.3} />
              </div>

              <div className="mt-6 font-manrope text-3xl font-extrabold leading-tight tracking-tight text-slate-900">
                Handle with Care
              </div>

              <div className="mt-2 max-w-lg text-sm leading-relaxed text-[#595c5e]">
                Beamio cannot undo the exposure of your private key.
              </div>
            </div>

            {/* Key box */}
            <div className="mt-12 w-full">
              <div
                className="
                  relative
                  rounded-[28px]
                  bg-white
                  ring-1 ring-slate-200
                  shadow-[0_18px_60px_rgba(15,23,42,0.10)]
                  px-7 py-6
                "
              >
                <div
                  className="
                    absolute right-6 top-[-14px]
                    rounded-xl bg-red-600
                    px-4 py-2
                    text-[10px] font-extrabold tracking-[0.08em]
                    text-white
                    shadow-[0_10px_24px_rgba(239,68,68,0.20)]
                  "
                >
                  UNENCRYPTED
                </div>

                <div className="flex items-start gap-4">
                  <pre
                    className="
                      m-0 flex-1
                      whitespace-pre-wrap break-all
                      font-mono
                      text-[12px]
                      leading-[1.35]
                      text-slate-900
                    "
                  >
                    {keyText}
                  </pre>

                  <button
                    type="button"
                    onClick={() => setKeyVisible(v => !v)}
                    className="
                      mt-1
                      h-12 w-12 rounded-full
                      grid place-items-center
                      text-slate-400 hover:text-slate-600
                      hover:bg-slate-50
                      active:scale-95
                      transition
                    "
                    aria-label={keyVisible ? 'Hide key' : 'Show key'}
                    title={keyVisible ? 'Hide' : 'Show'}
                  >
                    {keyVisible ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-10 w-full space-y-6">
              <AppButton
                fullWidth
                variant="secondary"
                onClick={onCopy}
                className="
                  rounded-full h-12
                  bg-white hover:bg-slate-50
                  ring-1 ring-slate-200
                  shadow-sm
                  text-slate-900
                  text-sm font-semibold
                "
                leftIcon={
                  copied ? (
                    <Check className="h-4 w-4" strokeWidth={2.25} />
                  ) : (
                    <Copy className="h-4 w-4" strokeWidth={2.25} />
                  )
                }
              >
                {copied ? 'Copied' : 'Copy to Clipboard'}
              </AppButton>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
