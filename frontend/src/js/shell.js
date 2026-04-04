import { navigate } from './router.js';
import { getHeaderLogo } from './logo.js';

let ffName = 'FeuerwehrHub';
let currentUser = null;
let activeModules = {};
let openDropdown = null;
let currentPage = '';

const MODULE_ACCENTS = {
  lager:           '#d97706',
  einsatzberichte: '#e63022',
  personal:        '#16a34a',
  fahrzeuge:       '#2563eb',
  verein:          '#7c3aed',
};

const PAGE_MODULE = {
  orders:          'lager',
  'new-order':     'lager',
  articles:        'lager',
  incidents:       'einsatzberichte',
  'new-incident':  'einsatzberichte',
  'edit-incident': 'einsatzberichte',
  personal:        'personal',
  termine:         'personal',
  vehicles:        'fahrzeuge',
  verein:          'verein',
};

const MODULE_COLORS = {
  lager:           { c: 'var(--lager-c)',    hell: 'var(--lager-hell)' },
  personal:        { c: 'var(--personal-c)', hell: 'var(--personal-hell)' },
  fahrzeuge:       { c: 'var(--fahrzeug-c)', hell: 'var(--fahrzeug-hell)' },
  einsatzberichte: { c: 'var(--einsatz-c)',  hell: 'var(--einsatz-hell)' },
  verein:          { c: 'var(--verein-c)',   hell: 'var(--verein-hell)' },
};

export function setShellInfo(name, user, modules) {
  ffName = name || ffName;
  currentUser = user;
  activeModules = modules || {};
}

export function canAccess(user, permission) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'superuser') return true;
  return (user.permissions || []).includes(permission);
}

function showModule(minPerm, moduleKey) {
  if (!canAccess(currentUser, minPerm)) return false;
  if (currentUser?.role === 'admin' || currentUser?.role === 'superuser') return true;
  const anyEnabled = Object.values(activeModules).some(v => v);
  return !anyEnabled || !!activeModules[moduleKey];
}

function getAccent() {
  return MODULE_ACCENTS[PAGE_MODULE[currentPage]] || '#e63022';
}

function isActive(page) {
  return currentPage === page || (page === '' && (currentPage === '' || currentPage === 'home'));
}

function isModuleActive(mod) {
  return PAGE_MODULE[currentPage] === mod;
}

function ddIcon(icon, module) {
  const col = MODULE_COLORS[module] || { c: 'var(--rot)', hell: 'var(--rot-hell)' };
  return `<span class="topnav__dd-item__icon" style="--item-accent-hell:${col.hell}">${icon}</span>`;
}

function buildNavItem(moduleKey, label, items) {
  const primaryPage = items[0].page;
  const isActive = isModuleActive(moduleKey);
  const extraItems = items.slice(1);

  // No extra items → plain direct link
  if (!extraItems.length) {
    return `<button class="topnav__item${isActive_(primaryPage) ? ' active' : ''}" data-page="${primaryPage}">${label}</button>`;
  }

  // Has extra items → direct link + dropdown arrow for secondary pages
  const col = MODULE_COLORS[moduleKey] || { c: 'var(--rot)', hell: 'var(--rot-hell)' };
  const isOpen = openDropdown === moduleKey;

  return `
    <div class="topnav__dropdown-wrap" data-dropdown="${moduleKey}">
      <button class="topnav__item topnav__item--has-dd${isActive ? ' active' : ''}" data-page="${primaryPage}">
        ${label}<span class="topnav__arrow${isOpen ? ' open' : ''}" data-dd-toggle="${moduleKey}"></span>
      </button>
      <div class="topnav__dropdown${isOpen ? ' open' : ''}">
        <div class="topnav__dropdown-label" style="color:${col.c}">${label}</div>
        ${items.map(item => `
          <button class="topnav__dd-item${isActive_(item.page) ? ' active' : ''}" data-page="${item.page}">
            ${ddIcon(item.icon, moduleKey)}
            ${item.label}
          </button>`).join('')}
      </div>
    </div>`;
}

// Separate active check for dropdown items (exact match only)
function isActive_(page) {
  return currentPage === page;
}

function buildShell() {
  const accent = getAccent();

  const lagerItems = [
    { page: 'orders',     label: 'Bestellübersicht', icon: '📋' },
    ...(canAccess(currentUser, 'lager') || canAccess(currentUser, 'lager.approve') ? [
      { page: 'new-order', label: 'Neue Bestellung',  icon: '➕' },
      { page: 'articles',  label: 'Artikelstamm',     icon: '📦' },
    ] : []),
  ];

  const personalItems = [
    { page: 'personal', label: 'Mitglieder', icon: '👤' },
    { page: 'termine',  label: 'Termine',    icon: '📅' },
  ];

  const fahrzeugeItems = [
    { page: 'vehicles', label: 'Fahrzeugübersicht', icon: '🚒' },
  ];

  const einsaetzeItems = [
    { page: 'incidents', label: 'Einsatzberichte', icon: '📄' },
    ...(canAccess(currentUser, 'einsatzberichte') ? [
      { page: 'new-incident', label: 'Neuer Bericht', icon: '➕' },
    ] : []),
  ];

  const vereinItems = [
    { page: 'verein', label: 'Vereinsverwaltung', icon: '🏛️' },
  ];

  return `
    <div class="app-shell" style="--accent: ${accent}">

      <header class="app-header">
        <button class="app-header__brand" data-page="">
          <div class="app-header__emblem">${getHeaderLogo()}</div>
          <div class="app-header__title">
            <span class="app-header__name">${ffName}</span>
            <span class="app-header__sub">Feuerwehrverwaltung</span>
          </div>
        </button>

        <div class="app-header__right">
          <span class="app-header__user">
            <span class="app-header__user-dot"></span>
            ${currentUser?.username || ''}
          </span>
          <button class="app-header__logout" id="btn-logout">Abmelden</button>
        </div>
      </header>

      <nav class="topnav">
        <button class="topnav__item${isActive('') ? ' active' : ''}" data-page="">Startseite</button>
        <button class="topnav__item${isActive('my-area') ? ' active' : ''}" data-page="my-area">Mein Bereich</button>

        <div class="topnav__sep"></div>

        ${showModule('lager.read', 'lager')           ? buildNavItem('lager',           'Lager',    lagerItems)    : ''}
        ${showModule('personal', 'personal')           ? buildNavItem('personal',        'Personal', personalItems) : ''}
        ${showModule('fahrzeuge', 'fahrzeuge')         ? buildNavItem('fahrzeuge',       'Fahrzeuge',fahrzeugeItems): ''}
        ${showModule('einsatzberichte.read', 'einsatzberichte') ? buildNavItem('einsatzberichte', 'Einsätze', einsaetzeItems) : ''}
        ${showModule('verein', 'verein')               ? buildNavItem('verein',          'Verein',   vereinItems)   : ''}

        <div class="topnav__spacer"></div>

        <button class="topnav__item${isActive('settings') ? ' active' : ''}" data-page="settings">Einstellungen</button>

        ${currentUser?.role === 'admin' || currentUser?.role === 'superuser' ? `
        <button class="topnav__item topnav__item--admin${isActive('admin') ? ' active' : ''}" data-page="admin">Admin</button>` : ''}
      </nav>

      <main class="page-main" id="main-content">
        <div id="page-content"></div>
      </main>
    </div>
    <div id="toast-container"></div>
  `;
}

function rerender(activePage) {
  currentPage = activePage || '';
  const app = document.getElementById('app');
  app.innerHTML = buildShell();
  bindEvents(app);
}

function bindEvents(app) {
  // Brand-Button
  const brand = app.querySelector('.app-header__brand');
  if (brand) {
    brand.addEventListener('click', () => {
      openDropdown = null;
      navigate('#/');
    });
  }

  // Direkte Nav-Links (ohne Dropdown)
  app.querySelectorAll('.topnav__item[data-page]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Klick auf den Pfeil → Dropdown togglen, nicht navigieren
      if (e.target.closest('.topnav__arrow')) return;
      openDropdown = null;
      navigate(`#/${btn.dataset.page}`);
    });
  });

  // Dropdown-Arrow Toggles
  app.querySelectorAll('.topnav__arrow[data-dd-toggle]').forEach(arrow => {
    arrow.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = arrow.dataset.ddToggle;
      openDropdown = openDropdown === name ? null : name;
      rerender(currentPage);
    });
  });

  // Dropdown-Items
  app.querySelectorAll('.topnav__dd-item[data-page]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openDropdown = null;
      navigate(`#/${btn.dataset.page}`);
    });
  });

  // Logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('ff_token');
      navigate('#/login');
    });
  }

  // Dropdown schließen bei Klick außerhalb
  window.addEventListener('click', (e) => {
    if (!e.target.closest('.topnav__dropdown-wrap')) {
      if (openDropdown !== null) {
        openDropdown = null;
        rerender(currentPage);
      }
    }
  }, { once: true });
}

export function renderShell(activePage) {
  openDropdown = null;
  rerender(activePage);
}
