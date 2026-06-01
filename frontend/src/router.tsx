import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import OrdersPage from './pages/OrdersPage'
import MessagesPage from './pages/MessagesPage'
import StatsPage from './pages/StatsPage'
import OrderFieldSettingsPage from './pages/OrderFieldSettingsPage'
import { redirectIfAuthed, requireAuth } from '@/lib/auth'

export const router = createBrowserRouter([
  {
    path: '/login',
    loader: redirectIfAuthed,
    element: <LoginPage />,
  },
  {
    path: '/',
    loader: requireAuth,
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'messages', element: <MessagesPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'settings/order-fields', element: <OrderFieldSettingsPage /> },
    ],
  },
])
