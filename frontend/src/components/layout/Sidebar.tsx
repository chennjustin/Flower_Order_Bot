import { useNavigate, useLocation } from 'react-router-dom'
import './Sidebar.css'

type MenuEntry = {
  label: string
  icon: string
  route: string
}

const menu: MenuEntry[] = [
  { label: '首頁', icon: 'fas fa-home', route: '/' },
  { label: '訂單管理', icon: 'fas fa-shopping-bag', route: '/orders' },
  { label: '顧客溝通', icon: 'fas fa-comment', route: '/messages' },
  { label: '統計資料', icon: 'fas fa-chart-bar', route: '/stats' },
]

interface SidebarProps {
  show: boolean
  onClose: () => void
}

export default function Sidebar({ show, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  function selectItem(item: MenuEntry) {
    navigate(item.route)
    onClose()
  }

  return (
    <>
      {show ? (
        <div role="presentation" className="sidebar-overlay sidebar-fade" onClick={onClose} />
      ) : null}
      {show ? (
        <aside className="sidebar sidebar-slide">
          <header className="sidebar-header">
            <h2>訂單管理平台</h2>
            <button type="button" className="close-btn" aria-label="Close menu" onClick={onClose}>
              <i className="fas fa-times" />
            </button>
          </header>
          <nav className="sidebar-menu">
            <ul>
              {menu.map((item) => (
                <li
                  key={item.label}
                  className={(item.route === '/' ? pathname === '/' : pathname.startsWith(item.route))
                    ? 'active'
                    : undefined}
                  onClick={() => selectItem(item)}
                  role="presentation"
                >
                  <i className={item.icon} /> {item.label}
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      ) : null}
    </>
  )
}
