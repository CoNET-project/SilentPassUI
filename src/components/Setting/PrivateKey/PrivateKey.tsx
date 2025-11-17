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
      <p className={styles.privateKeyWarning}>
        Do not share this with anyone. Anyone with your private key can steal
        your funds.
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
