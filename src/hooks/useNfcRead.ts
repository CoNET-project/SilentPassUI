/**
 * Web NFC API：读取 NTAG 424 DNA 卡的 UID
 * 仅支持 Chrome Android（需 HTTPS + 用户手势）
 */
import { useState, useCallback } from 'react'

declare global {
	interface NDEFReadingEvent extends Event {
		serialNumber: string
		message?: unknown
	}

	interface NDEFReader extends EventTarget {
		read(): Promise<void>
		onreading: ((event: NDEFReadingEvent) => void) | null
	}

	interface Window {
		NDEFReader?: new () => NDEFReader
	}
}

export function useNfcRead() {
	const [status, setStatus] = useState<'idle' | 'reading' | 'success' | 'error'>('idle')
	const [uid, setUid] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)

	const readUid = useCallback(async (): Promise<string | null> => {
		setStatus('reading')
		setError(null)
		setUid(null)

		if (!('NDEFReader' in window)) {
			setError('NFC 不可用，请使用 Chrome Android 并确保 HTTPS')
			setStatus('error')
			return null
		}

		try {
			const reader = new (window as any).NDEFReader()
			return new Promise((resolve) => {
				reader.onreading = (event: NDEFReadingEvent) => {
					const serial = event.serialNumber || ''
					// serialNumber 格式：hex 字符串，如 "04A1B2C3D4E5F6"
					const uidHex = serial.length > 0 ? serial : ''
					setUid(uidHex)
					setStatus('success')
					resolve(uidHex)
				}
				reader.onerror = () => {
					setError('读取失败，请重试')
					setStatus('error')
					resolve(null)
				}
				reader.read().catch((err: Error) => {
					setError(err?.message ?? 'NFC 读取失败')
					setStatus('error')
					resolve(null)
				})
			})
		} catch (err) {
			const msg = (err as Error)?.message ?? 'NFC 不可用'
			setError(msg)
			setStatus('error')
			return null
		}
	}, [])

	const reset = useCallback(() => {
		setStatus('idle')
		setUid(null)
		setError(null)
	}, [])

	return { readUid, uid, status, error, reset }
}
