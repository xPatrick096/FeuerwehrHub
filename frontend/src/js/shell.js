import { userStore, modulesStore, ffNameStore } from '../lib/stores/user.js';
import { currentPageStore } from '../lib/stores/route.js';
import { canAccess } from '../lib/permissions.js';

export { canAccess };

/**
 * Setzt Shell-Informationen (User, Module, Name) in die Svelte-Stores.
 * Shell.svelte reagiert reaktiv darauf und zeigt/aktualisiert die Navigation.
 */
export function setShellInfo(name, user, modules) {
  ffNameStore.set(name || 'FeuerwehrHub');
  userStore.set(user || null);
  modulesStore.set(modules || {});
}

/**
 * Setzt die aktive Seite und leert den Seiteninhalt.
 * Wird von jeder Seite aufgerufen bevor sie ihren Inhalt in #page-content schreibt.
 */
export function renderShell(activePage) {
  currentPageStore.set(activePage || '');

  const content = document.getElementById('page-content');
  if (content) content.innerHTML = '';
}
