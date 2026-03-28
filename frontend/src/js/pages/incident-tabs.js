/**
 * Phase B + C: Dynamische Tab-Inhalte für Fahrzeuge, Personal & Anhänge im Einsatz
 * Wird von edit-incident.js und incidents.js (Modal) importiert.
 */

import { api } from '../api.js';
import { toast } from '../toast.js';
import { esc } from '../utils.js';

// ── Fahrzeuge Tab ─────────────────────────────────────────────────────────────

export async function loadVehiclesTab(incidentId, readonly = false) {
  const wrap = document.getElementById('incident-vehicles-wrap');
  if (!wrap) return;

  let vehicles = [];
  let incidentVehicles = [];

  try {
    [incidentVehicles, vehicles] = await Promise.all([
      api.getIncidentVehicles(incidentId),
      readonly ? Promise.resolve([]) : api.getVehicles().catch(() => []),
    ]);
  } catch (e) {
    wrap.innerHTML = `<p style="color:#ff8a80;font-size:13px">Fehler: ${esc(e.message)}</p>`;
    return;
  }

  _renderVehiclesTab(wrap, incidentId, incidentVehicles, vehicles, readonly);
}

function _renderVehiclesTab(wrap, incidentId, rows, vehicleOptions, readonly) {
  const fmt = t => t ? t.slice(0, 5) : '—';

  const tableHTML = rows.length ? `
    <div style="overflow-x:auto;margin-bottom:16px">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fahrzeug</th><th>Kennung</th>
            <th>Alarm</th><th>Ausrück</th><th>Eintreffen</th><th>Rückkehr</th><th>Einsatzbereit</th>
            <th>km</th><th>Bes.</th>
            ${!readonly ? '<th></th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr data-vid="${r.id}">
              <td style="font-weight:500">${esc(r.vehicle_name)}</td>
              <td style="color:#7d8590">${esc(r.callsign || '—')}</td>
              <td>${fmt(r.alarm_time)}</td>
              <td>${fmt(r.departure_time)}</td>
              <td>${fmt(r.arrival_time)}</td>
              <td>${fmt(r.return_time)}</td>
              <td>${fmt(r.ready_time)}</td>
              <td>${r.km_driven ?? '—'}</td>
              <td>${r.crew_count ?? '—'}</td>
              ${!readonly ? `
                <td>
                  <button class="btn btn--outline btn--sm" data-action="edit-v" data-id="${r.id}">✏</button>
                  <button class="btn btn--danger btn--sm"  data-action="del-v"  data-id="${r.id}">✕</button>
                </td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : `<p style="color:#7d8590;font-size:13px;margin-bottom:16px">Noch keine Fahrzeuge eingetragen.</p>`;

  const addFormHTML = readonly ? '' : `
    <div id="v-add-form" style="display:none;background:#161b27;border:1px solid #21273d;border-radius:10px;padding:16px;margin-bottom:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="form-group" style="grid-column:1/-1">
          <label style="font-size:12px">Fahrzeug</label>
          ${vehicleOptions.length ? `
            <select id="v-vehicle-select" style="margin-bottom:6px">
              <option value="">— Fahrzeug wählen (optional) —</option>
              ${vehicleOptions.map(v => `<option value="${v.id}" data-name="${esc(v.name)}">${esc(v.name)}</option>`).join('')}
            </select>` : ''}
          <input type="text" id="v-name" placeholder="Fahrzeugname *" />
        </div>
        <div class="form-group">
          <label style="font-size:12px">Kennung / Art</label>
          <input type="text" id="v-callsign" placeholder="z.B. HLF 20" />
        </div>
        <div class="form-group">
          <label style="font-size:12px">Besatzung</label>
          <input type="number" id="v-crew" min="0" placeholder="Anzahl" />
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:10px">
        ${[['v-t-alarm','Status A (Alarm)'],['v-t-dep','Status 3 (Ausrück)'],['v-t-arr','Status 4 (Eintreffen)'],['v-t-ret','Status 1 (Rückkehr)'],['v-t-ready','Status 2 (Einsatzbereit)']].map(([id, lbl]) => `
          <div class="form-group">
            <label style="font-size:11px">${lbl}</label>
            <input type="time" id="${id}" />
          </div>`).join('')}
      </div>
      <div class="form-group" style="margin-bottom:10px;max-width:200px">
        <label style="font-size:12px">km gefahren</label>
        <input type="number" id="v-km" min="0" placeholder="0" />
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn--primary btn--sm" id="v-btn-submit">Hinzufügen</button>
        <button class="btn btn--outline btn--sm" id="v-btn-cancel">Abbrechen</button>
      </div>
    </div>
    <button class="btn btn--primary btn--sm" id="v-btn-add">+ Fahrzeug hinzufügen</button>`;

  wrap.innerHTML = tableHTML + addFormHTML;

  if (readonly) return;

  // Vehicle-Dropdown → Name auto-fill
  const sel = document.getElementById('v-vehicle-select');
  if (sel) {
    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex];
      if (opt.value) document.getElementById('v-name').value = opt.dataset.name || '';
    });
  }

  document.getElementById('v-btn-add')?.addEventListener('click', () => {
    document.getElementById('v-add-form').style.display = 'block';
    document.getElementById('v-btn-add').style.display = 'none';
  });

  document.getElementById('v-btn-cancel')?.addEventListener('click', () => {
    document.getElementById('v-add-form').style.display = 'none';
    document.getElementById('v-btn-add').style.display = '';
  });

  document.getElementById('v-btn-submit')?.addEventListener('click', async () => {
    const name = document.getElementById('v-name')?.value.trim();
    if (!name) { toast('Fahrzeugname eingeben', 'error'); return; }
    const sel = document.getElementById('v-vehicle-select');
    const body = {
      vehicle_id:     sel?.value || null,
      vehicle_name:   name,
      callsign:       document.getElementById('v-callsign')?.value.trim() || null,
      alarm_time:     document.getElementById('v-t-alarm')?.value || null,
      departure_time: document.getElementById('v-t-dep')?.value || null,
      arrival_time:   document.getElementById('v-t-arr')?.value || null,
      return_time:    document.getElementById('v-t-ret')?.value || null,
      ready_time:     document.getElementById('v-t-ready')?.value || null,
      km_driven:      +document.getElementById('v-km')?.value || null,
      crew_count:     +document.getElementById('v-crew')?.value || null,
    };
    try {
      await api.addIncidentVehicle(incidentId, body);
      toast('Fahrzeug hinzugefügt');
      loadVehiclesTab(incidentId, false);
    } catch (e) { toast(e.message, 'error'); }
  });

  // Edit per Row (inline replace mit Update-Request)
  wrap.querySelectorAll('[data-action="edit-v"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = rows.find(r => r.id === btn.dataset.id);
      if (!row) return;
      _openVehicleEditRow(incidentId, row, vehicleOptions);
    });
  });

  wrap.querySelectorAll('[data-action="del-v"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Fahrzeug aus dem Einsatzbericht entfernen?')) return;
      try {
        await api.removeIncidentVehicle(incidentId, btn.dataset.id);
        toast('Fahrzeug entfernt');
        loadVehiclesTab(incidentId, false);
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

function _openVehicleEditRow(incidentId, row, vehicleOptions) {
  const tr = document.querySelector(`tr[data-vid="${row.id}"]`);
  if (!tr) return;
  const fmt = t => t ? t.slice(0, 5) : '';
  tr.innerHTML = `
    <td colspan="${vehicleOptions.length ? 10 : 9}" style="padding:10px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <input type="text"   id="ev-name"    value="${esc(row.vehicle_name)}" placeholder="Fahrzeugname *" />
        <input type="text"   id="ev-sign"    value="${esc(row.callsign || '')}" placeholder="Kennung" />
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:8px">
        <input type="time" id="ev-t-alarm" value="${fmt(row.alarm_time)}" title="Status A" />
        <input type="time" id="ev-t-dep"   value="${fmt(row.departure_time)}" title="Status 3" />
        <input type="time" id="ev-t-arr"   value="${fmt(row.arrival_time)}" title="Status 4" />
        <input type="time" id="ev-t-ret"   value="${fmt(row.return_time)}" title="Status 1" />
        <input type="time" id="ev-t-ready" value="${fmt(row.ready_time)}" title="Status 2" />
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
        <input type="number" id="ev-km"   value="${row.km_driven ?? ''}"  placeholder="km" style="width:80px" />
        <input type="number" id="ev-crew" value="${row.crew_count ?? ''}" placeholder="Bes." style="width:80px" />
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn--primary btn--sm" id="ev-save">Speichern</button>
        <button class="btn btn--outline btn--sm" id="ev-cancel">Abbrechen</button>
      </div>
    </td>`;

  document.getElementById('ev-cancel').addEventListener('click', () => loadVehiclesTab(incidentId, false));
  document.getElementById('ev-save').addEventListener('click', async () => {
    const name = document.getElementById('ev-name')?.value.trim();
    if (!name) { toast('Fahrzeugname eingeben', 'error'); return; }
    const body = {
      vehicle_id:     row.vehicle_id || null,
      vehicle_name:   name,
      callsign:       document.getElementById('ev-sign')?.value.trim() || null,
      alarm_time:     document.getElementById('ev-t-alarm')?.value || null,
      departure_time: document.getElementById('ev-t-dep')?.value || null,
      arrival_time:   document.getElementById('ev-t-arr')?.value || null,
      return_time:    document.getElementById('ev-t-ret')?.value || null,
      ready_time:     document.getElementById('ev-t-ready')?.value || null,
      km_driven:      +document.getElementById('ev-km')?.value || null,
      crew_count:     +document.getElementById('ev-crew')?.value || null,
    };
    try {
      await api.updateIncidentVehicle(incidentId, row.id, body);
      toast('Fahrzeug gespeichert');
      loadVehiclesTab(incidentId, false);
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ── Personal Tab ──────────────────────────────────────────────────────────────

export async function loadPersonnelTab(incidentId, readonly = false) {
  const wrap = document.getElementById('incident-personnel-wrap');
  if (!wrap) return;

  let members = [];
  let incidentPersonnel = [];

  try {
    [incidentPersonnel, members] = await Promise.all([
      api.getIncidentPersonnel(incidentId),
      readonly ? Promise.resolve([]) : api.getPersonalMembers().catch(() => []),
    ]);
  } catch (e) {
    wrap.innerHTML = `<p style="color:#ff8a80;font-size:13px">Fehler: ${esc(e.message)}</p>`;
    return;
  }

  _renderPersonnelTab(wrap, incidentId, incidentPersonnel, members, readonly);
}

function _renderPersonnelTab(wrap, incidentId, rows, memberOptions, readonly) {
  const tableHTML = rows.length ? `
    <div style="overflow-x:auto;margin-bottom:16px">
      <table class="data-table">
        <thead>
          <tr>
            <th>Name</th><th>Dienstgrad / Rolle</th><th>Funktion im Einsatz</th>
            ${!readonly ? '<th></th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="font-weight:500">${esc(r.display_name)}</td>
              <td style="color:#7d8590">${esc(r.role_name || '—')}</td>
              <td>${esc(r.function || '—')}</td>
              ${!readonly ? `
                <td>
                  <button class="btn btn--danger btn--sm" data-action="del-p" data-id="${r.id}">✕</button>
                </td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="font-size:12px;color:#7d8590;margin-bottom:12px">
      ${rows.length} eingesetzte Kraft${rows.length !== 1 ? 'kräfte' : ''}
    </div>` : `<p style="color:#7d8590;font-size:13px;margin-bottom:16px">Noch keine Kräfte eingetragen.</p>`;

  const addFormHTML = readonly ? '' : `
    <div id="p-add-form" style="display:none;background:#161b27;border:1px solid #21273d;border-radius:10px;padding:16px;margin-bottom:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="form-group" style="grid-column:1/-1">
          <label style="font-size:12px">Person aus dem System wählen (optional)</label>
          ${memberOptions.length ? `
            <select id="p-member-select">
              <option value="">— Person wählen —</option>
              ${memberOptions.map(m => `<option value="${m.id}" data-name="${esc(m.display_name || m.username)}" data-role="${esc(m.role_name || '')}">${esc(m.display_name || m.username)}</option>`).join('')}
            </select>` : ''}
        </div>
        <div class="form-group">
          <label style="font-size:12px">Name <span style="color:#e63022">*</span></label>
          <input type="text" id="p-name" placeholder="Vor- und Nachname" />
        </div>
        <div class="form-group">
          <label style="font-size:12px">Dienstgrad / Rolle</label>
          <input type="text" id="p-role" placeholder="z.B. Gruppenführer" />
        </div>
        <div class="form-group" style="grid-column:1/-1">
          <label style="font-size:12px">Funktion im Einsatz</label>
          <input type="text" id="p-function" placeholder="z.B. Angriffstrupp, Maschinist, EL" />
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn--primary btn--sm" id="p-btn-submit">Hinzufügen</button>
        <button class="btn btn--outline btn--sm" id="p-btn-cancel">Abbrechen</button>
      </div>
    </div>
    <button class="btn btn--primary btn--sm" id="p-btn-add">+ Person hinzufügen</button>`;

  wrap.innerHTML = tableHTML + addFormHTML;

  if (readonly) return;

  // Member-Dropdown → Name + Rolle auto-fill
  const sel = document.getElementById('p-member-select');
  if (sel) {
    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex];
      if (opt.value) {
        document.getElementById('p-name').value = opt.dataset.name || '';
        document.getElementById('p-role').value = opt.dataset.role || '';
      }
    });
  }

  document.getElementById('p-btn-add')?.addEventListener('click', () => {
    document.getElementById('p-add-form').style.display = 'block';
    document.getElementById('p-btn-add').style.display = 'none';
  });

  document.getElementById('p-btn-cancel')?.addEventListener('click', () => {
    document.getElementById('p-add-form').style.display = 'none';
    document.getElementById('p-btn-add').style.display = '';
  });

  document.getElementById('p-btn-submit')?.addEventListener('click', async () => {
    const name = document.getElementById('p-name')?.value.trim();
    if (!name) { toast('Name eingeben', 'error'); return; }
    const sel = document.getElementById('p-member-select');
    const body = {
      user_id:      sel?.value || null,
      display_name: name,
      role_name:    document.getElementById('p-role')?.value.trim() || null,
      function:     document.getElementById('p-function')?.value.trim() || null,
    };
    try {
      await api.addIncidentPersonnel(incidentId, body);
      toast('Person hinzugefügt');
      loadPersonnelTab(incidentId, false);
    } catch (e) { toast(e.message, 'error'); }
  });

  wrap.querySelectorAll('[data-action="del-p"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Person aus dem Einsatzbericht entfernen?')) return;
      try {
        await api.removeIncidentPersonnel(incidentId, btn.dataset.id);
        toast('Person entfernt');
        loadPersonnelTab(incidentId, false);
      } catch (e) { toast(e.message, 'error'); }
    });
  });
}

// ── Anhänge Tab (Phase C) ─────────────────────────────────────────────────────

export async function loadAttachmentsTab(incidentId, readonly = false) {
  const wrap = document.getElementById('incident-attachments-wrap');
  if (!wrap) return;

  try {
    const attachments = await api.getIncidentAttachments(incidentId);
    _renderAttachmentsTab(wrap, incidentId, attachments, readonly);
  } catch (e) {
    wrap.innerHTML = `<p style="color:#ff8a80;font-size:13px">Fehler: ${esc(e.message)}</p>`;
  }
}

function _renderAttachmentsTab(wrap, incidentId, attachments, readonly) {
  const fmtSize = bytes => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const fmtDate = iso => new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const listHTML = attachments.length ? `
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
      ${attachments.map(a => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;
                    background:#161b27;border:1px solid #21273d;border-radius:8px">
          <span style="font-size:20px;flex-shrink:0">${_fileIcon(a.mime_type)}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"
                 title="${esc(a.filename)}">${esc(a.filename)}</div>
            <div style="font-size:11px;color:#7d8590">${fmtSize(a.file_size)} · ${fmtDate(a.created_at)}</div>
          </div>
          <button class="btn btn--outline btn--sm" data-action="download"
                  data-id="${a.id}" data-name="${esc(a.filename)}">↓ Download</button>
          ${!readonly ? `<button class="btn btn--danger btn--sm"
                  data-action="delete" data-id="${a.id}">✕</button>` : ''}
        </div>`).join('')}
    </div>` : `<p style="color:#7d8590;font-size:13px;margin-bottom:16px">Keine Anhänge vorhanden.</p>`;

  const uploadHTML = readonly ? '' : `
    <div id="attach-drop-zone"
         style="border:2px dashed #21273d;border-radius:8px;padding:24px;text-align:center;cursor:pointer;
                transition:border-color 0.15s">
      <div style="font-size:28px">📎</div>
      <div style="font-size:13px;color:#7d8590;margin-top:6px">Datei hierher ziehen oder klicken zum Auswählen</div>
      <div style="font-size:11px;color:#7d8590;margin-top:2px">Bilder (JPEG/PNG/GIF/WebP), PDF, Word (docx), ODT, Text — max. 20 MB</div>
      <input type="file" id="attach-file-input" style="display:none"
             accept="image/*,.pdf,.docx,.odt,.txt">
    </div>
    <div id="attach-progress" style="display:none;margin-top:8px;font-size:13px;color:#7d8590;text-align:center">
      Wird hochgeladen...
    </div>
  `;

  wrap.innerHTML = listHTML + uploadHTML;

  // Download
  wrap.querySelectorAll('[data-action="download"]').forEach(btn => {
    btn.addEventListener('click', () =>
      _downloadAttachment(incidentId, btn.dataset.id, btn.dataset.name));
  });

  // Löschen
  wrap.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Anhang wirklich löschen?')) return;
      try {
        await api.deleteIncidentAttachment(incidentId, btn.dataset.id);
        toast('Anhang gelöscht');
        loadAttachmentsTab(incidentId, readonly);
      } catch (e) { toast(e.message, 'error'); }
    });
  });

  // Upload
  if (!readonly) {
    const dropZone  = document.getElementById('attach-drop-zone');
    const fileInput = document.getElementById('attach-file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.style.borderColor = '#e63022';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = '#21273d';
    });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.style.borderColor = '#21273d';
      const file = e.dataTransfer.files[0];
      if (file) _uploadFile(incidentId, file, readonly);
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) _uploadFile(incidentId, file, readonly);
      fileInput.value = '';
    });
  }
}

function _fileIcon(mime) {
  if (mime.startsWith('image/'))    return '🖼️';
  if (mime === 'application/pdf')   return '📄';
  if (mime.includes('word') || mime.includes('officedocument')) return '📝';
  if (mime === 'text/plain')        return '📋';
  return '📎';
}

async function _downloadAttachment(incidentId, attachmentId, filename) {
  try {
    const res = await api.downloadIncidentAttachment(incidentId, attachmentId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename || 'anhang';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    toast('Download fehlgeschlagen', 'error');
  }
}

async function _uploadFile(incidentId, file, readonly) {
  const progress = document.getElementById('attach-progress');
  const dropZone = document.getElementById('attach-drop-zone');
  if (progress) progress.style.display = 'block';
  if (dropZone) dropZone.style.opacity = '0.5';
  try {
    await api.uploadIncidentAttachment(incidentId, file);
    loadAttachmentsTab(incidentId, readonly);
  } catch (e) {
    toast(e.message, 'error');
    if (progress) progress.style.display = 'none';
    if (dropZone) dropZone.style.opacity = '1';
  }
}
