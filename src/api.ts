const API = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function openGoogleLogin() {
  window.location.href = `${API}/oauth2/authorization/google`;
}

export async function logout() {
  await apiRequest('/api/auth/logout', { method: 'POST' });
  window.location.reload();
}

export default API;