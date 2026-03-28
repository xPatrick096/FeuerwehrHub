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
  deletePdf: () => request('DELETE', '/settings/pdf'),

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
  getUsers:            ()          => request('GET',    '/admin/users'),
  createUser:          (body)      => request('POST',   '/admin/users', body),
  updateUser:          (id, body)  => request('PUT',    `/admin/users/${id}`, body),
  updateUserSystemRole:(id, body)  => request('PUT',    `/admin/users/${id}/role`, body),
  updatePermissions:   (id, perms) => request('PUT',    `/admin/users/${id}/permissions`, { permissions: perms }),
  assignRole:          (id, roleId)=> request('PUT',    `/admin/users/${id}/assign-role`, { role_id: roleId }),

  getRoles:    ()       => request('GET',    '/roles'),
  createRole:  (body)   => request('POST',   '/roles', body),
  updateRole:  (id, b)  => request('PUT',    `/roles/${id}`, b),
  deleteRole:  (id)     => request('DELETE', `/roles/${id}`),

  // Zusatzfunktionen
  getUserFunctions: (id)        => request('GET',    `/admin/users/${id}/functions`),
  assignFunction:   (id, body)  => request('POST',   `/admin/users/${id}/functions`, body),
  removeFunction:   (id, roleId)=> request('DELETE', `/admin/users/${id}/functions/${roleId}`),
  resetPassword:  (id, body)  => request('POST',   `/admin/users/${id}/reset-password`, body),
  adminResetTotp: (id)        => request('POST',   `/admin/users/${id}/reset-totp`),
  deleteUser:     (id)        => request('DELETE', `/admin/users/${id}`),
  getAuditLog:    ()          => request('GET',    '/admin/audit-log'),

  // Personal
  getPersonalMembers:          ()               => request('GET',    '/personal/members'),
  getPersonalDetails:          (id)             => request('GET',    `/personal/members/${id}/details`),
  updatePersonalDetails:       (id, body)       => request('PUT',    `/personal/members/${id}/details`, body),
  getPersonalQualifications:   (id)             => request('GET',    `/personal/members/${id}/qualifications`),
  createPersonalQualification: (id, body)       => request('POST',   `/personal/members/${id}/qualifications`, body),
  updatePersonalQualification: (id, qid, body)  => request('PUT',    `/personal/members/${id}/qualifications/${qid}`, body),
  deletePersonalQualification: (id, qid)        => request('DELETE', `/personal/members/${id}/qualifications/${qid}`),
  getPersonalEquipment:        (id)             => request('GET',    `/personal/members/${id}/equipment`),
  createPersonalEquipment:     (id, body)       => request('POST',   `/personal/members/${id}/equipment`, body),
  updatePersonalEquipment:     (id, eid, body)  => request('PUT',    `/personal/members/${id}/equipment/${eid}`, body),
  deletePersonalEquipment:     (id, eid)        => request('DELETE', `/personal/members/${id}/equipment/${eid}`),
  getPersonalHonors:           (id)             => request('GET',    `/personal/members/${id}/honors`),
  createPersonalHonor:         (id, body)       => request('POST',   `/personal/members/${id}/honors`, body),
  updatePersonalHonor:         (id, hid, body)  => request('PUT',    `/personal/members/${id}/honors/${hid}`, body),
  deletePersonalHonor:         (id, hid)        => request('DELETE', `/personal/members/${id}/honors/${hid}`),

  // Mein Bereich (Selfservice)
  getMyProfile:        ()          => request('GET',    '/me/profile'),
  updateMyProfile:     (body)      => request('PUT',    '/me/profile', body),
  getMyQualifications: ()          => request('GET',    '/me/qualifications'),
  getMyEquipment:      ()          => request('GET',    '/me/equipment'),

  // Ankündigungen
  getAnnouncements:    ()          => request('GET',    '/announcements'),
  createAnnouncement:  (body)      => request('POST',   '/announcements', body),
  updateAnnouncement:  (id, body)  => request('PUT',    `/announcements/${id}`, body),
  deleteAnnouncement:  (id)        => request('DELETE', `/announcements/${id}`),

  // Personal Stats
  getPersonalStats:    ()             => request('GET',    '/personal/stats'),

  // Anwesenheit
  getAttendance:       (id)           => request('GET',    `/personal/members/${id}/attendance`),
  createAttendance:    (id, body)     => request('POST',   `/personal/members/${id}/attendance`, body),
  updateAttendance:    (id, aid, body)=> request('PUT',    `/personal/members/${id}/attendance/${aid}`, body),
  deleteAttendance:    (id, aid)      => request('DELETE', `/personal/members/${id}/attendance/${aid}`),
  getAttendanceStats:  (id)           => request('GET',    `/personal/members/${id}/attendance/stats`),

  // Admin
  getContainerLog:     ()             => request('GET',    '/admin/container-log'),
  setupStatus:         ()             => fetch('/api/auth/setup-status').then(r => r.json()),

  // Fahrzeuge
  getVehicleStats:      ()              => request('GET',    '/vehicles/stats'),
  getVehicles:          ()              => request('GET',    '/vehicles'),
  getVehicle:           (id)            => request('GET',    `/vehicles/${id}`),
  createVehicle:        (body)          => request('POST',   '/vehicles', body),
  updateVehicle:        (id, body)      => request('PUT',    `/vehicles/${id}`, body),
  deleteVehicle:        (id)            => request('DELETE', `/vehicles/${id}`),
  getInspections:       (vid)           => request('GET',    `/vehicles/${vid}/inspections`),
  createInspection:     (vid, body)     => request('POST',   `/vehicles/${vid}/inspections`, body),
  updateInspection:     (vid, iid, body)=> request('PUT',    `/vehicles/${vid}/inspections/${iid}`, body),
  deleteInspection:     (vid, iid)      => request('DELETE', `/vehicles/${vid}/inspections/${iid}`),

  // Fahrtenbuch
  getTrips:             (vid)           => request('GET',    `/vehicles/${vid}/trips`),
  createTrip:           (vid, body)     => request('POST',   `/vehicles/${vid}/trips`, body),
  updateTrip:           (vid, tid, body)=> request('PUT',    `/vehicles/${vid}/trips/${tid}`, body),
  deleteTrip:           (vid, tid)      => request('DELETE', `/vehicles/${vid}/trips/${tid}`),

  // Tankprotokoll
  getFuelings:          (vid)           => request('GET',    `/vehicles/${vid}/fuelings`),
  createFueling:        (vid, body)     => request('POST',   `/vehicles/${vid}/fuelings`, body),
  updateFueling:        (vid, fid, body)=> request('PUT',    `/vehicles/${vid}/fuelings/${fid}`, body),
  deleteFueling:        (vid, fid)      => request('DELETE', `/vehicles/${vid}/fuelings/${fid}`),

  // Störungsmeldungen
  getDefects:           (vid)           => request('GET',    `/vehicles/${vid}/defects`),
  createDefect:         (vid, body)     => request('POST',   `/vehicles/${vid}/defects`, body),
  updateDefectStatus:   (vid, did, body)=> request('PUT',    `/vehicles/${vid}/defects/${did}/status`, body),
  deleteDefect:         (vid, did)      => request('DELETE', `/vehicles/${vid}/defects/${did}`),
  getDefectComments:    (vid, did)      => request('GET',    `/vehicles/${vid}/defects/${did}/comments`),
  createDefectComment:  (vid, did, body)=> request('POST',   `/vehicles/${vid}/defects/${did}/comments`, body),

  // Geräte / Beladung
  getEquipment:         (vid)           => request('GET',    `/vehicles/${vid}/equipment`),
  createEquipment:      (vid, body)     => request('POST',   `/vehicles/${vid}/equipment`, body),
  updateEquipment:      (vid, eid, body)=> request('PUT',    `/vehicles/${vid}/equipment/${eid}`, body),
  deleteEquipment:      (vid, eid)      => request('DELETE', `/vehicles/${vid}/equipment/${eid}`),

  // Checklisten-Vorlagen
  getTemplates:         (vid)           => request('GET',    `/vehicles/${vid}/checklist-templates`),
  createTemplate:       (vid, body)     => request('POST',   `/vehicles/${vid}/checklist-templates`, body),
  deleteTemplate:       (vid, tid)      => request('DELETE', `/vehicles/${vid}/checklist-templates/${tid}`),

  // Checklisten (ausgefüllt)
  getChecklists:        (vid)           => request('GET',    `/vehicles/${vid}/checklists`),
  createChecklist:      (vid, body)     => request('POST',   `/vehicles/${vid}/checklists`, body),
  getChecklist:         (vid, cid)      => request('GET',    `/vehicles/${vid}/checklists/${cid}`),
  deleteChecklist:      (vid, cid)      => request('DELETE', `/vehicles/${vid}/checklists/${cid}`),
  defectsFromChecklist: (vid, body)     => request('POST',   `/vehicles/${vid}/defects-from-checklist`, body),
};
