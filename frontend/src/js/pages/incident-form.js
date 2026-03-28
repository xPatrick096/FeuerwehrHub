/**
 * Geteilte Logik für Einsatzbericht-Formulare
 * Wird von new-incident.js (Erstellen) und incidents.js (Bearbeiten/Anzeigen) genutzt.
 */

import { esc } from '../utils.js';

export const GF_LEVEL = 30;
export const WL_LEVEL = 50;

export const STATUS_LABELS = {
  entwurf:     'Entwurf',
  freigegeben: 'Freigegeben',
  archiviert:  'Archiviert',
};

export const STATUS_COLORS = {
  entwurf:     '#f0a500',
  freigegeben: '#3fb950',
  archiviert:  '#7d8590',
};

export const RESOURCES = [
  { key: 'kleinloescher',         label: 'Kleinlöscher',               unit: 'Stk'   },
  { key: 'd_schlaeuche',          label: 'D-Schläuche',                unit: 'Stk'   },
  { key: 'c_schlaeuche',          label: 'C-Schläuche',                unit: 'Stk'   },
  { key: 'b_schlaeuche',          label: 'B-Schläuche',                unit: 'Stk'   },
  { key: 'a_schlaeuche',          label: 'A-Schläuche',                unit: 'Stk'   },
  { key: 's_angriff',             label: 'S-Angriff',                  unit: 'Stk'   },
  { key: 'd_rohre',               label: 'D-Rohre',                    unit: 'Stk'   },
  { key: 'c_rohre',               label: 'C-Rohre',                    unit: 'Stk'   },
  { key: 'b_rohre',               label: 'B-Rohre',                    unit: 'Stk'   },
  { key: 'schaumrohre',           label: 'Schaumrohre',                unit: 'Stk'   },
  { key: 'messgeraete',           label: 'Messgeräte',                 unit: 'Stk'   },
  { key: 'seilwinde',             label: 'Seilwinde / Greifzug',       unit: 'Stk'   },
  { key: 'tueroeffnung',          label: 'Türöffnungsset',             unit: 'Set'   },
  { key: 'dichtkissen',           label: 'Dichtkissen',                unit: 'Stk'   },
  { key: 'beleuchtung',           label: 'Beleuchtungsgerät',          unit: 'Stk'   },
  { key: 'handwerkszeug',         label: 'Handwerkszeug',              unit: 'Stk'   },
  { key: 'steckleiter',           label: 'Steckleiter',                unit: 'Stk'   },
  { key: 'schiebleiter',          label: 'Schiebleiter',               unit: 'Stk'   },
  { key: 'feuerwehrleine',        label: 'Feuerwehrleine',             unit: 'Stk'   },
  { key: 'arbeitsleine',          label: 'Arbeitsleine',               unit: 'Stk'   },
  { key: 'sprungpolster',         label: 'Sprungpolster / -retter',    unit: 'Stk'   },
  { key: 'hydraul_schere',        label: 'Hydraulische Schere',        unit: 'Stk'   },
  { key: 'hydraul_spreizer',      label: 'Hydraulischer Spreizer',     unit: 'Stk'   },
  { key: 'oelsperre',             label: 'Ölsperre',                   unit: 'm'     },
  { key: 'atemschutz',            label: 'Atemschutzgeräte',           unit: 'Stk'   },
  { key: 'pressluftflasche',      label: 'Pressluftflasche',           unit: 'Stk'   },
  { key: 'schaummittel_l',        label: 'Schaummittel',               unit: 'l'     },
  { key: 'oelbinder_ohne_l',      label: 'Ölbinder ohne Entsorgung',   unit: 'kg'    },
  { key: 'oelbinder_mit_l',       label: 'Ölbinder mit Entsorgung',    unit: 'kg'    },
  { key: 'bioversal_ohne',        label: 'Bioversal ohne Entsorgung',  unit: 'ml'    },
  { key: 'bioversal_mit',         label: 'Bioversal mit Entsorgung',   unit: 'ml'    },
  { key: 'strassenreiniger',      label: 'Straßenreiniger',            unit: 'kg'    },
  { key: 'vliesbahn',             label: 'Vliesbahn',                  unit: 'm'     },
  { key: 'vliestuch',             label: 'Vliestuch',                  unit: 'Stk'   },
  { key: 'wasser_gesamt_m3',      label: 'Wasser gesamt',              unit: 'm³'    },
  { key: 'wasser_hydrant_m3',     label: 'davon aus Hydrant',          unit: 'm³'    },
  { key: 'wasser_loeschteich_m3', label: 'davon aus Löschteich',       unit: 'm³'    },
  { key: 'pulver_kg',             label: 'Pulver',                     unit: 'kg'    },
  { key: 'wassersauger_hhmm',     label: 'Wassersauger',               unit: 'hh:mm' },
];

// ── Tab-HTML (wiederverwendbar in Modal und als Seite) ────────────────────────

export function buildTabsHTML(tabContainerStyle = '') {
  const tabs = ['Basisdaten', 'Flags', 'Kräfte & Schäden', 'Bericht', 'Einsatzmittel', 'Polizei'];
  return `
    <div class="incident-tabs" style="display:flex;gap:2px;background:#0d1117;border-bottom:1px solid #21273d;overflow-x:auto;${tabContainerStyle}">
      ${tabs.map((t, i) => `
        <button class="incident-tab" data-tab="${i}"
          style="padding:10px 16px;background:none;border:none;border-bottom:2px solid transparent;
                 color:#7d8590;cursor:pointer;font-size:13px;white-space:nowrap;font-weight:400">
          ${t}
        </button>`).join('')}
    </div>
    ${buildPanelsHTML()}
  `;
}

function buildPanelsHTML() {
  return `
    <!-- Tab 0: Basisdaten -->
    <div class="incident-tab-panel" data-panel="0" style="padding:20px 0">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 16px">
        <div class="form-group">
          <label>Einsatznummer</label>
          <input type="text" id="ir-number" placeholder="wird automatisch vergeben" />
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
    <div class="incident-tab-panel" data-panel="1" style="display:none;padding:20px 0">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${[
          ['ir-flag-extinguished', 'Vor Ankunft gelöscht'],
          ['ir-flag-malicious',    'Böswilliger Alarm'],
          ['ir-flag-false',        'Blinder Alarm'],
          ['ir-flag-supra',        'Überregionaler Einsatz'],
          ['ir-flag-bf',           'BF beteiligt'],
          ['ir-flag-violence',     'Gewalt gegen Einsatzkräfte'],
        ].map(([id, label]) => `
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:12px;
                        background:#161b27;border:1px solid #21273d;border-radius:8px">
            <input type="checkbox" id="${id}" style="width:16px;height:16px;cursor:pointer" />
            <span style="font-size:13px;color:#e6edf3">${label}</span>
          </label>`).join('')}
      </div>
      <div class="form-group" style="margin-top:16px;max-width:260px">
        <label>Anzahl betroffener Einsatzkräfte (Gewalt)</label>
        <input type="number" id="ir-violence-count" min="0" value="0" />
      </div>
    </div>

    <!-- Tab 2: Kräfte & Schäden -->
    <div class="incident-tab-panel" data-panel="2" style="display:none;padding:20px 0">
      <h4 style="margin:0 0 12px;font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:.05em">Kräftestärke (eigene)</h4>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
        <div class="form-group"><label>Führung</label><input type="number" id="ir-str-leadership" min="0" value="0" /></div>
        <div class="form-group"><label>Unterführung</label><input type="number" id="ir-str-sub" min="0" value="0" /></div>
        <div class="form-group"><label>Mannschaft</label><input type="number" id="ir-str-crew" min="0" value="0" /></div>
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
        ].map(([id, l]) => `
          <div class="form-group"><label>${l}</label>
          <input type="number" id="${id}" min="0" value="0" /></div>`).join('')}
      </div>

      <h4 style="margin:0 0 12px;font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:.05em">Tierschäden</h4>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
        ${[
          ['ir-a-rescued',   'Gerettet'],
          ['ir-a-injured',   'Verletzt'],
          ['ir-a-recovered', 'Geborgen'],
          ['ir-a-dead',      'Tot'],
        ].map(([id, l]) => `
          <div class="form-group"><label>${l}</label>
          <input type="number" id="${id}" min="0" value="0" /></div>`).join('')}
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
    <div class="incident-tab-panel" data-panel="3" style="display:none;padding:20px 0">
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
    <div class="incident-tab-panel" data-panel="4" style="display:none;padding:20px 0">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px"
           id="resources-grid"></div>
    </div>

    <!-- Tab 5: Polizei -->
    <div class="incident-tab-panel" data-panel="5" style="display:none;padding:20px 0">
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
  `;
}

// ── Tabs initialisieren ───────────────────────────────────────────────────────

export function setupTabs(scope = document) {
  scope.querySelectorAll('.incident-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(+btn.dataset.tab, scope));
  });
  switchTab(0, scope);
}

export function switchTab(idx, scope = document) {
  scope.querySelectorAll('.incident-tab').forEach((btn, i) => {
    const active = i === idx;
    btn.style.color             = active ? '#e6edf3' : '#7d8590';
    btn.style.borderBottomColor = active ? '#e63022' : 'transparent';
    btn.style.fontWeight        = active ? '600' : '400';
  });
  scope.querySelectorAll('.incident-tab-panel').forEach((panel, i) => {
    panel.style.display = i === idx ? 'block' : 'none';
  });
}

// ── Einsatzarten-Dropdown befüllen ────────────────────────────────────────────

const CAT_LABELS = {
  brand:     'Brand',
  thl:       'THL',
  gefahrgut: 'Gefahrgut',
  fehlalarm: 'Fehlalarm',
  sonstiges: 'Sonstiges',
};

export function buildTypeDropdown(selectEl, types, selectedKey) {
  selectEl.innerHTML = '';
  for (const [cat, label] of Object.entries(CAT_LABELS)) {
    const filtered = types.filter(t => t.category === cat && t.active);
    if (!filtered.length) continue;
    const grp = document.createElement('optgroup');
    grp.label = label;
    filtered.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.key;
      opt.textContent = t.label;
      if (t.key === selectedKey) opt.selected = true;
      grp.appendChild(opt);
    });
    selectEl.appendChild(grp);
  }
}

export function buildTypeFilter(selectEl, types) {
  for (const [cat, label] of Object.entries(CAT_LABELS)) {
    const filtered = types.filter(t => t.category === cat && t.active);
    if (!filtered.length) continue;
    const grp = document.createElement('optgroup');
    grp.label = label;
    filtered.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.key;
      opt.textContent = t.label;
      grp.appendChild(opt);
    });
    selectEl.appendChild(grp);
  }
}

// ── Einsatzmittel-Grid befüllen ───────────────────────────────────────────────

export function buildResourcesGrid(containerId, resources, readonly = false) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = RESOURCES.map(r => {
    const val  = resources?.[r.key] ?? '';
    const show = !readonly || (val !== '' && val !== 0 && val !== '0');
    if (readonly && !show) return '';
    return `
      <div class="form-group">
        <label style="font-size:12px">${esc(r.label)}
          <span style="color:#7d8590">(${r.unit})</span></label>
        <input type="${r.unit === 'hh:mm' ? 'text' : 'number'}"
          id="res-${r.key}" data-resource="${r.key}"
          min="0" value="${esc(String(val))}" placeholder="0"
          ${readonly ? 'readonly' : ''} />
      </div>`;
  }).join('');
}

// ── Formular befüllen ─────────────────────────────────────────────────────────

export function fillForm(r) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

  set('ir-number',         r.incident_number);
  set('ir-date',           r.incident_date);
  set('ir-alarm-time',     r.alarm_time?.slice(0, 5));
  set('ir-departure-time', r.departure_time?.slice(0, 5));
  set('ir-arrival-time',   r.arrival_time?.slice(0, 5));
  set('ir-end-time',       r.end_time?.slice(0, 5));
  set('ir-location',       r.location);
  set('ir-postal',         r.postal_code);
  set('ir-district',       r.district);
  set('ir-street',         r.street);
  set('ir-housenr',        r.house_number);
  set('ir-commander',      r.incident_commander);
  set('ir-reporter',       r.reporter_name);
  set('ir-reporter-phone', r.reporter_phone);
  set('ir-str-leadership', r.strength_leadership);
  set('ir-str-sub',        r.strength_sub);
  set('ir-str-crew',       r.strength_crew);
  set('ir-fire-object',    r.fire_object);
  set('ir-situation',      r.situation);
  set('ir-measures',       r.measures);
  set('ir-notes',          r.notes);
  set('ir-weather',        r.weather_influence);
  set('ir-handover',       r.handover_to);
  set('ir-handover-notes', r.handover_notes);
  set('ir-police-casenr',  r.police_case_number);
  set('ir-police-station', r.police_station);
  set('ir-police-officer', r.police_officer);
  set('ir-dmg-vehicle',    r.vehicle_damage);
  set('ir-dmg-equipment',  r.equipment_damage);
  set('ir-violence-count', r.violence_count);
  set('ir-p-rescued',      r.persons_rescued);
  set('ir-p-evacuated',    r.persons_evacuated);
  set('ir-p-injured',      r.persons_injured);
  set('ir-p-inj-own',      r.persons_injured_own);
  set('ir-p-recovered',    r.persons_recovered);
  set('ir-p-dead',         r.persons_dead);
  set('ir-p-dead-own',     r.persons_dead_own);
  set('ir-a-rescued',      r.animals_rescued);
  set('ir-a-injured',      r.animals_injured);
  set('ir-a-recovered',    r.animals_recovered);
  set('ir-a-dead',         r.animals_dead);

  chk('ir-flag-extinguished', r.extinguished_before_arrival);
  chk('ir-flag-malicious',    r.malicious_alarm);
  chk('ir-flag-false',        r.false_alarm);
  chk('ir-flag-supra',        r.supraregional);
  chk('ir-flag-bf',           r.bf_involved);
  chk('ir-flag-violence',     r.violence_against_crew);
}

// ── Formular-Daten sammeln ────────────────────────────────────────────────────

export function collectBody() {
  const typeSel  = document.getElementById('ir-type');
  const typeKey  = typeSel?.value || 'sonstiges';
  const typeLabel= typeSel?.options[typeSel.selectedIndex]?.text || 'Sonstiges';

  const resources = {};
  document.querySelectorAll('[data-resource]').forEach(el => {
    const v = el.value.trim();
    if (v && v !== '0') resources[el.dataset.resource] = isNaN(v) ? v : Number(v);
  });

  const g = id => document.getElementById(id)?.value || null;
  const n = id => +document.getElementById(id)?.value || 0;
  const b = id => document.getElementById(id)?.checked || false;

  return {
    incident_number:             g('ir-number') || null,
    incident_date:               g('ir-date'),
    alarm_time:                  g('ir-alarm-time'),
    departure_time:              g('ir-departure-time'),
    arrival_time:                g('ir-arrival-time'),
    end_time:                    g('ir-end-time'),
    incident_type_key:           typeKey,
    incident_type_label:         typeLabel,
    location:                    document.getElementById('ir-location')?.value.trim() || '',
    postal_code:                 g('ir-postal'),
    district:                    g('ir-district'),
    street:                      g('ir-street'),
    house_number:                g('ir-housenr'),
    extinguished_before_arrival: b('ir-flag-extinguished'),
    malicious_alarm:             b('ir-flag-malicious'),
    false_alarm:                 b('ir-flag-false'),
    supraregional:               b('ir-flag-supra'),
    bf_involved:                 b('ir-flag-bf'),
    violence_against_crew:       b('ir-flag-violence'),
    violence_count:              n('ir-violence-count'),
    incident_commander:          g('ir-commander'),
    reporter_name:               g('ir-reporter'),
    reporter_phone:              g('ir-reporter-phone'),
    strength_leadership:         n('ir-str-leadership'),
    strength_sub:                n('ir-str-sub'),
    strength_crew:               n('ir-str-crew'),
    fire_object:                 g('ir-fire-object'),
    situation:                   g('ir-situation'),
    measures:                    g('ir-measures'),
    notes:                       g('ir-notes'),
    weather_influence:           g('ir-weather'),
    handover_to:                 g('ir-handover'),
    handover_notes:              g('ir-handover-notes'),
    police_case_number:          g('ir-police-casenr'),
    police_station:              g('ir-police-station'),
    police_officer:              g('ir-police-officer'),
    persons_rescued:             n('ir-p-rescued'),
    persons_evacuated:           n('ir-p-evacuated'),
    persons_injured:             n('ir-p-injured'),
    persons_injured_own:         n('ir-p-inj-own'),
    persons_recovered:           n('ir-p-recovered'),
    persons_dead:                n('ir-p-dead'),
    persons_dead_own:            n('ir-p-dead-own'),
    animals_rescued:             n('ir-a-rescued'),
    animals_injured:             n('ir-a-injured'),
    animals_recovered:           n('ir-a-recovered'),
    animals_dead:                n('ir-a-dead'),
    vehicle_damage:              g('ir-dmg-vehicle'),
    equipment_damage:            g('ir-dmg-equipment'),
    resources,
  };
}

// ── Readonly-Toggle ───────────────────────────────────────────────────────────

export function setFormReadonly(readonly, scope = document) {
  scope.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.type === 'checkbox' || el.tagName === 'SELECT') {
      el.disabled = readonly;
    } else {
      if (readonly) el.setAttribute('readonly', '');
      else el.removeAttribute('readonly');
    }
  });
}
