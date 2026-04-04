import { navigate } from './router.js';

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

function buildDropdownMenu(items) {
  return `<div class="nav-dropdown__menu">
    ${items.map(item => `
      <button class="nav-dropdown__item${isActive(item.page) ? ' active' : ''}" data-page="${item.page}">
        ${item.label}
      </button>`).join('')}
  </div>`;
}

function buildTopnav() {
  const accent = getAccent();

  const lagerItems = [
    { page: 'orders', label: 'Bestellübersicht' },
    ...(canAccess(currentUser, 'lager') || canAccess(currentUser, 'lager.approve') ? [
      { page: 'new-order', label: 'Neue Bestellung' },
      { page: 'articles', label: 'Artikelstamm' },
    ] : []),
  ];

  const personalItems = [
    { page: 'personal', label: 'Mitglieder' },
    { page: 'termine', label: 'Termine' },
  ];

  const fahrzeugeItems = [
    { page: 'vehicles', label: 'Fahrzeugübersicht' },
  ];

  const einsaetzeItems = [
    { page: 'incidents', label: 'Einsatzberichte' },
    ...(canAccess(currentUser, 'einsatzberichte') ? [
      { page: 'new-incident', label: 'Neuer Bericht' },
    ] : []),
  ];

  const vereinItems = [
    { page: 'verein', label: 'Vereinsverwaltung' },
  ];

  return `
    <div class="app-shell" style="--accent: ${accent}">
      <header class="topnav">
        <button class="topnav__brand" data-page="">
          <span class="topnav__flame">🔥</span>
          <span class="topnav__name">${ffName}</span>
        </button>

        <nav class="topnav__links">
          <button class="topnav__link${isActive('') ? ' active' : ''}" data-page="">Startseite</button>
          <button class="topnav__link${isActive('my-area') ? ' active' : ''}" data-page="my-area">Mein Bereich</button>

          ${showModule('lager.read', 'lager') ? `
          <div class="nav-dropdown${isModuleActive('lager') ? ' module-active' : ''}" data-dropdown="lager">
            <button class="topnav__link topnav__link--has-dropdown${isModuleActive('lager') ? ' active' : ''}${openDropdown === 'lager' ? ' open' : ''}">
              Lager <span class="nav-caret">▾</span>
            </button>
            ${openDropdown === 'lager' ? buildDropdownMenu(lagerItems) : ''}
          </div>` : ''}

          ${showModule('personal', 'personal') ? `
          <div class="nav-dropdown${isModuleActive('personal') ? ' module-active' : ''}" data-dropdown="personal">
            <button class="topnav__link topnav__link--has-dropdown${isModuleActive('personal') ? ' active' : ''}${openDropdown === 'personal' ? ' open' : ''}">
              Personal <span class="nav-caret">▾</span>
            </button>
            ${openDropdown === 'personal' ? buildDropdownMenu(personalItems) : ''}
          </div>` : ''}

          ${showModule('fahrzeuge', 'fahrzeuge') ? `
          <div class="nav-dropdown${isModuleActive('fahrzeuge') ? ' module-active' : ''}" data-dropdown="fahrzeuge">
            <button class="topnav__link topnav__link--has-dropdown${isModuleActive('fahrzeuge') ? ' active' : ''}${openDropdown === 'fahrzeuge' ? ' open' : ''}">
              Fahrzeuge <span class="nav-caret">▾</span>
            </button>
            ${openDropdown === 'fahrzeuge' ? buildDropdownMenu(fahrzeugeItems) : ''}
          </div>` : ''}

          ${showModule('einsatzberichte.read', 'einsatzberichte') ? `
          <div class="nav-dropdown${isModuleActive('einsatzberichte') ? ' module-active' : ''}" data-dropdown="einsatzberichte">
            <button class="topnav__link topnav__link--has-dropdown${isModuleActive('einsatzberichte') ? ' active' : ''}${openDropdown === 'einsatzberichte' ? ' open' : ''}">
              Einsätze <span class="nav-caret">▾</span>
            </button>
            ${openDropdown === 'einsatzberichte' ? buildDropdownMenu(einsaetzeItems) : ''}
          </div>` : ''}

          ${showModule('verein', 'verein') ? `
          <div class="nav-dropdown${isModuleActive('verein') ? ' module-active' : ''}" data-dropdown="verein">
            <button class="topnav__link topnav__link--has-dropdown${isModuleActive('verein') ? ' active' : ''}${openDropdown === 'verein' ? ' open' : ''}">
              Verein <span class="nav-caret">▾</span>
            </button>
            ${openDropdown === 'verein' ? buildDropdownMenu(vereinItems) : ''}
          </div>` : ''}

          <button class="topnav__link${isActive('settings') ? ' active' : ''}" data-page="settings">Einstellungen</button>

          ${currentUser?.role === 'admin' || currentUser?.role === 'superuser' ? `
          <button class="topnav__link topnav__link--admin${isActive('admin') ? ' active' : ''}" data-page="admin">Admin</button>` : ''}
        </nav>

        <div class="topnav__user">
          <span class="topnav__username">
            <span class="topnav__user-dot"></span>
            ${currentUser?.username || ''}
          </span>
          <button class="topnav__logout" id="btn-logout">Abmelden</button>
        </div>
      </header>

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
  app.innerHTML = buildTopnav();
  bindEvents(app);
}

function bindEvents(app) {
  // Brand + nav links
  app.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (btn.closest('.nav-dropdown__menu') || !btn.closest('.nav-dropdown')) {
        openDropdown = null;
        navigate(`#/${btn.dataset.page}`);
      }
    });
  });

  // Dropdown toggles
  app.querySelectorAll('.nav-dropdown').forEach(dd => {
    const name = dd.dataset.dropdown;
    const trigger = dd.querySelector('.topnav__link--has-dropdown');
    if (trigger) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        openDropdown = openDropdown === name ? null : name;
        rerender(currentPage);
      });
    }
  });

  // Dropdown item navigation
  app.querySelectorAll('.nav-dropdown__item[data-page]').forEach(btn => {
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

  // Close dropdown on outside click
  window.addEventListener('click', (e) => {
    if (!e.target.closest('.nav-dropdown')) {
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
