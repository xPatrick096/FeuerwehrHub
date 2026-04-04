import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo, canAccess } from '../shell.js';
import { esc } from '../utils.js';
import { icon, renderIcons } from '../icons.js';

export async function renderHome() {
  const [settings, user] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('home');

  const content = document.getElementById('page-content');
  const displayName = user?.display_name || user?.username || '';
  const isAdmin = user?.role === 'admin' || user?.role === 'superuser';
  const modules = settings?.modules || {};

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Willkommen, ${esc(displayName)}</h2>
        <p>${esc(settings?.ff_name || 'FeuerwehrHub')}</p>
      </div>
    </div>

    <div id="announcements-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0;font-size:15px;font-weight:600;color:var(--text)">Ankündigungen</h3>
        ${isAdmin ? `<button class="btn btn--primary btn--sm" id="btn-new-announcement">+ Neu</button>` : ''}
      </div>
      <div id="announcements-list"><p class="text-muted text-sm">Lade...</p></div>
    </div>

    ${modules.verein ? `
    <div id="schwarzesbrett-section" style="margin-top:2rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0;font-size:15px;font-weight:600;color:var(--text)">${icon('clipboard-list', 14)} Schwarzes Brett</h3>
        <a href="#/verein" style="font-size:12px;color:var(--text-muted);text-decoration:none">Verwalten →</a>
      </div>
      <div id="schwarzesbrett-list"><p class="text-muted text-sm">Lade...</p></div>
    </div>` : ''}

    <div class="widget-grid" id="widget-grid">
      <div id="vehicle-widget" class="widget-card widget-card--fahrzeuge" style="display:none">
        <div class="widget-card__header">
          <h3>${icon('truck', 15)} Fahrzeuge</h3>
          <a href="#/vehicles">Alle anzeigen →</a>
        </div>
        <div class="widget-card__body" id="vehicle-widget-content">
          <p class="text-muted text-sm">Lade...</p>
        </div>
      </div>

      <div id="incident-widget" class="widget-card widget-card--einsatzberichte" style="display:none">
        <div class="widget-card__header">
          <h3>${icon('siren', 15)} Einsatzberichte</h3>
          <a href="#/incidents">Alle anzeigen →</a>
        </div>
        <div class="widget-card__body" id="incident-widget-content">
          <p class="text-muted text-sm">Lade...</p>
        </div>
      </div>

      <div id="personal-widget" class="widget-card widget-card--personal" style="display:none">
        <div class="widget-card__header">
          <h3>${icon('users', 15)} Personal</h3>
          <a href="#/personal">Alle anzeigen →</a>
        </div>
        <div class="widget-card__body" id="personal-widget-content">
          <p class="text-muted text-sm">Lade...</p>
        </div>
      </div>

      <div id="termine-widget" class="widget-card widget-card--termine" style="display:none">
        <div class="widget-card__header">
          <h3>${icon('calendar', 15)} Termine</h3>
          <a href="#/termine">Alle anzeigen →</a>
        </div>
        <div class="widget-card__body" id="termine-widget-content">
          <p class="text-muted text-sm">Lade...</p>
        </div>
      </div>
    </div>

    ${isAdmin ? `
    <!-- Modal: Ankündigung erstellen/bearbeiten -->
    <div id="modal-announcement" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3 id="modal-announcement-title">Ankündigung erstellen</h3>
          <button class="modal__close" id="btn-close-announcement">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label>Titel</label>
            <input type="text" id="ann-title" placeholder="z.B. Übung nächste Woche" />
          </div>
          <div class="form-group">
            <label>Inhalt</label>
            <textarea id="ann-content" rows="5"
              style="width:100%;resize:vertical;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg-card-hover);color:var(--text)"
              placeholder="Nachricht..."></textarea>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" id="ann-pinned" />
              Ankündigung anheften (erscheint immer oben)
            </label>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-announcement">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-announcement">Abbrechen</button>
        </div>
      </div>
    </div>
    ` : ''}
  `;

  renderIcons(content);
  await loadAnnouncements(user, isAdmin);

  if (isAdmin || (modules.fahrzeuge === true && canAccess(user, 'fahrzeuge'))) {
    loadVehicleWidget();
  }
  if (isAdmin || (modules.personal === true && canAccess(user, 'personal'))) {
    loadPersonalWidget();
  }
  // Termine-Widget für alle eingeloggten Nutzer
  loadTermineWidget(modules);
  if (isAdmin || (modules.einsatzberichte === true && canAccess(user, 'einsatzberichte'))) {
    loadIncidentWidget();
  }

  if (isAdmin) {
    setupAnnouncementModal(user);
  }

  if (modules.verein) {
    loadSchwarztesBrett(isAdmin);
  }
}

// ── Ankündigungen laden & rendern ─────────────────────────────────────────────

async function loadAnnouncements(user, isAdmin) {
  const list = document.getElementById('announcements-list');
  if (!list) return;

  try {
    const items = await api.getAnnouncements();

    if (!items.length) {
      list.innerHTML = `<p class="text-muted text-sm">Keine Ankündigungen vorhanden.</p>`;
      return;
    }

    list.innerHTML = items.map(a => `
      <div class="card announcement-card" data-id="${a.id}" style="margin-bottom:12px">
        <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
          <span>
            ${a.pinned ? `<span style="color:var(--rot);margin-right:6px" title="Angeheftet">${icon('pin', 13)}</span>` : ''}
            <strong>${esc(a.title)}</strong>
          </span>
          <span style="display:flex;align-items:center;gap:12px">
            <span class="text-muted text-xs">
              ${esc(a.created_by_name)} · ${formatDate(a.created_at)}
            </span>
            ${isAdmin ? `
              <div class="btn-group">
                <button class="btn btn--outline btn--sm" data-action="edit-ann"
                  data-id="${a.id}" data-title="${esc(a.title)}"
                  data-content="${esc(a.content)}" data-pinned="${a.pinned}">Bearbeiten</button>
                <button class="btn btn--danger btn--sm" data-action="delete-ann"
                  data-id="${a.id}">Löschen</button>
              </div>
            ` : ''}
          </span>
        </div>
        <div class="card__body" style="white-space:pre-wrap;font-size:14px;color:var(--text)">
          ${esc(a.content)}
        </div>
      </div>
    `).join('');

    if (isAdmin) {
      list.querySelectorAll('[data-action="delete-ann"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Ankündigung wirklich löschen?')) return;
          try {
            await api.deleteAnnouncement(btn.dataset.id);
            toast('Ankündigung gelöscht');
            await loadAnnouncements(user, isAdmin);
          } catch (e) { toast(e.message, 'error'); }
        });
      });

      list.querySelectorAll('[data-action="edit-ann"]').forEach(btn => {
        btn.addEventListener('click', () => {
          openAnnouncementModal({
            id: btn.dataset.id,
            title: btn.dataset.title,
            content: btn.dataset.content,
            pinned: btn.dataset.pinned === 'true',
          }, user, isAdmin);
        });
      });
    }
  } catch (e) {
    list.innerHTML = `<p class="error-msg">Fehler: ${e.message}</p>`;
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

let editTarget = null;

function setupAnnouncementModal(user) {
  const isAdmin = true;

  document.getElementById('btn-new-announcement')?.addEventListener('click', () => {
    openAnnouncementModal(null, user, isAdmin);
  });

  const close = () => {
    document.getElementById('modal-announcement').style.display = 'none';
    document.getElementById('ann-title').value = '';
    document.getElementById('ann-content').value = '';
    document.getElementById('ann-pinned').checked = false;
    editTarget = null;
  };

  document.getElementById('btn-close-announcement').addEventListener('click', close);
  document.getElementById('btn-cancel-announcement').addEventListener('click', close);

  document.getElementById('btn-submit-announcement').addEventListener('click', async () => {
    const title   = document.getElementById('ann-title').value.trim();
    const content = document.getElementById('ann-content').value.trim();
    const pinned  = document.getElementById('ann-pinned').checked;

    if (!title)   { toast('Titel eingeben', 'error'); return; }
    if (!content) { toast('Inhalt eingeben', 'error'); return; }

    try {
      if (editTarget) {
        await api.updateAnnouncement(editTarget, { title, content, pinned });
        toast('Ankündigung gespeichert');
      } else {
        await api.createAnnouncement({ title, content, pinned });
        toast('Ankündigung erstellt');
      }
      close();
      await loadAnnouncements(user, true);
    } catch (e) { toast(e.message, 'error'); }
  });
}

function openAnnouncementModal(ann, user, isAdmin) {
  editTarget = ann?.id || null;
  document.getElementById('modal-announcement-title').textContent =
    ann ? 'Ankündigung bearbeiten' : 'Ankündigung erstellen';
  document.getElementById('ann-title').value   = ann?.title   || '';
  document.getElementById('ann-content').value = ann?.content || '';
  document.getElementById('ann-pinned').checked = ann?.pinned || false;
  document.getElementById('modal-announcement').style.display = 'flex';
  document.getElementById('ann-title').focus();
}

// ── Fahrzeuge-Widget ──────────────────────────────────────────────────────────

async function loadVehicleWidget() {
  const widget  = document.getElementById('vehicle-widget');
  const content = document.getElementById('vehicle-widget-content');
  if (!widget || !content) return;

  widget.style.display = 'flex';
  widget.style.flexDirection = 'column';

  try {
    const s = await api.getVehicleStats();

    const tile = (value, label, color) => `
      <div class="stat-tile">
        <div class="stat-tile__value" style="color:${color}">${value}</div>
        <div class="stat-tile__label">${label}</div>
      </div>`;

    const overdueColor = s.inspections_overdue > 0 ? 'var(--rot)' : 'var(--gruen)';
    const soonColor    = s.inspections_soon    > 0 ? 'var(--gelb)' : 'var(--gruen)';

    content.innerHTML = `
      <div class="stat-tiles">
        ${tile(s.active,              'Einsatzbereit',      'var(--gruen)')}
        ${tile(s.inspections_overdue, 'Fristen überfällig', overdueColor)}
        ${tile(s.inspections_soon,    'Fristen bald fällig',soonColor)}
      </div>`;
  } catch (_) {
    widget.style.display = 'none';
    widget.style.flexDirection = '';
  }
}

// ── Personal-Widget ───────────────────────────────────────────────────────────

async function loadPersonalWidget() {
  const widget  = document.getElementById('personal-widget');
  const content = document.getElementById('personal-widget-content');
  if (!widget || !content) return;

  widget.style.display = 'flex';
  widget.style.flexDirection = 'column';

  try {
    const s = await api.getPersonalStats();

    const tile = (value, label, color) => `
      <div class="stat-tile">
        <div class="stat-tile__value" style="color:${color}">${value}</div>
        <div class="stat-tile__label">${label}</div>
      </div>`;

    const warn30Color = s.qualifications_expiring_30 > 0 ? 'var(--rot)' : 'var(--gruen)';
    const g263Color   = s.g263_expiring_90           > 0 ? 'var(--gelb)' : 'var(--gruen)';

    content.innerHTML = `
      <div class="stat-tiles">
        ${tile(s.active_members,             'Aktive Mitglieder',          'var(--text)')}
        ${tile(s.qualifications_expiring_30, 'Quali. ablaufend (30 Tage)', warn30Color)}
        ${tile(s.g263_expiring_90,           'G26.3 ablaufend (90 Tage)',  g263Color)}
      </div>`;
  } catch (_) {
    widget.style.display = 'none';
    widget.style.flexDirection = '';
  }
}

// ── Einsatz-Widget ────────────────────────────────────────────────────────────

async function loadIncidentWidget() {
  const widget  = document.getElementById('incident-widget');
  const content = document.getElementById('incident-widget-content');
  if (!widget || !content) return;

  widget.style.display = 'flex';
  widget.style.flexDirection = 'column';

  try {
    const s = await api.getIncidentStats();

    const tile = (value, label, color) => `
      <div class="stat-tile">
        <div class="stat-tile__value" style="color:${color}">${value}</div>
        <div class="stat-tile__label">${label}</div>
      </div>`;

    const entwurfColor = s.entwurf > 0 ? 'var(--gelb)' : 'var(--gruen)';

    content.innerHTML = `
      <div class="stat-tiles">
        ${tile(s.total,   `Einsätze ${s.year}`, 'var(--text)')}
        ${tile(s.brand,   'Brand',               'var(--rot)')}
        ${tile(s.entwurf, 'Entwürfe offen',      entwurfColor)}
      </div>`;
  } catch (_) {
    widget.style.display = 'none';
    widget.style.flexDirection = '';
  }
}

// ── Termine-Widget ────────────────────────────────────────────────────────────

async function loadTermineWidget(modules = {}) {
  const widget  = document.getElementById('termine-widget');
  const content = document.getElementById('termine-widget-content');
  if (!widget || !content) return;

  widget.style.display = 'flex';
  widget.style.flexDirection = 'column';

  try {
    const fetches = [api.getMyTermine()];
    if (modules.verein) fetches.push(api.getEvents().catch(() => []));
    const [myTermine, vereinEvents] = await Promise.all(fetches);

    const vereinNorm = (vereinEvents || []).map(e => ({
      id: e.id,
      title: e.titel,
      location: e.ort || null,
      start_at: e.datum + 'T' + (e.uhrzeit ? e.uhrzeit + ':00' : '00:00:00'),
      typ_color: null,
      _source: 'verein',
    }));

    const now     = new Date();
    const upcoming = [...myTermine, ...vereinNorm]
      .filter(t => new Date(t.start_at) >= now)
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
      .slice(0, 5);

    if (!upcoming.length) {
      content.innerHTML = `<p style="color:var(--text-muted);font-size:13px;margin:0">Keine bevorstehenden Termine.</p>`;
      return;
    }

    content.innerHTML = upcoming.map(t => {
      const d = new Date(t.start_at);
      const colorDot = t._source === 'verein'
        ? `<span style="display:inline-block;padding:1px 5px;border-radius:999px;font-size:9px;font-weight:600;background:var(--bg-card-hover);color:var(--text-muted);margin-right:5px;flex-shrink:0">Verein</span>`
        : t.typ_color
          ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${t.typ_color};margin-right:5px;flex-shrink:0"></span>`
          : '';
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="min-width:40px;text-align:center;background:var(--bg-card-hover);border-radius:5px;padding:4px 6px;flex-shrink:0">
            <div style="font-size:14px;font-weight:700;line-height:1">${String(d.getDate()).padStart(2,'0')}</div>
            <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase">${d.toLocaleDateString('de-DE',{month:'short'})}</div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${colorDot}${esc(t.title)}
            </div>
            <div style="color:var(--text-muted);font-size:11px;margin-top:1px">
              ${d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})} Uhr
              ${t.location ? ` · ${esc(t.location)}` : ''}
            </div>
          </div>
        </div>`;
    }).join('');

    renderIcons(widget);
  } catch (_) {
    widget.style.display = 'none';
    widget.style.flexDirection = '';
  }
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────


function formatDate(iso) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ── Schwarzes Brett Widget ────────────────────────────────────────────────────

async function loadSchwarztesBrett(isAdmin) {
  const list = document.getElementById('schwarzesbrett-list');
  if (!list) return;
  try {
    const posts = await api.getVereinPosts();
    if (!posts?.length) {
      list.innerHTML = `<p class="text-muted text-sm">Keine Beiträge vorhanden.</p>`;
      return;
    }
    list.innerHTML = posts.map(p => `
      <div class="card announcement-card" style="margin-bottom:12px">
        <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
          <span>
            ${p.pinned ? `<span style="color:var(--gelb-dunkel);margin-right:6px">${icon('pin', 13)}</span>` : ''}
            <strong>${esc(p.title)}</strong>
            ${p.visibility === 'vorstand' && isAdmin ? `<span class="badge badge--orange" style="margin-left:8px">Nur Vorstand</span>` : ''}
          </span>
          <span class="text-muted text-xs">
            ${p.expires_at ? `Bis ${p.expires_at} · ` : ''}${esc(p.created_by_name)}
          </span>
        </div>
        <div class="card__body" style="white-space:pre-wrap;font-size:14px;color:var(--text)">
          ${esc(p.content)}
        </div>
      </div>
    `).join('');
    renderIcons(list);
  } catch (e) {
    list.innerHTML = `<p class="error-msg">Fehler: ${esc(e.message)}</p>`;
  }
}
