import { useState } from 'react'
import Sidebar from './Sidebar'

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
          onClick={() => setShowSidebar(true)}
          className="absolute top-[13px] left-[28px] flex h-8 w-8 cursor-pointer items-center border-none bg-transparent text-[28px] text-white"
          aria-label="開啟側邊欄"
        >
          <i className="fas fa-bars" />
        </button>
        <span className="absolute top-[13px] left-[73px] flex h-[30px] items-center gap-[13px] text-[1.4rem] font-bold tracking-[3px] text-white">
          奇美花店 <b>Chi-Mei Floral</b>
        </span>
      </div>
      <Sidebar show={showSidebar} onClose={() => setShowSidebar(false)} />
    </div>
  )
}
