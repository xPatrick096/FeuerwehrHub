import { api } from '../api.js';
import { toast } from '../toast.js';
import { navigate } from '../router.js';

export function renderLogin() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-emblem">🚒</div>
          <h1>FF Druckerverwaltung</h1>
          <p>Freiwillige Feuerwehr</p>
        </div>
        <div class="auth-body" id="auth-step-login">
          <div class="form-group">
            <label>Benutzername</label>
            <input type="text" id="login-user" autocomplete="username" placeholder="benutzername" />
          </div>
          <div class="form-group">
            <label>Passwort</label>
            <input type="password" id="login-pass" autocomplete="current-password" placeholder="••••••••" />
          </div>
          <div style="margin-top:20px">
            <button class="btn btn--primary btn--full btn--lg" id="btn-login">Anmelden</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Enter-Taste
  app.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });
  app.querySelector('#btn-login').addEventListener('click', doLogin);
}

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;

  if (!username || !password) {
    toast('Bitte Benutzername und Passwort eingeben', 'error');
    return;
  }

  try {
    const res = await api.login({ username, password });
    if (!res) return;

    localStorage.setItem('ff_token', res.token);

    if (res.totp_setup_required) {
      renderTotpSetup();
    } else if (res.requires_totp) {
      renderTotpVerify();
    } else {
      navigate('#/orders');
    }
  } catch (e) {
    toast(e.message || 'Anmeldung fehlgeschlagen', 'error');
  }
}

function renderTotpVerify() {
  const body = document.getElementById('auth-step-login');
  body.innerHTML = `
    <div class="auth-totp-hint">
      <strong>2-Faktor-Authentifizierung</strong>
      Gib den aktuellen Code aus deiner Authenticator-App ein.
    </div>
    <div class="form-group">
      <label>6-stelliger Code</label>
      <input type="text" id="totp-code" class="totp-code-input"
             maxlength="6" inputmode="numeric" placeholder="000000" autocomplete="one-time-code" />
    </div>
    <div style="margin-top:20px">
      <button class="btn btn--primary btn--full btn--lg" id="btn-totp">Bestätigen</button>
    </div>
  `;

  const input = document.getElementById('totp-code');
  input.focus();
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doVerifyTotp(); });
  document.getElementById('btn-totp').addEventListener('click', doVerifyTotp);
}

async function doVerifyTotp() {
  const code = document.getElementById('totp-code').value.trim();
  if (code.length !== 6) {
    toast('Bitte einen 6-stelligen Code eingeben', 'error');
    return;
  }

  try {
    const res = await api.verifyTotp({ code });
    if (!res) return;
    localStorage.setItem('ff_token', res.token);
    navigate('#/orders');
  } catch (e) {
    toast(e.message || 'Ungültiger Code', 'error');
  }
}

function renderTotpSetup() {
  const body = document.getElementById('auth-step-login');
  body.innerHTML = `
    <div class="auth-totp-hint">
      <strong>2FA einrichten</strong>
      Für deine Sicherheit muss 2FA eingerichtet werden.
    </div>
    <div style="text-align:center;margin-bottom:16px">
      <button class="btn btn--secondary" id="btn-get-qr">QR-Code generieren</button>
    </div>
    <div id="qr-area" style="display:none">
      <div class="auth-totp-hint">
        <strong>Scanne den QR-Code</strong>
        Öffne deine Authenticator-App und scanne den Code.
      </div>
      <div id="qr-uri" style="word-break:break-all;font-size:11px;background:#f5f5f5;padding:10px;border-radius:4px;margin-bottom:12px;"></div>
      <div class="form-group">
        <label>Code zum Bestätigen</label>
        <input type="text" id="totp-confirm-code" class="totp-code-input"
               maxlength="6" inputmode="numeric" placeholder="000000" />
      </div>
      <div style="margin-top:16px">
        <button class="btn btn--primary btn--full" id="btn-confirm-totp">2FA aktivieren</button>
      </div>
    </div>
  `;

  document.getElementById('btn-get-qr').addEventListener('click', async () => {
    try {
      const res = await api.setupTotp();
      if (!res) return;
      document.getElementById('qr-area').style.display = 'block';
      document.getElementById('qr-uri').textContent = res.uri;
      document.getElementById('totp-confirm-code').focus();
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  document.getElementById('auth-step-login').addEventListener('click', async (e) => {
    if (e.target.id !== 'btn-confirm-totp') return;
    const code = document.getElementById('totp-confirm-code').value.trim();
    if (code.length !== 6) {
      toast('Bitte einen 6-stelligen Code eingeben', 'error');
      return;
    }
    try {
      const res = await api.confirmTotp({ code });
      if (!res) return;
      localStorage.setItem('ff_token', res.token);
      toast('2FA erfolgreich eingerichtet!');
      navigate('#/orders');
    } catch (e) {
      toast(e.message || 'Ungültiger Code', 'error');
    }
  });
}
