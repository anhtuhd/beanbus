export function createDemoOrderCode(date = new Date()): string {
  const datePart = date.toISOString().slice(2, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 8).padEnd(6, '0').toUpperCase();
  return `DH-${datePart}${randomPart}`;
}
