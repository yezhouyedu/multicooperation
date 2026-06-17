'use client';

export const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

const adminAuthTokenKey = 'admin_auth_token';

export function getAdminToken() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(adminAuthTokenKey);
}

export function hasAdminToken() {
  return Boolean(getAdminToken());
}

export function clearAdminToken() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(adminAuthTokenKey);
}

export async function loginAdmin(password: string) {
  const response = await fetch(`${serverBaseUrl}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) throw new Error('admin login failed');
  const data = (await response.json()) as { token?: string };
  if (!data.token) throw new Error('admin login missing token');
  sessionStorage.setItem(adminAuthTokenKey, data.token);
  return data.token;
}

export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getAdminToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    clearAdminToken();
    window.dispatchEvent(new CustomEvent('admin-auth-expired'));
  }
  return response;
}

export async function adminFetchJson<T>(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await adminFetch(input, init);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
  return (await response.json()) as T;
}
