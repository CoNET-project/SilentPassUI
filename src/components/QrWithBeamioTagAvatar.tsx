/**
 * QR canvas with center excavated so a BeamioTag avatar can sit on top
 * without covering modules (error correction level H + excavate).
 * Pattern matches ReceiveFundsPanel ReceiveQrWithBeamioAvatar.
 */

import { useEffect, useMemo } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { IpfsImg } from '@/components/IpfsImg'
import { useBeamioTagDatabase } from '@/providers/BeamioTagDatabaseProvider'
import { useDaemonContext } from '@/providers/DaemonProvider'

/** Transparent 1×1 GIF — excavate only; avatar is overlaid as a circle. */
const QR_CENTER_EXCAVATE_PIXEL =
	'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='

const DEFAULT_AVATAR_PX = 50

type QrWithBeamioTagAvatarProps = {
	value: string
	size?: number
	/** Wallet EOA used to resolve BeamioTag profile / DiceBear seed. */
	eoa?: string
	/** Optional @tag override (without leading @). */
	accountName?: string
	/** Excavation / overlay diameter in CSS px. */
	avatarPx?: number
	includeMargin?: boolean
	bgColor?: string
	fgColor?: string
	className?: string
}

export function QrWithBeamioTagAvatar({
	value,
	size = 220,
	eoa = '',
	accountName = '',
	avatarPx = DEFAULT_AVATAR_PX,
	includeMargin = true,
	bgColor = '#ffffff',
	fgColor = '#0f172a',
	className,
}: QrWithBeamioTagAvatarProps) {
	const { beamio } = useDaemonContext()
	const { lookupByAddress, resolveTagPlain, avatarImgUrl, ensureProfilesForAddresses } =
		useBeamioTagDatabase()

	const eoaTrim = eoa.trim()
	const tagOverride = accountName.trim().replace(/^@+/, '')

	useEffect(() => {
		if (!eoaTrim) return
		void ensureProfilesForAddresses([eoaTrim])
	}, [eoaTrim, ensureProfilesForAddresses])

	const avatarSrc = useMemo(() => {
		const fromProfile = beamio?.image != null ? String(beamio.image).trim() : ''
		const fromDb = (lookupByAddress(eoaTrim)?.image ?? '').trim()
		if (fromProfile) return fromProfile
		if (fromDb) return fromDb
		const tag =
			tagOverride ||
			resolveTagPlain(eoaTrim) ||
			String(beamio?.accountName ?? '')
				.trim()
				.replace(/^@+/, '')
		return avatarImgUrl(tag || undefined, eoaTrim || undefined)
	}, [
		avatarImgUrl,
		beamio?.accountName,
		beamio?.image,
		eoaTrim,
		lookupByAddress,
		resolveTagPlain,
		tagOverride,
	])

	const src = String(avatarSrc || '').trim()
	const usePlainImg =
		Boolean(src) &&
		(src.startsWith('data:') ||
			src.startsWith('blob:') ||
			src.includes('api.dicebear.com') ||
			(/^https?:\/\//i.test(src) && !/ipfs\.conet\.network|beamio\.app\/api\/fragment/i.test(src)))

	return (
		<div
			className={className ?? 'relative inline-flex shrink-0'}
			style={{ width: size, height: size }}
		>
			<QRCodeCanvas
				key={`invite-qr:${value}:${src.slice(0, 64)}:${avatarPx}`}
				value={value}
				size={size}
				level="H"
				includeMargin={includeMargin}
				bgColor={bgColor}
				fgColor={fgColor}
				style={{ height: size, width: size }}
				imageSettings={{
					src: QR_CENTER_EXCAVATE_PIXEL,
					height: avatarPx,
					width: avatarPx,
					excavate: true,
				}}
			/>
			<span
				className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-white bg-white shadow-[0_0_0_2px_#fff]"
				style={{ width: avatarPx, height: avatarPx }}
				aria-hidden
			>
				{usePlainImg ? (
					<img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
				) : src ? (
					<IpfsImg src={src} alt="" className="h-full w-full object-cover" draggable={false} />
				) : null}
			</span>
		</div>
	)
}
