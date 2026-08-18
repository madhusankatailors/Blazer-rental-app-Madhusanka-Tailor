const LOCALE_KEY = 'blazerRentals_locale';

const translations = {
  en: {
    pageTitle: 'Blazer Rental Management | Madhusanka Tailors',
    appTitle: 'Blazer Rental Management',
    businessName: 'Madhusanka Tailors',
    langEnglish: 'English',
    langSinhala: 'සිංහල',
    statTotalBookings: 'Total Bookings',
    statActiveRentals: 'Active Rentals',
    statOverdueItems: 'Overdue Items',
    statTodayReturns: "Today's Returns Due",
    statTodayGoingBlazers: "Today's Going Blazers",
    analyticsDailySales: 'Daily Sales',
    analyticsMonthlyRevenue: 'Monthly Revenue',
    analyticsTopColors: 'Best-selling Colors',
    analyticsOverdueRate: 'Overdue Rate',
    analyticsTodaySummary: 'Bookings made today',
    analyticsMonthSummary: 'This month',
    analyticsColorSummary: 'Most rented color',
    analyticsOverdueSummary: 'Pending bookings overdue',
    analyticsNoData: 'No data',
    analyticsMenuLabel: 'Business Analytics',
    formNewTitle: 'New Rental Booking',
    formNewSubtitle: 'Fill in the details below to create a new rental entry.',
    formEditTitle: 'Edit Rental Booking',
    formEditSubtitle: 'Editing booking for {name} (Code {code}).',
    labelCustomerName: 'Customer Name',
    labelPhoneNumber: 'Phone Number',
    labelBlazerCode: 'Blazer Code',
    labelBlazers: 'Blazers',
    labelColorName: 'Color Name',
    labelColorType: 'Color Type',
    colorLight: 'Light Color',
    colorDark: 'Dark Color',
    labelBookingDate: 'Booking Date',
    labelPickupDate: 'Pickup Date',
    labelReturnDate: 'Return Date',
    returnDateHint: 'Auto-set to Pickup + 2 days (editable)',
    blazersHint: 'Add one or more blazer codes for this customer. Total price is calculated automatically.',
    labelTotalPrice: 'Total Price (Rs.)',
    labelPayment: 'Payment',
    paymentFull: 'Paid in Full',
    paymentFullHint: 'Customer paid everything now',
    paymentAdvance: 'Advance Only',
    paymentAdvanceHint: 'Customer pays rest on pickup day',
    labelPaidNow: 'Paid Now (Rs.)',
    labelPaymentStatus: 'Status',
    labelBalanceOnPickup: 'Balance on Pickup Day',
    paymentAllPaid: 'Fully Paid',
    paymentDueShort: 'due',
    paymentPaidSoFar: '{amount} paid so far',
    labelAdvancePaid: 'Advance Paid (Rs.)',
    labelBalanceDue: 'Balance Due (Rs.)',
    labelDepositType: 'Deposit / ID Kept',
    labelStatus: 'Status',
    labelNotes: 'Additional Notes',
    notesHint: 'Optional — add any extra details for this booking.',
    depositNationalId: 'National ID',
    depositDrivingLicense: 'Driving License',
    depositCash: 'Cash Deposit',
    depositNone: 'None',
    statusPending: 'Pending',
    statusReturned: 'Returned',
    btnSaveBooking: 'Save Booking',
    btnAddBlazer: 'Add Blazer',
    btnRemoveBlazer: 'Remove blazer',
    btnUpdateBooking: 'Update Booking',
    btnCancelEdit: 'Cancel Edit',
    dashboardTitle: 'Rental Dashboard',
    dashboardSubtitle: 'All bookings with overdue tracking',
    searchPlaceholder: 'Search code, name, phone...',
    filterDateField: 'Filter by Date',
    filterBookingDate: 'Booking Date',
    filterPickupDate: 'Pickup Date',
    filterReturnDate: 'Return Date',
    filterFromDate: 'From',
    filterToDate: 'To',
    btnClearFilters: 'Clear Filters',
    mobileCardsHint: 'Main booking info below — tap Details for full info',
    tableScrollHint: 'Swipe horizontally to see all columns',
    emptyNoResults: 'No bookings match your filters',
    emptyNoResultsSubtitle: 'Try changing the search text or date range.',
    thBooking: 'Booking',
    thName: 'Name',
    thPhone: 'Phone',
    thCode: 'Code',
    thColor: 'Color',
    thPickup: 'Pickup',
    thReturn: 'Return',
    thPrice: 'Price',
    thPayment: 'Payment',
    thAdvance: 'Advance',
    thBalance: 'Balance',
    thDeposit: 'Deposit/ID',
    thNotes: 'Notes',
    thDetails: 'Details',
    thStatus: 'Status',
    thActions: 'Actions',
    badgeReturned: 'Returned',
    badgeOverdue: 'Overdue',
    badgeGoingToday: 'Going Today',
    badgeUpcoming: 'Upcoming',
    badgeDueToday: 'Due Today',
    badgePending: 'Pending',
    btnReturned: 'Returned',
    btnCollectBalance: 'Collect Balance',
    btnPrintReceipt: 'Print Receipt',
    btnDownloadReceipt: 'Download Receipt',
    btnViewDetails: 'Details',
    btnEdit: 'Edit',
    btnDelete: 'Delete',
    emptyTitle: 'No rental bookings yet',
    emptySubtitle: 'Create your first booking using the form above.',
    footerText: '© 2026 Madhusanka Tailor. All rights reserved.',
    placeholderFullName: 'Full name',
    placeholderBlazerCode: 'e.g. 01, 05',
    placeholderColorName: 'e.g. Navy Blue',
    placeholderNotes: 'e.g. needs alteration, wedding on Saturday, special instructions...',
    alertRequiredFields: 'Please fill in all required fields.',
    alertBlazerRequired: 'Please enter a blazer code and color for each blazer.',
    alertAdvanceRequired: 'Please enter how much the customer paid now.',
    alertAdvanceTooMuch: 'Paid amount must be less than the total. Choose Paid in Full instead.',
    confirmDelete: 'Delete booking for {name} (Code {code})?',
    loginTitle: 'Sign In',
    loginSubtitle: 'Sign in to access your rental data from any device.',
    labelUsername: 'Username',
    labelPassword: 'Password',
    placeholderUsername: 'Username',
    placeholderPassword: 'Password',
    btnLogin: 'Sign In',
    btnLoggingIn: 'Signing in...',
    btnLogout: 'Logout',
    loginErrorInvalid: 'Invalid username or password. Please try again.',
    loginErrorGeneric: 'Could not sign in. Check your connection and try again.',
    loginCloudNote: 'Data syncs to the cloud after login.',
    syncLoading: 'Loading data...',
    syncSaving: 'Saving...',
    syncSaved: 'All changes saved',
    syncError: 'Sync error — check connection',
    toastBookingSaved: 'Booking saved successfully.',
    toastBookingUpdated: 'Booking updated successfully.',
    toastBookingDeleted: 'Booking deleted successfully.',
    toastBookingReturned: 'Booking marked as returned.',
    toastBalanceCollected: 'Balance collected — fully paid now.',
    toastReceiptDownloaded: 'Receipt downloaded successfully.',
    toastReceiptBlocked: 'Receipt pop-up was blocked. Please allow pop-ups and try again.',
    toastSyncError: 'Sync failed. Please check your connection.',
    detailModalLabel: 'Booking Details',
    detailBlazerNumber: 'Blazer {number}',
    emptyBlazers: 'No blazers listed.',
    loginPageTitle: 'Login | Madhusanka Tailors',
  },
  si: {
    pageTitle: 'බ්ලේසර් උකස් කළමනාකරණය | මධුසංක ටේලර්ස්',
    appTitle: 'Blazer Rental Management',
    businessName: 'මධුසංක ටේලර්ස්',
    langEnglish: 'English',
    langSinhala: 'සිංහල',
    statTotalBookings: 'මුළු වෙන්කිරීම්',
    statActiveRentals: 'ක්‍රියාත්මක උකස්',
    statOverdueItems: 'ප්‍රමාද වූ අයිතම',
    statTodayReturns: 'අද ආපසු දිය යුතු',
    statTodayGoingBlazers: 'අද ගෙන යන බ්ලේසර්',
    analyticsDailySales: 'දිනික මුදල',
    analyticsMonthlyRevenue: 'මාසික ආදායම',
    analyticsTopColors: 'වඩා අලෙවිය වන වර්ණ',
    analyticsOverdueRate: 'ප්‍රමාද අනුපාතය',
    analyticsTodaySummary: 'අද කළ වෙන්කිරීම්',
    analyticsMonthSummary: 'මෙම මාසය',
    analyticsColorSummary: 'වඩා වැඩිවී මන්දගාමී වර්ණය',
    analyticsOverdueSummary: 'අපේක්ෂා කරන ප්‍රමාද වෙන්කිරීම්',
    analyticsNoData: 'දත්ත නැත',
    formNewTitle: 'නව උකස් වෙන්කිරීම',
    formNewSubtitle: 'නව උකස් වාර්තාවක් සෑදීමට පහත විස්තර පුරවන්න.',
    formEditTitle: 'උකස් වෙන්කිරීම සංස්කරණය',
    formEditSubtitle: '{name} (කේතය {code}) සඳහා වෙන්කිරීම සංස්කරණය කරමින්.',
    labelCustomerName: 'පාරිභෝගික නම',
    labelPhoneNumber: 'දුරකථන අංකය',
    labelBlazerCode: 'බ්ලේසර් කේතය',
    labelBlazers: 'බ්ලේසර්',
    labelColorName: 'වර්ණ නම',
    labelColorType: 'වර්ණ වර්ගය',
    colorLight: 'සැහැල්ලු වර්ණ',
    colorDark: 'තද වර්ණ',
    labelBookingDate: 'වෙන්කිරීම් දිනය',
    labelPickupDate: 'ගන්නා දිනය',
    labelReturnDate: 'ආපසු දෙන දිනය',
    returnDateHint: 'ගන්නා දිනය + 2 දින (සංස්කරණය කළ හැක)',
    blazersHint: 'මෙම පාරිභෝගිකයා සඳහා එක් හෝ වැඩි බ්ලේසර් කේත එකතු කරන්න. මුළු මිල ස්වයංක්‍රීයව ගණනය වේ.',
    labelTotalPrice: 'මුළු මිල (රු.)',
    labelPayment: 'ගෙවීම',
    paymentFull: 'සම්පූර්ණයෙන් ගෙවා ඇත',
    paymentFullHint: 'පාරිභෝගිකයා දැන් මුළු මුදල ගෙවා ඇත',
    paymentAdvance: 'අග්‍රිම පමණයි',
    paymentAdvanceHint: 'ඉතිරි මුදල ගන්නා දිනයේ ගෙවයි',
    labelPaidNow: 'දැන් ගෙවූ මුදල (රු.)',
    labelPaymentStatus: 'තත්ත්වය',
    labelBalanceOnPickup: 'ගන්නා දිනයේ ඉතිරි මුදල',
    paymentAllPaid: 'සම්පූර්ණයෙන් ගෙවා ඇත',
    paymentDueShort: 'ඉතිරි',
    paymentPaidSoFar: '{amount} දක්වා ගෙවා ඇත',
    labelAdvancePaid: 'අග්‍රිම ගෙවීම (රු.)',
    labelBalanceDue: 'ඉතිරි ශේෂය (රු.)',
    labelDepositType: 'තැන්පතු / තබාගත් හැඳුනුම්පත',
    labelStatus: 'තත්ත්වය',
    labelNotes: 'අමතර සටහන්',
    notesHint: 'විකල්ප — මෙම වෙන්කිරීම සඳහා අමතර විස්තර එකතු කරන්න.',
    depositNationalId: 'ජාතික හැඳුනුම්පත',
    depositDrivingLicense: 'රියදුරු බලපත්‍ර',
    depositCash: 'මුදල් තැන්පතු',
    depositNone: 'නැත',
    statusPending: 'අපේක්ෂා කරමින්',
    statusReturned: 'ආපසු ලබා දුන්',
    btnSaveBooking: 'වෙන්කිරීම සුරකින්න',
    btnAddBlazer: 'බ්ලේසර් එකතු කරන්න',
    btnRemoveBlazer: 'බ්ලේසර් ඉවත් කරන්න',
    btnUpdateBooking: 'වෙන්කිරීම යාවත්කාලීන කරන්න',
    btnCancelEdit: 'සංස්කරණය අවලංගු කරන්න',
    dashboardTitle: 'උකස් පුවරුව',
    dashboardSubtitle: 'ප්‍රමාද කළමනාකරණය සහිත සියලු වෙන්කිරීම්',
    searchPlaceholder: 'කේතය, නම, දුරකථනය සොයන්න...',
    filterDateField: 'දිනය අනුව පෙරහන්',
    filterBookingDate: 'වෙන්කිරීම් දිනය',
    filterPickupDate: 'ගන්නා දිනය',
    filterReturnDate: 'ආපසු දෙන දිනය',
    filterFromDate: 'සිට',
    filterToDate: 'දක්වා',
    btnClearFilters: 'පෙරහන් ඉවත් කරන්න',
    mobileCardsHint: 'ප්‍රධාන තොරතුරු පහත — සම්පූර්ණ විස්තර සඳහා Details ඔබන්න',
    tableScrollHint: 'සියලු තොරතුරු බලන්න තිරය තල්ලු කරන්න',
    emptyNoResults: 'ඔබේ පෙරහන් වලට ගැලපෙන වෙන්කිරීම් නැත',
    emptyNoResultsSubtitle: 'සෙවුම් පාඨය හෝ දින පරාසය වෙනස් කර බලන්න.',
    thBooking: 'වෙන්කිරීම',
    thName: 'නම',
    thPhone: 'දුරකථන',
    thCode: 'කේතය',
    thColor: 'වර්ණ',
    thPickup: 'ගන්නා දිනය',
    thReturn: 'ආපසු දෙන දිනය',
    thPrice: 'මිල',
    thPayment: 'ගෙවීම',
    thAdvance: 'අග්‍රිම',
    thBalance: 'ශේෂය',
    thDeposit: 'තැන්පතු/හැඳුනුම්',
    thNotes: 'සටහන්',
    thDetails: 'විස්තර',
    thStatus: 'තත්ත්වය',
    thActions: 'ක්‍රියා',
    badgeReturned: 'ආපසු ලබා දුන්',
    badgeOverdue: 'ප්‍රමාද',
    badgeGoingToday: 'අද ගෙන යයි',
    badgeUpcoming: 'ඉදිරියට',
    badgeDueToday: 'අද ආපසු දිය යුතු',
    badgePending: 'අපේක්ෂා කරමින්',
    btnReturned: 'ආපසු ලබා දුන්',
    btnCollectBalance: 'ඉතිරි මුදල ගන්න',
    btnPrintReceipt: 'රිසිට් ප්‍රින්ට් කරන්න',
    btnDownloadReceipt: 'රිසිට් බාගන්න',
    btnViewDetails: 'විස්තර',
    btnEdit: 'සංස්කරණය',
    btnDelete: 'මකන්න',
    emptyTitle: 'තවම උකස් වෙන්කිරීම් නැත',
    emptySubtitle: 'ඉහත පෝරමය භාවිතයෙන් ඔබේ පළමු වෙන්කිරීම සාදන්න.',
    footerText: '© 2026 Madhusanka Tailor. All rights reserved.',
    placeholderFullName: 'සම්පූර්ණ නම',
    placeholderBlazerCode: 'උදා: 01, 05',
    placeholderColorName: 'උදා: නේවි නිල',
    placeholderNotes: 'උදා: අලුත්වැඩියාව අවශ්‍ය, සෙනසුරාදා විවාහය, විශේෂ උපදෙස්...',
    alertRequiredFields: 'කරුණාකර අවශ්‍ය සියලුම ක්ෂේත්‍ර පුරවන්න.',
    alertBlazerRequired: 'සෑම බ්ලේසර් එකකටම කේතය සහ වර්ණය ඇතුළත් කරන්න.',
    alertAdvanceRequired: 'පාරිභෝගිකයා දැන් ගෙවූ මුදල ඇතුළත් කරන්න.',
    alertAdvanceTooMuch: 'ගෙවූ මුදල මුළු මිලට වඩා අඩු විය යුතුය. සම්පූර්ණ ගෙවීම තෝරන්න.',
    confirmDelete: '{name} (කේත {code}) සඳහා වෙන්කිරීම මකන්නද?',
    loginTitle: 'පිවිසෙන්න',
    loginSubtitle: 'ඕනෑම උපාංගයකින් ඔබේ උකස් දත්ත වලට පිවිසෙන්න.',
    labelUsername: 'පරිශීලක නාමය',
    labelPassword: 'මුරපදය',
    placeholderUsername: 'පරිශීලක නාමය',
    placeholderPassword: 'මුරපදය',
    btnLogin: 'පිවිසෙන්න',
    btnLoggingIn: 'පිවිසෙමින්...',
    btnLogout: 'පිටවීම',
    loginErrorInvalid: 'වැරදි පරිශීලක නාමය හෝ මුරපදය. නැවත උත්සාහ කරන්න.',
    loginErrorGeneric: 'පිවිසිය නොහැක. අන්තර්ජාල සම්බන්ධතාව පරීක්ෂා කරන්න.',
    loginCloudNote: 'පිවිසීමෙන් පසු දත්ත cloud වෙත sync වේ.',
    syncLoading: 'දත්ත load වෙමින්...',
    syncSaving: 'සුරකිමින්...',
    syncSaved: 'සියල්ල සුරකින ලදී',
    syncError: 'Sync දෝෂය — සම්බන්ධතාව පරීක්ෂා කරන්න',
    toastBookingSaved: 'වෙන්කිරීම සාර්ථකව සුරකින ලදී.',
    toastBookingUpdated: 'වෙන්කිරීම සාර්ථකව යාවත්කාලීන කරන ලදී.',
    toastBookingDeleted: 'වෙන්කිරීම සාර්ථකව මකා හරින ලදී.',
    toastBookingReturned: 'වෙන්කිරීම ආපසු ලබා දුන් ලෙස සලකුණු කරන ලදී.',
    toastBalanceCollected: 'ඉතිරි මුදල ගෙන ඇත — දැන් සම්පූර්ණයෙන් ගෙවා ඇත.',
    toastReceiptDownloaded: 'රිසිට් සාර්ථකව බාගත විය.',
    toastReceiptBlocked: 'රිසිට් popup අවහිර විය. pop-up සලකාගෙන නැවත උත්සාහ කරන්න.',
    toastSyncError: 'Sync අසාර්ථකයි. ඔබේ සම්බන්ධතාවය පරීක්ෂා කරන්න.',
    detailModalLabel: 'වෙන්කිරීම් විස්තර',
    detailBlazerNumber: 'බ්ලේසර් {number}',
    emptyBlazers: 'බ්ලේසර් ලැයිස්තුගත කර නැත.',
    loginPageTitle: 'පිවිසීම | මධුසංක ටේලර්ස්',
  },
};

const depositLabels = {
  'National ID': 'depositNationalId',
  'Driving License': 'depositDrivingLicense',
  'Cash Deposit': 'depositCash',
  'None': 'depositNone',
};

const colorTypeLabels = {
  'Light Color': 'colorLight',
  'Dark Color': 'colorDark',
};

const statusLabels = {
  Pending: 'statusPending',
  Returned: 'statusReturned',
};

let currentLocale = localStorage.getItem(LOCALE_KEY) || 'en';

function getLocale() {
  return currentLocale;
}

function setLocale(locale) {
  if (!translations[locale]) return;
  currentLocale = locale;
  localStorage.setItem(LOCALE_KEY, locale);
  document.documentElement.lang = locale === 'si' ? 'si' : 'en';
  document.title = t('pageTitle');
  applyI18n();
  updateLangButtons();
  window.dispatchEvent(new CustomEvent('localechange'));
}

function t(key, params = {}) {
  const str = translations[currentLocale][key] ?? translations.en[key] ?? key;
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? params[k] : `{${k}}`));
}

function translateDeposit(value) {
  const key = depositLabels[value];
  return key ? t(key) : value;
}

function translateColorType(value) {
  const key = colorTypeLabels[value];
  return key ? t(key) : value;
}

function translateStatus(value) {
  const key = statusLabels[value];
  return key ? t(key) : value;
}

function getDateLocale() {
  return currentLocale === 'si' ? 'si-LK' : 'en-LK';
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });

  document.querySelectorAll('[data-i18n-option]').forEach((el) => {
    el.textContent = t(el.dataset.i18nOption);
  });

  const lightLabel = document.querySelector('[data-i18n-color="light"]');
  const darkLabel = document.querySelector('[data-i18n-color="dark"]');
  if (lightLabel) {
    lightLabel.innerHTML = `${t('colorLight')} <span class="text-slate-400">(Rs. 2000)</span>`;
  }
  if (darkLabel) {
    darkLabel.innerHTML = `${t('colorDark')} <span class="text-slate-400">(Rs. 1750)</span>`;
  }
}

function updateLangButtons() {
  const enBtn = document.getElementById('langEn');
  const siBtn = document.getElementById('langSi');
  if (!enBtn || !siBtn) return;

  const active = 'bg-white text-brand-800 shadow-sm';
  const inactive = 'text-brand-100 hover:text-white hover:bg-brand-700';

  enBtn.className = `px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${currentLocale === 'en' ? active : inactive}`;
  siBtn.className = `px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${currentLocale === 'si' ? active : inactive}`;
}

function initI18n() {
  const isLoginPage = document.getElementById('loginForm');
  document.documentElement.lang = currentLocale === 'si' ? 'si' : 'en';
  document.title = isLoginPage ? t('loginPageTitle') : t('pageTitle');
  applyI18n();
  updateLangButtons();

  document.getElementById('langEn')?.addEventListener('click', () => setLocale('en'));
  document.getElementById('langSi')?.addEventListener('click', () => setLocale('si'));
}

document.addEventListener('DOMContentLoaded', initI18n);
