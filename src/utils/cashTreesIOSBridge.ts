declare global {
  interface Window {
    CashTreesIOS?: {
      scanQr?: (payload: { requestId: string }) => void
      scanRecoveryQr?: (payload: { requestId: string }) => void
      getEmbeddedPwaVersion?: () => string
      getEmbeddedPwaPendingVersion?: () => string
      applyEmbeddedPwaUpdate?: () => void
      publishAppState?: (state: Record<string, unknown>) => void
      bindPushIdentity?: (payload: { eoa: string; pgpKeyId?: string }) => void
      debugLog?: (level: string, message: string) => void
    }
    CashTreesAndroid?: {
      getNfcStatus?: () => string
      startPhysicalCardBind?: () => void
      cancelPhysicalCardBind?: () => void
      scanQr?: (requestId: string) => void
      scanRecoveryQr?: (requestId: string) => void
      openURL?: (url: string) => void
      getEmbeddedPwaVersion?: () => string
      getEmbeddedPwaPendingVersion?: () => string
      applyEmbeddedPwaUpdate?: () => void
      publishAppState?: (json: string) => void
      /** JSON string `{ eoa, pgpKeyId? }` — FCM bind */
      bindPushIdentity?: (json: string) => void
      debugLog?: (level: string, message: string) => void
    }
  }
}

export type CashTreesScanQrResult =
  | { ok: true; text: string }
  | { ok: false; error?: string; cancelled?: boolean }

type NativeScanPlatform = 'ios' | 'android'

function detectNativeScanPlatform(): NativeScanPlatform | null {
  if (typeof window === 'undefined') return null
  if (typeof window.CashTreesIOS?.scanQr === 'function') return 'ios'
  if (typeof window.CashTreesAndroid?.scanQr === 'function') return 'android'
  return null
}

export function isEmbeddedCashTreesWebView(): boolean {
  if (typeof window === 'undefined') return false
  if (window.CashTreesIOS) return true
  if (window.CashTreesAndroid) return true
  const webkitBridge = (window as Window & {
    webkit?: {
      messageHandlers?: Record<string, unknown>
    }
  }).webkit
  return !!webkitBridge?.messageHandlers?.CashTreesIOS
}

export function isCashTreesNativeWebView(): boolean {
  return detectNativeScanPlatform() !== null
}

export function scanQrViaCashTreesNative(timeoutMs = 120_000): Promise<CashTreesScanQrResult> {
  return new Promise((resolve) => {
    const platform = detectNativeScanPlatform()
    if (!platform) {
      resolve({ ok: false, error: 'native_unavailable' })
      return
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const eventName = platform === 'ios' ? 'cashtreesios' : 'cashtreesandroid'

    const finish = (result: CashTreesScanQrResult) => {
      window.removeEventListener(eventName, onEvent)
      clearTimeout(timer)
      resolve(result)
    }

    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        action?: string
        ok?: boolean
        requestId?: string
        text?: string
        error?: string
      }
      if (!detail || detail.action !== 'scanQr' || detail.requestId !== requestId) return

      if (detail.ok && typeof detail.text === 'string') {
        finish({ ok: true, text: detail.text })
        return
      }

      finish({
        ok: false,
        error: detail.error || 'scan_failed',
        cancelled: detail.error === 'cancelled',
      })
    }

    const timer = setTimeout(() => {
      finish({ ok: false, error: 'timeout' })
    }, timeoutMs)

    window.addEventListener(eventName, onEvent)

    try {
      if (platform === 'ios') {
        window.CashTreesIOS!.scanQr!({ requestId })
      } else {
        window.CashTreesAndroid!.scanQr!(requestId)
      }
    } catch (err) {
      finish({
        ok: false,
        error: err instanceof Error ? err.message : 'scan_failed',
      })
    }
  })
}

export {}
