import { api } from './api.js';
import { canAccess } from '../lib/permissions.js';

const routes = {};
const routePermissions = {};

export function registerRoute(hash, fn, requiredPermission) {
  routes[hash] = fn;
  if (requiredPermission) routePermissions[hash] = requiredPermission;
}

export function navigate(hash) {
  window.location.hash = hash;
}

export function initRouter() {
  async function handle() {
    const hash = window.location.hash || '#/login';

    // Auth-Guard
    const token = localStorage.getItem('ff_token');
    if (!token && hash !== '#/login' && hash !== '#/setup') {
      window.location.hash = '#/login';
      return;
    }

    const handler = routes[hash] || routes['*'];
    if (handler) {
      const requiredPerm = routePermissions[hash];
      if (requiredPerm) {
        const user = await api.me().catch(() => null);
        if (!canAccess(user, requiredPerm)) {
          window.location.hash = '#/';
          return;
        }
      }

      handler().catch(err => console.error('[router] Fehler auf', hash, err));
    }
  }

  window.addEventListener('hashchange', handle);
  handle();
}
