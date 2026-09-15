(() => {
  const key = 'gv-theme';
  const apply = value => {
    const mode = value === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = mode;
    document.body?.classList.toggle('light-mode', mode === 'light');
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(mode === 'light'));
      button.title = mode === 'light' ? 'حالت تاریک' : 'حالت روشن';
      button.textContent = mode === 'light' ? '☾' : '☀';
    });
  };
  const ensureToggle = () => {
    if (document.querySelector('[data-theme-toggle]') || !document.body) return;
    const button = document.createElement('button');
    button.dataset.themeToggle = '';
    button.className = 'global-theme-toggle';
    button.setAttribute('aria-label', 'تغییر ظاهر');
    document.body?.append(button);
  };
  ensureToggle();
  document.addEventListener('DOMContentLoaded', ensureToggle, { once: true });
  apply(localStorage.getItem(key) || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  addEventListener('storage', event => { if (event.key === key) apply(event.newValue); });
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-theme-toggle]')) return;
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem(key, next); apply(next);
    new BroadcastChannel('game-vault-theme').postMessage(next);
  });
  new BroadcastChannel('game-vault-theme').onmessage = event => apply(event.data);
})();
