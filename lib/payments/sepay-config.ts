type Environment = Record<string, string | undefined>;

export type SepayConfig = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  webhookSecret: string;
};

export function getSepayConfig(env: Environment = process.env): SepayConfig {
  const webhookSecret = env.SEPAY_WEBHOOK_SECRET?.trim();
  const bankCode = env.SEPAY_BANK_CODE?.trim();
  const accountNumber = env.SEPAY_BANK_ACCOUNT?.trim();
  const accountName = env.SEPAY_ACCOUNT_NAME?.trim();

  if (!webhookSecret || webhookSecret.length < 16) throw new Error('Invalid SEPAY_WEBHOOK_SECRET');
  if (!bankCode || !/^[A-Za-z0-9-]{2,32}$/.test(bankCode)) throw new Error('Invalid SEPAY_BANK_CODE');
  if (!accountNumber || !/^\d{4,64}$/.test(accountNumber)) throw new Error('Invalid SEPAY_BANK_ACCOUNT');
  if (!accountName || accountName.length > 100) throw new Error('Invalid SEPAY_ACCOUNT_NAME');

  return { webhookSecret, bankCode, accountNumber, accountName };
}
