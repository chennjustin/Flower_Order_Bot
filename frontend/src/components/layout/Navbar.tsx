import { useState } from 'react'
import Sidebar from './Sidebar'

export default function Navbar() {
  const [showSidebar, setShowSidebar] = useState(false)

  return (
    <>
      <div
        className="fixed top-0 left-0 z-[1000] h-14 w-screen rounded-3xl"
        style={{
          background:
            'linear-gradient(90.11deg, #6168FC 5.18%, #77B5FF 98.9%)',
        }}
      >
        <button
          type="button"
          onClick={() => setShowSidebar(true)}
          aria-label="開啟側邊欄"
          aria-expanded={showSidebar}
          className="absolute top-[13px] left-[28px] flex h-8 w-8 items-center justify-center border-none bg-transparent p-0 text-[28px] text-white transition-transform duration-200 ease-out hover:scale-110 active:scale-90"
        >
          <i className="fas fa-bars" />
        </button>
        <span className="absolute top-[13px] left-[73px] flex h-[30px] items-center gap-[13px] text-[1.4rem] font-bold tracking-[3px] text-white">
          奇美花店 <b>Chi-Mei Floral</b>
        </span>
      </div>

      <Sidebar show={showSidebar} onClose={() => setShowSidebar(false)} />
    </>
  )
}
