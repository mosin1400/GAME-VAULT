(() => {
  const key = 'gv-theia-theme-mode';
  const button = document.querySelector('#gv-theia-theme-toggle');
  const modeFor = family => {
    const remembered = localStorage.getItem(`gv-theia-theme-mode-${family}`);
    return remembered?.endsWith(`-${family}`) ? remembered : `modern-${family}`;
  };
  const apply = value => {
    const mode = value?.endsWith('-light') || value?.endsWith('-dark') ? value : modeFor(value === 'light' ? 'light' : 'dark');
    const light = mode.endsWith('-light');
    document.documentElement.dataset.gvTheme = light ? 'light' : 'dark';
    button.textContent = light ? '☾' : '☀';
    button.title = light ? 'حالت تاریک' : 'حالت روشن';
    button.setAttribute('aria-pressed', String(light));
    window.dispatchEvent(new CustomEvent('gv-theme-change', { detail: mode }));
  };
  apply(localStorage.getItem(key) || 'modern-dark');
  button.addEventListener('click', () => {
    const next = document.documentElement.dataset.gvTheme === 'light' ? 'dark' : 'light';
    const mode = modeFor(next);
    localStorage.setItem(key, mode); apply(mode);
  });
})();
