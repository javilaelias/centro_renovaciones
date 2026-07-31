/* ==========================================
   CENTRO DE RENOVACIONES - Application Logic
   ========================================== */

'use strict';

// ---- Constants ----
const API_BASE = window.location.origin + '/api/items';
const CATEGORIES = {
  domain:     { label: 'Dominio',     icon: '\u{1F310}' },
  ssl:        { label: 'SSL',         icon: '\u{1F512}' },
  hosting:    { label: 'Hosting',     icon: '\u{1F5A5}' },
  license:    { label: 'Licencia',    icon: '\u{1F4C4}' },
  insurance:  { label: 'Seguro',      icon: '\u{1F9E1}' },
  certificate:{ label: 'Certificado', icon: '\u{1F393}' },
  tuition:    { label: 'Colegiatura', icon: '\u{1F3EB}' },
  subscription:{ label: 'Suscripción', icon: '\u{1F4B0}' },
  warranty:   { label: 'Garantía',    icon: '\u{1F582}' },
};
const ALERT_DAYS = [90, 60, 30, 7, 1];

// ---- State ----
let items = [];
let currentFilter = 'all';
let currentSort = 'days-asc';
let searchQuery = '';
let editingId = null;
let isLoading = true;
let isOffline = false;
let currentView = 'list';
let calendarDate = new Date();
let selectedCalDate = null;
let calSearchQuery = '';
let calDateFilter = 'all';
let calUrgencyFilter = 'all';
let calCategoryFilter = 'all';
let calDateFrom = '';
let calDateTo = '';

// ---- DOM refs ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const dom = {};

function cacheDom() {
  dom.grid = $('#itemsGrid');
  dom.empty = $('#emptyState');
  dom.emptyAddBtn = $('#emptyAddBtn');
  dom.emptyDemoBtn = $('#emptyDemoBtn');
  dom.sectionTitle = $('#sectionTitle');
  dom.sectionCount = $('#sectionCount');
  dom.searchInput = $('#searchInput');
  dom.sortSelect = $('#sortSelect');
  dom.filterChips = $('#filterChips');
  dom.addBtn = $('#addBtn');
  dom.statTotal = $('#statTotal');
  dom.statOk = $('#statOk');
  dom.statSoon = $('#statSoon');
  dom.statWarning = $('#statWarning');
  dom.statUrgent = $('#statUrgent');
  dom.statExpired = $('#statExpired');
  dom.modalOverlay = $('#modalOverlay');
  dom.modalTitle = $('#modalTitle');
  dom.modalClose = $('#modalClose');
  dom.modalCancel = $('#modalCancel');
  dom.itemForm = $('#itemForm');
  dom.itemId = $('#itemId');
  dom.itemName = $('#itemName');
  dom.itemCategory = $('#itemCategory');
  dom.itemExpiry = $('#itemExpiry');
  dom.itemCost = $('#itemCost');
  dom.itemProvider = $('#itemProvider');
  dom.itemNotes = $('#itemNotes');
  dom.alertEmail = $('#alertEmail');
  dom.alertWhatsApp = $('#alertWhatsApp');
  dom.alertTelegram = $('#alertTelegram');
  dom.modalSave = $('#modalSave');
  dom.confirmOverlay = $('#confirmOverlay');
  dom.confirmText = $('#confirmText');
  dom.confirmClose = $('#confirmClose');
  dom.confirmCancel = $('#confirmCancel');
  dom.confirmDelete = $('#confirmDelete');
  dom.settingsOverlay = $('#settingsOverlay');
  dom.settingsClose = $('#settingsClose');
  dom.settingsCancel = $('#settingsCancel');
  dom.settingsForm = $('#settingsForm');
  dom.settingsSave = $('#settingsSave');
  dom.smtpEnabled = $('#smtpEnabled');
  dom.smtpHost = $('#smtpHost');
  dom.smtpPort = $('#smtpPort');
  dom.smtpUser = $('#smtpUser');
  dom.smtpPass = $('#smtpPass');
  dom.smtpFromEmail = $('#smtpFromEmail');
  dom.smtpFromName = $('#smtpFromName');
  dom.smtpFields = $('#smtpFields');
  dom.testEmailBtn = $('#testEmailBtn');
  dom.twilioEnabled = $('#twilioEnabled');
  dom.twilioAccountSid = $('#twilioAccountSid');
  dom.twilioAuthToken = $('#twilioAuthToken');
  dom.twilioFromNumber = $('#twilioFromNumber');
  dom.twilioToNumber = $('#twilioToNumber');
  dom.twilioFields = $('#twilioFields');
  dom.testSmsBtn = $('#testSmsBtn');
  dom.telegramEnabled = $('#telegramEnabled');
  dom.telegramBotToken = $('#telegramBotToken');
  dom.telegramChatId = $('#telegramChatId');
  dom.telegramFields = $('#telegramFields');
  dom.testTelegramBtn = $('#testTelegramBtn');
  dom.pushEnabled = $('#pushEnabled');
  dom.pushFields = $('#pushFields');
  dom.pushStatus = $('#pushStatus');
  dom.pushSubscribeBtn = $('#pushSubscribeBtn');
  dom.testPushBtn = $('#testPushBtn');
  dom.calendarSection = $('#calendarSection');
  dom.calendarTitle = $('#calendarTitle');
  dom.calMonthCount = $('#calMonthCount');
  dom.calCategoryBreakdown = $('#calCategoryBreakdown');
  dom.calUrgencyBreakdown = $('#calUrgencyBreakdown');
  dom.calendarGrid = $('#calendarGrid');
  dom.calPrev = $('#calPrev');
  dom.calNext = $('#calNext');
  dom.calMonthSelect = $('#calMonthSelect');
  dom.calYearSelect = $('#calYearSelect');
  dom.calTodayBtn = $('#calTodayBtn');
  dom.calDayDetail = $('#calDayDetail');
  dom.calDayDate = $('#calDayDate');
  dom.calDayCats = $('#calDayCats');
  dom.calDayUrgency = $('#calDayUrgency');
  dom.calDayItems = $('#calDayItems');
  dom.calDayClose = $('#calDayClose');
  dom.listViewTab = $('#listViewTab');
  dom.calendarViewTab = $('#calendarViewTab');
  dom.itemsSection = $('#itemsSection');
  dom.calendarLegend = $('#calendarLegend');
  dom.toastContainer = $('#toastContainer');
  // Calendar filter refs
  dom.calSearchInput = $('#calSearchInput');
  dom.calDateChips = $('#calDateChips');
  dom.calUrgencyChips = $('#calUrgencyChips');
  dom.calDateFrom = $('#calDateFrom');
  dom.calDateTo = $('#calDateTo');
  dom.calCustomRange = $('#calCustomRange');
  dom.calFilterCount = $('#calFilterCount');
  dom.calClearFilters = $('#calClearFilters');
  // Login elements
  dom.loginForm = $('#loginForm');
  dom.loginUsername = $('#loginUsername');
  dom.loginPassword = $('#loginPassword');
  dom.loginError = $('#loginError');
  dom.loginBtn = $('#loginBtn');
  dom.loginPage = $('#loginPage');
  dom.appContent = $('#appContent');
  // User account elements
  dom.userName = $('#userName');
  dom.logoutBtn = $('#logoutBtn');
  dom.changePassBtn = $('#changePassBtn');
  dom.passwordOverlay = $('#passwordOverlay');
  dom.passwordClose = $('#passwordClose');
  dom.passwordCancel = $('#passwordCancel');
  dom.passwordForm = $('#passwordForm');
  dom.currentPassword = $('#currentPassword');
  dom.newPassword = $('#newPassword');
  dom.confirmPassword = $('#confirmPassword');
  dom.passwordSave = $('#passwordSave');
}

// ---- Token Management ----
const TOKEN_KEY = 'centro_token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

const USER_KEY = 'centro_user';

function getStoredUsername() {
  return localStorage.getItem(USER_KEY) || 'admin';
}

function setStoredUsername(username) {
  localStorage.setItem(USER_KEY, username);
}

// ---- API Client ----
const API_SETTINGS = window.location.origin + '/api/items/settings';
const API_NOTIFY = window.location.origin + '/api/items/notify';

async function apiRequest(method, path, body) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  const token = getToken();
  if (token) options.headers['Authorization'] = 'Bearer ' + token;
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, options);
  let json;
  try { json = await res.json(); } catch { throw new Error('Respuesta inválida del servidor'); }
  if (!res.ok || !json.success) {
    if (res.status === 401) { clearToken(); location.reload(); throw new Error('Sesión expirada'); }
    throw new Error(json.error || 'Error de conexión con el servidor');
  }
  return json;
}

async function fetchItems() {
  const json = await apiRequest('GET', '');
  items = json.data;
  isOffline = false;
}

async function createItem(data) {
  const json = await apiRequest('POST', '', data);
  items.unshift(json.data);
  return json.data;
}

async function updateItem(id, data) {
  const json = await apiRequest('PUT', `/${id}`, data);
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) items[idx] = json.data;
  return json.data;
}

async function deleteItem(id) {
  await apiRequest('DELETE', `/${id}`);
  items = items.filter(i => i.id !== id);
}

async function seedDemoDataOnServer() {
  if (items.length > 0) {
    const ok = confirm('¿Agregar datos de ejemplo a los existentes? Se añadirán 12 renovaciones de muestra.');
    if (!ok) return;
  }
  const json = await apiRequest('POST', '/seed');
  items = json.data;
  render();
  showToast(`${json.data.length} renovaciones de ejemplo agregadas \u{1F389}`, 'success');
}

async function importItems(importedItems) {
  const json = await apiRequest('POST', '/import', { items: importedItems });
  items = json.data;
  return json.data.length;
}

async function clearAllItems() {
  await apiRequest('DELETE', '');
  items = [];
  render();
  showToast('Todos los items eliminados', 'success');
}

async function apiSettings(method, path, body) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  const token = getToken();
  if (token) options.headers['Authorization'] = 'Bearer ' + token;
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${API_SETTINGS}${path}`, options);
  return res.json();
}

async function fetchSettings() {
  const json = await apiSettings('GET', '');
  return json.data || {};
}

async function saveSettings(data) {
  const json = await apiSettings('PUT', '', data);
  return json.data;
}

async function testEmailSettings(data) {
  const json = await apiSettings('/test', data);
  return json;
}

async function testSmsSettings(data) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(`${API_SETTINGS}/test-sms`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
}

async function testTelegramSettings(data) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(`${API_SETTINGS}/test-telegram`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
}

async function getVapidPublicKey() {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(`${API_SETTINGS}/vapid-public-key`, { headers });
  const json = await res.json();
  return json.success ? json.data.publicKey : null;
}

async function subscribePush(subscription) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(window.location.origin + '/api/items/push/subscribe', {
    method: 'POST',
    headers,
    body: JSON.stringify({ subscription }),
  });
  return res.json();
}

async function unsubscribePush(endpoint) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(window.location.origin + '/api/items/push/unsubscribe', {
    method: 'POST',
    headers,
    body: JSON.stringify({ endpoint }),
  });
  return res.json();
}

async function testPushSettings(subscription) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(`${API_SETTINGS}/test-push`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ subscription }),
  });
  return res.json();
}

async function triggerManualCheck() {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(`${API_NOTIFY}/check`, { method: 'POST', headers });
  return res.json();
}

// ---- Helpers ----
function daysUntil(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr + 'T00:00:00');
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getUrgencyLevel(days) {
  if (days < 0) return 'expired';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'warning';
  if (days <= 60) return 'soon';
  return 'ok';
}

function getDaysLabel(days) {
  if (days < 0) return `Vencido hace ${Math.abs(days)} días`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `${days} días`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') return '';
  return '$' + parseFloat(amount).toFixed(2);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getHostname(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.hostname.replace(/^www\./, '');
  } catch { return url; }
}

// ---- Login Particles ----
function createLoginParticles() {
  const container = $('.login-particles');
  if (!container) return;
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'login-particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.width = p.style.height = (Math.random() * 4 + 2) + 'px';
    p.style.animationDuration = (Math.random() * 15 + 10) + 's';
    p.style.animationDelay = (Math.random() * 10) + 's';
    p.style.opacity = Math.random() * 0.5 + 0.1;
    container.appendChild(p);
  }
}

// ---- Calendar Filter Helpers ----
function getCalendarFilteredItems(opts) {
  let result = [...items];
  // Calendar search
  if (calSearchQuery.trim()) {
    const q = calSearchQuery.toLowerCase().trim();
    result = result.filter(item =>
      item.name.toLowerCase().includes(q) ||
      CATEGORIES[item.category]?.label.toLowerCase().includes(q) ||
      (item.notes && item.notes.toLowerCase().includes(q)) ||
      (item.provider && item.provider.toLowerCase().includes(q))
    );
  }
  // Date range filter
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (calDateFilter === 'month') {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    result = result.filter(item => {
      const d = new Date(item.expiryDate + 'T00:00:00');
      return d >= first && d <= last;
    });
  } else if (calDateFilter === '30d') {
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 30);
    result = result.filter(item => {
      const d = new Date(item.expiryDate + 'T00:00:00');
      return d >= now && d <= limit;
    });
  } else if (calDateFilter === '90d') {
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 90);
    result = result.filter(item => {
      const d = new Date(item.expiryDate + 'T00:00:00');
      return d >= now && d <= limit;
    });
  } else if (calDateFilter === 'custom') {
    if (calDateFrom) {
      const from = new Date(calDateFrom + 'T00:00:00');
      result = result.filter(item => new Date(item.expiryDate + 'T00:00:00') >= from);
    }
    if (calDateTo) {
      const to = new Date(calDateTo + 'T00:00:00');
      result = result.filter(item => new Date(item.expiryDate + 'T00:00:00') <= to);
    }
  }
  // Urgency filter (skip when ignoreUrgency is set, e.g. for the breakdown view)
  if (calUrgencyFilter !== 'all' && !(opts && opts.ignoreUrgency)) {
    result = result.filter(item => {
      const days = daysUntil(item.expiryDate);
      return getUrgencyLevel(days) === calUrgencyFilter;
    });
  }
  // Category filter (skip when ignoreCategory is set, e.g. for the breakdown view)
  if (calCategoryFilter !== 'all' && !(opts && opts.ignoreCategory)) {
    result = result.filter(item => item.category === calCategoryFilter);
  }
  return result;
}

// Count items by category and return sorted entries [[cat, count], ...] descending
function countByCategory(items) {
  const counts = {};
  items.forEach(item => { counts[item.category] = (counts[item.category] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

// Urgency level metadata (labels and CSS dot classes)
const URGENCY_META = {
  ok:      { label: 'En orden',  dot: 'ok' },
  soon:    { label: 'Próximas',  dot: 'soon' },
  warning: { label: 'Alertas',   dot: 'warning' },
  urgent:  { label: 'Urgentes',  dot: 'urgent' },
  expired: { label: 'Vencidas',  dot: 'expired' },
};

// Count items by urgency level in canonical order: ok, soon, warning, urgent, expired
function countByUrgency(items) {
  const order = ['ok', 'soon', 'warning', 'urgent', 'expired'];
  const counts = {};
  items.forEach(item => {
    const level = getUrgencyLevel(daysUntil(item.expiryDate));
    counts[level] = (counts[level] || 0) + 1;
  });
  return order.filter(l => counts[l]).map(l => [l, counts[l]]);
}

// Sync the filter-bar urgency chips with the current urgency filter
function syncUrgencyFilterChips() {
  if (dom.calUrgencyChips) {
    dom.calUrgencyChips.querySelectorAll('.cal-chip').forEach(c => c.classList.toggle('cal-chip-active', c.dataset.filter === calUrgencyFilter));
  }
}

function updateCalendarFilterUI(filteredItems) {
  const filtered = filteredItems || getCalendarFilteredItems();
  const total = items.length;
  const hasFilters = calSearchQuery || calDateFilter !== 'all' || calUrgencyFilter !== 'all' || calCategoryFilter !== 'all' || calDateFrom || calDateTo;
  if (hasFilters) {
    dom.calFilterCount.textContent = `${filtered.length} de ${total} items`;
    dom.calClearFilters.style.display = 'inline-block';
  } else {
    dom.calFilterCount.textContent = `${total} items`;
    dom.calClearFilters.style.display = 'none';
  }
  // Custom range visibility
  dom.calCustomRange.style.display = calDateFilter === 'custom' ? 'flex' : 'none';
}

// ---- Calendar Date Persistence ----
const CAL_DATE_KEY = 'centro_calendar_date';

function saveCalendarDate() {
  try {
    localStorage.setItem(CAL_DATE_KEY, `${calendarDate.getFullYear()}-${calendarDate.getMonth()}`);
  } catch (e) { /* storage unavailable */ }
}

function restoreCalendarDate() {
  const saved = localStorage.getItem(CAL_DATE_KEY);
  if (!saved) return;
  const parts = saved.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month) || month < 0 || month > 11 || year < 2000 || year > 2100) return;
  calendarDate = new Date(year, month, 1);
}

// ---- Calendar Filters Persistence ----
const CAL_FILTERS_KEY = 'centro_calendar_filters';

function saveCalendarFilters() {
  try {
    const data = JSON.stringify({
      search: calSearchQuery,
      date: calDateFilter,
      urgency: calUrgencyFilter,
      category: calCategoryFilter,
      from: calDateFrom,
      to: calDateTo,
    });
    localStorage.setItem(CAL_FILTERS_KEY, data);
  } catch (e) { /* storage unavailable */ }
}

function restoreCalendarFilters() {
  const saved = localStorage.getItem(CAL_FILTERS_KEY);
  if (!saved) return;
  try {
    const f = JSON.parse(saved);
    if (!f || typeof f !== 'object') return;
    calSearchQuery = typeof f.search === 'string' ? f.search : '';
    calDateFilter = ['all', 'month', '30d', '90d', 'custom'].includes(f.date) ? f.date : 'all';
    calUrgencyFilter = ['all', 'ok', 'soon', 'warning', 'urgent', 'expired'].includes(f.urgency) ? f.urgency : 'all';
    calCategoryFilter = (typeof f.category === 'string' && CATEGORIES[f.category]) ? f.category : 'all';
    calDateFrom = typeof f.from === 'string' ? f.from : '';
    calDateTo = typeof f.to === 'string' ? f.to : '';
    // Restore UI controls
    if (dom.calSearchInput) dom.calSearchInput.value = calSearchQuery;
    if (dom.calDateFrom) dom.calDateFrom.value = calDateFrom;
    if (dom.calDateTo) dom.calDateTo.value = calDateTo;
    if (dom.calDateChips) {
      dom.calDateChips.querySelectorAll('.cal-chip').forEach(c => c.classList.toggle('cal-chip-active', c.dataset.filter === calDateFilter));
    }
    syncUrgencyFilterChips();
  } catch (e) { /* corrupted data */ }
}

// ---- Go to Today ----
function goToToday() {
  calendarDate = new Date();
  calendarDate.setDate(1);
  selectedCalDate = null;
  if (dom.calDayDetail) dom.calDayDetail.style.display = 'none';
  renderCalendar();
}

// ---- Go to First Day of Visible Month ----
function goToFirstDayOfMonth() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  selectedCalDate = firstDateStr;
  showCalendarDayDetail(firstDateStr);
  renderCalendar();
}

// ---- Calendar Month/Year Picker ----
function initCalendarMonthYearPicker() {
  if (!dom.calMonthSelect || !dom.calYearSelect) return;
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  dom.calMonthSelect.innerHTML = monthNames.map((m, i) => `<option value="${i}">${m}</option>`).join('');
  // Build year range from items + current year (with margin)
  const years = new Set([new Date().getFullYear()]);
  items.forEach(item => {
    const y = parseInt(item.expiryDate, 10);
    if (!isNaN(y)) years.add(y);
  });
  const minYear = Math.min(...years) - 1;
  const maxYear = Math.max(...years) + 1;
  let yearOptions = '';
  for (let y = minYear; y <= maxYear; y++) yearOptions += `<option value="${y}">${y}</option>`;
  dom.calYearSelect.innerHTML = yearOptions;
  // Jump to the selected month/year
  dom.calMonthSelect.addEventListener('change', () => {
    calendarDate = new Date(calendarDate.getFullYear(), parseInt(dom.calMonthSelect.value, 10), 1);
    selectedCalDate = null;
    dom.calDayDetail.style.display = 'none';
    renderCalendar();
  });
  dom.calYearSelect.addEventListener('change', () => {
    calendarDate = new Date(parseInt(dom.calYearSelect.value, 10), calendarDate.getMonth(), 1);
    selectedCalDate = null;
    dom.calDayDetail.style.display = 'none';
    renderCalendar();
  });
}

// ---- Calendar Rendering ----
function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  // Note: the title (with month total) is set later via innerHTML in this function
  // Keep month/year pickers in sync with the displayed month
  if (dom.calMonthSelect) dom.calMonthSelect.value = String(month);
  if (dom.calYearSelect) {
    if (!dom.calYearSelect.querySelector(`option[value="${year}"]`)) {
      const opt = document.createElement('option');
      opt.value = String(year); opt.textContent = String(year);
      dom.calYearSelect.appendChild(opt);
      const sorted = [...dom.calYearSelect.options].sort((a, b) => parseInt(a.value) - parseInt(b.value));
      dom.calYearSelect.innerHTML = '';
      sorted.forEach(o => dom.calYearSelect.appendChild(o));
    }
    dom.calYearSelect.value = String(year);
  }
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  // Highlight the 'Hoy' button when viewing the current month
  if (dom.calTodayBtn) {
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    dom.calTodayBtn.classList.toggle('is-today', isCurrentMonth);
  }
  const filteredItems = getCalendarFilteredItems();
  updateCalendarFilterUI(filteredItems);
  // Count renewals in the visible month — filtered (respecting filters) and total (all items)
  const inVisibleMonth = (item) => {
    const d = new Date(item.expiryDate + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  };
  const monthItems = filteredItems.filter(inVisibleMonth);
  const monthFilteredCount = monthItems.length;
  const monthTotalCount = items.filter(inVisibleMonth).length;
  const hasActiveFilters = calSearchQuery || calDateFilter !== 'all' || calUrgencyFilter !== 'all' || calDateFrom || calDateTo;
  // Title always shows the month total; when filters reduce the count, show "X de Y"
  const pluralRenewals = (n) => (n === 1 ? 'renovación' : 'renovaciones');
  const titleLabel = (hasActiveFilters && monthFilteredCount !== monthTotalCount)
    ? `${monthFilteredCount} de ${monthTotalCount} ${pluralRenewals(monthTotalCount)}`
    : `${monthTotalCount} ${pluralRenewals(monthTotalCount)}`;
  dom.calendarTitle.innerHTML = `${monthNames[month]} ${year} <span class="cal-title-count" role="button" tabindex="0" title="Ir al primer día del mes visible">· ${titleLabel}</span>`;
  if (dom.calMonthCount) {
    dom.calMonthCount.textContent = String(monthFilteredCount);
    dom.calMonthCount.classList.toggle('is-empty', monthFilteredCount === 0);
    dom.calMonthCount.title = `${monthFilteredCount} ${pluralRenewals(monthFilteredCount)} en ${monthNames[month]} ${year} — clic para ir al día 1`;
  }
  // Category breakdown for the visible month (ignores the category filter so all chips stay visible)
  if (dom.calCategoryBreakdown) {
    const breakdownItems = getCalendarFilteredItems({ ignoreCategory: true }).filter(inVisibleMonth);
    const catEntries = countByCategory(breakdownItems);
    // Keep the active category chip visible even if it has 0 items in the visible month
    if (calCategoryFilter !== 'all' && !catEntries.some(([cat]) => cat === calCategoryFilter)) {
      catEntries.push([calCategoryFilter, 0]);
    }
    if (catEntries.length === 0) {
      dom.calCategoryBreakdown.style.display = 'none';
      dom.calCategoryBreakdown.innerHTML = '';
    } else {
      dom.calCategoryBreakdown.style.display = 'flex';
      dom.calCategoryBreakdown.innerHTML = catEntries.map(([cat, n]) => {
        const meta = CATEGORIES[cat] || { label: cat, icon: '' };
        const isActive = calCategoryFilter === cat;
        return `<span class="cal-cat-chip${isActive ? ' is-active' : ''}" data-category="${escapeHtml(cat)}" role="button" tabindex="0" title="${escapeHtml(meta.label)}">${meta.icon} ${escapeHtml(meta.label)} <b>${n}</b></span>`;
      }).join('');
    }
  }
  // Urgency breakdown for the visible month (ignores the urgency filter so all chips stay visible)
  if (dom.calUrgencyBreakdown) {
    const urgencyBreakdownItems = getCalendarFilteredItems({ ignoreUrgency: true }).filter(inVisibleMonth);
    const urgencyEntries = countByUrgency(urgencyBreakdownItems);
    // Keep the active urgency chip visible even if it has 0 items in the visible month
    if (calUrgencyFilter !== 'all' && !urgencyEntries.some(([lvl]) => lvl === calUrgencyFilter)) {
      urgencyEntries.push([calUrgencyFilter, 0]);
    }
    if (urgencyEntries.length === 0) {
      dom.calUrgencyBreakdown.style.display = 'none';
      dom.calUrgencyBreakdown.innerHTML = '';
    } else {
      dom.calUrgencyBreakdown.style.display = 'flex';
      dom.calUrgencyBreakdown.innerHTML = urgencyEntries.map(([level, n]) => {
        const meta = URGENCY_META[level] || { label: level, dot: 'ok' };
        const isActive = calUrgencyFilter === level;
        return `<span class="cal-urgency-chip${isActive ? ' is-active' : ''}" data-urgency="${level}" role="button" tabindex="0" title="${escapeHtml(meta.label)}"><span class="cal-dot dot-${meta.dot}"></span> ${escapeHtml(meta.label)} <b>${n}</b></span>`;
      }).join('');
    }
  }
  let html = '';
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  for (let i = firstDay - 1; i >= 0; i--) {
    html += `<div class="calendar-day other-month"><div class="day-number">${daysInPrevMonth - i}</div></div>`;
  }
  let dayIdx = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const isSelected = selectedCalDate === dateStr;
    const dayItems = filteredItems.filter(item => item.expiryDate === dateStr);
    let classes = 'calendar-day';
    if (isToday) classes += ' today';
    if (isSelected) classes += ' selected';
    const waveDelay = (dayIdx % 7) * 0.02 + Math.floor(dayIdx / 7) * 0.06;
    let itemsHtml = '';
    if (dayItems.length > 0) {
      itemsHtml = '<div class="day-items">';
      dayItems.slice(0, 3).forEach((item, i) => {
        const days = daysUntil(item.expiryDate);
        const level = getUrgencyLevel(days);
        itemsHtml += `<div class="day-item level-${level}" title="${escapeHtml(item.name)}" style="animation-delay:${i * 0.06}s">${escapeHtml(item.name)}</div>`;
      });
      if (dayItems.length > 3) {
        itemsHtml += `<div class="day-item" style="background:transparent;color:var(--primary-400);font-size:0.55rem;">+${dayItems.length - 3} más</div>`;
      }
      itemsHtml += '</div>';
    }
    html += `<div class="${classes}" data-date="${dateStr}" style="animation-delay:${waveDelay}s">\n      <div class="day-number">${d}</div>\n      ${itemsHtml}\n    </div>`;
    dayIdx++;
  }
  const totalCells = firstDay + daysInMonth;
  const remaining = 42 - totalCells;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="calendar-day other-month"><div class="day-number">${i}</div></div>`;
  }
  dom.calendarGrid.innerHTML = html;
  dom.calendarGrid.querySelectorAll('.calendar-day:not(.other-month)').forEach(dayEl => {
    dayEl.addEventListener('click', () => {
      selectedCalDate = dayEl.dataset.date;
      showCalendarDayDetail(dayEl.dataset.date);
      renderCalendar();
    });
  });
  saveCalendarDate();
}

function clearCalendarFilters() {
  calSearchQuery = '';
  calDateFilter = 'all';
  calUrgencyFilter = 'all';
  calCategoryFilter = 'all';
  calDateFrom = '';
  calDateTo = '';
  if (dom.calSearchInput) dom.calSearchInput.value = '';
  if (dom.calDateFrom) dom.calDateFrom.value = '';
  if (dom.calDateTo) dom.calDateTo.value = '';
  // Reset chips
  if (dom.calDateChips) {
    dom.calDateChips.querySelectorAll('.cal-chip').forEach(c => c.classList.remove('cal-chip-active'));
    dom.calDateChips.querySelector('[data-filter="all"]')?.classList.add('cal-chip-active');
  }
  if (dom.calUrgencyChips) {
    dom.calUrgencyChips.querySelectorAll('.cal-chip').forEach(c => c.classList.remove('cal-chip-active'));
    dom.calUrgencyChips.querySelector('[data-filter="all"]')?.classList.add('cal-chip-active');
  }
  saveCalendarFilters();
  renderCalendar();
}

function showCalendarDayDetail(dateStr) {
  const filteredItems = getCalendarFilteredItems();
  const dayItems = filteredItems.filter(item => item.expiryDate === dateStr);
  if (dayItems.length === 0) { dom.calDayDetail.style.display = 'none'; return; }
  const d = new Date(dateStr + 'T00:00:00');
  dom.calDayDate.textContent = d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  let itemsHtml = '';
  dayItems.forEach((item, i) => {
    const days = daysUntil(item.expiryDate);
    const level = getUrgencyLevel(days);
    const cat = CATEGORIES[item.category] || { label: item.category, icon: '' };
    itemsHtml += `\n      <div class="cal-day-item-card level-${level}" onclick="openEdit('${item.id}')" style="animation-delay:${i * 0.06}s">\n        <span class="cal-day-item-name">${cat.icon} ${escapeHtml(item.name)}</span>\n        <span class="cal-day-item-cat">${cat.label}</span>\n        <span class="day-item level-${level}" style="font-size:0.7rem;">${getDaysLabel(days)}</span>\n      </div>`;
  });
  dom.calDayItems.innerHTML = itemsHtml;
  // Category breakdown for this day
  if (dom.calDayCats) {
    const dayCatEntries = countByCategory(dayItems);
    dom.calDayCats.innerHTML = dayCatEntries.map(([cat, n]) => {
      const meta = CATEGORIES[cat] || { label: cat, icon: '' };
      return `<span class="cal-day-cat-chip" title="${escapeHtml(meta.label)}">${meta.icon} ${escapeHtml(meta.label)} <b>${n}</b></span>`;
    }).join('');
  }
  // Urgency breakdown for this day
  if (dom.calDayUrgency) {
    const dayUrgencyEntries = countByUrgency(dayItems);
    dom.calDayUrgency.innerHTML = dayUrgencyEntries.map(([level, n]) => {
      const meta = URGENCY_META[level] || { label: level, dot: 'ok' };
      return `<span class="cal-day-urgency-chip" title="${escapeHtml(meta.label)}"><span class="cal-dot dot-${meta.dot}"></span> ${escapeHtml(meta.label)} <b>${n}</b></span>`;
    }).join('');
  }
  dom.calDayDetail.style.display = 'block';
}

function switchView(view) {
  currentView = view;
  if (view === 'list') {
    dom.itemsSection.style.display = 'block';
    dom.calendarSection.style.display = 'none';
    dom.listViewTab.classList.add('view-tab-active');
    dom.calendarViewTab.classList.remove('view-tab-active');
  } else {
    dom.itemsSection.style.display = 'none';
    dom.calendarSection.style.display = 'block';
    dom.calendarViewTab.classList.add('view-tab-active');
    dom.listViewTab.classList.remove('view-tab-active');
    renderCalendar();
  }
}

// ---- Skeleton Loading ----
function renderSkeletons() {
  let html = '';
  for (let i = 0; i < 6; i++) {
    html += `\n      <div class="skeleton-card" style="animation-delay:${i * 0.05}s">\n        <div class="skeleton-line skeleton-line-sm" style="width:40%;height:18px;margin-bottom:12px;"></div>\n        <div class="skeleton-line skeleton-line-lg" style="height:20px;margin-bottom:10px;"></div>\n        <div class="skeleton-line skeleton-line-md" style="height:28px;margin-bottom:12px;"></div>\n        <div class="skeleton-line skeleton-line-sm" style="width:50%;"></div>\n        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--surface-border);display:flex;gap:8px;">\n          <div class="skeleton-line" style="width:70px;height:28px;border-radius:8px;"></div>\n          <div class="skeleton-line" style="width:80px;height:28px;border-radius:8px;"></div>\n        </div>\n      </div>`;
  }
  return `<div class="skeleton-grid">${html}</div>`;
}

// ---- Animated Number Counting ----
function animateNumber(el, target) {
  const current = parseInt(el.textContent) || 0;
  if (current === target || el._animating) return;
  el._animating = true;
  const duration = 800;
  const start = performance.now();
  const delta = target - current;
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(current + delta * eased);
    if (progress < 1) requestAnimationFrame(update);
    else el._animating = false;
  }
  requestAnimationFrame(update);
}

// ---- Filtering & Sorting ----
function getFilteredItems() {
  let result = [...items];
  if (currentFilter !== 'all') result = result.filter(item => item.category === currentFilter);
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter(item =>
      item.name.toLowerCase().includes(q) ||
      CATEGORIES[item.category]?.label.toLowerCase().includes(q) ||
      (item.notes && item.notes.toLowerCase().includes(q)) ||
      (item.provider && item.provider.toLowerCase().includes(q))
    );
  }
  result.sort((a, b) => {
    const daysA = daysUntil(a.expiryDate);
    const daysB = daysUntil(b.expiryDate);
    switch (currentSort) {
      case 'days-asc':  return daysA - daysB;
      case 'days-desc': return daysB - daysA;
      case 'name':      return a.name.localeCompare(b.name);
      case 'category':  return a.category.localeCompare(b.category) || daysA - daysB;
      default:          return daysA - daysB;
    }
  });
  return result;
}

// ---- Rendering with Skeletons & Animated Stats ----
function render() {
  const filtered = getFilteredItems();
  const total = items.length;
  updateStats();
  const catLabel = currentFilter === 'all' ? 'Todas las renovaciones' : CATEGORIES[currentFilter]?.label + 's';
  dom.sectionTitle.textContent = catLabel;
  dom.sectionCount.textContent = `${filtered.length} de ${total} ítems`;
  if (isLoading) {
    dom.grid.innerHTML = renderSkeletons();
    dom.empty.style.display = 'none';
    return;
  }
  if (isOffline) {
    dom.grid.innerHTML = `\n      <div class="error-state">\n        <div class="error-icon">&#x26A0;&#xFE0F;</div>\n        <h3>Error de conexión</h3>\n        <p>No se puede conectar con el servidor. Asegúrate de que el backend esté corriendo.</p>\n        <button class="btn btn-primary" onclick="location.reload()">Reintentar</button>\n      </div>`;
    dom.empty.style.display = 'none';
    return;
  }
  if (filtered.length === 0) { dom.grid.innerHTML = ''; dom.empty.style.display = 'block'; return; }
  dom.empty.style.display = 'none';
  dom.grid.innerHTML = filtered.map((item, index) => renderCard(item, index)).join('');
}

function renderCard(item, index) {
  const days = daysUntil(item.expiryDate);
  const level = getUrgencyLevel(days);
  const cat = CATEGORIES[item.category] || { label: item.category, icon: '' };
  const isExpired = days < 0;
  const providerUrl = item.provider && (item.provider.startsWith('http') ? item.provider : 'https://' + item.provider);
  const hasCost = item.cost !== null && item.cost !== undefined && item.cost >= 0;
  return `\n    <div class="item-card level-${level}" style="animation-delay:${index * 0.04}s">\n      <div class="item-card-header">\n        <span class="item-category">${cat.icon} ${cat.label}</span>\n        <div class="item-notifs">\n          <span class="notif-icon active" title="Notificaciones Push activadas" data-tooltip="Push activado">&#x1F4EA;</span>
          <span class="notif-icon ${item.alertEmail ? 'active' : ''}" title="Recibir alertas por email" data-tooltip="${item.alertEmail ? 'Email activado' : 'Email desactivado'}">&#x2709;</span>
          <span class="notif-icon ${item.alertWhatsApp ? 'active' : ''}" title="Recibir alertas por SMS" data-tooltip="${item.alertWhatsApp ? 'WhatsApp/SMS activado' : 'WhatsApp/SMS desactivado'}">&#x1F4AC;</span>
          <span class="notif-icon ${item.alertTelegram ? 'active' : ''}" title="Recibir alertas por Telegram" data-tooltip="${item.alertTelegram ? 'Telegram activado' : 'Telegram desactivado'}">&#x1F4E2;</span>\n        </div>\n      </div>\n      <div class="item-name">${escapeHtml(item.name)}</div>\n      <div class="item-days">\n        <span class="days-badge ${isExpired ? 'expired' : level}">\n          ${isExpired ? '\u{23F0}' : '\u{1F552}'}
          ${getDaysLabel(days)}\n        </span>\n        <span class="days-label">${formatDate(item.expiryDate)}</span>\n      </div>\n      <div class="item-meta">\n        ${hasCost ? `<span class="item-cost">${formatCurrency(item.cost)}</span>` : ''}
        ${providerUrl ? `<a href="${providerUrl}" target="_blank" rel="noopener" class="item-provider" title="Ir al proveedor">${getHostname(item.provider)}</a>` : ''}\n      </div>\n      ${item.notes ? `<div class="item-notes">${escapeHtml(item.notes)}</div>` : ''}\n      <div class="item-actions">\n        <button class="item-action-btn edit" data-id="${item.id}" onclick="openEdit('${item.id}')" data-tooltip="Editar renovación">\n          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>\n          Editar\n        </button>\n        <button class="item-action-btn delete" data-id="${item.id}" onclick="confirmDelete('${item.id}')" data-tooltip="Eliminar renovación" data-tooltip-left>\n          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>\n          Eliminar\n        </button>\n      </div>\n    </div>`;
}

// ---- Stats with Progress Bars & Animated Numbers ----
function updateStats() {
  const stats = { total: items.length, ok: 0, soon: 0, warning: 0, urgent: 0, expired: 0 };
  items.forEach(item => {
    const days = daysUntil(item.expiryDate);
    stats[getUrgencyLevel(days)]++;
  });
  animateNumber(dom.statTotal, stats.total);
  animateNumber(dom.statOk, stats.ok);
  animateNumber(dom.statSoon, stats.soon);
  animateNumber(dom.statWarning, stats.warning);
  animateNumber(dom.statUrgent, stats.urgent);
  animateNumber(dom.statExpired, stats.expired);
  const total = stats.total || 1;
  updateStatProgress('statOk', stats.ok / total * 100);
  updateStatProgress('statSoon', stats.soon / total * 100);
  updateStatProgress('statWarning', stats.warning / total * 100);
  updateStatProgress('statUrgent', stats.urgent / total * 100);
  updateStatProgress('statExpired', stats.expired / total * 100);
}

function updateStatProgress(statId, percent) {
  const el = document.getElementById(statId);
  if (!el) return;
  const bar = el.closest('.stat-card')?.querySelector('.stat-progress-bar');
  if (bar) bar.style.width = `${Math.min(percent, 100)}%`;
}

// ---- Modal ----
function openModal(title, itemData) {
  dom.modalTitle.textContent = title;
  dom.modalOverlay.style.display = 'flex';
  if (itemData) {
    dom.itemId.value = itemData.id || '';
    dom.itemName.value = itemData.name || '';
    dom.itemCategory.value = itemData.category || '';
    dom.itemExpiry.value = itemData.expiryDate || '';
    dom.itemCost.value = itemData.cost ?? '';
    dom.itemProvider.value = itemData.provider || '';
    dom.itemNotes.value = itemData.notes || '';
    dom.alertEmail.checked = itemData.alertEmail || false;
    dom.alertWhatsApp.checked = itemData.alertWhatsApp || false;
    dom.alertTelegram.checked = itemData.alertTelegram || false;
  } else {
    dom.itemForm.reset();
    dom.itemId.value = '';
    dom.alertEmail.checked = false;
    dom.alertWhatsApp.checked = false;
    dom.alertTelegram.checked = false;
  }
  const today = new Date().toISOString().split('T')[0];
  dom.itemExpiry.min = today;
}

function closeModal() { dom.modalOverlay.style.display = 'none'; editingId = null; }

function openNew() { editingId = null; openModal('Nueva renovación'); dom.itemName.focus(); }

function openEdit(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  editingId = id;
  openModal('Editar renovación', item);
  dom.itemName.focus();
}

// ---- Confirm Delete ----
let deleteTargetId = null;

function confirmDelete(id) {
  deleteTargetId = id;
  const item = items.find(i => i.id === id);
  dom.confirmText.textContent = `¿Eliminar "${item?.name || 'esta renovación'}"? Esta acción no se puede deshacer.`;
  dom.confirmOverlay.style.display = 'flex';
}

function closeConfirm() { dom.confirmOverlay.style.display = 'none'; deleteTargetId = null; }

async function executeDelete() {
  if (!deleteTargetId) return;
  const id = deleteTargetId;
  dom.confirmDelete.disabled = true;
  dom.confirmDelete.innerHTML = 'Eliminando...';
  try {
    await deleteItem(id);
    render();
    closeConfirm();
    showToast('Renovación eliminada', 'success');
  } catch (err) {
    showToast(err.message || 'Error al eliminar', 'error');
  } finally {
    dom.confirmDelete.disabled = false;
    dom.confirmDelete.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Eliminar`;
  }
}

// ---- Form Submit ----
async function handleFormSubmit(e) {
  e.preventDefault();
  const name = dom.itemName.value.trim();
  const category = dom.itemCategory.value;
  const expiryDate = dom.itemExpiry.value;
  if (!name) { showToast('El nombre es obligatorio', 'error'); dom.itemName.focus(); return; }
  if (!category) { showToast('Selecciona una categoría', 'error'); dom.itemCategory.focus(); return; }
  if (!expiryDate) { showToast('La fecha de vencimiento es obligatoria', 'error'); dom.itemExpiry.focus(); return; }
  const itemData = {
    name, category, expiryDate,
    cost: dom.itemCost.value ? parseFloat(dom.itemCost.value) : null,
    provider: dom.itemProvider.value.trim() || '',
    notes: dom.itemNotes.value.trim() || '',
    alertEmail: dom.alertEmail.checked,
    alertWhatsApp: dom.alertWhatsApp.checked,
    alertTelegram: dom.alertTelegram.checked,
  };
  dom.modalSave.disabled = true;
  dom.modalSave.innerHTML = 'Guardando...';
  try {
    if (editingId) {
      await updateItem(editingId, itemData);
      showToast('Renovación actualizada', 'success');
    } else {
      const created = await createItem(itemData);
      showToast('Renovación agregada', 'success');
      checkAlerts(created);
    }
    render();
    closeModal();
  } catch (err) {
    showToast(err.message || 'Error al guardar', 'error');
  } finally {
    dom.modalSave.disabled = false;
    dom.modalSave.innerHTML = `\n      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>\n      Guardar\n    `;
  }
}

// ---- Alerts ----
function checkAlerts(item) {
  const days = daysUntil(item.expiryDate);
  ALERT_DAYS.forEach(threshold => {
    if (days === threshold) {
      if ('Notification' in window && Notification.permission === 'granted') {
        const cat = CATEGORIES[item.category]?.label || item.category;
        new Notification(`\u{26A0}\u{FE0F} ${item.name} vence en ${threshold} días`, { body: `${cat} — ${formatDate(item.expiryDate)}` });
      }
      const thresholdLabel = threshold === 1 ? 'mañana' : `en ${threshold} días`;
      showToast(`\u{1F514} ${item.name} vence ${thresholdLabel}`, 'info');
    }
  });
}

// ---- Theme (Light/Dark) ----
const THEME_KEY = 'centro_theme';

function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function setTheme(theme) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function initTheme() {
  setTheme(getPreferredTheme());
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(THEME_KEY)) setTheme(e.matches ? 'dark' : 'light');
    });
  }
}

// ---- Theme Color (Accent/Hue) ----
const THEME_COLOR_KEY = 'centro_theme_color';
const THEME_COLORS = {
  default: { name: 'Clásico',   color: '#3b82f6' },
  emerald: { name: 'Esmeralda', color: '#10b981' },
  purple:  { name: 'Púrpura',   color: '#8b5cf6' },
  rose:    { name: 'Rosa',      color: '#f43f5e' },
  amber:   { name: 'Ámbar',     color: '#f59e0b' },
  teal:    { name: 'Teal',      color: '#14b8a6' },
  ocean:   { name: 'Océano',    color: '#06b6d4' },
  indigo:  { name: 'Índigo',    color: '#6366f1' },
};

function getThemeColor() {
  return localStorage.getItem(THEME_COLOR_KEY) || 'default';
}

function setThemeColor(color) {
  localStorage.setItem(THEME_COLOR_KEY, color);
  applyThemeColor(color);
}

function applyThemeColor(color) {
  if (color === 'default') {
    document.documentElement.removeAttribute('data-theme-color');
  } else {
    document.documentElement.setAttribute('data-theme-color', color);
  }
  // Update the dot indicator
  const dot = $('#themeColorDot');
  if (dot) {
    const info = THEME_COLORS[color] || THEME_COLORS.default;
    dot.style.background = info.color;
  }
  // Update active swatch in panel
  document.querySelectorAll('.theme-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.color === color);
  });
}

function setupThemeColorPicker() {
  const toggle = $('#themeColorToggle');
  const panel = $('#themeColorPanel');
  if (!toggle || !panel) return;

  // Toggle panel open/close
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = panel.style.display === 'block';
    if (isOpen) {
      closeThemePanel(panel);
    } else {
      panel.classList.remove('closing');
      panel.style.display = 'block';
    }
  });

  function closeThemePanel(panelEl) {
    panelEl.classList.add('closing');
    setTimeout(() => {
      panelEl.style.display = 'none';
      panelEl.classList.remove('closing');
    }, 200);
  }

  // Swatch click
  panel.querySelectorAll('.theme-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      const color = swatch.dataset.color;
      setThemeColor(color);
      showToast(`Tema "${THEME_COLORS[color].name}" aplicado`, 'success');
      closeThemePanel(panel);
    });
  });

  // Click outside to close
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !panel.contains(e.target) && panel.style.display === 'block') {
      closeThemePanel(panel);
    }
  });

  // Apply saved color
  applyThemeColor(getThemeColor());
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
}

// ---- Toast ----
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '\u2705', error: '\u274C', info: '\u2139\uFE0F' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  dom.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ---- Notification Buttons ----
function notifyWhatsApp() {
  const soon = items.filter(i => { const d = daysUntil(i.expiryDate); return d >= 0 && d <= 30; });
  if (soon.length === 0) { showToast('No hay renovaciones próximas para compartir', 'info'); return; }
  let msg = '\u{1F514} *Centro de Renovaciones* - Próximos vencimientos:\n\n';
  soon.forEach(item => {
    const cat = CATEGORIES[item.category]?.icon || '';
    const days = daysUntil(item.expiryDate);
    msg += `${cat} *${item.name}* — ${getDaysLabel(days)}\n`;
  });
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function notifyTelegram() {
  const soon = items.filter(i => { const d = daysUntil(i.expiryDate); return d >= 0 && d <= 30; });
  if (soon.length === 0) { showToast('No hay renovaciones próximas para compartir', 'info'); return; }
  let msg = '\u{1F514} Centro de Renovaciones - Próximos vencimientos:\n\n';
  soon.forEach(item => {
    const cat = CATEGORIES[item.category]?.icon || '';
    const days = daysUntil(item.expiryDate);
    msg += `${cat} ${item.name} — ${getDaysLabel(days)}\n`;
  });
  window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(msg)}`, '_blank');
}

function notifyEmail() {
  const upcoming = items.filter(i => { const d = daysUntil(i.expiryDate); return d >= 0 && d <= 90; });
  if (upcoming.length === 0) { showToast('No hay renovaciones próximas', 'info'); return; }
  let body = 'Resumen de renovaciones próximas:\n\n';
  upcoming.forEach(item => {
    const cat = CATEGORIES[item.category]?.label || item.category;
    const days = daysUntil(item.expiryDate);
    const status = getUrgencyLevel(days);
    body += `[${status.toUpperCase()}] ${item.name} (${cat}) — ${getDaysLabel(days)} — ${formatDate(item.expiryDate)}\n`;
  });
  window.open(`mailto:?subject=${encodeURIComponent('Centro de Renovaciones - Recordatorio')}&body=${encodeURIComponent(body)}`, '_blank');
  showToast('Cliente de correo abierto', 'success');
}

function notifyPushAll() {
  requestNotificationPermission();
  if (!('Notification' in window) || Notification.permission !== 'granted') { showToast('Permiso de notificaciones no concedido', 'error'); return; }
  const urgent = items.filter(i => { const d = daysUntil(i.expiryDate); return d >= 0 && d <= 7; });
  if (urgent.length === 0) { showToast('No hay renovaciones urgentes', 'info'); return; }
  urgent.forEach(item => {
    const days = daysUntil(item.expiryDate);
    const cat = CATEGORIES[item.category]?.label || item.category;
    new Notification(`\u{26A0}\u{FE0F} Urgente: ${item.name}`, { body: `${cat} — ${getDaysLabel(days)}` });
  });
  showToast(`${urgent.length} notificaciones enviadas`, 'success');
}

// ---- Export / Import ----
function exportData() {
  if (items.length === 0) { showToast('No hay datos para exportar', 'info'); return; }
  const data = JSON.stringify(items, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `centro-renovaciones-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Datos exportados', 'success');
}

// ---- Export filtered data (CSV / PDF) ----
function getExportItems() {
  return currentView === 'calendar' ? getCalendarFilteredItems() : getFilteredItems();
}

function exportCsv() {
  const data = getExportItems();
  if (data.length === 0) { showToast('No hay datos filtrados para exportar', 'info'); return; }
  const headers = ['Nombre', 'Categoría', 'Fecha de vencimiento', 'Estado', 'Días', 'Costo', 'Proveedor', 'Notas'];
  const levelLabels = { ok: 'En orden', soon: 'Próxima', warning: 'Alerta', urgent: 'Urgente', expired: 'Vencida' };
  const esc = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    // Proteger contra inyección de fórmulas en Excel (=, +, -, @)
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = data.map(item => {
    const days = daysUntil(item.expiryDate);
    const level = getUrgencyLevel(days);
    return [
      esc(item.name),
      esc(CATEGORIES[item.category]?.label || item.category),
      esc(item.expiryDate),
      esc(levelLabels[level] || level),
      days,
      item.cost != null && item.cost !== '' ? item.cost : '',
      esc(item.provider || ''),
      esc(item.notes || '')
    ].join(',');
  });
  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `centro-renovaciones-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${data.length} renovaciones exportadas a CSV`, 'success');
}

function exportPdf() {
  const data = getExportItems();
  if (data.length === 0) { showToast('No hay datos filtrados para exportar', 'info'); return; }
  const win = window.open('', '_blank', 'width=900,height=650');
  if (!win) { showToast('Permite ventanas emergentes para exportar PDF', 'error'); return; }
  const levelColors = { ok: '#10b981', soon: '#f59e0b', warning: '#f97316', urgent: '#ef4444', expired: '#94a3b8' };
  const levelLabels = { ok: 'En orden', soon: 'Próxima', warning: 'Alerta', urgent: 'Urgente', expired: 'Vencida' };
  const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const viewLabel = currentView === 'calendar' ? 'Calendario' : 'Lista';
  const rowsHtml = data.map(item => {
    const days = daysUntil(item.expiryDate);
    const level = getUrgencyLevel(days);
    const color = levelColors[level];
    return `\n      <tr>\n        <td class="name"><strong>${escapeHtml(item.name)}</strong></td>\n        <td>${escapeHtml(CATEGORIES[item.category]?.label || item.category)}</td>\n        <td>${escapeHtml(formatDate(item.expiryDate))}</td>\n        <td><span class="badge" style="background:${color}22;color:${color};border:1px solid ${color}55;">${levelLabels[level]}</span></td>\n        <td class="days" style="color:${color};">${getDaysLabel(days)}</td>\n        <td class="cost">${item.cost != null ? escapeHtml(formatCurrency(item.cost)) : ''}</td>\n      </tr>`;
  }).join('');
  win.document.write(`<!DOCTYPE html>\n<html lang="es"><head><meta charset="UTF-8"><title>Centro de Renovaciones</title><style>\n  * { box-sizing: border-box; margin: 0; padding: 0; }\n  body { font-family: 'Segoe UI', -apple-system, Arial, sans-serif; color: #1e293b; padding: 32px; }\n  .print-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }\n  .print-header h1 { font-size: 20px; color: #0f172a; }\n  .print-meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }\n  table { width: 100%; border-collapse: collapse; margin-top: 8px; }\n  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0; padding: 8px 10px; }\n  td { font-size: 13px; padding: 9px 10px; border-bottom: 1px solid #f1f5f9; }\n  td.name { font-weight: 600; }\n  td.cost { text-align: right; }\n  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }\n  .print-footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; }\n  .print-summary { font-size: 12px; color: #475569; margin-bottom: 16px; }\n  @media print { body { padding: 0; } }\n</style></head><body>\n  <div class="print-header">\n    <h1>\u21BB Centro de Renovaciones</h1>\n    <span class="badge" style="background:#dbeafe;color:#2563eb;border:1px solid #93c5fd;">Vista: ${viewLabel}</span>\n  </div>\n  <div class="print-meta">Reporte generado el ${today} \u2022 ${data.length} renovaciones</div>\n  <div class="print-summary">Este reporte incluye solo los datos visibles con los filtros actuales.</div>\n  <table>\n    <thead><tr><th>Nombre</th><th>Categoría</th><th>Vence</th><th>Estado</th><th>Tiempo</th><th style="text-align:right;">Costo</th></tr></thead>\n    <tbody>${rowsHtml}</tbody>\n  </table>\n  <div class="print-footer">Centro de Renovaciones \u2014 Generado automáticamente</div>\n  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }; window.onafterprint = function(){ window.close(); };<\/script>\n</body></html>`);
  win.document.close();
  win.focus();
  showToast(`Generando PDF de ${data.length} renovaciones...`, 'info');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error('Formato inválido');
        const validItems = imported.filter(item => item.name && item.category && item.expiryDate);
        if (validItems.length === 0) throw new Error('No hay items válidos');
        const count = await importItems(validItems);
        render();
        showToast(`${count} renovaciones importadas`, 'success');
      } catch (err) { showToast(err.message || 'Archivo inválido', 'error'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ---- Daily Alert Check ----
function dailyAlertCheck() {
  items.forEach(item => {
    const days = daysUntil(item.expiryDate);
    if (days >= 0) {
      ALERT_DAYS.forEach(threshold => {
        if (days === threshold) {
          const cat = CATEGORIES[item.category]?.label || item.category;
          showToast(`\u{1F514} ${item.name} (${cat}) — ${getDaysLabel(days)}`, threshold <= 7 ? 'error' : 'info');
          if (threshold <= 7 && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`\u{26A0}\u{FE0F} ${item.name} — ${getDaysLabel(days)}`, { body: `${cat} — Renueva pronto` });
          }
        }
      });
    }
  });
}

// ---- Keyboard Shortcuts ----
function handleKeyboard(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openNew(); }
  if (e.key === 'Escape') {
    if (dom.settingsOverlay.style.display === 'flex') closeSettings();
    if (dom.modalOverlay.style.display === 'flex') closeModal();
    if (dom.confirmOverlay.style.display === 'flex') closeConfirm();
    if (dom.passwordOverlay && dom.passwordOverlay.style.display === 'flex') closePasswordModal();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); dom.searchInput.focus(); }
  }
}

// ---- Login Handler ----
async function handleLogin(e) {
  e.preventDefault();
  const username = dom.loginUsername.value.trim();
  const password = dom.loginPassword.value;
  if (!username || !password) {
    dom.loginError.textContent = 'Completa todos los campos';
    return;
  }
  dom.loginError.textContent = '';
  dom.loginBtn.disabled = true;
  dom.loginBtn.innerHTML = 'Iniciando sesi\u00F3n...';
  try {
    const res = await fetch(window.location.origin + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const json = await res.json();
    if (!json.success || !json.data || !json.data.token) {
      throw new Error(json.error || 'Error al iniciar sesi\u00F3n');
    }
    setToken(json.data.token);
    setStoredUsername(json.data.username || username);
    showApp();
  } catch (err) {
    dom.loginError.textContent = err.message || 'Error de conexi\u00F3n';
  } finally {
    dom.loginBtn.disabled = false;
    dom.loginBtn.innerHTML = `\n      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>\n      Iniciar sesi\u00F3n\n    `;
  }
}

function showApp() {
  if (dom.loginPage) dom.loginPage.style.display = 'none';
  if (dom.appContent) dom.appContent.style.display = 'block';
  if (dom.userName) dom.userName.textContent = getStoredUsername();
  startApp();
}

// ---- Logout ----
function logout() {
  clearToken();
  localStorage.removeItem(USER_KEY);
  location.reload();
}

// ---- Change Password ----
async function changePassword(currentPassword, newPassword) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(window.location.origin + '/api/auth/password', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    if (res.status === 401) { clearToken(); location.reload(); throw new Error('Sesi\u00F3n expirada'); }
    throw new Error(json.error || 'Error al cambiar la contrase\u00F1a');
  }
  return json;
}

function openPasswordModal() {
  dom.passwordForm.reset();
  dom.passwordOverlay.style.display = 'flex';
  dom.currentPassword.focus();
}

function closePasswordModal() {
  dom.passwordOverlay.style.display = 'none';
  dom.passwordForm.reset();
}

async function handlePasswordSubmit(e) {
  e.preventDefault();
  const currentPassword = dom.currentPassword.value;
  const newPassword = dom.newPassword.value;
  const confirmPassword = dom.confirmPassword.value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('Completa todos los campos', 'error'); return;
  }
  if (newPassword.length < 4) {
    showToast('La nueva contrase\u00F1a debe tener al menos 4 caracteres', 'error'); return;
  }
  if (newPassword !== confirmPassword) {
    showToast('Las contrase\u00F1as no coinciden', 'error'); return;
  }

  dom.passwordSave.disabled = true;
  dom.passwordSave.innerHTML = 'Guardando...';
  try {
    await changePassword(currentPassword, newPassword);
    closePasswordModal();
    showToast('Contrase\u00F1a actualizada correctamente', 'success');
  } catch (err) {
    showToast(err.message || 'Error al cambiar la contrase\u00F1a', 'error');
  } finally {
    dom.passwordSave.disabled = false;
    dom.passwordSave.innerHTML = `\n      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>\n      Guardar\n    `;
  }
}

// ---- Start App (after login) ----
async function startApp() {
  restoreCalendarDate();
  restoreCalendarFilters();
  isLoading = true;
  render();

  try { await fetchItems(); } catch (err) { console.error('Error loading items:', err); isOffline = true; }
  finally { isLoading = false; render(); }

  requestNotificationPermission();

  dom.addBtn.addEventListener('click', openNew);
  dom.emptyAddBtn.addEventListener('click', openNew);
  dom.modalClose.addEventListener('click', closeModal);
  dom.modalCancel.addEventListener('click', closeModal);
  dom.modalOverlay.addEventListener('click', (e) => { if (e.target === dom.modalOverlay) closeModal(); });
  dom.itemForm.addEventListener('submit', handleFormSubmit);
  dom.confirmClose.addEventListener('click', closeConfirm);
  dom.confirmCancel.addEventListener('click', closeConfirm);
  dom.confirmDelete.addEventListener('click', executeDelete);
  dom.confirmOverlay.addEventListener('click', (e) => { if (e.target === dom.confirmOverlay) closeConfirm(); });
  dom.searchInput.addEventListener('input', (e) => { searchQuery = e.target.value; render(); });
  dom.sortSelect.addEventListener('change', (e) => { currentSort = e.target.value; render(); });
  dom.filterChips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      dom.filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      currentFilter = chip.dataset.filter;
      render();
    });
  });
  if (dom.emptyDemoBtn) dom.emptyDemoBtn.addEventListener('click', seedDemoDataOnServer);

  const notifBar = document.createElement('div');
  notifBar.className = 'notif-bar';
  notifBar.innerHTML = `\n    <button class="btn btn-secondary" onclick="notifyWhatsApp()">\u{1F4AC} WhatsApp</button>\n    <button class="btn btn-secondary" onclick="notifyTelegram()">\u{1F4E2} Telegram</button>\n    <button class="btn btn-secondary" onclick="notifyEmail()">\u{2709} Email</button>\n    <button class="btn btn-secondary" onclick="notifyPushAll()">\u{1F4EA} Push</button>\n    <button class="btn btn-secondary" onclick="exportData()">\u{1F4E5} JSON</button>\n    <button class="btn btn-secondary" onclick="exportCsv()">\u{1F4C4} CSV</button>\n    <button class="btn btn-secondary" onclick="exportPdf()">\u{1F4C5} PDF</button>\n    <button class="btn btn-secondary" onclick="importData()">\u{1F4E4} Importar</button>\n    <button class="btn btn-secondary" onclick="seedDemoDataOnServer()">\u{1F4CB} Datos demo</button>\n    <button class="btn btn-secondary settings-btn" onclick="openSettings()">\u{2699}\u{FE0F} Configurar alertas</button>`;
  const statsBar = document.querySelector('.stats-bar');
  statsBar.parentNode.insertBefore(notifBar, statsBar.nextSibling);

  dom.themeToggle = $('#themeToggle');
  initTheme();
  if (dom.themeToggle) dom.themeToggle.addEventListener('click', toggleTheme);
  setupThemeColorPicker();

  dom.settingsClose.addEventListener('click', closeSettings);
  dom.settingsCancel.addEventListener('click', closeSettings);
  dom.settingsOverlay.addEventListener('click', (e) => { if (e.target === dom.settingsOverlay) closeSettings(); });

  if (dom.logoutBtn) dom.logoutBtn.addEventListener('click', logout);
  if (dom.changePassBtn) dom.changePassBtn.addEventListener('click', openPasswordModal);
  if (dom.passwordClose) dom.passwordClose.addEventListener('click', closePasswordModal);
  if (dom.passwordCancel) dom.passwordCancel.addEventListener('click', closePasswordModal);
  if (dom.passwordOverlay) dom.passwordOverlay.addEventListener('click', (e) => { if (e.target === dom.passwordOverlay) closePasswordModal(); });
  if (dom.passwordForm) dom.passwordForm.addEventListener('submit', handlePasswordSubmit);
  dom.settingsForm.addEventListener('submit', handleSettingsSubmit);
  dom.testEmailBtn.addEventListener('click', handleTestEmail);
  dom.smtpEnabled.addEventListener('change', () => { dom.smtpFields.style.display = dom.smtpEnabled.checked ? 'block' : 'none'; });
  dom.testSmsBtn.addEventListener('click', handleTestSms);
  dom.twilioEnabled.addEventListener('change', () => { dom.twilioFields.style.display = dom.twilioEnabled.checked ? 'block' : 'none'; });
  dom.testTelegramBtn.addEventListener('click', handleTestTelegram);
  dom.telegramEnabled.addEventListener('change', () => { dom.telegramFields.style.display = dom.telegramEnabled.checked ? 'block' : 'none'; });
  dom.pushEnabled.addEventListener('change', handlePushToggle);
  dom.pushSubscribeBtn.addEventListener('click', () => {
    if (dom.pushSubscribeBtn.textContent.includes('Cancelar')) unsubscribeFromPush();
    else subscribeToPush();
  });
  dom.testPushBtn.addEventListener('click', handleTestPush);

  dom.listViewTab.addEventListener('click', () => switchView('list'));
  dom.calendarViewTab.addEventListener('click', () => switchView('calendar'));
  dom.calPrev.addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); selectedCalDate = null; dom.calDayDetail.style.display = 'none'; renderCalendar(); });
  dom.calNext.addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); selectedCalDate = null; dom.calDayDetail.style.display = 'none'; renderCalendar(); });
  dom.calDayClose.addEventListener('click', () => { dom.calDayDetail.style.display = 'none'; selectedCalDate = null; renderCalendar(); });
  if (dom.calTodayBtn) dom.calTodayBtn.addEventListener('click', goToToday);
  if (dom.calMonthCount) {
    dom.calMonthCount.addEventListener('click', goToFirstDayOfMonth);
    dom.calMonthCount.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goToFirstDayOfMonth();
      }
    });
  }
  // Title count is regenerated on each render — use event delegation on the title element
  if (dom.calendarTitle) {
    dom.calendarTitle.addEventListener('click', (e) => {
      if (e.target.classList.contains('cal-title-count')) goToFirstDayOfMonth();
    });
    dom.calendarTitle.addEventListener('keydown', (e) => {
      if (e.target.classList.contains('cal-title-count') && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        goToFirstDayOfMonth();
      }
    });
  }
  // Category chips are regenerated each render — use event delegation on the container
  if (dom.calCategoryBreakdown) {
    dom.calCategoryBreakdown.addEventListener('click', (e) => {
      const chip = e.target.closest('.cal-cat-chip');
      if (!chip) return;
      const cat = chip.dataset.category;
      calCategoryFilter = (calCategoryFilter === cat) ? 'all' : cat;
      saveCalendarFilters();
      renderCalendar();
    });
    dom.calCategoryBreakdown.addEventListener('keydown', (e) => {
      const chip = e.target.closest('.cal-cat-chip');
      if (!chip || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      const cat = chip.dataset.category;
      calCategoryFilter = (calCategoryFilter === cat) ? 'all' : cat;
      saveCalendarFilters();
      renderCalendar();
    });
  }
  // Urgency chips are regenerated each render — use event delegation on the container
  if (dom.calUrgencyBreakdown) {
    dom.calUrgencyBreakdown.addEventListener('click', (e) => {
      const chip = e.target.closest('.cal-urgency-chip');
      if (!chip) return;
      const level = chip.dataset.urgency;
      calUrgencyFilter = (calUrgencyFilter === level) ? 'all' : level;
      syncUrgencyFilterChips();
      saveCalendarFilters();
      renderCalendar();
    });
    dom.calUrgencyBreakdown.addEventListener('keydown', (e) => {
      const chip = e.target.closest('.cal-urgency-chip');
      if (!chip || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      const level = chip.dataset.urgency;
      calUrgencyFilter = (calUrgencyFilter === level) ? 'all' : level;
      syncUrgencyFilterChips();
      saveCalendarFilters();
      renderCalendar();
    });
  }
  initCalendarMonthYearPicker();

  // Calendar filter events
  if (dom.calSearchInput) {
    dom.calSearchInput.addEventListener('input', (e) => {
      calSearchQuery = e.target.value;
      saveCalendarFilters();
      renderCalendar();
    });
  }
  if (dom.calDateChips) {
    dom.calDateChips.querySelectorAll('.cal-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        dom.calDateChips.querySelectorAll('.cal-chip').forEach(c => c.classList.remove('cal-chip-active'));
        chip.classList.add('cal-chip-active');
        calDateFilter = chip.dataset.filter;
        saveCalendarFilters();
        renderCalendar();
      });
    });
  }
  if (dom.calUrgencyChips) {
    dom.calUrgencyChips.querySelectorAll('.cal-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        dom.calUrgencyChips.querySelectorAll('.cal-chip').forEach(c => c.classList.remove('cal-chip-active'));
        chip.classList.add('cal-chip-active');
        calUrgencyFilter = chip.dataset.filter;
        saveCalendarFilters();
        renderCalendar();
      });
    });
  }
  if (dom.calClearFilters) {
    dom.calClearFilters.addEventListener('click', clearCalendarFilters);
  }
  if (dom.calDateFrom) {
    dom.calDateFrom.addEventListener('change', (e) => { calDateFrom = e.target.value; saveCalendarFilters(); renderCalendar(); });
  }
  if (dom.calDateTo) {
    dom.calDateTo.addEventListener('change', (e) => { calDateTo = e.target.value; saveCalendarFilters(); renderCalendar(); });
  }

  document.addEventListener('keydown', handleKeyboard);

  dailyAlertCheck();
  setInterval(dailyAlertCheck, 5 * 60 * 1000);

  console.log(`\u{1F504} Centro de Renovaciones iniciado — ${items.length} renovaciones cargadas`);
}

function init() {
  cacheDom();
  createLoginParticles();

  // Register service worker for push notifications
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  const token = getToken();
  if (token) {
    fetch(window.location.origin + '/api/auth/verify', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(res => res.json())
    .then(json => {
      if (json.success) {
        if (json.data && json.data.username) setStoredUsername(json.data.username);
        showApp();
      }
      else { clearToken(); localStorage.removeItem(USER_KEY); dom.loginForm.addEventListener('submit', handleLogin); }
    })
    .catch(() => { dom.loginForm.addEventListener('submit', handleLogin); });
  } else {
    dom.loginForm.addEventListener('submit', handleLogin);
  }
}

// ---- Settings ----
async function openSettings() {
  try {
    const settings = await fetchSettings();
    dom.smtpEnabled.checked = settings.smtp_enabled;
    dom.smtpHost.value = settings.smtp_host || '';
    dom.smtpPort.value = settings.smtp_port || '587';
    dom.smtpUser.value = settings.smtp_user || '';
    dom.smtpPass.value = settings.smtp_pass || '';
    dom.smtpFromEmail.value = settings.smtp_from_email || '';
    dom.smtpFromName.value = settings.smtp_from_name || 'Centro de Renovaciones';
    dom.smtpFields.style.display = settings.smtp_enabled ? 'block' : 'none';
    dom.twilioEnabled.checked = settings.twilio_enabled || false;
    dom.twilioAccountSid.value = settings.twilio_account_sid || '';
    dom.twilioAuthToken.value = settings.twilio_auth_token || '';
    dom.twilioFromNumber.value = settings.twilio_from_number || '';
    dom.twilioToNumber.value = settings.twilio_to_number || '';
    dom.twilioFields.style.display = settings.twilio_enabled ? 'block' : 'none';
    dom.telegramEnabled.checked = settings.telegram_enabled || false;
    dom.telegramBotToken.value = settings.telegram_bot_token || '';
    dom.telegramChatId.value = settings.telegram_chat_id || '';
    dom.telegramFields.style.display = settings.telegram_enabled ? 'block' : 'none';
    refreshPushUi();
    dom.settingsOverlay.style.display = 'flex';
  } catch (err) { showToast('Error al cargar configuración', 'error'); }
}

// ---- Push Subscription Helpers ----
function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

async function getExistingPushSubscription() {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch (e) { return null; }
}

async function refreshPushUi() {
  if (!dom.pushEnabled || !dom.pushStatus) return;
  const sub = await getExistingPushSubscription();
  const enabled = sub ? true : false;
  if (dom.pushEnabled.checked !== enabled) dom.pushEnabled.checked = enabled;
  if (dom.pushFields) dom.pushFields.style.display = dom.pushEnabled.checked ? 'block' : 'none';
  if (dom.pushStatus) {
    dom.pushStatus.textContent = enabled
      ? 'Estado: suscrito a notificaciones push'
      : (isPushSupported() ? 'Estado: no suscrito' : 'Estado: navegador no compatible');
  }
  if (dom.pushSubscribeBtn) {
    dom.pushSubscribeBtn.textContent = enabled ? '\u{1F6AB} Cancelar suscripción' : '\u{1F4EA} Suscribirme a notificaciones';
  }
  return sub;
}

async function handlePushToggle(e) {
  const wantEnabled = dom.pushEnabled.checked;
  if (wantEnabled) {
    await subscribeToPush();
  } else {
    await unsubscribeFromPush();
  }
}

async function subscribeToPush() {
  if (!isPushSupported()) { showToast('Este navegador no soporta notificaciones push', 'error'); return; }
  try {
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Permiso de notificaciones denegado', 'error');
      refreshPushUi();
      return;
    }
    const publicKey = await getVapidPublicKey();
    if (!publicKey) { showToast('No se pudo obtener la clave VAPID del servidor', 'error'); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    const result = await subscribePush(sub.toJSON());
    if (result.success) {
      showToast('Suscripción push registrada', 'success');
      dom.pushEnabled.checked = true;
    } else {
      showToast(result.error || 'Error al registrar la suscripción', 'error');
    }
  } catch (err) {
    showToast('Error al suscribirse a push: ' + err.message, 'error');
  }
  refreshPushUi();
}

async function unsubscribeFromPush() {
  try {
    const sub = await getExistingPushSubscription();
    if (sub) {
      await unsubscribePush(sub.endpoint);
      await sub.unsubscribe();
    }
    showToast('Suscripción push cancelada', 'success');
  } catch (err) {
    showToast('Error al cancelar la suscripción: ' + err.message, 'error');
  }
  refreshPushUi();
}

async function handleTestPush() {
  const sub = await getExistingPushSubscription();
  if (!sub) { showToast('Primero suscríbete a notificaciones push', 'error'); return; }
  dom.testPushBtn.disabled = true;
  dom.testPushBtn.innerHTML = 'Enviando push...';
  try {
    const result = await testPushSettings(sub.toJSON());
    if (result.success) showToast('✅ Push de prueba enviado', 'success');
    else showToast(result.error || 'Error al enviar push de prueba', 'error');
  } catch (err) { showToast('Error de conexión', 'error'); }
  finally { dom.testPushBtn.disabled = false; dom.testPushBtn.innerHTML = '\u{1F4E4} Enviar push de prueba'; }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function closeSettings() { dom.settingsOverlay.style.display = 'none'; }

async function handleSettingsSubmit(e) {
  e.preventDefault();
  const data = {
    smtp_enabled: dom.smtpEnabled.checked,
    smtp_host: dom.smtpHost.value.trim(),
    smtp_port: parseInt(dom.smtpPort.value) || 587,
    smtp_user: dom.smtpUser.value.trim(),
    smtp_pass: dom.smtpPass.value,
    smtp_from_email: dom.smtpFromEmail.value.trim(),
    smtp_from_name: dom.smtpFromName.value.trim(),
    twilio_enabled: dom.twilioEnabled.checked,
    twilio_account_sid: dom.twilioAccountSid.value.trim(),
    twilio_auth_token: dom.twilioAuthToken.value,
    twilio_from_number: dom.twilioFromNumber.value.trim(),
    twilio_to_number: dom.twilioToNumber.value.trim(),
    telegram_enabled: dom.telegramEnabled.checked,
    telegram_bot_token: dom.telegramBotToken.value,
    telegram_chat_id: dom.telegramChatId.value.trim(),
  };
  dom.settingsSave.disabled = true;
  dom.settingsSave.innerHTML = 'Guardando...';
  try {
    await saveSettings(data);
    showToast('Configuración guardada', 'success');
    closeSettings();
  } catch (err) { showToast(err.message || 'Error al guardar configuración', 'error'); }
  finally {
    dom.settingsSave.disabled = false;
    dom.settingsSave.innerHTML = `\n      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>\n      Guardar\n    `;
  }
}

async function handleTestEmail() {
  const data = {
    smtp_host: dom.smtpHost.value.trim(),
    smtp_port: parseInt(dom.smtpPort.value) || 587,
    smtp_user: dom.smtpUser.value.trim(),
    smtp_pass: dom.smtpPass.value,
    smtp_from_email: dom.smtpFromEmail.value.trim(),
    smtp_from_name: dom.smtpFromName.value.trim(),
  };
  dom.testEmailBtn.disabled = true;
  dom.testEmailBtn.innerHTML = 'Enviando...';
  try {
    const result = await testEmailSettings(data);
    if (result.success) showToast('\u2705 Email de prueba enviado', 'success');
    else showToast(result.error || 'Error al enviar prueba', 'error');
  } catch (err) { showToast('Error de conexión', 'error'); }
  finally { dom.testEmailBtn.disabled = false; dom.testEmailBtn.innerHTML = '\u{1F4E8} Enviar correo de prueba'; }
}

async function handleTestSms() {
  const data = {
    twilio_account_sid: dom.twilioAccountSid.value.trim(),
    twilio_auth_token: dom.twilioAuthToken.value,
    twilio_from_number: dom.twilioFromNumber.value.trim(),
    twilio_to_number: dom.twilioToNumber.value.trim(),
  };
  if (!data.twilio_account_sid || !data.twilio_auth_token || !data.twilio_from_number || !data.twilio_to_number) {
    showToast('Completa todos los campos de SMS primero', 'error'); return;
  }
  dom.testSmsBtn.disabled = true;
  dom.testSmsBtn.innerHTML = 'Enviando SMS...';
  try {
    const result = await testSmsSettings(data);
    if (result.success) showToast('✅ SMS de prueba enviado', 'success');
    else showToast(result.error || 'Error al enviar SMS de prueba', 'error');
  } catch (err) { showToast('Error de conexión', 'error'); }
  finally { dom.testSmsBtn.disabled = false; dom.testSmsBtn.innerHTML = '\u{1F4F1} Enviar SMS de prueba'; }
}

async function handleTestTelegram() {
  const data = {
    telegram_bot_token: dom.telegramBotToken.value.trim(),
    telegram_chat_id: dom.telegramChatId.value.trim(),
  };
  if (!data.telegram_bot_token || !data.telegram_chat_id) {
    showToast('Completa el token y el chat ID de Telegram primero', 'error'); return;
  }
  dom.testTelegramBtn.disabled = true;
  dom.testTelegramBtn.innerHTML = 'Enviando...';
  try {
    const result = await testTelegramSettings(data);
    if (result.success) showToast('✅ Mensaje de Telegram enviado', 'success');
    else showToast(result.error || 'Error al enviar mensaje de Telegram', 'error');
  } catch (err) { showToast('Error de conexión', 'error'); }
  finally { dom.testTelegramBtn.disabled = false; dom.testTelegramBtn.innerHTML = '\u{1F4E2} Enviar mensaje de prueba'; }
}

document.addEventListener('DOMContentLoaded', init);