import { useMemo, useState } from 'react'

type VscodeJsonBlockProps = {
	data: unknown
	className?: string
	maxHeightClassName?: string
	defaultExpandedDepth?: number
}

type JsonRecord = Record<string, unknown>

const normalizeJsonValue = (value: unknown): unknown => {
	if (typeof value === 'bigint') return value.toString()
	if (value instanceof Date) return value.toISOString()
	if (Array.isArray(value)) return value.map(normalizeJsonValue)
	if (value && typeof value === 'object') {
		const out: JsonRecord = {}
		for (const [k, v] of Object.entries(value as JsonRecord)) {
			out[k] = normalizeJsonValue(v)
		}
		return out
	}
	return value
}

const normalizeForDisplay = (data: unknown): unknown => {
	if (typeof data === 'string') {
		try {
			return normalizeJsonValue(JSON.parse(data))
		} catch {
			return data
		}
	}
	return normalizeJsonValue(data)
}

const isRecord = (value: unknown): value is JsonRecord =>
	!!value && typeof value === 'object' && !Array.isArray(value)

function PrimitiveValue({ value }: { value: unknown }) {
	if (typeof value === 'string') {
		return <span className="text-[#a31515] dark:text-[#ce9178]">{JSON.stringify(value)}</span>
	}
	if (typeof value === 'number') {
		return <span className="text-[#098658] dark:text-[#b5cea8]">{String(value)}</span>
	}
	if (typeof value === 'boolean') {
		return <span className="text-[#0000ff] dark:text-[#569cd6]">{String(value)}</span>
	}
	if (value === null) {
		return <span className="text-[#0000ff] dark:text-[#569cd6]">null</span>
	}
	if (value === undefined) {
		return <span className="text-[#0000ff] dark:text-[#569cd6]">undefined</span>
	}
	return <span className="text-[#1f1f1f] dark:text-[#d4d4d4]">{String(value)}</span>
}

function JsonNode({
	name,
	value,
	level,
	isLast,
	defaultExpandedDepth,
}: {
	name?: string
	value: unknown
	level: number
	isLast: boolean
	defaultExpandedDepth: number
}) {
	const expandable = Array.isArray(value) || isRecord(value)
	const [expanded, setExpanded] = useState(level < defaultExpandedDepth)
	const indent = `${level}rem`
	const comma = isLast ? '' : ','

	if (!expandable) {
		return (
			<div className="whitespace-nowrap" style={{ paddingLeft: indent }}>
				<span className="inline-block w-4" />
				{name !== undefined && (
					<>
						<span className="text-[#0451a5] dark:text-[#9cdcfe]">{JSON.stringify(name)}</span>
						<span className="text-[#666] dark:text-[#d4d4d4]">: </span>
					</>
				)}
				<PrimitiveValue value={value} />
				<span className="text-[#666] dark:text-[#d4d4d4]">{comma}</span>
			</div>
		)
	}

	const entries = Array.isArray(value)
		? value.map((v, idx) => [String(idx), v] as const)
		: Object.entries(value)
	const open = Array.isArray(value) ? '[' : '{'
	const close = Array.isArray(value) ? ']' : '}'
	const summary = Array.isArray(value) ? `[${entries.length}]` : '{…}'

	return (
		<div>
			<div className="whitespace-nowrap" style={{ paddingLeft: indent }}>
				<button
					type="button"
					onClick={() => setExpanded((v) => !v)}
					className="inline-flex w-4 items-center justify-center text-[#6a6a6a] hover:text-[#1f1f1f] dark:text-[#858585] dark:hover:text-[#d4d4d4]"
					aria-label={expanded ? 'Collapse JSON node' : 'Expand JSON node'}
				>
					{expanded ? '▾' : '▸'}
				</button>
				{name !== undefined && (
					<>
						<span className="text-[#0451a5] dark:text-[#9cdcfe]">{JSON.stringify(name)}</span>
						<span className="text-[#666] dark:text-[#d4d4d4]">: </span>
					</>
				)}
				<span className="text-[#1f1f1f] dark:text-[#d4d4d4]">{expanded ? open : summary}</span>
				{!expanded && <span className="text-[#666] dark:text-[#d4d4d4]">{comma}</span>}
			</div>
			{expanded && (
				<>
					{entries.map(([key, child], idx) => (
						<JsonNode
							key={`${level}:${key}`}
							name={Array.isArray(value) ? undefined : key}
							value={child}
							level={level + 1}
							isLast={idx === entries.length - 1}
							defaultExpandedDepth={defaultExpandedDepth}
						/>
					))}
					<div className="whitespace-nowrap" style={{ paddingLeft: indent }}>
						<span className="inline-block w-4" />
						<span className="text-[#1f1f1f] dark:text-[#d4d4d4]">{close}</span>
						<span className="text-[#666] dark:text-[#d4d4d4]">{comma}</span>
					</div>
				</>
			)}
		</div>
	)
}

export default function VscodeJsonBlock({
	data,
	className = '',
	maxHeightClassName = 'max-h-[32vh]',
	defaultExpandedDepth = 1,
}: VscodeJsonBlockProps) {
	const normalized = useMemo(() => normalizeForDisplay(data), [data])

	return (
		<div
			className={[
				'rounded-[16px] border border-[#d4d4d4] bg-white p-4 shadow-inner',
				'dark:border-[#3c3c3c] dark:bg-[#1e1e1e]',
				'overflow-auto',
				maxHeightClassName,
				className,
			].join(' ')}
		>
			<div className="font-mono text-[11px] leading-relaxed text-[#1f1f1f] dark:text-[#d4d4d4]">
				<JsonNode value={normalized} level={0} isLast defaultExpandedDepth={defaultExpandedDepth} />
			</div>
		</div>
	)
}
