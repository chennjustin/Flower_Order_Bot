import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface OnboardingCardProps {
  title?: string
  description?: string
  children: ReactNode
  className?: string
}

/** Centered white card used on onboarding steps. */
export default function OnboardingCard({
  title,
  description,
  children,
  className,
}: OnboardingCardProps) {
  const hasHeader = Boolean(title || description)

  return (
    <div
      className={cn(
        'w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 shadow-xl',
        className,
      )}
    >
      {title ? (
        <h1 className="m-0 text-center text-xl font-bold text-[#3a3a3a]">{title}</h1>
      ) : null}
      {description ? (
        <p className="mt-2 mb-0 text-center text-sm leading-relaxed text-black/60">
          {description}
        </p>
      ) : null}
      <div className={hasHeader ? 'mt-6' : undefined}>{children}</div>
    </div>
  )
}
