import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface OrderSidePanelToggleProps {
  /** `open` = show handle to expand panel; `close` = show handle to collapse panel */
  mode: 'open' | 'close'
  onClick: () => void
  className?: string
}

/**
 * Seam control sitting on the border between chat and the order sidebar.
 */
export default function OrderSidePanelToggle({
  mode,
  onClick,
  className,
}: OrderSidePanelToggleProps) {
  const isOpen = mode === 'open'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isOpen ? '開啟訂單詳情' : '收起訂單詳情'}
      className={cn(
        'group flex flex-col items-center justify-center gap-1 border border-[#B3B3B3] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition',
        "font-['Noto_Sans_TC',sans-serif]",
        'hover:border-[#6168FC] hover:bg-[#F5F6FF] active:scale-[0.98]',
        isOpen
          ? 'absolute right-0 top-1/2 z-20 h-[88px] w-9 -translate-y-1/2 rounded-l-xl border-r-0 pr-0.5'
          : 'absolute -left-3 top-1/2 z-30 h-12 w-6 -translate-y-1/2 rounded-l-full border-r-0',
        className,
      )}
    >
      {isOpen ? (
        <>
          <ChevronsLeft
            className="h-4 w-4 text-[#528DD2] transition group-hover:text-[#6168FC]"
            strokeWidth={2.5}
            aria-hidden
          />
          <span className="text-[10px] font-bold leading-none text-[#528DD2] [writing-mode:vertical-rl] group-hover:text-[#6168FC]">
            訂單
          </span>
        </>
      ) : (
        <ChevronsRight
          className="h-4 w-4 text-[#528DD2] transition group-hover:text-white"
          strokeWidth={2.5}
          aria-hidden
        />
      )}
    </button>
  )
}
