import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';
import { esc } from '../utils.js';

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
            <input type="text" id="v-name" placeholder="z.B. HLF 20" maxlength="200" />
          </div>
          <div class="form-group">
            <label>Kurzname</label>
            <input type="text" id="v-short-name" placeholder="z.B. HLF" maxlength="50" />
          </div>
          <div class="form-group">
            <label>Funkkenner</label>
            <input type="text" id="v-opta" maxlength="50" />
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
            <input type="text" id="v-license-plate" maxlength="20" />
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
          <div class="form-group" style="grid-column:1/-1">
            <label>Besatzungsstärke
              <span style="font-size:11px;color:var(--text-muted);font-weight:400;margin-left:6px">Führung / Unterführung / Mannschaft (z.B. 0/1/8)</span>
            </label>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="number" id="v-str-lead" value="0" min="0" max="99"
                style="width:70px;text-align:center" title="Führung" />
              <span style="color:var(--text-muted);font-size:18px;font-weight:300">/</span>
              <input type="number" id="v-str-sub" value="0" min="0" max="99"
                style="width:70px;text-align:center" title="Unterführung" />
              <span style="color:var(--text-muted);font-size:18px;font-weight:300">/</span>
              <input type="number" id="v-str-crew" value="0" min="0" max="99"
                style="width:70px;text-align:center" title="Mannschaft" />
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
              style="width:100%;resize:vertical;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg-card-hover);color:var(--text)"
              placeholder="Freitext..."></textarea>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-vehicle">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-vehicle">Abbrechen</button>
        </div>
      </div>
    </div>

    <!-- Modal: Gerät anlegen / bearbeiten -->
    <div id="modal-equipment" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3 id="modal-equipment-title">Gerät anlegen</h3>
          <button class="modal__close" id="btn-close-equipment-modal">✕</button>
        </div>
        <div class="modal__body" style="display:grid;grid-template-columns:1fr 1fr;gap:12px 16px">
          <div class="form-group" style="grid-column:1/-1">
            <label>Bezeichnung <span style="color:#e63022">*</span></label>
            <input type="text" id="eq-name" maxlength="200" placeholder="z.B. Hydraulisches Rettungsgerät" />
          </div>
          <div class="form-group">
            <label>Seriennummer</label>
            <input type="text" id="eq-serial" maxlength="100" />
          </div>
          <div class="form-group">
            <label>Hersteller</label>
            <input type="text" id="eq-manufacturer" maxlength="100" />
          </div>
          <div class="form-group">
            <label>Baujahr</label>
            <input type="number" id="eq-year" min="1900" max="2100" />
          </div>
          <div class="form-group">
            <label>Status</label>
            <select id="eq-status">
              <option value="ok">In Ordnung</option>
              <option value="defekt">Defekt</option>
              <option value="ausgebaut">Ausgebaut</option>
            </select>
          </div>
          <div class="form-group">
            <label>Letzte Prüfung</label>
            <input type="date" id="eq-last" />
          </div>
          <div class="form-group">
            <label>Nächste Prüfung</label>
            <input type="date" id="eq-next" />
          </div>
          <div class="form-group">
            <label>Prüfintervall (Monate)</label>
            <input type="number" id="eq-interval" min="1" max="120" />
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Notiz</label>
            <input type="text" id="eq-notes" maxlength="500" />
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-equipment">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-equipment">Abbrechen</button>
        </div>
      </div>
    </div>

    <!-- Modal: Checklisten-Vorlage anlegen -->
    <div id="modal-template" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box" style="max-width:560px;width:100%">
        <div class="modal__header">
          <h3>Vorlage anlegen</h3>
          <button class="modal__close" id="btn-close-template-modal">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label>Name <span style="color:#e63022">*</span></label>
            <input type="text" id="tpl-name" maxlength="200" placeholder="z.B. Tagesdienstcheck" />
          </div>
          <div class="form-group">
            <label>Turnus</label>
            <select id="tpl-interval">
              <option value="manuell">Manuell</option>
              <option value="taeglich">Täglich</option>
              <option value="woechentlich">Wöchentlich</option>
              <option value="monatlich">Monatlich</option>
            </select>
          </div>
          <div class="form-group">
            <label>Prüfpunkte</label>
            <div id="tpl-items-wrap" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px"></div>
            <button type="button" class="btn btn--outline btn--sm" id="btn-add-tpl-item">+ Punkt hinzufügen</button>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-template">Vorlage speichern</button>
          <button class="btn btn--outline" id="btn-cancel-template">Abbrechen</button>
        </div>
      </div>
    </div>

    <!-- Modal: Checkliste ausfüllen -->
    <div id="modal-fill-checklist" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box" style="max-width:560px;width:100%">
        <div class="modal__header">
          <h3 id="modal-fill-title">Checkliste ausfüllen</h3>
          <button class="modal__close" id="btn-close-fill-modal">✕</button>
        </div>
        <div class="modal__body">
          <div id="fill-items-wrap"></div>
          <div class="form-group" style="margin-top:12px">
            <label>Gesamtnotiz</label>
            <textarea id="fill-notes" rows="2"
              style="width:100%;resize:vertical;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg-card-hover);color:var(--text)"></textarea>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-fill">Checkliste speichern</button>
          <button class="btn btn--outline" id="btn-cancel-fill">Abbrechen</button>
        </div>
      </div>
    </div>

    <!-- Modal: Fahrt anlegen / bearbeiten -->
    <div id="modal-trip" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3>Fahrt eintragen</h3>
          <button class="modal__close" id="btn-close-trip-modal">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label>Datum <span style="color:#e63022">*</span></label>
            <input type="date" id="trip-date" />
          </div>
          <div class="form-group">
            <label>Fahrer</label>
            <input type="text" id="trip-driver" maxlength="100" />
          </div>
          <div class="form-group">
            <label>Anlass</label>
            <select id="trip-reason">
              <option value="sonstiges">Sonstiges</option>
              <option value="uebung">Übung</option>
              <option value="einsatz">Einsatz</option>
              <option value="werkstatt">Werkstatt</option>
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label>km Start</label>
              <input type="number" id="trip-km-start" min="0" />
            </div>
            <div class="form-group">
              <label>km Ende</label>
              <input type="number" id="trip-km-end" min="0" />
            </div>
          </div>
          <div class="form-group">
            <label>Notiz</label>
            <input type="text" id="trip-notes" maxlength="500" />
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-trip">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-trip">Abbrechen</button>
        </div>
      </div>
    </div>

    <!-- Modal: Tankvorgang anlegen / bearbeiten -->
    <div id="modal-fueling" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3>Tankvorgang eintragen</h3>
          <button class="modal__close" id="btn-close-fueling-modal">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label>Datum <span style="color:#e63022">*</span></label>
            <input type="date" id="fueling-date" />
          </div>
          <div class="form-group">
            <label>km-Stand</label>
            <input type="number" id="fueling-km" min="0" />
          </div>
          <div class="form-group">
            <label>Liter</label>
            <input type="number" id="fueling-liters" step="0.1" min="0" />
          </div>
          <div class="form-group">
            <label>Kraftstoffart</label>
            <select id="fueling-type">
              <option value="diesel">Diesel</option>
              <option value="benzin">Benzin</option>
              <option value="adblue">AdBlue</option>
              <option value="strom">Strom</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </div>
          <div class="form-group">
            <label>Kosten (€)</label>
            <input type="number" id="fueling-cost" step="0.01" min="0" />
          </div>
          <div class="form-group">
            <label>Notiz</label>
            <input type="text" id="fueling-notes" maxlength="500" />
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-fueling">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-fueling">Abbrechen</button>
        </div>
      </div>
    </div>

    <!-- Modal: Störung melden -->
    <div id="modal-defect" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3>Störung melden</h3>
          <button class="modal__close" id="btn-close-defect-modal">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label>Titel <span style="color:#e63022">*</span></label>
            <input type="text" id="defect-title" maxlength="200" placeholder="Kurze Beschreibung des Defekts" />
          </div>
          <div class="form-group">
            <label>Beschreibung</label>
            <textarea id="defect-desc" rows="3"
              style="width:100%;resize:vertical;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg-card-hover);color:var(--text)"
              placeholder="Details zum Defekt..."></textarea>
          </div>
          <div class="form-group">
            <label>Priorität</label>
            <select id="defect-priority">
              <option value="niedrig">Niedrig</option>
              <option value="mittel" selected>Mittel</option>
              <option value="hoch">Hoch</option>
              <option value="kritisch">⚠ Kritisch (Fahrzeug wird auf Wartung gesetzt)</option>
            </select>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-defect">Melden</button>
          <button class="btn btn--outline" id="btn-cancel-defect">Abbrechen</button>
        </div>
      </div>
    </div>

    <!-- Modal: Defekt-Status ändern -->
    <div id="modal-dstatus" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3>Status aktualisieren</h3>
          <button class="modal__close" id="btn-close-dstatus-modal">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label>Status</label>
            <select id="dstatus-select">
              <option value="offen">Offen</option>
              <option value="in_bearbeitung">In Bearbeitung</option>
              <option value="behoben">Behoben</option>
              <option value="nicht_reproduzierbar">Nicht reproduzierbar</option>
            </select>
          </div>
          <div class="form-group">
            <label>Lösungsnotiz</label>
            <input type="text" id="dstatus-note" maxlength="500" placeholder="Was wurde gemacht?" />
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-dstatus">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-dstatus">Abbrechen</button>
        </div>
      </div>
    </div>

    <!-- Modal: Kommentare -->
    <div id="modal-comments" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3>Kommentare</h3>
          <button class="modal__close" id="btn-close-comments-modal">✕</button>
        </div>
        <div class="modal__body">
          <div id="comments-list" style="max-height:280px;overflow-y:auto;margin-bottom:16px"></div>
          <div class="form-group">
            <label>Kommentar hinzufügen</label>
            <textarea id="comment-body" rows="2"
              style="width:100%;resize:vertical;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg-card-hover);color:var(--text)"
              placeholder="Statusupdate, Rückfrage..."></textarea>
          </div>
          <button class="btn btn--primary" id="btn-submit-comment">Kommentar senden</button>
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
  listWrap.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Lade...</p>';

  try {
    const vehicles = await api.getVehicles();

    if (!vehicles.length) {
      listWrap.innerHTML = `
        <div class="card">
          <div class="card__body" style="text-align:center;padding:32px;color:var(--text-muted)">
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
            ${v.short_name ? `<span style="color:var(--text-muted);font-size:11px;margin-left:6px">${esc(v.short_name)}</span>` : ''}
          </td>
          <td style="padding:10px 16px;color:var(--text-muted)">${esc(TYPE_LABELS[v.vehicle_type] || v.vehicle_type)}</td>
          <td style="padding:10px 16px;color:var(--text-muted)">${esc(v.base_type || '–')}</td>
          <td style="padding:10px 16px;color:var(--text-muted)">${esc(v.license_plate || '–')}</td>
          <td style="padding:10px 16px;color:var(--text-muted)">${strength}</td>
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
            style="background:var(--bg-card-hover);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:6px;font-size:13px;width:200px" />
        </div>
        <div class="card__body" style="padding:0">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="background:var(--bg-card-hover)">
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Fahrzeug</th>
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Typ</th>
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Grund-Typ</th>
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Kennzeichen</th>
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Stärke (F/U/M)</th>
                <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Status</th>
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
    tr.style.borderBottom = '1px solid var(--border)';
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
  detailWrap.innerHTML     = '<p style="color:var(--text-muted);font-size:13px">Lade...</p>';

  try {
    const v = await api.getVehicle(id);
    const statusColor = STATUS_COLORS[v.status] || '#7d8590';
    const statusLabel = STATUS_LABELS[v.status] || v.status;

    detailWrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
        <button class="btn btn--outline btn--sm" id="btn-back-vehicles">← Zurück</button>
        <h2 style="margin:0;font-size:18px;font-weight:700;color:var(--text)">${esc(v.name)}</h2>
        <span style="color:${statusColor};font-size:12px;font-weight:600;background:${statusColor}22;padding:3px 10px;border-radius:20px">${statusLabel}</span>
        ${isAdmin ? `
          <div style="margin-left:auto;display:flex;gap:8px">
            <button class="btn btn--outline btn--sm" id="btn-edit-vehicle">Bearbeiten</button>
            <button class="btn btn--danger btn--sm" id="btn-delete-vehicle">Löschen</button>
          </div>` : ''}
      </div>

      <!-- Tabs -->
      <div style="display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:0;flex-wrap:wrap">
        <button class="v-tab active" data-tab="uebersicht"  style="padding:8px 16px;background:none;border:none;color:var(--text);font-size:13px;font-weight:600;cursor:pointer;border-bottom:2px solid #e63022;margin-bottom:-1px;font-family:inherit">Übersicht</button>
        <button class="v-tab"        data-tab="fahrtenbuch" style="padding:8px 16px;background:none;border:none;color:var(--text-muted);font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:inherit">Fahrtenbuch</button>
        <button class="v-tab"        data-tab="stoerungen"  style="padding:8px 16px;background:none;border:none;color:var(--text-muted);font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:inherit">Störungen</button>
        <button class="v-tab"        data-tab="geraete"     style="padding:8px 16px;background:none;border:none;color:var(--text-muted);font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:inherit">Geräte</button>
        <button class="v-tab"        data-tab="checklisten" style="padding:8px 16px;background:none;border:none;color:var(--text-muted);font-size:13px;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;font-family:inherit">Checklisten</button>
      </div>

      <div id="tab-uebersicht">
        <div class="card" style="margin-bottom:20px">
          <div class="card__header">Stammdaten</div>
          <div class="card__body">
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px 24px;font-size:13px">
              ${field('Kurzname',         v.short_name)}
              ${field('Funkkenner',       v.opta)}
              ${field('Typ',              TYPE_LABELS[v.vehicle_type] || v.vehicle_type)}
              ${field('Grund-Typ',        v.base_type)}
              ${field('Kennzeichen',      v.license_plate)}
              ${field('Hersteller',       v.manufacturer)}
              ${field('Aufbauhersteller', v.body_manufacturer)}
              ${field('Baujahr',          v.year_built)}
              ${field('Fahrgestell-Nr.',  v.chassis_number)}
              ${field('Stärke (F/U/M)',   `${v.strength_leadership}/${v.strength_sub}/${v.strength_crew}`)}
              ${field('Ersatzfahrzeug',   v.replacement_name || null)}
              ${field('Telefon',          v.phone)}
              ${field('Länge',            v.length_m  != null ? v.length_m  + ' m'  : null)}
              ${field('Breite',           v.width_m   != null ? v.width_m   + ' m'  : null)}
              ${field('Höhe',             v.height_m  != null ? v.height_m  + ' m'  : null)}
              ${field('Gesamtgewicht',    v.weight_kg != null ? v.weight_kg + ' kg' : null)}
            </div>
            ${v.notes ? `<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);font-size:13px;color:var(--text-muted);white-space:pre-wrap">${esc(v.notes)}</div>` : ''}
          </div>
        </div>
        <div class="card">
          <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
            <span>Fristen & Prüfungen</span>
            ${isAdmin ? `<button class="btn btn--primary btn--sm" id="btn-new-inspection">+ Frist</button>` : ''}
          </div>
          <div id="inspections-wrap"><p style="color:var(--text-muted);font-size:13px;padding:16px">Lade...</p></div>
        </div>
      </div>

      <div id="tab-fahrtenbuch" style="display:none">
        <div class="card" style="margin-bottom:20px">
          <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
            <span>Fahrtenprotokoll</span>
            <button class="btn btn--primary btn--sm" id="btn-new-trip">+ Fahrt</button>
          </div>
          <div id="trips-wrap"><p style="color:var(--text-muted);font-size:13px;padding:16px">Lade...</p></div>
        </div>
        <div class="card">
          <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
            <span>Tankprotokoll</span>
            <button class="btn btn--primary btn--sm" id="btn-new-fueling">+ Tankvorgang</button>
          </div>
          <div id="fuelings-wrap"><p style="color:var(--text-muted);font-size:13px;padding:16px">Lade...</p></div>
        </div>
      </div>

      <div id="tab-stoerungen" style="display:none">
        <div class="card">
          <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
            <span>Störungsmeldungen</span>
            <button class="btn btn--primary btn--sm" id="btn-new-defect">+ Störung melden</button>
          </div>
          <div id="defects-wrap"><p style="color:var(--text-muted);font-size:13px;padding:16px">Lade...</p></div>
        </div>
      </div>

      <div id="tab-geraete" style="display:none">
        <div class="card">
          <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
            <span>Beladung & Ausrüstung</span>
            ${isAdmin ? `<button class="btn btn--primary btn--sm" id="btn-new-equipment">+ Gerät</button>` : ''}
          </div>
          <div id="equipment-wrap"><p style="color:var(--text-muted);font-size:13px;padding:16px">Lade...</p></div>
        </div>
      </div>

      <div id="tab-checklisten" style="display:none">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
          <div class="card">
            <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
              <span>Vorlagen</span>
              ${isAdmin ? `<button class="btn btn--primary btn--sm" id="btn-new-template">+ Vorlage</button>` : ''}
            </div>
            <div id="templates-wrap"><p style="color:var(--text-muted);font-size:13px;padding:16px">Lade...</p></div>
          </div>
          <div class="card">
            <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
              <span>Historie</span>
            </div>
            <div id="checklists-wrap"><p style="color:var(--text-muted);font-size:13px;padding:16px">Lade...</p></div>
          </div>
        </div>
      </div>
    `;

    // Tab-Logik
    document.querySelectorAll('.v-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.v-tab').forEach(b => {
          b.style.color = '#7d8590';
          b.style.borderBottomColor = 'transparent';
          b.style.fontWeight = '500';
          b.classList.remove('active');
        });
        btn.style.color = '#e6edf3';
        btn.style.borderBottomColor = '#e63022';
        btn.style.fontWeight = '600';
        btn.classList.add('active');
        document.querySelectorAll('[id^="tab-"]').forEach(p => p.style.display = 'none');
        document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
      });
    });

    document.getElementById('btn-back-vehicles').addEventListener('click', () => loadVehicleList(isAdmin));

    // Übersicht laden
    api.getInspections(id).then(insp => {
      const w = document.getElementById('inspections-wrap');
      if (w) w.innerHTML = renderInspectionsTable(insp, isAdmin);
      if (isAdmin) bindInspectionActions(id, isAdmin);
    });

    // Fahrtenbuch lazy laden beim Tab-Wechsel
    document.querySelector('[data-tab="fahrtenbuch"]').addEventListener('click', () => {
      loadTrips(id, isAdmin);
      loadFuelings(id, isAdmin);
    }, { once: true });

    document.querySelector('[data-tab="stoerungen"]').addEventListener('click', () => {
      loadDefects(id, isAdmin);
    }, { once: true });

    document.querySelector('[data-tab="geraete"]').addEventListener('click', () => {
      loadEquipment(id, isAdmin);
    }, { once: true });

    document.querySelector('[data-tab="checklisten"]').addEventListener('click', () => {
      loadTemplates(id, isAdmin);
      loadChecklists(id, isAdmin);
    }, { once: true });

    // Für alle Nutzer: Fahrtenbuch, Tankprotokoll, Störungsmeldung
    document.getElementById('btn-new-trip').addEventListener('click', () => openTripModal(null, id, isAdmin));
    document.getElementById('btn-new-fueling').addEventListener('click', () => openFuelingModal(null, id, isAdmin));
    document.getElementById('btn-new-defect').addEventListener('click', () => openDefectModal(id, isAdmin));
    setupTripModal(id, isAdmin);
    setupFuelingModal(id, isAdmin);
    setupDefectModal(id, isAdmin);

    if (isAdmin) {
      document.getElementById('btn-edit-vehicle').addEventListener('click', () => openVehicleModal(v));
      document.getElementById('btn-delete-vehicle').addEventListener('click', () => deleteVehicle(id, isAdmin));
      document.getElementById('btn-new-inspection').addEventListener('click', () => openInspectionModal(null, id, isAdmin));
      document.getElementById('btn-new-equipment')?.addEventListener('click', () => openEquipmentModal(null, id, isAdmin));
      document.getElementById('btn-new-template')?.addEventListener('click', () => openTemplateModal(id, isAdmin));
      setupInspectionModal(id, isAdmin);
      setupEquipmentModal(id, isAdmin);
      setupTemplateModal(id, isAdmin);
    }

  } catch (e) {
    detailWrap.innerHTML = `<p style="color:#ff8a80">${esc(e.message)}</p>`;
  }
}

function field(label, value) {
  if (value == null || value === '') return '';
  return `
    <div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">${label}</div>
      <div style="color:var(--text);font-weight:500">${esc(String(value))}</div>
    </div>`;
}

// ── Fristen-Tabelle ────────────────────────────────────────────────────────────

function ampelDot(nextDate) {
  if (!nextDate) return '<span style="color:var(--text-muted)">•</span>';
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
    return `<div class="card__body" style="color:var(--text-muted);font-size:13px">Keine Fristen eingetragen.</div>`;
  }
  const rows = inspections.map(insp => `
    <tr class="insp-row" data-id="${insp.id}">
      <td style="padding:10px 16px">${ampelDot(insp.next_date)}</td>
      <td style="padding:10px 16px;color:var(--text)">${esc(insp.name)}</td>
      <td style="padding:10px 16px;color:var(--text-muted)">${insp.last_date ? formatDate(insp.last_date) : '–'}</td>
      <td style="padding:10px 16px;color:var(--text-muted)">${insp.next_date ? formatDate(insp.next_date) : '–'}</td>
      <td style="padding:10px 16px;color:var(--text-muted)">${insp.interval_months ? insp.interval_months + ' Monate' : '–'}</td>
      <td style="padding:10px 16px;color:var(--text-muted);font-size:12px">${esc(insp.notes || '')}</td>
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
        <tr style="background:var(--bg-card-hover)">
          <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);width:28px"></th>
          <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Bezeichnung</th>
          <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Letztes Datum</th>
          <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Nächstes Datum</th>
          <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Intervall</th>
          <th style="padding:10px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Notiz</th>
          <th style="padding:10px 16px;border-bottom:1px solid var(--border)"></th>
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
  ['btn-close-inspection-modal', 'btn-cancel-inspection'].forEach(btnId => {
    const old = document.getElementById(btnId);
    const fresh = old.cloneNode(true);
    old.parentNode.replaceChild(fresh, old);
    fresh.addEventListener('click', close);
  });

  const submitOld = document.getElementById('btn-submit-inspection');
  const submitBtn = submitOld.cloneNode(true);
  submitOld.parentNode.replaceChild(submitBtn, submitOld);
  submitBtn.addEventListener('click', async () => {
    const name = document.getElementById('insp-name').value.trim();
    if (!name) { toast('Bezeichnung eingeben', 'error'); return; }

    const body = {
      name,
      last_date:       document.getElementById('insp-last-date').value || null,
      next_date:       document.getElementById('insp-next-date').value || null,
      interval_months: num('insp-interval'),
      notes:           nvl('insp-notes'),
    };

    submitBtn.disabled = true;
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
    finally { submitBtn.disabled = false; }
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

// ── Fahrtenbuch ────────────────────────────────────────────────────────────────

const REASON_LABELS = {
  uebung:    'Übung',
  einsatz:   'Einsatz',
  werkstatt: 'Werkstatt',
  sonstiges: 'Sonstiges',
};

const FUEL_LABELS = {
  diesel:    'Diesel',
  benzin:    'Benzin',
  adblue:    'AdBlue',
  strom:     'Strom',
  sonstiges: 'Sonstiges',
};

async function loadTrips(vehicleId, isAdmin) {
  const wrap = document.getElementById('trips-wrap');
  if (!wrap) return;
  try {
    const trips = await api.getTrips(vehicleId);
    if (!trips.length) {
      wrap.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-size:13px">Keine Fahrten eingetragen.</div>`;
      return;
    }
    const rows = trips.map(t => {
      const km = (t.km_start != null && t.km_end != null)
        ? `${t.km_start} → ${t.km_end} (${t.km_end - t.km_start} km)`
        : (t.km_start != null ? `ab ${t.km_start} km` : '–');
      return `<tr class="trip-row">
        <td style="padding:9px 16px;color:var(--text-muted)">${formatDate(t.trip_date)}</td>
        <td style="padding:9px 16px;color:var(--text)">${esc(t.driver || '–')}</td>
        <td style="padding:9px 16px;color:var(--text-muted)">${REASON_LABELS[t.reason] || t.reason}</td>
        <td style="padding:9px 16px;color:var(--text-muted)">${km}</td>
        <td style="padding:9px 16px;color:var(--text-muted);font-size:12px">${esc(t.notes || '')}</td>
        ${isAdmin ? `<td style="padding:9px 16px">
          <div class="btn-group">
            <button class="btn btn--outline btn--sm" data-action="edit-trip" data-id="${t.id}">Bearb.</button>
            <button class="btn btn--danger btn--sm"  data-action="del-trip"  data-id="${t.id}">Löschen</button>
          </div></td>` : '<td></td>'}
      </tr>`;
    }).join('');
    wrap.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:var(--bg-card-hover)">
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Datum</th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Fahrer</th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Anlass</th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Kilometer</th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Notiz</th>
        <th style="border-bottom:1px solid var(--border)"></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
    styleGenericRows('trip-row');

    // Letzten km_end als Standard-km_start für neue Fahrt vorbelegen
    const lastKmEnd = trips[0]?.km_end ?? null;
    const newTripBtn = document.getElementById('btn-new-trip');
    if (newTripBtn) {
      newTripBtn.onclick = () => openTripModal(null, vehicleId, isAdmin, lastKmEnd);
    }

    if (isAdmin) {
      wrap.querySelectorAll('[data-action="del-trip"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Fahrt löschen?')) return;
          try { await api.deleteTrip(vehicleId, btn.dataset.id); toast('Fahrt gelöscht'); loadTrips(vehicleId, isAdmin); }
          catch (e) { toast(e.message, 'error'); }
        });
      });
      wrap.querySelectorAll('[data-action="edit-trip"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const all = await api.getTrips(vehicleId);
          openTripModal(all.find(t => t.id === btn.dataset.id), vehicleId, isAdmin);
        });
      });
    }
  } catch (e) { wrap.innerHTML = `<p style="color:#ff8a80;padding:16px">${esc(e.message)}</p>`; }
}

async function loadFuelings(vehicleId, isAdmin) {
  const wrap = document.getElementById('fuelings-wrap');
  if (!wrap) return;
  try {
    const fuelings = await api.getFuelings(vehicleId);
    if (!fuelings.length) {
      wrap.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-size:13px">Keine Tankvorgänge eingetragen.</div>`;
      return;
    }
    const rows = fuelings.map(f => `
      <tr class="fueling-row">
        <td style="padding:9px 16px;color:var(--text-muted)">${formatDate(f.fueling_date)}</td>
        <td style="padding:9px 16px;color:var(--text-muted)">${f.km_stand != null ? f.km_stand + ' km' : '–'}</td>
        <td style="padding:9px 16px;color:var(--text)">${f.liters != null ? f.liters.toFixed(1) + ' L' : '–'}</td>
        <td style="padding:9px 16px;color:var(--text-muted)">${FUEL_LABELS[f.fuel_type] || f.fuel_type}</td>
        <td style="padding:9px 16px;color:var(--text-muted)">${f.cost_eur != null ? f.cost_eur.toFixed(2) + ' €' : '–'}</td>
        ${isAdmin ? `<td style="padding:9px 16px">
          <div class="btn-group">
            <button class="btn btn--outline btn--sm" data-action="edit-fueling" data-id="${f.id}">Bearb.</button>
            <button class="btn btn--danger btn--sm"  data-action="del-fueling"  data-id="${f.id}">Löschen</button>
          </div></td>` : '<td></td>'}
      </tr>`).join('');
    wrap.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:var(--bg-card-hover)">
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Datum</th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">km-Stand</th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Liter</th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Kraftstoff</th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Kosten</th>
        <th style="border-bottom:1px solid var(--border)"></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
    styleGenericRows('fueling-row');
    if (isAdmin) {
      wrap.querySelectorAll('[data-action="del-fueling"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Tankvorgang löschen?')) return;
          try { await api.deleteFueling(vehicleId, btn.dataset.id); toast('Tankvorgang gelöscht'); loadFuelings(vehicleId, isAdmin); }
          catch (e) { toast(e.message, 'error'); }
        });
      });
      wrap.querySelectorAll('[data-action="edit-fueling"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const all = await api.getFuelings(vehicleId);
          openFuelingModal(all.find(f => f.id === btn.dataset.id), vehicleId, isAdmin);
        });
      });
    }
  } catch (e) { wrap.innerHTML = `<p style="color:#ff8a80;padding:16px">${esc(e.message)}</p>`; }
}

// ── Trip-Modal ─────────────────────────────────────────────────────────────────

let editTripId = null;

function setupTripModal(vehicleId, isAdmin) {
  const modalId = 'modal-trip';
  const close = () => { document.getElementById(modalId).style.display = 'none'; editTripId = null; };
  ['btn-close-trip-modal', 'btn-cancel-trip'].forEach(btnId => {
    const old = document.getElementById(btnId);
    const fresh = old.cloneNode(true);
    old.parentNode.replaceChild(fresh, old);
    fresh.addEventListener('click', close);
  });

  const submitOld = document.getElementById('btn-submit-trip');
  const submitBtn = submitOld.cloneNode(true);
  submitOld.parentNode.replaceChild(submitBtn, submitOld);
  submitBtn.addEventListener('click', async () => {
    const dateVal = document.getElementById('trip-date').value;
    if (!dateVal) { toast('Datum eingeben', 'error'); return; }
    const body = {
      trip_date: dateVal,
      driver:    nvl('trip-driver'),
      reason:    document.getElementById('trip-reason').value,
      km_start:  num('trip-km-start'),
      km_end:    num('trip-km-end'),
      notes:     nvl('trip-notes'),
    };
    submitBtn.disabled = true;
    try {
      if (editTripId) { await api.updateTrip(vehicleId, editTripId, body); toast('Fahrt gespeichert'); }
      else            { await api.createTrip(vehicleId, body);             toast('Fahrt eingetragen'); }
      close();
      loadTrips(vehicleId, isAdmin);
    } catch (e) { toast(e.message, 'error'); }
    finally { submitBtn.disabled = false; }
  });
}

function openTripModal(t, vehicleId, isAdmin, defaultKmStart = null) {
  editTripId = t?.id || null;
  document.getElementById('trip-date').value     = t?.trip_date    || new Date().toISOString().slice(0,10);
  document.getElementById('trip-driver').value   = t?.driver       || '';
  document.getElementById('trip-reason').value   = t?.reason       || 'sonstiges';
  document.getElementById('trip-km-start').value = t?.km_start     ?? defaultKmStart ?? '';
  document.getElementById('trip-km-end').value   = t?.km_end       ?? '';
  document.getElementById('trip-notes').value    = t?.notes        || '';
  document.getElementById('modal-trip').style.display = 'flex';
}

// ── Fueling-Modal ──────────────────────────────────────────────────────────────

let editFuelingId = null;

function setupFuelingModal(vehicleId, isAdmin) {
  const close = () => { document.getElementById('modal-fueling').style.display = 'none'; editFuelingId = null; };
  ['btn-close-fueling-modal', 'btn-cancel-fueling'].forEach(btnId => {
    const old = document.getElementById(btnId);
    const fresh = old.cloneNode(true);
    old.parentNode.replaceChild(fresh, old);
    fresh.addEventListener('click', close);
  });

  const submitOld = document.getElementById('btn-submit-fueling');
  const submitBtn = submitOld.cloneNode(true);
  submitOld.parentNode.replaceChild(submitBtn, submitOld);
  submitBtn.addEventListener('click', async () => {
    const dateVal = document.getElementById('fueling-date').value;
    if (!dateVal) { toast('Datum eingeben', 'error'); return; }
    const body = {
      fueling_date: dateVal,
      km_stand:     num('fueling-km'),
      liters:       flt('fueling-liters'),
      fuel_type:    document.getElementById('fueling-type').value,
      cost_eur:     flt('fueling-cost'),
      notes:        nvl('fueling-notes'),
    };
    submitBtn.disabled = true;
    try {
      if (editFuelingId) { await api.updateFueling(vehicleId, editFuelingId, body); toast('Tankvorgang gespeichert'); }
      else               { await api.createFueling(vehicleId, body);                toast('Tankvorgang eingetragen'); }
      close();
      loadFuelings(vehicleId, isAdmin);
    } catch (e) { toast(e.message, 'error'); }
    finally { submitBtn.disabled = false; }
  });
}

function openFuelingModal(f, vehicleId, isAdmin) {
  editFuelingId = f?.id || null;
  document.getElementById('fueling-date').value   = f?.fueling_date || new Date().toISOString().slice(0,10);
  document.getElementById('fueling-km').value     = f?.km_stand     ?? '';
  document.getElementById('fueling-liters').value = f?.liters       ?? '';
  document.getElementById('fueling-type').value   = f?.fuel_type    || 'diesel';
  document.getElementById('fueling-cost').value   = f?.cost_eur     ?? '';
  document.getElementById('fueling-notes').value  = f?.notes        || '';
  document.getElementById('modal-fueling').style.display = 'flex';
}

// ── Störungsmeldungen ──────────────────────────────────────────────────────────

const PRIORITY_COLORS = { niedrig: '#7d8590', mittel: '#f0a500', hoch: '#e63022', kritisch: '#e63022' };
const PRIORITY_LABELS = { niedrig: 'Niedrig', mittel: 'Mittel', hoch: 'Hoch', kritisch: '⚠ Kritisch' };
const DEFECT_STATUS_LABELS = {
  offen: 'Offen', in_bearbeitung: 'In Bearbeitung',
  behoben: 'Behoben', nicht_reproduzierbar: 'Nicht reproduzierbar',
};
const DEFECT_STATUS_COLORS = {
  offen: '#e63022', in_bearbeitung: '#f0a500',
  behoben: '#3fb950', nicht_reproduzierbar: '#7d8590',
};

async function loadDefects(vehicleId, isAdmin) {
  const wrap = document.getElementById('defects-wrap');
  if (!wrap) return;
  try {
    const defects = await api.getDefects(vehicleId);
    if (!defects.length) {
      wrap.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-size:13px">Keine Störungsmeldungen vorhanden.</div>`;
      return;
    }
    wrap.innerHTML = defects.map(d => {
      const sc = DEFECT_STATUS_COLORS[d.status] || '#7d8590';
      const sl = DEFECT_STATUS_LABELS[d.status] || d.status;
      const pc = PRIORITY_COLORS[d.priority]    || '#7d8590';
      const pl = PRIORITY_LABELS[d.priority]    || d.priority;
      return `
        <div class="defect-card" data-id="${d.id}" style="border-bottom:1px solid var(--border);padding:14px 16px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-size:13px;font-weight:600;color:var(--text)">${esc(d.title)}</span>
                <span style="font-size:11px;color:${pc};font-weight:600">${pl}</span>
                <span style="font-size:11px;color:${sc};background:${sc}22;padding:2px 8px;border-radius:20px;font-weight:600">${sl}</span>
              </div>
              ${d.description ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">${esc(d.description)}</div>` : ''}
              <div style="font-size:11px;color:#4c5462">
                Gemeldet von ${esc(d.reported_by_name || 'Unbekannt')} · ${formatDateTime(d.reported_at)}
                ${d.resolved_at ? ` · Behoben: ${formatDateTime(d.resolved_at)}` : ''}
              </div>
              ${d.resolution_note ? `<div style="font-size:12px;color:#3fb950;margin-top:4px">Lösung: ${esc(d.resolution_note)}</div>` : ''}
            </div>
            ${isAdmin ? `
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn--outline btn--sm" data-action="status-defect" data-id="${d.id}"
                data-status="${d.status}" data-note="${esc(d.resolution_note || '')}">Status</button>
              <button class="btn btn--outline btn--sm" data-action="comments-defect" data-id="${d.id}">Kommentare</button>
              <button class="btn btn--danger btn--sm"  data-action="del-defect"     data-id="${d.id}">Löschen</button>
            </div>` : `
            <button class="btn btn--outline btn--sm" data-action="comments-defect" data-id="${d.id}">Kommentare</button>`}
          </div>
        </div>`;
    }).join('');

    wrap.querySelectorAll('[data-action="del-defect"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Störungsmeldung löschen?')) return;
        try { await api.deleteDefect(vehicleId, btn.dataset.id); toast('Gelöscht'); loadDefects(vehicleId, isAdmin); }
        catch (e) { toast(e.message, 'error'); }
      });
    });

    wrap.querySelectorAll('[data-action="status-defect"]').forEach(btn => {
      btn.addEventListener('click', () => openStatusModal(vehicleId, btn.dataset.id, btn.dataset.status, btn.dataset.note, isAdmin));
    });

    wrap.querySelectorAll('[data-action="comments-defect"]').forEach(btn => {
      btn.addEventListener('click', () => openCommentsModal(vehicleId, btn.dataset.id, isAdmin));
    });

  } catch (e) { wrap.innerHTML = `<p style="color:#ff8a80;padding:16px">${esc(e.message)}</p>`; }
}

function setupDefectModal(vehicleId, isAdmin) {
  const close = () => document.getElementById('modal-defect').style.display = 'none';

  // cloneNode entfernt alte gestapelte Listener (gleicher Fix wie openStatusModal)
  ['btn-close-defect-modal', 'btn-cancel-defect'].forEach(btnId => {
    const old = document.getElementById(btnId);
    const fresh = old.cloneNode(true);
    old.parentNode.replaceChild(fresh, old);
    fresh.addEventListener('click', close);
  });

  const submitOld = document.getElementById('btn-submit-defect');
  const submitBtn = submitOld.cloneNode(true);
  submitOld.parentNode.replaceChild(submitBtn, submitOld);
  submitBtn.addEventListener('click', async () => {
    const title = document.getElementById('defect-title').value.trim();
    if (!title) { toast('Titel eingeben', 'error'); return; }
    const body = {
      title,
      description: nvl('defect-desc'),
      priority:    document.getElementById('defect-priority').value,
    };
    submitBtn.disabled = true;
    try {
      await api.createDefect(vehicleId, body);
      toast('Störung gemeldet');
      close();
      loadDefects(vehicleId, isAdmin);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function openDefectModal(vehicleId, isAdmin) {
  document.getElementById('defect-title').value    = '';
  document.getElementById('defect-desc').value     = '';
  document.getElementById('defect-priority').value = 'mittel';
  document.getElementById('modal-defect').style.display = 'flex';
}

function openStatusModal(vehicleId, defectId, currentStatus, currentNote, isAdmin) {
  document.getElementById('dstatus-select').value = currentStatus;
  document.getElementById('dstatus-note').value   = currentNote || '';
  document.getElementById('modal-dstatus').style.display = 'flex';

  const close = () => document.getElementById('modal-dstatus').style.display = 'none';
  const submitBtn = document.getElementById('btn-submit-dstatus');
  const newBtn = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newBtn, submitBtn);
  document.getElementById('btn-close-dstatus-modal').onclick = close;
  document.getElementById('btn-cancel-dstatus').onclick = close;
  newBtn.addEventListener('click', async () => {
    const body = {
      status:          document.getElementById('dstatus-select').value,
      resolution_note: nvl('dstatus-note'),
    };
    try {
      await api.updateDefectStatus(vehicleId, defectId, body);
      toast('Status aktualisiert');
      close();
      loadDefects(vehicleId, isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

async function openCommentsModal(vehicleId, defectId, isAdmin) {
  document.getElementById('modal-comments').style.display = 'flex';
  document.getElementById('comments-list').innerHTML = '<p style="color:var(--text-muted);font-size:13px">Lade...</p>';

  const reload = async () => {
    const comments = await api.getDefectComments(vehicleId, defectId);
    const list = document.getElementById('comments-list');
    list.innerHTML = comments.length
      ? comments.map(c => `
          <div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="font-size:11px;color:#4c5462;margin-bottom:3px">${esc(c.author_name || 'Unbekannt')} · ${formatDateTime(c.created_at)}</div>
            <div style="font-size:13px;color:var(--text)">${esc(c.body)}</div>
          </div>`).join('')
      : `<p style="color:var(--text-muted);font-size:13px">Noch keine Kommentare.</p>`;
  };

  await reload();

  const close = () => document.getElementById('modal-comments').style.display = 'none';
  document.getElementById('btn-close-comments-modal').onclick = close;

  const submitBtn = document.getElementById('btn-submit-comment');
  const newBtn = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newBtn, submitBtn);
  newBtn.addEventListener('click', async () => {
    const text = document.getElementById('comment-body').value.trim();
    if (!text) return;
    try {
      await api.createDefectComment(vehicleId, defectId, { body: text });
      document.getElementById('comment-body').value = '';
      await reload();
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ── Geräte / Beladungsliste ────────────────────────────────────────────────────

const EQ_STATUS_LABELS = { ok: 'In Ordnung', defekt: 'Defekt', ausgebaut: 'Ausgebaut' };
const EQ_STATUS_COLORS = { ok: '#3fb950', defekt: '#e63022', ausgebaut: '#7d8590' };

async function loadEquipment(vehicleId, isAdmin) {
  const wrap = document.getElementById('equipment-wrap');
  if (!wrap) return;
  try {
    const items = await api.getEquipment(vehicleId);
    if (!items.length) {
      wrap.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-size:13px">Keine Geräte eingetragen.</div>`;
      return;
    }
    const rows = items.map(e => {
      const sc = EQ_STATUS_COLORS[e.status] || '#7d8590';
      const sl = EQ_STATUS_LABELS[e.status] || e.status;
      return `<tr class="eq-row">
        <td style="padding:9px 16px;color:var(--text);font-weight:500">${esc(e.name)}</td>
        <td style="padding:9px 16px;color:var(--text-muted)">${esc(e.serial_number || '–')}</td>
        <td style="padding:9px 16px;color:var(--text-muted)">${esc(e.manufacturer || '–')}</td>
        <td style="padding:9px 16px">${ampelDot(e.next_inspection)}</td>
        <td style="padding:9px 16px;color:var(--text-muted)">${e.next_inspection ? formatDate(e.next_inspection) : '–'}</td>
        <td style="padding:9px 16px"><span style="color:${sc};font-size:12px;font-weight:600">${sl}</span></td>
        ${isAdmin ? `<td style="padding:9px 16px">
          <div class="btn-group">
            <button class="btn btn--outline btn--sm" data-action="edit-eq" data-id="${e.id}">Bearb.</button>
            <button class="btn btn--danger btn--sm"  data-action="del-eq"  data-id="${e.id}">Löschen</button>
          </div></td>` : '<td></td>'}
      </tr>`;
    }).join('');
    wrap.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:var(--bg-card-hover)">
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Bezeichnung</th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Seriennummer</th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Hersteller</th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);width:28px"></th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Nächste Prüfung</th>
        <th style="padding:9px 16px;color:var(--text-muted);font-weight:600;border-bottom:1px solid var(--border);text-align:left">Status</th>
        <th style="border-bottom:1px solid var(--border)"></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
    styleGenericRows('eq-row');
    if (isAdmin) {
      wrap.querySelectorAll('[data-action="del-eq"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Gerät löschen?')) return;
          try { await api.deleteEquipment(vehicleId, btn.dataset.id); toast('Gerät gelöscht'); loadEquipment(vehicleId, isAdmin); }
          catch (e) { toast(e.message, 'error'); }
        });
      });
      wrap.querySelectorAll('[data-action="edit-eq"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const all = await api.getEquipment(vehicleId);
          openEquipmentModal(all.find(e => e.id === btn.dataset.id), vehicleId, isAdmin);
        });
      });
    }
  } catch (e) { wrap.innerHTML = `<p style="color:#ff8a80;padding:16px">${esc(e.message)}</p>`; }
}

let editEquipmentId = null;

function setupEquipmentModal(vehicleId, isAdmin) {
  const close = () => { document.getElementById('modal-equipment').style.display = 'none'; editEquipmentId = null; };
  ['btn-close-equipment-modal', 'btn-cancel-equipment'].forEach(btnId => {
    const old = document.getElementById(btnId);
    const fresh = old.cloneNode(true);
    old.parentNode.replaceChild(fresh, old);
    fresh.addEventListener('click', close);
  });

  const submitOld = document.getElementById('btn-submit-equipment');
  const submitBtn = submitOld.cloneNode(true);
  submitOld.parentNode.replaceChild(submitBtn, submitOld);
  submitBtn.addEventListener('click', async () => {
    const name = document.getElementById('eq-name').value.trim();
    if (!name) { toast('Bezeichnung eingeben', 'error'); return; }
    const body = {
      name,
      serial_number:   nvl('eq-serial'),
      manufacturer:    nvl('eq-manufacturer'),
      year_built:      num('eq-year'),
      status:          document.getElementById('eq-status').value,
      last_inspection: document.getElementById('eq-last').value || null,
      next_inspection: document.getElementById('eq-next').value || null,
      interval_months: num('eq-interval'),
      notes:           nvl('eq-notes'),
    };
    submitBtn.disabled = true;
    try {
      if (editEquipmentId) { await api.updateEquipment(vehicleId, editEquipmentId, body); toast('Gerät gespeichert'); }
      else                 { await api.createEquipment(vehicleId, body);                  toast('Gerät angelegt'); }
      close();
      loadEquipment(vehicleId, isAdmin);
    } catch (e) { toast(e.message, 'error'); }
    finally { submitBtn.disabled = false; }
  });
}

function openEquipmentModal(e, vehicleId, isAdmin) {
  editEquipmentId = e?.id || null;
  document.getElementById('modal-equipment-title').textContent = e ? 'Gerät bearbeiten' : 'Gerät anlegen';
  document.getElementById('eq-name').value         = e?.name             || '';
  document.getElementById('eq-serial').value       = e?.serial_number    || '';
  document.getElementById('eq-manufacturer').value = e?.manufacturer     || '';
  document.getElementById('eq-year').value         = e?.year_built       ?? '';
  document.getElementById('eq-status').value       = e?.status           || 'ok';
  document.getElementById('eq-last').value         = e?.last_inspection  || '';
  document.getElementById('eq-next').value         = e?.next_inspection  || '';
  document.getElementById('eq-interval').value     = e?.interval_months  ?? '';
  document.getElementById('eq-notes').value        = e?.notes            || '';
  document.getElementById('modal-equipment').style.display = 'flex';
}

// ── Checklisten ────────────────────────────────────────────────────────────────

const INTERVAL_LABELS = { taeglich: 'Täglich', woechentlich: 'Wöchentlich', monatlich: 'Monatlich', manuell: 'Manuell' };

async function loadTemplates(vehicleId, isAdmin) {
  const wrap = document.getElementById('templates-wrap');
  if (!wrap) return;
  try {
    const templates = await api.getTemplates(vehicleId);
    if (!templates.length) {
      wrap.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-size:13px">Keine Vorlagen.</div>`;
      return;
    }
    wrap.innerHTML = templates.map(t => `
      <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(t.name)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
            ${INTERVAL_LABELS[t.interval] || t.interval} · ${t.items.length} Punkte
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn--primary btn--sm" data-action="fill-tpl" data-id="${t.id}">Ausfüllen</button>
          ${isAdmin ? `<button class="btn btn--danger btn--sm" data-action="del-tpl" data-id="${t.id}">Löschen</button>` : ''}
        </div>
      </div>`).join('');

    wrap.querySelectorAll('[data-action="fill-tpl"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tpl = templates.find(t => t.id === btn.dataset.id);
        if (tpl) openFillModal(tpl, vehicleId, isAdmin);
      });
    });
    if (isAdmin) {
      wrap.querySelectorAll('[data-action="del-tpl"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Vorlage löschen? Alle ausgefüllten Checklisten dieser Vorlage werden ebenfalls gelöscht.')) return;
          try { await api.deleteTemplate(vehicleId, btn.dataset.id); toast('Vorlage gelöscht'); loadTemplates(vehicleId, isAdmin); }
          catch (e) { toast(e.message, 'error'); }
        });
      });
    }
  } catch (e) { wrap.innerHTML = `<p style="color:#ff8a80;padding:16px">${esc(e.message)}</p>`; }
}

async function loadChecklists(vehicleId, isAdmin) {
  const wrap = document.getElementById('checklists-wrap');
  if (!wrap) return;
  try {
    const list = await api.getChecklists(vehicleId);
    if (!list.length) {
      wrap.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-size:13px">Noch keine ausgefüllten Checklisten.</div>`;
      return;
    }
    wrap.innerHTML = list.map(c => {
      const mangel = c.mangel_count > 0;
      return `<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${esc(c.template_name || '–')}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
            ${formatDateTime(c.filled_at)} · ${esc(c.filled_name || 'Unbekannt')}
            · <span style="color:#3fb950">${c.ok_count} OK</span>
            ${mangel ? `· <span style="color:#e63022">${c.mangel_count} Mängel</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn--outline btn--sm" data-action="view-cl" data-id="${c.id}">Detail</button>
          ${isAdmin ? `<button class="btn btn--danger btn--sm" data-action="del-cl" data-id="${c.id}">Löschen</button>` : ''}
        </div>
      </div>`;
    }).join('');

    wrap.querySelectorAll('[data-action="view-cl"]').forEach(btn => {
      btn.addEventListener('click', () => openChecklistDetail(vehicleId, btn.dataset.id, isAdmin));
    });
    if (isAdmin) {
      wrap.querySelectorAll('[data-action="del-cl"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Checkliste löschen?')) return;
          try { await api.deleteChecklist(vehicleId, btn.dataset.id); toast('Gelöscht'); loadChecklists(vehicleId, isAdmin); }
          catch (e) { toast(e.message, 'error'); }
        });
      });
    }
  } catch (e) { wrap.innerHTML = `<p style="color:#ff8a80;padding:16px">${esc(e.message)}</p>`; }
}

function setupTemplateModal(vehicleId, isAdmin) {
  const close = () => {
    document.getElementById('modal-template').style.display = 'none';
    document.getElementById('tpl-items-wrap').innerHTML = '';
  };
  ['btn-close-template-modal', 'btn-cancel-template'].forEach(btnId => {
    const old = document.getElementById(btnId);
    const fresh = old.cloneNode(true);
    old.parentNode.replaceChild(fresh, old);
    fresh.addEventListener('click', close);
  });

  const addOld = document.getElementById('btn-add-tpl-item');
  const addBtn = addOld.cloneNode(true);
  addOld.parentNode.replaceChild(addBtn, addOld);
  addBtn.addEventListener('click', () => {
    const wrap = document.getElementById('tpl-items-wrap');
    const idx = wrap.children.length;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;gap:6px;align-items:center';
    div.innerHTML = `
      <input type="text" class="tpl-item-input" maxlength="200"
        placeholder="Prüfpunkt ${idx + 1}"
        style="flex:1;background:var(--bg-card-hover);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:6px;font-size:13px" />
      <button type="button" style="background:none;border:none;color:#e63022;cursor:pointer;font-size:16px;padding:4px">✕</button>`;
    div.querySelector('button').addEventListener('click', () => div.remove());
    wrap.appendChild(div);
    div.querySelector('input').focus();
  });

  const submitOld = document.getElementById('btn-submit-template');
  const submitBtn = submitOld.cloneNode(true);
  submitOld.parentNode.replaceChild(submitBtn, submitOld);
  submitBtn.addEventListener('click', async () => {
    const name = document.getElementById('tpl-name').value.trim();
    if (!name) { toast('Name eingeben', 'error'); return; }
    const items = [...document.querySelectorAll('.tpl-item-input')]
      .map(i => i.value.trim()).filter(Boolean);
    if (!items.length) { toast('Mindestens einen Prüfpunkt eingeben', 'error'); return; }
    const body = { name, interval: document.getElementById('tpl-interval').value, items };
    submitBtn.disabled = true;
    try {
      await api.createTemplate(vehicleId, body);
      toast('Vorlage gespeichert');
      close();
      loadTemplates(vehicleId, isAdmin);
    } catch (e) { toast(e.message, 'error'); }
    finally { submitBtn.disabled = false; }
  });
}

function openTemplateModal(vehicleId, isAdmin) {
  document.getElementById('tpl-name').value = '';
  document.getElementById('tpl-interval').value = 'manuell';
  document.getElementById('tpl-items-wrap').innerHTML = '';
  document.getElementById('modal-template').style.display = 'flex';
}

// Checkliste ausfüllen
let fillTemplateData = null;
let fillVehicleId = null;

function openFillModal(template, vehicleId, isAdmin) {
  fillTemplateData = template;
  fillVehicleId = vehicleId;
  document.getElementById('modal-fill-title').textContent = `${template.name} ausfüllen`;
  document.getElementById('fill-notes').value = '';

  const wrap = document.getElementById('fill-items-wrap');
  wrap.innerHTML = template.items.map((item, i) => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:13px;color:var(--text);margin-bottom:6px">${esc(item.label)}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;color:#3fb950">
          <input type="radio" name="item-${i}" value="ok" checked /> OK
        </label>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;color:#e63022">
          <input type="radio" name="item-${i}" value="mangel" /> Mangel
        </label>
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;color:var(--text-muted)">
          <input type="radio" name="item-${i}" value="nicht_geprueft" /> Nicht geprüft
        </label>
        <input type="text" class="fill-note-${i}" maxlength="300" placeholder="Notiz..."
          style="flex:1;min-width:120px;background:var(--bg-card-hover);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:6px;font-size:12px" />
      </div>
    </div>`).join('');

  const close = () => {
    document.getElementById('modal-fill-checklist').style.display = 'none';
  };
  document.getElementById('btn-close-fill-modal').onclick = close;
  document.getElementById('btn-cancel-fill').onclick = close;

  const submitOld = document.getElementById('btn-submit-fill');
  const submitBtn = submitOld.cloneNode(true);
  submitOld.parentNode.replaceChild(submitBtn, submitOld);
  submitBtn.textContent = 'Checkliste speichern';
  submitBtn.style.background = '';
  submitBtn.style.display = '';
  submitBtn.onclick = async () => {
    if (!fillTemplateData || !fillVehicleId) return;
    submitBtn.disabled = true;
    const entries = fillTemplateData.items.map((item, i) => ({
      item_id:    item.id,
      item_label: item.label,
      result:     document.querySelector(`[name="item-${i}"]:checked`)?.value || 'nicht_geprueft',
      note:       document.querySelector(`.fill-note-${i}`)?.value?.trim() || null,
    }));
    const body = {
      template_id: fillTemplateData.id,
      notes: document.getElementById('fill-notes')?.value?.trim() || null,
      entries,
    };
    try {
      await api.createChecklist(fillVehicleId, body);
      toast('Checkliste gespeichert');
      close();
      loadChecklists(fillVehicleId, true);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  };

  document.getElementById('modal-fill-checklist').style.display = 'flex';
}

async function openChecklistDetail(vehicleId, checklistId, isAdmin) {
  const detail = await api.getChecklist(vehicleId, checklistId);
  const mangels = detail.entries.filter(e => e.result === 'mangel');

  document.getElementById('modal-fill-title').textContent = `${detail.template_name || 'Checkliste'} — Ergebnis`;
  const wrap = document.getElementById('fill-items-wrap');
  wrap.innerHTML = detail.entries.map(e => {
    const color = e.result === 'ok' ? '#3fb950' : e.result === 'mangel' ? '#e63022' : '#7d8590';
    const label = e.result === 'ok' ? '✓ OK' : e.result === 'mangel' ? '✗ Mangel' : '– Nicht geprüft';
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:13px">
      <span style="color:var(--text)">${esc(e.item_label)}</span>
      <span style="color:${color};font-weight:600;font-size:12px">${label}${e.note ? ` — ${esc(e.note)}` : ''}</span>
    </div>`;
  }).join('');

  document.getElementById('fill-notes').value = detail.notes || '';
  document.getElementById('fill-notes').disabled = true;
  document.getElementById('modal-fill-checklist').style.display = 'flex';

  // "Als Störungsmeldung" Button für Mängel
  const submitBtn = document.getElementById('btn-submit-fill');
  if (mangels.length && isAdmin) {
    submitBtn.textContent = `${mangels.length} Mängel als Störungen melden`;
    submitBtn.style.background = '#e63022';
    submitBtn.onclick = async () => {
      try {
        const res = await api.defectsFromChecklist(vehicleId, {
          checklist_id: checklistId,
          entry_ids: mangels.map(e => e.id),
        });
        toast(`${res.created} Störungsmeldung(en) angelegt`);
        submitBtn.style.display = 'none';
      } catch (e) { toast(e.message, 'error'); }
    };
  } else {
    submitBtn.style.display = 'none';
  }

  document.getElementById('btn-cancel-fill').onclick = () => {
    document.getElementById('modal-fill-checklist').style.display = 'none';
    document.getElementById('fill-notes').disabled = false;
    submitBtn.style.display = '';
    submitBtn.textContent = 'Checkliste speichern';
    submitBtn.style.background = '';
    submitBtn.onclick = null;
  };
  document.getElementById('btn-close-fill-modal').onclick =
    document.getElementById('btn-cancel-fill').onclick;
}


function styleGenericRows(cls) {
  document.querySelectorAll('.' + cls).forEach((tr, i) => {
    tr.style.borderBottom = '1px solid var(--border)';
    tr.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
  });
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


function formatDate(iso) {
  if (!iso) return '–';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
