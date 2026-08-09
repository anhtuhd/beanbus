import { normalizeVietnameseMobile } from '../auth/input.ts';

export type BookingRequestInput = {
  consentToContact: true;
  guestCount: number;
  idempotencyKey: string;
  name: string;
  note?: string;
  phone: string;
  reservationAt: string;
  seatingArea: 'indoor' | 'balcony' | 'roastery_bar';
};

type ParseResult =
  | { data: BookingRequestInput; ok: true }
  | { error: string; ok: false };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseVietnamDateTime(dateValue: unknown, timeValue: unknown): Date | null {
  const dateMatch = DATE.exec(String(dateValue ?? ''));
  const timeMatch = TIME.exec(String(timeValue ?? ''));
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const result = new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
  const local = new Date(result.getTime() + 7 * 60 * 60 * 1000);

  if (local.getUTCFullYear() !== year
    || local.getUTCMonth() + 1 !== month
    || local.getUTCDate() !== day
    || local.getUTCHours() !== hour
    || local.getUTCMinutes() !== minute) return null;
  return result;
}

export function parseBookingRequestInput(value: unknown, nowMs = Date.now()): ParseResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'INVALID_BOOKING' };
  }
  const input = value as Record<string, unknown>;
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  const phone = typeof input.phone === 'string' ? normalizeVietnameseMobile(input.phone) : null;
  const reservationAt = parseVietnamDateTime(input.date, input.time);

  if (!UUID.test(String(input.idempotencyKey ?? ''))) return { ok: false, error: 'INVALID_IDEMPOTENCY_KEY' };
  if (name.length < 2 || name.length > 100 || !phone) return { ok: false, error: 'INVALID_CUSTOMER' };
  if (!Number.isInteger(input.guestCount) || Number(input.guestCount) < 1 || Number(input.guestCount) > 20) {
    return { ok: false, error: 'INVALID_GUEST_COUNT' };
  }
  if (!['indoor', 'balcony', 'roastery_bar'].includes(String(input.seatingArea))) {
    return { ok: false, error: 'INVALID_SEATING_AREA' };
  }
  if (!reservationAt
    || reservationAt.getTime() < nowMs + 30 * 60 * 1000
    || reservationAt.getTime() > nowMs + 90 * 24 * 60 * 60 * 1000) {
    return { ok: false, error: 'INVALID_RESERVATION_TIME' };
  }
  if (note.length > 500) return { ok: false, error: 'INVALID_NOTE' };
  if (input.consentToContact !== true) return { ok: false, error: 'CONSENT_REQUIRED' };

  return {
    ok: true,
    data: {
      idempotencyKey: String(input.idempotencyKey),
      name,
      phone,
      reservationAt: reservationAt.toISOString(),
      guestCount: Number(input.guestCount),
      seatingArea: input.seatingArea as BookingRequestInput['seatingArea'],
      note: note || undefined,
      consentToContact: true,
    },
  };
}
