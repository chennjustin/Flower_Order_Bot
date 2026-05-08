import { useState } from 'react'
import Sidebar from './Sidebar'
import { cn } from '@/lib/utils'

export default function Navbar() {
  const [showSidebar, setShowSidebar] = useState(false)

  return (
    <div className="fixed top-0 left-0 z-[1000] m-0 flex h-14 w-screen p-0">
      <div
        className="relative h-14 w-full rounded-3xl"
        style={{
          background:
            'linear-gradient(90.11deg, #6168FC 5.18%, #77B5FF 98.9%)',
        }}
      >
        <button
          type="button"
          onClick={() => setShowSidebar(s => !s)}
          aria-label={showSidebar ? '關閉側邊欄' : '開啟側邊欄'}
          aria-expanded={showSidebar}
          className="group absolute top-[13px] left-[28px] h-8 w-8 border-none bg-transparent p-0 transition-transform duration-200 ease-out hover:scale-110 active:scale-90"
        >
          <span
            className={cn(
              'absolute left-[2px] block h-[3px] w-7 rounded-full bg-white transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
              showSidebar ? 'top-[14.5px] rotate-45' : 'top-[8px] group-hover:w-6',
            )}
          />
          <span
            className={cn(
              'absolute left-[2px] top-[14.5px] block h-[3px] w-7 rounded-full bg-white transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
              showSidebar
                ? 'scale-x-0 opacity-0'
                : 'opacity-100 group-hover:w-5',
            )}
          />
          <span
            className={cn(
              'absolute left-[2px] block h-[3px] w-7 rounded-full bg-white transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
              showSidebar
                ? 'top-[14.5px] -rotate-45'
                : 'top-[21px] group-hover:w-6',
            )}
          />
        </button>
        <span className="absolute top-[13px] left-[73px] flex h-[30px] items-center gap-[13px] text-[1.4rem] font-bold tracking-[3px] text-white">
          奇美花店 <b>Chi-Mei Floral</b>
        </span>
      </div>
      <Sidebar show={showSidebar} onClose={() => setShowSidebar(false)} />
    </div>
  )
}
