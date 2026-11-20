// Shared UI behavior only. Does not touch rentals, invoices, inventory or Firebase.
(() => {
  const boot = () => {
    const settings = document.querySelector('.mt-app-header .mt-settings');
    if (!settings) return;
    document.addEventListener('pointerdown', (event) => {
      if (settings.open && !settings.contains(event.target)) settings.open = false;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && settings.open) {
        settings.open = false;
        settings.querySelector('summary')?.focus();
      }
    });
    const setPressed = () => {
      const locale = document.documentElement.lang === 'si' ? 'si' : 'en';
      for (const key of ['en', 'si']) {
        const btn = document.getElementById(key === 'en' ? 'langEn' : 'langSi');
        if (btn) btn.setAttribute('aria-pressed', String(locale === key));
      }
    };
    setPressed();
    const observer = new MutationObserver(setPressed);
    observer.observe(document.documentElement, {attributes:true,attributeFilter:['lang']});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
