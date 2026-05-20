import { createHash, randomBytes } from 'node:crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const API_KEY_PREFIX = 'sk_';
const API_KEY_LENGTH = 32;

/**
 * Generate a random API key
 * Format: sk_<32-char-random>
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const randomPart = randomBytes(API_KEY_LENGTH).toString('hex');
  const raw = `${API_KEY_PREFIX}${randomPart}`;
  const hash = sha256(raw);
  const prefix = raw.slice(0, 10);
  return { raw, hash, prefix };
}

/**
 * Hash an API key using SHA-256
 * Never store the raw key in DB
 */
export function hashApiKey(apiKey: string): string {
  return sha256(apiKey);
}

/**
 * Get the prefix for display (first 10 chars)
 */
export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 10);
}

/**
 * Verify an API key against its hash
 */
export function verifyApiKey(apiKey: string, hash: string): boolean {
  const computedHash = hashApiKey(apiKey);
  return computedHash === hash;
}
