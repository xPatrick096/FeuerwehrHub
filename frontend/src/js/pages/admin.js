import { api } from '../api.js';
import { toast } from '../toast.js';
import { renderShell, setShellInfo } from '../shell.js';
import { esc } from '../utils.js';
import { icon, renderIcons } from '../icons.js';

const ROLE_LABELS = {
  superuser: 'Superuser',
  admin:     'Admin',
  user:      'Benutzer',
};

const MODULE_LABELS = {
  'lager.read':              'Lager (Nur lesen)',
  lager:                     'Lager (Schreiben)',
  'lager.approve':           'Lager (Genehmigen)',
  personal:                  'Personal',
  fahrzeuge:                 'Technik & Geräte',
  'einsatzberichte.read':    'Einsatzberichte (Nur lesen)',
  einsatzberichte:           'Einsatzberichte (Schreiben)',
  'einsatzberichte.approve': 'Einsatzberichte (Genehmigen)',
  verein:                    'Vereinsverwaltung',
};

export async function renderAdmin() {
  const [settings, me] = await Promise.all([api.getSettings(), api.me()]);
  setShellInfo(settings?.ff_name, me, settings?.modules);
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

    <div id="update-banner" class="alert-success" style="display:none;align-items:center;gap:10px">
      <span>${icon('arrow-up-circle', 16)}</span>
      <span id="update-banner-text"></span>
      <a id="update-banner-link" href="#" target="_blank" class="text-success" style="font-weight:600;text-decoration:underline">Releases ansehen</a>
      <button id="update-banner-btn" onclick="triggerUpdate()" class="btn btn--primary" style="margin-left:auto;background:var(--gruen);font-size:12px;padding:5px 14px">Update installieren</button>
    </div>

    <div id="update-modal" class="modal-overlay">
      <div class="modal" style="max-width:580px">
        <div class="modal__header">
          <span>${icon('arrow-up-circle', 16)} Update wird installiert</span>
        </div>
        <div class="modal__body">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            <div id="update-spinner" style="width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--gruen);border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0"></div>
            <span id="update-status-text" style="font-weight:600;color:var(--text)">Initialisiere...</span>
            <span id="update-timer" style="margin-left:auto;font-size:12px;color:var(--text-muted);font-variant-numeric:tabular-nums"></span>
          </div>
          <pre id="update-log" class="terminal" style="max-height:320px">Warte auf ersten Log-Eintrag...</pre>
          <div id="update-countdown" class="alert-success" style="display:none;margin-top:16px;text-align:center"></div>
        </div>
      </div>
    </div>

    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>

    <div class="tab-bar">
      <button class="tab-btn tab-btn--active" data-tab="users">Benutzer</button>
      <button class="tab-btn" data-tab="roles">Rollen</button>
      <button class="tab-btn" data-tab="modules">Module</button>
      <button class="tab-btn" data-tab="einsatzarten">Einsatzarten</button>
      <button class="tab-btn" data-tab="config">Konfiguration</button>
      <button class="tab-btn" data-tab="audit">Audit-Log</button>
      <button class="tab-btn" data-tab="container-log">Container-Log</button>
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

    <div id="tab-modules" class="tab-panel" style="display:none">
      <div class="card">
        <div class="card__header">Module aktivieren / deaktivieren</div>
        <div class="card__body" id="modules-list">
          <p>Lade...</p>
        </div>
      </div>
    </div>

    <div id="tab-einsatzarten" class="tab-panel" style="display:none">
      <div class="card">
        <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
          <span>Einsatzarten / Stichwortverzeichnis</span>
          <button class="btn btn--primary btn--sm" id="btn-new-einsatzart">+ Neue Einsatzart</button>
        </div>
        <div class="card__body" style="padding:0">
          <div id="einsatzarten-add-form" style="display:none;padding:16px;background:var(--bg-card);border-bottom:1px solid var(--border)">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end">
              <div class="form-group" style="margin:0">
                <label style="font-size:12px">Schlüssel <span class="required">*</span>
                  <span style="color:var(--text-muted);font-weight:400">(unveränderlich)</span></label>
                <input type="text" id="ea-key" placeholder="z.B. TH2_BOOT" style="text-transform:uppercase" />
              </div>
              <div class="form-group" style="margin:0">
                <label style="font-size:12px">Bezeichnung <span class="required">*</span></label>
                <input type="text" id="ea-label" placeholder="z.B. TH2 – Boot in Not" />
              </div>
              <div class="form-group" style="margin:0">
                <label style="font-size:12px">Kategorie <span class="required">*</span></label>
                <select id="ea-category">
                  <option value="brand">Brand</option>
                  <option value="thl">THL</option>
                  <option value="gefahrgut">Gefahrgut</option>
                  <option value="fehlalarm">Fehlalarm</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn btn--primary btn--sm" id="ea-btn-submit">Anlegen</button>
                <button class="btn btn--outline btn--sm" id="ea-btn-cancel">✕</button>
              </div>
            </div>
          </div>
          <div id="einsatzarten-list">
            <p style="color:var(--text-muted);font-size:13px;padding:16px">Lade...</p>
          </div>
        </div>
      </div>
      <p style="font-size:12px;color:var(--text-muted);margin-top:8px;padding:0 4px">
        Der Schlüssel (Key) ist nach dem Anlegen nicht mehr änderbar, da er in gespeicherten Einsatzberichten als Snapshot hinterlegt wird.
        Die Bezeichnung kann jederzeit angepasst werden.
      </p>
    </div>

    <div id="tab-config" class="tab-panel" style="display:none">
      <div class="card">
        <div class="card__header">Design</div>
        <div class="card__body">
          <p class="text-muted text-sm" style="margin-bottom:16px">
            Wähle das Erscheinungsbild der Oberfläche. Die Einstellung wird lokal im Browser gespeichert.
          </p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button id="theme-btn-light" class="btn btn--outline" style="gap:8px">
              ☀️ Helles Design
            </button>
            <button id="theme-btn-dark" class="btn btn--outline" style="gap:8px">
              🌙 Dunkles Design
            </button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__header">Feuerwehr-Stammdaten</div>
        <div class="card__body">
          <div class="form-grid">
            <div class="form-group form-group--full">
              <label>Name der Feuerwehr</label>
              <input type="text" id="cfg-ff-name" maxlength="100" value="${esc(settings?.ff_name || '')}" />
            </div>
            <div class="form-group">
              <label>Straße & Hausnummer</label>
              <input type="text" id="cfg-ff-strasse" maxlength="100" value="${esc(settings?.ff_strasse || '')}" />
            </div>
            <div class="form-group">
              <label>PLZ & Ort</label>
              <input type="text" id="cfg-ff-ort" maxlength="100" value="${esc(settings?.ff_ort || '')}" />
            </div>
          </div>
          <div class="btn-group" style="margin-top:16px">
            <button class="btn btn--primary" id="btn-save-config">Speichern</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:0">
        <div class="card__header">Wappen / Logo</div>
        <div class="card__body">
          <p class="text-muted text-sm" style="margin-bottom:16px">
            Lade das Wappen oder Logo deiner Feuerwehr hoch. Es erscheint auf der Anmeldeseite und in der Navigation.
            Empfohlen: PNG mit transparentem Hintergrund, max. 500 KB.
          </p>
          <div id="logo-preview" style="display:flex;align-items:center;gap:12px;margin-bottom:16px;min-height:40px;"></div>
          <div class="form-group">
            <label>Bilddatei auswählen (PNG, JPG, SVG, WEBP)</label>
            <input type="file" id="logo-upload-input" accept="image/*" />
          </div>
          <div class="btn-group" style="margin-top:12px">
            <button class="btn btn--primary" id="btn-upload-logo">Wappen speichern</button>
            <button class="btn btn--outline" id="btn-remove-logo">Standard (Flamme) wiederherstellen</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:0">
        <div class="card__header">Unterschrift</div>
        <div class="card__body">
          <p class="text-muted text-sm" style="margin-bottom:16px">
            Lade eine Unterschrift hoch. Sie wird automatisch in generierte PDFs eingesetzt
            (generisches PDF, kein Template). Empfohlen: PNG mit transparentem Hintergrund, max. 500 KB.
          </p>
          <div id="sig-preview" style="display:flex;align-items:center;gap:12px;margin-bottom:16px;min-height:40px;"></div>
          <div class="form-group">
            <label>Bilddatei auswählen (PNG, JPG)</label>
            <input type="file" id="sig-upload-input" accept="image/png,image/jpeg" />
          </div>
          <div class="btn-group" style="margin-top:12px">
            <button class="btn btn--primary" id="btn-upload-sig">Unterschrift speichern</button>
            <button class="btn btn--outline" id="btn-remove-sig">Unterschrift entfernen</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:0">
        <div class="card__header">Beschaffungsauftrag PDF-Vorlage</div>
        <div class="card__body">
          <p class="text-muted text-sm" style="margin-bottom:16px">
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
            <button class="btn btn--danger" id="btn-delete-pdf" style="display:none">PDF löschen</button>
          </div>
        </div>
      </div>
    </div>

    <div id="tab-audit" class="tab-panel" style="display:none">
      <div class="card">
        <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
          <span>Audit-Log</span>
          <button class="btn btn--outline btn--sm" id="btn-refresh-audit">Aktualisieren</button>
        </div>
        <div class="card__body" id="audit-table-wrap"><p>Lade...</p></div>
      </div>
    </div>

    <div id="tab-container-log" class="tab-panel" style="display:none">
      <div class="card">
        <div class="card__header" style="display:flex;justify-content:space-between;align-items:center">
          <span>Container-Log</span>
          <button class="btn btn--outline btn--sm" id="btn-refresh-container-log">Aktualisieren</button>
        </div>
        <div class="card__body" id="container-log-wrap">
          <pre id="container-log-content" class="terminal" style="max-height:600px">Lade...</pre>
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
            <input type="text" id="new-user-name" maxlength="64" autocomplete="off" />
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
            <input type="text" id="role-name" maxlength="64" placeholder="z.B. Lagerverwalter" autocomplete="off" />
          </div>
          <div class="form-group">
            <label>Typ</label>
            <select id="role-type" style="width:100%">
              <option value="dienstgrad">Dienstgrad (z.B. Truppführer, Gruppenführer)</option>
              <option value="funktion">Zusatzfunktion (z.B. Gerätewart, Lagerverwalter)</option>
            </select>
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

    <!-- Modal: Benutzer bearbeiten -->
    <div id="modal-edit-user" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3>Benutzer bearbeiten</h3>
          <button class="modal__close" id="btn-close-edit-user">✕</button>
        </div>
        <div class="modal__body">
          <p id="edit-user-info" style="font-size:13px;color:var(--text-muted);margin-bottom:12px"></p>
          <div class="form-group">
            <label>Benutzername</label>
            <input type="text" id="edit-user-username" maxlength="64" autocomplete="off" />
          </div>
          <div class="form-group">
            <label>Anzeigename</label>
            <input type="text" id="edit-user-displayname" maxlength="100"
              placeholder="Leer = Benutzername wird verwendet" />
          </div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--primary" id="btn-submit-edit-user">Speichern</button>
          <button class="btn btn--outline" id="btn-cancel-edit-user">Abbrechen</button>
        </div>
      </div>
    </div>

    <!-- Modal: Zusatzfunktionen verwalten -->
    <div id="modal-functions" class="modal" style="display:none">
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <div class="modal__header">
          <h3>Zusatzfunktionen — <span id="modal-functions-username"></span></h3>
          <button class="modal__close" id="btn-close-functions">✕</button>
        </div>
        <div class="modal__body">
          <p class="text-muted text-sm" style="margin-bottom:16px">
            Zusatzfunktionen erweitern die Modulberechtigungen des Benutzers additiv.
          </p>
          <div id="functions-checks" style="display:flex;flex-direction:column;gap:10px"></div>
        </div>
        <div class="modal__footer">
          <button class="btn btn--outline" id="btn-close-functions-footer">Schließen</button>
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
          <p id="reset-pw-username" style="font-size:13px;color:var(--text-muted);margin-bottom:12px"></p>
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
      if (btn.dataset.tab === 'audit')        loadAuditLog();
      if (btn.dataset.tab === 'modules')      loadModules();
      if (btn.dataset.tab === 'container-log') loadContainerLog();
      if (btn.dataset.tab === 'einsatzarten') loadEinsatzarten();
    });
  });

  // Design / Dark Mode
  function updateThemeButtons(theme) {
    document.getElementById('theme-btn-light').classList.toggle('btn--primary', theme !== 'dark');
    document.getElementById('theme-btn-light').classList.toggle('btn--outline', theme === 'dark');
    document.getElementById('theme-btn-dark').classList.toggle('btn--primary', theme === 'dark');
    document.getElementById('theme-btn-dark').classList.toggle('btn--outline', theme !== 'dark');
  }
  updateThemeButtons(localStorage.getItem('ff_theme') || 'light');

  document.getElementById('theme-btn-light').addEventListener('click', () => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('ff_theme');
    updateThemeButtons('light');
  });
  document.getElementById('theme-btn-dark').addEventListener('click', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('ff_theme', 'dark');
    updateThemeButtons('dark');
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
  const updatePdfStatus = (hasPdf) => {
    const statusEl = document.getElementById('pdf-upload-status');
    const deleteBtn = document.getElementById('btn-delete-pdf');
    if (!statusEl) return;
    if (hasPdf) {
      statusEl.innerHTML = `<span class="text-success">${icon('check-circle', 14)} PDF-Vorlage ist hinterlegt</span>`;
      if (deleteBtn) deleteBtn.style.display = '';
    } else {
      statusEl.innerHTML = `<span class="text-error">${icon('alert-triangle', 14)} Noch keine PDF-Vorlage hochgeladen</span>`;
      if (deleteBtn) deleteBtn.style.display = 'none';
    }
    renderIcons(statusEl);
  };

  fetch('/api/settings/pdf', { method: 'HEAD' })
    .then(res => updatePdfStatus(res.ok))
    .catch(() => updatePdfStatus(false));

  // PDF hochladen
  document.getElementById('btn-upload-pdf').addEventListener('click', async () => {
    const file = document.getElementById('pdf-upload-input').files[0];
    if (!file) { toast('Keine Datei ausgewählt', 'error'); return; }
    if (!file.name.toLowerCase().endsWith('.pdf')) { toast('Nur PDF-Dateien erlaubt', 'error'); return; }
    try {
      await api.uploadPdf(file);
      toast('PDF-Vorlage erfolgreich hochgeladen');
      document.getElementById('pdf-upload-input').value = '';
      updatePdfStatus(true);
    } catch (e) { toast(e.message, 'error'); }
  });

  // PDF löschen
  document.getElementById('btn-delete-pdf').addEventListener('click', async () => {
    if (!confirm('PDF-Vorlage wirklich löschen? Danach wird das generische PDF verwendet.')) return;
    try {
      await api.deletePdf();
      toast('PDF-Vorlage gelöscht');
      updatePdfStatus(false);
    } catch (e) { toast(e.message, 'error'); }
  });

  // Logo-Verwaltung
  const updateLogoPreview = () => {
    const el = document.getElementById('logo-preview');
    if (!el) return;
    const saved = localStorage.getItem('ff_custom_logo');
    if (saved) {
      el.innerHTML = `
        <img src="${saved}" style="width:56px;height:56px;object-fit:contain;border:1px solid var(--border);border-radius:12px;padding:4px;background:var(--bg-card);">
        <span class="text-success" style="font-size:12px;font-weight:600">✓ Eigenes Wappen aktiv</span>`;
    } else {
      el.innerHTML = `<span class="text-muted text-xs">${icon('flame', 14)} Standard-Logo (Flamme) aktiv</span>`;
    }
    renderIcons(el);
  };
  updateLogoPreview();

  document.getElementById('btn-upload-logo').addEventListener('click', () => {
    const file = document.getElementById('logo-upload-input').files[0];
    if (!file) { toast('Keine Datei ausgewählt', 'error'); return; }
    if (!file.type.startsWith('image/')) { toast('Nur Bilddateien erlaubt', 'error'); return; }
    if (file.size > 500 * 1024) { toast('Datei zu groß (max. 500 KB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      localStorage.setItem('ff_custom_logo', e.target.result);
      toast('Wappen gespeichert — wird ab dem nächsten Seitenaufruf angezeigt');
      updateLogoPreview();
      document.getElementById('logo-upload-input').value = '';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-remove-logo').addEventListener('click', () => {
    localStorage.removeItem('ff_custom_logo');
    toast('Standard-Logo wiederhergestellt');
    updateLogoPreview();
  });

  // Unterschrift-Verwaltung
  const updateSigPreview = () => {
    const el = document.getElementById('sig-preview');
    if (!el) return;
    const saved = localStorage.getItem('ff_signature');
    if (saved) {
      el.innerHTML = `
        <img src="${saved}" style="height:44px;max-width:220px;object-fit:contain;border:1px solid var(--border);border-radius:8px;padding:4px;background:#fff;">
        <span class="text-success" style="font-size:12px;font-weight:600">✓ Unterschrift gespeichert</span>`;
    } else {
      el.innerHTML = `<span class="text-muted text-xs">Keine Unterschrift hinterlegt</span>`;
    }
  };
  updateSigPreview();

  document.getElementById('btn-upload-sig').addEventListener('click', () => {
    const file = document.getElementById('sig-upload-input').files[0];
    if (!file) { toast('Keine Datei ausgewählt', 'error'); return; }
    if (!file.type.startsWith('image/')) { toast('Nur Bilddateien erlaubt', 'error'); return; }
    if (file.size > 500 * 1024) { toast('Datei zu groß (max. 500 KB)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => {
      localStorage.setItem('ff_signature', e.target.result);
      toast('Unterschrift gespeichert');
      updateSigPreview();
      document.getElementById('sig-upload-input').value = '';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-remove-sig').addEventListener('click', () => {
    localStorage.removeItem('ff_signature');
    toast('Unterschrift entfernt');
    updateSigPreview();
  });

  // Benutzer + Rollen laden
  const roles = await api.getRoles().catch(() => []);
  await loadUsers(me, roles);

  // Rollen-Tab
  await loadRoles(me);

  renderIcons(document.getElementById('page-content'));

  document.getElementById('btn-refresh-audit').addEventListener('click', loadAuditLog);
  document.getElementById('btn-refresh-container-log').addEventListener('click', loadContainerLog);

  // Update-Check im Hintergrund
  checkForUpdate();

  // Modal: Neuer Benutzer
  let resetTarget = null;
  let editUserTarget = null;

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

  // Modal: Benutzer bearbeiten
  const closeEditUser = () => {
    document.getElementById('modal-edit-user').style.display = 'none';
    document.getElementById('edit-user-username').value = '';
    document.getElementById('edit-user-displayname').value = '';
    editUserTarget = null;
  };
  document.getElementById('btn-close-edit-user').addEventListener('click', closeEditUser);
  document.getElementById('btn-cancel-edit-user').addEventListener('click', closeEditUser);

  document.getElementById('btn-submit-edit-user').addEventListener('click', async () => {
    const username    = document.getElementById('edit-user-username').value.trim();
    const displayName = document.getElementById('edit-user-displayname').value.trim();
    if (!username) { toast('Benutzername darf nicht leer sein', 'error'); return; }
    try {
      await api.updateUser(editUserTarget.id, {
        username,
        display_name: displayName || null,
      });
      toast(`Benutzer "${username}" aktualisiert`);
      closeEditUser();
      const roles = await api.getRoles().catch(() => []);
      await loadUsers(me, roles);
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

    if (e.target.matches('[data-action="edit-user"]')) {
      editUserTarget = { id, username };
      document.getElementById('edit-user-info').textContent = `Benutzer: ${username}`;
      document.getElementById('edit-user-username').value = e.target.dataset.username;
      document.getElementById('edit-user-displayname').value = e.target.dataset.displayname || '';
      document.getElementById('modal-edit-user').style.display = 'flex';
      document.getElementById('edit-user-username').focus();
    }

    if (e.target.matches('[data-action="reset-totp"]')) {
      if (!confirm(`2FA für "${username}" wirklich zurücksetzen? Der Benutzer muss 2FA danach neu einrichten.`)) return;
      try {
        await api.adminResetTotp(id);
        toast(`2FA für "${username}" zurückgesetzt`);
        const roles = await api.getRoles().catch(() => []);
        await loadUsers(me, roles);
      } catch (e) { toast(e.message, 'error'); }
    }

    if (e.target.matches('[data-action="toggle-role"]')) {
      const currentRole = e.target.dataset.role;
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      try {
        await api.updateUserSystemRole(id, { role: newRole });
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

    if (e.target.matches('[data-action="unlock"]')) {
      if (!confirm(`Account "${username}" wirklich entsperren?`)) return;
      try {
        await api.unlockUser(id);
        toast(`Account "${username}" entsperrt`);
        const roles = await api.getRoles().catch(() => []);
        await loadUsers(me, roles);
      } catch (e) { toast(e.message, 'error'); }
    }

    if (e.target.matches('[data-action="manage-functions"]')) {
      await openFunctionsModal(id, username);
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

async function openFunctionsModal(userId, username) {
  const modal    = document.getElementById('modal-functions');
  const checksEl = document.getElementById('functions-checks');
  document.getElementById('modal-functions-username').textContent = username;
  checksEl.innerHTML = '<p class="text-muted text-sm">Lade...</p>';
  modal.style.display = 'flex';

  const [allRoles, userFunctions] = await Promise.all([
    api.getRoles().catch(() => []),
    api.getUserFunctions(userId).catch(() => []),
  ]);

  const funktionen = allRoles.filter(r => r.type === 'funktion');
  const assignedIds = userFunctions.map(f => f.role_id);

  if (!funktionen.length) {
    checksEl.innerHTML = '<p class="text-muted text-sm">Keine Zusatzfunktionen angelegt.</p>';
  } else {
    checksEl.innerHTML = funktionen.map(f => `
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border:1px solid var(--border);border-radius:8px">
        <input type="checkbox" class="fn-check" data-role-id="${f.id}"
          ${assignedIds.includes(f.id) ? 'checked' : ''} />
        <span>
          <strong style="font-size:13px">${esc(f.name)}</strong>
          ${f.permissions.length ? `<span style="font-size:11px;color:var(--text-muted);margin-left:6px">→ ${f.permissions.join(', ')}</span>` : ''}
        </span>
      </label>
    `).join('');

    checksEl.querySelectorAll('.fn-check').forEach(cb => {
      cb.addEventListener('change', async () => {
        const roleId = cb.dataset.roleId;
        try {
          if (cb.checked) {
            await api.assignFunction(userId, { role_id: roleId });
            toast('Funktion zugewiesen');
          } else {
            await api.removeFunction(userId, roleId);
            toast('Funktion entfernt');
          }
        } catch (e) {
          cb.checked = !cb.checked; // revert
          toast(e.message, 'error');
        }
      });
    });
  }

  const close = () => { modal.style.display = 'none'; };
  document.getElementById('btn-close-functions').onclick = close;
  document.getElementById('btn-close-functions-footer').onclick = close;
  modal.querySelector('.modal__backdrop').onclick = close;
}

async function loadRoles(me) {
  const wrap = document.getElementById('roles-table-wrap');
  if (!wrap) return;

  let editTarget = null;

  const render = async () => {
    const roles = await api.getRoles().catch(() => []);

    if (!roles.length) {
      wrap.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Noch keine Rollen angelegt.</p>';
    } else {
      wrap.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>Rollenname</th>
              <th>Typ</th>
              <th>Module</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            ${roles.map(r => `
              <tr>
                <td><strong>${esc(r.name)}</strong></td>
                <td>
                  <span style="font-size:11px;padding:2px 8px;border-radius:10px;
                    background:${r.type === 'funktion' ? 'var(--orange-hell)' : 'var(--gruen-hell)'};
                    color:${r.type === 'funktion' ? 'var(--gelb)' : 'var(--gruen)'}">
                    ${r.type === 'funktion' ? 'Zusatzfunktion' : 'Dienstgrad'}
                  </span>
                </td>
                <td>${r.permissions.length ? r.permissions.map(p => MODULE_LABELS[p] || p).join(', ') : '<span style="color:var(--text-subtle)">keine</span>'}</td>
                <td>
                  <div class="btn-group">
                    <button class="btn btn--outline btn--sm" data-action="edit-role"
                      data-id="${r.id}" data-name="${esc(r.name)}" data-type="${r.type}"
                      data-perms="${JSON.stringify(r.permissions).replace(/"/g,'&quot;')}">Bearbeiten</button>
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
        document.getElementById('role-type').value = btn.dataset.type || 'dienstgrad';
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
    document.getElementById('role-type').value = 'dienstgrad';
  };

  document.getElementById('btn-new-role').addEventListener('click', () => {
    editTarget = null;
    document.getElementById('modal-role-title').textContent = 'Rolle anlegen';
    document.getElementById('role-name').value = '';
    document.getElementById('role-type').value = 'dienstgrad';
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
    const type = document.getElementById('role-type').value;

    try {
      if (editTarget) {
        await api.updateRole(editTarget, { name, permissions, type });
        toast('Rolle gespeichert');
      } else {
        await api.createRole({ name, permissions, type });
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
      wrap.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Keine Benutzer gefunden.</p>';
      return;
    }

    const dienstgrade = roles.filter(r => r.type === 'dienstgrad');

    wrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Benutzername</th>
            <th>Systemrolle</th>
            <th>Dienstgrad</th>
            <th>Funktionen</th>
            <th>2FA</th>
            <th>Status</th>
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
            const canEditUser = !isSelf && !isSuperuser && canReset;
            const isPrivileged = u.role === 'admin' || u.role === 'superuser';
            const isLocked = u.locked_until && new Date(u.locked_until) > new Date();

            const roleDropdown = isPrivileged
              ? `<span style="font-size:11px;color:var(--text-muted)">alle (Systemrolle)</span>`
              : `<select class="user-role-select" data-user-id="${u.id}" style="font-size:13px">
                   <option value="">— kein Dienstgrad —</option>
                   ${dienstgrade.map(r =>
                     `<option value="${r.id}" ${u.role_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`
                   ).join('')}
                 </select>`;

            return `
              <tr>
                <td>
                  ${esc(u.username)}
                  ${isSelf ? ' <span style="font-size:11px;color:var(--text-muted)">(ich)</span>' : ''}
                </td>
                <td>
                  <span class="badge badge--${u.role}">${ROLE_LABELS[u.role] || u.role}</span>
                </td>
                <td>${roleDropdown}</td>
                <td>
                  ${!isPrivileged
                    ? `<button class="btn btn--outline btn--sm" data-action="manage-functions"
                         data-id="${u.id}" data-username="${esc(u.username)}">
                         Funktionen
                       </button>`
                    : '<span style="font-size:11px;color:var(--text-muted)">alle</span>'}
                </td>
                <td style="text-align:center">${u.totp_enabled ? `${icon('lock', 14)}` : '—'}</td>
                <td style="text-align:center">
                  ${isLocked ? `<span class="badge badge--danger" title="Gesperrt bis ${new Date(u.locked_until).toLocaleString('de-DE')}">Gesperrt</span>` : '—'}
                </td>
                <td style="font-size:12px;color:var(--text-muted)">
                  ${new Date(u.created_at).toLocaleDateString('de-DE')}
                </td>
                <td>
                  <div class="btn-group">
                    ${canEditUser ? `
                      <button class="btn btn--outline btn--sm"
                        data-action="edit-user" data-id="${u.id}"
                        data-username="${esc(u.username)}"
                        data-displayname="${esc(u.display_name || '')}">
                        Bearbeiten
                      </button>` : ''}
                    ${canReset ? `
                      <button class="btn btn--outline btn--sm"
                        data-action="reset-pw" data-id="${u.id}" data-username="${esc(u.username)}">
                        PW Reset
                      </button>` : ''}
                    ${canReset && u.totp_enabled ? `
                      <button class="btn btn--outline btn--sm"
                        data-action="reset-totp" data-id="${u.id}" data-username="${esc(u.username)}">
                        2FA Reset
                      </button>` : ''}
                    ${canReset && isLocked ? `
                      <button class="btn btn--warning btn--sm"
                        data-action="unlock" data-id="${u.id}" data-username="${esc(u.username)}">
                        Entsperren
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

const MODULE_DEFS = [
  { key: 'lager',           iconName: 'package',         label: 'Lager',           desc: 'Beschaffungsaufträge, Bestellübersicht, Artikelstamm' },
  { key: 'personal',        iconName: 'users',           label: 'Personal',        desc: 'Mitgliederverwaltung, Qualifikationen, Ehrungen' },
  { key: 'einsatzberichte', iconName: 'truck',           label: 'Einsatzberichte', desc: 'Einsatzberichte erfassen und verwalten' },
  { key: 'verein',          iconName: 'building',        label: 'Verein',          desc: 'Vorstandsverwaltung, Schwarzes Brett, Dokumentenablage, Briefkopf' },
  { key: 'fahrzeuge',       iconName: 'wrench',          label: 'Technik &amp; Geräte', desc: 'Fahrzeuge, Geräte, Fristen, Prüfungen, Checklisten' },
  { key: 'jugendfeuerwehr', iconName: 'users',           label: 'Jugendfeuerwehr', desc: 'JF-Mitglieder, Termine, Wettbewerbe',                  soon: true },
];

async function loadModules() {
  const wrap = document.getElementById('modules-list');
  if (!wrap) return;

  try {
    const settings = await api.getSettings();
    const modules = settings?.modules || {};

    wrap.innerHTML = `
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">
        Aktiviere oder deaktiviere Module für diese Feuerwehr.
        Deaktivierte Module sind für alle Benutzer ausgeblendet.
      </p>
      <div style="display:flex;flex-direction:column;gap:0">
        ${MODULE_DEFS.map(m => `
          <div style="display:flex;align-items:center;justify-content:space-between;
                      padding:14px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:12px">
              <span>${icon(m.iconName, 22)}</span>
              <div>
                <div style="font-weight:600;font-size:14px">${m.label}
                  ${m.soon ? '<span style="font-size:11px;color:var(--text-subtle);margin-left:6px;font-weight:400">Demnächst</span>' : ''}
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${m.desc}</div>
              </div>
            </div>
            <label class="toggle-switch" style="flex-shrink:0">
              <input type="checkbox" data-module="${m.key}"
                ${modules[m.key] ? 'checked' : ''}
                ${m.soon ? 'disabled' : ''} />
              <span class="toggle-switch__track"></span>
            </label>
          </div>
        `).join('')}
      </div>
      <div class="btn-group" style="margin-top:20px">
        <button class="btn btn--primary" id="btn-save-modules">Änderungen speichern</button>
      </div>
    `;

    renderIcons(wrap);

    document.getElementById('btn-save-modules').addEventListener('click', async () => {
      const updated = {};
      wrap.querySelectorAll('input[data-module]').forEach(cb => {
        if (!cb.disabled) updated[cb.dataset.module] = cb.checked;
      });
      try {
        await api.updateModules({ modules: updated });
        toast('Module gespeichert');
      } catch (e) { toast(e.message, 'error'); }
    });
  } catch (e) {
    wrap.innerHTML = `<p style="color:red;font-size:13px">Fehler: ${e.message}</p>`;
  }
}

async function loadAuditLog() {
  const wrap = document.getElementById('audit-table-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<p>Lade...</p>';

  try {
    const entries = await api.getAuditLog();

    if (!entries.length) {
      wrap.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Noch keine Einträge.</p>';
      return;
    }

    const ACTION_LABELS = {
      LOGIN_SUCCESS:    `${icon('check-circle', 14)} Login erfolgreich`,
      LOGIN_FAILED:     `${icon('alert-triangle', 14)} Login fehlgeschlagen`,
      ACCOUNT_LOCKED:   `${icon('lock', 14)} Account gesperrt`,
      ACCOUNT_UNLOCKED: `${icon('unlock', 14)} Account entsperrt`,
      USER_CREATED:     `${icon('plus', 14)} Benutzer angelegt`,
      USER_DELETED:     `${icon('trash-2', 14)} Benutzer gelöscht`,
      PASSWORD_RESET:   `${icon('key', 14)} Passwort zurückgesetzt`,
      ROLE_CHANGED:     `${icon('wrench', 14)} Systemrolle geändert`,
      SETTINGS_UPDATED: `${icon('settings', 14)} Einstellungen geändert`,
    };

    wrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Zeitpunkt</th>
            <th>Benutzer</th>
            <th>Aktion</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(e => `
            <tr>
              <td style="font-size:12px;color:var(--text-muted);white-space:nowrap">
                ${new Date(e.created_at).toLocaleString('de-DE')}
              </td>
              <td>${esc(e.username)}</td>
              <td style="white-space:nowrap">${ACTION_LABELS[e.action] || esc(e.action)}</td>
              <td style="font-size:12px;color:var(--text-muted)">${esc(e.details || '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    renderIcons(wrap);
  } catch (err) {
    wrap.innerHTML = `<p style="color:red;font-size:13px">Fehler: ${err.message}</p>`;
  }
}


// ── Container-Log ─────────────────────────────────────────────────────────────

async function loadContainerLog() {
  const pre = document.getElementById('container-log-content');
  if (!pre) return;
  pre.textContent = 'Lade...';
  try {
    const data = await api.getContainerLog();
    const lines = data?.lines || [];
    if (!lines.length) {
      pre.textContent = 'Noch keine Log-Einträge vorhanden.';
      return;
    }
    pre.textContent = lines.join('\n');
    pre.scrollTop = pre.scrollHeight;
  } catch (e) {
    pre.textContent = `Fehler: ${e.message}`;
  }
}

// ── Einsatzarten ─────────────────────────────────────────────────────────────

const CAT_LABELS_EA = { brand: 'Brand', thl: 'THL', gefahrgut: 'Gefahrgut', fehlalarm: 'Fehlalarm', sonstiges: 'Sonstiges' };
const CAT_COLORS_EA = { brand: 'var(--rot)', thl: 'var(--gelb)', gefahrgut: 'var(--lila)', fehlalarm: 'var(--text-muted)', sonstiges: 'var(--gruen)' };

async function loadEinsatzarten() {
  const list = document.getElementById('einsatzarten-list');
  if (!list) return;
  list.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:16px">Lade...</p>`;

  let types;
  try {
    types = await api.getIncidentTypes();
  } catch (e) {
    list.innerHTML = `<p class="error-msg" style="padding:16px">Fehler: ${esc(e.message)}</p>`;
    return;
  }

  // Nach Kategorie gruppieren
  const grouped = {};
  for (const cat of Object.keys(CAT_LABELS_EA)) grouped[cat] = [];
  types.forEach(t => { if (grouped[t.category]) grouped[t.category].push(t); });

  list.innerHTML = Object.entries(grouped).map(([cat, items]) => {
    if (!items.length) return '';
    const color = CAT_COLORS_EA[cat] || 'var(--text-muted)';
    return `
      <div style="border-bottom:1px solid var(--border)">
        <div style="padding:10px 16px;background:var(--bg-card-hover);font-size:11px;font-weight:700;
          color:${color};text-transform:uppercase;letter-spacing:.08em">
          ${CAT_LABELS_EA[cat]}
        </div>
        ${items.map(t => `
          <div class="ea-row" data-id="${t.id}" style="display:flex;align-items:center;gap:12px;
            padding:10px 16px;border-top:1px solid var(--border);
            opacity:${t.active ? 1 : 0.5}">
            <div style="flex:0 0 140px;font-family:monospace;font-size:12px;
              color:var(--text-muted);background:var(--bg-card);padding:3px 8px;border-radius:4px">
              ${esc(t.key)}
            </div>
            <div style="flex:1;font-size:13px;font-weight:500" id="ea-label-${t.id}">
              ${esc(t.label)}
            </div>
            <div style="font-size:11px;color:var(--text-muted);flex:0 0 80px;text-align:center">
              ${t.used_count > 0 ? `${t.used_count} Bericht${t.used_count !== 1 ? 'e' : ''}` : '—'}
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn--outline btn--sm" data-action="ea-edit" data-id="${t.id}"
                data-label="${esc(t.label)}" data-cat="${t.category}" data-sort="${t.sort_order}">
                Bearbeiten
              </button>
              <button class="btn btn--outline btn--sm" data-action="ea-toggle" data-id="${t.id}"
                style="color:${t.active ? 'var(--gelb)' : 'var(--gruen)'}">
                ${t.active ? 'Deakt.' : 'Aktiv.'}
              </button>
              <button class="btn btn--danger btn--sm" data-action="ea-delete" data-id="${t.id}"
                data-key="${esc(t.key)}" data-count="${t.used_count}"
                ${t.used_count > 0 ? 'title="Dieser Typ wird in Einsatzberichten verwendet"' : ''}>
                Löschen
              </button>
            </div>
          </div>`).join('')}
      </div>`;
  }).join('');

  // Add-Formular
  document.getElementById('btn-new-einsatzart').onclick = () => {
    document.getElementById('einsatzarten-add-form').style.display = 'block';
    document.getElementById('btn-new-einsatzart').style.display = 'none';
    document.getElementById('ea-key').focus();
  };
  document.getElementById('ea-btn-cancel').onclick = () => {
    document.getElementById('einsatzarten-add-form').style.display = 'none';
    document.getElementById('btn-new-einsatzart').style.display = '';
  };
  document.getElementById('ea-btn-submit').onclick = async () => {
    const key   = document.getElementById('ea-key').value.trim().toUpperCase();
    const label = document.getElementById('ea-label').value.trim();
    const cat   = document.getElementById('ea-category').value;
    if (!key || !label) { toast('Schlüssel und Bezeichnung sind Pflichtfelder', 'error'); return; }
    try {
      await api.createIncidentType({ key, label, category: cat, sort_order: 50 });
      toast('Einsatzart angelegt');
      document.getElementById('ea-key').value = '';
      document.getElementById('ea-label').value = '';
      document.getElementById('einsatzarten-add-form').style.display = 'none';
      document.getElementById('btn-new-einsatzart').style.display = '';
      loadEinsatzarten();
    } catch (e) { toast(e.message, 'error'); }
  };

  // Edit inline
  list.querySelectorAll('[data-action="ea-edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id    = btn.dataset.id;
      const row   = document.querySelector(`.ea-row[data-id="${id}"]`);
      const labelDiv = document.getElementById(`ea-label-${id}`);
      if (!labelDiv) return;

      // Inline-Editor aufklappen
      labelDiv.innerHTML = `
        <div style="display:flex;gap:6px;align-items:center">
          <input type="text" id="ea-edit-label-${id}" value="${esc(btn.dataset.label)}"
            style="flex:1;font-size:13px" />
          <select id="ea-edit-cat-${id}" style="font-size:12px">
            ${Object.entries(CAT_LABELS_EA).map(([k, v]) =>
              `<option value="${k}" ${btn.dataset.cat === k ? 'selected' : ''}>${v}</option>`
            ).join('')}
          </select>
          <input type="number" id="ea-edit-sort-${id}" value="${btn.dataset.sort}"
            style="width:60px;font-size:12px" placeholder="Sort" />
          <button class="btn btn--primary btn--sm" id="ea-save-${id}">✓</button>
          <button class="btn btn--outline btn--sm" id="ea-discard-${id}">✕</button>
        </div>`;

      document.getElementById(`ea-discard-${id}`).onclick = () => loadEinsatzarten();
      document.getElementById(`ea-save-${id}`).onclick = async () => {
        const newLabel = document.getElementById(`ea-edit-label-${id}`).value.trim();
        const newCat   = document.getElementById(`ea-edit-cat-${id}`).value;
        const newSort  = +document.getElementById(`ea-edit-sort-${id}`).value || 50;
        if (!newLabel) { toast('Bezeichnung darf nicht leer sein', 'error'); return; }
        try {
          await api.updateIncidentType(id, {
            key: btn.dataset.key || '', label: newLabel, category: newCat, sort_order: newSort,
          });
          toast('Gespeichert');
          loadEinsatzarten();
        } catch (e) { toast(e.message, 'error'); }
      };
    });
  });

  // Toggle aktiv/inaktiv
  list.querySelectorAll('[data-action="ea-toggle"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const t = types.find(x => x.id === btn.dataset.id);
      if (!t) return;
      try {
        await api.updateIncidentType(t.id, {
          key: t.key, label: t.label, category: t.category, sort_order: t.sort_order,
          active: !t.active,
        });
        toast(t.active ? 'Deaktiviert' : 'Aktiviert');
        loadEinsatzarten();
      } catch (e) { toast(e.message, 'error'); }
    });
  });

  // Löschen
  list.querySelectorAll('[data-action="ea-delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const count = +btn.dataset.count;
      const msg = count > 0
        ? `Einsatzart "${btn.dataset.key}" wirklich löschen?\n\nAchtung: ${count} Einsatzbericht${count !== 1 ? 'e verwenden' : ' verwendet'} diesen Typ. Die Berichte bleiben erhalten, der Typ erscheint aber nicht mehr in Auswertungen.`
        : `Einsatzart "${btn.dataset.key}" wirklich löschen?`;
      if (!confirm(msg)) return;
      try {
        await api.deleteIncidentType(btn.dataset.id);
        toast('Gelöscht');
        loadEinsatzarten();
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

// ── Update-Check & In-App-Update ─────────────────────────────────────────────

const CURRENT_VERSION = __APP_VERSION__;
const GITHUB_REPO     = 'xpatrick096/FeuerwehrHub';

let _updatePollInterval = null;
let _updateTimerInterval = null;
let _updateStartTime = null;

async function checkForUpdate() {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return;
    const data = await res.json();
    const latest = (data.tag_name || '').replace(/^v/, '');
    if (latest && latest !== CURRENT_VERSION) {
      const banner = document.getElementById('update-banner');
      const text   = document.getElementById('update-banner-text');
      const link   = document.getElementById('update-banner-link');
      if (!banner) return;
      text.textContent = `Update verfügbar: v${latest} (aktuell v${CURRENT_VERSION})`;
      link.href = data.html_url || `https://github.com/${GITHUB_REPO}/releases`;
      banner.style.display = 'flex';
    }
  } catch (_) { /* GitHub nicht erreichbar — ignorieren */ }
}

window.triggerUpdate = async function() {
  if (!confirm('Update jetzt installieren?\n\nDas System wird dabei neu gestartet. Alle aktiven Sitzungen bleiben nach dem Neustart erhalten.')) return;

  const modal   = document.getElementById('update-modal');
  const logPre  = document.getElementById('update-log');
  const spinner = document.getElementById('update-spinner');
  const statusText = document.getElementById('update-status-text');
  const timerEl = document.getElementById('update-timer');
  const countdown = document.getElementById('update-countdown');

  // Modal öffnen + Reset
  modal.classList.add('active');
  logPre.textContent = '';
  countdown.style.display = 'none';
  statusText.textContent  = 'Starte Update...';
  statusText.style.color  = 'var(--text)';
  spinner.style.display   = 'block';

  // Laufzeit-Timer starten
  _updateStartTime = Date.now();
  clearInterval(_updateTimerInterval);
  _updateTimerInterval = setInterval(() => {
    const sec = Math.floor((Date.now() - _updateStartTime) / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }, 1000);

  // Update anstoßen
  try {
    await api.request('POST', '/admin/update');
  } catch (e) {
    statusText.textContent = `Fehler: ${e.message}`;
    statusText.style.color = 'var(--error)';
    spinner.style.display  = 'none';
    clearInterval(_updateTimerInterval);
    return;
  }

  // Log-Polling starten
  clearInterval(_updatePollInterval);
  _updatePollInterval = setInterval(async () => {
    try {
      const data = await api.request('GET', '/admin/update/status');

      // Log aktualisieren
      if (data.log && data.log.length > 0) {
        logPre.textContent = data.log.join('\n');
        logPre.scrollTop = logPre.scrollHeight;
        statusText.textContent = data.log[data.log.length - 1].replace(/^\[[^\]]+\]\s*/, '');
      }

      if (data.status === 'done') {
        clearInterval(_updatePollInterval);
        clearInterval(_updateTimerInterval);
        spinner.style.display  = 'none';
        statusText.textContent = 'Update abgeschlossen — System startet neu...';
        statusText.style.color = 'var(--gruen)';
        _startRestartCountdown(countdown);
      }

      if (data.status === 'error') {
        clearInterval(_updatePollInterval);
        clearInterval(_updateTimerInterval);
        spinner.style.display  = 'none';
        statusText.textContent = 'Update fehlgeschlagen.';
        statusText.style.color = 'var(--error)';
      }
    } catch (_) {
      // Backend antwortet nicht mehr → Neustart läuft
      if (document.getElementById('update-countdown')?.style.display !== 'none') return;
      clearInterval(_updatePollInterval);
      clearInterval(_updateTimerInterval);
      spinner.style.display  = 'none';
      statusText.textContent = 'Backend neugestartet — Weiterleitung...';
      statusText.style.color = 'var(--gruen)';
      _startRestartCountdown(countdown);
    }
  }, 1500);
};

function _startRestartCountdown(countdownEl) {
  let seconds = 12;
  countdownEl.style.display = 'block';
  countdownEl.textContent   = `System startet neu — Weiterleitung zum Login in ${seconds}s...`;

  const iv = setInterval(() => {
    seconds--;
    if (seconds <= 0) {
      clearInterval(iv);
      window.location.hash = '#/login';
      window.location.reload();
    } else {
      countdownEl.textContent = `System startet neu — Weiterleitung zum Login in ${seconds}s...`;
    }
  }, 1000);
}
