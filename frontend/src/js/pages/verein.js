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

    <div class="tabs" id="verein-tabs">
      <button class="tab active" data-tab="schwarzesbrett">${icon('clipboard-list', 14)} Schwarzes Brett</button>
      <button class="tab" data-tab="vorstand">${icon('users', 14)} Vorstand</button>
      <button class="tab" data-tab="dokumente">${icon('folder', 14)} Dokumente</button>
      ${isAdmin ? `<button class="tab" data-tab="briefkopf">${icon('settings', 14)} Briefkopf</button>` : ''}
    </div>

    <div id="tab-schwarzesbrett" class="tab-content active"></div>
    <div id="tab-vorstand"       class="tab-content" style="display:none"></div>
    <div id="tab-dokumente"      class="tab-content" style="display:none"></div>
    ${isAdmin ? `<div id="tab-briefkopf" class="tab-content" style="display:none"></div>` : ''}
  `;

  renderIcons(content);

  document.querySelectorAll('#verein-tabs .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#verein-tabs .tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).style.display = '';
    });
  });

  loadSchwarztesBrett(isAdmin);
  loadVorstand(isAdmin);
  loadDokumente(isAdmin);
  if (isAdmin) loadBriefkopf();
}

// ── Schwarzes Brett ───────────────────────────────────────────────────────────

async function loadSchwarztesBrett(isAdmin) {
  const el = document.getElementById('tab-schwarzesbrett');

  const renderBtn = isAdmin ? `
    <button class="btn btn--primary" id="btn-new-post">
      ${icon('plus', 14)} Beitrag erstellen
    </button>` : '';

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="margin:0">Schwarzes Brett</h3>
      ${renderBtn}
    </div>
    <div id="posts-list"><div class="loading">Lädt...</div></div>
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
        <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
          <span>
            ${p.pinned ? `<span style="color:#f0a500;margin-right:6px">${icon('pin', 13)}</span>` : ''}
            ${esc(p.title)}
            ${p.visibility === 'vorstand' ? `<span class="badge badge--warn" style="margin-left:8px;font-size:11px">Nur Vorstand</span>` : ''}
          </span>
          <span style="font-size:12px;color:#7d8590">
            ${p.expires_at ? `Bis ${p.expires_at} · ` : ''}${esc(p.created_by_name)}
          </span>
        </div>
        <div class="card__body">
          <p style="white-space:pre-wrap;margin:0">${esc(p.content)}</p>
          ${isAdmin ? `
          <div class="btn-group" style="margin-top:12px">
            <button class="btn btn--secondary btn--sm" data-edit-post="${p.id}">Bearbeiten</button>
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
    el.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

function openPostModal(post = null) {
  const existing = document.getElementById('post-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'post-modal';
  modal.className = 'modal-overlay';
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
      const isAdmin = true;
      refreshPosts(isAdmin);
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ── Vorstand ──────────────────────────────────────────────────────────────────

async function loadVorstand(isAdmin) {
  const el = document.getElementById('tab-vorstand');

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="margin:0">Vorstand</h3>
      ${isAdmin ? `<button class="btn btn--primary" id="btn-new-vorstand">${icon('plus', 14)} Hinzufügen</button>` : ''}
    </div>
    <div id="vorstand-list"><div class="loading">Lädt...</div></div>
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
        <table class="table">
          <thead><tr>
            <th>Name</th><th>Funktion</th><th>Seit</th><th>Bis</th>
            ${isAdmin ? '<th></th>' : ''}
          </tr></thead>
          <tbody>
            ${list.map(v => `
              <tr>
                <td>${esc(v.name)}</td>
                <td>${esc(v.funktion)}</td>
                <td>${v.seit || '—'}</td>
                <td>${v.bis || '—'}</td>
                ${isAdmin ? `<td>
                  <button class="btn btn--secondary btn--sm" data-edit-vorstand="${v.id}">Bearbeiten</button>
                  <button class="btn btn--danger btn--sm" data-del-vorstand="${v.id}">Löschen</button>
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
    el.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

function openVorstandModal(v = null) {
  const existing = document.getElementById('vorstand-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'vorstand-modal';
  modal.className = 'modal-overlay';
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
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="margin:0">Dokumentenablage</h3>
      ${isAdmin ? `<label class="btn btn--primary" style="cursor:pointer">
        ${icon('upload', 14)} Dokument hochladen
        <input type="file" id="doc-upload-input" style="display:none" />
      </label>` : ''}
    </div>
    ${isAdmin ? `
    <div class="card" style="margin-bottom:16px" id="upload-form" style="display:none">
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
    <div id="dokumente-list"><div class="loading">Lädt...</div></div>
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
      <div class="card" style="margin-bottom:16px">
        <div class="card__header">${icon('folder', 14)} ${esc(cat)}</div>
        <div class="card__body" style="padding:0">
          <table class="table">
            <tbody>
              ${items.map(d => `
                <tr>
                  <td>${icon('file', 13)} ${esc(d.name)}</td>
                  <td style="color:#7d8590;font-size:12px">${formatSize(d.file_size)}</td>
                  <td style="color:#7d8590;font-size:12px">${d.access_level === 'vorstand' ? '🔒 Vorstand' : '👥 Alle'}</td>
                  <td style="color:#7d8590;font-size:12px">${esc(d.uploaded_by_name)}</td>
                  <td>
                    <button class="btn btn--secondary btn--sm" data-download="${d.id}" data-name="${esc(d.name)}">
                      ${icon('download', 13)} Download
                    </button>
                    ${isAdmin ? `<button class="btn btn--danger btn--sm" data-del-doc="${d.id}">Löschen</button>` : ''}
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
    el.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Briefkopf ─────────────────────────────────────────────────────────────────

async function loadBriefkopf() {
  const el = document.getElementById('tab-briefkopf');
  el.innerHTML = `<div class="loading">Lädt...</div>`;

  try {
    const bk = await api.getBriefkopf();
    el.innerHTML = `
      <div class="card">
        <div class="card__header">Briefkopf & Kontaktdaten</div>
        <div class="card__body">
          <p style="font-size:13px;color:#7d8590;margin-bottom:16px">
            Name, Straße und Ort werden in den allgemeinen Einstellungen gepflegt.
          </p>
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
          <div class="btn-group" style="margin-top:16px">
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
            <button class="btn btn--danger btn--sm" id="btn-del-logo">Logo entfernen</button>
            <span style="margin-left:12px;color:#7d8590;font-size:13px">oder</span>
          ` : `<p style="font-size:13px;color:#7d8590;margin-bottom:12px">Noch kein Logo hinterlegt.</p>`}
          <label class="btn btn--secondary" style="cursor:pointer;margin-left:${bk.has_logo ? '12' : '0'}px">
            ${icon('upload', 14)} Logo hochladen (PNG/JPG/WebP, max. 2 MB)
            <input type="file" id="logo-upload" accept="image/png,image/jpeg,image/webp" style="display:none" />
          </label>
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
    el.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}
