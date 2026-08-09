import { notFound } from 'next/navigation';
import { DemoConfirmation } from './DemoConfirmation';
import { ProductionConfirmation } from './ProductionConfirmation';
import { getAppMode } from '@/lib/env';
import { getOrderReceipt } from '@/lib/orders/receipt';

type ConfirmationPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ receipt?: string | string[] }>;
};

export default async function OrderConfirmationPage({ params, searchParams }: ConfirmationPageProps) {
  if (getAppMode() === 'demo') return <DemoConfirmation />;

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const receiptToken = typeof query.receipt === 'string' ? query.receipt : '';
  const order = await getOrderReceipt(id, receiptToken);
  if (!order) notFound();

  return <ProductionConfirmation order={order} />;
}
