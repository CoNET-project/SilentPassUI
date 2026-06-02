import { IpfsImg } from '@/components/IpfsImg';
import React from "react"
import { Coffee } from "lucide-react"

type CardSmallItemProps = {
  /** 背景图 URL（如室内/商户图） */
  backgroundImg: string
  /** 标题，如 "Beamio Coffee" */
  title: string
  /** 副标题或点数，如 "1250 PTS" */
  subtitle?: string
  /** 点数文案（与 subtitle 二选一，若传则优先显示） */
  amount?: string
  /** 自定义图标，不传则默认咖啡杯 */
  icon?: React.ReactNode
  /** 点击回调 */
  onClick?: () => void
}

export default function CardSmallItem({
  backgroundImg,
  title,
  subtitle,
  amount,
  icon,
  onClick,
}: CardSmallItemProps) {
  const bottomText = amount ?? subtitle ?? ""

  return (
    <button
      type="button"
      onClick={onClick}
      className="
        w-full text-left
        rounded-2xl overflow-hidden
        shadow-[0_10px_26px_rgba(15,23,42,0.08)]
        ring-1 ring-black/5
        aspect-[4/3] min-h-[120px] max-h-[180px]
        relative
        active:scale-[0.99] transition
      "
    >
      {/* 背景图 + 遮罩 */}
      <div className="absolute inset-0">
        <IpfsImg
          src={backgroundImg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
          aria-hidden
        />
      </div>

		{/* 左上角：图标 */}
		<div className="absolute top-4 left-4">
		<div
			className="
			w-11 h-11 rounded-full
			bg-black/50 backdrop-blur-sm
			flex items-center justify-center
			ring-1 ring-white/20
			"
		>
			{icon ?? (
			<Coffee className="w-5 h-5 text-white" strokeWidth={2} />
			)}
		</div>
		</div>

		{/* 左下角：标题 + 点数 */}
		<div className="absolute inset-0 flex items-end p-4">
		<div className="flex flex-col justify-end min-w-0 pb-0.5">
			<span className="text-[17px] font-bold text-white truncate drop-shadow-sm">
			{title}
			</span>
			{bottomText && (
				<span className="text-[13px] font-medium text-white/95 mt-0.5 drop-shadow-sm">
					{bottomText} PTS
				</span>
			)}
		</div>
		</div>
    </button>
  )
}
