export function toast(msg, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const el = document.createElement('div');
  el.className = `toast${type !== 'success' ? ` toast--${type}` : ''}`;
  el.textContent = msg;
  container.appendChild(el);

  setTimeout(() => el.remove(), 3500);
}
