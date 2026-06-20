import { IpfsImg } from '@/components/IpfsImg';
/**
 * 根据 AI 输出的 Action 渲染对应 UI 组件
 * 去 UI 化：AI 决定展示什么，此处仅负责映射与渲染
 */

import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import type { BeamioAction } from "./types"
import { DynamicUIRenderer } from "./DynamicUIRenderer"
import PayScreen from "@/pages/Pay/send"
import FuelView from "@/components/Home/FuelView"
import { Wallet, Users, User, MessageCircle, Loader2, CheckCircle, History } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { searchUsername, postBeamio, storeSystemData } from "@/services/beamio"
import { initMessage, sendMessage, getRandomNodes, getCoNETNodesForChat } from "@/services/chat"
import { InlineHistoryPreview } from "./InlineHistoryPreview"
import { GenerateAvatarImageCard } from "./GenerateAvatarImageCard"
import { getBUnitBalanceOnConet } from "@/services/BeamioCard"
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"
import { tu } from '@/locale/beamioLocale'

const DICEBEAR_URL = "https://api.dicebear.com/8.x/fun-emoji/svg?seed="
const CURRENCIES = ["USD", "USDC", "CAD", "JPY", "CNY", "HKD", "EUR", "SGD", "TWD"] as const

function getDisplayLastName(ln: string | undefined): string {
  if (!ln) return ""
  const first = ln.split("\r\n")[0]
  return /^\{/.test(first || "") ? "" : (first || "").trim()
}

function EditProfileForm({
  action,
  beamio,
  profiles,
  setBeamio,
  onClose,
  onComplete,
}: {
  action: BeamioAction
  beamio: beamio | null
  profiles: profile[] | null
  setBeamio: (b: beamio) => void
  onClose: () => void
  onComplete?: (result?: unknown) => void
}) {
  const p = (action.params || {}) as {
    firstName?: string
    lastName?: string
    avatarSeed?: string
    currency?: string
  }
  const [firstName, setFirstName] = useState(
    p.firstName ?? beamio?.firstName ?? ""
  )
  const [lastName, setLastName] = useState(
    p.lastName ?? getDisplayLastName(beamio?.lastName) ?? ""
  )
  const [avatarSeed, setAvatarSeed] = useState(() => {
    if (p.avatarSeed) return p.avatarSeed
    const img = beamio?.image ?? ""
    if (img.includes("seed=")) {
      const m = img.match(/[?&]seed=([^&]+)/)
      return m ? decodeURIComponent(m[1]) : "Beamio"
    }
    return beamio?.accountName ?? "Beamio"
  })
  const [currency, setCurrency] = useState(
    p.currency ?? beamio?.currency ?? "USD"
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (p.firstName != null) setFirstName(p.firstName)
    if (p.lastName != null) setLastName(p.lastName)
    if (p.avatarSeed != null) setAvatarSeed(p.avatarSeed)
    if (p.currency != null) setCurrency(p.currency)
  }, [p.firstName, p.lastName, p.avatarSeed, p.currency])

  const handleSave = async () => {
    const profile = profiles?.[0]
    const tmpData = CoNET_Data
    if (!profile || !beamio || !tmpData) {
      setError("Profile not loaded")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const imageUrl = `${DICEBEAR_URL}${encodeURIComponent(avatarSeed || "Beamio")}`
      const bo: beamio = {
        ...beamio,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        image: imageUrl,
        currency: (currency || "USD") as beamio["currency"],
      }
      const ok = await postBeamio(bo, profile.privateKeyArmor)
      if (!ok) {
        setError("Save failed")
        return
      }
      tmpData.beamio = bo
      setCoNET_Data(tmpData)
      await storeSystemData()
      setBeamio({ ...bo })
      onComplete?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg border border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          <User size={24} className="text-violet-600" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
            Edit Profile
          </h3>
          <p className="text-sm text-slate-500">
            Update name, avatar, or currency
          </p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            First Name
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Last Name
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Avatar (DiceBear seed)
          </label>
          <div className="flex gap-3 items-center">
            <IpfsImg
              src={`${DICEBEAR_URL}${encodeURIComponent(avatarSeed || "Beamio")}`}
              alt="Avatar"
              className="w-14 h-14 rounded-full object-cover border border-slate-200"
            />
            <input
              type="text"
              value={avatarSeed}
              onChange={(e) => setAvatarSeed(e.target.value)}
              placeholder="avatar seed"
              className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3 rounded-xl bg-[#1562f0] text-white font-bold disabled:opacity-50"
        >
          {saving ? "Saving..." : tu('save')}
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold"
        >{tu('cancel')}</button>
      </div>
    </div>
  )
}

function SendChatCard({
  action,
  profiles,
  onClose,
  onComplete,
}: {
  action: BeamioAction
  profiles: profile[] | null
  onClose: () => void
  onComplete?: () => void
}) {
  const p = (action.params || {}) as { to?: string; text?: string }
  const to = (p.to ?? "").trim().replace(/^@/, "")
  const text = (p.text ?? "").trim()
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSend = async () => {
    if (!to || !text || !profiles?.[0]) {
      setErrorMsg("Missing recipient or message")
      setStatus("error")
      return
    }
    setStatus("sending")
    setErrorMsg(null)
    try {
      const r = await searchUsername(to)
      const recipient = r?.results?.[0]
      if (!recipient) {
        setErrorMsg(`User "${to}" not found`)
        setStatus("error")
        return
      }
      const profile = profiles[0]
      const chatData = await initMessage(profile, recipient)
      if (!chatData?.chatData?.publicArmored) {
        setErrorMsg("Could not get recipient PGP key")
        setStatus("error")
        return
      }
      const allNodes = await getCoNETNodesForChat()
      const nodes = getRandomNodes(allNodes, 2)
      const ok = await sendMessage(
        chatData.chatData.publicArmored,
        text,
        profile.privateKeyArmor,
        nodes
      )
      if (ok) {
        setStatus("sent")
        onComplete?.()
      } else {
        setErrorMsg("Failed to send message")
        setStatus("error")
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Send failed")
      setStatus("error")
    }
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg border border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <MessageCircle size={24} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{tu('send_message')}</h3>
          <p className="text-sm text-slate-500">
            To @{to}: {text.slice(0, 50)}{text.length > 50 ? "…" : ""}
          </p>
        </div>
      </div>
      {status === "idle" && (
        <button
          onClick={handleSend}
          className="w-full py-3 rounded-xl bg-[#1562f0] text-white font-bold"
        >{tu('send')}</button>
      )}
      {status === "sending" && (
        <div className="flex items-center justify-center gap-2 py-3 text-slate-600 dark:text-slate-300">
          <Loader2 size={20} className="animate-spin" />
          <span>Sending…</span>
        </div>
      )}
      {status === "sent" && (
        <div className="flex items-center justify-center gap-2 py-3 text-emerald-600">
          <CheckCircle size={20} />
          <span>Message sent</span>
        </div>
      )}
      {status === "error" && (
        <p className="text-red-600 dark:text-red-400 text-sm mb-3">{errorMsg}</p>
      )}
      <button
        onClick={onClose}
        className="mt-2 w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold"
      >
        Close
      </button>
    </div>
  )
}

type ActionRendererProps = {
  action: BeamioAction
  onClose: () => void
  onComplete?: (result?: unknown) => void
  /** When custom-ui ActionButton is clicked, open nested action (e.g. pay, fuel) */
  onActionClick?: (action: BeamioAction) => void
}

export function ActionRenderer({ action, onClose, onComplete, onActionClick }: ActionRendererProps) {
  const navigate = useNavigate()
  const { myAddress, usdcbalance, profiles, setChatHomeItem, beamio, setBeamio } = useDaemonContext()
  const [beamioer, setBeamioer] = React.useState<searchResult | null>(null)
  const [bUnitBalance, setBUnitBalance] = React.useState<{ total: number; free: number; paid: number } | null>(null)

  React.useEffect(() => {
    if (!myAddress) return
    getBUnitBalanceOnConet(myAddress).then(setBUnitBalance).catch(() => setBUnitBalance(null))
  }, [myAddress])

  const payTo = action.type === "pay" ? (action.params as { to?: string })?.to : undefined
  React.useEffect(() => {
    if (action.type !== "pay" || !payTo) return
    const to = String(payTo).trim()
    if (!to || to.length < 3) return
    searchUsername(to)
      .then((r) => {
        const acc = r?.results?.[0]
        if (acc) setBeamioer(acc)
      })
      .catch(() => setBeamioer(null))
  }, [action.type, payTo])

  const handlePayClose = (path?: string) => {
    onComplete?.()
    onClose()
  }

  switch (action.type) {
    case "pay":
      return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900">
          <PayScreen
            beamioer={beamioer ?? undefined}
            close={handlePayClose}
            preferredToAddress={action.params?.to ? String(action.params.to) : undefined}
            focusAmountOnMount={!!action.params?.amount}
          />
        </div>
      )

    case "fuel":
      return (
        <div className="fixed inset-0 z-50 bg-[#fdfdff] dark:bg-slate-900">
          <FuelView
            onClose={onClose}
            bUnitBalance={bUnitBalance}
            onRefresh={() => myAddress && getBUnitBalanceOnConet(myAddress).then(setBUnitBalance)}
            account={myAddress}
          />
        </div>
      )

    case "balance":
      return (
        <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Wallet size={24} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{tu('balance')}</h3>
              <p className="text-sm text-slate-500">Your USDC & B-Units</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500">USDC</span>
              <span className="text-xl font-black text-slate-800 dark:text-slate-100">
                ${typeof usdcbalance === "number" ? usdcbalance.toFixed(2) : "0.00"}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500">B-Units</span>
              <span className="text-xl font-black text-orange-500">
                {bUnitBalance != null ? Math.floor(bUnitBalance.total) : "—"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mt-4 w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold"
          >
            Close
          </button>
        </div>
      )

    case "add-usdc":
      return (
        <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg border border-slate-100 dark:border-slate-700">
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            Add USDC via Coinbase or bank transfer. Redirecting...
          </p>
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-slate-100 font-bold">
            Close
          </button>
        </div>
      )

    case "text":
      return (
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700">
          <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
            {action.params?.content ?? ""}
          </p>
          <button onClick={onClose} className="mt-3 text-sm font-bold text-orange-500">
            Dismiss
          </button>
        </div>
      )

    case "history":
      const historyLimit = (action.params as { limit?: number })?.limit
      if (typeof historyLimit === "number" && historyLimit > 0) {
        return (
          <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <History size={24} className="text-violet-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Transaction History</h3>
                <p className="text-sm text-slate-500">Last {historyLimit} transactions</p>
              </div>
            </div>
            <InlineHistoryPreview limit={historyLimit} onOpenFull={() => { onComplete?.(); onClose(); navigate("/History") }} />
            <button onClick={onClose} className="mt-4 w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
              Close
            </button>
          </div>
        )
      }
      return (
        <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <History size={24} className="text-violet-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Transaction History</h3>
              <p className="text-sm text-slate-500">View your USDC and card transactions</p>
            </div>
          </div>
          <button
            onClick={() => {
              onComplete?.()
              onClose()
              navigate("/History")
            }}
            className="w-full py-3 rounded-xl bg-[#1562f0] text-white font-bold"
          >
            Open History
          </button>
          <button onClick={onClose} className="mt-2 w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
            Close
          </button>
        </div>
      )

    case "contact":
      const contactQuery = (action.params as { query?: string; action?: string })?.query?.trim()
      const contactAction = (action.params as { query?: string; action?: string })?.action
      const handleOpenChat = async () => {
        onClose()
        if (contactQuery && contactAction === "chat") {
          try {
            const q = contactQuery.replace(/^@/, "").trim()
            const r = q ? await searchUsername(q) : { results: [] }
            const acc = r?.results?.[0]
            if (acc) setChatHomeItem(acc)
            else setChatHomeItem(null)
          } catch {
            setChatHomeItem(null)
          }
        } else {
          setChatHomeItem(null)
        }
        navigate("/Chat")
      }
      return (
        <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg border border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Users size={24} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Contacts</h3>
              <p className="text-sm text-slate-500">
                {contactQuery ? `Chat with ${contactQuery}` : "View and chat with your contacts"}
              </p>
            </div>
          </div>
          <button
            onClick={handleOpenChat}
            className="w-full py-3 rounded-xl bg-[#1562f0] text-white font-bold"
          >
            {contactQuery ? `Open chat with ${contactQuery}` : "Open Contacts"}
          </button>
          <button onClick={onClose} className="mt-2 w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
            Close
          </button>
        </div>
      )

    case "custom-ui":
      return (
        <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg border border-slate-100 dark:border-slate-700">
          <DynamicUIRenderer
            ui={action.params?.ui}
            onActionClick={(a) => {
              onActionClick?.(a)
            }}
          />
          <button onClick={onClose} className="mt-4 w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
            Close
          </button>
        </div>
      )

    case "edit-profile":
      return (
        <EditProfileForm
          action={action}
          beamio={beamio}
          profiles={profiles}
          setBeamio={setBeamio}
          onClose={onClose}
          onComplete={onComplete}
        />
      )

    case "send-chat":
      return (
        <SendChatCard
          action={action}
          profiles={profiles}
          onClose={onClose}
          onComplete={onComplete}
        />
      )

    case "generate-avatar-image":
      return (
        <GenerateAvatarImageCard
          action={action}
          onClose={onClose}
          onComplete={onComplete}
        />
      )

    default:
      return (
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-200 dark:border-amber-800">
          <p className="text-amber-800 dark:text-amber-200">
            Action &quot;{action.type}&quot; is not yet implemented.
          </p>
          <button onClick={onClose} className="mt-2 text-sm font-bold text-amber-600">
            Close
          </button>
        </div>
      )
  }
}
