import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useAuth } from '@/contexts/AuthContext'

export default function Navbar() {
  const [showSidebar, setShowSidebar] = useState(false)
  const { session, signOut } = useAuth()
  const navigate = useNavigate()

  const displayName =
    session?.user?.user_metadata?.full_name ??
    session?.user?.email ??
    '花店系統'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

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
          {displayName}
        </span>

        {session && (
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="登出"
            title="登出"
            className="absolute top-[13px] right-[20px] flex h-8 items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 text-xs font-medium text-white transition hover:bg-white/20 active:scale-95"
          >
            <i className="fas fa-sign-out-alt" />
            登出
          </button>
        )}
      </div>

      <Sidebar show={showSidebar} onClose={() => setShowSidebar(false)} />
    </>
  )
}
