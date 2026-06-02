import { IpfsImg } from '@/components/IpfsImg';
import * as React from 'react'
import bLogoWhite from '@/components/Footer/assets/B-logo-white.svg'

type BeamioLogoProps = {
  size?: number | string
  className?: string
  style?: React.CSSProperties
}

/**
 * Beamio App-style Icon
 * - API compatible with lucide-react (size / className / style)
 * - Blue rounded background + white Beamio B
 */
export const BeamioLogoWhiteWhithBlueApp: React.FC<BeamioLogoProps> = ({
  size = 24,
  className,
  style
}) => {
  const resolvedSize = typeof size === 'number' ? `${size}px` : size

  return (
		<span
		className={className}
		style={{
				width: resolvedSize,
				height: resolvedSize,
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: 'center',
				borderRadius: '22%',
				backgroundColor: '#2F54D6',
				...style
		}}
		>
		<IpfsImg
			src={bLogoWhite}
			alt="Beamio"
			style={{
				width: '62%',
				height: '62%',
				objectFit: 'contain'
			}}
			draggable={false}
		/>
		</span>
  )
}
