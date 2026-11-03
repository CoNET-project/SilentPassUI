/**
 * The inbound chat line list after the queue effect has taken `taken` from it.
 *
 * Lines that arrived after the render the effect saw are already appended to
 * `prev`. Replacing the list with [] dropped them: they were never stored and
 * never ACKed, so the mailbox replayed them on the next listen.
 */
export function dropTakenInboundLines(prev: readonly string[], taken: readonly string[]): string[] {
	if (!taken.length) return [...prev]
	const isPrefix = prev.length >= taken.length && taken.every((line, i) => prev[i] === line)
	if (isPrefix) return prev.slice(taken.length)
	// Not a prefix (e.g. the effect ran twice for one render): remove each taken line once.
	const rest = [...prev]
	for (const line of taken) {
		const i = rest.indexOf(line)
		if (i >= 0) rest.splice(i, 1)
	}
	return rest
}
