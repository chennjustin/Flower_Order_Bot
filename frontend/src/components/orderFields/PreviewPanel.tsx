import { getRegistryEntry } from '@/config/orderDisplayFields'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'

/**
 * Live preview of visible field labels in display order (mockup right panel).
 */
export default function PreviewPanel() {
  const { sortedDraftFields } = useOrderDisplayConfig()

  const visibleFields = sortedDraftFields.filter(field => field.visible)

  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 text-lg font-bold text-[#333] font-['Noto_Sans_TC',sans-serif]">
        預覽
      </h3>
      <div className="flex min-h-[320px] flex-1 flex-col gap-2">
        {visibleFields.length === 0 ? (
          <p className="m-0 text-sm text-black/40 font-['Noto_Sans_TC',sans-serif]">
            目前沒有可見欄位
          </p>
        ) : (
          visibleFields.map(field => (
            <span
              key={field.key}
              className="inline-flex w-full items-center justify-center rounded-lg bg-[#E8E8E8] px-4 py-3 text-center text-base font-medium text-[#555] font-['Noto_Sans_TC',sans-serif]"
            >
              {getRegistryEntry(field.key).label}
            </span>
          ))
        )}
      </div>
    </div>
  )
}
