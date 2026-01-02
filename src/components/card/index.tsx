import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createAvatar, type Style } from '@dicebear/core'
import { avataaars, bottts, identicon, lorelei } from '@dicebear/collection'


export type DiceBearCardResult = {
  seed: string
  style: DiceBearStyle
  svg: string
  svgDataUrl: string
  pngDataUrl?: string
}

function svgToDataUrl(svg: string) {
  // 避免中文/特殊字符导致 data url 失效
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')
  return `data:image/svg+xml,${encoded}`
}

async function svgToPngDataUrl(svg: string, size = 512): Promise<string> {
  // 把 SVG 渲染到 canvas，再导出 PNG dataURL
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    const img = new Image()
    // 关键：避免跨域污染 canvas（这里是 blob url，仍然建议保留）
    img.crossOrigin = 'anonymous'

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG image load failed'))
      img.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context not available')

    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(img, 0, 0, size, size)

    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

type DiceBearStyle = 'avataaars' | 'bottts' | 'identicon' | 'lorelei'

function pickStyle(s: DiceBearStyle): Style<any> {
  switch (s) {
    case 'avataaars':
      return avataaars as unknown as Style<any>
    case 'bottts':
      return bottts as unknown as Style<any>
    case 'identicon':
      return identicon as unknown as Style<any>
    case 'lorelei':
      return lorelei as unknown as Style<any>
    default:
      return avataaars as unknown as Style<any>
  }
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const styles: { value: DiceBearStyle; label: string }[] = [
  { value: 'avataaars', label: 'Avataaars (people)' },
  { value: 'bottts', label: 'Bottts (robots)' },
  { value: 'identicon', label: 'Identicon (hash)' },
  { value: 'lorelei', label: 'Lorelei (cartoon)' }
]

const DiceBearCard = ({
  defaultSeed = '',
  defaultStyle = 'avataaars',
  onResult
}: {
  defaultSeed?: string
  defaultStyle?: DiceBearStyle
  onResult?: (result: DiceBearCardResult) => void
}) => {
  const [seedInput, setSeedInput] = useState(defaultSeed)
  const [seed, setSeed] = useState(defaultSeed || 'beamio')
  const [style, setStyle] = useState<DiceBearStyle>(defaultStyle)

  const [pngDataUrl, setPngDataUrl] = useState<string | undefined>(undefined)
  const [busyPng, setBusyPng] = useState(false)
  const [err, setErr] = useState<string>('')

  // debounce 输入，减少频繁生成
  const debounceRef = useRef<number | null>(null)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      const trimmed = seedInput.trim()
      setSeed(trimmed || 'beamio')
    }, 200)

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [seedInput])

const svg = useMemo(() => {
  try {
    setErr('')
    const avatar = createAvatar(pickStyle(style), { seed, size: 256 })
    return avatar.toString()
  } catch (e: any) {
    setErr(e?.message || 'Failed to create avatar')
    return ''
  }
}, [seed, style])

  const svgDataUrl = useMemo(() => {
    if (!svg) return ''
    return svgToDataUrl(svg)
  }, [svg])

  // 每次 seed/style 变化都清空 png（避免显示旧结果）
  useEffect(() => {
    setPngDataUrl(undefined)
  }, [seed, style])

  // 把结果回传给父组件（可选）
  useEffect(() => {
    if (!svg || !svgDataUrl) return
    const result: DiceBearCardResult = {
      seed,
      style,
      svg,
      svgDataUrl,
      pngDataUrl
    }
    onResult?.(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, style, svg, svgDataUrl, pngDataUrl])

  const makePng = async () => {
    if (!svg) return
    setBusyPng(true)
    setErr('')
    try {
      const out = await svgToPngDataUrl(svg, 768)
      setPngDataUrl(out)
    } catch (e: any) {
      setErr(e?.message || 'Failed to export PNG')
    } finally {
      setBusyPng(false)
    }
  }

  const downloadSvg = () => {
    if (!svgDataUrl) return
    downloadDataUrl(svgDataUrl, `dicebear-${style}-${seed}.svg`)
  }

  const downloadPng = () => {
    if (!pngDataUrl) return
    downloadDataUrl(pngDataUrl, `dicebear-${style}-${seed}.png`)
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-slate-900">DiceBear Card</div>
          <div className="mt-0.5 text-[12px] text-slate-500">
            输入 keyword（seed）即可生成固定头像/卡片
          </div>
        </div>

        <div className="shrink-0 text-[11px] text-slate-500 tabular-nums">
          {style} / {seed || 'beamio'}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <label className="text-[12px] text-slate-600">Keyword (seed)</label>
        <input
          value={seedInput}
          onChange={e => setSeedInput(e.currentTarget.value)}
          placeholder="e.g. peter, beamio, wallet address..."
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:ring-2 focus:ring-sky-200"
          spellCheck={false}
        />

        <label className="mt-2 text-[12px] text-slate-600">Style</label>
        <select
          value={style}
          onChange={e => setStyle(e.currentTarget.value as DiceBearStyle)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:ring-2 focus:ring-sky-200"
        >
          {styles.map(s => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* 卡片预览 */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-2">
            {svgDataUrl ? (
              <img
                src={svgDataUrl}
                alt="dicebear"
                className="h-24 w-24 rounded-xl object-contain"
              />
            ) : (
              <div className="h-24 w-24 rounded-xl bg-slate-100" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-slate-900 truncate">
              Happy Birthday 🎉
            </div>
            <div className="mt-1 text-[12px] text-slate-600 truncate">
              keyword: <span className="font-mono text-slate-800">{seed}</span>
            </div>
            <div className="mt-1 text-[12px] text-slate-600 truncate">
              style: <span className="font-mono text-slate-800">{style}</span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadSvg}
                disabled={!svgDataUrl}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 hover:bg-slate-100 disabled:opacity-50"
              >
                Download SVG
              </button>

              <button
                type="button"
                onClick={makePng}
                disabled={!svg || busyPng}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 hover:bg-slate-100 disabled:opacity-50"
              >
                {busyPng ? 'Exporting…' : 'Export PNG'}
              </button>

              <button
                type="button"
                onClick={downloadPng}
                disabled={!pngDataUrl}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-[12px] text-slate-900 hover:bg-slate-100 disabled:opacity-50"
              >
                Download PNG
              </button>
            </div>
          </div>
        </div>

        {pngDataUrl && (
          <div className="mt-3">
            <div className="text-[12px] text-slate-600">PNG preview</div>
            <img
              src={pngDataUrl}
              alt="png preview"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white"
            />
          </div>
        )}

        {err && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {err}
          </div>
        )}
      </div>
    </div>
  )
}

export default DiceBearCard
