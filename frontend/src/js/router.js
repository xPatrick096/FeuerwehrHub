const routes = {};
let currentPage = null;

export function registerRoute(hash, fn) {
  routes[hash] = fn;
}

export function navigate(hash) {
  window.location.hash = hash;
}

export function initRouter() {
  function handle() {
    const hash = window.location.hash || '#/login';

    // Auth-Guard
    const token = localStorage.getItem('ff_token');
    if (!token && hash !== '#/login' && hash !== '#/setup') {
      window.location.hash = '#/login';
      return;
    }

    const handler = routes[hash] || routes['*'];
    if (handler) {
      if (currentPage) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.sidebar__item').forEach(b => b.classList.remove('active'));
      }
      currentPage = hash;
      handler();
    }
  }

  window.addEventListener('hashchange', handle);
  handle();
}
