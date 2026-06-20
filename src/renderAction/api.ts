/**
 * Beamio AI API：调用 Cluster /api/ai/chat（由 Cluster 直接调 Gemini 2.5 Flash）
 */
import { beamioApi } from "@/utils/constants"
import type { BeamioAction } from "./types"
import { tu } from '@/locale/beamioLocale'

export type AiChatMessage = { role: "user" | "assistant"; content: string }

export async function fetchBeamioAiChat(
  messages: AiChatMessage[],
  userText: string
): Promise<{ action: BeamioAction } | { error: string }> {
  const res = await fetch(`${beamioApi}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, userText }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: data?.error ?? res.statusText ?? tu('request_failed') }
  }
  if (data?.action) {
    return { action: data.action as BeamioAction }
  }
  return { error: data?.error ?? "Invalid response" }
}
