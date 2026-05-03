import { createBrowserRouter } from 'react-router-dom'
import App from '@/App'
import DashboardPage from '@/pages/DashboardPage'
import OrdersPage from '@/pages/OrdersPage'
import StatsPage from '@/pages/StatsPage'
import MessagesPage from '@/pages/MessagesPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'messages', element: <MessagesPage /> },
      { path: 'stats', element: <StatsPage /> },
    ],
  },
])
