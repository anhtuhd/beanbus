export function withSupportReference(
  message: string,
  reference: string | undefined,
  label: string
): string {
  return reference ? `${message} ${label}: ${reference}` : message;
}
