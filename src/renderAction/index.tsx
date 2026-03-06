/**
 * Beamio AI-Native App：去 UI 化对话界面
 * AI 根据用户意图即时生成 Action，renderAction 渲染对应 UI
 *
 * 用法：AI 返回 { type, params }，本页展示对话流并渲染 Action 卡片
 */

import React, { useState, useRef, useEffect, useLayoutEffect } from "react"
import { ChevronLeft, Send, Sparkles, Loader2, Wallet, ThumbsUp, Pencil } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { ActionRenderer } from "./ActionRenderer"
import { DynamicUIRenderer } from "./DynamicUIRenderer"
import { InlineHistoryPreview } from "./InlineHistoryPreview"
import type { BeamioAction, RenderActionMessage } from "./types"
import { beamioApi } from "@/utils/constants"
import { getBUnitBalanceOnConet } from "@/services/BeamioCard"

/** 气泡内嵌 Balance 卡片 */
function InlineBalanceCard({
  usdcbalance,
  myAddress,
}: {
  usdcbalance: number | string | undefined
  myAddress: string
}) {
  const [bUnitBalance, setBUnitBalance] = useState<{ total: number } | null>(null)
  useEffect(() => {
    if (!myAddress) return
    getBUnitBalanceOnConet(myAddress).then((r) => setBUnitBalance(r)).catch(() => setBUnitBalance(null))
  }, [myAddress])
  const usdc = typeof usdcbalance === "number" ? usdcbalance.toFixed(2) : "0.00"
  const bUnits = bUnitBalance != null ? Math.floor(bUnitBalance.total) : "—"
  return (
    <div className="mt-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3 border border-slate-100 dark:border-slate-600">
      <div className="flex items-center gap-2 mb-2">
        <Wallet size={18} className="text-emerald-600" />
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Balance</span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">USDC</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">${usdc}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">B-Units</span>
          <span className="font-bold text-orange-500">{bUnits}</span>
        </div>
      </div>
    </div>
  )
}

/** 气泡内嵌 Add USDC 卡片 */
function InlineAddUsdcCard() {
  return (
    <div className="mt-2 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3 border border-slate-100 dark:border-slate-600">
      <p className="text-sm text-slate-600 dark:text-slate-300">Add USDC via Coinbase or bank transfer.</p>
    </div>
  )
}

/** 提交 AI 学习反馈到服务器。correctedAction：Beamio 提供的期望 UI，供 AI 学习 */
async function submitLearningFeedback(
  kind: "approved" | "corrected",
  userInput: string,
  action: BeamioAction,
  customRule?: string,
  correctedAction?: BeamioAction
): Promise<boolean> {
  const res = await fetch(`${beamioApi}/api/ai/learningFeedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, userInput, action, customRule, correctedAction }),
  })
  return res.ok
}

/** 根据 Beamio 反馈让 AI 重新生成 action（用于 UI 学习） */
async function regenerateActionWithFeedback(
  userInput: string,
  correction: string,
  originalAction: BeamioAction
): Promise<BeamioAction | null> {
  const syntheticInput = `User originally said: "${userInput}". Beamio feedback: "${correction}". Return the corrected action (prefer custom-ui for composite UI).`
  const history: Array<{ role: "user" | "assistant"; content: string }> = [
    { role: "user", content: userInput },
    { role: "assistant", content: `Previous action: ${JSON.stringify(originalAction)}` },
  ]
  const res = await fetch(`${beamioApi}/api/ai/beamioAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userText: syntheticInput, messages: history }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.action ?? null
}

/** 调用 Beamio 服务器 Gemini 2.5 Flash 接口，返回 BeamioAction。503/429 时自动重试 */
async function fetchBeamioAction(
  userText: string,
  messages: RenderActionMessage[],
  retries = 2
): Promise<BeamioAction | null> {
  const history = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }))
  const doFetch = async (): Promise<Response> => {
    const res = await fetch(`${beamioApi}/api/ai/beamioAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userText, messages: history }),
    })
    return res
  }
  let res = await doFetch()
  for (let i = 0; i < retries && (res.status === 503 || res.status === 429); i++) {
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)))
    res = await doFetch()
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = typeof err?.error === "string" ? err.error : err?.error?.message ?? `API ${res.status}`
    const friendly =
      res.status === 503 || /high demand|UNAVAILABLE|try again/i.test(msg)
        ? "AI is busy. Please try again in a moment."
        : msg
    throw new Error(friendly)
  }
  const data = await res.json()
  return data?.action ?? null
}

export default function RenderActionPage() {
  const navigate = useNavigate()
  const { myAddress, setShowFooter, usdcbalance } = useDaemonContext()
  const [messages, setMessages] = useState<RenderActionMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [expandedAction, setExpandedAction] = useState<BeamioAction | null>(null)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Set<string>>(new Set())
  const [correctModal, setCorrectModal] = useState<{
    msgId: string
    userInput: string
    action: BeamioAction
  } | null>(null)
  const [correctText, setCorrectText] = useState("")
  const [correctRegenerating, setCorrectRegenerating] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    setShowFooter(false)
    return () => setShowFooter(true)
  }, [setShowFooter])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput("")
    const userMsg: RenderActionMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    let action: BeamioAction | null = null
    try {
      action = await fetchBeamioAction(text, messages)
    } catch (e) {
      action = {
        type: "text",
        params: { content: (e instanceof Error ? e.message : "Request failed") },
      }
    }
    setLoading(false)

    const assistantMsg: RenderActionMessage = {
      id: `a_${Date.now()}`,
      role: "assistant",
      content: action?.type === "text" ? (action.params as { content: string }).content : "",
      action: action ?? undefined,
      triggeredByUserInput: text,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, assistantMsg])
  }

  const handleFeedback = async (
    msgId: string,
    kind: "approved" | "corrected",
    userInput: string,
    action: BeamioAction,
    customRule?: string,
    correctedAction?: BeamioAction
  ) => {
    const ok = await submitLearningFeedback(kind, userInput, action, customRule, correctedAction)
    if (ok) setFeedbackSubmitted((prev) => new Set(prev).add(msgId))
  }

  const handleCorrectRegenerate = async () => {
    if (!correctModal || !correctText.trim()) return
    setCorrectRegenerating(true)
    try {
      const newAction = await regenerateActionWithFeedback(
        correctModal.userInput,
        correctText.trim(),
        correctModal.action
      )
      if (newAction) {
        await handleFeedback(
          correctModal.msgId,
          "corrected",
          correctModal.userInput,
          correctModal.action,
          correctText.trim(),
          newAction
        )
      } else {
        await handleFeedback(
          correctModal.msgId,
          "corrected",
          correctModal.userInput,
          correctModal.action,
          correctText.trim()
        )
      }
      setCorrectModal(null)
      setCorrectText("")
    } finally {
      setCorrectRegenerating(false)
    }
  }

  const handleCorrectSaveOnly = async () => {
    if (!correctModal) return
    await handleFeedback(
      correctModal.msgId,
      "corrected",
      correctModal.userInput,
      correctModal.action,
      correctText.trim() || "User marked as incorrect"
    )
    setCorrectModal(null)
    setCorrectText("")
  }

  return (
    <div className="flex flex-col h-screen bg-[#f4f5f9] dark:bg-slate-900">
      {/* Header */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <Sparkles size={20} className="text-orange-500" />
          <h1 className="text-lg font-black text-slate-800 dark:text-slate-100">Beamio AI</h1>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Sparkles size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">Say what you want to do</p>
            <p className="text-xs mt-1">e.g. &quot;Send $5 to @Simon&quot;, &quot;Balance&quot;, &quot;Fuel&quot;</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-[#1562f0] text-white"
                  : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700"
              }`}
            >
              {msg.role === "user" ? (
                <p className="text-[15px]">{msg.content}</p>
              ) : (
                <>
                  {msg.content && <p className="text-[15px] mb-2">{msg.content}</p>}
                  {msg.action && msg.action.type !== "text" && (
                    <div className="mt-2">
                      {msg.action.type === "custom-ui" && (
                        <DynamicUIRenderer
                          ui={msg.action.params?.ui}
                          compact
                          onActionClick={(action) => setExpandedAction(action)}
                        />
                      )}
                      {msg.action.type === "balance" && (
                        <InlineBalanceCard usdcbalance={usdcbalance} myAddress={myAddress ?? ""} />
                      )}
                      {msg.action.type === "add-usdc" && <InlineAddUsdcCard />}
                      {msg.action.type === "history" &&
                        typeof (msg.action.params as { limit?: number })?.limit === "number" && (
                          <InlineHistoryPreview
                            limit={(msg.action.params as { limit?: number }).limit}
                            onOpenFull={() => setExpandedAction(msg.action!)}
                          />
                        )}
                      {msg.action.type === "history" &&
                        typeof (msg.action.params as { limit?: number })?.limit !== "number" && (
                          <button
                            onClick={() => setExpandedAction(msg.action!)}
                            className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            Open History
                          </button>
                        )}
                      {["pay", "fuel", "edit-profile", "generate-avatar-image"].includes(msg.action.type) && (
                        <button
                          onClick={() => setExpandedAction(msg.action!)}
                          className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          {msg.action.type === "pay" && "Send USDC"}
                          {msg.action.type === "fuel" && "Open Fuel Center"}
                          {msg.action.type === "edit-profile" && "Edit Profile"}
                          {msg.action.type === "generate-avatar-image" && "Generate Avatar Image"}
                        </button>
                      )}
                      {!["pay", "fuel", "balance", "add-usdc", "custom-ui", "edit-profile", "history", "generate-avatar-image"].includes(msg.action.type) && (
                        <button
                          onClick={() => setExpandedAction(msg.action!)}
                          className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          Open {msg.action.type}
                        </button>
                      )}
                    </div>
                  )}
                  {msg.role === "assistant" &&
                    msg.action &&
                    msg.triggeredByUserInput &&
                    !feedbackSubmitted.has(msg.id) && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() =>
                            handleFeedback(msg.id, "approved", msg.triggeredByUserInput!, msg.action!)
                          }
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                          <ThumbsUp size={14} />
                          Satisfied
                        </button>
                        <button
                          onClick={() =>
                            setCorrectModal({
                              msgId: msg.id,
                              userInput: msg.triggeredByUserInput!,
                              action: msg.action!,
                            })
                          }
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        >
                          <Pencil size={14} />
                          Correct
                        </button>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <Loader2 size={20} className="animate-spin text-orange-500" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Send $5 to @Simon"
            className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-orange-500/30"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-12 h-12 rounded-xl bg-[#1562f0] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* Correction modal：Beamio 反馈，AI 学习 */}
      {correctModal && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/50">
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl border border-slate-100 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
              Correct UI
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              Describe what you want. AI will learn and generate better UI next time.
            </p>
            <textarea
              value={correctText}
              onChange={(e) => setCorrectText(e.target.value)}
              placeholder="e.g. Put balance first, then Add USDC button"
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-600 resize-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleCorrectRegenerate}
                disabled={!correctText.trim() || correctRegenerating}
                className="flex-1 py-3 rounded-xl bg-[#1562f0] text-white font-bold disabled:opacity-50"
              >
                {correctRegenerating ? "Regenerating..." : "Regenerate & Save"}
              </button>
              <button
                onClick={handleCorrectSaveOnly}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold"
              >
                Save description
              </button>
              <button
                onClick={() => {
                  setCorrectModal(null)
                  setCorrectText("")
                }}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
          <div
            className="absolute inset-0 -z-10"
            onClick={() => {
              setCorrectModal(null)
              setCorrectText("")
            }}
            aria-hidden
          />
        </div>
      )}

      {/* Expanded Action：pay/fuel 全屏，其余弹窗 */}
      {expandedAction && (
        <>
          {["pay", "fuel"].includes(expandedAction.type) ? (
            <ActionRenderer
              action={expandedAction}
              onClose={() => setExpandedAction(null)}
              onComplete={() => setExpandedAction(null)}
              onActionClick={(a) => setExpandedAction(a)}
            />
          ) : (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
              <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <ActionRenderer
                  action={expandedAction}
                  onClose={() => setExpandedAction(null)}
                  onComplete={() => setExpandedAction(null)}
                  onActionClick={(a) => setExpandedAction(a)}
                />
              </div>
              <div
                className="absolute inset-0 -z-10"
                onClick={() => setExpandedAction(null)}
                aria-hidden
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
