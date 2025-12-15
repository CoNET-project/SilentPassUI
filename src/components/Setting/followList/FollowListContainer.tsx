import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { getFololowsData } from '@/services/beamio'
import { useDaemonContext } from '@/providers/DaemonProvider'
import { searchResult } from "@/components/Home/SearchBarWithResults"
import BeamioContactProfilePreview from '@/components/Home/BeamioContactProfilePreview'

type FollowUserItem = {
  address: string
  followedAt: number
  username: string 
  createdAt: number 
  image: string 
  firstName: string 
  lastName: string 
  followingCount: number
  followerCount: number
}

type Result = {
  following: FollowUserItem[]
  followers: FollowUserItem[]
  followingCount: number
  followerCount: number
}


type FollowListContainerProps = {
  tab: 'following' | 'followers'
  onClose: () => void
}

const getImg = (avatarSeed: string) =>
  `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(
    avatarSeed
  ).toString()}`

// 日期格式：Dec 10, 2025
const formatDate = (ts: number | null) => {
  if (!ts) return ''
  // 如果是秒级时间戳，转换成毫秒
  const ms = ts < 1e12 ? ts * 1000 : ts
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  })
}

const FollowListContainer = ({ tab, onClose }: FollowListContainerProps) => {
  const [activeTab, setActiveTab] = useState<'following' | 'followers'>(tab)

  const [following, setFollowing] = useState<FollowUserItem[]>([])
  const [followers, setFollowers] = useState<FollowUserItem[]>([])
  const [followingCount, setFollowingCount] = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [userPreviewItem, setUserPreviewItem] = useState<searchResult | null>()

  const [meUsername, setMeUsername] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const { beamio, profiles } = useDaemonContext()

  const list = activeTab === 'following' ? following : followers

  const displayName = (item: FollowUserItem) => {
    const full = [item.firstName, item.lastName].filter(Boolean).join(' ')
    return full || item.username || 'Unknown'
  }

  const shortAddress = (addr: string) => {
    if (!addr || addr.length < 10) return addr
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const getData = async () => {
    if (!beamio || !profiles?.length) return

    setMeUsername(beamio.accountName)

    const profile = profiles[0] as any

    try {
      const result: Result = await getFololowsData(profile.keyID)

      setFollowing(result.following || [])
      setFollowers(result.followers || [])

      setFollowingCount(
        typeof result.followingCount === 'number'
          ? result.followingCount
          : result.following?.length ?? 0
      )

      setFollowerCount(
        typeof result.followerCount === 'number'
          ? result.followerCount
          : result.followers?.length ?? 0
      )
    } catch (e) {
      console.error('getFololowsData error:', e)
    }
  }

  useEffect(() => {
    setIsOpen(true)
  }, [])

  useEffect(() => {
    getData()
  }, [beamio, profiles])

  return (
    <div className="fixed inset-0 z-50 bg-[#f6f7fb]">
      {userPreviewItem ? (
        <BeamioContactProfilePreview
          item={userPreviewItem}
          close={() => {
            setUserPreviewItem(null)
          }}
        />
      ) : (
        <>
          {/* 从右滑入容器 */}
          <div
            className={`
              h-full w-full
              flex flex-col
              px-4 pt-4 pb-6
              transform transition-transform duration-300 ease-out
              ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}
          >
            {/* 顶部：Tabs + 用户名 + 关闭 */}
            <div className="flex items-center justify-between mb-3">
              <div className="inline-flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('following')}
                  className={`px-3.5 h-8 rounded-full text-[13px] font-semibold flex items-center justify-center transition
                    ${
                      activeTab === 'following'
                        ? 'bg-white text-sky-600 shadow-sm'
                        : 'text-slate-500'
                    }`}
                >
                  Following ({followingCount})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('followers')}
                  className={`ml-1 px-3.5 h-8 rounded-full text-[13px] font-semibold flex items-center justify-center transition
                    ${
                      activeTab === 'followers'
                        ? 'bg-white text-sky-600 shadow-sm'
                        : 'text-slate-500'
                    }`}
                >
                  Followers ({followerCount})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {meUsername && (
                  <div className="text-[13px] text-slate-400">@{meUsername}</div>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="
                    w-8 h-8 rounded-full
                    flex items-center justify-center
                    bg-slate-100 text-slate-500
                    hover:bg-slate-200 hover:text-slate-700
                    active:scale-95
                    transition-all duration-150
                  "
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 列表区域 */}
            <div className="flex-1 overflow-y-auto pb-2">
              <div className="flex flex-col gap-2">
                {list.map(item => (
                  <button
                    key={item.address}
                    type="button"
                    className="
                      w-full text-left
                      rounded-[20px] bg-white
                      px-4 py-3
                      shadow-sm border border-slate-100
                      flex items-center justify-between
                      hover:bg-slate-50 active:scale-[0.99]
                      transition
                    "
                    onClick={() => {
						setUserPreviewItem({
							username: item.username,
							address: item.address,
							created_at: item.createdAt,
							first_name: item.firstName,
							image: item.image,
							last_name: item.lastName,
							follow_count: item.followingCount.toFixed(0),
							follower_count: item.followerCount.toFixed(0),
						})
                      // 预留 onClick：之后你可以在这里 setUserPreviewItem(...) 或者跳转
                      // setUserPreviewItem(…)
                    }}
                  >
                    {/* 左侧：头像 + 文本 */}
                    <div className="flex items-center min-w-0">
                      {/* 头像 */}
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.username || ''}
                          className="w-9 h-9 rounded-full object-cover mr-3 flex-shrink-0"
                        />
                      ) : (
                        <img
                          src={getImg(item.username || '')}
                          alt={item.username || ''}
                          className="w-9 h-9 rounded-full object-cover mr-3 flex-shrink-0 bg-slate-200"
                        />
                      )}

                      {/* 文本块 */}
                      <div className="flex flex-col min-w-0">
                        {/* 昵称 */}
                        <div className="text-[15px] font-semibold text-slate-900 truncate">
                          {displayName(item)}
                        </div>

                        {/* @username · address */}
                        <div className="mt-0.5 text-[12px] text-slate-500 flex items-center gap-1 min-w-0">
                          {item.username && (
                            <>
                              <span className="truncate">@{item.username}</span>
                              <span className="mx-1 text-slate-300">·</span>
                            </>
                          )}
                          <span className="shrink-0">
                            {shortAddress(item.address)}
                          </span>
                        </div>

                        {/* following / followers 统计 */}
                        <div className="mt-0.5 text-[12px] text-slate-400">
                          {item.followingCount} following · {item.followerCount}{' '}
                          followers
                        </div>
                      </div>
                    </div>

                    {/* 右侧日期 */}
                    <div className="ml-3 text-[11px] text-slate-400 whitespace-nowrap">
                      {formatDate(item.createdAt)}
                    </div>
                  </button>
                ))}

                {list.length === 0 && (
                  <div className="py-8 text-center text-[13px] text-slate-400">
                    {activeTab === 'following'
                      ? 'Not following anyone yet.'
                      : 'No followers yet.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default FollowListContainer
