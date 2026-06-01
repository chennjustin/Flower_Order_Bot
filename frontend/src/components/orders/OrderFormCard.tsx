import { useMemo } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'
import {
  getVisibleOrderFormFields,
  orderFormTitle,
  type OrderFormMode,
} from '@/config/orderFormFields'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import { formatOrderFormFieldValue } from '@/lib/orderFieldPresentation'
import type { Order } from '@/types/domain'
import { cn } from '@/lib/utils'

interface OrderFormCardProps {
  mode: OrderFormMode
  order?: Order | null
  className?: string
  onPrimaryAction?: () => void
  onClose?: () => void
}

const labelClass =
  "py-1 text-base font-bold leading-[140%] text-black/[0.87] font-['Noto_Sans_TC',sans-serif]"
const valueClass =
  "text-base font-bold leading-[140%] text-black/60 font-['Noto_Sans_TC',sans-serif]"

export default function OrderFormCard({
  mode,
  order,
  className,
  onPrimaryAction,
  onClose,
}: OrderFormCardProps) {
  const { savedConfig } = useOrderDisplayConfig()
  const title = orderFormTitle(mode)
  const isView = mode === 'view'

  const formFields = useMemo(
    () => getVisibleOrderFormFields(savedConfig),
    [savedConfig],
  )

  return (
    <div
      className={cn(
        'flex w-[496px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[24px] bg-white',
        'border-r border-[#B3B3B3] shadow-[0_4px_4px_rgba(0,0,0,0.25)]',
        className,
      )}
    >
      <header className="relative flex h-20 shrink-0 items-center border-b border-black/[0.38] px-10">
        <h2
          className={cn(
            "text-2xl font-bold leading-[125%] tracking-[0.1em] text-[#6168FC]",
            "font-['Noto_Sans_TC',sans-serif]",
          )}
        >
          {title}
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="absolute right-6 top-1/2 -translate-y-1/2 rounded-sm p-1 text-black/50 transition hover:text-black/80"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </header>

      <div className="flex max-h-[min(442px,calc(90vh-10rem))] overflow-y-auto px-10 py-4">
        <div className="flex w-full gap-5">
          <div className="flex w-[152px] shrink-0 flex-col gap-2">
            {formFields.map(field => (
              <div key={field.key} className="flex h-[30px] items-center py-1">
                <span className={labelClass}>{field.label}</span>
              </div>
            ))}
          </div>

          <div className="flex w-[200px] shrink-0 flex-col gap-2">
            {formFields.map(field => {
              const display =
                order != null ? formatOrderFormFieldValue(field.key, order) : '—'
              const isSelect = field.type === 'select'
              const isPlain = field.plain === true

              if (isView && isPlain) {
                return (
                  <div key={field.key} className="flex h-[30px] items-center px-2 py-1">
                    <span className={valueClass}>{display}</span>
                  </div>
                )
              }

              return (
                <div
                  key={field.key}
                  className={cn(
                    'flex h-[30px] items-center gap-2 rounded-lg px-2 py-1',
                    !isPlain && 'border border-[#B3B3B3]',
                    isSelect && 'justify-between',
                  )}
                >
                  <span className={cn(valueClass, 'min-w-0 truncate')}>{display}</span>
                  {isSelect && (
                    <ChevronDown className="h-5 w-5 shrink-0 text-black/60" strokeWidth={2} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {mode === 'create' && (
        <footer className="flex shrink-0 justify-center pb-8 pt-4">
          <button
            type="button"
            onClick={onPrimaryAction}
            className={cn(
              'flex h-10 items-center gap-2 rounded-xl bg-[#6168FC] px-3 py-2',
              'text-base font-bold text-white shadow-[2px_2px_2px_rgba(0,0,0,0.25)]',
              "font-['Noto_Sans_TC',sans-serif] transition hover:opacity-90",
            )}
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
            新增訂單
          </button>
        </footer>
      )}
    </div>
  )
}
