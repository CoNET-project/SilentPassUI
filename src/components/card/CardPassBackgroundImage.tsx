import { IpfsImg } from '@/components/IpfsImg'
import React from 'react'

/** Pass / wallet card background: width-first or height-first (tier `imageFit`). */
export type CardPassBackgroundImageFit = 'width' | 'height'

export function normalizeCardPassBackgroundImageFit(raw: unknown): CardPassBackgroundImageFit {
	return raw === 'height' ? 'height' : 'width'
}

/**
 * Tier pass background image with edge blur fill — aligned with bizSite CardPassBackgroundImage.
 * Local blob/data URLs use native `<img>`; remote IPFS URLs go through IpfsImg.
 */
export function CardPassBackgroundImage({
	src,
	fit,
}: {
	src: string
	fit: CardPassBackgroundImageFit
}) {
	const isLocal = src.startsWith('blob:') || src.startsWith('data:')
	const fitWidth = fit === 'width'
	const mediaClass = fitWidth
		? 'absolute left-0 top-1/2 z-[1] h-auto w-full max-h-none -translate-y-1/2 object-contain'
		: 'absolute left-1/2 top-0 z-[1] h-full w-auto max-w-none -translate-x-1/2 object-contain'
	return (
		// Isolate filter blur fills onto their own layer so pass face text does not re-rasterize with them.
		<div className="pointer-events-none absolute inset-0 isolate overflow-hidden [transform:translateZ(0)]">
			{fitWidth ? (
				<>
					<div
						className="absolute inset-x-0 top-0 h-1/2 scale-110 bg-cover bg-top bg-no-repeat blur-xl"
						style={{ backgroundImage: `url("${src}")` }}
						aria-hidden
					/>
					<div
						className="absolute inset-x-0 bottom-0 h-1/2 scale-110 bg-cover bg-bottom bg-no-repeat blur-xl"
						style={{ backgroundImage: `url("${src}")` }}
						aria-hidden
					/>
				</>
			) : (
				<>
					<div
						className="absolute inset-y-0 left-0 w-1/2 scale-110 bg-cover bg-left bg-no-repeat blur-xl"
						style={{ backgroundImage: `url("${src}")` }}
						aria-hidden
					/>
					<div
						className="absolute inset-y-0 right-0 w-1/2 scale-110 bg-cover bg-right bg-no-repeat blur-xl"
						style={{ backgroundImage: `url("${src}")` }}
						aria-hidden
					/>
				</>
			)}
			{isLocal ? (
				<img src={src} alt="" className={mediaClass} draggable={false} />
			) : (
				<IpfsImg key={`${src}:${fit}`} src={src} alt="" className={mediaClass} draggable={false} />
			)}
		</div>
	)
}
