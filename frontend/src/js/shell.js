import { navigate } from './router.js';

let ffName = 'FeuerwehrHub';
let currentUser = null;

export function setShellInfo(name, user) {
  ffName = name || ffName;
  currentUser = user;
}

export function renderShell(activePage) {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="app-shell">
      <header class="header">
        <div class="header__emblem">🚒</div>
        <div class="header__title">
          <h1>${ffName}</h1>
          <p>FeuerwehrHub</p>
        </div>
        <div class="header__right">
          <span class="header__user">👤 ${currentUser?.username || ''}</span>
          <button class="header__logout" id="btn-logout">Abmelden</button>
        </div>
      </header>
      <div class="body-layout">
        <nav class="sidebar">
          <div class="sidebar__nav">
            <div class="sidebar__module">🏪 Lager</div>
            <button class="sidebar__item${activePage === 'orders' ? ' active' : ''}" data-page="orders">
              <span class="sidebar__item__icon">📋</span> Bestellübersicht
            </button>
            <button class="sidebar__item${activePage === 'new-order' ? ' active' : ''}" data-page="new-order">
              <span class="sidebar__item__icon">➕</span> Neue Bestellung
            </button>
            <button class="sidebar__item${activePage === 'articles' ? ' active' : ''}" data-page="articles">
              <span class="sidebar__item__icon">📦</span> Artikelstamm
            </button>
            <div class="sidebar__divider"></div>
            <button class="sidebar__item${activePage === 'settings' ? ' active' : ''}" data-page="settings">
              <span class="sidebar__item__icon">⚙️</span> Einstellungen
            </button>
            ${currentUser?.role === 'admin' || currentUser?.role === 'superuser' ? `
            <button class="sidebar__item${activePage === 'admin' ? ' active' : ''}" data-page="admin">
              <span class="sidebar__item__icon">🛡️</span> Admin Panel
            </button>` : ''}
          </div>
        </nav>
        <main class="main-content" id="main-content">
          <div id="page-content"></div>
        </main>
      </div>
    </div>
    <div id="toast-container"></div>
  `;

  document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('ff_token');
    navigate('#/login');
  });

  document.querySelectorAll('.sidebar__item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(`#/${btn.dataset.page}`);
    });
  });
}
