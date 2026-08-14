export function toTransferMemo(paymentCode: string): string {
  return paymentCode.trim().replaceAll('-', '').toUpperCase();
}
