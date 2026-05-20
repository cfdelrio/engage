const API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';

export interface PublicPreferencesResponse {
  preferences: Array<{
    id: string;
    userId: string;
    channel: string;
    category?: string;
    enabled: boolean;
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
  user: {
    email?: string;
    phone?: string;
    timezone: string;
  };
}

export interface UpdatePreferenceRequest {
  channel: string;
  category?: string;
  enabled?: boolean;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
}

export async function fetchPublicPreferences(
  token: string
): Promise<PublicPreferencesResponse> {
  const response = await fetch(`${API_URL}/v1/public/preferences`, {
    headers: { 'X-Preference-Token': token },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'Preferences not found or token expired'
        : 'Failed to fetch preferences'
    );
  }

  return response.json();
}

export async function updatePublicPreferences(
  token: string,
  preferences: UpdatePreferenceRequest[]
): Promise<PublicPreferencesResponse['preferences']> {
  const response = await fetch(`${API_URL}/v1/public/preferences`, {
    method: 'PUT',
    headers: {
      'X-Preference-Token': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ preferences }),
  });

  if (!response.ok) {
    throw new Error('Failed to update preferences');
  }

  return response.json();
}

export async function optOutPublicPreferences(token: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/public/preferences/opt-out`, {
    method: 'POST',
    headers: { 'X-Preference-Token': token },
  });

  if (!response.ok) {
    throw new Error('Failed to opt out');
  }
}
