import 'server-only';

import { headers } from 'next/headers';
import { CORRELATION_HEADER, createCorrelationId } from './logger';

export async function getRequestCorrelationId(): Promise<string> {
  return createCorrelationId((await headers()).get(CORRELATION_HEADER));
}
