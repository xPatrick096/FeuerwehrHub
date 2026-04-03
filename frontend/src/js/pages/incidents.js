import { api } from '../api.js';
import { toast } from '../toast.js';
import { navigate } from '../router.js';
import { renderShell, setShellInfo } from '../shell.js';
import { esc } from '../utils.js';
import {
  STATUS_LABELS, STATUS_COLORS,
  buildTabsHTML, buildTypeDropdown, buildTypeFilter,
  buildResourcesGrid, setupTabs, fillForm, setFormReadonly,
} from './incident-form.js';
import { loadVehiclesTab, loadPersonnelTab, loadAttachmentsTab } from './incident-tabs.js';

// ── State ─────────────────────────────────────────────────────────────────────

let _user    = null;
let _types   = [];
let _mods    = {};
let _filters = { year: new Date().getFullYear(), type_key: '', status: '', page: 1 };
let _editId  = null;

// ── Hauptseite ────────────────────────────────────────────────────────────────

export async function renderIncidents() {
  const [settings, user] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('incidents');
  _user = user;
  _mods = settings?.modules || {};

  const isAdmin    = user?.role === 'admin' || user?.role === 'superuser';
  const perms      = user?.permissions || [];
  const canApprove = isAdmin || perms.includes('einsatzberichte.approve');
  const canCreate  = isAdmin || perms.includes('einsatzberichte') || canApprove;

  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div><h2>Einsatzberichte</h2><p>Verwaltung und Dokumentation</p></div>
      ${canCreate ? `<button class="btn btn--primary" id="btn-new-incident">+ Neuer Bericht</button>` : ''}
    </div>

    <div class="filter-bar" style="margin-bottom:16px">
      <select id="filter-year" style="min-width:90px"></select>
      <select id="filter-type"><option value="">Alle Einsatzarten</option></select>
      <select id="filter-status">
        <option value="">Alle Status</option>
        <option value="entwurf">Entwurf</option>
        <option value="freigegeben">Freigegeben</option>
        <option value="archiviert">Archiviert</option>
      </select>
    </div>

    <div id="stats-row" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px"></div>
    <div id="incident-table-wrap"></div>

    <!-- Modal: Anzeigen / Bearbeiten -->
    <div id="modal-incident" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box" style="max-width:900px;width:100%;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal__header" style="flex-shrink:0">
          <h3 id="modal-incident-title">Einsatzbericht</h3>
          <button class="modal__close" id="btn-close-modal">✕</button>
        </div>
        <div style="flex-shrink:0">
          ${buildTabsHTML('padding:0 24px', { showVehicles: !!_mods.fahrzeuge, showPersonnel: !!_mods.personal, showAttachments: true })}
        </div>
        <div class="modal__body" style="overflow-y:auto;flex:1" id="modal-body-scroll">
          <!-- Tab-Panels werden via buildTabsHTML injiziert, aber im Modal überschreiben wir den Wrapper -->
        </div>
        <div class="modal__footer" style="flex-shrink:0" id="modal-footer"></div>
      </div>
    </div>
  `;

  // Das buildTabsHTML hat Panels innerhalb des modal__box divs gerendert,
  // wir müssen die Panels in den scroll-container verschieben
  const box = document.querySelector('#modal-incident .modal__box');
  const scrollWrap = document.getElementById('modal-body-scroll');
  box.querySelectorAll('.incident-tab-panel').forEach(p => scrollWrap.appendChild(p));

  // Jahresfilter
  const yearSel = document.getElementById('filter-year');
  const curYear = new Date().getFullYear();
  for (let y = curYear; y >= curYear - 10; y--) {
    const opt = document.createElement('option');
    opt.value = y; opt.textContent = y;
    if (y === _filters.year) opt.selected = true;
    yearSel.appendChild(opt);
  }

  // Einsatzarten laden
  try {
    _types = await api.getIncidentTypes();
    buildTypeFilter(document.getElementById('filter-type'), _types);
  } catch (_) {}

  setupTabs(document.getElementById('modal-incident'));

  // Events
  yearSel.addEventListener('change', () => { _filters.year = +yearSel.value; _filters.page = 1; _load(); });
  document.getElementById('filter-type').addEventListener('change', e => { _filters.type_key = e.target.value; _filters.page = 1; _load(); });
  document.getElementById('filter-status').addEventListener('change', e => { _filters.status = e.target.value; _filters.page = 1; _load(); });

  document.getElementById('btn-new-incident')?.addEventListener('click', () => navigate('#/new-incident'));
  document.getElementById('btn-close-modal').addEventListener('click', _closeModal);
  document.querySelector('#modal-incident .modal__backdrop').addEventListener('click', _closeModal);

  await _load();
  _loadStats();
}

// ── Laden ─────────────────────────────────────────────────────────────────────

async function _load() {
  const wrap = document.getElementById('incident-table-wrap');
  wrap.innerHTML = `<p style="color:#7d8590;font-size:13px">Lade...</p>`;
  try {
    const data = await api.getIncidents(_filters);
    _renderTable(data);
  } catch (e) {
    wrap.innerHTML = `<p style="color:#ff8a80;font-size:13px">Fehler: ${esc(e.message)}</p>`;
  }
}

async function _loadStats() {
  try {
    const s   = await api.getIncidentStats(_filters.year);
    const row = document.getElementById('stats-row');
    if (!row) return;
    const tile = (v, l, c) =>
      `<div style="background:#161b27;border:1px solid #21273d;border-radius:10px;padding:12px 16px;min-width:90px;flex:1">
        <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
        <div style="font-size:11px;color:#7d8590;margin-top:2px">${l}</div>
      </div>`;
    row.innerHTML =
      tile(s.total,     'Gesamt',         '#e6edf3') +
      tile(s.brand,     'Brand',          '#e63022') +
      tile(s.thl,       'THL',            '#f0a500') +
      tile(s.fehlalarm, 'Fehlalarm',      '#7d8590') +
      tile(s.sonstiges, 'Sonstiges',      '#7d8590') +
      tile(s.entwurf,   'Entwürfe offen', s.entwurf > 0 ? '#f0a500' : '#3fb950');
  } catch (_) {}
}

// ── Tabelle ───────────────────────────────────────────────────────────────────

function _renderTable({ items, total, page, per_page }) {
  const wrap      = document.getElementById('incident-table-wrap');
  const isAdmin    = _user?.role === 'admin' || _user?.role === 'superuser';
  const perms      = _user?.permissions || [];

  if (!items.length) {
    wrap.innerHTML = `<p style="color:#7d8590;font-size:13px;padding:20px 0">Keine Einsatzberichte gefunden.</p>`;
    return;
  }

  const totalPages = Math.ceil(total / per_page);

  wrap.innerHTML = `
    <div style="overflow-x:auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nr.</th><th>Datum</th><th>Art</th><th>Ort</th>
            <th>Einsatzleiter</th><th>Stärke</th><th>Status</th><th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(r => `
            <tr>
              <td style="font-size:12px;color:#7d8590">${esc(r.incident_number || '—')}</td>
              <td>${_fmtDate(r.incident_date)}</td>
              <td>${esc(r.incident_type_label)}</td>
              <td>${esc(r.location)}</td>
              <td>${esc(r.incident_commander || '—')}</td>
              <td style="font-size:12px">${r.strength_leadership}/${r.strength_sub}/${r.strength_crew}</td>
              <td>
                <span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;
                  background:${STATUS_COLORS[r.status]}22;color:${STATUS_COLORS[r.status]}">
                  ${STATUS_LABELS[r.status] || r.status}
                </span>
              </td>
              <td>
                <div class="btn-group">
                  <button class="btn btn--outline btn--sm" data-action="view" data-id="${r.id}">Anzeigen</button>
                  ${_canEdit(r, isAdmin, perms) ? `<button class="btn btn--outline btn--sm" data-action="edit" data-id="${r.id}">Bearbeiten</button>` : ''}
                  ${_canDelete(r, isAdmin, perms) ? `<button class="btn btn--danger btn--sm" data-action="delete" data-id="${r.id}">Löschen</button>` : ''}
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${totalPages > 1 ? `
      <div style="display:flex;justify-content:center;gap:8px;margin-top:16px;align-items:center">
        <button class="btn btn--outline btn--sm" id="pg-prev" ${page <= 1 ? 'disabled' : ''}>← Zurück</button>
        <span style="font-size:13px;color:#7d8590">Seite ${page} / ${totalPages} (${total})</span>
        <button class="btn btn--outline btn--sm" id="pg-next" ${page >= totalPages ? 'disabled' : ''}>Weiter →</button>
      </div>` : ''}
  `;

  wrap.querySelectorAll('[data-action="view"]').forEach(b =>
    b.addEventListener('click', () => _openModal(b.dataset.id, true)));
  wrap.querySelectorAll('[data-action="edit"]').forEach(b =>
    b.addEventListener('click', () => {
      sessionStorage.setItem('edit_incident_id', b.dataset.id);
      navigate('#/edit-incident');
    }));
  wrap.querySelectorAll('[data-action="delete"]').forEach(b =>
    b.addEventListener('click', () => _delete(b.dataset.id)));

  document.getElementById('pg-prev')?.addEventListener('click', () => { _filters.page--; _load(); });
  document.getElementById('pg-next')?.addEventListener('click', () => { _filters.page++; _load(); });
}

function _canEdit(r, isAdmin, perms) {
  if (isAdmin) return true;
  const canApprove = perms.includes('einsatzberichte.approve');
  if (r.status === 'entwurf') return r.created_by === _user?.id || canApprove;
  return false;
}

function _canDelete(r, isAdmin, perms) {
  if (isAdmin) return true;
  const canApprove = perms.includes('einsatzberichte.approve');
  if (r.status === 'entwurf') return r.created_by === _user?.id || canApprove;
  if (r.status === 'freigegeben' || r.status === 'archiviert') return canApprove;
  return false;
}

// ── Modal (Anzeigen / Bearbeiten) ─────────────────────────────────────────────

async function _openModal(id, viewOnly) {
  _editId = id;
  const modal  = document.getElementById('modal-incident');
  const title  = document.getElementById('modal-incident-title');
  const footer = document.getElementById('modal-footer');

  title.textContent = 'Lade...';
  modal.style.display = 'flex';

  try {
    const r         = await api.getIncident(id);
    const isAdmin    = _user?.role === 'admin' || _user?.role === 'superuser';
    const perms      = _user?.permissions || [];
    const canApprove = isAdmin || perms.includes('einsatzberichte.approve');

    title.textContent = `${r.incident_number || r.id.slice(0,8)} — ${r.incident_type_label}`;

    fillForm(r);
    buildTypeDropdown(document.getElementById('ir-type'), _types, r.incident_type_key);
    buildResourcesGrid('resources-grid', r.resources, viewOnly);
    setFormReadonly(viewOnly, document.getElementById('modal-incident'));

    // Phase B: Fahrzeuge & Personal laden (immer readonly im Modal)
    if (_mods.fahrzeuge)  loadVehiclesTab(id, true);
    if (_mods.personal)   loadPersonnelTab(id, true);
    loadAttachmentsTab(id, true);

    const canRelease = canApprove && r.status === 'entwurf';
    const canArchive = canApprove && r.status === 'freigegeben';
    const canEdit    = _canEdit(r, isAdmin, perms);

    footer.innerHTML = `
      ${canEdit    ? `<button class="btn btn--primary" id="btn-modal-edit">Bearbeiten</button>` : ''}
      ${canRelease ? `<button class="btn btn--primary" id="btn-release" style="background:#2ea043">Freigeben</button>` : ''}
      ${canArchive ? `<button class="btn btn--outline" id="btn-archive">Archivieren</button>` : ''}
      <button class="btn btn--outline" id="btn-modal-close">Schließen</button>
    `;

    document.getElementById('btn-modal-edit')?.addEventListener('click', () => {
      _closeModal();
      sessionStorage.setItem('edit_incident_id', id);
      navigate('#/edit-incident');
    });
    document.getElementById('btn-release')?.addEventListener('click', () => _setStatus(id, 'freigegeben'));
    document.getElementById('btn-archive')?.addEventListener('click', () => _setStatus(id, 'archiviert'));
    document.getElementById('btn-modal-close').addEventListener('click', _closeModal);

  } catch (e) {
    toast(e.message, 'error');
    _closeModal();
  }
}

function _closeModal() {
  document.getElementById('modal-incident').style.display = 'none';
  _editId = null;
}

// ── Löschen ───────────────────────────────────────────────────────────────────

async function _delete(id) {
  if (!confirm('Einsatzbericht wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
  try {
    await api.deleteIncident(id);
    toast('Einsatzbericht gelöscht');
    await _load();
    _loadStats();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Status ändern ─────────────────────────────────────────────────────────────

async function _setStatus(id, status) {
  const labels = { freigegeben: 'freigeben', archiviert: 'archivieren' };
  if (!confirm(`Einsatzbericht wirklich ${labels[status]}?`)) return;
  try {
    await api.setIncidentStatus(id, status);
    toast(`Status: ${STATUS_LABELS[status]}`);
    _closeModal();
    await _load();
    _loadStats();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function _fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
