import React, { useState, useEffect, useRef } from 'react'
import { Camera, Check, Trash2,  } from 'lucide-react'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { CoNET_Data, setCoNET_Data } from '../../utils/globals'
import { storeSystemData, postBeamio, postToIPFS } from '@/services/beamio'
import { getKeysFromCoNETPGPSCByAddress } from '@/services/chat'
import { ethers } from 'ethers'
import { AppButton } from '@/components/button/AppButton'
import GetPicture from '@/components/GetPicture/GetPicture'
const ipfsEndpoint = `https://ipfs.conet.network/api/getFragment?hash=`
/**
 * 仅用作 DiceBear avatar 的视觉占位 seed，**严禁作为 server `/api/addUser`
 * 提交的 accountName fallback**：链上 handle "Beamio" 已被 BeamioOfficial
 * (`0xEaBF0A98aC208647247eAA25fDD4eB0e67793d61`) 占用，
 * 其它 wallet 提交 accountName="Beamio" 会被 server `userOwnershipCheck`
 * 拒绝并返回 400 "Wallet & accountName ownership Error!"。
 */
const AVATAR_SEED_FALLBACK = 'Beamio'
/** Beamio handle 校验，必须与 server `/api/addUser` 端 `^[a-zA-Z0-9_\.]{3,20}$` 完全一致 */
const BEAMIO_HANDLE_RE = /^[a-zA-Z0-9_\.]{3,20}$/
/** BeamioOfficial 保留 handle 列表，只有 BeamioOfficial 自己才能在链上注册这些名字 */
const RESERVED_HANDLES = new Set(['Beamio'])
const BEAMIO_OFFICIAL_WALLET = '0xeabf0a98ac208647247eaa25fdd4eb0e67793d61'

type prof = {
  colse: (bo: beamio) => void
}

// ✅ Downscale helper：仅当 w>250 && h>250 才触发
const downscaleTo250 = (img: HTMLImageElement) => {
  const w = img.width
  const h = img.height

  if (!(w > 250 && h > 250)) return null

  let targetH = 250
  let targetW = Math.round((w * 250) / h)

  if (targetW < 250) {
    targetW = 250
    targetH = Math.round((h * 250) / w)
  }

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, targetW, targetH)
  ctx.drawImage(img, 0, 0, targetW, targetH)

  return canvas.toDataURL('image/png')
}


export default function BeamioAccountScreen({ colse }: prof) {
  const { beamio, setBeamio, darkModle, profiles } = useDaemonContext()
  const [avatarSeed, setAvatarSeed] = useState(beamio?.accountName || AVATAR_SEED_FALLBACK)
  const [avatarName, setAvatarName] = useState(beamio?.accountName || AVATAR_SEED_FALLBACK)
  const [firstName, setFirstName] = useState(beamio?.firstName || '')
  const [lastName, setLastName] = useState('')
  const [avatarImageDataTemp, setAvatarImageDataTemp] = useState<string | null>(null)
  const [avatarFileUrl, setAvatarFileUrl] = useState<string | null>(null)
  const [avatarFileName, setAvatarFileName] = useState<string>('')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  /** 进入页面时锁定的 accountName，保存时强制使用此值，防止被 AVATAR TEXT 或其它逻辑覆盖。
   *  注意：如果用户尚未注册（beamio.accountName 为空），此处必须保留为空字符串，
   *  让 `handleSaveAvatar` 走「补充注册」分支：从 `pendingHandle` 输入框取值，
   *  避免误把视觉占位 'Beamio' 提交给 server（'Beamio' 已被 BeamioOfficial 占用）。 */
  const accountNameLockRef = useRef<string>(beamio?.accountName || '')
  /** 未注册分支：用户在 BEAMIO HANDLE 输入框里填写的新 handle，仅当未注册时启用 */
  const [pendingHandle, setPendingHandle] = useState<string>('')
  /** 是否处于「补充注册」UI 分支。必须用 useState（而非派生自 ref），以便 initData 异步
   *  把 `beamio.accountName` 写入 lock 后能触发 BEAMIO HANDLE 区域从输入框切回 PERMANENT 只读。 */
  const [isHandleEditable, setIsHandleEditable] = useState<boolean>(!beamio?.accountName)
  const [loading, setLoading] = useState(false)
  const [avatarUploadingIpfs, setAvatarUploadingIpfs] = useState(false)
  const [avatarSeedConfirmed, setAvatarSeedConfirmed] = useState(false)
  const [openGetPicture, setOpenGetPicture] = useState(false)
  /** 上传完成后得到的 IPFS URL，保存账户时用此值作为 image，避免使用 blob/data URL */
  const [ipfsImageUrl, setIpfsImageUrl] = useState<string | null>(null)

  const avatarUrl = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed).toString()}`
  const currentAvatarSrcTemp = avatarImageDataTemp || avatarUrl
  const isDicebear = (src?: string | null) =>
  	!!src && src.includes("api.dicebear.com/8.x/fun-emoji/svg?seed=")
  const usingUploadedAvatar = !!avatarImageDataTemp && !isDicebear(currentAvatarSrcTemp)
  const checkLastName = (lastname: string|undefined) => {
	if (!lastname) return ''
	const spl = lastname.split('\r\n')[0]
	if (/^\{/.test(spl)) return ''
	return spl
  }

	const initData = async (bo: beamio) => {
		const img = bo.image || ''
		if (img && !isDicebear(img)) {
			setAvatarImageDataTemp(img)
			setIpfsImageUrl(img)
		} else {
			setAvatarImageDataTemp(null)
			setIpfsImageUrl(null)
			if (img && isDicebear(img)) {
				const m = img.match(/[?&]seed=([^&]+)/)
				if (m) {
					const seed = decodeURIComponent(m[1])
					setAvatarSeed(seed)
				}
			}
		}
		// 已注册用户：BEAMIO HANDLE (accountName) 不允许修改，进入时锁定。
		// 未注册用户：lock 留空字符串，UI 切到补充注册分支（pendingHandle 输入框 + Save Changes 提交）。
		const locked = bo.accountName || ''
		accountNameLockRef.current = locked
		setAvatarName(locked || AVATAR_SEED_FALLBACK)
		setIsHandleEditable(!locked)
		setLastName(checkLastName(bo?.lastName))
	}

  useEffect(() => {
    if (!beamio) return
    initData(beamio)
  }, [])

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
	const file = e.target.files?.[0]
	if (!file) return
	if (!file.type.startsWith("image/")) return
  
	// 允许重复选择同一个文件也触发 onChange
	e.target.value = ""
  
	// ✅ 1) 先用 objectURL 立即预览（avatarImageDataTemp 只存 URL）
	const blobUrl = URL.createObjectURL(file)
  
	setAvatarFileUrl(prev => {
	  if (prev) URL.revokeObjectURL(prev)
	  return blobUrl
	})
  
	setAvatarImageDataTemp(blobUrl)
	setAvatarFileName(file.name)
	setIpfsImageUrl(null)
	setAvatarUploadingIpfs(true)

	// ✅ 2) 异步转成 dataUrl → downscale → 上传 IPFS，成功后展示 IPFS URL
	const reader = new FileReader()
	reader.onloadend = () => {
	  const dataUrl = reader.result as string
	  if (!dataUrl) {
		setAvatarUploadingIpfs(false)
		return
	  }

	  const img = new Image()
	  img.onload = async () => {
		if (!profiles?.[0]) {
		  setAvatarUploadingIpfs(false)
		  return
		}
		const resized = downscaleTo250(img) || dataUrl
		const hash = await postToIPFS(profiles[0], resized)
		setAvatarUploadingIpfs(false)
		if (!hash) return

		const ipfsUrl = `${ipfsEndpoint}${hash}&t=${Date.now()}`
		setAvatarImageDataTemp(ipfsUrl)
		setIpfsImageUrl(ipfsUrl)
		setAvatarFileUrl(prev => {
		  if (prev) URL.revokeObjectURL(prev)
		  return null
		})
	  }
	  img.onerror = () => setAvatarUploadingIpfs(false)
	  img.src = dataUrl
	}
	reader.readAsDataURL(file)
  }

  const handleSaveAvatar = async () => {
    if (!CoNET_Data || !profiles) return
    if (avatarUploadingIpfs) return

    const tmpData = CoNET_Data
    // 已注册用户：BEAMIO HANDLE 不允许修改，使用进入页面时锁定的值，避免被 avatarSeed 或其它逻辑覆盖。
    // 未注册用户：从 BEAMIO HANDLE 输入框（pendingHandle）取值，「Save Changes」即「补充注册」入口。
    // **绝不 fallback 到 'Beamio'**：链上该 handle 已绑定 BeamioOfficial，普通 wallet 提交
    // 会触发 server `userOwnershipCheck` 拒绝并返回 400 "Wallet & accountName ownership Error!"。
    const accountNameToSave = (accountNameLockRef.current || pendingHandle || '').trim()
    if (!accountNameToSave || !BEAMIO_HANDLE_RE.test(accountNameToSave)) {
      window.alert(
        isHandleEditable
          ? 'Please enter a Beamio handle (3–20 chars: letters, digits, "_" or ".") to register your account.'
          : 'Beamio handle is invalid. Please reopen the app and try again.'
      )
      return
    }
    let myWalletAddrLc = ''
    try {
      myWalletAddrLc = new ethers.Wallet(profiles?.[0]?.privateKeyArmor).address.toLowerCase()
    } catch {
      window.alert('Wallet not ready. Please reopen the app and try again.')
      return
    }
    if (RESERVED_HANDLES.has(accountNameToSave) && myWalletAddrLc !== BEAMIO_OFFICIAL_WALLET) {
      window.alert(`"${accountNameToSave}" is a reserved Beamio handle. Please choose another handle.`)
      return
    }
    setLoading(true)

    // image 仅使用 IPFS URL；优先用当前展示的 avatarImageDataTemp（已是 IPFS 时），避免 setState 未提交导致 ipfsImageUrl 滞后
    let imageForSave = beamio?.image || ''
    const isIpfsUrl = (url: string) =>
      url.includes('getFragment?hash=') || url.startsWith(ipfsEndpoint)
    if (avatarImageDataTemp && isIpfsUrl(avatarImageDataTemp)) {
      imageForSave = avatarImageDataTemp
    } else if (ipfsImageUrl) {
      imageForSave = ipfsImageUrl
    } else if (avatarImageDataTemp && !avatarImageDataTemp.startsWith('blob:') && !isDicebear(avatarImageDataTemp)) {
      // 例如从 GetPicture 来的 data URL 尚未完成上传，保存时再上传一次
      const hash = await postToIPFS(profiles[0], avatarImageDataTemp)
      if (hash) imageForSave = `${ipfsEndpoint}${hash}&t=${Date.now()}`
    } else {
      // 使用 DiceBear 时，保存带当前 avatarSeed 的 URL，确保 AVATAR TEXT 生效
      imageForSave = `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(avatarSeed || AVATAR_SEED_FALLBACK)}`
    }

    const profile: profile = tmpData.profiles[0]
    let pgpPublicKeyID = (profile.chatManager as any)?.pgpKey?.keyID ?? beamio?.pgpPublicKeyID ?? ''
    let pgpPublicKeyArmor = (profile.chatManager as any)?.pgpKey?.publicKey ?? beamio?.pgpPublicKeyArmor ?? ''
    // 若 pgpKeys 为空，尝试从 AddressPGP 链上拉取（如 Beamio Official 等先通过 regiestChatRoute 登记的情况）
    if ((!pgpPublicKeyID || !pgpPublicKeyArmor) && profile.privateKeyArmor) {
      try {
        const walletAddr = new ethers.Wallet(profile.privateKeyArmor).address
        const keyInfo = await getKeysFromCoNETPGPSCByAddress(walletAddr, profile.privateKeyArmor)
        if (keyInfo?.userPgpKeyID) pgpPublicKeyID = pgpPublicKeyID || keyInfo.userPgpKeyID
        if (keyInfo?.publicArmored) pgpPublicKeyArmor = pgpPublicKeyArmor || keyInfo.publicArmored
      } catch (_) { /* 链上无则保持空 */ }
    }
    const bo: beamio = {
		firstName,
		lastName,
		accountName: accountNameToSave,
		image: imageForSave,
		darkTheme: darkModle,
		isETHFaucet: beamio?.isETHFaucet || false,
		isUSDCFaucet: beamio?.isUSDCFaucet || false,
		initialLoading: beamio?.initialLoading || false,
		createdAt: beamio?.createdAt || Date.now(),
		currency: 'USD',
		language: 'en',
		pgpPublicKeyID,
		pgpPublicKeyArmor
    }

    await postBeamio(bo, profile.privateKeyArmor)

    tmpData.beamio = bo
    setCoNET_Data(tmpData)

    await storeSystemData()
    setBeamio({ ...bo })

    setLoading(false)
    colse(bo)
  }

  return (
    <aside className="min-h-screen w-full bg-white">
      <div className="mx-auto w-full max-w-[520px] px-6 pb-10 pt-8">
        {/* Avatar */}
        <div className="flex flex-col items-center">
			<div className="relative">
				<div className="h-[118px] w-[118px] rounded-full bg-white shadow-[0_16px_40px_rgba(15,23,42,0.10)] ring-1 ring-slate-200 overflow-hidden">
				<img
					key={avatarSeed}
					src={currentAvatarSrcTemp}
					alt="Avatar"
					className="h-full w-full object-cover"
				/>
				{avatarUploadingIpfs && (
					<div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
						<div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
					</div>
				)}
				</div>

				{/* 右下角按钮：相机(选图) / 删除(恢复 dicebear) */}
				{usingUploadedAvatar ? (
				<button
					type="button"
					onClick={() => {
						setAvatarImageDataTemp(null)
						setAvatarFileUrl(null)
						setAvatarFileName('')
						setIpfsImageUrl(null)
					}}
					aria-label="Remove avatar image"
					className="
						absolute -right-1 -bottom-1
						h-10 w-10 rounded-full
						flex items-center justify-center
						bg-white/20
						backdrop-blur-[4px]
						shadow-[0_8px_20px_rgba(0,0,0,0.12)]
						transition
						ring-1 ring-white/40
						active:scale-95
						active:opacity-80
					"
					>
					<Trash2
						className="h-5 w-5 text-slate-500/50"
						strokeWidth={2}
					/>
					</button>
				) : (
				<button
						type="button"
						onClick={() => {
							setOpenGetPicture(true)
						}}
						aria-label="Change avatar"
						className="
							absolute -right-1 -bottom-1
							h-10 w-10 rounded-full
							flex items-center justify-center
							bg-white/20
							ring-1 ring-white/40
							backdrop-blur-[4px]
							shadow-[0_8px_20px_rgba(0,0,0,0.12)]
							transition
							active:scale-95
							active:opacity-80
						"
						>
						<Camera
							className="h-5 w-5 text-slate-500/50"
							strokeWidth={2}
						/>
						</button>
				)}
			</div>

			<input
				ref={avatarInputRef}
				id="avatarFileInput"
				type="file"
				accept="image/*"
				capture="environment"
				className="hidden"
				onChange={handleAvatarFileChange}
			/>
			</div>

        {/* AVATAR TEXT */}
        {!usingUploadedAvatar && (
			<div className="mt-7">
				<div className="text-[12px] font-semibold tracking-[0.12em] text-slate-400">
				AVATAR TEXT
				</div>

				<div
				className="
					mt-3
					flex items-center justify-between gap-3
					rounded-2xl bg-slate-50
					ring-1 ring-slate-200
					px-5 py-4
				"
				>
				<input
					value={avatarSeed}
					onChange={e => setAvatarSeed(e.target.value)}
					onFocus={() => setAvatarSeedConfirmed(false)}
					placeholder="Beamio"
					className="
					w-full bg-transparent outline-none
					text-[20px] font-semibold text-slate-900
					placeholder:text-slate-300
					"
				/>

				{!avatarSeedConfirmed && (
					<button
					type="button"
					onClick={() => setAvatarSeedConfirmed(true)}
					className="
						h-9 w-9 rounded-full flex items-center justify-center
						bg-emerald-500
						shadow-[0_10px_20px_rgba(16,185,129,0.25)]
						active:scale-95
					"
					aria-label="Confirm avatar text"
					>
					<Check className="h-5 w-5 text-white" strokeWidth={3} />
					</button>
				)}
				</div>

				<p className="mt-2 text-[12px] text-slate-500">
				Change the letters to pick a different avatar.
				</p>
			</div>
			)}

        {/* BEAMIO HANDLE */}
        <div className="mt-7">
          <div className="text-[12px] font-semibold tracking-[0.12em] text-slate-400">
            BEAMIO HANDLE
          </div>

          {isHandleEditable ? (
            // 未注册分支：本输入框就是补充注册入口，「Save Changes」会把它提交给 /api/addUser。
            // 一旦 server 注册成功，下次进入本页 accountNameLockRef 非空，自动切回只读 PERMANENT。
            <>
              <div
                className="
                  mt-3
                  flex items-center
                  rounded-2xl bg-white
                  ring-1 ring-slate-200
                  focus-within:ring-2 focus-within:ring-blue-200
                  px-5 py-4
                "
              >
                <span className="text-[20px] font-semibold text-slate-400 mr-1">@</span>
                <input
                  value={pendingHandle}
                  onChange={(e) => {
                    // 实时把非法字符过滤掉，避免提交时才报错
                    const v = e.target.value.replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 20)
                    setPendingHandle(v)
                  }}
                  placeholder="your_handle"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={20}
                  className="
                    w-full bg-transparent outline-none
                    text-[20px] font-semibold text-slate-900
                    placeholder:text-slate-300
                  "
                />
              </div>
              <p className="mt-2 text-[12px] text-slate-500">
                3–20 chars: letters, digits, &quot;_&quot; or &quot;.&quot;. Cannot be changed after registration.
              </p>
            </>
          ) : (
            <div
              className="
                mt-3
                flex items-center justify-between
                rounded-2xl bg-slate-100/70
                px-5 py-4
              "
            >
              <div className="text-[20px] font-semibold text-slate-700">
                @{avatarName}
              </div>

              <div className="rounded-xl bg-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-500">
                PERMANENT
              </div>
            </div>
          )}
        </div>

        {/* FIRST / LAST */}
				<div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2">
				<div>
					<div className="text-[12px] font-semibold tracking-[0.12em] text-slate-400">
						FIRST NAME
					</div>
					<input
					value={firstName}
					onChange={e => setFirstName(e.target.value)}
					placeholder="Music"
					className="
						mt-3 w-full
						rounded-2xl bg-white
						px-5 py-4
						text-[18px] sm:text-[20px]
						font-semibold text-slate-900
						ring-1 ring-slate-200
						outline-none
						focus:ring-2 focus:ring-blue-200
					"
					/>
				</div>

				<div>
					<div className="text-[12px] font-semibold tracking-[0.12em] text-slate-400">
					LAST NAME
					</div>
					<input
					value={lastName}
					onChange={e => setLastName(e.target.value)}
					placeholder="Stadium"
					className="
						mt-3 w-full
						rounded-2xl bg-white
						px-5 py-4
						text-[18px] sm:text-[20px]
						font-semibold text-slate-900
						ring-1 ring-slate-200
						outline-none
						focus:ring-2 focus:ring-blue-200
					"
					/>
				</div>
				</div>

        {/* Bottom button */}
        <div className="mt-10">
          {/* 如果你 AppButton 支持 className，建议给它这个样式；否则就包一层 div */}
          <div className="rounded-2xl shadow-[0_18px_50px_rgba(37,99,235,0.28)]">
            <AppButton onClick={handleSaveAvatar} loading={loading} disabled={avatarUploadingIpfs} fullWidth>
              Save Changes
            </AppButton>
          </div>
        </div>
      </div>
	  <GetPicture
		open={openGetPicture}
		onClose={() => setOpenGetPicture(false)}
		downscaleTo250={downscaleTo250}
		onPicked={async (dataUrl) => {
			setAvatarImageDataTemp(dataUrl)
			setAvatarFileUrl(null)
			setAvatarFileName('')
			if (!profiles?.[0] || !dataUrl) return
			setAvatarUploadingIpfs(true)
			const hash = await postToIPFS(profiles[0], dataUrl)
			setAvatarUploadingIpfs(false)
			if (hash) {
				const ipfsUrl = `${ipfsEndpoint}${hash}&t=${Date.now()}`
				setAvatarImageDataTemp(ipfsUrl)
				setIpfsImageUrl(ipfsUrl)
			}
		}}
		/>
    </aside>
  )
}
