import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';

const EQUIPMENT_LABELS = {
  pager:           '📟 Pager',
  key:             '🔑 Schlüssel',
  transponder:     '💳 Transponder',
  id_card:         '🪪 Dienstausweis',
  driving_permit:  '🚒 Fahrberechtigung',
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

    <div class="tab-bar" style="display:flex;gap:4px;margin-bottom:24px;border-bottom:1px solid #21273d;padding-bottom:0">
      <button class="tab-btn active" data-tab="profile"          style="padding:8px 16px;background:none;border:none;border-bottom:2px solid transparent;color:#7d8590;cursor:pointer;font-size:13px;font-weight:600;margin-bottom:-1px">👤 Mein Profil</button>
      <button class="tab-btn"        data-tab="qualifications"   style="padding:8px 16px;background:none;border:none;border-bottom:2px solid transparent;color:#7d8590;cursor:pointer;font-size:13px;font-weight:600;margin-bottom:-1px">🎓 Qualifikationen</button>
      <button class="tab-btn"        data-tab="equipment"        style="padding:8px 16px;background:none;border:none;border-bottom:2px solid transparent;color:#7d8590;cursor:pointer;font-size:13px;font-weight:600;margin-bottom:-1px">🔧 Ausrüstung</button>
      <button class="tab-btn"        data-tab="appointments"     style="padding:8px 16px;background:none;border:none;border-bottom:2px solid transparent;color:#7d8590;cursor:pointer;font-size:13px;font-weight:600;margin-bottom:-1px">📅 Termine</button>
    </div>

    <div id="tab-profile"></div>
    <div id="tab-qualifications" style="display:none"></div>
    <div id="tab-equipment"      style="display:none"></div>
    <div id="tab-appointments"   style="display:none"></div>
  `;

  // Tab-Logik
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.style.color = '#7d8590';
        b.style.borderBottomColor = 'transparent';
      });
      btn.style.color = '#e6edf3';
      btn.style.borderBottomColor = '#e63022';
      document.querySelectorAll('[id^="tab-"]').forEach(t => t.style.display = 'none');
      document.getElementById(`tab-${btn.dataset.tab}`).style.display = 'block';
    });
  });
  // Ersten Tab aktiv stylen
  const firstTab = document.querySelector('.tab-btn.active');
  if (firstTab) {
    firstTab.style.color = '#e6edf3';
    firstTab.style.borderBottomColor = '#e63022';
  }

  loadProfileTab(user);
  loadQualificationsTab();
  loadEquipmentTab();
  loadAppointmentsTab();
}

// ── Tab: Mein Profil ──────────────────────────────────────────────────────────

async function loadProfileTab(user) {
  const wrap = document.getElementById('tab-profile');
  wrap.innerHTML = '<p style="color:#7d8590;font-size:13px">Lade...</p>';

  try {
    const profile = await api.getMyProfile();

    wrap.innerHTML = `
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
          <p style="font-size:12px;color:#7d8590;margin-top:8px">Benutzername und Anzeigename können unter <a href="#/settings" style="color:#e63022">Einstellungen</a> geändert werden.</p>
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
        <div class="card__header">Notfallkontakt</div>
        <div class="card__body">
          <p style="font-size:13px;color:#7d8590;margin-bottom:16px">
            Wird im Einsatzfall benötigt — wird nur von Führungskräften eingesehen.
          </p>
          <div class="form-grid">
            <div class="form-group">
              <label>Name</label>
              <input type="text" id="p-emergency-name" maxlength="100" value="${esc(profile?.emergency_contact_name || '')}" placeholder="Maria Mustermann" />
            </div>
            <div class="form-group">
              <label>Telefon</label>
              <input type="tel" id="p-emergency-phone" maxlength="30" value="${esc(profile?.emergency_contact_phone || '')}" placeholder="0170 9876543" />
            </div>
          </div>
          <div class="btn-group" style="margin-top:16px">
            <button class="btn btn--primary" id="btn-save-emergency">Notfallkontakt speichern</button>
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

    document.getElementById('btn-save-emergency').addEventListener('click', async () => {
      try {
        await api.updateMyProfile({
          phone:         profile?.phone || null,
          email_private: profile?.email_private || null,
          address:       profile?.address || null,
          emergency_contact_name:  document.getElementById('p-emergency-name').value.trim() || null,
          emergency_contact_phone: document.getElementById('p-emergency-phone').value.trim() || null,
        });
        toast('Notfallkontakt gespeichert');
      } catch (e) { toast(e.message, 'error'); }
    });

  } catch (e) {
    wrap.innerHTML = `<p style="color:#ff8a80">${esc(e.message)}</p>`;
  }
}

// ── Tab: Qualifikationen ──────────────────────────────────────────────────────

async function loadQualificationsTab() {
  const wrap = document.getElementById('tab-qualifications');
  wrap.innerHTML = '<p style="color:#7d8590;font-size:13px">Lade...</p>';

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
            <p style="color:#7d8590;font-size:13px">Noch keine Qualifikationen hinterlegt. Der Wehrleiter kann diese im Personal-Modul eintragen.</p>
          </div>
        </div>`;
      return;
    }

    const rows = qualifications.map(q => {
      const { icon, label, daysLeft } = expiryStatus(q.expires_at, warnDays, today);
      const expiryText = q.expires_at
        ? `${icon} ${formatDate(q.expires_at)}${daysLeft !== null ? ` (${daysLeft < 0 ? 'abgelaufen' : `noch ${daysLeft} Tage`})` : ''}`
        : '<span style="color:#7d8590">–</span>';

      return `
        <tr>
          <td><strong>${esc(q.name)}</strong></td>
          <td>${q.acquired_at ? formatDate(q.acquired_at) : '<span style="color:#7d8590">–</span>'}</td>
          <td>${expiryText}</td>
          <td>${q.notes ? esc(q.notes) : '<span style="color:#7d8590">–</span>'}</td>
        </tr>`;
    }).join('');

    wrap.innerHTML = `
      <div class="card">
        <div class="card__header">Meine Qualifikationen</div>
        <div class="card__body" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#0d1117;text-align:left">
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d">Qualifikation</th>
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d">Erworben</th>
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d">Gültig bis</th>
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d">Hinweis</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
      <p style="font-size:12px;color:#7d8590;margin-top:12px">
        🟢 Gültig &nbsp;|&nbsp; 🟡 Läuft in ${warnDays} Tagen ab &nbsp;|&nbsp; 🔴 Abgelaufen oder kritisch
      </p>
    `;

    // Tabellenzeilen stylen
    wrap.querySelectorAll('tbody tr').forEach((tr, i) => {
      tr.style.borderBottom = '1px solid #21273d';
      tr.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
    });

  } catch (e) {
    wrap.innerHTML = `<p style="color:#ff8a80">${esc(e.message)}</p>`;
  }
}

// ── Tab: Ausrüstung ───────────────────────────────────────────────────────────

async function loadEquipmentTab() {
  const wrap = document.getElementById('tab-equipment');
  wrap.innerHTML = '<p style="color:#7d8590;font-size:13px">Lade...</p>';

  try {
    const equipment = await api.getMyEquipment();

    if (!equipment.length) {
      wrap.innerHTML = `
        <div class="card">
          <div class="card__body">
            <p style="color:#7d8590;font-size:13px">Noch keine Ausrüstung / Ausweise hinterlegt. Diese werden vom Gerätewart oder Wehrleiter eingetragen.</p>
          </div>
        </div>`;
      return;
    }

    const cards = equipment.map(e => `
      <div style="background:#161b27;border:1px solid #21273d;border-radius:8px;padding:16px">
        <div style="font-size:15px;font-weight:700;margin-bottom:8px">${EQUIPMENT_LABELS[e.type] || esc(e.type)}</div>
        ${e.identifier ? `<div style="font-size:13px;color:#e6edf3;margin-bottom:4px">Nr./Bezeichnung: <strong>${esc(e.identifier)}</strong></div>` : ''}
        ${e.issued_at  ? `<div style="font-size:12px;color:#7d8590">Ausgestellt: ${formatDate(e.issued_at)}</div>` : ''}
        ${e.expires_at ? `<div style="font-size:12px;color:#7d8590">Gültig bis: ${formatDate(e.expires_at)}</div>` : ''}
        ${e.notes      ? `<div style="font-size:12px;color:#7d8590;margin-top:6px">${esc(e.notes)}</div>` : ''}
      </div>
    `).join('');

    wrap.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
        ${cards}
      </div>
      <p style="font-size:12px;color:#7d8590;margin-top:16px">Ausrüstung und Ausweise werden vom Gerätewart oder Wehrleiter gepflegt.</p>
    `;

  } catch (e) {
    wrap.innerHTML = `<p style="color:#ff8a80">${esc(e.message)}</p>`;
  }
}

// ── Tab: Termine ──────────────────────────────────────────────────────────────

function loadAppointmentsTab() {
  document.getElementById('tab-appointments').innerHTML = `
    <div class="card">
      <div class="card__body" style="text-align:center;padding:40px 20px">
        <div style="font-size:32px;margin-bottom:12px">📅</div>
        <p style="color:#7d8590;font-size:14px">Das Terminmodul ist noch nicht verfügbar.</p>
        <p style="color:#4c5462;font-size:12px;margin-top:8px">Kommt in einer zukünftigen Version.</p>
      </div>
    </div>
  `;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function expiryStatus(expiresAt, warnDays, today) {
  if (!expiresAt) return { icon: '', label: 'ok', daysLeft: null };
  const exp = new Date(expiresAt);
  exp.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((exp - today) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0)        return { icon: '🔴', label: 'abgelaufen', daysLeft };
  if (daysLeft <= 30)      return { icon: '🔴', label: 'kritisch', daysLeft };
  if (daysLeft <= warnDays) return { icon: '🟡', label: 'warnung', daysLeft };
  return { icon: '🟢', label: 'ok', daysLeft };
}

function formatDate(dateStr) {
  if (!dateStr) return '–';
  const d = new Date(dateStr);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
