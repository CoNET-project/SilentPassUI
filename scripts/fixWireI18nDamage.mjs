#!/usr/bin/env node
/** Repair wireI18nToSource.mjs damage: imports split mid-block, JSX attrs missing braces */
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
		} else if (/\.(tsx|ts)$/.test(p)) out.push(p)
	}
	return out
}

function fixSource(src) {
	let next = src

	// import {\nimport { tu } ... \n  foo → separate imports
	next = next.replace(
		/import \{\nimport \{ tu \} from '@\/locale\/beamioLocale'\n/g,
		"import { tu } from '@/locale/beamioLocale'\nimport {\n",
	)
	next = next.replace(
		/import \{\nimport \{ mapServerError \} from '@\/locale\/mapServerError'\n/g,
		"import { mapServerError } from '@/locale/mapServerError'\nimport {\n",
	)

	// JSX attr=tu('key') → attr={tu('key')}
	const jsxAttrs = ['alt', 'title', 'placeholder', 'aria-label', 'label']
	for (const attr of jsxAttrs) {
		const re = new RegExp(`(\\s${attr})=tu\\(`, 'g')
		next = next.replace(re, `$1={tu(`)
		next = next.replace(new RegExp(`(\\s${attr})=\\{tu\\(([^)]*)\\)(?!\\})`, 'g'), `$1={tu($2)}`)
	}
	// Fix double-brace or missing closing brace: alt={tu('x') without }
	next = next.replace(/(\salt=\{tu\('[^']+'\))(?!})/g, '$1}')

	// Remove duplicate consecutive tu imports
	next = next.replace(
		/(import \{ tu \} from '@\/locale\/beamioLocale'\n)+/g,
		"import { tu } from '@/locale/beamioLocale'\n",
	)
	next = next.replace(
		/(import \{ mapServerError \} from '@\/locale\/mapServerError'\n)+/g,
		"import { mapServerError } from '@/locale/mapServerError'\n",
	)

	return next
}

let n = 0
for (const f of walk(SRC)) {
	const src = fs.readFileSync(f, 'utf8')
	const fixed = fixSource(src)
	if (fixed !== src) {
		fs.writeFileSync(f, fixed)
		n++
	}
}
console.log(`Fixed ${n} files`)
