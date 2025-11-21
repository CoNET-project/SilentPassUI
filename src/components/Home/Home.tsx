// Home.tsx

import { useTranslation } from 'react-i18next'
import styles from '@/components/Home/home.module.scss'
import { useDaemonContext } from '@/providers/DaemonProvider'
import ScanBtn from '@/components/Wallet/scanBtn/ScanButtonForB'
const Home = ({}) => {


  return (
    <div className={styles.home}>
      {/* 透明背景容器 */}
      <div className="flex-1 
                      pt-5 px-5 pb-24 
                      overflow-y-auto bg-transparent">

        {/* Search + QR row */}
        <div className="flex items-center gap-3 mb-4">

          {/* 搜索框：透明背景 */}
          <div className="flex items-center flex-1 h-11 
                          rounded-full 
                          bg-transparent 
                          border border-slate-300/40 
                          px-3">
            <span className="ml-2 text-[13px] text-slate-500">
              Find a person, @handle, or business
            </span>
          </div>

          {/* Search 按钮：透明背景 */}
          <ScanBtn />
        </div>

        {/* Recent Activity */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">
              Recent activity
            </span>
            <button className="text-xs text-slate-400">
              Filter
            </button>
          </div>

          {/* 卡片：透明背景 + 虚线边框 */}
          <div className="rounded-xl border border-dashed 
                          border-slate-300/50
                          px-3 py-3 
                          text-[11px] 
                          text-slate-400">
            No activity yet. Your payments and requests will appear here.
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
