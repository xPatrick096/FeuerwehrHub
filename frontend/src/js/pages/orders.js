import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';
import { generateBeschaffungsauftrag } from '../pdf-generator.js';

export async function renderOrders() {
  const [settings, user] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, user);
  renderShell('orders');

  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Bestellübersicht</h2>
        <p>Alle erfassten Bestellungen und deren Status</p>
      </div>
    </div>
    <div class="stats-row" id="stats-row"></div>
    <div class="card">
      <div class="card__header">
        Bestellungen
        <div class="filter-bar" style="margin:0">
          <input type="text" id="filter-search" placeholder="🔍 Suche..." style="width:180px" />
          <select id="filter-status">
            <option value="">Alle Status</option>
            <option value="offen">Offen</option>
            <option value="teillieferung">Teillieferung</option>
            <option value="vollstaendig">Vollständig</option>
            <option value="storniert">Storniert</option>
          </select>
        </div>
      </div>
      <div class="card__body" style="padding:0">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Artikel</th>
                <th>Menge</th>
                <th>Lieferant</th>
                <th>Bestellt am</th>
                <th>Bestellt von</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody id="orders-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal: Lieferung -->
    <div class="modal-overlay" id="delivery-modal">
      <div class="modal">
        <div class="modal__header">
          Lieferung eintragen
          <button class="modal__close" id="close-delivery-modal">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label>Gelieferte Menge</label>
            <input type="number" id="delivery-qty" min="0.01" step="0.01" placeholder="0" />
          </div>
          <div class="form-group">
            <label>Lieferdatum</label>
            <input type="date" id="delivery-date" />
          </div>
          <div class="form-group">
            <label>Anmerkung</label>
            <textarea id="delivery-notes" placeholder="Optional..."></textarea>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="close-delivery-modal2">Abbrechen</button>
          <button class="btn btn--success" id="btn-save-delivery">Lieferung speichern</button>
        </div>
      </div>
    </div>
  `;

  let currentOrderId = null;

  async function load() {
    const search = document.getElementById('filter-search').value;
    const status = document.getElementById('filter-status').value;

    const [orders, stats] = await Promise.all([
      api.getOrders({ search: search || undefined, status: status || undefined }),
      api.getStats(),
    ]);

    // Stats
    document.getElementById('stats-row').innerHTML = `
      <div class="stat-card stat-card--gesamt">
        <div class="stat-card__number">${stats.gesamt}</div>
        <div class="stat-card__label">Gesamt</div>
      </div>
      <div class="stat-card stat-card--offen">
        <div class="stat-card__number">${stats.offen}</div>
        <div class="stat-card__label">Offen</div>
      </div>
      <div class="stat-card stat-card--teillieferung">
        <div class="stat-card__number">${stats.teillieferung}</div>
        <div class="stat-card__label">Teillieferung</div>
      </div>
      <div class="stat-card stat-card--vollstaendig">
        <div class="stat-card__number">${stats.vollstaendig}</div>
        <div class="stat-card__label">Vollständig</div>
      </div>
    `;

    const tbody = document.getElementById('orders-tbody');
    if (!orders || orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Keine Bestellungen gefunden</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(o => `
      <tr>
        <td><strong>${esc(o.article_name)}</strong></td>
        <td>${o.quantity} ${esc(o.unit)}</td>
        <td>${esc(o.supplier) || '—'}</td>
        <td>${formatDate(o.order_date)}</td>
        <td>${esc(o.ordered_by_name) || '—'}</td>
        <td><span class="badge badge--${o.status}">${statusLabel(o.status)}</span></td>
        <td>
          <div class="btn-group">
            ${o.status !== 'vollstaendig' && o.status !== 'storniert'
              ? `<button class="btn btn--success btn--sm" data-action="delivery" data-id="${o.id}">📦 Lieferung</button>`
              : ''}
            <button class="btn btn--outline btn--sm" data-action="pdf" data-id="${o.id}">📄 PDF</button>
            <button class="btn btn--danger btn--sm" data-action="delete" data-id="${o.id}">🗑</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Filter-Events
  let searchTimer;
  document.getElementById('filter-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 300);
  });
  document.getElementById('filter-status').addEventListener('change', load);

  // Delegated events
  document.getElementById('orders-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'delivery') {
      currentOrderId = id;
      document.getElementById('delivery-date').value = today();
      document.getElementById('delivery-modal').classList.add('active');
    }

    if (action === 'pdf') {
      try {
        const order = await api.getOrder(id);
        await generateBeschaffungsauftrag(order);
      } catch (e) {
        toast('PDF-Generierung fehlgeschlagen: ' + e.message, 'error');
      }
    }

    if (action === 'delete') {
      if (!confirm('Bestellung wirklich löschen?')) return;
      try {
        await api.deleteOrder(id);
        toast('Bestellung gelöscht');
        load();
      } catch (e) {
        toast(e.message, 'error');
      }
    }
  });

  document.getElementById('close-delivery-modal').addEventListener('click', closeModal);
  document.getElementById('close-delivery-modal2').addEventListener('click', closeModal);
  function closeModal() {
    document.getElementById('delivery-modal').classList.remove('active');
    currentOrderId = null;
  }

  document.getElementById('btn-save-delivery').addEventListener('click', async () => {
    const qty = parseFloat(document.getElementById('delivery-qty').value);
    const date = document.getElementById('delivery-date').value;
    const notes = document.getElementById('delivery-notes').value;

    if (!qty || qty <= 0) { toast('Menge eingeben', 'error'); return; }

    try {
      await api.addDelivery(currentOrderId, {
        quantity_delivered: qty,
        delivery_date: date || undefined,
        notes: notes || undefined,
      });
      toast('Lieferung eingetragen');
      closeModal();
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  load();
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatDate(d) { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}.${m}.${y}`; }
function today() { return new Date().toISOString().split('T')[0]; }
function statusLabel(s) {
  return { offen: 'Offen', teillieferung: 'Teillieferung', vollstaendig: 'Vollständig', storniert: 'Storniert' }[s] || s;
}
