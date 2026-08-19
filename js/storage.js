import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db, isConfigured } from './firebase.js';

const LOCAL_KEY = 'blazerRentals_v1';
const COLLECTION = 'rentals';
const DOC_ID = 'madhusanka_tailors';

let unsubscribe = null;
let saveQueue = Promise.resolve();

export function subscribeRentals(onUpdate, onError) {
  if (!isConfigured() || !db) {
    onError?.(new Error('Firebase is not configured.'));
    return () => {};
  }

  const ref = doc(db, COLLECTION, DOC_ID);

  migrateLocalData(ref).catch(onError);

  unsubscribe = onSnapshot(
    ref,
    (snapshot) => {
      const items = snapshot.exists() ? snapshot.data().items || [] : [];
      onUpdate(Array.isArray(items) ? items : []);
    },
    (error) => onError?.(error)
  );

  return () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
}

async function migrateLocalData(ref) {
  const snapshot = await getDoc(ref);
  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) return;

  let localItems = [];
  try {
    localItems = JSON.parse(raw);
    if (!Array.isArray(localItems)) localItems = [];
  } catch {
    localItems = [];
  }

  if (localItems.length === 0) {
    localStorage.removeItem(LOCAL_KEY);
    return;
  }

  const cloudItems = snapshot.exists() ? snapshot.data().items || [] : [];
  if (cloudItems.length === 0) {
    await setDoc(ref, {
      items: localItems,
      updatedAt: serverTimestamp(),
    });
  }

  localStorage.removeItem(LOCAL_KEY);
}

export function saveRentals(items) {
  if (!isConfigured() || !db) {
    return Promise.reject(new Error('Firebase is not configured.'));
  }

  const ref = doc(db, COLLECTION, DOC_ID);

  saveQueue = saveQueue.then(() =>
    setDoc(
      ref,
      {
        items,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
  );

  return saveQueue;
}


// -----------------------------------------------------------------------------
// DIGITAL BILL STORAGE
// Bills use their own Firestore document so rental data and billing data remain
// independent while still syncing through the same authenticated Firebase app.
// -----------------------------------------------------------------------------

const BILLS_COLLECTION = 'bills';
const BILLS_DOC_ID = 'madhusanka_tailors';

let billsUnsubscribe = null;
let billSaveQueue = Promise.resolve();

export function subscribeBills(onUpdate, onError) {
  if (!isConfigured() || !db) {
    onError?.(new Error('Firebase is not configured.'));
    return () => {};
  }

  const ref = doc(db, BILLS_COLLECTION, BILLS_DOC_ID);

  billsUnsubscribe = onSnapshot(
    ref,
    (snapshot) => {
      const items = snapshot.exists() ? snapshot.data().items || [] : [];
      onUpdate(Array.isArray(items) ? items : []);
    },
    (error) => onError?.(error)
  );

  return () => {
    if (billsUnsubscribe) {
      billsUnsubscribe();
      billsUnsubscribe = null;
    }
  };
}

export function saveBills(items) {
  if (!isConfigured() || !db) {
    return Promise.reject(new Error('Firebase is not configured.'));
  }

  const ref = doc(db, BILLS_COLLECTION, BILLS_DOC_ID);

  billSaveQueue = billSaveQueue.then(() =>
    setDoc(
      ref,
      {
        items,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
  );

  return billSaveQueue;
}
