import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { OrderDisplayConfigProvider } from '@/context/OrderDisplayConfigContext'
import { router } from './router'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrderDisplayConfigProvider>
          <RouterProvider router={router} />
        </OrderDisplayConfigProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
