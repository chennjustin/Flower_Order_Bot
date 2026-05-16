import { cn } from '@/lib/utils'

interface SidebarMenuIconProps {
  className?: string
}

/** Square panel icon from design spec (28×28, #6168FC stroke). */
export default function SidebarMenuIcon({ className }: SidebarMenuIconProps) {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <rect
        x="3.5"
        y="3.5"
        width="21"
        height="21"
        rx="1.5"
        stroke="#6168FC"
        strokeWidth="3"
      />
      <line x1="9" y1="5" x2="9" y2="23" stroke="#6168FC" strokeWidth="3" />
    </svg>
  )
}
