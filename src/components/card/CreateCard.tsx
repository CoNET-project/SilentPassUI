import React, { useEffect, useMemo, useRef, useState } from "react"
import { images } from "./cards"
import BeamioDetail from "./beamioCard"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { X, Check, Plus } from "lucide-react"

export type ClosePayload = {
  title: string
  detail: string
  bgIndex: number
  // ✅ 父容器只接受 base64（data:image/...;base64,...）
  bgBase64: string
}

type EditField = null | "title" | "detail" | "logo"

type Props = {
  initialTitle?: string
  initialDetail?: string
  initialBgIndex?: number
  initialLogoText?: string
  onClose: (payload: ClosePayload|null) => void
  currencyText: string
  usdcAmount: string
}

/** 🔐 顶栏高度*/
const HEADER_H = 120
const TOP_OFFSET = `calc(env(safe-area-inset-top) + ${HEADER_H}px)`

// ✅ iOS 风格：导航按钮在 safe-area 下方一点点
const NAV_TOP = "calc(env(safe-area-inset-top) + 10px)"

const TEXT_MAX_W = 420
const TEXT_PAD_X = 20

const LIMIT_H = 1280
const LIMIT_W = 720

// ✅ IndexedDB
const DB_NAME = "beamio_card_bg"
const DB_VER = 1
const STORE = "backgrounds"

// ✅ base64 cache (LRU)
const BASE64_CACHE_MAX = 12

function isDefaultLike(current: string, initial: string) {
  const c = current.replace(/\s+/g, " ").trim()
  const i = initial.replace(/\s+/g, " ").trim()

  if (!i) return false
  if (c === i) return true
  if (c.includes(i)) return true
  if (c.length === 0) return true
  return false
}

/* ===========================
   Base64 helpers
=========================== */
function blobToDataURL(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(fr.error)
    fr.readAsDataURL(blob) // data:image/...;base64,...
  })
}

async function srcToBase64(src: string, blobMap: Record<string, Blob>) {
  if (!src) return ""

  // ✅ objectURL（我们自己生成的）→ 直接用 blob（避免 fetch objectURL）
  const hit = blobMap[src]
  if (hit) return await blobToDataURL(hit)

  // ✅ 默认背景（import images）或其它同源资源 → fetch 转 blob
  const res = await fetch(src)
  const blob = await res.blob()
  return await blobToDataURL(blob)
}

/* ===========================
   IndexedDB helpers (Blob)
=========================== */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbAddBlob(blob: Blob) {
  const db = await openDb()
  return new Promise<number>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    const store = tx.objectStore(STORE)
    const req = store.add({ blob, createdAt: Date.now() })

    req.onsuccess = () => {
      resolve(Number(req.result))
      db.close()
    }
    req.onerror = () => {
      reject(req.error)
      db.close()
    }
  })
}

async function idbGetAllBlobs() {
  const db = await openDb()
  return new Promise<Array<{ id: number; blob: Blob; createdAt: number }>>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const store = tx.objectStore(STORE)
    const req = store.getAll()

    req.onsuccess = () => {
      const rows = (req.result || []) as Array<{ id: number; blob: Blob; createdAt: number }>
      rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      resolve(rows)
      db.close()
    }
    req.onerror = () => {
      reject(req.error)
      db.close()
    }
  })
}

/* ===========================
   Downscale helpers
   规则：先按高 1280，若宽<720，则改按宽 720
   仅当 w>720 且 h>1280 才触发
=========================== */
function loadImageFromBlob(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = err => {
      URL.revokeObjectURL(url)
      reject(err)
    }
    img.src = url
  })
}

async function maybeDownscaleToBlob(file: File) {
  const img = await loadImageFromBlob(file)
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height

  // ✅ 只有当两边都超阈值才降像素
  if (!(w > LIMIT_W && h > LIMIT_H)) return file as Blob

  // ✅ 先按高缩到 1280
  const scaleH = LIMIT_H / h
  const wAfterH = w * scaleH

  // ✅ 若此时宽<720，则改按宽缩到 720（高按比例，允许 >1280）
  const scale = wAfterH >= LIMIT_W ? scaleH : LIMIT_W / w

  const tw = Math.max(1, Math.round(w * scale))
  const th = Math.max(1, Math.round(h * scale))

  const canvas = document.createElement("canvas")
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext("2d")
  if (!ctx) return file as Blob

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, 0, 0, tw, th)

  const out = await new Promise<Blob>(resolve => {
    // 背景图用 JPEG 更省空间；如果你必须保留透明才改回 image/png
    canvas.toBlob(b => resolve(b || (file as Blob)), "image/jpeg", 0.92)
  })

  return out
}

export default function DiceBearCardFullscreenEditor({
  initialTitle = "Your dynamic text goes here",
  initialDetail = "Write some detail…",
  initialBgIndex = 0,
  initialLogoText = "Your logo",
  onClose,
  currencyText,
  usdcAmount
}: Props) {
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const { beamio } = useDaemonContext()

  // ✅ 背景列表：从 cards.ts 的 images 初始化，然后允许追加用户上传/DB载入
  const [bgList, setBgList] = useState<string[]>(() => images.slice())

  const clampIndex = (idx: number, list: string[]) =>
    Math.max(0, Math.min(idx, Math.max(list.length - 1, 0)))

  const [bgIndex, setBgIndex] = useState(() => clampIndex(initialBgIndex, bgList))

  // ✅ 用于 Cancel（丢弃所有更改）
  const initialSnapshotRef = useRef({
    title: initialTitle,
    detail: initialDetail,
    bgIndex: clampIndex(initialBgIndex, images)
  })

  /* ================== WYSIWYG 编辑状态 ================== */
  const [edit, setEdit] = useState<EditField>(null)
  const beforeRef = useRef({ title: initialTitle, detail: initialDetail })

  const titleRef = useRef<HTMLTextAreaElement | null>(null)
  const detailRef = useRef<HTMLTextAreaElement | null>(null)
  const logoRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<HTMLDivElement | null>(null)

  /* ================== 缩略图条 ================== */
  const hideThumbTimer = useRef<number | null>(null)
  const [thumbsMounted, setThumbsMounted] = useState(false)
  const [thumbsAnim, setThumbsAnim] = useState<"in" | "out">("in")
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])

  /* ================== 上传按钮 input ================== */
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ✅ 记录我们创建的 objectURL，卸载时统一 revoke
  const objectUrlsRef = useRef<string[]>([])

  // ✅ objectURL -> Blob：用于把用户上传/DB 的图片变 base64（避免 fetch objectURL）
  const bgBlobMapRef = useRef<Record<string, Blob>>({})

  // ✅ 背景 base64 缓存（LRU）
  const bgBase64CacheRef = useRef<Map<string, string>>(new Map())

  // ✅ 生成任务版本号（切换太快时丢弃旧任务结果）
  const pregenTokenRef = useRef(0)

  const currentIndex = useMemo(() => {
    if (!bgList.length) return 0
    return clampIndex(bgIndex, bgList)
  }, [bgIndex, bgList])

  const bgSrc = bgList[currentIndex] || bgList[0] || ""
  const bgBreathing = thumbsMounted

  const resetHideTimer = () => {
		if (isPickingFile.current) return // ✅ 文件选择中，不允许隐藏

		if (hideThumbTimer.current) window.clearTimeout(hideThumbTimer.current)

		hideThumbTimer.current = window.setTimeout(() => {
			setThumbsAnim("out")
			hideThumbTimer.current = null
		}, 3000)
	}


  /* ================== 样式 ================== */
  const TITLE_CLASS = [
    "font-extrabold",
    "text-[34px]",
    "leading-tight",
    "tracking-tight",
    "text-yellow-400",
    "drop-shadow-[0_3px_2px_rgba(0,0,0,0.55)]"
  ].join(" ")

  const DETAIL_CLASS = [
    "text-[24px]",
    "leading-[1.6]",
    "font-semibold",
    "text-white/95",
    "drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]",
    "mt-10"
  ].join(" ")

  const autosize = (el: HTMLTextAreaElement | null, maxPx: number) => {
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`
  }

  /* ================== 编辑控制 ================== */
  const beginEdit = (field: Exclude<EditField, null>) => {
    beforeRef.current = { title, detail }
    setEdit(field)

    requestAnimationFrame(() => {
      if (field === "title") {
        const el = titleRef.current
        if (!el) return

        autosize(el, 260)
        el.focus()

        const isDefault = isDefaultLike(title, initialTitle)
        if (isDefault) el.setSelectionRange(0, el.value.length)
        else el.setSelectionRange(el.value.length, el.value.length)
        return
      }

      if (field === "detail") {
        const el = detailRef.current
        if (!el) return

        autosize(el, 200)
        el.focus()

        const isDefault = isDefaultLike(detail, initialDetail)
        if (isDefault) el.setSelectionRange(0, el.value.length)
        else el.setSelectionRange(el.value.length, el.value.length)
        return
      }

    })
  }

  const cancelEdit = () => {
    setTitle(beforeRef.current.title)
    setDetail(beforeRef.current.detail)
    setEdit(null)
  }

  const commitEdit = () => setEdit(null)

  /* ================== 缓存/LRU helpers ================== */
  const cacheGet = (k: string) => bgBase64CacheRef.current.get(k)

  const cacheSetLRU = (k: string, v: string) => {
    const m = bgBase64CacheRef.current
    if (m.has(k)) m.delete(k) // bump recency
    m.set(k, v)
    while (m.size > BASE64_CACHE_MAX) {
      const oldestKey = m.keys().next().value as string | undefined
      if (!oldestKey) break
      m.delete(oldestKey)
    }
  }

  /* ================== 后台预生成 base64（当前背景） ================== */
  useEffect(() => {
    if (!bgSrc) return

    // 已缓存就不做
    if (cacheGet(bgSrc)) return

    const myToken = ++pregenTokenRef.current
    let cancelled = false

    const run = async () => {
      // ✅ 给 UI 一点喘息：切换后稍微延迟再做（避免连点时抢主线程）
      await new Promise<void>(r => setTimeout(() => r(), 80))
      if (cancelled) return
      if (myToken !== pregenTokenRef.current) return

      try {
        const b64 = await srcToBase64(bgSrc, bgBlobMapRef.current)
        if (cancelled) return
        if (myToken !== pregenTokenRef.current) return
        if (b64) cacheSetLRU(bgSrc, b64)
      } catch {
        // ignore
      }
    }

    run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgSrc])

  /* ================== 背景切换 ================== */
  const showThumbsWithAutoHide = () => {
    setThumbsMounted(true)
	setThumbsAnim("in")

	resetHideTimer()
  }

  const goIndex = (next: number) => {
    if (!bgList.length) return
    const n = ((next % bgList.length) + bgList.length) % bgList.length
    setBgIndex(n)
    showThumbsWithAutoHide()

    requestAnimationFrame(() => {
      thumbRefs.current[n]?.scrollIntoView({ behavior: "smooth", inline: "center" })
    })
  }

  const goPrev = () => goIndex(currentIndex - 1)
  const goNext = () => goIndex(currentIndex + 1)

  /* ================== 上传背景（降像素 + 写入 DB Blob + objectURL） ================== */
  const openFilePicker = () => {
      setThumbsMounted(true)
		setThumbsAnim("in")

		// ✅ 冻结 auto-hide
		isPickingFile.current = true
		if (hideThumbTimer.current) {
			window.clearTimeout(hideThumbTimer.current)
			hideThumbTimer.current = null
		}

		// ✅ 等用户从文件选择器回来（选完 or 取消），恢复计时
		const onBack = () => {
			window.removeEventListener("focus", onBack)
			isPickingFile.current = false
			resetHideTimer() // 回来后再等 3 秒隐藏
		}

		window.addEventListener("focus", onBack, { once: true })

		// 触发系统选择器
		fileInputRef.current?.click()
  }

 const onPickFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
	const input = e.currentTarget

	try {
		const file = input.files?.[0]
		if (!file) return
		if (!file.type.startsWith("image/")) return

		// 可选：限制大小（例如 12MB；降像素后会更小）
		const MAX = 12 * 1024 * 1024
		if (file.size > MAX) return

		// ✅ 1) 降像素（严格规则）
		const blob = await maybeDownscaleToBlob(file)

		// ✅ 2) 写入 IndexedDB（Blob）
		await idbAddBlob(blob)

		// ✅ 3) 生成 objectURL 加入 bgList
		const url = URL.createObjectURL(blob)
		objectUrlsRef.current.push(url)
		bgBlobMapRef.current[url] = blob

		setBgList(prev => {
		const next = prev.concat([url])
		const newIndex = next.length - 1

		requestAnimationFrame(() => {
			setBgIndex(newIndex)

			// 这里会触发 resetHideTimer（前提：isPickingFile 已经在 finally 里设回 false）
			showThumbsWithAutoHide()

			requestAnimationFrame(() => {
			thumbRefs.current[newIndex]?.scrollIntoView({
				behavior: "smooth",
				inline: "center",
			})
			})
		})

		return next
		})
	} catch {
		// ignore
	} finally {
		// ✅ 选完文件后：确保恢复（无论成功/失败/不合法 return）
		isPickingFile.current = false
		resetHideTimer()

		// ✅ 允许重复选择同一张图
		input.value = ""
	}
}

  // ✅ OK：提交当前（优先用预生成缓存）
  const ok = async () => {
    const cached = cacheGet(bgSrc)
    const bgBase64 = cached || (await srcToBase64(bgSrc, bgBlobMapRef.current))
    if (!cached && bgBase64) cacheSetLRU(bgSrc, bgBase64)

    onClose({
      title,
      detail,
      bgIndex: currentIndex,
      bgBase64
    })
  }

  // ✅ Cancel：丢弃所有更改，返回 initial（也回送 base64）
  const cancel = async () => {
		const snap = initialSnapshotRef.current
		const idx = clampIndex(snap.bgIndex, images)
		const src = images[idx] || images[0] || ""

		const cached = cacheGet(src)
		const bgBase64 = cached || (await srcToBase64(src, bgBlobMapRef.current))
		if (!cached && bgBase64) cacheSetLRU(src, bgBase64)

		onClose(null)
  }
  	const isPickingFile = useRef(false)
	const resumeAfterPicker = useRef<null | (() => void)>(null)

  /* ================== 打开组件时：从 IndexedDB 读 Blob -> createObjectURL -> 追加 ================== */
  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const rows = await idbGetAllBlobs()
        if (!alive) return
        if (!rows.length) return

        const urls: string[] = []
        for (const r of rows) {
          if (!r?.blob) continue
          const url = URL.createObjectURL(r.blob)
          urls.push(url)
          bgBlobMapRef.current[url] = r.blob
        }

        objectUrlsRef.current.push(...urls)
        setBgList(prev => prev.concat(urls))
      } catch {
        // ignore
      }
    })()

    return () => {
      alive = false
      if (hideThumbTimer.current) window.clearTimeout(hideThumbTimer.current)

      for (const u of objectUrlsRef.current) URL.revokeObjectURL(u)
      objectUrlsRef.current = []
      bgBlobMapRef.current = {}
      bgBase64CacheRef.current.clear()
    }
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPickFile}
      />

      <style>{`
        @keyframes thumbsIn {
          0% { transform: translateY(115%); opacity: 0 }
          60% { transform: translateY(-20%); opacity: 1 }
          100% { transform: translateY(0); opacity: 1 }
        }
        @keyframes thumbsOut {
          0% { transform: translateY(0); opacity: 1 }
          100% { transform: translateY(45%); opacity: 0 }
        }
        .thumbs-in { animation: thumbsIn 420ms cubic-bezier(0.2,0.9,0.2,1) both }
        .thumbs-out { animation: thumbsOut 260ms cubic-bezier(0.2,0,0.2,1) both }

        @keyframes bgBreath {
          0% { transform: scale(1) }
          50% { transform: scale(1.03) }
          100% { transform: scale(1) }
        }
        .bg-breath { animation: bgBreath 2.6s ease-in-out infinite }
      `}</style>

      {/* ===== 全屏背景（就是卡片） ===== */}
      <div className="absolute inset-0">
        <div className={bgBreathing ? "absolute inset-0 bg-breath" : "absolute inset-0"}>
          {bgSrc && (
            <img
              src={bgSrc}
              alt="card-bg"
              className="w-full h-full object-cover"
              draggable={false}
            />
          )}
        </div>
        <div
          className="absolute inset-0 bg-black/20"
          style={{ WebkitBackdropFilter: "blur(1px)", backdropFilter: "blur(1px)" }}
        />
      </div>

      {/* ✅ iOS 顶部：左 Cancel(X) + 右 OK(Check) */}
      <button
        type="button"
        onClick={cancel}
        className="
          absolute left-3 z-30
          w-10 h-10 rounded-full
          bg-white/10
          backdrop-blur-md
          border border-white/20
          shadow-[0_6px_16px_rgba(0,0,0,0.06)]
          hover:bg-white/15
          active:scale-95
          transition
          mt-16
        "
        style={{ top: NAV_TOP }}
        aria-label="Cancel"
      >
        <X className="w-5 h-5 mx-auto text-white/40 translate-y-[2px]" />
      </button>

      <button
        type="button"
        onClick={ok}
        className="
          absolute right-3 z-30
          w-10 h-10 rounded-full
          bg-white/10
          backdrop-blur-md
          border border-white/20
          shadow-[0_6px_16px_rgba(0,0,0,0.06)]
          hover:bg-white/15
          active:scale-95
          transition
          mt-16
        "
        style={{ top: NAV_TOP }}
        aria-label="OK"
      >
        <Check className="w-5 h-5 mx-auto text-white/40 translate-y-[2px]" />
      </button>

      {/* ===== WYSIWYG 编辑层 ===== */}
      <div ref={editorRef} className="absolute inset-0 z-20">
        {/* Title / Detail（居中 + 最大宽 420） */}
        <div
          className="absolute"
          style={{
            top: `calc(${TOP_OFFSET} + 12px)`,
            left: "50%",
            transform: "translateX(-50%)",
            width: `min(${TEXT_MAX_W}px, calc(100vw - ${TEXT_PAD_X * 2}px))`
          }}
        >
          {/* Title */}
          {edit === "title" ? (
            <textarea
              ref={titleRef}
              value={title}
              onChange={e => {
                setTitle(e.currentTarget.value)
                autosize(e.currentTarget, 260)
              }}
              onKeyDown={e => {
                if (e.key === "Escape") {
                  e.preventDefault()
                  cancelEdit()
                }
              }}
              onBlur={commitEdit}
              rows={1}
              className={[
                "w-full",
                "bg-transparent outline-none resize-none",
                "caret-yellow-200",
                TITLE_CLASS
              ].join(" ")}
              style={{ whiteSpace: "pre-wrap" }}
              placeholder="Your dynamic text goes here"
            />
          ) : (
            <button
              type="button"
              onClick={() => beginEdit("title")}
              className={["w-full", "bg-transparent text-left", TITLE_CLASS].join(" ")}
              style={{ whiteSpace: "pre-wrap" }}
              aria-label="Edit title"
            >
              {title || initialTitle}
            </button>
          )}

          {/* Detail */}
          <div className="mt-2">
            {edit === "detail" ? (
              <textarea
                ref={detailRef}
                value={detail}
                onChange={e => {
                  setDetail(e.currentTarget.value)
                  autosize(e.currentTarget, 200)
                }}
                onKeyDown={e => {
                  if (e.key === "Escape") {
                    e.preventDefault()
                    cancelEdit()
                  }
                }}
                onBlur={commitEdit}
                rows={2}
                className={[
                  "w-full",
                  "bg-transparent outline-none resize-none",
                  "caret-white/90",
                  DETAIL_CLASS
                ].join(" ")}
                style={{ whiteSpace: "pre-wrap" }}
                placeholder="Write some detail…"
              />
            ) : (
              <button
                type="button"
                onClick={() => beginEdit("detail")}
                className={["w-full", "bg-transparent text-left", DETAIL_CLASS].join(" ")}
                style={{ whiteSpace: "pre-wrap" }}
                aria-label="Edit detail"
              >
                {detail || initialDetail}
              </button>
            )}
          </div>
        </div>

        {/* Logo（你这里用 BeamioDetail 展示） */}
        <div
          className="
            absolute
            left-1/2
            -translate-x-1/2
            bottom-[calc(env(safe-area-inset-bottom)+120px)]
            z-50
          "
        >
          <BeamioDetail item={beamio} currencyText={currencyText} usdcAmount={usdcAmount} />
        </div>

        {/* < > 背景切换 */}
        <button
          type="button"
          onClick={goPrev}
          className="
            absolute
            left-3
            top-1/2
            -translate-y-1/2
            z-30
            w-10 h-10
            rounded-full
            bg-white/[0.06]
            backdrop-blur-sm
            border border-white/10
            shadow-[0_6px_16px_rgba(0,0,0,0.06)]
            hover:bg-white/15
            active:scale-95
            transition
          "
          aria-label="Prev background"
        >
          <span className="text-white/30 text-lg leading-none">&lt;</span>
        </button>

        <button
          type="button"
          onClick={goNext}
          className="
            absolute
            right-3
            top-1/2
            -translate-y-1/2
            z-30
            w-10 h-10
            rounded-full
            bg-white/[0.06]
            backdrop-blur-sm
            border border-white/10
            shadow-[0_6px_16px_rgba(0,0,0,0.06)]
            hover:bg-white/15
            active:scale-95
            transition
          "
          aria-label="Next background"
        >
          <span className="text-white/30 text-lg leading-none">&gt;</span>
        </button>

        {/* 缩略图条（底部，避开 home indicator） */}
        {thumbsMounted && (
          <div
            className={`absolute left-0 right-0 bottom-0 z-30 ${thumbsAnim === "in" ? "thumbs-in" : "thumbs-out"}`}
            onAnimationEnd={() => thumbsAnim === "out" && setThumbsMounted(false)}
          >
            <div
              className="px-2 pt-3 bg-white/10 backdrop-blur-xl border-t border-white/20 shadow-[0_-10px_30px_rgba(0,0,0,0.25)]"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
            >
              <div 
			  	
				className="flex gap-2 overflow-x-auto items-center"
				onScroll={resetHideTimer}
				onTouchStart={resetHideTimer}
				onTouchMove={resetHideTimer}
				onPointerDown={resetHideTimer}
				onPointerMove={resetHideTimer}
				>
                {/* ✅ + 上传按钮（放在缩略图列表最前） */}
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="
                    shrink-0
                    w-16 h-10
                    rounded-xl
                    border border-white/30
                    bg-white/10
                    backdrop-blur
                    flex items-center justify-center
                    hover:bg-white/15
                    active:scale-[0.98]
                    transition
                  "
                  aria-label="Upload background image"
                  title="Upload"
                >
                  <Plus className="w-4 h-4 text-white/70" />
                </button>

                {/* ✅ 其余缩略图（来自 bgList，含用户上传/DB载入） */}
                {bgList.map((src, i) => (
                  <button
                    key={`${src.slice(0, 24)}-${i}`}
                    ref={el => (thumbRefs.current[i] = el)}
                    onClick={() => goIndex(i)}
                    className={`shrink-0 rounded-xl overflow-hidden border ${i === currentIndex ? "border-white scale-105" : "border-white/40"}`}
                    aria-label={`Select background ${i + 1}`}
                  >
                    <img src={src} className="w-16 h-10 object-cover" draggable={false} />
                  </button>
                ))}
              </div>

              <div className="mt-1 text-[11px] text-white/70 px-1">
                {`Background ${currentIndex + 1} / ${bgList.length}`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
