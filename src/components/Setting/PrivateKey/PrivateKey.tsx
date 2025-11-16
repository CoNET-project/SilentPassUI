//		PrivateKey.tsx

import { useState } from 'react'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'

type Props = {
  privateKey: string
  t:(cn: string, en: string, ja?: string) => string
  onClose: () => void
}

export default function PrivateKeyReveal({ privateKey, t, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    await navigator.clipboard.writeText(privateKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
		
			<div className="w-full max-w-xl">
			{/* 标题与警示 */}
			<div className="flex items-center justify-between mb-2">
				<h2 className="text-2xl font-bold">
					{t('私钥', 'Private Key', '秘密鍵')}
				</h2>

				<button
					type="button"
					onClick={onClose}
					className="text-sm px-2 py-1 rounded-lg border border-black/20 bg-black/5 hover:bg-black/10 transition"
				>
					X
				</button>
			</div>
			
			<p className="text-black/60 mb-4 text-sm leading-relaxed">
				{t(
				'请勿与任何人分享。持有您私钥的人可以转走您的资产。',
				"Do not share this with anyone. Anyone with your private key can steal your funds.",
				'誰とも共有しないでください。秘密鍵があれば資金を盗まれる可能性があります。'
				)}
			</p>

			{/* 私钥容器 */}
			<div className="relative border border-black/10 rounded-2xl p-4 min-h-[128px] bg-white">
				{/* 下层：真实私钥 */}
				<pre className="whitespace-pre-wrap break-all font-mono text-sm text-black/80 select-text pr-10">
				{privateKey}
				</pre>

				{/* 遮罩层：放在更低层，避免覆盖图标 */}
				{!visible && (
				<div className="absolute inset-0 z-[1] rounded-2xl overflow-hidden pointer-events-none">
					<div className="absolute inset-0 backdrop-blur-sm bg-white/70" />
				</div>
				)}

				{/* 右下角：眼睛按钮（固定尺寸+线宽+高层级） */}
				<button
					type="button"
					onClick={() => setVisible(v => !v)}
					className="absolute bottom-3 right-3 z-[9999] flex items-center justify-center
								w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 transition shrink-0"
					title={visible ? t('隐藏', 'Hide', '非表示') : t('显示', 'Show', '表示')}
				>
					{visible ? (
						<EyeOff
							className="w-4 h-4 text-blue-600 flex-shrink-0"
							strokeWidth={2.5}
						/>
					) : (
						<Eye
							className="w-4 h-4 text-blue-600 flex-shrink-0"
							strokeWidth={2.5}
						/>
					)}
				</button>
			</div>

			{/* 复制按钮 */}
			<button
				type="button"
				onClick={onCopy}
				className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 transition"
			>
				{copied ? (
				<>
					<Check className="w-4 h-4 text-green-600" />
					<span className="text-sm text-black/80">
					{t('已复制', 'Copied', 'コピーしました')}
					</span>
				</>
				) : (
				<>
					<Copy className="w-4 h-4" />
					<span className="text-sm text-black/80">
					{t('复制到剪贴板', 'Copy to clipboard', 'クリップボードにコピー')}
					</span>
				</>
				)}
			</button>
		</div>
		
  )
}
