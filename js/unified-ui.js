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


// Accessible mobile-only navigation, appended without changing page/business handlers.
(() => {
  const bootMobileNav = () => {
    if (!document.querySelector('.mt-app-header[data-mt-shared-header]')) return;
    if (document.getElementById('mtMobileBottomNav')) return;
    const active = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const nav = document.createElement('nav');
    nav.id = 'mtMobileBottomNav';
    nav.className = 'mt-mobile-bottom-nav';
    nav.setAttribute('aria-label', 'Mobile main navigation');
    const paths = [
      {path:'index.html',label:'Rentals',translation:'navRentals',icon:'calendar'},
      {path:'billing.html',label:'Billing',translation:'navBilling',icon:'receipt'},
      {path:'shoe.html',label:'Shoes',translation:'navShoes',icon:'shoe'},
    ];
    const icons = {
      calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
      receipt:'<path d="M5 3h14v18l-3-2-3 2-3-2-3 2-2-2V3z"/><path d="M8 8h8M8 12h8"/>',
      shoe:'<path d="M3 15c3 0 5-1 6-6l4 3c2 2 5 3 8 3v4H3v-4z"/><path d="M11 12l2-2M14 14l2-2"/>',
    };
    paths.forEach(({path,label,translation,icon}) => {
      const a = document.createElement('a');
      a.href = path;
      if (active === path || (active === '' && path === 'index.html')) a.setAttribute('aria-current','page');
      a.setAttribute('aria-label', label);
      const graphic = document.createElement('span');
      graphic.className='mt-mobile-tab-icon';
      graphic.setAttribute('aria-hidden','true');
      graphic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[icon] + '</svg>';
      const labelNode = document.createElement('span');
      labelNode.className = 'mt-mobile-tab-label';
      labelNode.dataset.i18n=translation;
      labelNode.textContent=label;
      a.append(graphic,labelNode);
      nav.append(a);
    });
    document.body.append(nav);
    // Leverage the current page's translation control; do not override any handlers.
    const headerNav = document.querySelector('.mt-app-header .mt-nav');
    const syncLabels = () => {
      if (!headerNav) return;
      const source = [...headerNav.querySelectorAll('a')];
      nav.querySelectorAll('a').forEach((link) => {
        const match = source.find(a => a.getAttribute('href') === link.getAttribute('href'));
        if (match && match.textContent.trim()) link.querySelector('.mt-mobile-tab-label').textContent=match.textContent.trim();
      });
    };
    syncLabels();
    if (headerNav) {
      const observer = new MutationObserver(syncLabels);
      observer.observe(headerNav,{subtree:true,childList:true,characterData:true});
    }
  };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootMobileNav,{once:true});
  else bootMobileNav();
})();
