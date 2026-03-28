import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';
import { esc } from '../utils.js';

// ── Konstanten ────────────────────────────────────────────────────────────────

const GF_LEVEL = 30;
const WL_LEVEL = 50;

const STATUS_LABELS = {
  entwurf:     'Entwurf',
  freigegeben: 'Freigegeben',
  archiviert:  'Archiviert',
};

const STATUS_COLORS = {
  entwurf:     '#f0a500',
  freigegeben: '#3fb950',
  archiviert:  '#7d8590',
};

// Einsatzmittel-Definitionen
const RESOURCES = [
  { key: 'kleinloescher',        label: 'Kleinlöscher',                  unit: 'Stk' },
  { key: 'd_schlaeuche',         label: 'D-Schläuche',                   unit: 'Stk' },
  { key: 'c_schlaeuche',         label: 'C-Schläuche',                   unit: 'Stk' },
  { key: 'b_schlaeuche',         label: 'B-Schläuche',                   unit: 'Stk' },
  { key: 'a_schlaeuche',         label: 'A-Schläuche',                   unit: 'Stk' },
  { key: 's_angriff',            label: 'S-Angriff',                     unit: 'Stk' },
  { key: 'd_rohre',              label: 'D-Rohre',                       unit: 'Stk' },
  { key: 'c_rohre',              label: 'C-Rohre',                       unit: 'Stk' },
  { key: 'b_rohre',              label: 'B-Rohre',                       unit: 'Stk' },
  { key: 'schaumrohre',          label: 'Schaumrohre',                   unit: 'Stk' },
  { key: 'messgeraete',          label: 'Messgeräte',                    unit: 'Stk' },
  { key: 'seilwinde',            label: 'Seilwinde / Greifzug',          unit: 'Stk' },
  { key: 'tueroeffnung',         label: 'Türöffnungsset',                unit: 'Set' },
  { key: 'dichtkissen',          label: 'Dichtkissen',                   unit: 'Stk' },
  { key: 'beleuchtung',          label: 'Beleuchtungsgerät',             unit: 'Stk' },
  { key: 'handwerkszeug',        label: 'Handwerkszeug',                 unit: 'Stk' },
  { key: 'steckleiter',          label: 'Steckleiter',                   unit: 'Stk' },
  { key: 'schiebleiter',         label: 'Schiebleiter',                  unit: 'Stk' },
  { key: 'feuerwehrleine',       label: 'Feuerwehrleine',                unit: 'Stk' },
  { key: 'arbeitsleine',         label: 'Arbeitsleine',                  unit: 'Stk' },
  { key: 'sprungpolster',        label: 'Sprungpolster / -retter',       unit: 'Stk' },
  { key: 'hydraul_schere',       label: 'Hydraulische Schere',           unit: 'Stk' },
  { key: 'hydraul_spreizer',     label: 'Hydraulischer Spreizer',        unit: 'Stk' },
  { key: 'oelsperre',            label: 'Ölsperre',                      unit: 'm'   },
  { key: 'atemschutz',           label: 'Atemschutzgeräte',              unit: 'Stk' },
  { key: 'pressluftflasche',     label: 'Pressluftflasche',              unit: 'Stk' },
  { key: 'schaummittel_l',       label: 'Schaummittel',                  unit: 'l'   },
  { key: 'oelbinder_ohne_l',     label: 'Ölbinder ohne Entsorgung',      unit: 'kg'  },
  { key: 'oelbinder_mit_l',      label: 'Ölbinder mit Entsorgung',       unit: 'kg'  },
  { key: 'bioversal_ohne',       label: 'Bioversal ohne Entsorgung',     unit: 'ml'  },
  { key: 'bioversal_mit',        label: 'Bioversal mit Entsorgung',      unit: 'ml'  },
  { key: 'strassenreiniger',     label: 'Straßenreiniger',               unit: 'kg'  },
  { key: 'vliesbahn',            label: 'Vliesbahn',                     unit: 'm'   },
  { key: 'vliestuch',            label: 'Vliestuch',                     unit: 'Stk' },
  { key: 'wasser_gesamt_m3',     label: 'Wasser gesamt',                 unit: 'm³'  },
  { key: 'wasser_hydrant_m3',    label: 'davon aus Hydrant',             unit: 'm³'  },
  { key: 'wasser_loeschteich_m3',label: 'davon aus Löschteich',          unit: 'm³'  },
  { key: 'pulver_kg',            label: 'Pulver',                        unit: 'kg'  },
  { key: 'wassersauger_hhmm',    label: 'Wassersauger',                  unit: 'hh:mm'},
];

// ── State ─────────────────────────────────────────────────────────────────────

let _user       = null;
let _types      = [];
let _filters    = { year: new Date().getFullYear(), type_key: '', status: '', page: 1 };
let _editId     = null;
let _viewMode   = false; // true = nur lesen

// ── Hauptseite ────────────────────────────────────────────────────────────────

export async function renderIncidents() {
  const [settings, user] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('incidents');
  _user = user;

  const isAdmin   = user?.role === 'admin' || user?.role === 'superuser';
  const roleLevel = user?.role_level ?? 0;
  const canCreate = isAdmin || roleLevel > 0; // TF+ kann erstellen
  const canRelease= isAdmin || roleLevel >= GF_LEVEL;

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

    <!-- Modal: Einsatzbericht -->
    <div id="modal-incident" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box" style="max-width:900px;width:100%;max-height:90vh;display:flex;flex-direction:column">
        <div class="modal__header" style="flex-shrink:0">
          <h3 id="modal-incident-title">Neuer Einsatzbericht</h3>
          <button class="modal__close" id="btn-close-incident-modal">✕</button>
        </div>

        <!-- Tabs -->
        <div style="display:flex;gap:2px;padding:0 24px;background:#0d1117;flex-shrink:0;border-bottom:1px solid #21273d;overflow-x:auto">
          ${['Basisdaten','Flags','Kräfte & Schäden','Bericht','Einsatzmittel','Polizei'].map((t,i) =>
            `<button class="incident-tab" data-tab="${i}" style="padding:10px 14px;background:none;border:none;border-bottom:2px solid transparent;color:#7d8590;cursor:pointer;font-size:13px;white-space:nowrap">${t}</button>`
          ).join('')}
        </div>

        <div class="modal__body" style="overflow-y:auto;flex:1">
          <!-- Tab 0: Basisdaten -->
          <div class="incident-tab-panel" data-panel="0">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 16px">
              <div class="form-group">
                <label>Einsatznummer</label>
                <input type="text" id="ir-number" placeholder="auto" />
              </div>
              <div class="form-group">
                <label>Datum <span style="color:#e63022">*</span></label>
                <input type="date" id="ir-date" />
              </div>
              <div class="form-group">
                <label>Alarmzeit</label>
                <input type="time" id="ir-alarm-time" />
              </div>
              <div class="form-group">
                <label>Ausrückzeit</label>
                <input type="time" id="ir-departure-time" />
              </div>
              <div class="form-group">
                <label>Eintreffzeit</label>
                <input type="time" id="ir-arrival-time" />
              </div>
              <div class="form-group">
                <label>Einsatzende</label>
                <input type="time" id="ir-end-time" />
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label>Einsatzart <span style="color:#e63022">*</span></label>
                <select id="ir-type"></select>
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label>Einsatzort <span style="color:#e63022">*</span></label>
                <input type="text" id="ir-location" placeholder="Ortsname / Gemeinde" />
              </div>
              <div class="form-group">
                <label>PLZ</label>
                <input type="text" id="ir-postal" maxlength="10" />
              </div>
              <div class="form-group">
                <label>Ortsteil</label>
                <input type="text" id="ir-district" />
              </div>
              <div class="form-group">
                <label>Straße</label>
                <input type="text" id="ir-street" />
              </div>
              <div class="form-group">
                <label>Hausnummer</label>
                <input type="text" id="ir-housenr" maxlength="20" />
              </div>
              <div class="form-group" style="grid-column:1/-1">
                <label>Einsatzleiter</label>
                <input type="text" id="ir-commander" />
              </div>
              <div class="form-group">
                <label>Meldender</label>
                <input type="text" id="ir-reporter" />
              </div>
              <div class="form-group">
                <label>Telefon Melder</label>
                <input type="text" id="ir-reporter-phone" />
              </div>
            </div>
          </div>

          <!-- Tab 1: Flags -->
          <div class="incident-tab-panel" data-panel="1" style="display:none">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              ${[
                ['ir-flag-extinguished', 'Vor Ankunft gelöscht'],
                ['ir-flag-malicious',    'Böswilliger Alarm'],
                ['ir-flag-false',        'Blinder Alarm'],
                ['ir-flag-supra',        'Überregionaler Einsatz'],
                ['ir-flag-bf',           'BF beteiligt'],
                ['ir-flag-violence',     'Gewalt gegen Einsatzkräfte'],
              ].map(([id, label]) => `
                <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px;background:#161b27;border:1px solid #21273d;border-radius:8px">
                  <input type="checkbox" id="${id}" style="width:16px;height:16px;cursor:pointer" />
                  <span style="font-size:13px;color:#e6edf3">${label}</span>
                </label>
              `).join('')}
            </div>
            <div class="form-group" style="margin-top:16px;max-width:260px">
              <label>Anzahl betroffener Einsatzkräfte (Gewalt)</label>
              <input type="number" id="ir-violence-count" min="0" value="0" />
            </div>
          </div>

          <!-- Tab 2: Kräfte & Schäden -->
          <div class="incident-tab-panel" data-panel="2" style="display:none">
            <h4 style="margin:0 0 12px;font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:.05em">Kräftestärke (eigene)</h4>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
              <div class="form-group">
                <label>Führung</label>
                <input type="number" id="ir-str-leadership" min="0" value="0" />
              </div>
              <div class="form-group">
                <label>Unterführung</label>
                <input type="number" id="ir-str-sub" min="0" value="0" />
              </div>
              <div class="form-group">
                <label>Mannschaft</label>
                <input type="number" id="ir-str-crew" min="0" value="0" />
              </div>
            </div>

            <h4 style="margin:0 0 12px;font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:.05em">Personenschäden</h4>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
              ${[
                ['ir-p-rescued',   'Gerettet'],
                ['ir-p-evacuated', 'Evakuiert'],
                ['ir-p-injured',   'Verletzt'],
                ['ir-p-inj-own',   'davon eigene EK'],
                ['ir-p-recovered', 'Geborgen'],
                ['ir-p-dead',      'Tot'],
                ['ir-p-dead-own',  'davon eigene EK'],
              ].map(([id,l]) => `
                <div class="form-group"><label>${l}</label>
                <input type="number" id="${id}" min="0" value="0" /></div>
              `).join('')}
            </div>

            <h4 style="margin:0 0 12px;font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:.05em">Tierschäden</h4>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
              ${[
                ['ir-a-rescued',   'Gerettet'],
                ['ir-a-injured',   'Verletzt'],
                ['ir-a-recovered', 'Geborgen'],
                ['ir-a-dead',      'Tot'],
              ].map(([id,l]) => `
                <div class="form-group"><label>${l}</label>
                <input type="number" id="${id}" min="0" value="0" /></div>
              `).join('')}
            </div>

            <h4 style="margin:0 0 12px;font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:.05em">Sachschäden</h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
              <div class="form-group">
                <label>Fahrzeugschäden</label>
                <textarea id="ir-dmg-vehicle" rows="3" style="width:100%;resize:vertical"></textarea>
              </div>
              <div class="form-group">
                <label>Ausrüstungsschäden</label>
                <textarea id="ir-dmg-equipment" rows="3" style="width:100%;resize:vertical"></textarea>
              </div>
            </div>
          </div>

          <!-- Tab 3: Bericht -->
          <div class="incident-tab-panel" data-panel="3" style="display:none">
            <div style="display:grid;gap:14px">
              <div class="form-group">
                <label>Brandobjekt / Hilfeleistungsart</label>
                <input type="text" id="ir-fire-object" />
              </div>
              <div class="form-group">
                <label>Lage bei Eintreffen</label>
                <textarea id="ir-situation" rows="4" style="width:100%;resize:vertical"></textarea>
              </div>
              <div class="form-group">
                <label>Durchgeführte Maßnahmen</label>
                <textarea id="ir-measures" rows="4" style="width:100%;resize:vertical"></textarea>
              </div>
              <div class="form-group">
                <label>Besonderheiten / Kurzbeschreibung</label>
                <textarea id="ir-notes" rows="3" style="width:100%;resize:vertical"></textarea>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group">
                  <label>Einfluss der Wetterlage</label>
                  <input type="text" id="ir-weather" />
                </div>
                <div class="form-group">
                  <label>Übergabe an</label>
                  <input type="text" id="ir-handover" />
                </div>
              </div>
              <div class="form-group">
                <label>Bemerkung zur Übergabe</label>
                <textarea id="ir-handover-notes" rows="2" style="width:100%;resize:vertical"></textarea>
              </div>
            </div>
          </div>

          <!-- Tab 4: Einsatzmittel -->
          <div class="incident-tab-panel" data-panel="4" style="display:none">
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px" id="resources-grid"></div>
          </div>

          <!-- Tab 5: Polizei -->
          <div class="incident-tab-panel" data-panel="5" style="display:none">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:600px">
              <div class="form-group" style="grid-column:1/-1">
                <label>Tgb.-Nr.</label>
                <input type="text" id="ir-police-casenr" />
              </div>
              <div class="form-group">
                <label>Revier</label>
                <input type="text" id="ir-police-station" />
              </div>
              <div class="form-group">
                <label>Name Beamter</label>
                <input type="text" id="ir-police-officer" />
              </div>
            </div>
          </div>
        </div>

        <div class="modal__footer" style="flex-shrink:0" id="modal-incident-footer"></div>
      </div>
    </div>
  `;

  // Jahresfilter befüllen
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
    _buildTypeFilter();
  } catch (_) {}

  // Tabs
  _setupTabs();

  // Events
  yearSel.addEventListener('change', () => { _filters.year = +yearSel.value; _filters.page = 1; _load(); });
  document.getElementById('filter-type').addEventListener('change', e => { _filters.type_key = e.target.value; _filters.page = 1; _load(); });
  document.getElementById('filter-status').addEventListener('change', e => { _filters.status = e.target.value; _filters.page = 1; _load(); });

  document.getElementById('btn-new-incident')?.addEventListener('click', () => _openModal(null));
  document.getElementById('btn-close-incident-modal').addEventListener('click', _closeModal);
  document.getElementById('modal-incident').querySelector('.modal__backdrop').addEventListener('click', _closeModal);

  await _load();
  _loadStats();
}

// ── Daten laden ───────────────────────────────────────────────────────────────

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
    const s = await api.getIncidentStats(_filters.year);
    const row = document.getElementById('stats-row');
    if (!row) return;
    const tile = (v, l, c) =>
      `<div style="background:#161b27;border:1px solid #21273d;border-radius:10px;padding:12px 16px;min-width:90px;flex:1">
        <div style="font-size:20px;font-weight:800;color:${c}">${v}</div>
        <div style="font-size:11px;color:#7d8590;margin-top:2px">${l}</div>
      </div>`;
    row.innerHTML =
      tile(s.total,     'Gesamt',          '#e6edf3') +
      tile(s.brand,     'Brand',           '#e63022') +
      tile(s.thl,       'THL',             '#f0a500') +
      tile(s.fehlalarm, 'Fehlalarm',       '#7d8590') +
      tile(s.sonstiges, 'Sonstiges',       '#7d8590') +
      tile(s.entwurf,   'Entwürfe offen',  s.entwurf > 0 ? '#f0a500' : '#3fb950');
  } catch (_) {}
}

// ── Tabelle rendern ───────────────────────────────────────────────────────────

function _renderTable({ items, total, page, per_page }) {
  const wrap = document.getElementById('incident-table-wrap');
  const isAdmin   = _user?.role === 'admin' || _user?.role === 'superuser';
  const roleLevel = _user?.role_level ?? 0;

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
            <th>Nr.</th>
            <th>Datum</th>
            <th>Art</th>
            <th>Ort</th>
            <th>Einsatzleiter</th>
            <th>Stärke</th>
            <th>Status</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(r => `
            <tr>
              <td style="font-size:12px;color:#7d8590">${esc(r.incident_number || '—')}</td>
              <td>${formatDate(r.incident_date)}</td>
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
                  ${_canEdit(r, isAdmin, roleLevel) ? `<button class="btn btn--outline btn--sm" data-action="edit" data-id="${r.id}">Bearbeiten</button>` : ''}
                  ${_canDelete(r, isAdmin, roleLevel) ? `<button class="btn btn--danger btn--sm" data-action="delete" data-id="${r.id}">Löschen</button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${totalPages > 1 ? `
      <div style="display:flex;justify-content:center;gap:8px;margin-top:16px;align-items:center">
        <button class="btn btn--outline btn--sm" id="pg-prev" ${page <= 1 ? 'disabled' : ''}>← Zurück</button>
        <span style="font-size:13px;color:#7d8590">Seite ${page} / ${totalPages} (${total} Einträge)</span>
        <button class="btn btn--outline btn--sm" id="pg-next" ${page >= totalPages ? 'disabled' : ''}>Weiter →</button>
      </div>` : ''}
  `;

  wrap.querySelectorAll('[data-action="view"]').forEach(b =>
    b.addEventListener('click', () => _openModal(b.dataset.id, true)));
  wrap.querySelectorAll('[data-action="edit"]').forEach(b =>
    b.addEventListener('click', () => _openModal(b.dataset.id, false)));
  wrap.querySelectorAll('[data-action="delete"]').forEach(b =>
    b.addEventListener('click', () => _delete(b.dataset.id)));

  document.getElementById('pg-prev')?.addEventListener('click', () => { _filters.page--; _load(); });
  document.getElementById('pg-next')?.addEventListener('click', () => { _filters.page++; _load(); });
}

function _canEdit(r, isAdmin, level) {
  if (isAdmin) return true;
  if (r.status === 'entwurf') return r.created_by === _user?.id || level >= GF_LEVEL;
  return false;
}

function _canDelete(r, isAdmin, level) {
  if (isAdmin) return true;
  if (r.status === 'entwurf') return r.created_by === _user?.id || level >= GF_LEVEL;
  if (r.status === 'freigegeben' || r.status === 'archiviert') return level >= WL_LEVEL;
  return false;
}

// ── Modal öffnen ──────────────────────────────────────────────────────────────

async function _openModal(id, viewOnly = false) {
  _editId   = id;
  _viewMode = viewOnly;

  const modal  = document.getElementById('modal-incident');
  const title  = document.getElementById('modal-incident-title');
  const footer = document.getElementById('modal-incident-footer');

  // Auf Tab 0 zurücksetzen
  _switchTab(0);

  if (!id) {
    // Neu
    title.textContent = 'Neuer Einsatzbericht';
    _clearForm();
    document.getElementById('ir-date').value = new Date().toISOString().split('T')[0];
    _buildResourcesGrid(null, false);
    _buildTypeDropdown(null);
    _setFormReadonly(false);
    footer.innerHTML = `
      <button class="btn btn--primary" id="btn-save-incident">Speichern</button>
      <button class="btn btn--outline" id="btn-cancel-incident">Abbrechen</button>`;
    document.getElementById('btn-save-incident').addEventListener('click', _save);
    document.getElementById('btn-cancel-incident').addEventListener('click', _closeModal);
  } else {
    title.textContent = 'Lade...';
    modal.style.display = 'flex';
    try {
      const r = await api.getIncident(id);
      const isAdmin   = _user?.role === 'admin' || _user?.role === 'superuser';
      const roleLevel = _user?.role_level ?? 0;

      title.textContent = viewOnly
        ? `Einsatzbericht ${r.incident_number || r.id.slice(0,8)}`
        : `Bearbeiten – ${r.incident_number || r.id.slice(0,8)}`;

      _fillForm(r);
      _buildResourcesGrid(r.resources, viewOnly);
      _buildTypeDropdown(r.incident_type_key);
      _setFormReadonly(viewOnly);

      const canRelease = (isAdmin || roleLevel >= GF_LEVEL) && r.status === 'entwurf';
      const canArchive = (isAdmin || roleLevel >= GF_LEVEL) && r.status === 'freigegeben';

      if (viewOnly) {
        footer.innerHTML = `
          ${canRelease ? `<button class="btn btn--primary" id="btn-release">Freigeben</button>` : ''}
          ${canArchive ? `<button class="btn btn--outline" id="btn-archive">Archivieren</button>` : ''}
          <button class="btn btn--outline" id="btn-cancel-incident">Schließen</button>`;
      } else {
        footer.innerHTML = `
          <button class="btn btn--primary" id="btn-save-incident">Speichern</button>
          ${canRelease ? `<button class="btn btn--primary" id="btn-release" style="background:#2ea043">Freigeben</button>` : ''}
          <button class="btn btn--outline" id="btn-cancel-incident">Abbrechen</button>`;
        document.getElementById('btn-save-incident').addEventListener('click', _save);
      }

      document.getElementById('btn-release')?.addEventListener('click', () => _setStatus(id, 'freigegeben'));
      document.getElementById('btn-archive')?.addEventListener('click', () => _setStatus(id, 'archiviert'));
      document.getElementById('btn-cancel-incident').addEventListener('click', _closeModal);
    } catch (e) {
      toast(e.message, 'error');
      _closeModal();
      return;
    }
  }

  modal.style.display = 'flex';
  document.getElementById('btn-cancel-incident').addEventListener('click', _closeModal);
}

function _closeModal() {
  document.getElementById('modal-incident').style.display = 'none';
  _editId = null;
}

// ── Formular befüllen / leeren ────────────────────────────────────────────────

function _clearForm() {
  ['ir-number','ir-date','ir-alarm-time','ir-departure-time','ir-arrival-time','ir-end-time',
   'ir-location','ir-postal','ir-district','ir-street','ir-housenr','ir-commander',
   'ir-reporter','ir-reporter-phone','ir-fire-object','ir-situation','ir-measures',
   'ir-notes','ir-weather','ir-handover','ir-handover-notes',
   'ir-police-casenr','ir-police-station','ir-police-officer','ir-dmg-vehicle','ir-dmg-equipment']
  .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  ['ir-flag-extinguished','ir-flag-malicious','ir-flag-false','ir-flag-supra','ir-flag-bf','ir-flag-violence']
  .forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });

  ['ir-violence-count','ir-str-leadership','ir-str-sub','ir-str-crew',
   'ir-p-rescued','ir-p-evacuated','ir-p-injured','ir-p-inj-own',
   'ir-p-recovered','ir-p-dead','ir-p-dead-own',
   'ir-a-rescued','ir-a-injured','ir-a-recovered','ir-a-dead']
  .forEach(id => { const el = document.getElementById(id); if (el) el.value = '0'; });
}

function _fillForm(r) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

  set('ir-number',          r.incident_number);
  set('ir-date',            r.incident_date);
  set('ir-alarm-time',      r.alarm_time?.slice(0,5));
  set('ir-departure-time',  r.departure_time?.slice(0,5));
  set('ir-arrival-time',    r.arrival_time?.slice(0,5));
  set('ir-end-time',        r.end_time?.slice(0,5));
  set('ir-location',        r.location);
  set('ir-postal',          r.postal_code);
  set('ir-district',        r.district);
  set('ir-street',          r.street);
  set('ir-housenr',         r.house_number);
  set('ir-commander',       r.incident_commander);
  set('ir-reporter',        r.reporter_name);
  set('ir-reporter-phone',  r.reporter_phone);
  set('ir-str-leadership',  r.strength_leadership);
  set('ir-str-sub',         r.strength_sub);
  set('ir-str-crew',        r.strength_crew);
  set('ir-fire-object',     r.fire_object);
  set('ir-situation',       r.situation);
  set('ir-measures',        r.measures);
  set('ir-notes',           r.notes);
  set('ir-weather',         r.weather_influence);
  set('ir-handover',        r.handover_to);
  set('ir-handover-notes',  r.handover_notes);
  set('ir-police-casenr',   r.police_case_number);
  set('ir-police-station',  r.police_station);
  set('ir-police-officer',  r.police_officer);
  set('ir-dmg-vehicle',     r.vehicle_damage);
  set('ir-dmg-equipment',   r.equipment_damage);
  set('ir-violence-count',  r.violence_count);
  set('ir-p-rescued',       r.persons_rescued);
  set('ir-p-evacuated',     r.persons_evacuated);
  set('ir-p-injured',       r.persons_injured);
  set('ir-p-inj-own',       r.persons_injured_own);
  set('ir-p-recovered',     r.persons_recovered);
  set('ir-p-dead',          r.persons_dead);
  set('ir-p-dead-own',      r.persons_dead_own);
  set('ir-a-rescued',       r.animals_rescued);
  set('ir-a-injured',       r.animals_injured);
  set('ir-a-recovered',     r.animals_recovered);
  set('ir-a-dead',          r.animals_dead);

  chk('ir-flag-extinguished', r.extinguished_before_arrival);
  chk('ir-flag-malicious',    r.malicious_alarm);
  chk('ir-flag-false',        r.false_alarm);
  chk('ir-flag-supra',        r.supraregional);
  chk('ir-flag-bf',           r.bf_involved);
  chk('ir-flag-violence',     r.violence_against_crew);
}

function _setFormReadonly(readonly) {
  document.querySelectorAll('#modal-incident input, #modal-incident textarea, #modal-incident select')
    .forEach(el => {
      if (readonly) el.setAttribute('readonly', '');
      else el.removeAttribute('readonly');
      if (el.tagName === 'SELECT' || el.type === 'checkbox') {
        el.disabled = readonly;
      }
    });
}

// ── Einsatzarten-Dropdown ─────────────────────────────────────────────────────

function _buildTypeFilter() {
  const sel = document.getElementById('filter-type');
  // Kategorien gruppieren
  const cats = { brand: 'Brand', thl: 'THL', gefahrgut: 'Gefahrgut', fehlalarm: 'Fehlalarm', sonstiges: 'Sonstiges' };
  for (const [cat, label] of Object.entries(cats)) {
    const types = _types.filter(t => t.category === cat && t.active);
    if (!types.length) continue;
    const grp = document.createElement('optgroup');
    grp.label = label;
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.key; opt.textContent = t.label;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  }
}

function _buildTypeDropdown(selectedKey) {
  const sel = document.getElementById('ir-type');
  sel.innerHTML = '';
  const cats = { brand: 'Brand', thl: 'THL', gefahrgut: 'Gefahrgut', fehlalarm: 'Fehlalarm', sonstiges: 'Sonstiges' };
  for (const [cat, label] of Object.entries(cats)) {
    const types = _types.filter(t => t.category === cat && t.active);
    if (!types.length) continue;
    const grp = document.createElement('optgroup');
    grp.label = label;
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.key; opt.textContent = t.label;
      if (t.key === selectedKey) opt.selected = true;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  }
}

// ── Einsatzmittel-Grid ────────────────────────────────────────────────────────

function _buildResourcesGrid(resources, readonly) {
  const grid = document.getElementById('resources-grid');
  grid.innerHTML = RESOURCES.map(r => {
    const val = resources?.[r.key] || '';
    const show = !readonly || (val && val !== '0');
    if (readonly && !show) return '';
    return `
      <div class="form-group">
        <label style="font-size:12px">${esc(r.label)} <span style="color:#7d8590">(${r.unit})</span></label>
        <input type="${r.unit === 'hh:mm' ? 'text' : 'number'}"
          id="res-${r.key}" data-resource="${r.key}"
          min="0" value="${esc(String(val))}"
          placeholder="0"
          ${readonly ? 'readonly' : ''} />
      </div>`;
  }).join('');
}

// ── Speichern ─────────────────────────────────────────────────────────────────

async function _save() {
  const date = document.getElementById('ir-date').value;
  const loc  = document.getElementById('ir-location').value.trim();

  if (!date) { toast('Datum ist Pflichtfeld', 'error'); return; }
  if (!loc)  { toast('Einsatzort ist Pflichtfeld', 'error'); return; }

  // Einsatzart Label ermitteln
  const typeSel = document.getElementById('ir-type');
  const typeKey = typeSel.value;
  const typeLabel = typeSel.options[typeSel.selectedIndex]?.text || 'Sonstiges';

  // Ressourcen sammeln
  const resources = {};
  document.querySelectorAll('[data-resource]').forEach(el => {
    const v = el.value.trim();
    if (v && v !== '0') resources[el.dataset.resource] = isNaN(v) ? v : Number(v);
  });

  const body = {
    incident_number:             document.getElementById('ir-number').value.trim() || null,
    incident_date:               date,
    alarm_time:                  document.getElementById('ir-alarm-time').value || null,
    departure_time:              document.getElementById('ir-departure-time').value || null,
    arrival_time:                document.getElementById('ir-arrival-time').value || null,
    end_time:                    document.getElementById('ir-end-time').value || null,
    incident_type_key:           typeKey,
    incident_type_label:         typeLabel,
    location:                    loc,
    postal_code:                 document.getElementById('ir-postal').value || null,
    district:                    document.getElementById('ir-district').value || null,
    street:                      document.getElementById('ir-street').value || null,
    house_number:                document.getElementById('ir-housenr').value || null,
    extinguished_before_arrival: document.getElementById('ir-flag-extinguished').checked,
    malicious_alarm:             document.getElementById('ir-flag-malicious').checked,
    false_alarm:                 document.getElementById('ir-flag-false').checked,
    supraregional:               document.getElementById('ir-flag-supra').checked,
    bf_involved:                 document.getElementById('ir-flag-bf').checked,
    violence_against_crew:       document.getElementById('ir-flag-violence').checked,
    violence_count:              +document.getElementById('ir-violence-count').value || 0,
    incident_commander:          document.getElementById('ir-commander').value || null,
    reporter_name:               document.getElementById('ir-reporter').value || null,
    reporter_phone:              document.getElementById('ir-reporter-phone').value || null,
    strength_leadership:         +document.getElementById('ir-str-leadership').value || 0,
    strength_sub:                +document.getElementById('ir-str-sub').value || 0,
    strength_crew:               +document.getElementById('ir-str-crew').value || 0,
    fire_object:                 document.getElementById('ir-fire-object').value || null,
    situation:                   document.getElementById('ir-situation').value || null,
    measures:                    document.getElementById('ir-measures').value || null,
    notes:                       document.getElementById('ir-notes').value || null,
    weather_influence:           document.getElementById('ir-weather').value || null,
    handover_to:                 document.getElementById('ir-handover').value || null,
    handover_notes:              document.getElementById('ir-handover-notes').value || null,
    police_case_number:          document.getElementById('ir-police-casenr').value || null,
    police_station:              document.getElementById('ir-police-station').value || null,
    police_officer:              document.getElementById('ir-police-officer').value || null,
    persons_rescued:             +document.getElementById('ir-p-rescued').value || 0,
    persons_evacuated:           +document.getElementById('ir-p-evacuated').value || 0,
    persons_injured:             +document.getElementById('ir-p-injured').value || 0,
    persons_injured_own:         +document.getElementById('ir-p-inj-own').value || 0,
    persons_recovered:           +document.getElementById('ir-p-recovered').value || 0,
    persons_dead:                +document.getElementById('ir-p-dead').value || 0,
    persons_dead_own:            +document.getElementById('ir-p-dead-own').value || 0,
    animals_rescued:             +document.getElementById('ir-a-rescued').value || 0,
    animals_injured:             +document.getElementById('ir-a-injured').value || 0,
    animals_recovered:           +document.getElementById('ir-a-recovered').value || 0,
    animals_dead:                +document.getElementById('ir-a-dead').value || 0,
    vehicle_damage:              document.getElementById('ir-dmg-vehicle').value || null,
    equipment_damage:            document.getElementById('ir-dmg-equipment').value || null,
    resources,
  };

  const btn = document.getElementById('btn-save-incident');
  btn.disabled = true;
  try {
    if (_editId) {
      await api.updateIncident(_editId, body);
      toast('Einsatzbericht gespeichert');
    } else {
      await api.createIncident(body);
      toast('Einsatzbericht erstellt');
    }
    _closeModal();
    await _load();
    _loadStats();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
  }
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
    toast(`Status geändert: ${STATUS_LABELS[status]}`);
    _closeModal();
    await _load();
    _loadStats();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function _setupTabs() {
  document.querySelectorAll('.incident-tab').forEach(btn => {
    btn.addEventListener('click', () => _switchTab(+btn.dataset.tab));
  });
  _switchTab(0);
}

function _switchTab(idx) {
  document.querySelectorAll('.incident-tab').forEach((btn, i) => {
    const active = i === idx;
    btn.style.color       = active ? '#e6edf3' : '#7d8590';
    btn.style.borderBottomColor = active ? '#e63022' : 'transparent';
    btn.style.fontWeight  = active ? '600' : '400';
  });
  document.querySelectorAll('.incident-tab-panel').forEach((panel, i) => {
    panel.style.display = i === idx ? 'block' : 'none';
  });
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
