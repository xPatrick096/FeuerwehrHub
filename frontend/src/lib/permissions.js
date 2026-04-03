// Zentrale Permission-Auflösung.
// Höhere Permissions implizieren automatisch niedrigere — kein manuelles Aufzählen mehr.
const HIERARCHY = {
  'lager.approve': ['lager.approve', 'lager', 'lager.read'],
  'lager':         ['lager', 'lager.read'],
  'lager.read':    ['lager.read'],
  'einsatzberichte.approve': ['einsatzberichte.approve', 'einsatzberichte', 'einsatzberichte.read'],
  'einsatzberichte':         ['einsatzberichte', 'einsatzberichte.read'],
  'einsatzberichte.read':    ['einsatzberichte.read'],
};

/**
 * Löst rohe Permissions eines Users nach oben hin auf.
 * Wer 'lager.approve' hat, bekommt automatisch 'lager' und 'lager.read'.
 */
export function resolvePermissions(rawPerms = []) {
  const resolved = new Set();
  for (const p of rawPerms) {
    const implied = HIERARCHY[p] || [p];
    implied.forEach(i => resolved.add(i));
  }
  return resolved;
}

/**
 * Prüft ob ein User Zugriff auf eine Permission (oder eine von mehreren) hat.
 * @param {object} user  — User-Objekt mit .role und .permissions[]
 * @param {string|string[]} permission  — eine oder mehrere Permissions (OR-Verknüpfung)
 */
export function canAccess(user, permission) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'superuser') return true;
  const resolved = resolvePermissions(user.permissions || []);
  const perms = Array.isArray(permission) ? permission : [permission];
  return perms.some(p => resolved.has(p));
}
