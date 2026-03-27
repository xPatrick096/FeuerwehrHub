/**
 * HTML-escaping für sichere innerHTML-Ausgabe.
 * Escaped &, <, >, " und ' um XSS in Text-Content und Attributen zu verhindern.
 */
export function esc(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
