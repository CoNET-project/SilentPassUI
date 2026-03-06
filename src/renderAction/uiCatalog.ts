/**
 * Beamio UI Catalog: Component directory for AI-generated UI
 * AI outputs JSON matching these types; DynamicUIRenderer maps to React components
 */

/** Schema version for forward compatibility */
export const UI_CATALOG_SCHEMA = "beamio-ui-v1"

/** Allowed component types in the catalog */
export type UICatalogComponentType =
  | "Card"
  | "Text"
  | "Button"
  | "Row"
  | "Column"
  | "Spacer"
  | "Divider"
  | "BalanceDisplay"
  | "AddUsdcHint"
  | "ActionButton"

/** Single UI node: type + optional props + optional children */
export type UINode = {
  type: UICatalogComponentType
  props?: Record<string, unknown>
  children?: UINode[]
}

/** Root of AI-generated UI tree */
export type BeamioUI = {
  schema: string
  root: UINode
}

/** Component catalog: type -> description for AI prompt */
export const UI_CATALOG: Record<
  UICatalogComponentType,
  { description: string; props?: Record<string, string> }
> = {
  Card: {
    description: "Container with rounded corners and border",
    props: { title: "optional string", subtitle: "optional string" },
  },
  Text: {
    description: "Plain text content",
    props: { content: "string", size: "xs|sm|base|lg (optional)" },
  },
  Button: {
    description: "Clickable button",
    props: {
      label: "string",
      action: "pay|fuel|balance|add-usdc|contact|history|cashcode|request|card-topup (optional, triggers Beamio action)",
      actionParams: "optional object for action params (e.g. { to, amount } for pay)",
      href: "optional string for external link",
    },
  },
  Row: {
    description: "Horizontal layout, children side by side",
    props: { gap: "number in px (optional)" },
  },
  Column: {
    description: "Vertical layout, children stacked",
    props: { gap: "number in px (optional)" },
  },
  Spacer: {
    description: "Vertical spacing",
    props: { height: "number in px (optional, default 8)" },
  },
  Divider: {
    description: "Horizontal divider line",
  },
  BalanceDisplay: {
    description: "Shows USDC and B-Units (uses user context)",
  },
  AddUsdcHint: {
    description: "Hint card for adding USDC via Coinbase",
  },
  ActionButton: {
    description: "Button that opens a Beamio action (pay, fuel, etc.)",
    props: {
      label: "string",
      actionType: "pay|fuel|balance|add-usdc|contact|history|cashcode|request|card-topup|send-chat",
      actionParams: "optional object for action params",
    },
  },
}

/** Validate and sanitize UINode (only allow catalog types) */
export function isValidUINode(node: unknown): node is UINode {
  if (!node || typeof node !== "object") return false
  const n = node as Record<string, unknown>
  const type = n.type
  if (typeof type !== "string" || !(type in UI_CATALOG)) return false
  if (n.children !== undefined) {
    if (!Array.isArray(n.children)) return false
    if (!n.children.every(isValidUINode)) return false
  }
  return true
}

/** Validate BeamioUI root */
export function isValidBeamioUI(ui: unknown): ui is BeamioUI {
  if (!ui || typeof ui !== "object") return false
  const u = ui as Record<string, unknown>
  return (
    typeof u.schema === "string" &&
    u.root !== undefined &&
    isValidUINode(u.root)
  )
}

/** Get catalog as JSON for AI system prompt */
export function getCatalogForPrompt(): string {
  return JSON.stringify(
    {
      schema: UI_CATALOG_SCHEMA,
      components: UI_CATALOG,
      example: {
        type: "custom-ui",
        params: {
          ui: {
            schema: UI_CATALOG_SCHEMA,
            root: {
              type: "Card",
              props: { title: "Your Balance" },
              children: [
                { type: "BalanceDisplay" },
                { type: "Spacer", props: { height: 12 } },
                { type: "ActionButton", props: { label: "Add USDC", actionType: "add-usdc" } },
              ],
            },
          },
        },
      },
    },
    null,
    2
  )
}
