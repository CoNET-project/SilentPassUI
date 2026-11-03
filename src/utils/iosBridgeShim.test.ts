import fs from 'fs'
import path from 'path'

// The iOS shell injects window.CashTreesIOS: one forwarding function per action,
// each copying only the fields it lists. A field the page sends but the
// function does not copy never reaches the shell (RC3b: postPgpCiphertext lost
// `purpose`, so the call screen never saw the offer and always timed out).
// Reads the shell source next to this repository; skipped when it is not there.
const CONTENT_VIEW = path.resolve(__dirname, '../../../CashTrees_iOS/CashTrees_iOS/CashTrees_iOS/ContentView.swift')
const source = fs.existsSync(CONTENT_VIEW) ? fs.readFileSync(CONTENT_VIEW, 'utf8') : ''
const maybe = source ? test : test.skip

/** Fields each injected function copies, by action name. */
const shimFields = (src: string): Map<string, Set<string>> => {
	const out = new Map<string, Set<string>>()
	const re = /\n\s{12}(\w+):function\(\w*\)\{([\s\S]*?)\n\s{12}\},/g
	for (let m = re.exec(src); m; m = re.exec(src)) {
		const keys = new Set<string>()
		for (const k of m[2].matchAll(/\n\s+(\w+):/g)) keys.add(k[1])
		for (const k of m[2].matchAll(/m\.(\w+)=/g)) keys.add(k[1])
		keys.delete('action')
		out.set(m[1], keys)
	}
	return out
}

/** Fields the native handler reads (`body["…"]`), by action name. */
const nativeReads = (src: string): Map<string, Set<string>> => {
	const out = new Map<string, Set<string>>()
	const re = /case "(\w+)":([\s\S]*?)(?=\n {8}case "|\n {8}default:)/g
	for (let m = re.exec(src); m; m = re.exec(src)) {
		out.set(m[1], new Set([...m[2].matchAll(/body\["(\w+)"\]/g)].map((k) => k[1])))
	}
	return out
}

// Read natively but never sent by the page (optional on the native side).
const NOT_SENT_BY_THE_PAGE: Record<string, string[]> = { bindPushIdentity: ['requestId'] }

maybe('every field an iOS handler reads is forwarded by its injected function', () => {
	const shims = shimFields(source)
	const reads = nativeReads(source)
	expect(shims.size).toBeGreaterThan(20)
	const missing: string[] = []
	for (const [action, fields] of reads) {
		const shim = shims.get(action)
		if (!shim) continue
		for (const field of fields) {
			if (!shim.has(field) && !(NOT_SENT_BY_THE_PAGE[action] || []).includes(field)) missing.push(`${action}.${field}`)
		}
	}
	expect(missing).toEqual([])
})

maybe('postPgpCiphertext forwards purpose voice-offer only', () => {
	const shim = shimFields(source).get('postPgpCiphertext')
	expect(shim?.has('purpose')).toBe(true)
	expect(source).toContain("if(payload.purpose==='voice-offer'){m.purpose='voice-offer';}")
})
