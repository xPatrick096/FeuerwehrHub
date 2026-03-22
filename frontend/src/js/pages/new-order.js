import { api } from '../api.js';
import { toast } from '../toast.js';
import { navigate } from '../router.js';
import { renderShell, setShellInfo } from '../shell.js';

export async function renderNewOrder() {
  const [settings, user, articles, units] = await Promise.all([
    api.getSettings(), api.me(), api.getArticles(), api.getUnits(),
  ]);
  setShellInfo(settings?.ff_name, user);
  renderShell('new-order');

  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Neue Bestellung</h2>
        <p>Beschaffungsauftrag erfassen</p>
      </div>
    </div>

    <div class="card">
      <div class="card__header">Bestelldaten</div>
      <div class="card__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Artikel (aus Stamm wählen oder frei eingeben)</label>
            <select id="article-select">
              <option value="">— Frei eingeben —</option>
              ${articles.map(a => `<option value="${a.id}" data-name="${esc(a.name)}" data-unit="${esc(a.unit)}">${esc(a.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group form-group--full">
            <label>Artikelbezeichnung *</label>
            <input type="text" id="article-name" placeholder="z.B. HP 85A Toner" />
          </div>
          <div class="form-group">
            <label>Menge *</label>
            <input type="number" id="order-qty" min="0.01" step="0.01" placeholder="1" />
          </div>
          <div class="form-group">
            <label>Einheit *</label>
            <select id="order-unit">
              ${units.map(u => `<option value="${esc(u.label)}">${esc(u.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Lieferant</label>
            <input type="text" id="order-supplier" placeholder="z.B. Staples, Amazon..." />
          </div>
          <div class="form-group">
            <label>Bestelldatum</label>
            <input type="date" id="order-date" value="${today()}" />
          </div>
          <div class="form-group form-group--full">
            <label>Anmerkungen</label>
            <textarea id="order-notes" placeholder="Optional..."></textarea>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__header">Beschaffungsauftrag (PDF)</div>
      <div class="card__body">
        <p style="font-size:13px;color:#666;margin-bottom:16px">
          Diese Felder werden im offiziellen Beschaffungsauftrag der Stadt Leipzig verwendet.
        </p>
        <div class="form-grid">
          <div class="form-group">
            <label>Telefon Bedarfsmelder(in)</label>
            <input type="text" id="pdf-telefon" placeholder="z.B. 0341 / 12345" />
          </div>
          <div class="form-group">
            <label>Lieferanschrift</label>
            <input type="text" id="pdf-lieferanschrift" placeholder="z.B. Feuerwehr Böhlitz-Ehrenberg" />
          </div>
          <div class="form-group form-group--full">
            <label>Begründung der Notwendigkeit</label>
            <textarea id="pdf-begruendung" rows="4"
              placeholder="Warum wird die Beschaffung benötigt?"></textarea>
          </div>
          <div class="form-group">
            <label>Händler / Anbieter 1</label>
            <input type="text" id="pdf-haendler1" placeholder="z.B. Amazon Business" />
          </div>
          <div class="form-group">
            <label>Händler / Anbieter 2</label>
            <input type="text" id="pdf-haendler2" placeholder="Optional" />
          </div>
          <div class="form-group">
            <label>Händler / Anbieter 3</label>
            <input type="text" id="pdf-haendler3" placeholder="Optional" />
          </div>
        </div>
      </div>
    </div>

    <div class="btn-group" style="margin-top:8px">
      <button class="btn btn--primary" id="btn-save-order">Bestellung speichern</button>
      <button class="btn btn--outline" id="btn-cancel">Abbrechen</button>
    </div>
  `;

  // Artikel aus Stamm wählen → Felder befüllen
  document.getElementById('article-select').addEventListener('change', (e) => {
    const opt = e.target.selectedOptions[0];
    if (opt && opt.dataset.name) {
      document.getElementById('article-name').value = opt.dataset.name;
      const unitSelect = document.getElementById('order-unit');
      for (const o of unitSelect.options) {
        if (o.value === opt.dataset.unit) { unitSelect.value = o.value; break; }
      }
    }
  });

  document.getElementById('btn-save-order').addEventListener('click', async () => {
    const articleSelect = document.getElementById('article-select');
    const articleId   = articleSelect.value || null;
    const articleName = document.getElementById('article-name').value.trim();
    const qty         = parseFloat(document.getElementById('order-qty').value);
    const unit        = document.getElementById('order-unit').value;
    const supplier    = document.getElementById('order-supplier').value.trim();
    const orderDate   = document.getElementById('order-date').value;
    const notes       = document.getElementById('order-notes').value.trim();
    const telefon     = document.getElementById('pdf-telefon').value.trim();
    const lieferanschrift = document.getElementById('pdf-lieferanschrift').value.trim();
    const begruendung = document.getElementById('pdf-begruendung').value.trim();
    const haendler_1  = document.getElementById('pdf-haendler1').value.trim();
    const haendler_2  = document.getElementById('pdf-haendler2').value.trim();
    const haendler_3  = document.getElementById('pdf-haendler3').value.trim();

    if (!articleName) { toast('Artikelbezeichnung eingeben', 'error'); return; }
    if (!qty || qty <= 0) { toast('Menge eingeben', 'error'); return; }

    try {
      await api.createOrder({
        article_id: articleId,
        article_name: articleName,
        quantity: qty,
        unit,
        supplier:         supplier     || undefined,
        order_date:       orderDate    || undefined,
        notes:            notes        || undefined,
        telefon:          telefon      || undefined,
        lieferanschrift:  lieferanschrift || undefined,
        begruendung:      begruendung  || undefined,
        haendler_1:       haendler_1   || undefined,
        haendler_2:       haendler_2   || undefined,
        haendler_3:       haendler_3   || undefined,
      });
      toast('Bestellung gespeichert!');
      navigate('#/orders');
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  document.getElementById('btn-cancel').addEventListener('click', () => navigate('#/orders'));
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function today() { return new Date().toISOString().split('T')[0]; }
