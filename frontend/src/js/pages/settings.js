import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';

export async function renderSettings() {
  const [settings, user] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, user);
  renderShell('settings');

  const content = document.getElementById('page-content');
  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Einstellungen</h2>
        <p>Feuerwehr-Daten und Konto verwalten</p>
      </div>
    </div>

    <div class="card">
      <div class="card__header">Feuerwehr</div>
      <div class="card__body">
        <div class="form-grid">
          <div class="form-group form-group--full">
            <label>Name der Feuerwehr</label>
            <input type="text" id="set-ff-name" value="${esc(settings?.ff_name || '')}" />
          </div>
          <div class="form-group">
            <label>Straße & Hausnummer</label>
            <input type="text" id="set-ff-strasse" value="${esc(settings?.ff_strasse || '')}" />
          </div>
          <div class="form-group">
            <label>PLZ & Ort</label>
            <input type="text" id="set-ff-ort" value="${esc(settings?.ff_ort || '')}" />
          </div>
        </div>
        <div class="btn-group" style="margin-top:16px">
          <button class="btn btn--primary" id="btn-save-settings">Speichern</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__header">Konto: ${esc(user?.username || '')}</div>
      <div class="card__body">
        <div class="form-grid">
          <div class="form-group">
            <label>Aktuelles Passwort</label>
            <input type="password" id="pw-current" autocomplete="current-password" />
          </div>
          <div class="form-group">
            <label>Neues Passwort</label>
            <input type="password" id="pw-new" autocomplete="new-password" />
          </div>
          <div class="form-group">
            <label>Neues Passwort wiederholen</label>
            <input type="password" id="pw-new2" autocomplete="new-password" />
          </div>
        </div>
        <div class="btn-group" style="margin-top:16px">
          <button class="btn btn--secondary" id="btn-change-pw">Passwort ändern</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    try {
      await api.updateSettings({
        ff_name: document.getElementById('set-ff-name').value.trim(),
        ff_strasse: document.getElementById('set-ff-strasse').value.trim(),
        ff_ort: document.getElementById('set-ff-ort').value.trim(),
      });
      toast('Einstellungen gespeichert');
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  document.getElementById('btn-change-pw').addEventListener('click', async () => {
    const current = document.getElementById('pw-current').value;
    const newPw   = document.getElementById('pw-new').value;
    const newPw2  = document.getElementById('pw-new2').value;

    if (!current || !newPw) { toast('Alle Passwortfelder ausfüllen', 'error'); return; }
    if (newPw !== newPw2)   { toast('Passwörter stimmen nicht überein', 'error'); return; }
    if (newPw.length < 8)   { toast('Mindestens 8 Zeichen', 'error'); return; }

    try {
      await api.changePassword({ current_password: current, new_password: newPw });
      toast('Passwort geändert');
      document.getElementById('pw-current').value = '';
      document.getElementById('pw-new').value = '';
      document.getElementById('pw-new2').value = '';
    } catch (e) {
      toast(e.message, 'error');
    }
  });
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
