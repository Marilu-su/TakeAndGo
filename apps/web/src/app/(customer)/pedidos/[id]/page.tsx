import { OrderDetail } from '@/components/order-view';
import { isCheckoutReturn } from '@/lib/checkout';

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pago?: string | string[] }>;
}) {
  const [{ id }, { pago }] = await Promise.all([params, searchParams]);
  return <OrderDetail id={id} returnedFromCheckout={isCheckoutReturn(pago)} />;
}
