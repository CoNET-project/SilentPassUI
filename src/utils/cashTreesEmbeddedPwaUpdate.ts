/**
 * iOS embedded PWA OTA — feature-detect only. Android WebView has no equivalent bridge;
 * do not call these helpers unless `isIosEmbeddedPwaOtaSupported()` is true.
 */

export type EmbeddedPwaUpdateDetail = {
  currentVer: string
  pendingVer: string
}

export type ApplyEmbeddedPwaUpdateDetail = {
  ok: boolean
  ver?: string
  error?: string
}

const IOS_BRIDGE_EVENT = 'cashtreesios'

/** True only when the iOS shell injected OTA bridge methods (not Android). */
export function isIosEmbeddedPwaOtaSupported(): boolean {
  if (typeof window === 'undefined') return false
  return typeof window.CashTreesIOS?.applyEmbeddedPwaUpdate === 'function'
}

export function readEmbeddedPwaVersion(): string {
  if (!isIosEmbeddedPwaOtaSupported()) return ''
  return window.CashTreesIOS?.getEmbeddedPwaVersion?.() ?? ''
}

export function readEmbeddedPwaPendingVersion(): string {
  if (!isIosEmbeddedPwaOtaSupported()) return ''
  return window.CashTreesIOS?.getEmbeddedPwaPendingVersion?.() ?? ''
}

export function requestEmbeddedPwaUpdateApply(): void {
  if (!isIosEmbeddedPwaOtaSupported()) return
  window.CashTreesIOS?.applyEmbeddedPwaUpdate?.()
}

export function subscribeEmbeddedPwaUpdateAvailable(
  listener: (detail: EmbeddedPwaUpdateDetail) => void,
): () => void {
  if (!isIosEmbeddedPwaOtaSupported()) return () => {}

  const onEvent = (event: Event) => {
    const detail = (event as CustomEvent).detail as {
      action?: string
      currentVer?: string
      pendingVer?: string
    }
    if (!detail || detail.action !== 'embeddedPwaUpdateAvailable') return
    if (!detail.pendingVer) return
    listener({
      currentVer: detail.currentVer ?? '',
      pendingVer: detail.pendingVer,
    })
  }

  window.addEventListener(IOS_BRIDGE_EVENT, onEvent)
  return () => window.removeEventListener(IOS_BRIDGE_EVENT, onEvent)
}

export function subscribeApplyEmbeddedPwaUpdateResult(
  listener: (detail: ApplyEmbeddedPwaUpdateDetail) => void,
): () => void {
  if (!isIosEmbeddedPwaOtaSupported()) return () => {}

  const onEvent = (event: Event) => {
    const detail = (event as CustomEvent).detail as {
      action?: string
      ok?: boolean
      ver?: string
      error?: string
    }
    if (!detail || detail.action !== 'applyEmbeddedPwaUpdate') return
    listener({
      ok: detail.ok === true,
      ver: detail.ver,
      error: detail.error,
    })
  }

  window.addEventListener(IOS_BRIDGE_EVENT, onEvent)
  return () => window.removeEventListener(IOS_BRIDGE_EVENT, onEvent)
}
