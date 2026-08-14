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
  | 'payment_reconciliation_completed'
  | 'payment_reconciliation_gap'
  | 'webhook_failed'
  | 'webhook_processed'
  | 'webhook_rejected';

export type OperationalOperation =
  | 'create_booking'
  | 'create_customer_request'
  | 'create_order'
  | 'create_payment'
  | 'archive_catalog_product'
  | 'cancel_booking'
  | 'cancel_customer_request'
  | 'exchange_oauth_code'
  | 'health_check'
  | 'issue_order_receipt'
  | 'process_sepay_webhook'
  | 'reconcile_sepay_transactions'
  | 'request_phone_otp'
  | 'start_google_oauth'
  | 'update_booking_status'
  | 'update_catalog_status'
  | 'update_commerce_policy'
  | 'update_content_publication'
  | 'update_customer_request_status'
  | 'update_order_status'
  | 'update_loyalty_policy'
  | 'update_points_payment_policy'
  | 'admin_adjust_member_points'
  | 'refund_order_settlement'
  | 'compensate_order_payment_failure'
  | 'refund_order_payment'
  | 'update_stored_value_policy'
  | 'upsert_content'
  | 'upsert_catalog_product'
  | 'upsert_stored_value'
  | 'upsert_voucher'
  | 'upsert_loyalty_reward'
  | 'verify_phone_otp';

export type OperationalReason =
  | 'configuration_error'
  | 'database_error'
  | 'feature_disabled'
  | 'invalid_payload'
  | 'invalid_signature'
  | 'missing_result'
  | 'payload_too_large'
  | 'payment_required'
  | 'payment_lookup_failed'
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

type OperationalMetrics = {
  duplicates?: number;
  pages?: number;
  processed?: number;
  rejected?: number;
  skipped?: number;
  storedValue?: boolean;
  outcome?: 'duplicate' | 'processed' | 'rejected';
};

type EventInput = {
  correlationId?: string | null;
  event: OperationalEvent;
  level?: 'info' | 'warn';
  operation: OperationalOperation;
  metrics?: OperationalMetrics;
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

export function logOperationalEvent(
  input: EventInput,
  sink: LogSink = console.info,
  now = new Date()
): string {
  const correlationId = createCorrelationId(input.correlationId);
  const metrics = input.metrics ?? {};
  const line = {
    timestamp: now.toISOString(),
    level: input.level ?? 'info',
    service: 'beanbus-web',
    event: input.event,
    correlationId,
    operation: input.operation,
    ...(typeof metrics.pages === 'number' ? { pages: Math.max(0, Math.floor(metrics.pages)) } : {}),
    ...(typeof metrics.processed === 'number' ? { processed: Math.max(0, Math.floor(metrics.processed)) } : {}),
    ...(typeof metrics.rejected === 'number' ? { rejected: Math.max(0, Math.floor(metrics.rejected)) } : {}),
    ...(typeof metrics.duplicates === 'number' ? { duplicates: Math.max(0, Math.floor(metrics.duplicates)) } : {}),
    ...(typeof metrics.skipped === 'number' ? { skipped: Math.max(0, Math.floor(metrics.skipped)) } : {}),
    ...(typeof metrics.storedValue === 'boolean' ? { storedValue: metrics.storedValue } : {}),
    ...(metrics.outcome ? { outcome: metrics.outcome } : {}),
  };
  sink(JSON.stringify(line));
  return correlationId;
}
