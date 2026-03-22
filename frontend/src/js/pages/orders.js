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
                <th>Positionen</th>
                <th>Bedarfsmelder</th>
                <th>Bestellt am</th>
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
      <div class="modal" style="max-width:640px">
        <div class="modal__header">
          Lieferung eintragen
          <button class="modal__close" id="close-delivery-modal">✕</button>
        </div>
        <div class="modal__body" id="delivery-modal-body"></div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="close-delivery-modal2">Abbrechen</button>
          <button class="btn btn--success" id="btn-save-delivery">Lieferung speichern</button>
        </div>
      </div>
    </div>

    <!-- Modal: Details -->
    <div class="modal-overlay" id="detail-modal">
      <div class="modal" style="max-width:700px">
        <div class="modal__header">
          Bestelldetails
          <button class="modal__close" id="close-detail-modal">✕</button>
        </div>
        <div class="modal__body" id="detail-modal-body"></div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="close-detail-modal2">Schließen</button>
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
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Keine Bestellungen gefunden</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(o => {
      const positions = (o.positions || []).filter(p => p.gegenstand);

      let positionsHtml;
      if (positions.length > 0) {
        positionsHtml = `
          <table style="border-collapse:collapse;width:100%;font-size:0.85em">
            <thead>
              <tr>
                <th style="padding:2px 8px 2px 0;color:#888;font-weight:600;white-space:nowrap;border-bottom:1px solid #e0e0e0;width:60px">Menge</th>
                <th style="padding:2px 8px 2px 0;color:#888;font-weight:600;white-space:nowrap;border-bottom:1px solid #e0e0e0;width:110px">Einheit</th>
                <th style="padding:2px 8px 2px 0;color:#888;font-weight:600;white-space:nowrap;border-bottom:1px solid #e0e0e0">Gegenstand / Leistung</th>
              </tr>
            </thead>
            <tbody>
              ${positions.map(p => `
                <tr>
                  <td style="padding:2px 8px 2px 0;vertical-align:top">${esc(p.menge) || ''}</td>
                  <td style="padding:2px 8px 2px 0;vertical-align:top">${esc(p.einheit) || ''}</td>
                  <td style="padding:2px 0;vertical-align:top"><strong>${esc(p.gegenstand)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>`;
      } else {
        positionsHtml = `<span style="color:#888">${esc(o.article_name) || '—'}</span>`;
      }

      return `
        <tr>
          <td>${positionsHtml}</td>
          <td>${esc(o.ordered_by_name) || '—'}</td>
          <td>${formatDate(o.order_date)}</td>
          <td><span class="badge badge--${o.status}">${statusLabel(o.status)}</span></td>
          <td>
            <div class="btn-group">
              <button class="btn btn--secondary btn--sm" data-action="detail" data-id="${o.id}" title="Details">🔍</button>
              ${o.status !== 'vollstaendig' && o.status !== 'storniert'
                ? `<button class="btn btn--success btn--sm" data-action="delivery" data-id="${o.id}">📦</button>`
                : ''}
              <button class="btn btn--outline btn--sm" data-action="pdf" data-id="${o.id}">📄</button>
              <button class="btn btn--danger btn--sm" data-action="delete" data-id="${o.id}">🗑</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
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

    if (action === 'detail') {
      try {
        const order = await api.getOrder(id);
        showDetailModal(order);
      } catch (e) {
        toast('Fehler beim Laden: ' + e.message, 'error');
      }
    }

    if (action === 'delivery') {
      currentOrderId = id;
      try {
        const order = await api.getOrder(id);
        showDeliveryModal(order);
      } catch (e) {
        toast('Fehler beim Laden: ' + e.message, 'error');
      }
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

  function showDetailModal(order) {
    const positions = (order.positions || []).filter(p => p.gegenstand);
    const haendler = [order.haendler_1, order.haendler_2, order.haendler_3].filter(Boolean);

    document.getElementById('detail-modal-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin-bottom:16px;font-size:0.9em">
        <div><strong>Bedarfsmelder:</strong><br>${esc(order.ordered_by_name) || '—'}</div>
        <div><strong>Telefon:</strong><br>${esc(order.telefon) || '—'}</div>
        <div><strong>Datum:</strong><br>${formatDate(order.order_date)}</div>
        <div><strong>Status:</strong><br><span class="badge badge--${order.status}">${statusLabel(order.status)}</span></div>
        <div style="grid-column:1/-1"><strong>Lieferanschrift:</strong><br>${esc(order.lieferanschrift) || '—'}</div>
      </div>

      <table style="margin-bottom:12px">
        <thead>
          <tr>
            <th style="width:80px">Menge</th>
            <th style="width:140px">Einheit</th>
            <th style="width:90px">Gesamt</th>
            <th>Gegenstand / Leistung</th>
          </tr>
        </thead>
        <tbody>
          ${positions.length > 0
            ? positions.map(p => `
                <tr>
                  <td>${esc(p.menge) || '—'}</td>
                  <td>${esc(p.einheit) || '—'}</td>
                  <td>${esc(p.gesamt) || '—'}</td>
                  <td>${esc(p.gegenstand)}</td>
                </tr>
              `).join('')
            : `<tr><td colspan="4" class="table-empty">Keine Positionen</td></tr>`
          }
        </tbody>
      </table>

      ${order.begruendung ? `
        <div style="margin-bottom:12px;font-size:0.9em">
          <strong>Begründung:</strong><br>${esc(order.begruendung)}
        </div>
      ` : ''}

      ${haendler.length > 0 ? `
        <div style="margin-bottom:12px;font-size:0.9em">
          <strong>Händler / Anbieter:</strong><br>${haendler.map(h => esc(h)).join('<br>')}
        </div>
      ` : ''}

      ${order.notes ? `
        <div style="font-size:0.9em;color:#666">
          <strong>Interne Anmerkungen:</strong><br>${esc(order.notes)}
        </div>
      ` : ''}
    `;
    document.getElementById('detail-modal').classList.add('active');
  }

  function showDeliveryModal(order) {
    const positions = (order.positions || []).filter(p => p.gegenstand);

    let posRows = '';
    if (positions.length > 0) {
      posRows = positions.map((p, i) => `
        <tr>
          <td style="padding:6px 8px 6px 0">
            <strong>${esc(p.gegenstand)}</strong>
            ${p.menge || p.einheit ? `<br><small style="color:#888">${esc(p.menge || '')} ${esc(p.einheit || '')}</small>` : ''}
          </td>
          <td style="padding:6px 8px">
            <select class="delivery-status-select" data-index="${i}" style="width:130px">
              <option value="">— nicht eingetragen —</option>
              <option value="vollstaendig">Vollständig erhalten</option>
              <option value="teilweise">Teilweise erhalten</option>
              <option value="ausstehend">Ausstehend</option>
            </select>
          </td>
          <td style="padding:6px 0">
            <input type="number" class="delivery-qty-input" data-index="${i}"
              data-position="${esc(p.gegenstand)}"
              data-ordered="${p.menge || ''}"
              min="0.01" step="0.01" placeholder="Menge"
              style="width:90px;display:none" />
          </td>
        </tr>
      `).join('');
    } else {
      // Fallback: kein Positions-Array (alte Bestellung)
      posRows = `
        <tr>
          <td style="padding:6px 8px 6px 0"><strong>${esc(order.article_name)}</strong></td>
          <td style="padding:6px 8px">
            <select class="delivery-status-select" data-index="0" style="width:130px">
              <option value="">— nicht eingetragen —</option>
              <option value="vollstaendig">Vollständig erhalten</option>
              <option value="teilweise">Teilweise erhalten</option>
              <option value="ausstehend">Ausstehend</option>
            </select>
          </td>
          <td style="padding:6px 0">
            <input type="number" class="delivery-qty-input" data-index="0"
              data-position="${esc(order.article_name)}"
              min="0.01" step="0.01" placeholder="Menge"
              style="width:90px;display:none" />
          </td>
        </tr>
      `;
    }

    document.getElementById('delivery-modal-body').innerHTML = `
      <div class="form-group" style="margin-bottom:16px">
        <label>Lieferdatum</label>
        <input type="date" id="delivery-date" value="${today()}" style="max-width:180px" />
      </div>
      <table style="width:100%;margin-bottom:16px">
        <thead>
          <tr>
            <th style="padding:4px 8px 4px 0;color:#888;font-weight:600;font-size:0.85em">Position</th>
            <th style="padding:4px 8px;color:#888;font-weight:600;font-size:0.85em">Status</th>
            <th style="padding:4px 0;color:#888;font-weight:600;font-size:0.85em">Menge erhalten</th>
          </tr>
        </thead>
        <tbody>${posRows}</tbody>
      </table>
      <div class="form-group">
        <label>Anmerkung (optional)</label>
        <textarea id="delivery-notes" placeholder="z.B. Lieferschein-Nr., Hinweise..."></textarea>
      </div>
    `;

    // Dropdown → Mengenfeld ein-/ausblenden
    document.querySelectorAll('.delivery-status-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = sel.dataset.index;
        const qtyInput = document.querySelector(`.delivery-qty-input[data-index="${idx}"]`);
        if (sel.value === 'teilweise') {
          qtyInput.style.display = 'inline-block';
          qtyInput.focus();
        } else if (sel.value === 'vollstaendig') {
          qtyInput.style.display = 'inline-block';
          const ordered = parseFloat(qtyInput.dataset.ordered);
          if (ordered > 0) qtyInput.value = ordered;
        } else {
          qtyInput.style.display = 'none';
          qtyInput.value = '';
        }
      });
    });

    document.getElementById('delivery-modal').classList.add('active');
  }

  document.getElementById('close-detail-modal').addEventListener('click', () => {
    document.getElementById('detail-modal').classList.remove('active');
  });
  document.getElementById('close-detail-modal2').addEventListener('click', () => {
    document.getElementById('detail-modal').classList.remove('active');
  });

  document.getElementById('close-delivery-modal').addEventListener('click', closeDeliveryModal);
  document.getElementById('close-delivery-modal2').addEventListener('click', closeDeliveryModal);
  function closeDeliveryModal() {
    document.getElementById('delivery-modal').classList.remove('active');
    currentOrderId = null;
  }

  document.getElementById('btn-save-delivery').addEventListener('click', async () => {
    const date = document.getElementById('delivery-date').value;
    const notes = document.getElementById('delivery-notes').value;

    const statusSelects = document.querySelectorAll('.delivery-status-select');
    const entries = [];

    for (const sel of statusSelects) {
      if (!sel.value || sel.value === 'ausstehend') continue;
      const idx = sel.dataset.index;
      const qtyInput = document.querySelector(`.delivery-qty-input[data-index="${idx}"]`);
      const qty = parseFloat(qtyInput?.value);
      const positionName = qtyInput?.dataset.position || '';

      if (!qty || qty <= 0) {
        toast(`Menge für "${positionName}" eingeben`, 'error');
        return;
      }
      entries.push({ qty, positionName });
    }

    if (entries.length === 0) {
      toast('Mindestens eine Position als erhalten markieren', 'error');
      return;
    }

    try {
      for (const entry of entries) {
        await api.addDelivery(currentOrderId, {
          quantity_delivered: entry.qty,
          delivery_date: date || undefined,
          notes: notes || undefined,
          position_name: entry.positionName || undefined,
        });
      }
      toast('Lieferung eingetragen');
      closeDeliveryModal();
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  load();
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatDate(d) { if (!d) return '—'; const part = d.split('T')[0]; const [y,m,dd] = part.split('-'); return `${dd}.${m}.${y}`; }
function today() { return new Date().toISOString().split('T')[0]; }
function statusLabel(s) {
  return { offen: 'Offen', teillieferung: 'Teillieferung', vollstaendig: 'Vollständig', storniert: 'Storniert' }[s] || s;
}
