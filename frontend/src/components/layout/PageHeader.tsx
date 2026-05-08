interface PageHeaderProps {
  title: string
}

/**
 * Full-width 80px title bar pinned just below the navbar.
 * Matches the legacy `.main-title-bar` markup so page paddings stay aligned.
 */
export default function PageHeader({ title }: PageHeaderProps) {
  return (
    <div className="absolute top-14 left-0 w-screen">
      <div className="relative h-20 w-screen border-b border-black/[0.38]">
        <span className="absolute left-[72px] top-5 h-10 text-[32px] font-bold leading-10 text-[#6168FC] font-['Noto_Sans_TC','PingFang_TC','Microsoft_JhengHei',Arial,sans-serif]">
          {title}
        </span>
      </div>
    </div>
  )
}
