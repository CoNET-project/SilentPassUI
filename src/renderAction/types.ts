/**
 * Beamio AI-Native App：AI 根据用户意图即时生成的 Action 类型
 * AI 输出 JSON，renderAction 据此渲染对应 UI
 */

export type ActionType =
  | "pay"
  | "request"
  | "cashcode"
  | "fuel"
  | "balance"
  | "history"
  | "contact"
  | "add-usdc"
  | "card-topup"
  | "text"
  | "custom-ui"
  | "edit-profile"
  | "send-chat"
  | "generate-avatar-image"

/** Generate avatar image: 從外部 API 取得圖片（如貓咪），可下載或設為頭像 */
export type GenerateAvatarImageAction = {
  type: "generate-avatar-image"
  params?: {
    prompt?: string // e.g. "cat", "kitten"
  }
}

/** Send chat: 直接发送 CoNET P2P 消息 */
export type SendChatAction = {
  type: "send-chat"
  params: {
    to: string // BeamioTag
    text: string
  }
}

/** Pay 动作：发送 USDC */
export type PayAction = {
  type: "pay"
  params: {
    to?: string // @BeamioTag 或地址
    amount?: number
    currency?: "USD" | "USDC" | "CAD"
    note?: string
  }
}

/** Request 动作：请求收款 */
export type RequestAction = {
  type: "request"
  params: {
    amount?: number
    currency?: "USD" | "USDC" | "CAD"
    note?: string
  }
}

/** Cashcode 动作：创建/使用 Cashcode */
export type CashcodeAction = {
  type: "cashcode"
  params: {
    mode?: "create" | "redeem"
    amount?: number
    note?: string
  }
}

/** Fuel 动作：B-Units 充值/查看 */
export type FuelAction = {
  type: "fuel"
  params?: Record<string, unknown>
}

/** Balance 动作：查看余额 */
export type BalanceAction = {
  type: "balance"
  params?: Record<string, unknown>
}

/** History 动作：交易历史。limit 存在时在气泡内联显示前 N 条，否则打开 History 页 */
export type HistoryAction = {
  type: "history"
  params?: {
    limit?: number
  }
}

/** Contact 动作：查看/选择联系人 */
export type ContactAction = {
  type: "contact"
  params?: {
    query?: string
    action?: "view" | "pay" | "chat"
  }
}

/** Add USDC 动作：入金 */
export type AddUsdcAction = {
  type: "add-usdc"
  params?: Record<string, unknown>
}

/** Card Topup 动作：卡充值 */
export type CardTopupAction = {
  type: "card-topup"
  params?: {
    cardId?: string
    amount?: number
  }
}

/** 纯文本回复（无 UI 组件） */
export type TextAction = {
  type: "text"
  params: {
    content: string
  }
}

/** Edit profile：更新 firstName、lastName、avatarSeed、currency */
export type EditProfileAction = {
  type: "edit-profile"
  params?: {
    firstName?: string
    lastName?: string
    /** DiceBear seed for AI-generated avatar: https://api.dicebear.com/8.x/fun-emoji/svg?seed=... */
    avatarSeed?: string
    /** USD | USDC | CAD | JPY | CNY | HKD | EUR | SGD | TWD */
    currency?: string
  }
}

/** AI 生成的复合 UI（组件目录 + JSON） */
export type CustomUIAction = {
  type: "custom-ui"
  params: {
    /** BeamioUI schema + root tree */
    ui: {
      schema: string
      root: {
        type: string
        props?: Record<string, unknown>
        children?: unknown[]
      }
    }
  }
}

export type BeamioAction =
  | PayAction
  | RequestAction
  | CashcodeAction
  | FuelAction
  | BalanceAction
  | HistoryAction
  | ContactAction
  | AddUsdcAction
  | CardTopupAction
  | TextAction
  | EditProfileAction
  | SendChatAction
  | GenerateAvatarImageAction
  | CustomUIAction

/** 对话消息：用户输入或 AI 回复（含 action） */
export type RenderActionMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  /** AI 回复时：结构化 action，用于渲染 UI */
  action?: BeamioAction
  /** AI 回复时：触发该回复的用户输入（用于学习反馈） */
  triggeredByUserInput?: string
  timestamp: number
}
