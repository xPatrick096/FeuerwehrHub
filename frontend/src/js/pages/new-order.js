import { api } from '../api.js';
import { toast } from '../toast.js';
import { navigate } from '../router.js';
import { renderShell, setShellInfo } from '../shell.js';
import { esc } from '../utils.js';

const NUM_POSITIONS = 6;

export async function renderNewOrder() {
  const [settings, user, articles, units] = await Promise.all([
    api.getSettings(), api.me(), api.getArticles(), api.getUnits(),
  ]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('new-order');

  const content = document.getElementById('page-content');

  // Einheit-Optionen für alle Zeilen
  const unitOptions = units.map(u => `<option value="${esc(u.label)}">${esc(u.label)}</option>`).join('');

  // 6 Positionszeilen bauen
  const posRows = Array.from({ length: NUM_POSITIONS }, (_, i) => `
    <div class="beschaffung-table-row" data-pos="${i}">
      <div class="beschaffung-td beschaffung-td--menge">
        <input type="number" id="pos-${i}-menge" min="0.01" step="0.01" placeholder="" />
      </div>
      <div class="beschaffung-td beschaffung-td--einheit">
        <select id="pos-${i}-einheit">
          <option value=""></option>
          ${unitOptions}
        </select>
      </div>
      <div class="beschaffung-td beschaffung-td--gesamt">
        <input type="text" id="pos-${i}-gesamt" maxlength="50" placeholder="" />
      </div>
      <div class="beschaffung-td beschaffung-td--gegenstand">
        <input type="text" id="pos-${i}-gegenstand" maxlength="255" placeholder="${i === 0 ? 'Artikelbezeichnung' : ''}" />
      </div>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Neuer Beschaffungsauftrag</h2>
        <p>${esc(settings?.ff_name || '')}</p>
      </div>
    </div>

    <div class="card beschaffung-card">
      <div class="card__body">

        <!-- Artikel aus Stamm wählen (Hilfsfunktion) -->
        <div class="form-group beschaffung-article-select">
          <label>Artikel aus Stamm wählen (befüllt Zeile 1)</label>
          <select id="article-select">
            <option value="">— Frei eingeben —</option>
            ${articles.map(a =>
              `<option value="${a.id}" data-name="${esc(a.name)}" data-unit="${esc(a.unit)}">${esc(a.name)}</option>`
            ).join('')}
          </select>
        </div>

        <div class="beschaffung-form">

          <!-- Zeile 1: Bedarfsmelder | Telefon | Datum -->
          <div class="beschaffung-row beschaffung-row--header">
            <div class="beschaffung-cell beschaffung-cell--bedarfsmelder">
              <div class="beschaffung-label">Bedarfsmelder(in)</div>
              <input type="text" id="field-bedarfsmelder" maxlength="100"
                value="${esc(user?.display_name || user?.username || '')}" />
            </div>
            <div class="beschaffung-cell beschaffung-cell--telefon">
              <div class="beschaffung-label">Telefon</div>
              <input type="text" id="field-telefon" maxlength="30" placeholder="z.B. 0341 / 12345" />
            </div>
            <div class="beschaffung-cell beschaffung-cell--datum">
              <div class="beschaffung-label">Datum</div>
              <input type="date" id="field-datum" value="${today()}" />
            </div>
          </div>

          <!-- Zeile 2: Lieferanschrift -->
          <div class="beschaffung-row">
            <div class="beschaffung-cell beschaffung-cell--full">
              <div class="beschaffung-label">Lieferanschrift (ggf. mit Zimmernummer)</div>
              <input type="text" id="field-lieferanschrift" maxlength="200"
                placeholder="${esc(settings?.ff_strasse ? settings.ff_strasse + ', ' + settings.ff_ort : 'Lieferanschrift eingeben')}" />
            </div>
          </div>

          <!-- Tabelle: Menge | Einheit | Gesamt | Gegenstand / Leistung -->
          <div class="beschaffung-table-header">
            <div class="beschaffung-th beschaffung-th--menge">Menge¹</div>
            <div class="beschaffung-th beschaffung-th--einheit">Einheit²</div>
            <div class="beschaffung-th beschaffung-th--gesamt">Gesamt³</div>
            <div class="beschaffung-th beschaffung-th--gegenstand">Gegenstand / Leistung</div>
          </div>
          ${posRows}
          <div class="beschaffung-hint">
            ¹ Anzahl / Mengenwert &nbsp;&nbsp; ² Einheit (z.B.: Stück / kg / l / cbm / Verpackungseinheit) &nbsp;&nbsp; ³ Gesamtanzahl (Menge × Stück je VE)
          </div>

          <!-- Begründung -->
          <div class="beschaffung-row">
            <div class="beschaffung-cell beschaffung-cell--full">
              <div class="beschaffung-label">Begründung der Notwendigkeit</div>
              <textarea id="field-begruendung" rows="4" maxlength="1000"
                placeholder="Begründung eingeben ..."></textarea>
            </div>
          </div>

          <!-- Händler -->
          <div class="beschaffung-row">
            <div class="beschaffung-cell beschaffung-cell--full">
              <div class="beschaffung-label">Geeignete Händler / Anbieter (bitte bis zu drei angeben)</div>
            </div>
          </div>
          <div class="beschaffung-row beschaffung-row--haendler">
            <div class="beschaffung-cell beschaffung-cell--full">
              <input type="text" id="field-haendler1" maxlength="100" placeholder="Händler / Anbieter 1" />
            </div>
          </div>
          <div class="beschaffung-row beschaffung-row--haendler">
            <div class="beschaffung-cell beschaffung-cell--full">
              <input type="text" id="field-haendler2" maxlength="100" placeholder="Händler / Anbieter 2" />
            </div>
          </div>
          <div class="beschaffung-row beschaffung-row--haendler">
            <div class="beschaffung-cell beschaffung-cell--full">
              <input type="text" id="field-haendler3" maxlength="100" placeholder="Händler / Anbieter 3" />
            </div>
          </div>

          <!-- Interne Anmerkungen -->
          <div class="beschaffung-row" style="margin-top:8px">
            <div class="beschaffung-cell beschaffung-cell--full">
              <div class="beschaffung-label">Interne Anmerkungen (erscheinen nicht im PDF)</div>
              <textarea id="field-notes" rows="2" maxlength="500" placeholder="Optional..."></textarea>
            </div>
          </div>

        </div><!-- /beschaffung-form -->
      </div>
    </div>

    <div class="btn-group" style="margin-top:8px">
      <button class="btn btn--primary" id="btn-save-order">Speichern</button>
      <button class="btn btn--outline" id="btn-cancel">Abbrechen</button>
    </div>
  `;

  // Artikel aus Stamm → Zeile 1 befüllen
  document.getElementById('article-select').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    if (opt?.dataset.name) {
      document.getElementById('pos-0-gegenstand').value = opt.dataset.name;
      const unitSel = document.getElementById('pos-0-einheit');
      for (const o of unitSel.options) {
        if (o.value === opt.dataset.unit) { unitSel.value = o.value; break; }
      }
    }
  });

  // Lieferanschrift aus Einstellungen
  if (settings?.ff_strasse && settings?.ff_ort) {
    document.getElementById('field-lieferanschrift').value =
      `${settings.ff_strasse}, ${settings.ff_ort}`;
  }

  // Speichern
  document.getElementById('btn-save-order').addEventListener('click', async () => {
    // Positionen sammeln
    const positions = Array.from({ length: NUM_POSITIONS }, (_, i) => ({
      menge:      document.getElementById(`pos-${i}-menge`).value.trim() || null,
      einheit:    document.getElementById(`pos-${i}-einheit`).value || null,
      gesamt:     document.getElementById(`pos-${i}-gesamt`).value.trim() || null,
      gegenstand: document.getElementById(`pos-${i}-gegenstand`).value.trim() || null,
    }));

    const hasPosition = positions.some(p => p.gegenstand);
    if (!hasPosition) {
      toast('Mindestens eine Position (Gegenstand / Leistung) eingeben', 'error');
      return;
    }

    const datum          = document.getElementById('field-datum').value;
    const telefon        = document.getElementById('field-telefon').value.trim();
    const lieferanschrift = document.getElementById('field-lieferanschrift').value.trim();
    const begruendung    = document.getElementById('field-begruendung').value.trim();
    const haendler_1     = document.getElementById('field-haendler1').value.trim();
    const haendler_2     = document.getElementById('field-haendler2').value.trim();
    const haendler_3     = document.getElementById('field-haendler3').value.trim();
    const notes          = document.getElementById('field-notes').value.trim();

    try {
      await api.createOrder({
        positions,
        order_date:      datum            || undefined,
        notes:           notes            || undefined,
        telefon:         telefon          || undefined,
        lieferanschrift: lieferanschrift  || undefined,
        begruendung:     begruendung      || undefined,
        haendler_1:      haendler_1       || undefined,
        haendler_2:      haendler_2       || undefined,
        haendler_3:      haendler_3       || undefined,
      });
      toast('Beschaffungsauftrag gespeichert');
      navigate('#/orders');
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  document.getElementById('btn-cancel').addEventListener('click', () => navigate('#/orders'));
}

function today() { return new Date().toISOString().split('T')[0]; }
