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
	This is the secret key for your Beamio wallet. Do not share it
	with anyone – anyone with this key can move your funds.
	</p>
	<p className="mt-1">
	Beamio cannot recover this wallet if both your device and this
	private key are lost.
	</p>

      {/* 私钥容器 */}
      <div className={styles.privateKeyBox}>
        {/* 真正的私钥文本 */}
        <pre className={styles.privateKeyText}>
          {privateKey || 'No private key found.'}
        </pre>

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
	  <p className="text-[10px] text-slate-400 leading-snug">
            View this key only in a private place. Make sure no one is looking
            at your screen when you reveal it.
          </p>
		<div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 mt-3 text-[11px] text-slate-700 leading-snug">
            <p className="font-semibold mb-1">How to back this up</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Save it in a password manager you control, or</li>
              <li>Write it down on paper and store it in a safe place.</li>
              <li>Do not keep it in screenshots, email, or chat apps.</li>
            </ul>
          </div>
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
