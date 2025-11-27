import { useState } from "react"

type JsonViewerProps = {
  data: any
  level?: number
}

export function JsonViewer({ data, level = 0 }: JsonViewerProps) {
  const [collapsed, setCollapsed] = useState(true)

  if (typeof data !== "object" || data === null) {
    return (
      <span className="text-blue-700 break-all">
        {JSON.stringify(data)}
      </span>
    )
  }

  const entries = Object.entries(data)
  const paddingLeft = `${level * 1.25}rem`

  return (
    <div style={{ paddingLeft }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="text-gray-600 hover:text-black transition text-xs"
      >
        {collapsed ? "▶" : "▼"} {Array.isArray(data) ? `[Array ${data.length}]` : "{Object}"}
      </button>

      {!collapsed && (
        <div className="ml-3 border-l border-gray-300 pl-3 text-sm font-mono text-gray-800 space-y-1">
          {entries.map(([key, val]) => (
            <div key={key}>
              <span className="text-gray-500">"{key}"</span>
              <span className="text-gray-400">: </span>
              <JsonViewer data={val} level={level + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
