'use server';

import { parseBookingRequestInput } from '@/lib/requests/booking-input';
import { getAppMode } from '@/lib/env';
import { logOperationalFailure } from '@/lib/observability/logger';
import { getRequestCorrelationId } from '@/lib/observability/request';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export type CreateBookingResult =
  | {
      ok: true;
      booking: {
        reference: string;
        reservationAt: string;
        status: 'pending';
      };
    }
  | { error: string; ok: false; reference?: string };

export async function createProductionBooking(input: unknown): Promise<CreateBookingResult> {
  if (getAppMode() !== 'production') return { ok: false, error: 'PRODUCTION_MODE_REQUIRED' };

  const parsed = parseBookingRequestInput(input);
  if (!parsed.ok) return parsed;

  const correlationId = await getRequestCorrelationId();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc('create_booking_request', {
    p_idempotency_key: parsed.data.idempotencyKey,
    p_customer_name: parsed.data.name,
    p_customer_phone: parsed.data.phone,
    p_reservation_at: parsed.data.reservationAt,
    p_guest_count: parsed.data.guestCount,
    p_seating_area: parsed.data.seatingArea,
    p_note: parsed.data.note ?? null,
    p_consent_to_contact: parsed.data.consentToContact,
  });
  const booking = data?.[0];
  if (error || !booking) {
    logOperationalFailure({
      correlationId,
      event: 'booking_failed',
      operation: 'create_booking',
      reason: error ? 'database_error' : 'missing_result',
    });
    return { ok: false, error: 'BOOKING_CREATION_FAILED', reference: correlationId };
  }

  return {
    ok: true,
    booking: {
      reference: `BK-${new Date(booking.reservation_at).getFullYear()}-${String(booking.booking_number).padStart(6, '0')}`,
      reservationAt: booking.reservation_at,
      status: 'pending',
    },
  };
}
