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
      <button class="tab-btn" data-tab="dokumente">${icon('folder', 14)} Dokumente</button>
      <button class="tab-btn" data-tab="inventar">${icon('box', 14)} Inventar</button>
      <button class="tab-btn" data-tab="schluessel">${icon('key', 14)} Schlüssel</button>
      <button class="tab-btn" data-tab="aufgaben">${icon('check-square', 14)} Aufgaben</button>
      ${isAdmin ? `<button class="tab-btn" data-tab="briefkopf">${icon('settings', 14)} Briefkopf</button>` : ''}
    </div>

    <div id="tab-schwarzesbrett" class="tab-panel"></div>
    <div id="tab-mitglieder"     class="tab-panel" style="display:none"></div>
    <div id="tab-dokumente"      class="tab-panel" style="display:none"></div>
    <div id="tab-inventar"       class="tab-panel" style="display:none"></div>
    <div id="tab-schluessel"     class="tab-panel" style="display:none"></div>
    <div id="tab-aufgaben"       class="tab-panel" style="display:none"></div>
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
  loadDokumente(isAdmin);
  loadInventar(isAdmin);
  loadSchluessel(isAdmin);
  loadAufgaben(isAdmin);
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
    <div id="mitglieder-ehrungen" style="margin-top:24px"></div>
  `;
  renderIcons(el);
  if (isAdmin) document.getElementById('btn-new-mitglied').addEventListener('click', () => openMitgliedModal());
  document.getElementById('filter-status').addEventListener('change', () => renderMitgliederTable(isAdmin));
  document.getElementById('filter-name').addEventListener('input', () => renderMitgliederTable(isAdmin));
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
          ${(m.kleidung_oberteil || m.kleidung_hose || m.kleidung_schuhe) ? `
          <div><span class="text-muted text-xs">Oberteil</span><br>${esc(m.kleidung_oberteil || '—')}</div>
          <div><span class="text-muted text-xs">Hose</span><br>${esc(m.kleidung_hose || '—')}</div>
          <div><span class="text-muted text-xs">Schuhe</span><br>${esc(m.kleidung_schuhe || '—')}</div>
          ` : ''}
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
  const el = document.getElementById('mitglieder-ehrungen');
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
