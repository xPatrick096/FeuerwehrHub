import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';

export async function renderSettings() {
  const [settings, user] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, user, settings?.modules);
  renderShell('settings');

  const content = document.getElementById('page-content');
  const totp_enabled = user?.totp_enabled || false;

  content.innerHTML = `
    <div class="page-header">
      <div>
        <h2>Einstellungen</h2>
        <p>Konto verwalten</p>
      </div>
    </div>

    <div class="card">
      <div class="card__header">Konto: ${esc(user?.username || '')}</div>
      <div class="card__body">
        <div class="form-grid" style="margin-bottom:16px">
          <div class="form-group form-group--full">
            <label>Anzeigename (wird als Bedarfsmelder vorausgefüllt)</label>
            <input type="text" id="set-display-name"
              value="${esc(user?.display_name || '')}"
              placeholder="${esc(user?.username || '')}" />
          </div>
        </div>
        <div class="btn-group" style="margin-bottom:24px">
          <button class="btn btn--primary" id="btn-save-profile">Anzeigename speichern</button>
        </div>
        <hr style="border:none;border-top:1px solid #21273d;margin-bottom:20px" />
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

    <div class="card">
      <div class="card__header">2-Faktor-Authentifizierung</div>
      <div class="card__body">
        <p style="font-size:13px;color:#7d8590;margin-bottom:16px">
          ${totp_enabled
            ? '✅ 2FA ist aktiviert. Dein Account ist mit einem Authenticator gesichert.'
            : '⚠️ 2FA ist <strong>nicht aktiv</strong>. Du kannst es optional aktivieren.'}
        </p>
        ${!totp_enabled ? `
          <div id="totp-setup-area">
            <button class="btn btn--secondary" id="btn-setup-totp">2FA einrichten</button>
          </div>
          <div id="totp-qr-area" style="display:none;margin-top:16px">
            <p style="font-size:13px;color:#7d8590;margin-bottom:12px">
              Scanne den QR-Code mit deiner Authenticator-App (2FAS, Google Authenticator, Authy, ...):
            </p>
            <div style="margin-bottom:16px;display:flex;justify-content:flex-start">
              <div style="background:#ffffff;padding:12px;border-radius:8px;display:inline-block">
                <canvas id="totp-qr-canvas"></canvas>
              </div>
            </div>
            <p style="font-size:12px;color:#7d8590;margin-bottom:6px">
              Oder manuell eingeben:
            </p>
            <div id="totp-uri" style="word-break:break-all;font-size:11px;background:#0d1117;color:#7d8590;border:1px solid #21273d;padding:10px;border-radius:4px;margin-bottom:16px"></div>
            <div class="form-group" style="max-width:200px">
              <label>Code bestätigen</label>
              <input type="text" id="totp-code" maxlength="6" inputmode="numeric"
                     placeholder="000000" style="text-align:center;font-size:20px;letter-spacing:6px;font-weight:700" />
            </div>
            <div class="btn-group" style="margin-top:12px">
              <button class="btn btn--primary" id="btn-confirm-totp">2FA aktivieren</button>
              <button class="btn btn--outline" id="btn-cancel-totp">Abbrechen</button>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  document.getElementById('btn-save-profile').addEventListener('click', async () => {
    try {
      await api.updateProfile({
        display_name: document.getElementById('set-display-name').value.trim() || null,
      });
      toast('Anzeigename gespeichert');
    } catch (e) {
      toast(e.message, 'error');
    }
  });

  // 2FA Setup (nur wenn nicht aktiv)
  if (!totp_enabled) {
    document.getElementById('btn-setup-totp').addEventListener('click', async () => {
      try {
        const res = await api.setupTotp();
        if (!res) return;
        document.getElementById('totp-setup-area').style.display = 'none';
        document.getElementById('totp-qr-area').style.display = 'block';

        // QR-Code generieren
        const QRCode = (await import('qrcode')).default;
        const canvas = document.getElementById('totp-qr-canvas');
        await QRCode.toCanvas(canvas, res.uri, {
          width: 200,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' },
        });

        document.getElementById('totp-uri').textContent = res.uri;
        document.getElementById('totp-code').focus();
      } catch (e) { toast(e.message, 'error'); }
    });

    document.getElementById('btn-cancel-totp').addEventListener('click', () => {
      document.getElementById('totp-setup-area').style.display = 'block';
      document.getElementById('totp-qr-area').style.display = 'none';
    });

    document.getElementById('btn-confirm-totp').addEventListener('click', async () => {
      const code = document.getElementById('totp-code').value.trim();
      if (code.length !== 6) { toast('6-stelligen Code eingeben', 'error'); return; }
      try {
        const res = await api.confirmTotp({ code });
        if (!res) return;
        localStorage.setItem('ff_token', res.token);
        toast('2FA erfolgreich aktiviert!');
        renderSettings();
      } catch (e) { toast(e.message || 'Ungültiger Code', 'error'); }
    });
  }

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
