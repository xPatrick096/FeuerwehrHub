import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';

const ROLE_LABELS = {
  superuser: '⭐ Superuser',
  admin:     '🔧 Admin',
  user:      '👤 Benutzer',
};

const MODULE_LABELS = {
  lager: '🏪 Lager',
};

export async function renderAdmin() {
  const [settings, me] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, me);
  renderShell('admin');

  // Zugriffsprüfung
  if (me?.role !== 'superuser' && me?.role !== 'admin') {
    document.getElementById('page-content').innerHTML =
      `<div class="page-header"><div><h2>Kein Zugriff</h2><p>Nur Admins können diese Seite aufrufen.</p></div></div>`;
    return;
  }

  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Admin Panel</h2>
        <p>Benutzerverwaltung und Konfiguration</p>
      </div>
    </div>

    <div class="tab-bar">
      <button class="tab-btn tab-btn--active" data-tab="users">Benutzer</button>
      <button class="tab-btn" data-tab="roles">Rollen</button>
      <button class="tab-btn" data-tab="config">Konfiguration</button>
    </div>

    <div id="tab-users" class="tab-panel">
      <div class="card">
        <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
          <span>Benutzer</span>
          <button class="btn btn--primary btn--sm" id="btn-new-user">+ Benutzer anlegen</button>
        </div>
        <div class="card__body" id="users-table-wrap">
          <p>Lade...</p>
        </div>
      </div>
    </div>

    <div id="tab-roles" class="tab-panel" style="display:none">
      <div class="card">
        <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
          <span>Rollen</span>
          <button class="btn btn--primary btn--sm" id="btn-new-role">+ Rolle anlegen</button>
        </div>
        <div class="card__body" id="roles-table-wrap"><p>Lade...</p></div>
      </div>
    </div>

    <div id="tab-config" class="tab-panel" style="display:none">
      <div class="card">
        <div class="card__header">Feuerwehr-Stammdaten</div>
        <div class="card__body">
          <div class="form-grid">
            <div class="form-group form-group--full">
              <label>Name der Feuerwehr</label>
              <input type="text" id="cfg-ff-name" value="${esc(settings?.ff_name || '')}" />
            </div>
            <div class="form-group">
              <label>Straße & Hausnummer</label>
              <input type="text" id="cfg-ff-strasse" value="${esc(settings?.ff_strasse || '')}" />
            </div>
            <div class="form-group">
              <label>PLZ & Ort</label>
              <input type="text" id="cfg-ff-ort" value="${esc(settings?.ff_ort || '')}" />
            </div>
          </div>
          <div class="btn-group" style="margin-top:16px">
            <button class="btn btn--primary" id="btn-save-config">Speichern</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:0">
        <div class="card__header">Beschaffungsauftrag PDF-Vorlage</div>
        <div class="card__body">
          <p style="font-size:13px;color:#666;margin-bottom:16px">
            Lade das offizielle Formular deiner Feuerwehr / Stadt hoch.
            Dieses PDF wird als Vorlage für alle Beschaffungsaufträge verwendet und mit den Bestelldaten befüllt.
          </p>
          <div id="pdf-upload-status" style="margin-bottom:12px;font-size:13px"></div>
          <div class="form-group">
            <label>PDF-Datei auswählen</label>
            <input type="file" id="pdf-upload-input" accept=".pdf" />
          </div>
          <div class="btn-group" style="margin-top:12px">
            <button class="btn btn--primary" id="btn-upload-pdf">PDF hochladen</button>
            <a class="btn btn--outline" href="/api/settings/pdf" target="_blank" id="btn-view-pdf">Aktuelles PDF ansehen</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Neuer Benutzer -->
    <div id="modal-new-user" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3>Neuen Benutzer anlegen</h3>
          <button class="modal__close" id="btn-close-new-user">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label>Benutzername</label>
            <input type="text" id="new-user-name" autocomplete="off" />
          </div>
          <div class="form-group">
            <label>Passwort (mind. 8 Zeichen)</label>
            <input type="password" id="new-user-pw" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label>Rolle</label>
            <select id="new-user-role">
              <option value="user">Benutzer</option>
              ${me?.role === 'superuser' ? '<option value="admin">Admin</option>' : ''}
            </select>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-new-user">Anlegen</button>
          <button class="btn btn--outline" id="btn-cancel-new-user">Abbrechen</button>
        </div>
      </div>
    </div>

    <!-- Modal: Rolle anlegen/bearbeiten -->
    <div id="modal-role" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3 id="modal-role-title">Rolle anlegen</h3>
          <button class="modal__close" id="btn-close-role-modal">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <label>Rollenname</label>
            <input type="text" id="role-name" placeholder="z.B. Lagerverwalter" autocomplete="off" />
          </div>
          <div class="form-group">
            <label>Module</label>
            <div id="role-perm-checks" style="display:flex;flex-direction:column;gap:8px;margin-top:4px"></div>
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-role">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-role">Abbrechen</button>
        </div>
      </div>
    </div>

    <!-- Modal: PW Reset -->
    <div id="modal-reset-pw" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3>Passwort zurücksetzen</h3>
          <button class="modal__close" id="btn-close-reset-pw">✕</button>
        </div>
        <div class="modal__body">
          <p id="reset-pw-username" style="font-size:13px;color:#666;margin-bottom:12px"></p>
          <div class="form-group">
            <label>Neues Passwort (mind. 8 Zeichen)</label>
            <input type="password" id="reset-pw-value" autocomplete="new-password" />
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-reset-pw">Zurücksetzen</button>
          <button class="btn btn--outline" id="btn-cancel-reset-pw">Abbrechen</button>
        </div>
      </div>
    </div>
  `;

  // Tabs
  content.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
      btn.classList.add('tab-btn--active');
      content.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      document.getElementById(`tab-${btn.dataset.tab}`).style.display = 'block';
    });
  });

  // Konfig speichern
  document.getElementById('btn-save-config').addEventListener('click', async () => {
    try {
      await api.updateSettings({
        ff_name:    document.getElementById('cfg-ff-name').value.trim(),
        ff_strasse: document.getElementById('cfg-ff-strasse').value.trim(),
        ff_ort:     document.getElementById('cfg-ff-ort').value.trim(),
      });
      toast('Einstellungen gespeichert');
    } catch (e) { toast(e.message, 'error'); }
  });

  // PDF-Status anzeigen
  fetch('/api/settings/pdf', { method: 'HEAD' }).then(res => {
    const statusEl = document.getElementById('pdf-upload-status');
    if (!statusEl) return;
    if (res.ok) {
      statusEl.innerHTML = '<span style="color:#1E8449">✅ PDF-Vorlage ist hinterlegt</span>';
    } else {
      statusEl.innerHTML = '<span style="color:#C0392B">⚠️ Noch keine PDF-Vorlage hochgeladen</span>';
    }
  }).catch(() => {});

  // PDF hochladen
  document.getElementById('btn-upload-pdf').addEventListener('click', async () => {
    const file = document.getElementById('pdf-upload-input').files[0];
    if (!file) { toast('Keine Datei ausgewählt', 'error'); return; }
    if (!file.name.toLowerCase().endsWith('.pdf')) { toast('Nur PDF-Dateien erlaubt', 'error'); return; }
    try {
      await api.uploadPdf(file);
      toast('PDF-Vorlage erfolgreich hochgeladen');
      document.getElementById('pdf-upload-input').value = '';
      document.getElementById('pdf-upload-status').innerHTML =
        '<span style="color:#1E8449">✅ PDF-Vorlage ist hinterlegt</span>';
    } catch (e) { toast(e.message, 'error'); }
  });

  // Benutzer + Rollen laden
  const roles = await api.getRoles().catch(() => []);
  await loadUsers(me, roles);

  // Rollen-Tab
  await loadRoles(me);

  // Modal: Neuer Benutzer
  let resetTarget = null;

  document.getElementById('btn-new-user').addEventListener('click', () => {
    document.getElementById('modal-new-user').style.display = 'flex';
    document.getElementById('new-user-name').focus();
  });

  const closeNewUser = () => {
    document.getElementById('modal-new-user').style.display = 'none';
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-pw').value = '';
  };
  document.getElementById('btn-close-new-user').addEventListener('click', closeNewUser);
  document.getElementById('btn-cancel-new-user').addEventListener('click', closeNewUser);

  document.getElementById('btn-submit-new-user').addEventListener('click', async () => {
    const username = document.getElementById('new-user-name').value.trim();
    const password = document.getElementById('new-user-pw').value;
    const role     = document.getElementById('new-user-role').value;

    if (!username || !password) { toast('Alle Felder ausfüllen', 'error'); return; }
    if (password.length < 8)    { toast('Passwort mind. 8 Zeichen', 'error'); return; }

    try {
      await api.createUser({ username, password, role });
      toast(`Benutzer "${username}" angelegt`);
      closeNewUser();
      const roles = await api.getRoles().catch(() => []);
      await loadUsers(me, roles);
    } catch (e) { toast(e.message, 'error'); }
  });

  // Modal: PW Reset
  const closeResetPw = () => {
    document.getElementById('modal-reset-pw').style.display = 'none';
    document.getElementById('reset-pw-value').value = '';
    resetTarget = null;
  };
  document.getElementById('btn-close-reset-pw').addEventListener('click', closeResetPw);
  document.getElementById('btn-cancel-reset-pw').addEventListener('click', closeResetPw);

  document.getElementById('btn-submit-reset-pw').addEventListener('click', async () => {
    const newPassword = document.getElementById('reset-pw-value').value;
    if (newPassword.length < 8) { toast('Passwort mind. 8 Zeichen', 'error'); return; }
    try {
      await api.resetPassword(resetTarget.id, { new_password: newPassword });
      toast(`Passwort für "${resetTarget.username}" zurückgesetzt`);
      closeResetPw();
    } catch (e) { toast(e.message, 'error'); }
  });

  // Event Delegation für Tabellen-Aktionen
  document.getElementById('users-table-wrap').addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    const username = e.target.dataset.username;

    if (e.target.matches('[data-action="reset-pw"]')) {
      resetTarget = { id, username };
      document.getElementById('reset-pw-username').textContent = `Benutzer: ${username}`;
      document.getElementById('modal-reset-pw').style.display = 'flex';
      document.getElementById('reset-pw-value').focus();
    }

    if (e.target.matches('[data-action="toggle-role"]')) {
      const currentRole = e.target.dataset.role;
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      try {
        await api.updateRole(id, { role: newRole });
        toast(`Systemrolle auf "${ROLE_LABELS[newRole]}" geändert`);
        const roles = await api.getRoles().catch(() => []);
        await loadUsers(me, roles);
      } catch (e) { toast(e.message, 'error'); }
    }

    if (e.target.matches('[data-action="delete"]')) {
      if (!confirm(`Benutzer "${username}" wirklich löschen?`)) return;
      try {
        await api.deleteUser(id);
        toast(`Benutzer "${username}" gelöscht`);
        const roles = await api.getRoles().catch(() => []);
        await loadUsers(me, roles);
      } catch (e) { toast(e.message, 'error'); }
    }
  });

  // Rolle-Dropdown Änderungen (delegiert)
  document.getElementById('users-table-wrap').addEventListener('change', async (e) => {
    if (!e.target.matches('.user-role-select')) return;
    const userId = e.target.dataset.userId;
    const roleId = e.target.value || null;
    try {
      await api.assignRole(userId, roleId);
      toast('Rolle zugewiesen');
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

async function loadRoles(me) {
  const wrap = document.getElementById('roles-table-wrap');
  if (!wrap) return;

  let editTarget = null;

  const render = async () => {
    const roles = await api.getRoles().catch(() => []);

    if (!roles.length) {
      wrap.innerHTML = '<p style="color:#666;font-size:13px">Noch keine Rollen angelegt.</p>';
    } else {
      wrap.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>Rollenname</th>
              <th>Module</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${roles.map(r => `
              <tr>
                <td><strong>${esc(r.name)}</strong></td>
                <td>${r.permissions.length ? r.permissions.map(p => MODULE_LABELS[p] || p).join(', ') : '<span style="color:#aaa">keine</span>'}</td>
                <td>
                  <div class="btn-group">
                    <button class="btn btn--outline btn--sm" data-action="edit-role"
                      data-id="${r.id}" data-name="${esc(r.name)}"
                      data-perms="${esc(JSON.stringify(r.permissions))}">Bearbeiten</button>
                    <button class="btn btn--danger btn--sm" data-action="delete-role"
                      data-id="${r.id}" data-name="${esc(r.name)}">Löschen</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    wrap.querySelectorAll('[data-action="edit-role"]').forEach(btn => {
      btn.addEventListener('click', () => {
        editTarget = btn.dataset.id;
        const perms = JSON.parse(btn.dataset.perms || '[]');
        document.getElementById('modal-role-title').textContent = 'Rolle bearbeiten';
        document.getElementById('role-name').value = btn.dataset.name;
        buildPermCheckboxes(perms);
        document.getElementById('modal-role').style.display = 'flex';
      });
    });

    wrap.querySelectorAll('[data-action="delete-role"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Rolle "${btn.dataset.name}" wirklich löschen?`)) return;
        try {
          await api.deleteRole(btn.dataset.id);
          toast('Rolle gelöscht');
          render();
        } catch (e) { toast(e.message, 'error'); }
      });
    });
  };

  await render();

  const buildPermCheckboxes = (selected = []) => {
    document.getElementById('role-perm-checks').innerHTML =
      Object.entries(MODULE_LABELS).map(([key, label]) => `
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" value="${key}" ${selected.includes(key) ? 'checked' : ''} />
          ${label}
        </label>
      `).join('');
  };

  const closeModal = () => {
    editTarget = null;
    document.getElementById('modal-role').style.display = 'none';
    document.getElementById('role-name').value = '';
  };

  document.getElementById('btn-new-role').addEventListener('click', () => {
    editTarget = null;
    document.getElementById('modal-role-title').textContent = 'Rolle anlegen';
    document.getElementById('role-name').value = '';
    buildPermCheckboxes();
    document.getElementById('modal-role').style.display = 'flex';
  });

  document.getElementById('btn-close-role-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-role').addEventListener('click', closeModal);

  document.getElementById('btn-submit-role').addEventListener('click', async () => {
    const name = document.getElementById('role-name').value.trim();
    if (!name) { toast('Rollenname eingeben', 'error'); return; }
    const permissions = [...document.querySelectorAll('#role-perm-checks input:checked')]
      .map(cb => cb.value);

    try {
      if (editTarget) {
        await api.updateRole(editTarget, { name, permissions });
        toast('Rolle gespeichert');
      } else {
        await api.createRole({ name, permissions });
        toast(`Rolle "${name}" angelegt`);
      }
      closeModal();
      render();
    } catch (e) { toast(e.message, 'error'); }
  });
}

async function loadUsers(me, roles = []) {
  const wrap = document.getElementById('users-table-wrap');
  if (!wrap) return;

  try {
    const users = await api.getUsers();

    if (!users.length) {
      wrap.innerHTML = '<p style="color:#666;font-size:13px">Keine Benutzer gefunden.</p>';
      return;
    }

    const roleOptions = roles.map(r =>
      `<option value="${r.id}">${esc(r.name)}</option>`
    ).join('');

    wrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Benutzername</th>
            <th>Systemrolle</th>
            <th>Zugewiesene Rolle</th>
            <th>2FA</th>
            <th>Erstellt</th>
            <th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const isSelf = u.id === me?.id;
            const isSuperuser = u.role === 'superuser';
            const canEdit = me?.role === 'superuser' && !isSuperuser;
            const canReset = (me?.role === 'superuser' || (me?.role === 'admin' && u.role === 'user'));
            const isPrivileged = u.role === 'admin' || u.role === 'superuser';

            const roleDropdown = isPrivileged
              ? `<span style="font-size:11px;color:#888">alle (Systemrolle)</span>`
              : `<select class="user-role-select" data-user-id="${u.id}" style="font-size:13px">
                   <option value="">— keine Rolle —</option>
                   ${roles.map(r =>
                     `<option value="${r.id}" ${u.role_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`
                   ).join('')}
                 </select>`;

            return `
              <tr>
                <td>
                  ${esc(u.username)}
                  ${isSelf ? ' <span style="font-size:11px;color:#888">(ich)</span>' : ''}
                </td>
                <td>
                  <span class="badge badge--${u.role}">${ROLE_LABELS[u.role] || u.role}</span>
                </td>
                <td>${roleDropdown}</td>
                <td style="text-align:center">${u.totp_enabled ? '✅' : '—'}</td>
                <td style="font-size:12px;color:#666">
                  ${new Date(u.created_at).toLocaleDateString('de-DE')}
                </td>
                <td>
                  <div class="btn-group">
                    ${canReset ? `
                      <button class="btn btn--outline btn--sm"
                        data-action="reset-pw" data-id="${u.id}" data-username="${esc(u.username)}">
                        PW Reset
                      </button>` : ''}
                    ${canEdit ? `
                      <button class="btn btn--outline btn--sm"
                        data-action="toggle-role" data-id="${u.id}"
                        data-role="${u.role}" data-username="${esc(u.username)}">
                        → ${u.role === 'admin' ? 'Benutzer' : 'Admin'}
                      </button>
                      <button class="btn btn--danger btn--sm"
                        data-action="delete" data-id="${u.id}" data-username="${esc(u.username)}">
                        Löschen
                      </button>` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    wrap.innerHTML = `<p style="color:red;font-size:13px">Fehler: ${e.message}</p>`;
  }
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
