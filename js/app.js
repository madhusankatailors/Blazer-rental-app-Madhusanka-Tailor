import { requireAuth, logout } from './auth.js';
import { subscribeRentals, saveRentals as persistRentals } from './storage.js';

const PRICES = { 'Light Color': 2000, 'Dark Color': 1750 };

let rentals = [];
let returnDateManuallyEdited = false;
let hasLoadedCloudData = false;
let pendingLocalWrites = 0;
let syncState = 'loading';
let previousSnapshot = [];
let activeDetailRentalId = null;
let activeQuickFilter = 'all';
const ITEMS_PER_PAGE = 10;
let currentPage = 1;

const $ = (id) => document.getElementById(id);

const els = {
  form: $('rentalForm'),
  editId: $('editId'),
  customerName: $('customerName'),
  phoneNumber: $('phoneNumber'),
  blazersList: $('blazersList'),
  addBlazerBtn: $('addBlazerBtn'),
  bookingDate: $('bookingDate'),
  pickupDate: $('pickupDate'),
  returnDate: $('returnDate'),
  totalPrice: $('totalPrice'),
  advancePaid: $('advancePaid'),
  advanceFieldWrap: $('advanceFieldWrap'),
  balanceSummary: $('balanceSummary'),
  depositType: $('depositType'),
  status: $('status'),
  notes: $('notes'),
  submitBtn: $('submitBtn'),
  cancelEditBtn: $('cancelEditBtn'),
  formTitle: $('formTitle'),
  formSubtitle: $('formSubtitle'),
  searchInput: $('searchInput'),
  dateFilterField: $('dateFilterField'),
  dateFrom: $('dateFrom'),
  dateTo: $('dateTo'),
  clearFiltersBtn: $('clearFiltersBtn'),
  exportCsvBtn: $('exportCsvBtn'),
  backupDataBtn: $('backupDataBtn'),
  newBookingBtn: $('newBookingBtn'),
  bookingFormSection: $('bookingFormSection'),
  quickFilters: $('quickFilters'),
  rentalsCards: $('rentalsCards'),
  tableScroll: $('tableScroll'),
  mobileCardsHint: $('mobileCardsHint'),
  tableBody: $('rentalsTableBody'),
  detailModal: $('detailModal'),
  detailModalTitle: $('detailModalTitle'),
  detailModalBody: $('detailModalBody'),
  detailModalActions: $('detailModalActions'),
  emptyState: $('emptyState'),
  emptyTitle: $('emptyTitle'),
  emptySubtitle: $('emptySubtitle'),
  todayDisplay: $('todayDisplay'),
  statTotal: $('statTotal'),
  statActive: $('statActive'),
  statOverdue: $('statOverdue'),
  statTodayReturns: $('statTodayReturns'),
  statTodayGoingBlazers: $('statTodayGoingBlazers'),
  statOutstandingBalance: $('statOutstandingBalance'),
  analyticsDailySalesValue: $('analyticsDailySalesValue'),
  analyticsMonthlyRevenueValue: $('analyticsMonthlyRevenueValue'),
  analyticsTopColorsValue: $('analyticsTopColorsValue'),
  analyticsOverdueRateValue: $('analyticsOverdueRateValue'),
  syncStatus: $('syncStatus'),
  appLoading: $('appLoading'),
  logoutBtn: $('logoutBtn'),
  paginationControls: $('paginationControls'),
  analyticsToggleBtn: $('analyticsToggleBtn'),
  analyticsToggleIcon: $('analyticsToggleIcon'),
  analyticsPanel: $('analyticsPanel'),
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

function getDefaultPrice(colorType) {
  return PRICES[colorType] ?? PRICES['Dark Color'];
}

function normalizeRental(rental) {
  if (rental.blazers && Array.isArray(rental.blazers) && rental.blazers.length > 0) {
    return rental;
  }

  if (rental.blazerCode) {
    const { blazerCode, colorName, colorType, ...rest } = rental;
    return {
      ...rest,
      blazers: [{
        blazerCode: blazerCode || '',
        colorName: colorName || '',
        colorType: colorType || 'Dark Color',
      }],
    };
  }

  return {
    ...rental,
    blazers: [{ blazerCode: '', colorName: '', colorType: 'Dark Color' }],
  };
}

function normalizeRentals(items) {
  return (items || []).map(normalizeRental);
}

function getBlazerCodes(rental) {
  return (rental.blazers || []).map((b) => b.blazerCode).filter(Boolean);
}

function formatBlazerCodes(rental) {
  const codes = getBlazerCodes(rental);
  return codes.length ? codes.join(', ') : '—';
}

function sanitizeRentalForSave(rental) {
  const { blazerCode, colorName, colorType, ...rest } = rental;
  return {
    ...rest,
    blazers: (rest.blazers || []).map(({ _rowId, ...blazer }) => blazer),
  };
}

function createBlazerRow(data = {}) {
  const rowId = data._rowId || `blazer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const colorType = data.colorType || 'Dark Color';
  const row = document.createElement('div');
  row.className = 'blazer-row grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/80';
  row.dataset.rowId = rowId;
  row.innerHTML = `
    <div class="sm:col-span-3">
      <label class="block text-xs font-medium text-slate-600 mb-1">${escapeHtml(t('labelBlazerCode'))}</label>
      <input type="text" data-field="blazerCode" required
        class="blazer-code w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        placeholder="${escapeHtml(t('placeholderBlazerCode'))}" value="${escapeHtml(data.blazerCode || '')}" />
    </div>
    <div class="sm:col-span-3">
      <label class="block text-xs font-medium text-slate-600 mb-1">${escapeHtml(t('labelColorName'))}</label>
      <input type="text" data-field="colorName" required
        class="blazer-color w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
        placeholder="${escapeHtml(t('placeholderColorName'))}" value="${escapeHtml(data.colorName || '')}" />
    </div>
    <div class="sm:col-span-5">
      <span class="block text-xs font-medium text-slate-600 mb-1">${escapeHtml(t('labelColorType'))}</span>
      <div class="flex flex-col xs:flex-row gap-2 sm:gap-3">
        <label class="inline-flex items-center gap-2 cursor-pointer select-none">
          <input type="radio" name="colorType-${rowId}" data-field="colorType" value="Light Color" class="blazer-color-type shrink-0" ${colorType === 'Light Color' ? 'checked' : ''} />
          <span class="text-xs sm:text-sm">${escapeHtml(t('colorLight'))} <span class="text-slate-400">(Rs. 2000)</span></span>
        </label>
        <label class="inline-flex items-center gap-2 cursor-pointer select-none">
          <input type="radio" name="colorType-${rowId}" data-field="colorType" value="Dark Color" class="blazer-color-type shrink-0" ${colorType === 'Dark Color' ? 'checked' : ''} />
          <span class="text-xs sm:text-sm">${escapeHtml(t('colorDark'))} <span class="text-slate-400">(Rs. 1750)</span></span>
        </label>
      </div>
    </div>
    <div class="sm:col-span-1 flex items-end justify-end sm:justify-center pb-0.5">
      <button type="button" data-action="remove-blazer"
        class="remove-blazer-btn p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors"
        title="${escapeHtml(t('btnRemoveBlazer'))}" aria-label="${escapeHtml(t('btnRemoveBlazer'))}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    </div>
  `;

  row.querySelectorAll('.blazer-color-type').forEach((input) => {
    input.addEventListener('change', updateTotalPriceFromBlazers);
    input.addEventListener('click', updateTotalPriceFromBlazers);
  });

  row.querySelector('[data-action="remove-blazer"]')?.addEventListener('click', () => {
    if (els.blazersList.children.length <= 1) return;
    row.remove();
    updateRemoveButtons();
    updateTotalPriceFromBlazers();
  });

  return row;
}

function renderBlazerRows(blazers) {
  els.blazersList.innerHTML = '';
  const items = blazers?.length ? blazers : [{ blazerCode: '', colorName: '', colorType: 'Dark Color' }];
  items.forEach((blazer) => {
    els.blazersList.appendChild(createBlazerRow(blazer));
  });
  updateRemoveButtons();
}

function updateRemoveButtons() {
  const rows = els.blazersList.querySelectorAll('.blazer-row');
  const hideRemove = rows.length <= 1;
  rows.forEach((row) => {
    const btn = row.querySelector('.remove-blazer-btn');
    if (btn) btn.hidden = hideRemove;
  });
}

function getBlazersFromForm() {
  return Array.from(els.blazersList.querySelectorAll('.blazer-row')).map((row) => {
    const colorTypeInput = row.querySelector('.blazer-color-type:checked');
    return {
      _rowId: row.dataset.rowId,
      blazerCode: row.querySelector('.blazer-code')?.value.trim() || '',
      colorName: row.querySelector('.blazer-color')?.value.trim() || '',
      colorType: colorTypeInput?.value || 'Dark Color',
    };
  });
}

function getBalanceDue(total, advance) {
  return Math.max(0, (total || 0) - (advance || 0));
}

function getRentalBalance(rental) {
  return getBalanceDue(rental.totalPrice, rental.advancePaid);
}

function getPaymentType() {
  const checked = document.querySelector('input[name="paymentType"]:checked');
  return checked?.value === 'advance' ? 'advance' : 'full';
}

function setPaymentType(type) {
  document.querySelectorAll('input[name="paymentType"]').forEach((radio) => {
    radio.checked = radio.value === type;
  });
  updatePaymentUI();
}

function getPaymentAmounts() {
  const total = parseFloat(els.totalPrice.value) || 0;
  if (getPaymentType() === 'full') {
    return { totalPrice: total, advancePaid: total, balanceDue: 0 };
  }
  const advance = Math.min(Math.max(0, parseFloat(els.advancePaid.value) || 0), total);
  return { totalPrice: total, advancePaid: advance, balanceDue: getBalanceDue(total, advance) };
}

function updatePaymentUI() {
  if (!els.balanceSummary) return;

  const total = parseFloat(els.totalPrice.value) || 0;
  const isAdvance = getPaymentType() === 'advance';

  if (els.advanceFieldWrap) {
    els.advanceFieldWrap.hidden = !isAdvance;
  }

  if (!isAdvance) {
    els.advancePaid.value = total;
  }

  const { advancePaid, balanceDue } = getPaymentAmounts();

  if (!isAdvance || balanceDue === 0) {
    els.balanceSummary.innerHTML = `
      <p class="text-[10px] uppercase tracking-wide text-emerald-600 font-semibold">${escapeHtml(t('labelPaymentStatus'))}</p>
      <p class="text-sm font-semibold text-emerald-700">${escapeHtml(t('paymentAllPaid'))}</p>
    `;
    return;
  }

  els.balanceSummary.innerHTML = `
    <p class="text-[10px] uppercase tracking-wide text-amber-600 font-semibold">${escapeHtml(t('labelBalanceOnPickup'))}</p>
    <p class="text-sm font-bold text-amber-800">${escapeHtml(formatCurrency(balanceDue))}</p>
    <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(t('paymentPaidSoFar', { amount: formatCurrency(advancePaid) }))}</p>
  `;
}

function updateTotalPriceFromBlazers() {
  const total = getBlazersFromForm().reduce((sum, b) => sum + getDefaultPrice(b.colorType), 0);
  els.totalPrice.value = total;
  updatePaymentUI();
}

function updateBalance() {
  updatePaymentUI();
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

function isPickupToday(rental) {
  return rental.status === 'Pending' && rental.pickupDate === todayISO();
}

function isGoingOutToday(rental) {
  return isPickupToday(rental);
}

function getRentalDisplayStatus(rental) {
  if (rental.status === 'Returned') return 'returned';
  if (isOverdue(rental)) return 'overdue';
  if (isPickupToday(rental)) return 'going-today';
  if (isReturnDueToday(rental)) return 'due-today';
  if (isUpcoming(rental)) return 'upcoming';
  return 'pending';
}

function getBlazerCountForRental(rental) {
  const blazers = Array.isArray(rental.blazers) ? rental.blazers : [];
  if (blazers.length > 0) {
    return blazers.filter((blazer) => blazer && (blazer.blazerCode || blazer.colorName || blazer.colorType)).length;
  }
  return rental.blazerCode ? 1 : 0;
}

function getRowStatus(rental) {
  return getRentalDisplayStatus(rental);
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
  pendingLocalWrites += 1;
  try {
    await persistRentals(rentals);
    setSyncState('saved');
  } catch (error) {
    console.error(error);
    setSyncState('error');
    alert(t('syncError'));
    throw error;
  } finally {
    pendingLocalWrites = Math.max(0, pendingLocalWrites - 1);
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
  setPaymentType('full');
  renderBlazerRows([{ blazerCode: '', colorName: '', colorType: 'Dark Color' }]);
  updateTotalPriceFromBlazers();
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
        code: formatBlazerCodes(rental),
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
  const payment = getPaymentAmounts();
  return {
    customerName: els.customerName.value.trim(),
    phoneNumber: els.phoneNumber.value.trim(),
    blazers: getBlazersFromForm(),
    bookingDate: els.bookingDate.value,
    pickupDate: els.pickupDate.value,
    returnDate: els.returnDate.value,
    totalPrice: payment.totalPrice,
    advancePaid: payment.advancePaid,
    balanceDue: payment.balanceDue,
    depositType: els.depositType.value,
    status: els.status.value,
    notes: els.notes.value.trim(),
  };
}

function populateForm(rental) {
  setBookingFormVisible(true);
  const normalized = normalizeRental(rental);
  els.editId.value = normalized.id;
  els.customerName.value = normalized.customerName;
  els.phoneNumber.value = normalized.phoneNumber;
  renderBlazerRows(normalized.blazers);
  els.bookingDate.value = normalized.bookingDate;
  els.pickupDate.value = normalized.pickupDate;
  returnDateManuallyEdited = true;
  els.returnDate.value = normalized.returnDate;
  els.totalPrice.value = normalized.totalPrice;
  const balance = getRentalBalance(normalized);
  if (balance > 0 && normalized.advancePaid < normalized.totalPrice) {
    setPaymentType('advance');
    els.advancePaid.value = normalized.advancePaid;
  } else {
    setPaymentType('full');
  }
  updatePaymentUI();
  els.depositType.value = normalized.depositType;
  els.status.value = normalized.status;
  els.notes.value = normalized.notes || '';
  els.cancelEditBtn.hidden = false;
  updateFormLabels();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function matchesSearch(rental, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const blazerCodes = getBlazerCodes(rental).join(' ').toLowerCase();
  const colorNames = (rental.blazers || []).map((b) => b.colorName).join(' ').toLowerCase();
  return (
    rental.customerName.toLowerCase().includes(q) ||
    rental.phoneNumber.toLowerCase().includes(q) ||
    blazerCodes.includes(q) ||
    colorNames.includes(q) ||
    (rental.notes || '').toLowerCase().includes(q)
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

function matchesQuickFilter(rental) {
  switch (activeQuickFilter) {
    case 'pickups-today': return isPickupToday(rental);
    case 'returns-today': return isReturnDueToday(rental);
    case 'overdue': return isOverdue(rental);
    case 'pending': return rental.status === 'Pending';
    case 'returned': return rental.status === 'Returned';
    default: return true;
  }
}

function getFilteredRentals() {
  const query = els.searchInput.value.trim();
  return rentals
    .filter((r) => matchesSearch(r, query) && matchesDateFilter(r) && matchesQuickFilter(r))
    .sort((a, b) => b.bookingDate.localeCompare(a.bookingDate) || b.id.localeCompare(a.id));
}

function getPaginatedRentals(filtered) {
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  return {
    page: currentPage,
    totalPages,
    items: filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE),
  };
}

function renderPagination(filteredLength) {
  if (!els.paginationControls) return;

  if (filteredLength === 0) {
    els.paginationControls.classList.add('hidden');
    els.paginationControls.innerHTML = '';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filteredLength / ITEMS_PER_PAGE));
  const startItem = filteredLength === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filteredLength);

  els.paginationControls.classList.remove('hidden');
  els.paginationControls.innerHTML = `
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-xs sm:text-sm text-slate-600">Showing ${startItem}-${endItem} of ${filteredLength}</p>
      <div class="flex items-center gap-2">
        <button type="button" data-page-action="prev" ${currentPage <= 1 ? 'disabled' : ''}
          class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${currentPage <= 1 ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}">
          Previous
        </button>
        <span class="min-w-[4.5rem] text-center text-xs sm:text-sm font-medium text-slate-600">Page ${currentPage}/${totalPages}</span>
        <button type="button" data-page-action="next" ${currentPage >= totalPages ? 'disabled' : ''}
          class="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${currentPage >= totalPages ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}">
          Next
        </button>
      </div>
    </div>
  `;
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
  activeQuickFilter = 'all';
  renderTable();
}

function renderQuickFilters() {
  els.quickFilters?.querySelectorAll('[data-quick-filter]').forEach((button) => {
    const isActive = button.dataset.quickFilter === activeQuickFilter;
    button.className = `quick-filter-btn inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${isActive
      ? 'border-brand-600 bg-brand-600 text-white'
      : 'border-slate-300 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700'}`;
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function setBookingFormVisible(visible) {
  if (!els.bookingFormSection) return;
  els.bookingFormSection.hidden = !visible;
  els.newBookingBtn?.setAttribute('aria-expanded', String(visible));

  if (visible) {
    requestAnimationFrame(() => {
      els.bookingFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      els.customerName?.focus({ preventScroll: true });
    });
  }
}

function renderPaymentCell(rental) {
  const balance = getRentalBalance(rental);
  if (balance <= 0) {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">${escapeHtml(t('paymentAllPaid'))}</span>`;
  }
  return `
    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">${escapeHtml(formatCurrency(balance))} ${escapeHtml(t('paymentDueShort'))}</span>
    <span class="block text-xs text-slate-500 mt-0.5">${escapeHtml(t('paymentPaidSoFar', { amount: formatCurrency(rental.advancePaid || 0) }))}</span>
  `;
}

function renderActionButtons(rental, compact = false) {
  const btnClass = compact
    ? 'flex-1 min-w-[3.7rem] px-1.5 py-1.5 sm:py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap'
    : 'px-1.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap';
  const balance = getRentalBalance(rental);

  return `
    <div class="flex flex-wrap items-center justify-end gap-1 ${compact ? 'rental-card-actions w-full' : 'table-action-group'}">
      <button type="button" data-action="download-receipt" data-id="${rental.id}"
        class="${btnClass} bg-violet-600 text-white hover:bg-violet-700">${escapeHtml(t('btnDownloadReceipt'))}</button>
      ${rental.status === 'Pending' && balance > 0
        ? `<button type="button" data-action="collect-balance" data-id="${rental.id}"
            class="${btnClass} bg-amber-500 text-white hover:bg-amber-600">${escapeHtml(t('btnCollectBalance'))}</button>`
        : ''}
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

function renderBlazerCodesCell(rental) {
  const codes = getBlazerCodes(rental);
  if (codes.length <= 1) {
    return `<span class="font-mono font-semibold">${escapeHtml(codes[0] || '—')}</span>`;
  }
  return codes.map((code) =>
    `<span class="inline-block font-mono font-semibold bg-slate-100 rounded px-1.5 py-0.5 mr-1 mb-0.5 text-xs">${escapeHtml(code)}</span>`
  ).join('');
}

function renderBlazerColorsCell(rental) {
  const blazers = rental.blazers || [];
  if (!blazers.length) return '—';
  return blazers.map((b) => `
    <span class="block">
      <span>${escapeHtml(b.colorName || '—')}</span>
      <span class="text-xs opacity-70">${escapeHtml(translateColorType(b.colorType))}</span>
    </span>
  `).join('');
}

function renderNotesCell(notes, maxLength = 28) {
  if (!notes) return '<span class="text-slate-400">—</span>';
  const truncated = notes.length > maxLength ? `${notes.slice(0, maxLength)}…` : notes;
  return `<span class="text-xs text-slate-600 line-clamp-2" title="${escapeHtml(notes)}">${escapeHtml(truncated)}</span>`;
}

function getPhoneLink(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : '#';
}

function renderPhoneLink(phone) {
  const safePhone = escapeHtml(phone || '—');
  const telHref = getPhoneLink(phone);
  if (!phone) return '<span class="text-slate-400">—</span>';
  return `<a href="${telHref}" class="phone-call-link" aria-label="Call ${safePhone}">${safePhone}</a>`;
}

function renderDetailsButton(rentalId, compact = false) {
  const btnClass = compact
    ? 'w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors'
    : 'inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors whitespace-nowrap';
  return `
    <button type="button" data-action="view-details" data-id="${rentalId}" class="${btnClass}" title="${escapeHtml(t('btnViewDetails'))}">
      <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      <span>${escapeHtml(t('btnViewDetails'))}</span>
    </button>`;
}

function renderDetailModalBlazers(rental) {
  const blazers = rental.blazers || [];
  if (!blazers.length) return `<p class="text-sm text-slate-500">${escapeHtml(t('emptyBlazers'))}</p>`;
  return blazers.map((blazer, index) => `
    <div class="detail-blazer-item">
      <div class="flex items-center justify-between gap-2 mb-1">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">${escapeHtml(t('detailBlazerNumber', { number: index + 1 }))}</span>
        <span class="font-mono text-sm font-bold text-slate-900">${escapeHtml(blazer.blazerCode || '—')}</span>
      </div>
      <p class="text-sm text-slate-700">${escapeHtml(blazer.colorName || '—')}</p>
      <p class="text-xs text-slate-500">${escapeHtml(translateColorType(blazer.colorType))} · ${escapeHtml(formatCurrency(getDefaultPrice(blazer.colorType)))}</p>
    </div>
  `).join('');
}

function buildReceiptHtml(rental) {
  const blazers = Array.isArray(rental.blazers) && rental.blazers.length ? rental.blazers : [{ blazerCode: rental.blazerCode || '—', colorName: rental.colorName || '—', colorType: rental.colorType || 'Dark Color' }];
  const rows = blazers.map((blazer) => `
    <tr>
      <td>${escapeHtml(blazer.blazerCode || '—')}</td>
      <td>${escapeHtml(blazer.colorName || '—')}</td>
      <td>${escapeHtml(translateColorType(blazer.colorType || 'Dark Color'))}</td>
      <td>${escapeHtml(formatCurrency(getDefaultPrice(blazer.colorType || 'Dark Color')))}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Madhusanka Tailors Rental Receipt</title>
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
        .receipt { max-width: 760px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 14px; padding: 28px; }
        .header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 20px; }
        .brand { font-size: 24px; font-weight: 700; }
        .label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 12px 22px; margin: 18px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 18px; }
        th, td { border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 14px; }
        th { background: #f8fafc; }
        .totals { margin-top: 18px; display: flex; justify-content: flex-end; }
        .totals-box { width: 260px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
        .row { display: flex; justify-content: space-between; margin-top: 8px; }
        .notes { margin-top: 18px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
        @media print { body { margin: 0; } .receipt { border: none; box-shadow: none; } }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <div>
            <div class="brand">Madhusanka Tailor's</div>
            <div class="label">Rental Receipt</div>
          </div>
          <div style="text-align: right;">
            <div class="label">Receipt No.</div>
            <div>${escapeHtml(rental.id || '—')}</div>
          </div>
        </div>

        <div class="grid">
          <div><div class="label">Customer</div><div>${escapeHtml(rental.customerName || '—')}</div></div>
          <div><div class="label">Phone</div><div>${escapeHtml(rental.phoneNumber || '—')}</div></div>
          <div><div class="label">Booking Date</div><div>${formatDate(rental.bookingDate)}</div></div>
          <div><div class="label">Pickup Date</div><div>${formatDate(rental.pickupDate)}</div></div>
          <div><div class="label">Return Date</div><div>${formatDate(rental.returnDate)}</div></div>
          <div><div class="label">Status</div><div>${escapeHtml(getDisplayStatusText(rental))}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Blazer Code</th>
              <th>Color</th>
              <th>Type</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-box">
            <div class="row"><span>Total</span><strong>${formatCurrency(rental.totalPrice || 0)}</strong></div>
            <div class="row"><span>Paid Now</span><strong>${formatCurrency(rental.advancePaid || 0)}</strong></div>
            <div class="row"><span>Balance</span><strong>${formatCurrency(getRentalBalance(rental))}</strong></div>
          </div>
        </div>

        ${rental.notes ? `<div class="notes"><div class="label">Notes</div><div>${escapeHtml(rental.notes)}</div></div>` : ''}
      </div>
    </body>
    </html>`;
}

async function downloadRentalReceipt(rental) {
  if (!window.html2canvas || !window.jspdf?.jsPDF) {
    showToast(t('toastPdfUnavailable'), 'error');
    return;
  }

  const source = new DOMParser().parseFromString(buildReceiptHtml(rental), 'text/html');
  const receipt = document.createElement('div');
  receipt.style.cssText = 'position:fixed;left:-10000px;top:0;width:824px;background:#fff;z-index:-1;';
  const styles = source.head.querySelector('style');
  if (styles) receipt.appendChild(styles.cloneNode(true));
  receipt.append(...Array.from(source.body.children).map((child) => child.cloneNode(true)));
  document.body.appendChild(receipt);

  const safeName = (rental.customerName || 'customer').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'receipt';
  try {
    const canvas = await window.html2canvas(receipt, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageHeight = (canvas.height * pageWidth) / canvas.width;
    const image = canvas.toDataURL('image/jpeg', 0.95);
    let remainingHeight = imageHeight;
    let position = 0;

    pdf.addImage(image, 'JPEG', 0, position, pageWidth, imageHeight);
    remainingHeight -= pageHeight;
    while (remainingHeight > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(image, 'JPEG', 0, position, pageWidth, imageHeight);
      remainingHeight -= pageHeight;
    }
    pdf.save(`Madhusanka Tailor's receipt-${safeName}.pdf`);
    showToast(t('toastReceiptDownloaded'), 'success');
  } catch (error) {
    console.error(error);
    showToast(t('toastPdfUnavailable'), 'error');
  } finally {
    receipt.remove();
  }
}



function renderDetailModalContent(rental) {
  const balance = getRentalBalance(rental);
  return `
    <div class="detail-modal-section">
      <div class="flex flex-wrap items-center gap-2 mb-4">
        ${renderStatusBadge(rental)}
        ${renderPaymentCell(rental)}
      </div>
      <dl class="detail-grid">
        <div class="detail-field">
          <dt>${escapeHtml(t('labelPhoneNumber'))}</dt>
          <dd>${renderPhoneLink(rental.phoneNumber)}</dd>
        </div>
        <div class="detail-field">
          <dt>${escapeHtml(t('labelBookingDate'))}</dt>
          <dd>${formatDate(rental.bookingDate)}</dd>
        </div>
        <div class="detail-field">
          <dt>${escapeHtml(t('labelPickupDate'))}</dt>
          <dd>${formatDate(rental.pickupDate)}</dd>
        </div>
        <div class="detail-field">
          <dt>${escapeHtml(t('labelReturnDate'))}</dt>
          <dd class="font-semibold">${formatDate(rental.returnDate)}</dd>
        </div>
        <div class="detail-field">
          <dt>${escapeHtml(t('labelDepositType'))}</dt>
          <dd>${escapeHtml(translateDeposit(rental.depositType))}</dd>
        </div>
        <div class="detail-field">
          <dt>${escapeHtml(t('labelStatus'))}</dt>
          <dd>${escapeHtml(getDisplayStatusText(rental))}</dd>
        </div>
      </dl>
    </div>

    <div class="detail-modal-section">
      <h3 class="detail-section-title">${escapeHtml(t('labelBlazers'))}</h3>
      <div class="detail-blazer-list">${renderDetailModalBlazers(rental)}</div>
    </div>

    <div class="detail-modal-section">
      <h3 class="detail-section-title">${escapeHtml(t('labelPayment'))}</h3>
      <dl class="detail-grid">
        <div class="detail-field">
          <dt>${escapeHtml(t('labelTotalPrice'))}</dt>
          <dd class="font-semibold">${formatCurrency(rental.totalPrice)}</dd>
        </div>
        <div class="detail-field">
          <dt>${escapeHtml(t('labelPaidNow'))}</dt>
          <dd>${formatCurrency(rental.advancePaid || 0)}</dd>
        </div>
        <div class="detail-field">
          <dt>${escapeHtml(t('labelBalanceDue'))}</dt>
          <dd class="${balance > 0 ? 'text-amber-700 font-bold' : 'text-emerald-700 font-semibold'}">${balance > 0 ? formatCurrency(balance) : escapeHtml(t('paymentAllPaid'))}</dd>
        </div>
      </dl>
    </div>

    ${rental.notes ? `
    <div class="detail-modal-section">
      <h3 class="detail-section-title">${escapeHtml(t('labelNotes'))}</h3>
      <p class="detail-notes">${escapeHtml(rental.notes)}</p>
    </div>` : ''}

    <div class="detail-modal-section">
      <h3 class="detail-section-title">${escapeHtml(t('labelStatus'))}</h3>
      <div class="flex flex-wrap items-center gap-2">
        ${renderStatusBadge(rental)}
        <span class="text-sm text-slate-600">${escapeHtml(translateStatus(rental.status))}</span>
      </div>
    </div>
  `;
}

function openDetailModal(rentalId) {
  const rental = rentals.find((r) => r.id === rentalId);
  if (!rental || !els.detailModal) return;

  activeDetailRentalId = rentalId;
  els.detailModalTitle.textContent = rental.customerName;
  els.detailModalBody.innerHTML = renderDetailModalContent(rental);
  els.detailModalActions.innerHTML = renderActionButtons(rental, true);

  els.detailModal.classList.remove('hidden');
  els.detailModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeDetailModal() {
  if (!els.detailModal) return;
  activeDetailRentalId = null;
  els.detailModal.classList.add('hidden');
  els.detailModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function refreshDetailModalIfOpen() {
  if (!activeDetailRentalId) return;
  const rental = rentals.find((r) => r.id === activeDetailRentalId);
  if (!rental) {
    closeDetailModal();
    return;
  }
  els.detailModalTitle.textContent = rental.customerName;
  els.detailModalBody.innerHTML = renderDetailModalContent(rental);
  els.detailModalActions.innerHTML = renderActionButtons(rental, true);
}

function renderRentalCard(rental) {
  const card = document.createElement('article');
  card.className = getCardClass(rental);
  card.innerHTML = `
    <div class="flex items-start justify-between gap-2 mb-3">
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold text-slate-900 truncate">${escapeHtml(rental.customerName)}</h3>
        <p class="text-xs text-slate-500 mt-0.5">${renderPhoneLink(rental.phoneNumber)}</p>
      </div>
      <div class="shrink-0">${renderStatusBadge(rental)}</div>
    </div>
    <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:text-sm mb-3">
      <div>
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thBooking'))}</dt>
        <dd>${formatDate(rental.bookingDate)}</dd>
      </div>
      <div>
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thCode'))}</dt>
        <dd class="font-mono font-semibold">${renderBlazerCodesCell(rental)}</dd>
      </div>
      <div class="col-span-2">
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thColor'))}</dt>
        <dd>${renderBlazerColorsCell(rental)}</dd>
      </div>
      <div>
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thPrice'))}</dt>
        <dd>${formatCurrency(rental.totalPrice)}</dd>
      </div>
      <div>
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thPayment'))}</dt>
        <dd>${renderPaymentCell(rental)}</dd>
      </div>
      ${rental.notes ? `
      <div class="col-span-2">
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thNotes'))}</dt>
        <dd class="text-slate-600">${renderNotesCell(rental.notes, 60)}</dd>
      </div>` : ''}
      <div class="col-span-2">
        <dt class="text-slate-400 text-[10px] sm:text-xs uppercase tracking-wide">${escapeHtml(t('thStatus'))}</dt>
        <dd>${renderStatusBadge(rental)}</dd>
      </div>
    </dl>
    ${renderDetailsButton(rental.id, true)}
  `;
  return card;
}

function setRentalsViewVisible(show) {
  [els.rentalsCards, els.tableScroll, els.mobileCardsHint].forEach((el) => {
    if (el) el.classList.toggle('empty-hidden', !show);
  });
}

function getDisplayStatusText(rental) {
  const rowStatus = getRowStatus(rental);

  if (rowStatus === 'returned') return t('statusReturned');
  if (rowStatus === 'overdue') return t('badgeOverdue');
  if (rowStatus === 'going-today') return t('badgeGoingToday');
  if (rowStatus === 'due-today') return t('badgeDueToday');
  if (rowStatus === 'upcoming') return t('badgeUpcoming');
  if (rowStatus === 'pending') return t('badgePending');
  return t('statusPending');
}

function renderStatusBadge(rental) {
  const rowStatus = getRowStatus(rental);

  if (rowStatus === 'returned') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">${escapeHtml(t('badgeReturned'))}</span>`;
  }
  if (rowStatus === 'overdue') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white uppercase tracking-wide">${escapeHtml(t('badgeOverdue'))}</span>`;
  }
  if (rowStatus === 'going-today') {
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">${escapeHtml(t('badgeGoingToday'))}</span>`;
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
  const { items: paginatedRentals } = getPaginatedRentals(filtered);

  els.tableBody.innerHTML = '';
  els.rentalsCards.innerHTML = '';

  if (filtered.length === 0) {
    currentPage = 1;
    updateEmptyState(rentals.length > 0, false);
    els.emptyState.classList.remove('hidden');
    setRentalsViewVisible(false);
    renderPagination(0);
    return;
  }

  els.emptyState.classList.add('hidden');
  setRentalsViewVisible(true);

  paginatedRentals.forEach((rental) => {
    els.rentalsCards.appendChild(renderRentalCard(rental));

    const tr = document.createElement('tr');
    tr.className = getRowClass(rental);
    tr.innerHTML = `
      <td class="px-3 py-3 whitespace-nowrap">${formatDate(rental.bookingDate)}</td>
      <td class="px-3 py-3 whitespace-nowrap font-medium max-w-[8rem] truncate" title="${escapeHtml(rental.customerName)}">${escapeHtml(rental.customerName)}</td>
      <td class="px-3 py-3 whitespace-nowrap">${renderBlazerCodesCell(rental)}</td>
      <td class="px-3 py-3 whitespace-nowrap">${formatDate(rental.returnDate)}</td>
      <td class="px-3 py-3 whitespace-nowrap">${renderPaymentCell(rental)}</td>
      <td class="px-3 py-3 whitespace-nowrap">${renderStatusBadge(rental)}</td>
      <td class="px-2 py-3 whitespace-nowrap text-right">${renderDetailsButton(rental.id)}</td>
    `;
    els.tableBody.appendChild(tr);
  });

  renderPagination(filtered.length);
}

function getTodaySales() {
  const today = todayISO();
  return rentals
    .filter((rental) => rental.bookingDate === today)
    .reduce((sum, rental) => sum + (Number(rental.totalPrice) || 0), 0);
}

function getMonthlyRevenue() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  return rentals
    .filter((rental) => rental.bookingDate && rental.bookingDate.slice(0, 7) === currentMonth)
    .reduce((sum, rental) => sum + (Number(rental.totalPrice) || 0), 0);
}

function getTopColors() {
  const counts = new Map();

  rentals.forEach((rental) => {
    (rental.blazers || []).forEach((blazer) => {
      const colorName = (blazer?.colorName || '').trim();
      if (!colorName) return;
      counts.set(colorName, (counts.get(colorName) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} (${count})`);
}

function getOverdueRate() {
  const pending = rentals.filter((rental) => rental.status === 'Pending').length;
  if (!pending) return 0;
  const overdue = rentals.filter(isOverdue).length;
  return Math.round((overdue / pending) * 100);
}

function renderAnalytics() {
  if (!els.analyticsDailySalesValue || !els.analyticsMonthlyRevenueValue || !els.analyticsTopColorsValue || !els.analyticsOverdueRateValue) {
    return;
  }

  const topColors = getTopColors();
  const dailySales = getTodaySales();
  const monthlyRevenue = getMonthlyRevenue();
  const overdueRate = getOverdueRate();

  els.analyticsDailySalesValue.textContent = formatCurrency(dailySales);
  els.analyticsMonthlyRevenueValue.textContent = formatCurrency(monthlyRevenue);
  els.analyticsTopColorsValue.textContent = topColors.length ? topColors.join(' · ') : t('analyticsNoData');
  els.analyticsOverdueRateValue.textContent = `${overdueRate}%`;
}

function downloadTextFile(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Leave the object URL available until the browser has started the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function escapeCsvValue(value) {
  let text = String(value ?? '');

  // Excel evaluates cells beginning with these characters as formulas. Prefixing
  // them with an apostrophe preserves the source value as text in an audit export.
  if (/^\s*[=+\-@]/.test(text)) text = `'${text}`;

  return `"${text.replace(/"/g, '""')}"`;
}

function getExportCsvRows(items) {
  const header = [
    'Booking ID',
    'Customer Name',
    'Phone Number',
    'Blazer Codes',
    'Colors',
    'Booking Date',
    'Pickup Date',
    'Return Date',
    'Status',
    'Total Price',
    'Advance Paid',
    'Balance Due',
    'Deposit Type',
    'Notes',
    'Late Penalty',
  ];

  const rows = items.map((rental) => {
    const blazers = (rental.blazers || []).map((blazer) => blazer.blazerCode || '').filter(Boolean).join('; ');
    const colors = (rental.blazers || []).map((blazer) => `${blazer.colorName || ''} (${blazer.colorType || 'Dark Color'})`).filter(Boolean).join('; ');
    const latePenalty = Number(rental.latePenalty || 0);
    const balanceDue = getRentalBalance(rental);

    return [
      rental.id || '',
      rental.customerName || '',
      rental.phoneNumber || '',
      blazers,
      colors,
      rental.bookingDate || '',
      rental.pickupDate || '',
      rental.returnDate || '',
      rental.status || '',
      Number(rental.totalPrice || 0),
      Number(rental.advancePaid || 0),
      balanceDue,
      rental.depositType || '',
      rental.notes || '',
      latePenalty,
    ];
  });

  return [header, ...rows];
}

function exportBookingsCsv() {
  const exportedRentals = getFilteredRentals();
  if (!exportedRentals.length) {
    showToast(t('toastNoDataToExport'), 'info');
    return;
  }

  const csvRows = getExportCsvRows(exportedRentals)
    .map((row) => row.map(escapeCsvValue).join(','));

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  // The BOM makes Sinhala names and notes display correctly when the file is
  // opened directly in Microsoft Excel.
  downloadTextFile(`blazer-rental-bookings-${stamp}.csv`, `\uFEFF${csvRows.join('\n')}\n`, 'text/csv;charset=utf-8');
  showToast(t('toastExportedCsv'), 'success');
}

function backupRentalData() {
  if (!rentals.length) {
    showToast(t('toastNoDataToExport'), 'info');
    return;
  }

  const backup = {
    format: 'madhusanka-tailors-rental-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    application: 'Blazer Rental Management',
    totalBookings: rentals.length,
    rentals: normalizeRentals(rentals).map((rental) => ({
      ...sanitizeRentalForSave(rental),
      balanceDue: getRentalBalance(rental),
    })),
  };

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadTextFile(`blazer-rental-backup-${stamp}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
  showToast(t('toastBackupCreated'), 'success');
}

function renderStats() {
  const today = todayISO();
  const total = rentals.length;
  const active = rentals.filter((r) => r.status === 'Pending').length;
  const overdue = rentals.filter(isOverdue).length;
  const todayReturns = rentals.filter(isReturnDueToday).length;
  const todayGoingBlazers = rentals
    .filter(isGoingOutToday)
    .reduce((sum, rental) => sum + getBlazerCountForRental(rental), 0);
  const outstandingBalance = rentals
    .filter((rental) => rental.status === 'Pending')
    .reduce((sum, rental) => sum + getRentalBalance(rental), 0);

  els.statTotal.textContent = total;
  els.statActive.textContent = active;
  els.statOverdue.textContent = overdue;
  els.statTodayReturns.textContent = todayReturns;
  els.statTodayGoingBlazers.textContent = todayGoingBlazers;
  els.statOutstandingBalance.textContent = formatCurrency(outstandingBalance);

  const dateObj = new Date(today + 'T12:00:00');
  els.todayDisplay.textContent = dateObj.toLocaleDateString(getDateLocale(), {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function render() {
  renderStats();
  renderAnalytics();
  renderQuickFilters();
  renderTable();
  applyI18n();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container || !message) return;

  const currentToast = container.querySelector('.toast-item');
  if (currentToast) {
    clearTimeout(Number(currentToast.dataset.timeoutId || 0));
    currentToast.classList.add('opacity-0', 'translate-y-1', 'transition', 'duration-200');
    setTimeout(() => currentToast.remove(), 200);
  }

  const toast = document.createElement('div');
  const tone = {
    success: 'bg-emerald-600 text-white border-emerald-500',
    error: 'bg-red-600 text-white border-red-500',
    info: 'bg-brand-600 text-white border-brand-500',
  };

  toast.className = `toast-item pointer-events-auto w-full rounded-lg border px-3 py-2 text-xs font-medium shadow-lg text-white sm:text-sm ${tone[type] || tone.info}`;
  toast.textContent = message;
  toast.dataset.toastMessage = message;
  toast.dataset.toastType = type;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('opacity-100');
  });

  const timeoutId = setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-1', 'transition', 'duration-200');
    setTimeout(() => toast.remove(), 200);
  }, 2200);
  toast.dataset.timeoutId = String(timeoutId);
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

  if (!data.blazers.length || data.blazers.some((b) => !b.blazerCode || !b.colorName)) {
    alert(t('alertBlazerRequired'));
    return;
  }

  if (getPaymentType() === 'advance') {
    const total = data.totalPrice;
    const paid = data.advancePaid;
    if (paid <= 0) {
      alert(t('alertAdvanceRequired'));
      return;
    }
    if (paid >= total) {
      alert(t('alertAdvanceTooMuch'));
      return;
    }
  }

  const editId = els.editId.value;
  if (editId) {
    const idx = rentals.findIndex((r) => r.id === editId);
    if (idx !== -1) {
      rentals[idx] = sanitizeRentalForSave({ ...rentals[idx], ...data });
    }
  } else {
    rentals.push(sanitizeRentalForSave({ id: generateId(), ...data }));
  }

  setSubmitButtonLoading(true);
  saveRentals()
    .then(() => {
      const successMessage = els.editId.value ? t('toastBookingUpdated') : t('toastBookingSaved');
      showToast(successMessage, 'success');
      resetForm();
      setBookingFormVisible(false);
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

  if (action === 'close-modal') {
    closeDetailModal();
    return;
  }

  if (action === 'view-details') {
    openDetailModal(id);
    return;
  }

  const rental = rentals.find((r) => r.id === id);
  if (!rental) return;

  if (action === 'download-receipt') {
    downloadRentalReceipt(rental);
    return;
  }
  if (!rental) return;

  const afterAction = () => {
    refreshDetailModalIfOpen();
    render();
  };

  if (action === 'return') {
    rental.status = 'Returned';
    saveRentals()
      .then(() => {
        showToast(t('toastBookingReturned'), 'success');
        afterAction();
      })
      .catch(() => {
        showToast(t('toastSyncError'), 'error');
      });
  } else if (action === 'collect-balance') {
    rental.advancePaid = rental.totalPrice;
    rental.balanceDue = 0;
    saveRentals()
      .then(() => {
        showToast(t('toastBalanceCollected'), 'success');
        afterAction();
      })
      .catch(() => {
        showToast(t('toastSyncError'), 'error');
      });
  } else if (action === 'edit') {
    closeDetailModal();
    populateForm(rental);
  } else if (action === 'delete') {
    if (confirm(t('confirmDelete', { name: rental.customerName, code: formatBlazerCodes(rental) }))) {
      rentals = rentals.filter((r) => r.id !== id);
      saveRentals()
        .then(() => {
          showToast(t('toastBookingDeleted'), 'success');
          if (els.editId.value === id) resetForm();
          closeDetailModal();
        })
        .catch(() => {
          showToast(t('toastSyncError'), 'error');
        });
    }
  }
}

function initEventListeners() {
  els.analyticsToggleBtn?.addEventListener('click', () => {
    const isHidden = els.analyticsPanel.classList.contains('hidden');
    if (isHidden) {
      els.analyticsPanel.classList.remove('hidden');
      els.analyticsToggleIcon.classList.add('rotate-180');
    } else {
      els.analyticsPanel.classList.add('hidden');
      els.analyticsToggleIcon.classList.remove('rotate-180');
    }
  });

  els.form.addEventListener('submit', handleSubmit);
  els.cancelEditBtn.addEventListener('click', () => {
    resetForm();
    setBookingFormVisible(false);
  });
  els.newBookingBtn?.addEventListener('click', () => {
    resetForm();
    setBookingFormVisible(true);
  });
  els.tableBody.addEventListener('click', handleTableClick);
  els.rentalsCards.addEventListener('click', handleTableClick);
  els.detailModal?.addEventListener('click', handleTableClick);
  els.detailModalActions?.addEventListener('click', handleTableClick);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeDetailRentalId) {
      closeDetailModal();
    }
  });

  els.searchInput.addEventListener('input', () => {
    currentPage = 1;
    renderTable();
  });
  els.dateFilterField.addEventListener('change', () => {
    currentPage = 1;
    renderTable();
  });
  els.dateFrom.addEventListener('change', () => {
    currentPage = 1;
    renderTable();
  });
  els.dateTo.addEventListener('change', () => {
    currentPage = 1;
    renderTable();
  });
  els.clearFiltersBtn.addEventListener('click', () => {
    currentPage = 1;
    clearFilters();
  });
  els.quickFilters?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-quick-filter]');
    if (!button) return;
    activeQuickFilter = button.dataset.quickFilter || 'all';
    currentPage = 1;
    renderTable();
    renderQuickFilters();
  });
  els.exportCsvBtn?.addEventListener('click', exportBookingsCsv);
  els.backupDataBtn?.addEventListener('click', backupRentalData);
  els.paginationControls?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page-action]');
    if (!button) return;

    const action = button.dataset.pageAction;
    const filtered = getFilteredRentals();
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

    if (action === 'prev' && currentPage > 1) {
      currentPage -= 1;
      renderTable();
    }

    if (action === 'next' && currentPage < totalPages) {
      currentPage += 1;
      renderTable();
    }
  });

  els.addBlazerBtn?.addEventListener('click', () => {
    els.blazersList.appendChild(createBlazerRow({ colorType: 'Dark Color' }));
    updateRemoveButtons();
    updateTotalPriceFromBlazers();
  });

  document.querySelectorAll('input[name="paymentType"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (getPaymentType() === 'advance') {
        const total = parseFloat(els.totalPrice.value) || 0;
        const current = parseFloat(els.advancePaid.value) || 0;
        if (current >= total) {
          els.advancePaid.value = '';
        }
      }
      updatePaymentUI();
    });
  });

  els.advancePaid.addEventListener('input', updatePaymentUI);

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
      rentals = normalizeRentals(items);

      // A local write immediately creates a Firestore snapshot. The action that
      // made that write already shows a specific success toast, so do not show a
      // second generic snapshot toast for the same change.
      if (hasLoadedCloudData && pendingLocalWrites === 0) {
        notifyRemoteBookingChange(previousItems, items);
      }

      hasLoadedCloudData = true;
      hideAppLoading();
      setSyncState('saved');
      refreshDetailModalIfOpen();
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
    const currentBlazers = getBlazersFromForm();
    if (els.blazersList?.children.length > 0) {
      renderBlazerRows(currentBlazers);
    }
    updatePaymentUI();
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
