import { Outlet } from 'react-router-dom'

const BACKGROUND_STYLE = {
  backgroundColor: '#D8EAFF',
} as const

/**
 * Layout for onboarding wizard steps (no main Navbar).
 * Child routes render inside the centered card region via Outlet.
 */
export default function OnboardingLayout() {
  return (
    <div
      className="flex min-h-full flex-col items-center justify-center px-4 py-10"
      style={BACKGROUND_STYLE}
    >
      <header className="mb-8 text-center">
        <p className="m-0 text-base font-medium tracking-[2px] text-black">
          奇美花店
        </p>
        <h1 className="m-0 mt-1 text-3xl font-bold tracking-wide text-black">
          Chi-Mei Floral
        </h1>
        <p className="m-0 mt-2 text-base text-black">帳號設定</p>
      </header>

      <main className="flex w-full max-w-md flex-col items-center">
        <Outlet />
      </main>
    </div>
  )
}
