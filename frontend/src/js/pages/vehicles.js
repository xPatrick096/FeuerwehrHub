import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';

const TYPE_LABELS = {
  lkw:        'LKW',
  pkw:        'PKW',
  anhaenger:  'Anhänger',
  drohne:     'Drohne',
  warnmittel: 'Warnmittel',
};

const STATUS_LABELS = {
  aktiv:         'Einsatzbereit',
  ausser_dienst: 'Außer Dienst',
  wartung:       'In Wartung',
};

const STATUS_COLORS = {
  aktiv:         '#3fb950',
  ausser_dienst: '#e63022',
  wartung:       '#f0a500',
};

export async function renderVehicles() {
  const [settings, user] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('vehicles');

  const isAdmin = user?.role === 'admin' || user?.role === 'superuser';
  const content = document.getElementById('page-content');

  content.innerHTML = `
    <div class="page-header">
      <div><h2>Fahrzeuge</h2><p>Fuhrparkverwaltung</p></div>
      ${isAdmin ? `<button class="btn btn--primary" id="btn-new-vehicle">+ Neues Fahrzeug</button>` : ''}
    </div>
    <div id="vehicle-list-wrap"></div>
    <div id="vehicle-detail-wrap" style="display:none"></div>

    <!-- Modal: Fahrzeug anlegen / bearbeiten -->
    <div id="modal-vehicle" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box" style="max-width:620px;width:100%">
        <div class="modal__header">
          <h3 id="modal-vehicle-title">Fahrzeug anlegen</h3>
          <button class="modal__close" id="btn-close-vehicle-modal">✕</button>
        </div>
        <div class="modal__body" style="display:grid;grid-template-columns:1fr 1fr;gap:12px 16px">
          <div class="form-group" style="grid-column:1/-1">
            <label>Name <span style="color:#e63022">*</span></label>
            <input type="text" id="v-name" placeholder="z.B. HLF Böhlitz-Ehrenberg" maxlength="200" />
          </div>
          <div class="form-group">
            <label>Kurzname</label>
            <input type="text" id="v-short-name" placeholder="z.B. HLF" maxlength="50" />
          </div>
          <div class="form-group">
            <label>OPTA</label>
            <input type="text" id="v-opta" placeholder="z.B. 65.49.1" maxlength="50" />
          </div>
          <div class="form-group">
            <label>Einsatzmitteltyp</label>
            <select id="v-type">
              <option value="lkw">LKW</option>
              <option value="pkw">PKW</option>
              <option value="anhaenger">Anhänger</option>
              <option value="drohne">Drohne</option>
              <option value="warnmittel">Warnmittel</option>
            </select>
          </div>
          <div class="form-group">
            <label>Grund-Typ</label>
            <input type="text" id="v-base-type" placeholder="z.B. HLF 20, DLK 23/12" maxlength="100" />
          </div>
          <div class="form-group">
            <label>Kennzeichen</label>
            <input type="text" id="v-license-plate" placeholder="z.B. L-FF 1234" maxlength="20" />
          </div>
          <div class="form-group">
            <label>Hersteller</label>
            <input type="text" id="v-manufacturer" placeholder="z.B. MAN, Mercedes" maxlength="100" />
          </div>
          <div class="form-group">
            <label>Aufbauhersteller</label>
            <input type="text" id="v-body-manufacturer" placeholder="z.B. Rosenbauer" maxlength="100" />
          </div>
          <div class="form-group">
            <label>Baujahr</label>
            <input type="number" id="v-year-built" placeholder="z.B. 2018" min="1900" max="2100" />
          </div>
          <div class="form-group">
            <label>Fahrgestell-Nr.</label>
            <input type="text" id="v-chassis" maxlength="100" />
          </div>
          <div class="form-group" style="display:flex;gap:8px;align-items:flex-end">
            <div style="flex:1">
              <label>Stärke Führung</label>
              <input type="number" id="v-str-lead" value="0" min="0" max="99" />
            </div>
            <div style="flex:1">
              <label>Unterführung</label>
              <input type="number" id="v-str-sub" value="0" min="0" max="99" />
            </div>
            <div style="flex:1">
              <label>Mannschaft</label>
              <input type="number" id="v-str-crew" value="0" min="0" max="99" />
            </div>
          </div>
          <div class="form-group">
            <label>Telefon (Fahrzeug)</label>
            <input type="text" id="v-phone" maxlength="50" />
          </div>
          <div class="form-group">
            <label>Länge (m)</label>
            <input type="number" id="v-length" step="0.01" min="0" />
          </div>
          <div class="form-group">
            <label>Breite (m)</label>
            <input type="number" id="v-width" step="0.01" min="0" />
          </div>
          <div class="form-group">
            <label>Höhe (m)</label>
            <input type="number" id="v-height" step="0.01" min="0" />
          </div>
          <div class="form-group">
            <label>Gesamtgewicht (kg)</label>
            <input type="number" id="v-weight" min="0" />
          </div>
          <div class="form-group">
            <label>Dienststellung</label>
            <select id="v-status">
              <option value="aktiv">Einsatzbereit</option>
              <option value="ausser_dienst">Außer Dienst</option>
              <option value="wartung">In Wartung</option>
            </select>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Bemerkung</label>
            <textarea id="v-notes" rows="3"
              style="width:100%;resize:vertical;padding:8px;border:1px solid #21273d;border-radius:8px;font-size:14px;background:#0d1117;color:#e6edf3"
              placeholder="Freitext..."></textarea>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-vehicle">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-vehicle">Abbrechen</button>
        </div>
      </div>
    </div>

    <!-- Modal: Frist anlegen / bearbeiten -->
    <div id="modal-inspection" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3 id="modal-inspection-title">Frist anlegen</h3>
          <button class="modal__close" id="btn-close-inspection-modal">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label>Bezeichnung <span style="color:#e63022">*</span></label>
            <input type="text" id="insp-name" placeholder="z.B. Hauptuntersuchung (HU)" maxlength="200" />
          </div>
          <div class="form-group">
            <label>Letztes Datum</label>
            <input type="date" id="insp-last-date" />
          </div>
          <div class="form-group">
            <label>Nächstes Datum</label>
            <input type="date" id="insp-next-date" />
          </div>
          <div class="form-group">
            <label>Intervall (Monate)</label>
            <input type="number" id="insp-interval" min="1" max="120" placeholder="z.B. 12" />
          </div>
          <div class="form-group">
            <label>Notiz</label>
            <input type="text" id="insp-notes" maxlength="500" />
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-inspection">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-inspection">Abbrechen</button>
        </div>
      </div>
    </div>
  `;

  loadVehicleList(isAdmin);

  if (isAdmin) {
    setupVehicleModal();
    document.getElementById('btn-new-vehicle').addEventListener('click', () => openVehicleModal(null));
  }
}

// ── Fahrzeugliste ──────────────────────────────────────────────────────────────

async function loadVehicleList(isAdmin) {
  const listWrap   = document.getElementById('vehicle-list-wrap');
  const detailWrap = document.getElementById('vehicle-detail-wrap');
  listWrap.style.display   = 'block';
  detailWrap.style.display = 'none';
  listWrap.innerHTML = '<p style="color:#7d8590;font-size:13px">Lade...</p>';

  try {
    const vehicles = await api.getVehicles();

    if (!vehicles.length) {
      listWrap.innerHTML = `
        <div class="card">
          <div class="card__body" style="text-align:center;padding:32px;color:#7d8590">
            Noch keine Fahrzeuge eingetragen.
            ${isAdmin ? `<br><br><button class="btn btn--primary" id="btn-empty-new">Fahrzeug anlegen</button>` : ''}
          </div>
        </div>`;
      if (isAdmin) {
        document.getElementById('btn-empty-new')?.addEventListener('click', () => openVehicleModal(null));
      }
      return;
    }

    const rows = vehicles.map(v => {
      const statusColor = STATUS_COLORS[v.status] || '#7d8590';
      const statusLabel = STATUS_LABELS[v.status] || v.status;
      const strength = `${v.strength_leadership}/${v.strength_sub}/${v.strength_crew}`;
      return `
        <tr class="vehicle-row" data-id="${v.id}" style="cursor:pointer">
          <td style="padding:10px 16px">
            <strong>${esc(v.name)}</strong>
            ${v.short_name ? `<span style="color:#7d8590;font-size:11px;margin-left:6px">${esc(v.short_name)}</span>` : ''}
          </td>
          <td style="padding:10px 16px;color:#7d8590">${esc(TYPE_LABELS[v.vehicle_type] || v.vehicle_type)}</td>
          <td style="padding:10px 16px;color:#7d8590">${esc(v.base_type || '–')}</td>
          <td style="padding:10px 16px;color:#7d8590">${esc(v.license_plate || '–')}</td>
          <td style="padding:10px 16px;color:#7d8590">${strength}</td>
          <td style="padding:10px 16px">
            <span style="color:${statusColor};font-size:12px;font-weight:600">${statusLabel}</span>
          </td>
        </tr>`;
    }).join('');

    listWrap.innerHTML = `
      <div class="card">
        <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
          <span>Alle Fahrzeuge (${vehicles.length})</span>
          <input type="text" id="vehicle-search" placeholder="Suchen..." maxlength="100"
            style="background:#0d1117;border:1px solid #21273d;color:#e6edf3;padding:6px 10px;border-radius:6px;font-size:13px;width:200px" />
        </div>
        <div class="card__body" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:#0d1117">
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Fahrzeug</th>
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Typ</th>
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Grund-Typ</th>
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Kennzeichen</th>
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Stärke (F/U/M)</th>
                <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Status</th>
              </tr>
            </thead>
            <tbody id="vehicle-tbody">${rows}</tbody>
          </table>
        </div>
      </div>`;

    styleVehicleRows();

    document.getElementById('vehicle-search').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('.vehicle-row').forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    });

    document.querySelectorAll('.vehicle-row').forEach(tr => {
      tr.addEventListener('click', () => openVehicleDetail(tr.dataset.id, vehicles, isAdmin));
    });

  } catch (e) {
    listWrap.innerHTML = `<p style="color:#ff8a80">${esc(e.message)}</p>`;
  }
}

function styleVehicleRows() {
  document.querySelectorAll('.vehicle-row').forEach((tr, i) => {
    tr.style.borderBottom = '1px solid #21273d';
    tr.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
    tr.addEventListener('mouseenter', () => tr.style.background = 'rgba(230,48,34,0.06)');
    tr.addEventListener('mouseleave', () => tr.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)');
  });
}

// ── Detail-Ansicht ─────────────────────────────────────────────────────────────

async function openVehicleDetail(id, vehicles, isAdmin) {
  const listWrap   = document.getElementById('vehicle-list-wrap');
  const detailWrap = document.getElementById('vehicle-detail-wrap');
  listWrap.style.display   = 'none';
  detailWrap.style.display = 'block';
  detailWrap.innerHTML     = '<p style="color:#7d8590;font-size:13px">Lade...</p>';

  try {
    const [v, inspections] = await Promise.all([
      api.getVehicle(id),
      api.getInspections(id),
    ]);

    const allVehicles = vehicles || [];
    const replacementName = v.replacement_name || '–';
    const statusColor = STATUS_COLORS[v.status] || '#7d8590';
    const statusLabel = STATUS_LABELS[v.status] || v.status;

    detailWrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <button class="btn btn--outline btn--sm" id="btn-back-vehicles">← Zurück</button>
        <h2 style="margin:0;font-size:18px;font-weight:700;color:#e6edf3">${esc(v.name)}</h2>
        <span style="color:${statusColor};font-size:12px;font-weight:600;background:${statusColor}22;padding:3px 10px;border-radius:20px">${statusLabel}</span>
        ${isAdmin ? `
          <div style="margin-left:auto;display:flex;gap:8px">
            <button class="btn btn--outline btn--sm" id="btn-edit-vehicle">Bearbeiten</button>
            <button class="btn btn--danger btn--sm" id="btn-delete-vehicle">Löschen</button>
          </div>` : ''}
      </div>

      <!-- Stammdaten -->
      <div class="card" style="margin-bottom:20px">
        <div class="card__header">Stammdaten</div>
        <div class="card__body">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px 24px;font-size:13px">
            ${field('Kurzname',           v.short_name)}
            ${field('OPTA',               v.opta)}
            ${field('Einsatzmitteltyp',   TYPE_LABELS[v.vehicle_type] || v.vehicle_type)}
            ${field('Grund-Typ',          v.base_type)}
            ${field('Kennzeichen',        v.license_plate)}
            ${field('Hersteller',         v.manufacturer)}
            ${field('Aufbauhersteller',   v.body_manufacturer)}
            ${field('Baujahr',            v.year_built)}
            ${field('Fahrgestell-Nr.',    v.chassis_number)}
            ${field('Stärke (F/U/M)',     `${v.strength_leadership}/${v.strength_sub}/${v.strength_crew}`)}
            ${field('Ersatzfahrzeug',     replacementName)}
            ${field('Telefon',            v.phone)}
            ${field('Länge',              v.length_m != null ? v.length_m + ' m' : null)}
            ${field('Breite',             v.width_m  != null ? v.width_m  + ' m' : null)}
            ${field('Höhe',               v.height_m != null ? v.height_m + ' m' : null)}
            ${field('Gesamtgewicht',      v.weight_kg != null ? v.weight_kg + ' kg' : null)}
          </div>
          ${v.notes ? `<div style="margin-top:16px;padding-top:12px;border-top:1px solid #21273d;font-size:13px;color:#7d8590;white-space:pre-wrap">${esc(v.notes)}</div>` : ''}
        </div>
      </div>

      <!-- Fristen & Prüfungen -->
      <div class="card">
        <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
          <span>Fristen & Prüfungen</span>
          ${isAdmin ? `<button class="btn btn--primary btn--sm" id="btn-new-inspection">+ Frist</button>` : ''}
        </div>
        <div id="inspections-wrap">
          ${renderInspectionsTable(inspections, isAdmin)}
        </div>
      </div>
    `;

    document.getElementById('btn-back-vehicles').addEventListener('click', () => loadVehicleList(isAdmin));

    if (isAdmin) {
      document.getElementById('btn-edit-vehicle').addEventListener('click', () => openVehicleModal(v));
      document.getElementById('btn-delete-vehicle').addEventListener('click', () => deleteVehicle(id, isAdmin));
      document.getElementById('btn-new-inspection').addEventListener('click', () => openInspectionModal(null, id, isAdmin));
      setupInspectionModal(id, isAdmin);
      bindInspectionActions(id, isAdmin);
    }

  } catch (e) {
    detailWrap.innerHTML = `<p style="color:#ff8a80">${esc(e.message)}</p>`;
  }
}

function field(label, value) {
  if (value == null || value === '') return '';
  return `
    <div>
      <div style="font-size:11px;color:#7d8590;margin-bottom:2px">${label}</div>
      <div style="color:#e6edf3;font-weight:500">${esc(String(value))}</div>
    </div>`;
}

// ── Fristen-Tabelle ────────────────────────────────────────────────────────────

function ampelDot(nextDate) {
  if (!nextDate) return '<span style="color:#7d8590">•</span>';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nd = new Date(nextDate);
  const diffDays = Math.round((nd - today) / 86400000);
  if (diffDays < 0)  return '<span style="color:#e63022" title="Überfällig">●</span>';
  if (diffDays <= 14) return '<span style="color:#e63022" title="Sehr bald fällig">●</span>';
  if (diffDays <= 60) return '<span style="color:#f0a500" title="Bald fällig">●</span>';
  return '<span style="color:#3fb950" title="OK">●</span>';
}

function renderInspectionsTable(inspections, isAdmin) {
  if (!inspections.length) {
    return `<div class="card__body" style="color:#7d8590;font-size:13px">Keine Fristen eingetragen.</div>`;
  }
  const rows = inspections.map(insp => `
    <tr class="insp-row" data-id="${insp.id}">
      <td style="padding:10px 16px">${ampelDot(insp.next_date)}</td>
      <td style="padding:10px 16px;color:#e6edf3">${esc(insp.name)}</td>
      <td style="padding:10px 16px;color:#7d8590">${insp.last_date ? formatDate(insp.last_date) : '–'}</td>
      <td style="padding:10px 16px;color:#7d8590">${insp.next_date ? formatDate(insp.next_date) : '–'}</td>
      <td style="padding:10px 16px;color:#7d8590">${insp.interval_months ? insp.interval_months + ' Monate' : '–'}</td>
      <td style="padding:10px 16px;color:#7d8590;font-size:12px">${esc(insp.notes || '')}</td>
      ${isAdmin ? `
      <td style="padding:10px 16px">
        <div class="btn-group">
          <button class="btn btn--outline btn--sm" data-action="edit-insp" data-id="${insp.id}">Bearb.</button>
          <button class="btn btn--danger btn--sm" data-action="del-insp" data-id="${insp.id}">Löschen</button>
        </div>
      </td>` : '<td></td>'}
    </tr>`).join('');

  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:#0d1117">
          <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;width:28px"></th>
          <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Bezeichnung</th>
          <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Letztes Datum</th>
          <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Nächstes Datum</th>
          <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Intervall</th>
          <th style="padding:10px 16px;color:#7d8590;font-weight:600;border-bottom:1px solid #21273d;text-align:left">Notiz</th>
          <th style="padding:10px 16px;border-bottom:1px solid #21273d"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function reloadInspections(vehicleId, isAdmin) {
  const wrap = document.getElementById('inspections-wrap');
  if (!wrap) return;
  const inspections = await api.getInspections(vehicleId);
  wrap.innerHTML = renderInspectionsTable(inspections, isAdmin);
  if (isAdmin) bindInspectionActions(vehicleId, isAdmin);
}

function bindInspectionActions(vehicleId, isAdmin) {
  const wrap = document.getElementById('inspections-wrap');
  if (!wrap) return;

  wrap.querySelectorAll('[data-action="edit-insp"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const inspections = await api.getInspections(vehicleId);
      const insp = inspections.find(i => i.id === btn.dataset.id);
      if (insp) openInspectionModal(insp, vehicleId, isAdmin);
    });
  });

  wrap.querySelectorAll('[data-action="del-insp"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Frist wirklich löschen?')) return;
      try {
        await api.deleteInspection(vehicleId, btn.dataset.id);
        toast('Frist gelöscht');
        await reloadInspections(vehicleId, isAdmin);
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

// ── Fahrzeug-Modal ─────────────────────────────────────────────────────────────

let editVehicleId = null;

function setupVehicleModal() {
  const close = () => {
    document.getElementById('modal-vehicle').style.display = 'none';
    editVehicleId = null;
  };
  document.getElementById('btn-close-vehicle-modal').addEventListener('click', close);
  document.getElementById('btn-cancel-vehicle').addEventListener('click', close);

  document.getElementById('btn-submit-vehicle').addEventListener('click', async () => {
    const name = document.getElementById('v-name').value.trim();
    if (!name) { toast('Name eingeben', 'error'); return; }

    const body = {
      name,
      short_name:        nvl('v-short-name'),
      opta:              nvl('v-opta'),
      vehicle_type:      document.getElementById('v-type').value,
      base_type:         nvl('v-base-type'),
      license_plate:     nvl('v-license-plate'),
      manufacturer:      nvl('v-manufacturer'),
      body_manufacturer: nvl('v-body-manufacturer'),
      year_built:        num('v-year-built'),
      chassis_number:    nvl('v-chassis'),
      strength_leadership: parseInt(document.getElementById('v-str-lead').value) || 0,
      strength_sub:        parseInt(document.getElementById('v-str-sub').value)  || 0,
      strength_crew:       parseInt(document.getElementById('v-str-crew').value) || 0,
      phone:             nvl('v-phone'),
      length_m:          flt('v-length'),
      width_m:           flt('v-width'),
      height_m:          flt('v-height'),
      weight_kg:         num('v-weight'),
      status:            document.getElementById('v-status').value,
      notes:             nvl('v-notes'),
    };

    try {
      if (editVehicleId) {
        await api.updateVehicle(editVehicleId, body);
        toast('Fahrzeug gespeichert');
      } else {
        await api.createVehicle(body);
        toast('Fahrzeug angelegt');
      }
      close();
      loadVehicleList(true);
    } catch (e) { toast(e.message, 'error'); }
  });
}

function openVehicleModal(v) {
  editVehicleId = v?.id || null;
  document.getElementById('modal-vehicle-title').textContent = v ? 'Fahrzeug bearbeiten' : 'Fahrzeug anlegen';

  document.getElementById('v-name').value           = v?.name           || '';
  document.getElementById('v-short-name').value     = v?.short_name     || '';
  document.getElementById('v-opta').value           = v?.opta           || '';
  document.getElementById('v-type').value           = v?.vehicle_type   || 'lkw';
  document.getElementById('v-base-type').value      = v?.base_type      || '';
  document.getElementById('v-license-plate').value  = v?.license_plate  || '';
  document.getElementById('v-manufacturer').value   = v?.manufacturer   || '';
  document.getElementById('v-body-manufacturer').value = v?.body_manufacturer || '';
  document.getElementById('v-year-built').value     = v?.year_built     || '';
  document.getElementById('v-chassis').value        = v?.chassis_number || '';
  document.getElementById('v-str-lead').value       = v?.strength_leadership ?? 0;
  document.getElementById('v-str-sub').value        = v?.strength_sub   ?? 0;
  document.getElementById('v-str-crew').value       = v?.strength_crew  ?? 0;
  document.getElementById('v-phone').value          = v?.phone          || '';
  document.getElementById('v-length').value         = v?.length_m       ?? '';
  document.getElementById('v-width').value          = v?.width_m        ?? '';
  document.getElementById('v-height').value         = v?.height_m       ?? '';
  document.getElementById('v-weight').value         = v?.weight_kg      ?? '';
  document.getElementById('v-status').value         = v?.status         || 'aktiv';
  document.getElementById('v-notes').value          = v?.notes          || '';

  document.getElementById('modal-vehicle').style.display = 'flex';
  document.getElementById('v-name').focus();
}

async function deleteVehicle(id, isAdmin) {
  if (!confirm('Fahrzeug wirklich löschen? Alle Fristen werden ebenfalls gelöscht.')) return;
  try {
    await api.deleteVehicle(id);
    toast('Fahrzeug gelöscht');
    loadVehicleList(isAdmin);
  } catch (e) { toast(e.message, 'error'); }
}

// ── Fristen-Modal ──────────────────────────────────────────────────────────────

let editInspectionId   = null;
let editInspectionVid  = null;

function setupInspectionModal(vehicleId, isAdmin) {
  const close = () => {
    document.getElementById('modal-inspection').style.display = 'none';
    editInspectionId = null;
    editInspectionVid = null;
  };
  document.getElementById('btn-close-inspection-modal').addEventListener('click', close);
  document.getElementById('btn-cancel-inspection').addEventListener('click', close);

  document.getElementById('btn-submit-inspection').addEventListener('click', async () => {
    const name = document.getElementById('insp-name').value.trim();
    if (!name) { toast('Bezeichnung eingeben', 'error'); return; }

    const body = {
      name,
      last_date:       document.getElementById('insp-last-date').value || null,
      next_date:       document.getElementById('insp-next-date').value || null,
      interval_months: num('insp-interval'),
      notes:           nvl('insp-notes'),
    };

    try {
      if (editInspectionId) {
        await api.updateInspection(editInspectionVid, editInspectionId, body);
        toast('Frist gespeichert');
      } else {
        await api.createInspection(vehicleId, body);
        toast('Frist angelegt');
      }
      close();
      await reloadInspections(vehicleId, isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

function openInspectionModal(insp, vehicleId, isAdmin) {
  editInspectionId  = insp?.id     || null;
  editInspectionVid = vehicleId;
  document.getElementById('modal-inspection-title').textContent = insp ? 'Frist bearbeiten' : 'Frist anlegen';
  document.getElementById('insp-name').value       = insp?.name            || '';
  document.getElementById('insp-last-date').value  = insp?.last_date       || '';
  document.getElementById('insp-next-date').value  = insp?.next_date       || '';
  document.getElementById('insp-interval').value   = insp?.interval_months || '';
  document.getElementById('insp-notes').value      = insp?.notes           || '';
  document.getElementById('modal-inspection').style.display = 'flex';
  document.getElementById('insp-name').focus();
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function nvl(id) {
  const v = document.getElementById(id)?.value?.trim();
  return v || null;
}

function num(id) {
  const v = parseInt(document.getElementById(id)?.value);
  return isNaN(v) ? null : v;
}

function flt(id) {
  const v = parseFloat(document.getElementById(id)?.value);
  return isNaN(v) ? null : v;
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
