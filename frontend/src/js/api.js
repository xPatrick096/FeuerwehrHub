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
  updateProfile: (body) => request('PUT',  '/auth/profile', body),
  changePassword:(body) => request('POST', '/auth/change-password', body),
  disableTotp:   (body) => request('POST', '/auth/disable-totp', body),
  setup:         (body) => request('POST', '/auth/setup', body),

  // Bestellungen
  getOrders: (params) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null && v !== '') p.append(k, v);
    }
    return request('GET', `/orders?${p}`);
  },
  getOrder:     (id)     => request('GET',    `/orders/${id}`),
  createOrder:  (body)   => request('POST',   '/orders', body),
  updateOrder:  (id, b)  => request('PUT',    `/orders/${id}`, b),
  deleteOrder:  (id)     => request('DELETE', `/orders/${id}`),
  addDelivery:  (id, b)  => request('POST',   `/orders/${id}/delivery`, b),
  setStatus:    (id, s)  => request('POST',   `/orders/${id}/status`, { status: s }),
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
  updateModules:  (body) => request('PUT', '/settings/modules', body),

  // PDF-Vorlage
  uploadPdf: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    return fetch(`${BASE}/settings/pdf`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async res => {
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return data;
    });
  },

  // Admin
  getUsers:       ()          => request('GET',    '/admin/users'),
  createUser:     (body)      => request('POST',   '/admin/users', body),
  updateRole:        (id, body) => request('PUT', `/admin/users/${id}/role`, body),
  updatePermissions: (id, perms) => request('PUT', `/admin/users/${id}/permissions`, { permissions: perms }),
  assignRole:        (id, roleId) => request('PUT', `/admin/users/${id}/assign-role`, { role_id: roleId }),

  getRoles:    ()       => request('GET',    '/roles'),
  createRole:  (body)   => request('POST',   '/roles', body),
  updateRole:  (id, b)  => request('PUT',    `/roles/${id}`, b),
  deleteRole:  (id)     => request('DELETE', `/roles/${id}`),
  resetPassword:  (id, body)  => request('POST',   `/admin/users/${id}/reset-password`, body),
  adminResetTotp: (id)        => request('POST',   `/admin/users/${id}/reset-totp`),
  deleteUser:     (id)        => request('DELETE', `/admin/users/${id}`),
  getAuditLog:    ()          => request('GET',    '/admin/audit-log'),

  // Ankündigungen
  getAnnouncements:    ()          => request('GET',    '/announcements'),
  createAnnouncement:  (body)      => request('POST',   '/announcements', body),
  updateAnnouncement:  (id, body)  => request('PUT',    `/announcements/${id}`, body),
  deleteAnnouncement:  (id)        => request('DELETE', `/announcements/${id}`),
};
