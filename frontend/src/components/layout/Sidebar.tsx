import { useLocation, useNavigate } from 'react-router-dom'

interface MenuItem {
  label: string
  icon: string
  route: string
}

const MENU: MenuItem[] = [
  { label: '首頁', icon: 'fas fa-home', route: '/' },
  { label: '訂單管理', icon: 'fas fa-shopping-bag', route: '/orders' },
  { label: '顧客溝通', icon: 'fas fa-comment', route: '/messages' },
  { label: '訂單欄位設定', icon: 'fas fa-cog', route: '/settings/order-fields' },
  { label: '統計資料', icon: 'fas fa-chart-bar', route: '/stats' },
]

interface SidebarProps {
  show: boolean
  onClose: () => void
}

export default function Sidebar({ show, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

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
        className="fixed top-0 left-0 z-[1000] flex h-screen w-[min(280px,85vw)] -translate-x-full flex-col overflow-hidden rounded-tr-xl rounded-br-xl bg-[#F7F7F7] shadow-[2px_0_12px_rgba(0,0,0,0.2)] transition-transform duration-[400ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] data-[show=true]:translate-x-0"
      >
        <header className="flex h-14 items-center justify-between border-b border-black/40 bg-[#f5f5f5] px-5">
          <h2 className="m-0 truncate text-[18px] font-medium text-brand-primary">
            訂單管理平台
          </h2>
          <button
            type="button"
            onClick={onClose}
            tabIndex={show ? 0 : -1}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border-none bg-transparent text-2xl text-[#999] transition-colors hover:bg-black/5 hover:text-[#333] active:scale-95"
            aria-label="關閉側邊欄"
          >
            <i className="fas fa-times" />
          </button>
        </header>
        <nav className="flex-1 overflow-y-auto py-5">
          <ul className="m-0 list-none p-0">
            {MENU.map((item) => {
              const active =
                item.route === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.route)
              return (
                <li
                  key={item.label}
                  onClick={() => select(item)}
                  data-active={active}
                  className="flex cursor-pointer items-center gap-3 rounded-3xl px-6 py-3 text-base text-[#555] transition-colors hover:bg-brand-soft hover:text-brand-primary-dark data-[active=true]:bg-brand-soft data-[active=true]:text-brand-primary-dark"
                >
                  <i className={`${item.icon} w-5 text-center`} />
                  {item.label}
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}
