import { requireAuth, logout } from './auth.js';
import { subscribeRentals, saveRentals as persistRentals } from './storage.js';

const PRICES = { 'Light Color': 2000, 'Dark Color': 1750 };

let rentals = [];
let returnDateManuallyEdited = false;
let hasLoadedCloudData = false;
let syncState = 'loading';
let previousSnapshot = [];

const $ = (id) => document.getElementById(id);

const els = {
  form: $('rentalForm'),
  editId: $('editId'),
  customerName: $('customerName'),
  phoneNumber: $('phoneNumber'),
  blazerCode: $('blazerCode'),
  colorName: $('colorName'),
  bookingDate: $('bookingDate'),
  pickupDate: $('pickupDate'),
  returnDate: $('returnDate'),
  totalPrice: $('totalPrice'),
  advancePaid: $('advancePaid'),
  balanceDue: $('balanceDue'),
  depositType: $('depositType'),
  status: $('status'),
  submitBtn: $('submitBtn'),
  cancelEditBtn: $('cancelEditBtn'),
  formTitle: $('formTitle'),
  formSubtitle: $('formSubtitle'),
  searchInput: $('searchInput'),
  dateFilterField: $('dateFilterField'),
  dateFrom: $('dateFrom'),
  dateTo: $('dateTo'),
  clearFiltersBtn: $('clearFiltersBtn'),
  rentalsCards: $('rentalsCards'),
  tableScroll: $('tableScroll'),
  tableScrollHint: $('tableScrollHint'),
  mobileCardsHint: $('mobileCardsHint'),
  tableBody: $('rentalsTableBody'),
  emptyState: $('emptyState'),
  emptyTitle: $('emptyTitle'),
  emptySubtitle: $('emptySubtitle'),
  todayDisplay: $('todayDisplay'),
  statTotal: $('statTotal'),
  statActive: $('statActive'),
  statOverdue: $('statOverdue'),
  statTodayReturns: $('statTodayReturns'),
  syncStatus: $('syncStatus'),
  appLoading: $('appLoading'),
  logoutBtn: $('logoutBtn'),
};

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatCurrency(n) {
  return 'Rs. ' + Number(n).toLocaleString('en-LK');
}

function addDays(iso, days) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function setSubmitButtonLoading(isLoading) {
  if (!els.submitBtn) return;

  const defaultText = els.submitBtn.dataset.defaultText || els.submitBtn.textContent.trim();
  if (!els.submitBtn.dataset.defaultText) {
    els.submitBtn.dataset.defaultText = defaultText;
  }

  els.submitBtn.disabled = isLoading;
  els.submitBtn.setAttribute('aria-busy', String(isLoading));
  els.submitBtn.classList.toggle('opacity-70', isLoading);
  els.submitBtn.classList.toggle('cursor-not-allowed', isLoading);

  const spinner = '<span class="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent align-middle"></span>';
  els.submitBtn.innerHTML = isLoading
    ? `${spinner}${t('syncSaving')}`
    : defaultText;
}

function compareDates(a, b) {
  return a.localeCompare(b);
}

function getColorType() {
  const checked = document.querySelector('input[name="colorType"]:checked');
  return checked ? checked.value : 'Light Color';
}

function setColorType(value) {
  document.querySelectorAll('input[name="colorType"]').forEach((r) => {
    r.checked = r.value === value;
  });
}

function getDefaultPrice(colorType) {
  return PRICES[colorType] ?? PRICES['Light Color'];
}

function updateTotalPriceFromColorType() {
  els.totalPrice.value = getDefaultPrice(getColorType());
  updateBalance();
}

function updateBalance() {
  const total = parseFloat(els.totalPrice.value) || 0;
  const advance = parseFloat(els.advancePaid.value) || 0;
  els.balanceDue.value = Math.max(0, total - advance);
}

function autoSetReturnDate() {
  if (returnDateManuallyEdited || !els.pickupDate.value) return;
  els.returnDate.value = addDays(els.pickupDate.value, 2);
}

function isOverdue(rental) {
  return rental.status === 'Pending' && compareDates(todayISO(), rental.returnDate) > 0;
}

function isUpcoming(rental) {
  return rental.status === 'Pending' && compareDates(rental.pickupDate, todayISO()) > 0;
}

function isReturnDueToday(rental) {
  return rental.status === 'Pending' && rental.returnDate === todayISO();
}

function getRowStatus(rental) {
  if (rental.status === 'Returned') return 'returned';
  if (isOverdue(rental)) return 'overdue';
  if (isUpcoming(rental)) return 'upcoming';
  if (isReturnDueToday(rental)) return 'due-today';
  return 'active';
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

function loadRentals() {
  // Rentals are loaded from Firebase via subscribeRentals().
}

async function saveRentals() {
  setSyncState('saving');
  try {
    await persistRentals(rentals);
    setSyncState('saved');
  } catch (error) {
    console.error(error);
    setSyncState('error');
    alert(t('syncError'));
    throw error;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function resetForm() {
  els.form.reset();
  els.editId.value = '';
  returnDateManuallyEdited = false;
  els.bookingDate.value = todayISO();
  els.returnDate.value = '';
  els.advancePaid.value = 0;
  setColorType('Light Color');
  updateTotalPriceFromColorType();
  els.cancelEditBtn.hidden = true;
  updateFormLabels();
  setSubmitButtonLoading(false);
}

function updateFormLabels() {
  const editId = els.editId.value;
  if (editId) {
    const rental = rentals.find((r) => r.id === editId);
    if (rental) {
      els.formTitle.textContent = t('formEditTitle');
      els.formSubtitle.textContent = t('formEditSubtitle', {
        name: rental.customerName,
        code: rental.blazerCode,
      });
      els.submitBtn.textContent = t('btnUpdateBooking');
      return;
    }
  }
  els.formTitle.textContent = t('formNewTitle');
  els.formSubtitle.textContent = t('formNewSubtitle');
  els.submitBtn.textContent = t('btnSaveBooking');
}

function getFormData() {
  return {
    customerName: els.customerName.value.trim(),
    phoneNumber: els.phoneNumber.value.trim(),
    blazerCode: String(parseInt(els.blazerCode.value, 10)).padStart(2, '0'),
    colorName: els.colorName.value.trim(),
    colorType: getColorType(),
    bookingDate: els.bookingDate.value,
    pickupDate: els.pickupDate.value,
    returnDate: els.returnDate.value,
    totalPrice: parseFloat(els.totalPrice.value) || 0,
    advancePaid: parseFloat(els.advancePaid.value) || 0,
    balanceDue: parseFloat(els.balanceDue.value) || 0,
    depositType: els.depositType.value,
    status: els.status.value,
  };
}

function populateForm(rental) {
  els.editId.value = rental.id;
  els.customerName.value = rental.customerName;
  els.phoneNumber.value = rental.phoneNumber;
  els.blazerCode.value = parseInt(rental.blazerCode, 10);
  els.colorName.value = rental.colorName;
  setColorType(rental.colorType);
  els.bookingDate.value = rental.bookingDate;
  els.pickupDate.value = rental.pickupDate;
  returnDateManuallyEdited = true;
  els.returnDate.value = rental.returnDate;
  els.totalPrice.value = rental.totalPrice;
  els.advancePaid.value = rental.advancePaid;
  els.balanceDue.value = rental.balanceDue;
  els.depositType.value = rental.depositType;
  els.status.value = rental.status;
  els.cancelEditBtn.hidden = false;
  updateFormLabels();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function matchesSearch(rental, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    rental.customerName.toLowerCase().includes(q) ||
    rental.phoneNumber.toLowerCase().includes(q) ||
    rental.blazerCode.includes(q) ||
    String(parseInt(rental.blazerCode, 10)).includes(q) ||
    rental.colorName.toLowerCase().includes(q)
  );
}

function matchesDateFilter(rental) {
  let from = els.dateFrom.value;
  let to = els.dateTo.value;
  if (!from && !to) return true;

  if (from && to && compareDates(from, to) > 0) {
    [from, to] = [to, from];
  }

  const field = els.dateFilterField.value;
  const rentalDate = rental[field];
  if (!rentalDate) return false;

  if (from && compareDates(rentalDate, from) < 0) return false;
  if (to && compareDates(rentalDate, to) > 0) return false;
  return true;
}

function getFilteredRentals() {
  const query = els.searchInput.value.trim();
  return rentals
    .filter((r) => matchesSearch(r, query) && matchesDateFilter(r))
    .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate) || b.id.localeCompare(a.id));
}

function updateEmptyState(hasRentals, hasResults) {
  if (hasResults) return;

  if (!hasRentals) {
    els.emptyTitle.textContent = t('emptyTitle');
    els.emptySubtitle.textContent = t('emptySubtitle');
  } else {
    els.emptyTitle.textContent = t('emptyNoResults');
    els.emptySubtitle.textContent = t('emptyNoResultsSubtitle');
  }
}

function clearFilters() {
  els.searchInput.value = '';
  els.dateFrom.value = '';
  els.dateTo.value = '';
  els.dateFilterField.value = 'bookingDate';
  renderTable();
}

function renderActionButtons(rental, compact = false) {
  const btnClass = compact
    ? 'flex-1 min-w-[4.5rem] px-2 py-2.5 sm:py-1 text-xs font-medium rounded transition-colors'
    : 'px-2 py-1 text-xs font-medium rounded transition-colors';

  return `
    <div class="flex flex-wrap gap-1.5 sm:gap-1 ${compact ? 'rental-card-actions' : ''}">
      ${rental.status === 'Pending'
        ? `<button type="button" data-action="return" data-id="${rental.id}"
            class="${btnClass} bg-green-600 text-white hover:bg-green-700">${escapeHtml(t('btnReturned'))}</button>`
        : ''}
      <button type="button" data-action="edit" data-id="${rental.id}"
        class="${btnClass} bg-brand-600 text-white hover:bg-brand-700">${escapeHtml(t('btnEdit'))}</button>
      <button type="button" data-action="delete" data-id="${rental.id}"
        class="${btnClass} bg-red-600 text-white hover:bg-red-700">${escapeHtml(t('btnDelete'))}</button>
    </div>`;
}

function getRowClass(rental) {
  const rowStatus = getRowStatus(rental);
  if (rowStatus === 'overdue') return 'bg-red-100 text-red-800 hover:bg-red-200';
  if (rowStatus === 'returned') return 'bg-green-50/60 hover:bg-green-50';
  return 'hover:bg-slate-50 transition-colors';
}

function getCardClass(rental) {
  const rowStatus = getRowStatus(rental);
  if (rowStatus === 'overdue') return 'rental-card rental-card-overdue';
  if (rowStatus === 'returned') return 'rental-card rental-card-returned';
  return 'rental-card rental-card-default';
}

function renderRentalCard(rental) {
  const card = document.createElement('article');
  card.className = getCardClass(rental);
  card.innerHTML = `
    <div class="flex items-start justify-between gap-2 mb-3">
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold text-slate-900 truncate">${escapeHtml(rental.customerName)}</h3>
        <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(rental.phoneNumber)}</p>
      </div>
      <div class="shrink-0">${renderStatusBadge(rental)}</div>
    </div>
    <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:text-sm mb-3">
      <div>
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thCode'))}</dt>
        <dd class="font-mono font-semibold">${escapeHtml(rental.blazerCode)}</dd>
      </div>
      <div>
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thBooking'))}</dt>
        <dd>${formatDate(rental.bookingDate)}</dd>
      </div>
      <div class="col-span-2">
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thColor'))}</dt>
        <dd>${escapeHtml(rental.colorName)} <span class="text-slate-400">· ${escapeHtml(translateColorType(rental.colorType))}</span></dd>
      </div>
      <div>
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thPickup'))}</dt>
        <dd>${formatDate(rental.pickupDate)}</dd>
      </div>
      <div>
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thReturn'))}</dt>
        <dd class="font-medium">${formatDate(rental.returnDate)}</dd>
      </div>
      <div>
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thPrice'))}</dt>
        <dd>${formatCurrency(rental.totalPrice)}</dd>
      </div>
      <div>
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thBalance'))}</dt>
        <dd class="font-semibold">${formatCurrency(rental.balanceDue)}</dd>
      </div>
      <div class="col-span-2">
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thDeposit'))}</dt>
        <dd>${escapeHtml(translateDeposit(rental.depositType))}</dd>
      </div>
    </dl>
    ${renderActionButtons(rental, true)}
  `;
  return card;
}

function setRentalsViewVisible(show) {
  [els.rentalsCards, els.tableScroll, els.tableScrollHint, els.mobileCardsHint].forEach((el) => {
    if (el) el.classList.toggle('empty-hidden', !show);
  });
}

function renderStatusBadge(rental) {
  const rowStatus = getRowStatus(rental);

  if (rowStatus === 'returned') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">${escapeHtml(t('badgeReturned'))}</span>`;
  }
  if (rowStatus === 'overdue') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white uppercase tracking-wide">${escapeHtml(t('badgeOverdue'))}</span>`;
  }
  if (rowStatus === 'upcoming') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">${escapeHtml(t('badgeUpcoming'))}</span>`;
  }
  if (rowStatus === 'due-today') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">${escapeHtml(t('badgeDueToday'))}</span>`;
  }
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">${escapeHtml(t('badgePending'))}</span>`;
}

function renderTable() {
  const filtered = getFilteredRentals();

  els.tableBody.innerHTML = '';
  els.rentalsCards.innerHTML = '';

  if (filtered.length === 0) {
    updateEmptyState(rentals.length > 0, false);
    els.emptyState.classList.remove('hidden');
    setRentalsViewVisible(false);
    return;
  }

  els.emptyState.classList.add('hidden');
  setRentalsViewVisible(true);

  filtered.forEach((rental) => {
    els.rentalsCards.appendChild(renderRentalCard(rental));

    const tr = document.createElement('tr');
    tr.className = getRowClass(rental);
    tr.innerHTML = `
      <td class="px-3 py-3 whitespace-nowrap">${formatDate(rental.bookingDate)}</td>
      <td class="px-3 py-3 whitespace-nowrap font-medium">${escapeHtml(rental.customerName)}</td>
      <td class="px-3 py-3 whitespace-nowrap">${escapeHtml(rental.phoneNumber)}</td>
      <td class="px-3 py-3 whitespace-nowrap font-mono font-semibold">${escapeHtml(rental.blazerCode)}</td>
      <td class="px-3 py-3 whitespace-nowrap">
        <span>${escapeHtml(rental.colorName)}</span>
        <span class="block text-xs opacity-70">${escapeHtml(translateColorType(rental.colorType))}</span>
      </td>
      <td class="px-3 py-3 whitespace-nowrap">${formatDate(rental.pickupDate)}</td>
      <td class="px-3 py-3 whitespace-nowrap font-medium">${formatDate(rental.returnDate)}</td>
      <td class="px-3 py-3 whitespace-nowrap">${formatCurrency(rental.totalPrice)}</td>
      <td class="px-3 py-3 whitespace-nowrap">${formatCurrency(rental.advancePaid)}</td>
      <td class="px-3 py-3 whitespace-nowrap font-semibold">${formatCurrency(rental.balanceDue)}</td>
      <td class="px-3 py-3 whitespace-nowrap text-xs">${escapeHtml(translateDeposit(rental.depositType))}</td>
      <td class="px-3 py-3 whitespace-nowrap">${renderStatusBadge(rental)}</td>
      <td class="px-3 py-3 whitespace-nowrap">${renderActionButtons(rental)}</td>
    `;
    els.tableBody.appendChild(tr);
  });
}

function renderStats() {
  const today = todayISO();
  const total = rentals.length;
  const active = rentals.filter((r) => r.status === 'Pending').length;
  const overdue = rentals.filter(isOverdue).length;
  const todayReturns = rentals.filter(isReturnDueToday).length;

  els.statTotal.textContent = total;
  els.statActive.textContent = active;
  els.statOverdue.textContent = overdue;
  els.statTodayReturns.textContent = todayReturns;

  const dateObj = new Date(today + 'T12:00:00');
  els.todayDisplay.textContent = dateObj.toLocaleDateString(getDateLocale(), {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function render() {
  renderStats();
  renderTable();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container || !message) return;

  const toast = document.createElement('div');
  const tone = {
    success: 'bg-emerald-600 text-white border-emerald-500',
    error: 'bg-red-600 text-white border-red-500',
    info: 'bg-brand-600 text-white border-brand-500',
  };

  toast.className = `pointer-events-auto w-full rounded-lg border px-3 py-2 text-xs font-medium shadow-lg text-white sm:text-sm ${tone[type] || tone.info}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('opacity-100');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-1', 'transition', 'duration-200');
    setTimeout(() => toast.remove(), 200);
  }, 2200);
}

function notifyRemoteBookingChange(previousItems, nextItems) {
  if (!hasLoadedCloudData || previousItems === nextItems) return;

  const previousMap = new Map((previousItems || []).map((item) => [item.id, item]));
  const nextMap = new Map((nextItems || []).map((item) => [item.id, item]));

  const added = (nextItems || []).filter((item) => !previousMap.has(item.id));
  const removed = (previousItems || []).filter((item) => !nextMap.has(item.id));
  const updated = (nextItems || []).filter((item) => {
    const prev = previousMap.get(item.id);
    return prev && JSON.stringify(prev) !== JSON.stringify(item);
  });

  if (added.length > 0) {
    showToast(t('toastBookingSaved'), 'success');
    return;
  }

  if (removed.length > 0) {
    showToast(t('toastBookingDeleted'), 'info');
    return;
  }

  if (updated.length > 0) {
    showToast(t('toastBookingUpdated'), 'success');
  }
}

function handleSubmit(e) {
  e.preventDefault();
  if (els.submitBtn?.disabled) return;

  const data = getFormData();

  if (!data.customerName || !data.phoneNumber || !data.pickupDate || !data.returnDate) {
    alert(t('alertRequiredFields'));
    return;
  }

  const editId = els.editId.value;
  if (editId) {
    const idx = rentals.findIndex((r) => r.id === editId);
    if (idx !== -1) {
      rentals[idx] = { ...rentals[idx], ...data };
    }
  } else {
    rentals.push({ id: generateId(), ...data });
  }

  setSubmitButtonLoading(true);
  saveRentals()
    .then(() => {
      const successMessage = els.editId.value ? t('toastBookingUpdated') : t('toastBookingSaved');
      showToast(successMessage, 'success');
      resetForm();
    })
    .catch(() => {
      setSubmitButtonLoading(false);
      showToast(t('toastSyncError'), 'error');
    });
}

function handleTableClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const { action, id } = btn.dataset;
  const rental = rentals.find((r) => r.id === id);
  if (!rental) return;

  if (action === 'return') {
    rental.status = 'Returned';
    saveRentals()
      .then(() => {
        showToast(t('toastBookingReturned'), 'success');
      })
      .catch(() => {
        showToast(t('toastSyncError'), 'error');
      });
  } else if (action === 'edit') {
    populateForm(rental);
  } else if (action === 'delete') {
    if (confirm(t('confirmDelete', { name: rental.customerName, code: rental.blazerCode }))) {
      rentals = rentals.filter((r) => r.id !== id);
      saveRentals()
        .then(() => {
          showToast(t('toastBookingDeleted'), 'success');
          if (els.editId.value === id) resetForm();
        })
        .catch(() => {
          showToast(t('toastSyncError'), 'error');
        });
    }
  }
}

function initEventListeners() {
  els.form.addEventListener('submit', handleSubmit);
  els.cancelEditBtn.addEventListener('click', resetForm);
  els.tableBody.addEventListener('click', handleTableClick);
  els.rentalsCards.addEventListener('click', handleTableClick);
  els.searchInput.addEventListener('input', renderTable);
  els.dateFilterField.addEventListener('change', renderTable);
  els.dateFrom.addEventListener('change', renderTable);
  els.dateTo.addEventListener('change', renderTable);
  els.clearFiltersBtn.addEventListener('click', clearFilters);

  document.querySelectorAll('input[name="colorType"]').forEach((r) => {
    r.addEventListener('change', updateTotalPriceFromColorType);
  });

  els.totalPrice.addEventListener('input', updateBalance);
  els.advancePaid.addEventListener('input', updateBalance);

  const handlePickupDateChange = () => {
    returnDateManuallyEdited = false;
    autoSetReturnDate();
  };

  els.pickupDate.addEventListener('change', handlePickupDateChange);
  els.pickupDate.addEventListener('input', handlePickupDateChange);

  els.returnDate.addEventListener('change', () => {
    returnDateManuallyEdited = true;
  });
  els.returnDate.addEventListener('input', () => {
    returnDateManuallyEdited = true;
  });

  els.logoutBtn?.addEventListener('click', () => {
    logout().catch(() => {
      window.location.href = 'login.html';
    });
  });
}

function hideAppLoading() {
  if (els.appLoading) {
    els.appLoading.classList.add('hidden');
  }
}

async function init() {
  await requireAuth();

  resetForm();
  initEventListeners();
  setSyncState('loading');

  subscribeRentals(
    (items) => {
      const previousItems = [...rentals];
      rentals = items;

      if (hasLoadedCloudData) {
        notifyRemoteBookingChange(previousItems, items);
      }

      hasLoadedCloudData = true;
      hideAppLoading();
      setSyncState('saved');
      render();
    },
    (error) => {
      console.error(error);
      hideAppLoading();
      setSyncState('error');
      if (!hasLoadedCloudData) {
        alert(t('syncError'));
      }
    }
  );

  window.addEventListener('localechange', () => {
    updateFormLabels();
    setSyncState(syncState);
    render();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((error) => {
    console.error(error);
    hideAppLoading();
  });
});
