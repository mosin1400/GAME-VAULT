(() => {
  const button = document.querySelector('#gv-theia-theme-toggle');
  const choices = [['modern-light', 'Modern Light'], ['modern-dark', 'Modern Dark'], ['main-light', 'Main Light'], ['main-dark', 'Main Dark']];
  const menu = document.createElement('div');
  menu.id = 'gv-theme-menu'; menu.hidden = true; menu.setAttribute('role', 'menu');
  const apply = mode => {
    localStorage.setItem('gv-theia-theme-mode', mode);
    window.dispatchEvent(new CustomEvent('gv-theme-change', { detail: mode }));
    menu.hidden = true; button.setAttribute('aria-expanded', 'false');
  };
  for (const [mode, label] of choices) {
    const item = document.createElement('button');
    item.type = 'button'; item.textContent = label; item.dataset.mode = mode;
    item.setAttribute('role', 'menuitemradio'); item.onclick = () => apply(mode);
    menu.appendChild(item);
  }
  document.body.appendChild(menu);
  button.textContent = '◐ Themes'; button.title = 'Choose Studio color theme';
  button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-expanded', 'false');
  button.onclick = () => { menu.hidden = !menu.hidden; button.setAttribute('aria-expanded', String(!menu.hidden)); };
  document.addEventListener('click', event => {
    if (!menu.contains(event.target) && !button.contains(event.target)) { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') menu.hidden = true; });
  window.addEventListener('gv-theme-applied', event => {
    for (const item of menu.children) item.setAttribute('aria-checked', String(item.dataset.mode === event.detail));
  });
})();
