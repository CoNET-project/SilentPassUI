#!/usr/bin/env node
/** Fix wireI18n inserting `import { tu }` inside multiline import blocks. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src')

function walk(dir, out = []) {
	for (const name of fs.readdirSync(dir)) {
		const p = path.join(dir, name)
		if (fs.statSync(p).isDirectory()) {
			if (name === 'node_modules' || name === 'locale') continue
			walk(p, out)
		} else if (/\.(tsx|ts)$/.test(p) && !p.endsWith('.d.ts')) out.push(p)
	}
	return out
}

function fixFile(src) {
	let next = src.replace(
		/import \{\nimport \{ tu \} from '@\/locale\/beamioLocale'\n/g,
		"import { tu } from '@/locale/beamioLocale'\nimport {\n",
	)
	// `{ value: "en", {tu('english')} }` → `{ value: "en", label: tu('english') }`
	next = next.replace(
		/\{\s*value:\s*(['"][^'"]+['"]),\s*\{tu\('([^']+)'\)\}\s*\}/g,
		"{ value: $1, label: tu('$2') }",
	)
	// `label: {tu('x')}` already ok; `label={tu('x')}` ok
	return next
}

let n = 0
for (const f of walk(SRC)) {
	const src = fs.readFileSync(f, 'utf8')
	const fixed = fixFile(src)
	if (fixed !== src) {
		fs.writeFileSync(f, fixed)
		n++
		console.log(' fixed', path.relative(SRC, f))
	}
}
console.log(`Fixed ${n} file(s).`)
