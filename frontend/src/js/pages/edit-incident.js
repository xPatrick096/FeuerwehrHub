import { api } from '../api.js';
import { toast } from '../toast.js';
import { navigate } from '../router.js';
import { renderShell, setShellInfo } from '../shell.js';
import { esc } from '../utils.js';
import {
  STATUS_LABELS, STATUS_COLORS,
  buildTabsHTML, buildTypeDropdown, buildResourcesGrid,
  setupTabs, fillForm, collectBody,
} from './incident-form.js';
import { loadVehiclesTab, loadPersonnelTab, loadAttachmentsTab } from './incident-tabs.js';

let _incidentId = null;
let _incident   = null;

export async function renderEditIncident() {
  _incidentId = sessionStorage.getItem('edit_incident_id');
  if (!_incidentId) { navigate('#/incidents'); return; }

  const [settings, user, types] = await Promise.all([
    api.getSettings(), api.me(), api.getIncidentTypes().catch(() => []),
  ]);
  const mods = settings?.modules || {};
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('incidents');

  const content = document.getElementById('page-content');

  let report;
  try {
    report = await api.getIncident(_incidentId);
    _incident = report;
  } catch (e) {
    toast(e.message, 'error');
    navigate('#/incidents');
    return;
  }

  // Bearbeitungsrecht prüfen
  const isAdmin    = user?.role === 'admin' || user?.role === 'superuser';
  const perms      = user?.permissions || [];
  const canApprove = isAdmin || perms.includes('einsatzberichte.approve');
  const canEdit    = isAdmin
    || (report.status === 'entwurf' && (report.created_by === user?.id || canApprove));

  if (!canEdit) {
    toast('Keine Berechtigung zum Bearbeiten', 'error');
    navigate('#/incidents');
    return;
  }

  const statusColor = STATUS_COLORS[report.status] || '#64748b';
  const statusLabel = STATUS_LABELS[report.status] || report.status;

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Einsatzbericht bearbeiten</h2>
        <p style="display:flex;align-items:center;gap:8px">
          ${esc(report.incident_number || report.id.slice(0,8))} —
          ${esc(report.incident_type_label)}
          <span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;
            background:${statusColor}22;color:${statusColor}">${esc(statusLabel)}</span>
        </p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn--outline" id="btn-cancel">Abbrechen</button>
        <button class="btn btn--primary" id="btn-save">Speichern</button>
      </div>
    </div>

    <div class="card">
      <div class="card__body" style="padding:0">
        ${buildTabsHTML('padding:0 24px', { showVehicles: !!mods.fahrzeuge, showPersonnel: !!mods.personal, showAttachments: true })}
      </div>
    </div>

    <!-- Änderungskommentar -->
    <div class="card" style="margin-top:16px">
      <div class="card__body">
        <label style="display:block;margin-bottom:6px;font-size:13px;color:#64748b">
          Kommentar zur Änderung (optional)
        </label>
        <textarea id="edit-comment" rows="2"
          placeholder="Was wurde geändert und warum?"
          style="width:100%;resize:vertical"></textarea>
      </div>
    </div>

    <!-- Änderungshistorie -->
    <div class="card" style="margin-top:16px">
      <div class="card__body">
        <h4 style="margin:0 0 12px;font-size:14px">Änderungshistorie</h4>
        <div id="changes-list">
          <p style="color:#64748b;font-size:13px">Lade...</p>
        </div>
      </div>
    </div>
  `;

  // Formular befüllen
  fillForm(report);
  buildTypeDropdown(document.getElementById('ir-type'), types, report.incident_type_key);
  buildResourcesGrid('resources-grid', report.resources, false);
  setupTabs();

  // Phase B: Fahrzeuge & Personal laden
  if (mods.fahrzeuge)  loadVehiclesTab(_incidentId, false);
  if (mods.personal)   loadPersonnelTab(_incidentId, false);
  loadAttachmentsTab(_incidentId, false);

  // Änderungshistorie laden
  _loadChanges();

  // Events
  document.getElementById('btn-cancel').addEventListener('click', () => navigate('#/incidents'));
  document.getElementById('btn-save').addEventListener('click', _save);
}

async function _save() {
  const body = collectBody();
  body.comment = document.getElementById('edit-comment')?.value?.trim() || undefined;

  if (!body.incident_date) { toast('Datum ist Pflichtfeld', 'error'); return; }
  if (!body.location)      { toast('Einsatzort ist Pflichtfeld', 'error'); return; }

  const btn = document.getElementById('btn-save');
  btn.disabled = true;

  try {
    await api.updateIncident(_incidentId, body);
    toast('Einsatzbericht gespeichert');
    sessionStorage.removeItem('edit_incident_id');
    navigate('#/incidents');
  } catch (e) {
    toast(e.message, 'error');
    btn.disabled = false;
  }
}

async function _loadChanges() {
  const list = document.getElementById('changes-list');
  if (!list) return;
  try {
    const changes = await api.getIncidentChanges(_incidentId);
    if (!changes.length) {
      list.innerHTML = `<p style="color:#64748b;font-size:13px">Noch keine Änderungen protokolliert.</p>`;
      return;
    }
    list.innerHTML = changes.map(c => `
      <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #e2e8f0;align-items:flex-start">
        <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:#e2e8f0;
          display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#64748b">
          ${esc((c.changed_by_name || '?').slice(0,1).toUpperCase())}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600">${esc(c.changed_by_name || '—')}</div>
          ${c.comment ? `<div style="font-size:13px;color:#1e293b;margin-top:2px">${esc(c.comment)}</div>` : ''}
          <div style="font-size:11px;color:#64748b;margin-top:2px">${_fmtDate(c.created_at)}</div>
        </div>
      </div>
    `).join('');
  } catch (_) {
    list.innerHTML = `<p style="color:#64748b;font-size:13px">Änderungshistorie nicht verfügbar.</p>`;
  }
}

function _fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
