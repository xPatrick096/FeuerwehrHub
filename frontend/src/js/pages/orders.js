import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';
import { generateBeschaffungsauftrag } from '../pdf-generator.js';
import { esc } from '../utils.js';
import { icon, renderIcons } from '../icons.js';

const PAGE_SIZE = 25;

export async function renderOrders() {
  const [settings, user] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('orders');
  const isAdmin    = user?.role === 'admin' || user?.role === 'superuser';
  const perms      = user?.permissions || [];
  const canApprove = isAdmin || perms.includes('lager.approve');
  const canWrite   = isAdmin || perms.includes('lager') || canApprove;

  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Bestellübersicht</h2>
        <p>Alle erfassten Bestellungen und deren Status</p>
      </div>
      <button class="btn btn--outline btn--sm" id="btn-csv-export">${icon('bar-chart-2', 14)} CSV exportieren</button>
    </div>
    <div class="stats-row" id="stats-row"></div>
    <div class="card">
      <div class="card__header">
        Bestellungen
        <div class="filter-bar" style="margin:0">
          <input type="text" id="filter-search" placeholder="Suche..." style="width:180px" />
          <select id="filter-status">
            <option value="">Alle Status</option>
            <option value="entwurf">Entwurf</option>
            <option value="ausstehend">Ausstehend</option>
            <option value="genehmigt">Genehmigt</option>
            <option value="abgelehnt">Abgelehnt</option>
            <option value="offen">Offen (alt)</option>
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
        <div id="pagination-bar" style="display:none;align-items:center;justify-content:space-between;padding:10px 16px;border-top:1px solid var(--border);font-size:13px;color:var(--text-muted)">
          <span id="page-info"></span>
          <div class="btn-group">
            <button class="btn btn--outline btn--sm" id="btn-prev-page">← Zurück</button>
            <button class="btn btn--outline btn--sm" id="btn-next-page">Weiter →</button>
          </div>
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

  renderIcons(document.getElementById('page-content'));

  let allOrders = [];
  let currentPage = 1;
  let currentOrderId = null;

  // ── Daten laden ──────────────────────────────────────────────────────────────

  async function load() {
    const search = document.getElementById('filter-search').value;
    const status = document.getElementById('filter-status').value;
    currentPage = 1;

    const [orders, stats] = await Promise.all([
      api.getOrders({ search: search || undefined, status: status || undefined }),
      api.getStats(),
    ]);

    allOrders = orders || [];
    renderStats(stats);
    renderTable();
  }

  // Reject-Modal
  const rejectModal = document.createElement('div');
  rejectModal.innerHTML = `
    <div id="reject-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:400;align-items:center;justify-content:center">
      <div class="inline-panel" style="max-width:420px">
        <h3 style="margin:0 0 12px;font-size:16px">Ablehnen</h3>
        <div class="form-group">
          <label>Ablehnungsgrund</label>
          <textarea id="reject-reason" rows="3" placeholder="Bitte Grund angeben..."
            style="width:100%;resize:vertical;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card-hover);color:var(--text);font-size:13px"></textarea>
        </div>
        <div class="btn-group" style="margin-top:12px">
          <button class="btn btn--danger"  id="btn-confirm-reject">Ablehnen</button>
          <button class="btn btn--outline" id="btn-cancel-reject">Abbrechen</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(rejectModal.firstElementChild);

  let rejectTargetId = null;
  document.getElementById('btn-cancel-reject').addEventListener('click', () => {
    document.getElementById('reject-modal').style.display = 'none';
  });
  document.getElementById('btn-confirm-reject').addEventListener('click', async () => {
    const reason = document.getElementById('reject-reason').value.trim();
    if (!reason) { toast('Ablehnungsgrund eingeben', 'error'); return; }
    try {
      await api.rejectOrder(rejectTargetId, reason);
      toast('Abgelehnt');
      document.getElementById('reject-modal').style.display = 'none';
      load();
    } catch (e) { toast(e.message, 'error'); }
  });

  // ── Stats ────────────────────────────────────────────────────────────────────

  function renderStats(stats) {
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
  }

  // ── Tabelle + Pagination ─────────────────────────────────────────────────────

  function renderTable() {
    const totalPages = Math.max(1, Math.ceil(allOrders.length / PAGE_SIZE));
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = allOrders.slice(start, start + PAGE_SIZE);

    const tbody = document.getElementById('orders-tbody');
    if (allOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Keine Bestellungen gefunden</td></tr>`;
    } else {
      tbody.innerHTML = pageItems.map(o => {
        const positions = (o.positions || []).filter(p => p.gegenstand);
        let positionsHtml;
        if (positions.length > 0) {
          positionsHtml = `
            <table style="border-collapse:collapse;width:100%;font-size:0.85em">
              <thead>
                <tr>
                  <th style="padding:2px 8px 2px 0;color:var(--text-muted);font-weight:600;white-space:nowrap;border-bottom:1px solid var(--border);width:60px">Menge</th>
                  <th style="padding:2px 8px 2px 0;color:var(--text-muted);font-weight:600;white-space:nowrap;border-bottom:1px solid var(--border);width:110px">Einheit</th>
                  <th style="padding:2px 8px 2px 0;color:var(--text-muted);font-weight:600;white-space:nowrap;border-bottom:1px solid var(--border)">Gegenstand / Leistung</th>
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
          positionsHtml = `<span class="text-muted">${esc(o.article_name) || '—'}</span>`;
        }

        return `
          <tr>
            <td>${positionsHtml}</td>
            <td>${esc(o.ordered_by_name) || '—'}</td>
            <td>${formatDate(o.order_date)}</td>
            <td>
              <span class="badge badge--${o.approval_status || o.status}">${approvalLabel(o.approval_status, o.status)}</span>
            </td>
            <td>
              <div class="btn-group">
                <button class="btn btn--secondary btn--sm" data-action="detail" data-id="${o.id}" title="Details">${icon('search', 14)}</button>
                ${o.approval_status === 'entwurf'
                  ? `<button class="btn btn--primary btn--sm" data-action="submit" data-id="${o.id}" title="Einreichen">${icon('send', 14)}</button>`
                  : ''}
                ${o.approval_status === 'ausstehend' && canApprove ? `
                  <button class="btn btn--success btn--sm" data-action="approve" data-id="${o.id}" title="Genehmigen">${icon('check', 14)}</button>
                  <button class="btn btn--danger btn--sm"  data-action="reject"  data-id="${o.id}" title="Ablehnen">${icon('x', 14)}</button>
                ` : ''}
                ${o.approval_status === 'abgelehnt'
                  ? `<button class="btn btn--outline btn--sm" data-action="resubmit" data-id="${o.id}" title="Erneut einreichen">${icon('refresh-cw', 14)}</button>`
                  : ''}
                ${['genehmigt', 'offen', 'teillieferung'].includes(o.approval_status) && o.status !== 'vollstaendig' && o.status !== 'storniert'
                  ? `<button class="btn btn--success btn--sm" data-action="delivery" data-id="${o.id}" title="Lieferung">${icon('package', 14)}</button>`
                  : ''}
                <button class="btn btn--outline btn--sm" data-action="pdf"    data-id="${o.id}" title="PDF">${icon('file-text', 14)}</button>
                <button class="btn btn--outline btn--sm" data-action="email"  data-id="${o.id}" title="E-Mail">${icon('mail', 14)}</button>
                <button class="btn btn--danger btn--sm"  data-action="delete" data-id="${o.id}" title="Löschen">${icon('trash-2', 14)}</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    renderIcons(document.getElementById('orders-tbody'));

    // Pagination-Bar
    const bar = document.getElementById('pagination-bar');
    if (totalPages <= 1 && allOrders.length <= PAGE_SIZE) {
      bar.style.display = 'none';
    } else {
      bar.style.display = 'flex';
      document.getElementById('page-info').textContent =
        `${allOrders.length} Bestellungen — Seite ${currentPage} / ${totalPages}`;
      document.getElementById('btn-prev-page').disabled = currentPage <= 1;
      document.getElementById('btn-next-page').disabled = currentPage >= totalPages;
    }
  }

  // ── Pagination Events ────────────────────────────────────────────────────────

  document.getElementById('btn-prev-page').addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderTable(); }
  });
  document.getElementById('btn-next-page').addEventListener('click', () => {
    const totalPages = Math.ceil(allOrders.length / PAGE_SIZE);
    if (currentPage < totalPages) { currentPage++; renderTable(); }
  });

  // ── CSV Export ───────────────────────────────────────────────────────────────

  document.getElementById('btn-csv-export').addEventListener('click', () => {
    if (!allOrders.length) { toast('Keine Bestellungen zum Exportieren', 'error'); return; }
    exportCsv(allOrders);
  });

  // ── Filter Events ────────────────────────────────────────────────────────────

  let searchTimer;
  document.getElementById('filter-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 300);
  });
  document.getElementById('filter-status').addEventListener('change', load);

  // ── Delegated Action Events ──────────────────────────────────────────────────

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

    if (action === 'email') {
      try {
        const order = await api.getOrder(id);
        openMailto(order);
      } catch (e) {
        toast('Fehler: ' + e.message, 'error');
      }
    }

    if (action === 'submit') {
      if (!confirm('Beschaffungsauftrag zur Genehmigung einreichen?')) return;
      try { await api.submitOrder(id); toast('Eingereicht'); load(); }
      catch (e) { toast(e.message, 'error'); }
    }

    if (action === 'approve') {
      if (!confirm('Beschaffungsauftrag genehmigen?')) return;
      try { await api.approveOrder(id); toast('Genehmigt'); load(); }
      catch (e) { toast(e.message, 'error'); }
    }

    if (action === 'reject') {
      rejectTargetId = id;
      document.getElementById('reject-reason').value = '';
      document.getElementById('reject-modal').style.display = 'flex';
    }

    if (action === 'resubmit') {
      if (!confirm('Erneut zur Genehmigung einreichen?')) return;
      try { await api.resubmitOrder(id); toast('Erneut eingereicht'); load(); }
      catch (e) { toast(e.message, 'error'); }
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

  // ── Detail Modal ─────────────────────────────────────────────────────────────

  function showDetailModal(order) {
    const positions = (order.positions || []).filter(p => p.gegenstand);
    const haendler = [order.haendler_1, order.haendler_2, order.haendler_3].filter(Boolean);

    document.getElementById('detail-modal-body').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 20px;margin-bottom:16px;font-size:0.9em">
        <div><strong>Bedarfsmelder:</strong><br>${esc(order.ordered_by_name) || '—'}</div>
        <div><strong>Telefon:</strong><br>${esc(order.telefon) || '—'}</div>
        <div><strong>Datum:</strong><br>${formatDate(order.order_date)}</div>
        <div>
          <strong>Status:</strong><br>
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
            <select id="detail-status-select" style="font-size:0.9em">
              <option value="offen"         ${order.status==='offen'         ?'selected':''}>Offen</option>
              <option value="teillieferung" ${order.status==='teillieferung' ?'selected':''}>Teillieferung</option>
              <option value="vollstaendig"  ${order.status==='vollstaendig'  ?'selected':''}>Vollständig</option>
              <option value="storniert"     ${order.status==='storniert'     ?'selected':''}>Storniert</option>
            </select>
            <button class="btn btn--secondary btn--sm" id="btn-save-status" data-id="${order.id}">Speichern</button>
          </div>
        </div>
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

      ${order.rejection_reason ? `
        <div class="alert-danger" style="font-size:0.9em">
          <strong class="text-error">Ablehnungsgrund:</strong><br>
          <span style="color:var(--error)">${esc(order.rejection_reason)}</span>
          ${order.approved_by_name ? `<br><span class="text-muted text-xs">Abgelehnt von: ${esc(order.approved_by_name)}</span>` : ''}
        </div>
      ` : ''}

      ${order.approval_status === 'genehmigt' && order.approved_by_name ? `
        <div style="margin-bottom:12px;font-size:0.9em;color:var(--text-muted)">
          Genehmigt von: ${esc(order.approved_by_name)}
          ${order.approved_at ? ` · ${formatDate(order.approved_at)}` : ''}
        </div>
      ` : ''}

      ${order.notes ? `
        <div style="font-size:0.9em;color:var(--text-muted)">
          <strong>Interne Anmerkungen:</strong><br>${esc(order.notes)}
        </div>
      ` : ''}
    `;

    document.getElementById('btn-save-status').addEventListener('click', async (e) => {
      const orderId = e.currentTarget.dataset.id;
      const newStatus = document.getElementById('detail-status-select').value;
      try {
        await api.setStatus(orderId, newStatus);
        toast('Status geändert');
        document.getElementById('detail-modal').classList.remove('active');
        load();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    document.getElementById('detail-modal').classList.add('active');
  }

  // ── Delivery Modal ───────────────────────────────────────────────────────────

  function showDeliveryModal(order) {
    const positions = (order.positions || []).filter(p => p.gegenstand);

    let posRows = '';
    if (positions.length > 0) {
      posRows = positions.map((p, i) => `
        <tr>
          <td style="padding:6px 8px 6px 0">
            <strong>${esc(p.gegenstand)}</strong>
            ${p.menge || p.einheit ? `<br><small class="text-muted">${esc(p.menge || '')} ${esc(p.einheit || '')}</small>` : ''}
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
            <th style="padding:4px 8px 4px 0;color:var(--text-muted);font-weight:600;font-size:0.85em">Position</th>
            <th style="padding:4px 8px;color:var(--text-muted);font-weight:600;font-size:0.85em">Status</th>
            <th style="padding:4px 0;color:var(--text-muted);font-weight:600;font-size:0.85em">Menge erhalten</th>
          </tr>
        </thead>
        <tbody>${posRows}</tbody>
      </table>
      <div class="form-group">
        <label>Anmerkung (optional)</label>
        <textarea id="delivery-notes" placeholder="z.B. Lieferschein-Nr., Hinweise..."></textarea>
      </div>
    `;

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

  // ── Modal Close Events ───────────────────────────────────────────────────────

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

// ── CSV Export ─────────────────────────────────────────────────────────────────

function exportCsv(orders) {
  const headers = ['Datum', 'Bedarfsmelder', 'Status', 'Positionen', 'Begründung', 'Händler'];
  const rows = orders.map(o => {
    const pos = (o.positions || [])
      .filter(p => p.gegenstand)
      .map(p => [p.menge, p.einheit, p.gegenstand].filter(Boolean).join(' '))
      .join(' | ');
    return [
      formatDate(o.order_date),
      o.ordered_by_name || '',
      statusLabel(o.status),
      pos || o.article_name || '',
      o.begruendung || '',
      [o.haendler_1, o.haendler_2, o.haendler_3].filter(Boolean).join(', '),
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(';'))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bestellungen_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── E-Mail (mailto:) ───────────────────────────────────────────────────────────

function openMailto(order) {
  const positions = (order.positions || [])
    .filter(p => p.gegenstand)
    .map(p => `  - ${p.gegenstand}${p.menge ? ' (' + p.menge + (p.einheit ? ' ' + p.einheit : '') + ')' : ''}`)
    .join('\n') || `  - ${order.article_name || ''}`;

  const haendler = [order.haendler_1, order.haendler_2, order.haendler_3].filter(Boolean);

  const lines = [
    'Beschaffungsauftrag',
    '',
    `Bedarfsmelder: ${order.ordered_by_name || '—'}`,
    `Datum: ${formatDate(order.order_date)}`,
    `Telefon: ${order.telefon || '—'}`,
    `Lieferanschrift: ${order.lieferanschrift || '—'}`,
    '',
    'Positionen:',
    positions,
  ];

  if (order.begruendung) lines.push('', `Begründung: ${order.begruendung}`);
  if (haendler.length > 0) lines.push('', `Händler: ${haendler.join(', ')}`);

  const subject = encodeURIComponent(`Beschaffungsauftrag vom ${formatDate(order.order_date)}`);
  const body = encodeURIComponent(lines.join('\n'));

  const a = document.createElement('a');
  a.href = `mailto:?subject=${subject}&body=${body}`;
  a.click();
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function formatDate(d) { if (!d) return '—'; const part = d.split('T')[0]; const [y,m,dd] = part.split('-'); return `${dd}.${m}.${y}`; }
function today() { return new Date().toISOString().split('T')[0]; }
function statusLabel(s) {
  return { offen: 'Offen', teillieferung: 'Teillieferung', vollstaendig: 'Vollständig', storniert: 'Storniert' }[s] || s;
}

function approvalLabel(approvalStatus, deliveryStatus) {
  if (approvalStatus === 'genehmigt') {
    return { offen: 'Offen', teillieferung: 'Teillieferung', vollstaendig: 'Vollständig', storniert: 'Storniert' }[deliveryStatus] || 'Genehmigt';
  }
  return { entwurf: 'Entwurf', ausstehend: 'Ausstehend', abgelehnt: 'Abgelehnt' }[approvalStatus] || statusLabel(deliveryStatus);
}
