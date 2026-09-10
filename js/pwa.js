(() => {
  const banner = document.createElement('div');
  banner.className = 'pwa-connection-banner';
  banner.setAttribute('role', 'status');
  document.body.append(banner);

  function message(key, fallback) {
    return typeof window.t === 'function' ? window.t(key) : fallback;
  }

  function updateConnectionBanner({ announce = true } = {}) {
    const offline = !navigator.onLine;
    banner.textContent = offline
      ? message('offlineMode', 'Offline mode. Changes are saved on this device and will sync when you reconnect.')
      : message('backOnline', 'Back online. Syncing your latest changes...');
    banner.classList.toggle('is-visible', offline);
    banner.classList.toggle('is-syncing', !offline && announce);
    if (!offline && announce) window.setTimeout(() => banner.classList.remove('is-syncing'), 2600);
    window.dispatchEvent(new CustomEvent('app:connectionchange', { detail: { online: !offline } }));
  }

  window.addEventListener('online', updateConnectionBanner);
  window.addEventListener('offline', updateConnectionBanner);
  updateConnectionBanner({ announce: false });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('PWA registration failed', error));
    });
  }
})();
