import { login, redirectIfAuthenticated } from './auth.js';

const form = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

function hideError() {
  loginError.classList.add('hidden');
}

redirectIfAuthenticated().catch((error) => {
  showError(error.message || t('loginErrorGeneric'));
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideError();

  loginBtn.disabled = true;
  loginBtn.textContent = t('btnLoggingIn');

  try {
    await login(usernameInput.value, passwordInput.value);
    window.location.href = 'index.html';
  } catch (error) {
    showError(t('loginErrorInvalid'));
    loginBtn.disabled = false;
    loginBtn.textContent = t('btnLogin');
  }
});
