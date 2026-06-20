import { IpfsImg } from '@/components/IpfsImg';
import { VERRA_BRAND_LOGO_SRC } from '@/ui/verraBrandAssets'

export type VerraBrandLockupProps = {
	/** 浅底用 onLight，合影/深色顶栏用 onDark */
	variant?: 'onLight' | 'onDark'
	/** standard ≈ 浮动顶栏；compact ≈ 居中小顶栏 */
	size?: 'standard' | 'compact'
	className?: string
}

const textClass: Record<NonNullable<VerraBrandLockupProps['variant']>, string> = {
	onLight: 'text-[#1a1c1f]',
	onDark: 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
}

const imgClass: Record<NonNullable<VerraBrandLockupProps['size']>, string> = {
	standard: 'max-h-8 w-auto max-w-8 object-contain',
	compact: 'max-h-7 w-auto max-w-7 object-contain',
}

const wordClass: Record<NonNullable<VerraBrandLockupProps['size']>, string> = {
	standard: 'text-xl',
	compact: 'text-lg',
}

/** 全局统一：logo512 + 「Beamio」字标（仅用于品牌条，勿与功能图标混用） */
export function VerraBrandLockup({
	variant = 'onLight',
	size = 'standard',
	className,
}: VerraBrandLockupProps) {
	return (
		<div className={['flex items-center gap-0', className].filter(Boolean).join(' ')}>
			<IpfsImg
				src={VERRA_BRAND_LOGO_SRC}
				alt=""
				className={[
					imgClass[size],
					'shrink-0 block align-middle',
					variant === 'onDark' ? 'drop-shadow-md brightness-0 invert' : '',
				]
					.filter(Boolean)
					.join(' ')}
				draggable={false}
			/>
			<span className={['font-bold tracking-tighter', textClass[variant], wordClass[size]].join(' ')}>
				Beamio
			</span>
		</div>
	)
}
