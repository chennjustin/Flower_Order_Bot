import { cn } from '@/lib/utils'

interface StepIndicatorProps {
  /** Current step number (1-based). */
  current: 1 | 2
  /** Total onboarding wizard steps before the order-fields page. */
  total?: 2
  className?: string
}

/** Shows progress within the two-step onboarding wizard (name + LINE OA). */
export default function StepIndicator({
  current,
  total = 2,
  className,
}: StepIndicatorProps) {
  return (
    <p
      className={cn(
        'm-0 text-center text-sm font-medium tracking-wide text-white/90',
        className,
      )}
      aria-live="polite"
    >
      步驟 {current} / {total}
    </p>
  )
}
