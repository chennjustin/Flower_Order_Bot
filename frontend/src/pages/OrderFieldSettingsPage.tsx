import OrderFieldList from '@/components/orderFields/OrderFieldList'
import PreviewPanel from '@/components/orderFields/PreviewPanel'
import PageHeader from '@/components/layout/PageHeader'

export default function OrderFieldSettingsPage() {
  return (
    <>
      <PageHeader title="訂單欄位設定" />
      <div className="mx-auto max-w-[1280px] px-2 pt-[160px] pb-12">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <OrderFieldList />
          <PreviewPanel />
        </div>
      </div>
    </>
  )
}
