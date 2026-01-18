export type Handler<T = any> = (payload: T) => void

const listeners = new Map<string, Handler<any>[]>()

export function onGossipEvent<T = any>(event: string, handler: Handler<T>) {
  const arr = listeners.get(event) || []
  arr.push(handler as Handler<any>)
  listeners.set(event, arr)

  return () => {
    const arr = listeners.get(event)
    if (!arr) return
    const idx = arr.indexOf(handler as Handler<any>)
    if (idx >= 0) arr.splice(idx, 1)
  }
}

export function emitGossipEvent<T = any>(event: string, payload: T) {
  const arr = listeners.get(event)
  console.log('Emitting event:', event, payload) // ✅ 添加这行
  if (!arr?.length) return
  ;[...arr].forEach(fn => fn(payload))
}

export const GOSSIP_MESSAGE = "gossip:message"
export const GOSSIP_ERROR = "gossip:error"
