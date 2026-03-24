// ── Logo-Manager ──────────────────────────────────────────────────────────────
// Verwaltet das Wappen/Logo der Feuerwehr (localStorage-basiert).
// Standard: Flammen-SVG (identisch zur Landing Page).

const LS_KEY = 'ff_custom_logo';

const FLAME_PATH = `M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z`;

/**
 * Gibt das Logo-HTML für den Header-Emblem-Bereich zurück.
 * Bei eigenem Wappen: <img>-Tag, sonst: Flammen-SVG in Rot.
 */
export function getHeaderLogo() {
  const custom = localStorage.getItem(LS_KEY);
  if (custom) {
    return `<img src="${custom}" alt="Wappen" style="width:28px;height:28px;object-fit:contain;">`;
  }
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="#e63022" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="${FLAME_PATH}"/>
  </svg>`;
}

/**
 * Gibt das Logo-HTML für die Login-Seite (Auth-Emblem) zurück.
 * Bei eigenem Wappen: <img>-Tag, sonst: Flammen-SVG in Weiß.
 */
export function getLoginLogo() {
  const custom = localStorage.getItem(LS_KEY);
  if (custom) {
    return `<img src="${custom}" alt="Wappen" style="width:40px;height:40px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">`;
  }
  return `<svg width="36" height="36" viewBox="0 0 24 24" fill="none"
    stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="${FLAME_PATH}"/>
  </svg>`;
}

/** Speichert ein Base64-Bild als Custom-Logo. */
export function saveCustomLogo(base64) {
  localStorage.setItem(LS_KEY, base64);
}

/** Entfernt das Custom-Logo (Flammen-Standard wird wieder aktiv). */
export function removeCustomLogo() {
  localStorage.removeItem(LS_KEY);
}

/** Gibt true zurück, wenn ein Custom-Logo gesetzt ist. */
export function hasCustomLogo() {
  return !!localStorage.getItem(LS_KEY);
}
