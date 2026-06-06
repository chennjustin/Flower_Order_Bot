import { cn } from '@/lib/utils'

interface BrandLogoProps {
  size?: 'nav' | 'sidebar'
  className?: string
}

export default function BrandLogo({ size = 'nav', className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "font-['Montserrat_Alternates',sans-serif] font-medium tracking-[0.1em] text-[#6168FC]",
        size === 'nav' && 'text-2xl leading-[125%]',
        size === 'sidebar' && 'text-xl leading-[125%]',
        className,
      )}
    >
      Flourish
    </span>
  )
}
