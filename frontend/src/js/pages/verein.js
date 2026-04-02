import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';
import { esc } from '../utils.js';
import { icon, renderIcons } from '../icons.js';

export async function renderVerein() {
  const [settings, user] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('verein');

  const content = document.getElementById('page-content');
  const isAdmin = user?.role === 'admin' || user?.role === 'superuser';

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Verein</h2>
        <p>Vereinsverwaltung</p>
      </div>
    </div>

    <div class="tab-bar" id="verein-tabs">
      <button class="tab-btn tab-btn--active" data-tab="schwarzesbrett">${icon('clipboard-list', 14)} Schwarzes Brett</button>
      <button class="tab-btn" data-tab="mitglieder">${icon('users', 14)} Mitglieder</button>
      <button class="tab-btn" data-tab="ehrungen">${icon('award', 14)} Ehrungen</button>
      <button class="tab-btn" data-tab="vorstand">${icon('user-check', 14)} Vorstand</button>
      <button class="tab-btn" data-tab="dokumente">${icon('folder', 14)} Dokumente</button>
      ${isAdmin ? `<button class="tab-btn" data-tab="briefkopf">${icon('settings', 14)} Briefkopf</button>` : ''}
    </div>

    <div id="tab-schwarzesbrett" class="tab-panel"></div>
    <div id="tab-mitglieder"     class="tab-panel" style="display:none"></div>
    <div id="tab-ehrungen"       class="tab-panel" style="display:none"></div>
    <div id="tab-vorstand"       class="tab-panel" style="display:none"></div>
    <div id="tab-dokumente"      class="tab-panel" style="display:none"></div>
    ${isAdmin ? `<div id="tab-briefkopf" class="tab-panel" style="display:none"></div>` : ''}
  `;

  renderIcons(content);

  document.querySelectorAll('#verein-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#verein-tabs .tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
      document.querySelectorAll('.tab-panel').forEach(t => t.style.display = 'none');
      btn.classList.add('tab-btn--active');
      document.getElementById(`tab-${btn.dataset.tab}`).style.display = '';
    });
  });

  loadSchwarztesBrett(isAdmin);
  loadMitglieder(isAdmin);
  loadEhrungen();
  loadVorstand(isAdmin);
  loadDokumente(isAdmin);
  if (isAdmin) loadBriefkopf();
}

// ── Schwarzes Brett ───────────────────────────────────────────────────────────

async function loadSchwarztesBrett(isAdmin) {
  const el = document.getElementById('tab-schwarzesbrett');

  el.innerHTML = `
    <div class="section-header">
      <h3>Schwarzes Brett</h3>
      ${isAdmin ? `<button class="btn btn--primary" id="btn-new-post">${icon('plus', 14)} Beitrag erstellen</button>` : ''}
    </div>
    <div id="posts-list"><p class="text-muted">Lädt...</p></div>
  `;

  renderIcons(el);

  if (isAdmin) {
    document.getElementById('btn-new-post').addEventListener('click', () => openPostModal());
  }

  await refreshPosts(isAdmin);
}

async function refreshPosts(isAdmin) {
  const el = document.getElementById('posts-list');
  try {
    const posts = await api.getVereinPosts();
    if (!posts?.length) {
      el.innerHTML = `<div class="empty-state">Noch keine Beiträge vorhanden.</div>`;
      return;
    }
    el.innerHTML = posts.map(p => `
      <div class="card" style="margin-bottom:12px">
        <div class="card__header">
          <span>
            ${p.pinned ? `<span style="color:#d29922;margin-right:6px">${icon('pin', 13)}</span>` : ''}
            ${esc(p.title)}
            ${p.visibility === 'vorstand' ? `<span class="badge badge--superuser" style="margin-left:8px">Nur Vorstand</span>` : ''}
          </span>
          <span class="text-muted text-sm">
            ${p.expires_at ? `Bis ${p.expires_at} · ` : ''}${esc(p.created_by_name)}
          </span>
        </div>
        <div class="card__body">
          <p style="white-space:pre-wrap;margin:0">${esc(p.content)}</p>
          ${isAdmin ? `
          <div class="btn-group" style="margin-top:12px">
            <button class="btn btn--outline btn--sm" data-edit-post="${p.id}">Bearbeiten</button>
            <button class="btn btn--danger btn--sm" data-del-post="${p.id}">Löschen</button>
          </div>` : ''}
        </div>
      </div>
    `).join('');

    renderIcons(el);

    el.querySelectorAll('[data-edit-post]').forEach(btn => {
      const post = posts.find(p => p.id === btn.dataset.editPost);
      btn.addEventListener('click', () => openPostModal(post));
    });
    el.querySelectorAll('[data-del-post]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Beitrag löschen?')) return;
        await api.deleteVereinPost(btn.dataset.delPost);
        toast('Beitrag gelöscht', 'success');
        refreshPosts(isAdmin);
      });
    });
  } catch (e) {
    el.innerHTML = `<p class="text-muted">${esc(e.message)}</p>`;
  }
}

function openPostModal(post = null) {
  const existing = document.getElementById('post-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'post-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h3>${post ? 'Beitrag bearbeiten' : 'Neuer Beitrag'}</h3>
        <button class="modal__close" id="close-post-modal">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-group">
          <label>Titel</label>
          <input type="text" id="post-title" value="${esc(post?.title || '')}" />
        </div>
        <div class="form-group">
          <label>Inhalt</label>
          <textarea id="post-content" rows="5">${esc(post?.content || '')}</textarea>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Sichtbarkeit</label>
            <select id="post-visibility">
              <option value="all"      ${post?.visibility !== 'vorstand' ? 'selected' : ''}>Alle</option>
              <option value="vorstand" ${post?.visibility === 'vorstand' ? 'selected' : ''}>Nur Vorstand</option>
            </select>
          </div>
          <div class="form-group">
            <label>Ablaufdatum (optional)</label>
            <input type="date" id="post-expires" value="${post?.expires_at || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="post-pinned" ${post?.pinned ? 'checked' : ''} />
            Anheften
          </label>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-post-modal2">Abbrechen</button>
        <button class="btn btn--primary" id="save-post-btn">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById('close-post-modal').addEventListener('click', close);
  document.getElementById('close-post-modal2').addEventListener('click', close);

  document.getElementById('save-post-btn').addEventListener('click', async () => {
    const body = {
      title:      document.getElementById('post-title').value.trim(),
      content:    document.getElementById('post-content').value.trim(),
      visibility: document.getElementById('post-visibility').value,
      expires_at: document.getElementById('post-expires').value || null,
      pinned:     document.getElementById('post-pinned').checked,
    };
    if (!body.title) { toast('Titel fehlt', 'error'); return; }
    try {
      if (post) { await api.updateVereinPost(post.id, body); }
      else       { await api.createVereinPost(body); }
      toast('Gespeichert', 'success');
      modal.remove();
      refreshPosts(true);
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ── Vorstand ──────────────────────────────────────────────────────────────────

async function loadVorstand(isAdmin) {
  const el = document.getElementById('tab-vorstand');

  el.innerHTML = `
    <div class="section-header">
      <h3>Vorstand</h3>
      ${isAdmin ? `<button class="btn btn--primary" id="btn-new-vorstand">${icon('plus', 14)} Hinzufügen</button>` : ''}
    </div>
    <div id="vorstand-list"><p class="text-muted">Lädt...</p></div>
  `;

  renderIcons(el);

  if (isAdmin) {
    document.getElementById('btn-new-vorstand').addEventListener('click', () => openVorstandModal());
  }

  await refreshVorstand(isAdmin);
}

async function refreshVorstand(isAdmin) {
  const el = document.getElementById('vorstand-list');
  try {
    const list = await api.getVorstand();
    if (!list?.length) {
      el.innerHTML = `<div class="empty-state">Kein Vorstand eingetragen.</div>`;
      return;
    }
    el.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead><tr>
            <th>Name</th><th>Funktion</th><th>Seit</th><th>Bis</th>
            ${isAdmin ? '<th></th>' : ''}
          </tr></thead>
          <tbody>
            ${list.map(v => `
              <tr>
                <td>${esc(v.name)}</td>
                <td>${esc(v.funktion)}</td>
                <td class="text-muted text-sm">${v.seit || '—'}</td>
                <td class="text-muted text-sm">${v.bis || '—'}</td>
                ${isAdmin ? `<td>
                  <div class="btn-group">
                    <button class="btn btn--outline btn--sm" data-edit-vorstand="${v.id}">Bearbeiten</button>
                    <button class="btn btn--danger btn--sm" data-del-vorstand="${v.id}">Löschen</button>
                  </div>
                </td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    el.querySelectorAll('[data-edit-vorstand]').forEach(btn => {
      const v = list.find(x => x.id === btn.dataset.editVorstand);
      btn.addEventListener('click', () => openVorstandModal(v));
    });
    el.querySelectorAll('[data-del-vorstand]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Eintrag löschen?')) return;
        await api.deleteVorstand(btn.dataset.delVorstand);
        toast('Gelöscht', 'success');
        refreshVorstand(isAdmin);
      });
    });
  } catch (e) {
    el.innerHTML = `<p class="text-muted">${esc(e.message)}</p>`;
  }
}

function openVorstandModal(v = null) {
  const existing = document.getElementById('vorstand-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'vorstand-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h3>${v ? 'Vorstandsmitglied bearbeiten' : 'Vorstandsmitglied hinzufügen'}</h3>
        <button class="modal__close" id="close-vm">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="vm-name" value="${esc(v?.name || '')}" />
          </div>
          <div class="form-group">
            <label>Funktion</label>
            <input type="text" id="vm-funktion" value="${esc(v?.funktion || '')}" placeholder="z.B. 1. Vorsitzender" />
          </div>
          <div class="form-group">
            <label>Gewählt seit</label>
            <input type="date" id="vm-seit" value="${v?.seit || ''}" />
          </div>
          <div class="form-group">
            <label>Amtszeit bis</label>
            <input type="date" id="vm-bis" value="${v?.bis || ''}" />
          </div>
          <div class="form-group">
            <label>Reihenfolge</label>
            <input type="number" id="vm-sort" value="${v?.sort_order ?? 0}" />
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-vm2">Abbrechen</button>
        <button class="btn btn--primary" id="save-vm-btn">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById('close-vm').addEventListener('click', close);
  document.getElementById('close-vm2').addEventListener('click', close);

  document.getElementById('save-vm-btn').addEventListener('click', async () => {
    const body = {
      name:       document.getElementById('vm-name').value.trim(),
      funktion:   document.getElementById('vm-funktion').value.trim(),
      seit:       document.getElementById('vm-seit').value || null,
      bis:        document.getElementById('vm-bis').value || null,
      sort_order: parseInt(document.getElementById('vm-sort').value) || 0,
    };
    if (!body.name || !body.funktion) { toast('Name und Funktion erforderlich', 'error'); return; }
    try {
      if (v) { await api.updateVorstand(v.id, body); }
      else    { await api.createVorstand(body); }
      toast('Gespeichert', 'success');
      modal.remove();
      refreshVorstand(true);
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ── Dokumente ─────────────────────────────────────────────────────────────────

async function loadDokumente(isAdmin) {
  const el = document.getElementById('tab-dokumente');

  el.innerHTML = `
    <div class="section-header">
      <h3>Dokumentenablage</h3>
      ${isAdmin ? `<label class="btn btn--primary" style="cursor:pointer">
        ${icon('upload', 14)} Dokument hochladen
        <input type="file" id="doc-upload-input" style="display:none" />
      </label>` : ''}
    </div>
    ${isAdmin ? `
    <div class="card" id="upload-form">
      <div class="card__body">
        <div class="form-grid">
          <div class="form-group">
            <label>Kategorie</label>
            <input type="text" id="doc-category" placeholder="z.B. Satzung, Protokolle, Versicherungen" />
          </div>
          <div class="form-group">
            <label>Zugriff</label>
            <select id="doc-access">
              <option value="all">Alle</option>
              <option value="vorstand">Nur Vorstand / Admin</option>
            </select>
          </div>
        </div>
      </div>
    </div>` : ''}
    <div id="dokumente-list"><p class="text-muted">Lädt...</p></div>
  `;

  renderIcons(el);

  if (isAdmin) {
    document.getElementById('doc-upload-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const category = document.getElementById('doc-category').value || 'Allgemein';
      const access   = document.getElementById('doc-access').value || 'all';
      try {
        await api.uploadDocument(file, category, access);
        toast('Dokument hochgeladen', 'success');
        e.target.value = '';
        refreshDokumente(isAdmin);
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  await refreshDokumente(isAdmin);
}

async function refreshDokumente(isAdmin) {
  const el = document.getElementById('dokumente-list');
  try {
    const docs = await api.getDocuments();
    if (!docs?.length) {
      el.innerHTML = `<div class="empty-state">Noch keine Dokumente hochgeladen.</div>`;
      return;
    }

    const byCategory = {};
    docs.forEach(d => {
      if (!byCategory[d.category]) byCategory[d.category] = [];
      byCategory[d.category].push(d);
    });

    el.innerHTML = Object.entries(byCategory).map(([cat, items]) => `
      <div class="card" style="margin-bottom:12px">
        <div class="card__header">${icon('folder', 14)} ${esc(cat)}</div>
        <div class="card__body" style="padding:0">
          <table>
            <tbody>
              ${items.map(d => `
                <tr>
                  <td>${icon('file', 13)} ${esc(d.name)}</td>
                  <td class="text-muted text-sm">${formatSize(d.file_size)}</td>
                  <td class="text-muted text-sm">
                    ${d.access_level === 'vorstand'
                      ? `<span class="badge badge--superuser">Nur Vorstand</span>`
                      : `<span class="badge badge--vollstaendig">Alle</span>`}
                  </td>
                  <td class="text-muted text-sm">${esc(d.uploaded_by_name)}</td>
                  <td>
                    <div class="btn-group">
                      <button class="btn btn--secondary btn--sm" data-download="${d.id}" data-name="${esc(d.name)}">
                        ${icon('download', 13)} Download
                      </button>
                      ${isAdmin ? `<button class="btn btn--danger btn--sm" data-del-doc="${d.id}">Löschen</button>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');

    renderIcons(el);

    el.querySelectorAll('[data-download]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const res = await api.downloadDocument(btn.dataset.download);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = btn.dataset.name;
        a.click(); URL.revokeObjectURL(url);
      });
    });

    el.querySelectorAll('[data-del-doc]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Dokument löschen?')) return;
        await api.deleteDocument(btn.dataset.delDoc);
        toast('Gelöscht', 'success');
        refreshDokumente(isAdmin);
      });
    });
  } catch (e) {
    el.innerHTML = `<p class="text-muted">${esc(e.message)}</p>`;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Mitglieder ────────────────────────────────────────────────────────────────

const STATUS_LABELS = { aktiv: 'Aktiv', passiv: 'Passiv', ehren: 'Ehrenmitglied', jugend: 'Jugend' };
const STATUS_BADGE  = { aktiv: 'badge--vollstaendig', passiv: 'badge--ausstehend', ehren: 'badge--superuser', jugend: 'badge--teillieferung' };

async function loadMitglieder(isAdmin) {
  const el = document.getElementById('tab-mitglieder');
  el.innerHTML = `
    <div class="section-header">
      <h3>Mitglieder</h3>
      ${isAdmin ? `<button class="btn btn--primary" id="btn-new-mitglied">${icon('plus', 14)} Mitglied anlegen</button>` : ''}
    </div>
    <div class="filter-bar">
      <select id="filter-status">
        <option value="">Alle Status</option>
        <option value="aktiv">Aktiv</option>
        <option value="passiv">Passiv</option>
        <option value="ehren">Ehrenmitglied</option>
        <option value="jugend">Jugend</option>
      </select>
      <input type="text" id="filter-name" placeholder="Name suchen…" style="flex:1;max-width:260px" />
    </div>
    <div id="mitglieder-list"><p class="text-muted">Lädt...</p></div>
  `;
  renderIcons(el);
  if (isAdmin) document.getElementById('btn-new-mitglied').addEventListener('click', () => openMitgliedModal());
  document.getElementById('filter-status').addEventListener('change', () => renderMitgliederTable(isAdmin));
  document.getElementById('filter-name').addEventListener('input', () => renderMitgliederTable(isAdmin));
  await refreshMitglieder(isAdmin);
}

let _mitgliederCache = [];

async function refreshMitglieder(isAdmin) {
  try {
    _mitgliederCache = await api.getMitglieder();
    renderMitgliederTable(isAdmin);
  } catch (e) {
    document.getElementById('mitglieder-list').innerHTML = `<p class="text-muted">${esc(e.message)}</p>`;
  }
}

function renderMitgliederTable(isAdmin) {
  const el = document.getElementById('mitglieder-list');
  if (!el) return;
  const statusFilter = document.getElementById('filter-status')?.value || '';
  const nameFilter   = (document.getElementById('filter-name')?.value || '').toLowerCase();

  let list = _mitgliederCache;
  if (statusFilter) list = list.filter(m => m.status === statusFilter);
  if (nameFilter)   list = list.filter(m =>
    (m.vorname + ' ' + m.nachname).toLowerCase().includes(nameFilter) ||
    m.mitgliedsnummer.toLowerCase().includes(nameFilter)
  );

  const aktive  = list.filter(m => !m.archiviert);
  const archiv  = list.filter(m => m.archiviert);

  if (!aktive.length && !archiv.length) {
    el.innerHTML = `<div class="empty-state">Noch keine Mitglieder angelegt.</div>`;
    return;
  }

  const renderRows = (items) => items.map(m => `
    <tr>
      <td class="text-muted text-sm">${esc(m.mitgliedsnummer)}</td>
      <td><strong>${esc(m.nachname)}</strong>, ${esc(m.vorname)}</td>
      <td><span class="badge ${STATUS_BADGE[m.status] || ''}">${STATUS_LABELS[m.status] || m.status}</span></td>
      <td class="text-muted text-sm">${m.eintrittsdatum || '—'}</td>
      <td class="text-muted text-sm">${m.email ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : '—'}</td>
      ${isAdmin ? `<td>
        <div class="btn-group">
          <button class="btn btn--outline btn--sm" data-detail="${m.id}">Details</button>
          <button class="btn btn--outline btn--sm" data-edit-m="${m.id}">Bearbeiten</button>
          ${!m.archiviert ? `<button class="btn btn--danger btn--sm" data-archive-m="${m.id}">Archivieren</button>` : ''}
        </div>
      </td>` : `<td><button class="btn btn--outline btn--sm" data-detail="${m.id}">Details</button></td>`}
    </tr>
  `).join('');

  el.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Nr.</th><th>Name</th><th>Status</th><th>Eintrittsdatum</th><th>E-Mail</th><th></th>
        </tr></thead>
        <tbody>${renderRows(aktive)}</tbody>
      </table>
    </div>
    ${archiv.length ? `
    <details style="margin-top:16px">
      <summary class="text-muted text-sm" style="cursor:pointer;padding:8px 0">Archiv (${archiv.length})</summary>
      <div class="table-wrapper" style="margin-top:8px">
        <table>
          <thead><tr><th>Nr.</th><th>Name</th><th>Status</th><th>Eintrittsdatum</th><th>E-Mail</th><th></th></tr></thead>
          <tbody>${renderRows(archiv)}</tbody>
        </table>
      </div>
    </details>` : ''}
  `;

  el.querySelectorAll('[data-detail]').forEach(btn => {
    const m = _mitgliederCache.find(x => x.id === btn.dataset.detail);
    btn.addEventListener('click', () => openMitgliedDetail(m, isAdmin));
  });
  if (isAdmin) {
    el.querySelectorAll('[data-edit-m]').forEach(btn => {
      const m = _mitgliederCache.find(x => x.id === btn.dataset.editM);
      btn.addEventListener('click', () => openMitgliedModal(m));
    });
    el.querySelectorAll('[data-archive-m]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Mitglied archivieren?')) return;
        await api.deleteMitglied(btn.dataset.archiveM);
        toast('Archiviert', 'success');
        refreshMitglieder(isAdmin);
      });
    });
  }
}

function openMitgliedModal(m = null) {
  const existing = document.getElementById('mitglied-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'mitglied-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h3>${m ? 'Mitglied bearbeiten' : 'Neues Mitglied'}</h3>
        <button class="modal__close" id="close-mm">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group">
            <label>Vorname</label>
            <input type="text" id="mm-vorname" value="${esc(m?.vorname || '')}" />
          </div>
          <div class="form-group">
            <label>Nachname</label>
            <input type="text" id="mm-nachname" value="${esc(m?.nachname || '')}" />
          </div>
          <div class="form-group">
            <label>E-Mail</label>
            <input type="email" id="mm-email" value="${esc(m?.email || '')}" />
          </div>
          <div class="form-group">
            <label>Telefon</label>
            <input type="text" id="mm-telefon" value="${esc(m?.telefon || '')}" />
          </div>
          <div class="form-group">
            <label>Geburtsdatum</label>
            <input type="date" id="mm-geburt" value="${m?.geburtsdatum || ''}" />
          </div>
          <div class="form-group">
            <label>Eintrittsdatum</label>
            <input type="date" id="mm-eintritt" value="${m?.eintrittsdatum || ''}" />
          </div>
          <div class="form-group">
            <label>Status</label>
            <select id="mm-status">
              ${['aktiv','passiv','ehren','jugend'].map(s =>
                `<option value="${s}" ${(m?.status || 'aktiv') === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`
              ).join('')}
            </select>
          </div>
          ${m ? `
          <div class="form-group">
            <label>Austrittsdatum</label>
            <input type="date" id="mm-austritt" value="${m?.austritt_datum || ''}" />
          </div>
          <div class="form-group form-group--full">
            <label>Austrittsgrund</label>
            <input type="text" id="mm-austrittsgrund" value="${esc(m?.austritt_grund || '')}" />
          </div>` : ''}
          <div class="form-group form-group--full">
            <label>Bemerkung</label>
            <textarea id="mm-bemerkung" rows="2">${esc(m?.bemerkung || '')}</textarea>
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-mm2">Abbrechen</button>
        <button class="btn btn--primary" id="save-mm-btn">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById('close-mm').addEventListener('click', close);
  document.getElementById('close-mm2').addEventListener('click', close);

  document.getElementById('save-mm-btn').addEventListener('click', async () => {
    const body = {
      vorname:        document.getElementById('mm-vorname').value.trim(),
      nachname:       document.getElementById('mm-nachname').value.trim(),
      email:          document.getElementById('mm-email').value.trim() || null,
      telefon:        document.getElementById('mm-telefon').value.trim() || null,
      geburtsdatum:   document.getElementById('mm-geburt').value || null,
      eintrittsdatum: document.getElementById('mm-eintritt').value,
      status:         document.getElementById('mm-status').value,
      bemerkung:      document.getElementById('mm-bemerkung').value.trim() || null,
    };
    if (m) {
      body.austritt_datum   = document.getElementById('mm-austritt')?.value || null;
      body.austritt_grund   = document.getElementById('mm-austrittsgrund')?.value.trim() || null;
    }
    if (!body.vorname || !body.nachname)       { toast('Vor- und Nachname erforderlich', 'error'); return; }
    if (!body.eintrittsdatum)                  { toast('Eintrittsdatum erforderlich', 'error'); return; }
    try {
      if (m) await api.updateMitglied(m.id, body);
      else   await api.createMitglied(body);
      toast('Gespeichert', 'success');
      modal.remove();
      refreshMitglieder(true);
    } catch (e) { toast(e.message, 'error'); }
  });
}

function openMitgliedDetail(m, isAdmin) {
  const existing = document.getElementById('mitglied-detail-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'mitglied-detail-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal" style="max-width:680px">
      <div class="modal__header">
        <h3>${esc(m.vorname)} ${esc(m.nachname)} <span class="badge ${STATUS_BADGE[m.status] || ''}" style="margin-left:8px">${STATUS_LABELS[m.status]}</span></h3>
        <button class="modal__close" id="close-detail">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-grid" style="margin-bottom:16px">
          <div><span class="text-muted text-xs">Mitgliedsnr.</span><br>${esc(m.mitgliedsnummer)}</div>
          <div><span class="text-muted text-xs">Eingetreten</span><br>${m.eintrittsdatum || '—'}</div>
          <div><span class="text-muted text-xs">E-Mail</span><br>${m.email ? `<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>` : '—'}</div>
          <div><span class="text-muted text-xs">Telefon</span><br>${esc(m.telefon || '—')}</div>
        </div>

        <div class="section-header" style="margin-top:16px">
          <h3 style="font-size:14px">Qualifikationen</h3>
          ${isAdmin ? `<button class="btn btn--outline btn--sm" id="btn-add-quali">+ Hinzufügen</button>` : ''}
        </div>
        <div id="quali-list-${m.id}" class="text-muted text-sm">Lädt...</div>

        <div class="section-header" style="margin-top:20px">
          <h3 style="font-size:14px">Auszeichnungen</h3>
          ${isAdmin ? `<button class="btn btn--outline btn--sm" id="btn-add-auszeichnung">+ Hinzufügen</button>` : ''}
        </div>
        <div id="auszeichnung-list-${m.id}" class="text-muted text-sm">Lädt...</div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-detail2">Schließen</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById('close-detail').addEventListener('click', close);
  document.getElementById('close-detail2').addEventListener('click', close);

  loadQualiList(m.id, isAdmin);
  loadAuszeichnungList(m.id, isAdmin);

  if (isAdmin) {
    document.getElementById('btn-add-quali').addEventListener('click', () => openQualiModal(m.id));
    document.getElementById('btn-add-auszeichnung').addEventListener('click', () => openAuszeichnungModal(m.id));
  }
}

async function loadQualiList(mitgliedId, isAdmin) {
  const el = document.getElementById(`quali-list-${mitgliedId}`);
  if (!el) return;
  try {
    const list = await api.getQualifikationen(mitgliedId);
    if (!list.length) { el.innerHTML = `<span class="text-muted text-sm">Keine Qualifikationen erfasst.</span>`; return; }
    el.innerHTML = `
      <table style="margin-top:4px">
        <tbody>
          ${list.map(q => {
            const expired = q.gueltig_bis && new Date(q.gueltig_bis) < new Date();
            const expiringSoon = q.gueltig_bis && !expired &&
              (new Date(q.gueltig_bis) - new Date()) < 90 * 24 * 60 * 60 * 1000;
            return `<tr>
              <td>${esc(q.bezeichnung)}</td>
              <td class="text-muted text-sm">${q.erworben_am || '—'}</td>
              <td class="text-sm">
                ${q.gueltig_bis
                  ? `<span class="badge ${expired ? 'badge--abgelehnt' : expiringSoon ? 'badge--teillieferung' : 'badge--vollstaendig'}">
                      ${expired ? 'Abgelaufen' : 'Bis ' + q.gueltig_bis}
                     </span>`
                  : '<span class="text-muted">unbegrenzt</span>'}
              </td>
              ${isAdmin ? `<td><button class="btn btn--danger btn--sm" data-del-quali="${q.id}">✕</button></td>` : ''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
    if (isAdmin) {
      el.querySelectorAll('[data-del-quali]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Qualifikation löschen?')) return;
          await api.deleteQualifikation(btn.dataset.delQuali);
          loadQualiList(mitgliedId, isAdmin);
        });
      });
    }
  } catch (e) { el.innerHTML = `<span class="text-muted">${esc(e.message)}</span>`; }
}

async function loadAuszeichnungList(mitgliedId, isAdmin) {
  const el = document.getElementById(`auszeichnung-list-${mitgliedId}`);
  if (!el) return;
  try {
    const list = await api.getAuszeichnungen(mitgliedId);
    if (!list.length) { el.innerHTML = `<span class="text-muted text-sm">Keine Auszeichnungen erfasst.</span>`; return; }
    el.innerHTML = `
      <table style="margin-top:4px">
        <tbody>
          ${list.map(a => `<tr>
            <td>${esc(a.bezeichnung)}</td>
            <td class="text-muted text-sm">${a.verliehen_am || '—'}</td>
            ${isAdmin ? `<td><button class="btn btn--danger btn--sm" data-del-az="${a.id}">✕</button></td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
    `;
    if (isAdmin) {
      el.querySelectorAll('[data-del-az]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Auszeichnung löschen?')) return;
          await api.deleteAuszeichnung(btn.dataset.delAz);
          loadAuszeichnungList(mitgliedId, isAdmin);
        });
      });
    }
  } catch (e) { el.innerHTML = `<span class="text-muted">${esc(e.message)}</span>`; }
}

function openQualiModal(mitgliedId) {
  const existing = document.getElementById('quali-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'quali-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h3>Qualifikation hinzufügen</h3>
        <button class="modal__close" id="close-qm">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Bezeichnung</label>
            <input type="text" id="qm-bez" placeholder="z.B. Atemschutz, Erste Hilfe, …" />
          </div>
          <div class="form-group">
            <label>Erworben am</label>
            <input type="date" id="qm-erworben" />
          </div>
          <div class="form-group">
            <label>Gültig bis (optional)</label>
            <input type="date" id="qm-gueltig" />
          </div>
          <div class="form-group form-group--full">
            <label>Bemerkung</label>
            <input type="text" id="qm-bemerkung" />
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-qm2">Abbrechen</button>
        <button class="btn btn--primary" id="save-qm">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('close-qm').addEventListener('click', close);
  document.getElementById('close-qm2').addEventListener('click', close);
  document.getElementById('save-qm').addEventListener('click', async () => {
    const body = {
      bezeichnung: document.getElementById('qm-bez').value.trim(),
      erworben_am: document.getElementById('qm-erworben').value || null,
      gueltig_bis: document.getElementById('qm-gueltig').value || null,
      bemerkung:   document.getElementById('qm-bemerkung').value.trim() || null,
    };
    if (!body.bezeichnung) { toast('Bezeichnung erforderlich', 'error'); return; }
    try {
      await api.createQualifikation(mitgliedId, body);
      toast('Gespeichert', 'success');
      modal.remove();
      loadQualiList(mitgliedId, true);
    } catch (e) { toast(e.message, 'error'); }
  });
}

function openAuszeichnungModal(mitgliedId) {
  const existing = document.getElementById('az-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'az-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h3>Auszeichnung hinzufügen</h3>
        <button class="modal__close" id="close-azm">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Bezeichnung</label>
            <input type="text" id="azm-bez" placeholder="z.B. Verdienstmedaille, Ehrenmitgliedschaft, …" />
          </div>
          <div class="form-group">
            <label>Verliehen am</label>
            <input type="date" id="azm-datum" />
          </div>
          <div class="form-group form-group--full">
            <label>Begründung</label>
            <textarea id="azm-begruendung" rows="2"></textarea>
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-azm2">Abbrechen</button>
        <button class="btn btn--primary" id="save-azm">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('close-azm').addEventListener('click', close);
  document.getElementById('close-azm2').addEventListener('click', close);
  document.getElementById('save-azm').addEventListener('click', async () => {
    const body = {
      bezeichnung:  document.getElementById('azm-bez').value.trim(),
      verliehen_am: document.getElementById('azm-datum').value || null,
      begruendung:  document.getElementById('azm-begruendung').value.trim() || null,
    };
    if (!body.bezeichnung) { toast('Bezeichnung erforderlich', 'error'); return; }
    try {
      await api.createAuszeichnung(mitgliedId, body);
      toast('Gespeichert', 'success');
      modal.remove();
      loadAuszeichnungList(mitgliedId, true);
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ── Ehrungen-Übersicht ────────────────────────────────────────────────────────

async function loadEhrungen() {
  const el = document.getElementById('tab-ehrungen');
  el.innerHTML = `<p class="text-muted">Lädt...</p>`;
  try {
    const data = await api.getEhrungen();
    const jubilare = data.jubilare || [];
    const ablaufend = data.ablaufende_qualifikationen || [];

    el.innerHTML = `
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-card__number" style="color:#d29922">${jubilare.length}</div>
          <div class="stat-card__label">Anstehende Jubiläen</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__number" style="color:${ablaufend.filter(q => q.tage_verbleibend <= 30).length > 0 ? '#e63022' : '#d29922'}">${ablaufend.length}</div>
          <div class="stat-card__label">Ablaufende Qualifikationen</div>
        </div>
      </div>

      ${jubilare.length ? `
      <div class="card">
        <div class="card__header">${icon('award', 14)} Jubiläen (≥ 10 Dienstjahre)</div>
        <div class="card__body" style="padding:0">
          <table>
            <thead><tr><th>Name</th><th>Eingetreten</th><th>Dienstjahre</th><th>Nächstes Jubiläum</th></tr></thead>
            <tbody>
              ${jubilare.map(j => `
                <tr>
                  <td>${esc(j.name)}</td>
                  <td class="text-muted text-sm">${j.eintrittsdatum}</td>
                  <td><strong>${j.dienstjahre}</strong></td>
                  <td><span class="badge badge--superuser">${j.naechstes_jubilaeum} Jahre</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>` : `<div class="empty-state">Keine Jubilare in den nächsten Monaten.</div>`}

      ${ablaufend.length ? `
      <div class="card" style="margin-top:16px">
        <div class="card__header">${icon('alert-triangle', 14)} Ablaufende Qualifikationen (90 Tage)</div>
        <div class="card__body" style="padding:0">
          <table>
            <thead><tr><th>Mitglied</th><th>Qualifikation</th><th>Läuft ab</th><th>Verbleibend</th></tr></thead>
            <tbody>
              ${ablaufend.map(q => {
                const tage = Number(q.tage_verbleibend);
                const cls = tage < 0 ? 'badge--abgelehnt' : tage <= 30 ? 'badge--teillieferung' : 'badge--ausstehend';
                const label = tage < 0 ? `${Math.abs(tage)} Tage überfällig` : `${tage} Tage`;
                return `<tr>
                  <td>${esc(q.mitglied_name)}</td>
                  <td>${esc(q.bezeichnung)}</td>
                  <td class="text-muted text-sm">${q.gueltig_bis}</td>
                  <td><span class="badge ${cls}">${label}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}
    `;
    renderIcons(el);
  } catch (e) {
    el.innerHTML = `<p class="text-muted">${esc(e.message)}</p>`;
  }
}

// ── Briefkopf ─────────────────────────────────────────────────────────────────

async function loadBriefkopf() {
  const el = document.getElementById('tab-briefkopf');
  el.innerHTML = `<p class="text-muted">Lädt...</p>`;

  try {
    const bk = await api.getBriefkopf();
    el.innerHTML = `
      <div class="card">
        <div class="card__header">Briefkopf &amp; Kontaktdaten</div>
        <div class="card__body">
          <p class="hint">Name, Straße und Ort werden in den allgemeinen Einstellungen gepflegt.</p>
          <div class="form-grid">
            <div class="form-group">
              <label>E-Mail</label>
              <input type="email" id="bk-email" value="${esc(bk.ff_email)}" placeholder="info@feuerwehr.de" />
            </div>
            <div class="form-group">
              <label>Telefon</label>
              <input type="text" id="bk-phone" value="${esc(bk.ff_phone)}" placeholder="+49 ..." />
            </div>
            <div class="form-group form-group--full">
              <label>Website</label>
              <input type="text" id="bk-website" value="${esc(bk.ff_website)}" placeholder="https://..." />
            </div>
          </div>
          <div class="btn-group" style="margin-top:${16}px">
            <button class="btn btn--primary" id="btn-save-bk">Speichern</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card__header">Logo</div>
        <div class="card__body">
          ${bk.has_logo ? `
            <div style="margin-bottom:16px">
              <img src="/api/verein/logo" style="max-height:80px;border-radius:6px" alt="Logo" />
            </div>
            <div class="btn-group">
              <button class="btn btn--danger btn--sm" id="btn-del-logo">Logo entfernen</button>
              <label class="btn btn--secondary btn--sm" style="cursor:pointer">
                ${icon('upload', 13)} Ersetzen
                <input type="file" id="logo-upload" accept="image/png,image/jpeg,image/webp" style="display:none" />
              </label>
            </div>
          ` : `
            <p class="hint">Noch kein Logo hinterlegt.</p>
            <label class="btn btn--secondary" style="cursor:pointer">
              ${icon('upload', 14)} Logo hochladen (PNG/JPG/WebP, max. 2 MB)
              <input type="file" id="logo-upload" accept="image/png,image/jpeg,image/webp" style="display:none" />
            </label>
          `}
        </div>
      </div>
    `;

    renderIcons(el);

    document.getElementById('btn-save-bk').addEventListener('click', async () => {
      try {
        await api.updateBriefkopf({
          ff_email:   document.getElementById('bk-email').value,
          ff_phone:   document.getElementById('bk-phone').value,
          ff_website: document.getElementById('bk-website').value,
        });
        toast('Briefkopf gespeichert', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });

    document.getElementById('logo-upload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await api.uploadLogo(file);
        toast('Logo hochgeladen', 'success');
        loadBriefkopf();
      } catch (e) { toast(e.message, 'error'); }
    });

    const delBtn = document.getElementById('btn-del-logo');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!confirm('Logo entfernen?')) return;
        await api.deleteLogo();
        toast('Logo entfernt', 'success');
        loadBriefkopf();
      });
    }
  } catch (e) {
    el.innerHTML = `<p class="text-muted">${esc(e.message)}</p>`;
  }
}
