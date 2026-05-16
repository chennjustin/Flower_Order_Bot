import type { ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import RequireAuth from '@/components/auth/RequireAuth'
import RequireOnboardingDone from '@/components/auth/RequireOnboardingDone'
import OnboardingStepGuard from '@/components/auth/OnboardingStepGuard'
import OnboardingIndexRedirect from '@/components/auth/OnboardingIndexRedirect'
import App from './App'
import OnboardingLayout from './layouts/OnboardingLayout'
import DashboardPage from './pages/DashboardPage'
import OrdersPage from './pages/OrdersPage'
import MessagesPage from './pages/MessagesPage'
import StatsPage from './pages/StatsPage'
import LoginPage from './pages/LoginPage'
import OnboardingNamePage from './pages/onboarding/OnboardingNamePage'
import OnboardingLineOfficialPage from './pages/onboarding/OnboardingLineOfficialPage'
import OrderFieldsPage from './pages/settings/OrderFieldsPage'

/** Wraps main back-office pages; blocks until onboarding is DONE. */
function ProtectedPage({ children }: { children: ReactNode }) {
  return <RequireOnboardingDone>{children}</RequireOnboardingDone>
}

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
      { index: true, element: <OnboardingIndexRedirect /> },
      {
        path: 'name',
        element: (
          <OnboardingStepGuard expectedStep="NAME">
            <OnboardingNamePage />
          </OnboardingStepGuard>
        ),
      },
      {
        path: 'line-official',
        element: (
          <OnboardingStepGuard expectedStep="LINE_OA">
            <OnboardingLineOfficialPage />
          </OnboardingStepGuard>
        ),
      },
    ],
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <App />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: (
          <ProtectedPage>
            <DashboardPage />
          </ProtectedPage>
        ),
      },
      {
        path: 'orders',
        element: (
          <ProtectedPage>
            <OrdersPage />
          </ProtectedPage>
        ),
      },
      {
        path: 'messages',
        element: (
          <ProtectedPage>
            <MessagesPage />
          </ProtectedPage>
        ),
      },
      {
        path: 'stats',
        element: (
          <ProtectedPage>
            <StatsPage />
          </ProtectedPage>
        ),
      },
      {
        // Allowed during LINE_OA so mount can call completeOnboarding()
        path: 'settings/order-fields',
        element: <OrderFieldsPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
