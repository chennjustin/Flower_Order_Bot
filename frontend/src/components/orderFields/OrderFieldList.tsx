import { Eye, EyeOff, GripVertical } from 'lucide-react'
import { getRegistryEntry, isFieldLockedVisible } from '@/config/orderDisplayFields'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import { cn } from '@/lib/utils'

/**
 * Configurable field list with visibility toggles (drag-and-drop in Step 11).
 */
export default function OrderFieldList() {
  const { sortedDraftFields, toggleVisible } = useOrderDisplayConfig()

  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-lg font-bold text-[#333] font-['Noto_Sans_TC',sans-serif]">
        選擇欄位與順序
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1 rounded-xl bg-white p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
        {sortedDraftFields.map(field => {
          const label = getRegistryEntry(field.key).label
          const locked = isFieldLockedVisible(field.key)

          return (
            <li
              key={field.key}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-2.5',
                !field.visible && 'opacity-70',
              )}
            >
              <GripVertical
                className="h-5 w-5 flex-shrink-0 text-[#999]"
                aria-hidden
              />
              <span
                className={cn(
                  'flex-1 text-base font-medium font-["Noto_Sans_TC",sans-serif]',
                  field.visible ? 'text-black' : 'text-black/40',
                )}
              >
                {label}
              </span>
              <button
                type="button"
                disabled={locked}
                onClick={() => toggleVisible(field.key)}
                aria-label={
                  field.visible ? `隱藏${label}` : `顯示${label}`
                }
                aria-pressed={field.visible}
                className={cn(
                  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border-0 bg-transparent transition-colors',
                  locked
                    ? 'cursor-not-allowed text-black/25'
                    : 'cursor-pointer text-[#555] hover:bg-black/5',
                )}
              >
                {field.visible ? (
                  <Eye className="h-5 w-5" strokeWidth={2} />
                ) : (
                  <EyeOff className="h-5 w-5" strokeWidth={2} />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
