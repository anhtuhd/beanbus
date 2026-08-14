import { notFound } from 'next/navigation';
import { DemoConfirmation } from './DemoConfirmation';
import { ProductionConfirmation } from './ProductionConfirmation';
import { getAppMode } from '@/lib/env';
import { getOrderReceipt } from '@/lib/orders/receipt';
import { buildSepayQrUrl } from '@/lib/payments/sepay';

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

  const paymentDisplay = order.payment ? {
    accountName: process.env.SEPAY_ACCOUNT_NAME?.trim() || '',
    qrUrl: buildSepayQrUrl({
      accountName: process.env.SEPAY_ACCOUNT_NAME?.trim(),
      accountNumber: order.payment.accountNumber,
      amountVnd: order.cashDueVnd,
      bankCode: order.payment.bankCode,
      paymentCode: order.payment.code,
    }),
  } : null;

  return <ProductionConfirmation order={order} paymentDisplay={paymentDisplay} receiptToken={receiptToken} />;
}
