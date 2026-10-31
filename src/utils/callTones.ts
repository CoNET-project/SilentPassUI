/**
 * Call progress tones for the browser call window (the native shells play their own).
 *
 * - Ringback: 425 Hz, 1 s on / 4 s off (ITU-T E.180), looped while the dialer waits.
 * - Busy: 425 Hz, 0.5 s on / 0.5 s off, three beeps, after the callee declines.
 *
 * The PCM is synthesized here (no audio file) and played through an <audio>
 * element: desktop Chrome can keep `AudioContext.destination` silent, which is
 * why `VoicePlaybackBuffer` uses an element speaker too. Call `unlock()` from
 * the Call click, before any await, so later `play()` calls are allowed.
 */

const SAMPLE_RATE = 16_000
const TONE_HZ = 425
/** About -10 dBFS before the element volume. */
const AMPLITUDE = 0.3
const ELEMENT_VOLUME = 0.6
const RAMP_SECONDS = 0.01

type Segment = { onSeconds: number; offSeconds: number }

const synthesize = (segments: Segment[]): Float32Array => {
	const total = segments.reduce(
		(sum, s) => sum + Math.round((s.onSeconds + s.offSeconds) * SAMPLE_RATE),
		0,
	)
	const out = new Float32Array(total)
	const ramp = Math.round(RAMP_SECONDS * SAMPLE_RATE)
	let offset = 0
	for (const segment of segments) {
		const on = Math.round(segment.onSeconds * SAMPLE_RATE)
		for (let i = 0; i < on; i++) {
			const gain = i < ramp ? i / ramp : i >= on - ramp ? (on - i) / ramp : 1
			out[offset + i] = Math.sin((2 * Math.PI * TONE_HZ * i) / SAMPLE_RATE) * AMPLITUDE * gain
		}
		offset += on + Math.round(segment.offSeconds * SAMPLE_RATE)
	}
	return out
}

const wavBlob = (samples: Float32Array): Blob => {
	const bytes = new ArrayBuffer(44 + samples.length * 2)
	const view = new DataView(bytes)
	const text = (at: number, value: string) => {
		for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i))
	}
	text(0, 'RIFF')
	view.setUint32(4, 36 + samples.length * 2, true)
	text(8, 'WAVE')
	text(12, 'fmt ')
	view.setUint32(16, 16, true)
	view.setUint16(20, 1, true)
	view.setUint16(22, 1, true)
	view.setUint32(24, SAMPLE_RATE, true)
	view.setUint32(28, SAMPLE_RATE * 2, true)
	view.setUint16(32, 2, true)
	view.setUint16(34, 16, true)
	text(36, 'data')
	view.setUint32(40, samples.length * 2, true)
	for (let i = 0; i < samples.length; i++) {
		const v = Math.max(-1, Math.min(1, samples[i]))
		view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
	}
	return new Blob([bytes], { type: 'audio/wav' })
}

type ToneKind = 'ringback' | 'busy'

const TONE_SEGMENTS: Record<ToneKind, Segment[]> = {
	ringback: [{ onSeconds: 1, offSeconds: 4 }],
	busy: [
		{ onSeconds: 0.5, offSeconds: 0.5 },
		{ onSeconds: 0.5, offSeconds: 0.5 },
		{ onSeconds: 0.5, offSeconds: 0 },
	],
}

export class CallTonePlayer {
	private element: HTMLAudioElement | null = null
	private urls: Partial<Record<ToneKind | 'silence', string>> = {}
	private mode: 'idle' | ToneKind = 'idle'

	private url(kind: ToneKind | 'silence'): string {
		const cached = this.urls[kind]
		if (cached) return cached
		const samples = kind === 'silence' ? new Float32Array(160) : synthesize(TONE_SEGMENTS[kind])
		const url = URL.createObjectURL(wavBlob(samples))
		this.urls[kind] = url
		return url
	}

	private ensureElement(): HTMLAudioElement | null {
		if (this.element) return this.element
		if (typeof Audio === 'undefined') return null
		const element = new Audio()
		element.setAttribute('playsinline', 'true')
		element.preload = 'auto'
		element.volume = ELEMENT_VOLUME
		element.addEventListener('ended', () => {
			if (this.mode === 'busy') this.mode = 'idle'
		})
		this.element = element
		return element
	}

	/** From the Call click, before any await: lets later play() calls through. */
	unlock(): void {
		const element = this.ensureElement()
		if (!element || this.mode !== 'idle') return
		element.loop = false
		element.src = this.url('silence')
		void element.play()?.catch(() => { /* a later play() may still work */ })
	}

	private play(kind: ToneKind): void {
		const element = this.ensureElement()
		if (!element) return
		this.mode = kind
		element.loop = kind === 'ringback'
		element.src = this.url(kind)
		element.currentTime = 0
		void element.play()?.catch((error: unknown) => {
			console.warn('[call-tone] play rejected', kind, error)
			if (this.mode === kind) this.mode = 'idle'
		})
	}

	startRingback(): void {
		if (this.mode === 'ringback') return
		this.play('ringback')
	}

	/** Stops the ringback only; a busy tone that already started keeps playing. */
	stopRingback(): void {
		if (this.mode !== 'ringback') return
		this.stop()
	}

	/** Callee declined while the ringback plays: switch to the busy tone. */
	busyIfRinging(): void {
		if (this.mode !== 'ringback') return
		this.play('busy')
	}

	stop(): void {
		this.mode = 'idle'
		const element = this.element
		if (!element) return
		element.pause()
		element.loop = false
	}

	destroy(): void {
		this.stop()
		if (this.element) {
			this.element.removeAttribute('src')
			this.element.load()
			this.element = null
		}
		for (const url of Object.values(this.urls)) {
			if (url) URL.revokeObjectURL(url)
		}
		this.urls = {}
	}
}
