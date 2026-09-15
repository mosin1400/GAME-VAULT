const { ContainerModule } = require('@theia/core/shared/inversify');
const { FrontendApplicationContribution } = require('@theia/core/lib/browser/frontend-application-contribution');
const { PreferenceService } = require('@theia/core/lib/common/preferences/preference-service');
const { PreferenceScope } = require('@theia/core/lib/common/preferences/preference-scope');

const modes = {
  'main-dark': 'Dark+ (default dark)',
  'main-light': 'Light+ (default light)',
  'modern-dark': 'Dark Modern',
  'modern-light': 'Light Modern'
};

const familyKey = family => `gv-theia-theme-mode-${family}`;
const isFamily = (mode, family) => modes[mode] && mode.endsWith(`-${family}`);
const rememberedMode = family => {
  const remembered = localStorage.getItem(familyKey(family));
  return isFamily(remembered, family) ? remembered : `modern-${family}`;
};
const resolveMode = value => {
  if (modes[value]) return value;
  if (value === 'light' || value === 'dark') return rememberedMode(value);
  const remembered = localStorage.getItem('gv-theia-theme-mode');
  return modes[remembered] ? remembered : rememberedMode('dark');
};

const themeModule = new ContainerModule(bind => {
  bind(FrontendApplicationContribution).toDynamicValue(context => {
    const preferences = context.container.get(PreferenceService);
    const apply = mode => {
      const selected = resolveMode(mode);
      const family = selected.endsWith('light') ? 'light' : 'dark';
      localStorage.setItem('gv-theia-theme-mode', selected);
      localStorage.setItem(familyKey(family), selected);
      document.documentElement.dataset.gvThemeStyle = selected.startsWith('modern') ? 'modern' : 'main';
      document.documentElement.dataset.gvThemeLight = selected.endsWith('light') ? 'true' : 'false';
      return preferences.set('workbench.colorTheme', modes[selected], PreferenceScope.User).catch(console.error);
    };
    return {
      onStart: () => {
        const launchTheme = new URLSearchParams(window.location.search).get('gvTheme');
        apply(launchTheme || localStorage.getItem('gv-theia-theme-mode') || 'modern-dark');
        window.addEventListener('gv-theme-change', event => apply(event.detail));
      }
    };
  }).inSingletonScope();
});

module.exports.default = themeModule;
