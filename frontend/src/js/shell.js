import { navigate } from './router.js';
import { getHeaderLogo } from './logo.js';
import { icon, renderIcons } from './icons.js';

let ffName = 'FeuerwehrHub';
let currentUser = null;
let activeModules = {};

export function setShellInfo(name, user, modules) {
  ffName = name || ffName;
  currentUser = user;
  activeModules = modules || {};
}

function canAccess(user, module) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'superuser') return true;
  return (user.permissions || []).includes(module);
}

export { canAccess };

export function renderShell(activePage) {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="app-shell">
      <header class="header">
        <div class="header__emblem">${getHeaderLogo()}</div>
        <div class="header__title">
          <h1>${ffName}</h1>
          <p>FeuerwehrHub</p>
        </div>
        <div class="header__right">
          <span class="header__user">${icon('user', 14)} ${currentUser?.username || ''}</span>
          <button class="header__logout" id="btn-logout">Abmelden</button>
        </div>
      </header>
      <div class="body-layout">
        <nav class="sidebar">
          <div class="sidebar__nav" style="flex:1">
            <button class="sidebar__item${activePage === 'home' ? ' active' : ''}" data-page="">
              <span class="sidebar__item__icon">${icon('house', 16)}</span> Startseite
            </button>
            <button class="sidebar__item${activePage === 'my-area' ? ' active' : ''}" data-page="my-area">
              <span class="sidebar__item__icon">${icon('user', 16)}</span> Mein Bereich
            </button>
            <div class="sidebar__divider"></div>
            ${canAccess(currentUser, 'lager') && activeModules['lager'] ? `
            <div class="sidebar__module">${icon('package', 14)} Lager</div>
            <button class="sidebar__item${activePage === 'orders' ? ' active' : ''}" data-page="orders">
              <span class="sidebar__item__icon">${icon('clipboard-list', 16)}</span> Bestellübersicht
            </button>
            <button class="sidebar__item${activePage === 'new-order' ? ' active' : ''}" data-page="new-order">
              <span class="sidebar__item__icon">${icon('plus', 16)}</span> Neue Bestellung
            </button>
            <button class="sidebar__item${activePage === 'articles' ? ' active' : ''}" data-page="articles">
              <span class="sidebar__item__icon">${icon('box', 16)}</span> Artikelstamm
            </button>
            <div class="sidebar__divider"></div>` : ''}

            ${canAccess(currentUser, 'personal') && activeModules['personal'] ? `
            <div class="sidebar__module">${icon('users', 14)} Personal</div>
            <button class="sidebar__item${activePage === 'personal' ? ' active' : ''}" data-page="personal">
              <span class="sidebar__item__icon">${icon('user', 16)}</span> Mitglieder
            </button>
            <button class="sidebar__item${activePage === 'termine' ? ' active' : ''}" data-page="termine">
              <span class="sidebar__item__icon">${icon('calendar', 16)}</span> Termine
            </button>
            <div class="sidebar__divider"></div>` : ''}

            ${canAccess(currentUser, 'fahrzeuge') && activeModules['fahrzeuge'] ? `
            <div class="sidebar__module">${icon('truck', 14)} Fahrzeuge</div>
            <button class="sidebar__item${activePage === 'vehicles' ? ' active' : ''}" data-page="vehicles">
              <span class="sidebar__item__icon">${icon('car', 16)}</span> Fahrzeugübersicht
            </button>
            <div class="sidebar__divider"></div>` : ''}

            ${canAccess(currentUser, 'einsatzberichte') && activeModules['einsatzberichte'] ? `
            <div class="sidebar__module">${icon('siren', 14)} Einsätze</div>
            <button class="sidebar__item${activePage === 'incidents' ? ' active' : ''}" data-page="incidents">
              <span class="sidebar__item__icon">${icon('file-text', 16)}</span> Einsatzberichte
            </button>
            <div class="sidebar__divider"></div>` : ''}

            <button class="sidebar__item${activePage === 'settings' ? ' active' : ''}" data-page="settings">
              <span class="sidebar__item__icon">${icon('settings', 16)}</span> Einstellungen
            </button>
            ${currentUser?.role === 'admin' || currentUser?.role === 'superuser' ? `
            <button class="sidebar__item${activePage === 'admin' ? ' active' : ''}" data-page="admin">
              <span class="sidebar__item__icon">${icon('shield', 16)}</span> Admin Panel
            </button>` : ''}
          </div>
          <div class="sidebar__copyright">© 2026 Patrick Faust</div>
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

  renderIcons(app);
}
