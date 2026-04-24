/**
 * Token-forwarding fetch helper. Mirrors cc-agent-ui/src/utils/api.js:4-31 —
 * reads `auth-token` from localStorage and attaches it as
 * `Authorization: Bearer <token>` on every outbound request. Same header chain
 * the existing cc-agent-ui UI uses, so a single login covers both bundles.
 */

export type NolmeFetchInit = RequestInit & { skipAuth?: boolean };

export async function nolmeFetch(url: string, init: NolmeFetchInit = {}): Promise<Response> {
  const { skipAuth, headers: rawHeaders, ...rest } = init;
  const headers = new Headers(rawHeaders);
  if (!skipAuth && typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('auth-token');
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  if (!headers.has('Content-Type') && rest.body && !(rest.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(url, { ...rest, headers });
}
