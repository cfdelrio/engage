/**
 * Admin API Types — API Key Management
 * Scalable design: permissions as string[], status as enum-like string
 */

export type ApiKeyStatus = 'active' | 'disabled' | 'revoked';

export interface ApiKeyPermission {
  resource: string; // 'events', 'campaigns', 'reports', 'admin'
  action: string; // 'read', 'write', '*'
}

/**
 * Request payload for creating an API key
 */
export interface CreateApiKeyRequest {
  name: string;
  permissions?: string[]; // E.g., ['events:read', 'campaigns:write']
}

/**
 * Request payload for rotating an API key
 */
export interface RotateApiKeyRequest {
  // Empty body — rotation is determined by the key ID
}

/**
 * Response for API key operations
 * Note: rawKey only returned on creation, never again
 */
export interface ApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string; // First 10 chars, for UI recognition
  permissions: string[];
  status: ApiKeyStatus;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rawKey?: string; // Only on creation
}

/**
 * Response for list/get operations (no raw key)
 */
export interface ApiKeyInfoResponse extends Omit<ApiKeyResponse, 'rawKey'> {}

/**
 * Audit log entry for API key actions
 */
export interface ApiKeyAuditLog {
  id: string;
  keyId: string;
  action: 'created' | 'rotated' | 'disabled' | 'enabled' | 'deleted' | 'accessed';
  userId?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

/**
 * Error response from Admin API
 */
export interface ApiErrorResponse {
  error: string;
  code: string; // E.g., 'NOT_FOUND', 'UNAUTHORIZED', 'INVALID_REQUEST'
  details?: Record<string, unknown>;
}
