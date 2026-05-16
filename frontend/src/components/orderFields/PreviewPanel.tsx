import { getRegistryEntry } from '@/config/orderDisplayFields'
import { useOrderDisplayConfig } from '@/context/OrderDisplayConfigContext'
import { settingsSectionTitleClass } from '@/components/orderFields/orderFieldSettingsStyles'

/**
 * Live preview of visible field labels in display order (Figma right panel).
 */
export default function PreviewPanel() {
  const { sortedDraftFields } = useOrderDisplayConfig()

  const visibleFields = sortedDraftFields.filter(field => field.visible)

  return (
    <>
      <h3 className={settingsSectionTitleClass}>預覽</h3>
      <div className="mt-4 flex min-h-[442px] flex-1 flex-col gap-2">
        {visibleFields.length === 0 ? (
          <p className="m-0 text-base font-bold leading-[140%] text-black/38 font-['Noto_Sans_TC',sans-serif]">
            目前沒有可見欄位
          </p>
        ) : (
          visibleFields.map(field => (
            <span
              key={field.key}
              className={[
                'inline-flex h-[30px] w-fit items-center rounded-lg border border-[#B3B3B3]',
                'px-2 py-1 text-base font-bold leading-[140%] text-black/60',
                "font-['Noto_Sans_TC',sans-serif]",
              ].join(' ')}
            >
              {getRegistryEntry(field.key).label}
            </span>
          ))
        )}
      </div>
    </>
  )
}
