#!/usr/bin/env node
/** Revert tu('key') in type unions / state setters / comparisons back to English literals. Fix JSX prop=tu(. */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src')

/** Internal route/state tokens — must stay stable English, not localized at runtime */
const KEY_TO_STATE_LITERAL = {
	payment: 'Payment',
	pending: 'Pending',
	print: 'Print',
	privacy: 'Privacy',
	notifications: 'Notifications',
	search: 'Search',
	paymentnfc: 'PaymentNFC',
	payrequest: 'PayRequest',
	unknown: 'Unknown',
	overview: 'Overview',
	business: 'Business',
	market: 'Market',
	transactions: 'Transactions',
	settings: 'Settings',
	messages: 'Messages',
	members: 'Members',
	wallets: 'Wallets',
	staff: 'Staff',
	dashboard: 'Dashboard',
	programs: 'Programs',
	close: 'Close',
}

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

function replaceStateTu(src, key, literal) {
	const re = new RegExp(`tu\\('${key}'\\)`, 'g')
	return src.replace(re, `'${literal}'`)
}

function fixSource(src) {
	let next = src

	// JSX: prop=tu('x') → prop={tu('x')}
	for (const prop of [
		'actionLabel', 'subtitle', 'payTitle', 'paySubtitle', 'title', 'label', 'alt', 'placeholder',
	]) {
		next = next.replace(new RegExp(`(\\b${prop})=tu\\(`, 'g'), `$1={tu(`)
		next = next.replace(new RegExp(`(\\b${prop})=\\{tu\\(([^)]*)\\)(?!\\})`, 'g'), `$1={tu($2)}`)
	}

	// Setter calls: setXxx(tu('payment')) → setXxx('Payment')
	for (const setter of [
		'setShowAlphaHowItWorks',
		'setSettingsOpen',
		'setEoaPanelOpen',
		'setAaPanelOpen',
		'setPanelOpen',
	]) {
		for (const [key, literal] of Object.entries(KEY_TO_STATE_LITERAL)) {
			next = next.replace(
				new RegExp(`(${setter})\\(\\s*tu\\('${key}'\\)\\s*\\)`, 'g'),
				`$1('${literal}')`,
			)
		}
	}

	// handleTabChange / route args: handleTabChange(tu('overview')) → handleTabChange('Overview')
	next = next.replace(/handleTabChange\(\s*tu\('([^']+)'\)/g, (full, key) => {
		const lit = KEY_TO_STATE_LITERAL[key]
		return lit ? `handleTabChange('${lit}'` : full
	})
	next = next.replace(/navigate\(\s*tu\('([^']+)'\)/g, (full, key) => {
		const lit = KEY_TO_STATE_LITERAL[key]
		return lit ? `navigate('${lit}'` : full
	})

	const lines = next.split('\n')
	for (let i = 0; i < lines.length; i++) {
		let line = lines[i]

		const isTypeOrStateLine =
			/export\s+type\s/.test(line) ||
			/type\s+\w+\s*=/.test(line) ||
			/useState\s*</.test(line) ||
			/(:\s*\([^)]*\)\s*=>\s*void)/.test(line) && /tu\(/.test(line) ||
			/setShowAlphaHowItWorks|setSettingsOpen|setEoaPanelOpen|setAaPanelOpen/.test(line)

		const isCompareLine =
			/(===|!==|==)/.test(line) &&
			/(status|PanelOpen|settingsOpen|showAlphaHowItWorks|showMode|username|\.status|getStatus|actionLabel|isProvisional|PlaceholderTitle|activeTab|navChromeTab|transactionsSidebar)/.test(line)

		const isUsernameCheck = /username/.test(line) && /tu\('unknown'\)/.test(line)

		const isIndexerTitleCompare =
			/(===|!==)/.test(line) &&
			/isProvisional|PlaceholderTitle|merchantCardDatabase/.test(line)

		if (isTypeOrStateLine || isCompareLine || isUsernameCheck || isIndexerTitleCompare) {
			for (const [key, literal] of Object.entries(KEY_TO_STATE_LITERAL)) {
				line = line.replace(new RegExp(`tu\\('${key}'\\)`, 'g'), `'${literal}'`)
			}
			if (isCompareLine && /getStatus|\.status|status ===/.test(line)) {
				line = line.replace(/tu\('expired_2'\)/g, "'EXPIRED'")
				line = line.replace(/tu\('expired'\)/g, "'Expired'")
			}
		}

		lines[i] = line
	}
	next = lines.join('\n')

	// messageSendReceiveCard status type
	next = next.replace(
		/status\?\:\s*"Completed"\s*\|\s*tu\('pending'\)\s*\|\s*"Failed"/,
		'status?: "Completed" | "Pending" | "Failed"',
	)

	// Pay/index ternary for showAlphaHowItWorks display mapping — keep English token compare
	next = next.replace(
		/showAlphaHowItWorks === tu\('paymentnfc'\)/g,
		"showAlphaHowItWorks === 'PaymentNFC'",
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
console.log(`Fixed state tokens in ${n} files`)
