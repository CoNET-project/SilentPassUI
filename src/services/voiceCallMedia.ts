import { decryptVoiceFrame, encryptVoiceFrame } from '@/utils/voiceCallSession'

/** 16 kHz mono PCM. Both browsers and Android WebView can capture and play this. */
export const VOICE_PCM_SAMPLE_RATE = 16_000
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

export const decodePcmVoiceFrame = (
	bytes: Uint8Array,
): { sampleRate: number; samples: Float32Array } | null => {
	if (
		bytes.length < 10
		|| bytes[0] !== VOICE_PCM_MAGIC[0]
		|| bytes[1] !== VOICE_PCM_MAGIC[1]
		|| bytes[2] !== VOICE_PCM_MAGIC[2]
		|| bytes[3] !== VOICE_PCM_MAGIC[3]
	) return null
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

/**
 * Capture microphone PCM and send short encrypted frames.
 * MediaRecorder timeslices are not a continuous Opus stream, so the other
 * side cannot play them. Raw PCM plays on both ends.
 */
export const startVoiceCapture = async (
	stream: MediaStream,
	key: Uint8Array,
	onFrame: (payload: string) => Promise<void> | void,
): Promise<() => void> => {
	const Ctor = audioContextCtor()
	if (!Ctor) throw new Error('voice_media_recorder_unsupported')
	const context = new Ctor()
	await context.resume()
	const source = context.createMediaStreamSource(stream)
	if (typeof context.createScriptProcessor !== 'function') {
		void context.close().catch(() => {})
		throw new Error('voice_media_recorder_unsupported')
	}
	const processor = context.createScriptProcessor(4096, 1, 1)
	const sink = context.createGain()
	sink.gain.value = 0
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
	processor.onaudioprocess = (event) => {
		if (closed) return
		event.outputBuffer.getChannelData(0).fill(0)
		append(downsampleToInt16(event.inputBuffer.getChannelData(0), context.sampleRate, VOICE_PCM_SAMPLE_RATE))
		while (pending.length >= samplesPerFrame) {
			const frame = pending.subarray(0, samplesPerFrame)
			pending = pending.subarray(samplesPerFrame)
			const copy = new Int16Array(frame)
			void encryptVoiceFrame(key, encodePcmVoiceFrame(copy, VOICE_PCM_SAMPLE_RATE))
				.then(onFrame)
				.catch(() => { /* a dropped frame must not stop the microphone */ })
		}
	}
	source.connect(processor)
	processor.connect(sink)
	sink.connect(context.destination)
	return () => {
		closed = true
		try { processor.disconnect() } catch { /* already stopped */ }
		try { source.disconnect() } catch { /* already stopped */ }
		void context.close().catch(() => {})
		stream.getTracks().forEach((track) => track.stop())
	}
}

export class VoicePlaybackBuffer {
	readonly context: AudioContext | null
	readonly analyser: AnalyserNode | null
	private gain: GainNode | null
	private key: Uint8Array | null = null
	private nextTime = 0
	private sources: AudioBufferSourceNode[] = []

	constructor() {
		const Ctor = audioContextCtor()
		if (!Ctor) {
			this.context = null
			this.analyser = null
			this.gain = null
			return
		}
		const context = new Ctor()
		const analyser = context.createAnalyser()
		const gain = context.createGain()
		analyser.fftSize = 256
		gain.gain.value = 1
		// Meter the decoded voice, then apply the speaker gain.
		analyser.connect(gain)
		gain.connect(context.destination)
		this.context = context
		this.analyser = analyser
		this.gain = gain
	}

	resume(): void {
		void this.context?.resume().catch(() => {})
	}

	setOutputGain(value: number): void {
		if (this.gain) this.gain.gain.value = value
	}

	setKey(key: Uint8Array): void { this.key = key }

	async push(payload: string): Promise<void> {
		if (!this.key || !this.context || !this.analyser) throw new Error('voice_playback_key_missing')
		const decoded = decodePcmVoiceFrame(await decryptVoiceFrame(this.key, payload))
		if (!decoded || !decoded.samples.length) throw new Error('voice_pcm_frame_invalid')
		this.resume()
		const buffer = this.context.createBuffer(1, decoded.samples.length, decoded.sampleRate)
		buffer.getChannelData(0).set(decoded.samples)
		const source = this.context.createBufferSource()
		source.buffer = buffer
		source.connect(this.analyser)
		const now = this.context.currentTime
		if (this.nextTime < now + 0.02) this.nextTime = now + 0.05
		source.start(this.nextTime)
		this.nextTime += buffer.duration
		this.sources.push(source)
		source.onended = () => {
			this.sources = this.sources.filter((item) => item !== source)
		}
	}

	/** Stop queued audio and keep the player ready for the next call. */
	reset(): void {
		this.key = null
		this.nextTime = 0
		for (const source of this.sources) {
			try { source.stop() } catch { /* already finished */ }
		}
		this.sources = []
		if (this.gain) this.gain.gain.value = 1
	}

	destroy(): void {
		this.reset()
		const context = this.context
		this.gain = null
		if (context) void context.close().catch(() => {})
	}
}
