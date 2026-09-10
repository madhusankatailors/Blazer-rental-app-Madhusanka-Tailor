import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase.js";
import {
  collection,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const sources = { rentals: [], bills: [], sales: [], payments: [] };
const PAGE_SIZE = 12;
let customerPage = 1;
let activeProfileId = "";
const money = (value) =>
  `Rs. ${Number(value || 0).toLocaleString("en-LK", { maximumFractionDigits: 2 })}`;
const escapeHtml = (value) => {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
};
const text = (key, fallback, params = {}) =>
  typeof window.t === "function"
    ? window.t(key, params)
    : fallback.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);

function dateValue(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDate(value) {
  const timestamp = dateValue(value);
  return timestamp ? new Date(timestamp).toLocaleDateString() : "—";
}

function phoneKey(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("0094")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("94") && digits.length >= 11)
    digits = `0${digits.slice(2)}`;
  return digits;
}

function nameKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function profileKey(name, phone) {
  return phoneKey(phone) || `name:${nameKey(name)}`;
}

function buildProfiles() {
  const profiles = new Map();
  const get = (name, phone) => {
    const key = profileKey(name, phone);
    if (!profiles.has(key))
      profiles.set(key, {
        id: key,
        name: name || text("customersUnknown", "Unknown customer"),
        phone: phone || "",
        rentals: 0,
        bills: 0,
        sales: 0,
        paid: 0,
        outstanding: 0,
        lastActivity: 0,
        activity: [],
      });
    const profile = profiles.get(key);
    if (
      !profile.name ||
      profile.name === text("customersUnknown", "Unknown customer")
    )
      profile.name = name || profile.name;
    if (!profile.phone) profile.phone = phone || "";
    return profile;
  };
  const addActivity = (profile, entry) => {
    entry.timestamp = dateValue(entry.date);
    profile.activity.push(entry);
    profile.lastActivity = Math.max(profile.lastActivity, entry.timestamp);
  };
  sources.rentals.forEach((item) => {
    const profile = get(item.customerName, item.phoneNumber);
    const date = item.updatedAt || item.bookingDate;
    profile.rentals += 1;
    profile.paid += Number(item.advancePaid || 0);
    profile.outstanding += Number(
      item.balanceDue ??
        Math.max(
          0,
          Number(item.totalPrice || 0) - Number(item.advancePaid || 0),
        ),
    );
    addActivity(profile, {
      kind: "rental",
      id: item.id,
      type: text("customersRental", "Rental"),
      date,
      detail: item.status || text("statusPending", "Pending"),
      amount: item.totalPrice,
    });
  });
  sources.bills.forEach((item) => {
    const profile = get(item.customerName, item.phone);
    const date = item.updatedAt || item.billDate;
    profile.bills += 1;
    profile.paid += Number(item.paidAmount || item.advanceAmount || 0);
    profile.outstanding += Number(
      item.balanceAmount ??
        Math.max(
          0,
          Number(item.totalAmount || 0) -
            Number(item.paidAmount || item.advanceAmount || 0),
        ),
    );
    addActivity(profile, {
      kind: "bill",
      id: item.id,
      type: text("customersBill", "Bill"),
      date,
      detail: item.billNo || text("customersBill", "Bill"),
      amount: item.totalAmount,
    });
  });
  sources.sales.forEach((item) => {
    const profile = get(item.customerName, item.customerPhone);
    const date = item.updatedAt || item.saleDate;
    profile.sales += 1;
    profile.paid += Number(item.paidAmount || 0);
    profile.outstanding += Number(
      item.balanceAmount ??
        Math.max(
          0,
          Number(item.totalAmount || 0) - Number(item.paidAmount || 0),
        ),
    );
    addActivity(profile, {
      kind: "sale",
      id: item.id,
      type: text("customersShoeSale", "Shoe sale"),
      date,
      detail: item.paymentStatus || text("customersShoeSale", "Sale"),
      amount: item.totalAmount,
    });
  });
  sources.payments.forEach((item) => {
    const sale = sources.sales.find((entry) => entry.id === item.saleId);
    if (sale)
      addActivity(get(sale.customerName, sale.customerPhone), {
        kind: "payment",
        id: item.id,
        type: text("customersPayment", "Payment"),
        date: item.paymentDate || item.createdAt,
        detail: text("customersReceived", "Received"),
        amount: item.paymentAmount,
      });
  });
  return [...profiles.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getFilteredProfiles() {
  const query = $("customerSearch").value.trim().toLowerCase();
  const from = $("customerDateFrom").value
    ? dateValue(`${$("customerDateFrom").value}T00:00:00`)
    : 0;
  const to = $("customerDateTo").value
    ? dateValue(`${$("customerDateTo").value}T23:59:59`)
    : Infinity;
  const type = $("customerTypeFilter").value;
  const balance = $("customerBalanceFilter").value;
  const sort = $("customerSort").value;
  const profiles = buildProfiles().filter((profile) => {
    const matchesText =
      !query ||
      [profile.name, profile.phone, profile.id].some((value) =>
        String(value).toLowerCase().includes(query),
      );
    const matchingActivity = profile.activity.some(
      (entry) =>
        entry.timestamp >= from &&
        entry.timestamp <= to &&
        (type === "all" || entry.kind === type),
    );
    const matchesBalance =
      balance === "all" ||
      (balance === "due" ? profile.outstanding > 0 : profile.outstanding <= 0);
    return matchesText && matchingActivity && matchesBalance;
  });
  return profiles.sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : sort === "balance"
        ? b.outstanding - a.outstanding
        : b.lastActivity - a.lastActivity,
  );
}

function renderPagination(total) {
  const pages = Math.ceil(total / PAGE_SIZE);
  customerPage = Math.min(Math.max(customerPage, 1), Math.max(pages, 1));
  if (pages <= 1) {
    $("customerPagination").innerHTML = "";
    return;
  }

  const from = (customerPage - 1) * PAGE_SIZE + 1;
  const to = Math.min(customerPage * PAGE_SIZE, total);
  const previousLabel = escapeHtml(text("customersPrevious", "Previous"));
  const nextLabel = escapeHtml(text("customersNext", "Next"));
  const showing = escapeHtml(
    text("customersShowing", "Showing {from}–{to} of {total}", {
      from,
      to,
      total,
    }),
  );

  $("customerPagination").innerHTML = `
    <button type="button" data-page="${customerPage - 1}" ${customerPage === 1 ? "disabled" : ""}>
      ‹ ${previousLabel}
    </button>
    <span>${showing}</span>
    <button type="button" data-page="${customerPage + 1}" ${customerPage === pages ? "disabled" : ""}>
      ${nextLabel} ›
    </button>`;
}

function profileCard(profile) {
  const history = [...profile.activity]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 2);
  const latest = history[0];
  const tone =
    profile.outstanding > 0
      ? "is-due"
      : String(latest?.detail || "").toLowerCase() === "pending"
        ? "is-pending"
        : "is-paid";
  const phone = profile.phone
    ? `<a class="phone-call-link" href="tel:${escapeHtml(profile.phone)}">${escapeHtml(profile.phone)}</a>`
    : escapeHtml(text("customersNoPhone", "No phone number"));
  const historyRows = history
    .map(
      (entry) => `
        <div>
          <span>${escapeHtml(entry.type)} · ${escapeHtml(entry.detail)} <small>${formatDate(entry.date)}</small></span>
          <strong>${money(entry.amount)}</strong>
        </div>`,
    )
    .join("");

  return `
    <article class="customer-card ${tone}">
      <div class="customer-card-header">
        <div>
          <h3 class="customer-card-name">${escapeHtml(profile.name)}</h3>
          <p class="customer-card-id">${escapeHtml(profile.phone || profile.id)}</p>
        </div>
        <span class="customer-card-badge">${profile.rentals + profile.bills + profile.sales} ${escapeHtml(text("customersRecords", "records"))}</span>
      </div>
      <p class="customer-card-contact">${phone}</p>
      <div class="customer-card-metrics">
        <div class="customer-balance-metric"><span>${escapeHtml(text("customersBalance", "Balance"))}</span><strong>${money(profile.outstanding)}</strong></div>
        <div><span>${escapeHtml(text("customersPayments", "Payments"))}</span><strong>${money(profile.paid)}</strong></div>
        <div><span>${escapeHtml(text("customersLastActivity", "Last activity"))}</span><strong>${formatDate(profile.lastActivity)}</strong></div>
      </div>
      <div class="customer-card-activity">
        <span class="customer-rental-count">${profile.rentals} ${escapeHtml(text("customersRentals", "rentals"))}</span>
        <span class="customer-bill-count">${profile.bills} ${escapeHtml(text("customersBills", "bills"))}</span>
        <span class="customer-sale-count">${profile.sales} ${escapeHtml(text("customersShoeSales", "shoe sales"))}</span>
      </div>
      <div class="customer-card-history">${historyRows}</div>
      <button type="button" class="customer-detail-button" data-profile-id="${escapeHtml(profile.id)}">
        ${escapeHtml(text("customersViewDetails", "View full profile"))} →
      </button>
    </article>`;
}

function render() {
  const profiles = getFilteredProfiles();
  $("customerTotal").textContent = profiles.length;
  $("customerRentalTotal").textContent = profiles.filter(
    (profile) => profile.rentals > 0,
  ).length;
  $("customerOutstanding").textContent = money(
    profiles.reduce((sum, profile) => sum + profile.outstanding, 0),
  );
  const start = (customerPage - 1) * PAGE_SIZE;
  $("customerList").innerHTML = profiles.length
    ? profiles
        .slice(start, start + PAGE_SIZE)
        .map(profileCard)
        .join("")
    : `<p class="customer-empty">${escapeHtml(text("customersEmpty", "No customers match your search."))}</p>`;
  renderPagination(profiles.length);
  if (activeProfileId) renderDetail();
}

function renderDetail() {
  const profile = buildProfiles().find((item) => item.id === activeProfileId);
  if (!profile) return closeDetail();
  const history = [...profile.activity].sort(
    (a, b) => b.timestamp - a.timestamp,
  );
  const billingCustomer = encodeURIComponent(profile.phone || profile.name);
  const billingLabel = escapeHtml(
    text("customersOpenBilling", "Open bills / create bill"),
  );
  const billingLink = profile.bills
    ? `<a class="customer-open-billing" href="billing.html?customer=${billingCustomer}">${billingLabel} →</a>`
    : "";
  const historyRows = history
    .map((entry) => {
      const editLink =
        entry.kind === "bill"
          ? `<a href="billing.html?editBill=${encodeURIComponent(entry.id)}">${escapeHtml(
              text("customersEditBill", "Edit bill"),
            )}</a>`
          : "";
      return `
        <div class="customer-history-row">
          <div>
            <strong>${escapeHtml(entry.type)} · ${escapeHtml(entry.detail)}</strong>
            <span>${formatDate(entry.date)}</span>
          </div>
          <div>
            <b>${money(entry.amount)}</b>
            ${editLink}
          </div>
        </div>`;
    })
    .join("");

  $("customerDetailContent").innerHTML = `
    <div class="customer-detail-head">
      <h2 id="customerDetailName">${escapeHtml(profile.name)}</h2>
      <p>${escapeHtml(profile.phone || text("customersNoPhone", "No phone number"))}</p>
    </div>
    <div class="customer-detail-totals">
      <div><span>${escapeHtml(text("customersBalance", "Balance"))}</span><strong>${money(profile.outstanding)}</strong></div>
      <div><span>${escapeHtml(text("customersPayments", "Payments"))}</span><strong>${money(profile.paid)}</strong></div>
    </div>
    ${billingLink}
    <h3>${escapeHtml(text("customersFullHistory", "Full history"))}</h3>
    <div class="customer-detail-history">${historyRows}</div>`;
}

function openDetail(id) {
  activeProfileId = id;
  $("customerDetailModal").classList.add("is-open");
  $("customerDetailModal").setAttribute("aria-hidden", "false");
  renderDetail();
}
function closeDetail() {
  activeProfileId = "";
  $("customerDetailModal").classList.remove("is-open");
  $("customerDetailModal").setAttribute("aria-hidden", "true");
}

function listen(name, collectionName) {
  return onSnapshot(
    collection(db, collectionName),
    (snapshot) => {
      sources[name] = snapshot.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      }));
      render();
    },
    () => render(),
  );
}

async function init() {
  const user = await requireAuth();
  if (!user) return;
  ["rentals", "bills", "sales", "payments"].forEach((name, index) =>
    listen(
      name,
      ["rentalRecords", "billRecords", "shoeSales", "shoePayments"][index],
    ),
  );
  [
    "customerSearch",
    "customerDateFrom",
    "customerDateTo",
    "customerTypeFilter",
    "customerBalanceFilter",
    "customerSort",
  ].forEach((id) =>
    $(id).addEventListener(id === "customerSearch" ? "input" : "change", () => {
      customerPage = 1;
      render();
    }),
  );
  $("customerClearFilters").addEventListener("click", () => {
    $("customerSearch").value = "";
    $("customerDateFrom").value = "";
    $("customerDateTo").value = "";
    $("customerTypeFilter").value = "all";
    $("customerBalanceFilter").value = "all";
    $("customerSort").value = "activity";
    customerPage = 1;
    render();
  });
  $("customerPagination").addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button || button.disabled) return;
    customerPage = Number(button.dataset.page);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("customerList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-profile-id]");
    if (button) openDetail(button.dataset.profileId);
  });
  $("customerDetailModal").addEventListener("click", (event) => {
    if (event.target.closest('[data-customer-action="close"]')) closeDetail();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDetail();
  });
  $("logoutBtn").addEventListener("click", logout);
}

window.addEventListener("localechange", render);
init();
