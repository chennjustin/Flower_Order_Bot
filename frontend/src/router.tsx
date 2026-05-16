import { createBrowserRouter } from 'react-router-dom'
import RequireAuth from '@/components/auth/RequireAuth'
import OnboardingStepGuard from '@/components/auth/OnboardingStepGuard'
import App from './App'
import OnboardingLayout from './layouts/OnboardingLayout'
import DashboardPage from './pages/DashboardPage'
import OrdersPage from './pages/OrdersPage'
import MessagesPage from './pages/MessagesPage'
import StatsPage from './pages/StatsPage'
import LoginPage from './pages/LoginPage'
import OnboardingNamePage from './pages/onboarding/OnboardingNamePage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/onboarding',
    element: (
      <RequireAuth>
        <OnboardingLayout />
      </RequireAuth>
    ),
    children: [
      {
        path: 'name',
        element: (
          <OnboardingStepGuard expectedStep="NAME">
            <OnboardingNamePage />
          </OnboardingStepGuard>
        ),
      },
    ],
  },
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
