export function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`/api/engage${path}`, options);
}
