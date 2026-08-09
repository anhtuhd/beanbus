import { assertProductionEnv, getAppMode } from '@/lib/env';
import {
  CORRELATION_HEADER,
  createCorrelationId,
  logOperationalFailure,
} from '@/lib/observability/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export function GET(request: Request) {
  const correlationId = createCorrelationId(request.headers.get(CORRELATION_HEADER));
  const headers = {
    'Cache-Control': 'no-store',
    [CORRELATION_HEADER]: correlationId,
  };

  try {
    assertProductionEnv();
    return Response.json({ status: 'ok', mode: getAppMode() }, { headers });
  } catch {
    logOperationalFailure({
      correlationId,
      event: 'health_check_failed',
      operation: 'health_check',
      reason: 'configuration_error',
    });
    return Response.json({ status: 'unavailable' }, { status: 503, headers });
  }
}
