import { api } from '../api.js';
import { toast } from '../toast.js';
import { navigate } from '../router.js';
import { renderShell, setShellInfo } from '../shell.js';
import {
  buildTabsHTML, buildTypeDropdown, buildResourcesGrid,
  setupTabs, collectBody,
} from './incident-form.js';

export async function renderNewIncident() {
  const [settings, user, types] = await Promise.all([
    api.getSettings(), api.me(), api.getIncidentTypes().catch(() => []),
  ]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('incidents');

  const content = document.getElementById('page-content');

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Neuer Einsatzbericht</h2>
        <p>Entwurf — wird nach dem Speichern zur Freigabe vorgelegt</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn--outline" id="btn-cancel">Abbrechen</button>
        <button class="btn btn--primary" id="btn-save">Speichern</button>
      </div>
    </div>

    <div class="card">
      <div class="card__body" style="padding:0">
        ${buildTabsHTML('padding:0 24px')}
      </div>
    </div>
  `;

  // Datum vorbelegen
  document.getElementById('ir-date').value = new Date().toISOString().split('T')[0];

  // Einsatzarten-Dropdown befüllen
  buildTypeDropdown(document.getElementById('ir-type'), types, null);

  // Ressourcen-Grid
  buildResourcesGrid('resources-grid', null, false);

  // Tabs aktivieren
  setupTabs();

  // Events
  document.getElementById('btn-cancel').addEventListener('click', () => navigate('#/incidents'));
  document.getElementById('btn-save').addEventListener('click', _save);
}

async function _save() {
  const body = collectBody();

  if (!body.incident_date) { toast('Datum ist Pflichtfeld', 'error'); return; }
  if (!body.location)      { toast('Einsatzort ist Pflichtfeld', 'error'); return; }

  const btn = document.getElementById('btn-save');
  btn.disabled = true;

  try {
    await api.createIncident(body);
    toast('Einsatzbericht erstellt');
    navigate('#/incidents');
  } catch (e) {
    toast(e.message, 'error');
    btn.disabled = false;
  }
}
