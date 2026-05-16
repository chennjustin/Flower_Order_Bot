import { Outlet } from 'react-router-dom'
import Navbar from '@/components/layout/Navbar'

/** Main app shell with top Navbar (orders, messages, stats, etc.). */
export default function AppLayout() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </>
  )
}
