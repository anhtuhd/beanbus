export interface DiscountRule {
  type: 'percent' | 'fixed';
  value: number;
}

export function calculateDiscount(subtotal: number, rule: DiscountRule | null): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0 || !rule || !Number.isFinite(rule.value) || rule.value <= 0) {
    return 0;
  }

  const discount = rule.type === 'percent'
    ? Math.round((subtotal * rule.value) / 100)
    : rule.value;

  return Math.min(subtotal, discount);
}
