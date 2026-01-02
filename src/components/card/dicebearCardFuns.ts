import { createAvatar } from "@dicebear/core"
import { avataaars, bottts, identicon, lorelei } from '@dicebear/collection'

export type DiceBearCardOptions = {
  width?: number
  height?: number

  title: string
  detail: string

  seed: string
  images: string[] // 本地 assets 导出的 url 列表

  // 右下角黄块显示的“logo文字”（可选）
  logoText?: string

  // 如果不传，用 seed 自动选背景图
  backgroundIndex?: number
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function hashToIndex(seed: string, len: number) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const idx = Math.abs(h) % Math.max(1, len)
  return idx
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function svgToImage(svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadImage(url)
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * 生成竖版卡片 PNG（dataURL）
 * 完全前端：Canvas 合成 背景图 + 文本 + DiceBear 头像
 */
export async function generateDiceBearCardPng(opts: DiceBearCardOptions) {
  const width = opts.width ?? 1024
  const height = opts.height ?? 1536 // 竖版

  const images = opts.images ?? []
  if (!images.length) {
    throw new Error("images[] 不能为空：请传入本地 assets 的图片 url 列表")
  }

  const bgIndex =
    typeof opts.backgroundIndex === "number"
      ? clamp(opts.backgroundIndex, 0, images.length - 1)
      : hashToIndex(opts.seed, images.length)

  // 1) 画布
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D context 不可用")

  // 2) 背景图（cover 填充）
  const bg = await loadImage(images[bgIndex])
  const scale = Math.max(width / bg.width, height / bg.height)
  const dw = bg.width * scale
  const dh = bg.height * scale
  const dx = (width - dw) / 2
  const dy = (height - dh) / 2
  ctx.drawImage(bg, dx, dy, dw, dh)

  // 3) 轻微暗角/雾层（让文字更稳）
  ctx.save()
  ctx.globalAlpha = 0.22
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, width, height)
  ctx.restore()

  // 4) 标题 & 详情（左上）
  const pad = Math.round(width * 0.06)
  const titleMaxWidth = Math.round(width * 0.84)

  // 标题：黄字 + 黑色阴影（类似你图）
  ctx.save()
  ctx.font = `800 ${Math.round(width * 0.07)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`
  ctx.fillStyle = "#ffd400"
  ctx.shadowColor = "rgba(0,0,0,0.55)"
  ctx.shadowBlur = Math.round(width * 0.008)
  ctx.shadowOffsetX = Math.round(width * 0.003)
  ctx.shadowOffsetY = Math.round(width * 0.004)

  const titleLines = wrapText(ctx, opts.title, titleMaxWidth, 2)
  let y = pad + Math.round(width * 0.07)
  for (const line of titleLines) {
    ctx.fillText(line, pad, y)
    y += Math.round(width * 0.085)
  }
  ctx.restore()

  // 详情：白字（略小，限制行数）
  ctx.save()
  ctx.font = `600 ${Math.round(width * 0.035)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`
  ctx.fillStyle = "rgba(255,255,255,0.92)"
  ctx.shadowColor = "rgba(0,0,0,0.45)"
  ctx.shadowBlur = Math.round(width * 0.006)
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = Math.round(width * 0.003)

  const detailTop = y + Math.round(width * 0.02)
  const detailLines = wrapText(ctx, opts.detail, Math.round(width * 0.78), 5)
  y = detailTop
  for (const line of detailLines) {
    ctx.fillText(line, pad, y)
    y += Math.round(width * 0.05)
  }
  ctx.restore()

  // 5) 右下角 “logo” 黄块
  const blockW = Math.round(width * 0.52)
  const blockH = Math.round(height * 0.16)
  const blockX = width - pad - blockW
  const blockY = height - pad - blockH
  const radius = Math.round(width * 0.03)

  // 阴影底条（更接近你图的压边）
  ctx.save()
  ctx.fillStyle = "rgba(0,0,0,0.4)"
  roundRect(ctx, blockX + Math.round(width * 0.01), blockY + Math.round(width * 0.012), blockW, blockH, radius)
  ctx.fill()
  ctx.restore()

  // 主黄块
  ctx.save()
  ctx.fillStyle = "#ffd400"
  roundRect(ctx, blockX, blockY, blockW, blockH, radius)
  ctx.fill()
  ctx.restore()

  // 6) DiceBear 头像（放在黄块左侧）
  const avatarSvg = createAvatar(avataaars, {
    seed: opts.seed,
    // 你想要更统一的卡片风格可以固定一些参数
    // accessoriesChance: 25,
    // mouth: ["smile", "default"],
  }).toString()

  const avatarImg = await svgToImage(avatarSvg)

  const avatarSize = Math.round(blockH * 0.78)
  const avatarX = blockX + Math.round(blockH * 0.12)
  const avatarY = blockY + Math.round((blockH - avatarSize) / 2)

  // 头像白底圆形
  ctx.save()
  ctx.fillStyle = "rgba(255,255,255,0.95)"
  ctx.beginPath()
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2,
    0,
    Math.PI * 2
  )
  ctx.fill()
  ctx.clip()
  ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize)
  ctx.restore()

  // 7) 黄块右侧 logoText
  const logoText = (opts.logoText ?? "Your logo").trim()
  if (logoText) {
    const textX = avatarX + avatarSize + Math.round(blockH * 0.18)
    const textY = blockY + Math.round(blockH * 0.62)

    ctx.save()
    ctx.fillStyle = "#111"
    ctx.font = `900 ${Math.round(blockH * 0.38)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`
    ctx.textBaseline = "alphabetic"
    ctx.fillText(truncateText(ctx, logoText, blockX + blockW - pad - textX), textX, textY)
    ctx.restore()
  }

  return canvas.toDataURL("image/png")
}

// --------- helpers ---------

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim()
  if (!t) return []

  const words = t.split(" ")
  const lines: string[] = []
  let line = ""

  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width <= maxWidth) {
      line = test
    } else {
      if (line) lines.push(line)
      line = w
      if (lines.length >= maxLines - 1) break
    }
  }

  if (line && lines.length < maxLines) lines.push(line)

  // 如果超行，最后一行加省略号
  if (lines.length === maxLines) {
    lines[maxLines - 1] = truncateText(ctx, lines[maxLines - 1], maxWidth)
  }

  return lines
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const t = String(text ?? "")
  if (ctx.measureText(t).width <= maxWidth) return t

  let lo = 0
  let hi = t.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const s = t.slice(0, mid) + "…"
    if (ctx.measureText(s).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return t.slice(0, lo) + "…"
}