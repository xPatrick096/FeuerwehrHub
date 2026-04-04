import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';
import { esc } from '../utils.js';
import { icon, renderIcons } from '../icons.js';

const EQUIPMENT_LABELS = {
  pager:           'Pager',
  key:             'Schlüssel',
  transponder:     'Transponder',
  id_card:         'Dienstausweis',
  driving_permit:  'Fahrberechtigung',
};

export async function renderMyArea() {
  const [settings, user] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('my-area');

  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Mein Bereich</h2>
        <p>${esc(user?.display_name || user?.username || '')}</p>
      </div>
    </div>

    <div class="tab-bar">
      <button class="tab-btn tab-btn--active" data-tab="profile">${icon('user', 14)} Mein Profil</button>
      <button class="tab-btn" data-tab="qualifications">${icon('graduation-cap', 14)} Qualifikationen</button>
      <button class="tab-btn" data-tab="honors">${icon('award', 14)} Ehrungen</button>
      <button class="tab-btn" data-tab="equipment">${icon('wrench', 14)} Ausrüstung</button>
      <button class="tab-btn" data-tab="appointments">${icon('calendar', 14)} Termine</button>
    </div>

    <div id="tab-profile"></div>
    <div id="tab-qualifications" style="display:none"></div>
    <div id="tab-honors"         style="display:none"></div>
    <div id="tab-equipment"      style="display:none"></div>
    <div id="tab-appointments"   style="display:none"></div>
  `;

  // Tab-Logik
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
      btn.classList.add('tab-btn--active');
      document.querySelectorAll('[id^="tab-"]').forEach(t => t.style.display = 'none');
      document.getElementById(`tab-${btn.dataset.tab}`).style.display = 'block';
    });
  });

  loadProfileTab(user);
  loadQualificationsTab();
  loadHonorsTab();
  loadEquipmentTab();
  loadAppointmentsTab();
  renderIcons(document.getElementById('page-content'));
}

// ── Tab: Mein Profil ──────────────────────────────────────────────────────────

async function loadProfileTab(user) {
  const wrap = document.getElementById('tab-profile');
  wrap.innerHTML = '<p class="text-muted text-sm">Lade...</p>';

  try {
    const profile = await api.getMyProfile();

    const updatedByNotice = (profile?.updated_by_name && profile?.updated_by_id !== user?.id)
      ? `<div class="alert-warning">
           Zuletzt aktualisiert von ${esc(profile.updated_by_name)}
         </div>`
      : '';

    wrap.innerHTML = `
      ${updatedByNotice}

      <div class="card" style="max-width:560px">
        <div class="card__header">Benutzerkonto</div>
        <div class="card__body">
          <div class="form-grid">
            <div class="form-group">
              <label>Benutzername</label>
              <input type="text" value="${esc(user?.username || '')}" disabled style="opacity:0.5" />
            </div>
            <div class="form-group">
              <label>Anzeigename</label>
              <input type="text" value="${esc(user?.display_name || '')}" disabled style="opacity:0.5" />
            </div>
          </div>
          <p class="text-muted text-xs" style="margin-top:8px">Benutzername und Anzeigename können unter <a href="#/settings" style="color:var(--rot)">Einstellungen</a> geändert werden.</p>
        </div>
      </div>

      <div class="card" style="max-width:560px;margin-top:16px">
        <div class="card__header">Kontaktdaten</div>
        <div class="card__body">
          <div class="form-grid">
            <div class="form-group">
              <label>Telefon</label>
              <input type="tel" id="p-phone" maxlength="30" value="${esc(profile?.phone || '')}" placeholder="z.B. 0170 1234567" />
            </div>
            <div class="form-group">
              <label>Private E-Mail</label>
              <input type="email" id="p-email" maxlength="100" value="${esc(profile?.email_private || '')}" placeholder="max@beispiel.de" />
            </div>
            <div class="form-group form-group--full">
              <label>Adresse (optional)</label>
              <input type="text" id="p-address" maxlength="200" value="${esc(profile?.address || '')}" placeholder="Musterstraße 1, 12345 Musterstadt" />
            </div>
          </div>
          <div class="btn-group" style="margin-top:16px">
            <button class="btn btn--primary" id="btn-save-contact">Kontaktdaten speichern</button>
          </div>
        </div>
      </div>

      <div class="card" style="max-width:560px;margin-top:16px">
        <div class="card__header">Notfallkontakte</div>
        <div class="card__body">
          <p class="text-muted text-sm" style="margin-bottom:16px">
            Werden im Einsatzfall benötigt — werden nur von Führungskräften eingesehen.
          </p>
          <div id="emergency-contacts-list"></div>
          <div class="btn-group" style="margin-top:12px">
            <button class="btn btn--outline btn--sm" id="btn-add-emergency">+ Neuer Notfallkontakt</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-save-contact').addEventListener('click', async () => {
      try {
        await api.updateMyProfile({
          phone:         document.getElementById('p-phone').value.trim() || null,
          email_private: document.getElementById('p-email').value.trim() || null,
          address:       document.getElementById('p-address').value.trim() || null,
          emergency_contact_name:  profile?.emergency_contact_name || null,
          emergency_contact_phone: profile?.emergency_contact_phone || null,
        });
        toast('Kontaktdaten gespeichert');
      } catch (e) { toast(e.message, 'error'); }
    });

    // Notfallkontakte laden und rendern
    await renderEmergencyContacts();

    document.getElementById('btn-add-emergency').addEventListener('click', () => {
      addEmergencyContactRow(null);
    });

  } catch (e) {
    wrap.innerHTML = `<p class="error-msg">${esc(e.message)}</p>`;
  }
}

async function renderEmergencyContacts() {
  const listEl = document.getElementById('emergency-contacts-list');
  if (!listEl) return;

  try {
    const contacts = await api.getMyEmergencyContacts();

    if (!contacts.length) {
      listEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;margin-bottom:8px">Noch keine Notfallkontakte hinterlegt.</p>';
      return;
    }

    listEl.innerHTML = contacts.map(c => `
      <div class="ec-row" data-id="${c.id}" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center">
        <input type="text" class="ec-name field" value="${esc(c.name)}" placeholder="Name" maxlength="100" />
        <input type="tel" class="ec-phone field" value="${esc(c.phone)}" placeholder="Telefon" maxlength="30" />
        <input type="text" class="ec-rel field" value="${esc(c.relationship || '')}" placeholder="Beziehung (optional)" maxlength="100" />
        <div class="btn-group" style="flex-shrink:0">
          <button class="btn btn--primary btn--sm ec-save" data-id="${c.id}">Speichern</button>
          <button class="btn btn--danger btn--sm ec-delete" data-id="${c.id}">Löschen</button>
        </div>
      </div>
    `).join('');

    bindEmergencyContactActions();
  } catch (e) {
    listEl.innerHTML = `<p class="error-msg">${esc(e.message)}</p>`;
  }
}

function addEmergencyContactRow(existingId) {
  const listEl = document.getElementById('emergency-contacts-list');
  if (!listEl) return;

  // Leere Zeile mit temporärer ID am Ende einfügen
  const tmpId = 'new-' + Date.now();
  const row = document.createElement('div');
  row.className = 'ec-row';
  row.dataset.id = tmpId;
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center';
  row.innerHTML = `
    <input type="text" class="ec-name field" value="" placeholder="Name" maxlength="100" />
    <input type="tel" class="ec-phone field" value="" placeholder="Telefon" maxlength="30" />
    <input type="text" class="ec-rel field" value="" placeholder="Beziehung (optional)" maxlength="100" />
    <div class="btn-group" style="flex-shrink:0">
      <button class="btn btn--primary btn--sm ec-save" data-id="${tmpId}">Speichern</button>
      <button class="btn btn--danger btn--sm ec-delete" data-id="${tmpId}">Löschen</button>
    </div>
  `;

  // Leere-Meldung entfernen falls vorhanden
  const empty = listEl.querySelector('p');
  if (empty) empty.remove();

  listEl.appendChild(row);
  row.querySelector('.ec-name').focus();

  // Save-Button für neue Zeile
  row.querySelector('.ec-save').addEventListener('click', async () => {
    const name  = row.querySelector('.ec-name').value.trim();
    const phone = row.querySelector('.ec-phone').value.trim();
    const rel   = row.querySelector('.ec-rel').value.trim();
    if (!name)  { toast('Name eingeben', 'error'); return; }
    if (!phone) { toast('Telefon eingeben', 'error'); return; }
    try {
      await api.createMyEmergencyContact({ name, phone, relationship: rel || null });
      toast('Notfallkontakt gespeichert');
      await renderEmergencyContacts();
    } catch (e) { toast(e.message, 'error'); }
  });

  // Delete-Button für neue Zeile (einfach entfernen ohne API-Call)
  row.querySelector('.ec-delete').addEventListener('click', () => {
    row.remove();
    if (!listEl.querySelector('.ec-row')) {
      listEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px;margin-bottom:8px">Noch keine Notfallkontakte hinterlegt.</p>';
    }
  });
}

function bindEmergencyContactActions() {
  document.querySelectorAll('.ec-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id  = btn.dataset.id;
      const row = document.querySelector(`.ec-row[data-id="${id}"]`);
      if (!row) return;
      const name  = row.querySelector('.ec-name').value.trim();
      const phone = row.querySelector('.ec-phone').value.trim();
      const rel   = row.querySelector('.ec-rel').value.trim();
      if (!name)  { toast('Name eingeben', 'error'); return; }
      if (!phone) { toast('Telefon eingeben', 'error'); return; }
      try {
        await api.updateMyEmergencyContact(id, { name, phone, relationship: rel || null });
        toast('Notfallkontakt gespeichert');
      } catch (e) { toast(e.message, 'error'); }
    });
  });

  document.querySelectorAll('.ec-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Notfallkontakt löschen?')) return;
      const id = btn.dataset.id;
      try {
        await api.deleteMyEmergencyContact(id);
        toast('Gelöscht');
        await renderEmergencyContacts();
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

// ── Tab: Qualifikationen ──────────────────────────────────────────────────────

async function loadQualificationsTab() {
  const wrap = document.getElementById('tab-qualifications');
  wrap.innerHTML = '<p class="text-muted text-sm">Lade...</p>';

  try {
    const [qualifications, settings] = await Promise.all([
      api.getMyQualifications(),
      api.getSettings(),
    ]);
    const warnDays = settings?.qualification_warn_days ?? 90;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!qualifications.length) {
      wrap.innerHTML = `
        <div class="card">
          <div class="card__body">
            <p class="text-muted text-sm">Noch keine Qualifikationen hinterlegt. Der Wehrleiter kann diese im Personal-Modul eintragen.</p>
          </div>
        </div>`;
      return;
    }

    const rows = qualifications.map(q => {
      const { statusDot, label, daysLeft } = expiryStatus(q.expires_at, warnDays, today);
      const expiryText = q.expires_at
        ? `${statusDot} ${formatDate(q.expires_at)}${daysLeft !== null ? ` (${daysLeft < 0 ? 'abgelaufen' : `noch ${daysLeft} Tage`})` : ''}`
        : '<span class="text-muted">–</span>';

      return `
        <tr>
          <td><strong>${esc(q.name)}</strong></td>
          <td>${q.acquired_at ? formatDate(q.acquired_at) : '<span class="text-muted">–</span>'}</td>
          <td>${expiryText}</td>
          <td>${q.notes ? esc(q.notes) : '<span class="text-muted">–</span>'}</td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
      <div class="card">
        <div class="card__header">Meine Qualifikationen</div>
        <div class="card__body" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:var(--bg-card-hover);text-align:left">
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border)">Qualifikation</th>
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border)">Erworben</th>
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border)">Gültig bis</th>
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border)">Hinweis</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:12px">
        <span class="status-dot status-dot--success"></span> Gültig &nbsp;|&nbsp;
        <span class="status-dot status-dot--warning"></span> Läuft in ${warnDays} Tagen ab &nbsp;|&nbsp;
        <span class="status-dot status-dot--danger"></span> Abgelaufen oder kritisch
      </p>
    `;

    // Tabellenzeilen stylen
    wrap.querySelectorAll('tbody tr').forEach((tr, i) => {
      
      tr.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
    });
    renderIcons(wrap);

  } catch (e) {
    wrap.innerHTML = `<p class="error-msg">${esc(e.message)}</p>`;
  }
}

// ── Tab: Ehrungen ─────────────────────────────────────────────────────────────

async function loadHonorsTab() {
  const wrap = document.getElementById('tab-honors');
  wrap.innerHTML = '<p class="text-muted text-sm">Lade...</p>';

  try {
    const honors = await api.getMyHonors();

    if (!honors.length) {
      wrap.innerHTML = `
        <div class="card">
          <div class="card__body">
            <p class="text-muted text-sm">Noch keine Ehrungen hinterlegt. Ehrungen werden vom Wehrleiter im Personal-Modul eingetragen.</p>
          </div>
        </div>`;
      renderIcons(wrap);
      return;
    }

    const rows = honors.map(h => {
      const isActive = h.status === 'aktiv';
      const statusBadge = isActive
        ? `<span class="badge-success">Aktiv</span>`
        : `<span class="badge-muted">Zurückgezogen</span>`;
      return `
        <tr style="border-bottom:1px solid var(--border)">
          <td style="padding:10px 16px"><strong>${esc(h.name)}</strong></td>
          <td>${h.awarded_at ? formatDate(h.awarded_at) : '–'}</td>
          <td style="padding:10px 16px">${statusBadge}</td>
          <td>${h.notes ? esc(h.notes) : '–'}</td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
      <div class="card">
        <div class="card__header">Meine Ehrungen</div>
        <div class="card__body" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:var(--bg-card-hover);text-align:left">
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border)">Ehrung</th>
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border)">Verliehen am</th>
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border)">Status</th>
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border)">Notizen</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    renderIcons(wrap);

  } catch (e) {
    wrap.innerHTML = `<p class="error-msg">${esc(e.message)}</p>`;
  }
}

// ── Tab: Ausrüstung ───────────────────────────────────────────────────────────

async function loadEquipmentTab() {
  const wrap = document.getElementById('tab-equipment');
  wrap.innerHTML = '<p class="text-muted text-sm">Lade...</p>';

  try {
    const equipment = await api.getMyEquipment();

    if (!equipment.length) {
      wrap.innerHTML = `
        <div class="card">
          <div class="card__body">
            <p class="text-muted text-sm">Noch keine Ausrüstung / Ausweise hinterlegt. Diese werden vom Gerätewart oder Wehrleiter eingetragen.</p>
          </div>
        </div>`;
      return;
    }

    const cards = equipment.map(e => `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:16px">
        <div style="font-size:15px;font-weight:700;margin-bottom:8px">${EQUIPMENT_LABELS[e.type] || esc(e.type)}</div>
        ${e.identifier ? `<div style="font-size:13px;color:var(--text);margin-bottom:4px">Nr./Bezeichnung: <strong>${esc(e.identifier)}</strong></div>` : ''}
        ${e.issued_at  ? `<div class="text-muted text-xs">Ausgestellt: ${formatDate(e.issued_at)}</div>` : ''}
        ${e.expires_at ? `<div class="text-muted text-xs">Gültig bis: ${formatDate(e.expires_at)}</div>` : ''}
        ${e.notes      ? `<div style="font-size:12px;color:var(--text-muted);margin-top:6px">${esc(e.notes)}</div>` : ''}
      </div>
    `).join('');

    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
        ${cards}
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:16px">Ausrüstung und Ausweise werden vom Gerätewart oder Wehrleiter gepflegt.</p>
    `;

  } catch (e) {
    wrap.innerHTML = `<p class="error-msg">${esc(e.message)}</p>`;
  }
}

// ── Tab: Termine ──────────────────────────────────────────────────────────────

async function loadAppointmentsTab() {
  const wrap = document.getElementById('tab-appointments');
  wrap.innerHTML = '<p class="text-muted text-sm">Lade...</p>';

  try {
    const termine = await api.getMyTermine();
    const now = new Date();

    if (!termine.length) {
      wrap.innerHTML = `
        <div class="card">
          <div class="card__body" style="text-align:center;padding:40px 20px">
            <div style="margin-bottom:12px">${icon('calendar', 32)}</div>
            <p style="color:var(--text-muted);font-size:14px">Keine Termine vorhanden.</p>
          </div>
        </div>`;
      renderIcons(wrap);
      return;
    }

    const upcoming = termine.filter(t => new Date(t.start_at) >= now);
    const past     = termine.filter(t => new Date(t.start_at) <  now);

    const renderCards = (list) => list.map(t => {
      const colorDot = t.typ_color
        ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.typ_color};margin-right:4px"></span>`
        : '';
      return `
        <div style="border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:10px">
          <div style="display:flex;align-items:flex-start;gap:12px">
            <div style="min-width:52px;text-align:center;background:var(--bg-card-hover);border-radius:6px;padding:6px 8px">
              <div style="font-size:18px;font-weight:700;line-height:1">${new Date(t.start_at).getDate().toString().padStart(2,'0')}</div>
              <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">${new Date(t.start_at).toLocaleDateString('de-DE', {month:'short'})}</div>
            </div>
            <div style="flex:1">
              <div style="font-weight:600;font-size:14px">${esc(t.title)}</div>
              <div style="color:var(--text-muted);font-size:12px;margin-top:3px">
                ${colorDot}${t.typ_name ? esc(t.typ_name) + ' · ' : ''}
                ${new Date(t.start_at).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})} Uhr
                ${t.end_at ? ` – ${new Date(t.end_at).toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'})} Uhr` : ''}
              </div>
              ${t.location ? `<div style="color:var(--text-muted);font-size:12px;margin-top:2px">${icon('map-pin',11)} ${esc(t.location)}</div>` : ''}
              ${t.description ? `<div class="text-muted" style="font-size:12px;margin-top:4px">${esc(t.description)}</div>` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    wrap.innerHTML = `
      ${upcoming.length ? `
        <div class="card" style="margin-bottom:16px">
          <div class="card__header">Bevorstehende Termine (${upcoming.length})</div>
          <div class="card__body">${renderCards(upcoming)}</div>
        </div>` : ''}
      ${past.length ? `
        <div class="card">
          <div class="card__header text-muted">Vergangene Termine (${past.length})</div>
          <div class="card__body" style="opacity:0.6">${renderCards(past)}</div>
        </div>` : ''}
    `;

    renderIcons(wrap);

  } catch (e) {
    wrap.innerHTML = `<p class="error-msg">${esc(e.message)}</p>`;
  }
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function expiryStatus(expiresAt, warnDays, today) {
  const dot = (mod) => `<span class="status-dot status-dot--${mod}"></span>`;
  if (!expiresAt) return { statusDot: '', label: 'ok', daysLeft: null };
  const exp = new Date(expiresAt);
  exp.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((exp - today) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0)         return { statusDot: dot('danger'), label: 'abgelaufen', daysLeft };
  if (daysLeft <= 30)       return { statusDot: dot('danger'), label: 'kritisch', daysLeft };
  if (daysLeft <= warnDays) return { statusDot: dot('warning'), label: 'warnung', daysLeft };
  return { statusDot: dot('success'), label: 'ok', daysLeft };
}

function formatDate(dateStr) {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
