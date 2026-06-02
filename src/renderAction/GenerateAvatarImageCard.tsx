import { IpfsImg } from '@/components/IpfsImg';
/**
 * Generate avatar image: uses Pollinations.ai for AI image generation (any prompt).
 * Fallback to The Cat API for instant cat photos when prompt is "cat".
 * User can download or set as profile avatar.
 */

import React, { useEffect, useRef, useState } from "react"
import { Download, Loader2, Image as ImageIcon, Check } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { postBeamio, storeSystemData } from "@/services/beamio"
import { CoNET_Data, setCoNET_Data } from "@/utils/globals"
import { beamioApi } from "@/utils/constants"

const CAT_API = "https://api.thecatapi.com/v1/images/search?limit=1"

/** 透過 beamio 後端 proxy 取得 Pollinations 圖片，避免 403/CORS */
function getGenerateImageProxyUrl(prompt: string): string {
  const text = (prompt || "a cute avatar").trim()
  return `${beamioApi}/api/ai/generateImage?prompt=${encodeURIComponent(text)}`
}

export function GenerateAvatarImageCard({
  action,
  onClose,
  onComplete,
}: {
  action: { type: string; params?: { prompt?: string } }
  onClose: () => void
  onComplete?: () => void
}) {
  const { profiles, beamio, setBeamio } = useDaemonContext()
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [permanentUrl, setPermanentUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const blobUrlRef = useRef<string | null>(null)

  const rawPrompt = (action.params?.prompt ?? "a cute cat avatar").trim()
  const promptLower = rawPrompt.toLowerCase()
  const useCatApi = /^(cat|kitten|貓|小猫)$/.test(promptLower) && rawPrompt.length < 20

  useEffect(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    if (useCatApi) {
      fetch(CAT_API)
        .then((r) => r.json())
        .then((arr: { url?: string }[]) => {
          const url = arr?.[0]?.url
          if (url) {
            setImageUrl(url)
            setPermanentUrl(url)
          } else setError("No image returned")
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to fetch"))
        .finally(() => setLoading(false))
    } else {
      const url = getGenerateImageProxyUrl(rawPrompt)
      setPermanentUrl(url)
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 90_000)
      fetch(url, { signal: ctrl.signal, mode: "cors" })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.blob()
        })
        .then((blob) => {
          if (!blob.type.startsWith("image/")) throw new Error("Not an image")
          const u = URL.createObjectURL(blob)
          blobUrlRef.current = u
          setImageUrl(u)
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to generate"))
        .finally(() => {
          clearTimeout(t)
          setLoading(false)
        })
    }
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [rawPrompt, useCatApi])

  const handleDownload = () => {
    if (!imageUrl) return
    const a = document.createElement("a")
    a.href = imageUrl
    a.download = `generated-${rawPrompt.slice(0, 20).replace(/\s/g, "-") || "image"}.png`
    a.target = "_blank"
    a.rel = "noopener noreferrer"
    a.click()
  }

  const handleSetAsAvatar = async () => {
    const urlToUse = permanentUrl || imageUrl
    if (!urlToUse || !profiles?.[0] || !beamio) return
    setSaving(true)
    try {
      const bo = { ...beamio, image: urlToUse }
      const ok = await postBeamio(bo, profiles[0].privateKeyArmor)
      if (ok) {
        const tmp = CoNET_Data
        if (tmp?.beamio) tmp.beamio = bo
        setCoNET_Data(tmp)
        await storeSystemData()
        setBeamio(bo)
        setSaved(true)
        onComplete?.()
      } else {
        setError("Failed to save")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  if (loading && !imageUrl) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 size={24} className="animate-spin text-orange-500" />
          <span className="text-slate-600 dark:text-slate-300">Generating image…</span>
        </div>
        <button onClick={onClose} className="mt-2 w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
          Close
        </button>
      </div>
    )
  }

  if (error && !imageUrl) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg border border-slate-100 dark:border-slate-700">
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-4 border border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
        </div>
        <button onClick={onClose} className="mt-4 w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-lg border border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <ImageIcon size={24} className="text-orange-600" />
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Generated Image</h3>
          <p className="text-sm text-slate-500">{rawPrompt || "Your image"}</p>
        </div>
      </div>
      {imageUrl && (
        <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 mb-4 relative bg-slate-100 dark:bg-slate-700 min-h-[200px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-200/80 dark:bg-slate-600/80 z-10">
              <Loader2 size={32} className="animate-spin text-orange-500" />
              <span className="ml-2 text-sm">Generating…</span>
            </div>
          )}
          <IpfsImg
            src={imageUrl}
            alt={rawPrompt}
            className="w-full h-auto max-h-64 object-cover"
            onLoad={() => setLoading(false)}
          />
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          disabled={!imageUrl}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold disabled:opacity-50"
        >
          <Download size={18} />
          Download
        </button>
        <button
          onClick={handleSetAsAvatar}
          disabled={!imageUrl || saving}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1562f0] text-white font-bold disabled:opacity-50"
        >
          {saved ? <Check size={18} /> : saving ? <Loader2 size={18} className="animate-spin" /> : null}
          {saved ? "Saved" : saving ? "Saving…" : "Set as avatar"}
        </button>
      </div>
      <button onClick={onClose} className="mt-2 w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
        Close
      </button>
    </div>
  )
}
