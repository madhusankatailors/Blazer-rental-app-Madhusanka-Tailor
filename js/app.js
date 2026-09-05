import { requireAuth, logout } from './auth.js';
import { subscribeRentals, saveRentals as persistRentals, updateRentalStatus } from './storage.js';

const PRICES = { 'Light Color': 2000, 'Dark Color': 1750 };

let rentals = [];
let returnDateManuallyEdited = false;
let hasLoadedCloudData = false;
let pendingLocalWrites = 0;
let syncState = 'loading';
let previousSnapshot = [];
let activeDetailRentalId = null;
let activeQuickFilter = 'all';
let pendingRestore = null;
let previewReceiptRentalId = null;
let calendarMonth = new Date(`${todayISO()}T12:00:00`);
let selectedCalendarDate = todayISO();
const ITEMS_PER_PAGE = 10;
let currentPage = 1;

const $ = (id) => document.getElementById(id);

const els = {
  form: $('rentalForm'),
  editId: $('editId'),
  customerName: $('customerName'),
  phoneNumber: $('phoneNumber'),
  phoneNumber2: $('phoneNumber2'),
  phoneNumber2Toggle: $('phoneNumber2Toggle'),
  phoneNumber2Wrap: $('phoneNumber2Wrap'),
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
  restoreBackupInput: $('restoreBackupInput'),
  restorePreviewModal: $('restorePreviewModal'),
  restorePreviewBody: $('restorePreviewBody'),
  restoreMergeBtn: $('restoreMergeBtn'),
  restoreReplaceBtn: $('restoreReplaceBtn'),
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
  analyticsDailyCard: $('analyticsDailyCard'),
  analyticsMonthlyCard: $('analyticsMonthlyCard'),
  analyticsHistoryModal: $('analyticsHistoryModal'),
  analyticsHistoryTitle: $('analyticsHistoryTitle'),
  analyticsHistoryBody: $('analyticsHistoryBody'),
  rentalReceiptPreviewModal: $('rentalReceiptPreviewModal'),
  rentalReceiptPreviewScroll: $('rentalReceiptPreviewScroll'),
  rentalReceiptPaperStage: $('rentalReceiptPaperStage'),
  rentalReceiptPdfBtn: $('rentalReceiptPdfBtn'),
  rentalReceiptWhatsAppBtn: $('rentalReceiptWhatsAppBtn'),
  analyticsTopColorsValue: $('analyticsTopColorsValue'),
  analyticsOverdueRateValue: $('analyticsOverdueRateValue'),
  syncStatus: $('syncStatus'),
  appLoading: $('appLoading'),
  logoutBtn: $('logoutBtn'),
  paginationControls: $('paginationControls'),
  analyticsToggleBtn: $('analyticsToggleBtn'),
  analyticsToggleIcon: $('analyticsToggleIcon'),
  analyticsPanel: $('analyticsPanel'),
  calendarPrevBtn: $('calendarPrevBtn'),
  calendarToggleBtn: $('calendarToggleBtn'),
  calendarContent: $('calendarContent'),
  calendarTodayBtn: $('calendarTodayBtn'),
  calendarNextBtn: $('calendarNextBtn'),
  calendarMonthLabel: $('calendarMonthLabel'),
  calendarGrid: $('calendarGrid'),
  calendarSelectedDate: $('calendarSelectedDate'),
  calendarEvents: $('calendarEvents'),
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

function getBlazerPrice(blazer) {
  if (blazer?.colorType === 'Custom Price') {
    return Math.max(0, Number(blazer.customPrice) || 0);
  }
  return getDefaultPrice(blazer?.colorType || 'Dark Color');
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
  const customPrice = Number(data.customPrice) >= 0 && data.customPrice !== '' && data.customPrice != null
    ? Number(data.customPrice)
    : '';
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
      <div class="flex flex-col xs:flex-row xs:flex-wrap gap-2 sm:gap-3">
        <label class="inline-flex items-center gap-2 cursor-pointer select-none">
          <input type="radio" name="colorType-${rowId}" data-field="colorType" value="Light Color" class="blazer-color-type shrink-0" ${colorType === 'Light Color' ? 'checked' : ''} />
          <span class="text-xs sm:text-sm">${escapeHtml(t('colorLight'))} <span class="text-slate-400">(Rs. 2000)</span></span>
        </label>
        <label class="inline-flex items-center gap-2 cursor-pointer select-none">
          <input type="radio" name="colorType-${rowId}" data-field="colorType" value="Dark Color" class="blazer-color-type shrink-0" ${colorType === 'Dark Color' ? 'checked' : ''} />
          <span class="text-xs sm:text-sm">${escapeHtml(t('colorDark'))} <span class="text-slate-400">(Rs. 1750)</span></span>
        </label>
        <label class="inline-flex items-center gap-2 cursor-pointer select-none">
          <input type="radio" name="colorType-${rowId}" data-field="colorType" value="Custom Price" class="blazer-color-type shrink-0" ${colorType === 'Custom Price' ? 'checked' : ''} />
          <span class="text-xs sm:text-sm">${escapeHtml(t('colorCustom'))}</span>
        </label>
      </div>
      <div class="blazer-custom-price-wrap mt-2 ${colorType === 'Custom Price' ? '' : 'hidden'}">
        <label class="block text-xs font-medium text-slate-600 mb-1">${escapeHtml(t('labelCustomPrice'))}</label>
        <input type="number" min="0" step="1"
          class="blazer-custom-price w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          placeholder="${escapeHtml(t('placeholderCustomPrice'))}" value="${escapeHtml(String(customPrice))}" ${colorType === 'Custom Price' ? 'required' : 'disabled'} />
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

  const syncCustomPriceUI = () => {
    const isCustom = row.querySelector('.blazer-color-type:checked')?.value === 'Custom Price';
    const wrap = row.querySelector('.blazer-custom-price-wrap');
    const input = row.querySelector('.blazer-custom-price');
    wrap?.classList.toggle('hidden', !isCustom);
    if (input) {
      input.disabled = !isCustom;
      input.required = isCustom;
    }
  };

  row.querySelectorAll('.blazer-color-type').forEach((input) => {
    input.addEventListener('change', () => {
      syncCustomPriceUI();
      updateTotalPriceFromBlazers();
    });
  });

  row.querySelector('.blazer-custom-price')?.addEventListener('input', updateTotalPriceFromBlazers);
  syncCustomPriceUI();

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
    const colorType = colorTypeInput?.value || 'Dark Color';
    return {
      _rowId: row.dataset.rowId,
      blazerCode: row.querySelector('.blazer-code')?.value.trim() || '',
      colorName: row.querySelector('.blazer-color')?.value.trim() || '',
      colorType,
      customPrice: colorType === 'Custom Price'
        ? Math.max(0, Number(row.querySelector('.blazer-custom-price')?.value) || 0)
        : 0,
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
  if (checked?.value === 'advance') return 'advance';
  if (checked?.value === 'unpaid') return 'unpaid';
  return 'full';
}

function setSecondPhoneVisible(visible) {
  if (!els.phoneNumber2Wrap) return;
  els.phoneNumber2Wrap.classList.toggle('hidden', !visible);
  els.phoneNumber2Toggle?.setAttribute('aria-expanded', String(visible));
  if (els.phoneNumber2Toggle) els.phoneNumber2Toggle.textContent = visible ? '−' : '+';
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
  if (getPaymentType() === 'unpaid') {
    return { totalPrice: total, advancePaid: 0, balanceDue: total };
  }
  const advance = Math.min(Math.max(0, parseFloat(els.advancePaid.value) || 0), total);
  return { totalPrice: total, advancePaid: advance, balanceDue: getBalanceDue(total, advance) };
}

function updatePaymentUI() {
  if (!els.balanceSummary) return;

  const total = parseFloat(els.totalPrice.value) || 0;
  const paymentType = getPaymentType();
  const isAdvance = paymentType === 'advance';
  const isUnpaid = paymentType === 'unpaid';

  if (els.advanceFieldWrap) {
    els.advanceFieldWrap.hidden = !isAdvance;
  }

  if (!isAdvance) {
    els.advancePaid.value = total;
  }

  if (isUnpaid) {
    els.advancePaid.value = 0;
  }

  const { advancePaid, balanceDue } = getPaymentAmounts();

  if (!isAdvance && !isUnpaid || balanceDue === 0) {
    els.balanceSummary.innerHTML = `
      <p class="text-[10px] uppercase tracking-wide text-emerald-600 font-semibold">${escapeHtml(t('labelPaymentStatus'))}</p>
      <p class="text-sm font-semibold text-emerald-700">${escapeHtml(t('paymentAllPaid'))}</p>
    `;
    return;
  }

  if (isUnpaid) {
    els.balanceSummary.innerHTML = `
      <p class="text-[10px] uppercase tracking-wide text-red-600 font-semibold">${escapeHtml(t('labelPaymentStatus'))}</p>
      <p class="text-sm font-bold text-red-700">${escapeHtml(t('paymentNotPaid'))}</p>
      <p class="text-xs text-slate-500 mt-0.5">${escapeHtml(t('paymentDueOnReturn', { amount: formatCurrency(balanceDue) }))}</p>
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
  const total = getBlazersFromForm().reduce((sum, blazer) => sum + getBlazerPrice(blazer), 0);
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
  setSecondPhoneVisible(false);
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
    phoneNumber2: els.phoneNumber2.value.trim(),
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
  els.phoneNumber2.value = normalized.phoneNumber2 || '';
  setSecondPhoneVisible(Boolean(els.phoneNumber2.value));
  renderBlazerRows(normalized.blazers);
  els.bookingDate.value = normalized.bookingDate;
  els.pickupDate.value = normalized.pickupDate;
  returnDateManuallyEdited = true;
  els.returnDate.value = normalized.returnDate;
  els.totalPrice.value = normalized.totalPrice;
  const balance = getRentalBalance(normalized);
  if (balance > 0 && normalized.advancePaid < normalized.totalPrice) {
    setPaymentType(normalized.advancePaid > 0 ? 'advance' : 'unpaid');
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
    (rental.phoneNumber2 || '').toLowerCase().includes(q) ||
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
      ${balance > 0
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

function getWhatsAppNumber(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Customer numbers are usually saved locally as 07X XXX XXXX. WhatsApp
  // requires the international form, without the leading plus sign.
  if (/^0?7\d{8}$/.test(digits)) {
    digits = `94${digits.replace(/^0/, '')}`;
  }
  return digits;
}

function openReceiptWhatsApp(rental) {
  const number = getWhatsAppNumber(rental.phoneNumber);
  if (!number) {
    showToast(t('toastWhatsAppPhoneMissing'), 'error');
    return;
  }

  const message = t('shareReceiptWhatsAppText', { name: rental.customerName || '' });
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

function dateToISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCalendarEvents(date) {
  return rentals.flatMap((rental) => {
    if (rental.status !== 'Pending') return [];
    const events = [];
    if (rental.pickupDate === date) events.push({ rental, type: 'pickup' });
    if (rental.returnDate === date) events.push({ rental, type: 'return' });
    return events;
  });
}

function openWhatsAppReminder(rental, type) {
  const number = getWhatsAppNumber(rental.phoneNumber);
  if (!number) {
    showToast(t('toastWhatsAppPhoneMissing'), 'error');
    return;
  }

  const isReturn = type === 'return';
  const date = formatDate(isReturn ? rental.returnDate : rental.pickupDate);
  const messageKey = isReturn
    ? 'whatsAppReturnReminder'
    : type === 'upcoming' ? 'whatsAppUpcomingReminder' : 'whatsAppPickupReminder';
  const message = t(messageKey, {
    name: rental.customerName || '',
    date,
  });
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

function renderCalendar() {
  if (!els.calendarGrid || !els.calendarEvents || !els.calendarMonthLabel) return;

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  els.calendarMonthLabel.textContent = new Intl.DateTimeFormat(getDateLocale(), {
    month: 'long', year: 'numeric',
  }).format(new Date(year, month, 1));

  const weekdayFormatter = new Intl.DateTimeFormat(getDateLocale(), { weekday: 'short' });
  const weekdayHeaders = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(2024, 0, 1 + index); // Monday through Sunday
    return `<div class="bg-slate-100 px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">${escapeHtml(weekdayFormatter.format(date))}</div>`;
  }).join('');

  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const blanks = Array.from({ length: firstDayOffset }, () => '<div class="calendar-day calendar-day-empty bg-slate-50/70"></div>').join('');
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(year, month, index + 1);
    const iso = dateToISO(date);
    const events = getCalendarEvents(iso);
    const pickupCount = events.filter((event) => event.type === 'pickup').length;
    const upcomingPickupCount = events.filter((event) => event.type === 'pickup' && compareDates(iso, todayISO()) > 0).length;
    const todayPickupCount = pickupCount - upcomingPickupCount;
    const returnCount = events.filter((event) => event.type === 'return').length;
    const isToday = iso === todayISO();
    const isSelected = iso === selectedCalendarDate;
    const title = events.length
      ? `${todayPickupCount ? `${todayPickupCount} ${t('calendarPickup')}` : ''}${todayPickupCount && upcomingPickupCount ? ' · ' : ''}${upcomingPickupCount ? `${upcomingPickupCount} ${t('calendarUpcoming')}` : ''}${(todayPickupCount || upcomingPickupCount) && returnCount ? ' · ' : ''}${returnCount ? `${returnCount} ${t('calendarReturn')}` : ''}`
      : '';
    return `<button type="button" data-calendar-date="${iso}" title="${escapeHtml(title)}" aria-label="${escapeHtml(`${index + 1}${title ? `, ${title}` : ''}`)}" class="calendar-day bg-white p-1.5 text-left transition-colors hover:bg-brand-50 ${isSelected ? 'ring-2 ring-inset ring-brand-500' : ''}">
      <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${isToday ? 'bg-brand-600 text-white' : 'text-slate-700'}">${index + 1}</span>
      <span class="mt-1 flex flex-wrap gap-1">${todayPickupCount ? `<span class="rounded bg-sky-100 px-1 py-0.5 text-[9px] font-bold text-sky-800">P ${todayPickupCount}</span>` : ''}${upcomingPickupCount ? `<span class="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-800">P ${upcomingPickupCount}</span>` : ''}${returnCount ? `<span class="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-800">R ${returnCount}</span>` : ''}</span>
    </button>`;
  }).join('');
  els.calendarGrid.innerHTML = weekdayHeaders + blanks + days;

  const selected = new Date(`${selectedCalendarDate}T12:00:00`);
  els.calendarSelectedDate.textContent = new Intl.DateTimeFormat(getDateLocale(), {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(selected);
  const selectedEvents = getCalendarEvents(selectedCalendarDate);
  els.calendarEvents.innerHTML = selectedEvents.length
    ? selectedEvents.map(({ rental, type }) => {
      const showReminder = type === 'return' || compareDates(rental.pickupDate, todayISO()) > 0;
      const reminderType = type === 'pickup' ? 'upcoming' : 'return';
      const reminderButton = showReminder
        ? `<button type="button" data-action="calendar-reminder" data-id="${rental.id}" data-reminder-type="${reminderType}" class="calendar-reminder-btn rounded-md bg-[#25D366] px-2 py-1 text-[10px] font-semibold leading-tight text-white hover:bg-[#1fb958]" title="${escapeHtml(t('btnWhatsAppReminder'))}">${escapeHtml(t('btnWhatsAppReminder'))}</button>`
        : '';
      const eventBadge = type === 'return'
        ? `<span class="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">${escapeHtml(t('calendarReturn'))}</span>`
        : renderStatusBadge(rental);
      return `<article class="rounded-lg border border-slate-200 bg-white p-2.5">
        <div class="flex items-start justify-between gap-2"><div class="min-w-0"><p class="truncate text-sm font-semibold text-slate-800">${escapeHtml(rental.customerName)}</p><p class="mt-0.5 text-xs font-medium ${type === 'pickup' ? 'text-sky-700' : 'text-amber-700'}">${escapeHtml(type === 'pickup' ? t('calendarPickup') : t('calendarReturn'))} · ${escapeHtml(formatBlazerCodes(rental))}</p></div>${eventBadge}</div>
        <div class="calendar-event-actions mt-2 flex items-center gap-1.5">${reminderButton}<button type="button" data-action="view-details" data-id="${rental.id}" class="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold leading-tight text-slate-700 hover:bg-slate-50">${escapeHtml(t('btnViewDetails'))}</button></div>
      </article>`;
    }).join('')
    : `<p class="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-xs text-slate-500">${escapeHtml(t('calendarNoBookings'))}</p>`;
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
      <p class="text-xs text-slate-500">${escapeHtml(translateColorType(blazer.colorType))} · ${escapeHtml(formatCurrency(getBlazerPrice(blazer)))}</p>
    </div>
  `).join('');
}

function buildReceiptHtml(rental) {
  const blazers = Array.isArray(rental.blazers) && rental.blazers.length ? rental.blazers : [{ blazerCode: rental.blazerCode || '—', colorName: rental.colorName || '—', colorType: rental.colorType || 'Dark Color' }];
  const balance = getRentalBalance(rental);
  const formatReceiptAmount = (amount) => Number(amount || 0).toLocaleString('en-LK');
  const isPaidInFull = Number(rental.totalPrice || 0) > 0 && balance <= 0;
  const rows = blazers.map((blazer, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(`Blazer ${blazer.blazerCode || '—'} · ${blazer.colorName || '—'} · ${translateColorType(blazer.colorType || 'Dark Color')}`)}</td>
      <td>1</td>
      <td>${escapeHtml(formatReceiptAmount(getBlazerPrice(blazer)))}</td>
      <td>${escapeHtml(formatReceiptAmount(getBlazerPrice(blazer)))}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Madhusanka Tailors Rental Receipt</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; background: #fff; }
        .billing-paper { position: relative; width: 148mm; min-height: 210mm; padding: 6.5mm 7mm 6mm; background: #fff; color: #25211d; font-family: Arial, Helvetica, sans-serif; }
        .billing-paper-header { display: grid; grid-template-columns: 30mm 1fr; align-items: center; gap: 4mm; min-height: 27mm; }
        .billing-paper-logo-wrap { display: flex; align-items: center; justify-content: center; }
        .billing-paper-logo { display: block; width: 28mm; height: auto; }
        .billing-paper-brand { text-align: center; min-width: 0; }
        .billing-paper-brand h1 { margin: 0 0 1.2mm; font-family: Georgia, 'Times New Roman', serif; font-size: 5.4mm; line-height: 1; letter-spacing: .16mm; font-weight: 800; }
        .billing-paper-brand p { margin: .7mm 0 0; font-size: 2.45mm; line-height: 1.3; font-weight: 600; }
        .billing-paper-rule { height: .8mm; margin: 1.5mm 0 3.3mm; background: linear-gradient(90deg, #70512a, #c9a56d, #70512a); }
        .billing-paper-meta { display: grid; grid-template-columns: 1fr 46mm; gap: 4mm; margin-bottom: 3mm; }
        .billing-paper-meta-left, .billing-paper-meta-right { display: grid; gap: 1.6mm; }
        .billing-paper-meta-left > div, .billing-paper-meta-right > div { display: grid; grid-template-columns: auto 1fr; gap: 2mm; min-height: 5mm; align-items: end; }
        .billing-paper-meta span { font-size: 2.65mm; font-weight: 700; white-space: nowrap; }
        .billing-paper-meta strong { min-width: 0; padding: 0 1mm .6mm; border-bottom: .3mm dotted #756b61; font-size: 2.65mm; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .billing-paper-table { width: 100%; border-collapse: collapse; table-layout: fixed; border: .4mm solid #2e2a26; }
        .billing-paper-table th, .billing-paper-table td { border: .3mm solid #3b3733; }
        .billing-paper-table th { height: 6.6mm; padding: .8mm 1mm; background: #2a251f; color: #fff; font-size: 2.5mm; text-align: center; line-height: 1; font-weight: 700; }
        .billing-paper-table td { height: 6.4mm; padding: .6mm 1.2mm; font-size: 2.55mm; line-height: 1.05; }
        .billing-paper-table td:nth-child(1), .billing-paper-table td:nth-child(3) { text-align: center; }
        .billing-paper-table td:nth-child(4), .billing-paper-table td:nth-child(5) { text-align: right; padding-right: 1.5mm; font-variant-numeric: tabular-nums; }
        .billing-paper-bottom { display: grid; grid-template-columns: 1fr 50mm; border: .3mm solid #3b3733; border-top: 0; }
        .billing-paper-dates { display: grid; align-content: center; gap: 2.2mm; padding: 3mm; border-right: .3mm solid #3b3733; }
        .billing-paper-dates > div { display: grid; grid-template-columns: auto 1fr; gap: 2mm; align-items: end; }
        .billing-paper-dates span, .billing-paper-summary span { font-size: 2.45mm; font-weight: 700; }
        .billing-paper-dates strong { padding-bottom: .5mm; border-bottom: .3mm dotted #756b61; font-size: 2.45mm; text-align: center; }
        .billing-paper-summary > div { min-height: 7mm; display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; align-items: center; padding: 1mm 2mm; border-bottom: .3mm solid #3b3733; }
        .billing-paper-summary > div:last-child { border-bottom: 0; }
        .billing-paper-summary strong { text-align: right; font-size: 2.75mm; }
        .billing-paper-balance { background: #f2ece3; font-weight: 900; }
        .billing-paid-seal { position: absolute; right: 57mm; bottom: 27mm; width: 28mm; height: auto; opacity: .92; transform: rotate(-7deg); }
        .billing-paper-footer { margin-top: 3.2mm; }
        .billing-paper-footer p { margin: 0; font-size: 2.05mm; line-height: 1.4; text-align: justify; }
        .billing-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 15mm; margin-top: 8mm; }
        .billing-signatures span { padding-top: 1.4mm; border-top: .3mm solid #4a433c; text-align: center; font-size: 2.2mm; }
        .billing-signatures strong { display: block; margin-bottom: .8mm; font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 3.4mm; font-weight: 600; }
        .billing-signatures .customer-name { font-family: Arial, Helvetica, sans-serif; font-size: 2.65mm; font-weight: 700; }
        .billing-signatures small { display: block; font-size: 2.2mm; }
        .billing-signatures .rental-signature { padding-top: 0; border-top: 0; }
        .billing-signatures .rental-signature small { padding-top: 1.4mm; border-top: .3mm solid #4a433c; }
      </style>
    </head>
    <body>
      <article class="billing-paper">
        <header class="billing-paper-header">
          <div class="billing-paper-logo-wrap"><img src="assets/madhusanka-logo.png" alt="Madhusanka Tailors" class="billing-paper-logo" /></div>
          <div class="billing-paper-brand"><h1>MADHUSANKA TAILORS</h1><p>No.29, Super Market Lane, Dankotuwa.</p><p>Tel: 031 490 3171 &nbsp; | &nbsp; Mobile: 077 860 1003</p></div>
        </header>
        <div class="billing-paper-rule"></div>
        <section class="billing-paper-meta">
          <div class="billing-paper-meta-left"><div><span>Name</span><strong>${escapeHtml(rental.customerName || '—')}</strong></div><div><span>Telephone</span><strong>${escapeHtml(rental.phoneNumber || '—')}</strong></div></div>
          <div class="billing-paper-meta-right"><div><span>Date</span><strong>${formatDate(rental.bookingDate)}</strong></div></div>
        </section>
        <table class="billing-paper-table">
          <colgroup><col style="width:8%"><col style="width:40%"><col style="width:10%"><col style="width:20%"><col style="width:22%"></colgroup>
          <thead>
            <tr><th>No.</th><th>Description</th><th>Qty</th><th>Unit Price (Rs.)</th><th>Amount (Rs.)</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <section class="billing-paper-bottom">
          <div class="billing-paper-dates"><div><span>Received Date</span><strong>${formatDate(rental.pickupDate)}</strong></div><div><span>Delivery / Return Date</span><strong>${formatDate(rental.returnDate)}</strong></div></div>
          <div class="billing-paper-summary"><div><span>Total</span><strong>${formatReceiptAmount(rental.totalPrice)}</strong></div><div><span>Paid</span><strong>${formatReceiptAmount(rental.advancePaid)}</strong></div><div><span>Payment Status</span><strong>${balance <= 0 ? 'Paid' : 'Not Paid'}</strong></div><div class="billing-paper-balance"><span>Balance</span><strong>${formatReceiptAmount(balance)}</strong></div></div>
        </section>
        ${isPaidInFull ? '<img src="assets/paid-seal.png" alt="Paid" class="billing-paid-seal is-visible" />' : ''}
        <footer class="billing-paper-footer"><p>Wedding garments must be returned on the agreed date. Damage or loss will be charged according to the amount determined by the establishment. Late returns are subject to a Rs. 200/- charge per day.</p><div class="billing-signatures"><span class="rental-signature"><strong class="customer-name">${escapeHtml(rental.customerName || 'Customer')}</strong><small>Customer Signature</small></span><span class="rental-signature"><strong>Madhusanka Tailors</strong><small>Authorized Signature</small></span></div></footer>
      </article>
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
  receipt.style.cssText = 'position:fixed;left:-10000px;top:0;width:148mm;background:#fff;z-index:-1;';
  const styles = source.head.querySelector('style');
  if (styles) receipt.appendChild(styles.cloneNode(true));
  receipt.append(...Array.from(source.body.children).map((child) => child.cloneNode(true)));
  document.body.appendChild(receipt);

  const safeName = (rental.customerName || 'customer').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'receipt';
  try {
    const paper = receipt.querySelector('.billing-paper') || receipt;
    const canvas = await window.html2canvas(paper, {
      scale: 2.4,
      backgroundColor: '#ffffff',
      useCORS: true,
    });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: [148, 210] });
    const image = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(image, 'JPEG', 0, 0, 148, 210);
    const fileName = `receipt-${safeName}.pdf`;
    const pdfBlob = pdf.output('blob');
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
    const canShareFile = typeof navigator.share === 'function'
      && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [pdfFile] });

    if (canShareFile) {
      try {
        await navigator.share({
          title: t('shareReceiptTitle'),
          text: t('shareReceiptText', { name: rental.customerName || '' }),
          files: [pdfFile],
        });
        showToast(t('toastReceiptShared'), 'success');
        return;
      } catch (shareError) {
        // A user cancellation is not an error. For other share failures, use
        // the regular download fallback below.
        if (shareError?.name === 'AbortError') return;
      }
    }

    const url = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(t('toastReceiptDownloaded'), 'success');
  } catch (error) {
    console.error(error);
    showToast(t('toastPdfUnavailable'), 'error');
  } finally {
    receipt.remove();
  }
}

function fitRentalReceiptPreview() {
  const paper = els.rentalReceiptPaperStage?.querySelector('.billing-paper');
  const scroll = els.rentalReceiptPreviewScroll;
  if (!paper || !scroll) return;

  paper.style.transform = 'none';
  const availableWidth = Math.max(1, scroll.clientWidth - 34);
  const scale = Math.min(1, availableWidth / paper.offsetWidth);
  paper.style.transformOrigin = 'top left';
  paper.style.transform = `scale(${scale})`;
  els.rentalReceiptPaperStage.style.width = `${Math.ceil(paper.offsetWidth * scale)}px`;
  els.rentalReceiptPaperStage.style.height = `${Math.ceil(paper.offsetHeight * scale)}px`;
}

function openRentalReceiptPreview(rental) {
  if (!els.rentalReceiptPreviewModal || !els.rentalReceiptPaperStage) return;
  const source = new DOMParser().parseFromString(buildReceiptHtml(rental), 'text/html');
  const paper = source.body.querySelector('.billing-paper');
  if (!paper) return;

  previewReceiptRentalId = rental.id;
  els.rentalReceiptPaperStage.innerHTML = paper.outerHTML;
  els.rentalReceiptPreviewModal.classList.remove('hidden');
  els.rentalReceiptPreviewModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('billing-modal-open');
  requestAnimationFrame(() => requestAnimationFrame(fitRentalReceiptPreview));
}

function closeRentalReceiptPreview() {
  if (!els.rentalReceiptPreviewModal) return;
  previewReceiptRentalId = null;
  els.rentalReceiptPreviewModal.classList.add('hidden');
  els.rentalReceiptPreviewModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('billing-modal-open');
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
          <dd>${renderPhoneLink(rental.phoneNumber)}${rental.phoneNumber2 ? `<br>${renderPhoneLink(rental.phoneNumber2)}` : ''}</dd>
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

function getSalesByDay() {
  const grouped = new Map();
  rentals.forEach((rental) => {
    const date = rental.bookingDate || 'Unknown';
    const entry = grouped.get(date) || { date, revenue: 0, bookings: 0 };
    entry.revenue += Number(rental.totalPrice) || 0;
    entry.bookings += 1;
    grouped.set(date, entry);
  });
  return [...grouped.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function getRevenueByMonth() {
  const grouped = new Map();
  rentals.forEach((rental) => {
    const month = (rental.bookingDate || '').slice(0, 7) || 'Unknown';
    const entry = grouped.get(month) || { month, revenue: 0, bookings: 0 };
    entry.revenue += Number(rental.totalPrice) || 0;
    entry.bookings += 1;
    grouped.set(month, entry);
  });
  return [...grouped.values()].sort((a, b) => b.month.localeCompare(a.month));
}

function closeAnalyticsHistory() {
  els.analyticsHistoryModal?.classList.add('hidden');
  els.analyticsHistoryModal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function openAnalyticsHistory(type) {
  if (!els.analyticsHistoryModal) return;
  const isDaily = type === 'daily';
  const records = isDaily ? getSalesByDay() : getRevenueByMonth();
  els.analyticsHistoryTitle.textContent = t(isDaily ? 'analyticsDailyHistoryTitle' : 'analyticsMonthlyHistoryTitle');
  els.analyticsHistoryBody.innerHTML = records.length ? `
    <div class="overflow-x-auto rounded-lg border border-slate-200">
      <table class="w-full min-w-[22rem] text-left text-sm">
        <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-3 py-2">${escapeHtml(t(isDaily ? 'analyticsDate' : 'analyticsMonth'))}</th><th class="px-3 py-2">${escapeHtml(t('analyticsBookingsCount'))}</th><th class="px-3 py-2 text-right">${escapeHtml(t('analyticsRevenue'))}</th></tr></thead>
        <tbody class="divide-y divide-slate-200">${records.map((record) => `<tr><td class="px-3 py-2 font-medium">${escapeHtml(isDaily ? formatDate(record.date) : record.month)}</td><td class="px-3 py-2">${record.bookings}</td><td class="px-3 py-2 text-right font-semibold">${escapeHtml(formatCurrency(record.revenue))}</td></tr>`).join('')}</tbody>
      </table>
    </div>` : `<div class="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">${escapeHtml(t('analyticsNoData'))}</div>`;
  els.analyticsHistoryModal.classList.remove('hidden');
  els.analyticsHistoryModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
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
    'Phone Number 2',
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
      rental.phoneNumber2 || '',
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

function closeRestorePreview() {
  pendingRestore = null;
  els.restorePreviewModal?.classList.add('hidden');
  els.restorePreviewModal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function renderRestorePreview(items, fileName) {
  const previewItems = items.slice(0, 5);
  els.restorePreviewBody.innerHTML = `
    <div class="rounded-lg border border-brand-100 bg-brand-50 p-3 text-sm text-brand-900">
      <p class="font-semibold">${escapeHtml(fileName)}</p>
      <p class="mt-1">${escapeHtml(t('restorePreviewCount', { count: items.length }))}</p>
    </div>
    <div class="mt-4 overflow-x-auto rounded-lg border border-slate-200">
      <table class="w-full min-w-[34rem] text-left text-sm">
        <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-500"><tr><th class="px-3 py-2">${escapeHtml(t('thName'))}</th><th class="px-3 py-2">${escapeHtml(t('thPhone'))}</th><th class="px-3 py-2">${escapeHtml(t('thBooking'))}</th><th class="px-3 py-2">${escapeHtml(t('thStatus'))}</th></tr></thead>
        <tbody class="divide-y divide-slate-200">${previewItems.map((item) => `<tr><td class="px-3 py-2 font-medium">${escapeHtml(item.customerName || '—')}</td><td class="px-3 py-2">${escapeHtml(item.phoneNumber || '—')}</td><td class="px-3 py-2">${formatDate(item.bookingDate)}</td><td class="px-3 py-2">${escapeHtml(item.status || 'Pending')}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    ${items.length > previewItems.length ? `<p class="mt-2 text-xs text-slate-500">${escapeHtml(t('restorePreviewMore', { count: items.length - previewItems.length }))}</p>` : ''}
    <p class="mt-4 text-sm text-slate-600">${escapeHtml(t('restorePreviewChoice'))}</p>
  `;
  els.restorePreviewModal.classList.remove('hidden');
  els.restorePreviewModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

async function handleRestoreFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    const sourceItems = Array.isArray(parsed) ? parsed : parsed?.rentals;
    if (!Array.isArray(sourceItems) || !sourceItems.length) throw new Error('No rentals found');
    if (sourceItems.length > 10000) throw new Error('Backup is too large');

    const seenIds = new Set();
    const imported = sourceItems
      .filter((item) => item && typeof item === 'object' && String(item.customerName || '').trim())
      .map((item) => {
        let id = String(item.id || '').trim();
        if (!id || seenIds.has(id)) id = generateId();
        seenIds.add(id);
        const normalized = normalizeRental(item);
        return sanitizeRentalForSave({ ...normalized, id, status: normalized.status === 'Returned' ? 'Returned' : 'Pending' });
      });
    if (!imported.length) throw new Error('No valid rentals found');

    pendingRestore = { items: imported, fileName: file.name };
    renderRestorePreview(imported, file.name);
  } catch (error) {
    console.error(error);
    showToast(t('toastRestoreInvalid'), 'error');
  }
}

async function restoreRentalData(mode) {
  if (!pendingRestore?.items?.length) return;
  const count = pendingRestore.items.length;
  const confirmed = confirm(t(mode === 'replace' ? 'confirmRestoreReplace' : 'confirmRestoreMerge', { count }));
  if (!confirmed) return;

  const imported = pendingRestore.items;
  const previousRentals = rentals;
  if (mode === 'replace') {
    rentals = imported;
  } else {
    const byId = new Map(rentals.map((item) => [item.id, item]));
    imported.forEach((item) => byId.set(item.id, item));
    rentals = [...byId.values()];
  }

  els.restoreMergeBtn.disabled = true;
  els.restoreReplaceBtn.disabled = true;
  try {
    await saveRentals();
    closeRestorePreview();
    render();
    showToast(t('toastRestoreSuccess'), 'success');
  } catch {
    rentals = previousRentals;
    els.restoreMergeBtn.disabled = false;
    els.restoreReplaceBtn.disabled = false;
    showToast(t('toastSyncError'), 'error');
  }
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
  const outstandingBalance = rentals.reduce((sum, rental) => sum + getRentalBalance(rental), 0);

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
  renderCalendar();
  applyI18n();
  if (els.calendarToggleBtn) {
    const isExpanded = els.calendarToggleBtn.getAttribute('aria-expanded') !== 'false';
    els.calendarToggleBtn.textContent = t(isExpanded ? 'calendarCollapse' : 'calendarExpand');
  }
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

function setActionButtonLoading(button, loading, label = t('syncSaving')) {
  if (!button) return;
  if (loading) {
    button.disabled = true;
    button.dataset.defaultHtml = button.innerHTML;
    button.innerHTML = `<span class="app-loading-spinner" aria-hidden="true"></span>${escapeHtml(label)}`;
    button.classList.add('opacity-70', 'cursor-not-allowed');
    return;
  }
  button.disabled = false;
  if (button.dataset.defaultHtml) button.innerHTML = button.dataset.defaultHtml;
  button.classList.remove('opacity-70', 'cursor-not-allowed');
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

  if (action === 'calendar-reminder') {
    const rental = rentals.find((item) => item.id === id);
    if (rental) openWhatsAppReminder(rental, btn.dataset.reminderType || 'pickup');
    return;
  }

  const rental = rentals.find((r) => r.id === id);
  if (!rental) return;

  if (action === 'download-receipt') {
    openRentalReceiptPreview(rental);
    return;
  }
  if (!rental) return;

  const afterAction = () => {
    refreshDetailModalIfOpen();
    render();
  };

  if (action === 'return') {
    const rentalIndex = rentals.findIndex((item) => item.id === id);
    const previousRental = rentalIndex >= 0 ? { ...rentals[rentalIndex] } : null;
    if (rentalIndex >= 0) {
      rentals[rentalIndex] = { ...rentals[rentalIndex], status: 'Returned' };
    }
    setActionButtonLoading(btn, true);
    updateRentalStatus(rental.id, 'Returned')
      .then(() => {
        showToast(t('toastBookingReturned'), 'success');
        afterAction();
      })
      .catch(() => {
        if (rentalIndex >= 0 && previousRental) {
          rentals[rentalIndex] = previousRental;
        }
        setActionButtonLoading(btn, false);
        showToast(t('toastSyncError'), 'error');
      });
  } else if (action === 'collect-balance') {
    const rentalIndex = rentals.findIndex((r) => r.id === id);
    const previousRental = rentalIndex >= 0 ? { ...rentals[rentalIndex] } : null;
    setActionButtonLoading(btn, true);
    if (rentalIndex >= 0) {
      const updated = {
        ...rentals[rentalIndex],
        advancePaid: rentals[rentalIndex].totalPrice,
        balanceDue: 0,
        updatedAt: new Date().toISOString(),
      };
      rentals[rentalIndex] = updated;
      saveRentals()
        .then(() => {
          showToast(t('toastBalanceCollected'), 'success');
          afterAction();
        })
        .catch(() => {
          if (previousRental) {
            rentals[rentalIndex] = previousRental;
          }
          setActionButtonLoading(btn, false);
          showToast(t('toastSyncError'), 'error');
        });
    } else {
      setActionButtonLoading(btn, false);
      showToast(t('toastSyncError'), 'error');
    }
  } else if (action === 'edit') {
    closeDetailModal();
    populateForm(rental);
  } else if (action === 'delete') {
    if (confirm(t('confirmDelete', { name: rental.customerName, code: formatBlazerCodes(rental) }))) {
      setActionButtonLoading(btn, true);
      rentals = rentals.filter((r) => r.id !== id);
      saveRentals()
        .then(() => {
          showToast(t('toastBookingDeleted'), 'success');
          if (els.editId.value === id) resetForm();
          closeDetailModal();
        })
        .catch(() => {
          setActionButtonLoading(btn, false);
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
  els.calendarEvents?.addEventListener('click', handleTableClick);
  els.calendarGrid?.addEventListener('click', (event) => {
    const day = event.target.closest('[data-calendar-date]');
    if (!day) return;
    selectedCalendarDate = day.dataset.calendarDate;
    renderCalendar();
  });
  els.calendarPrevBtn?.addEventListener('click', () => {
    calendarMonth.setMonth(calendarMonth.getMonth() - 1);
    renderCalendar();
  });
  els.calendarToggleBtn?.addEventListener('click', () => {
    const isExpanded = els.calendarToggleBtn.getAttribute('aria-expanded') === 'true';
    els.calendarContent?.classList.toggle('hidden', isExpanded);
    els.calendarToggleBtn.setAttribute('aria-expanded', String(!isExpanded));
    els.calendarToggleBtn.textContent = t(isExpanded ? 'calendarExpand' : 'calendarCollapse');
  });
  els.calendarTodayBtn?.addEventListener('click', () => {
    selectedCalendarDate = todayISO();
    calendarMonth = new Date(`${selectedCalendarDate}T12:00:00`);
    renderCalendar();
  });
  els.calendarNextBtn?.addEventListener('click', () => {
    calendarMonth.setMonth(calendarMonth.getMonth() + 1);
    renderCalendar();
  });
  els.rentalReceiptPreviewModal?.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="close-receipt-preview"]')) closeRentalReceiptPreview();
  });
  els.rentalReceiptPdfBtn?.addEventListener('click', () => {
    const rental = rentals.find((item) => item.id === previewReceiptRentalId);
    if (rental) downloadRentalReceipt(rental);
  });
  els.rentalReceiptWhatsAppBtn?.addEventListener('click', () => {
    const rental = rentals.find((item) => item.id === previewReceiptRentalId);
    if (rental) openReceiptWhatsApp(rental);
  });
  els.analyticsHistoryModal?.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="close-analytics-history"]')) closeAnalyticsHistory();
  });
  els.restorePreviewModal?.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="close-restore"]')) closeRestorePreview();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!els.analyticsHistoryModal?.classList.contains('hidden')) {
      closeAnalyticsHistory();
      return;
    }
    if (!els.restorePreviewModal?.classList.contains('hidden')) closeRestorePreview();
    else if (!els.rentalReceiptPreviewModal?.classList.contains('hidden')) closeRentalReceiptPreview();
    else if (activeDetailRentalId) closeDetailModal();
  });

  window.addEventListener('resize', () => {
    if (!els.rentalReceiptPreviewModal?.classList.contains('hidden')) fitRentalReceiptPreview();
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
  els.analyticsDailyCard?.addEventListener('click', () => openAnalyticsHistory('daily'));
  els.analyticsMonthlyCard?.addEventListener('click', () => openAnalyticsHistory('monthly'));
  els.phoneNumber2Toggle?.addEventListener('click', () => {
    const visible = els.phoneNumber2Wrap?.classList.contains('hidden');
    setSecondPhoneVisible(visible);
    if (visible) els.phoneNumber2?.focus();
  });
  els.restoreBackupInput?.addEventListener('change', handleRestoreFile);
  els.restoreMergeBtn?.addEventListener('click', () => restoreRentalData('merge'));
  els.restoreReplaceBtn?.addEventListener('click', () => restoreRentalData('replace'));
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
  const user = await requireAuth();
  if (!user) return;

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
