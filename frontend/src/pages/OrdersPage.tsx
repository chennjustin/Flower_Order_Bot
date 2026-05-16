import OrderTable from '@/components/orders/OrderTable'
import PageHeader from '@/components/layout/PageHeader'

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="訂單管理" />
      <div className="mx-auto max-w-[1280px] px-7 pt-[160px] md:px-2">
        <OrderTable showTitle={false} />
      </div>
    </>
  )
}
