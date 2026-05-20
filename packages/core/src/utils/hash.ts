import { createHash, randomBytes } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = `oek_${randomBytes(32).toString('base64url')}`;
  const hash = sha256(raw);
  const prefix = raw.slice(0, 10);
  return { raw, hash, prefix };
}
