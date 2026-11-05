import { isCallToolsPanelBackgroundTap } from './callToolsPanelTap'

function buildPanel() {
	const outside = document.createElement('div')
	outside.innerHTML = `
		<div data-testid="panel">
			<button aria-label="Hide call controls"></button>
			<div class="identity">
				<p data-testid="name">@peer</p>
				<p data-testid="clock">00:12</p>
			</div>
			<div data-testid="row">
				<button aria-label="Mute"><span data-testid="mute-disc"><svg data-testid="mute-icon"><path data-testid="mute-path"/></svg></span><span data-testid="mute-label">Mute</span></button>
				<button aria-label="Video" disabled><span data-testid="video-label">Video</span></button>
			</div>
			<div role="button" data-testid="role-button"><span data-testid="role-inner">x</span></div>
		</div>
		<p data-testid="outside">outside</p>`
	document.body.appendChild(outside)
	const q = (id: string) => outside.querySelector(`[data-testid="${id}"]`) as Element
	return { root: outside, panel: q('panel'), q }
}

describe('isCallToolsPanelBackgroundTap', () => {
	afterEach(() => {
		document.body.innerHTML = ''
	})

	it('collapses for taps on the panel and its non-control content', () => {
		const { panel, q } = buildPanel()
		expect(isCallToolsPanelBackgroundTap(panel, panel)).toBe(true)
		expect(isCallToolsPanelBackgroundTap(q('name'), panel)).toBe(true)
		expect(isCallToolsPanelBackgroundTap(q('clock'), panel)).toBe(true)
		expect(isCallToolsPanelBackgroundTap(q('row'), panel)).toBe(true)
		expect(isCallToolsPanelBackgroundTap(q('name').firstChild, panel)).toBe(true)
	})

	it('does not collapse for taps on a control or anything inside it', () => {
		const { panel, q } = buildPanel()
		expect(isCallToolsPanelBackgroundTap(panel.querySelector('button'), panel)).toBe(false)
		expect(isCallToolsPanelBackgroundTap(q('mute-disc'), panel)).toBe(false)
		expect(isCallToolsPanelBackgroundTap(q('mute-icon'), panel)).toBe(false)
		expect(isCallToolsPanelBackgroundTap(q('mute-path'), panel)).toBe(false)
		expect(isCallToolsPanelBackgroundTap(q('mute-label'), panel)).toBe(false)
		expect(isCallToolsPanelBackgroundTap(q('video-label'), panel)).toBe(false)
		expect(isCallToolsPanelBackgroundTap(q('role-inner'), panel)).toBe(false)
	})

	it('ignores taps outside the panel and missing inputs', () => {
		const { panel, q } = buildPanel()
		expect(isCallToolsPanelBackgroundTap(q('outside'), panel)).toBe(false)
		expect(isCallToolsPanelBackgroundTap(null, panel)).toBe(false)
		expect(isCallToolsPanelBackgroundTap(q('name'), null)).toBe(false)
		expect(isCallToolsPanelBackgroundTap(window, panel)).toBe(false)
	})
})
