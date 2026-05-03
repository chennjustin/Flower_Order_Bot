import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import './Navbar.css'

export default function Navbar() {
  const [showSidebar, setShowSidebar] = useState(false)

  return (
    <div className="navbar-wrapper">
      <div className="brand-bar">
        <button type="button" className="hamburger-btn" onClick={() => setShowSidebar(true)}>
          <i className="fas fa-bars" />
        </button>
        <span className="brand-title">
          奇美花店 <b>Chi-Mei Floral</b>
        </span>
      </div>
      <Sidebar show={showSidebar} onClose={() => setShowSidebar(false)} />
    </div>
  )
}
