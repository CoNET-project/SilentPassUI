// @/components/Setting/PrivateKey/PrivateKey.tsx
import { useState } from 'react'
import { Eye, EyeOff, Copy, Check } from 'lucide-react'
import styles from '../setting.module.scss'

type Props = {
  privateKey: string
  onClose: () => void
}

export default function PrivateKeyReveal({ privateKey, onClose }: Props) {
	const [visible, setVisible] = useState(false)
	const [copied, setCopied] = useState(false)

	const onCopy = async () => {
		if (!privateKey) return
		await navigator.clipboard.writeText(privateKey)
		setCopied(true)
		setTimeout(() => setCopied(false), 1500)
	}

	return (
		<div className={styles.avatarEditorPanel}>
		{/* 头部：标题 + 关闭 */}
		<div className={styles.avatarEditorHeader}>
			<h3 className={styles.avatarEditorTitle}>Private key</h3>
			<button
			type="button"
			onClick={onClose}
			className={styles.avatarEditorClose}
			>
			✕
			</button>
		</div>

		{/* 警示文字 */}
			<p>
				For advanced users only. Anyone with this key can move your funds.
			</p>
			{/* Danger banner */}
			<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
				<div className="text-[12px] font-semibold text-rose-800 mb-0.5">
				Handle with extreme care
				</div>
				<p className="text-[11px] text-rose-700 leading-snug">
				Beamio cannot undo the exposure of your private key. Only view it in
				a private place and never share it with anyone.
				</p>
			</div>

		{/* 私钥容器 */}
		
			<div className="flex items-center justify-between">
			<span className="text-[12px] font-semibold text-slate-800">
				Wallet private key
			</span>
			<span className="text-[10px] text-slate-500">Base · EOA</span>
			</div>
			<div className={styles.privateKeyBox}>
				<div className="mt-1 h-11 rounded-xl border border-slate-200 bg-white px-3 flex items-center justify-between">
					{/* 真正的私钥文本 */}
					<pre className={styles.privateKeyText}>
					{privateKey || 'No private key found.'}
					</pre>
				</div>
			{/* 遮罩层 */}
			{!visible && (
			<div className={styles.privateKeyMask}>
				<div className={styles.privateKeyMaskBlur} />
			</div>
			)}

			{/* 右下角眼睛按钮 */}
			<button
			type="button"
			onClick={() => setVisible(v => !v)}
			className={styles.privateKeyToggle}
			title={visible ? 'Hide' : 'Show'}
			>
			{visible ? (
				<EyeOff className={styles.privateKeyToggleIcon} strokeWidth={2.5} />
			) : (
				<Eye className={styles.privateKeyToggleIcon} strokeWidth={2.5} />
			)}
			</button>
			
		</div>
		<p className="text-[10px] text-slate-500 leading-snug mt-1">
			This private key controls your Beamio wallet on Base. You can also
			use your Recovery QR + PIN to restore this wallet. Exposing this key
			is not required for normal Beamio usage.
			</p>
			{/* How to back this up safely */}
			<div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
				<div className="text-[12px] font-semibold text-slate-800 mb-1">
				How to back this up safely
				</div>
				<ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">
				<li>Store it in a password manager you control.</li>
				<li>Or write it down on paper and keep it in a safe place.</li>
				<li>
					Do not keep it in screenshots, email, cloud notes, or chat apps.
				</li>
				</ul>
			</div>
			<p className="mt-3 text-[10px] text-slate-500 leading-snug">
				If you lose this private key and all other recovery methods (Recovery
				QR + PIN), Beamio cannot recover this wallet or your funds.
				</p>
		{/* 底部按钮区：左 Close，右 Copy */}
		<div className={styles.avatarEditorActions}>
			<button
			type="button"
			className={styles.avatarEditorCancel}
			onClick={onClose}
			>
			Close
			</button>

			<button
			type="button"
			className={styles.avatarEditorSave}
			onClick={onCopy}
			>
			<span className={styles.privateKeyCopyContent}>
				{copied ? (
				<>
					<Check className={styles.privateKeyCopyIcon} />
					<span>Copied</span>
				</>
				) : (
				<>
					<Copy className={styles.privateKeyCopyIcon} />
					<span>Copy to clipboard</span>
				</>
				)}
			</span>
			</button>
		</div>
		</div>
	)
}
