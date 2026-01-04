import { useEffect, useState } from "react"


const sniffImageMime = async (blob: Blob) => {
  // 只读很小一段即可
  const buf = await blob.slice(0, 16).arrayBuffer()
  const b = new Uint8Array(buf)

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) return "image/png"

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg"

  // GIF: 47 49 46 38
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif"

  // WEBP: "RIFF"...."WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) return "image/webp"

  // SVG: 以 "<svg" 或 "<?xml" 开头（可能有空白/BOM）
  const headText = new TextDecoder().decode(b).trimStart()
  if (headText.startsWith("<svg") || headText.startsWith("<?xml")) return "image/svg+xml"

  return ""
}

const guessMimeFromUrl = (url: string) => {
  const u = url.toLowerCase()
  if (u.includes(".png")) return "image/png"
  if (u.includes(".jpg") || u.includes(".jpeg")) return "image/jpeg"
  if (u.includes(".webp")) return "image/webp"
  if (u.includes(".gif")) return "image/gif"
  if (u.includes(".svg")) return "image/svg+xml"
  return ""
}

const parseDataUrl = (dataUrl: string) => {
  const s = String(dataUrl || "").trim()
	
  const m = /^data:([^;]+);base64,(.+)$/i.exec(s)
  if (!m) return null

  return {
    mime: m[1],
    base64: m[2]
  }
}


const base64ToBlob = (base64: string, mime: string) => {
  const bin = atob(base64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}


export const urlToObjectUrl = async (url: string) => {
	if (!/ipfs\.conet\.network/i.test(url)){
		return url
	}
	const res = await fetch(url, { cache: "force-cache" })
	if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`)

	// 先看响应头（很多网关会给 text/plain）
	

    const txt = (await res.text()).trim()
    if (txt.startsWith("data:image/")) {
      const parsed = parseDataUrl(txt)
      if (parsed) {
        const blob = base64ToBlob(parsed.base64, parsed.mime || "image/webp")
        return URL.createObjectURL(blob)
      }
    }

    // 有些服务端不带 data: 前缀，只回裸 base64（兜底）
    if (/^[A-Za-z0-9+/]+=*$/.test(txt) && txt.length > 128) {
      const blob = base64ToBlob(txt, "image/webp")
      return URL.createObjectURL(blob)
    }

    throw new Error("Response is text but not a valid image data URL")
  
}

export const useObjectImgSrc = (src?: string) => {
  const [imgSrc, setImgSrc] = useState("")

  useEffect(() => {
    const s = String(src || "").trim()
    if (!s) {
      setImgSrc("")
      return
    }

    // data URL / blob URL / 普通 http 若你想也可以直接返回
    if (s.startsWith("data:image/") || s.startsWith("blob:")) {
      setImgSrc(s)
      return
    }

    let alive = true
    let objUrl = ""

    ;(async () => {
      try {
        objUrl = await urlToObjectUrl(s)
        if (alive) setImgSrc(objUrl)
      } catch (e) {
        if (alive) setImgSrc("") // 你也可以在这里 set error
      }
    })()

    return () => {
      alive = false
      if (objUrl) URL.revokeObjectURL(objUrl)
    }
  }, [src])

  return imgSrc
}