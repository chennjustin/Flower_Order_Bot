import {
  BarChart2,
  Home,
  MessageCircle,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import SidebarMenuIcon from './SidebarMenuIcon'
import { cn } from '@/lib/utils'

interface MenuItem {
  label: string
  icon: LucideIcon
  route: string
}

const PRIMARY_MENU: MenuItem[] = [
  { label: '首頁', icon: Home, route: '/' },
  { label: '訂單管理', icon: ShoppingBag, route: '/orders' },
  { label: '顧客溝通', icon: MessageCircle, route: '/messages' },
  { label: '訂單欄位設定', icon: MessageCircle, route: '/settings/order-fields' },
]

const SECONDARY_MENU: MenuItem[] = [
  { label: '統計資料', icon: BarChart2, route: '/stats' },
]

interface SidebarProps {
  show: boolean
  onClose: () => void
}

function MenuRow({
  item,
  active,
  onSelect,
}: {
  item: MenuItem
  active: boolean
  onSelect: () => void
}) {
  const Icon = item.icon
  return (
    <li className="px-2">
      <button
        type="button"
        onClick={onSelect}
        data-active={active}
        className={cn(
          'flex h-10 w-full items-center gap-4 rounded-[24px] px-[22px] py-2 text-left transition-colors',
          "font-['Noto_Sans_TC',sans-serif] text-base font-normal leading-[140%] text-black/[0.87]",
          'hover:bg-[#C5C7FF]/70',
          'data-[active=true]:bg-[#C5C7FF]',
        )}
      >
        <Icon className="h-6 w-6 shrink-0 text-[#1E1E1E]" strokeWidth={2.5} />
        {item.label}
      </button>
    </li>
  )
}

export default function Sidebar({ show, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  function isActive(route: string) {
    return route === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(route)
  }

  function select(item: MenuItem) {
    navigate(item.route)
    onClose()
  }

  return (
    <>
      <div
        data-show={show}
        onClick={onClose}
        aria-hidden={!show}
        className="pointer-events-none fixed inset-0 z-[999] bg-black/40 opacity-0 transition-opacity duration-300 ease-in-out data-[show=true]:pointer-events-auto data-[show=true]:opacity-100"
      />
      <aside
        data-show={show}
        aria-hidden={!show}
        className={cn(
          'fixed top-0 left-0 z-[1000] flex h-screen w-[264px] max-w-[85vw] -translate-x-full flex-col overflow-hidden',
          'bg-[#F7F7F7] shadow-[4px_0_8px_rgba(0,0,0,0.25)]',
          'rounded-tr-xl rounded-br-xl',
          'transition-transform duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]',
          'data-[show=true]:translate-x-0',
        )}
      >
        <header className="relative flex h-20 shrink-0 items-center border-b border-black/[0.38] bg-[#F7F7F7]">
          <BrandLogo size="sidebar" className="ml-[30px]" />
          <button
            type="button"
            onClick={onClose}
            tabIndex={show ? 0 : -1}
            aria-label="收合側邊欄"
            className="absolute top-1/2 right-[29px] flex h-7 w-7 -translate-y-1/2 items-center justify-center border-none bg-transparent p-0 text-[#6168FC] transition-opacity hover:opacity-80 active:scale-95"
          >
            <SidebarMenuIcon />
          </button>
        </header>

        <nav className="flex-1 overflow-y-auto pt-2">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {PRIMARY_MENU.map(item => (
              <MenuRow
                key={item.label}
                item={item}
                active={isActive(item.route)}
                onSelect={() => select(item)}
              />
            ))}
          </ul>

          <div className="mx-2 my-2 border-t border-black/[0.38]" />

          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {SECONDARY_MENU.map(item => (
              <MenuRow
                key={item.label}
                item={item}
                active={isActive(item.route)}
                onSelect={() => select(item)}
              />
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
