export const CORRELATION_HEADER = 'x-request-id';

const SAFE_CORRELATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export type OperationalEvent =
  | 'admin_operation_failed'
  | 'auth_failed'
  | 'booking_failed'
  | 'customer_request_failed'
  | 'health_check_failed'
  | 'order_failed'
  | 'payment_failed'
  | 'webhook_failed'
  | 'webhook_rejected';

export type OperationalOperation =
  | 'create_booking'
  | 'create_customer_request'
  | 'create_order'
  | 'create_payment'
  | 'exchange_oauth_code'
  | 'health_check'
  | 'issue_order_receipt'
  | 'process_sepay_webhook'
  | 'request_phone_otp'
  | 'start_google_oauth'
  | 'update_booking_status'
  | 'update_catalog_status'
  | 'update_content_publication'
  | 'update_customer_request_status'
  | 'update_order_status'
  | 'verify_phone_otp';

export type OperationalReason =
  | 'configuration_error'
  | 'database_error'
  | 'invalid_payload'
  | 'invalid_signature'
  | 'missing_result'
  | 'payload_too_large'
  | 'payment_required'
  | 'provider_error'
  | 'refund_required'
  | 'unsupported_media_type';

type FailureInput = {
  correlationId?: string | null;
  event: OperationalEvent;
  level?: 'error' | 'warn';
  operation: OperationalOperation;
  reason: OperationalReason;
};

type LogSink = (line: string) => void;

export function createCorrelationId(candidate?: string | null): string {
  const value = candidate?.trim();
  return value && SAFE_CORRELATION_ID.test(value) ? value : crypto.randomUUID();
}

export function logOperationalFailure(
  input: FailureInput,
  sink: LogSink = console.error,
  now = new Date()
): string {
  const correlationId = createCorrelationId(input.correlationId);
  sink(JSON.stringify({
    timestamp: now.toISOString(),
    level: input.level ?? 'error',
    service: 'beanbus-web',
    event: input.event,
    correlationId,
    operation: input.operation,
    reason: input.reason,
  }));
  return correlationId;
}
