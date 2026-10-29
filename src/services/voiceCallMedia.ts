import { startNativeVoiceMic, stopNativeVoiceMic } from '@/utils/cashTreesNativeNfc'
import { decryptVoiceFrame, encryptVoiceFrame } from '@/utils/voiceCallSession'

/** 16 kHz mono PCM. Both browsers and Android WebView can capture and play this. */
export const VOICE_PCM_SAMPLE_RATE = 16_000

/** Android WebView pulls the capture graph by writing silence to the speaker.
 *  Default echo cancellation then treats that output as the reference and
 *  erases the microphone, so the visible meter and the uplink both stay flat.
 */
export const voiceCaptureConstraints = (androidShell: boolean): MediaStreamConstraints => (
	androidShell
		? { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }
		: { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }
)
const VOICE_PCM_FRAME_MS = 80
const VOICE_PCM_MAGIC = [0x42, 0x50, 0x43, 0x4d] as const // BPCM

type AudioContextCtor = typeof AudioContext

const audioContextCtor = (): AudioContextCtor | null => {
	if (typeof window === 'undefined') return null
	return window.AudioContext
		|| (window as Window & { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
		|| null
}

const floatToInt16 = (sample: number): number => {
	const clamped = Math.max(-1, Math.min(1, sample))
	return clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff)
}

export const downsampleToInt16 = (
	input: Float32Array,
	inputRate: number,
	outputRate: number,
): Int16Array => {
	if (inputRate <= outputRate) {
		const direct = new Int16Array(input.length)
		for (let i = 0; i < input.length; i++) direct[i] = floatToInt16(input[i])
		return direct
	}
	const ratio = inputRate / outputRate
	const length = Math.floor(input.length / ratio)
	const output = new Int16Array(length)
	for (let i = 0; i < length; i++) {
		const start = Math.floor(i * ratio)
		const end = Math.min(input.length, Math.floor((i + 1) * ratio))
		let sum = 0
		let count = 0
		for (let j = start; j < end; j++) {
			sum += input[j]
			count += 1
		}
		output[i] = floatToInt16(count ? sum / count : 0)
	}
	return output
}

export const encodePcmVoiceFrame = (pcm: Int16Array, sampleRate: number): Uint8Array => {
	const bytes = new Uint8Array(8 + pcm.length * 2)
	bytes.set(VOICE_PCM_MAGIC)
	const view = new DataView(bytes.buffer)
	view.setUint32(4, sampleRate, true)
	for (let i = 0; i < pcm.length; i++) view.setInt16(8 + i * 2, pcm[i], true)
	return bytes
}

const hasBpcmMagic = (bytes: Uint8Array): boolean => (
	bytes.length >= 4
	&& bytes[0] === VOICE_PCM_MAGIC[0]
	&& bytes[1] === VOICE_PCM_MAGIC[1]
	&& bytes[2] === VOICE_PCM_MAGIC[2]
	&& bytes[3] === VOICE_PCM_MAGIC[3]
)

/** Little-endian int16 mono PCM → float samples (Android native uplink format). */
const decodeRawPcm16Le = (
	bytes: Uint8Array,
	sampleRate: number,
): { sampleRate: number; samples: Float32Array } | null => {
	if (bytes.length < 4 || (bytes.length % 2) !== 0) return null
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const sampleCount = bytes.length >> 1
	const samples = new Float32Array(sampleCount)
	for (let i = 0; i < sampleCount; i++) {
		samples[i] = view.getInt16(i * 2, true) / 32768
	}
	return { sampleRate, samples }
}

/**
 * Decode an AES-plain voice payload.
 * - Preferred: BPCM header (browser ↔ browser, PWA capture).
 * - Fallback: raw LE int16 @ 16 kHz — Android `BeamioNativeVoiceChannel` encrypts
 *   bare AudioRecord PCM with no BPCM wrapper; rejecting that left the browser
 *   dialer with decrypt-ok / decode-fail silence (no level, no speaker).
 */
export const decodePcmVoiceFrame = (
	bytes: Uint8Array,
): { sampleRate: number; samples: Float32Array } | null => {
	if (hasBpcmMagic(bytes)) {
		if (bytes.length < 10) return null
		const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
		const sampleRate = view.getUint32(4, true)
		if (sampleRate < 8_000 || sampleRate > 48_000) return null
		const sampleCount = (bytes.length - 8) >> 1
		const samples = new Float32Array(sampleCount)
		for (let i = 0; i < sampleCount; i++) {
			samples[i] = view.getInt16(8 + i * 2, true) / 32768
		}
		return { sampleRate, samples }
	}
	// Native Android callee/dialer uplink (and any peer that skips BPCM).
	return decodeRawPcm16Le(bytes, VOICE_PCM_SAMPLE_RATE)
}

/**
 * True when AES-plain looks like PCM media, not a UTF-8 JSON control frame.
 * Android uplink is raw PCM16 LE (even length). Control frames are short JSON
 * starting with `{`. Long even payloads that start with `{` are still PCM —
 * chat.tsx only JSON.parses when this returns false, then falls through to
 * media on parse failure; treat long even frames as media so we never drop them.
 */
export const isLikelyVoiceMediaPlain = (bytes: Uint8Array): boolean => {
	if (!(bytes instanceof Uint8Array) || bytes.length < 4) return false
	if (hasBpcmMagic(bytes)) return true
	if ((bytes.length % 2) !== 0) return false
	// Short `{…}` control (accept/hangup/reject). Media frames are ≥10ms @16k.
	if (bytes[0] === 0x7b && bytes.length < 640) return false
	return true
}

/**
 * Capture microphone PCM and send short encrypted frames.
 * MediaRecorder timeslices are not a continuous Opus stream, so the other
 * side cannot play them. Raw PCM plays on both ends.
 */
const coerceFloat32 = (data: unknown): Float32Array | null => {
	if (data instanceof Float32Array) return data
	// AudioWorklet messages can arrive as a typed array from another realm,
	// where instanceof Float32Array is false.
	if (ArrayBuffer.isView(data)) {
		const view = data as ArrayBufferView
		if (!view.byteLength || view.byteLength % 4 !== 0) return null
		return new Float32Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength))
	}
	if (data instanceof ArrayBuffer && data.byteLength && data.byteLength % 4 === 0) {
		return new Float32Array(data.slice(0))
	}
	if (Array.isArray(data) && data.length) return Float32Array.from(data as number[])
	return null
}

export type VoiceCaptureGraph = {
	context: AudioContext
	source: MediaStreamAudioSourceNode
}

export const startVoiceCapture = async (
	stream: MediaStream,
	key: Uint8Array,
	onFrame: (payload: string) => Promise<void> | void,
	shared?: VoiceCaptureGraph,
	onDiag?: (phase: string, detail: Record<string, unknown>) => void,
): Promise<() => void> => {
	const Ctor = audioContextCtor()
	if (!Ctor && !shared) throw new Error('voice_media_recorder_unsupported')
	const ownsContext = !shared
	const context = shared?.context ?? new Ctor!()
	// Android WebView can leave resume() pending forever when the gesture was
	// the native Answer button, not a WebView tap. Connect the graph anyway.
	void context.resume().catch(() => {})
	const source = shared?.source ?? context.createMediaStreamSource(stream)
	const trackSettings = stream.getAudioTracks()[0]?.getSettings?.() || {}
	onDiag?.('capture_context', {
		state: context.state,
		rate: context.sampleRate,
		shared: Boolean(shared),
		worklet: Boolean(context.audioWorklet),
		echoCancellation: trackSettings.echoCancellation ?? null,
	})
	let closed = false
	let pending = new Int16Array(0)
	const samplesPerFrame = Math.round(VOICE_PCM_SAMPLE_RATE * VOICE_PCM_FRAME_MS / 1000)
	const append = (chunk: Int16Array) => {
		if (!chunk.length) return
		const next = new Int16Array(pending.length + chunk.length)
		next.set(pending)
		next.set(chunk, pending.length)
		const maxPending = VOICE_PCM_SAMPLE_RATE
		pending = next.length > maxPending ? next.subarray(next.length - maxPending) : next
	}
	const consume = (input: Float32Array) => {
		if (closed || !input.length) return
		append(downsampleToInt16(input, context.sampleRate, VOICE_PCM_SAMPLE_RATE))
		while (pending.length >= samplesPerFrame) {
			const frame = pending.subarray(0, samplesPerFrame)
			pending = pending.subarray(samplesPerFrame)
			const copy = new Int16Array(frame)
			void encryptVoiceFrame(key, encodePcmVoiceFrame(copy, VOICE_PCM_SAMPLE_RATE))
				.then(onFrame)
				.catch(() => { /* a dropped frame must not stop the microphone */ })
		}
	}
	// Android WebView does not pull a ScriptProcessor that sits behind a silent
	// gain, so the visible mic meter runs while no frames are posted. AudioWorklet
	// stays on the rendering thread and writes silence to the destination so the
	// graph is pulled without playing the mic back into the speaker.
	if (context.audioWorklet) {
		try {
		const sourceText = `
			class BeamioPcmCapture extends AudioWorkletProcessor {
				process(inputs, outputs) {
					const channel = inputs[0] && inputs[0][0]
					if (channel && channel.length) this.port.postMessage(channel.slice(0))
					const out = outputs[0] && outputs[0][0]
					if (out) out.fill(0)
					return true
				}
			}
			registerProcessor('beamio-pcm-capture', BeamioPcmCapture)
		`
		const moduleUrl = URL.createObjectURL(new Blob([sourceText], { type: 'text/javascript' }))
		try {
			await context.audioWorklet.addModule(moduleUrl)
		} finally {
			URL.revokeObjectURL(moduleUrl)
		}
		const node = new AudioWorkletNode(context, 'beamio-pcm-capture', {
			numberOfInputs: 1,
			numberOfOutputs: 1,
			outputChannelCount: [1],
		})
		let workletMessages = 0
		node.port.onmessage = (event) => {
			const data = coerceFloat32(event.data)
			workletMessages += 1
			if (workletMessages <= 2 || workletMessages === 80) {
				const raw = event.data
				let peak = 0
				if (data) {
					for (let i = 0; i < data.length; i += 16) peak = Math.max(peak, Math.abs(data[i]))
				}
				onDiag?.('worklet_frame', {
					n: workletMessages,
					kind: raw?.constructor?.name || typeof raw,
					len: data?.length || 0,
					peak: Number(peak.toFixed(4)),
					state: context.state,
				})
			}
			if (data) consume(data)
		}
		source.connect(node)
		// Do not play this node to the speaker. Android's voice HAL echo
		// canceller treats that output as the reference and erases the mic,
		// even when echoCancellation is false. A media-stream sink still
		// pulls the graph.
		const sink = context.createMediaStreamDestination()
		node.connect(sink)
		return () => {
			closed = true
			try { node.disconnect() } catch { /* already stopped */ }
			try { node.port.close() } catch { /* already stopped */ }
			try { sink.disconnect() } catch { /* already stopped */ }
			if (ownsContext) {
				try { source.disconnect() } catch { /* already stopped */ }
				void context.close().catch(() => {})
			}
			stream.getTracks().forEach((track) => track.stop())
		}
		} catch (error) {
			onDiag?.('worklet_failed', {
				message: error instanceof Error ? error.message : 'worklet_failed',
			})
		}
	}
	if (typeof context.createScriptProcessor !== 'function') {
		void context.close().catch(() => {})
		throw new Error('voice_media_recorder_unsupported')
	}
	const processor = context.createScriptProcessor(4096, 1, 1)
	processor.onaudioprocess = (event) => {
		event.outputBuffer.getChannelData(0).fill(0)
		consume(event.inputBuffer.getChannelData(0))
	}
	source.connect(processor)
	const sink = context.createMediaStreamDestination()
	processor.connect(sink)
	onDiag?.('script_processor', { state: context.state, rate: context.sampleRate })
	return () => {
		closed = true
		try { processor.disconnect() } catch { /* already stopped */ }
		if (ownsContext) {
			try { source.disconnect() } catch { /* already stopped */ }
			void context.close().catch(() => {})
		}
		stream.getTracks().forEach((track) => track.stop())
	}
}

const decodeNativePcm16 = (encoded: string): Int16Array | null => {
	if (!encoded) return null
	let binary = ''
	try {
		binary = atob(encoded)
	} catch {
		return null
	}
	if (binary.length < 2) return null
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	const view = new DataView(bytes.buffer)
	const samples = new Int16Array(bytes.length >> 1)
	for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true)
	return samples.length ? samples : null
}

/**
 * Android Telecom MODE_IN_COMMUNICATION silences WebView getUserMedia.
 * Native AudioRecord delivers 16 kHz PCM that is already the uplink rate.
 */
export const startAndroidNativeMicCapture = (
	key: Uint8Array,
	onFrame: (payload: string) => Promise<void> | void,
	onLevel?: (level: number) => void,
	onDiag?: (phase: string, detail: Record<string, unknown>) => void,
): (() => void) | null => {
	const host = window as Window & { __beamioNativeMicChunk?: (encoded: string) => void }
	let closed = false
	let pending = new Int16Array(0)
	let chunks = 0
	const samplesPerFrame = Math.round(VOICE_PCM_SAMPLE_RATE * VOICE_PCM_FRAME_MS / 1000)
	const stop = () => {
		if (closed) return
		closed = true
		delete host.__beamioNativeMicChunk
		stopNativeVoiceMic()
	}
	host.__beamioNativeMicChunk = (encoded: string) => {
		if (closed) return
		const chunk = decodeNativePcm16(encoded)
		if (!chunk) return
		chunks += 1
		let peak = 0
		let energy = 0
		for (let i = 0; i < chunk.length; i++) {
			const sample = chunk[i]
			const magnitude = sample < 0 ? -sample : sample
			if (magnitude > peak) peak = magnitude
			const unit = sample / 32768
			energy += unit * unit
		}
		onLevel?.(Math.min(1, peak / 8000))
		if (chunks <= 2 || chunks === 20) {
			onDiag?.('native_mic_chunk', {
				n: chunks,
				samples: chunk.length,
				peak,
				rms: Number(Math.sqrt(energy / chunk.length).toFixed(4)),
			})
		}
		const next = new Int16Array(pending.length + chunk.length)
		next.set(pending)
		next.set(chunk, pending.length)
		pending = next.length > VOICE_PCM_SAMPLE_RATE
			? next.subarray(next.length - VOICE_PCM_SAMPLE_RATE)
			: next
		while (pending.length >= samplesPerFrame) {
			const frame = new Int16Array(pending.subarray(0, samplesPerFrame))
			pending = pending.subarray(samplesPerFrame)
			void encryptVoiceFrame(key, encodePcmVoiceFrame(frame, VOICE_PCM_SAMPLE_RATE))
				.then(onFrame)
				.catch(() => { /* a dropped frame must not stop the microphone */ })
		}
	}
	if (!startNativeVoiceMic()) {
		delete host.__beamioNativeMicChunk
		onDiag?.('native_mic_start_failed', {})
		return null
	}
	onDiag?.('native_mic_started', { rate: VOICE_PCM_SAMPLE_RATE })
	return stop
}

export const voiceLevelFromPcmBytes = (bytes: Uint8Array): number | null => {
	const decoded = decodePcmVoiceFrame(bytes)
	if (!decoded || !decoded.samples.length) return null
	let peak = 0
	const samples = decoded.samples
	for (let i = 0; i < samples.length; i++) {
		const value = samples[i] < 0 ? -samples[i] : samples[i]
		if (value > peak) peak = value
	}
	// Same scale as the Android mic meter: int16 peak / 8000.
	return Math.min(1, peak * 32768 / 8000)
}

const desktopUsesAudioElementSpeaker = (): boolean => {
	if (typeof navigator === 'undefined') return false
	// Android WebView already plays call audio through the WebAudio graph.
	// Desktop Chrome runs that same graph (the incoming curve moves) while
	// context.destination stays silent, so the desktop speaker is an <audio> element.
	return !/Android/i.test(navigator.userAgent)
}

const encodeWavBlob = (samples: Float32Array, sampleRate: number): Blob => {
	const bytes = new ArrayBuffer(44 + samples.length * 2)
	const view = new DataView(bytes)
	const write = (offset: number, text: string) => {
		for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
	}
	write(0, 'RIFF')
	view.setUint32(4, 36 + samples.length * 2, true)
	write(8, 'WAVE')
	write(12, 'fmt ')
	view.setUint32(16, 16, true)
	view.setUint16(20, 1, true)
	view.setUint16(22, 1, true)
	view.setUint32(24, sampleRate, true)
	view.setUint32(28, sampleRate * 2, true)
	view.setUint16(32, 2, true)
	view.setUint16(34, 16, true)
	write(36, 'data')
	view.setUint32(40, samples.length * 2, true)
	let offset = 44
	for (let i = 0; i < samples.length; i++) {
		view.setInt16(offset, floatToInt16(samples[i]), true)
		offset += 2
	}
	return new Blob([bytes], { type: 'audio/wav' })
}

const resampleFloat32 = (input: Float32Array, fromRate: number, toRate: number): Float32Array => {
	if (!input.length || fromRate === toRate) return input
	const length = Math.max(1, Math.round(input.length * toRate / fromRate))
	const output = new Float32Array(length)
	const ratio = fromRate / toRate
	for (let i = 0; i < length; i++) {
		const position = i * ratio
		const left = Math.floor(position)
		const right = Math.min(input.length - 1, left + 1)
		const mix = position - left
		output[i] = input[left] * (1 - mix) + input[right] * mix
	}
	return output
}

export class VoicePlaybackBuffer {
	context: AudioContext | null
	analyser: AnalyserNode | null
	private gain: GainNode | null
	private speaker: HTMLAudioElement | null = null
	private key: Uint8Array | null = null
	private nextTime = 0
	private sources: AudioBufferSourceNode[] = []
	private pcmPending = new Float32Array(0)
	private pcmRate = VOICE_PCM_SAMPLE_RATE
	private clipTail: Promise<void> = Promise.resolve()
	private clipGeneration = 0
	private flushTimer: number | null = null
	/** Speaker level. Earpiece uses a lower value; neither is mute. */
	private outputGain = 4

	constructor() {
		this.context = null
		this.analyser = null
		this.gain = null
		this.mountGraph()
	}

	private prefersElementSpeaker(): boolean {
		return desktopUsesAudioElementSpeaker()
	}

	private ensureSpeaker(): HTMLAudioElement | null {
		if (!this.prefersElementSpeaker() || typeof Audio === 'undefined') return null
		if (this.speaker) return this.speaker
		const speaker = new Audio()
		speaker.setAttribute('playsinline', 'true')
		speaker.preload = 'auto'
		speaker.volume = this.outputGain >= 4 ? 1 : 0.45
		this.speaker = speaker
		return speaker
	}

	private unlockSpeaker(): void {
		const speaker = this.ensureSpeaker()
		if (!speaker) return
		const silent = encodeWavBlob(new Float32Array(160), VOICE_PCM_SAMPLE_RATE)
		const url = URL.createObjectURL(silent)
		speaker.src = url
		const played = speaker.play()
		if (played) {
			played.then(() => URL.revokeObjectURL(url)).catch(() => URL.revokeObjectURL(url))
		} else {
			URL.revokeObjectURL(url)
		}
	}

	private enqueueSpeakerPcm(samples: Float32Array, sampleRate: number): void {
		const speaker = this.ensureSpeaker()
		if (!speaker || !samples.length) return
		const merged = new Float32Array(this.pcmPending.length + samples.length)
		merged.set(this.pcmPending, 0)
		merged.set(samples, this.pcmPending.length)
		// ~80ms @16k — lower than 240ms so first inbound audio is audible sooner.
		const flushAt = Math.floor(sampleRate * 0.08)
		if (merged.length < flushAt) {
			this.pcmPending = merged
			this.pcmRate = sampleRate
			this.scheduleSpeakerFlush()
			return
		}
		this.pcmPending = new Float32Array(0)
		this.playSpeakerClip(merged, sampleRate)
	}

	private scheduleSpeakerFlush(): void {
		if (this.flushTimer !== null) return
		this.flushTimer = window.setTimeout(() => {
			this.flushTimer = null
			if (!this.pcmPending.length) return
			const pending = this.pcmPending
			const rate = this.pcmRate
			this.pcmPending = new Float32Array(0)
			this.playSpeakerClip(pending, rate)
		}, 80)
	}

	private notePlayFail(detail: Record<string, unknown>): void {
		try {
			const w = window as Window & { __voicePlayFail?: Record<string, unknown> }
			w.__voicePlayFail = { ...detail, at: Date.now() }
			console.warn('[voice-play]', detail)
		} catch {
			/* ignore */
		}
	}

	private playSpeakerClip(samples: Float32Array, sampleRate: number): void {
		// Desktop Chrome often keeps context.destination silent; HTMLAudio is the
		// audible path. Remount (armOutput) clears speaker — re-unlock if missing.
		if (!this.speaker && this.prefersElementSpeaker()) {
			this.unlockSpeaker()
		}
		const speaker = this.speaker
		if (!speaker) {
			this.notePlayFail({ reason: 'no_speaker', samples: samples.length, sampleRate })
			return
		}
		const generation = this.clipGeneration
		const url = URL.createObjectURL(encodeWavBlob(samples, sampleRate))
		this.clipTail = this.clipTail.then(() => new Promise<void>((resolve) => {
			if (generation !== this.clipGeneration) {
				URL.revokeObjectURL(url)
				resolve()
				return
			}
			let settled = false
			let timer = 0
			const done = () => {
				if (settled) return
				settled = true
				window.clearTimeout(timer)
				speaker.removeEventListener('ended', done)
				speaker.removeEventListener('error', done)
				URL.revokeObjectURL(url)
				resolve()
			}
			timer = window.setTimeout(done, Math.ceil((samples.length / sampleRate) * 1000) + 350)
			speaker.addEventListener('ended', done)
			speaker.addEventListener('error', done)
			speaker.src = url
			const played = speaker.play()
			if (played) {
				played.catch((error: unknown) => {
					const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
					this.notePlayFail({ reason: 'play_rejected', message, samples: samples.length, sampleRate })
					done()
				})
			}
		}))
	}

	/**
	 * Call from the click / Answer gesture, before any await.
	 * A context created at page load can run the analyser (the curve moves)
	 * while the browser still refuses to open the speaker.
	 * Desktop always remounts WebAudio on the gesture too — HTMLAudio unlock
	 * alone left inbound PCM with peer level but no audible output when
	 * element `play()` stayed blocked after Accept.
	 */
	armOutput(): void {
		this.mountGraph()
		if (this.prefersElementSpeaker()) {
			this.unlockSpeaker()
		}
	}

	/** Schedule PCM on WebAudio → destination (primary audible path). */
	private scheduleWebAudioPcm(samples: Float32Array, sampleRate: number): void {
		if (!this.context || !this.analyser || !samples.length) return
		this.resume()
		const now = this.context.currentTime
		if (this.nextTime < now) this.nextTime = now + 0.05
		// A suspended context never advances currentTime, so a 2s cap would
		// drop every frame after the first burst and the speaker stays quiet.
		if (this.nextTime > now + 0.3) this.nextTime = now + 0.05
		const resampled = resampleFloat32(samples, sampleRate, this.context.sampleRate)
		const buffer = this.context.createBuffer(1, resampled.length, this.context.sampleRate)
		buffer.getChannelData(0).set(resampled)
		const source = this.context.createBufferSource()
		source.buffer = buffer
		if (this.gain) source.connect(this.gain)
		source.connect(this.analyser)
		source.start(this.nextTime)
		this.nextTime += buffer.duration
		this.sources.push(source)
		source.onended = () => {
			this.sources = this.sources.filter((item) => item !== source)
		}
	}

	private mountGraph(): void {
		const Ctor = audioContextCtor()
		if (!Ctor) return
		const previous = this.context
		const previousSpeaker = this.speaker
		for (const source of this.sources) {
			try { source.stop() } catch { /* already finished */ }
		}
		this.sources = []
		this.nextTime = 0
		const context = new Ctor({ latencyHint: 'interactive' })
		const analyser = context.createAnalyser()
		const gain = context.createGain()
		analyser.fftSize = 256
		gain.gain.value = this.outputGain
		// Always play through the hardware output. A MediaStream <audio>
		// element stays at digital silence in this browser while the analyser
		// still draws a curve, so the speakers never receive the call.
		gain.connect(context.destination)
		void context.resume().catch(() => {})
		this.context = context
		this.analyser = analyser
		this.gain = gain
		this.speaker = null
		if (previous && previous !== context) void previous.close().catch(() => {})
		if (previousSpeaker) {
			previousSpeaker.pause()
			previousSpeaker.srcObject = null
			previousSpeaker.remove()
		}
	}

	resume(): void {
		void this.context?.resume().catch(() => {})
		const speaker = this.speaker
		if (!speaker || !speaker.src) return
		if (!speaker.paused && !speaker.ended) return
		void speaker.play().catch(() => {})
	}

	setOutputGain(value: number): void {
		this.outputGain = value
		if (this.gain) this.gain.gain.value = value
		if (this.speaker) this.speaker.volume = value >= 4 ? 1 : 0.45
	}

	setKey(key: Uint8Array): void { this.key = key }

	async push(payload: string): Promise<void> {
		if (!this.key) throw new Error('voice_playback_key_missing')
		// Dial already armed the graph; if mid-call remount cleared it, rebuild
		// without waiting for another gesture (resume may still be suspended).
		if (!this.context || !this.analyser) {
			this.mountGraph()
			if (this.prefersElementSpeaker()) this.unlockSpeaker()
		}
		if (!this.context || !this.analyser) throw new Error('voice_playback_key_missing')
		const decoded = decodePcmVoiceFrame(await decryptVoiceFrame(this.key, payload))
		if (!decoded || !decoded.samples.length) throw new Error('voice_pcm_frame_invalid')
		// Always drive WebAudio → destination (gesture-unlocked via armOutput).
		this.scheduleWebAudioPcm(decoded.samples, decoded.sampleRate)
		// Desktop: also queue HTMLAudioElement WAV — primary audible path when
		// context.destination stays silent while the analyser/curve still moves.
		if (this.prefersElementSpeaker()) {
			if (!this.speaker) this.unlockSpeaker()
			this.enqueueSpeakerPcm(decoded.samples, decoded.sampleRate)
		}
	}

	/** Stop queued audio and keep the player ready for the next call. */
	reset(): void {
		this.key = null
		this.nextTime = 0
		this.pcmPending = new Float32Array(0)
		this.clipGeneration += 1
		this.clipTail = Promise.resolve()
		if (this.flushTimer !== null) {
			window.clearTimeout(this.flushTimer)
			this.flushTimer = null
		}
		for (const source of this.sources) {
			try { source.stop() } catch { /* already finished */ }
		}
		this.sources = []
		if (this.speaker) {
			this.speaker.pause()
			this.speaker.removeAttribute('src')
		}
		if (this.gain) this.gain.gain.value = this.outputGain
	}

	destroy(): void {
		this.reset()
		const context = this.context
		const speaker = this.speaker
		this.gain = null
		this.speaker = null
		if (speaker) {
			speaker.pause()
			speaker.srcObject = null
			speaker.remove()
		}
		if (context) void context.close().catch(() => {})
	}
}
