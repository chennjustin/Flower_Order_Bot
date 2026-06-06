import { Outlet } from 'react-router-dom'

const GRADIENT_STYLE = {
  background: 'linear-gradient(160deg, #6168FC 0%, #77B5FF 55%, #e4e7ff 100%)',
} as const

/**
 * Layout for onboarding wizard steps (no main Navbar).
 * Child routes render inside the centered card region via Outlet.
 */
export default function OnboardingLayout() {
  return (
    <div
      className="flex min-h-full flex-col items-center justify-center px-4 py-10"
      style={GRADIENT_STYLE}
    >
      <header className="mb-8 text-center">
        <p className="m-0 text-sm font-medium tracking-[2px] text-white/80">
          奇美花店
        </p>
        <h1 className="m-0 mt-1 text-2xl font-bold tracking-wide text-white">
          Chi-Mei Floral
        </h1>
        <p className="m-0 mt-2 text-sm text-white/75">帳號設定</p>
      </header>

      <main className="flex w-full max-w-md flex-col items-center">
        <Outlet />
      </main>
    </div>
  )
}
