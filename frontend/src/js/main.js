import { initRouter, registerRoute } from './router.js';
import { renderLogin } from './pages/login.js';
import { renderSetup } from './pages/setup.js';
import { renderOrders } from './pages/orders.js';
import { renderNewOrder } from './pages/new-order.js';
import { renderArticles } from './pages/articles.js';
import { renderSettings } from './pages/settings.js';
import { renderAdmin } from './pages/admin.js';

// Routen registrieren
registerRoute('#/login',     renderLogin);
registerRoute('#/setup',     renderSetup);
registerRoute('#/orders',    renderOrders,    'lager');
registerRoute('#/new-order', renderNewOrder,  'lager');
registerRoute('#/articles',  renderArticles,  'lager');
registerRoute('#/settings',  renderSettings);
registerRoute('#/admin',     renderAdmin);

// Fallback
registerRoute('*', renderLogin);

// App starten
initRouter();
