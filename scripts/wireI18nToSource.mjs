#!/usr/bin/env node
/**
 * Full i18n wire: catalog English strings → tu('key').
 * Skips imports, classNames, enum/state comparisons, lucide symbols.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(__dirname, '../src')
const en = JSON.parse(fs.readFileSync(path.join(SRC, 'locale/en.json'), 'utf8'))

const EN_TO_KEY = {}
for (const [key, value] of Object.entries(en.ui)) {
	if (typeof value === 'string' && value.trim()) EN_TO_KEY[value.trim()] = key
}

const SKIP_DIRS = new Set(['locale', 'locales'])
const SKIP_FILE_RE = /(\.d\.ts$|sample\.tsx$|_副本|index copy)/
/** Internal route / state tokens — never replace as UI copy */
const STATE_LITERALS = new Set([
	'Payment', 'PayRequest', 'PaymentNFC', 'Privacy', 'Notifications', 'Statement',
	'Search', 'Claim', 'Redeem', 'Print', 'Unknown', 'Pending', 'Expired', 'Close',
	'Back', 'Owned', 'Canceled', 'Waiting', 'Account', 'Region', 'Cashcodes', 'Passkey',
	'Help', 'privateKey', 'backup', 'payme', 'payrequest', 'paymentnfc', 'payment',
	'coupon', 'catalog', 'gift', 'Waiting', 'Canceled', 'Success', 'Failed',
])

const UI_PROPS = [
	'label', 'title', 'placeholder', 'subtitle', 'helper', 'helperText', 'description',
	'heading', 'message', 'emptyText', 'actionLabel', 'aria-label', 'ariaLabel',
	'confirmText', 'cancelText', 'buttonText', 'headerTitle', 'text', 'content', 'name',
	'payTitle', 'paySubtitle', 'desc', 'action', 'emptyMessage', 'successTitle', 'errorTitle',
]

const ASSIGN_VARS = ['title', 'handle', 'label', 'message', 'subtitle', 'description', 'text']

const enEntries = Object.entries(EN_TO_KEY).sort((a, b) => b[0].length - a[0].length)

function shouldProcess(filePath) {
	const rel = path.relative(SRC, filePath)
	if (SKIP_FILE_RE.test(filePath)) return false
	for (const part of rel.split(path.sep)) {
		if (SKIP_DIRS.has(part)) return false
	}
	return /\.(tsx|ts)$/.test(filePath)
}

function walk(dir, out = []) {
	for (const name of fs.readdirSync(dir)) {
		const p = path.join(dir, name)
		if (fs.statSync(p).isDirectory()) {
			if (name === 'node_modules') continue
			walk(p, out)
		} else if (shouldProcess(p)) out.push(p)
	}
	return out
}

function escapeRegExp(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function lineIsUnsafe(line) {
	if (/^\s*(\/\/|\*)/.test(line)) return true
	if (/^\s*import\s/.test(line)) return true
	if (/from\s+['"]lucide-react['"]/.test(line)) return true
	if (/className=/.test(line)) return true
	if (/console\.(log|warn|error|debug)\(/.test(line)) return true
	if (/useState\s*</.test(line)) return true
	if (/export\s+type\s/.test(line)) return true
	if (/type\s+\w+\s*=/.test(line) && line.includes('|')) return true
	if (/https?:\/\//.test(line)) return true
	if (/\.(tsx?|jsx?|png|jpg|svg|avif|json|scss|css)['"]/.test(line)) return true
	return false
}

function hasStateComparison(line, english) {
	const e = escapeRegExp(english)
	return (
		new RegExp(`(===|!==|==)\\s*['"]${e}['"]`).test(line) ||
		new RegExp(`['"]${e}['"]\\s*(===|!==|==)`).test(line) ||
		new RegExp(`\\|\\s*['"]${e}['"]`).test(line) ||
		new RegExp(`case\\s+['"]${e}['"]`).test(line) ||
		new RegExp(`set\\w+\\(['"]${e}['"]\\)`).test(line)
	)
}

function ensureImports(src) {
	let out = src
	const add = (line) => {
		if (out.includes(line.trim())) return
		const lines = out.split('\n')
		let at = 0
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].startsWith('import ')) at = i + 1
		}
		lines.splice(at, 0, line)
		out = lines.join('\n')
	}
	if (out.includes("tu('") || out.includes('tu("')) {
		add("import { tu } from '@/locale/beamioLocale'")
	}
	if (out.includes('mapServerError(')) {
		add("import { mapServerError } from '@/locale/mapServerError'")
	}
	return out
}

function replaceQuoted(line, english, key, quote) {
	const e = escapeRegExp(english)
	const q = quote === '"' ? '"' : "'"
	const replacement = `tu('${key}')`
	const patterns = [
		// UI props: label: 'Text'
		new RegExp(`(\\b(?:${UI_PROPS.join('|')})\\s*:\\s*)${q}${e}${q}`, 'g'),
		// JSX props: placeholder="Text"
		new RegExp(`(\\b(?:${UI_PROPS.join('|')})=)${q}${e}${q}`, 'g'),
		// default param: label = 'Text'
		new RegExp(`(\\b(?:${UI_PROPS.join('|')})\\s*=\\s*)${q}${e}${q}`, 'g'),
		// var assign: title = 'Text'
		new RegExp(`(\\b(?:${ASSIGN_VARS.join('|')})\\s*=\\s*)${q}${e}${q}`, 'g'),
		// Toast / content
		new RegExp(`(content:\\s*)${q}${e}${q}`, 'g'),
		// JSX expression: {'Text'}
		new RegExp(`(\\{)${q}${e}${q}(\\})`, 'g'),
	]
	let out = line
	for (const re of patterns) {
		out = out.replace(re, (_, a, b) => {
			if (b !== undefined) return `{${replacement}}`
			return `${a}${replacement}`
		})
	}
	// JSX text: >Text<
	if (line.includes('>') && line.includes('<')) {
		out = out.replace(
			new RegExp(`>\\s*${e}\\s*<`, 'g'),
			`>{${replacement}}<`,
		)
	}
	return out
}

function wireFile(filePath) {
	let src = fs.readFileSync(filePath, 'utf8')
	const original = src
	if (src.includes("tu('") && !filePath.includes('locale')) {
		// still process — may have partial wiring
	}

	// Multiline JSX text nodes
	for (const [english, key] of enEntries) {
		if (STATE_LITERALS.has(english) && english.length < 12) continue
		const e = escapeRegExp(english)
		const ml = new RegExp(`>\\s*\\n\\s*${e}\\s*\\n\\s*<`, 'g')
		if (ml.test(src)) {
			src = src.replace(ml, `>{tu('${key}')}<`)
		}
	}

	const lines = src.split('\n')
	let changed = false
	for (let li = 0; li < lines.length; li++) {
		let line = lines[li]
		if (lineIsUnsafe(line)) continue
		if (line.includes('tu(') && !/content:|placeholder=|title=|label=|>\s*\w/.test(line)) {
			// allow partial line updates
		}

		for (const [english, key] of enEntries) {
			if (!line.includes(english)) continue
			if (line.includes(`tu('${key}')`)) continue
			if (STATE_LITERALS.has(english) && hasStateComparison(line, english)) continue
			if (english.length < 4) continue
			if (english.includes('${')) continue

			const next = replaceQuoted(line, english, key, "'")
			const next2 = replaceQuoted(next, english, key, '"')
			if (next2 !== line) {
				line = next2
				changed = true
			}
		}

		// Error toast fallbacks
		const errReplacements = [
			[/content:\s*ret\.error\s*\?\?\s*['"][^'"]+['"]/g, "content: mapServerError(ret.error)"],
			[/content:\s*e\?\.message\s*\?\?\s*['"][^'"]+['"]/g, 'content: mapServerError(e?.message)'],
			[/content:\s*res\.error\s*\?\?\s*['"][^'"]+['"]/g, "content: mapServerError(res.error, 'createFailed')"],
			[/content:\s*err,\s*position:/g, 'content: mapServerError(err), position:'],
			[/content:\s*err\s*\}/g, 'content: mapServerError(err) }'],
		]
		for (const [re, rep] of errReplacements) {
			const n = line.replace(re, rep)
			if (n !== line) {
				line = n
				changed = true
			}
		}

		lines[li] = line
	}

	src = ensureImports(lines.join('\n'))
	if (src !== original) {
		fs.writeFileSync(filePath, src)
		return true
	}
	return false
}

let n = 0
for (const f of walk(SRC)) {
	if (wireFile(f)) {
		n++
		console.log(' wired', path.relative(SRC, f))
	}
}
console.log(`Done. Updated ${n} file(s).`)
