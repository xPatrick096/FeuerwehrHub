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
  addDelivery:    (id, b)  => request('POST',   `/orders/${id}/delivery`, b),
  setStatus:      (id, s)  => request('POST',   `/orders/${id}/status`, { status: s }),
  submitOrder:    (id)     => request('POST',   `/orders/${id}/submit`),
  approveOrder:   (id)     => request('POST',   `/orders/${id}/approve`),
  rejectOrder:    (id, r)  => request('POST',   `/orders/${id}/reject`, { reason: r }),
  resubmitOrder:  (id)     => request('POST',   `/orders/${id}/resubmit`),
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

  // Mein Bereich - Notfallkontakte
  getMyEmergencyContacts:   ()         => request('GET',    '/me/emergency-contacts'),
  createMyEmergencyContact: (b)        => request('POST',   '/me/emergency-contacts', b),
  updateMyEmergencyContact: (id, b)    => request('PUT',    `/me/emergency-contacts/${id}`, b),
  deleteMyEmergencyContact: (id)       => request('DELETE', `/me/emergency-contacts/${id}`),
  getMyHonors:              ()         => request('GET',    '/me/honors'),

  // Personal - Kontaktdaten
  updateMemberProfile:        (id, b)  => request('PUT',    `/personal/members/${id}/profile`, b),
  getMemberEmergencyContacts: (id)     => request('GET',    `/personal/members/${id}/emergency-contacts`),

  // Termine (Personal-Modul)
  getTermine:              ()            => request('GET',    '/personal/termine'),
  createTermin:            (b)           => request('POST',   '/personal/termine', b),
  updateTermin:            (id, b)       => request('PUT',    `/personal/termine/${id}`, b),
  deleteTermin:            (id)          => request('DELETE', `/personal/termine/${id}`),
  getTerminAssignments:    (id)          => request('GET',    `/personal/termine/${id}/assignments`),
  setTerminAssignments:    (id, b)       => request('POST',   `/personal/termine/${id}/assignments`, b),
  getTerminTypen:          ()            => request('GET',    '/personal/termin-typen'),
  createTerminTyp:         (b)           => request('POST',   '/personal/termin-typen', b),
  deleteTerminTyp:         (id)          => request('DELETE', `/personal/termin-typen/${id}`),

  // Mein Bereich - Termine
  getMyTermine:            ()            => request('GET',    '/me/termine'),

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

  // Verein
  getBriefkopf:       ()          => request('GET',    '/verein/briefkopf'),
  updateBriefkopf:    (body)      => request('PUT',    '/verein/briefkopf', body),
  deleteLogo:         ()          => request('DELETE', '/verein/logo'),
  uploadLogo: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = getToken();
    return fetch(`${BASE}/verein/logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async res => {
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return data;
    });
  },

  getVorstand:    ()          => request('GET',    '/verein/vorstand'),
  createVorstand: (body)      => request('POST',   '/verein/vorstand', body),
  updateVorstand: (id, body)  => request('PUT',    `/verein/vorstand/${id}`, body),
  deleteVorstand: (id)        => request('DELETE', `/verein/vorstand/${id}`),

  getVereinPosts:    ()          => request('GET',    '/verein/posts'),
  createVereinPost:  (body)      => request('POST',   '/verein/posts', body),
  updateVereinPost:  (id, body)  => request('PUT',    `/verein/posts/${id}`, body),
  deleteVereinPost:  (id)        => request('DELETE', `/verein/posts/${id}`),

  getDocuments:    ()     => request('GET',    '/verein/dokumente'),
  deleteDocument:  (id)   => request('DELETE', `/verein/dokumente/${id}`),
  downloadDocument: (id) => {
    const token = getToken();
    return fetch(`${BASE}/verein/dokumente/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
  uploadDocument: (file, category, accessLevel, beschreibung) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category || 'Sonstiges');
    formData.append('access_level', accessLevel || 'all');
    if (beschreibung) formData.append('beschreibung', beschreibung);
    const token = getToken();
    return fetch(`${BASE}/verein/dokumente`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async res => {
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return data;
    });
  },

  // Verein — Mitglieder
  getMitglieder:       ()          => request('GET',    '/verein/mitglieder'),
  createMitglied:      (body)      => request('POST',   '/verein/mitglieder', body),
  updateMitglied:      (id, body)  => request('PUT',    `/verein/mitglieder/${id}`, body),
  deleteMitglied:      (id)        => request('DELETE', `/verein/mitglieder/${id}`),

  // Verein — Qualifikationen
  getQualifikationen:    (mid)      => request('GET',    `/verein/mitglieder/${mid}/qualifikationen`),
  createQualifikation:   (mid, b)   => request('POST',   `/verein/mitglieder/${mid}/qualifikationen`, b),
  deleteQualifikation:   (id)       => request('DELETE', `/verein/qualifikationen/${id}`),

  // Verein — Auszeichnungen
  getAuszeichnungen:     (mid)      => request('GET',    `/verein/mitglieder/${mid}/auszeichnungen`),
  createAuszeichnung:    (mid, b)   => request('POST',   `/verein/mitglieder/${mid}/auszeichnungen`, b),
  deleteAuszeichnung:    (id)       => request('DELETE', `/verein/auszeichnungen/${id}`),

  // Verein — Ehrungen-Übersicht
  getEhrungen:           ()         => request('GET',    '/verein/ehrungen'),

  // Verein — Inventar
  getInventar:             ()         => request('GET',    '/verein/inventar'),
  createInventar:          (body)     => request('POST',   '/verein/inventar', body),
  updateInventar:          (id, body) => request('PUT',    `/verein/inventar/${id}`, body),
  deleteInventar:          (id)       => request('DELETE', `/verein/inventar/${id}`),
  getInventarAusleihen:    (id)       => request('GET',    `/verein/inventar/${id}/ausleihen`),
  createAusleihe:          (id, body) => request('POST',   `/verein/inventar/${id}/ausleihen`, body),
  returnAusleihe:          (id, body) => request('PUT',    `/verein/ausleihen/${id}/rueckgabe`, body),
  deleteAusleihe:          (id)       => request('DELETE', `/verein/ausleihen/${id}`),

  // Verein — Schlüssel
  getSchluessel:           ()         => request('GET',    '/verein/schluessel'),
  createSchluessel:        (body)     => request('POST',   '/verein/schluessel', body),
  updateSchluessel:        (id, body) => request('PUT',    `/verein/schluessel/${id}`, body),
  deleteSchluessel:        (id)       => request('DELETE', `/verein/schluessel/${id}`),
  getSchluesselAusgaben:   (id)       => request('GET',    `/verein/schluessel/${id}/ausgaben`),
  createSchluesselAusgabe: (id, body) => request('POST',   `/verein/schluessel/${id}/ausgaben`, body),
  returnSchluesselAusgabe: (id, body) => request('PUT',    `/verein/schluessel-ausgaben/${id}/rueckgabe`, body),

  // Verein — Aufgaben
  getAufgaben:             ()         => request('GET',    '/verein/aufgaben'),
  createAufgabe:           (body)     => request('POST',   '/verein/aufgaben', body),
  updateAufgabe:           (id, body) => request('PUT',    `/verein/aufgaben/${id}`, body),
  deleteAufgabe:           (id)       => request('DELETE', `/verein/aufgaben/${id}`),

  // Verein — Veranstaltungen
  getEvents:               ()         => request('GET',    '/verein/events'),
  createEvent:             (body)     => request('POST',   '/verein/events', body),
  updateEvent:             (id, body) => request('PUT',    `/verein/events/${id}`, body),
  deleteEvent:             (id)       => request('DELETE', `/verein/events/${id}`),
  getEventAntworten:       (id)       => request('GET',    `/verein/events/${id}/antworten`),
  setMeineAntwort:         (id, body) => request('PUT',    `/verein/events/${id}/meine-antwort`, body),
  setAntwortAdmin:         (id, mid, body) => request('PUT', `/verein/events/${id}/antworten/${mid}`, body),
  exportEventCsv:          (id)       => {
    const token = localStorage.getItem('ff_token');
    return fetch(`${BASE}/verein/events/${id}/antworten/csv`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
  },

  // Verein — Protokolle
  getProtokolle:           ()         => request('GET',    '/verein/protokolle'),
  getProtokoll:            (id)       => request('GET',    `/verein/protokolle/${id}`),
  createProtokoll:         (body)     => request('POST',   '/verein/protokolle', body),
  updateProtokoll:         (id, body) => request('PUT',    `/verein/protokolle/${id}`, body),
  deleteProtokoll:         (id)       => request('DELETE', `/verein/protokolle/${id}`),
  createTop:               (pid, body)=> request('POST',   `/verein/protokolle/${pid}/tops`, body),
  updateTop:               (id, body) => request('PUT',    `/verein/protokoll-tops/${id}`, body),
  deleteTop:               (id)       => request('DELETE', `/verein/protokoll-tops/${id}`),

  // Einsatzarten
  getIncidentTypes:    ()         => request('GET',    '/incident-types'),
  createIncidentType:  (body)     => request('POST',   '/incident-types', body),
  updateIncidentType:  (id, body) => request('PUT',    `/incident-types/${id}`, body),
  deleteIncidentType:  (id)       => request('DELETE', `/incident-types/${id}`),

  // Einsatzberichte
  getIncidents: (params) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params || {})) {
      if (v != null && v !== '') p.append(k, v);
    }
    return request('GET', `/einsatzberichte?${p}`);
  },
  getIncident:       (id)        => request('GET',    `/einsatzberichte/${id}`),
  createIncident:    (body)      => request('POST',   '/einsatzberichte', body),
  updateIncident:    (id, body)  => request('PUT',    `/einsatzberichte/${id}`, body),
  deleteIncident:    (id)        => request('DELETE', `/einsatzberichte/${id}`),
  setIncidentStatus: (id, status)=> request('PUT',    `/einsatzberichte/${id}/status`, { status }),
  getIncidentStats:  (year)      => request('GET',    `/einsatzberichte/stats${year ? `?year=${year}` : ''}`),
  getIncidentChanges:  (id)       => request('GET',    `/einsatzberichte/${id}/changes`),

  // Phase B
  getIncidentVehicles: (id)       => request('GET',    `/einsatzberichte/${id}/fahrzeuge`),
  addIncidentVehicle:  (id, body) => request('POST',   `/einsatzberichte/${id}/fahrzeuge`, body),
  updateIncidentVehicle:(id,fid,body)=>request('PUT',  `/einsatzberichte/${id}/fahrzeuge/${fid}`, body),
  removeIncidentVehicle:(id, fid) => request('DELETE', `/einsatzberichte/${id}/fahrzeuge/${fid}`),

  getIncidentPersonnel:  (id)       => request('GET',    `/einsatzberichte/${id}/personal`),
  addIncidentPersonnel:  (id, body) => request('POST',   `/einsatzberichte/${id}/personal`, body),
  removeIncidentPersonnel:(id, pid) => request('DELETE', `/einsatzberichte/${id}/personal/${pid}`),

  // Phase C — Anhänge
  getIncidentAttachments:   (id)       => request('GET',    `/einsatzberichte/${id}/anhaenge`),
  deleteIncidentAttachment: (id, aid)  => request('DELETE', `/einsatzberichte/${id}/anhaenge/${aid}`),
  uploadIncidentAttachment: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('ff_token');
    return fetch(`${BASE}/einsatzberichte/${id}/anhaenge`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    }).then(async res => {
      if (res.status === 401) {
        localStorage.removeItem('ff_token');
        window.location.hash = '#/login';
        return null;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return data;
    });
  },
  downloadIncidentAttachment: (id, aid) => {
    const token = localStorage.getItem('ff_token');
    return fetch(`${BASE}/einsatzberichte/${id}/anhaenge/${aid}/download`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
  },

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
