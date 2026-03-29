import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';
import { esc } from '../utils.js';
import { icon, renderIcons } from '../icons.js';

const EQUIPMENT_LABELS = {
  pager:          'Pager',
  key:            'Schlüssel',
  transponder:    'Transponder',
  id_card:        'Dienstausweis',
  driving_permit: 'Fahrberechtigung',
};

const EQUIPMENT_TYPES = Object.entries(EQUIPMENT_LABELS)
  .map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

export async function renderPersonal() {
  const [settings, user] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('personal');

  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div><h2>Personal</h2><p>Mitgliederverwaltung</p></div>
    </div>
    <div id="personal-list-wrap"></div>
    <div id="personal-detail-wrap" style="display:none"></div>
  `;

  loadMemberList();
  renderIcons(document.getElementById('page-content'));
}

// ── Mitgliederliste ───────────────────────────────────────────────────────────

async function loadMemberList() {
  const listWrap   = document.getElementById('personal-list-wrap');
  const detailWrap = document.getElementById('personal-detail-wrap');
  listWrap.style.display   = 'block';
  detailWrap.style.display = 'none';
  listWrap.innerHTML = '<p style="color:#7d8590;font-size:13px">Lade...</p>';

  try {
    const members = await api.getPersonalMembers();

    const rows = members.map(m => `
      <tr style="cursor:pointer" data-id="${m.id}" class="member-row">
        <td style="padding:10px 16px"><strong>${esc(m.display_name || m.username)}</strong>
          ${m.display_name ? `<span style="color:#7d8590;font-size:11px;margin-left:6px">${esc(m.username)}</span>` : ''}</td>
        <td style="padding:10px 16px;color:#7d8590">${esc(m.personnel_number || '–')}</td>
        <td style="padding:10px 16px;color:#7d8590">${m.entry_date ? formatDate(m.entry_date) : '–'}</td>
        <td style="padding:10px 16px;color:#7d8590">${m.exit_date ? `<span style="color:#ff8a80">${formatDate(m.exit_date)}</span>` : '<span style="color:#3fb950">Aktiv</span>'}</td>
      </tr>
    `).join('');

    listWrap.innerHTML = `
      <div class="card">
        <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
          <span>Alle Mitglieder (${members.length})</span>
          <input type="text" id="personal-search" placeholder="Suchen..." maxlength="100"
            style="background:#0d1117;border:1px solid #21273d;color:#e6edf3;padding:6px 10px;border-radius:6px;font-size:13px;width:200px" />
        </div>
        <div class="card__body" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#0d1117">
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Name</th>
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Pers.-Nr.</th>
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Eintrittsdatum</th>
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Status</th>
              </tr>
            </thead>
            <tbody id="personal-tbody">${rows}</tbody>
          </table>
        </div>
      </div>
    `;

    styleRows();

    document.getElementById('personal-search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.member-row').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    document.querySelectorAll('.member-row').forEach(tr => {
      tr.addEventListener('click', () => openMember(tr.dataset.id, members));
    });

  } catch (e) {
    listWrap.innerHTML = `<p style="color:#ff8a80">${esc(e.message)}</p>`;
  }
}

function styleRows() {
  document.querySelectorAll('.member-row').forEach((tr, i) => {
    tr.style.borderBottom = '1px solid #21273d';
    tr.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
    tr.addEventListener('mouseenter', () => tr.style.background = 'rgba(230,48,34,0.06)');
    tr.addEventListener('mouseleave', () => tr.style.background = document.querySelectorAll('.member-row')[Array.from(document.querySelectorAll('.member-row')).indexOf(tr) % 2 === 0 ? 0 : 1]?.style.background || 'transparent');
  });
}

// ── Mitglied-Detailansicht ────────────────────────────────────────────────────

async function openMember(userId, members) {
  const listWrap   = document.getElementById('personal-list-wrap');
  const detailWrap = document.getElementById('personal-detail-wrap');
  listWrap.style.display   = 'none';
  detailWrap.style.display = 'block';
  detailWrap.innerHTML     = '<p style="color:#7d8590;font-size:13px">Lade...</p>';

  const member = members.find(m => m.id === userId);

  try {
    const [details, qualifications, equipment, honors, settings, attendance] = await Promise.all([
      api.getPersonalDetails(userId),
      api.getPersonalQualifications(userId),
      api.getPersonalEquipment(userId),
      api.getPersonalHonors(userId),
      api.getSettings(),
      api.getAttendance(userId),
    ]);
    const warnDays = settings?.qualification_warn_days ?? 90;

    detailWrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <button class="btn btn--outline btn--sm" id="btn-back-personal">← Zurück</button>
        <div>
          <h3 style="margin:0;font-size:18px">${esc(member?.display_name || member?.username || '')}</h3>
          <span style="color:#7d8590;font-size:13px">${esc(member?.username || '')}</span>
        </div>
      </div>

      <div class="tab-bar" style="display:flex;gap:4px;margin-bottom:24px;border-bottom:1px solid #21273d;padding-bottom:0">
        <button class="ptab-btn active" data-tab="pstamm"      style="${tabStyle(true)}">${icon('clipboard-list', 14)} Stammdaten</button>
        <button class="ptab-btn"        data-tab="pquali"       style="${tabStyle(false)}">${icon('graduation-cap', 14)} Qualifikationen</button>
        <button class="ptab-btn"        data-tab="pequip"       style="${tabStyle(false)}">${icon('wrench', 14)} Ausrüstung</button>
        <button class="ptab-btn"        data-tab="phonors"      style="${tabStyle(false)}">${icon('award', 14)} Ehrungen</button>
        <button class="ptab-btn"        data-tab="panwesenheit" style="${tabStyle(false)}">${icon('calendar', 14)} Anwesenheit</button>
      </div>

      <div id="ptab-pstamm"></div>
      <div id="ptab-pquali"       style="display:none"></div>
      <div id="ptab-pequip"       style="display:none"></div>
      <div id="ptab-phonors"      style="display:none"></div>
      <div id="ptab-panwesenheit" style="display:none"></div>
    `;

    document.getElementById('btn-back-personal').addEventListener('click', loadMemberList);

    document.querySelectorAll('.ptab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ptab-btn').forEach(b => b.style.cssText = tabStyle(false));
        btn.style.cssText = tabStyle(true);
        document.querySelectorAll('[id^="ptab-"]').forEach(t => t.style.display = 'none');
        document.getElementById(`ptab-${btn.dataset.tab}`).style.display = 'block';
      });
    });

    renderStammdaten(userId, details);
    renderQualifikationen(userId, qualifications, warnDays);
    renderAusruestung(userId, equipment);
    renderEhrungen(userId, honors);
    renderAnwesenheit(userId, attendance, member);
    renderIcons(document.getElementById('personal-detail-wrap'));

  } catch (e) {
    detailWrap.innerHTML = `<p style="color:#ff8a80">${esc(e.message)}</p>`;
  }
}

function tabStyle(active) {
  return `padding:8px 16px;background:none;border:none;border-bottom:2px solid ${active ? '#e63022' : 'transparent'};color:${active ? '#e6edf3' : '#7d8590'};cursor:pointer;font-size:13px;font-weight:600;margin-bottom:-1px`;
}

// ── Tab: Stammdaten ───────────────────────────────────────────────────────────

function renderStammdaten(userId, details) {
  const wrap = document.getElementById('ptab-pstamm');
  wrap.innerHTML = `
    <div class="card" style="max-width:560px">
      <div class="card__header">Stammdaten</div>
      <div class="card__body">
        <div class="form-grid">
          <div class="form-group">
            <label>Geburtsdatum</label>
            <input type="date" id="d-dob" value="${details?.date_of_birth || ''}" />
          </div>
          <div class="form-group">
            <label>Personalnummer</label>
            <input type="text" id="d-persnr" maxlength="50" value="${esc(details?.personnel_number || '')}" />
          </div>
          <div class="form-group">
            <label>Eintrittsdatum</label>
            <input type="date" id="d-entry" value="${details?.entry_date || ''}" />
          </div>
          <div class="form-group">
            <label>Austrittsdatum</label>
            <input type="date" id="d-exit" value="${details?.exit_date || ''}" />
          </div>
          <div class="form-group form-group--full">
            <label>Interne Notizen</label>
            <textarea id="d-notes" maxlength="500" rows="3"
              style="background:#0d1117;border:1px solid #21273d;color:#e6edf3;padding:8px;border-radius:6px;width:100%;resize:vertical;font-size:13px">${esc(details?.notes || '')}</textarea>
          </div>
        </div>
        <div class="btn-group" style="margin-top:16px">
          <button class="btn btn--primary" id="btn-save-stamm">Stammdaten speichern</button>
        </div>
      </div>
    </div>

    <div class="card" style="max-width:560px;margin-top:16px">
      <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
        <span>Kontaktdaten</span>
        <span style="font-size:11px;color:#7d8590">Vom Mitglied pflegbar — hier überschreibbar</span>
      </div>
      <div class="card__body">
        ${details?.updated_by_name
          ? `<div style="background:#1c2335;border:1px solid #f0a500;border-radius:8px;padding:10px 14px;font-size:12px;color:#f0a500;margin-bottom:12px">
               Zuletzt bearbeitet von ${esc(details.updated_by_name)}
             </div>`
          : ''}
        <div class="form-grid">
          <div class="form-group">
            <label>Telefon</label>
            <input type="text" id="cd-phone" maxlength="30" value="${esc(details?.phone || '')}" placeholder="z.B. 0170 1234567" />
          </div>
          <div class="form-group">
            <label>Private E-Mail</label>
            <input type="email" id="cd-email" maxlength="100" value="${esc(details?.email_private || '')}" placeholder="max@beispiel.de" />
          </div>
          <div class="form-group form-group--full">
            <label>Adresse</label>
            <input type="text" id="cd-address" maxlength="200" value="${esc(details?.address || '')}" placeholder="Musterstraße 1, 12345 Musterstadt" />
          </div>
        </div>
        <div class="btn-group" style="margin-top:16px">
          <button class="btn btn--primary" id="btn-save-contact-data">Kontaktdaten speichern</button>
        </div>
      </div>
    </div>

    <div class="card" style="max-width:560px;margin-top:16px">
      <div class="card__header">Notfallkontakte</div>
      <div class="card__body">
        <div id="member-emergency-contacts-list">
          <p style="color:#7d8590;font-size:13px">Lade...</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-save-stamm').addEventListener('click', async () => {
    try {
      await api.updatePersonalDetails(userId, {
        date_of_birth:    document.getElementById('d-dob').value   || null,
        entry_date:       document.getElementById('d-entry').value || null,
        exit_date:        document.getElementById('d-exit').value  || null,
        personnel_number: document.getElementById('d-persnr').value.trim() || null,
        notes:            document.getElementById('d-notes').value.trim()  || null,
      });
      toast('Stammdaten gespeichert');
    } catch (e) { toast(e.message, 'error'); }
  });

  document.getElementById('btn-save-contact-data').addEventListener('click', async () => {
    try {
      await api.updateMemberProfile(userId, {
        phone:         document.getElementById('cd-phone').value.trim()   || null,
        email_private: document.getElementById('cd-email').value.trim()   || null,
        address:       document.getElementById('cd-address').value.trim() || null,
      });
      toast('Kontaktdaten gespeichert');
    } catch (e) { toast(e.message, 'error'); }
  });

  // Notfallkontakte laden (read-only)
  loadMemberEmergencyContacts(userId);
}

async function loadMemberEmergencyContacts(userId) {
  const listEl = document.getElementById('member-emergency-contacts-list');
  if (!listEl) return;

  try {
    const contacts = await api.getMemberEmergencyContacts(userId);

    if (!contacts.length) {
      listEl.innerHTML = '<p style="color:#7d8590;font-size:13px">Noch keine Notfallkontakte hinterlegt.</p>';
      return;
    }

    const rows = contacts.map(c => `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:6px;font-size:13px;padding:8px 0;border-bottom:1px solid #21273d">
        <div><strong>${esc(c.name)}</strong></div>
        <div style="color:#7d8590">${esc(c.phone)}</div>
        <div style="color:#7d8590">${c.relationship ? esc(c.relationship) : '–'}</div>
      </div>
    `).join('');

    listEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:4px">
        <div style="font-size:11px;color:#7d8590;font-weight:600">Name</div>
        <div style="font-size:11px;color:#7d8590;font-weight:600">Telefon</div>
        <div style="font-size:11px;color:#7d8590;font-weight:600">Beziehung</div>
      </div>
      ${rows}
    `;
  } catch (e) {
    listEl.innerHTML = `<p style="color:#ff8a80">${esc(e.message)}</p>`;
  }
}

// ── Tab: Qualifikationen ──────────────────────────────────────────────────────

function renderQualifikationen(userId, qualifications, warnDays) {
  const wrap = document.getElementById('ptab-pquali');
  const today = new Date(); today.setHours(0,0,0,0);

  wrap.innerHTML = `
    <div class="card">
      <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
        <span>Qualifikationen</span>
        <button class="btn btn--primary btn--sm" id="btn-add-quali">+ Hinzufügen</button>
      </div>
      <div id="quali-list">
        ${qualifications.length ? renderQualiTable(qualifications, warnDays, today) : '<div style="padding:16px"><p style="color:#7d8590;font-size:13px">Noch keine Qualifikationen eingetragen.</p></div>'}
      </div>
    </div>

    <div id="quali-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;align-items:center;justify-content:center">
      <div style="background:#161b27;border:1px solid #21273d;border-radius:12px;padding:24px;width:100%;max-width:440px">
        <h3 id="quali-modal-title" style="margin:0 0 16px;font-size:16px">Qualifikation</h3>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Bezeichnung</label>
            <input type="text" id="q-name" maxlength="100" placeholder="z.B. Grundausbildung, G26.3, AGT..." />
          </div>
          <div class="form-group">
            <label>Erworben am</label>
            <input type="date" id="q-acquired" />
          </div>
          <div class="form-group">
            <label>Gültig bis</label>
            <input type="date" id="q-expires" />
          </div>
          <div class="form-group form-group--full">
            <label>Hinweis</label>
            <input type="text" id="q-notes" maxlength="200" />
          </div>
        </div>
        <div class="btn-group" style="margin-top:16px">
          <button class="btn btn--primary" id="btn-save-quali">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-quali">Abbrechen</button>
        </div>
      </div>
    </div>
  `;

  let editQualId = null;

  const openModal = (q = null) => {
    editQualId = q?.id || null;
    document.getElementById('quali-modal-title').textContent = q ? 'Qualifikation bearbeiten' : 'Qualifikation hinzufügen';
    document.getElementById('q-name').value     = q?.name || '';
    document.getElementById('q-acquired').value = q?.acquired_at || '';
    document.getElementById('q-expires').value  = q?.expires_at  || '';
    document.getElementById('q-notes').value    = q?.notes || '';
    document.getElementById('quali-modal').style.display = 'flex';
  };

  const closeModal = () => { document.getElementById('quali-modal').style.display = 'none'; };

  document.getElementById('btn-add-quali').addEventListener('click', () => openModal());
  document.getElementById('btn-cancel-quali').addEventListener('click', closeModal);

  document.getElementById('btn-save-quali').addEventListener('click', async () => {
    const name = document.getElementById('q-name').value.trim();
    if (!name) { toast('Bezeichnung eingeben', 'error'); return; }
    try {
      const body = {
        name,
        acquired_at: document.getElementById('q-acquired').value || null,
        expires_at:  document.getElementById('q-expires').value  || null,
        notes:       document.getElementById('q-notes').value.trim() || null,
      };
      if (editQualId) {
        await api.updatePersonalQualification(userId, editQualId, body);
        toast('Qualifikation gespeichert');
      } else {
        await api.createPersonalQualification(userId, body);
        toast('Qualifikation hinzugefügt');
      }
      closeModal();
      const updated = await api.getPersonalQualifications(userId);
      document.getElementById('quali-list').innerHTML = updated.length
        ? renderQualiTable(updated, warnDays, today)
        : '<div style="padding:16px"><p style="color:#7d8590;font-size:13px">Noch keine Qualifikationen eingetragen.</p></div>';
      bindQualiActions(userId, warnDays, today, openModal);
    } catch (e) { toast(e.message, 'error'); }
  });

  bindQualiActions(userId, warnDays, today, openModal);
}

function renderQualiTable(qualifications, warnDays, today) {
  const rows = qualifications.map(q => {
    const { statusDot, daysLeft } = expiryStatus(q.expires_at, warnDays, today);
    const expiryText = q.expires_at
      ? `${statusDot} ${formatDate(q.expires_at)}${daysLeft !== null ? ` (${daysLeft < 0 ? 'abgelaufen' : `noch ${daysLeft}d`})` : ''}`
      : '–';
    return `
      <tr data-qid="${q.id}" data-name="${esc(q.name)}"
          data-acquired="${q.acquired_at || ''}" data-expires="${q.expires_at || ''}" data-notes="${esc(q.notes || '')}">
        <td style="padding:10px 16px"><strong>${esc(q.name)}</strong></td>
        <td style="padding:10px 16px;color:#7d8590">${q.acquired_at ? formatDate(q.acquired_at) : '–'}</td>
        <td style="padding:10px 16px">${expiryText}</td>
        <td style="padding:10px 16px">
          <div class="btn-group">
            <button class="btn btn--outline btn--sm" data-action="edit-quali">Bearbeiten</button>
            <button class="btn btn--danger btn--sm"  data-action="delete-quali">Löschen</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#0d1117">
        <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Qualifikation</th>
        <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Erworben</th>
        <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Gültig bis</th>
        <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left"></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function bindQualiActions(userId, warnDays, today, openModal) {
  document.querySelectorAll('[data-action="edit-quali"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tr = btn.closest('tr');
      openModal({
        id: tr.dataset.qid, name: tr.dataset.name,
        acquired_at: tr.dataset.acquired, expires_at: tr.dataset.expires, notes: tr.dataset.notes,
      });
    });
  });
  document.querySelectorAll('[data-action="delete-quali"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Qualifikation löschen?')) return;
      try {
        await api.deletePersonalQualification(userId, btn.closest('tr').dataset.qid);
        toast('Gelöscht');
        const updated = await api.getPersonalQualifications(userId);
        document.getElementById('quali-list').innerHTML = updated.length
          ? renderQualiTable(updated, warnDays, today)
          : '<div style="padding:16px"><p style="color:#7d8590;font-size:13px">Noch keine Qualifikationen eingetragen.</p></div>';
        bindQualiActions(userId, warnDays, today, openModal);
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

// ── Tab: Ausrüstung ───────────────────────────────────────────────────────────

function renderAusruestung(userId, equipment) {
  const wrap = document.getElementById('ptab-pequip');

  wrap.innerHTML = `
    <div class="card">
      <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
        <span>Ausrüstung & Ausweise</span>
        <button class="btn btn--primary btn--sm" id="btn-add-equip">+ Hinzufügen</button>
      </div>
      <div id="equip-list">
        ${equipment.length ? renderEquipTable(equipment) : '<div style="padding:16px"><p style="color:#7d8590;font-size:13px">Noch keine Ausrüstung eingetragen.</p></div>'}
      </div>
    </div>

    <div id="equip-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;align-items:center;justify-content:center">
      <div style="background:#161b27;border:1px solid #21273d;border-radius:12px;padding:24px;width:100%;max-width:440px">
        <h3 id="equip-modal-title" style="margin:0 0 16px;font-size:16px">Ausrüstung</h3>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Typ</label>
            <select id="e-type" style="background:#0d1117;border:1px solid #21273d;color:#e6edf3;padding:8px;border-radius:6px;width:100%;font-size:13px">
              ${EQUIPMENT_TYPES}
            </select>
          </div>
          <div class="form-group form-group--full">
            <label>Nr. / Bezeichnung</label>
            <input type="text" id="e-identifier" maxlength="100" placeholder="z.B. Pagernummer, Schlüsselnummer..." />
          </div>
          <div class="form-group">
            <label>Ausgestellt am</label>
            <input type="date" id="e-issued" />
          </div>
          <div class="form-group">
            <label>Gültig bis</label>
            <input type="date" id="e-expires" />
          </div>
          <div class="form-group form-group--full">
            <label>Hinweis</label>
            <input type="text" id="e-notes" maxlength="200" />
          </div>
        </div>
        <div class="btn-group" style="margin-top:16px">
          <button class="btn btn--primary" id="btn-save-equip">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-equip">Abbrechen</button>
        </div>
      </div>
    </div>
  `;

  let editEquipId = null;

  const openModal = (e = null) => {
    editEquipId = e?.id || null;
    document.getElementById('equip-modal-title').textContent = e ? 'Ausrüstung bearbeiten' : 'Ausrüstung hinzufügen';
    document.getElementById('e-type').value       = e?.type || 'pager';
    document.getElementById('e-identifier').value = e?.identifier || '';
    document.getElementById('e-issued').value     = e?.issued_at || '';
    document.getElementById('e-expires').value    = e?.expires_at || '';
    document.getElementById('e-notes').value      = e?.notes || '';
    document.getElementById('equip-modal').style.display = 'flex';
  };
  const closeModal = () => { document.getElementById('equip-modal').style.display = 'none'; };

  document.getElementById('btn-add-equip').addEventListener('click', () => openModal());
  document.getElementById('btn-cancel-equip').addEventListener('click', closeModal);

  document.getElementById('btn-save-equip').addEventListener('click', async () => {
    try {
      const body = {
        type:       document.getElementById('e-type').value,
        identifier: document.getElementById('e-identifier').value.trim() || null,
        issued_at:  document.getElementById('e-issued').value  || null,
        expires_at: document.getElementById('e-expires').value || null,
        notes:      document.getElementById('e-notes').value.trim() || null,
      };
      if (editEquipId) {
        await api.updatePersonalEquipment(userId, editEquipId, body);
        toast('Gespeichert');
      } else {
        await api.createPersonalEquipment(userId, body);
        toast('Hinzugefügt');
      }
      closeModal();
      const updated = await api.getPersonalEquipment(userId);
      document.getElementById('equip-list').innerHTML = updated.length
        ? renderEquipTable(updated)
        : '<div style="padding:16px"><p style="color:#7d8590;font-size:13px">Noch keine Ausrüstung eingetragen.</p></div>';
      bindEquipActions(userId, openModal);
    } catch (e) { toast(e.message, 'error'); }
  });

  bindEquipActions(userId, openModal);
}

function renderEquipTable(equipment) {
  const rows = equipment.map(e => `
    <tr data-eid="${e.id}" data-type="${e.type}"
        data-identifier="${esc(e.identifier || '')}" data-issued="${e.issued_at || ''}"
        data-expires="${e.expires_at || ''}" data-notes="${esc(e.notes || '')}">
      <td style="padding:10px 16px">${EQUIPMENT_LABELS[e.type] || esc(e.type)}</td>
      <td style="padding:10px 16px;color:#7d8590">${esc(e.identifier || '–')}</td>
      <td style="padding:10px 16px;color:#7d8590">${e.issued_at ? formatDate(e.issued_at) : '–'}</td>
      <td style="padding:10px 16px;color:#7d8590">${e.expires_at ? formatDate(e.expires_at) : '–'}</td>
      <td style="padding:10px 16px">
        <div class="btn-group">
          <button class="btn btn--outline btn--sm" data-action="edit-equip">Bearbeiten</button>
          <button class="btn btn--danger btn--sm"  data-action="delete-equip">Löschen</button>
        </div>
      </td>
    </tr>`).join('');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#0d1117">
        <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Typ</th>
        <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Nr./Bezeichnung</th>
        <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Ausgestellt</th>
        <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Gültig bis</th>
        <th style="padding:10px 16px;border-bottom:1px solid #21273d"></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function bindEquipActions(userId, openModal) {
  document.querySelectorAll('[data-action="edit-equip"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tr = btn.closest('tr');
      openModal({ id: tr.dataset.eid, type: tr.dataset.type, identifier: tr.dataset.identifier,
                  issued_at: tr.dataset.issued, expires_at: tr.dataset.expires, notes: tr.dataset.notes });
    });
  });
  document.querySelectorAll('[data-action="delete-equip"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Eintrag löschen?')) return;
      try {
        await api.deletePersonalEquipment(userId, btn.closest('tr').dataset.eid);
        toast('Gelöscht');
        const updated = await api.getPersonalEquipment(userId);
        document.getElementById('equip-list').innerHTML = updated.length
          ? renderEquipTable(updated)
          : '<div style="padding:16px"><p style="color:#7d8590;font-size:13px">Noch keine Ausrüstung eingetragen.</p></div>';
        bindEquipActions(userId, openModal);
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

// ── Tab: Ehrungen ─────────────────────────────────────────────────────────────

function renderEhrungen(userId, honors) {
  const wrap = document.getElementById('ptab-phonors');

  wrap.innerHTML = `
    <div class="card">
      <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
        <span>Ehrungen</span>
        <button class="btn btn--primary btn--sm" id="btn-add-honor">+ Hinzufügen</button>
      </div>
      <div id="honor-list">
        ${honors.length ? renderHonorTable(honors) : '<div style="padding:16px"><p style="color:#7d8590;font-size:13px">Noch keine Ehrungen eingetragen.</p></div>'}
      </div>
    </div>

    <div id="honor-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:200;align-items:center;justify-content:center">
      <div style="background:#161b27;border:1px solid #21273d;border-radius:12px;padding:24px;width:100%;max-width:440px">
        <h3 id="honor-modal-title" style="margin:0 0 16px;font-size:16px">Ehrung</h3>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Bezeichnung</label>
            <input type="text" id="h-name" maxlength="100" placeholder="z.B. 10 Jahre aktiver Dienst, Feuerwehr-Ehrenzeichen..." />
          </div>
          <div class="form-group">
            <label>Verliehen am</label>
            <input type="date" id="h-awarded" />
          </div>
          <div class="form-group">
            <label>Status</label>
            <select id="h-status">
              <option value="aktiv">Aktiv</option>
              <option value="zurueckgezogen">Zurückgezogen</option>
            </select>
          </div>
          <div class="form-group form-group--full">
            <label>Hinweis</label>
            <input type="text" id="h-notes" maxlength="200" />
          </div>
        </div>
        <div class="btn-group" style="margin-top:16px">
          <button class="btn btn--primary" id="btn-save-honor">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-honor">Abbrechen</button>
        </div>
      </div>
    </div>
  `;

  let editHonorId = null;

  const openModal = (h = null) => {
    editHonorId = h?.id || null;
    document.getElementById('honor-modal-title').textContent = h ? 'Ehrung bearbeiten' : 'Ehrung hinzufügen';
    document.getElementById('h-name').value    = h?.name || '';
    document.getElementById('h-awarded').value = h?.awarded_at || '';
    document.getElementById('h-status').value  = h?.status || 'aktiv';
    document.getElementById('h-notes').value   = h?.notes || '';
    document.getElementById('honor-modal').style.display = 'flex';
  };
  const closeModal = () => { document.getElementById('honor-modal').style.display = 'none'; };

  document.getElementById('btn-add-honor').addEventListener('click', () => openModal());
  document.getElementById('btn-cancel-honor').addEventListener('click', closeModal);

  document.getElementById('btn-save-honor').addEventListener('click', async () => {
    const name = document.getElementById('h-name').value.trim();
    if (!name) { toast('Bezeichnung eingeben', 'error'); return; }
    try {
      const body = {
        name,
        awarded_at: document.getElementById('h-awarded').value || null,
        status:     document.getElementById('h-status').value,
        notes:      document.getElementById('h-notes').value.trim() || null,
      };
      if (editHonorId) {
        await api.updatePersonalHonor(userId, editHonorId, body);
        toast('Gespeichert');
      } else {
        await api.createPersonalHonor(userId, body);
        toast('Hinzugefügt');
      }
      closeModal();
      const updated = await api.getPersonalHonors(userId);
      document.getElementById('honor-list').innerHTML = updated.length
        ? renderHonorTable(updated)
        : '<div style="padding:16px"><p style="color:#7d8590;font-size:13px">Noch keine Ehrungen eingetragen.</p></div>';
      bindHonorActions(userId, openModal);
    } catch (e) { toast(e.message, 'error'); }
  });

  bindHonorActions(userId, openModal);
}

function renderHonorTable(honors) {
  const rows = honors.map(h => {
    const isActive = h.status === 'aktiv';
    const statusBadge = isActive
      ? `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#14532d;color:#4ade80">Aktiv</span>`
      : `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#1f2937;color:#9ca3af">Zurückgezogen</span>`;
    return `
    <tr data-hid="${h.id}" data-name="${esc(h.name)}"
        data-awarded="${h.awarded_at || ''}" data-status="${h.status || 'aktiv'}" data-notes="${esc(h.notes || '')}">
      <td style="padding:10px 16px"><strong>${esc(h.name)}</strong></td>
      <td style="padding:10px 16px;color:#7d8590">${h.awarded_at ? formatDate(h.awarded_at) : '–'}</td>
      <td style="padding:10px 16px">${statusBadge}</td>
      <td style="padding:10px 16px;color:#7d8590">${esc(h.notes || '–')}</td>
      <td style="padding:10px 16px">
        <div class="btn-group">
          <button class="btn btn--outline btn--sm" data-action="edit-honor">Bearbeiten</button>
          <button class="btn btn--danger btn--sm"  data-action="delete-honor">Löschen</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#0d1117">
        <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Ehrung</th>
        <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Verliehen am</th>
        <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Status</th>
        <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Hinweis</th>
        <th style="padding:10px 16px;border-bottom:1px solid #21273d"></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function bindHonorActions(userId, openModal) {
  document.querySelectorAll('[data-action="edit-honor"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tr = btn.closest('tr');
      openModal({ id: tr.dataset.hid, name: tr.dataset.name, awarded_at: tr.dataset.awarded, status: tr.dataset.status, notes: tr.dataset.notes });
    });
  });
  document.querySelectorAll('[data-action="delete-honor"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Ehrung löschen?')) return;
      try {
        await api.deletePersonalHonor(userId, btn.closest('tr').dataset.hid);
        toast('Gelöscht');
        const updated = await api.getPersonalHonors(userId);
        document.getElementById('honor-list').innerHTML = updated.length
          ? renderHonorTable(updated)
          : '<div style="padding:16px"><p style="color:#7d8590;font-size:13px">Noch keine Ehrungen eingetragen.</p></div>';
        bindHonorActions(userId, openModal);
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function expiryStatus(expiresAt, warnDays, today) {
  const dot = (color) => `<span class="status-dot" style="background:${color};width:8px;height:8px;border-radius:50%;display:inline-block"></span>`;
  if (!expiresAt) return { statusDot: '', daysLeft: null };
  const exp = new Date(expiresAt); exp.setHours(0,0,0,0);
  const daysLeft = Math.floor((exp - today) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0)         return { statusDot: dot('#e63022'), daysLeft };
  if (daysLeft <= 30)       return { statusDot: dot('#e63022'), daysLeft };
  if (daysLeft <= warnDays) return { statusDot: dot('#f0a500'), daysLeft };
  return { statusDot: dot('#3fb950'), daysLeft };
}

function formatDate(d) {
  if (!d) return '–';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}


// ── Tab: Anwesenheit ──────────────────────────────────────────────────────────

const ATTENDANCE_LABELS = {
  present: { label: 'Anwesend',     color: '#3fb950' },
  absent:  { label: 'Abwesend',     color: '#ff8a80' },
  excused: { label: 'Entschuldigt', color: '#d29922' },
};

function renderAnwesenheit(userId, attendance, member) {
  const wrap = document.getElementById('ptab-panwesenheit');
  if (!wrap) return;

  const memberName = member?.display_name || member?.username || '';

  const renderTable = (entries) => {
    if (!entries.length) return '<p style="color:#7d8590;font-size:13px;padding:16px">Noch keine Einträge vorhanden.</p>';
    return `
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#0d1117">
          <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Datum</th>
          <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Status</th>
          <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Notiz</th>
          <th style="padding:10px 16px;border-bottom:1px solid #21273d"></th>
        </tr></thead>
        <tbody>
          ${entries.map(e => {
            const s = ATTENDANCE_LABELS[e.status] || { label: e.status, color: '#7d8590' };
            return `
              <tr data-aid="${e.id}" style="border-bottom:1px solid #21273d">
                <td style="padding:10px 16px">${formatDate(e.service_date)}</td>
                <td style="padding:10px 16px;color:${s.color};font-weight:600">${s.label}</td>
                <td style="padding:10px 16px;color:#7d8590">${esc(e.notes || '–')}</td>
                <td style="padding:10px 16px">
                  <div class="btn-group">
                    <button class="btn btn--danger btn--sm" data-action="delete-attendance" data-aid="${e.id}">Löschen</button>
                  </div>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  };

  // Statistik berechnen
  const calcStats = (entries) => {
    const total   = entries.length;
    const present = entries.filter(e => e.status === 'present').length;
    const absent  = entries.filter(e => e.status === 'absent').length;
    const excused = entries.filter(e => e.status === 'excused').length;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, excused, pct };
  };

  const renderStats = (entries) => {
    const s = calcStats(entries);
    return `
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">
        <div style="background:#0d1117;border:1px solid #21273d;border-radius:8px;padding:12px 20px;text-align:center;min-width:80px">
          <div style="font-size:22px;font-weight:700">${s.total}</div>
          <div style="font-size:11px;color:#7d8590">Gesamt</div>
        </div>
        <div style="background:#0d1117;border:1px solid #21273d;border-radius:8px;padding:12px 20px;text-align:center;min-width:80px">
          <div style="font-size:22px;font-weight:700;color:#3fb950">${s.present}</div>
          <div style="font-size:11px;color:#7d8590">Anwesend</div>
        </div>
        <div style="background:#0d1117;border:1px solid #21273d;border-radius:8px;padding:12px 20px;text-align:center;min-width:80px">
          <div style="font-size:22px;font-weight:700;color:#ff8a80">${s.absent}</div>
          <div style="font-size:11px;color:#7d8590">Abwesend</div>
        </div>
        <div style="background:#0d1117;border:1px solid #21273d;border-radius:8px;padding:12px 20px;text-align:center;min-width:80px">
          <div style="font-size:22px;font-weight:700;color:#d29922">${s.excused}</div>
          <div style="font-size:11px;color:#7d8590">Entschuldigt</div>
        </div>
        <div style="background:#0d1117;border:1px solid #21273d;border-radius:8px;padding:12px 20px;text-align:center;min-width:80px">
          <div style="font-size:22px;font-weight:700;color:#58a6ff">${s.pct}%</div>
          <div style="font-size:11px;color:#7d8590">Quote</div>
        </div>
      </div>`;
  };

  let currentEntries = [...attendance];

  const rebuild = () => {
    document.getElementById('attendance-stats').innerHTML = renderStats(currentEntries);
    document.getElementById('attendance-list').innerHTML  = renderTable(currentEntries);
    bindDeleteActions();
  };

  wrap.innerHTML = `
    <div class="card">
      <div class="card__header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <span>Dienstbeteiligung</span>
        <div class="btn-group">
          <a class="btn btn--outline btn--sm" href="/api/personal/members/${userId}/attendance/export"
             download="anwesenheit_${esc(memberName)}.csv">CSV Export</a>
          <button class="btn btn--primary btn--sm" id="btn-add-attendance">+ Eintrag hinzufügen</button>
        </div>
      </div>
      <div class="card__body">
        <div id="attendance-stats">${renderStats(currentEntries)}</div>

        <div id="add-attendance-form" style="display:none;background:#0d1117;border:1px solid #21273d;border-radius:8px;padding:16px;margin-bottom:16px">
          <div class="form-grid">
            <div class="form-group">
              <label>Datum</label>
              <input type="date" id="att-date" value="${new Date().toISOString().slice(0,10)}" />
            </div>
            <div class="form-group">
              <label>Status</label>
              <select id="att-status" style="background:#161b27;border:1px solid #21273d;color:#e6edf3;padding:8px;border-radius:6px;width:100%;font-size:13px">
                <option value="present">Anwesend</option>
                <option value="absent">Abwesend</option>
                <option value="excused">Entschuldigt</option>
              </select>
            </div>
            <div class="form-group form-group--full">
              <label>Notiz (optional)</label>
              <input type="text" id="att-notes" maxlength="200" placeholder="z.B. Urlaubsabwesenheit" />
            </div>
          </div>
          <div class="btn-group" style="margin-top:8px">
            <button class="btn btn--primary btn--sm" id="btn-save-attendance">Speichern</button>
            <button class="btn btn--outline btn--sm" id="btn-cancel-attendance">Abbrechen</button>
          </div>
        </div>

        <div id="attendance-list">${renderTable(currentEntries)}</div>
      </div>
    </div>
  `;

  document.getElementById('btn-add-attendance').addEventListener('click', () => {
    document.getElementById('add-attendance-form').style.display = 'block';
    document.getElementById('att-date').focus();
  });

  document.getElementById('btn-cancel-attendance').addEventListener('click', () => {
    document.getElementById('add-attendance-form').style.display = 'none';
  });

  document.getElementById('btn-save-attendance').addEventListener('click', async () => {
    const date   = document.getElementById('att-date').value;
    const status = document.getElementById('att-status').value;
    const notes  = document.getElementById('att-notes').value.trim();
    if (!date) { toast('Datum angeben', 'error'); return; }
    try {
      const entry = await api.createAttendance(userId, { service_date: date, status, notes: notes || null });
      currentEntries.unshift(entry);
      rebuild();
      document.getElementById('add-attendance-form').style.display = 'none';
      document.getElementById('att-notes').value = '';
      toast('Eintrag gespeichert');
    } catch (e) { toast(e.message, 'error'); }
  });

  function bindDeleteActions() {
    document.querySelectorAll('[data-action="delete-attendance"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Eintrag löschen?')) return;
        try {
          await api.deleteAttendance(userId, btn.dataset.aid);
          currentEntries = currentEntries.filter(e => e.id !== btn.dataset.aid);
          rebuild();
          toast('Gelöscht');
        } catch (e) { toast(e.message, 'error'); }
      });
    });
  }

  bindDeleteActions();
}
