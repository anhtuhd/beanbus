export const MAX_PAGE = 100;

export function boundedPage(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(Math.floor(value), MAX_PAGE);
}
