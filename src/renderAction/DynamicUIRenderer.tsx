/**
 * Renders AI-generated UI from JSON (BeamioUI)
 * Maps UINode types from uiCatalog to React components
 */

import React, { useState, useEffect } from "react"
import { Wallet } from "lucide-react"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { getBUnitBalanceOnConet } from "@/services/BeamioCard"
import type { UINode, BeamioUI } from "./uiCatalog"
import { isValidBeamioUI, isValidUINode, UI_CATALOG_SCHEMA } from "./uiCatalog"
import type { BeamioAction } from "./types"
import { openExternalUrl } from "@/utils/cashTreesNativeNfc"

/** True when ui has schema+root but root is empty/invalid (e.g. root: {}) */
function hasSchemaButInvalidRoot(ui: unknown): boolean {
  if (!ui || typeof ui !== "object") return false
  const u = ui as Record<string, unknown>
  return typeof u.schema === "string" && u.root !== undefined && !isValidUINode(u.root)
}

/** Fallback when AI returns custom-ui with empty/invalid root (e.g. root: {}) */
const FALLBACK_BALANCE_UI: BeamioUI = {
  schema: UI_CATALOG_SCHEMA,
  root: {
    type: "Card",
    props: { title: "Balance" },
    children: [
      { type: "BalanceDisplay" },
      { type: "ActionButton", props: { label: "Add USDC", actionType: "add-usdc" } },
    ],
  },
}

type DynamicUIRendererProps = {
  ui: BeamioUI | unknown
  /** When user clicks ActionButton, pass the BeamioAction to open */
  onActionClick?: (action: BeamioAction) => void
  /** Optional: compact mode for inline bubble (smaller spacing) */
  compact?: boolean
}

function renderUINode(
  node: UINode,
  ctx: {
    usdcbalance: number | string | undefined
    myAddress: string
    bUnitBalance: { total: number } | null
    onActionClick?: (action: BeamioAction) => void
    compact?: boolean
  }
): React.ReactNode {
  const { usdcbalance, myAddress, bUnitBalance, onActionClick, compact } = ctx
  const gap = compact ? 2 : 4
  const p = node.props ?? {}

  switch (node.type) {
    case "Card":
      return (
        <div
          key={node.type}
          className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3 border border-slate-100 dark:border-slate-600"
        >
          {(p.title as string) && (
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
              {String(p.title)}
            </div>
          )}
          {(p.subtitle as string) && (
            <div className="text-xs text-slate-500 mb-2">{String(p.subtitle)}</div>
          )}
          <div className="space-y-2">
            {node.children?.map((c, i) => (
              <React.Fragment key={i}>
                {renderUINode(c, ctx)}
              </React.Fragment>
            ))}
          </div>
        </div>
      )

    case "Text":
      const size = (p.size as string) || "sm"
      const sizeClass =
        size === "xs"
          ? "text-xs"
          : size === "sm"
            ? "text-sm"
            : size === "lg"
              ? "text-base"
              : "text-sm"
      return (
        <p key={node.type} className={`${sizeClass} text-slate-600 dark:text-slate-300`}>
          {String(p.content ?? "")}
        </p>
      )

    case "Button":
      const label = String(p.label ?? "Button")
      const action = p.action as string | undefined
      const href = p.href as string | undefined
      const btnActionParams = (p.actionParams as Record<string, unknown>) ?? {}
      const handleClick = () => {
        if (action && onActionClick) {
          onActionClick({ type: action, params: btnActionParams } as BeamioAction)
        } else if (href) {
          openExternalUrl(href)
        }
      }
      return (
        <button
          key={node.type}
          onClick={handleClick}
          className="w-full text-left px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          {label}
        </button>
      )

    case "ActionButton":
      const actionLabel = String(p.label ?? "Open")
      const actionType = (p.actionType as string) ?? "text"
      const actionParams = (p.actionParams as Record<string, unknown>) ?? {}
      return (
        <button
          key={node.type}
          onClick={() =>
            onActionClick?.({ type: actionType, params: actionParams } as BeamioAction)
          }
          className="w-full text-left px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          {actionLabel}
        </button>
      )

    case "Row":
      const rowGap = (p.gap as number) ?? gap * 4
      return (
        <div
          key={node.type}
          className="flex flex-wrap items-center gap-2"
          style={{ gap: rowGap }}
        >
          {node.children?.map((c, i) => (
            <React.Fragment key={i}>{renderUINode(c, ctx)}</React.Fragment>
          ))}
        </div>
      )

    case "Column":
      const colGap = (p.gap as number) ?? gap * 4
      return (
        <div
          key={node.type}
          className="flex flex-col"
          style={{ gap: colGap }}
        >
          {node.children?.map((c, i) => (
            <React.Fragment key={i}>{renderUINode(c, ctx)}</React.Fragment>
          ))}
        </div>
      )

    case "Spacer":
      const height = (p.height as number) ?? 8
      return <div key={node.type} style={{ height }} aria-hidden />

    case "Divider":
      return (
        <hr
          key={node.type}
          className="border-slate-200 dark:border-slate-600 my-2"
          aria-hidden
        />
      )

    case "BalanceDisplay":
      const usdc = typeof usdcbalance === "number" ? usdcbalance.toFixed(2) : "0.00"
      const bUnits = bUnitBalance != null ? Math.floor(bUnitBalance.total) : "—"
      return (
        <div
          key={node.type}
          className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3 border border-slate-100 dark:border-slate-600"
        >
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={18} className="text-emerald-600" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Balance</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">USDC</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">${usdc}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">B-Units</span>
              <span className="font-bold text-orange-500">{bUnits}</span>
            </div>
          </div>
        </div>
      )

    case "AddUsdcHint":
      return (
        <div
          key={node.type}
          className="rounded-xl bg-slate-50 dark:bg-slate-700/50 p-3 border border-slate-100 dark:border-slate-600"
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Add USDC via Coinbase or bank transfer.
          </p>
        </div>
      )

    default:
      return null
  }
}

export function DynamicUIRenderer({
  ui,
  onActionClick,
  compact = false,
}: DynamicUIRendererProps) {
  const { usdcbalance, myAddress } = useDaemonContext()
  const [bUnitBalance, setBUnitBalance] = useState<{ total: number } | null>(null)

  useEffect(() => {
    if (!myAddress) return
    getBUnitBalanceOnConet(myAddress).then(setBUnitBalance).catch(() => setBUnitBalance(null))
  }, [myAddress])

  const effectiveUI: BeamioUI =
    isValidBeamioUI(ui) ? ui : hasSchemaButInvalidRoot(ui) ? FALLBACK_BALANCE_UI : (null as unknown as BeamioUI)
  if (!effectiveUI) {
    return (
      <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 border border-amber-200 dark:border-amber-800">
        <p className="text-sm text-amber-800 dark:text-amber-200">Invalid UI schema</p>
      </div>
    )
  }

  const ctx = {
    usdcbalance,
    myAddress: myAddress ?? "",
    bUnitBalance,
    onActionClick,
    compact,
  }

  return (
    <div className="space-y-2">
      {renderUINode(effectiveUI.root, ctx)}
    </div>
  )
}
