import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo, canAccess } from '../shell.js';

export async function renderHome() {
  const [settings, user] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('home');

  const content = document.getElementById('page-content');
  const displayName = user?.display_name || user?.username || '';
  const isAdmin = user?.role === 'admin' || user?.role === 'superuser';

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Willkommen, ${esc(displayName)}</h2>
        <p>${esc(settings?.ff_name || 'FeuerwehrHub')}</p>
      </div>
    </div>

    <div id="announcements-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0;font-size:15px;font-weight:600;color:#e6edf3">Ankündigungen</h3>
        ${isAdmin ? `<button class="btn btn--primary btn--sm" id="btn-new-announcement">+ Neu</button>` : ''}
      </div>
      <div id="announcements-list"><p style="color:#7d8590;font-size:13px">Lade...</p></div>
    </div>

    <div id="dashboard-modules" style="margin-top:32px">
      <h3 style="margin:0 0 12px;font-size:15px;font-weight:600;color:#e6edf3">Meine Module</h3>
      <div class="dashboard-grid" id="module-cards"></div>
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
              style="width:100%;resize:vertical;padding:8px;border:1px solid #21273d;border-radius:8px;font-size:14px;background:#0d1117;color:#e6edf3"
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

  await loadAnnouncements(user, isAdmin);
  renderModuleCards(user, settings?.modules || {});

  if (isAdmin) {
    setupAnnouncementModal(user);
  }
}

// ── Ankündigungen laden & rendern ─────────────────────────────────────────────

async function loadAnnouncements(user, isAdmin) {
  const list = document.getElementById('announcements-list');
  if (!list) return;

  try {
    const items = await api.getAnnouncements();

    if (!items.length) {
      list.innerHTML = `<p style="color:#7d8590;font-size:13px">Keine Ankündigungen vorhanden.</p>`;
      return;
    }

    list.innerHTML = items.map(a => `
      <div class="card announcement-card" data-id="${a.id}" style="margin-bottom:12px">
        <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
          <span>
            ${a.pinned ? '<span style="color:#c0392b;margin-right:6px" title="Angeheftet">📌</span>' : ''}
            <strong>${esc(a.title)}</strong>
          </span>
          <span style="display:flex;align-items:center;gap:12px">
            <span style="font-size:11px;color:#7d8590">
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
        <div class="card__body" style="white-space:pre-wrap;font-size:14px;color:#e6edf3">
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
    list.innerHTML = `<p style="color:#ff8a80;font-size:13px">Fehler: ${e.message}</p>`;
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

// ── Modul-Kacheln ─────────────────────────────────────────────────────────────

function renderModuleCards(user, modules) {
  const grid = document.getElementById('module-cards');
  if (!grid) return;

  const isAdmin = user?.role === 'admin' || user?.role === 'superuser';

  const allModules = [
    { key: 'lager',           icon: '🏪', label: 'Lager',           desc: 'Bestellungen, Artikelstamm',          page: '#/orders', implemented: true },
    { key: 'einsatzberichte', icon: '🚒', label: 'Einsatzberichte', desc: 'Berichte erfassen & verwalten',        page: null,       implemented: false },
    { key: 'fahrzeuge',       icon: '🚗', label: 'Fahrzeuge',       desc: 'TÜV-Fristen, Wartung',                 page: null,       implemented: false },
    { key: 'personal',        icon: '👥', label: 'Personal',        desc: 'Mitglieder, Qualifikationen, Ehrungen', page: '#/personal', implemented: true },
    { key: 'jugendfeuerwehr', icon: '🧒', label: 'Jugendfeuerwehr', desc: 'JF-Mitglieder, Termine',               page: null,       implemented: false },
  ];

  // Für reguläre Benutzer: nur aktive Module mit Berechtigung
  // Für Admins: aktive Module + deaktivierte implementierte Module (als Hinweis) + Demnächst-Module
  const visible = allModules.filter(m => {
    if (!m.implemented) return isAdmin; // Demnächst nur für Admins
    const isActive = modules[m.key] === true;
    if (isActive) return canAccess(user, m.key);
    return isAdmin; // Deaktivierte Module nur für Admins sichtbar
  });

  if (!visible.length) {
    grid.innerHTML = `<p style="color:#7d8590;font-size:13px">Keine Module verfügbar. Wende dich an deinen Administrator.</p>`;
    return;
  }

  grid.innerHTML = visible.map(m => {
    const isActive = modules[m.key] === true;
    const isClickable = m.implemented && isActive && m.page;
    let badge = '';
    if (!m.implemented) badge = `<div class="dashboard-card__soon">Demnächst</div>`;
    else if (!isActive) badge = `<div class="dashboard-card__soon">Deaktiviert</div>`;

    return `
      <div class="dashboard-card ${isClickable ? 'dashboard-card--active' : 'dashboard-card--soon'}"
        ${isClickable ? `data-page="${m.page}"` : ''}>
        <div class="dashboard-card__icon">${m.icon}</div>
        <div class="dashboard-card__label">${m.label}</div>
        <div class="dashboard-card__desc">${m.desc}</div>
        ${badge}
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.dashboard-card--active[data-page]').forEach(card => {
    card.addEventListener('click', () => {
      window.location.hash = card.dataset.page;
    });
  });
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
