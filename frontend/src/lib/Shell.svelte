<script>
  import { userStore, modulesStore, ffNameStore } from './stores/user.js';
  import { currentPageStore } from './stores/route.js';
  import { canAccess } from './permissions.js';
  import { navigate } from '../js/router.js';

  // Modul-Akzentfarben (abgestimmt auf design-preview.html)
  const MODULE_ACCENTS = {
    lager:           '#d97706',
    einsatzberichte: '#e63022',
    personal:        '#16a34a',
    fahrzeuge:       '#2563eb',
    verein:          '#7c3aed',
  };

  // Welche Seite gehört zu welchem Modul?
  const PAGE_MODULE = {
    orders:         'lager',
    'new-order':    'lager',
    articles:       'lager',
    incidents:      'einsatzberichte',
    'new-incident': 'einsatzberichte',
    'edit-incident':'einsatzberichte',
    personal:       'personal',
    termine:        'personal',
    vehicles:       'fahrzeuge',
    verein:         'verein',
  };

  let openDropdown = null;

  $: accent = MODULE_ACCENTS[PAGE_MODULE[$currentPageStore]] || '#e63022';
  $: user    = $userStore;
  $: modules = $modulesStore;
  $: ffName  = $ffNameStore;

  function go(page) {
    openDropdown = null;
    navigate(`#/${page}`);
  }

  function toggleDropdown(name) {
    openDropdown = openDropdown === name ? null : name;
  }

  function handleWindowClick(e) {
    if (!e.target.closest('.nav-dropdown')) {
      openDropdown = null;
    }
  }

  function logout() {
    userStore.set(null);
    localStorage.removeItem('ff_token');
    navigate('#/login');
  }

  $: isActive = (page) => $currentPageStore === page;
  $: isModuleActive = (mod) => PAGE_MODULE[$currentPageStore] === mod;

  // Zeigt Nav-Item wenn User die Permission hat.
  // Fallback: wenn noch kein Modul konfiguriert wurde (alle false), werden alle
  // freigeschalteten Module angezeigt — damit das System direkt nach der
  // Einrichtung funktioniert ohne erst ins Admin-Panel gehen zu müssen.
  $: anyModuleEnabled = Object.values(modules).some(v => v);
  function showModule(minPerm, moduleKey) {
    if (!canAccess(user, minPerm)) return false;
    // Admins sehen immer alle Module (auch wenn im Admin-Panel deaktiviert)
    if (user?.role === 'admin' || user?.role === 'superuser') return true;
    return !anyModuleEnabled || !!modules[moduleKey];
  }
</script>

<svelte:window on:click={handleWindowClick} />

<div class="app-shell" style="--accent: {accent}">
  {#if user}
  <header class="topnav">
    <!-- Brand -->
    <button class="topnav__brand" on:click={() => go('')}>
      <span class="topnav__flame">🔥</span>
      <span class="topnav__name">{ffName}</span>
    </button>

    <!-- Navigation Links -->
    <nav class="topnav__links">
      <button
        class="topnav__link"
        class:active={isActive('') || isActive('home')}
        on:click={() => go('')}
      >Startseite</button>

      <button
        class="topnav__link"
        class:active={isActive('my-area')}
        on:click={() => go('my-area')}
      >Mein Bereich</button>

      <!-- Lager -->
      {#if showModule('lager.read', 'lager')}
      <div class="nav-dropdown" class:active={isModuleActive('lager')}>
        <button
          class="topnav__link topnav__link--has-dropdown"
          class:active={isModuleActive('lager')}
          on:click={() => toggleDropdown('lager')}
        >
          Lager <span class="nav-caret">▾</span>
        </button>
        {#if openDropdown === 'lager'}
        <div class="nav-dropdown__menu" style="--accent: {MODULE_ACCENTS.lager}">
          <button class="nav-dropdown__item" class:active={isActive('orders')} on:click={() => go('orders')}>
            Bestellübersicht
          </button>
          {#if canAccess(user, 'lager')}
          <button class="nav-dropdown__item" class:active={isActive('new-order')} on:click={() => go('new-order')}>
            Neue Bestellung
          </button>
          <button class="nav-dropdown__item" class:active={isActive('articles')} on:click={() => go('articles')}>
            Artikelstamm
          </button>
          {/if}
        </div>
        {/if}
      </div>
      {/if}

      <!-- Personal -->
      {#if showModule('personal', 'personal')}
      <div class="nav-dropdown" class:active={isModuleActive('personal')}>
        <button
          class="topnav__link topnav__link--has-dropdown"
          class:active={isModuleActive('personal')}
          on:click={() => toggleDropdown('personal')}
        >
          Personal <span class="nav-caret">▾</span>
        </button>
        {#if openDropdown === 'personal'}
        <div class="nav-dropdown__menu" style="--accent: {MODULE_ACCENTS.personal}">
          <button class="nav-dropdown__item" class:active={isActive('personal')} on:click={() => go('personal')}>
            Mitglieder
          </button>
          <button class="nav-dropdown__item" class:active={isActive('termine')} on:click={() => go('termine')}>
            Termine
          </button>
        </div>
        {/if}
      </div>
      {/if}

      <!-- Fahrzeuge -->
      {#if showModule('fahrzeuge', 'fahrzeuge')}
      <div class="nav-dropdown" class:active={isModuleActive('fahrzeuge')}>
        <button
          class="topnav__link topnav__link--has-dropdown"
          class:active={isModuleActive('fahrzeuge')}
          on:click={() => toggleDropdown('fahrzeuge')}
        >
          Fahrzeuge <span class="nav-caret">▾</span>
        </button>
        {#if openDropdown === 'fahrzeuge'}
        <div class="nav-dropdown__menu" style="--accent: {MODULE_ACCENTS.fahrzeuge}">
          <button class="nav-dropdown__item" class:active={isActive('vehicles')} on:click={() => go('vehicles')}>
            Fahrzeugübersicht
          </button>
        </div>
        {/if}
      </div>
      {/if}

      <!-- Einsätze -->
      {#if showModule('einsatzberichte.read', 'einsatzberichte')}
      <div class="nav-dropdown" class:active={isModuleActive('einsatzberichte')}>
        <button
          class="topnav__link topnav__link--has-dropdown"
          class:active={isModuleActive('einsatzberichte')}
          on:click={() => toggleDropdown('einsatzberichte')}
        >
          Einsätze <span class="nav-caret">▾</span>
        </button>
        {#if openDropdown === 'einsatzberichte'}
        <div class="nav-dropdown__menu" style="--accent: {MODULE_ACCENTS.einsatzberichte}">
          <button class="nav-dropdown__item" class:active={isActive('incidents')} on:click={() => go('incidents')}>
            Einsatzberichte
          </button>
          {#if canAccess(user, 'einsatzberichte')}
          <button class="nav-dropdown__item" class:active={isActive('new-incident')} on:click={() => go('new-incident')}>
            Neuer Bericht
          </button>
          {/if}
        </div>
        {/if}
      </div>
      {/if}

      <!-- Verein -->
      {#if showModule('verein', 'verein')}
      <div class="nav-dropdown" class:active={isModuleActive('verein')}>
        <button
          class="topnav__link topnav__link--has-dropdown"
          class:active={isModuleActive('verein')}
          on:click={() => toggleDropdown('verein')}
        >
          Verein <span class="nav-caret">▾</span>
        </button>
        {#if openDropdown === 'verein'}
        <div class="nav-dropdown__menu" style="--accent: {MODULE_ACCENTS.verein}">
          <button class="nav-dropdown__item" class:active={isActive('verein')} on:click={() => go('verein')}>
            Vereinsverwaltung
          </button>
        </div>
        {/if}
      </div>
      {/if}

      <button
        class="topnav__link"
        class:active={isActive('settings')}
        on:click={() => go('settings')}
      >Einstellungen</button>

      {#if user?.role === 'admin' || user?.role === 'superuser'}
      <button
        class="topnav__link topnav__link--admin"
        class:active={isActive('admin')}
        on:click={() => go('admin')}
      >Admin</button>
      {/if}
    </nav>

    <!-- User-Bereich -->
    <div class="topnav__user">
      <span class="topnav__username">
        <span class="topnav__user-dot"></span>
        {user?.username || ''}
      </span>
      <button class="topnav__logout" on:click={logout}>Abmelden</button>
    </div>
  </header>
  {/if}

  <main class="page-main" class:has-nav={!!user}>
    <div id="page-content"></div>
  </main>

  <div id="toast-container"></div>
</div>

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }
  :global(body) {
    margin: 0;
    background: #f4f5f7;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Top Navigation ─────────────────────────────────────────────────── */
  .topnav {
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 52px;
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0 16px;
    z-index: 100;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .topnav__brand {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 12px 6px 0;
    margin-right: 8px;
    border-right: 1px solid #e2e8f0;
    text-decoration: none;
    white-space: nowrap;
  }

  .topnav__flame {
    font-size: 18px;
    line-height: 1;
  }

  .topnav__name {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
  }

  .topnav__links {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .topnav__links::-webkit-scrollbar { display: none; }

  .topnav__link {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #475569;
    white-space: nowrap;
    transition: background 0.12s, color 0.12s;
    position: relative;
  }

  .topnav__link:hover {
    background: #f1f5f9;
    color: #1e293b;
  }

  .topnav__link.active {
    color: var(--accent, #e63022);
    background: color-mix(in srgb, var(--accent, #e63022) 8%, transparent);
  }

  .topnav__link--admin {
    color: #7c3aed;
  }

  .topnav__link--has-dropdown {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .nav-caret {
    font-size: 10px;
    opacity: 0.7;
  }

  /* ── Dropdowns ──────────────────────────────────────────────────────── */
  .nav-dropdown {
    position: relative;
  }

  .nav-dropdown__menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.10);
    min-width: 180px;
    padding: 4px;
    z-index: 200;
    border-top: 3px solid var(--accent, #e63022);
  }

  .nav-dropdown__item {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 5px;
    font-size: 13px;
    color: #374151;
    transition: background 0.1s, color 0.1s;
  }

  .nav-dropdown__item:hover {
    background: #f8fafc;
    color: #1e293b;
  }

  .nav-dropdown__item.active {
    background: color-mix(in srgb, var(--accent, #e63022) 10%, transparent);
    color: var(--accent, #e63022);
    font-weight: 500;
  }

  /* ── User-Bereich ───────────────────────────────────────────────────── */
  .topnav__user {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
    margin-left: 8px;
    padding-left: 12px;
    border-left: 1px solid #e2e8f0;
  }

  .topnav__username {
    font-size: 12px;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
  }

  .topnav__user-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #22c55e;
    flex-shrink: 0;
  }

  .topnav__logout {
    background: none;
    border: 1px solid #e2e8f0;
    cursor: pointer;
    padding: 4px 10px;
    border-radius: 5px;
    font-size: 12px;
    color: #64748b;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
    white-space: nowrap;
  }

  .topnav__logout:hover {
    background: #fee2e2;
    color: #dc2626;
    border-color: #fca5a5;
  }

  /* ── Seiteninhalt ───────────────────────────────────────────────────── */
  .page-main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .page-main.has-nav {
    padding-top: 52px;
  }

  #page-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
</style>
