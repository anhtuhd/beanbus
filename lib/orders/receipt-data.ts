export type OrderReceipt = {
  createdAt: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  discountVnd: number;
  fulfillment: 'pickup' | 'delivery';
  id: string;
  items: Array<{
    id: string;
    lineTotalVnd: number;
    nameEn: string;
    nameVi: string;
    quantity: number;
  }>;
  number: number;
  paymentMethod: 'cod' | 'sepay_qr';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  pickupAt: string | null;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  subtotalVnd: number;
  totalVnd: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isMoney(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

export function parseOrderReceipt(value: unknown): OrderReceipt | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;
  const items = value.items.map((item) => {
    if (!isRecord(item)
      || !isText(item.id)
      || !isText(item.nameVi)
      || !isText(item.nameEn)
      || !Number.isInteger(item.quantity)
      || Number(item.quantity) < 1
      || !isMoney(item.lineTotalVnd)) return null;
    return {
      id: item.id,
      nameVi: item.nameVi,
      nameEn: item.nameEn,
      quantity: Number(item.quantity),
      lineTotalVnd: item.lineTotalVnd,
    };
  });

  if (items.some((item) => item === null)
    || !isText(value.id)
    || !Number.isInteger(value.number)
    || !isText(value.customerName)
    || !isText(value.customerPhone)
    || !['pickup', 'delivery'].includes(String(value.fulfillment))
    || !['cod', 'sepay_qr'].includes(String(value.paymentMethod))
    || !['pending', 'paid', 'failed', 'refunded'].includes(String(value.paymentStatus))
    || !['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'].includes(String(value.status))
    || !isMoney(value.subtotalVnd)
    || !isMoney(value.discountVnd)
    || !isMoney(value.totalVnd)
    || !isText(value.createdAt)) return null;

  return {
    id: value.id,
    number: Number(value.number),
    customerName: value.customerName,
    customerPhone: value.customerPhone,
    fulfillment: value.fulfillment as OrderReceipt['fulfillment'],
    pickupAt: typeof value.pickupAt === 'string' ? value.pickupAt : null,
    deliveryAddress: typeof value.deliveryAddress === 'string' ? value.deliveryAddress : null,
    subtotalVnd: value.subtotalVnd,
    discountVnd: value.discountVnd,
    totalVnd: value.totalVnd,
    paymentMethod: value.paymentMethod as OrderReceipt['paymentMethod'],
    paymentStatus: value.paymentStatus as OrderReceipt['paymentStatus'],
    status: value.status as OrderReceipt['status'],
    createdAt: value.createdAt,
    items: items as OrderReceipt['items'],
  };
}
