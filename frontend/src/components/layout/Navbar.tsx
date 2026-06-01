import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import BrandLogo from './BrandLogo'
import Sidebar from './Sidebar'
import SidebarMenuIcon from './SidebarMenuIcon'

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
      <header className="fixed top-0 left-0 z-[1000] flex h-14 w-full items-center bg-[#D8EAFF]">
        <button
          type="button"
          onClick={() => setShowSidebar(true)}
          aria-label="開啟側邊欄"
          aria-expanded={showSidebar}
          className="absolute left-7 top-1/2 flex -translate-y-1/2 items-center justify-center border-none bg-transparent p-0 transition-opacity hover:opacity-80 active:scale-95"
        >
          <SidebarMenuIcon />
        </button>
        <div className="absolute left-[73px] top-1/2 flex -translate-y-1/2 items-center gap-[13px]">
          <BrandLogo size="nav" />
        </div>
      </header>

      <Sidebar show={showSidebar} onClose={() => setShowSidebar(false)} />
    </>
  )
}
