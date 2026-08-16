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
    formNewTitle: 'New Rental Booking',
    formNewSubtitle: 'Fill in the details below to create a new rental entry.',
    formEditTitle: 'Edit Rental Booking',
    formEditSubtitle: 'Editing booking for {name} (Code {code}).',
    labelCustomerName: 'Customer Name',
    labelPhoneNumber: 'Phone Number',
    labelBlazerCode: 'Blazer Code',
    labelColorName: 'Color Name',
    labelColorType: 'Color Type',
    colorLight: 'Light Color',
    colorDark: 'Dark Color',
    labelBookingDate: 'Booking Date',
    labelPickupDate: 'Pickup Date',
    labelReturnDate: 'Return Date',
    returnDateHint: 'Auto-set to Pickup + 3 days (editable)',
    labelTotalPrice: 'Total Price (Rs.)',
    labelAdvancePaid: 'Advance Paid (Rs.)',
    labelBalanceDue: 'Balance Due (Rs.)',
    labelDepositType: 'Deposit / ID Kept',
    labelStatus: 'Status',
    depositNationalId: 'National ID',
    depositDrivingLicense: 'Driving License',
    depositCash: 'Cash Deposit',
    depositNone: 'None',
    statusPending: 'Pending',
    statusReturned: 'Returned',
    btnSaveBooking: 'Save Booking',
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
    mobileCardsHint: 'Bookings shown as cards on mobile',
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
    thAdvance: 'Advance',
    thBalance: 'Balance',
    thDeposit: 'Deposit/ID',
    thStatus: 'Status',
    thActions: 'Actions',
    badgeReturned: 'Returned',
    badgeOverdue: 'Overdue',
    badgeUpcoming: 'Upcoming',
    badgeDueToday: 'Due Today',
    badgePending: 'Pending',
    btnReturned: 'Returned',
    btnEdit: 'Edit',
    btnDelete: 'Delete',
    emptyTitle: 'No rental bookings yet',
    emptySubtitle: 'Create your first booking using the form above.',
    footerText: 'Data saved securely in the cloud · syncs across all devices',
    placeholderFullName: 'Full name',
    placeholderBlazerCode: 'e.g. 01, 05',
    placeholderColorName: 'e.g. Navy Blue',
    alertRequiredFields: 'Please fill in all required fields.',
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
    loginPageTitle: 'Login | Madhusanka Tailors',
  },
  si: {
    pageTitle: 'බ්ලේසර් උකස් කළමනාකරණය | මධුසංක ටේලර්ස්',
    appTitle: 'බ්ලේසර් උකස් කළමනාකරණය',
    businessName: 'මධුසංක ටේලර්ස්',
    langEnglish: 'English',
    langSinhala: 'සිංහල',
    statTotalBookings: 'මුළු වෙන්කිරීම්',
    statActiveRentals: 'ක්‍රියාත්මක උකස්',
    statOverdueItems: 'ප්‍රමාද වූ අයිතම',
    statTodayReturns: 'අද ආපසු දිය යුතු',
    formNewTitle: 'නව උකස් වෙන්කිරීම',
    formNewSubtitle: 'නව උකස් වාර්තාවක් සෑදීමට පහත විස්තර පුරවන්න.',
    formEditTitle: 'උකස් වෙන්කිරීම සංස්කරණය',
    formEditSubtitle: '{name} (කේතය {code}) සඳහා වෙන්කිරීම සංස්කරණය කරමින්.',
    labelCustomerName: 'පාරිභෝගික නම',
    labelPhoneNumber: 'දුරකථන අංකය',
    labelBlazerCode: 'බ්ලේසර් කේතය',
    labelColorName: 'වර්ණ නම',
    labelColorType: 'වර්ණ වර්ගය',
    colorLight: 'සැහැල්ලු වර්ණ',
    colorDark: 'තද වර්ණ',
    labelBookingDate: 'වෙන්කිරීම් දිනය',
    labelPickupDate: 'ගන්නා දිනය',
    labelReturnDate: 'ආපසු දෙන දිනය',
    returnDateHint: 'ගන්නා දිනය + 3 දින (සංස්කරණය කළ හැක)',
    labelTotalPrice: 'මුළු මිල (රු.)',
    labelAdvancePaid: 'අග්‍රිම ගෙවීම (රු.)',
    labelBalanceDue: 'ඉතිරි ශේෂය (රු.)',
    labelDepositType: 'තැන්පතු / තබාගත් හැඳුනුම්පත',
    labelStatus: 'තත්ත්වය',
    depositNationalId: 'ජාතික හැඳුනුම්පත',
    depositDrivingLicense: 'රියදුරු බලපත්‍ර',
    depositCash: 'මුදල් තැන්පතු',
    depositNone: 'නැත',
    statusPending: 'අපේක්ෂා කරමින්',
    statusReturned: 'ආපසු ලබා දුන්',
    btnSaveBooking: 'වෙන්කිරීම සුරකින්න',
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
    mobileCardsHint: 'ජංගම දුරකථනයේ වෙන්කිරීම් card ලෙස පෙන්වයි',
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
    thAdvance: 'අග්‍රිම',
    thBalance: 'ශේෂය',
    thDeposit: 'තැන්පතු/හැඳුනුම්',
    thStatus: 'තත්ත්වය',
    thActions: 'ක්‍රියා',
    badgeReturned: 'ආපසු ලබා දුන්',
    badgeOverdue: 'ප්‍රමාද',
    badgeUpcoming: 'ඉදිරියට',
    badgeDueToday: 'අද ආපසු දිය යුතු',
    badgePending: 'අපේක්ෂා කරමින්',
    btnReturned: 'ආපසු ලබා දුන්',
    btnEdit: 'සංස්කරණය',
    btnDelete: 'මකන්න',
    emptyTitle: 'තවම උකස් වෙන්කිරීම් නැත',
    emptySubtitle: 'ඉහත පෝරමය භාවිතයෙන් ඔබේ පළමු වෙන්කිරීම සාදන්න.',
    footerText: 'දත්ත cloud වල සුරක්ෂිතව · සියලු උපාංග වල sync වේ',
    placeholderFullName: 'සම්පූර්ණ නම',
    placeholderBlazerCode: 'උදා: 01, 05',
    placeholderColorName: 'උදා: නේවි නිල',
    alertRequiredFields: 'කරුණාකර අවශ්‍ය සියලුම ක්ෂේත්‍ර පුරවන්න.',
    confirmDelete: '{name} (කේතය {code}) සඳහා වෙන්කිරීම මකන්නද?',
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
