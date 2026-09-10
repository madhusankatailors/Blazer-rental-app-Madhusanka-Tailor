let activeDialog = null;

function ensureDialogHost() {
  let host = document.getElementById('appDialogHost');
  if (host) return host;

  host = document.createElement('div');
  host.id = 'appDialogHost';
  host.className = 'app-dialog-host';
  document.body.append(host);
  return host;
}

export function showAppDialog({
  title = '',
  message = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = false,
  input = null,
  danger = false,
} = {}) {
  if (activeDialog) activeDialog.resolve(false);

  const host = ensureDialogHost();
  const panel = document.createElement('section');
  panel.className = 'app-dialog-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'appDialogTitle');
  panel.innerHTML = `
    <div class="app-dialog-header">
      <h2 id="appDialogTitle" class="app-dialog-title"></h2>
      <button type="button" class="app-dialog-close" data-dialog-cancel aria-label="Close">&times;</button>
    </div>
    <div class="app-dialog-body">
      <p class="app-dialog-message"></p>
      ${input ? '<input class="app-dialog-input" type="text" autocomplete="off">' : ''}
    </div>
    <div class="app-dialog-actions">
      ${showCancel ? '<button type="button" class="app-dialog-button app-dialog-cancel" data-dialog-cancel></button>' : ''}
      <button type="button" class="app-dialog-button app-dialog-confirm" data-dialog-confirm></button>
    </div>`;

  panel.querySelector('.app-dialog-title').textContent = title;
  panel.querySelector('.app-dialog-message').textContent = message;
  const inputElement = panel.querySelector('.app-dialog-input');
  if (inputElement && input?.type) {
    inputElement.type = input.type;
    inputElement.inputMode = input.type === 'number' ? 'decimal' : 'text';
  }
  panel.querySelector('[data-dialog-confirm]').textContent = confirmText;
  panel.querySelector('[data-dialog-confirm]').classList.toggle('is-danger', danger);
  panel.querySelector('[data-dialog-cancel]')?.classList.toggle('is-danger', false);
  panel.querySelector('.app-dialog-cancel:not([data-dialog-cancel])');
  const cancelButton = panel.querySelector('.app-dialog-actions [data-dialog-cancel]');
  if (cancelButton) cancelButton.textContent = cancelText;

  host.replaceChildren(panel);
  host.classList.add('is-open');
  document.body.classList.add('app-dialog-open');

  return new Promise((resolve) => {
    activeDialog = { resolve };
    const close = (result) => {
      if (!activeDialog) return;
      activeDialog = null;
      host.classList.remove('is-open');
      document.body.classList.remove('app-dialog-open');
      host.replaceChildren();
      resolve(result);
    };

    panel.querySelector('[data-dialog-confirm]').addEventListener('click', () => {
      close(inputElement ? inputElement.value : true);
    });
    panel.querySelectorAll('[data-dialog-cancel]').forEach((button) => button.addEventListener('click', () => close(false)));
    panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close(false);
      if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') panel.querySelector('[data-dialog-confirm]').click();
    });
    requestAnimationFrame(() => (inputElement || panel.querySelector('[data-dialog-confirm]'))?.focus());
  });
}

export const showAppNotice = (title, message, options = {}) => showAppDialog({ title, message, ...options });
export const askAppConfirmation = (title, message, options = {}) => showAppDialog({
  title,
  message,
  showCancel: true,
  confirmText: options.confirmText || 'Confirm',
  cancelText: options.cancelText || 'Cancel',
  danger: options.danger || false,
});
