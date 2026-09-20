import React, { useEffect, useMemo, useRef, useState, useLayoutEffect, useCallback } from "react"
import { flushSync } from "react-dom"
import { useNavigate } from "react-router-dom"
import { CoNET_Data, setCoNET_Data } from '@/utils/globals'
import { motion, AnimatePresence } from "framer-motion"
import { ethers } from "ethers"
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf"
import { checkSign, emitReactionAsNewMessage, createMembershipActivatedCard, sendVoiceCallOffer } from '@/services/chat'
import { backfillChatMessagesToHistory, mirrorChatMessageToHistory } from '@/services/chatHistoryMirror'
import { IpfsImg } from '@/components/IpfsImg'
import {
  ArrowUp,
  ChevronLeft,
  Info,
  Phone,
  Video,
  CheckCheck,
  Plus,
  Mic,
  AlertTriangle,
  Camera,
  ImageIcon,
  Clock,
  BarChart3,
  Sticker,
  DollarSign,
  Gift,
  MoreHorizontal,
  Copy,
  Loader2,
  CheckCircle2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  ZoomIn,
  ZoomOut,
  Gauge,
  Check,
  FileText,
  ExternalLink,
  X,
  CornerUpLeft,
  Trash2,
  Paperclip
} from "lucide-react"
import { ChatHeaderIOS } from "./components/ChatHeaderIOS"
import BeamioContactProfilePreview from "@/components/Home/BeamioContactProfilePreview"
import { useScrollCapsuleOpacity } from "@/hooks/useScrollCapsuleOpacity"
import {
	initBeamioPGPKeys,
	regiestChatRoute,
	getKeysFromCoNETPGPSC,
	connectToGossipNode,
	sendMessage,
	makeMessage

} from '@/services/chat'
import {
	startWorkerVoiceListen,
	stopWorkerVoiceListen,
	sendWorkerVoiceFrame,
	onVoiceFrame,
} from '@/services/chatWorkerBridge'
import { PlusActionMenu } from "./components/PlusActionMenu"
import { useDaemonContext } from "@/providers/DaemonProvider"
import { searchUsername, storeSystemData, AuthorizationSign } from '@/services/beamio'
import { fiatPrefix } from '@/services/currency'
import { dispatchNativeSystemCallAction, getCashTreesNativeNfcBridge, openExternalUrl, requestNativeCameraCapture, saveFileToNative } from '@/utils/cashTreesNativeNfc'
import { MessageSendReceiveCard } from "./components/messageSendReceiveCard"
import { AaMultisigChatRequestCard } from '@/components/chat/AaMultisigChatRequestCard'
import { ChatShareLinkPreviewCard } from '@/components/chat/ChatShareLinkPreviewCard'
import { ChatGenericLinkPreviewCard } from '@/components/chat/ChatGenericLinkPreviewCard'
import { parseAaMultisigChatPreview } from '@/utils/aaMultisigChatPreview'
import {
	findBeamioShareUrlInText,
	isPrimarilyBeamioShareLinkMessage,
	resolveBeamioShareInAppNavigation,
} from '@/utils/chatShareLinkPreview'
import {
	findHttpUrlInText,
	isPrimarilyHttpUrlMessage,
} from '@/utils/chatGenericLinkPreview'
import { ingestAaMultisigFromChat } from '@/utils/aaMultisigIngest'
import { getAaMultisigTaskAny } from '@/utils/aaMultisigLocalStore'
import {
	formatMultisigSignatureProgress,
	multisigHistorySummary,
	multisigPendingSecondaryMessage,
	multisigTaskDeepLinkTab,
	viewerNeedsToSignMultisigTask,
} from '@/utils/aaMultisigTaskUi'
import type { AaMultisigChatPreview } from '@/utils/aaMultisigChatPreview'
import { tu } from '@/locale/beamioLocale'
import {
	decryptVoiceFragment,
	encryptVoiceBlob,
	uploadEncryptedVoiceDataUrl,
	VOICE_MAX_AUDIO_BYTES,
	type VoiceMessageManifest,
} from '@/utils/voiceMessage'
import {
	randomVoiceId,
	type VoiceCallSignal,
} from '@/utils/voiceCallSession'
import { startVoiceCapture, VoicePlaybackBuffer } from '@/services/voiceCallMedia'
import { createVoiceCallController, type VoiceCallController } from '@/services/voiceCallController'
import {
	createChatFileArchive,
	decryptChatFileManifest,
	encryptChatFiles,
	uploadEncryptedChatFileDataUrl,
	type ChatFileMessageManifest,
} from '@/utils/chatFileMessage'

const aptEndpoint = 'https://api.settleonbase.xyz'
const baseExplorerTxUrl = (hash: string) => `https://basescan.org/tx/${hash}`
GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || '/app'}/pdf.worker.min.js`

const REACTIONS = [
  { key: "love", label: "❤️" },
  { key: "like", label: "👍" },
  { key: "bad", label: "👎" },
  { key: "laugh", label: "😂" },
  { key: "exclamation", label: "❗️" },
  { key: "question", label: "❓" },
  { key: "sweat", label: "😅" },
  { key: "ok", label: "👌" },
] as const

type ReactionKey = typeof REACTIONS[number]["key"]

function formatVoiceDuration(durationMs: number): string {
	const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
	return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function formatVoiceBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = ''
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
	}
	return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
	return bytes
}

async function localFileManifestKey(privateKey: string, usage: KeyUsage[]): Promise<CryptoKey> {
	const keyMaterial = ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(privateKey)))
	return crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, usage)
}

async function encryptLocalFileManifest(manifest: ChatFileMessageManifest, privateKey: string): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const key = await localFileManifestKey(privateKey, ['encrypt'])
	const cipher = new Uint8Array(await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		new TextEncoder().encode(JSON.stringify(manifest)),
	))
	return `${bytesToBase64(iv)}.${bytesToBase64(cipher)}`
}

async function decryptLocalFileManifest(
	cipherText: string,
	privateKey: string,
): Promise<ChatFileMessageManifest | null> {
	try {
		const [ivB64, cipherB64] = cipherText.split('.')
		if (!ivB64 || !cipherB64) return null
		const key = await localFileManifestKey(privateKey, ['decrypt'])
		const plain = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: base64ToBytes(ivB64) },
			key,
			base64ToBytes(cipherB64),
		)
		return JSON.parse(new TextDecoder().decode(plain)) as ChatFileMessageManifest
	} catch {
		return null
	}
}

type ChatFileJob = {
	id: string
	files: File[]
	name: string
	progress: number
	status: 'uploading' | 'ready' | 'failed' | 'cancelled'
	error?: string
	manifest?: ChatFileMessageManifest
	thumbnailUrl?: string
}

const SKIP_DROP_FILE_NAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini'])

function isJunkDropFileName(name: string): boolean {
	const base = (name.split('/').pop() || name).trim()
	if (!base) return true
	const lower = base.toLowerCase()
	return SKIP_DROP_FILE_NAMES.has(lower) || base.startsWith('._')
}

function fileNameStem(name: string): string {
	const lastDot = name.lastIndexOf('.')
	return lastDot > 0 ? name.slice(0, lastDot) : name
}

const IMAGE_LIKE_FOLDER_EXT = /\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff?)$/i

function folderDisplayName(name: string): string {
	const trimmed = name.trim()
	if (!trimmed) return trimmed
	// Chrome/macOS type-sniffs a dropped folder as `folder.png`.
	return IMAGE_LIKE_FOLDER_EXT.test(trimmed) ? fileNameStem(trimmed) : trimmed
}

function isTopLevelDroppedFile(file: File): boolean {
	const name = file.name
	const stem = fileNameStem(name)
	const rel = (file.webkitRelativePath || '').replace(/\/+$/, '')
	return !rel || rel === name || rel === stem
}

function isNotFoundReadError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : ''
	return (error instanceof DOMException && error.name === 'NotFoundError')
		|| /could not be found at the time an operation was processed/i.test(message)
}

function markDroppedDirectoryName(directoryNames: Set<string>, name: string): void {
	const trimmed = name.trim()
	if (!trimmed) return
	directoryNames.add(trimmed)
	directoryNames.add(fileNameStem(trimmed))
}

function extraDirectoryNamesFromHint(hint?: string | null): Set<string> | undefined {
	if (!hint?.trim()) return undefined
	const names = new Set<string>()
	markDroppedDirectoryName(names, hint.trim())
	return names
}

function looksLikeDirectoryStub(file: File, directoryNames: Set<string>): boolean {
	if (!isTopLevelDroppedFile(file)) return false
	const name = file.name
	const stem = fileNameStem(name)
	if (directoryNames.has(name) || directoryNames.has(stem)) return true
	// Chrome/macOS type-sniffs a dropped folder as a 0-byte File, often
	// `folder.png` / image/png. The stub is not a real child.
	if (file.size === 0) return true
	return false
}

function cloneFileWithBytes(file: File, bytes: ArrayBuffer): File {
	const next = new File([bytes], file.name, { type: file.type, lastModified: file.lastModified })
	const rel = file.webkitRelativePath
	if (rel) Object.defineProperty(next, 'webkitRelativePath', { value: rel, configurable: true })
	return next
}

function folderNameFromDroppedFiles(files: File[]): string | null {
	const prefixes = new Set<string>()
	for (const file of files) {
		const rel = file.webkitRelativePath || ''
		if (!rel.includes('/')) continue
		const top = rel.split('/').find(Boolean)
		if (top) prefixes.add(top)
	}
	if (prefixes.size === 1) return folderDisplayName([...prefixes][0] || '') || null
	return null
}

function folderNameFromStubNames(stubNames: string[]): string | null {
	const stems = [...new Set(stubNames.map(name => folderDisplayName(name).trim()).filter(Boolean))]
	return stems.length === 1 ? stems[0] : null
}

function inferDroppedDirectoryNames(files: File[], extraNames?: Set<string>): Set<string> {
	const names = extraNames ? new Set(extraNames) : new Set<string>()
	for (const file of files) {
		const rel = file.webkitRelativePath || ''
		const top = rel.split('/').find(Boolean)
		if (top) names.add(top)
		if (isTopLevelDroppedFile(file) && file.size === 0) {
			names.add(file.name)
			names.add(fileNameStem(file.name))
		}
	}
	return names
}

function sanitizeDroppedChatFiles(files: File[], directoryNames?: Set<string>): File[] {
	const names = inferDroppedDirectoryNames(files, directoryNames)
	return files.filter(file => (
		!isJunkDropFileName(file.name)
		&& !isJunkDropFileName(file.webkitRelativePath || '')
		&& !looksLikeDirectoryStub(file, names)
	))
}

async function materializeDroppedChatFiles(
	files: File[],
	directoryNames?: Set<string>,
): Promise<{ files: File[]; stubNames: string[] }> {
	const names = inferDroppedDirectoryNames(files, directoryNames)
	const kept: File[] = []
	const stubNames: string[] = []
	for (const file of files) {
		if (looksLikeDirectoryStub(file, names)) {
			stubNames.push(file.name)
			continue
		}
		try {
			const bytes = await file.arrayBuffer()
			// Chrome folder stubs can report size > 0, then yield 0 readable bytes
			// without throwing. Keep those out of the composer file list.
			if (bytes.byteLength === 0 && isTopLevelDroppedFile(file) && files.length > 1) {
				stubNames.push(file.name)
				continue
			}
			kept.push(cloneFileWithBytes(file, bytes))
		} catch (error) {
			if (isNotFoundReadError(error)) {
				stubNames.push(file.name)
				continue
			}
			throw error
		}
	}
	return { files: kept, stubNames }
}

async function materializePickedChatFiles(files: File[]): Promise<File[]> {
	const output: File[] = []
	for (const file of files) {
		const bytes = await file.arrayBuffer()
		if (bytes.byteLength === 0) {
			throw new Error('The selected file is empty or unavailable. Please choose it again.')
		}
		output.push(cloneFileWithBytes(file, bytes))
	}
	return output
}

function resolveDropFolderHint(opts: {
	files: File[]
	stubNames: string[]
	directoryNames?: Set<string>
	singleItemManyFiles?: boolean
	firstDirectName?: string
}): string | null {
	const fromPaths = folderNameFromDroppedFiles(opts.files)
	if (fromPaths) return fromPaths
	const fromStubs = folderNameFromStubNames(opts.stubNames)
	if (fromStubs) return fromStubs
	if (opts.directoryNames && opts.directoryNames.size > 0) {
		const stems = [...new Set(
			[...opts.directoryNames].map(name => folderDisplayName(name).trim()).filter(Boolean),
		)]
		if (stems.length === 1) return stems[0]
	}
	if (opts.singleItemManyFiles && opts.firstDirectName) {
		return folderDisplayName(opts.firstDirectName) || null
	}
	return null
}

function chatFileBundleDisplayName(files: File[], folderHint?: string | null): string {
	const folder = folderDisplayName(folderHint || folderNameFromDroppedFiles(files) || '')
	if (folder) return folder
	if (files.length <= 1) return files[0]?.name || 'File'
	return `${files.length} files`
}

function chatFileReadErrorMessage(error: unknown): string {
	if (isNotFoundReadError(error)) return 'This folder could not be read. Drop the files inside it, or try again.'
	const message = error instanceof Error ? error.message : ''
	return message || 'Those files could not be added.'
}

async function createVideoThumbnail(videoFile: File): Promise<Blob> {
	const url = URL.createObjectURL(videoFile)
	try {
		const video = document.createElement('video')
		video.preload = 'metadata'
		video.muted = true
		video.src = url
		await new Promise<void>((resolve, reject) => {
			const timeout = window.setTimeout(() => reject(new Error('Video thumbnail timed out; continuing upload.')), 8_000)
			video.onloadeddata = () => {
				window.clearTimeout(timeout)
				resolve()
			}
			video.onerror = () => {
				window.clearTimeout(timeout)
				reject(new Error('Video thumbnail could not be created.'))
			}
		})
		video.currentTime = Math.min(0.1, Number.isFinite(video.duration) ? Math.max(0, video.duration / 10) : 0)
		await new Promise<void>(resolve => { video.onseeked = () => resolve(); window.setTimeout(resolve, 250) })
		const canvas = document.createElement('canvas')
		canvas.width = 512
		canvas.height = 288
		const context = canvas.getContext('2d')
		if (!context) throw new Error('Video thumbnail could not be created.')
		context.drawImage(video, 0, 0, canvas.width, canvas.height)
		return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Video thumbnail could not be created.')), 'image/jpeg', 0.82))
	} finally {
		URL.revokeObjectURL(url)
	}
}

async function readMediaDimensions(file: File): Promise<{ width: number; height: number } | undefined> {
	if (file.type.startsWith('image/')) {
		const url = URL.createObjectURL(file)
		try {
			const image = new Image()
			const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
				image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
				image.onerror = () => reject(new Error('Image dimensions could not be read.'))
				image.src = url
			})
			return dimensions.width > 0 && dimensions.height > 0 ? dimensions : undefined
		} finally {
			URL.revokeObjectURL(url)
		}
	}
	if (file.type.startsWith('video/')) {
		const url = URL.createObjectURL(file)
		try {
			const video = document.createElement('video')
			video.preload = 'metadata'
			video.src = url
			const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
				video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight })
				video.onerror = () => reject(new Error('Video dimensions could not be read.'))
			})
			return dimensions.width > 0 && dimensions.height > 0 ? dimensions : undefined
		} finally {
			URL.revokeObjectURL(url)
		}
	}
	return undefined
}

type DataTransferItemWithHandle = DataTransferItem & {
	getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>
}

type WalkableDirectoryHandle = FileSystemDirectoryHandle & {
	values(): AsyncIterableIterator<FileSystemHandle>
}

function snapshotFileSystemHandle(item: DataTransferItem): Promise<FileSystemHandle | null> {
	const withHandle = item as DataTransferItemWithHandle
	if (typeof withHandle.getAsFileSystemHandle !== 'function') return Promise.resolve(null)
	try {
		return Promise.resolve(withHandle.getAsFileSystemHandle()).catch(() => null)
	} catch {
		return Promise.resolve(null)
	}
}

/**
 * Collect files from a drop. Critical: call getAsFileSystemHandle() /
 * webkitGetAsEntry() / getAsFile() for EVERY item synchronously before any
 * await — browsers invalidate later items once the first async entry.file() runs.
 *
 * Chrome/macOS may report a folder named `rrrr.png` as a FILE (image/png).
 * FileSystemDirectoryHandle is the only reliable way to walk that folder.
 *
 * For plain multi-file drops (no folders), prefer the sync `dataTransfer.files`
 * list — it is the most reliable multi-file source across Chrome / Safari / Firefox.
 */
async function filesFromDropItems(items: DataTransferItemList): Promise<{
	files: File[]
	hasDirectory: boolean
	directoryNames: Set<string>
}> {
	const output: File[] = []
	type Snapshot =
		| { kind: 'entry'; entry: FileSystemEntry; handlePromise: Promise<FileSystemHandle | null> }
		| { kind: 'file'; file: File; handlePromise: Promise<FileSystemHandle | null> }
	const snapshots: Snapshot[] = []
	const directoryNames = new Set<string>()
	let hasDirectory = false
	for (let i = 0; i < items.length; i += 1) {
		const item = items[i]
		if (!item) continue
		const handlePromise = snapshotFileSystemHandle(item)
		const entry = typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null
		if (entry) {
			if (entry.isDirectory) {
				hasDirectory = true
				markDroppedDirectoryName(directoryNames, entry.name)
			}
			snapshots.push({ kind: 'entry', entry, handlePromise })
			continue
		}
		const file = item.getAsFile()
		if (file) snapshots.push({ kind: 'file', file, handlePromise })
	}

	const markImageNamedFolder = (name: string): void => {
		hasDirectory = true
		markDroppedDirectoryName(directoryNames, name)
	}

	const readDirectoryHandle = async (handle: FileSystemDirectoryHandle, prefix = ''): Promise<void> => {
		hasDirectory = true
		markDroppedDirectoryName(directoryNames, handle.name)
		try {
			const walker = handle as FileSystemDirectoryHandle & {
				values: () => AsyncIterableIterator<FileSystemHandle>
			}
			for await (const child of walker.values()) {
				if (child.kind === 'directory') {
					await readDirectoryHandle(child as FileSystemDirectoryHandle, `${prefix}${handle.name}/`)
					continue
				}
				if (child.kind !== 'file') continue
				try {
					const file = await (child as FileSystemFileHandle).getFile()
					if (isJunkDropFileName(file.name)) continue
					Object.defineProperty(file, 'webkitRelativePath', {
						value: `${prefix}${handle.name}/${file.name}`,
						configurable: true,
					})
					output.push(file)
				} catch {
					// Child vanished — skip that file only.
				}
			}
		} catch {
			// Directory listing failed — skip this folder, keep siblings.
		}
	}

	const treatUnreadableImageNamedAsFolder = async (name: string, file?: File): Promise<boolean> => {
		if (!IMAGE_LIKE_FOLDER_EXT.test(name)) return false
		if (file) {
			try {
				const bytes = await file.arrayBuffer()
				if (bytes.byteLength > 0) return false
			} catch (error) {
				if (!isNotFoundReadError(error)) return false
			}
		}
		markImageNamedFolder(name)
		return true
	}

	const readEntry = async (entry: FileSystemEntry, prefix = ''): Promise<void> => {
		if (entry.isFile) {
			try {
				const file = await new Promise<File>((resolve, reject) => {
					;(entry as FileSystemFileEntry).file(resolve, reject)
				})
				if (isJunkDropFileName(file.name)) return
				if (!prefix && await treatUnreadableImageNamedAsFolder(file.name, file)) return
				Object.defineProperty(file, 'webkitRelativePath', {
					value: `${prefix}${file.name}`,
					configurable: true,
				})
				output.push(file)
			} catch {
				if (!prefix && IMAGE_LIKE_FOLDER_EXT.test(entry.name)) markImageNamedFolder(entry.name)
			}
			return
		}
		if (entry.isDirectory) {
			markDroppedDirectoryName(directoryNames, entry.name)
			try {
				const reader = (entry as FileSystemDirectoryEntry).createReader()
				while (true) {
					const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
						reader.readEntries(resolve, reject)
					})
					if (!batch.length) break
					for (const child of batch) {
						await readEntry(child, `${prefix}${entry.name}/`)
					}
				}
			} catch {
				// Directory listing failed — skip this folder, keep siblings.
			}
		}
	}

	for (const snapshot of snapshots) {
		const handle = await snapshot.handlePromise
		if (handle?.kind === 'directory') {
			await readDirectoryHandle(handle as FileSystemDirectoryHandle)
			continue
		}
		if (handle?.kind === 'file') {
			try {
				const file = await (handle as FileSystemFileHandle).getFile()
				if (await treatUnreadableImageNamedAsFolder(file.name, file)) {
					if (snapshot.kind === 'entry') await readEntry(snapshot.entry)
					continue
				}
				if (isJunkDropFileName(file.name) || looksLikeDirectoryStub(file, directoryNames)) continue
				if (snapshot.kind === 'entry' && snapshot.entry.isDirectory) {
					await readEntry(snapshot.entry)
					continue
				}
				output.push(file)
			} catch {
				if (IMAGE_LIKE_FOLDER_EXT.test(handle.name)) {
					markImageNamedFolder(handle.name)
				} else if (snapshot.kind === 'entry') {
					await readEntry(snapshot.entry)
				}
			}
			continue
		}
		if (snapshot.kind === 'file') {
			if (!isJunkDropFileName(snapshot.file.name) && !looksLikeDirectoryStub(snapshot.file, directoryNames)) {
				if (await treatUnreadableImageNamedAsFolder(snapshot.file.name, snapshot.file)) continue
				output.push(snapshot.file)
			}
			continue
		}
		await readEntry(snapshot.entry)
	}
	return { files: output, hasDirectory, directoryNames }
}

async function filesFromDropTransfer(
	dataTransfer: DataTransfer,
	directFiles: File[] = Array.from(dataTransfer.files),
): Promise<{ files: File[]; folderHint: string | null }> {
	// Chrome invalidates FileList File objects after the first await in the
	// drop handler. Start arrayBuffer() in this same turn so a FileList
	// fallback stays readable if FileSystemDirectoryHandle walk fails.
	const eagerDirectReads = directFiles.map(file =>
		file.arrayBuffer()
			.then((bytes): { file: File; bytes: ArrayBuffer } => ({ file, bytes }))
			.catch((error: unknown): { file: File; error: unknown } => ({ file, error })),
	)
	const fromItems = await filesFromDropItems(dataTransfer.items)
	const directoryNames = inferDroppedDirectoryNames(directFiles, fromItems.directoryNames)
	const itemsHaveChildren = fromItems.files.some(file => (file.webkitRelativePath || '').includes('/'))
	const directLooksLikeFolder = fromItems.hasDirectory
		|| itemsHaveChildren
		|| directFiles.some(file => looksLikeDirectoryStub(file, directoryNames))
	let source: File[]
	if (directLooksLikeFolder) {
		if (fromItems.files.length > 0) {
			source = fromItems.files
		} else {
			const eagerly = await Promise.all(eagerDirectReads)
			const fromEager: File[] = []
			for (const result of eagerly) {
				if ('error' in result) {
					if (isNotFoundReadError(result.error) || looksLikeDirectoryStub(result.file, directoryNames)) {
						markDroppedDirectoryName(directoryNames, result.file.name)
						continue
					}
					throw result.error
				}
				if (result.bytes.byteLength === 0 && isTopLevelDroppedFile(result.file)) {
					markDroppedDirectoryName(directoryNames, result.file.name)
					continue
				}
				if (isJunkDropFileName(result.file.name) || looksLikeDirectoryStub(result.file, directoryNames)) continue
				fromEager.push(cloneFileWithBytes(result.file, result.bytes))
			}
			source = fromEager
		}
	} else {
		source = directFiles.length > 0 ? directFiles : fromItems.files
	}
	const seen = new Set<string>()
	const unique = sanitizeDroppedChatFiles(source, directoryNames).filter(file => {
		const key = `${file.name}:${file.size}:${file.lastModified}:${file.webkitRelativePath || ''}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
	const materialized = await materializeDroppedChatFiles(unique, directoryNames)
	const folderHint = resolveDropFolderHint({
		files: materialized.files,
		stubNames: materialized.stubNames,
		directoryNames,
		singleItemManyFiles: fromItems.hasDirectory || directLooksLikeFolder,
		firstDirectName: fromItems.hasDirectory
			? ([...fromItems.directoryNames][0] || [...directoryNames][0])
			: (directFiles[0]?.name),
	})
	return { files: materialized.files, folderHint }
}

function voiceWaveformPath(samples: number[]): string {
	if (samples.length === 0) return 'M 0 16 L 240 16'
	const upper = samples.map((sample, index) => {
		const x = (index / Math.max(1, samples.length - 1)) * 240
		const amplitude = Math.max(1.5, Math.min(14, sample * 14))
		return `${x.toFixed(2)} ${(16 - amplitude).toFixed(2)}`
	})
	const lower = [...samples].reverse().map((sample, reverseIndex) => {
		const index = samples.length - 1 - reverseIndex
		const x = (index / Math.max(1, samples.length - 1)) * 240
		const amplitude = Math.max(1.5, Math.min(14, sample * 14))
		return `${x.toFixed(2)} ${(16 + amplitude).toFixed(2)}`
	})
	return `M ${upper.join(' L ')} L ${lower.join(' L ')} Z`
}

function VoiceMessagePlayer({ manifest, isMe }: { manifest: VoiceMessageManifest; isMe: boolean }) {
	const [url, setUrl] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [playing, setPlaying] = useState(false)
	const [volume, setVolume] = useState(1)
	const [volumeOpen, setVolumeOpen] = useState(false)
	const [menuOpen, setMenuOpen] = useState(false)
	const [playbackRate, setPlaybackRate] = useState(1)
	const audioRef = useRef<HTMLAudioElement | null>(null)
	const voiceControlsRef = useRef<HTMLDivElement | null>(null)
	useEffect(() => {
		let cancelled = false
		setUrl(null)
		setError(null)
		setLoading(true)
		void decryptVoiceFragment(manifest)
			.then(blob => {
				if (cancelled) return
				setUrl(URL.createObjectURL(blob))
			})
			.catch(() => {
				if (!cancelled) setError('Voice message is unavailable')
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
			setPlaying(false)
			setUrl(previous => {
				if (previous) URL.revokeObjectURL(previous)
				return null
			})
		}
	}, [manifest])
	useEffect(() => {
		const audio = audioRef.current
		if (!audio) return
		audio.volume = volume
		audio.playbackRate = playbackRate
	}, [volume, playbackRate, url])
	useEffect(() => {
		if (!volumeOpen) return
		const timer = window.setTimeout(() => setVolumeOpen(false), 3000)
		return () => window.clearTimeout(timer)
	}, [volumeOpen, volume])
	useEffect(() => {
		if (!volumeOpen && !menuOpen) return
		const closeOnOutsideAction = (event: PointerEvent) => {
			const target = event.target
			if (target instanceof Node && voiceControlsRef.current?.contains(target)) return
			setVolumeOpen(false)
			setMenuOpen(false)
		}
		document.addEventListener('pointerdown', closeOnOutsideAction, true)
		return () => document.removeEventListener('pointerdown', closeOnOutsideAction, true)
	}, [menuOpen, volumeOpen])

	const togglePlayback = () => {
		const audio = audioRef.current
		if (!audio || !url) return
		if (audio.paused) {
			void audio.play().then(() => setPlaying(true)).catch(() => setError('Voice message could not be played.'))
		} else {
			audio.pause()
			setPlaying(false)
		}
	}

	const downloadVoice = () => {
		if (!url) return
		const anchor = document.createElement('a')
		anchor.href = url
		anchor.download = `voice-message-${manifest.durationMs}.webm`
		anchor.click()
		setMenuOpen(false)
	}

	return (
		<div ref={voiceControlsRef} className="relative min-w-[230px] text-slate-900">
			{loading ? <div className="text-[13px] text-slate-500">Preparing voice message…</div> : null}
			{error ? <div role="alert" className="text-[13px] text-rose-600">{error}</div> : null}
			{url ? (
				<div
					className={[
						'flex items-center gap-1.5 rounded-full p-1.5 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_20px_rgba(15,23,42,0.08)] ring-1 ring-white/70',
						isMe ? 'bg-[#dceaff]/45' : 'bg-white/45',
					].join(' ')}
				>
					<audio
						ref={audioRef}
						preload="metadata"
						src={url}
						className="hidden"
						onEnded={() => setPlaying(false)}
					/>
					<button
						type="button"
						onClick={togglePlayback}
						aria-label={playing ? 'Pause voice message' : 'Play voice message'}
						className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/55 text-[#424655]/85 shadow-[0_2px_8px_rgba(15,23,42,0.12)] ring-1 ring-white/80 backdrop-blur-md transition active:scale-95"
					>
						{playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
					</button>
					<span className="min-w-0 flex-1 text-center text-[13px] font-semibold text-[#424655]/80">
						{formatVoiceDuration(manifest.durationMs)}
					</span>
					<div className="relative">
						<button
							type="button"
							onClick={() => {
								setVolumeOpen(previous => !previous)
								setMenuOpen(false)
							}}
							aria-label="Adjust volume"
							className="grid h-9 w-9 place-items-center rounded-full text-[#424655]/80 transition hover:bg-white/35 active:scale-95"
						>
							{volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
						</button>
						{volumeOpen ? (
							<div className="absolute bottom-full right-0 z-20 mb-2 flex h-28 w-10 items-center justify-center rounded-2xl bg-white p-1 shadow-xl ring-1 ring-black/10">
								<input
									type="range"
									min={0}
									max={1}
									step={0.01}
									value={volume}
									onChange={event => setVolume(Number(event.target.value))}
									className="h-20 w-4 accent-[#1652f0] [writing-mode:vertical-lr] [direction:rtl]"
									aria-label={`Volume ${Math.round(volume * 100)} percent`}
								/>
							</div>
						) : null}
					</div>
					<div className="relative">
						<button
							type="button"
							onClick={() => {
								setMenuOpen(previous => !previous)
								setVolumeOpen(false)
							}}
							aria-label="Voice message options"
							className="grid h-9 w-9 place-items-center rounded-full text-[#424655]/80 transition hover:bg-white/35 active:scale-95"
						>
							<Gauge className="h-4 w-4" />
						</button>
						{menuOpen ? (
							<div className="absolute bottom-full right-0 z-20 mb-2 w-36 rounded-2xl bg-white p-1.5 shadow-xl ring-1 ring-black/10">
								<button type="button" onClick={downloadVoice} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100">
									<Download className="h-3.5 w-3.5" /> Download
								</button>
								<p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Playback speed</p>
								{[1, 1.5, 2].map(rate => (
									<button
										key={rate}
										type="button"
										onClick={() => {
											setPlaybackRate(rate)
											setMenuOpen(false)
										}}
										className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 ${playbackRate === rate ? 'text-[#1652f0]' : 'text-slate-700'}`}
									>
										<span>{rate}x</span>
										{playbackRate === rate ? <Check className="h-3.5 w-3.5" /> : null}
									</button>
								))}
							</div>
						) : null}
					</div>
				</div>
			) : null}
		</div>
	)
}

const CHAT_IMAGE_PREVIEW_MIN_SCALE = 1
const CHAT_IMAGE_PREVIEW_MAX_SCALE = 5

function touchPairDistance(touches: TouchList | React.TouchList): number {
	if (touches.length < 2) return 0
	const dx = touches[0].clientX - touches[1].clientX
	const dy = touches[0].clientY - touches[1].clientY
	return Math.hypot(dx, dy)
}

function ChatImageFullscreenPreview({
	src,
	onClose,
	onDownload,
	canDownload,
}: {
	src: string
	onClose: () => void
	onDownload: () => void
	canDownload: boolean
}) {
	const [scale, setScale] = useState(1)
	const [pan, setPan] = useState({ x: 0, y: 0 })
	const viewportRef = useRef<HTMLDivElement>(null)
	const pinchRef = useRef<{ dist: number; scale: number } | null>(null)
	const panDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null)

	const clampScale = useCallback((value: number) => clamp(value, CHAT_IMAGE_PREVIEW_MIN_SCALE, CHAT_IMAGE_PREVIEW_MAX_SCALE), [])

	const setScaleClamped = useCallback(
		(next: number | ((prev: number) => number)) => {
			setScale(prev => {
				const raw = typeof next === 'function' ? next(prev) : next
				const s = clampScale(raw)
				if (s <= 1) setPan({ x: 0, y: 0 })
				return s
			})
		},
		[clampScale]
	)

	useEffect(() => {
		const el = viewportRef.current
		if (!el) return
		const onWheel = (event: WheelEvent) => {
			event.preventDefault()
			const delta = event.deltaY > 0 ? -0.12 : 0.12
			setScaleClamped(prev => prev + delta)
		}
		el.addEventListener('wheel', onWheel, { passive: false })
		return () => el.removeEventListener('wheel', onWheel)
	}, [setScaleClamped])

	const zoomIn = () => setScaleClamped(prev => prev + 0.35)
	const zoomOut = () => setScaleClamped(prev => prev - 0.35)

	const onTouchStart = (event: React.TouchEvent) => {
		if (event.touches.length === 2) {
			pinchRef.current = { dist: touchPairDistance(event.touches), scale }
			panDragRef.current = null
			return
		}
		if (event.touches.length === 1 && scale > 1) {
			panDragRef.current = {
				startX: event.touches[0].clientX,
				startY: event.touches[0].clientY,
				panX: pan.x,
				panY: pan.y,
			}
		}
	}

	const onTouchMove = (event: React.TouchEvent) => {
		if (event.touches.length === 2 && pinchRef.current) {
			event.preventDefault()
			const dist = touchPairDistance(event.touches)
			if (pinchRef.current.dist <= 0) return
			const ratio = dist / pinchRef.current.dist
			const base = pinchRef.current.scale
			setScaleClamped(base * ratio)
			return
		}
		if (event.touches.length === 1 && panDragRef.current && scale > 1) {
			event.preventDefault()
			const dx = event.touches[0].clientX - panDragRef.current.startX
			const dy = event.touches[0].clientY - panDragRef.current.startY
			setPan({ x: panDragRef.current.panX + dx, y: panDragRef.current.panY + dy })
		}
	}

	const endPanOrPinch = () => {
		pinchRef.current = null
		panDragRef.current = null
	}

	const onMouseDown = (event: React.MouseEvent) => {
		if (scale <= 1 || event.button !== 0) return
		panDragRef.current = {
			startX: event.clientX,
			startY: event.clientY,
			panX: pan.x,
			panY: pan.y,
		}
	}

	const onMouseMove = (event: React.MouseEvent) => {
		if (!panDragRef.current || scale <= 1) return
		const dx = event.clientX - panDragRef.current.startX
		const dy = event.clientY - panDragRef.current.startY
		setPan({ x: panDragRef.current.panX + dx, y: panDragRef.current.panY + dy })
	}

	const chromeBtn =
		'pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/35 bg-white/20 text-white/90 shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-white/30 disabled:opacity-40'

	return (
		<div
			className="fixed inset-0 z-[120] flex flex-col bg-black/95"
			role="dialog"
			aria-modal="true"
			aria-label="Image preview"
		>
			<div
				className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-center justify-between gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top,0px))]"
			>
				<button type="button" tabIndex={-1} onClick={onClose} aria-label="Back" className={chromeBtn}>
					<ChevronLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden />
				</button>
				<div className="pointer-events-auto flex items-center gap-2">
					<button
						type="button"
						tabIndex={-1}
						onClick={zoomOut}
						disabled={scale <= CHAT_IMAGE_PREVIEW_MIN_SCALE}
						aria-label="Zoom out"
						className={chromeBtn}
					>
						<ZoomOut className="h-5 w-5" aria-hidden />
					</button>
					<button
						type="button"
						tabIndex={-1}
						onClick={zoomIn}
						disabled={scale >= CHAT_IMAGE_PREVIEW_MAX_SCALE}
						aria-label="Zoom in"
						className={chromeBtn}
					>
						<ZoomIn className="h-5 w-5" aria-hidden />
					</button>
				</div>
				{canDownload ? (
					<button type="button" tabIndex={-1} onClick={onDownload} aria-label="Download image" className={chromeBtn}>
						<Download className="h-5 w-5" aria-hidden />
					</button>
				) : (
					<span className="h-11 w-11 shrink-0" aria-hidden />
				)}
			</div>
			<div
				ref={viewportRef}
				className="min-h-0 flex-1 touch-none overflow-hidden pt-[calc(max(1rem,env(safe-area-inset-top,0px))+3.25rem)] pb-[env(safe-area-inset-bottom,0px)]"
				onTouchStart={onTouchStart}
				onTouchMove={onTouchMove}
				onTouchEnd={endPanOrPinch}
				onTouchCancel={endPanOrPinch}
				onMouseDown={onMouseDown}
				onMouseMove={onMouseMove}
				onMouseUp={endPanOrPinch}
				onMouseLeave={endPanOrPinch}
			>
				<div className="flex h-full w-full items-center justify-center px-2">
					<img
						src={src}
						alt=""
						draggable={false}
						onDoubleClick={() => setScaleClamped(prev => (prev > 1 ? 1 : 2.5))}
						className="max-h-full max-w-full select-none object-contain"
						style={{
							transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
							transformOrigin: 'center center',
							cursor: scale > 1 ? 'grab' : 'zoom-in',
						}}
					/>
				</div>
			</div>
		</div>
	)
}

function ChatPdfFullscreenPreview({
	src,
	onClose,
	onDownload,
}: {
	src: Blob
	onClose: () => void
	onDownload: () => void
}) {
	const [pageCount, setPageCount] = useState(0)
	const [error, setError] = useState<string | null>(null)
	const [fallbackUrl, setFallbackUrl] = useState<string | null>(null)
	const pdfRef = useRef<any>(null)
	const canvasRefs = useRef<HTMLCanvasElement[]>([])
	const pagesRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		const url = URL.createObjectURL(src)
		setFallbackUrl(url)
		return () => {
			URL.revokeObjectURL(url)
			setFallbackUrl(null)
		}
	}, [src])

	useEffect(() => {
		let cancelled = false
		setPageCount(0)
		setError(null)
		canvasRefs.current = []
		void (async () => {
			try {
				const data = new Uint8Array(await src.arrayBuffer())
				const pdf = await getDocument({ data } as any).promise
				if (cancelled) {
					await pdf.destroy()
					return
				}
				pdfRef.current = pdf
				setPageCount(pdf.numPages)
			} catch (reason) {
				if (!cancelled) setError(reason instanceof Error ? reason.message : 'PDF could not be opened.')
			}
		})()
		return () => {
			cancelled = true
			const pdf = pdfRef.current
			pdfRef.current = null
			if (pdf) void pdf.destroy()
		}
	}, [src])

	useEffect(() => {
		const pdf = pdfRef.current
		const container = pagesRef.current
		if (!pdf || !container || !pageCount) return
		let cancelled = false
		void (async () => {
			try {
				for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
					if (cancelled) return
					const canvas = canvasRefs.current[pageNumber - 1]
					if (!canvas) continue
					const page = await pdf.getPage(pageNumber)
					const baseViewport = page.getViewport({ scale: 1 })
					const availableWidth = Math.max(280, container.clientWidth - 24)
					const scale = Math.min(1.6, availableWidth / baseViewport.width)
					const viewport = page.getViewport({ scale })
					const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
					canvas.width = Math.ceil(viewport.width * pixelRatio)
					canvas.height = Math.ceil(viewport.height * pixelRatio)
					canvas.style.width = `${viewport.width}px`
					canvas.style.height = `${viewport.height}px`
					const context = canvas.getContext('2d')
					if (!context) continue
					context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
					await page.render({ canvasContext: context, viewport }).promise
				}
			} catch (reason) {
				if (!cancelled) setError(reason instanceof Error ? reason.message : 'PDF page could not be rendered.')
			}
		})()
		return () => { cancelled = true }
	}, [pageCount])

	const chromeBtn =
		'pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-white/35 bg-white/20 text-white/90 shadow-[0_2px_10px_rgba(0,0,0,0.35)] backdrop-blur-md transition hover:bg-white/30'

	return (
		<div className="fixed inset-0 z-[120] flex flex-col bg-slate-950/95" role="dialog" aria-modal="true" aria-label="PDF preview">
			<div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-center justify-between gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top,0px))]">
				<button type="button" tabIndex={-1} onClick={onClose} aria-label="Back" className={chromeBtn}>
					<ChevronLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden />
				</button>
				<button type="button" tabIndex={-1} onClick={onDownload} aria-label="Download PDF" className={chromeBtn}>
					<Download className="h-5 w-5" aria-hidden />
				</button>
			</div>
			<div ref={pagesRef} className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto px-2 pb-[env(safe-area-inset-bottom,0px)] pt-[calc(max(1rem,env(safe-area-inset-top,0px))+3.25rem)]">
				<div className="mx-auto flex min-h-full w-full min-w-0 max-w-3xl flex-col items-center gap-3 rounded-xl bg-slate-700/50 py-3 shadow-2xl">
					{Array.from({ length: pageCount }, (_, index) => (
						<canvas
							key={index}
							ref={canvas => { if (canvas) canvasRefs.current[index] = canvas }}
							className="block h-auto max-w-full bg-white shadow-md"
							aria-label={`PDF page ${index + 1}`}
						/>
					))}
					{!error && !pageCount ? <Loader2 className="my-10 h-6 w-6 animate-spin text-white/75" aria-label="Loading PDF" /> : null}
					{error && fallbackUrl ? (
						<iframe
							src={fallbackUrl}
							title="PDF preview"
							className="h-[calc(100dvh-8rem)] w-full min-w-0 bg-white"
						/>
					) : null}
					{error && !fallbackUrl ? <div role="alert" className="m-4 rounded-xl bg-rose-950/70 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
				</div>
			</div>
		</div>
	)
}

function ChatFileMessagePlayer({ manifest, isMe }: { manifest: ChatFileMessageManifest; isMe: boolean }) {
	const [files, setFiles] = useState<Map<string, Blob> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [playing, setPlaying] = useState(false)
	const [videoUrl, setVideoUrl] = useState<string | null>(null)
	const [previewUrl, setPreviewUrl] = useState<string | null>(null)
	const [fullImageUrl, setFullImageUrl] = useState<string | null>(null)
	const [pdfUrl, setPdfUrl] = useState<string | null>(null)
	const [imageFullscreen, setImageFullscreen] = useState(false)
	const [pdfFullscreen, setPdfFullscreen] = useState(false)
	const videoRef = useRef<HTMLVideoElement | null>(null)
	const [videoBlob, setVideoBlob] = useState<Blob | null>(null)
	const [imageBlob, setImageBlob] = useState<Blob | null>(null)
	const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
	const [archiveBlob, setArchiveBlob] = useState<Blob | null>(null)
	const previewBlob = files && manifest.previewName ? files.get(manifest.previewName) ?? null : null
	const downloadImageBlob = imageBlob ?? previewBlob
	useEffect(() => {
		const controller = new AbortController()
		setLoading(true)
		setError(null)
		setFiles(null)
		setVideoUrl(null)
		setPreviewUrl(null)
		setFullImageUrl(null)
		setPdfUrl(null)
		setVideoBlob(null)
		setImageBlob(null)
		setPdfBlob(null)
		setArchiveBlob(null)
		setImageFullscreen(false)
		setPdfFullscreen(false)
		void decryptChatFileManifest(manifest, controller.signal)
			.then(result => {
				setFiles(result)
				if (manifest.isArchive) {
					void createChatFileArchive(result, manifest)
						.then(setArchiveBlob)
						.catch(() => setError('ZIP bundle could not be prepared.'))
				}
				if (manifest.mediaKind === 'video' || manifest.mediaKind === 'image' || manifest.mediaKind === 'pdf') {
					const mainEntryName = manifest.files[0]?.name
					const mainBlob = mainEntryName ? result.get(mainEntryName) : undefined
					const videoEntry = Array.from(result.entries()).find(([name]) => name !== manifest.previewName)?.[1]
					const preview = manifest.previewName ? result.get(manifest.previewName) : undefined
					if (manifest.mediaKind === 'video' && videoEntry) {
						setVideoBlob(videoEntry)
						setVideoUrl(URL.createObjectURL(videoEntry))
					}
					if (manifest.mediaKind === 'image') {
						const fullImage = mainBlob ?? videoEntry
						if (fullImage) {
							setImageBlob(fullImage)
							setFullImageUrl(URL.createObjectURL(fullImage))
						}
						const thumbSource = preview ?? fullImage
						if (thumbSource) setPreviewUrl(URL.createObjectURL(thumbSource))
					} else if (preview) {
						setPreviewUrl(URL.createObjectURL(preview))
					}
					if (manifest.mediaKind === 'pdf' && mainBlob) {
						setPdfBlob(mainBlob)
						setPdfUrl(URL.createObjectURL(mainBlob))
					}
				}
			})
			.catch(error => {
				if (error?.name !== 'AbortError') setError(error instanceof Error ? error.message : 'File attachment is unavailable.')
			})
			.finally(() => setLoading(false))
		return () => {
			controller.abort()
			setVideoUrl(previous => { if (previous) URL.revokeObjectURL(previous); return null })
			setPreviewUrl(previous => { if (previous) URL.revokeObjectURL(previous); return null })
			setFullImageUrl(previous => { if (previous) URL.revokeObjectURL(previous); return null })
			setPdfUrl(previous => { if (previous) URL.revokeObjectURL(previous); return null })
		}
	}, [manifest])
	const download = async (name: string, blob: Blob) => {
		const url = URL.createObjectURL(blob)
		const native = getCashTreesNativeNfcBridge()
		if (typeof native?.saveFile === 'function') {
			const dataUrl = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader()
				reader.onload = () => resolve(String(reader.result || ''))
				reader.onerror = () => reject(reader.error || new Error('File could not be prepared.'))
				reader.readAsDataURL(blob)
			})
			try {
				const saved = saveFileToNative({
					dataUrl,
					filename: name.split('/').pop() || 'download',
					mimeType: blob.type || 'application/octet-stream',
					requestId: crypto.randomUUID(),
				})
				if (saved) {
					URL.revokeObjectURL(url)
					return
				}
			} catch {
				// Fall back to the browser download path.
			}
		}
		const anchor = document.createElement('a')
		anchor.href = url
		anchor.download = name.split('/').pop() || 'download'
		anchor.click()
		window.setTimeout(() => URL.revokeObjectURL(url), 0)
	}
	const isImageMessage = manifest.mediaKind === 'image'
	const isPdfMessage = manifest.mediaKind === 'pdf'
	const mediaAspectRatio =
		manifest.width && manifest.height && manifest.width > 0 && manifest.height > 0
			? `${manifest.width} / ${manifest.height}`
			: '4 / 3'
	return (
		<div
			className={[
				isPdfMessage
					? 'min-w-0 bg-transparent p-0 ring-0'
					: isImageMessage
					? 'max-w-[min(78vw,280px)] overflow-hidden rounded-2xl p-0 ring-1 ring-black/5'
					: 'min-w-[220px] rounded-2xl px-3 py-2 ring-1 ring-black/5',
				isPdfMessage ? '' : isMe ? 'bg-[#dceaff]/70' : 'bg-white/70',
			].join(' ')}
		>
			{manifest.mediaKind === 'video' ? (
				<div className="relative mb-2 w-full overflow-hidden rounded-xl bg-slate-900" style={{ aspectRatio: mediaAspectRatio }}>
					{videoUrl ? <video ref={videoRef} src={videoUrl} className="absolute inset-0 block h-full w-full object-contain" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} controls={false} /> : <div className="absolute inset-0 animate-pulse bg-slate-800/70" aria-hidden />}
					{previewUrl ? <img src={previewUrl} alt="Video thumbnail" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: playing ? 0 : 1 }} /> : null}
					{videoUrl && !playing ? (
						<button type="button" onClick={() => {
							const video = videoRef.current
							if (!video) return
							void video.play().catch(() => setError('Video could not be played.'))
						}} aria-label="Play video" className="absolute inset-0 grid place-items-center">
							<span className="grid h-12 w-12 place-items-center rounded-full bg-black/60 text-white shadow-lg"><Play className="ml-1 h-6 w-6 fill-current" /></span>
						</button>
					) : null}
				</div>
			) : null}
			{isPdfMessage ? (
				<button
					type="button"
					disabled={!pdfUrl}
					onClick={() => setPdfFullscreen(true)}
					className={[
						'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition disabled:cursor-wait',
						isMe ? 'bg-[#dceaff]/70 hover:bg-[#dceaff]' : 'bg-white/70 hover:bg-white',
					].join(' ')}
					aria-label="Open PDF fullscreen"
				>
					<span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-600" aria-hidden>
						<FileText className="h-5 w-5" />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block truncate text-[13px] font-semibold text-slate-700">{manifest.name}</span>
						<span className="mt-0.5 block text-[11px] font-medium text-slate-500">PDF · Tap to preview</span>
					</span>
					<span className="text-[11px] font-semibold text-[#1652f0]">Open</span>
				</button>
			) : manifest.mediaKind === 'image' ? (
				<button
					type="button"
					disabled={!previewUrl}
					onClick={() => setImageFullscreen(true)}
					className="block w-full text-left disabled:cursor-wait"
					aria-label="Open image fullscreen"
				>
					{previewUrl ? (
						<img src={previewUrl} alt="" className="block h-full w-full object-cover" style={{ aspectRatio: mediaAspectRatio }} />
					) : (
						<div className="min-w-[200px] animate-pulse bg-slate-200/80" style={{ aspectRatio: mediaAspectRatio }} aria-hidden />
					)}
				</button>
			) : manifest.mediaKind === 'video' ? (
				<div className="flex items-center justify-end gap-2 px-3 py-2 text-[12px] font-semibold text-slate-700">
					<span>{manifest.count} file{manifest.count === 1 ? '' : 's'} · {formatVoiceBytes(manifest.sizeBytes)}</span>
					{videoBlob ? (
						<button
							type="button"
							onClick={() => download(manifest.name, videoBlob)}
							aria-label="Download video"
							className="grid h-7 w-7 place-items-center rounded-full text-[#1652f0] transition hover:bg-[#1652f0]/10"
						>
							<Download className="h-4 w-4" aria-hidden />
						</button>
					) : null}
				</div>
			) : (
				<div className="text-[12px] font-semibold text-slate-700">{manifest.count} file{manifest.count === 1 ? '' : 's'} · {formatVoiceBytes(manifest.sizeBytes)}</div>
			)}
			{loading && !isImageMessage ? <div className="mt-1 text-[12px] text-slate-500">Preparing files…</div> : null}
			{error ? (
				<div role="alert" className={isImageMessage ? 'px-3 py-2 text-[12px] text-rose-600' : 'mt-1 text-[12px] text-rose-600'}>
					{error}
				</div>
			) : null}
			{manifest.isArchive ? (
				<div className="mt-1 flex items-center justify-between gap-2 text-[12px] font-semibold text-slate-700">
					<span>{manifest.count} files · ZIP bundle · {formatVoiceBytes(manifest.sizeBytes)}</span>
					{archiveBlob ? (
						<button
							type="button"
							onClick={() => void download(manifest.archiveName || 'Files.zip', archiveBlob)}
							aria-label="Download ZIP bundle"
							className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#1652f0] transition hover:bg-[#1652f0]/10"
						>
							<Download className="h-4 w-4" aria-hidden />
						</button>
					) : <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Preparing ZIP bundle" />}
				</div>
			) : files && !manifest.mediaKind ? <div className="mt-1 space-y-1">{Array.from(files.entries()).map(([name, blob]) => (
				name === manifest.previewName ? null :
				<div key={name} className="flex items-center gap-2 text-[12px]">
					<span className="min-w-0 flex-1 truncate text-slate-600">{name}</span>
					<button
						type="button"
						onClick={() => download(name, blob)}
						aria-label={`Download ${name}`}
						title="Download file"
						className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#1652f0] transition hover:bg-[#1652f0]/10"
					>
						<Download className="h-4 w-4" aria-hidden />
					</button>
				</div>
			))}</div> : null}
			{manifest.mediaKind === 'image' && imageFullscreen && (fullImageUrl || previewUrl) ? (
				<ChatImageFullscreenPreview
					src={fullImageUrl ?? previewUrl ?? ''}
					onClose={() => setImageFullscreen(false)}
					canDownload={Boolean(downloadImageBlob)}
					onDownload={() => void download(manifest.files[0]?.name ?? manifest.name, downloadImageBlob!)}
				/>
			) : null}
			{isPdfMessage && pdfFullscreen && pdfBlob ? (
				<ChatPdfFullscreenPreview
					src={pdfBlob}
					onClose={() => setPdfFullscreen(false)}
					onDownload={() => { if (pdfBlob) void download(manifest.name, pdfBlob) }}
				/>
			) : null}
		</div>
	)
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

const getImg = (avatarSeed: string) =>
	`https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`

function enrichMultisigChatPreview(
	preview: AaMultisigChatPreview,
	stored: NonNullable<ReturnType<typeof getAaMultisigTaskAny>>,
	viewerEoa: string
): AaMultisigChatPreview {
	const historySummary = multisigHistorySummary(stored)
	const needsSign = viewerNeedsToSignMultisigTask(stored, viewerEoa)
	const waitingLine = multisigPendingSecondaryMessage(stored, viewerEoa)
	const progressLabel =
		stored.status === 'expired'
			? 'Expired — create a new request'
			: stored.status === 'completed'
				? 'Completed'
				: formatMultisigSignatureProgress(stored)

	let ctaLabel = preview.ctaLabel
	if (stored.status === 'completed' || stored.status === 'expired') ctaLabel = 'View in history'
	else if (stored.status === 'ready') ctaLabel = 'Submit transfer'
	else if (needsSign) ctaLabel = 'Review & sign'
	else ctaLabel = 'View progress'

	return {
		...preview,
		threshold: stored.threshold,
		signatureCount: stored.signatures.length,
		progressLabel,
		statusLine:
			historySummary ??
			(stored.status === 'ready'
				? 'All signatures collected — ready to submit'
				: needsSign
					? progressLabel
					: waitingLine ?? progressLabel),
		ctaLabel,
	}
}

const unknowAcc = (address: string):searchResult => {
	const ret: searchResult = {
		address,
		created_at: 0,
		first_name: '',
		last_name: '',
		follow_count: '',
		follower_count: '',
		username: '未知',
		image: ''
	}
	return ret
}


type ChatSection = {
	key: string
	title: string
	kind: "day" | "month" | "year"
	items: ChatMessage[]
  }
  
  function startOfDay(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  
  function dayDiff(today0: Date, d0: Date) {
	return Math.floor((today0.getTime() - d0.getTime()) / 86_400_000)
  }
  
  function fmtMonthYear(d: Date) {
	return d.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()
  }
  
  function fmtWeekday(d: Date) {
	return d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()
  }
  
  function getMsgTs(m: ChatMessage) {
	const ts = Number(m?.paymentCard?.timeStamp || m?.createdAt || 0)
	return isFinite(ts) ? ts : 0
  }

  function formatTimeLabel(ts: number): string {
	const t = typeof ts === "number" && ts > 0 && ts < 1e12 ? ts * 1000 : ts
	const d = new Date(t)
	if (!isFinite(d.getTime())) return tu('just_now')
	const now = Date.now()
	if (now - t < 60 * 1000) return tu('just_now')
	const h = d.getHours()
	const m = d.getMinutes()
	const ampm = h >= 12 ? "p.m." : "a.m."
	const h12 = h % 12 || 12
	return `${h12}:${String(m).padStart(2, "0")} ${ampm}`
  }
  
  function groupChatMessages(items: ChatMessage[], now = new Date()): ChatSection[] {
	const today0 = startOfDay(now)
	const currentYear = now.getFullYear()
  
	// ✅ Chat 建议升序显示（旧 -> 新），但分组标题从旧到新/新到旧都可以
	// 这里用升序，配合你 UI 最底部显示更自然
	const sorted = [...items].sort((a, b) => getMsgTs(a) - getMsgTs(b))
  
	const map = new Map<string, ChatSection>()
  
	for (const m of sorted) {
	  const ts = getMsgTs(m)
	  const d = new Date(ts)
	  const d0 = startOfDay(d)
	  const diff = dayDiff(today0, d0)
  
	  // 1) 一周内：按天
	  if (diff >= 0 && diff <= 6) {
		let title = fmtWeekday(d0)
		if (diff === 0) title = "TODAY"
		if (diff === 1) title = "YESTERDAY"
  
		const key = `day:${d0.getFullYear()}-${d0.getMonth()}-${d0.getDate()}`
		let sec = map.get(key)
		if (!sec) {
		  sec = { key, title, kind: "day", items: [] }
		  map.set(key, sec)
		}
		sec.items.push(m)
		continue
	  }
  
	  // 2) 超过一周：今年内按月
	  if (d.getFullYear() === currentYear) {
		const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
		const key = `month:${ym}`
		const title = fmtMonthYear(new Date(d.getFullYear(), d.getMonth(), 1))
  
		let sec = map.get(key)
		if (!sec) {
		  sec = { key, title, kind: "month", items: [] }
		  map.set(key, sec)
		}
		sec.items.push(m)
		continue
	  }
  
	  // 3) 跨年：按年
	  {
		const y = String(d.getFullYear())
		const key = `year:${y}`
		const title = y
  
		let sec = map.get(key)
		if (!sec) {
		  sec = { key, title, kind: "year", items: [] }
		  map.set(key, sec)
		}
		sec.items.push(m)
	  }
	}
  
	// ✅ sections 顺序：跟你显示方向一致
	// 这里用 “按最早消息时间升序” 排（老分组在上，新分组在下）
	const sections = Array.from(map.values())
	sections.sort((a, b) => (getMsgTs(a.items[0]) || 0) - (getMsgTs(b.items[0]) || 0))
	return sections
  }
  
  function ChatSectionHeader({ title }: { title: string }) {
	return (
	  <div className="px-1 pt-3 pb-2">
		<div className="text-[11px] tracking-[0.22em] font-extrabold text-slate-300 text-center">
		  {title}
		</div>
	  </div>
	)
  }


type ChatProps = {
	onBack?: () => void
	allNodes: nodeInfo[]
	chatData: chatData
	privateKey: string

}

function fmtTime(ts: number) {
  const d = new Date(ts)
  if (!isFinite(d.getTime())) return ""
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

function BubbleCornerStatus({
  status,
  onRetry
}: {
  status?: "sending" | "sent" | "delivered" | "failed"
  onRetry?: () => void
}) {
  if (!status) return null

  // 容器：右下角小胶囊点
  const shell = [
    "absolute -bottom-1 -right-1",
    "h-4 w-4 rounded-full",
    "bg-white/75 backdrop-blur",
    "ring-1 ring-black/5",
    "grid place-items-center",
    "shadow-[0_6px_16px_rgba(15,23,42,0.12)]"
  ].join(" ")

  if (status === "sending") {
    return (
      <span className={shell} aria-label="Sending">
        <motion.span
          className="block h-3 w-3 rounded-full border-2 border-slate-300 border-t-[#1652f0]"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
        />
      </span>
    )
  }

  if (status === "delivered") {
    return (
      <span className={shell} aria-label="Delivered">
        <CheckCheck className="h-3 w-3 text-[#1652f0]" strokeWidth={2.8} />
      </span>
    )
  }

  if (status === "sent") {
    return null
  }

  // failed：可点
  return (
    <button
      type="button"
      onClick={onRetry}
      className={[
        shell,
        "cursor-pointer",
        "bg-white/80",
        "ring-1 ring-rose-200",
        "active:scale-[0.96] transition"
      ].join(" ")}
      aria-label="Failed, tap to retry"
      title="Failed · Tap to retry"
    >
      <AlertTriangle className="h-3 w-3 text-rose-600" strokeWidth={2.8} />
    </button>
  )
}



// ---------- Your existing Chat messages render (patched) ----------
type ChatListProps = {
	messages: ChatMessage[]
	pressTimerRef: React.MutableRefObject<number | null>
	openReactionBarForElement: (id: string, el: HTMLElement) => void
	setText: (t: string) => void
	setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
	BubbleCornerStatus: React.FC<{ status?: "sending" | "sent" | "delivered" | "failed"; onRetry: () => void }>
}




export default function Chat({ onBack, chatData, privateKey }: ChatProps) {
	const navigate = useNavigate()
	const [text, setText] = useState("")
	 
  	const {
		profiles,
		setProfiles,
		setShowFooter,
		allNodes,
		setGossip,
		gossip,
		charts,
		setbBeamioUsers,
		currencyData = {} as Record<string, number>,
		usdcbalance = 0,
		setScanData,
	} = useDaemonContext()
	


	const [messages, setMessages] = useState<ChatMessage[]>(chatData.messages)

	const scrollRef = useRef<HTMLDivElement | null>(null)
	const {
		setRef: setHeaderScrollRef,
		setLayerRef: setHeaderLayerRef,
		showCapsuleNow,
	} = useScrollCapsuleOpacity(true)
	const setChatScrollRef = useCallback((node: HTMLDivElement | null) => {
		scrollRef.current = node
		setHeaderScrollRef(node)
	}, [setHeaderScrollRef])
	const inputRef = useRef<HTMLTextAreaElement | null>(null)
	/** CJK / non-Latin IME: Enter confirms candidates — must not send while composing. */
	const imeComposingRef = useRef(false)
	/** After send, ignore compositionend / onChange / beforeinput echoes that re-fill the cleared textarea. */
	const suppressImeEchoRef = useRef(false)
	const suppressImeEchoTimerRef = useRef<number | null>(null)
	/** Remount textarea after send so WebKit/IME cannot keep composing into a cleared controlled value. */
	const [inputSession, setInputSession] = useState(0)
	/** Guard rapid double-tap / IME echo re-send of the same body. */
	const lastSentGuardRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })
	const recorderRef = useRef<MediaRecorder | null>(null)
	const recordingStartedAtRef = useRef(0)
	const recordingChunksRef = useRef<Blob[]>([])
	const recordingTimerRef = useRef<number | null>(null)
	const voiceLevelRafRef = useRef<number | null>(null)
	const voiceAnalyserRef = useRef<AnalyserNode | null>(null)
	const voiceAudioContextRef = useRef<AudioContext | null>(null)
	const [isRecordingVoice, setIsRecordingVoice] = useState(false)
	const [voiceDurationMs, setVoiceDurationMs] = useState(0)
	const [voiceRecordedBytes, setVoiceRecordedBytes] = useState(0)
	const [voiceLevelSamples, setVoiceLevelSamples] = useState<number[]>([])
	const [voiceDraftBlob, setVoiceDraftBlob] = useState<Blob | null>(null)
	const [voiceSending, setVoiceSending] = useState(false)
	const [voiceError, setVoiceError] = useState<string | null>(null)
	const [voiceCallState, setVoiceCallState] = useState<'idle' | 'outgoing' | 'ended'>('idle')
	const voiceCallSessionRef = useRef<string | null>(null)
	const voiceCallOfferRef = useRef<{ callId: string; sessionId: string; sessionKey: string } | null>(null)
	const voiceCallKeyRef = useRef<Uint8Array | null>(null)
	const voiceCallPeerSessionRef = useRef<string | null>(null)
	const voiceCaptureStopRef = useRef<(() => void) | null>(null)
	const voicePlaybackAudioRef = useRef<HTMLAudioElement | null>(null)
	const voicePlaybackRef = useRef<VoicePlaybackBuffer | null>(null)
	const voiceFrameSeqRef = useRef(0)
	const reportedIncomingCallIdsRef = useRef(new Set<string>())
	const voiceControllerRef = useRef<VoiceCallController | null>(null)
	const [incomingVoiceOffer, setIncomingVoiceOffer] = useState<Record<string, any> | null>(null)
	const [fileJobs, setFileJobs] = useState<ChatFileJob[]>([])
	const fileControllersRef = useRef(new Map<string, AbortController>())
	const storageDataRef = useRef<(() => Promise<void>) | null>(null)
	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const cameraInputRef = useRef<HTMLInputElement | null>(null)
	const cameraRequestIdRef = useRef<string | null>(null)
	const nativeCameraChunksRef = useRef<{ requestId: string; mimeType: string; chunks: string[] } | null>(null)
	const addChatFilesRef = useRef<((incoming: File[], dropFolderHint?: string | null, source?: 'drop' | 'picker' | 'camera') => void | Promise<void>) | null>(null)
	const [fileError, setFileError] = useState<string | null>(null)
	const [nativeCameraProcessing, setNativeCameraProcessing] = useState(false)
	const [fileDropActive, setFileDropActive] = useState(false)
	/** Nested dragenter/leave depth on the chat shell — avoids clearing the overlay when React remounts children under the cursor (relatedTarget often null). */
	const fileDragDepthRef = useRef(0)
	const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
	const [cameraRecording, setCameraRecording] = useState(false)
	const cameraRecorderRef = useRef<MediaRecorder | null>(null)
	const cameraChunksRef = useRef<Blob[]>([])
	const cameraPreviewRef = useRef<HTMLVideoElement | null>(null)
	const [chatError, setChatError] = useState<string | null>(null)

	const upsertPhoneCallRecord = useCallback((patch: PhoneCallRecord) => {
		const currentProfiles = Array.isArray(profiles) ? profiles : []
		if (!currentProfiles.length) return
		const current: PhoneCallRecord[] = Array.isArray(currentProfiles[0].phoneCalls) ? currentProfiles[0].phoneCalls : []
		const previous = current.find(item => item.sessionId === patch.sessionId)
		const merged: PhoneCallRecord = {
			...previous,
			...patch,
			createdAt: previous?.createdAt ?? patch.createdAt,
		}
		const nextProfiles = currentProfiles.slice()
		nextProfiles[0] = {
			...currentProfiles[0],
			phoneCalls: [...current.filter(item => item.sessionId !== patch.sessionId), merged]
				.sort((a, b) => b.createdAt - a.createdAt)
				.slice(0, 200),
		}
		setProfiles(nextProfiles)
		if (CoNET_Data) {
			CoNET_Data.profiles = nextProfiles
			setCoNET_Data(CoNET_Data)
		}
		void storeSystemData()
		mirrorChatMessageToHistory(chatData.address, {
			id: `phone_${patch.sessionId}_${merged.status}_${Date.now()}`,
			sendId: `phone:${patch.sessionId}:${merged.status}`,
			from: 'me',
			text: '',
			createdAt: Date.now(),
			callRecord: merged,
		}, 'out')
	}, [chatData.address, profiles, setProfiles])

	useEffect(() => {
		const addCapturedVideo = (dataUrl: string, mimeType?: string) => {
			// A previous folder/drop failure must not remain visible after the
			// user successfully starts a new camera capture.
			setFileError(null)
			if (!dataUrl) {
				setNativeCameraProcessing(false)
				setFileError('Camera returned no video. Please try again.')
				return
			}
			void fetch(dataUrl)
				.then(response => response.blob())
				.then(blob => {
					if (!blob.size) throw new Error('empty_camera_video')
					const file = new File([blob], `camera-${Date.now()}.mp4`, { type: mimeType || blob.type || 'video/mp4' })
					// iOS camera recordings can use a codec that WKWebView can
					// upload but cannot decode for a local thumbnail. Keep the
					// upload path intact and skip only the optional thumbnail.
					void addChatFilesRef.current?.([file], null, 'camera')
				})
				.catch(() => {
					setNativeCameraProcessing(false)
					setFileError('The captured video could not be read. Please try again.')
				})
		}
		const handleNativeCameraResult = (event: Event) => {
			const detail = (event as CustomEvent<{
				action?: string
				ok?: boolean
				requestId?: string
				dataUrl?: string
				data?: string
				mimeType?: string
				error?: string
			}>).detail
			if (!detail?.action?.startsWith('cameraCapture')) return
			if (cameraRequestIdRef.current && detail.requestId && detail.requestId !== cameraRequestIdRef.current) return
			if (detail.action === 'cameraCaptureStart') {
				setFileError(null)
				setNativeCameraProcessing(true)
				nativeCameraChunksRef.current = {
					requestId: detail.requestId || cameraRequestIdRef.current || '',
					mimeType: detail.mimeType || 'video/mp4',
					chunks: [],
				}
				return
			}
			if (detail.action === 'cameraCaptureChunk') {
				const transfer = nativeCameraChunksRef.current
				if (transfer && transfer.requestId === (detail.requestId || transfer.requestId)) {
					transfer.chunks.push(detail.data || '')
				}
				return
			}
			if (detail.action === 'cameraCaptureEnd') {
				const transfer = nativeCameraChunksRef.current
				nativeCameraChunksRef.current = null
				cameraRequestIdRef.current = null
				if (transfer) addCapturedVideo(`data:${transfer.mimeType};base64,${transfer.chunks.join('')}`, transfer.mimeType)
				else {
					setNativeCameraProcessing(false)
					setFileError('Camera returned no video. Please try again.')
				}
				return
			}
			cameraRequestIdRef.current = null
			if (!detail.ok) {
				setNativeCameraProcessing(false)
				setFileError(detail.error === 'cancelled' ? 'Camera capture was cancelled.' : 'Camera capture failed. Please try again.')
				return
			}
			addCapturedVideo(detail.dataUrl || '', detail.mimeType)
		}
		window.addEventListener('cashtreesandroid', handleNativeCameraResult)
		window.addEventListener('cashtreesios', handleNativeCameraResult)
		return () => {
			window.removeEventListener('cashtreesandroid', handleNativeCameraResult)
			window.removeEventListener('cashtreesios', handleNativeCameraResult)
		}
	}, [])

	const toAddress = chatData.address
	const walletEoa = (profiles[0]?.keyID ?? '').trim()

	const startVoiceMedia = useCallback(async () => {
		if (voiceCaptureStopRef.current || !voiceCallKeyRef.current || !voiceCallPeerSessionRef.current) return
		if (!navigator.mediaDevices?.getUserMedia) {
			setVoiceError('Voice calling is not supported by this browser.')
			return
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			const key = voiceCallKeyRef.current
			const targetSessionId = voiceCallPeerSessionRef.current
			const callId = voiceCallOfferRef.current?.callId || ''
			voiceFrameSeqRef.current = 0
			voiceCaptureStopRef.current = await startVoiceCapture(stream, key, async (payload) => {
				const route = chatData.chatData?.routersArmoreds?.trim()
				if (!route || !callId || !targetSessionId) return
				await sendWorkerVoiceFrame(route, {
					type: 'voice_frame_v1',
					callId,
					sessionId: voiceCallSessionRef.current,
					targetSessionId,
					targetWallet: toAddress,
					seq: voiceFrameSeqRef.current++,
					payload,
				})
			})
		} catch {
			setVoiceError('Microphone access was denied or unavailable.')
		}
	}, [chatData.chatData, toAddress])

	const startVoiceCall = useCallback(async () => {
		if (voiceCallState !== 'idle') return
		const route = chatData.chatData?.routersArmoreds?.trim()
		const recipientPgp = chatData.chatData?.publicArmored?.trim()
		if (!route || !recipientPgp) {
			setVoiceError('Voice calling requires the contact to have an active Chat route.')
			return
		}
		const callerWallet = new ethers.Wallet(privateKey).address
		const callerCallId = String(
			CoNET_Data?.beamio?.accountName ||
			callerWallet,
		).trim() || callerWallet
		const controller = createVoiceCallController({
			privateKey,
			localCallId: callerCallId,
			peerEoa: toAddress,
			peerPgp: recipientPgp,
			peerRoute: route,
			allNodes,
		})
		const channel = await controller.startOutgoing()
		if (!channel) {
			setVoiceError('Voice call could not open a temporary relay.')
			return
		}
		voiceControllerRef.current = controller
		const sessionId = channel.sessionId
		const key = channel.sessionKey
		voiceCallSessionRef.current = sessionId
		voiceCallKeyRef.current = key
		setVoiceCallState('outgoing')
		const signal = channel.signal
		voiceCallOfferRef.current = { callId: signal.callId, sessionId, sessionKey: signal.sessionKey || '' }
		upsertPhoneCallRecord({
			callId: signal.callId,
			sessionId,
			peerAddress: toAddress,
			direction: 'outgoing',
			status: 'ringing',
			createdAt: Date.now(),
		})
		dispatchNativeSystemCallAction('startSystemCall', {
			callId: signal.callId,
			peerAddress: toAddress,
			displayName: chatData.beamio?.username || toAddress,
		})
	}, [allNodes, chatData, privateKey, toAddress, upsertPhoneCallRecord, voiceCallState])

	useEffect(() => {
		const latest = [...messages].reverse().find((message) => message.from === 'them' && message.text)
		if (!latest?.text) return
		try {
			const signal = JSON.parse(latest.text) as Record<string, any>
			if (
				signal.type === 'voice_call_offer_v1' &&
				typeof signal.callId === 'string' &&
				typeof signal.sessionId === 'string' &&
				typeof signal.sessionKey === 'string' &&
				Number(signal.expiresAt) > Date.now()
			) {
				setIncomingVoiceOffer(previous => previous?.callId === signal.callId ? previous : signal)
				if (!reportedIncomingCallIdsRef.current.has(signal.sessionId)) {
					reportedIncomingCallIdsRef.current.add(signal.sessionId)
					upsertPhoneCallRecord({
						callId: signal.callId,
						sessionId: signal.sessionId,
						peerAddress: chatData.address,
						direction: 'incoming',
						status: 'ringing',
						createdAt: Date.now(),
					})
					dispatchNativeSystemCallAction('reportIncomingSystemCall', {
						callId: signal.callId,
						peerAddress: chatData.address,
						displayName: chatData.beamio?.username || chatData.address,
					})
				}
			}
			if (
				signal.type === 'voice_call_accept_v1' &&
				voiceCallOfferRef.current?.callId === signal.callId &&
				typeof signal.peerSessionId === 'string'
			) {
				// The relay is now paired. Media capture is intentionally owned by
				// the call controller, not the normal Chat message stream.
				voiceCallPeerSessionRef.current = signal.peerSessionId
				setVoiceCallState('outgoing')
				void startVoiceMedia()
			}
		} catch {
			/* ordinary Chat text */
		}
	}, [chatData, messages, startVoiceMedia, upsertPhoneCallRecord])

	const acceptVoiceCall = useCallback(async () => {
		const offer = incomingVoiceOffer
		if (!offer) return
		try {
			const localWallet = new ethers.Wallet(privateKey).address
			const controller = createVoiceCallController({
				privateKey,
				localCallId: String(CoNET_Data?.beamio?.accountName || localWallet).trim() || localWallet,
				peerEoa: offer.from,
				peerPgp: chatData.chatData.publicArmored,
				peerRoute: chatData.chatData.routersArmoreds,
				allNodes,
			})
			const channel = await controller.acceptIncoming(offer as VoiceCallSignal)
			if (!channel) {
				setVoiceError('Voice call could not open a temporary relay.')
				return
			}
			voiceControllerRef.current = controller
			const key = channel.sessionKey
			const sessionId = channel.sessionId
			voiceCallKeyRef.current = key
			voiceCallSessionRef.current = sessionId
			voiceCallPeerSessionRef.current = offer.sessionId
			voiceCallOfferRef.current = { callId: channel.callId, sessionId: offer.sessionId, sessionKey: offer.sessionKey }
			setIncomingVoiceOffer(null)
			setVoiceCallState('outgoing')
			upsertPhoneCallRecord({
				callId: offer.callId,
				sessionId: offer.sessionId,
				peerAddress: offer.from,
				direction: 'incoming',
				status: 'answered',
				createdAt: Number(offer.createdAt) || Date.now(),
				answeredAt: Date.now(),
			})
			dispatchNativeSystemCallAction('startSystemCall', {
				callId: offer.callId,
				peerAddress: offer.from,
				displayName: offer.from,
			})
			void startVoiceMedia()
		} catch {
			setVoiceError('This voice call request is invalid or expired.')
		}
	}, [allNodes, chatData.chatData, incomingVoiceOffer, privateKey, startVoiceMedia, upsertPhoneCallRecord])

	const rejectVoiceCall = useCallback(async () => {
		const offer = incomingVoiceOffer
		if (!offer) return
		const localWallet = new ethers.Wallet(privateKey).address
		const controller = createVoiceCallController({
			privateKey,
			localCallId: String(CoNET_Data?.beamio?.accountName || localWallet).trim() || localWallet,
			peerEoa: offer.from,
			peerPgp: chatData.chatData.publicArmored,
			peerRoute: chatData.chatData.routersArmoreds,
			allNodes,
		})
		await controller.rejectIncoming(offer as VoiceCallSignal)
		upsertPhoneCallRecord({
			callId: offer.callId,
			sessionId: offer.sessionId,
			peerAddress: offer.from,
			direction: 'incoming',
			status: 'declined',
			createdAt: Number(offer.createdAt) || Date.now(),
			endedAt: Date.now(),
		})
		dispatchNativeSystemCallAction('endSystemCall', { callId: offer.callId })
		setIncomingVoiceOffer(null)
	}, [allNodes, chatData.chatData.publicArmored, incomingVoiceOffer, privateKey, upsertPhoneCallRecord])

	const endVoiceCall = useCallback(async () => {
		const sessionId = voiceCallSessionRef.current
		const callId = voiceCallOfferRef.current?.callId
		const callSessionId = voiceCallOfferRef.current?.sessionId || sessionId || ''
		if (voiceControllerRef.current) {
			await voiceControllerRef.current.end()
			voiceControllerRef.current = null
		} else if (sessionId) {
			await stopWorkerVoiceListen(sessionId)
		}
		voiceCaptureStopRef.current?.()
		voiceCaptureStopRef.current = null
		voicePlaybackRef.current?.destroy()
		voicePlaybackRef.current = null
		voiceCallKeyRef.current = null
		voiceCallPeerSessionRef.current = null
		voiceCallSessionRef.current = null
		if (callId) {
			upsertPhoneCallRecord({
				callId,
				sessionId: callSessionId,
				peerAddress: toAddress,
				direction: 'outgoing',
				status: 'ended',
				createdAt: Date.now(),
				endedAt: Date.now(),
			})
			dispatchNativeSystemCallAction('endSystemCall', { callId })
		}
		setVoiceCallState('ended')
		window.setTimeout(() => setVoiceCallState('idle'), 300)
	}, [toAddress, upsertPhoneCallRecord])

	useEffect(() => {
		const onNativeCallAction = (event: Event) => {
			const detail = (event as CustomEvent<{ action?: string; callId?: string }>).detail
			if (!detail?.action || !detail.callId) return
			if (detail.action === 'callAnswered' && incomingVoiceOffer?.callId === detail.callId) {
				void acceptVoiceCall()
			} else if (detail.action === 'callRejected' && incomingVoiceOffer?.callId === detail.callId) {
				void rejectVoiceCall()
			} else if (detail.action === 'callEnded') {
				void endVoiceCall()
			}
		}
		window.addEventListener('cashtreesios', onNativeCallAction)
		window.addEventListener('cashtreesandroid', onNativeCallAction)
		return () => {
			window.removeEventListener('cashtreesios', onNativeCallAction)
			window.removeEventListener('cashtreesandroid', onNativeCallAction)
		}
	}, [acceptVoiceCall, endVoiceCall, incomingVoiceOffer, rejectVoiceCall])

	useEffect(() => {
		const audio = voicePlaybackAudioRef.current
		if (!audio) return
		const playback = new VoicePlaybackBuffer(audio)
		voicePlaybackRef.current = playback
		return () => {
			playback.destroy()
			if (voicePlaybackRef.current === playback) voicePlaybackRef.current = null
		}
	}, [])

	useEffect(() => onVoiceFrame((frame) => {
		if (
			voiceCallState !== 'outgoing' ||
			frame.type !== 'voice_frame_v1' ||
			typeof frame.payload !== 'string' ||
			frame.callId !== voiceCallOfferRef.current?.callId
		) return
		voicePlaybackRef.current?.setKey(voiceCallKeyRef.current || new Uint8Array())
		void voicePlaybackRef.current?.push(frame.payload).catch(() => {
			setVoiceError('Incoming voice audio could not be decoded.')
		})
	}), [voiceCallState])

	const openMultisigFromChat = useCallback(
		(messageText: string, isMeMessage: boolean, taskId: string, aaAccount?: string) => {
			const fromEoa = isMeMessage ? walletEoa : toAddress
			if (walletEoa && fromEoa) {
				try {
					ingestAaMultisigFromChat({ displayText: messageText, fromEoa, walletEoa })
				} catch {
					/* multisig ingest must not break chat navigation */
				}
			}
			// Expired / completed tasks only appear under History — never hardcode Pending.
			let tab: 'pending' | 'history' = 'pending'
			let resolvedAa = (aaAccount ?? '').trim()
			if (walletEoa && taskId) {
				const stored = getAaMultisigTaskAny(walletEoa, taskId)
				if (stored) {
					tab = multisigTaskDeepLinkTab(stored)
					if (!resolvedAa && stored.aaAccount) resolvedAa = stored.aaAccount
				}
			}
			const params = new URLSearchParams({ tab, taskId })
			if (resolvedAa) params.set('aaAccount', resolvedAa)
			navigate(`/wallet/aa-multisig?${params.toString()}`)
		},
		[navigate, walletEoa, toAddress]
	)
	const pressTimerRef = useRef<number | null>(null)
	const messagesRef = useRef<ChatMessage[]>(chatData.messages || [])
	const liveFileMessagesRef = useRef(new Map<string, ChatMessage>())
	const skipNextReflashdataRef = useRef(false)
	const [fromBeamio, setfromBeamio] = useState<searchResult|undefined> ()
	const [showContactProfile, setShowContactProfile] = useState(false)
	const [userImg, setUserImg] = useState('')
	const [plusOpen, setPlusOpen] = useState(false)
	const plusBtnRef = useRef<HTMLButtonElement | null>(null)
	const [reactionUI, setReactionUI] = useState<{
		open: boolean
		messageId?: string
		x: number
		y: number
		placement: "top"
		/** 被长按气泡的视口矩形，用于在气泡下方定位 iOS 风格上下文菜单 */
		rect?: { top: number; left: number; width: number; height: number; bottom: number }
		isMe?: boolean
		text?: string
		hasCard?: boolean
		createdAt?: number
	}>(() => ({ open: false, x: 0, y: 0, placement: "top" }))
	/** 引用回复草稿：用户点 Reply 后在输入框上方显示，发送时随 quote 一起发出 */
	const [replyTo, setReplyTo] = useState<{ id: string; text: string; from: "me" | "them" } | null>(null)
	/** 长按底部消息时，为让菜单完整显示而临时增加的底部占位高度（无法继续滚动时上提） */
	const [menuBottomSpacer, setMenuBottomSpacer] = useState(0)
	/** 接收方点击 Pay 后，在卡片内显示确认（该条消息的 sendId 或 id） */
	const [payConfirmForSendId, setPayConfirmForSendId] = useState<string | null>(null)
	/** 正在执行 Payment Request 转账的 sendId（显示 loading） */
	const [payTransferLoading, setPayTransferLoading] = useState<string | null>(null)
	const [payTransferError, setPayTransferError] = useState<string | null>(null)
	/** 正在发送 Decline 的 sendId（防止重复点击） */
	const [declineLoadingForSendId, setDeclineLoadingForSendId] = useState<string | null>(null)

	/** 仅展示“正文”消息（含文字或 paymentCard）；带 reply 的 reaction 消息不单独成行，用于在目标消息上显示 icon */
	const displayableMessages = useMemo(() => {
		return (messages || []).filter(m => {
			if (m.text) {
				try {
					const parsed = JSON.parse(m.text) as { type?: unknown }
					if (typeof parsed.type === 'string' && parsed.type.startsWith('voice_call_')) return false
				} catch {
					/* ordinary text */
				}
			}
			return !m.reply || !!m.text || !!m.paymentCard || !!m.voiceMessage || !!m.fileMessage
		})
	}, [messages])

	const sections = useMemo(() => {
		return groupChatMessages(displayableMessages, new Date())
	}, [displayableMessages])

	/** messageId（或时间戳字符串）-> 该条消息收到的 reaction 列表。paymentRequestCancel / paymentRequestPaid 不计入 reaction。 */
	const reactionsByMessageId = useMemo(() => {
		const map = new Map<string, { reactionKey: string; from: 'me' | 'them' }[]>()
		for (const m of messages || []) {
			if (!m.reply) continue
			if (m.reply.replyType === 'paymentRequestCancel' || m.reply.replyType === 'paymentRequestPaid') continue
			if (!m.reply.reactionKey) continue
			const list = map.get(m.reply.messageId) || []
			list.push({ reactionKey: m.reply.reactionKey, from: m.from })
			map.set(m.reply.messageId, list)
		}
		return map
	}, [messages])

	/** 已被取消的 Payment Request：sendId -> 取消消息的 createdAt（用于显示取消时间） */
	const cancelledPaymentRequestMap = useMemo(() => {
		const map = new Map<string, number>()
		for (const m of messages || []) {
			if (m.reply?.replyType === 'paymentRequestCancel' && m.reply.messageId != null && m.createdAt != null) {
				// 若同一条 request 被多次 cancel，保留第一次的 timestamp
				if (!map.has(m.reply.messageId)) map.set(m.reply.messageId, m.createdAt)
			}
		}
		return map
	}, [messages])
	const cancelledPaymentRequestSendIds = useMemo(() => new Set(cancelledPaymentRequestMap.keys()), [cancelledPaymentRequestMap])

	/** 已支付的 Payment Request：sendId -> { hash, createdAt }（用于卡片显示绿色 check + hash） */
	const paidPaymentRequestMap = useMemo(() => {
		const map = new Map<string, { hash: string; createdAt: number }>()
		for (const m of messages || []) {
			if (m.reply?.replyType === 'paymentRequestPaid' && m.reply.messageId != null && m.reply.paymentHash && m.createdAt != null) {
				if (!map.has(m.reply.messageId)) map.set(m.reply.messageId, { hash: m.reply.paymentHash, createdAt: m.createdAt })
			}
		}
		return map
	}, [messages])

	/** 1 USDC = ? in given currency (for converting fiat amount to USDC at Pay click) */
	function fxRateUSDCToCurrency(currency: ICurrency): number {
		const usdcToUSD = Number((currencyData as Record<string, number>)?.USDC ?? 1)
		if (currency === 'USD') return usdcToUSD
		const usdToCurrency = Number((currencyData as Record<string, number>)?.[currency] ?? 1)
		return usdcToUSD * usdToCurrency
	}

	/** 取某条消息对应的 reaction 列表：优先 sendId（reply 必须指向 sendId），再 id/createdAt/时间戳容差（兼容旧数据） */
	const getReactionsForMessage = useCallback(
		(m: ChatMessage) => {
			if (m.sendId) {
				const bySendId = reactionsByMessageId.get(m.sendId)
				if (bySendId?.length) return bySendId
			}
			const byId = reactionsByMessageId.get(m.id ?? '')
			if (byId?.length) return byId
			const byCreated = reactionsByMessageId.get(String(m.createdAt ?? ''))
			if (byCreated?.length) return byCreated
			const ts = Number(m.createdAt)
			if (!Number.isFinite(ts)) return undefined
			const tolerance = 15000
			for (const [key, list] of reactionsByMessageId) {
				const keyNum = Number(key)
				if (Number.isFinite(keyNum) && Math.abs(keyNum - ts) <= tolerance) return list
			}
			return undefined
		},
		[reactionsByMessageId]
	)


	const hasRoute = !!(chatData.chatData?.routersArmoreds?.trim())

	const canSend = useMemo(() => {
		return !!toAddress && !!hasRoute && (text.trim().length > 0 || !!voiceDraftBlob || fileJobs.some(job => job.status === 'ready'))
	}, [toAddress, hasRoute, text, voiceDraftBlob, fileJobs])

	const runningRef = useRef(false)

	const addChatFiles = useCallback(async (
		incoming: File[],
		dropFolderHint?: string | null,
		source: 'drop' | 'picker' | 'camera' = 'drop',
	) => {
		if (!hasRoute || !incoming.length) return
		// A later successful drop must not leave the previous folder-read alert
		// attached to the composer. Failed jobs are also stale for this new
		// user action; keeping them would continue rendering their alert <p>.
		setFileError(null)
		const extraDirectoryNames = extraDirectoryNamesFromHint(dropFolderHint)
		let readable: { files: File[]; stubNames: string[] }
		try {
			if (source === 'camera') {
				// Native camera already returns a materialized File. Do not send
				// it through the dropped-folder reader, which can classify the
				// camera result as an unreadable directory in WebViews.
				readable = {
					files: incoming,
					stubNames: [],
				}
			} else if (source === 'picker') {
				readable = {
					files: await materializePickedChatFiles(incoming),
					stubNames: [],
				}
			} else {
				readable = await materializeDroppedChatFiles(
					sanitizeDroppedChatFiles(incoming, extraDirectoryNames),
					extraDirectoryNames,
				)
			}
		} catch (error) {
			setFileError(source === 'picker'
				? (error instanceof Error ? error.message : 'The selected file could not be read. Please choose it again.')
				: chatFileReadErrorMessage(error))
			return
		}
		const files = readable.files
		const folderHint = resolveDropFolderHint({
			files,
			stubNames: readable.stubNames,
			directoryNames: extraDirectoryNames,
			singleItemManyFiles: incoming.length > 1 || Boolean(dropFolderHint),
			firstDirectName: dropFolderHint || incoming[0]?.name,
		}) || dropFolderHint || null
		if (!files.length) {
			setFileError('This folder could not be read. Drop the files inside it, or try again.')
			return
		}
		setFileJobs(previous => previous.filter(job => job.status !== 'failed'))
		const id = crypto.randomUUID()
		const isPdfFile = files[0].type === 'application/pdf' || files[0].name.toLowerCase().endsWith('.pdf')
		const isFolderSelection = Boolean(folderHint) || files.some(file => Boolean(file.webkitRelativePath && file.webkitRelativePath.includes('/')))
		const bundleName = chatFileBundleDisplayName(files, folderHint)
		const mediaFile = files.length === 1 && !isFolderSelection && (
			files[0].type.startsWith('video/')
			|| files[0].type.startsWith('image/')
			|| isPdfFile
		) ? files[0] : null
		const previewMediaFile = mediaFile && (mediaFile.type.startsWith('video/') || mediaFile.type.startsWith('image/')) ? mediaFile : null
		const videoFile = mediaFile?.type.startsWith('video/') ? mediaFile : null
		const controller = new AbortController()
		fileControllersRef.current.set(id, controller)
		setFileJobs(previous => [
			...previous,
			{
				id,
				files,
				name: bundleName,
				progress: 0,
				status: 'uploading',
			},
		])
		if (source === 'camera') setNativeCameraProcessing(false)
		let thumbnail: Blob | undefined
		let mediaDimensions: { width: number; height: number } | undefined
		try {
			if (previewMediaFile && source !== 'camera') {
				mediaDimensions = await readMediaDimensions(previewMediaFile)
			}
			if (videoFile && source !== 'camera') {
				setFileJobs(previous => previous.map(item => item.id === id ? { ...item, progress: 0.03 } : item))
				thumbnail = await createVideoThumbnail(videoFile)
				setFileJobs(previous => previous.map(item => item.id === id ? { ...item, progress: 0.08 } : item))
			} else if (previewMediaFile) {
				thumbnail = previewMediaFile
				setFileJobs(previous => previous.map(item => item.id === id ? { ...item, progress: 0.08 } : item))
			}
		} catch (error) {
			if (source === 'camera') setNativeCameraProcessing(false)
			if (!isNotFoundReadError(error)) {
				setFileError(chatFileReadErrorMessage(error) || 'Video thumbnail could not be created.')
			}
			// Keep the job alive and continue uploading; the receiver can still
			// render the decrypted media when no local thumbnail is available.
		}
		if (controller.signal.aborted) {
			fileControllersRef.current.delete(id)
			return
		}
		let thumbnailUrl: string | undefined
		try {
			thumbnailUrl = thumbnail ? URL.createObjectURL(thumbnail) : undefined
		} catch (error) {
			if (!isNotFoundReadError(error)) {
				setFileError(chatFileReadErrorMessage(error))
			}
			thumbnail = undefined
		}
		if (thumbnailUrl) {
			setFileJobs(previous => previous.map(item => item.id === id ? { ...item, thumbnailUrl } : item))
		}
		try {
			const encrypted = await encryptChatFiles(
				files,
				files.length > 1 || Boolean(folderHint)
					? bundleName
					: undefined,
				thumbnail,
				mediaDimensions,
			)
			const fragmentHash = await uploadEncryptedChatFileDataUrl(
				profiles[0]?.privateKeyArmor || '',
				encrypted.dataUrl,
				progress => setFileJobs(previous => previous.map(item => item.id === id ? { ...item, progress } : item)),
				controller.signal,
			)
			setFileJobs(previous => previous.map(item => item.id === id
				? { ...item, status: 'ready', progress: 1, manifest: { ...encrypted.manifest, fragmentHash } }
				: item))
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				setFileJobs(previous => previous.filter(item => item.id !== id))
			} else {
				setFileJobs(previous => previous.map(item => item.id === id ? { ...item, status: 'failed', error: chatFileReadErrorMessage(error) } : item))
			}
		} finally {
			fileControllersRef.current.delete(id)
		}
	}, [hasRoute, profiles])
	addChatFilesRef.current = addChatFiles

	const handleChatFileDragEnter = useCallback((event: React.DragEvent) => {
		event.preventDefault()
		event.stopPropagation()
		if (!hasRoute) return
		if (!Array.from(event.dataTransfer.types).includes('Files')) return
		fileDragDepthRef.current += 1
		setFileDropActive(true)
	}, [hasRoute])

	const handleChatFileDragOver = useCallback((event: React.DragEvent) => {
		event.preventDefault()
		event.stopPropagation()
		if (!hasRoute) return
		event.dataTransfer.dropEffect = 'copy'
		if (Array.from(event.dataTransfer.types).includes('Files')) setFileDropActive(true)
	}, [hasRoute])

	const handleChatFileDragLeave = useCallback((event: React.DragEvent) => {
		event.preventDefault()
		event.stopPropagation()
		const next = event.relatedTarget as Node | null
		// Overlay mount often fires leave with relatedTarget=null — do not clear.
		if (!next) return
		if (event.currentTarget.contains(next)) return
		fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1)
		if (fileDragDepthRef.current === 0) setFileDropActive(false)
	}, [])

	const handleChatFileDrop = useCallback((event: React.DragEvent) => {
		event.preventDefault()
		event.stopPropagation()
		// Snapshot FileList BEFORE any React state update — some engines clear
		// dataTransfer after the drop handler yields / re-renders.
		const directFiles = Array.from(event.dataTransfer.files || [])
		const dataTransfer = event.dataTransfer
		if (!hasRoute) {
			fileDragDepthRef.current = 0
			setFileDropActive(false)
			return
		}
		setFileError(null)
		// Start the FileSystem walk + FileList arrayBuffer() before React
		// state updates yield; Chrome otherwise invalidates the drop Files.
		const dropWork = filesFromDropTransfer(dataTransfer, directFiles)
		fileDragDepthRef.current = 0
		setFileDropActive(false)
		void dropWork.then(({ files, folderHint }) => {
			if (files.length) {
				void addChatFiles(files, folderHint)
				return
			}
			setFileError('This folder could not be read. Drop the files inside it, or try again.')
		}).catch(error => {
			setFileError(chatFileReadErrorMessage(error))
		})
	}, [addChatFiles, hasRoute])

	useEffect(() => {
		const clearFileDropUi = () => {
			fileDragDepthRef.current = 0
			setFileDropActive(false)
		}
		window.addEventListener('dragend', clearFileDropUi)
		return () => window.removeEventListener('dragend', clearFileDropUi)
	}, [])

	const openChatCamera = useCallback(() => {
		setFileError(null)
		if (!hasRoute) {
			setFileError('Camera attachments require an active Chat route.')
			return
		}
		const requestId = crypto.randomUUID()
		cameraRequestIdRef.current = requestId
		if (requestNativeCameraCapture({ requestId, mediaType: 'video' })) {
			setNativeCameraProcessing(true)
			return
		}
		const getUserMedia = navigator.mediaDevices?.getUserMedia
		if (typeof getUserMedia === 'function') {
			void getUserMedia.call(navigator.mediaDevices, { video: true, audio: true })
				.then(stream => {
					cameraRequestIdRef.current = null
					setFileError(null)
					setCameraStream(stream)
				})
				.catch(() => {
					cameraRequestIdRef.current = null
					cameraInputRef.current?.click()
				})
			return
		}
		cameraRequestIdRef.current = null
		cameraInputRef.current?.click()
	}, [hasRoute])

	const closeChatCamera = useCallback(() => {
		try { cameraRecorderRef.current?.stop() } catch {}
		cameraRecorderRef.current = null
		cameraChunksRef.current = []
		cameraStream?.getTracks().forEach(track => track.stop())
		setCameraStream(null)
		setCameraRecording(false)
	}, [cameraStream])

	const startChatCameraRecording = useCallback((video: HTMLVideoElement) => {
		if (!cameraStream || cameraRecording) return
		const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
			.find(type => MediaRecorder.isTypeSupported(type)) || ''
		const recorder = mimeType ? new MediaRecorder(cameraStream, { mimeType }) : new MediaRecorder(cameraStream)
		cameraChunksRef.current = []
		recorder.ondataavailable = event => {
			if (event.data.size > 0) cameraChunksRef.current.push(event.data)
		}
		recorder.onstop = () => {
			const blob = new Blob(cameraChunksRef.current, { type: recorder.mimeType || 'video/webm' })
			cameraChunksRef.current = []
			cameraRecorderRef.current = null
			cameraStream.getTracks().forEach(track => track.stop())
			setCameraStream(null)
			setCameraRecording(false)
			if (blob.size > 0) {
				const file = new File([blob], `camera-${Date.now()}.webm`, { type: blob.type || 'video/webm' })
				void addChatFiles([file])
			}
		}
		cameraRecorderRef.current = recorder
		recorder.start(250)
		setCameraRecording(true)
		video.play().catch(() => {})
	}, [addChatFiles, cameraRecording, cameraStream])

	const stopChatCameraRecording = useCallback(() => {
		if (cameraRecorderRef.current?.state !== 'inactive') cameraRecorderRef.current?.stop()
	}, [])

	useEffect(() => {
		const video = cameraPreviewRef.current
		if (!video || !cameraStream) return
		video.srcObject = cameraStream
		void video.play().catch(() => {})
		return () => {
			video.srcObject = null
		}
	}, [cameraStream])

	const cancelChatFileJob = useCallback((id: string) => {
		fileControllersRef.current.get(id)?.abort()
		setFileJobs(previous => {
			const removed = previous.find(item => item.id === id)
			if (removed?.thumbnailUrl) URL.revokeObjectURL(removed.thumbnailUrl)
			return previous.filter(item => item.id !== id)
		})
	}, [])

	const stopVoiceDurationTimer = useCallback(() => {
		if (recordingTimerRef.current !== null) {
			window.clearTimeout(recordingTimerRef.current)
			recordingTimerRef.current = null
		}
	}, [])

	const stopVoiceLevelMeter = useCallback(() => {
		if (voiceLevelRafRef.current !== null) {
			window.cancelAnimationFrame(voiceLevelRafRef.current)
			voiceLevelRafRef.current = null
		}
		voiceAnalyserRef.current = null
		const context = voiceAudioContextRef.current
		voiceAudioContextRef.current = null
		if (context) void context.close().catch(() => {})
	}, [])

	const sampleVoiceLevel = useCallback(() => {
		const analyser = voiceAnalyserRef.current
		if (!analyser) return
		const values = new Uint8Array(analyser.fftSize)
		analyser.getByteTimeDomainData(values)
		let sum = 0
		for (const value of values) {
			const normalized = (value - 128) / 128
			sum += normalized * normalized
		}
		const rms = Math.min(1, Math.sqrt(sum / values.length) * 3.5)
		setVoiceLevelSamples(previous => [...previous.slice(-119), rms])
		voiceLevelRafRef.current = window.requestAnimationFrame(sampleVoiceLevel)
	}, [])

	const scheduleVoiceDurationTimer = useCallback(() => {
		stopVoiceDurationTimer()
		if (!recordingStartedAtRef.current) return
		recordingTimerRef.current = window.setTimeout(() => {
			setVoiceDurationMs(Date.now() - recordingStartedAtRef.current)
			scheduleVoiceDurationTimer()
		}, 250)
	}, [stopVoiceDurationTimer])

	useEffect(() => () => {
		stopVoiceDurationTimer()
		stopVoiceLevelMeter()
		try { recorderRef.current?.stop() } catch { /* already stopped */ }
	}, [stopVoiceDurationTimer, stopVoiceLevelMeter])

	const startVoiceRecording = useCallback(async () => {
		if (!hasRoute || isRecordingVoice || voiceSending) return
		setVoiceError(null)
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
			setVoiceError('Voice recording is not supported by this browser.')
			return
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
				.find(type => MediaRecorder.isTypeSupported(type)) || ''
			const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
			recordingChunksRef.current = []
			setVoiceLevelSamples([])
			recorder.ondataavailable = event => {
				if (event.data.size > 0) {
					recordingChunksRef.current.push(event.data)
					setVoiceRecordedBytes(prev => prev + event.data.size)
				}
			}
			recorder.onerror = () => setVoiceError('Voice recording failed. Please try again.')
			recorderRef.current = recorder
			recordingStartedAtRef.current = Date.now()
			setVoiceDurationMs(0)
			setVoiceRecordedBytes(0)
			setIsRecordingVoice(true)
			const AudioContextCtor =
				window.AudioContext ||
				(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
			if (AudioContextCtor) {
				const audioContext = new AudioContextCtor()
				const source = audioContext.createMediaStreamSource(stream)
				const analyser = audioContext.createAnalyser()
				analyser.fftSize = 256
				source.connect(analyser)
				voiceAudioContextRef.current = audioContext
				voiceAnalyserRef.current = analyser
				voiceLevelRafRef.current = window.requestAnimationFrame(sampleVoiceLevel)
			}
			recorder.start(250)
			scheduleVoiceDurationTimer()
		} catch {
			setVoiceError('Microphone access was denied or unavailable.')
		}
	}, [hasRoute, isRecordingVoice, sampleVoiceLevel, scheduleVoiceDurationTimer, voiceSending])

	const finishVoiceRecording = useCallback(async () => {
		const recorder = recorderRef.current
		if (!recorder || recorder.state === 'inactive') return
		stopVoiceDurationTimer()
		stopVoiceLevelMeter()
		const durationMs = Math.max(1, Date.now() - recordingStartedAtRef.current)
		setVoiceDurationMs(durationMs)
		setIsRecordingVoice(false)
		await new Promise<void>(resolve => {
			recorder.onstop = () => resolve()
			recorder.stop()
		})
		recorder.stream.getTracks().forEach(track => track.stop())
		recorderRef.current = null
		const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
		recordingChunksRef.current = []
		if (!blob.size) {
			setVoiceError('No audio was recorded. Please try again.')
			return
		}
		setVoiceDraftBlob(blob)
		setVoiceRecordedBytes(blob.size)
		setVoiceError(null)
	}, [stopVoiceDurationTimer, stopVoiceLevelMeter])

	const cancelVoiceDraft = useCallback(() => {
		if (voiceSending) return
		setVoiceDraftBlob(null)
		setVoiceDurationMs(0)
		setVoiceRecordedBytes(0)
		setVoiceError(null)
	}, [voiceSending])

	const sendVoiceDraft = useCallback(async () => {
		if (!voiceDraftBlob || voiceSending || !profiles?.[0]?.privateKeyArmor) return
		setVoiceSending(true)
		setVoiceError(null)
		try {
			const encrypted = await encryptVoiceBlob(voiceDraftBlob, voiceDurationMs)
			const fragmentHash = await uploadEncryptedVoiceDataUrl(
				profiles[0].privateKeyArmor,
				encrypted.dataUrl,
			)
			const now = Date.now()
			const sendId = crypto.randomUUID()
			const payload: ChatMessage = {
				id: `tmp_${now}_${Math.random().toString(16).slice(2)}`,
				sendId,
				from: 'me',
				text: '',
				createdAt: now,
				status: 'sending',
				voiceMessage: { ...encrypted.manifest, fragmentHash },
			}
			const next = [...(messagesRef.current || []), payload]
			messagesRef.current = next
			setMessages(next)
			const wirePayload = {
				sendId,
				from: 'me' as const,
				text: '',
				createdAt: now,
				voiceMessage: payload.voiceMessage,
			}
			const sent = await sendMessage(
				chatData.chatData.publicArmored,
				JSON.stringify(wirePayload),
				privateKey,
				allNodes,
			)
			const settled = next.map(message =>
				message.id === payload.id ? { ...message, status: sent ? 'sent' as const : 'failed' as const } : message,
			)
			messagesRef.current = settled
			setMessages(settled)
			chatData.messages = settled
			await storageDataRef.current?.()
			if (sent) mirrorChatMessageToHistory(chatData.address, settled.find(message => message.id === payload.id), 'out')
			else setVoiceError('Voice message failed to reach CoNET entry nodes. Please retry.')
			if (sent) {
				setVoiceDraftBlob(null)
				setVoiceDurationMs(0)
				setVoiceRecordedBytes(0)
			}
		} catch (error) {
			setVoiceError(error instanceof Error ? error.message : 'Voice message could not be sent.')
		} finally {
			setVoiceSending(false)
		}
	}, [allNodes, chatData, privateKey, profiles, voiceDraftBlob, voiceDurationMs, voiceSending])

	const reflashdata = async () => {
		if (!profiles?.length) return

		const p0: profile = profiles[0]
		const chats = Array.isArray(p0?.chats) ? p0.chats : []
		if (!chats.length) return

		const addr = String(chatData.address || "").toLowerCase()
		if (!addr) return

		const myChat = chats.find(n => String(n.address || "").toLowerCase() === addr)
		if (!myChat) return

		// profiles/落盘的消息（“远端”）
		const remoteStored = Array.isArray(myChat.messages) ? myChat.messages : []
		const remote = await Promise.all(remoteStored.map(async message => {
			if (message.fileMessage || !message.fileMessageCipher || !privateKey) return message
			const fileMessage = await decryptLocalFileManifest(message.fileMessageCipher, privateKey)
			return fileMessage ? { ...message, fileMessage } : message
		}))

		// 本地 UI 正在显示的消息（可能包含 tmp_ / 更先进的 status）
		const local = [
			...(Array.isArray(messagesRef.current) ? messagesRef.current : []),
			...liveFileMessagesRef.current.values(),
		]

		// 建索引：local by id 与 sendId（远端可能用任一来匹配）
		const localById = new Map<string, ChatMessage>()
		for (const m of local) {
			if (m?.id) localById.set(m.id, m)
			if (m?.sendId) localById.set(m.sendId, m)
		}

		// ✅ 1) 先以 remote 为基础，逐条 merge：取双方更高 status；local tmp_ 字段补齐
		const merged: ChatMessage[] = remote.map(rm => {
			const lm =
				localById.get(rm.sendId ?? '') ||
				localById.get(rm.id ?? '') ||
				null
			if (!lm) return rm

			const remoteRank = statusRank(rm.status)
			const localRank = statusRank(lm.status)
			if (localRank > remoteRank) {
				return { ...rm, ...lm, status: lm.status }
			}
			if (remoteRank > localRank) {
				return {
					...rm,
					...(lm.fileMessage && !rm.fileMessage ? { fileMessage: lm.fileMessage } : {}),
					status: rm.status,
				}
			}
			// equal rank: remote text/payload wins; keep local status if set
			if (lm.status && lm.status !== rm.status) {
				return {
					...rm,
					...(lm.fileMessage && !rm.fileMessage ? { fileMessage: lm.fileMessage } : {}),
					status: lm.status,
				}
			}
			return {
				...rm,
				...(lm.fileMessage && !rm.fileMessage ? { fileMessage: lm.fileMessage } : {}),
			}
		})

		// ✅ 2) 把 local 里仍然存在但 remote 里没有的 tmp_ 消息追加回去（防止被冲掉）
		const remoteIdSet = new Set(remote.map(m => m.id ?? m.sendId ?? '').filter(Boolean))
		const localTempExtras = local.filter(m => (m.id && isTempId(m.id)) && !remoteIdSet.has(m.id))

		const next = [...merged, ...localTempExtras]
			.slice()
			.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))

		// Repair messages that survived only in this device's local chat mirror.
		// HistoryStore de-duplicates by sendId before uploading, so this is safe
		// to run whenever the conversation is opened/refreshed.
		backfillChatMessagesToHistory(chatData.address, next)

		// ✅ 3) 刷 UI
		pendingInitialScrollRef.current = true
		messagesRef.current = next
		setMessages(next)
	}

	// ✅ 放在 Chat 组件内部，refs 声明处附近
	const didInitialScrollRef = useRef(false)     // 只允许“首次到底”执行一次
	const pendingInitialScrollRef = useRef(true)  // 用于 reflashdata 异步回来后也能触发一次

	const scrollToBottom = (mode: "auto" | "smooth" = "auto") => {
	const el = scrollRef.current
	
	if (!el) return
	// 直接到底（不依赖 scrollHeight - clientHeight）
	el.scrollTo({ top: el.scrollHeight, behavior: mode })
	}

	// ✅ 1) 首次进入：用 useLayoutEffect，避免初次渲染闪烁
	useLayoutEffect(() => {
		if (didInitialScrollRef.current) return

		requestAnimationFrame(() => {
			scrollToBottom("auto")
			showCapsuleNow()
			didInitialScrollRef.current = true
			// 这里不要 pendingInitialScrollRef.current = false
			// 让 pending 那个 effect 负责“最终一次的清 unread”
		})
	}, [showCapsuleNow])

	/** 菜单与定位相关常量：菜单估算高度、间距、底部输入栏预留 */
	const MENU_EST_H = 150
	const MENU_GAP = 8
	const BOTTOM_RESERVED = 132

	function commitReactionUI(m: ChatMessage, el: HTMLElement, isMe: boolean) {
		const r = el.getBoundingClientRect()
		// iOS 风格：菜单宽度适中，可横向滚动显示更多
		const menuWidth = Math.min(280, window.innerWidth - 24)
		const x = clamp(r.left + r.width / 2 - menuWidth / 2, 12, window.innerWidth - menuWidth - 12)
		// 放在气泡上方，留出小间隙
		const y = clamp(r.top - 48, 12, window.innerHeight - 120)
		setReactionUI({
			open: true,
			messageId: m.sendId ?? m.id ?? '',
			x,
			y,
			placement: "top",
			rect: { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom },
			isMe,
			text: m.text || '',
			hasCard: !!m.paymentCard,
			createdAt: m.createdAt,
		})
	}

	function openReactionBarForElement(m: ChatMessage, el: HTMLElement, isMe: boolean) {
		const scroller = scrollRef.current
		const vh = typeof window !== 'undefined' ? window.innerHeight : 667
		const safeBottom = vh - BOTTOM_RESERVED
		const r0 = el.getBoundingClientRect()
		// 菜单显示在气泡下方，需要的底部边界
		const menuBottom = r0.bottom + MENU_GAP + MENU_EST_H
		const overflow = menuBottom - safeBottom

		// 不会被遮挡：直接显示
		if (overflow <= 0 || !scroller) {
			commitReactionUI(m, el, isMe)
			return
		}

		const maxScroll = scroller.scrollHeight - scroller.clientHeight
		const canScrollMore = Math.max(0, maxScroll - scroller.scrollTop)

		if (overflow <= canScrollMore) {
			// 还能继续向上滚动：滚动到位后再显示
			scroller.scrollTop = scroller.scrollTop + overflow
			requestAnimationFrame(() => commitReactionUI(m, el, isMe))
			return
		}

		// 无法继续滚动（如最新一条）：增加底部额外空间，再滚动上提
		const extra = overflow - canScrollMore + 24
		setMenuBottomSpacer(prev => Math.max(prev, extra))
		requestAnimationFrame(() => {
			const sc = scrollRef.current
			if (sc) {
				const newMax = sc.scrollHeight - sc.clientHeight
				sc.scrollTop = Math.min(newMax, sc.scrollTop + overflow)
			}
			requestAnimationFrame(() => commitReactionUI(m, el, isMe))
		})
	}

		function closeReactionBar() {
		setReactionUI(prev => ({ ...prev, open: false, messageId: undefined }))
		setMenuBottomSpacer(0)
	}

	/** Copy Text：复制被长按消息的文本 */
	function handleCopyMessageText() {
		const t = reactionUI.text || ''
		if (t) {
			try { navigator.clipboard.writeText(t) } catch { /* ignore */ }
		}
		closeReactionBar()
	}

	/** Reply：以被长按消息为引用，聚焦输入框 */
	function handleReplyToMessage() {
		const id = reactionUI.messageId
		const t = reactionUI.text || ''
		if (id) {
			setReplyTo({ id, text: t, from: reactionUI.isMe ? 'me' : 'them' })
			requestAnimationFrame(() => inputRef.current?.focus())
		}
		closeReactionBar()
	}

	/** Delete：本地删除该消息（及其 reaction 引用），并落盘 */
	async function handleDeleteMessage() {
		const id = reactionUI.messageId
		closeReactionBar()
		if (!id) return
		const next: ChatMessage[] = (messagesRef.current || []).filter(m => {
			const mid = m.sendId ?? m.id ?? ''
			if (mid === id) return false
			// 同时删除指向该消息的 reaction / reply
			if (m.reply?.messageId === id) return false
			return true
		})
		messagesRef.current = next
		setMessages(next)
		chatData.messages = next
		await storageData()
	}

	/** 发送 reaction：带 reply 指针的消息，对方可根据 messageId 找到原消息并显示 icon */
	async function sendReaction(targetMessageId: string, reactionKey: string) {
		closeReactionBar()
		if (!profiles?.length || !chatData?.chatData?.publicArmored) return
		const tempId = `tmp_reaction_${Date.now()}_${Math.random().toString(16).slice(2)}`
		const now = Date.now()
		const payload: ChatMessage = {
			id: tempId,
			from: 'me',
			text: '',
			createdAt: now,
			status: 'sending',
			reply: { messageId: targetMessageId, reactionKey },
		}
		{
			const next: ChatMessage[] = [...(messagesRef.current || []), payload]
			messagesRef.current = next
			setMessages(next)
		}
		if (!allNodes?.length) {
			const next = (messagesRef.current || []).map(m =>
				m.id === tempId ? { ...m, status: 'failed' as const } : m
			)
			messagesRef.current = next
			setMessages(next)
			chatData.messages = next
			await storageData()
			return
		}
		let ok = false
		try {
			ok = !!(await sendMessage(chatData.chatData.publicArmored, JSON.stringify(payload), privateKey, allNodes))
		} catch {
			ok = false
		}
		const next: ChatMessage[] = (messagesRef.current || []).map(m =>
			m.id === tempId ? { ...m, status: (ok ? 'sent' : 'failed') as 'sent' | 'failed' } : m
		)
		messagesRef.current = next
		setMessages(next)
		chatData.messages = next
		await storageData()
	}

	/** 发送方取消 Payment Request：发送一条 reply 指向该卡片的 paymentRequestCancel 消息；完成后才把消息加入列表并显示 decline 信息 */
	async function sendPaymentRequestCancel(targetSendId: string) {
		if (!profiles?.length || !chatData?.chatData?.publicArmored) return
		setDeclineLoadingForSendId(targetSendId)
		const now = Date.now()
		const payload: ChatMessage = {
			id: `tmp_cancel_pr_${now}_${Math.random().toString(16).slice(2)}`,
			from: 'me',
			text: '',
			createdAt: now,
			status: 'sent',
			reply: { messageId: targetSendId, replyType: 'paymentRequestCancel' },
		}
		try {
			if (!allNodes?.length) {
				return
			}
			const ok = !!(await sendMessage(chatData.chatData.publicArmored, JSON.stringify(payload), privateKey, allNodes))
			if (ok) {
				const next: ChatMessage[] = [...(messagesRef.current || []), payload]
				messagesRef.current = next
				setMessages(next)
				chatData.messages = next
				await storageData()
			}
		} finally {
			setDeclineLoadingForSendId(null)
		}
	}

	/** 执行 Payment Request 的 USDC 转账（与 PayScreen BeamioTransfer workflow 一致）。使用显式参数 currency/currencyAmount/usdcAmount。 */
	async function executePaymentRequestTransfer(
		prSendId: string,
		usdcAmountNum: number,
		toAddress: string,
		originalCurrency: ICurrency,
		originalCurrencyAmount: string
	) {
		if (!profiles?.length || !chatData?.chatData?.publicArmored || !toAddress) {
			setPayTransferError('Missing profile or chat')
			return
		}
		setPayTransferLoading(prSendId)
		setPayTransferError(null)
		const usdcAmountStr = usdcAmountNum > 0 ? usdcAmountNum.toFixed(6) : '0'
		const params = new URLSearchParams({
			amount: usdcAmountStr,
			usdcAmount: usdcAmountStr,
			currency: originalCurrency,
			currencyAmount: originalCurrencyAmount,
			toAddress,
			note: '',
		}).toString()
		const requestEndpoint = `${aptEndpoint}/api/BeamioTransfer?${params}`
		try {
			const response = await fetch(requestEndpoint, { method: 'GET' })
			if (response.status !== 402) {
				setPayTransferError('Transfer request failed')
				setPayTransferLoading(null)
				return
			}
			const { accepts } = await response.json().catch(() => ({}))
			const message = Array.isArray(accepts) ? accepts[0] : null
			if (!message?.payTo || message.maxAmountRequired == null) {
				setPayTransferError('Invalid payment challenge')
				setPayTransferLoading(null)
				return
			}
			const pay = BigInt(Number(message.maxAmountRequired).toFixed(0))
			const paymentHeader = await AuthorizationSign(pay, message.payTo)
			if (!paymentHeader) {
				setPayTransferError(tu('sign_failed'))
				setPayTransferLoading(null)
				return
			}
			const secondResponse = await fetch(message.data?.reqUrl ?? requestEndpoint, {
				method: 'GET',
				headers: { 'X-PAYMENT': paymentHeader, 'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE' },
				// @ts-ignore
				__is402Retry: true,
			})
			const body = await secondResponse.json().catch(() => ({}))
			if (!secondResponse.ok || !body?.USDC_tx) {
				setPayTransferError(body?.error || 'Transfer failed')
				setPayTransferLoading(null)
				return
			}
			const txHash = body.USDC_tx
			const now = Date.now()
			const tempId = `tmp_paid_pr_${now}_${Math.random().toString(16).slice(2)}`
			const payload: ChatMessage = {
				id: tempId,
				from: 'me',
				text: '',
				createdAt: now,
				status: 'sent',
				reply: { messageId: prSendId, replyType: 'paymentRequestPaid', paymentHash: txHash },
			}
			const next: ChatMessage[] = [...(messagesRef.current || []), payload]
			messagesRef.current = next
			setMessages(next)
			chatData.messages = next
			if (allNodes?.length) {
				try {
					await sendMessage(chatData.chatData.publicArmored, JSON.stringify(payload), privateKey, allNodes)
				} catch (_) {}
			}
			await storageData()
			setPayConfirmForSendId(null)
		} catch (e) {
			setPayTransferError((e as Error)?.message || 'Transfer failed')
		} finally {
			setPayTransferLoading(null)
		}
	}

	type paymentCard = {
		amount: number
		token: ICurrency
		approx: string
		title: string
		timeStamp: number
	}

	useEffect(() => {
		messagesRef.current = messages
	}, [messages])

	useLayoutEffect(() => {
		setShowFooter(false)
		return () => setShowFooter(true)
	}, [])

	const statusRank = (s?: ChatMessage["status"]) => {
	if (s === "delivered") return 4
	if (s === "sent") return 3
	if (s === "failed") return 3
	if (s === "sending") return 2
	return 1 // undefined / 其它
	}

	const isTempId = (id: string) => /^tmp_/i.test(id || "")


	useEffect(() => {
		// ✅ 如果这次 profiles 变化来自本组件 storageData()，跳过一次 reflashdata
		if (skipNextReflashdataRef.current) {
			skipNextReflashdataRef.current = false
			return
		}

		if (runningRef.current) return
		runningRef.current = true

		;(async () => {
			try {
			await reflashdata()
			} finally {
			runningRef.current = false
			}
		})()
	}, [profiles])



	// textarea 自适应高度
	useEffect(() => {
		const el = inputRef.current
		if (!el) return
		el.style.height = "0px"
		const next = Math.min(140, Math.max(44, el.scrollHeight))
		el.style.height = `${next}px`
	}, [text])

	const forceClearUnread = () => {
		const ps = Array.isArray(profiles) ? profiles : []
		if (ps.length === 0 || !chatData?.address) return

		const addr = chatData.address.toLowerCase()
		const now = Date.now()

		// ✅ 先判断：当前 unread 是否真的 > 0，不需要清就直接退出
		const p0 = ps[0]
		const chats0: chatData[] = Array.isArray(p0?.chats) ? p0.chats : []
		const idx0 = chats0.findIndex(c => c.address?.toLowerCase() === addr)
		const cur = idx0 >= 0 ? chats0[idx0] : null
		if (!cur || Number(cur.unreadCount || 0) <= 0) return

		// ✅ 1) React state
		setProfiles(prev => {
			if (!prev?.length) return prev
			const p = prev[0]
			const chats = Array.isArray(p.chats) ? p.chats : []
			const idx = chats.findIndex(c => c.address?.toLowerCase() === addr)
			if (idx < 0) return prev

			const nextChats = chats.slice()
			const old = nextChats[idx]
			nextChats[idx] = {
			...old,
			unreadCount: 0,
			lastReadTs: Math.max(Number(old?.lastReadTs || 0), now)
			}

			const next = prev.slice()
			next[0] = { ...p, chats: nextChats }
			return next
		})

		// ✅ 2) CoNET_Data snapshot（让 storeSystemData 写到最新）
		const temp = CoNET_Data
		if (temp) {
			const nextChats = chats0.slice()
			const old = nextChats[idx0]
			nextChats[idx0] = {
			...old,
			unreadCount: 0,
			lastReadTs: Math.max(Number(old?.lastReadTs || 0), now)
			}
			const nextProfiles = ps.slice()
			nextProfiles[0] = { ...p0, chats: nextChats }
			temp.profiles = nextProfiles
			setCoNET_Data(temp)
		}

		void storeSystemData()
	}

	type UrlKind = "cashcode" | "paymentlink" | "beamio" | "url"

	const isUrl = (input: string): UrlKind | undefined => {
		if (!input || typeof input !== "string") return
	  
		let searchParams: URLSearchParams
	  
		try {
		  // 尝试作为完整 URL 解析
		  const u = new URL(input)
		  searchParams = u.searchParams
		} catch {
		  // 再尝试作为 query string 解析
		  try {
			searchParams = new URLSearchParams(input)
		  } catch {
			// 两种都失败 → 非 URL
			return
		  }
		}
	  
		const code = searchParams.get("code") || ""
		const secureCode =
		  searchParams.get("secureCode") ||""
		const cashcode = searchParams.get("cashcode") || ""
		const beamio = searchParams.get("beamio") || ""
	  
		if (beamio) return "beamio"
		if (secureCode || cashcode) return "cashcode"
		if (code) return "paymentlink"
	  
		// 是 URL，但不属于你关心的类型
		return "url"
	  }

	 


	const clearChatInput = () => {
		suppressImeEchoRef.current = true
		imeComposingRef.current = false
		if (suppressImeEchoTimerRef.current != null) {
			window.clearTimeout(suppressImeEchoTimerRef.current)
			suppressImeEchoTimerRef.current = null
		}
		const el = inputRef.current
		if (el) {
			try {
				el.blur()
			} catch {
				/* ignore */
			}
			el.value = ""
		}
		flushSync(() => setText(""))
		// Destroy the composing IME session: controlled value="" alone cannot undo DOM writes from compositionend.
		flushSync(() => setInputSession(s => s + 1))
		queueMicrotask(() => {
			flushSync(() => setText(""))
			if (inputRef.current) inputRef.current.value = ""
		})
		// CJK IME on iOS/Android WebView often emits late input/compositionend (100–300ms).
		suppressImeEchoTimerRef.current = window.setTimeout(() => {
			flushSync(() => setText(""))
			if (inputRef.current) inputRef.current.value = ""
			suppressImeEchoRef.current = false
			suppressImeEchoTimerRef.current = null
		}, 400)
	}

	const sendFileDrafts = useCallback(async () => {
		const ready = fileJobs.filter(job => job.status === 'ready' && job.manifest)
		if (!ready.length || !privateKey || !allNodes?.length) return
		for (const job of ready) {
			const now = Date.now()
			const sendId = crypto.randomUUID()
			const payload: ChatMessage = {
				id: `tmp_${now}_${Math.random().toString(16).slice(2)}`,
				sendId,
				from: 'me',
				text: '',
				createdAt: now,
				status: 'sending',
				fileMessage: job.manifest,
			}
			if (payload.sendId) liveFileMessagesRef.current.set(payload.sendId, payload)
			const next = [...(messagesRef.current || []), payload]
			messagesRef.current = next
			setMessages(next)
			const sent = await sendMessage(chatData.chatData.publicArmored, JSON.stringify({
				sendId, from: 'me', text: '', createdAt: now, fileMessage: job.manifest,
			}), privateKey, allNodes).catch(() => false)
			const settled = next.map(message => message.id === payload.id ? { ...message, status: sent ? 'sent' as const : 'failed' as const } : message)
			messagesRef.current = settled
			setMessages(settled)
			chatData.messages = settled
			const settledFileMessage = settled.find(message => message.id === payload.id)
			if (settledFileMessage?.sendId) {
				liveFileMessagesRef.current.set(settledFileMessage.sendId, settledFileMessage)
			}
			await storageData()
			if (sent) mirrorChatMessageToHistory(chatData.address, settledFileMessage, 'out')
			else setFileError('A file message failed to reach CoNET entry nodes. Please try again.')
			if (sent) setFileJobs(previous => {
				const removed = previous.find(item => item.id === job.id)
				if (removed?.thumbnailUrl) URL.revokeObjectURL(removed.thumbnailUrl)
				return previous.filter(item => item.id !== job.id)
			})
		}
	}, [allNodes, chatData, fileJobs, privateKey])

	async function send() {
		const temp = CoNET_Data
		if (!temp || !profiles?.length) return
		if (!toAddress || !hasRoute) return

		// Prefer DOM value so in-progress IME composition is included when user taps Send.
		const t = (inputRef.current?.value ?? text).trim()
		if (!t) {
			await sendFileDrafts()
			return
		}

		const nowGuard = Date.now()
		const prev = lastSentGuardRef.current
		if (prev.text === t && nowGuard - prev.at < 900) return
		lastSentGuardRef.current = { text: t, at: nowGuard }

		clearChatInput()

		const mode = isUrl(t)
		void mode


		const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`
		const now = Date.now()
		const sendId = crypto.randomUUID()

		// 引用回复：发送方视角 from 取反（我引用对方=them，引用自己=me）；接收方解析时同样取反还原
		const quoteForSend = replyTo
			? { id: replyTo.id, text: (replyTo.text || '').slice(0, 240), from: (replyTo.from === 'me' ? 'me' : 'them') as 'me' | 'them' }
			: undefined

		// ✅ 1) 先插入 sending（同步构造 next），带 sendId 供对方 reply 时引用
		const pendingMsg: ChatMessage = {
			id: tempId,
			sendId,
			from: "me",
			text: t,
			createdAt: now,
			status: "sending",
			...(quoteForSend ? { quote: quoteForSend } : {}),
		}

		{
			const next: ChatMessage[] = [...(messagesRef.current || []), pendingMsg]
			messagesRef.current = next
			setMessages(next)
		}

		// ✅ 2) entry pool（sendMessage 内部挑选健康节点并重试）
		if (!allNodes?.length) {
			const next: ChatMessage[] = (messagesRef.current || []).map(m =>
			m.id === tempId ? { ...m, status: "failed" as const } : m
			)
			messagesRef.current = next
			setMessages(next)

			chatData.messages = next
			await storageData()
			return
		}

		// ✅ 3) 发送：统一发 JSON 包，带 sendId，对方据此可 reply
		const payload = { sendId, from: 'me' as const, text: t, createdAt: now, ...(quoteForSend ? { quote: quoteForSend } : {}) }
		// 发送后清除引用草稿
		setReplyTo(null)
		let ok = false
		try {
			ok = !!(await sendMessage(chatData.chatData.publicArmored, JSON.stringify(payload), privateKey, allNodes))
		} catch {
			ok = false
		}

		if (!ok) {
			const next: ChatMessage[] = (messagesRef.current || []).map(m =>
			m.id === tempId ? { ...m, status: "failed" as const } : m
			)
			messagesRef.current = next
			setMessages(next)

			chatData.messages = next
			await storageData()
			setChatError('Message failed to reach CoNET entry nodes. Please try again.')
			return
		}

		// ✅ 4) 标记 sent（同步构造 next），并用同一份 next 去落盘
		{
			const next: ChatMessage[] = (messagesRef.current || []).map(m =>
			m.id === tempId ? { ...m, status: "sent" as const } : m
			)
			messagesRef.current = next
			setMessages(next)

			chatData.messages = next
			await storageData()

			// Mirror the settled outbound message into encrypted history (fresh-device recovery).
			const sentMsg = next.find(m => m.id === tempId)
			mirrorChatMessageToHistory(chatData.address, sentMsg, 'out')
		}
	}

	const sendAll = useCallback(async () => {
		const value = (inputRef.current?.value ?? text).trim()
		if (value) {
			await send()
			await sendFileDrafts()
		} else {
			await send()
		}
	}, [sendFileDrafts, text])

	useEffect(() => {
		if (chatData.unreadCount > 0) {
			clearedRef.current = false
		}
	}, [chatData.unreadCount])

	// 首次装载 / rehydrate 后贴底一次。媒体消息现在在 manifest 中携带
	// intrinsic width/height，外层先占位固定 aspect-ratio，不再用 ResizeObserver
	// 追踪异步 Blob 加载；反复 pin 会造成图片解密完成时页面抖动。
	useEffect(() => {
		if (!pendingInitialScrollRef.current) return
		if (!messages?.length) return

		const scroller = scrollRef.current
		if (!scroller) return
		const finishPinning = () => {
			pendingInitialScrollRef.current = false
			didInitialScrollRef.current = true
			showCapsuleNow()
			forceClearUnread()
		}
		let finishTimer: number | null = null
		const frame = requestAnimationFrame(() => {
			scrollToBottom("auto")
			finishTimer = window.setTimeout(finishPinning, 250)
		})

		return () => {
			cancelAnimationFrame(frame)
			if (finishTimer !== null) window.clearTimeout(finishTimer)
		}
	}, [messages.length, showCapsuleNow])

	// 当用户发送新消息后，视图自动滚动到最底部
	const prevMessagesLengthRef = useRef(messages.length)
	useEffect(() => {
		if (messages.length > prevMessagesLengthRef.current) {
			const last = messages[messages.length - 1]
			if (last?.from === 'me') {
				requestAnimationFrame(() => scrollToBottom('smooth'))
			}
			prevMessagesLengthRef.current = messages.length
		} else {
			prevMessagesLengthRef.current = messages.length
		}
	}, [messages])

	const findingRef = useRef(false)

	const findUser = useCallback(async () => {
		if (findingRef.current) return
		if (fromBeamio) return

		findingRef.current = true
		try {
			let account: searchResult|undefined = undefined
				const _account = await searchUsername(chatData.address)
				if (_account?.results?.[0]) account = _account.results[0]
			

			if (!account) {
				account = unknowAcc(chatData.address) 
			} 
			//@ts-ignore
			setbBeamioUsers(prev => {
			const addr = (account?.address || '').toLowerCase()
			//@ts-ignore
			if (prev.some(u => (u.address || '').toLowerCase() === addr)) return prev
				return [...prev, account!]
			})
			
			setfromBeamio(account)

			setUserImg(account.image||getImg(account.username))
		} finally {
			findingRef.current = false
			
		}
	}, [chatData])

	useEffect(() => {
		findUser()
	}, [chatData])

	const clearedRef = useRef(false)
	// 距离底部多少 px 视为“已到最底”
	const BOTTOM_EPS = 24

	const isAtBottom = () => {
		const el = scrollRef.current
		if (!el) return false
		const distance = el.scrollHeight - el.scrollTop - el.clientHeight
		return distance <= BOTTOM_EPS
	}

	const clearUnreadIfNeeded = () => {
		if (!chatData?.unreadCount || chatData.unreadCount <= 0) return
		if (!isAtBottom()) return

		// 避免在一次到底滚动中重复触发多次
		if (clearedRef.current) return
		clearedRef.current = true

		forceClearUnread()
	}

	const storageData = async () => {
		const temp = CoNET_Data
		const ps = Array.isArray(profiles) ? profiles : []
		if (!temp || ps.length === 0) return

		const p0: profile = ps[0]
		const chats: chatData[] = Array.isArray(p0?.chats) ? p0.chats : []

		const addr = String(chatData?.address || "").toLowerCase()
		if (!addr) return

		const idx = chats.findIndex(c => String(c?.address || "").toLowerCase() === addr)

		const persistableMessages = await Promise.all((chatData.messages || []).map(async message => {
			if (!message.fileMessage) return message
			const fileMessageCipher = privateKey
				? await encryptLocalFileManifest(message.fileMessage, privateKey)
				: undefined
			const { fileMessage: _fileMessage, ...safeMessage } = message
			return fileMessageCipher ? { ...safeMessage, fileMessageCipher } : safeMessage
		}))
		const persistableChat = { ...chatData, messages: persistableMessages }
		const persistableChats = idx >= 0
			? chats.map((c, i) => i === idx ? persistableChat : c)
			: [...chats, persistableChat]
		const nextProfile = { ...p0, chats: persistableChats }
		const nextProfiles = ps.slice()
		nextProfiles[0] = nextProfile

		// ✅ 关键：告诉 useEffect([profiles]) 这次更新是我自己触发的，不要 reflashdata 覆盖 messages
		skipNextReflashdataRef.current = true

		setProfiles(nextProfiles)

		const nextTemp = temp
		nextTemp.profiles = nextProfiles
		setCoNET_Data(nextTemp)

		await storeSystemData()
	}
	storageDataRef.current = storageData

	function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		// keyCode 229 = IME processing (Android WebView / legacy); isComposing = modern browsers
		const ne = e.nativeEvent
		if (ne.isComposing || ne.keyCode === 229 || imeComposingRef.current) return
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			void send()
		}
	}

	function onCompositionStart() {
		imeComposingRef.current = true
	}

	function onCompositionEnd(e: React.CompositionEvent<HTMLTextAreaElement>) {
		imeComposingRef.current = false
		if (suppressImeEchoRef.current) {
			e.currentTarget.value = ""
			flushSync(() => setText(""))
			return
		}
		if (hasRoute) setText(e.currentTarget.value)
	}

	function onBeforeInput(e: React.FormEvent<HTMLTextAreaElement>) {
		if (!suppressImeEchoRef.current) return
		e.preventDefault()
		const t = e.currentTarget
		t.value = ""
		if (text !== "") flushSync(() => setText(""))
	}

  // textarea 自适应高度（1~3行），超过3行时只显示最后3行
	useEffect(() => {
		const el = inputRef.current
		if (!el) return

		// 你现在的 textarea 是 leading-[20px]
		const lineH = 20
		const maxLines = 3
		const maxH = lineH * maxLines

		// reset -> measure
		el.style.height = "0px"
		const next = Math.min(maxH, Math.max(lineH, el.scrollHeight))
		el.style.height = `${next}px`

		// 超过3行：保持滚动在底部（只显示最后3行）
		// 注意：需要 textarea overflow-y-auto 才能内部滚动
		el.scrollTop = el.scrollHeight
	}, [text])

	


  return (
		<div
			className="fixed inset-0 bg-[#F1F8ED]"
			onDragEnter={handleChatFileDragEnter}
			onDragOver={handleChatFileDragOver}
			onDragLeave={handleChatFileDragLeave}
			onDrop={handleChatFileDrop}
		>
			<ChatHeaderIOS
				layerRef={setHeaderLayerRef}
				beamioer={fromBeamio}
				onBack={onBack}
				onCenterClick={() => {
					if (fromBeamio) setShowContactProfile(true)
				}}
				online={chatData.chatData.online}
				avatarSrc={userImg}
				onCall={voiceCallState === 'outgoing' ? endVoiceCall : startVoiceCall}
				onPhoneHistory={() => navigate('/phone')}
				callBusy={voiceCallState === 'outgoing'}
			/>
			{showContactProfile && fromBeamio ? (
				<div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-white dark:bg-slate-900">
					<div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
						<BeamioContactProfilePreview
							item={fromBeamio}
							close={() => setShowContactProfile(false)}
						/>
					</div>
				</div>
			) : null}
			{incomingVoiceOffer ? (
				<div
					className="pointer-events-auto fixed isolate left-4 right-4 top-[max(5.5rem,calc(env(safe-area-inset-top)+5rem))] z-[100] rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.16)] backdrop-blur-xl"
					role="dialog"
					aria-label="Incoming voice call"
					style={{ touchAction: 'manipulation' }}
				>
					<div className="flex items-center gap-3">
						<Phone className="h-5 w-5 text-[#1652f0]" aria-hidden />
						<div className="min-w-0 flex-1">
							<p className="text-sm font-semibold text-slate-800">Incoming voice call</p>
							<p className="text-xs text-slate-500">Accept to open a temporary encrypted relay.</p>
						</div>
						<button
							type="button"
							onClick={() => void acceptVoiceCall()}
							className="pointer-events-auto relative z-10 min-h-11 min-w-[76px] touch-manipulation rounded-full bg-[#1652f0] px-3 py-1.5 text-xs font-semibold text-white"
							aria-label="Accept incoming voice call"
						>
							Accept
						</button>
						<button
							type="button"
							onClick={() => void rejectVoiceCall()}
							className="pointer-events-auto relative z-10 min-h-11 min-w-[76px] touch-manipulation rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
							aria-label="Decline incoming voice call"
						>
							Decline
						</button>
					</div>
				</div>
			) : null}
			<audio ref={voicePlaybackAudioRef} className="hidden" preload="none" aria-hidden />

			{/* iOS 风格 Message Reaction 菜单：仅对收到的消息显示，在 message 上方，内容可左右滚动；一点展开/收缩动画 */}
			<AnimatePresence>
			{reactionUI.open && (
				<motion.div
					key="reaction-menu-layer"
					className="fixed inset-0 z-[200]"
					initial={{ scale: 0, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					exit={{ scale: 0, opacity: 0 }}
					transition={{
						duration: 0.28,
						ease: [0.22, 0.61, 0.36, 1],
					}}
					style={{
						transformOrigin: `${reactionUI.x}px ${reactionUI.y}px`,
					}}
				>
					<div
						className="absolute inset-0"
						aria-hidden
						onClick={closeReactionBar}
						onTouchStart={closeReactionBar}
					/>
					<div
						className="fixed z-[201] flex flex-col items-center pointer-events-none ml-4"
						style={{
							left: reactionUI.x,
							top: reactionUI.y,
							width: Math.min(280, typeof window !== 'undefined' ? window.innerWidth - 24 : 280),
						}}
					>
						{/* 主菜单：毛玻璃椭圆（恢复点击以操作内部按钮） */}
						<div
							className="relative flex items-center rounded-full bg-black/5 shadow-lg ring-1 ring-black/5 backdrop-blur-sm py-2 px-3 min-w-0 pointer-events-auto"
							style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
							onClick={e => e.stopPropagation()}
						>
							<div className="flex gap-0.5 overflow-x-auto overflow-y-hidden scrollbar-hide w-full max-w-[280px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
								{REACTIONS.map(({ key, label }) => (
									<button
										key={key}
										type="button"
										className="flex-shrink-0 w-9 h-9 rounded-full grid place-items-center text-xl active:scale-95 transition-transform hover:bg-black/5"
										onClick={() => {
											if (reactionUI.messageId) sendReaction(reactionUI.messageId, key)
										}}
										aria-label={key}
									>
										{label}
									</button>
								))}
							</div>
						</div>
					</div>

					{/* iOS 风格上下文菜单：在被长按气泡下方（位置空间不足时上移），与点赞 bar 并存 */}
					{(() => {
						const rect = reactionUI.rect
						if (!rect) return null
						const vw = typeof window !== 'undefined' ? window.innerWidth : 375
						const vh = typeof window !== 'undefined' ? window.innerHeight : 667
						const menuW = Math.min(244, vw - 24)
						// 以 item 为界：菜单始终在气泡下方、左对齐气泡左缘
						const menuLeft = clamp(rect.left, 12, vw - menuW - 12)
						const menuTop = clamp(rect.bottom + MENU_GAP, 12, vh - MENU_EST_H - 16)
						const hasText = !!(reactionUI.text && reactionUI.text.trim())
						const tsLabel = reactionUI.createdAt ? formatTimeLabel(reactionUI.createdAt) : ''
						return (
							<div
								className="fixed z-[202] pointer-events-auto"
								style={{ left: menuLeft, top: menuTop, width: menuW }}
								onClick={e => e.stopPropagation()}
							>
								<div className="overflow-hidden rounded-2xl bg-white/95 backdrop-blur-xl ring-1 ring-black/5 shadow-[0_12px_40px_rgba(15,23,42,0.18)] text-[15px] text-slate-900">
									<button
										type="button"
										onClick={handleReplyToMessage}
										className="flex w-full items-center justify-between gap-3 px-4 py-3 active:bg-black/5"
									>
										<span className="font-medium">Reply</span>
										<CornerUpLeft className="h-[18px] w-[18px] text-slate-500" strokeWidth={2} />
									</button>
									{hasText && (
										<>
											<div className="h-px bg-black/5" />
											<button
												type="button"
												onClick={handleCopyMessageText}
												className="flex w-full items-center justify-between gap-3 px-4 py-3 active:bg-black/5"
											>
												<span className="font-medium">Copy Text</span>
												<Copy className="h-[18px] w-[18px] text-slate-500" strokeWidth={2} />
											</button>
										</>
									)}
									{tsLabel && (
										<>
											<div className="h-px bg-black/10" />
											<div className="px-4 py-2.5 text-[12px] text-slate-400">{tsLabel}</div>
										</>
									)}
									<div className="h-px bg-black/5" />
									<button
										type="button"
										onClick={handleDeleteMessage}
										className="flex w-full items-center justify-between gap-3 px-4 py-3 active:bg-rose-50"
									>
										<span className="font-medium text-rose-600">Delete</span>
										<Trash2 className="h-[18px] w-[18px] text-rose-500" strokeWidth={2} />
									</button>
								</div>
							</div>
						)
					})()}
				</motion.div>
			)}
			</AnimatePresence>

			{/* 内容区：消息列表 */}
			<div
				className={["absolute inset-0", "bg-[#F1F8ED]"].join(" ")}
				style={{
					// paddingTop: "calc(env(safe-area-inset-top) + 140px)",
					// paddingBottom: "calc(env(safe-area-inset-bottom) + 112px)"
				}}
			>
			{/* 顶部白色渐变蒙版 */}
			<div
				className="absolute left-0 right-0 top-0 h-[10rem] pointer-events-none z-10"
				style={{ background: "linear-gradient(to bottom, rgba(241,248,237,1) 0%, rgba(241,248,237,0) 100%)" }}
				aria-hidden
			/>
			{/* 底部白色渐变蒙版 */}
			<div
				className="absolute left-0 right-0 bottom-0 h-[10rem] pointer-events-none z-10"
				style={{ background: "linear-gradient(to top, rgba(241,248,237,1) 0%, rgba(241,248,237,0) 100%)" }}
				aria-hidden
			/>
			<div
				ref={setChatScrollRef}
				className="relative h-full overscroll-contain overflow-y-auto px-4 py-4"
				style={{
					// Image/IPFS decoding can change descendants after the first
					// paint. Disable browser scroll anchoring so WebView/browser
					// does not repeatedly compensate the viewport and appear to
					// shake while media messages settle.
					overflowAnchor: 'none',
				}}
				onScroll={() => {
				clearUnreadIfNeeded()
				}}
			>
				{fileDropActive ? (
					<div
						className="fixed inset-0 z-[120] grid place-items-center border-2 border-dashed border-[#1652f0]/70 bg-[#dceaff]/55 backdrop-blur-sm"
						onDragEnter={handleChatFileDragEnter}
						onDragOver={handleChatFileDragOver}
						onDrop={handleChatFileDrop}
					>
						<div className="pointer-events-none rounded-2xl bg-white/85 px-6 py-4 text-center shadow-lg ring-1 ring-white/80">
							<p className="text-base font-semibold text-[#1652f0]">Drop files to attach</p>
							<p className="mt-1 text-xs text-slate-500">Files and folders are encrypted before upload.</p>
						</div>
					</div>
				) : null}
				<div className="min-h-full flex flex-col justify-end">
				<div className="mx-auto w-full max-w-[820px]">
					<div aria-hidden className="h-[96px]" />
					<AnimatePresence initial={false}>
							{sections.map(sec => (
									<div key={sec.key}>
									<ChatSectionHeader title={sec.title} />

									{sec.items.map(m => {
										const isMe = m.from === "me"
										const multisigPreview = parseAaMultisigChatPreview(m.text)
										const hasMultisigCard = !!multisigPreview
										const hasCard = !!m.paymentCard
										const hasVoice = !!m.voiceMessage
										const hasFile = !!m.fileMessage
										const shareUrl =
											!hasMultisigCard && !hasCard && isPrimarilyBeamioShareLinkMessage(m.text)
												? findBeamioShareUrlInText(m.text)
												: null
										const hasShareLinkCard = !!shareUrl
										const genericUrl =
											!hasMultisigCard && !hasCard && !hasShareLinkCard && isPrimarilyHttpUrlMessage(m.text)
												? findHttpUrlInText(m.text)
												: null
										const hasGenericLinkCard = !!genericUrl
										const reactionBadges = (() => {
											const reactions = getReactionsForMessage(m)
											const show = reactions?.slice(-2) ?? []
											if (!show.length) return null
											const hasMyReply = show.some(r => r.from === 'me')
											return (
												<div
													className={`absolute -top-2 -left-2 z-10 flex items-center gap-0.5 rounded-tl-xl rounded-tr-xl rounded-br-xl rounded-bl-[6px] px-1.5 py-1 shadow-lg ring-1 ring-black/5 ${hasMyReply ? 'bg-[#1652f0]/80' : 'bg-slate-100/90'}`}
													aria-hidden
												>
													{show.map((r, i) => (
														<span key={`${r.reactionKey}-${i}`} className="text-base leading-none">
															{REACTIONS.find(x => x.key === r.reactionKey)?.label ?? r.reactionKey}
														</span>
													))}
												</div>
											)
										})()

										return (
										<motion.div
											key={m.id}
											initial={{ opacity: 0, y: 6 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, y: 6 }}
											transition={{ type: "spring", stiffness: 520, damping: 40 }}
											className={["w-full flex mb-2", isMe ? "justify-end" : "justify-start"].join(" ")}
										>
											<div className="max-w-[78%] sm:max-w-[62%]">
											{hasFile && m.fileMessage ? (
												<div
													className="relative"
													onPointerDown={e => {
														if (e.pointerType === "mouse" && e.button !== 0) return
														if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
														const target = e.currentTarget as HTMLElement
														pressTimerRef.current = window.setTimeout(() => openReactionBarForElement(m, target, isMe), 450)
													}}
													onPointerUp={() => { if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current); pressTimerRef.current = null }}
													onPointerCancel={() => { if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current); pressTimerRef.current = null }}
													onPointerLeave={() => { if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current); pressTimerRef.current = null }}
													onContextMenu={e => { e.preventDefault(); openReactionBarForElement(m, e.currentTarget as HTMLElement, isMe) }}
												>
													{reactionBadges}
													<ChatFileMessagePlayer manifest={m.fileMessage} isMe={isMe} />
													{isMe ? <div className="absolute -bottom-2 -right-2"><BubbleCornerStatus status={m.status} /></div> : null}
												</div>
											) : hasVoice && m.voiceMessage ? (
												<div
													className="relative"
													onPointerDown={e => {
														if (e.pointerType === "mouse" && e.button !== 0) return
														if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
														const target = e.currentTarget as HTMLElement
														pressTimerRef.current = window.setTimeout(() => openReactionBarForElement(m, target, isMe), 450)
													}}
													onPointerUp={() => { if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current); pressTimerRef.current = null }}
													onPointerCancel={() => { if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current); pressTimerRef.current = null }}
													onPointerLeave={() => { if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current); pressTimerRef.current = null }}
													onContextMenu={e => { e.preventDefault(); openReactionBarForElement(m, e.currentTarget as HTMLElement, isMe) }}
												>
													{reactionBadges}
													<VoiceMessagePlayer manifest={m.voiceMessage} isMe={isMe} />
													{isMe && (
														<div className="absolute -bottom-2 -right-2">
															<BubbleCornerStatus status={m.status} onRetry={() => setVoiceError('Please record and send the voice message again.')} />
														</div>
													)}
												</div>
											) : hasMultisigCard && multisigPreview ? (
												<AaMultisigChatRequestCard
													preview={(() => {
														const stored =
															walletEoa && multisigPreview.taskId
																? getAaMultisigTaskAny(walletEoa, multisigPreview.taskId)
																: null
														if (!stored || !walletEoa) return multisigPreview
														return enrichMultisigChatPreview(
															multisigPreview,
															stored,
															walletEoa
														)
													})()}
													timeLabel={fmtTime(getMsgTs(m))}
													isMe={isMe}
													onOpen={() =>
														openMultisigFromChat(
															m.text,
															isMe,
															multisigPreview.taskId,
															multisigPreview.aaAccount
														)
													}
												/>
											) : hasCard ? (
												<div
													className="relative"
													onPointerDown={e => {
														if (e.pointerType === "mouse" && e.button !== 0) return
														if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
														const target = e.currentTarget as HTMLElement
														pressTimerRef.current = window.setTimeout(() => {
															openReactionBarForElement(m, target, isMe)
														}, 450)
													}}
													onPointerUp={() => {
														if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
														pressTimerRef.current = null
													}}
													onPointerCancel={() => {
														if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
														pressTimerRef.current = null
													}}
													onPointerLeave={() => {
														if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
														pressTimerRef.current = null
													}}
													onContextMenu={e => {
														e.preventDefault()
														openReactionBarForElement(m, e.currentTarget as HTMLElement, isMe)
													}}
												>
												{(() => {
													const reactions = getReactionsForMessage(m)
													const show = reactions?.slice(-2) ?? []
													if (!show.length) return null
													const hasMyReply = show.some(r => r.from === 'me')
													return (
														<div
															className={["absolute -top-2 -left-2 z-10 flex items-center gap-0.5 rounded-tl-xl rounded-tr-xl rounded-br-xl rounded-bl-[6px] px-1.5 py-1 shadow-lg ring-1 ring-black/5", hasMyReply ? "bg-[#1652f0]/80" : "bg-slate-100/15"].join(" ")}
															style={{ boxShadow: '0 3px 12px rgba(0,0,0,0.2)' }}
															aria-hidden
														>
															{show.map((r, i) => {
																const label = REACTIONS.find(x => x.key === r.reactionKey)?.label ?? r.reactionKey
																return <span key={`${r.reactionKey}-${i}`} className="text-base leading-none" title={r.reactionKey}>{label}</span>
															})}
														</div>
													)
												})()}
												{m.paymentCard!.cardType === "paymentRequest" ? (
													(() => {
														const prCancelled = m.sendId ? cancelledPaymentRequestSendIds.has(m.sendId) : false
														const prPaid = m.sendId ? paidPaymentRequestMap.has(m.sendId) : false
														const prDeclineLoading = declineLoadingForSendId === (m.sendId ?? m.id ?? '')
														const prPayConfirm = !isMe && !prCancelled && !prPaid && payConfirmForSendId === (m.sendId ?? m.id ?? '')
														const pc = m.paymentCard!
														// USDC amount: for USDC request use stored value; for fiat convert at current rate when receiver clicks Pay
														const usdcForConfirm = pc.currency === 'USDC'
															? Number(pc.usdcAmount || 0)
															: (() => { const rate = fxRateUSDCToCurrency(pc.currency); return rate > 0 ? Number(pc.amount) / rate : 0 })()
														const usdcStr = Number.isFinite(usdcForConfirm) ? usdcForConfirm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
														const prLoading = payTransferLoading === (m.sendId ?? m.id ?? '')
														let actionBlock: React.ReactNode
														if (prPaid) {
															const paidInfo = m.sendId ? paidPaymentRequestMap.get(m.sendId) : null
															const hash = paidInfo?.hash ?? ''
															actionBlock = (
																<>
																	<div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200/80 py-3 px-4">
																		<CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
																		<span className="text-[13px] font-semibold text-emerald-700">Payment Sent</span>
																	</div>
																	{hash && (
																		<div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 mt-2">
																			<code className="flex-1 text-[10px] text-slate-600 truncate" title={hash}>{hash.slice(0, 10)}…{hash.slice(-8)}</code>
																			<button type="button" onClick={() => navigator.clipboard.writeText(hash)} className="p-1 text-slate-500 hover:text-slate-700" aria-label={tu('copy')}><Copy className="w-3.5 h-3.5" /></button>
																			<button type="button" onClick={() => openExternalUrl(baseExplorerTxUrl(hash))} className="p-1 text-slate-500 hover:text-slate-700" aria-label="Open explorer"><ExternalLink className="w-3.5 h-3.5" /></button>
																		</div>
																	)}
																</>
															)
														} else if (prCancelled) {
															actionBlock = null
														} else if (prPayConfirm) {
															const insufficientBalance = Number(usdcbalance) < usdcForConfirm
															actionBlock = (
																<div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 space-y-2">
																	<div className="text-[11px] text-slate-600 leading-tight">
																		Pay with EOA account USDC (converted at current rate): <span className="font-semibold tabular-nums">{usdcStr} USDC</span>
																	</div>
																	{insufficientBalance && (
																		<div className="text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">{tu('insufficient_balance')}</div>
																	)}
																	{payTransferError && (
																		<div className="text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5">{payTransferError}</div>
																	)}
																	<div className="flex gap-2">
																		<button type="button" onClick={() => { setPayConfirmForSendId(null); setPayTransferError(null); }} disabled={prLoading} className="flex-1 py-2 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50">{tu('cancel')}</button>
																		{!insufficientBalance && (
																		<button type="button" disabled={prLoading} onClick={() => {
																			if (!m.sendId) return
																			const origAmountStr = (pc.currency === 'JPY' || pc.currency === 'TWD') ? String(Math.round(Number(pc.amount))) : Number(pc.amount).toFixed(2)
																			executePaymentRequestTransfer(m.sendId, usdcForConfirm, toAddress, pc.currency, origAmountStr)
																		}} className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-[#1652f0] hover:opacity-90 disabled:opacity-70 flex items-center justify-center gap-1.5">
																			{prLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : tu('confirm')}
																		</button>
																		)}
																	</div>
																</div>
															)
														} else {
															// 发送方(请求方)：只显示 Cancel；接收方：只显示 Decline + Pay
															actionBlock = (
																<div className="flex gap-2">
																	{isMe ? (
																		<button
																			type="button"
																			disabled={prDeclineLoading}
																			onClick={() => m.sendId && !prDeclineLoading && sendPaymentRequestCancel(m.sendId)}
																			className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-70 flex items-center justify-center gap-1.5"
																		>
																			{prDeclineLoading ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" /> Cancelling…</> : '取消'}
																		</button>
																	) : (
																		<>
																			<button
																				type="button"
																				disabled={prDeclineLoading}
																				onClick={() => m.sendId && !prDeclineLoading && sendPaymentRequestCancel(m.sendId)}
																				className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-70 flex items-center justify-center gap-1.5"
																			>
																				{prDeclineLoading ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" /> Declining…</> : 'Decline'}
																			</button>
																			{!prDeclineLoading && (
																				<button
																					type="button"
																					onClick={() => setPayConfirmForSendId(m.sendId ?? m.id ?? '')}
																					className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#1652f0] hover:opacity-90"
																				>{tu('pay')}</button>
																			)}
																		</>
																	)}
																</div>
															)
														}
														const timeLabel = prPaid && m.sendId && paidPaymentRequestMap.has(m.sendId)
															? formatTimeLabel(paidPaymentRequestMap.get(m.sendId)!.createdAt)
															: prCancelled && m.sendId && cancelledPaymentRequestMap.has(m.sendId)
																? formatTimeLabel(cancelledPaymentRequestMap.get(m.sendId)!)
																: formatTimeLabel(pc.timeStamp)
														const headerIcon = prPaid ? (
															<div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
																<CheckCircle2 className="w-5 h-5 text-emerald-600" strokeWidth={2.2} />
															</div>
														) : prCancelled ? (
															<div className="w-10 h-10 rounded-full bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
																<X className="w-5 h-5 text-red-600" strokeWidth={2.5} />
															</div>
														) : (
															<div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
																<DollarSign className="w-5 h-5 text-slate-600" strokeWidth={2.2} />
															</div>
														)
														const headerTitle = prPaid ? 'Paid via Beamio' : prCancelled ? 'Request Declined' : 'Payment Request'
														const amountStr = `${fiatPrefix(pc.currency)}${Number(pc.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
														return (
													<div className={`w-[280px] max-w-full rounded-[22px] bg-white text-slate-900 shadow-[0_6px_18px_rgba(2,6,23,0.10)] ring-1 ring-black/5 overflow-hidden ${isMe ? "ml-auto" : "mr-auto"}`}>
														<div className="p-4">
															<div className="flex items-start justify-between gap-2 mb-3">
																<div className="flex items-center gap-2 min-w-0">
																	{headerIcon}
																	<div className="min-w-0">
																		<div className="font-bold text-[15px] text-slate-900">{headerTitle}</div>
																		<div className="text-[11px] text-slate-500 truncate">
																			{prCancelled && m.sendId && cancelledPaymentRequestMap.has(m.sendId)
																				? formatTimeLabel(cancelledPaymentRequestMap.get(m.sendId)!)
																				: (pc.walletLabel ?? 'Main Wallet • EOA')}
																		</div>
																	</div>
																</div>
																<span className="text-[11px] text-slate-400 shrink-0">{timeLabel}</span>
															</div>
															<div className="text-center mb-1">
																<div className="text-[22px] font-bold text-slate-900">{amountStr}</div>
															</div>
															{(pc.memo ?? pc.title) && (
																<div className="text-center text-[13px] text-slate-500 mb-3">{pc.memo ?? pc.title}</div>
															)}
															{actionBlock}
															<div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
																<span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">由 Beamio 安全保护</span>
																<button type="button" className="p-1 text-slate-400 hover:text-slate-600" aria-label="More">
																	<MoreHorizontal className="w-4 h-4" />
																</button>
															</div>
														</div>
													</div>
														)
													})()
												) : m.paymentCard!.cardType === "merchantGift" ? (
													(() => {
														const pc = m.paymentCard!
														const claimUrl = (pc.requestUrl || pc.cashcodeUrl || '').trim()
														const amountStr = `${fiatPrefix(pc.currency)}${Number(pc.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
														const openGiftClaim = () => {
															if (!claimUrl) return
															// Same path as global search paste → App opens MerchantGiftClaimSheet
															setScanData(claimUrl)
														}
														return (
															<button
																type="button"
																onClick={openGiftClaim}
																className={`w-[280px] max-w-full overflow-hidden rounded-[18px] bg-gradient-to-br from-[#2f2b27] via-[#25221e] to-[#1a1816] text-left text-[#faf9fe] shadow-[0_8px_24px_rgba(2,6,23,0.28)] ring-1 ring-white/10 transition active:scale-[0.99] ${isMe ? 'ml-auto' : 'mr-auto'}`}
															>
																<div className="flex items-center justify-between gap-2 px-3.5 pb-2 pt-3">
																	<div className="flex min-w-0 items-center gap-1.5">
																		<Gift className="h-3.5 w-3.5 shrink-0 text-white" aria-hidden />
																		<span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90">
																			Direct asset drop
																		</span>
																	</div>
																	<span className="shrink-0 font-mono text-[10px] tracking-wide text-white/45">
																		{formatTimeLabel(pc.timeStamp)}
																	</span>
																</div>
																{pc.imageUrl ? (
																	<div className="mx-3 mb-3 h-28 overflow-hidden rounded-xl">
																		<IpfsImg src={pc.imageUrl} alt="" className="h-full w-full object-cover" />
																	</div>
																) : null}
																<div className="mx-3 mb-3 overflow-hidden rounded-xl bg-gradient-to-r from-slate-300/25 via-purple-300/20 to-slate-200/15 px-3 py-3">
																	<div className="flex items-start justify-between gap-2">
																		<div className="min-w-0">
																			<span className="inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">
																				Gift
																			</span>
																			<p className="mt-1.5 truncate text-[13px] font-semibold text-white">
																				{pc.title || 'Merchant gift'}
																			</p>
																		</div>
																		<span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-white/70">
																			Gift voucher
																		</span>
																	</div>
																</div>
																<div className="px-3.5 pb-3.5">
																	<p className="text-[10px] font-semibold uppercase tracking-wider text-[#baa479]">
																		Gift card value
																	</p>
																	<p className="mt-0.5 text-[22px] font-bold tracking-tight text-white">
																		{amountStr}
																	</p>
																	<p className="mt-1 text-[11px] text-white/55">
																		Tap to claim to your vault
																	</p>
																</div>
															</button>
														)
													})()
												) : (
												<MessageSendReceiveCard
													variant={
														m.paymentCard!.cardType === "membershipActivated"
															? "membershipActivated"
															: m.paymentCard!.cashcodeUrl
																? "cashcode"
																: isMe
																	? "sent"
																	: "received"
													}
													status="Completed"
													amount={m.paymentCard!.amount}
													usdcAmount={m.paymentCard!.usdcAmount}
													cashcodeUrl={m.paymentCard!.cashcodeUrl}
													title={m.paymentCard!.title}
													timeLabel={formatTimeLabel(m.paymentCard!.timeStamp)}
													onMenu={() => {}}
													currency={m.paymentCard!.currency}
													className={isMe ? "ml-auto" : "mr-auto"}
													statusLabel={m.paymentCard!.cardType === "membershipActivated" ? m.paymentCard!.statusLabel : undefined}
													onViewInvoice={m.paymentCard!.cardType === "membershipActivated" ? () => { /* TODO: 跳转发票/详情 */ } : undefined}
												/>
												)}

													{isMe && (
														<div className="absolute -bottom-2 -right-2">
														<BubbleCornerStatus
															status={m.status}
															onRetry={() => {
															if (m.status !== "failed") return
															setText(m.text)
															setMessages(prev => prev.filter(x => x.id !== m.id))
															}}
														/>
														</div>
													)}
												</div>
											) : hasShareLinkCard && shareUrl ? (
												<div className="relative">
													<ChatShareLinkPreviewCard
														shareUrl={shareUrl}
														timeLabel={fmtTime(getMsgTs(m))}
														isMe={isMe}
														onOpen={() => {
															const nav = resolveBeamioShareInAppNavigation(shareUrl)
															if (nav) {
																navigate({ pathname: nav.pathname, search: nav.search })
																return
															}
															void openExternalUrl(shareUrl)
														}}
													/>
													{isMe && (
														<div className="absolute -bottom-2 -right-2">
															<BubbleCornerStatus
																status={m.status}
																onRetry={() => {
																	if (m.status !== "failed") return
																	setText(m.text)
																	setMessages(prev => prev.filter(x => x.id !== m.id))
																}}
															/>
														</div>
													)}
												</div>
											) : hasGenericLinkCard && genericUrl ? (
												<div className="relative">
													<ChatGenericLinkPreviewCard
														url={genericUrl}
														timeLabel={fmtTime(getMsgTs(m))}
														isMe={isMe}
														onOpen={() => {
															void openExternalUrl(genericUrl)
														}}
													/>
													{isMe && (
														<div className="absolute -bottom-2 -right-2">
															<BubbleCornerStatus
																status={m.status}
																onRetry={() => {
																	if (m.status !== "failed") return
																	setText(m.text)
																	setMessages(prev => prev.filter(x => x.id !== m.id))
																}}
															/>
														</div>
													)}
												</div>
											) : (
												<div
												className={[
													"relative",
													"px-3.5 py-2.5",
													"rounded-[18px]",
													"shadow-[0_8px_22px_rgba(15,23,42,0.08)]",
													isMe
													? "bg-[#1652f0] text-white rounded-br-[10px]"
													: "bg-white text-slate-900 ring-1 ring-black/5 rounded-bl-[10px]"
												].join(" ")}
												onPointerDown={e => {
													if (e.pointerType === "mouse" && e.button !== 0) return
													if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
													const target = e.currentTarget as HTMLElement
													pressTimerRef.current = window.setTimeout(() => {
														openReactionBarForElement(m, target, isMe)
													}, 450)
												}}
												onPointerUp={() => {
													if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
													pressTimerRef.current = null
												}}
												onPointerCancel={() => {
													if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
													pressTimerRef.current = null
												}}
												onPointerLeave={() => {
													if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current)
													pressTimerRef.current = null
												}}
												onContextMenu={e => {
													e.preventDefault()
													openReactionBarForElement(m, e.currentTarget as HTMLElement, isMe)
												}}
												>
												{(() => {
													const reactions = getReactionsForMessage(m)
													const show = reactions?.slice(-2) ?? []
													if (!show.length) return null
													const hasMyReply = show.some(r => r.from === 'me')
													return (
														<div
															className={["absolute -top-2 -left-2 z-10 flex items-center gap-0.5 rounded-tl-xl rounded-tr-xl rounded-br-xl rounded-bl-[6px] px-1.5 py-1 shadow-lg ring-1 ring-black/5", hasMyReply ? "bg-[#1652f0]/30" : "bg-slate-100/25"].join(" ")}
															style={{ boxShadow: '0 3px 12px rgba(0,0,0,0.2)' }}
															aria-hidden
														>
															{show.map((r, i) => {
																const label = REACTIONS.find(x => x.key === r.reactionKey)?.label ?? r.reactionKey
																return <span key={`${r.reactionKey}-${i}`} className="text-base leading-none" title={r.reactionKey}>{label}</span>
															})}
														</div>
													)
												})()}
												{m.quote?.text && (
													<div
														className={[
															"mb-1.5 rounded-lg border-l-2 pl-2 pr-2 py-1 text-[12px] leading-snug line-clamp-2",
															isMe
																? "border-white/60 bg-white/15 text-white/85"
																: "border-[#1652f0]/50 bg-slate-100 text-slate-500"
														].join(" ")}
													>
														{m.quote.text}
													</div>
												)}
												<div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">
													{m.text}
												</div>

												{isMe && (
													<BubbleCornerStatus
													status={m.status}
													onRetry={() => {
														if (m.status !== "failed") return
														setText(m.text)
														setMessages(prev => prev.filter(x => x.id !== m.id))
													}}
													/>
												)}
												</div>
											)}

											<div className={["mt-1 flex items-center gap-2", isMe ? "justify-end" : "justify-start"].join(" ")}>
												<span className="text-[11px] text-slate-400">
												{fmtTime(getMsgTs(m))}
												</span>

												{isMe && (
												<span className="text-[11px]">
													{m.status === "sending" && <span className="text-slate-400">Sending…</span>}
													{m.status === "sent" && <span className="text-slate-400">Sent</span>}
													{m.status === "delivered" && <span className="text-[#1652f0]">Delivered</span>}
													{m.status === "failed" && (
													<button
														type="button"
														onClick={() => {
														setText(m.text)
														setMessages(prev => prev.filter(x => x.id !== m.id))
														}}
														className="text-rose-600 underline underline-offset-2"
													>
														Failed · Tap to retry
													</button>
													)}
												</span>
												)}
											</div>
											</div>
										</motion.div>
										)
									})}
									</div>
								))}
							</AnimatePresence>

					{/* ✅ 关键：底部 spacer */}
					<div aria-hidden className="h-[96px]" />
					{/* 长按底部消息时临时增加的额外空间，确保菜单完整显示 */}
					{menuBottomSpacer > 0 && <div aria-hidden style={{ height: menuBottomSpacer }} />}
				</div>
				</div>
			</div>
			</div>

			{/* 底部：输入栏（iOS 毛玻璃 + pill） */}
			<div
				className={[
					"fixed left-0 right-0 bottom-0 z-50",
					"pb-[env(safe-area-inset-bottom)]"
				].join(" ")}
				onDragEnter={handleChatFileDragEnter}
				onDragOver={handleChatFileDragOver}
				onDrop={handleChatFileDrop}
			>
				<div className={["bg-white/0"].join(" ")}>
					<div className="relative">
						<div className="mx-auto w-full max-w-[820px] px-3 pt-3 pb-4">
						{cameraStream ? (
							<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
								<div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white p-3 shadow-2xl">
									<video
										ref={cameraPreviewRef}
										className="aspect-[3/4] w-full rounded-2xl bg-black object-cover"
										autoPlay
										muted
										playsInline
									/>
									<div className="mt-3 flex items-center justify-between gap-3">
										<button
											type="button"
											onClick={closeChatCamera}
											className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
										>
											Cancel
										</button>
										<button
											type="button"
											onClick={() => cameraRecording ? stopChatCameraRecording() : startChatCameraRecording(cameraPreviewRef.current as HTMLVideoElement)}
											className="rounded-full bg-[#1652f0] px-5 py-2 text-sm font-semibold text-white"
										>
											{cameraRecording ? 'Stop' : 'Record video'}
										</button>
									</div>
								</div>
							</div>
						) : null}
						{chatError && (
							<div role="alert" className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
								{chatError}
								<button type="button" className="ml-2 underline" onClick={() => setChatError(null)}>Dismiss</button>
							</div>
						)}
						{voiceError && (
							<div role="alert" className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
								{voiceError}
								<button type="button" className="ml-2 underline" onClick={() => setVoiceError(null)}>Dismiss</button>
							</div>
						)}
						{isRecordingVoice && (
							<div className="mb-2 rounded-xl border border-rose-200 bg-white/85 px-3 py-2 text-[13px] text-rose-700">
								<div className="flex items-center justify-between gap-3">
									<span>
										Recording voice message · {formatVoiceDuration(voiceDurationMs)} ·{' '}
										{formatVoiceBytes(voiceRecordedBytes)}
									</span>
									<button type="button" className="shrink-0 font-semibold underline" onClick={() => void finishVoiceRecording()}>
										Stop
									</button>
								</div>
								<div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-rose-100" aria-hidden>
									<div
										className="h-full rounded-full bg-rose-500 transition-[width] duration-300"
										style={{
											width: `${Math.min(100, Math.max(2, (voiceRecordedBytes / VOICE_MAX_AUDIO_BYTES) * 100))}%`,
										}}
									/>
								</div>
								<div className="mt-1.5 h-8 overflow-hidden rounded-md bg-[#fff4f7]/70" aria-label="Current recording volume">
									<svg
										viewBox="0 0 240 32"
										preserveAspectRatio="none"
										className="h-full w-full"
										role="img"
										aria-label="Live recording waveform"
									>
										<path d={voiceWaveformPath(voiceLevelSamples)} fill="rgba(225,29,72,0.58)" />
										<path d="M 0 16 L 240 16" stroke="rgba(225,29,72,0.28)" strokeWidth="0.5" />
									</svg>
								</div>
							</div>
						)}
						{replyTo && (
							<div className="mb-2 flex items-center gap-2 rounded-2xl bg-white/70 backdrop-blur-xl ring-1 ring-black/5 px-3 py-2 shadow-[0_4px_16px_rgba(15,23,42,0.06)]">
								<CornerUpLeft className="h-4 w-4 shrink-0 text-[#1652f0]" strokeWidth={2.2} />
								<div className="min-w-0 flex-1">
									<div className="text-[11px] font-semibold text-[#1652f0]">
										{replyTo.from === 'me' ? 'Replying to yourself' : 'Replying'}
									</div>
									<div className="truncate text-[12px] text-slate-500">{replyTo.text || '…'}</div>
								</div>
								<button
									type="button"
									tabIndex={-1}
									onClick={() => setReplyTo(null)}
									className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 active:scale-95 hover:bg-black/5"
									aria-label="Cancel reply"
								>
									<X className="h-4 w-4" strokeWidth={2.4} />
								</button>
							</div>
						)}
						{nativeCameraProcessing ? (
							<div role="status" aria-live="polite" className="mb-2 flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-[12px] text-blue-700">
								<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
								<span>Processing your camera video… Please wait.</span>
							</div>
						) : null}
						{fileError ? <div role="alert" className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{fileError}</div> : null}
						<div>
						<input ref={fileInputRef} type="file" multiple hidden onChange={event => { void addChatFiles(Array.from(event.target.files || []), null, 'picker'); event.currentTarget.value = '' }} />
						<input ref={cameraInputRef} type="file" accept="video/*" capture="environment" hidden onChange={event => { void addChatFiles(Array.from(event.target.files || []), null, 'picker'); event.currentTarget.value = '' }} />
						<div className="flex items-center gap-2">
							<PlusActionMenu
								open={plusOpen}
								onClose={() => setPlusOpen(false)}
								anchorRef={plusBtnRef}
								onAttachFiles={() => fileInputRef.current?.click()}
								onCaptureCamera={openChatCamera}
								
							/>
								{/* ✅ 输入框：内部放 send 按钮 */}
								<div
									className={[
									"relative flex-1",
									"rounded-[22px]",
									"bg-white/60 backdrop-blur-xl",
									"ring-1 ring-black/5",
									"shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
									].join(" ")}
								>
									{fileJobs.length || (voiceDraftBlob && !isRecordingVoice) ? (
										<div className="relative mx-2 flex flex-wrap items-center justify-start gap-1.5 pt-2">
											{voiceDraftBlob && !isRecordingVoice ? (
												<div className="inline-flex h-11 max-w-[min(100%,22rem)] items-center gap-2 rounded-2xl bg-white/75 px-3 ring-1 ring-black/5 backdrop-blur-xl">
													<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#dceaff] text-[#1652f0]" aria-hidden>
														<Mic className="h-4 w-4" strokeWidth={2.3} />
													</span>
													<div className="min-w-0">
														<p className="truncate text-[13px] font-semibold text-slate-700">Voice message</p>
														<p className="text-[11px] text-slate-500">{formatVoiceDuration(voiceDurationMs)} · {formatVoiceBytes(voiceRecordedBytes)}</p>
													</div>
													<button type="button" tabIndex={-1} disabled={voiceSending} onClick={cancelVoiceDraft} aria-label="Delete voice message" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
														<X className="h-4 w-4" strokeWidth={2.4} />
													</button>
												</div>
											) : null}
											{fileJobs.map(job => (
												<div key={job.id} className="inline-flex h-11 max-w-[min(100%,22rem)] items-center gap-2 rounded-2xl bg-white/75 px-3 ring-1 ring-black/5 backdrop-blur-xl">
													{job.thumbnailUrl ? (
														<div className="relative h-8 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
															<img src={job.thumbnailUrl} alt={job.name} className="h-full w-full object-cover" />
															{job.files.length === 1 && job.files[0].type.startsWith('video/') ? (
																<span className="absolute inset-0 grid place-items-center">
																	<span className="grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white">
																		<Play className="ml-0.5 h-3 w-3 fill-current" />
																	</span>
																</span>
															) : null}
														</div>
													) : null}
													<div className="min-w-0 flex-1">
														<p className="truncate text-[13px] font-semibold text-slate-700">{folderDisplayName(job.name) || job.name}</p>
														{job.files.length > 1 ? (
															<p className="truncate text-[11px] text-slate-500">
																{`${job.files.length} files · ${formatVoiceBytes(job.files.reduce((sum, file) => sum + file.size, 0))}`}
															</p>
														) : null}
														{job.status === 'uploading' ? <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#1652f0] transition-[width]" style={{ width: `${Math.max(2, job.progress * 100)}%` }} /></div> : null}
														{job.error ? <p role="alert" className="text-[11px] text-rose-600">{job.error}</p> : null}
													</div>
													<button type="button" tabIndex={-1} onClick={() => cancelChatFileJob(job.id)} aria-label="Cancel file upload" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-rose-50 hover:text-rose-600"><X className="h-4 w-4" strokeWidth={2.4} /></button>
												</div>
											))}
										</div>
									) : null}
									<button
										ref={plusBtnRef}
										type="button"
										tabIndex={-1}
										onClick={() => setPlusOpen(true)}
										className="absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-full bg-transparent ring-1 ring-slate-300/70 backdrop-blur-xl transition active:scale-[0.95]"
										aria-label="More actions"
									>
										<Plus className="h-4 w-4 text-slate-500" strokeWidth={2.6} />
									</button>
									<textarea
									key={inputSession}
									ref={inputRef}
									value={text}
									onChange={e => {
										if (!hasRoute) return
										if (suppressImeEchoRef.current) {
											e.target.value = ""
											if (text !== "") flushSync(() => setText(""))
											return
										}
										setText(e.target.value)
									}}
									onBeforeInput={hasRoute ? onBeforeInput : undefined}
									onKeyDown={hasRoute ? onKeyDown : undefined}
									onCompositionStart={hasRoute ? onCompositionStart : undefined}
									onCompositionEnd={hasRoute ? onCompositionEnd : undefined}
									placeholder={hasRoute ? "iMessage…" : "No route – message may not be delivered"}
									readOnly={!hasRoute}
									rows={1}
									tabIndex={1}
									inputMode="text"
									enterKeyHint="send"
									autoComplete="off"
									autoCorrect="on"
									spellCheck
									className={[
										"w-full resize-none bg-transparent outline-none",
										"py-3 pl-14 pr-14",
										"pr-14",
										"text-[15px] leading-[20px]",
										"placeholder:text-slate-400",
										"disabled:opacity-60",
										"overflow-y-auto",
										"[scrollbar-width:none]",
										"[-ms-overflow-style:none]",
										"[&::-webkit-scrollbar]:hidden"
									].join(" ")}
									/>

									{/* ✅ 按钮放进输入框内部，最右对齐 */}
									<button
									type="button"
									tabIndex={-1}
									onClick={() => {
										if (voiceDraftBlob) {
											void sendVoiceDraft()
										} else if (canSend || (hasRoute && (inputRef.current?.value ?? text).trim())) {
										void sendAll()
										} else if (isRecordingVoice) {
											void finishVoiceRecording()
										} else {
											void startVoiceRecording()
										}
									}}
									disabled={voiceSending}
									onPointerDown={e => {
										// Keep focus until send() snapshots DOM value + remounts; avoids IME commit-on-blur refill.
										if (voiceDraftBlob || canSend || (hasRoute && (inputRef.current?.value ?? "").trim())) {
											e.preventDefault()
										}
									}}
									className={[
										"absolute right-2 bottom-2",
										"h-8 w-8 rounded-full",
										"grid place-items-center",
										"transition active:scale-[0.95]",
										canSend
										? [
											"bg-[rgba(22,82,240,0.60)]",
											"shadow-[0_4px_12px_rgba(22,82,240,0.15)]"
											].join(" ")
										: isRecordingVoice
											? ["bg-rose-500", "ring-1 ring-rose-600"].join(" ")
											: ["bg-transparent", "ring-1 ring-slate-300/70"].join(" ")
									].join(" ")}
									aria-label={voiceDraftBlob || canSend ? tu('send') : isRecordingVoice ? "Stop voice recording" : "Record voice message"}
									>
									{canSend ? (
										<ArrowUp className="h-4 w-4 text-white/70" strokeWidth={2.8} />
									) : isRecordingVoice ? (
										<div className="h-3 w-3 rounded-sm bg-white" aria-hidden />
									) : (
										<Mic className="h-4 w-4 text-slate-400" strokeWidth={2.4} />
									)}
									</button>
								</div>
							</div>
						</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		)
}