import { decryptVoiceFrame, encryptVoiceFrame } from '@/utils/voiceCallSession'

const blobBytes = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer())

export const startVoiceCapture = async (
	stream: MediaStream,
	key: Uint8Array,
	onFrame: (payload: string) => Promise<void> | void,
	intervalMs = 100,
): Promise<() => void> => {
	if (typeof MediaRecorder === 'undefined') throw new Error('voice_media_recorder_unsupported')
	const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
		.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || ''
	const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
	recorder.ondataavailable = (event) => {
		if (!event.data.size) return
		void blobBytes(event.data).then((bytes) => encryptVoiceFrame(key, bytes)).then(onFrame)
	}
	recorder.start(intervalMs)
	return () => {
		try { recorder.stop() } catch { /* already stopped */ }
		stream.getTracks().forEach((track) => track.stop())
	}
}

export class VoicePlaybackBuffer {
	private readonly audio: HTMLAudioElement
	private readonly mediaSource: MediaSource | null
	private sourceBuffer: SourceBuffer | null = null
	private pending: Uint8Array[] = []
	private objectUrl: string | null = null
	private key: Uint8Array | null = null

	constructor(audio: HTMLAudioElement) {
		this.audio = audio
		this.mediaSource = typeof MediaSource === 'undefined' ? null : new MediaSource()
		if (!this.mediaSource) return
		this.objectUrl = URL.createObjectURL(this.mediaSource)
		audio.src = this.objectUrl
		this.mediaSource.addEventListener('sourceopen', () => {
			try {
				this.sourceBuffer = this.mediaSource?.addSourceBuffer('audio/webm; codecs="opus"') || null
				this.sourceBuffer?.addEventListener('updateend', () => this.flush())
				this.flush()
			} catch {
				/* Unsupported codec is reported when a frame cannot be appended. */
			}
		}, { once: true })
	}

	setKey(key: Uint8Array): void { this.key = key }

	async push(payload: string): Promise<void> {
		if (!this.key) throw new Error('voice_playback_key_missing')
		this.pending.push(await decryptVoiceFrame(this.key, payload))
		this.flush()
	}

	private flush(): void {
		if (!this.sourceBuffer || this.sourceBuffer.updating || !this.pending.length) return
		const frame = this.pending.shift()
		if (!frame) return
		try {
			this.sourceBuffer.appendBuffer(frame)
			void this.audio.play().catch(() => {})
		} catch {
			this.pending.unshift(frame)
		}
	}

	destroy(): void {
		this.pending = []
		this.key = null
		if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
		this.objectUrl = null
		this.audio.removeAttribute('src')
		this.audio.load()
	}
}
