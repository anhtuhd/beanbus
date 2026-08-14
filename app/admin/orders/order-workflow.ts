import type { Database } from '../../../lib/supabase/database.types';

export type OrderStatus = Database['public']['Enums']['order_status'];
export type PaymentMethod = Database['public']['Enums']['order_payment_method'];
export type PaymentStatus = Database['public']['Enums']['order_payment_status'];

export const ACTIVE_ORDER_STEPS: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
];

const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

export function getNextOrderStatus(
  currentStatus: OrderStatus,
  paymentMethod: PaymentMethod,
  paymentStatus: PaymentStatus,
): OrderStatus | null {
  if (paymentStatus === 'failed' || paymentStatus === 'refunded') return null;
  if (currentStatus === 'pending' && paymentMethod === 'sepay_qr' && paymentStatus !== 'paid') return null;
  return NEXT_ORDER_STATUS[currentStatus] ?? null;
}

export function canCancelOrder(currentStatus: OrderStatus, paymentStatus: PaymentStatus): boolean {
  return paymentStatus !== 'paid'
    && paymentStatus !== 'failed'
    && paymentStatus !== 'refunded'
    && currentStatus !== 'completed'
    && currentStatus !== 'cancelled';
}

export function canRefundOrder(
  currentStatus: OrderStatus,
  paymentMethod: PaymentMethod,
  paymentStatus: PaymentStatus,
  cashDueVnd: number,
  pointsApplied: number,
): boolean {
  if (cashDueVnd <= 0 && pointsApplied <= 0) return false;
  return paymentStatus === 'paid' || (paymentMethod === 'cod' && currentStatus === 'completed');
}
