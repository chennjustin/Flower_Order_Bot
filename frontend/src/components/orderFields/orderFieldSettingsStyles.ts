import { cn } from '@/lib/utils'

/** Shared card shell for column-settings panels (Figma edit-columns). */
export const settingsCardClass = cn(
  'flex w-full max-w-[370px] min-h-[619px] flex-col',
  'rounded-[24px] border border-[#B3B3B3] bg-white',
  'shadow-[0_4px_4px_rgba(0,0,0,0.25)]',
)

/** Section title (headline/H3). */
export const settingsSectionTitleClass = cn(
  "m-0 text-2xl font-bold leading-[125%] tracking-[0.1em] text-[#6168FC]",
  "font-['Noto_Sans_TC',sans-serif]",
)

const settingsBtnBase = cn(
  'inline-flex h-10 min-w-[88px] items-center justify-center gap-2',
  'rounded-xl px-3 py-2 text-base font-bold leading-[112.5%]',
  'shadow-[2px_2px_2px_rgba(0,0,0,0.25)] transition',
  "font-['Noto_Sans_TC',sans-serif]",
)

export function settingsCancelBtnClass(enabled = true) {
  return cn(
    settingsBtnBase,
    enabled
      ? 'cursor-pointer bg-[#EBCDCC] text-[#AE1914] hover:opacity-90'
      : 'cursor-not-allowed bg-[#EBCDCC]/60 text-[#AE1914]/50',
  )
}

export function settingsSaveBtnClass(enabled = true) {
  return cn(
    settingsBtnBase,
    enabled
      ? 'cursor-pointer bg-[#6168FC] text-white hover:bg-[#4F51FF]'
      : 'cursor-not-allowed bg-[#C5C7FF] text-white/80',
  )
}

export function settingsEditBtnClass() {
  return cn(settingsBtnBase, 'cursor-pointer bg-[#6168FC] text-white hover:bg-[#4F51FF]')
}

/** Visible / hidden label on field rows. */
export function fieldLabelClass(visible: boolean) {
  return cn(
    'flex-1 text-base font-bold leading-[140%]',
    "font-['Noto_Sans_TC',sans-serif]",
    visible ? 'text-[rgba(0,0,0,0.87)]' : 'text-black/38',
  )
}

export function fieldIconClass(visible: boolean) {
  return visible ? 'text-black/60' : 'text-black/38'
}
