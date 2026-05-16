import OrderTable from '@/components/orders/OrderTable'
import PageHeader from '@/components/layout/PageHeader'

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="訂單管理" />
      <div className="mx-auto max-w-[1280px] px-2 pt-[160px]">
        <OrderTable showTitle={false} />
      </div>
    </>
  )
}
