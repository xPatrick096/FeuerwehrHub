import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';

export async function renderArticles() {
  const [settings, user, units] = await Promise.all([
    api.getSettings(), api.me(), api.getUnits(),
  ]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('articles');

  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Artikelstamm</h2>
        <p>Bekannte Artikel verwalten und als Vorlage für Bestellungen nutzen</p>
      </div>
      <button class="btn btn--primary" id="btn-new-article">➕ Neuer Artikel</button>
    </div>
    <div class="card">
      <div class="card__header">Artikel</div>
      <div class="card__body" style="padding:0">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Bezeichnung</th>
                <th>Kategorie</th>
                <th>Einheit</th>
                <th>Mindestbestand</th>
                <th>Anmerkung</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody id="articles-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div class="modal-overlay" id="article-modal">
      <div class="modal">
        <div class="modal__header">
          <span id="modal-title">Neuer Artikel</span>
          <button class="modal__close" id="close-article-modal">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label>Bezeichnung *</label>
            <input type="text" id="a-name" placeholder="z.B. HP 85A Toner" />
          </div>
          <div class="form-group">
            <label>Kategorie</label>
            <input type="text" id="a-category" placeholder="z.B. Toner, Papier..." />
          </div>
          <div class="form-group">
            <label>Einheit *</label>
            <select id="a-unit">
              ${units.map(u => `<option value="${esc(u.label)}">${esc(u.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Mindestbestand</label>
            <input type="number" id="a-min-stock" min="0" value="0" />
          </div>
          <div class="form-group">
            <label>Anmerkung</label>
            <textarea id="a-notes" placeholder="Optional..."></textarea>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="close-article-modal2">Abbrechen</button>
          <button class="btn btn--primary" id="btn-save-article">Speichern</button>
        </div>
      </div>
    </div>
  `;

  let editId = null;

  async function load() {
    const articles = await api.getArticles();
    const tbody = document.getElementById('articles-tbody');

    if (!articles || articles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Keine Artikel vorhanden</td></tr>`;
      return;
    }

    tbody.innerHTML = articles.map(a => `
      <tr>
        <td><strong>${esc(a.name)}</strong></td>
        <td>${esc(a.category) || '—'}</td>
        <td>${esc(a.unit)}</td>
        <td>${a.min_stock || 0}</td>
        <td>${esc(a.notes) || '—'}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn--outline btn--sm" data-action="edit"
              data-id="${a.id}" data-name="${esc(a.name)}" data-category="${esc(a.category||'')}"
              data-unit="${esc(a.unit)}" data-stock="${a.min_stock}" data-notes="${esc(a.notes||'')}">
              ✏️ Bearbeiten
            </button>
            <button class="btn btn--danger btn--sm" data-action="delete" data-id="${a.id}">🗑</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  function openModal(article = null) {
    editId = article?.id || null;
    document.getElementById('modal-title').textContent = article ? 'Artikel bearbeiten' : 'Neuer Artikel';
    document.getElementById('a-name').value = article?.name || '';
    document.getElementById('a-category').value = article?.category || '';
    document.getElementById('a-unit').value = article?.unit || units[0]?.label || '';
    document.getElementById('a-min-stock').value = article?.min_stock || 0;
    document.getElementById('a-notes').value = article?.notes || '';
    document.getElementById('article-modal').classList.add('active');
  }

  function closeModal() {
    document.getElementById('article-modal').classList.remove('active');
    editId = null;
  }

  document.getElementById('btn-new-article').addEventListener('click', () => openModal());
  document.getElementById('close-article-modal').addEventListener('click', closeModal);
  document.getElementById('close-article-modal2').addEventListener('click', closeModal);

  document.getElementById('articles-tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    if (btn.dataset.action === 'edit') {
      openModal({
        id: btn.dataset.id,
        name: btn.dataset.name,
        category: btn.dataset.category,
        unit: btn.dataset.unit,
        min_stock: parseInt(btn.dataset.stock),
        notes: btn.dataset.notes,
      });
    }

    if (btn.dataset.action === 'delete') {
      if (!confirm('Artikel wirklich löschen?')) return;
      try {
        await api.deleteArticle(btn.dataset.id);
        toast('Artikel gelöscht');
        load();
      } catch (e) {
        toast(e.message, 'error');
      }
    }
  });

  document.getElementById('btn-save-article').addEventListener('click', async () => {
    const body = {
      name: document.getElementById('a-name').value.trim(),
      category: document.getElementById('a-category').value.trim() || null,
      unit: document.getElementById('a-unit').value,
      min_stock: parseInt(document.getElementById('a-min-stock').value) || 0,
      notes: document.getElementById('a-notes').value.trim() || null,
    };

    if (!body.name) { toast('Bezeichnung eingeben', 'error'); return; }

    try {
      if (editId) {
        await api.updateArticle(editId, body);
        toast('Artikel aktualisiert');
      } else {
        await api.createArticle(body);
        toast('Artikel angelegt');
      }
      closeModal();
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  load();
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
