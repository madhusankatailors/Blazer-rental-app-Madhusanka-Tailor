import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth, isConfigured } from './firebase.js';

export const AUTH_USERNAME = 'madhusanka_tailor';
export const AUTH_EMAIL = 'madhusankatailors1994@gmail.com';

export function waitForAuth() {
  if (!isConfigured() || !auth) {
    return Promise.reject(new Error('Firebase is not configured.'));
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function requireAuth() {
  if (!isConfigured()) {
    window.location.href = 'setup.html';
    return null;
  }

  const user = await waitForAuth();
  if (!user) {
    window.location.href = 'login.html';
    return null;
  }
  return user;
}

export async function redirectIfAuthenticated() {
  if (!isConfigured()) {
    window.location.href = 'setup.html';
    return false;
  }

  const user = await waitForAuth();
  if (user) {
    window.location.href = 'index.html';
    return true;
  }
  return false;
}

export async function login(username, password) {
  if (!isConfigured() || !auth) {
    throw new Error('Firebase is not configured. See README.md');
  }

  if (username.trim().toLowerCase() !== AUTH_USERNAME) {
    throw new Error('Invalid username or password.');
  }

  await signInWithEmailAndPassword(auth, AUTH_EMAIL, password);
}

export async function logout() {
  if (auth) {
    await signOut(auth);
  }
  window.location.href = 'login.html';
}
