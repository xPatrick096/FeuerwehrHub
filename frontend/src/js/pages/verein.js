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
  const isAdmin = user?.role === 'admin' || user?.role === 'superuser'
    || (user?.permissions || []).includes('verein');

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
      <button class="tab-btn" data-tab="dokumente">${icon('folder', 14)} Dokumente</button>
      <button class="tab-btn" data-tab="inventar">${icon('box', 14)} Inventar</button>
      <button class="tab-btn" data-tab="schluessel">${icon('key', 14)} Schlüssel</button>
      <button class="tab-btn" data-tab="aufgaben">${icon('check-square', 14)} Aufgaben</button>
      <button class="tab-btn" data-tab="veranstaltungen">${icon('calendar', 14)} Veranstaltungen</button>
      <button class="tab-btn" data-tab="protokolle">${icon('file-text', 14)} Protokolle</button>
      ${isAdmin ? `<button class="tab-btn" data-tab="finanzen">${icon('dollar-sign', 14)} Finanzen</button>` : ''}
      ${isAdmin ? `<button class="tab-btn" data-tab="jahresbericht">${icon('bar-chart', 14)} Jahresbericht</button>` : ''}
      ${isAdmin ? `<button class="tab-btn" data-tab="schreiben">${icon('edit', 14)} Schreiben</button>` : ''}
      ${isAdmin ? `<button class="tab-btn" data-tab="briefkopf">${icon('settings', 14)} Briefkopf</button>` : ''}
    </div>

    <div id="tab-schwarzesbrett"  class="tab-panel"></div>
    <div id="tab-mitglieder"      class="tab-panel" style="display:none"></div>
    <div id="tab-dokumente"       class="tab-panel" style="display:none"></div>
    <div id="tab-inventar"        class="tab-panel" style="display:none"></div>
    <div id="tab-schluessel"      class="tab-panel" style="display:none"></div>
    <div id="tab-aufgaben"        class="tab-panel" style="display:none"></div>
    <div id="tab-veranstaltungen" class="tab-panel" style="display:none"></div>
    <div id="tab-protokolle"      class="tab-panel" style="display:none"></div>
    ${isAdmin ? `<div id="tab-finanzen"      class="tab-panel" style="display:none"></div>` : ''}
    ${isAdmin ? `<div id="tab-jahresbericht" class="tab-panel" style="display:none"></div>` : ''}
    ${isAdmin ? `<div id="tab-schreiben"     class="tab-panel" style="display:none"></div>` : ''}
    ${isAdmin ? `<div id="tab-briefkopf"     class="tab-panel" style="display:none"></div>` : ''}
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
  loadDokumente(isAdmin);
  loadInventar(isAdmin);
  loadSchluessel(isAdmin);
  loadAufgaben(isAdmin);
  loadVeranstaltungen(isAdmin);
  loadProtokolle(isAdmin);
  if (isAdmin) {
    loadFinanzen(isAdmin);
    loadJahresbericht();
    loadSchreibenEditor();
    loadBriefkopf();
  }
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

// ── Dokumente ─────────────────────────────────────────────────────────────────

const DOK_KATEGORIEN = ['Satzung', 'Protokolle', 'Versicherungen', 'Formulare', 'Berichte', 'Sonstiges'];

async function loadDokumente(isAdmin) {
  const el = document.getElementById('tab-dokumente');

  el.innerHTML = `
    <div class="section-header">
      <h3>Dokumentenablage</h3>
      ${isAdmin ? `<button class="btn btn--primary" id="btn-upload-doc">${icon('upload', 14)} Hochladen</button>` : ''}
    </div>
    <div class="tab-bar" id="dok-filter-bar" style="margin-bottom:12px">
      <button class="tab-btn tab-btn--active" data-kat="">Alle</button>
      ${DOK_KATEGORIEN.map(k => `<button class="tab-btn" data-kat="${k}">${k}</button>`).join('')}
    </div>
    <div id="dokumente-list"><p class="text-muted">Lädt...</p></div>
  `;

  renderIcons(el);

  document.querySelectorAll('#dok-filter-bar .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#dok-filter-bar .tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
      btn.classList.add('tab-btn--active');
      renderDokumenteList(isAdmin, btn.dataset.kat);
    });
  });

  if (isAdmin) {
    document.getElementById('btn-upload-doc').addEventListener('click', () => openDokumentModal(isAdmin));
  }

  await refreshDokumente(isAdmin);
}

function openDokumentModal(isAdmin) {
  const existing = document.getElementById('dok-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'dok-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h3>Dokument hochladen</h3>
        <button class="modal__close" id="close-dok">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Datei</label>
            <input type="file" id="dok-file" />
          </div>
          <div class="form-group">
            <label>Kategorie</label>
            <select id="dok-kat">
              ${DOK_KATEGORIEN.map(k => `<option value="${k}">${k}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Zugriff</label>
            <select id="dok-access">
              <option value="all">Alle Mitglieder</option>
              <option value="vorstand">Nur Admin</option>
            </select>
          </div>
          <div class="form-group form-group--full">
            <label>Beschreibung <span class="text-muted">(optional)</span></label>
            <input type="text" id="dok-beschreibung" placeholder="Kurze Beschreibung des Dokuments" />
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-dok2">Abbrechen</button>
        <button class="btn btn--primary" id="save-dok">Hochladen</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('close-dok').addEventListener('click', close);
  document.getElementById('close-dok2').addEventListener('click', close);
  document.getElementById('save-dok').addEventListener('click', async () => {
    const file         = document.getElementById('dok-file').files[0];
    const kat          = document.getElementById('dok-kat').value;
    const access       = document.getElementById('dok-access').value;
    const beschreibung = document.getElementById('dok-beschreibung').value.trim();
    if (!file) { toast('Bitte eine Datei auswählen', 'error'); return; }
    try {
      await api.uploadDocument(file, kat, access, beschreibung || null);
      toast('Dokument hochgeladen', 'success');
      modal.remove();
      refreshDokumente(isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

let _dokCache = [];

async function refreshDokumente(isAdmin) {
  try {
    _dokCache = await api.getDocuments();
    const aktiveKat = document.querySelector('#dok-filter-bar .tab-btn--active')?.dataset.kat || '';
    renderDokumenteList(isAdmin, aktiveKat);
  } catch (e) {
    const el = document.getElementById('dokumente-list');
    if (el) el.innerHTML = `<p class="text-muted">${esc(e.message)}</p>`;
  }
}

function renderDokumenteList(isAdmin, katFilter = '') {
  const el = document.getElementById('dokumente-list');
  if (!el) return;
  const docs = katFilter ? _dokCache.filter(d => d.category === katFilter) : _dokCache;

  if (!docs.length) {
    el.innerHTML = `<div class="empty-state">Keine Dokumente in dieser Kategorie.</div>`;
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
          <thead><tr><th>Dateiname</th><th>Beschreibung</th><th>Größe</th><th>Zugriff</th><th>Hochgeladen</th><th></th></tr></thead>
          <tbody>
            ${items.map(d => `
              <tr>
                <td>${icon('file', 13)} <strong>${esc(d.name)}</strong></td>
                <td class="text-muted text-sm">${d.beschreibung ? esc(d.beschreibung) : '—'}</td>
                <td class="text-muted text-sm">${formatSize(d.file_size)}</td>
                <td>${d.access_level === 'vorstand'
                  ? `<span class="badge badge--superuser">Nur Admin</span>`
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
      <div style="display:flex;gap:.5rem">
        <button class="btn btn--ghost btn--sm" id="btn-mitglieder-csv">${icon('download', 14)} CSV</button>
        <button class="btn btn--ghost btn--sm" id="btn-jahresversammlung">${icon('printer', 14)} Jahresversammlung</button>
        ${isAdmin ? `<button class="btn btn--primary" id="btn-new-mitglied">${icon('plus', 14)} Mitglied anlegen</button>` : ''}
      </div>
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
    <div id="mitglieder-ehrungen" style="margin-top:24px"></div>
  `;
  renderIcons(el);
  if (isAdmin) document.getElementById('btn-new-mitglied').addEventListener('click', () => openMitgliedModal());
  document.getElementById('filter-status').addEventListener('change', () => renderMitgliederTable(isAdmin));
  document.getElementById('filter-name').addEventListener('input', () => renderMitgliederTable(isAdmin));
  document.getElementById('btn-mitglieder-csv').addEventListener('click', () => exportMitgliederCsv());
  document.getElementById('btn-jahresversammlung').addEventListener('click', () => printJahresversammlungsliste());
  await refreshMitglieder(isAdmin);
  loadEhrungen();
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
          <div class="form-group">
            <label>Oberteil Größe</label>
            <select id="mm-oberteil">
              <option value="">—</option>
              ${['XS','S','M','L','XL','XXL','XXXL'].map(s =>
                `<option value="${s}" ${(m?.kleidung_oberteil || '') === s ? 'selected' : ''}>${s}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Hose Größe</label>
            <input type="text" id="mm-hose" value="${esc(m?.kleidung_hose || '')}" placeholder="z.B. 50 oder 32/32" />
          </div>
          <div class="form-group">
            <label>Schuhgröße</label>
            <input type="text" id="mm-schuhe" value="${esc(m?.kleidung_schuhe || '')}" placeholder="z.B. 43" />
          </div>
          <div class="form-group">
            <label>Führerschein</label>
            <input type="text" id="mm-fuehrerschein" value="${esc(m?.fuehrerschein || '')}" placeholder="z.B. B, BE, C" />
          </div>
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
      bemerkung:           document.getElementById('mm-bemerkung').value.trim() || null,
      kleidung_oberteil:   document.getElementById('mm-oberteil').value || null,
      kleidung_hose:       document.getElementById('mm-hose').value.trim() || null,
      kleidung_schuhe:     document.getElementById('mm-schuhe').value.trim() || null,
      fuehrerschein:       document.getElementById('mm-fuehrerschein').value.trim() || null,
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
          ${m.geburtsdatum ? `<div><span class="text-muted text-xs">Geburtsdatum</span><br>${m.geburtsdatum}</div>` : ''}
          ${(m.kleidung_oberteil || m.kleidung_hose || m.kleidung_schuhe) ? `
          <div><span class="text-muted text-xs">Oberteil</span><br>${esc(m.kleidung_oberteil || '—')}</div>
          <div><span class="text-muted text-xs">Hose</span><br>${esc(m.kleidung_hose || '—')}</div>
          <div><span class="text-muted text-xs">Schuhe</span><br>${esc(m.kleidung_schuhe || '—')}</div>
          ` : ''}
          ${m.fuehrerschein ? `<div><span class="text-muted text-xs">Führerschein</span><br>${esc(m.fuehrerschein)}</div>` : ''}
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

function exportMitgliederCsv() {
  const m = _mitgliederCache.filter(x => !x.archiviert);
  const header = ['Nr.','Vorname','Nachname','Status','Eingetreten','Geburtsdatum','E-Mail','Telefon','Führerschein','Oberteil','Hose','Schuhe'];
  const rows = m.map(x => [
    x.mitgliedsnummer, x.vorname, x.nachname, x.status,
    x.eintrittsdatum || '', x.geburtsdatum || '',
    x.email || '', x.telefon || '', x.fuehrerschein || '',
    x.kleidung_oberteil || '', x.kleidung_hose || '', x.kleidung_schuhe || '',
  ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(';'));
  const csv = [header.join(';'), ...rows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'mitglieder.csv'; a.click();
  URL.revokeObjectURL(url);
}

async function printJahresversammlungsliste() {
  const year = new Date().getFullYear();
  let beitraege = [];
  try { beitraege = await api.getBeitraege({ jahr: year }) || []; } catch (_) {}
  const bMap = {};
  beitraege.forEach(b => { bMap[b.mitglied_id] = b; });

  const STATUS_LABELS = { aktiv: 'Aktiv', passiv: 'Passiv', ehren: 'Ehrenmitglied', jugend: 'Jugend' };
  const BEITRAG_LABELS = { bezahlt: '✓ Bezahlt', offen: '⚠ Offen', befreit: '– Befreit' };
  const BEITRAG_COLORS = { bezahlt: '#2d6a4f', offen: '#7d4e00', befreit: '#444' };

  const mitglieder = _mitgliederCache
    .filter(m => !m.archiviert)
    .sort((a, b) => a.nachname.localeCompare(b.nachname, 'de'));

  const rows = mitglieder.map(m => {
    const b = bMap[m.id];
    const bLabel = b ? (BEITRAG_LABELS[b.status] || b.status) : '—';
    const bColor = b ? (BEITRAG_COLORS[b.status] || '#444') : '#888';
    return `<tr>
      <td>${esc(m.mitgliedsnummer || '—')}</td>
      <td><strong>${esc(m.nachname)}, ${esc(m.vorname)}</strong></td>
      <td>${STATUS_LABELS[m.status] || m.status}</td>
      <td>${m.eintrittsdatum ? new Date(m.eintrittsdatum).toLocaleDateString('de-DE') : '—'}</td>
      <td style="color:${bColor}">${bLabel}</td>
      <td style="width:60px;border-bottom:1px solid #ccc">&nbsp;</td>
    </tr>`;
  }).join('');

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html lang="de"><head>
    <meta charset="UTF-8"><title>Mitgliederliste ${year}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 15mm 20mm; }
      h2 { margin: 0 0 2px; font-size: 16px; }
      p.meta { margin: 0 0 14px; color: #555; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f0f0f0; padding: 6px 8px; text-align: left; border-bottom: 2px solid #999; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
      td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
      tr:last-child td { border-bottom: 2px solid #999; }
      @media print { body { margin: 10mm 15mm; } }
    </style>
  </head><body>
    <h2>Mitgliederliste ${year}</h2>
    <p class="meta">${mitglieder.length} Mitglieder &nbsp;·&nbsp; Stand: ${new Date().toLocaleDateString('de-DE')}</p>
    <table>
      <thead><tr>
        <th>Nr.</th><th>Name</th><th>Status</th><th>Eingetreten</th><th>Beitrag ${year}</th><th>Unterschrift</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

async function loadEhrungen() {
  const el = document.getElementById('mitglieder-ehrungen');
  el.innerHTML = `<p class="text-muted">Lädt...</p>`;
  try {
    const data = await api.getEhrungen();
    const jubilare = data.jubilare || [];
    const ablaufend = data.ablaufende_qualifikationen || [];

    // Geburtstage aus Cache — nächste 60 Tage
    const heute = new Date();
    const geburtstage = _mitgliederCache.filter(m => !m.archiviert && m.geburtsdatum).map(m => {
      const gb = new Date(m.geburtsdatum);
      const diesjaehrig = new Date(heute.getFullYear(), gb.getMonth(), gb.getDate());
      if (diesjaehrig < heute) diesjaehrig.setFullYear(heute.getFullYear() + 1);
      const tage = Math.ceil((diesjaehrig - heute) / (1000*60*60*24));
      return { ...m, tage_bis_geburtstag: tage, naechster_geburtstag: diesjaehrig };
    }).filter(m => m.tage_bis_geburtstag <= 60).sort((a,b) => a.tage_bis_geburtstag - b.tage_bis_geburtstag);

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h3 style="margin:0;font-size:15px">Ehrungen &amp; Übersichten</h3>
        <button class="btn btn--ghost btn--sm" id="btn-quali-csv">${icon('download', 14)} Qualifikationen CSV</button>
      </div>
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-card__number" style="color:#d29922">${jubilare.length}</div>
          <div class="stat-card__label">Anstehende Jubiläen</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__number" style="color:${ablaufend.filter(q => q.tage_verbleibend <= 30).length > 0 ? '#e63022' : '#d29922'}">${ablaufend.length}</div>
          <div class="stat-card__label">Ablaufende Qualifikationen</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__number" style="color:${geburtstage.length > 0 ? '#3fb950' : '#7d8590'}">${geburtstage.length}</div>
          <div class="stat-card__label">Geburtstage (60 Tage)</div>
        </div>
      </div>

      ${geburtstage.length ? `
      <div class="card" style="margin-bottom:16px">
        <div class="card__header">${icon('cake', 14)} Geburtstage (nächste 60 Tage)</div>
        <div class="card__body" style="padding:0">
          <table>
            <thead><tr><th>Name</th><th>Datum</th><th>Alter</th><th>In</th></tr></thead>
            <tbody>
              ${geburtstage.map(m => {
                const gb = new Date(m.geburtsdatum);
                const alter = m.naechster_geburtstag.getFullYear() - gb.getFullYear();
                return `<tr>
                  <td>${esc(m.vorname)} ${esc(m.nachname)}</td>
                  <td class="text-muted text-sm">${m.naechster_geburtstag.toLocaleDateString('de-DE', {day:'2-digit',month:'2-digit'})}</td>
                  <td>${alter} Jahre</td>
                  <td><span class="badge ${m.tage_bis_geburtstag <= 7 ? 'badge--green' : 'badge--gray'}">${m.tage_bis_geburtstag === 0 ? 'Heute!' : `${m.tage_bis_geburtstag} Tage`}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}

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

    el.querySelector('#btn-quali-csv')?.addEventListener('click', async () => {
      try {
        const alle = await api.getAlleQualifikationen();
        const header = ['Mitglied','Qualifikation','Erworben','Gültig bis','Bemerkung'];
        const rows = alle.map(q => [
          q.mitglied_name, q.bezeichnung, q.erworben_am || '', q.gueltig_bis || '', q.bemerkung || '',
        ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(';'));
        const csv = [header.join(';'), ...rows].join('\r\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'qualifikationen.csv'; a.click();
        URL.revokeObjectURL(url);
      } catch (e) { toast(e.message, 'error'); }
    });
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

// ── Inventar ──────────────────────────────────────────────────────────────────

const KAT_LABELS     = { technik: 'Technik', werkzeug: 'Werkzeug', veranstaltung: 'Veranstaltung', buero: 'Büro', sonstige: 'Sonstiges' };
const ZUSTAND_LABELS = { gut: 'Gut', beschaedigt: 'Beschädigt', defekt: 'Defekt', ausgemustert: 'Ausgemustert' };
const ZUSTAND_BADGE  = { gut: 'badge--vollstaendig', beschaedigt: 'badge--superuser', defekt: 'badge--abgelehnt', ausgemustert: 'badge--storniert' };

let _inventarCache = [];

async function loadInventar(isAdmin) {
  const el = document.getElementById('tab-inventar');
  el.innerHTML = `
    <div class="section-header">
      <h3>Inventar</h3>
      ${isAdmin ? `<button class="btn btn--primary" id="btn-new-inventar">${icon('plus', 14)} Gerät anlegen</button>` : ''}
    </div>
    <div class="filter-bar">
      <select id="inv-filter-kat">
        <option value="">Alle Kategorien</option>
        ${Object.entries(KAT_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
      <select id="inv-filter-zustand">
        <option value="">Alle Zustände</option>
        ${Object.entries(ZUSTAND_LABELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
      <input type="text" id="inv-filter-name" placeholder="Suchen…" style="flex:1;max-width:260px" />
    </div>
    <div id="inventar-list"><p class="text-muted">Lädt...</p></div>
  `;
  renderIcons(el);
  if (isAdmin) document.getElementById('btn-new-inventar').addEventListener('click', () => openInventarModal());
  ['inv-filter-kat','inv-filter-zustand'].forEach(id =>
    document.getElementById(id).addEventListener('change', () => renderInventarList(isAdmin))
  );
  document.getElementById('inv-filter-name').addEventListener('input', () => renderInventarList(isAdmin));
  await refreshInventar(isAdmin);
}

async function refreshInventar(isAdmin) {
  try {
    _inventarCache = await api.getInventar();
    renderInventarList(isAdmin);
  } catch (e) {
    const el = document.getElementById('inventar-list');
    if (el) el.innerHTML = `<p class="text-muted">${esc(e.message)}</p>`;
  }
}

function renderInventarList(isAdmin) {
  const el = document.getElementById('inventar-list');
  if (!el) return;
  const katF     = document.getElementById('inv-filter-kat')?.value || '';
  const zustandF = document.getElementById('inv-filter-zustand')?.value || '';
  const nameF    = (document.getElementById('inv-filter-name')?.value || '').toLowerCase();

  let list = _inventarCache.filter(i =>
    (!katF || i.kategorie === katF) &&
    (!zustandF || i.zustand === zustandF) &&
    (!nameF || i.name.toLowerCase().includes(nameF))
  );

  const aktiv  = list.filter(i => !i.archiviert);
  const archiv = list.filter(i => i.archiviert);

  if (!aktiv.length && !archiv.length) {
    el.innerHTML = `<div class="empty-state">Noch keine Gegenstände erfasst.</div>`;
    return;
  }

  const renderRows = (items) => items.map(i => `
    <tr>
      <td><strong>${esc(i.name)}</strong>${i.standort ? `<br><span class="text-muted text-xs">${esc(i.standort)}</span>` : ''}</td>
      <td class="text-muted text-sm">${KAT_LABELS[i.kategorie] || i.kategorie}</td>
      <td><span class="badge ${ZUSTAND_BADGE[i.zustand] || ''}">${ZUSTAND_LABELS[i.zustand] || i.zustand}</span></td>
      <td>${i.ausgeliehen
        ? `<span class="badge badge--abgelehnt">Ausgeliehen</span>`
        : `<span class="badge badge--vollstaendig">Verfügbar</span>`}
      </td>
      <td class="text-muted text-sm">${esc(i.seriennummer || '—')}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn--outline btn--sm" data-inv-detail="${i.id}">Details</button>
          ${isAdmin && !i.archiviert ? `
            <button class="btn btn--outline btn--sm" data-inv-edit="${i.id}">Bearbeiten</button>
            <button class="btn btn--danger btn--sm" data-inv-arch="${i.id}">Archivieren</button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  el.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Name / Standort</th><th>Kategorie</th><th>Zustand</th><th>Status</th><th>Seriennr.</th><th></th></tr></thead>
        <tbody>${renderRows(aktiv)}</tbody>
      </table>
    </div>
    ${archiv.length ? `
    <details style="margin-top:12px">
      <summary class="text-muted text-sm" style="cursor:pointer">Archiviert (${archiv.length})</summary>
      <div class="table-wrapper" style="margin-top:8px">
        <table><tbody>${renderRows(archiv)}</tbody></table>
      </div>
    </details>` : ''}
  `;

  el.querySelectorAll('[data-inv-detail]').forEach(btn => {
    const item = _inventarCache.find(i => i.id === btn.dataset.invDetail);
    btn.addEventListener('click', () => openInventarDetail(item, isAdmin));
  });
  el.querySelectorAll('[data-inv-edit]').forEach(btn => {
    const item = _inventarCache.find(i => i.id === btn.dataset.invEdit);
    btn.addEventListener('click', () => openInventarModal(item));
  });
  el.querySelectorAll('[data-inv-arch]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Gegenstand archivieren?')) return;
      await api.deleteInventar(btn.dataset.invArch);
      toast('Archiviert', 'success');
      refreshInventar(isAdmin);
    });
  });
}

function openInventarModal(item = null) {
  const ex = document.getElementById('inv-modal');
  if (ex) ex.remove();
  const modal = document.createElement('div');
  modal.id = 'inv-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h3>${item ? 'Gerät bearbeiten' : 'Neues Gerät'}</h3>
        <button class="modal__close" id="close-inv">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Name</label>
            <input type="text" id="inv-name" value="${esc(item?.name || '')}" />
          </div>
          <div class="form-group">
            <label>Kategorie</label>
            <select id="inv-kat">
              ${Object.entries(KAT_LABELS).map(([k,v]) =>
                `<option value="${k}" ${(item?.kategorie || 'sonstige') === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Zustand</label>
            <select id="inv-zustand">
              ${Object.entries(ZUSTAND_LABELS).map(([k,v]) =>
                `<option value="${k}" ${(item?.zustand || 'gut') === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Seriennummer</label>
            <input type="text" id="inv-serial" value="${esc(item?.seriennummer || '')}" />
          </div>
          <div class="form-group">
            <label>Standort</label>
            <input type="text" id="inv-standort" value="${esc(item?.standort || '')}" />
          </div>
          <div class="form-group form-group--full">
            <label>Bemerkung</label>
            <input type="text" id="inv-bemerkung" value="${esc(item?.bemerkung || '')}" />
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-inv2">Abbrechen</button>
        <button class="btn btn--primary" id="save-inv">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('close-inv').addEventListener('click', close);
  document.getElementById('close-inv2').addEventListener('click', close);
  document.getElementById('save-inv').addEventListener('click', async () => {
    const body = {
      name:         document.getElementById('inv-name').value.trim(),
      kategorie:    document.getElementById('inv-kat').value,
      zustand:      document.getElementById('inv-zustand').value,
      seriennummer: document.getElementById('inv-serial').value.trim() || null,
      standort:     document.getElementById('inv-standort').value.trim() || null,
      bemerkung:    document.getElementById('inv-bemerkung').value.trim() || null,
    };
    if (!body.name) { toast('Name erforderlich', 'error'); return; }
    try {
      if (item) await api.updateInventar(item.id, body);
      else      await api.createInventar(body);
      toast('Gespeichert', 'success');
      modal.remove();
      refreshInventar(true);
    } catch (e) { toast(e.message, 'error'); }
  });
}

async function openInventarDetail(item, isAdmin) {
  const ex = document.getElementById('inv-detail-modal');
  if (ex) ex.remove();
  const ausleihen = await api.getInventarAusleihen(item.id).catch(() => []);
  const aktive = ausleihen.filter(a => !a.rueckgabe_ist);
  const modal = document.createElement('div');
  modal.id = 'inv-detail-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal" style="max-width:680px">
      <div class="modal__header">
        <h3>${esc(item.name)}
          <span class="badge ${item.ausgeliehen ? 'badge--abgelehnt' : 'badge--vollstaendig'}" style="margin-left:8px">
            ${item.ausgeliehen ? 'Ausgeliehen' : 'Verfügbar'}
          </span>
        </h3>
        <button class="modal__close" id="close-inv-d">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-grid" style="margin-bottom:16px">
          <div><span class="text-muted text-xs">Kategorie</span><br>${KAT_LABELS[item.kategorie] || item.kategorie}</div>
          <div><span class="text-muted text-xs">Zustand</span><br><span class="badge ${ZUSTAND_BADGE[item.zustand] || ''}">${ZUSTAND_LABELS[item.zustand] || item.zustand}</span></div>
          ${item.standort ? `<div><span class="text-muted text-xs">Standort</span><br>${esc(item.standort)}</div>` : ''}
          ${item.seriennummer ? `<div><span class="text-muted text-xs">Seriennr.</span><br>${esc(item.seriennummer)}</div>` : ''}
        </div>

        ${aktive.length ? `
        <div class="card" style="margin-bottom:16px;border-color:#e63022">
          <div class="card__body">
            <strong>Aktuell ausgeliehen an:</strong> ${esc(aktive[0].ausgeliehen_an)}<br>
            <span class="text-muted text-sm">Seit ${aktive[0].ausgabe_datum}${aktive[0].rueckgabe_soll ? ` · Soll zurück: ${aktive[0].rueckgabe_soll}` : ''}</span>
            ${isAdmin ? `<br><br><button class="btn btn--primary btn--sm" id="btn-rueckgabe-${aktive[0].id}">Rückgabe erfassen</button>` : ''}
          </div>
        </div>` : isAdmin ? `
        <div style="margin-bottom:16px">
          <button class="btn btn--primary" id="btn-ausleihen-${item.id}">Ausleihen</button>
        </div>` : ''}

        ${ausleihen.filter(a => a.rueckgabe_ist).length ? `
        <details>
          <summary class="text-muted text-sm" style="cursor:pointer">Ausleihe-Verlauf</summary>
          <table style="margin-top:8px">
            <thead><tr><th>Ausgeliehen an</th><th>Ausgabe</th><th>Zurück</th></tr></thead>
            <tbody>
              ${ausleihen.filter(a => a.rueckgabe_ist).map(a => `
                <tr>
                  <td>${esc(a.ausgeliehen_an)}</td>
                  <td class="text-muted text-sm">${a.ausgabe_datum}</td>
                  <td class="text-muted text-sm">${a.rueckgabe_ist}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </details>` : ''}
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-inv-d2">Schließen</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('close-inv-d').addEventListener('click', close);
  document.getElementById('close-inv-d2').addEventListener('click', close);

  if (isAdmin && aktive.length) {
    document.getElementById(`btn-rueckgabe-${aktive[0].id}`).addEventListener('click', async () => {
      const today = new Date().toISOString().split('T')[0];
      const datum = prompt('Rückgabedatum:', today);
      if (!datum) return;
      try {
        await api.returnAusleihe(aktive[0].id, { rueckgabe_ist: datum });
        toast('Rückgabe erfasst', 'success');
        modal.remove();
        refreshInventar(isAdmin);
      } catch (e) { toast(e.message, 'error'); }
    });
  }
  if (isAdmin && !item.ausgeliehen) {
    document.getElementById(`btn-ausleihen-${item.id}`)?.addEventListener('click', () => {
      openAusleiheModal(item, isAdmin);
    });
  }
}

function openAusleiheModal(item, isAdmin) {
  const ex = document.getElementById('ausl-modal');
  if (ex) ex.remove();
  const today = new Date().toISOString().split('T')[0];
  const modal = document.createElement('div');
  modal.id = 'ausl-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h3>Ausleihen: ${esc(item.name)}</h3>
        <button class="modal__close" id="close-ausl">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Ausgeliehen an</label>
            <input type="text" id="ausl-an" placeholder="Name der Person" />
          </div>
          <div class="form-group">
            <label>Ausgabedatum</label>
            <input type="date" id="ausl-datum" value="${today}" />
          </div>
          <div class="form-group">
            <label>Zurück bis <span class="text-muted">(optional)</span></label>
            <input type="date" id="ausl-bis" />
          </div>
          <div class="form-group form-group--full">
            <label>Bemerkung</label>
            <input type="text" id="ausl-bem" />
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-ausl2">Abbrechen</button>
        <button class="btn btn--primary" id="save-ausl">Ausleihen</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('close-ausl').addEventListener('click', close);
  document.getElementById('close-ausl2').addEventListener('click', close);
  document.getElementById('save-ausl').addEventListener('click', async () => {
    const body = {
      ausgeliehen_an: document.getElementById('ausl-an').value.trim(),
      ausgabe_datum:  document.getElementById('ausl-datum').value || null,
      rueckgabe_soll: document.getElementById('ausl-bis').value || null,
      bemerkung:      document.getElementById('ausl-bem').value.trim() || null,
    };
    if (!body.ausgeliehen_an) { toast('Name erforderlich', 'error'); return; }
    try {
      await api.createAusleihe(item.id, body);
      toast('Ausgeliehen', 'success');
      modal.remove();
      document.getElementById('inv-detail-modal')?.remove();
      refreshInventar(isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ── Schlüsselverwaltung ───────────────────────────────────────────────────────

let _schluesselCache = [];

async function loadSchluessel(isAdmin) {
  const el = document.getElementById('tab-schluessel');
  el.innerHTML = `
    <div class="section-header">
      <h3>Schlüsselverwaltung</h3>
      ${isAdmin ? `<button class="btn btn--primary" id="btn-new-schluessel">${icon('plus', 14)} Schlüssel anlegen</button>` : ''}
    </div>
    <div id="schluessel-list"><p class="text-muted">Lädt...</p></div>
  `;
  renderIcons(el);
  if (isAdmin) document.getElementById('btn-new-schluessel').addEventListener('click', () => openSchluesselModal());
  await refreshSchluessel(isAdmin);
}

async function refreshSchluessel(isAdmin) {
  try {
    _schluesselCache = await api.getSchluessel();
    renderSchluesselList(isAdmin);
  } catch (e) {
    const el = document.getElementById('schluessel-list');
    if (el) el.innerHTML = `<p class="text-muted">${esc(e.message)}</p>`;
  }
}

function renderSchluesselList(isAdmin) {
  const el = document.getElementById('schluessel-list');
  if (!el) return;
  if (!_schluesselCache.length) {
    el.innerHTML = `<div class="empty-state">Noch keine Schlüssel erfasst.</div>`;
    return;
  }
  el.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Bezeichnung</th><th>Bereich</th><th>Kopien</th><th>Vergeben</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${_schluesselCache.map(s => {
            const frei = s.kopien_anzahl - Number(s.ausgegeben);
            const statusCls = frei === 0 ? 'badge--abgelehnt' : 'badge--vollstaendig';
            return `
              <tr>
                <td><strong>${esc(s.bezeichnung)}</strong></td>
                <td class="text-muted text-sm">${esc(s.schloss_bereich || '—')}</td>
                <td class="text-muted text-sm">${s.kopien_anzahl}</td>
                <td class="text-muted text-sm">${s.ausgegeben}</td>
                <td><span class="badge ${statusCls}">${frei === 0 ? 'Alle vergeben' : frei + ' frei'}</span></td>
                <td>
                  <div class="btn-group">
                    <button class="btn btn--outline btn--sm" data-schl-detail="${s.id}">Details</button>
                    ${isAdmin ? `
                      <button class="btn btn--outline btn--sm" data-schl-edit="${s.id}">Bearbeiten</button>
                      <button class="btn btn--danger btn--sm" data-schl-del="${s.id}">Löschen</button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  el.querySelectorAll('[data-schl-detail]').forEach(btn => {
    const s = _schluesselCache.find(x => x.id === btn.dataset.schlDetail);
    btn.addEventListener('click', () => openSchluesselDetail(s, isAdmin));
  });
  el.querySelectorAll('[data-schl-edit]').forEach(btn => {
    const s = _schluesselCache.find(x => x.id === btn.dataset.schlEdit);
    btn.addEventListener('click', () => openSchluesselModal(s));
  });
  el.querySelectorAll('[data-schl-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Schlüssel löschen? Alle Ausgaben werden ebenfalls gelöscht.')) return;
      try {
        await api.deleteSchluessel(btn.dataset.schlDel);
        toast('Gelöscht', 'success');
        refreshSchluessel(isAdmin);
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

function openSchluesselModal(s = null) {
  const ex = document.getElementById('schl-modal');
  if (ex) ex.remove();
  const modal = document.createElement('div');
  modal.id = 'schl-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h3>${s ? 'Schlüssel bearbeiten' : 'Neuer Schlüssel'}</h3>
        <button class="modal__close" id="close-schl">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Bezeichnung</label>
            <input type="text" id="schl-bez" value="${esc(s?.bezeichnung || '')}" placeholder="z.B. Gerätehaus Haupteingang" />
          </div>
          <div class="form-group">
            <label>Schloss / Bereich</label>
            <input type="text" id="schl-bereich" value="${esc(s?.schloss_bereich || '')}" placeholder="z.B. Halle A" />
          </div>
          <div class="form-group">
            <label>Anzahl Kopien</label>
            <input type="number" id="schl-kopien" value="${s?.kopien_anzahl ?? 1}" min="1" />
          </div>
          <div class="form-group form-group--full">
            <label>Bemerkung</label>
            <input type="text" id="schl-bem" value="${esc(s?.bemerkung || '')}" />
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-schl2">Abbrechen</button>
        <button class="btn btn--primary" id="save-schl">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('close-schl').addEventListener('click', close);
  document.getElementById('close-schl2').addEventListener('click', close);
  document.getElementById('save-schl').addEventListener('click', async () => {
    const body = {
      bezeichnung:     document.getElementById('schl-bez').value.trim(),
      schloss_bereich: document.getElementById('schl-bereich').value.trim() || null,
      kopien_anzahl:   parseInt(document.getElementById('schl-kopien').value) || 1,
      bemerkung:       document.getElementById('schl-bem').value.trim() || null,
    };
    if (!body.bezeichnung) { toast('Bezeichnung erforderlich', 'error'); return; }
    try {
      if (s) await api.updateSchluessel(s.id, body);
      else   await api.createSchluessel(body);
      toast('Gespeichert', 'success');
      modal.remove();
      refreshSchluessel(true);
    } catch (e) { toast(e.message, 'error'); }
  });
}

async function openSchluesselDetail(s, isAdmin) {
  const ex = document.getElementById('schl-detail-modal');
  if (ex) ex.remove();
  const ausgaben = await api.getSchluesselAusgaben(s.id).catch(() => []);
  const aktive = ausgaben.filter(a => !a.rueckgabe_datum);
  const modal = document.createElement('div');
  modal.id = 'schl-detail-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal" style="max-width:680px">
      <div class="modal__header">
        <h3>${esc(s.bezeichnung)}${s.schloss_bereich ? ` <span class="text-muted text-sm">· ${esc(s.schloss_bereich)}</span>` : ''}</h3>
        <button class="modal__close" id="close-schl-d">✕</button>
      </div>
      <div class="modal__body">
        <p class="text-muted text-sm" style="margin-bottom:16px">${Number(s.ausgegeben)} von ${s.kopien_anzahl} Kopie(n) vergeben</p>

        <div class="section-header">
          <h3 style="font-size:14px">Aktuelle Inhaber</h3>
          ${isAdmin && Number(s.ausgegeben) < s.kopien_anzahl
            ? `<button class="btn btn--primary btn--sm" id="btn-ausgeben">Ausgeben</button>`
            : ''}
        </div>

        ${aktive.length ? `
        <table>
          <thead><tr><th>Name</th><th>Ausgegeben</th>${isAdmin ? '<th></th>' : ''}</tr></thead>
          <tbody>
            ${aktive.map(a => `
              <tr>
                <td>${esc(a.inhaber_name)}</td>
                <td class="text-muted text-sm">${a.ausgabe_datum}</td>
                ${isAdmin ? `<td><button class="btn btn--outline btn--sm" data-rueck="${a.id}">Rückgabe</button></td>` : ''}
              </tr>
            `).join('')}
          </tbody>
        </table>` : `<p class="text-muted">Keine aktiven Ausgaben.</p>`}

        ${ausgaben.filter(a => a.rueckgabe_datum).length ? `
        <details style="margin-top:16px">
          <summary class="text-muted text-sm" style="cursor:pointer">Verlauf</summary>
          <table style="margin-top:8px">
            <thead><tr><th>Name</th><th>Ausgabe</th><th>Rückgabe</th></tr></thead>
            <tbody>
              ${ausgaben.filter(a => a.rueckgabe_datum).map(a => `
                <tr>
                  <td>${esc(a.inhaber_name)}</td>
                  <td class="text-muted text-sm">${a.ausgabe_datum}</td>
                  <td class="text-muted text-sm">${a.rueckgabe_datum}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </details>` : ''}
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-schl-d2">Schließen</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('close-schl-d').addEventListener('click', close);
  document.getElementById('close-schl-d2').addEventListener('click', close);

  document.getElementById('btn-ausgeben')?.addEventListener('click', () => openSchluesselAusgabeModal(s, isAdmin));

  modal.querySelectorAll('[data-rueck]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const today = new Date().toISOString().split('T')[0];
      const datum = prompt('Rückgabedatum:', today);
      if (!datum) return;
      try {
        await api.returnSchluesselAusgabe(btn.dataset.rueck, { rueckgabe_datum: datum });
        toast('Rückgabe erfasst', 'success');
        modal.remove();
        refreshSchluessel(isAdmin);
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

function openSchluesselAusgabeModal(s, isAdmin) {
  const ex = document.getElementById('schl-ausg-modal');
  if (ex) ex.remove();
  const today = new Date().toISOString().split('T')[0];
  const modal = document.createElement('div');
  modal.id = 'schl-ausg-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h3>Schlüssel ausgeben: ${esc(s.bezeichnung)}</h3>
        <button class="modal__close" id="close-sa">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Inhaber Name</label>
            <input type="text" id="sa-name" placeholder="Name der Person" />
          </div>
          <div class="form-group">
            <label>Ausgabedatum</label>
            <input type="date" id="sa-datum" value="${today}" />
          </div>
          <div class="form-group form-group--full">
            <label>Bemerkung</label>
            <input type="text" id="sa-bem" />
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-sa2">Abbrechen</button>
        <button class="btn btn--primary" id="save-sa">Ausgeben</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('close-sa').addEventListener('click', close);
  document.getElementById('close-sa2').addEventListener('click', close);
  document.getElementById('save-sa').addEventListener('click', async () => {
    const body = {
      inhaber_name:  document.getElementById('sa-name').value.trim(),
      ausgabe_datum: document.getElementById('sa-datum').value || null,
      bemerkung:     document.getElementById('sa-bem').value.trim() || null,
    };
    if (!body.inhaber_name) { toast('Name erforderlich', 'error'); return; }
    try {
      await api.createSchluesselAusgabe(s.id, body);
      toast('Schlüssel ausgegeben', 'success');
      modal.remove();
      document.getElementById('schl-detail-modal')?.remove();
      refreshSchluessel(isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ── Aufgaben ──────────────────────────────────────────────────────────────────

const PRIO_LABELS        = { niedrig: 'Niedrig', normal: 'Normal', hoch: 'Hoch', dringend: 'Dringend' };
const PRIO_BADGE         = { niedrig: 'badge--ausstehend', normal: 'badge--entwurf', hoch: 'badge--superuser', dringend: 'badge--abgelehnt' };
const AUFG_STATUS_LABELS = { offen: 'Offen', in_arbeit: 'In Arbeit', erledigt: 'Erledigt' };
const AUFG_STATUS_BADGE  = { offen: 'badge--offen', in_arbeit: 'badge--ausstehend', erledigt: 'badge--vollstaendig' };

let _aufgabenCache  = [];
let _aufgFilterStatus = '';

async function loadAufgaben(isAdmin) {
  const el = document.getElementById('tab-aufgaben');
  el.innerHTML = `
    <div class="section-header">
      <h3>Aufgaben</h3>
      <button class="btn btn--primary" id="btn-new-aufgabe">${icon('plus', 14)} Neue Aufgabe</button>
    </div>
    <div class="filter-bar">
      <button class="btn btn--outline btn--sm aufg-fb aufg-fb--active" data-s="">Alle</button>
      <button class="btn btn--outline btn--sm aufg-fb" data-s="offen">Offen</button>
      <button class="btn btn--outline btn--sm aufg-fb" data-s="in_arbeit">In Arbeit</button>
      <button class="btn btn--outline btn--sm aufg-fb" data-s="erledigt">Erledigt</button>
    </div>
    <div id="aufgaben-list"><p class="text-muted">Lädt...</p></div>
  `;
  renderIcons(el);
  document.getElementById('btn-new-aufgabe').addEventListener('click', () => openAufgabeModal(null, isAdmin));
  el.querySelectorAll('.aufg-fb').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.aufg-fb').forEach(b => b.classList.remove('aufg-fb--active'));
      btn.classList.add('aufg-fb--active');
      _aufgFilterStatus = btn.dataset.s;
      renderAufgabenList(isAdmin);
    });
  });
  await refreshAufgaben(isAdmin);
}

async function refreshAufgaben(isAdmin) {
  try {
    _aufgabenCache = await api.getAufgaben();
    renderAufgabenList(isAdmin);
  } catch (e) {
    const el = document.getElementById('aufgaben-list');
    if (el) el.innerHTML = `<p class="text-muted">${esc(e.message)}</p>`;
  }
}

function renderAufgabenList(isAdmin) {
  const el = document.getElementById('aufgaben-list');
  if (!el) return;
  const list = _aufgFilterStatus
    ? _aufgabenCache.filter(a => a.status === _aufgFilterStatus)
    : _aufgabenCache;

  if (!list.length) {
    el.innerHTML = `<div class="empty-state">Keine Aufgaben in dieser Ansicht.</div>`;
    return;
  }

  const today = new Date().toISOString().split('T')[0];

  el.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Titel</th><th>Priorität</th><th>Zugewiesen</th><th>Fällig</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${list.map(a => {
            const ueberfaellig = a.faellig_am && a.faellig_am < today && a.status !== 'erledigt';
            return `
              <tr>
                <td>
                  <strong>${esc(a.titel)}</strong>
                  ${a.beschreibung ? `<br><span class="text-muted text-xs">${esc(a.beschreibung)}</span>` : ''}
                </td>
                <td><span class="badge ${PRIO_BADGE[a.prioritaet] || ''}">${PRIO_LABELS[a.prioritaet] || a.prioritaet}</span></td>
                <td class="text-muted text-sm">${a.zugewiesen_name ? esc(a.zugewiesen_name) : '—'}</td>
                <td class="${ueberfaellig ? 'badge badge--abgelehnt' : 'text-muted'} text-sm">${a.faellig_am || '—'}</td>
                <td><span class="badge ${AUFG_STATUS_BADGE[a.status] || ''}">${AUFG_STATUS_LABELS[a.status] || a.status}</span></td>
                <td>
                  <div class="btn-group">
                    ${a.status !== 'erledigt' ? `
                      <button class="btn btn--outline btn--sm" data-aufg-next="${a.id}" data-status="${a.status}">
                        ${a.status === 'offen' ? 'Starten' : 'Erledigen'}
                      </button>` : ''}
                    <button class="btn btn--outline btn--sm" data-aufg-edit="${a.id}">Bearbeiten</button>
                    ${isAdmin ? `<button class="btn btn--danger btn--sm" data-aufg-del="${a.id}">Löschen</button>` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  el.querySelectorAll('[data-aufg-next]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const next = btn.dataset.status === 'offen' ? 'in_arbeit' : 'erledigt';
      try {
        await api.updateAufgabe(btn.dataset.aufgNext, { status: next });
        toast('Status aktualisiert', 'success');
        refreshAufgaben(isAdmin);
      } catch (e) { toast(e.message, 'error'); }
    });
  });
  el.querySelectorAll('[data-aufg-edit]').forEach(btn => {
    const a = _aufgabenCache.find(x => x.id === btn.dataset.aufgEdit);
    btn.addEventListener('click', () => openAufgabeModal(a, isAdmin));
  });
  el.querySelectorAll('[data-aufg-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Aufgabe löschen?')) return;
      try {
        await api.deleteAufgabe(btn.dataset.aufgDel);
        toast('Gelöscht', 'success');
        refreshAufgaben(isAdmin);
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

async function openAufgabeModal(a = null, isAdmin) {
  const ex = document.getElementById('aufg-modal');
  if (ex) ex.remove();
  const mitglieder = await api.getMitglieder().catch(() => []);
  const modal = document.createElement('div');
  modal.id = 'aufg-modal';
  modal.className = 'modal-overlay active';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal__header">
        <h3>${a ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</h3>
        <button class="modal__close" id="close-aufg">✕</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Titel</label>
            <input type="text" id="aufg-titel" value="${esc(a?.titel || '')}" />
          </div>
          <div class="form-group form-group--full">
            <label>Beschreibung <span class="text-muted">(optional)</span></label>
            <textarea id="aufg-beschr" rows="2">${esc(a?.beschreibung || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Priorität</label>
            <select id="aufg-prio">
              ${Object.entries(PRIO_LABELS).map(([k,v]) =>
                `<option value="${k}" ${(a?.prioritaet || 'normal') === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Fällig am</label>
            <input type="date" id="aufg-faellig" value="${a?.faellig_am || ''}" />
          </div>
          <div class="form-group">
            <label>Zugewiesen an</label>
            <select id="aufg-zugewiesen">
              <option value="">— niemanden —</option>
              ${mitglieder.filter(m => !m.archiviert).map(m =>
                `<option value="${m.id}" ${a?.zugewiesen_an === m.id ? 'selected' : ''}>${esc(m.nachname)}, ${esc(m.vorname)}</option>`
              ).join('')}
            </select>
          </div>
          ${a ? `
          <div class="form-group">
            <label>Status</label>
            <select id="aufg-status">
              ${Object.entries(AUFG_STATUS_LABELS).map(([k,v]) =>
                `<option value="${k}" ${a.status === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </div>` : ''}
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-aufg2">Abbrechen</button>
        <button class="btn btn--primary" id="save-aufg">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('close-aufg').addEventListener('click', close);
  document.getElementById('close-aufg2').addEventListener('click', close);
  document.getElementById('save-aufg').addEventListener('click', async () => {
    const body = {
      titel:         document.getElementById('aufg-titel').value.trim(),
      beschreibung:  document.getElementById('aufg-beschr').value.trim() || null,
      prioritaet:    document.getElementById('aufg-prio').value,
      faellig_am:    document.getElementById('aufg-faellig').value || null,
      zugewiesen_an: document.getElementById('aufg-zugewiesen').value || null,
    };
    if (a) body.status = document.getElementById('aufg-status').value;
    if (!body.titel) { toast('Titel erforderlich', 'error'); return; }
    try {
      if (a) await api.updateAufgabe(a.id, body);
      else   await api.createAufgabe(body);
      toast('Gespeichert', 'success');
      modal.remove();
      refreshAufgaben(isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Veranstaltungen
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_TYP_LABELS = { uebung:'Übung', versammlung:'Versammlung', fest:'Fest', arbeitsdienst:'Arbeitsdienst', sonstiges:'Sonstiges' };
const EVENT_TYP_BADGE  = { uebung:'badge--blue', versammlung:'badge--purple', fest:'badge--green', arbeitsdienst:'badge--orange', sonstiges:'badge--gray' };

let _eventCache = [];

async function loadVeranstaltungen(isAdmin) {
  const el = document.getElementById('tab-veranstaltungen');
  if (!el) return;
  try {
    _eventCache = await api.getEvents() || [];
    renderVeranstaltungenList(isAdmin);
  } catch (e) {
    el.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

function refreshVeranstaltungen(isAdmin) {
  api.getEvents().then(data => {
    _eventCache = data || [];
    renderVeranstaltungenList(isAdmin);
  }).catch(e => toast(e.message, 'error'));
}

function renderVeranstaltungenList(isAdmin) {
  const el = document.getElementById('tab-veranstaltungen');
  if (!el) return;

  const now = new Date();
  const upcoming = _eventCache.filter(e => new Date(e.datum_von) >= now);
  const past     = _eventCache.filter(e => new Date(e.datum_von) <  now);

  el.innerHTML = `
    <div class="section-header" style="margin-bottom:1rem">
      <h3>Veranstaltungen</h3>
      ${isAdmin ? `<button class="btn btn--primary btn--sm" id="btn-new-event">+ Neu</button>` : ''}
    </div>

    <h4 style="margin:0 0 .5rem;color:var(--text-muted, #7d8590)">Bevorstehend</h4>
    ${upcoming.length === 0 ? `<p class="empty-state">Keine bevorstehenden Veranstaltungen</p>` : `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>Datum</th><th>Typ</th><th>Titel</th><th>Ort</th>
          <th>Ja</th><th>Nein</th><th>Vll.</th><th></th>
        </tr></thead>
        <tbody>
          ${upcoming.map(e => renderEventRow(e, isAdmin)).join('')}
        </tbody>
      </table>
    </div>`}

    <h4 style="margin:1.5rem 0 .5rem;color:var(--text-muted, #7d8590)">Vergangen</h4>
    ${past.length === 0 ? `<p class="empty-state">Keine vergangenen Veranstaltungen</p>` : `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>Datum</th><th>Typ</th><th>Titel</th><th>Ort</th>
          <th>Ja</th><th>Nein</th><th>Vll.</th><th></th>
        </tr></thead>
        <tbody>
          ${past.map(e => renderEventRow(e, isAdmin)).join('')}
        </tbody>
      </table>
    </div>`}
  `;
  renderIcons(el);

  if (isAdmin) {
    el.querySelector('#btn-new-event')?.addEventListener('click', () => openEventModal(null, isAdmin));
  }

  el.querySelectorAll('[data-event-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.eventId;
      openEventDetail(id, isAdmin);
    });
  });

  if (isAdmin) {
    el.querySelectorAll('[data-edit-event]').forEach(btn => {
      const id = btn.dataset.editEvent;
      const ev = _eventCache.find(e => e.id === id);
      btn.addEventListener('click', (evt) => { evt.stopPropagation(); openEventModal(ev, isAdmin); });
    });
    el.querySelectorAll('[data-del-event]').forEach(btn => {
      btn.addEventListener('click', async (evt) => {
        evt.stopPropagation();
        if (!confirm('Veranstaltung löschen?')) return;
        try { await api.deleteEvent(btn.dataset.delEvent); toast('Gelöscht', 'success'); refreshVeranstaltungen(isAdmin); }
        catch (e) { toast(e.message, 'error'); }
      });
    });
  }
}

function renderEventRow(e, isAdmin) {
  const d = new Date(e.datum_von);
  const dateStr = d.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
  const timeStr = d.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' });
  return `<tr style="cursor:pointer" data-event-id="${e.id}">
    <td>${dateStr} ${timeStr}</td>
    <td><span class="badge ${EVENT_TYP_BADGE[e.typ] || 'badge--gray'}">${EVENT_TYP_LABELS[e.typ] || e.typ}</span></td>
    <td>${esc(e.titel)}</td>
    <td>${e.ort ? esc(e.ort) : '—'}</td>
    <td><span class="badge badge--green">${e.antworten_ja}</span></td>
    <td><span class="badge badge--red">${e.antworten_nein}</span></td>
    <td><span class="badge badge--gray">${e.antworten_vllt}</span></td>
    <td style="white-space:nowrap">
      ${isAdmin ? `
        <button class="btn btn--ghost btn--xs" data-edit-event="${e.id}">${icon('edit', 12)}</button>
        <button class="btn btn--ghost btn--xs btn--danger" data-del-event="${e.id}">${icon('trash', 12)}</button>
      ` : ''}
    </td>
  </tr>`;
}

async function openEventDetail(id, isAdmin) {
  const ev = _eventCache.find(e => e.id === id);
  if (!ev) return;

  let antworten = [];
  try { antworten = await api.getEventAntworten(id) || []; } catch (_) {}

  const modal = document.createElement('div');
  modal.className = 'modal modal--open';
  const d = new Date(ev.datum_von);
  const dateStr = d.toLocaleDateString('de-DE', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  const timeStr = d.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' });
  const dateBis = ev.datum_bis ? ` bis ${new Date(ev.datum_bis).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })}` : '';

  const antwortRows = antworten.map(a => `
    <tr>
      <td>${esc(a.mitglied_name)}</td>
      <td><span class="badge ${a.antwort === 'ja' ? 'badge--green' : a.antwort === 'nein' ? 'badge--red' : 'badge--gray'}">${a.antwort === 'ja' ? 'Ja' : a.antwort === 'nein' ? 'Nein' : 'Vielleicht'}</span></td>
      <td>${a.kommentar ? esc(a.kommentar) : '—'}</td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div class="modal__box modal__box--lg">
      <div class="modal__header">
        <h3>${esc(ev.titel)}</h3>
        <button class="modal__close" id="close-evd">&times;</button>
      </div>
      <div class="modal__body">
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">Typ</span><span class="badge ${EVENT_TYP_BADGE[ev.typ] || 'badge--gray'}">${EVENT_TYP_LABELS[ev.typ]}</span></div>
          <div class="detail-item"><span class="detail-label">Datum</span><span>${dateStr}, ${timeStr}${dateBis} Uhr</span></div>
          ${ev.ort ? `<div class="detail-item"><span class="detail-label">Ort</span><span>${esc(ev.ort)}</span></div>` : ''}
          ${ev.beschreibung ? `<div class="detail-item detail-item--full"><span class="detail-label">Beschreibung</span><span>${esc(ev.beschreibung)}</span></div>` : ''}
        </div>

        <h4 style="margin:1.5rem 0 .5rem">Meine Antwort</h4>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap" id="my-rsvp-btns">
          <button class="btn btn--sm btn--success" data-rsvp="ja">✓ Ich komme</button>
          <button class="btn btn--sm btn--danger"  data-rsvp="nein">✗ Ich komme nicht</button>
          <button class="btn btn--sm btn--secondary" data-rsvp="vielleicht">? Vielleicht</button>
        </div>
        <div id="rsvp-kommentar-wrap" style="margin-top:.5rem;display:none">
          <input id="rsvp-kommentar" class="form-control" placeholder="Kommentar (optional)" style="max-width:400px">
          <button class="btn btn--primary btn--sm" id="rsvp-send" style="margin-top:.25rem">Absenden</button>
        </div>

        <h4 style="margin:1.5rem 0 .5rem">Antworten (${antworten.length})</h4>
        ${antworten.length === 0 ? '<p class="empty-state">Noch keine Antworten</p>' : `
        <div class="table-wrapper">
          <table class="data-table">
            <thead><tr><th>Mitglied</th><th>Antwort</th><th>Kommentar</th></tr></thead>
            <tbody>${antwortRows}</tbody>
          </table>
        </div>`}

        ${isAdmin ? `<div style="margin-top:1rem">
          <a class="btn btn--ghost btn--sm" id="btn-csv-export" href="#">CSV Export</a>
        </div>` : ''}
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-evd2">Schließen</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  renderIcons(modal);

  const close = () => modal.remove();
  modal.querySelector('#close-evd').addEventListener('click', close);
  modal.querySelector('#close-evd2').addEventListener('click', close);

  let selectedAntwort = null;
  modal.querySelectorAll('[data-rsvp]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedAntwort = btn.dataset.rsvp;
      modal.querySelectorAll('[data-rsvp]').forEach(b => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
      modal.querySelector('#rsvp-kommentar-wrap').style.display = '';
    });
  });

  modal.querySelector('#rsvp-send')?.addEventListener('click', async () => {
    if (!selectedAntwort) return;
    const kommentar = modal.querySelector('#rsvp-kommentar').value.trim() || null;
    try {
      await api.setMeineAntwort(id, { antwort: selectedAntwort, kommentar });
      toast('Antwort gespeichert', 'success');
      modal.remove();
      refreshVeranstaltungen(isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });

  if (isAdmin) {
    modal.querySelector('#btn-csv-export')?.addEventListener('click', async (evt) => {
      evt.preventDefault();
      try {
        const res = await api.exportEventCsv(id);
        if (!res.ok) { toast('Export fehlgeschlagen', 'error'); return; }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `event-${id}-antworten.csv`; a.click();
        URL.revokeObjectURL(url);
      } catch (e) { toast(e.message, 'error'); }
    });
  }
}

function openEventModal(ev, isAdmin) {
  const isEdit = !!ev;
  const modal = document.createElement('div');
  modal.className = 'modal modal--open';

  const formatDateLocal = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  modal.innerHTML = `
    <div class="modal__box">
      <div class="modal__header">
        <h3>${isEdit ? 'Veranstaltung bearbeiten' : 'Neue Veranstaltung'}</h3>
        <button class="modal__close" id="close-ev">&times;</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Titel *</label>
            <input id="ev-titel" class="form-control" value="${ev ? esc(ev.titel) : ''}">
          </div>
          <div class="form-group">
            <label>Typ</label>
            <select id="ev-typ">
              ${Object.entries(EVENT_TYP_LABELS).map(([k,v]) =>
                `<option value="${k}" ${ev?.typ === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Von *</label>
            <input id="ev-von" type="datetime-local" class="form-control" value="${formatDateLocal(ev?.datum_von)}">
          </div>
          <div class="form-group">
            <label>Bis</label>
            <input id="ev-bis" type="datetime-local" class="form-control" value="${formatDateLocal(ev?.datum_bis)}">
          </div>
          <div class="form-group">
            <label>Ort</label>
            <input id="ev-ort" class="form-control" value="${ev?.ort ? esc(ev.ort) : ''}">
          </div>
          <div class="form-group form-group--full">
            <label>Beschreibung</label>
            <textarea id="ev-beschr" class="form-control" rows="3">${ev?.beschreibung ? esc(ev.beschreibung) : ''}</textarea>
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-ev2">Abbrechen</button>
        <button class="btn btn--primary" id="save-ev">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#close-ev').addEventListener('click', close);
  modal.querySelector('#close-ev2').addEventListener('click', close);
  modal.querySelector('#save-ev').addEventListener('click', async () => {
    const toISO = v => v ? new Date(v).toISOString() : null;
    const body = {
      titel:       modal.querySelector('#ev-titel').value.trim(),
      typ:         modal.querySelector('#ev-typ').value,
      datum_von:   toISO(modal.querySelector('#ev-von').value),
      datum_bis:   toISO(modal.querySelector('#ev-bis').value),
      ort:         modal.querySelector('#ev-ort').value.trim() || null,
      beschreibung:modal.querySelector('#ev-beschr').value.trim() || null,
    };
    if (!body.titel || !body.datum_von) { toast('Titel und Von-Datum erforderlich', 'error'); return; }
    try {
      if (isEdit) await api.updateEvent(ev.id, body);
      else        await api.createEvent(body);
      toast('Gespeichert', 'success');
      modal.remove();
      refreshVeranstaltungen(isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — Protokolle
// ─────────────────────────────────────────────────────────────────────────────

const PROTO_STATUS_LABELS = { entwurf: 'Entwurf', final: 'Final' };
const PROTO_STATUS_BADGE  = { entwurf: 'badge--orange', final: 'badge--green' };

let _protokollCache = [];

async function loadProtokolle(isAdmin) {
  const el = document.getElementById('tab-protokolle');
  if (!el) return;
  try {
    _protokollCache = await api.getProtokolle() || [];
    renderProtokolleList(isAdmin);
  } catch (e) {
    el.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

function refreshProtokolle(isAdmin) {
  api.getProtokolle().then(data => {
    _protokollCache = data || [];
    renderProtokolleList(isAdmin);
  }).catch(e => toast(e.message, 'error'));
}

function renderProtokolleList(isAdmin) {
  const el = document.getElementById('tab-protokolle');
  if (!el) return;
  el.innerHTML = `
    <div class="section-header" style="margin-bottom:1rem">
      <h3>Protokolle</h3>
      ${isAdmin ? `<button class="btn btn--primary btn--sm" id="btn-new-proto">+ Neu</button>` : ''}
    </div>
    ${_protokollCache.length === 0 ? '<p class="empty-state">Keine Protokolle vorhanden</p>' : `
    <div class="table-wrapper">
      <table class="data-table">
        <thead><tr>
          <th>Datum</th><th>Titel</th><th>Ort</th><th>Protokollant</th><th>Status</th><th></th>
        </tr></thead>
        <tbody>
          ${_protokollCache.map(p => `
          <tr style="cursor:pointer" data-proto-id="${p.id}">
            <td>${new Date(p.datum).toLocaleDateString('de-DE')}</td>
            <td>${esc(p.titel)}</td>
            <td>${p.ort ? esc(p.ort) : '—'}</td>
            <td>${p.protokollant ? esc(p.protokollant) : '—'}</td>
            <td><span class="badge ${PROTO_STATUS_BADGE[p.status] || 'badge--gray'}">${PROTO_STATUS_LABELS[p.status] || p.status}</span></td>
            <td style="white-space:nowrap">
              ${isAdmin ? `
                <button class="btn btn--ghost btn--xs" data-edit-proto="${p.id}">${icon('edit', 12)}</button>
                <button class="btn btn--ghost btn--xs btn--danger" data-del-proto="${p.id}">${icon('trash', 12)}</button>
              ` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`}
  `;
  renderIcons(el);

  if (isAdmin) {
    el.querySelector('#btn-new-proto')?.addEventListener('click', () => openProtokollModal(null, isAdmin));
    el.querySelectorAll('[data-edit-proto]').forEach(btn => {
      const p = _protokollCache.find(x => x.id === btn.dataset.editProto);
      btn.addEventListener('click', (evt) => { evt.stopPropagation(); openProtokollModal(p, isAdmin); });
    });
    el.querySelectorAll('[data-del-proto]').forEach(btn => {
      btn.addEventListener('click', async (evt) => {
        evt.stopPropagation();
        if (!confirm('Protokoll löschen?')) return;
        try { await api.deleteProtokoll(btn.dataset.delProto); toast('Gelöscht', 'success'); refreshProtokolle(isAdmin); }
        catch (e) { toast(e.message, 'error'); }
      });
    });
  }

  el.querySelectorAll('[data-proto-id]').forEach(row => {
    row.addEventListener('click', () => openProtokollDetail(row.dataset.protoId, isAdmin));
  });
}

async function openProtokollDetail(id, isAdmin) {
  let data;
  try { data = await api.getProtokoll(id); } catch (e) { toast(e.message, 'error'); return; }
  const { protokoll: p, tops } = data;

  const modal = document.createElement('div');
  modal.className = 'modal modal--open';
  modal.innerHTML = `
    <div class="modal__box modal__box--xl" id="proto-print-area">
      <div class="modal__header no-print">
        <h3>${esc(p.titel)}</h3>
        <button class="modal__close" id="close-pd">&times;</button>
      </div>
      <div class="modal__body">
        <div class="proto-header">
          <h2 style="margin:0 0 .5rem">${esc(p.titel)}</h2>
          <div class="proto-meta">
            <span>Datum: ${new Date(p.datum).toLocaleDateString('de-DE', {weekday:'long', day:'2-digit', month:'long', year:'numeric'})}</span>
            ${p.ort ? `<span>Ort: ${esc(p.ort)}</span>` : ''}
            ${p.protokollant ? `<span>Protokollant: ${esc(p.protokollant)}</span>` : ''}
            ${p.anwesende != null ? `<span>Anwesende: ${p.anwesende}</span>` : ''}
            <span class="no-print"><span class="badge ${PROTO_STATUS_BADGE[p.status]}">${PROTO_STATUS_LABELS[p.status]}</span></span>
          </div>
        </div>
        <hr style="margin:1rem 0">
        <div id="tops-list">
          ${tops.length === 0 ? '<p class="empty-state">Keine Tagesordnungspunkte</p>' : tops.map(t => renderTopBlock(t, isAdmin)).join('')}
        </div>
        ${isAdmin ? `
        <div class="no-print" style="margin-top:1rem">
          <button class="btn btn--secondary btn--sm" id="btn-add-top">+ TOP hinzufügen</button>
        </div>` : ''}
      </div>
      <div class="modal__footer no-print">
        <button class="btn btn--secondary" id="close-pd2">Schließen</button>
        <button class="btn btn--ghost" id="btn-print-proto">${icon('printer', 14)} Drucken / PDF</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  renderIcons(modal);

  const close = () => modal.remove();
  modal.querySelector('#close-pd').addEventListener('click', close);
  modal.querySelector('#close-pd2').addEventListener('click', close);

  modal.querySelector('#btn-print-proto')?.addEventListener('click', () => window.print());

  if (isAdmin) {
    modal.querySelector('#btn-add-top')?.addEventListener('click', () => openTopModal(id, null, modal, isAdmin));
    bindTopButtons(modal, id, isAdmin);
  }
}

function renderTopBlock(t, isAdmin) {
  return `
  <div class="top-block" data-top-id="${t.id}">
    <div class="top-header">
      <span class="top-nr">TOP ${t.position}</span>
      <strong>${esc(t.titel)}</strong>
      ${isAdmin ? `
        <span style="margin-left:auto;display:flex;gap:.25rem">
          <button class="btn btn--ghost btn--xs no-print" data-edit-top="${t.id}">${icon('edit', 12)}</button>
          <button class="btn btn--ghost btn--xs btn--danger no-print" data-del-top="${t.id}">${icon('trash', 12)}</button>
        </span>` : ''}
    </div>
    ${t.inhalt ? `<div class="top-inhalt">${esc(t.inhalt)}</div>` : ''}
    ${t.beschluss ? `<div class="top-beschluss"><strong>Beschluss:</strong> ${esc(t.beschluss)}</div>` : ''}
  </div>`;
}

function bindTopButtons(modal, protokollId, isAdmin) {
  if (!isAdmin) return;
  modal.querySelectorAll('[data-edit-top]').forEach(btn => {
    btn.addEventListener('click', async () => {
      let data;
      try { data = await api.getProtokoll(protokollId); } catch (e) { toast(e.message, 'error'); return; }
      const top = data.tops.find(t => t.id === btn.dataset.editTop);
      if (top) openTopModal(protokollId, top, modal, isAdmin);
    });
  });
  modal.querySelectorAll('[data-del-top]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('TOP löschen?')) return;
      try {
        await api.deleteTop(btn.dataset.delTop);
        toast('Gelöscht', 'success');
        await reloadTops(protokollId, modal, isAdmin);
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

async function reloadTops(protokollId, modal, isAdmin) {
  try {
    const data = await api.getProtokoll(protokollId);
    const topsList = modal.querySelector('#tops-list');
    if (topsList) {
      topsList.innerHTML = data.tops.length === 0
        ? '<p class="empty-state">Keine Tagesordnungspunkte</p>'
        : data.tops.map(t => renderTopBlock(t, isAdmin)).join('');
      renderIcons(topsList);
      bindTopButtons(modal, protokollId, isAdmin);
    }
  } catch (e) { toast(e.message, 'error'); }
}

function openTopModal(protokollId, top, parentModal, isAdmin) {
  const isEdit = !!top;
  const m = document.createElement('div');
  m.className = 'modal modal--open modal--nested';
  m.innerHTML = `
    <div class="modal__box">
      <div class="modal__header">
        <h3>${isEdit ? 'TOP bearbeiten' : 'TOP hinzufügen'}</h3>
        <button class="modal__close" id="close-top">&times;</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Titel *</label>
            <input id="top-titel" class="form-control" value="${top ? esc(top.titel) : ''}">
          </div>
          <div class="form-group form-group--full">
            <label>Inhalt</label>
            <textarea id="top-inhalt" class="form-control" rows="4">${top?.inhalt ? esc(top.inhalt) : ''}</textarea>
          </div>
          <div class="form-group form-group--full">
            <label>Beschluss</label>
            <textarea id="top-beschluss" class="form-control" rows="2">${top?.beschluss ? esc(top.beschluss) : ''}</textarea>
          </div>
          ${isEdit ? `
          <div class="form-group">
            <label>Position</label>
            <input id="top-pos" type="number" min="1" class="form-control" value="${top.position}">
          </div>` : ''}
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-top2">Abbrechen</button>
        <button class="btn btn--primary" id="save-top">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.querySelector('#close-top').addEventListener('click', close);
  m.querySelector('#close-top2').addEventListener('click', close);
  m.querySelector('#save-top').addEventListener('click', async () => {
    const body = {
      titel:    m.querySelector('#top-titel').value.trim(),
      inhalt:   m.querySelector('#top-inhalt').value.trim() || null,
      beschluss:m.querySelector('#top-beschluss').value.trim() || null,
    };
    if (isEdit) body.position = parseInt(m.querySelector('#top-pos')?.value) || top.position;
    if (!body.titel) { toast('Titel erforderlich', 'error'); return; }
    try {
      if (isEdit) await api.updateTop(top.id, body);
      else        await api.createTop(protokollId, body);
      toast('Gespeichert', 'success');
      m.remove();
      await reloadTops(protokollId, parentModal, isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

function openProtokollModal(p, isAdmin) {
  const isEdit = !!p;
  const modal = document.createElement('div');
  modal.className = 'modal modal--open';
  const eventOpts = _eventCache.map(e =>
    `<option value="${e.id}" ${p?.event_id === e.id ? 'selected' : ''}>${esc(e.titel)}</option>`
  ).join('');
  modal.innerHTML = `
    <div class="modal__box">
      <div class="modal__header">
        <h3>${isEdit ? 'Protokoll bearbeiten' : 'Neues Protokoll'}</h3>
        <button class="modal__close" id="close-pm">&times;</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Titel *</label>
            <input id="pm-titel" class="form-control" value="${p ? esc(p.titel) : ''}">
          </div>
          <div class="form-group">
            <label>Datum *</label>
            <input id="pm-datum" type="date" class="form-control" value="${p?.datum || ''}">
          </div>
          <div class="form-group">
            <label>Ort</label>
            <input id="pm-ort" class="form-control" value="${p?.ort ? esc(p.ort) : ''}">
          </div>
          <div class="form-group">
            <label>Protokollant</label>
            <input id="pm-protokollant" class="form-control" value="${p?.protokollant ? esc(p.protokollant) : ''}">
          </div>
          <div class="form-group">
            <label>Anwesende</label>
            <input id="pm-anwesende" type="number" min="0" class="form-control" value="${p?.anwesende ?? ''}">
          </div>
          <div class="form-group">
            <label>Verknüpfte Veranstaltung</label>
            <select id="pm-event">
              <option value="">— keine —</option>
              ${eventOpts}
            </select>
          </div>
          ${isEdit ? `
          <div class="form-group">
            <label>Status</label>
            <select id="pm-status">
              ${Object.entries(PROTO_STATUS_LABELS).map(([k,v]) =>
                `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </div>` : ''}
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-pm2">Abbrechen</button>
        <button class="btn btn--primary" id="save-pm">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#close-pm').addEventListener('click', close);
  modal.querySelector('#close-pm2').addEventListener('click', close);
  modal.querySelector('#save-pm').addEventListener('click', async () => {
    const body = {
      titel:        modal.querySelector('#pm-titel').value.trim(),
      datum:        modal.querySelector('#pm-datum').value,
      ort:          modal.querySelector('#pm-ort').value.trim() || null,
      protokollant: modal.querySelector('#pm-protokollant').value.trim() || null,
      anwesende:    parseInt(modal.querySelector('#pm-anwesende').value) || null,
      event_id:     modal.querySelector('#pm-event').value || null,
    };
    if (isEdit) body.status = modal.querySelector('#pm-status').value;
    if (!body.titel || !body.datum) { toast('Titel und Datum erforderlich', 'error'); return; }
    try {
      if (isEdit) await api.updateProtokoll(p.id, body);
      else        await api.createProtokoll(body);
      toast('Gespeichert', 'success');
      modal.remove();
      refreshProtokolle(isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — Finanzen
// ─────────────────────────────────────────────────────────────────────────────

const BEITRAG_STATUS_LABELS = { offen: 'Offen', bezahlt: 'Bezahlt', befreit: 'Befreit' };
const BEITRAG_STATUS_BADGE  = { offen: 'badge--orange', bezahlt: 'badge--green', befreit: 'badge--gray' };

let _buchungenCache = [];
let _beitraegeCache = [];
let _kategorienCache = [];

function fmtEuro(val) {
  return new Intl.NumberFormat('de-DE', { style:'currency', currency:'EUR' }).format(val ?? 0);
}

async function loadFinanzen(isAdmin) {
  const el = document.getElementById('tab-finanzen');
  if (!el) return;
  try {
    _kategorienCache = await api.getFinanzKategorien() || [];
    el.innerHTML = `
      <div class="tab-bar" id="finanz-subtabs" style="margin-bottom:1rem">
        <button class="tab-btn tab-btn--active" data-subtab="buchungen">Buchungen</button>
        <button class="tab-btn" data-subtab="beitraege">Mitgliedsbeiträge</button>
      </div>
      <div id="subtab-buchungen"></div>
      <div id="subtab-beitraege" style="display:none"></div>
    `;
    el.querySelectorAll('#finanz-subtabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('#finanz-subtabs .tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
        el.querySelectorAll('[id^="subtab-"]').forEach(t => t.style.display = 'none');
        btn.classList.add('tab-btn--active');
        el.querySelector(`#subtab-${btn.dataset.subtab}`).style.display = '';
      });
    });
    await refreshBuchungen(isAdmin);
    await refreshBeitraege(isAdmin);
  } catch (e) {
    el.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}

async function refreshBuchungen(isAdmin, filter = {}) {
  const el = document.getElementById('subtab-buchungen');
  if (!el) return;
  try {
    const [buchungen, summary] = await Promise.all([
      api.getBuchungen(filter),
      api.getFinanzSummary(filter),
    ]);
    _buchungenCache = buchungen || [];
    const currentYear = new Date().getFullYear();

    el.innerHTML = `
      <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;margin-bottom:1rem">
        <div class="form-group" style="min-width:120px;margin:0">
          <label>Jahr</label>
          <select id="buchung-filter-jahr" class="form-control">
            <option value="">Alle</option>
            ${[currentYear, currentYear-1, currentYear-2].map(y => `<option value="${y}" ${filter.jahr == y ? 'selected':''}>${y}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="min-width:130px;margin:0">
          <label>Typ</label>
          <select id="buchung-filter-typ" class="form-control">
            <option value="">Alle</option>
            <option value="einnahme" ${filter.typ==='einnahme'?'selected':''}>Einnahmen</option>
            <option value="ausgabe"  ${filter.typ==='ausgabe'?'selected':''}>Ausgaben</option>
          </select>
        </div>
        <button class="btn btn--secondary btn--sm" id="btn-buchung-filter">Filtern</button>
        <button class="btn btn--ghost btn--sm" id="btn-buchungen-csv">${icon('download', 12)} CSV</button>
        ${isAdmin ? `<button class="btn btn--primary btn--sm" id="btn-new-buchung" style="margin-left:auto">+ Buchung</button>` : ''}
      </div>

      <div class="stats-row" style="margin-bottom:1.5rem">
        <div class="stat-card">
          <div class="stat-card__label">Einnahmen</div>
          <div class="stat-card__value" style="color:var(--gruen, #3fb950)">${fmtEuro(summary.einnahmen)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Ausgaben</div>
          <div class="stat-card__value" style="color:#ff8a80">${fmtEuro(summary.ausgaben)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Saldo</div>
          <div class="stat-card__value" style="color:${summary.saldo >= 0 ? 'var(--gruen, #3fb950)' : '#ff8a80'}">${fmtEuro(summary.saldo)}</div>
        </div>
      </div>

      ${_buchungenCache.length === 0 ? '<p class="empty-state">Keine Buchungen gefunden</p>' : `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr>
            <th>Datum</th><th>Bezeichnung</th><th>Kategorie</th><th>Typ</th><th>Betrag</th><th>Beleg</th><th></th>
          </tr></thead>
          <tbody>
            ${_buchungenCache.map(b => `
            <tr>
              <td>${new Date(b.datum).toLocaleDateString('de-DE')}</td>
              <td>
                ${esc(b.bezeichnung)}
                ${b.mitglied_name ? `<br><small style="color:#7d8590">${esc(b.mitglied_name)}</small>` : ''}
                ${b.notiz ? `<br><small style="color:#7d8590">${esc(b.notiz)}</small>` : ''}
              </td>
              <td>${b.kategorie_name ? esc(b.kategorie_name) : '—'}</td>
              <td><span class="badge ${b.typ === 'einnahme' ? 'badge--green' : 'badge--red'}">${b.typ === 'einnahme' ? 'Einnahme' : 'Ausgabe'}</span></td>
              <td style="font-weight:600;color:${b.typ === 'einnahme' ? '#3fb950' : '#ff8a80'}">${fmtEuro(b.betrag)}</td>
              <td>${b.beleg_nr ? esc(b.beleg_nr) : '—'}</td>
              <td style="white-space:nowrap">
                ${isAdmin ? `
                  <button class="btn btn--ghost btn--xs" data-edit-buchung="${b.id}">${icon('edit', 12)}</button>
                  <button class="btn btn--ghost btn--xs btn--danger" data-del-buchung="${b.id}">${icon('trash', 12)}</button>
                ` : ''}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
    `;
    renderIcons(el);

    el.querySelector('#btn-buchung-filter')?.addEventListener('click', () => {
      refreshBuchungen(isAdmin, {
        jahr: el.querySelector('#buchung-filter-jahr').value || undefined,
        typ:  el.querySelector('#buchung-filter-typ').value || undefined,
      });
    });
    el.querySelector('#btn-buchungen-csv')?.addEventListener('click', () => exportBuchungenCsv());

    if (isAdmin) {
      el.querySelector('#btn-new-buchung')?.addEventListener('click', () => openBuchungModal(null, isAdmin));
      el.querySelectorAll('[data-edit-buchung]').forEach(btn => {
        const b = _buchungenCache.find(x => x.id === btn.dataset.editBuchung);
        btn.addEventListener('click', () => openBuchungModal(b, isAdmin));
      });
      el.querySelectorAll('[data-del-buchung]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Buchung löschen?')) return;
          try { await api.deleteBuchung(btn.dataset.delBuchung); toast('Gelöscht', 'success'); refreshBuchungen(isAdmin, filter); }
          catch (e) { toast(e.message, 'error'); }
        });
      });
    }
  } catch (e) { el.innerHTML = `<p class="error">${esc(e.message)}</p>`; }
}

function openBuchungModal(b, isAdmin) {
  const isEdit = !!b;
  const modal = document.createElement('div');
  modal.className = 'modal modal--open';
  const katOpts = _kategorienCache.map(k =>
    `<option value="${k.id}" ${b?.kategorie_id === k.id ? 'selected' : ''}>${esc(k.name)}</option>`
  ).join('');
  modal.innerHTML = `
    <div class="modal__box">
      <div class="modal__header">
        <h3>${isEdit ? 'Buchung bearbeiten' : 'Neue Buchung'}</h3>
        <button class="modal__close" id="close-buch">&times;</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Bezeichnung *</label>
            <input id="buch-bezeichnung" class="form-control" value="${b ? esc(b.bezeichnung) : ''}">
          </div>
          <div class="form-group">
            <label>Typ *</label>
            <select id="buch-typ">
              <option value="einnahme" ${b?.typ === 'einnahme' ? 'selected' : ''}>Einnahme</option>
              <option value="ausgabe"  ${b?.typ === 'ausgabe'  ? 'selected' : ''}>Ausgabe</option>
            </select>
          </div>
          <div class="form-group">
            <label>Betrag (€) *</label>
            <input id="buch-betrag" type="number" min="0" step="0.01" class="form-control" value="${b ? b.betrag : ''}">
          </div>
          <div class="form-group">
            <label>Datum</label>
            <input id="buch-datum" type="date" class="form-control" value="${b?.datum || new Date().toISOString().slice(0,10)}">
          </div>
          <div class="form-group">
            <label>Kategorie</label>
            <select id="buch-kategorie">
              <option value="">— keine —</option>
              ${katOpts}
            </select>
          </div>
          <div class="form-group">
            <label>Beleg-Nr.</label>
            <input id="buch-beleg" class="form-control" value="${b?.beleg_nr ? esc(b.beleg_nr) : ''}">
          </div>
          <div class="form-group form-group--full">
            <label>Notiz</label>
            <textarea id="buch-notiz" class="form-control" rows="2">${b?.notiz ? esc(b.notiz) : ''}</textarea>
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-buch2">Abbrechen</button>
        <button class="btn btn--primary" id="save-buch">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#close-buch').addEventListener('click', close);
  modal.querySelector('#close-buch2').addEventListener('click', close);
  modal.querySelector('#save-buch').addEventListener('click', async () => {
    const body = {
      bezeichnung:  modal.querySelector('#buch-bezeichnung').value.trim(),
      typ:          modal.querySelector('#buch-typ').value,
      betrag:       parseFloat(modal.querySelector('#buch-betrag').value),
      datum:        modal.querySelector('#buch-datum').value || null,
      kategorie_id: modal.querySelector('#buch-kategorie').value || null,
      beleg_nr:     modal.querySelector('#buch-beleg').value.trim() || null,
      notiz:        modal.querySelector('#buch-notiz').value.trim() || null,
    };
    if (!body.bezeichnung || isNaN(body.betrag)) { toast('Bezeichnung und Betrag erforderlich', 'error'); return; }
    try {
      if (isEdit) await api.updateBuchung(b.id, body);
      else        await api.createBuchung(body);
      toast('Gespeichert', 'success');
      modal.remove();
      refreshBuchungen(isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

async function refreshBeitraege(isAdmin, filter = {}) {
  const el = document.getElementById('subtab-beitraege');
  if (!el) return;
  try {
    _beitraegeCache = await api.getBeitraege(filter) || [];
    const currentYear = new Date().getFullYear();

    const offen   = _beitraegeCache.filter(b => b.status === 'offen').length;
    const bezahlt = _beitraegeCache.filter(b => b.status === 'bezahlt').length;
    const befreit = _beitraegeCache.filter(b => b.status === 'befreit').length;
    const summe   = _beitraegeCache.reduce((s, b) => s + b.betrag, 0);
    const eingang = _beitraegeCache.filter(b => b.status === 'bezahlt').reduce((s, b) => s + b.betrag, 0);

    el.innerHTML = `
      <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-end;margin-bottom:1rem">
        <div class="form-group" style="min-width:120px;margin:0">
          <label>Jahr</label>
          <select id="beit-filter-jahr" class="form-control">
            <option value="">Alle</option>
            ${[currentYear, currentYear-1, currentYear-2].map(y => `<option value="${y}" ${filter.jahr == y ? 'selected':''} >${y}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="min-width:130px;margin:0">
          <label>Status</label>
          <select id="beit-filter-status" class="form-control">
            <option value="">Alle</option>
            ${Object.entries(BEITRAG_STATUS_LABELS).map(([k,v]) => `<option value="${k}" ${filter.typ===k?'selected':''}>${v}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn--secondary btn--sm" id="btn-beit-filter">Filtern</button>
        ${isAdmin ? `
          <button class="btn btn--primary btn--sm" id="btn-new-beit" style="margin-left:auto">+ Beitrag</button>
          <button class="btn btn--secondary btn--sm" id="btn-gen-beit">Jahresbeiträge generieren</button>
        ` : ''}
      </div>

      <div class="stats-row" style="margin-bottom:1.5rem">
        <div class="stat-card"><div class="stat-card__label">Offen</div><div class="stat-card__value" style="color:#ffb74d">${offen}</div></div>
        <div class="stat-card"><div class="stat-card__label">Bezahlt</div><div class="stat-card__value" style="color:#3fb950">${bezahlt}</div></div>
        <div class="stat-card"><div class="stat-card__label">Befreit</div><div class="stat-card__value" style="color:#7d8590">${befreit}</div></div>
        <div class="stat-card"><div class="stat-card__label">Eingang</div><div class="stat-card__value" style="color:#3fb950">${fmtEuro(eingang)} / ${fmtEuro(summe)}</div></div>
      </div>

      ${_beitraegeCache.length === 0 ? '<p class="empty-state">Keine Beiträge gefunden</p>' : `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Mitglied</th><th>Nr.</th><th>Jahr</th><th>Betrag</th><th>Status</th><th>Bezahlt am</th><th></th></tr></thead>
          <tbody>
            ${_beitraegeCache.map(b => `
            <tr>
              <td>${esc(b.mitglied_name)}</td>
              <td>${b.mitglied_nr ? esc(b.mitglied_nr) : '—'}</td>
              <td>${b.jahr}</td>
              <td>${fmtEuro(b.betrag)}</td>
              <td><span class="badge ${BEITRAG_STATUS_BADGE[b.status]}">${BEITRAG_STATUS_LABELS[b.status]}</span></td>
              <td>${b.bezahlt_am ? new Date(b.bezahlt_am).toLocaleDateString('de-DE') : '—'}</td>
              <td style="white-space:nowrap">
                ${isAdmin ? `
                  <button class="btn btn--ghost btn--xs" data-edit-beit="${b.id}">${icon('edit', 12)}</button>
                  <button class="btn btn--ghost btn--xs btn--danger" data-del-beit="${b.id}">${icon('trash', 12)}</button>
                ` : ''}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
    `;
    renderIcons(el);

    el.querySelector('#btn-beit-filter')?.addEventListener('click', () => {
      refreshBeitraege(isAdmin, {
        jahr: el.querySelector('#beit-filter-jahr').value || undefined,
        typ:  el.querySelector('#beit-filter-status').value || undefined,
      });
    });

    if (isAdmin) {
      el.querySelector('#btn-new-beit')?.addEventListener('click', () => openBeitragModal(null, isAdmin));
      el.querySelector('#btn-gen-beit')?.addEventListener('click', () => openGenerierModal(isAdmin));
      el.querySelectorAll('[data-edit-beit]').forEach(btn => {
        const b = _beitraegeCache.find(x => x.id === btn.dataset.editBeit);
        btn.addEventListener('click', () => openBeitragModal(b, isAdmin));
      });
      el.querySelectorAll('[data-del-beit]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Beitrag löschen?')) return;
          try { await api.deleteBeitrag(btn.dataset.delBeit); toast('Gelöscht', 'success'); refreshBeitraege(isAdmin, filter); }
          catch (e) { toast(e.message, 'error'); }
        });
      });
    }
  } catch (e) { el.innerHTML = `<p class="error">${esc(e.message)}</p>`; }
}

function openBeitragModal(b, isAdmin) {
  const isEdit = !!b;
  const modal = document.createElement('div');
  modal.className = 'modal modal--open';
  const mitgliederOpts = (_mitgliederCache || []).filter(m => !m.archiviert).map(m =>
    `<option value="${m.id}" ${b?.mitglied_id === m.id ? 'selected' : ''}>${esc(m.nachname)}, ${esc(m.vorname)}</option>`
  ).join('');
  modal.innerHTML = `
    <div class="modal__box">
      <div class="modal__header">
        <h3>${isEdit ? 'Beitrag bearbeiten' : 'Neuer Beitrag'}</h3>
        <button class="modal__close" id="close-beit">&times;</button>
      </div>
      <div class="modal__body">
        <div class="form-grid">
          ${!isEdit ? `
          <div class="form-group form-group--full">
            <label>Mitglied *</label>
            <select id="beit-mitglied"><option value="">— wählen —</option>${mitgliederOpts}</select>
          </div>` : `<p style="margin:0;font-weight:600">${esc(b.mitglied_name)}</p>`}
          <div class="form-group">
            <label>Jahr *</label>
            <input id="beit-jahr" type="number" min="2000" max="2100" class="form-control" value="${b?.jahr || new Date().getFullYear()}">
          </div>
          <div class="form-group">
            <label>Betrag (€) *</label>
            <input id="beit-betrag" type="number" min="0" step="0.01" class="form-control" value="${b ? b.betrag : ''}">
          </div>
          <div class="form-group">
            <label>Status</label>
            <select id="beit-status">
              ${Object.entries(BEITRAG_STATUS_LABELS).map(([k,v]) =>
                `<option value="${k}" ${b?.status === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Bezahlt am</label>
            <input id="beit-bezahlt" type="date" class="form-control" value="${b?.bezahlt_am || ''}">
          </div>
          <div class="form-group form-group--full">
            <label>Notiz</label>
            <textarea id="beit-notiz" class="form-control" rows="2">${b?.notiz ? esc(b.notiz) : ''}</textarea>
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-beit2">Abbrechen</button>
        <button class="btn btn--primary" id="save-beit">Speichern</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#close-beit').addEventListener('click', close);
  modal.querySelector('#close-beit2').addEventListener('click', close);
  modal.querySelector('#save-beit').addEventListener('click', async () => {
    const betrag    = parseFloat(modal.querySelector('#beit-betrag').value);
    const bezahltAm = modal.querySelector('#beit-bezahlt').value || null;
    const status    = modal.querySelector('#beit-status').value;
    if (isNaN(betrag)) { toast('Betrag erforderlich', 'error'); return; }
    // Auto-setze bezahlt_am wenn status → bezahlt
    const resolvedBezahlt = status === 'bezahlt' && !bezahltAm
      ? new Date().toISOString().slice(0,10)
      : bezahltAm;
    try {
      if (isEdit) {
        await api.updateBeitrag(b.id, {
          betrag, bezahlt_am: resolvedBezahlt, status,
          notiz: modal.querySelector('#beit-notiz').value.trim() || null,
        });
      } else {
        const mitglied_id = modal.querySelector('#beit-mitglied').value;
        const jahr        = parseInt(modal.querySelector('#beit-jahr').value);
        if (!mitglied_id || !jahr) { toast('Mitglied und Jahr erforderlich', 'error'); return; }
        await api.createBeitrag({ mitglied_id, jahr, betrag, bezahlt_am: resolvedBezahlt, status,
          notiz: modal.querySelector('#beit-notiz').value.trim() || null });
      }
      toast('Gespeichert', 'success');
      modal.remove();
      refreshBeitraege(isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

function openGenerierModal(isAdmin) {
  const modal = document.createElement('div');
  modal.className = 'modal modal--open';
  modal.innerHTML = `
    <div class="modal__box">
      <div class="modal__header">
        <h3>Jahresbeiträge generieren</h3>
        <button class="modal__close" id="close-gen">&times;</button>
      </div>
      <div class="modal__body">
        <p style="color:#7d8590;font-size:13px;margin:0 0 1rem">
          Erstellt Beitragseinträge für alle aktiven Mitglieder die noch keinen Eintrag für das gewählte Jahr haben.
        </p>
        <div class="form-grid">
          <div class="form-group">
            <label>Jahr *</label>
            <input id="gen-jahr" type="number" min="2000" max="2100" class="form-control" value="${new Date().getFullYear()}">
          </div>
          <div class="form-group">
            <label>Betrag (€) *</label>
            <input id="gen-betrag" type="number" min="0" step="0.01" class="form-control" placeholder="z.B. 30.00">
          </div>
        </div>
      </div>
      <div class="modal__footer">
        <button class="btn btn--secondary" id="close-gen2">Abbrechen</button>
        <button class="btn btn--primary" id="save-gen">Generieren</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#close-gen').addEventListener('click', close);
  modal.querySelector('#close-gen2').addEventListener('click', close);
  modal.querySelector('#save-gen').addEventListener('click', async () => {
    const jahr   = parseInt(modal.querySelector('#gen-jahr').value);
    const betrag = parseFloat(modal.querySelector('#gen-betrag').value);
    if (!jahr || isNaN(betrag)) { toast('Jahr und Betrag erforderlich', 'error'); return; }
    try {
      const res = await api.generateBeitraege({ jahr, betrag });
      toast(`${res.created} Beiträge für ${res.jahr} erstellt`, 'success');
      modal.remove();
      refreshBeitraege(isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

function exportBuchungenCsv() {
  if (!_buchungenCache.length) { toast('Keine Buchungen zum Exportieren', 'error'); return; }
  const header = ['Datum', 'Bezeichnung', 'Kategorie', 'Typ', 'Betrag (EUR)', 'Beleg-Nr.', 'Mitglied', 'Notiz'];
  const rows = _buchungenCache.map(b => [
    new Date(b.datum).toLocaleDateString('de-DE'),
    b.bezeichnung,
    b.kategorie_name || '',
    b.typ === 'einnahme' ? 'Einnahme' : 'Ausgabe',
    b.betrag.toFixed(2).replace('.', ','),
    b.beleg_nr || '',
    b.mitglied_name || '',
    b.notiz || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
  const csv = '\uFEFF' + [header.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `buchungen_${new Date().getFullYear()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5 — Jahresbericht
// ─────────────────────────────────────────────────────────────────────────────

async function loadJahresbericht() {
  const el = document.getElementById('tab-jahresbericht');
  if (!el) return;

  const currentYear = new Date().getFullYear();
  el.innerHTML = `
    <div class="section-header" style="margin-bottom:1rem">
      <h3>Jahresbericht</h3>
      <div style="display:flex;gap:.5rem;align-items:center">
        <select id="jb-jahr" class="form-control" style="width:100px">
          ${[currentYear, currentYear-1, currentYear-2].map(y => `<option value="${y}">${y}</option>`).join('')}
        </select>
        <button class="btn btn--primary btn--sm" id="btn-jb-load">Laden</button>
      </div>
    </div>
    <div id="jb-content"><p class="empty-state">Jahr wählen und auf Laden klicken</p></div>
  `;

  el.querySelector('#btn-jb-load').addEventListener('click', () => {
    const jahr = parseInt(el.querySelector('#jb-jahr').value);
    renderJahresbericht(jahr);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Schreiben-Editor (Briefkopf-basierter Briefeditor mit Print)
// ─────────────────────────────────────────────────────────────────────────────

async function loadSchreibenEditor() {
  const el = document.getElementById('tab-schreiben');
  if (!el) return;

  let briefkopf = {};
  try { briefkopf = await api.getBriefkopf() || {}; } catch (_) {}

  const today = new Date().toISOString().slice(0, 10);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;align-items:start">
      <div>
        <h3 style="margin:0 0 1rem">Schreiben erstellen</h3>
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Empfänger</label>
            <textarea id="sb-empfaenger" class="form-control" rows="3" placeholder="Name&#10;Straße&#10;PLZ Ort"></textarea>
          </div>
          <div class="form-group">
            <label>Datum</label>
            <input id="sb-datum" type="date" class="form-control" value="${today}">
          </div>
          <div class="form-group form-group--full">
            <label>Betreff</label>
            <input id="sb-betreff" class="form-control" placeholder="Betreff des Schreibens">
          </div>
          <div class="form-group form-group--full">
            <label>Anrede</label>
            <input id="sb-anrede" class="form-control" value="Sehr geehrte Damen und Herren,">
          </div>
          <div class="form-group form-group--full">
            <label>Inhalt</label>
            <textarea id="sb-inhalt" class="form-control" rows="8" placeholder="Text des Schreibens..."></textarea>
          </div>
          <div class="form-group form-group--full">
            <label>Grußformel</label>
            <input id="sb-gruss" class="form-control" value="Mit freundlichen Grüßen">
          </div>
          <div class="form-group form-group--full">
            <label>Unterschrift</label>
            <input id="sb-unterschrift" class="form-control" value="${esc(briefkopf.ff_name || '')}">
          </div>
        </div>
        <div style="margin-top:1rem;display:flex;gap:.5rem">
          <button class="btn btn--primary" id="btn-sb-preview">${icon('eye', 14)} Vorschau aktualisieren</button>
          <button class="btn btn--ghost" id="btn-sb-print">${icon('printer', 14)} Drucken / PDF</button>
        </div>
      </div>

      <div>
        <h3 style="margin:0 0 1rem">Vorschau</h3>
        <div id="schreiben-preview" class="schreiben-preview">
          <p style="color:#7d8590;font-size:13px">Felder ausfüllen und auf Vorschau klicken</p>
        </div>
      </div>
    </div>
  `;
  renderIcons(el);

  const updatePreview = () => {
    const preview = el.querySelector('#schreiben-preview');
    const empf    = el.querySelector('#sb-empfaenger').value.trim().replace(/\n/g, '<br>');
    const datum   = new Date(el.querySelector('#sb-datum').value).toLocaleDateString('de-DE', { day:'2-digit', month:'long', year:'numeric' });
    const betreff = el.querySelector('#sb-betreff').value.trim();
    const anrede  = el.querySelector('#sb-anrede').value.trim();
    const inhalt  = el.querySelector('#sb-inhalt').value.trim().replace(/\n/g, '<br>');
    const gruss   = el.querySelector('#sb-gruss').value.trim();
    const unter   = el.querySelector('#sb-unterschrift').value.trim();

    preview.innerHTML = `
      <div id="brief-print-content">
        <div class="brief-header">
          <div class="brief-absender">
            <strong>${esc(briefkopf.ff_name || '')}</strong><br>
            ${briefkopf.ff_strasse ? esc(briefkopf.ff_strasse) + '<br>' : ''}
            ${briefkopf.ff_ort ? esc(briefkopf.ff_ort) + '<br>' : ''}
            ${briefkopf.ff_email ? esc(briefkopf.ff_email) + '<br>' : ''}
            ${briefkopf.ff_phone ? esc(briefkopf.ff_phone) : ''}
          </div>
          <div class="brief-datum">${datum}</div>
        </div>

        <div class="brief-empfaenger">${empf || '—'}</div>

        ${betreff ? `<div class="brief-betreff"><strong>Betreff: ${esc(betreff)}</strong></div>` : ''}

        <div class="brief-body">
          <p>${esc(anrede)}</p>
          <p>${inhalt || '&nbsp;'}</p>
        </div>

        <div class="brief-gruss">
          <p>${esc(gruss)}</p>
          <br><br>
          <p>___________________________<br>${esc(unter)}</p>
        </div>
      </div>
    `;
  };

  el.querySelector('#btn-sb-preview').addEventListener('click', updatePreview);
  el.querySelector('#btn-sb-print').addEventListener('click', () => {
    updatePreview();
    const content = el.querySelector('#brief-print-content')?.innerHTML || '';
    const win = window.open('', '_blank', 'width=800,height=900');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Schreiben</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; color: #1a1a1a; margin: 2cm; }
        .brief-header { display: flex; justify-content: space-between; margin-bottom: 2rem; font-size: 11pt; }
        .brief-absender { line-height: 1.4; }
        .brief-datum { text-align: right; }
        .brief-empfaenger { margin-bottom: 2rem; min-height: 4rem; line-height: 1.5; }
        .brief-betreff { margin-bottom: 1.5rem; text-decoration: underline; }
        .brief-body { margin-bottom: 2rem; }
        .brief-gruss { margin-top: 1rem; }
        @media print { @page { margin: 2cm; } }
      </style>
    </head><body>${content}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  });

  // Initiale Vorschau
  updatePreview();
}

async function renderJahresbericht(jahr) {
  const el = document.getElementById('jb-content');
  if (!el) return;
  el.innerHTML = `<p style="color:#7d8590">Lade Daten...</p>`;
  try {
    const [summary, buchungen, beitraege, mitglieder, events, einsatzStats] = await Promise.all([
      api.getFinanzSummary({ jahr }),
      api.getBuchungen({ jahr }),
      api.getBeitraege({ jahr }),
      api.getMitglieder(),
      api.getEvents(),
      api.getIncidentStats(jahr).catch(() => null),
    ]);

    const aktiveMitglieder = (mitglieder || []).filter(m => !m.archiviert && m.status === 'aktiv');
    const eventsJahr = (events || []).filter(e => new Date(e.datum_von).getFullYear() === jahr);
    const beitragBezahlt = beitraege.filter(b => b.status === 'bezahlt').length;
    const beitragOffen   = beitraege.filter(b => b.status === 'offen').length;

    el.innerHTML = `
      <div id="jahresbericht-print">
        <div class="no-print" style="margin-bottom:1rem">
          <button class="btn btn--ghost" onclick="window.print()">${icon('printer', 14)} Drucken / PDF</button>
        </div>

        <h2 style="margin:0 0 .25rem">Jahresbericht ${jahr}</h2>
        <p style="color:#7d8590;font-size:13px;margin:0 0 2rem">Erstellt am ${new Date().toLocaleDateString('de-DE')}</p>

        <h3 style="margin:0 0 .75rem;border-bottom:1px solid var(--border,#21273d);padding-bottom:.5rem">Mitglieder</h3>
        <div class="stats-row" style="margin-bottom:2rem">
          <div class="stat-card"><div class="stat-card__label">Aktive Mitglieder</div><div class="stat-card__value">${aktiveMitglieder.length}</div></div>
          <div class="stat-card"><div class="stat-card__label">Gesamt</div><div class="stat-card__value">${(mitglieder||[]).filter(m=>!m.archiviert).length}</div></div>
        </div>

        ${einsatzStats ? `
        <h3 style="margin:0 0 .75rem;border-bottom:1px solid var(--border,#21273d);padding-bottom:.5rem">Einsätze ${jahr}</h3>
        <div class="stats-row" style="margin-bottom:2rem">
          <div class="stat-card"><div class="stat-card__label">Gesamt</div><div class="stat-card__value">${einsatzStats.total ?? 0}</div></div>
          <div class="stat-card"><div class="stat-card__label">Brand</div><div class="stat-card__value" style="color:#e63022">${einsatzStats.brand ?? 0}</div></div>
          <div class="stat-card"><div class="stat-card__label">THL</div><div class="stat-card__value">${einsatzStats.thl ?? 0}</div></div>
          <div class="stat-card"><div class="stat-card__label">Sonstige</div><div class="stat-card__value">${einsatzStats.sonstige ?? 0}</div></div>
        </div>` : ''}

        <h3 style="margin:0 0 .75rem;border-bottom:1px solid var(--border,#21273d);padding-bottom:.5rem">Veranstaltungen ${jahr}</h3>
        <div class="stats-row" style="margin-bottom:2rem">
          <div class="stat-card"><div class="stat-card__label">Gesamt</div><div class="stat-card__value">${eventsJahr.length}</div></div>
          ${Object.entries({ uebung:'Übungen', versammlung:'Versammlungen', fest:'Feste', arbeitsdienst:'Arbeitsdienste' }).map(([k,v]) => {
            const n = eventsJahr.filter(e => e.typ === k).length;
            return `<div class="stat-card"><div class="stat-card__label">${v}</div><div class="stat-card__value">${n}</div></div>`;
          }).join('')}
        </div>

        <h3 style="margin:0 0 .75rem;border-bottom:1px solid var(--border,#21273d);padding-bottom:.5rem">Finanzen ${jahr}</h3>
        <div class="stats-row" style="margin-bottom:1rem">
          <div class="stat-card"><div class="stat-card__label">Einnahmen</div><div class="stat-card__value" style="color:#3fb950">${fmtEuro(summary.einnahmen)}</div></div>
          <div class="stat-card"><div class="stat-card__label">Ausgaben</div><div class="stat-card__value" style="color:#ff8a80">${fmtEuro(summary.ausgaben)}</div></div>
          <div class="stat-card"><div class="stat-card__label">Saldo</div><div class="stat-card__value" style="color:${summary.saldo >= 0 ? '#3fb950' : '#ff8a80'}">${fmtEuro(summary.saldo)}</div></div>
        </div>

        ${beitraege.length > 0 ? `
        <p style="color:#7d8590;font-size:13px;margin:.5rem 0 2rem">Mitgliedsbeiträge: ${beitragBezahlt} bezahlt, ${beitragOffen} ausstehend</p>` : ''}

        ${buchungen.length > 0 ? `
        <h4 style="margin:0 0 .5rem">Buchungsübersicht</h4>
        <div class="table-wrapper" style="margin-bottom:2rem">
          <table class="data-table">
            <thead><tr><th>Datum</th><th>Bezeichnung</th><th>Kategorie</th><th>Typ</th><th>Betrag</th></tr></thead>
            <tbody>
              ${buchungen.map(b => `
              <tr>
                <td>${new Date(b.datum).toLocaleDateString('de-DE')}</td>
                <td>${esc(b.bezeichnung)}</td>
                <td>${b.kategorie_name ? esc(b.kategorie_name) : '—'}</td>
                <td>${b.typ === 'einnahme' ? 'Einnahme' : 'Ausgabe'}</td>
                <td style="color:${b.typ==='einnahme'?'#3fb950':'#ff8a80'}">${fmtEuro(b.betrag)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}
      </div>
    `;
    renderIcons(el);
  } catch (e) {
    el.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}
