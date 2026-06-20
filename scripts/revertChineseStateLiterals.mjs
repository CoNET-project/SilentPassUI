#!/usr/bin/env node
/**
 * Revert mistaken literal Chinese in internal route/state tokens (from accidental localizeToZh run).
 * Display copy must use tu(); tab/state tokens stay English.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src')

/** zh literal → stable English state token */
const REVERT = {
	'设置': 'Settings',
	'支付': 'Payment',
	'搜索': 'Search',
	'充值': 'Top-up',
	'收款请求': 'PayRequest',
	'NFC 支付': 'PaymentNFC',
	'隐私': 'Privacy',
	'通知': 'Notifications',
	// Merchant OS tab tokens (accidental localizeToZh)
	'概览': 'Overview',
	'业务': 'Business',
	'市场': 'Market',
	'消息': 'Messages',
	'钱包': 'Wallets',
	'交易': 'Transactions',
	'员工': 'Staff',
	'验证者管理': 'Validator Management',
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

function revertFile(src) {
	let out = src
	for (const [zh, en] of Object.entries(REVERT)) {
		out = out.split(`'${zh}'`).join(`'${en}'`)
		out = out.split(`"${zh}"`).join(`"${en}"`)
	}
	return out
}

let n = 0
for (const f of walk(SRC)) {
	const src = fs.readFileSync(f, 'utf8')
	const fixed = revertFile(src)
	if (fixed !== src) {
		fs.writeFileSync(f, fixed)
		n++
		console.log(' reverted', path.relative(SRC, f))
	}
}
console.log(`Reverted Chinese state literals in ${n} file(s).`)
