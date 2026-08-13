import { NextResponse } from 'next/server';
import { getOrderReceipt } from '@/lib/orders/receipt';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const receipt = new URL(request.url).searchParams.get('receipt') ?? '';
  const order = await getOrderReceipt(id, receipt);

  if (!order) {
    return NextResponse.json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' } }, { status: 404 });
  }

  return NextResponse.json(
    {
      status: order.status,
      paymentStatus: order.paymentStatus,
      payment: order.payment ? {
        status: order.payment.status,
        expiresAt: order.payment.expiresAt,
      } : null,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
