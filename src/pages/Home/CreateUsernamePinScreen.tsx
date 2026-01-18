import React, { useRef, useState } from "react"
import { AppButton } from "@/components/button/AppButton"
import { checkBeamioAccountAPI, createRecover } from "@/services/beamio"
// FIX: 将 TriangleAlert 替换为 AlertTriangle
import { Eye, EyeOff, ShieldCheck, AlertTriangle, Check } from "lucide-react"

// Types
type CreateBeamioTagProps = {
  loading: boolean
  value: string
  onChange: React.Dispatch<React.SetStateAction<string>>
  onNext: () => void
}

/**
 * Step A: Claim BeamioTag
 * Refined to match Screenshot 1 & 2
 */
const CreateBeamioTag = ({ loading, value, onChange, onNext }: CreateBeamioTagProps) => {
  const lastCheckedRef = useRef("")
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle")
  const [error, setError] = useState("")

  const localValidate = (raw: string) => {
    const trimmed = raw.trim().replace(/^@+/, "")
    if (!trimmed) return { ok: false, v: "", msg: "Please enter a BeamioTag" }
    // Regex allows alphanumeric, underscores, dots. Length 3-20.
    if (!/^[a-zA-Z0-9_\.]{3,20}$/.test(trimmed)) {
      return { ok: false, v: trimmed, msg: "Use 3–20 letters, numbers or dots" }
    }
    return { ok: true, v: trimmed, msg: "" }
  }

  const validateAndCheck = async () => {
    if (status === "checking") return false

    const { ok, v, msg } = localValidate(value)
    setError("")

    if (!ok) {
      if (v.length > 0) {
        setStatus("invalid")
        setError(msg)
      } else {
        setStatus("idle")
      }
      return false
    }

    if (v === lastCheckedRef.current && status === "valid") return true
    lastCheckedRef.current = v

    setStatus("checking")
    try {
      const available = await checkBeamioAccountAPI(v)
      if (!available) {
        setStatus("invalid")
        setError(`@${v} is already taken`)
        return false
      }
      setStatus("valid")
      setError("")
      return true
    } catch {
      setStatus("invalid")
      setError("Network error. Try again.")
      return false
    }
  }

  const isChecking = status === "checking"
  const isValid = status === "valid"

  return (
    <div className="flex flex-col h-full px-6 pt-6 pb-6">
      <div className="flex-1">
        {/* Header */}
        <h1 className="text-[32px] md:text-[40px] leading-[1.02] font-extrabold tracking-[-0.02em] text-slate-900">
          Claim BeamioTag
        </h1>
        <p className="mt-3 text-[18px] md:text-[20px] text-slate-500 font-medium">
          Your unique Beamio identity.
        </p>

        {/* Input Section */}
        <div className="mt-8">
          <div className="relative">
            {/* Fixed @ Symbol */}
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[24px] font-bold text-slate-300 select-none pointer-events-none">
              @
            </div>

            <input
              readOnly={loading || isChecking}
              autoCapitalize="none"
              autoCorrect="off"
              className={`
                w-full h-[72px] pl-12 pr-20 rounded-[24px]
                border border-slate-100 bg-white shadow-sm
                text-[24px] font-bold text-slate-900
                placeholder:text-slate-300 placeholder:font-bold
                outline-none transition-all
                focus:border-sky-300 focus:ring-4 focus:ring-sky-50
                disabled:opacity-70
                ${status === 'invalid' ? 'border-orange-200 ring-4 ring-orange-50 focus:border-orange-300 focus:ring-orange-100' : ''}
              `}
              value={value}
              placeholder="tagname" // Matches Screenshot 1
              onChange={e => {
                if (isChecking) return
                // Remove @ if user types it manually
                const next = e.currentTarget.value.replace(/@/g, "")
                onChange(next)
                setStatus("idle")
                setError("")
              }}
              onBlur={validateAndCheck}
            />

            {/* Right Side Indicator */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              {isChecking && (
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                </div>
              )}

              {isValid && (
                <div className="w-[42px] h-[42px] rounded-full bg-emerald-100/80 flex items-center justify-center">
                  <Check className="w-6 h-6 text-emerald-600" strokeWidth={3} />
                </div>
              )}
            </div>
          </div>

          {/* Warning / Error Message */}
          {status === "invalid" ? (
             <div className="mt-4 flex items-center gap-2 text-orange-600 animate-in fade-in slide-in-from-top-1">
             <AlertTriangle className="w-5 h-5 fill-orange-100 shrink-0" />
             <span className="text-[15px] font-semibold leading-snug">
               {error}
             </span>
           </div>
          ) : (
            <div className="mt-4 flex items-center gap-2 text-orange-500">
              <AlertTriangle className="w-5 h-5 fill-orange-100 text-orange-500 shrink-0" />
              <span className="text-[15px] font-bold leading-snug">
                Permanent. Cannot be changed later.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Button */}
      {isValid && (
        <div className="pb-[env(safe-area-inset-bottom)] pt-4">
          <AppButton
            fullWidth
            className="
              h-[64px] rounded-full
              text-[20px] font-bold tracking-wide
              bg-[#1652f0] hover:bg-[#1345ca]
              shadow-[0_12px_30px_rgba(22,82,240,0.3)]
              text-white
            "
            onClick={onNext}
          >
            Next <span className="ml-1">→</span>
          </AppButton>
        </div>
      )}
    </div>
  )
}

/**
 * Step B: Secure Wallet
 * Refined to match Screenshot 3
 */
const SecureWalletPassword = ({
  loading,
  onCreate
}: {
  loading: boolean
  onCreate: (password: string) => void
}) => {
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)

  // Validation logic can be stricter if needed
  const isValidLength = password.trim().length >= 6
  const canSubmit = isValidLength && !loading

  return (
    <div className="flex flex-col h-full px-6 pt-6 pb-6">
      <div className="flex-1">
        <h1 className="text-[32px] md:text-[40px] leading-[1.02] font-extrabold tracking-[-0.02em] text-slate-900">
          Secure Wallet
        </h1>
        <p className="mt-3 text-[18px] md:text-[20px] text-slate-500 font-medium">
          Encrypts your keys locally.
        </p>

        <div className="mt-8">
          <div className="relative">
            <input
              readOnly={loading}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              className="
                w-full h-[72px] pl-6 pr-16 rounded-[24px]
                border border-slate-100 bg-white shadow-sm
                text-[20px] font-semibold text-slate-900
                placeholder:text-slate-300 placeholder:font-medium
                outline-none transition-all
                focus:border-sky-300 focus:ring-4 focus:ring-sky-50
              "
              value={password}
              placeholder="Set Password (6+ chars)" // Matches Screenshot 3
              onChange={e => setPassword(e.currentTarget.value)}
            />

            <button
              type="button"
              className="
                absolute right-4 top-1/2 -translate-y-1/2
                w-12 h-12 rounded-full
                flex items-center justify-center
                text-slate-400 hover:text-slate-600
                active:bg-slate-100 transition
              "
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
            </button>
          </div>

          {/* Non-custodial Warning */}
          <div className="mt-6 flex items-start gap-4">
            <div className="shrink-0">
               {/* Matches the Shield Icon in Screenshot 3 */}
              <ShieldCheck className="w-7 h-7 text-slate-400" />
            </div>
            <div className="text-[16px] leading-snug text-slate-500 font-medium pt-0.5">
              Beamio is non-custodial. We cannot reset this.
            </div>
          </div>
        </div>
      </div>

      <div className="pb-[env(safe-area-inset-bottom)] pt-4">
        <AppButton
          fullWidth
          loading={loading}
          disabled={!canSubmit} 
          className={`
            h-[64px] rounded-full
            text-[20px] font-bold
            transition-all duration-200
            ${canSubmit 
              ? 'bg-[#1652f0] shadow-[0_12px_30px_rgba(22,82,240,0.3)] text-white' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}
          `}
          onClick={() => {
            if (password.trim().length < 6) return
            onCreate(password.trim())
          }}
        >
          Create Wallet
        </AppButton>
      </div>
    </div>
  )
}

/**
 * Main Controller
 */
const CreateUsernamePinScreen = ({
  close
}: {
  close: (val: {
    qrDataUrl: string
    pin: string
    passcode: string
    temp: any
  }) => void
}) => {
  const [step, setStep] = useState<"tag" | "password">("tag")
  const [beamioName, setBeamioName] = useState("")
  const [loading, setLoading] = useState(false)

  const handleCreateWallet = async (password: string) => {
    const trimmedTag = (beamioName || "").trim().replace(/^@+/, "")
    if (!trimmedTag) return

    setLoading(true)
    const kks = await createRecover(trimmedTag, password)
    setLoading(false)

    if (!kks) return

    close({
      qrDataUrl: kks.qrCode,
      pin: password,
      passcode: kks.recoverCode,
      temp: kks.temp
    })
  }

  return (
    <div className="flex flex-col h-full bg-white"> 
      {step === "tag" ? (
        <CreateBeamioTag
          loading={loading}
          value={beamioName}
          onChange={setBeamioName}
          onNext={() => setStep("password")}
        />
      ) : (
        <SecureWalletPassword 
          loading={loading} 
          onCreate={handleCreateWallet} 
        />
      )}
    </div>
  )
}

export default CreateUsernamePinScreen