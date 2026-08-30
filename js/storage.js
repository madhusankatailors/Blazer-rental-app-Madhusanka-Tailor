import { collection, deleteField, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db, isConfigured } from './firebase.js';

const LOCAL_KEY = 'blazerRentals_v1';
const RENTAL_RECORDS = 'rentalRecords';
const BILL_RECORDS = 'billRecords';
let rentalCache = new Map();
let billCache = new Map();
let rentalQueue = Promise.resolve();
let billQueue = Promise.resolve();
let stopRentals = null;
let stopBills = null;

function ensureReady() {
  if (!isConfigured() || !db) throw new Error('Firebase is not configured.');
}

function recordId(item, prefix) {
  const fallback = `${prefix}-${Date.now()}-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  return String(item?.id || fallback).replaceAll('/', '-');
}

function clean(item) {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined));
}

function comparable(item) {
  const copy = { ...clean(item) };
  delete copy.updatedAt;
  delete copy.migratedAt;
  return JSON.stringify(Object.keys(copy).sort().reduce((result, key) => {
    result[key] = copy[key];
    return result;
  }, {}));
}

async function commitOperations(operations) {
  for (let start = 0; start < operations.length; start += 400) {
    const batch = writeBatch(db);
    operations.slice(start, start + 400).forEach((operation) => {
      if (operation.type === 'delete') batch.delete(operation.ref);
      else batch.set(operation.ref, operation.data, { merge: false });
    });
    await batch.commit();
  }
}

async function migrateItems(items, collectionName, prefix) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  const operations = items.map((item) => {
    const id = recordId(item, prefix);
    return { type: 'set', ref: doc(db, collectionName, id), data: { ...clean(item), id, migratedAt: serverTimestamp() } };
  });
  await commitOperations(operations);
  return operations.length;
}

async function migrateRentals() {
  const legacyRef = doc(db, 'rentals', 'madhusanka_tailors');
  const legacy = await getDoc(legacyRef);
  const cloudItems = legacy.exists() && Array.isArray(legacy.data().items) ? legacy.data().items : [];
  let localItems = [];
  try { localItems = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { localItems = []; }
  const items = cloudItems.length ? cloudItems : localItems;
  const count = await migrateItems(items, RENTAL_RECORDS, 'rental');
  if (count > 0 && legacy.exists()) {
    await setDoc(legacyRef, { items: deleteField(), migratedTo: RENTAL_RECORDS, migratedCount: count, migratedAt: serverTimestamp() }, { merge: true });
  }
  if (count > 0 || localItems.length === 0) localStorage.removeItem(LOCAL_KEY);
}

async function migrateBills() {
  const legacyRef = doc(db, 'bills', 'madhusanka_tailors');
  const legacy = await getDoc(legacyRef);
  const items = legacy.exists() && Array.isArray(legacy.data().items) ? legacy.data().items : [];
  const count = await migrateItems(items, BILL_RECORDS, 'bill');
  if (count > 0) {
    await setDoc(legacyRef, { items: deleteField(), migratedTo: BILL_RECORDS, migratedCount: count, migratedAt: serverTimestamp() }, { merge: true });
  }
}

function listen(collectionName, setCache, onUpdate, onError) {
  return onSnapshot(collection(db, collectionName), (snapshot) => {
    const items = snapshot.docs.map((entry) => ({ ...entry.data(), id: entry.id }));
    setCache(new Map(items.map((item) => [item.id, item])));
    onUpdate(items);
  }, onError);
}

async function synchronize(collectionName, items, cache, prefix) {
  const normalized = items.map((item) => {
    const id = recordId(item, prefix);
    return { ...clean(item), id };
  });
  const ids = new Set(normalized.map((item) => item.id));
  const operations = normalized
    .filter((item) => comparable(item) !== comparable(cache.get(item.id) || {}))
    .map((item) => ({ type: 'set', ref: doc(db, collectionName, item.id), data: { ...item, updatedAt: serverTimestamp() } }));
  cache.forEach((_, id) => { if (!ids.has(id)) operations.push({ type: 'delete', ref: doc(db, collectionName, id) }); });
  await commitOperations(operations);
  cache.clear();
  normalized.forEach((item) => cache.set(item.id, item));
}

export function subscribeRentals(onUpdate, onError) {
  try { ensureReady(); } catch (error) { onError?.(error); return () => {}; }
  migrateRentals().then(() => { stopRentals = listen(RENTAL_RECORDS, (cache) => { rentalCache = cache; }, onUpdate, onError); }).catch(onError);
  return () => { stopRentals?.(); stopRentals = null; };
}

export function saveRentals(items) {
  try { ensureReady(); } catch (error) { return Promise.reject(error); }
  rentalQueue = rentalQueue.then(() => synchronize(RENTAL_RECORDS, items, rentalCache, 'rental'));
  return rentalQueue;
}

export function updateRentalStatus(id, status) {
  try { ensureReady(); } catch (error) { return Promise.reject(error); }
  const rentalRef = doc(db, RENTAL_RECORDS, String(id).replaceAll('/', '-'));
  rentalQueue = rentalQueue.then(async () => {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(rentalRef);
      if (!snapshot.exists()) throw new Error('This booking no longer exists. Refresh and try again.');
      if (snapshot.data().status !== 'Pending') throw new Error('This booking was already updated in another session.');
      transaction.update(rentalRef, { status, updatedAt: serverTimestamp() });
    });
    const cached = rentalCache.get(String(id));
    if (cached) rentalCache.set(String(id), { ...cached, status });
  });
  return rentalQueue;
}

export function subscribeBills(onUpdate, onError) {
  try { ensureReady(); } catch (error) { onError?.(error); return () => {}; }
  migrateBills().then(() => { stopBills = listen(BILL_RECORDS, (cache) => { billCache = cache; }, onUpdate, onError); }).catch(onError);
  return () => { stopBills?.(); stopBills = null; };
}

export function saveBills(items) {
  try { ensureReady(); } catch (error) { return Promise.reject(error); }
  billQueue = billQueue.then(() => synchronize(BILL_RECORDS, items, billCache, 'bill'));
  return billQueue;
}
