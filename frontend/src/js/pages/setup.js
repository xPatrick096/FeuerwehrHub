import { api } from '../api.js';
import { toast } from '../toast.js';
import { navigate } from '../router.js';

export function renderSetup() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-emblem">🚒</div>
          <h1>Ersteinrichtung</h1>
          <p>FeuerwehrHub</p>
        </div>
        <div class="auth-body">
          <p style="font-size:13px;color:#666;margin-bottom:20px">
            Willkommen! Richte jetzt den Administrator-Account ein.
          </p>
          <div class="form-group">
            <label>Name der Feuerwehr</label>
            <input type="text" id="setup-ff-name" placeholder="Freiwillige Feuerwehr Musterstadt" />
          </div>
          <div class="form-group">
            <label>Admin-Benutzername</label>
            <input type="text" id="setup-user" placeholder="admin" autocomplete="username" />
          </div>
          <div class="form-group">
            <label>Passwort (min. 8 Zeichen)</label>
            <input type="password" id="setup-pass" autocomplete="new-password" placeholder="••••••••" />
          </div>
          <div class="form-group">
            <label>Passwort wiederholen</label>
            <input type="password" id="setup-pass2" autocomplete="new-password" placeholder="••••••••" />
          </div>
          <div style="margin-top:20px">
            <button class="btn btn--primary btn--full btn--lg" id="btn-setup">Einrichtung abschließen</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-setup').addEventListener('click', doSetup);
}

async function doSetup() {
  const ffName   = document.getElementById('setup-ff-name').value.trim();
  const username = document.getElementById('setup-user').value.trim();
  const pass     = document.getElementById('setup-pass').value;
  const pass2    = document.getElementById('setup-pass2').value;

  if (!ffName || !username || !pass) {
    toast('Alle Felder ausfüllen', 'error');
    return;
  }
  if (pass !== pass2) {
    toast('Passwörter stimmen nicht überein', 'error');
    return;
  }
  if (pass.length < 8) {
    toast('Passwort muss mindestens 8 Zeichen haben', 'error');
    return;
  }

  try {
    await api.setup({ username, password: pass, ff_name: ffName });
    toast('Einrichtung abgeschlossen! Bitte anmelden.');
    navigate('#/login');
  } catch (e) {
    toast(e.message || 'Fehler bei der Einrichtung', 'error');
  }
}
