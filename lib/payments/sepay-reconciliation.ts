import { resolveSepayPaymentCode, resolveStoredValuePaymentCode } from './sepay.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

type Environment = Record<string, string | undefined>;

export type SepayReconciliationConfig = {
  apiKey: string;
  cronSecret: string;
};

export type SepayV2Transaction = {
  providerTransactionKey: string;
  transactionAt: string;
  accountNumber: string;
  code: string;
  transferType: 'in' | 'out';
  transferAmount: number;
  referenceCode: string;
  gateway: string;
  content: string;
};

export type SepayV2Response = {
  transactions: SepayV2Transaction[];
  currentPage: number;
  lastPage: number;
  hasMore: boolean;
};

export function formatSepayApiDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')} ${values.get('hour')}:${values.get('minute')}:${values.get('second')}`;
}

function boundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function parseLocalTransactionDate(value: unknown): string | null {
  if (!boundedText(value, 40)) return null;
  const date = LOCAL_DATE_PATTERN.test(value)
    ? new Date(`${value.replace(' ', 'T')}+07:00`)
    : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function safeAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function hasBeanbusPaymentCode(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  const code = typeof input.code === 'string' ? input.code : null;
  const content = typeof input.transaction_content === 'string' ? input.transaction_content : '';
  return Boolean(resolveStoredValuePaymentCode(code, content) || resolveSepayPaymentCode(code, content));
}

export function getSepayReconciliationConfig(env: Environment = process.env): SepayReconciliationConfig {
  const apiKey = env.SEPAY_API_KEY?.trim();
  const cronSecret = env.CRON_SECRET?.trim();
  if (!apiKey || apiKey.length < 16) throw new Error('Missing required SEPAY_API_KEY');
  if (!cronSecret || cronSecret.length < 16) throw new Error('Missing required CRON_SECRET');
  return { apiKey, cronSecret };
}

export function parseSepayV2Transaction(value: unknown): SepayV2Transaction | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const transactionAt = parseLocalTransactionDate(input.transaction_date);
  const transferType = input.transfer_type === 'in' || input.transfer_type === 'out'
    ? input.transfer_type
    : null;
  const content = input.transaction_content;
  const explicitCode = boundedText(input.code, 64) ? input.code : null;
  const boundedContent = boundedText(content, 2000) ? content : '';
  // SePay may leave `code` empty when its payment-code template is not active,
  // or return only a shortened extraction. The raw content still contains the
  // full Beanbus code, so resolve it before trusting the provider field.
  const code = resolveStoredValuePaymentCode(explicitCode, boundedContent)
    ?? resolveSepayPaymentCode(explicitCode, boundedContent)
    ?? undefined;
  const amount = transferType === 'in' ? input.amount_in : input.amount_out;

  if (!boundedText(input.id, 64) || !UUID_PATTERN.test(input.id)
    || !transactionAt
    || !boundedText(input.account_number, 64)
    || !boundedText(code, 64)
    || transferType === null
    || !safeAmount(amount)
    || (transferType === 'in' && input.amount_out !== 0)
    || (transferType === 'out' && input.amount_in !== 0)
    || !boundedText(input.reference_number, 200)
    || !boundedText(content, 2000)
    || !boundedText(input.bank_brand_name, 100)) return null;

  return {
    providerTransactionKey: input.id,
    transactionAt,
    accountNumber: input.account_number,
    code,
    transferType,
    transferAmount: amount,
    referenceCode: input.reference_number,
    gateway: input.bank_brand_name,
    content,
  };
}

export function parseSepayV2Response(value: unknown): SepayV2Response | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (input.status !== 'success' || !Array.isArray(input.data) || input.data.length > 100) return null;

  const meta = input.meta;
  const pagination = meta && typeof meta === 'object' && !Array.isArray(meta)
    ? (meta as Record<string, unknown>).pagination
    : null;
  const page = pagination && typeof pagination === 'object' && !Array.isArray(pagination)
    ? pagination as Record<string, unknown>
    : {};
  const currentPage = Number.isSafeInteger(page.current_page) && Number(page.current_page) > 0 ? Number(page.current_page) : 1;
  const lastPage = Number.isSafeInteger(page.last_page) && Number(page.last_page) >= currentPage ? Number(page.last_page) : currentPage;

  const transactions: SepayV2Transaction[] = [];
  for (const item of input.data) {
    const transaction = parseSepayV2Transaction(item);
    if (transaction) {
      transactions.push(transaction);
      continue;
    }

    // Do not advance the checkpoint past a malformed Beanbus payment. Unrelated
    // bank activity can be ignored because it cannot match an order payment code.
    if (hasBeanbusPaymentCode(item)) return null;
  }

  return {
    transactions,
    currentPage,
    lastPage,
    hasMore: page.has_more === true || currentPage < lastPage,
  };
}
