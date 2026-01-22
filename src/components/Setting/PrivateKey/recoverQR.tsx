// @/components/Setting/RecoveryQR/RecoverQRReveal.tsx
import { useState } from 'react'
import { Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { AppButton } from '@/components/button/AppButton'
import { RegenerateRecover } from '@/services/beamio'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { CoNET_Data } from '@/utils/globals'
import RecoveryQRScreen from '@/pages/Home/RecoveryQRScreen'

type Result = {
  pin: string
  recoverCode: string
  qrCode: string // data url
}

type Props = {
  close?: () => void
}

export default function RecoverQRReveal({ close }: Props) {
  const { beamio, profiles } = useDaemonContext()

  const [step, setStep] = useState<'locked' | 'revealed'>('locked')
  const [password, setPassword] = useState('')
  const [pwVisible, setPwVisible] = useState(false)

  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')

  const [qrDataUrl, setQrDataUrl] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')

  const canRegenerate = password.trim().length > 0 && !loading

  const regenerateRecoverQR = async (): Promise<boolean> => {
    const temp = CoNET_Data
    if (!temp || !beamio || !profiles?.[0]) return false

    const mnemonicPhrase = temp?.mnemonicPhrase
    if (!mnemonicPhrase) {
      setErrorText('No mnemonic phrase found on device.')
      return false
    }

    const pin = password.trim()
    if (pin.length < 6) {
      setErrorText('Password error')
      return false
    }

    const profile: profile = profiles[0]
    if (!profile?.privateKeyArmor) {
      setErrorText('No local profile key found.')
      return false
    }

    setLoading(true)
    setErrorText('')
    try {
      const result: Result | null = await RegenerateRecover(
        mnemonicPhrase,
        beamio,
        pin,
        profile.privateKeyArmor
      )

      if (!result) {
        setErrorText('System unknown error')
        return false
      }

      // ✅ 正确映射
      setRecoveryCode(result.recoverCode)
      setQrDataUrl(result.qrCode)

      return true
    } catch (e: any) {
      setErrorText(e?.message || 'Failed to regenerate recovery QR.')
      return false
    } finally {
      setLoading(false)
    }
  }

  if (step === 'revealed') {
    return (
      <RecoveryQRScreen
        qrDataUrl={qrDataUrl}
        recoveryCode={recoveryCode}
        showButton={false}
		close={() => {
			
		}}
      />
    )
  }

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="mx-auto w-full max-w-[560px] px-6 pt-8 pb-10">
        {/* Title */}
        <div className="mt-2">
          <div className="text-[32px] font-extrabold tracking-[-0.02em] text-slate-900">
            Rotate Recovery QR
          </div>
          <div className="mt-2 text-[16px] text-slate-500 leading-relaxed">
            This will invalidate your old QR code. You need your <br />
            password to authorize this.
          </div>
        </div>

        {/* Password input */}
        <div className="mt-8">
          <div
            className={`
              w-full
              rounded-2xl
              bg-white
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
              type={pwVisible ? 'text' : 'password'}
              placeholder="Set Password (6+ chars)" // Matches Screenshot 3
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

        {/* Yellow warning */}
        <div
          className="
            mt-5
            rounded-2xl
            bg-amber-50
            ring-1 ring-amber-100
            px-4 py-3
            flex items-start gap-3
          "
        >
          <div className="mt-0.5 text-amber-700">
            <AlertTriangle className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <div className="text-[14px] font-semibold text-amber-900 leading-snug">
            Ensure you save the new QR immediately after generation.
          </div>
        </div>

        {/* Bottom button */}
        <div className="mt-10">
          <AppButton
            fullWidth
            variant="primary"
            loading={loading}
            disabled={!canRegenerate}
            onClick={async () => {
              if (!canRegenerate) return
              const ok = await regenerateRecoverQR()
              if (ok) setStep('revealed')
            }}
            className={`
              rounded-2xl h-16 text-[18px] font-extrabold
              ${!password.trim() ? 'bg-slate-300 hover:bg-slate-300 shadow-none' : ''}
            `}
          >
            Regenerate
          </AppButton>
        </div>
      </div>
    </div>
  )
}
