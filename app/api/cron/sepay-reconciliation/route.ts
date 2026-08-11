import { randomUUID, timingSafeEqual } from 'node:crypto';
import { getSepayConfig } from '@/lib/payments/sepay-config';
import {
  getSepayReconciliationConfig,
  formatSepayApiDate,
  parseSepayV2Response,
  type SepayV2Response,
  type SepayV2Transaction,
} from '@/lib/payments/sepay-reconciliation';
import {
  CORRELATION_HEADER,
  createCorrelationId,
  logOperationalEvent,
  logOperationalFailure,
} from '@/lib/observability/logger';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/supabase/database.types';

export const runtime = 'nodejs';

const API_URL = 'https://userapi.sepay.vn/v2/transactions';
const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const LOOKBACK_MINUTES = 60;

function responseBody(status: number, correlationId: string, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: {
      [CORRELATION_HEADER]: correlationId,
      'Cache-Control': 'no-store',
    },
  });
}

function hasCronSecret(request: Request, secret: string): boolean {
  const authorization = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const providedBytes = Buffer.from(authorization);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

function reportFailure(correlationId: string, reason: 'configuration_error' | 'database_error' | 'provider_error') {
  logOperationalFailure({
    correlationId,
    event: 'payment_failed',
    operation: 'reconcile_sepay_transactions',
    reason,
  });
  return responseBody(502, correlationId, { success: false });
}

function transactionPayload(transaction: SepayV2Transaction): Json {
  return {
    providerTransactionKey: transaction.providerTransactionKey,
    transactionAt: transaction.transactionAt,
    accountNumber: transaction.accountNumber,
    code: transaction.code,
    transferType: transaction.transferType,
    transferAmount: transaction.transferAmount,
    referenceCode: transaction.referenceCode,
    gateway: transaction.gateway,
    content: transaction.content,
  };
}

async function fetchTransactions(
  apiKey: string,
  from: Date,
  to: Date,
  page: number,
  sinceId: string | null,
): Promise<SepayV2Response> {
  const url = new URL(API_URL);
  url.searchParams.set('transaction_date_from', formatSepayApiDate(from));
  url.searchParams.set('transaction_date_to', formatSepayApiDate(to));
  url.searchParams.set('transfer_type', 'in');
  url.searchParams.set('transaction_date_sort', 'asc');
  url.searchParams.set('timestamp_format', 'iso8601');
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(PAGE_SIZE));
  if (sinceId) url.searchParams.set('since_id', sinceId);

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('SEPAY_API_ERROR');
  const payload: unknown = await response.json();
  const parsed = parseSepayV2Response(payload);
  if (!parsed) throw new Error('SEPAY_API_PAYLOAD_INVALID');
  return parsed;
}

export async function GET(request: Request) {
  const correlationId = createCorrelationId(request.headers.get(CORRELATION_HEADER));
  if (process.env.NEXT_PUBLIC_ENABLE_SEPAY !== 'true'
    || process.env.NEXT_PUBLIC_ENABLE_SEPAY_RECONCILIATION !== 'true') {
    return responseBody(404, correlationId, { success: false });
  }

  let reconciliationConfig: ReturnType<typeof getSepayReconciliationConfig>;
  let sepayConfig: ReturnType<typeof getSepayConfig>;
  try {
    reconciliationConfig = getSepayReconciliationConfig();
    sepayConfig = getSepayConfig();
  } catch {
    return reportFailure(correlationId, 'configuration_error');
  }
  if (!hasCronSecret(request, reconciliationConfig.cronSecret)) {
    return responseBody(401, correlationId, { success: false });
  }

  const admin = createAdminSupabaseClient();
  const leaseKey = randomUUID();
  const leaseResult = await admin.rpc('acquire_sepay_reconciliation_lease', { p_lease_key: leaseKey });
  if (leaseResult.error) return reportFailure(correlationId, 'database_error');
  if (leaseResult.data !== true) return responseBody(409, correlationId, { success: false, busy: true });

  let completed = false;
  try {
    const expiryResult = await admin.rpc('expire_pending_sepay_payments');
    if (expiryResult.error) return reportFailure(correlationId, 'database_error');

    const stateResult = await admin
      .from('sepay_reconciliation_state')
      .select('cursor_at, cursor_key')
      .eq('id', true)
      .maybeSingle();
    if (stateResult.error) return reportFailure(correlationId, 'database_error');

    const now = new Date();
    const storedCursor = stateResult.data?.cursor_at ? Date.parse(stateResult.data.cursor_at) : NaN;
    const from = Number.isFinite(storedCursor)
      ? new Date(storedCursor - 5 * 60 * 1000)
      : new Date(now.getTime() - LOOKBACK_MINUTES * 60 * 1000);
    let page = 1;
    let hasMore = true;
    let pages = 0;
    let processed = 0;
    let rejected = 0;
    let duplicates = 0;
    let skipped = 0;
    let lastKey = stateResult.data?.cursor_key ?? null;

    while (hasMore && pages < MAX_PAGES) {
      const result = await fetchTransactions(
        reconciliationConfig.apiKey,
        from,
        now,
        page,
        stateResult.data?.cursor_key ?? null,
      );
      pages += 1;
      for (const transaction of result.transactions) {
        lastKey = transaction.providerTransactionKey;
        if (transaction.transferType !== 'in' || transaction.accountNumber !== sepayConfig.accountNumber) {
          skipped += 1;
          continue;
        }

        const processedResult = await admin.rpc('process_sepay_reconciliation', {
          p_provider_transaction_key: transaction.providerTransactionKey,
          p_gateway: transaction.gateway,
          p_transaction_at: transaction.transactionAt,
          p_account_number: transaction.accountNumber,
          p_code: transaction.code,
          p_transfer_type: transaction.transferType,
          p_transfer_amount: transaction.transferAmount,
          p_reference_code: transaction.referenceCode,
          p_content: transaction.content,
          p_payload: transactionPayload(transaction),
        });
        if (processedResult.error) return reportFailure(correlationId, 'database_error');
        const outcome = processedResult.data?.[0]?.outcome;
        if (outcome === 'processed') processed += 1;
        else if (outcome === 'rejected') rejected += 1;
        else if (outcome === 'duplicate') duplicates += 1;
        else return reportFailure(correlationId, 'database_error');
      }

      hasMore = result.hasMore;
      if (hasMore) page = result.currentPage + 1;
    }

    if (hasMore) {
      logOperationalEvent({
        correlationId,
        event: 'payment_reconciliation_gap',
        level: 'warn',
        operation: 'reconcile_sepay_transactions',
        metrics: { pages, processed, rejected, duplicates, skipped },
      });
      return responseBody(503, correlationId, { success: false, retry: true });
    }

    const completeResult = await admin.rpc('complete_sepay_reconciliation', {
      p_lease_key: leaseKey,
      p_cursor_at: now.toISOString(),
      p_cursor_key: lastKey ?? '',
    });
    if (completeResult.error) return reportFailure(correlationId, 'database_error');
    completed = true;
    logOperationalEvent({
      correlationId,
      event: 'payment_reconciliation_completed',
      operation: 'reconcile_sepay_transactions',
      metrics: { pages, processed, rejected, duplicates, skipped },
    });
    return responseBody(200, correlationId, { success: true, pages, processed, rejected, skipped });
  } catch {
    return reportFailure(correlationId, 'provider_error');
  } finally {
    if (!completed) {
      try {
        await admin.rpc('release_sepay_reconciliation_lease', { p_lease_key: leaseKey });
      } catch {
        // The original failure is the useful signal; lease expiry is the fallback.
      }
    }
  }
}
