import { requireAuth, logout } from './auth.js';
import { subscribeBills, saveBills as persistBills } from './storage.js';

const BILL_ITEMS = [
  { key: 'blazers', en: 'Blazers', si: 'කෝට්' },
  { key: 'long-trousers', en: 'Long Trousers', si: 'දිග කලිසම්' },
  { key: 'short-trousers', en: 'Short Trousers', si: 'කොට කලිසම්' },
  { key: 'long-sleeve-shirt', en: 'Long Sleeve Shirt', si: 'අත් දිග ෂර්ට්' },
  { key: 'short-sleeve-shirt', en: 'Short Sleeve Shirt', si: 'අත් කොට ෂර්ට්' },
  { key: 'waistcoat', en: 'Waistcoat', si: 'වෙස් කෝට්' },
  { key: 'tassel', en: 'Tassel', si: 'ටසල්' },
  { key: 'sarong', en: 'Sarong', si: 'සරම්' },
  { key: 'national-suit', en: 'National Suit', si: 'නැෂනල්' },
  { key: 'tie', en: 'Tie', si: 'ටයි' },
  { key: 'bow', en: 'Bow', si: 'බෝ' },
  { key: 'belt', en: 'Belt', si: 'බෙල්ට්' },
  { key: 'socks', en: 'Socks', si: 'මේස්' },
  { key: 'cufflinks-tie-pin', en: 'Cufflinks / Tie Pin', si: 'කෆ්ලින් / ටයි පින්' },
  { key: 'shoes', en: 'Shoes', si: 'සපත්තු' },
  { key: 'other', en: 'Other / Custom Item', si: 'වෙනත් / අභිරුචි අයිතමය', custom: true },
];

let bills = [];
let currentBillId = '';
let currentPreviewBill = null;
let pendingWrites = 0;
let syncState = 'loading';
let itemRowCounter = 0;

const $ = (id) => document.getElementById(id);

const els = {
  loading: $('billingLoading'),
  syncStatus: $('billingSyncStatus'),
  logoutBtn: $('billingLogoutBtn'),

  form: $('billingForm'),
  formTitle: $('billingFormTitle'),
  editId: $('billingEditId'),
  billNo: $('billNo'),
  billDate: $('billDate'),
  customerName: $('billCustomerName'),
  phone: $('billPhone'),
  receivedDate: $('billReceivedDate'),
  deliveryDate: $('billDeliveryDate'),
  paymentType: $('billingPaymentType'),
  paidAmountWrap: $('billingPaidAmountWrap'),
  paymentHint: $('billingPaymentHint'),
  advance: $('billAdvance'),
  itemsBody: $('billingItemsBody'),
  formTotal: $('billingFormTotal'),
  formAdvance: $('billingFormAdvance'),
  formBalance: $('billingFormBalance'),
  clearBtn: $('billingClearBtn'),
  saveBtn: $('billingSaveBtn'),
  savePreviewBtn: $('billingSavePreviewBtn'),

  statCount: $('billingStatCount'),
  statTotal: $('billingStatTotal'),
  statAdvance: $('billingStatAdvance'),
  statBalance: $('billingStatBalance'),

  search: $('billingSearch'),
  savedWrap: $('billingSavedWrap'),
  savedCards: $('billingSavedCards'),
  savedBody: $('billingSavedBody'),
  empty: $('billingEmpty'),

  previewModal: $('billingPreviewModal'),
  previewEditBtn: $('billingPreviewEditBtn'),
  printBtn: $('billingPrintBtn'),
  pdfBtn: $('billingPdfBtn'),
  paper: $('billingPaper'),
  paperStage: $('billingPaperStage'),
  previewScroll: $('billingPreviewScroll'),
  previewItems: $('billingPreviewItems'),
  previewCustomer: $('previewCustomer'),
  previewPhone: $('previewPhone'),
  previewBillNo: $('previewBillNo'),
  previewBillDate: $('previewBillDate'),
  previewReceivedDate: $('previewReceivedDate'),
  previewDeliveryDate: $('previewDeliveryDate'),
  previewTotal: $('previewTotal'),
  previewAdvance: $('previewAdvance'),
  previewBalance: $('previewBalance'),
  previewPaymentStatus: $('previewPaymentStatus'),

  itemSelect: $('billingItemSelect'),
  selectedItemsSummary: $('billingSelectedItemsSummary'),
};

const compactBillingQuery = window.matchMedia('(max-width: 1023px)');

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getLocaleSafe() {
  return typeof getLocale === 'function' ? getLocale() : 'en';
}

function translateItem(item) {
  return getLocaleSafe() === 'si'
    ? (item.nameSi || BILL_ITEMS.find((entry) => entry.key === item.key)?.si || item.nameEn || '')
    : (item.nameEn || BILL_ITEMS.find((entry) => entry.key === item.key)?.en || item.nameSi || '');
}

function showToast(message, type = 'success') {
  const container = $('toastContainer');
  if (!container || !message) return;

  container.innerHTML = '';
  const toast = document.createElement('div');
  const tones = {
    success: 'bg-emerald-600 border-emerald-500',
    error: 'bg-red-600 border-red-500',
    info: 'bg-brand-600 border-brand-500',
  };

  toast.className = `toast-item pointer-events-auto rounded-lg border px-3 py-2 text-xs sm:text-sm font-medium text-white shadow-lg ${tones[type] || tones.info}`;
  toast.textContent = message;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('opacity-0', 'transition', 'duration-200');
    window.setTimeout(() => toast.remove(), 200);
  }, 2200);
}

function setSyncState(state) {
  syncState = state;
  if (!els.syncStatus) return;

  const labels = {
    loading: t('syncLoading'),
    saving: t('syncSaving'),
    saved: t('syncSaved'),
    error: t('syncError'),
  };

  els.syncStatus.textContent = labels[state] || '';
}

function hideLoading() {
  els.loading?.classList.add('hidden');
}

function createItemRows() {
  if (els.itemsBody) els.itemsBody.innerHTML = '';
  populateBillingItemSelect();
  renderSelectedBillingItems();
}

function getBillingItemRows() {
  return els.itemsBody ? [...els.itemsBody.querySelectorAll('tr.billing-entry-row')] : [];
}

function billingRowIsActive(row) {
  const qty = Number(row.querySelector('.billing-qty')?.value || 0);
  const price = Number(row.querySelector('.billing-price')?.value || 0);
  return qty > 0 || price > 0;
}

function getBillingRowLabel(row) {
  const customName = row.querySelector('.billing-custom-name')?.value?.trim();
  if (customName) return customName;
  const key = row.dataset.itemKey || '';
  const def = BILL_ITEMS.find((item) => item.key === key);
  return def ? (getLocaleSafe() === 'si' ? def.si : def.en) : key;
}

function createBillingRowId() {
  itemRowCounter += 1;
  return `bill-item-${Date.now()}-${itemRowCounter}`;
}

function populateBillingItemSelect() {
  if (!els.itemSelect) return;

  els.itemSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = t('billingSelectItemPlaceholder');
  els.itemSelect.appendChild(placeholder);

  BILL_ITEMS.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.key;
    option.textContent = getLocaleSafe() === 'si' ? item.si : item.en;
    els.itemSelect.appendChild(option);
  });

  els.itemSelect.value = '';
}

function makeBillingItemRow(key, data = {}) {
  const itemDef = BILL_ITEMS.find((item) => item.key === key) || {
    key,
    en: data.nameEn || key,
    si: data.nameSi || data.nameEn || key,
    custom: key === 'other',
  };
  const rowId = createBillingRowId();
  const customName = itemDef.custom
    ? String(data.nameEn && data.nameEn !== itemDef.en ? data.nameEn : data.nameSi && data.nameSi !== itemDef.si ? data.nameSi : '')
    : '';
  const qty = Number(data.qty) > 0 ? Number(data.qty) : '';
  const unitPrice = Number(data.unitPrice) > 0 ? Number(data.unitPrice) : '';

  const row = document.createElement('tr');
  row.dataset.itemKey = itemDef.key;
  row.dataset.rowId = rowId;
  row.className = 'billing-entry-row billing-added-row';
  row.innerHTML = `
    <td class="billing-item-index px-3 py-2 text-slate-500"></td>
    <td class="billing-item-description px-3 py-2 font-medium text-slate-800">
      ${itemDef.custom
        ? `<label class="billing-mobile-field-label billing-custom-label">${escapeHtml(t('billingOtherItemName'))}</label>
           <input type="text" class="billing-custom-name w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="${escapeHtml(t('billingOtherItemPlaceholder'))}" aria-label="${escapeHtml(t('billingOtherItemName'))}" value="${escapeHtml(customName)}" />`
        : `<span class="billing-item-name">${escapeHtml(getLocaleSafe() === 'si' ? itemDef.si : itemDef.en)}</span>`}
    </td>
    <td class="billing-entry-field billing-qty-cell px-3 py-2">
      <span class="billing-mobile-field-label">${escapeHtml(t('billingQty'))}</span>
      <input type="number" min="0" step="1" value="${escapeHtml(String(qty))}" placeholder="0"
             class="billing-qty w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </td>
    <td class="billing-entry-field billing-price-cell px-3 py-2">
      <span class="billing-mobile-field-label">${escapeHtml(t('billingUnitPrice'))}</span>
      <input type="number" min="0" step="0.01" value="${escapeHtml(String(unitPrice))}" placeholder="0.00"
             class="billing-price w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </td>
    <td class="billing-entry-field billing-amount-cell px-3 py-2 text-right font-semibold text-slate-800">
      <span class="billing-mobile-field-label">${escapeHtml(t('billingAmount'))}</span>
      <span class="billing-row-amount">0.00</span>
    </td>
    <td class="billing-item-action-cell px-3 py-2 text-right">
      <button type="button" class="billing-remove-item-btn" data-remove-item="${escapeHtml(rowId)}" aria-label="${escapeHtml(t('billingRemoveItem'))}" title="${escapeHtml(t('billingRemoveItem'))}">
        <span aria-hidden="true">×</span><span class="billing-remove-item-text">${escapeHtml(t('billingRemoveItem'))}</span>
      </button>
    </td>`;

  row.querySelectorAll('input').forEach((input) => input.addEventListener('input', updateFormTotals));
  return row;
}

function reindexBillingRows() {
  getBillingItemRows().forEach((row, index) => {
    const indexCell = row.querySelector('.billing-item-index');
    if (indexCell) indexCell.textContent = String(index + 1);
  });
}

function focusBillingRow(rowId) {
  const row = getBillingItemRows().find((entry) => entry.dataset.rowId === rowId);
  if (!row) return;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const target = row.querySelector('.billing-custom-name') || row.querySelector('.billing-qty');
  window.setTimeout(() => target?.focus({ preventScroll: true }), 180);
}

function addBillingItem(key, data = {}, focus = true) {
  if (!key || !els.itemsBody) return null;
  const row = makeBillingItemRow(key, data);
  els.itemsBody.appendChild(row);
  reindexBillingRows();
  updateFormTotals();
  if (focus) focusBillingRow(row.dataset.rowId);
  return row;
}

function removeBillingItem(rowId) {
  const row = getBillingItemRows().find((entry) => entry.dataset.rowId === rowId);
  if (!row) return;
  row.remove();
  reindexBillingRows();
  updateFormTotals();
}

function renderSelectedBillingItems() {
  if (!els.selectedItemsSummary) return;
  const rows = getBillingItemRows();
  if (!rows.length) {
    els.selectedItemsSummary.innerHTML = `<span class="billing-selected-empty">${escapeHtml(t('billingNoSelectedItems'))}</span>`;
    return;
  }

  els.selectedItemsSummary.innerHTML = rows.map((row, index) => {
    const rowId = row.dataset.rowId || '';
    const name = getBillingRowLabel(row) || t('billingOtherItemName');
    const qty = Number(row.querySelector('.billing-qty')?.value || 0);
    const price = Number(row.querySelector('.billing-price')?.value || 0);
    const amount = qty * price;
    return `
      <span class="billing-selected-item-chip" data-row-chip="${escapeHtml(rowId)}">
        <button type="button" class="billing-chip-main" data-focus-row="${escapeHtml(rowId)}" title="${escapeHtml(name)}">
          <span class="billing-chip-order">${index + 1}</span>
          <span>${escapeHtml(name)}</span>
          <span>× ${escapeHtml(String(qty || 0))}</span>
          <span>Rs. ${formatMoney(amount)}</span>
        </button>
        <button type="button" class="billing-chip-remove" data-remove-row="${escapeHtml(rowId)}" aria-label="${escapeHtml(t('billingRemoveItem'))}" title="${escapeHtml(t('billingRemoveItem'))}">×</button>
      </span>`;
  }).join('');
}

function refreshBillingItemPicker() {
  populateBillingItemSelect();
  reindexBillingRows();
  renderSelectedBillingItems();
}

function getFormItems() {
  return getBillingItemRows().map((row) => {
    const key = row.dataset.itemKey || '';
    const itemDef = BILL_ITEMS.find((item) => item.key === key);
    const qtyRaw = row.querySelector('.billing-qty')?.value.trim() || '';
    const priceRaw = row.querySelector('.billing-price')?.value.trim() || '';
    const customName = row.querySelector('.billing-custom-name')?.value.trim() || '';
    const qty = qtyRaw === '' ? 0 : Math.max(0, Number(qtyRaw) || 0);
    const unitPrice = priceRaw === '' ? 0 : Math.max(0, Number(priceRaw) || 0);
    const fallbackEn = itemDef?.en || key;
    const fallbackSi = itemDef?.si || key;

    return {
      key,
      nameEn: itemDef?.custom ? (customName || fallbackEn) : fallbackEn,
      nameSi: itemDef?.custom ? (customName || fallbackSi) : fallbackSi,
      qty,
      unitPrice,
      amount: qty * unitPrice,
    };
  });
}

function getTotals(items, paymentType = 'unpaid', paidValue = '') {
  const total = (items || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const paidRaw = String(paidValue ?? '').trim();
  let paid = 0;

  if (paymentType === 'full') {
    paid = total;
  } else if (paymentType === 'advance') {
    paid = paidRaw === '' ? 0 : Math.max(0, Number(paidRaw) || 0);
  }

  const balance = Math.max(0, total - paid);
  return { total, paid, advance: paid, balance };
}

function getBillPaymentType(bill) {
  if (bill?.paymentType === 'full' || bill?.paymentType === 'advance' || bill?.paymentType === 'unpaid') {
    return bill.paymentType;
  }

  const total = Number(bill?.totalAmount) || 0;
  const paid = Number(bill?.paidAmount ?? bill?.advanceAmount) || 0;
  if (total > 0 && paid >= total) return 'full';
  if (paid > 0) return 'advance';
  return 'unpaid';
}

function normalizeBill(bill) {
  const total = Number(bill?.totalAmount) || 0;
  const legacyPaid = Math.max(0, Number(bill?.paidAmount ?? bill?.advanceAmount) || 0);
  const paymentType = getBillPaymentType({ ...bill, totalAmount: total, paidAmount: legacyPaid });
  const paid = paymentType === 'full' ? total : paymentType === 'advance' ? Math.min(legacyPaid, total) : 0;

  return {
    ...bill,
    paymentType,
    paidAmount: paid,
    advanceAmount: paid,
    balanceAmount: Math.max(0, total - paid),
  };
}

function getPaymentStatusLabel(billOrType) {
  const type = typeof billOrType === 'string' ? billOrType : getBillPaymentType(billOrType);
  if (type === 'full') return t('billingPaymentFull');
  if (type === 'advance') return t('billingPaymentAdvance');
  return t('billingPaymentUnpaid');
}

function updatePaymentControls() {
  if (!els.paymentType || !els.advance || !els.paidAmountWrap) return;
  const type = els.paymentType.value || 'unpaid';

  els.paidAmountWrap.classList.toggle('hidden', type === 'unpaid');
  els.advance.disabled = type !== 'advance';
  els.advance.required = type === 'advance';

  if (type === 'unpaid') {
    els.advance.value = '';
    if (els.paymentHint) els.paymentHint.textContent = t('billingPaymentUnpaidHint');
  } else if (type === 'full') {
    if (els.paymentHint) els.paymentHint.textContent = t('billingPaymentFullHint');
  } else if (els.paymentHint) {
    els.paymentHint.textContent = t('billingPaymentAdvanceHint');
  }
}

function updateFormTotals() {
  const items = getFormItems();

  [...els.itemsBody.querySelectorAll('tr')].forEach((row, index) => {
    row.querySelector('.billing-row-amount').textContent = formatMoney(items[index].amount);
  });

  const paymentType = els.paymentType?.value || 'unpaid';
  const totals = getTotals(items, paymentType, els.advance.value);

  if (paymentType === 'full') {
    els.advance.value = totals.total > 0 ? totals.total.toFixed(2) : '';
  }

  els.formTotal.textContent = `Rs. ${formatMoney(totals.total)}`;
  els.formAdvance.textContent = `Rs. ${formatMoney(totals.paid)}`;
  els.formBalance.textContent = `Rs. ${formatMoney(totals.balance)}`;

  els.formBalance.parentElement?.classList.toggle('ring-2', totals.balance > 0);
  els.formBalance.parentElement?.classList.toggle('ring-violet-200', totals.balance > 0);
  renderSelectedBillingItems();
}

function collectFormBill() {
  const items = getFormItems().filter((item) => item.qty > 0 || item.unitPrice > 0);
  const paymentType = els.paymentType?.value || 'unpaid';
  const totals = getTotals(items, paymentType, els.advance.value);
  const existing = bills.find((bill) => bill.id === currentBillId);

  return {
    id: currentBillId || `bill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    billNo: els.billNo.value.trim(),
    billDate: els.billDate.value,
    customerName: els.customerName.value.trim(),
    phone: els.phone.value.trim(),
    receivedDate: els.receivedDate.value,
    deliveryDate: els.deliveryDate.value,
    items,
    totalAmount: totals.total,
    paymentType,
    paidAmount: totals.paid,
    advanceAmount: totals.paid,
    balanceAmount: totals.balance,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function validateBill(bill) {
  if (!bill.billNo) {
    els.billNo.focus();
    showToast(t('billingErrorBillNo'), 'error');
    return false;
  }

  if (!bill.customerName) {
    els.customerName.focus();
    showToast(t('billingErrorCustomer'), 'error');
    return false;
  }

  if (!bill.items.some((item) => item.qty > 0)) {
    showToast(t('billingErrorItem'), 'error');
    return false;
  }

  const invalidOtherRow = getBillingItemRows().find((row) =>
    row.dataset.itemKey === 'other'
    && billingRowIsActive(row)
    && !row.querySelector('.billing-custom-name')?.value.trim()
  );
  if (invalidOtherRow) {
    invalidOtherRow.querySelector('.billing-custom-name')?.focus();
    showToast(t('billingErrorOtherItem'), 'error');
    return false;
  }

  if (bill.paidAmount > bill.totalAmount) {
    els.advance.focus();
    showToast(t('billingErrorAdvance'), 'error');
    return false;
  }

  const duplicate = bills.find((item) => item.billNo.toLowerCase() === bill.billNo.toLowerCase() && item.id !== bill.id);
  if (duplicate) {
    els.billNo.focus();
    showToast(t('billingErrorDuplicate', { number: bill.billNo }), 'error');
    return false;
  }

  return true;
}

async function persistCurrentBills() {
  setSyncState('saving');
  pendingWrites += 1;
  try {
    await persistBills(bills);
    setSyncState('saved');
  } catch (error) {
    console.error(error);
    setSyncState('error');
    throw error;
  } finally {
    pendingWrites = Math.max(0, pendingWrites - 1);
  }
}

async function saveBill(bill) {
  const previousBills = [...bills];
  const index = bills.findIndex((item) => item.id === bill.id);

  if (index >= 0) bills[index] = bill;
  else bills.unshift(bill);

  try {
    await persistCurrentBills();
    currentBillId = bill.id;
    els.editId.value = bill.id;
    showToast(t('billingToastSaved'), 'success');
    renderAll();
    return true;
  } catch {
    bills = previousBills;
    renderAll();
    showToast(t('toastSyncError'), 'error');
    return false;
  }
}

function resetForm() {
  currentBillId = '';
  els.editId.value = '';
  els.form.reset();

  // Manual Bill No. — intentionally blank.
  els.billNo.value = '';
  els.billDate.value = todayISO();
  els.receivedDate.value = todayISO();
  els.deliveryDate.value = '';
  if (els.paymentType) els.paymentType.value = 'unpaid';
  els.advance.value = '';
  updatePaymentControls();

  if (els.itemsBody) els.itemsBody.innerHTML = '';
  if (els.itemSelect) els.itemSelect.value = '';

  els.formTitle.textContent = t('billingNewBill');
  els.savePreviewBtn.textContent = t('billingSavePreview');
  els.saveBtn.textContent = t('billingSave');
  updatePaymentControls();
  updateFormTotals();
  refreshBillingItemPicker();
}

function fillForm(bill) {
  currentBillId = bill.id;
  els.editId.value = bill.id;

  els.billNo.value = bill.billNo || '';
  els.billDate.value = bill.billDate || todayISO();
  els.customerName.value = bill.customerName || '';
  els.phone.value = bill.phone || '';
  els.receivedDate.value = bill.receivedDate || '';
  els.deliveryDate.value = bill.deliveryDate || '';
  const normalized = normalizeBill(bill);
  if (els.paymentType) els.paymentType.value = normalized.paymentType;
  els.advance.value = normalized.paymentType === 'unpaid' ? '' : normalized.paidAmount;
  updatePaymentControls();

  if (els.itemsBody) els.itemsBody.innerHTML = '';
  (bill.items || [])
    .filter((item) => Number(item?.qty) > 0 || Number(item?.unitPrice) > 0)
    .forEach((item) => addBillingItem(item.key || 'other', item, false));
  reindexBillingRows();

  els.formTitle.textContent = t('billingEditBill', { number: bill.billNo });
  els.savePreviewBtn.textContent = t('billingUpdatePreview');
  els.saveBtn.textContent = t('billingUpdate');
  updateFormTotals();
  refreshBillingItemPicker();

  document.getElementById('billingFormSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => els.billNo.focus({ preventScroll: true }), 250);
}

function renderStats() {
  const totals = bills.reduce((acc, bill) => {
    acc.total += Number(bill.totalAmount) || 0;
    acc.advance += Number(bill.paidAmount ?? bill.advanceAmount) || 0;
    acc.balance += Number(bill.balanceAmount) || 0;
    return acc;
  }, { total: 0, advance: 0, balance: 0 });

  els.statCount.textContent = bills.length;
  els.statTotal.textContent = `Rs. ${formatMoney(totals.total)}`;
  els.statAdvance.textContent = `Rs. ${formatMoney(totals.advance)}`;
  els.statBalance.textContent = `Rs. ${formatMoney(totals.balance)}`;
}

function getFilteredBills() {
  const query = (els.search.value || '').trim().toLowerCase();
  const sorted = [...bills].sort((a, b) => {
    const dateCompare = (b.billDate || '').localeCompare(a.billDate || '');
    if (dateCompare !== 0) return dateCompare;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });

  if (!query) return sorted;

  return sorted.filter((bill) => {
    return String(bill.billNo || '').toLowerCase().includes(query)
      || String(bill.customerName || '').toLowerCase().includes(query)
      || String(bill.phone || '').toLowerCase().includes(query);
  });
}

function paymentStatusBadge(bill) {
  const type = getBillPaymentType(bill);
  const classes = type === 'full'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : type === 'advance'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-rose-100 text-rose-800 border-rose-200';
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${classes}">${escapeHtml(getPaymentStatusLabel(type))}</span>`;
}

function renderSavedBills() {
  const filtered = getFilteredBills();
  const hasBills = filtered.length > 0;

  els.empty.classList.toggle('hidden', hasBills);
  els.savedWrap.classList.toggle('hidden', !hasBills);
  els.savedCards?.classList.toggle('hidden', !hasBills);

  els.savedBody.innerHTML = filtered.map((bill) => {
    const normalized = normalizeBill(bill);
    const hasBalance = normalized.balanceAmount > 0;
    return `
    <tr class="hover:bg-slate-50">
      <td class="px-3 py-3 font-semibold text-slate-900">${escapeHtml(normalized.billNo || '—')}</td>
      <td class="px-3 py-3">
        <div>${escapeHtml(normalized.customerName || '—')}</div>
        <div class="mt-1">${paymentStatusBadge(normalized)}</div>
      </td>
      <td class="px-3 py-3 whitespace-nowrap">${formatDate(normalized.billDate)}</td>
      <td class="px-3 py-3 text-right whitespace-nowrap font-semibold">Rs. ${formatMoney(normalized.totalAmount)}</td>
      <td class="px-3 py-3 text-right whitespace-nowrap ${hasBalance ? 'text-violet-700 font-bold' : 'text-emerald-700 font-semibold'}">
        Rs. ${formatMoney(normalized.balanceAmount)}
        <div class="text-[10px] font-medium text-slate-500 mt-0.5">${escapeHtml(t('billingPaidShort'))}: Rs. ${formatMoney(normalized.paidAmount)}</div>
      </td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap justify-end gap-1">
          ${hasBalance ? `<button type="button" data-bill-action="collect-balance" data-id="${escapeHtml(normalized.id)}"
                  class="px-2.5 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">${escapeHtml(t('billingCollectBalance'))}</button>` : ''}
          <button type="button" data-bill-action="preview" data-id="${escapeHtml(normalized.id)}"
                  class="px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50">${escapeHtml(t('billingPreview'))}</button>
          <button type="button" data-bill-action="edit" data-id="${escapeHtml(normalized.id)}"
                  class="px-2.5 py-1.5 rounded-md bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700">${escapeHtml(t('btnEdit'))}</button>
          <button type="button" data-bill-action="pdf" data-id="${escapeHtml(normalized.id)}"
                  class="px-2.5 py-1.5 rounded-md bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700">PDF</button>
          <button type="button" data-bill-action="delete" data-id="${escapeHtml(normalized.id)}"
                  class="px-2.5 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700">${escapeHtml(t('btnDelete'))}</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  if (els.savedCards) {
    els.savedCards.innerHTML = filtered.map((rawBill) => {
      const bill = normalizeBill(rawBill);
      const hasBalance = bill.balanceAmount > 0;
      return `
      <article class="billing-saved-card">
        <div class="billing-saved-card-head">
          <div class="min-w-0">
            <p class="billing-saved-card-label">${escapeHtml(t('billingBillNo'))}</p>
            <p class="billing-saved-card-number">${escapeHtml(bill.billNo || '—')}</p>
          </div>
          <div class="text-right">
            <div class="billing-saved-card-date">${formatDate(bill.billDate)}</div>
            <div class="mt-1">${paymentStatusBadge(bill)}</div>
          </div>
        </div>

        <div class="billing-saved-card-customer">
          <p class="billing-saved-card-label">${escapeHtml(t('billingCustomerName'))}</p>
          <p class="font-semibold text-slate-900 break-words">${escapeHtml(bill.customerName || '—')}</p>
          ${bill.phone ? `<p class="mt-1 text-xs text-slate-500 break-all">${escapeHtml(bill.phone)}</p>` : ''}
        </div>

        <div class="billing-saved-card-money">
          <div>
            <span>${escapeHtml(t('billingTotal'))}</span>
            <strong>Rs. ${formatMoney(bill.totalAmount)}</strong>
          </div>
          <div>
            <span>${escapeHtml(t('billingPaidShort'))}</span>
            <strong>Rs. ${formatMoney(bill.paidAmount)}</strong>
          </div>
          <div class="${hasBalance ? 'billing-balance-due' : 'billing-balance-paid'}">
            <span>${escapeHtml(t('billingBalance'))}</span>
            <strong>Rs. ${formatMoney(bill.balanceAmount)}</strong>
          </div>
        </div>

        <div class="billing-saved-card-actions">
          ${hasBalance ? `<button type="button" data-bill-action="collect-balance" data-id="${escapeHtml(bill.id)}"
                  class="billing-mobile-action bg-emerald-600 text-white">${escapeHtml(t('billingCollectBalance'))}</button>` : ''}
          <button type="button" data-bill-action="preview" data-id="${escapeHtml(bill.id)}"
                  class="billing-mobile-action border border-slate-300 bg-white text-slate-700">${escapeHtml(t('billingPreview'))}</button>
          <button type="button" data-bill-action="edit" data-id="${escapeHtml(bill.id)}"
                  class="billing-mobile-action bg-brand-600 text-white">${escapeHtml(t('btnEdit'))}</button>
          <button type="button" data-bill-action="pdf" data-id="${escapeHtml(bill.id)}"
                  class="billing-mobile-action bg-violet-600 text-white">PDF</button>
          <button type="button" data-bill-action="delete" data-id="${escapeHtml(bill.id)}"
                  class="billing-mobile-action bg-red-600 text-white">${escapeHtml(t('btnDelete'))}</button>
        </div>
      </article>`;
    }).join('');
  }
}
function renderPreviewItems(bill) {
  const active = (bill.items || []).filter((item) => Number(item.qty) > 0);
  const rows = [...active];
  const minRows = 8;

  while (rows.length < minRows) rows.push({ blank: true });

  els.previewItems.innerHTML = rows.map((item, index) => {
    if (item.blank) {
      return `<tr><td>${index + 1}</td><td>&nbsp;</td><td></td><td></td><td></td></tr>`;
    }

    const amount = Number(item.amount) || 0;
    const [rs, cts] = amount.toFixed(2).split('.');

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(translateItem(item))}</td>
        <td>${escapeHtml(String(item.qty))}</td>
        <td>${Number(rs).toLocaleString('en-LK')}</td>
        <td>${cts}</td>
      </tr>
    `;
  }).join('');
}

function renderPreview(bill) {
  currentPreviewBill = bill;

  els.previewCustomer.textContent = bill.customerName || '—';
  els.previewPhone.textContent = bill.phone || '—';
  els.previewBillNo.textContent = bill.billNo || '—';
  els.previewBillDate.textContent = formatDate(bill.billDate);
  els.previewReceivedDate.textContent = formatDate(bill.receivedDate);
  els.previewDeliveryDate.textContent = formatDate(bill.deliveryDate);
  const normalized = normalizeBill(bill);
  els.previewTotal.textContent = formatMoney(normalized.totalAmount);
  els.previewAdvance.textContent = formatMoney(normalized.paidAmount);
  els.previewBalance.textContent = formatMoney(normalized.balanceAmount);
  if (els.previewPaymentStatus) els.previewPaymentStatus.textContent = getPaymentStatusLabel(normalized);
  renderPreviewItems(bill);
}

function fitPreviewPaper() {
  if (!els.paper || !els.paperStage || !els.previewScroll) return;
  if (els.previewModal?.classList.contains('hidden')) return;

  // Always measure the original A5 paper size, then scale only the on-screen
  // preview. Printing and PDF export still use the real 148 mm × 210 mm size.
  const oldTransform = els.paper.style.transform;
  els.paper.style.transform = 'none';

  const naturalWidth = els.paper.offsetWidth;
  const naturalHeight = els.paper.offsetHeight;
  const scrollStyle = window.getComputedStyle(els.previewScroll);
  const horizontalPadding =
    (parseFloat(scrollStyle.paddingLeft) || 0) +
    (parseFloat(scrollStyle.paddingRight) || 0);
  const availableWidth = Math.max(1, els.previewScroll.clientWidth - horizontalPadding - 2);
  const scale = Math.min(1, availableWidth / naturalWidth);

  if (!Number.isFinite(scale) || scale <= 0 || !naturalWidth || !naturalHeight) {
    els.paper.style.transform = oldTransform || 'none';
    return;
  }

  els.paper.style.transformOrigin = 'top left';
  els.paper.style.transform = `scale(${scale})`;
  els.paperStage.style.width = `${Math.ceil(naturalWidth * scale)}px`;
  els.paperStage.style.height = `${Math.ceil(naturalHeight * scale)}px`;
  els.paperStage.dataset.previewScale = String(scale);
}

function refreshPreviewFit() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(fitPreviewPaper);
  });
}

function openPreview(bill) {
  renderPreview(bill);
  els.previewModal.classList.remove('hidden');
  els.previewModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('billing-modal-open');
  refreshPreviewFit();
}

function closePreview() {
  els.previewModal.classList.add('hidden');
  els.previewModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('billing-modal-open');
}

async function downloadPreviewPdf() {
  if (!currentPreviewBill) return;

  if (!window.html2canvas || !window.jspdf?.jsPDF) {
    showToast(t('toastPdfUnavailable'), 'error');
    return;
  }

  const oldText = els.pdfBtn.textContent;
  els.pdfBtn.disabled = true;
  els.pdfBtn.textContent = t('billingPreparingPdf');

  const previousTransform = els.paper.style.transform;
  const previousStageWidth = els.paperStage?.style.width || '';
  const previousStageHeight = els.paperStage?.style.height || '';

  try {
    // Capture the true A5 paper, not the scaled mobile/tablet preview.
    els.paper.style.transform = 'none';
    if (els.paperStage) {
      els.paperStage.style.width = `${els.paper.offsetWidth}px`;
      els.paperStage.style.height = `${els.paper.offsetHeight}px`;
    }

    const canvas = await window.html2canvas(els.paper, {
      scale: 2.4,
      backgroundColor: '#ffffff',
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
    });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [148, 210],
    });

    const image = canvas.toDataURL('image/jpeg', 0.97);
    pdf.addImage(image, 'JPEG', 0, 0, 148, 210);

    const safeNo = String(currentPreviewBill.billNo || 'bill').replace(/[^a-z0-9_-]+/gi, '-');
    const fileName = `madhusanka-tailors-bill-${safeNo}.pdf`;
    const pdfBlob = pdf.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(t('billingToastPdf'), 'success');
  } catch (error) {
    console.error(error);
    showToast(t('toastPdfUnavailable'), 'error');
  } finally {
    els.paper.style.transform = previousTransform;
    if (els.paperStage) {
      els.paperStage.style.width = previousStageWidth;
      els.paperStage.style.height = previousStageHeight;
    }
    refreshPreviewFit();
    els.pdfBtn.disabled = false;
    els.pdfBtn.textContent = oldText;
  }
}

function printPreview() {
  if (!currentPreviewBill) return;
  window.print();
}

async function collectBillBalance(bill) {
  const normalized = normalizeBill(bill);
  if (normalized.balanceAmount <= 0) return;

  if (!window.confirm(t('billingConfirmCollectBalance', {
    amount: `Rs. ${formatMoney(normalized.balanceAmount)}`,
    number: normalized.billNo || '',
  }))) return;

  const previousBills = [...bills];
  const updated = {
    ...normalized,
    paymentType: 'full',
    paidAmount: normalized.totalAmount,
    advanceAmount: normalized.totalAmount,
    balanceAmount: 0,
    updatedAt: new Date().toISOString(),
  };

  bills = bills.map((item) => item.id === updated.id ? updated : item);

  try {
    await persistCurrentBills();
    if (currentBillId === updated.id) fillForm(updated);
    if (currentPreviewBill?.id === updated.id) renderPreview(updated);
    renderAll();
    showToast(t('billingToastBalanceCollected'), 'success');
  } catch {
    bills = previousBills;
    renderAll();
    showToast(t('toastSyncError'), 'error');
  }
}

async function deleteBill(id) {
  const bill = bills.find((item) => item.id === id);
  if (!bill) return;

  if (!window.confirm(t('billingConfirmDelete', { number: bill.billNo }))) return;

  const previousBills = [...bills];
  bills = bills.filter((item) => item.id !== id);

  try {
    await persistCurrentBills();
    if (currentBillId === id) resetForm();
    if (currentPreviewBill?.id === id) closePreview();
    showToast(t('billingToastDeleted'), 'success');
    renderAll();
  } catch {
    bills = previousBills;
    renderAll();
    showToast(t('toastSyncError'), 'error');
  }
}

function renderItemLanguage() {
  [...els.itemsBody.querySelectorAll('tr')].forEach((row) => {
    const key = row.dataset.itemKey;
    const item = BILL_ITEMS.find((entry) => entry.key === key);
    const cell = row.querySelector('.billing-item-name');
    if (item && cell) cell.textContent = getLocaleSafe() === 'si' ? item.si : item.en;
    const customName = row.querySelector('.billing-custom-name');
    if (customName) customName.placeholder = t('billingOtherItemPlaceholder');

    const labels = row.querySelectorAll('.billing-mobile-field-label');
    if (labels[0]) labels[0].textContent = t('billingQty');
    if (labels[1]) labels[1].textContent = t('billingUnitPrice');
    if (labels[2]) labels[2].textContent = t('billingAmount');
  });

  updatePaymentControls();
  populateBillingItemSelect();
  reindexBillingRows();
  renderSelectedBillingItems();

  if (currentPreviewBill) {
    renderPreview(currentPreviewBill);
    refreshPreviewFit();
  }
}

function renderAll() {
  renderStats();
  renderSavedBills();
  renderItemLanguage();
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}

function getBillById(id) {
  return bills.find((bill) => bill.id === id);
}

async function handleSave(openAfterSave) {
  const bill = collectFormBill();
  if (!validateBill(bill)) return;

  const saved = await saveBill(bill);
  if (saved && openAfterSave) openPreview(bill);
}

function handleSavedActions(event) {
  const button = event.target.closest('[data-bill-action]');
  if (!button) return;

  const action = button.dataset.billAction;

  if (action === 'close-preview') {
    closePreview();
    return;
  }

  const id = button.dataset.id;
  const bill = id ? getBillById(id) : null;

  if (action === 'preview' && bill) openPreview(normalizeBill(bill));
  if (action === 'collect-balance' && bill) collectBillBalance(bill);
  if (action === 'edit' && bill) {
    closePreview();
    fillForm(bill);
  }
  if (action === 'pdf' && bill) {
    openPreview(bill);
    requestAnimationFrame(() => window.setTimeout(downloadPreviewPdf, 120));
  }
  if (action === 'delete' && id) deleteBill(id);
}

function initEvents() {
  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleSave(true);
  });

  els.saveBtn.addEventListener('click', () => handleSave(false));
  els.clearBtn.addEventListener('click', () => {
    if (!window.confirm(t('billingConfirmClear'))) return;
    resetForm();
    document.getElementById('billingFormSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => els.billNo.focus({ preventScroll: true }), 180);
  });

  els.advance.addEventListener('input', updateFormTotals);
  els.paymentType?.addEventListener('change', () => {
    if (els.paymentType.value === 'advance') els.advance.value = '';
    updatePaymentControls();
    updateFormTotals();
    if (els.paymentType.value === 'advance') window.setTimeout(() => els.advance.focus(), 0);
  });
  els.search.addEventListener('input', renderSavedBills);

  els.itemSelect?.addEventListener('change', () => {
    const key = els.itemSelect.value;
    if (!key) return;
    addBillingItem(key, {}, true);
    els.itemSelect.value = '';
  });

  els.selectedItemsSummary?.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-row]');
    if (remove) {
      removeBillingItem(remove.dataset.removeRow || '');
      return;
    }
    const focus = event.target.closest('[data-focus-row]');
    if (focus) focusBillingRow(focus.dataset.focusRow || '');
  });

  els.itemsBody?.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-item]');
    if (!remove) return;
    removeBillingItem(remove.dataset.removeItem || '');
  });
  els.savedBody.addEventListener('click', handleSavedActions);
  els.savedCards?.addEventListener('click', handleSavedActions);
  els.previewModal.addEventListener('click', handleSavedActions);

  els.previewEditBtn.addEventListener('click', () => {
    if (!currentPreviewBill) return;
    closePreview();
    fillForm(currentPreviewBill);
  });

  els.printBtn.addEventListener('click', printPreview);
  els.pdfBtn.addEventListener('click', downloadPreviewPdf);

  els.logoutBtn.addEventListener('click', () => {
    logout().catch(() => {
      window.location.href = 'login.html';
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.previewModal.classList.contains('hidden')) closePreview();
  });

  let previewResizeTimer = null;
  const handlePreviewResize = () => {
    window.clearTimeout(previewResizeTimer);
    previewResizeTimer = window.setTimeout(() => {
      if (!els.previewModal.classList.contains('hidden')) refreshPreviewFit();
    }, 80);
  };

  window.addEventListener('resize', handlePreviewResize, { passive: true });
  window.addEventListener('orientationchange', handlePreviewResize, { passive: true });

  const handleCompactBillingChange = () => refreshBillingItemPicker();
  if (typeof compactBillingQuery.addEventListener === 'function') {
    compactBillingQuery.addEventListener('change', handleCompactBillingChange);
  } else if (typeof compactBillingQuery.addListener === 'function') {
    compactBillingQuery.addListener(handleCompactBillingChange);
  }

  window.addEventListener('localechange', () => {
    setSyncState(syncState);
    if (currentBillId) {
      const bill = getBillById(currentBillId);
      if (bill) els.formTitle.textContent = t('billingEditBill', { number: bill.billNo });
    } else {
      els.formTitle.textContent = t('billingNewBill');
    }

    els.savePreviewBtn.textContent = currentBillId ? t('billingUpdatePreview') : t('billingSavePreview');
    els.saveBtn.textContent = currentBillId ? t('billingUpdate') : t('billingSave');

    renderAll();
  });
}

async function init() {
  await requireAuth();

  createItemRows();
  resetForm();
  initEvents();
  setSyncState('loading');

  subscribeBills(
    (items) => {
      bills = Array.isArray(items) ? items.map(normalizeBill) : [];
      hideLoading();
      setSyncState('saved');
      renderAll();

      if (currentPreviewBill) {
        const fresh = bills.find((bill) => bill.id === currentPreviewBill.id);
        if (fresh) renderPreview(fresh);
      }
    },
    (error) => {
      console.error(error);
      hideLoading();
      setSyncState('error');
      showToast(t('toastSyncError'), 'error');
    }
  );
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((error) => {
    console.error(error);
    hideLoading();
    showToast(t('toastSyncError'), 'error');
  });
});
