const BASE = '/api';

function getToken() {
  return localStorage.getItem('ff_token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Token ungültig → ausloggen
    localStorage.removeItem('ff_token');
    window.location.hash = '#/login';
    return null;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login:         (body) => request('POST', '/auth/login', body),
  verifyTotp:    (body) => request('POST', '/auth/verify-totp', body),
  setupTotp:     ()     => request('POST', '/auth/setup-totp'),
  confirmTotp:   (body) => request('POST', '/auth/confirm-totp', body),
  me:            ()     => request('GET',  '/auth/me'),
  changePassword:(body) => request('POST', '/auth/change-password', body),
  setup:         (body) => request('POST', '/auth/setup', body),

  // Bestellungen
  getOrders:    (params) => request('GET',    `/orders?${new URLSearchParams(params || {})}`),
  getOrder:     (id)     => request('GET',    `/orders/${id}`),
  createOrder:  (body)   => request('POST',   '/orders', body),
  updateOrder:  (id, b)  => request('PUT',    `/orders/${id}`, b),
  deleteOrder:  (id)     => request('DELETE', `/orders/${id}`),
  addDelivery:  (id, b)  => request('POST',   `/orders/${id}/delivery`, b),
  getStats:     ()       => request('GET',    '/orders/stats'),

  // Artikel
  getArticles:   ()      => request('GET',    '/articles'),
  getUnits:      ()      => request('GET',    '/articles/units'),
  createArticle: (body)  => request('POST',   '/articles', body),
  updateArticle: (id, b) => request('PUT',    `/articles/${id}`, b),
  deleteArticle: (id)    => request('DELETE', `/articles/${id}`),

  // Einstellungen
  getSettings:    ()     => request('GET', '/settings'),
  updateSettings: (body) => request('PUT', '/settings', body),

  // Admin
  getUsers:       ()          => request('GET',    '/admin/users'),
  createUser:     (body)      => request('POST',   '/admin/users', body),
  updateRole:     (id, body)  => request('PUT',    `/admin/users/${id}/role`, body),
  resetPassword:  (id, body)  => request('POST',   `/admin/users/${id}/reset-password`, body),
  deleteUser:     (id)        => request('DELETE', `/admin/users/${id}`),
};
