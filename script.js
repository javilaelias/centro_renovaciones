/* ==========================================
   RENOVAMEF - Application Logic
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
  equipment:  { label: 'Equipamiento', icon: '\u{1F9ED}' },
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
let currentView = 'dashboard';
let calendarDate = new Date();
let selectedCalDate = null;
let calSearchQuery = '';
let calDateFilter = 'all';
let calUrgencyFilter = 'all';
let calCategoryFilter = 'all';
let calDateFrom = '';
let calDateTo = '';
let reqSearchQuery = '';
let reqEstadoFilter = 'all';
let reqAreaFilter = 'all';
// Paginación de la tabla de requerimientos
const REQ_PAGE_SIZES = [10, 25, 50, 0]; // 0 = mostrar todos
const REQ_PAGE_SIZE_KEY = 'centro_req_page_size';
function getReqPageSize() {
  try {
    const saved = parseInt(localStorage.getItem(REQ_PAGE_SIZE_KEY), 10);
    return REQ_PAGE_SIZES.includes(saved) ? saved : 25;
  } catch (e) { return 25; }
}
function saveReqPageSize(size) {
  try { localStorage.setItem(REQ_PAGE_SIZE_KEY, String(size)); } catch (e) { /* storage no disponible */ }
}
let reqPageSize = getReqPageSize();
let reqPage = 1;
// Ítems visibles de la página actual (se actualiza en cada renderRequirements)
let currentReqPageItems = [];

// Persistencia de filtros y página activa de Requerimientos entre sesiones
const REQ_FILTERS_KEY = 'centro_req_filters';
function saveReqFilters() {
  try {
    localStorage.setItem(REQ_FILTERS_KEY, JSON.stringify({
      search: reqSearchQuery || '',
      estado: reqEstadoFilter || 'all',
      area: reqAreaFilter || 'all',
      page: reqPage || 1,
    }));
  } catch (e) { /* storage no disponible */ }
}
function restoreReqFilters() {
  try {
    const raw = localStorage.getItem(REQ_FILTERS_KEY);
    if (!raw) return;
    const f = JSON.parse(raw);
    if (!f || typeof f !== 'object') return;
    if (typeof f.search === 'string') {
      reqSearchQuery = f.search;
      if (dom.reqSearchInput) dom.reqSearchInput.value = f.search;
    }
    if (typeof f.estado === 'string') reqEstadoFilter = normalizeReqEstado(f.estado);
    if (typeof f.area === 'string') reqAreaFilter = f.area;
    const p = parseInt(f.page, 10);
    if (!isNaN(p) && p >= 1) reqPage = p;
  } catch (e) { /* datos corruptos: se ignora */ }
}

// ---- DOM refs ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const dom = {};

function cacheDom() {
  dom.grid = $('#itemsGrid');
  dom.empty = $('#emptyState');
  dom.emptyAddBtn = $('#emptyAddBtn');
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
  dom.statPending = $('#statPending');
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
  dom.dashboardViewTab = $('#dashboardViewTab');
  dom.dashboardSection = $('#dashboardSection');
  dom.dashboardContent = $('#dashboardContent');
  dom.listViewTab = $('#listViewTab');
  dom.calendarViewTab = $('#calendarViewTab');
  dom.itemsSection = $('#itemsSection');
  dom.calendarLegend = $('#calendarLegend');
  dom.toastContainer = $('#toastContainer');
  // Requirements (Requerimientos) refs
  dom.reqViewTab = $('#reqViewTab');
  dom.reqSection = $('#reqSection');
  dom.reqTitle = $('#reqTitle');
  dom.reqCount = $('#reqCount');
  dom.reqSearchInput = $('#reqSearchInput');
  dom.reqEstadoFilter = $('#reqEstadoFilter');
  dom.reqAreaFilter = $('#reqAreaFilter');
  dom.reqTbody = $('#reqTbody');
  dom.reqEmpty = $('#reqEmpty');
  dom.reqSummary = $('#reqSummary');
  dom.reqPagination = $('#reqPagination');
  // Requerimientos settings (editor de estados)
  dom.reqEstadosList = $('#reqEstadosList');
  dom.reqEstadoInput = $('#reqEstadoInput');
  dom.reqEstadoAddBtn = $('#reqEstadoAddBtn');
  dom.reqEstadosResetBtn = $('#reqEstadosResetBtn');
  // Flujo secuencial de estados
  dom.reqFlowEnabled = $('#reqFlowEnabled');
  dom.reqFlowList = $('#reqFlowList');
  dom.reqFlowResetBtn = $('#reqFlowResetBtn');
  dom.tramiteUrl = $('#tramiteUrl');
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
  // Register elements
  dom.registerForm = $('#registerForm');
  dom.regEmail = $('#regEmail');
  dom.regPassword = $('#regPassword');
  dom.regPassword2 = $('#regPassword2');
  dom.registerError = $('#registerError');
  dom.registerBtn = $('#registerBtn');
  dom.showRegisterBtn = $('#showRegisterBtn');
  dom.showLoginBtn = $('#showLoginBtn');
  // User account elements
  dom.userName = $('#userName');
  dom.logoutBtn = $('#logoutBtn');
  dom.changePassBtn = $('#changePassBtn');
  dom.passwordOverlay = $('#passwordOverlay');
  dom.passwordClose = $('#passwordClose');
  dom.passwordCancel = $('#passwordCancel');
  // Historial de estados
  dom.historyOverlay = $('#historyOverlay');
  dom.historyClose = $('#historyClose');
  dom.historyItemName = $('#historyItemName');
  dom.historyList = $('#historyList');
  dom.historyExportBtn = $('#historyExportBtn');
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
const ROLE_KEY = 'centro_role';

function getStoredUsername() {
  return localStorage.getItem(USER_KEY) || 'admin';
}

function setStoredUsername(username) {
  localStorage.setItem(USER_KEY, username);
}

function getStoredRole() {
  return localStorage.getItem(ROLE_KEY) || 'analyst';
}

function setStoredRole(role) {
  localStorage.setItem(ROLE_KEY, role || 'analyst');
}

function isAdmin() {
  return getStoredRole() === 'admin';
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
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(dateStr + 'T00:00:00');
  if (isNaN(expiry.getTime())) return null;
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getUrgencyLevel(days) {
  if (days === null) return 'pending';
  if (days < 0) return 'expired';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'warning';
  if (days <= 60) return 'soon';
  return 'ok';
}

function getDaysLabel(days) {
  if (days === null) return 'Fecha pendiente';
  if (days < 0) return `Vencido hace ${Math.abs(days)} días`;
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  return `${days} días`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'Pendiente';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return 'Pendiente';
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Formatea un timestamp ISO (con hora) para el historial
function formatDateTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('es-ES', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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

// Etiquetas de hash amigables: #inicio, #renovaciones, #requerimientos, #calendario
const HASH_LABELS = { dashboard: 'inicio', list: 'renovaciones', req: 'requerimientos', calendar: 'calendario' };
// Mapa inverso: acepta los hash nuevos y los antiguos (#dashboard, #list, #req, #calendar)
const VIEW_FROM_HASH = { inicio: 'dashboard', renovaciones: 'list', requerimientos: 'req', calendario: 'calendar', dashboard: 'dashboard', list: 'list', req: 'req', calendar: 'calendar' };

function switchView(view) {
  hideDashTip();
  currentView = view;
  // Sincroniza la URL con etiquetas amigables (#inicio, #renovaciones, #requerimientos, #calendario)
  if (!applyingHash) {
    try {
      const h = HASH_LABELS[view] || view;
      if (location.hash !== '#' + h) history.replaceState(null, '', '#' + h);
    } catch (e) { /* sin hash en navegadores raros */ }
  }
  const isList = view === 'list';
  const isCalendar = view === 'calendar';
  const isReq = view === 'req';
  const isDashboard = view === 'dashboard';
  if (dom.dashboardSection) dom.dashboardSection.style.display = isDashboard ? 'block' : 'none';
  if (dom.itemsSection) dom.itemsSection.style.display = isList ? 'block' : 'none';
  if (dom.calendarSection) dom.calendarSection.style.display = isCalendar ? 'block' : 'none';
  if (dom.reqSection) dom.reqSection.style.display = isReq ? 'block' : 'none';
  if (dom.dashboardViewTab) dom.dashboardViewTab.classList.toggle('view-tab-active', isDashboard);
  if (dom.listViewTab) dom.listViewTab.classList.toggle('view-tab-active', isList);
  if (dom.calendarViewTab) dom.calendarViewTab.classList.toggle('view-tab-active', isCalendar);
  if (dom.reqViewTab) dom.reqViewTab.classList.toggle('view-tab-active', isReq);
  if (isCalendar) renderCalendar();
  if (isReq) renderRequirements();
  if (isDashboard) renderDashboard();
  if (isList) render(); // Renovaciones: poblar el grid al entrar (si no, sale vacío)
  syncListChrome();
}

// Las barras del módulo Renovaciones (resumen, botonera, filtros y timeline)
// solo se muestran en la vista Renovaciones; en Inicio/Calendario/Requerimientos se ocultan
// para que el Panel de control sea lo primero que se ve.
function syncListChrome() {
  const show = currentView === 'list';
  ['statsBar', 'filtersBar', 'timelineBar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  });
  const nb = document.querySelector('.notif-bar');
  if (nb) nb.style.display = show ? '' : 'none';
}

// Ruteo por hash: #dashboard, #list, #calendar, #req (soporta enlaces directos del .bat)
function applyHashRoute() {
  const v = (location.hash || '').replace('#', '');
  const mapped = VIEW_FROM_HASH[v];
  if (mapped && mapped !== currentView) {
    applyingHash = true;
    switchView(mapped);
    applyingHash = false;
  }
}

// Abre el sistema de trámite documentario con el código de hoja de ruta (otra pestaña)
function openTramite(hr) {
  let url = (tramiteUrl || '').trim();
  if (!url) {
    showToast('Configura la URL del sistema de trámite en Configuración', 'info');
    return;
  }
  if (url.includes('{hr}')) url = url.replace('{hr}', encodeURIComponent(hr || ''));
  else if (hr) url = url + (url.includes('?') ? '&' : '?') + 'hr=' + encodeURIComponent(hr);
  window.open(url, '_blank', 'noopener');
}

// ==========================================
//   REQUERIMIENTOS (Gestión de pendientes)
// ==========================================

const REQ_ESTADO_OPTIONS = [
  'En trámite', 'Sin tramitar', 'Revisión OAB', 'Revisión área usuaria',
  'En elaboración', 'Estudio de Mercado', 'Evaluación de Propuestas', 'Apoyo presupuestal',
  'Proceso de implementación/Activación/Entrega', 'Emisión de Conformidad',
  'Por suscribir contrato', 'Contratado', 'En ejecución', 'Ejecutado', 'Culminado', 'Vigente',
  'Para reformulación', 'Desistido', 'No corresponde atención OGTI'
];

// Normalización de estados por acentos: mapea cualquier variante sin tilde a la
// forma canónica (p. ej. 'En tramite' → 'En trámite') para que no se dupliquen
// los filtros, chips y desplegables. El mapa se genera desde la lista canónica.
const REQ_ESTADO_NORM = {};
REQ_ESTADO_OPTIONS.forEach(e => {
  const key = e.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!REQ_ESTADO_NORM[key]) REQ_ESTADO_NORM[key] = e;
});

// Devuelve la forma canónica (con acentos) de un estado; si no hay variante
// conocida, devuelve el texto tal cual (sin espacios de más).
function normalizeReqEstado(estado) {
  if (!estado) return estado;
  const s = estado.trim();
  const key = stripAccents(s).toLowerCase().trim();
  return REQ_ESTADO_NORM[key] || s;
}

// Quita los acentos/ diacríticos de un texto (para búsquedas insensibles a acentos)
function stripAccents(str) {
  return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
// Lista activa de estados: se puede personalizar desde Configuración
let reqEstadoOptions = [...REQ_ESTADO_OPTIONS];
// Borrador mientras se edita en el modal (se confirma solo al guardar)
let reqEstadoDraft = [...REQ_ESTADO_OPTIONS];
// Orden lógico por defecto del flujo (solo avance).
// NOTA: debe espejar exactamente defaultReqFlowOrder de server/src/db.js.
// La variante 'En tramite' (sin tilde) ya no existe como estado aparte:
// se normaliza a 'En trámite' (ver normalizeReqEstado).
const REQ_FLOW_DEFAULT_ORDER = [
  'Sin tramitar',
  'En trámite',
  'Revisión OAB',
  'Revisión área usuaria',
  'En elaboración',
  'Estudio de Mercado',
  'Evaluación de Propuestas',
  'Apoyo presupuestal',
  'Proceso de implementación/Activación/Entrega',
  'Emisión de Conformidad',
  'Por suscribir contrato',
  'Contratado',
  'En ejecución',
  'Ejecutado', 'Culminado', 'Vigente',
  'Para reformulación', 'Desistido', 'No corresponde atención OGTI'
];
// Flujo secuencial de estados (solo avanzar en orden lógico)
let reqFlowEnabled = false;
let reqFlowOrder = [...REQ_FLOW_DEFAULT_ORDER];   // orden activo del flujo
let reqFlowDraft = [...REQ_FLOW_DEFAULT_ORDER];   // borrador en el modal de Configuración
// URL del sistema de trámite documentario (hoja de ruta) — configurable desde Configuración
let tramiteUrl = '';
// Evita recursión al sincronizar la URL (#vista) con switchView
let applyingHash = false;

const REQ_ESTADO_COLORS = {
  'En trámite': 'blue',
  'Sin tramitar': 'gray',
  'Revisión OAB': 'purple',
  'Revisión área usuaria': 'cyan',
  'En elaboración': 'amber',
  'Estudio de Mercado': 'orange',
  'Evaluación de Propuestas': 'orange',
  'Apoyo presupuestal': 'amber',
  'Proceso de implementación/Activación/Entrega': 'amber',
  'Emisión de Conformidad': 'orange',
  'Por suscribir contrato': 'amber',
  'Contratado': 'green',
  'En ejecución': 'green',
  'Ejecutado': 'green', 'Culminado': 'green', 'Vigente': 'green',
  'Para reformulación': 'orange',
  'Desistido': 'gray', 'No corresponde atención OGTI': 'gray'
};

const REQ_ESTADO_HEX = {
  'En trámite': '#3b82f6',
  'Sin tramitar': '#94a3b8',
  'Revisión OAB': '#8b5cf6',
  'Revisión área usuaria': '#06b6d4',
  'En elaboración': '#f59e0b',
  'Estudio de Mercado': '#f97316',
  'Evaluación de Propuestas': '#f97316',
  'Apoyo presupuestal': '#f59e0b',
  'Proceso de implementación/Activación/Entrega': '#f59e0b',
  'Emisión de Conformidad': '#f97316',
  'Por suscribir contrato': '#f59e0b',
  'Contratado': '#10b981',
  'En ejecución': '#10b981',
  'Ejecutado': '#10b981', 'Culminado': '#10b981', 'Vigente': '#10b981',
  'Para reformulación': '#f97316',
  'Desistido': '#94a3b8', 'No corresponde atención OGTI': '#94a3b8'
};

// Extrae los campos estructurados de las notas del requerimiento
function parseReqNotes(item) {
  const notes = item.notes || '';
  const get = (label) => {
    const m = notes.match(new RegExp('(?:^|\\n)' + label + ':\\s*([^\\n]*)', 'i'));
    return m ? m[1].trim() : '';
  };
  const reqCodes = [];
  const re = /(?:^|\n)REQ:\s*(REQ-[^\s\n]+)/gi;
  let m;
  while ((m = re.exec(notes)) !== null) reqCodes.push(m[1]);
  return {
    req: reqCodes[0] || '',
    tipo: get('Tipo'),
    area: get('Área'),
    areaUsuaria: get('Área usuaria'),
    responsable: get('Responsable'),
    estado: normalizeReqEstado(get('Estado')),
    empresa: get('Empresa'),
    adjunto: extractAdjuntoUrl(notes),
    hr: extractHrCodes(notes),
  };
}

// Extrae la URL del adjunto (p. ej. enlace Sharepoint en "Comentarios servicio")
function extractAdjuntoUrl(notes) {
  if (!notes) return '';
  // Prioriza el enlace del campo "Comentarios servicio" (Sharepoint de OIT)
  const line = notes.match(/(?:^|\n)Comentarios servicio:\s*([^\n]*)/i);
  const m = (line ? line[1] : notes).match(/https?:\/\/[^\s)"']+/);
  return m ? m[0].replace(/[.,;]+$/, '') : '';
}

// Extrae códigos de hoja de ruta (p. ej. 074877-2026, HR 107615-2026) de las notas
function extractHrCodes(notes) {
  if (!notes) return [];
  const codes = [];
  const re = /\b(\d{5,7}-\d{4})\b/g;
  let m;
  while ((m = re.exec(notes)) !== null) {
    if (!codes.includes(m[1])) codes.push(m[1]);
  }
  return codes;
}

// Los requerimientos son los ítems sin fecha de vencimiento (pendientes)
function getReqItems() {
  return items.filter(i => !i.expiryDate);
}

function getFilteredReqItems() {
  let result = getReqItems();
  // Combina la búsqueda dedicada de la vista y la del header (siempre visible)
  // La consulta se normaliza por acentos para que 'tramite' encuentre 'En trámite'
  const q = stripAccents((reqSearchQuery || searchQuery)).trim().toLowerCase();
  if (q) {
    result = result.filter(item => {
      const p = parseReqNotes(item);
      const haystack = stripAccents(item.name + ' ' + p.req + ' ' + p.area + ' ' + p.areaUsuaria + ' ' + p.responsable + ' ' + p.estado + ' ' + p.tipo + ' ' + p.empresa + ' ' + (item.provider || ''));
      return haystack.toLowerCase().includes(q);
    });
  }
  if (reqEstadoFilter !== 'all') {
    result = result.filter(item => (parseReqNotes(item).estado || 'Sin asignar') === reqEstadoFilter);
  }
  if (reqAreaFilter !== 'all') {
    result = result.filter(item => (parseReqNotes(item).area || 'Sin asignar') === reqAreaFilter);
  }
  // Orden: por código REQ (año + secuencia final)
  result.sort((a, b) => {
    const seq = (code) => { const m = (code || '').match(/REQ-\d{4}-(\d+)/); return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER; };
    const na = seq(parseReqNotes(a).req);
    const nb = seq(parseReqNotes(b).req);
    return na - nb || a.name.localeCompare(b.name);
  });
  return result;
}

function reqEstadoColor(estado) {
  return REQ_ESTADO_COLORS[estado] || 'gray';
}

// Chips resumen: desglose de los pendientes por estado y área (arriba de la tabla)
function renderReqSummary() {
  if (!dom.reqSummary) return;
  const all = getReqItems();
  // Conteos por estado y área (sobre TODOS los pendientes, no los filtrados)
  const countBy = (keyFn) => {
    const map = new Map();
    for (const item of all) {
      const k = keyFn(item);
      const label = k || 'Sin asignar';
      map.set(label, (map.get(label) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));
  };
  const estados = countBy(i => parseReqNotes(i).estado);
  const areas = countBy(i => parseReqNotes(i).area);

  const chipHtml = (label, count, color, active, type, value) => `
    <button class="req-summary-chip${active ? ' req-summary-chip-active' : ''}" data-sum-type="${type}" data-sum-value="${escapeHtml(value)}" title="Filtrar por ${escapeHtml(label)}">
      ${color ? `<span class="req-summary-dot" style="background:${color};"></span>` : ''}
      <span class="req-summary-label">${escapeHtml(label)}</span>
      <span class="req-summary-count">${count}</span>
    </button>`;

  const estadoChips = chipHtml('Todos', all.length, '', reqEstadoFilter === 'all', 'estado', 'all') +
    estados.map(([e, c]) => chipHtml(e, c, REQ_ESTADO_HEX[e] || '#94a3b8', reqEstadoFilter === e, 'estado', e)).join('');
  const areaChips = chipHtml('Todas', all.length, '', reqAreaFilter === 'all', 'area', 'all') +
    areas.map(([a, c]) => chipHtml(a, c, '', reqAreaFilter === a, 'area', a)).join('');

  dom.reqSummary.innerHTML = `
    <div class="req-summary-group">
      <span class="req-summary-title">Por estado</span>
      <div class="req-summary-chips">${estadoChips}</div>
    </div>
    <div class="req-summary-group">
      <span class="req-summary-title">Por &aacute;rea</span>
      <div class="req-summary-chips">${areaChips}</div>
    </div>`;
}

// Aplica el filtro al hacer clic en un chip resumen (toggle si ya está activo)
function setReqSummaryFilter(type, value) {
  if (type === 'estado') {
    reqEstadoFilter = reqEstadoFilter === value ? 'all' : value;
    if (dom.reqEstadoFilter) dom.reqEstadoFilter.value = reqEstadoFilter;
  } else {
    reqAreaFilter = reqAreaFilter === value ? 'all' : value;
    if (dom.reqAreaFilter) dom.reqAreaFilter.value = reqAreaFilter;
  }
  reqPage = 1;
  renderRequirements();
}

// Select de cambio rápido de estado (sin abrir el modal)
function buildReqEstadoSelect(item, colorClass) {
  const p = parseReqNotes(item);
  const current = p.estado;
  const curIdx = reqFlowEnabled ? reqFlowOrder.indexOf(current) : -1;
  const options = [...new Set([current, ...reqEstadoOptions])].filter(Boolean)
    .map(e => {
      const idx = reqFlowEnabled ? reqFlowOrder.indexOf(e) : -1;
      const blocked = reqFlowEnabled && curIdx !== -1 && idx !== -1 && idx < curIdx;
      return `<option value="${escapeHtml(e)}"${e === current ? ' selected' : ''}${blocked ? ' disabled' : ''}${blocked ? ' title="No puedes retroceder (flujo secuencial)"' : ''}>${escapeHtml(e)}</option>`;
    }).join('');
  const hint = reqFlowEnabled ? 'Flujo secuencial activado: solo puedes avanzar en el orden configurado' : 'Cambiar estado del requerimiento';
  return `<select class="req-estado-select ${colorClass}" data-id="${item.id}" onchange="quickSetEstado(this)" title="${hint}">${options}</select>`;
}

function renderRequirements() {
  const all = getReqItems();
  const filtered = getFilteredReqItems();
  dom.reqTitle.textContent = 'Gestión de Requerimientos';
  dom.reqCount.textContent = `${filtered.length} de ${all.length} ítems`;

  // Opciones dinámicas para los filtros
  const estados = [...new Set(all.map(i => parseReqNotes(i).estado || 'Sin asignar'))].sort((a, b) => a.localeCompare(b, 'es'));
  const areas = [...new Set(all.map(i => parseReqNotes(i).area || 'Sin asignar'))].sort((a, b) => a.localeCompare(b, 'es'));
  if (dom.reqEstadoFilter) {
    dom.reqEstadoFilter.innerHTML = '<option value="all">Todos los estados</option>' +
      estados.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
    // Sincroniza la variable con el select: si el filtro activo ya no existe
    // entre los pendientes, se resetea a 'all' para evitar tabla vacía fantasma
    reqEstadoFilter = estados.includes(reqEstadoFilter) ? reqEstadoFilter : 'all';
    dom.reqEstadoFilter.value = reqEstadoFilter;
  }
  if (dom.reqAreaFilter) {
    dom.reqAreaFilter.innerHTML = '<option value="all">Todas las áreas</option>' +
      areas.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
    reqAreaFilter = areas.includes(reqAreaFilter) ? reqAreaFilter : 'all';
    dom.reqAreaFilter.value = reqAreaFilter;
  }

  // Chips resumen (después de la sincronización de filtros para reflejar el estado real)
  renderReqSummary();

  // Paginación: total de páginas y reencuadre de la página actual
  const pageSize = reqPageSize > 0 ? reqPageSize : Math.max(filtered.length, 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  if (reqPage > totalPages) reqPage = totalPages;
  if (reqPage < 1) reqPage = 1;
  const pageItems = filtered.slice((reqPage - 1) * pageSize, reqPage * pageSize);
  currentReqPageItems = pageItems;

  if (filtered.length === 0) {
    dom.reqTbody.innerHTML = '';
    dom.reqEmpty.style.display = 'block';
    renderReqPagination(0);
    saveReqFilters();
    return;
  }
  dom.reqEmpty.style.display = 'none';
  dom.reqTbody.innerHTML = pageItems.map(item => {
    const p = parseReqNotes(item);
    const color = reqEstadoColor(p.estado);
    const hasCost = item.cost != null && item.cost >= 0;
    return `
      <tr class="req-row">
        <td class="req-code">${p.req ? `<span class="req-code-badge">${escapeHtml(p.req)}</span>` : '<span class="req-no-code">Sin REQ</span>'}</td>
        <td class="req-name">${escapeHtml(item.name)}</td>
        <td class="req-tipo">${escapeHtml(p.tipo || '—')}</td>
        <td class="req-area">${escapeHtml(p.area || '—')}</td>
        <td class="req-area-usuaria">${escapeHtml(p.areaUsuaria || '—')}</td>
        <td class="req-resp">${escapeHtml(p.responsable || '—')}</td>
        <td>${buildReqEstadoSelect(item, color)}</td>
        <td class="req-provider">${escapeHtml(((item.provider || '').replace(/\s+/g, ' ').trim() || (p.empresa || '').replace(/\s+/g, ' ').trim() || '—'))}</td>
        <td class="req-cost">${hasCost ? escapeHtml(formatCurrency(item.cost)) : '—'}</td>
        <td class="req-hr">${(p.hr && p.hr.length) ? `<div class="req-hr-cell">${p.hr.slice(0, 3).map(c => `<button type="button" class="req-hr-badge" title="Abrir ${escapeHtml(c)} en el sistema de trámite" onclick="openTramite('${escapeHtml(c)}')">${escapeHtml(c)}</button>`).join('')}${p.hr.length > 3 ? `<span class="req-hr-more">+${p.hr.length - 3}</span>` : ''}</div>` : '<span class="req-no-hr">—</span>'}</td>
        <td class="req-adjunto">${p.adjunto ? `<a class="req-adjunto-link" href="${escapeHtml(p.adjunto)}" target="_blank" rel="noopener" title="Abrir adjunto: ${escapeHtml(p.adjunto)}">&#128279; ${escapeHtml(getHostname(p.adjunto))}</a>` : '<span class="req-no-hr">—</span>'}</td>
        <td class="req-actions">
          <input type="date" class="req-date-input" title="Asignar fecha de vencimiento (sale de pendientes)" min="${new Date().toISOString().split('T')[0]}" onchange="quickSetDate('${item.id}', this.value)" />
          <button class="item-action-btn history" onclick="openReqHistory('${item.id}')" data-tooltip="Ver historial de estados">&#128337;&#xFE0F;</button>
          <button class="item-action-btn edit" onclick="openEdit('${item.id}')" data-tooltip="Editar requerimiento">&#9998;&#xFE0F;</button>
          ${isAdmin() ? `<button class="item-action-btn delete" onclick="confirmDelete('${item.id}')" data-tooltip="Eliminar requerimiento">&#128465;&#xFE0F;</button>` : ''}
        </td>
      </tr>`;
  }).join('');
  renderReqPagination(filtered.length);
  saveReqFilters();
}

// Controles de paginación de la tabla de requerimientos
function renderReqPagination(total) {
  if (!dom.reqPagination) return;
  if (total === 0) {
    dom.reqPagination.innerHTML = '';
    dom.reqPagination.style.display = 'none';
    return;
  }
  dom.reqPagination.style.display = 'flex';

  const pageSize = reqPageSize > 0 ? reqPageSize : Math.max(total, 1);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Selector de tamaño de página (10 / 25 / 50 / Todos)
  const sizeSel = `
    <span class="req-page-size-wrap">
      <label class="req-page-size-label" for="reqPageSizeSelect">Por p&aacute;gina</label>
      <select id="reqPageSizeSelect" class="req-page-size-select" title="&Iacute;tems por p&aacute;gina">
        ${REQ_PAGE_SIZES.map(s => `<option value="${s}"${s === reqPageSize ? ' selected' : ''}>${s === 0 ? 'Todos' : s}</option>`).join('')}
      </select>
    </span>`;

  let nav = '';
  if (totalPages > 1) {
    // Numeración con elipsis cuando hay muchas páginas
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7 && i > 2 && i < totalPages - 1 && Math.abs(i - reqPage) > 1) {
        if (pages[pages.length - 1] !== '…') pages.push('…');
        continue;
      }
      pages.push(i);
    }
    const btn = (p, label, extra = '') =>
      `<button type="button" class="req-page-btn${p === reqPage ? ' req-page-btn-active' : ''}" data-page="${p}" ${extra}>${label}</button>`;
    nav = `
      ${btn(reqPage - 1, '‹', reqPage === 1 ? 'disabled' : '')}
      ${pages.map(p => p === '…' ? '<span class="req-page-dots">…</span>' : btn(p, p)).join('')}
      ${btn(reqPage + 1, '›', reqPage === totalPages ? 'disabled' : '')}`;
  }

  const start = (reqPage - 1) * pageSize + 1;
  const end = Math.min(total, reqPage * pageSize);
  const exportBtns = `
    <button type="button" class="req-page-export" onclick="exportReqPageCsv()" title="Exportar los ítems visibles de esta página a CSV">&#128196; CSV</button>
    <button type="button" class="req-page-export req-page-export-xlsx" onclick="exportReqPageXlsx()" title="Exportar los ítems visibles de esta página a Excel (.xlsx)">&#128196; XLSX</button>`;
  dom.reqPagination.innerHTML = `${sizeSel}${nav}<span class="req-page-info">${start}–${end} de ${total}</span>${exportBtns}`;
}

// Actualiza la línea 'Estado:' dentro de las notas del ítem
function setEstadoInNotes(notes, estado) {
  const line = `Estado: ${normalizeReqEstado(estado)}`;
  if (!notes) return line;
  if (/(^|\n)Estado: [^\n]*/.test(notes)) return notes.replace(/(^|\n)Estado: [^\n]*/, (m, p) => p + line);
  return notes + '\n' + line;
}

async function quickSetEstado(selectEl) {
  const id = selectEl.dataset.id;
  const estado = selectEl.value;
  const item = items.find(i => i.id === id);
  if (!item) return;
  // Validación del flujo secuencial: no se permite retroceder
  if (reqFlowEnabled && reqFlowOrder.length > 0) {
    const p = parseReqNotes(item);
    const cur = p.estado;
    const curIdx = reqFlowOrder.indexOf(cur);
    const newIdx = reqFlowOrder.indexOf(estado);
    if (curIdx !== -1 && newIdx !== -1 && newIdx < curIdx) {
      showToast(`Flujo secuencial: no puedes retroceder de "${cur}" a "${estado}"`, 'error');
      renderRequirements();
      return;
    }
  }
  const notes = setEstadoInNotes(item.notes || '', estado);
  try {
    await updateItem(id, { notes });
    showToast(`Estado actualizado: ${estado}`, 'success');
    renderRequirements();
  } catch (err) {
    showToast(err.message || 'Error al actualizar estado', 'error');
    renderRequirements();
  }
}

async function quickSetDate(id, dateStr) {
  if (!dateStr) return;
  try {
    await updateItem(id, { expiryDate: dateStr });
    showToast('Fecha asignada: ' + formatDate(dateStr), 'success');
    render();
  } catch (err) {
    showToast(err.message || 'Error al asignar fecha', 'error');
  }
}

// ---- Exportación de Requerimientos ----
// Construye el CSV a partir de un conjunto de ítems (reutilizado por exportación completa y por página)
// Escapa un valor para CSV (compartido por todas las exportaciones)
function csvEscape(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function buildReqCsv(data) {
  const headers = ['REQ', 'Requerimiento', 'Tipo', 'Área', 'Área usuaria', 'Responsable', 'Estado', 'Costo', 'Empresa/Proveedor', 'Adjunto'];
  const rows = data.map(item => {
    const p = parseReqNotes(item);
    return [
      csvEscape(p.req), csvEscape(item.name), csvEscape(p.tipo), csvEscape(p.area), csvEscape(p.areaUsuaria), csvEscape(p.responsable), csvEscape(p.estado),
      item.cost != null ? item.cost : '', csvEscape(((item.provider || '').replace(/\s+/g, ' ').trim() || (p.empresa || '').replace(/\s+/g, ' ').trim())), csvEscape(p.adjunto)
    ].join(',');
  });
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

// CSV del historial de estados: quién, cuándo, de qué a qué (mismo orden que el modal: más reciente primero)
function buildReqHistoryCsv(data) {
  const headers = ['Fecha', 'Usuario', 'Estado anterior', 'Estado nuevo'];
  const rows = data.map(h => [
    csvEscape(formatDateTime(h.created_at)),
    csvEscape(h.username || 'sistema'),
    csvEscape(h.from_estado || '(sin estado)'),
    csvEscape(h.to_estado || '(sin estado)')
  ].join(','));
  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

// Exporta el historial de estados del requerimiento actualmente abierto
function exportReqHistoryCsv() {
  if (currentReqHistory.length === 0) { showToast('No hay cambios de estado para exportar', 'info'); return; }
  const day = new Date().toISOString().split('T')[0];
  const slug = (currentReqHistoryName || 'requerimiento')
    .toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'requerimiento';
  downloadReqCsv(buildReqHistoryCsv([...currentReqHistory].reverse()), `historial-estados-${slug}-${day}.csv`);
  showToast(`Historial exportado a CSV (${currentReqHistory.length} cambios)`, 'success');
}

function downloadReqCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportReqCsv() {
  const data = getFilteredReqItems();
  if (data.length === 0) { showToast('No hay requerimientos para exportar', 'info'); return; }
  downloadReqCsv(buildReqCsv(data), `requerimientos-${new Date().toISOString().split('T')[0]}.csv`);
  showToast('Requerimientos exportados a CSV', 'success');
}

// Ítems visibles en la página actual (fijados en renderRequirements,
// así la exportación siempre coincide con lo que se ve en pantalla)
function getCurrentReqPageItems() {
  return currentReqPageItems;
}

// Exporta únicamente los ítems visibles de la página actual
function exportReqPageCsv() {
  const data = getCurrentReqPageItems();
  if (data.length === 0) { showToast('No hay ítems visibles en esta página', 'info'); return; }
  const day = new Date().toISOString().split('T')[0];
  downloadReqCsv(buildReqCsv(data), `requerimientos-pagina-${reqPage}-${day}.csv`);
  showToast(`Página ${reqPage} exportada a CSV (${data.length} ítems)`, 'success');
}

function exportReqPdf() {
  const data = getFilteredReqItems();
  if (data.length === 0) { showToast('No hay requerimientos para exportar', 'info'); return; }
  const win = window.open('', '_blank', 'width=1000,height=650');
  if (!win) { showToast('Permite ventanas emergentes para exportar PDF', 'error'); return; }
  const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const rowsHtml = data.map(item => {
    const p = parseReqNotes(item);
    const color = REQ_ESTADO_HEX[p.estado] || '#6366f1';
    return `
      <tr>
        <td class="code">${escapeHtml(p.req)}</td>
        <td class="name"><strong>${escapeHtml(item.name)}</strong></td>
        <td>${escapeHtml(p.tipo || '—')}</td>
        <td>${escapeHtml(p.area || '—')}</td>
        <td>${escapeHtml(p.areaUsuaria || '—')}</td>
        <td>${escapeHtml(p.responsable || '—')}</td>
        <td><span class="badge" style="background:${color}22;color:${color};border:1px solid ${color}55;">${escapeHtml(p.estado || '—')}</span></td>
        <td class="cost">${item.cost != null ? escapeHtml(formatCurrency(item.cost)) : ''}</td>
        <td>${escapeHtml(((item.provider || '').replace(/\s+/g, ' ').trim() || (p.empresa || '').replace(/\s+/g, ' ').trim()) || '—')}</td>
        <td class="link">${p.adjunto ? escapeHtml(getHostname(p.adjunto)) : ''}</td>
      </tr>`;
  }).join('');
  win.document.write(`<!DOCTYPE html>\n<html lang="es"><head><meta charset="UTF-8"><title>Gestión de Requerimientos</title><style>\n  * { box-sizing: border-box; margin: 0; padding: 0; }\n  body { font-family: 'Segoe UI', -apple-system, Arial, sans-serif; color: #1e293b; padding: 32px; }\n  .print-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }\n  .print-header h1 { font-size: 20px; color: #0f172a; }\n  .print-meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }\n  table { width: 100%; border-collapse: collapse; margin-top: 8px; }\n  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0; padding: 8px 10px; }\n  td { font-size: 12px; padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }\n  td.code { font-weight: 700; white-space: nowrap; }\n  td.name { font-weight: 600; }\n  td.cost { text-align: right; white-space: nowrap; }\n  td.link { color: #2563eb; white-space: nowrap; }\n  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }\n  .print-footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; }\n  @media print { body { padding: 0; } }\n</style></head><body>\n  <div class="print-header">\n    <h1>\u21BB RenovaMEF</h1>\n    <span class="badge" style="background:#eef2ff;color:#6366f1;border:1px solid #c7d2fe;">Gesti&oacute;n de Requerimientos</span>\n  </div>\n  <div class="print-meta">Reporte generado el ${today} \u2022 ${data.length} requerimientos</div>\n  <table>\n    <thead><tr><th>REQ</th><th>Requerimiento</th><th>Tipo</th><th>Área</th><th>Área usuaria</th><th>Responsable</th><th>Estado</th><th style="text-align:right;">Costo</th><th>Empresa/Proveedor</th><th>Adjunto</th></tr></thead>\n    <tbody>${rowsHtml}</tbody>\n  </table>\n  <div class="print-footer">RenovaMEF \u2014 Generado automáticamente</div>\n  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }; window.onafterprint = function(){ window.close(); };<\/script>\n</body></html>`);
  win.document.close();
  win.focus();
  showToast(`Generando PDF de ${data.length} requerimientos...`, 'info');
}

// Construye los bytes del .xlsx a partir de un conjunto de ítems (generador local sin dependencias)
function buildReqXlsxBytes(data) {
  const headers = ['REQ', 'Requerimiento', 'Tipo', 'Área', 'Área usuaria', 'Responsable', 'Estado', 'Costo', 'Empresa/Proveedor', 'Adjunto'];
  const rows = data.map(item => {
    const p = parseReqNotes(item);
    return [
      p.req, item.name, p.tipo, p.area, p.areaUsuaria, p.responsable, p.estado,
      item.cost != null && item.cost !== '' ? item.cost : '',
      (item.provider || '').replace(/\s+/g, ' ').trim() || (p.empresa || '').replace(/\s+/g, ' ').trim(),
      p.adjunto
    ];
  });
  // Anchos de columna aproximados según el contenido (máx. 40)
  const columnWidths = headers.map((h, i) => {
    let w = h.length;
    for (const r of rows) {
      const v = r[i] == null ? '' : String(r[i]);
      if (v.length > w) w = v.length;
    }
    return Math.min(Math.max(w + 3, 10), 40);
  });
  return CentroXlsx.buildXlsxBytes([headers, ...rows], {
    sheetName: 'Requerimientos',
    columnWidths
  });
}

function downloadReqXlsx(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Exportación masiva a Excel (.xlsx) usando el generador local sin dependencias (xlsx_export.js)
function exportReqXlsx() {
  const data = getFilteredReqItems();
  if (data.length === 0) { showToast('No hay requerimientos para exportar', 'info'); return; }
  if (typeof CentroXlsx === 'undefined') { showToast('El generador de Excel no está disponible', 'error'); return; }
  try {
    downloadReqXlsx(buildReqXlsxBytes(data), `requerimientos-${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast(`Excel generado con ${data.length} requerimientos`, 'success');
  } catch (err) {
    console.error('Error al exportar a Excel:', err);
    showToast('Error al generar el Excel', 'error');
  }
}

// Exporta a Excel únicamente los ítems visibles de la página actual
function exportReqPageXlsx() {
  const data = getCurrentReqPageItems();
  if (data.length === 0) { showToast('No hay ítems visibles en esta página', 'info'); return; }
  if (typeof CentroXlsx === 'undefined') { showToast('El generador de Excel no está disponible', 'error'); return; }
  const day = new Date().toISOString().split('T')[0];
  try {
    downloadReqXlsx(buildReqXlsxBytes(data), `requerimientos-pagina-${reqPage}-${day}.xlsx`);
    showToast(`Página ${reqPage} exportada a Excel (${data.length} ítems)`, 'success');
  } catch (err) {
    console.error('Error al exportar la página a Excel:', err);
    showToast('Error al generar el Excel', 'error');
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
  if (currentFilter === 'pending') {
    result = result.filter(item => !item.expiryDate);
  } else if (currentFilter !== 'all') {
    result = result.filter(item => item.category === currentFilter);
  }
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
      case 'days-asc':
        if (daysA === null && daysB === null) return 0;
        if (daysA === null) return 1;
        if (daysB === null) return -1;
        return daysA - daysB;
      case 'days-desc':
        if (daysA === null && daysB === null) return 0;
        if (daysA === null) return 1;
        if (daysB === null) return -1;
        return daysB - daysA;
      case 'name':      return a.name.localeCompare(b.name);
      case 'category':  return a.category.localeCompare(b.category) || (daysA ?? Infinity) - (daysB ?? Infinity);
      default:          return (daysA ?? Infinity) - (daysB ?? Infinity);
    }
  });
  return result;
}

// ---- Rendering with Skeletons & Animated Stats ----
function render() {
  if (currentView === 'dashboard') {
    updateStats();
    renderDashboard();
    return;
  }
  if (currentView === 'req') {
    updateStats();
    renderRequirements();
    return;
  }
  const filtered = getFilteredItems();
  const total = items.length;
  updateStats();
  const catLabel = currentFilter === 'all' ? 'Todas las renovaciones'
    : currentFilter === 'pending' ? 'Pendientes (sin fecha de vencimiento)'
    : CATEGORIES[currentFilter]?.label + 's';
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

// ==========================================
//   DASHBOARD (resumen de ambos módulos)
// ==========================================
function renderDashboard() {
  if (!dom.dashboardContent) return;
  if (isLoading) {
    dom.dashboardContent.innerHTML = '<div class="dash-loading">Cargando panel de control...</div>';
    return;
  }

  // --- Estadísticas del RenovaMEF ---
  const stats = { total: items.length, ok: 0, soon: 0, warning: 0, urgent: 0, expired: 0, pending: 0 };
  const itemsByLevel = { expired: [], urgent: [], warning: [], soon: [], ok: [], pending: [] };
  items.forEach(item => {
    const days = daysUntil(item.expiryDate);
    const level = getUrgencyLevel(days);
    stats[level]++;
    itemsByLevel[level].push(item);
  });
  const totalCost = items.reduce((s, i) => s + (parseFloat(i.cost) || 0), 0);
  const upcoming = items
    .filter(i => daysUntil(i.expiryDate) !== null && daysUntil(i.expiryDate) >= 0)
    .sort((a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate))
    .slice(0, 5);

  const tipAttr = tip => tip ? ` data-tip="${tip}"` : '';
  const kpiCard = (label, value, level, view, filter, tip) => `
    <div class="dash-kpi dash-kpi-${level}" data-view="${view}" data-filter="${filter || ''}"${tipAttr(tip)} role="button" tabindex="0">
      <span class="dash-kpi-value">${value}</span>
      <span class="dash-kpi-label">${label}</span>
    </div>`;

  const renovKpis =
    kpiCard('Total', stats.total, 'total', 'list', 'all', 'total') +
    kpiCard('En orden', stats.ok, 'ok', 'list', 'all', 'urgencia:ok') +
    kpiCard('Próximas', stats.soon, 'soon', 'list', 'all', 'urgencia:soon') +
    kpiCard('Alerta', stats.warning, 'warning', 'list', 'all', 'urgencia:warning') +
    kpiCard('Urgente', stats.urgent, 'urgent', 'list', 'all', 'urgencia:urgent') +
    kpiCard('Vencidas', stats.expired, 'expired', 'list', 'all', 'urgencia:expired') +
    kpiCard('Pendientes', stats.pending, 'pending', 'list', 'pending', 'urgencia:pending');

  const upcomingHtml = upcoming.length
    ? upcoming.map(item => {
        const days = daysUntil(item.expiryDate);
        const cat = CATEGORIES[item.category] || { label: item.category, icon: '' };
        const color = { ok: '#10b981', soon: '#f59e0b', warning: '#f97316', urgent: '#ef4444', expired: '#dc2626' }[getUrgencyLevel(days)] || '#94a3b8';
        return `
          <div class="dash-upcoming" data-id="${item.id}" data-tip="upcoming:${item.id}" role="button" tabindex="0">
            <span class="dash-upcoming-cat">${cat.icon}</span>
            <span class="dash-upcoming-name">${escapeHtml(item.name)}</span>
            <span class="dash-upcoming-days" style="color:${color};">${getDaysLabel(days)}</span>
          </div>`;
      }).join('')
    : '<div class="dash-empty">No hay vencimientos próximos 🎉</div>';

  // --- Barras de urgencia (distribución de renovaciones) ---
  const urgenciaOrder = [
    { key: 'expired', label: 'Vencidas', color: '#dc2626' },
    { key: 'urgent', label: 'Urgente', color: '#ef4444' },
    { key: 'warning', label: 'Alerta', color: '#f97316' },
    { key: 'soon', label: 'Próximas', color: '#f59e0b' },
    { key: 'ok', label: 'En orden', color: '#10b981' },
    { key: 'pending', label: 'Pendientes', color: '#6366f1' },
  ];
  const urgenciaBars = urgenciaOrder.map(({ key, label, color }) => {
    const n = stats[key] || 0;
    const pct = stats.total ? Math.round((n / stats.total) * 100) : 0;
    return `
      <div class="dash-bar-row" data-tip="urgencia:${key}">
        <span class="dash-bar-label">${label}</span>
        <div class="dash-bar-track">
          <div class="dash-bar-fill" style="width:${pct}%;background:${color};"></div>
        </div>
        <span class="dash-bar-num">${n}</span>
        <span class="dash-bar-pct">${pct}%</span>
      </div>`;
  }).join('');

  // --- Estadísticas del Gestor de Requerimientos ---
  const reqs = getReqItems();
  const byEstado = {};
  const byArea = {};
  const reqsByEstado = {};
  const reqsByArea = {};
  reqs.forEach(item => {
    const p = parseReqNotes(item);
    const e = p.estado || 'Sin asignar';
    const a = p.area || 'Sin asignar';
    byEstado[e] = (byEstado[e] || 0) + 1;
    byArea[a] = (byArea[a] || 0) + 1;
    (reqsByEstado[e] = reqsByEstado[e] || []).push({ item, p });
    (reqsByArea[a] = reqsByArea[a] || []).push({ item, p });
  });
  const estadoEntries = Object.entries(byEstado).sort((a, b) => b[1] - a[1]);

  // --- Dona de estados (conic-gradient puro, sin librerías) ---
  let donutAcc = 0;
  const donutStops = estadoEntries.map(([e, n], idx) => {
    const color = REQ_ESTADO_HEX[e] || '#94a3b8';
    const from = donutAcc;
    donutAcc += reqs.length ? (n / reqs.length) * 100 : 0;
    // Fuerza el último tramo a 100% exacto para evitar huecos por punto flotante
    const to = idx === estadoEntries.length - 1 ? 100 : donutAcc;
    return `${color} ${from}% ${to}%`;
  });
  const donutGradient = reqs.length
    ? `conic-gradient(${donutStops.join(', ')})`
    : 'conic-gradient(var(--primary-200) 0% 100%)';
  const donutLegend = estadoEntries.map(([e, n]) => {
    const pct = reqs.length ? Math.round((n / reqs.length) * 100) : 0;
    return `
      <div class="dash-donut-legend-item" data-req-estado="${encodeURIComponent(e)}" data-tip="estado" role="button" tabindex="0" aria-label="Filtrar por ${escapeHtml(e)}">
        <span class="dash-donut-legend-dot" style="background:${REQ_ESTADO_HEX[e] || '#94a3b8'};" ></span>
        <span class="dash-donut-legend-name">${escapeHtml(e)}</span>
        <span class="dash-donut-legend-num">${n}</span>
        <span class="dash-donut-legend-pct">${pct}%</span>
      </div>`;
  }).join('');
  const areaPalette = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#f59e0b', '#10b981', '#06b6d4'];
  const areaEntries = Object.entries(byArea)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const areaBars = areaEntries.map(([a, n], idx) => {
    const pct = reqs.length ? Math.round((n / reqs.length) * 100) : 0;
    const color = areaPalette[idx % areaPalette.length];
    return `
      <div class="dash-bar-row dash-bar-row--area" data-req-area="${encodeURIComponent(a)}" data-tip="area" role="button" tabindex="0" aria-label="Filtrar por ${escapeHtml(a)}">
        <span class="dash-bar-label">${escapeHtml(a)}</span>
        <div class="dash-bar-track">
          <div class="dash-bar-fill" style="width:${pct}%;background:${color};"></div>
        </div>
        <span class="dash-bar-num">${n}</span>
        <span class="dash-bar-pct">${pct}%</span>
      </div>`;
  }).join('');

  // Datos para los tooltips interactivos de cada segmento
  const areaColors = {};
  areaEntries.forEach(([a], i) => { areaColors[a] = areaPalette[i % areaPalette.length]; });
  dashTipData = { itemsByLevel, reqsByEstado, reqsByArea, estadoEntries, urgenciaMeta: urgenciaOrder, areaColors, totalStats: stats };

  dom.dashboardContent.innerHTML = `
    <div class="dash-header">
      <div>
        <h2 class="dash-title">Panel de control</h2>
        <span class="dash-date">${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
    </div>
    <div class="dash-grid">
      <section class="dash-module">
        <div class="dash-module-head">
          <h3>↻ Renovaciones</h3>
          <button class="btn btn-secondary" data-goto="list">Ver renovaciones →</button>
        </div>
        <div class="dash-kpis">${renovKpis}</div>
        <div class="dash-module-sub">
          <h4 class="dash-sub-title">Distribución por urgencia</h4>
          <div class="dash-bars">${urgenciaBars}</div>
        </div>
        <div class="dash-module-sub">
          <h4 class="dash-sub-title">Próximos vencimientos</h4>
          <div class="dash-upcoming-list">${upcomingHtml}</div>
        </div>
        <div class="dash-total-cost">Costo total registrado: <b>${formatCurrency(totalCost)}</b></div>
      </section>

      <section class="dash-module">
        <div class="dash-module-head">
          <h3>📋 Gestión de Requerimientos</h3>
          <button class="btn btn-secondary" data-goto="req">Ver tabla →</button>
        </div>
        <div class="dash-req-total">
          <span class="dash-req-total-num">${reqs.length}</span>
          <span class="dash-req-total-label">requerimientos en gestión</span>
        </div>
        <div class="dash-module-sub">
          <h4 class="dash-sub-title">Distribución por estado y área</h4>
          <div class="dash-donut-area-wrap">
            <div class="dash-donut-wrap">
              <div class="dash-donut" data-tip="donut" style="background:${donutGradient};" role="img" aria-label="Dona de estados de requerimientos">
                <span class="dash-donut-center-num">${reqs.length}</span>
              </div>
              <div class="dash-donut-legend">${donutLegend || '<div class="dash-empty">Sin requerimientos</div>'}</div>
            </div>
            <div class="dash-bars dash-bars--area">${areaBars || '<div class="dash-empty">Sin áreas</div>'}</div>
          </div>
        </div>
      </section>
    </div>`;
}

// Delegación de clics en el dashboard
function handleDashClick(e) {
  const gotoBtn = e.target.closest('[data-goto]');
  if (gotoBtn) { switchView(gotoBtn.dataset.goto); return; }
  const kpi = e.target.closest('.dash-kpi');
  if (kpi) {
    const filter = kpi.dataset.filter || 'all';
    currentFilter = filter;
    // Sincroniza el chip activo de la barra de filtros con el salto desde el dashboard
    if (dom.filterChips) {
      dom.filterChips.querySelectorAll('.chip').forEach(ch => ch.classList.toggle('chip-active', ch.dataset.filter === filter));
    }
    switchView(kpi.dataset.view);
    render();
    return;
  }
  const up = e.target.closest('.dash-upcoming');
  if (up) { openEdit(up.dataset.id); return; }
  const chipE = e.target.closest('[data-req-estado]');
  if (chipE) { reqEstadoFilter = decodeURIComponent(chipE.dataset.reqEstado); switchView('req'); return; }
  const chipA = e.target.closest('[data-req-area]');
  if (chipA) { reqAreaFilter = decodeURIComponent(chipA.dataset.reqArea); switchView('req'); return; }
}

// Accesibilidad: Enter/Espacio activan los elementos interactivos del dashboard
function handleDashKeydown(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const target = e.target.closest('[role="button"][tabindex]');
  if (!target) return;
  e.preventDefault();
  target.click();
}

// ==========================================
//   TOOLTIPS INTERACTIVOS DEL DASHBOARD
//   (ítems concretos de cada segmento al pasar el cursor)
// ==========================================
let dashTipEl = null;
let dashTipData = { itemsByLevel: {}, reqsByEstado: {}, reqsByArea: {}, estadoEntries: [], urgenciaMeta: [], areaColors: {}, totalStats: {} };
let dashTipTarget = null;
let dashTipLastSeg = null; // segmento de la dona ya renderizado (para no reconstruir en cada mousemove)

function getDashTip() {
  if (!dashTipEl) {
    dashTipEl = document.createElement('div');
    dashTipEl.className = 'dash-tip';
    dashTipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(dashTipEl);
    dashTipEl.addEventListener('click', handleDashTipItemClick);
    dashTipEl.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('.dash-tip-item');
      if (!row) return;
      e.preventDefault();
      row.click();
    });
    dashTipEl.addEventListener('mouseout', e => {
      const to = e.relatedTarget;
      // Ocultar al salir del tooltip hacia un área sin ítems clicables
      if (to && to.closest && (to.closest('.dash-tip') || to.closest('[data-tip]'))) return;
      hideDashTip();
    });
  }
  return dashTipEl;
}

function hideDashTip() {
  if (dashTipEl) dashTipEl.classList.remove('show');
  dashTipTarget = null;
  dashTipLastSeg = null;
}

function positionDashTip(tip, x, y) {
  const pad = 14;
  const r = tip.getBoundingClientRect();
  let left = x + pad;
  let top = y + pad;
  if (left + r.width > window.innerWidth - 10) left = x - r.width - pad;
  if (top + r.height > window.innerHeight - 10) top = y - r.height - pad;
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = Math.max(8, top) + 'px';
}

// Devuelve { name, color } del segmento de la dona bajo el cursor
function donutSegmentAt(clientX, clientY, donutEl) {
  const entries = dashTipData.estadoEntries;
  if (!entries.length) return null;
  const rect = donutEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const dist = Math.hypot(dx, dy);
  if (dist < rect.width / 2 - 27) return null; // dentro del agujero central
  // conic-gradient empieza en las 12 en punto y avanza en sentido horario
  let deg = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  const total = entries.reduce((s, e) => s + e[1], 0) || 1;
  let acc = 0;
  for (const [name, n] of entries) {
    acc += (n / total) * 360;
    if (deg < acc) return { name, color: REQ_ESTADO_HEX[name] || '#94a3b8' };
  }
  const last = entries[entries.length - 1];
  return { name: last[0], color: REQ_ESTADO_HEX[last[0]] || '#94a3b8' };
}

function buildTipRows(list, max, rowHtml) {
  const rows = list.slice(0, max).map(rowHtml).join('');
  const more = list.length > max ? `<li class="dash-tip-more">+${list.length - max} más…</li>` : '';
  return rows + more;
}

function showDashTipFor(el, x, y) {
  const tip = getDashTip();
  const kind = el.dataset.tip;
  let title = '', color = '#94a3b8', rows = '';
  // Máximo 6 filas: el tooltip tiene pointer-events:none (no scrolleable) y max-height 300px
  const max = 6;

  if (kind === 'urgencia') {
    dashTipLastSeg = null;
    const key = el.dataset.tip.split(':')[1];
    const meta = (dashTipData.urgenciaMeta || []).find(m => m.key === key) || { label: key, color: '#94a3b8' };
    const list = dashTipData.itemsByLevel[key] || [];
    title = meta.label;
    color = meta.color;
    rows = buildTipRows(list, max, it => {
      const days = daysUntil(it.expiryDate);
      return `<li class="dash-tip-item" data-kind="renovacion" data-id="${it.id}" role="button" tabindex="0" aria-label="Abrir ${escapeHtml(it.name)}"><span class="dash-tip-name">${escapeHtml(it.name)}</span><span class="dash-tip-sub">${getDaysLabel(days)} · ${formatDate(it.expiryDate)}</span></li>`;
    });
  } else if (kind === 'area') {
    dashTipLastSeg = null;
    const a = decodeURIComponent(el.dataset.reqArea);
    const list = dashTipData.reqsByArea[a] || [];
    title = a;
    color = dashTipData.areaColors[a] || '#6366f1';
    rows = buildTipRows(list, max, ({ item, p }) => {
      const extra = [p.req, p.estado].filter(Boolean).join(' · ');
      return `<li class="dash-tip-item" data-kind="req" data-id="${item.id}" role="button" tabindex="0" aria-label="Abrir ${escapeHtml(item.name)}"><span class="dash-tip-name">${escapeHtml(item.name)}</span><span class="dash-tip-sub">${escapeHtml(extra)}</span></li>`;
    });
  } else if (kind === 'estado') {
    dashTipLastSeg = null;
    const e = decodeURIComponent(el.dataset.reqEstado);
    const list = dashTipData.reqsByEstado[e] || [];
    title = e;
    color = REQ_ESTADO_HEX[e] || '#94a3b8';
    rows = buildTipRows(list, max, ({ item, p }) => {
      const extra = [p.req, p.area].filter(Boolean).join(' · ');
      return `<li class="dash-tip-item" data-kind="req" data-id="${item.id}" role="button" tabindex="0" aria-label="Abrir ${escapeHtml(item.name)}"><span class="dash-tip-name">${escapeHtml(item.name)}</span><span class="dash-tip-sub">${escapeHtml(extra)}</span></li>`;
    });
  } else if (kind === 'donut') {
    const seg = donutSegmentAt(x, y, el);
    if (!seg) { // cursor dentro del agujero central: ocultar sin anular dashTipTarget
      if (dashTipEl) dashTipEl.classList.remove('show');
      dashTipLastSeg = null;
      return;
    }
    const list = dashTipData.reqsByEstado[seg.name] || [];
    title = seg.name;
    color = seg.color;
    dashTipLastSeg = seg.name;
    rows = buildTipRows(list, max, ({ item, p }) => {
      const extra = [p.req, p.area].filter(Boolean).join(' · ');
      return `<li class="dash-tip-item" data-kind="req" data-id="${item.id}" role="button" tabindex="0" aria-label="Abrir ${escapeHtml(item.name)}"><span class="dash-tip-name">${escapeHtml(item.name)}</span><span class="dash-tip-sub">${escapeHtml(extra)}</span></li>`;
    });
  } else if (kind === 'upcoming') {
    // Próximos vencimientos: desglose del ítem (datos clave de la renovación)
    dashTipLastSeg = null;
    const id = el.dataset.tip.split(':')[1];
    const item = items.find(i => i.id === id);
    if (!item) return;
    const days = daysUntil(item.expiryDate);
    const cat = CATEGORIES[item.category] || { label: item.category || '—', icon: '' };
    const meta = (dashTipData.urgenciaMeta || []).find(m => m.key === getUrgencyLevel(days)) || { color: '#94a3b8' };
    title = item.name;
    color = meta.color;
    rows = [
      ['Categoría', cat.label],
      ['Vence', formatDate(item.expiryDate)],
      ['Días', getDaysLabel(days)],
      ['Costo', formatCurrency(item.cost)],
      ['Proveedor', item.provider || ''],
      ['Estado', item.estado || ''],
      ['Notas', item.notes || ''],
    ].filter(([, v]) => v && v !== '')
      .map(([k, v]) => `
        <li class="dash-tip-break">
          <span class="dash-tip-break-dot" style="background:${color};"></span>
          <span class="dash-tip-break-label">${escapeHtml(k)}</span>
          <span class="dash-tip-break-num">${escapeHtml(v)}</span>
        </li>`).join('');
  } else if (kind === 'total') {
    // KPI Total: desglose por nivel de urgencia
    dashTipLastSeg = null;
    title = 'Desglose por urgencia';
    color = '#3b82f6';
    rows = (dashTipData.urgenciaMeta || [])
      .filter(m => (dashTipData.totalStats[m.key] || 0) > 0)
      .map(m => {
        const n = dashTipData.totalStats[m.key] || 0;
        return `
        <li class="dash-tip-break">
          <span class="dash-tip-break-dot" style="background:${m.color};"></span>
          <span class="dash-tip-break-label">${m.label}</span>
          <span class="dash-tip-break-num">${n}</span>
        </li>`;
      }).join('');
  } else {
    dashTipLastSeg = null;
    return;
  }

  tip.innerHTML = `
    <div class="dash-tip-head">
      <span class="dash-tip-dot" style="background:${color};"></span>
      <span class="dash-tip-title">${escapeHtml(title)}</span>
    </div>
    <ul class="dash-tip-list">${rows || '<li class="dash-tip-empty">Sin ítems</li>'}</ul>`;
  tip.classList.add('show');
  positionDashTip(tip, x, y);
}

function handleDashTipOver(e) {
  const el = e.target.closest('[data-tip]');
  if (!el) return;
  dashTipTarget = el;
  showDashTipFor(el, e.clientX, e.clientY);
}

function handleDashTipMove(e) {
  if (!dashTipTarget) return;
  // Solo la dona necesita seguimiento: su segmento cambia con el cursor.
  // El resto de tooltips quedan fijas para que sus ítems sean clicables.
  if (dashTipTarget.dataset.tip !== 'donut') return;
  const seg = donutSegmentAt(e.clientX, e.clientY, dashTipTarget);
  if (!seg) { // agujero central: ocultar pero conservar dashTipTarget para reaparecer
    if (dashTipEl) dashTipEl.classList.remove('show');
    dashTipLastSeg = null;
    return;
  }
  if (seg.name !== dashTipLastSeg) {
    showDashTipFor(dashTipTarget, e.clientX, e.clientY);
  }
}

function handleDashTipOut(e) {
  const to = e.relatedTarget;
  if (to && dashTipTarget && dashTipTarget.contains(to)) return; // sigue dentro del mismo elemento
  if (to && to.closest && to.closest('[data-tip]')) return; // pasó a otro elemento con tooltip
  if (to && to.closest && to.closest('.dash-tip')) return; // pasó al tooltip: no ocultar para poder hacer clic
  hideDashTip();
}

// Clic en un ítem del tooltip: abrir renovación (editar) o requerimiento (historial)
function handleDashTipItemClick(e) {
  const row = e.target.closest('.dash-tip-item');
  if (!row) return;
  const id = row.dataset.id;
  const kind = row.dataset.kind;
  hideDashTip();
  if (kind === 'req' && id) openReqHistory(id);
  else if (id) openEdit(id);
}


function renderCard(item, index) {
  const days = daysUntil(item.expiryDate);
  const level = getUrgencyLevel(days);
  const cat = CATEGORIES[item.category] || { label: item.category, icon: '' };
  const isPending = days === null;
  const isExpired = days !== null && days < 0;
  const providerUrl = item.provider && (item.provider.startsWith('http') ? item.provider : 'https://' + item.provider);
  const hasCost = item.cost !== null && item.cost !== undefined && item.cost >= 0;
  return `\n    <div class="item-card level-${level}" style="animation-delay:${index * 0.04}s">\n      <div class="item-card-header">\n        <span class="item-category">${cat.icon} ${cat.label}</span>\n        <div class="item-notifs">\n          <span class="notif-icon active" title="Notificaciones Push activadas" data-tooltip="Push activado">&#x1F4EA;</span>
          <span class="notif-icon ${item.alertEmail ? 'active' : ''}" title="Recibir alertas por email" data-tooltip="${item.alertEmail ? 'Email activado' : 'Email desactivado'}">&#x2709;</span>
          <span class="notif-icon ${item.alertWhatsApp ? 'active' : ''}" title="Recibir alertas por SMS" data-tooltip="${item.alertWhatsApp ? 'WhatsApp/SMS activado' : 'WhatsApp/SMS desactivado'}">&#x1F4AC;</span>
          <span class="notif-icon ${item.alertTelegram ? 'active' : ''}" title="Recibir alertas por Telegram" data-tooltip="${item.alertTelegram ? 'Telegram activado' : 'Telegram desactivado'}">&#x1F4E2;</span>\n        </div>\n      </div>\n      <div class="item-name">${escapeHtml(item.name)}</div>\n      <div class="item-days">\n        <span class="days-badge ${isExpired ? 'expired' : level}">\n          ${isExpired ? '\u{23F0}' : '\u{1F552}'}
          ${getDaysLabel(days)}\n        </span>\n        <span class="days-label">${formatDate(item.expiryDate)}</span>\n      </div>\n      <div class="item-meta">\n        ${hasCost ? `<span class="item-cost">${formatCurrency(item.cost)}</span>` : ''}
        ${providerUrl ? `<a href="${providerUrl}" target="_blank" rel="noopener" class="item-provider" title="Ir al proveedor">${getHostname(item.provider)}</a>` : ''}\n      </div>\n      ${item.notes ? `<div class="item-notes">${escapeHtml(item.notes)}</div>` : ''}\n      <div class="item-actions">\n        <button class="item-action-btn edit" data-id="${item.id}" onclick="openEdit('${item.id}')" data-tooltip="Editar renovación">\n          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>\n          Editar\n        </button>\n        ${isAdmin() ? `<button class="item-action-btn delete" data-id="${item.id}" onclick="confirmDelete('${item.id}')" data-tooltip="Eliminar renovación" data-tooltip-left>\n          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>\n          Eliminar\n        </button>` : ''}\n      </div>\n    </div>`;
}

// ---- Stats with Progress Bars & Animated Numbers ----
function updateStats() {
  const stats = { total: items.length, ok: 0, soon: 0, warning: 0, urgent: 0, expired: 0, pending: 0 };
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
  animateNumber(dom.statPending, stats.pending);
  const total = stats.total || 1;
  updateStatProgress('statOk', stats.ok / total * 100);
  updateStatProgress('statSoon', stats.soon / total * 100);
  updateStatProgress('statWarning', stats.warning / total * 100);
  updateStatProgress('statUrgent', stats.urgent / total * 100);
  updateStatProgress('statExpired', stats.expired / total * 100);
  updateStatProgress('statPending', stats.pending / total * 100);
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

// ---- Historial de estados (auditoría) ----
let currentReqHistory = [];
let currentReqHistoryName = '';

async function openReqHistory(id) {
  const item = items.find(i => i.id === id);
  if (!item || !dom.historyOverlay) return;
  dom.historyItemName.textContent = item.name;
  dom.historyList.innerHTML = '<div class="history-loading">Cargando historial...</div>';
  dom.historyOverlay.style.display = 'flex';
  try {
    const json = await apiRequest('GET', `/${id}/history`);
    const history = Array.isArray(json.data) ? json.data : [];
    currentReqHistory = history;
    currentReqHistoryName = item.name;
    if (dom.historyExportBtn) dom.historyExportBtn.style.display = history.length ? 'inline-flex' : 'none';
    if (history.length === 0) {
      dom.historyList.innerHTML = '<div class="history-empty">Sin cambios de estado registrados aún.</div>';
      return;
    }
    dom.historyList.innerHTML = [...history].reverse().map(h => `
      <div class="history-item">
        <div class="history-arrow">${h.from_estado ? `<span class="hist-badge from">${escapeHtml(h.from_estado)}</span>` : '<span class="hist-badge from empty">(sin estado)</span>'} <span class="hist-arrow-sym">&#8594;</span> <span class="hist-badge to">${escapeHtml(h.to_estado || '(sin estado)')}</span></div>
        <div class="history-meta">
          <span class="history-user">&#128100; ${escapeHtml(h.username || 'sistema')}</span>
          <span class="history-date">&#128337; ${escapeHtml(formatDateTime(h.created_at))}</span>
        </div>
      </div>`).join('');
  } catch (err) {
    currentReqHistory = [];
    currentReqHistoryName = '';
    if (dom.historyExportBtn) dom.historyExportBtn.style.display = 'none';
    dom.historyList.innerHTML = `<div class="history-empty">${escapeHtml(err.message || 'Error al cargar el historial')}</div>`;
  }
}

function closeReqHistory() {
  if (dom.historyOverlay) dom.historyOverlay.style.display = 'none';
  currentReqHistory = [];
  currentReqHistoryName = '';
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
  if (days === null) return;
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
  const soon = items.filter(i => { const d = daysUntil(i.expiryDate); return d !== null && d >= 0 && d <= 30; });
  if (soon.length === 0) { showToast('No hay renovaciones próximas para compartir', 'info'); return; }
  let msg = '\u{1F514} *RenovaMEF* - Próximos vencimientos:\n\n';
  soon.forEach(item => {
    const cat = CATEGORIES[item.category]?.icon || '';
    const days = daysUntil(item.expiryDate);
    msg += `${cat} *${item.name}* — ${getDaysLabel(days)}\n`;
  });
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function notifyTelegram() {
  const soon = items.filter(i => { const d = daysUntil(i.expiryDate); return d !== null && d >= 0 && d <= 30; });
  if (soon.length === 0) { showToast('No hay renovaciones próximas para compartir', 'info'); return; }
  let msg = '\u{1F514} RenovaMEF - Próximos vencimientos:\n\n';
  soon.forEach(item => {
    const cat = CATEGORIES[item.category]?.icon || '';
    const days = daysUntil(item.expiryDate);
    msg += `${cat} ${item.name} — ${getDaysLabel(days)}\n`;
  });
  window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(msg)}`, '_blank');
}

function notifyEmail() {
  const upcoming = items.filter(i => { const d = daysUntil(i.expiryDate); return d !== null && d >= 0 && d <= 90; });
  if (upcoming.length === 0) { showToast('No hay renovaciones próximas', 'info'); return; }
  let body = 'Resumen de renovaciones próximas:\n\n';
  upcoming.forEach(item => {
    const cat = CATEGORIES[item.category]?.label || item.category;
    const days = daysUntil(item.expiryDate);
    const status = getUrgencyLevel(days);
    body += `[${status.toUpperCase()}] ${item.name} (${cat}) — ${getDaysLabel(days)} — ${formatDate(item.expiryDate)}\n`;
  });
  window.open(`mailto:?subject=${encodeURIComponent('RenovaMEF - Recordatorio')}&body=${encodeURIComponent(body)}`, '_blank');
  showToast('Cliente de correo abierto', 'success');
}

function notifyPushAll() {
  requestNotificationPermission();
  if (!('Notification' in window) || Notification.permission !== 'granted') { showToast('Permiso de notificaciones no concedido', 'error'); return; }
  const urgent = items.filter(i => { const d = daysUntil(i.expiryDate); return d !== null && d >= 0 && d <= 7; });
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
  const levelLabels = { ok: 'En orden', soon: 'Próxima', warning: 'Alerta', urgent: 'Urgente', expired: 'Vencida', pending: 'Pendiente' };
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
      days === null ? '' : days,
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
  const levelColors = { ok: '#10b981', soon: '#f59e0b', warning: '#f97316', urgent: '#ef4444', expired: '#94a3b8', pending: '#6366f1' };
  const levelLabels = { ok: 'En orden', soon: 'Próxima', warning: 'Alerta', urgent: 'Urgente', expired: 'Vencida', pending: 'Pendiente' };
  const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const viewLabel = currentView === 'calendar' ? 'Calendario' : 'Renovaciones';
  const rowsHtml = data.map(item => {
    const days = daysUntil(item.expiryDate);
    const level = getUrgencyLevel(days);
    const color = levelColors[level];
    return `\n      <tr>\n        <td class="name"><strong>${escapeHtml(item.name)}</strong></td>\n        <td>${escapeHtml(CATEGORIES[item.category]?.label || item.category)}</td>\n        <td>${escapeHtml(formatDate(item.expiryDate))}</td>\n        <td><span class="badge" style="background:${color}22;color:${color};border:1px solid ${color}55;">${levelLabels[level]}</span></td>\n        <td class="days" style="color:${color};">${getDaysLabel(days)}</td>\n        <td class="cost">${item.cost != null ? escapeHtml(formatCurrency(item.cost)) : ''}</td>\n      </tr>`;
  }).join('');
  win.document.write(`<!DOCTYPE html>\n<html lang="es"><head><meta charset="UTF-8"><title>RenovaMEF</title><style>\n  * { box-sizing: border-box; margin: 0; padding: 0; }\n  body { font-family: 'Segoe UI', -apple-system, Arial, sans-serif; color: #1e293b; padding: 32px; }\n  .print-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }\n  .print-header h1 { font-size: 20px; color: #0f172a; }\n  .print-meta { font-size: 12px; color: #64748b; margin-bottom: 20px; }\n  table { width: 100%; border-collapse: collapse; margin-top: 8px; }\n  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 2px solid #e2e8f0; padding: 8px 10px; }\n  td { font-size: 13px; padding: 9px 10px; border-bottom: 1px solid #f1f5f9; }\n  td.name { font-weight: 600; }\n  td.cost { text-align: right; }\n  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }\n  .print-footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: center; }\n  .print-summary { font-size: 12px; color: #475569; margin-bottom: 16px; }\n  @media print { body { padding: 0; } }\n</style></head><body>\n  <div class="print-header">\n    <h1>\u21BB RenovaMEF</h1>\n    <span class="badge" style="background:#dbeafe;color:#2563eb;border:1px solid #93c5fd;">Vista: ${viewLabel}</span>\n  </div>\n  <div class="print-meta">Reporte generado el ${today} \u2022 ${data.length} renovaciones</div>\n  <div class="print-summary">Este reporte incluye solo los datos visibles con los filtros actuales.</div>\n  <table>\n    <thead><tr><th>Nombre</th><th>Categoría</th><th>Vence</th><th>Estado</th><th>Tiempo</th><th style="text-align:right;">Costo</th></tr></thead>\n    <tbody>${rowsHtml}</tbody>\n  </table>\n  <div class="print-footer">RenovaMEF \u2014 Generado automáticamente</div>\n  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); }; window.onafterprint = function(){ window.close(); };<\/script>\n</body></html>`);
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
        const validItems = imported.filter(item => item.name && item.category);
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
    if (days !== null && days >= 0) {
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
    if (dom.historyOverlay && dom.historyOverlay.style.display === 'flex') closeReqHistory();
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
    setStoredRole(json.data.role);
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
  // Indica el rol junto al usuario (admin / analista)
  const roleBadge = document.getElementById('userRoleBadge');
  if (roleBadge) {
    roleBadge.textContent = isAdmin() ? 'admin' : 'analista';
    roleBadge.classList.toggle('role-admin', isAdmin());
  }
  startApp();
}

// ---- Register (solo cuentas Gmail) ----
function showRegisterForm() {
  if (dom.loginForm) dom.loginForm.style.display = 'none';
  if (dom.registerForm) dom.registerForm.style.display = 'block';
  if (dom.loginError) dom.loginError.textContent = '';
}

function showLoginForm() {
  if (dom.registerForm) dom.registerForm.style.display = 'none';
  if (dom.loginForm) dom.loginForm.style.display = 'block';
  if (dom.registerError) dom.registerError.textContent = '';
}

async function handleRegister(e) {
  e.preventDefault();
  const email = dom.regEmail.value.trim().toLowerCase();
  const password = dom.regPassword.value;
  const password2 = dom.regPassword2.value;

  if (!email || !password) {
    dom.registerError.textContent = 'Completa todos los campos';
    return;
  }
  if (!/^[a-z0-9._%+\-]+@gmail\.com$/i.test(email)) {
    dom.registerError.textContent = 'Solo se permiten cuentas Gmail (@gmail.com)';
    return;
  }
  if (password.length < 6) {
    dom.registerError.textContent = 'La contraseña debe tener al menos 6 caracteres';
    return;
  }
  if (password !== password2) {
    dom.registerError.textContent = 'Las contraseñas no coinciden';
    return;
  }

  dom.registerError.textContent = '';
  dom.registerBtn.disabled = true;
  dom.registerBtn.innerHTML = 'Creando cuenta...';
  try {
    const res = await fetch(window.location.origin + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!json.success || !json.data || !json.data.token) {
      throw new Error(json.error || 'Error al crear la cuenta');
    }
    setToken(json.data.token);
    setStoredUsername(json.data.username || email);
    setStoredRole(json.data.role);
    showApp();
  } catch (err) {
    dom.registerError.textContent = err.message || 'Error de conexión';
  } finally {
    dom.registerBtn.disabled = false;
    dom.registerBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
      Crear cuenta
    `;
  }
}

// ---- Logout ----
function logout() {
  clearToken();
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ROLE_KEY);
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

  // Carga los estados personalizados de requerimientos (si existen)
  try {
    const settings = await fetchSettings();
    if (Array.isArray(settings.req_estados)) {
      // Normaliza por acentos para no duplicar 'En tramite'/'En trámite'
      reqEstadoOptions = [...new Set(settings.req_estados.map(normalizeReqEstado).filter(Boolean))];
    }
    if (settings.req_flow_enabled !== undefined) {
      reqFlowEnabled = !!settings.req_flow_enabled;
    }
    if (Array.isArray(settings.req_flow_order) && settings.req_flow_order.length) {
      reqFlowOrder = [...new Set(settings.req_flow_order.map(normalizeReqEstado).filter(Boolean))];
    }
    if (typeof settings.tramite_url === 'string') tramiteUrl = settings.tramite_url;
    if (currentView === 'req') renderRequirements();
  } catch (err) { /* usa la lista por defecto */ }

  // Restaura los filtros y la página activa de Requerimientos de la sesión anterior.
  // Va fuera del try de settings para que siempre se ejecute (incluso en modo offline).
  restoreReqFilters();
  applyHashRoute();

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
  const notifBar = document.createElement('div');
  notifBar.className = 'notif-bar';
  notifBar.style.display = 'none'; // oculta hasta entrar a la vista Renovaciones
  // CSV/PDF disponibles para todos; el resto (notificar, importar, configurar) solo admin
  const csvPdf = `<button class="btn btn-secondary" onclick="exportCsv()">\u{1F4C4} CSV</button>
    <button class="btn btn-secondary" onclick="exportPdf()">\u{1F4C5} PDF</button>`;
  const adminBtns = isAdmin()
    ? `<button class="btn btn-secondary" onclick="notifyWhatsApp()">\u{1F4AC} WhatsApp</button>
    <button class="btn btn-secondary" onclick="notifyTelegram()">\u{1F4E2} Telegram</button>
    <button class="btn btn-secondary" onclick="notifyEmail()">\u{2709} Email</button>
    <button class="btn btn-secondary" onclick="notifyPushAll()">\u{1F4EA} Push</button>
    <button class="btn btn-secondary" onclick="exportData()">\u{1F4E5} JSON</button>
    ${csvPdf}
    <button class="btn btn-secondary" onclick="importData()">\u{1F4E4} Importar</button>
    <button class="btn btn-secondary settings-btn" onclick="openSettings()">\u{2699}\u{FE0F} Configurar alertas</button>`
    : csvPdf;
  notifBar.innerHTML = `\n    ${adminBtns}`;
  const statsBar = document.querySelector('.stats-bar');
  statsBar.parentNode.insertBefore(notifBar, statsBar.nextSibling);
  // Sincroniza la botonera con la vista activa (p. ej. #list ya aplicado por applyHashRoute)
  syncListChrome();

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
  if (dom.historyClose) dom.historyClose.addEventListener('click', closeReqHistory);
  if (dom.historyOverlay) dom.historyOverlay.addEventListener('click', (e) => { if (e.target === dom.historyOverlay) closeReqHistory(); });
  if (dom.historyExportBtn) dom.historyExportBtn.addEventListener('click', exportReqHistoryCsv);
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

  if (dom.dashboardViewTab) dom.dashboardViewTab.addEventListener('click', () => switchView('dashboard'));
  if (dom.dashboardContent) {
    dom.dashboardContent.addEventListener('click', handleDashClick);
    dom.dashboardContent.addEventListener('keydown', handleDashKeydown);
    dom.dashboardContent.addEventListener('mouseover', handleDashTipOver);
    dom.dashboardContent.addEventListener('mousemove', handleDashTipMove);
    dom.dashboardContent.addEventListener('mouseout', handleDashTipOut);
  }
  dom.listViewTab.addEventListener('click', () => switchView('list'));
  dom.calendarViewTab.addEventListener('click', () => switchView('calendar'));
  if (dom.reqViewTab) dom.reqViewTab.addEventListener('click', () => switchView('req'));
  window.addEventListener('hashchange', applyHashRoute);
  if (dom.reqSearchInput) dom.reqSearchInput.addEventListener('input', (e) => { reqSearchQuery = e.target.value; reqPage = 1; renderRequirements(); });
  if (dom.reqEstadoFilter) dom.reqEstadoFilter.addEventListener('change', (e) => { reqEstadoFilter = e.target.value; reqPage = 1; renderRequirements(); });
  if (dom.reqAreaFilter) dom.reqAreaFilter.addEventListener('change', (e) => { reqAreaFilter = e.target.value; reqPage = 1; renderRequirements(); });
  if (dom.reqPagination) dom.reqPagination.addEventListener('click', (e) => {
    const b = e.target.closest('.req-page-btn');
    if (!b || b.disabled) return;
    const p = parseInt(b.dataset.page, 10);
    if (!isNaN(p) && p >= 1) { reqPage = p; renderRequirements(); }
  });
  if (dom.reqPagination) dom.reqPagination.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'reqPageSizeSelect') {
      const v = parseInt(e.target.value, 10);
      if (REQ_PAGE_SIZES.includes(v)) {
        reqPageSize = v;
        saveReqPageSize(v);
        reqPage = 1;
        renderRequirements();
      }
    }
  });
  if (dom.reqSummary) dom.reqSummary.addEventListener('click', (e) => {
    const chip = e.target.closest('.req-summary-chip');
    if (!chip) return;
    setReqSummaryFilter(chip.dataset.sumType, chip.dataset.sumValue);
  });
  if (dom.reqEstadoAddBtn) dom.reqEstadoAddBtn.addEventListener('click', addReqEstado);
  if (dom.reqEstadoInput) dom.reqEstadoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addReqEstado(); } });
  if (dom.reqEstadosResetBtn) dom.reqEstadosResetBtn.addEventListener('click', resetReqEstados);
  if (dom.reqFlowResetBtn) dom.reqFlowResetBtn.addEventListener('click', resetReqFlow);
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

  console.log(`\u{1F504} RenovaMEF iniciado — ${items.length} renovaciones cargadas`);
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
        if (json.data && json.data.role) setStoredRole(json.data.role);
        showApp();
      }
      else { clearToken(); localStorage.removeItem(USER_KEY); localStorage.removeItem(ROLE_KEY); dom.loginForm.addEventListener('submit', handleLogin); }
    })
    .catch(() => { dom.loginForm.addEventListener('submit', handleLogin); });
  } else {
    dom.loginForm.addEventListener('submit', handleLogin);
  }
  if (dom.registerForm) dom.registerForm.addEventListener('submit', handleRegister);
  if (dom.showRegisterBtn) dom.showRegisterBtn.addEventListener('click', showRegisterForm);
  if (dom.showLoginBtn) dom.showLoginBtn.addEventListener('click', showLoginForm);
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
    dom.smtpFromName.value = settings.smtp_from_name || 'RenovaMEF';
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
    // Estados personalizados de requerimientos (borrador; se confirma al guardar)
    reqEstadoDraft = Array.isArray(settings.req_estados)
      ? [...new Set(settings.req_estados.map(normalizeReqEstado).filter(Boolean))]
      : [...REQ_ESTADO_OPTIONS];
    renderReqEstadosEditor();
    // Flujo secuencial (borrador; se confirma al guardar)
    reqFlowEnabled = !!settings.req_flow_enabled;
    reqFlowDraft = (Array.isArray(settings.req_flow_order) && settings.req_flow_order.length)
      ? [...new Set(settings.req_flow_order.map(normalizeReqEstado).filter(Boolean))]
      : [...REQ_FLOW_DEFAULT_ORDER];
    if (dom.reqFlowEnabled) dom.reqFlowEnabled.checked = reqFlowEnabled;
    renderReqFlowEditor();
    if (dom.tramiteUrl) dom.tramiteUrl.value = settings.tramite_url || '';
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

// ---- Editor de estados de requerimientos ----
// El editor trabaja sobre reqEstadoDraft; solo se confirma al guardar
function renderReqEstadosEditor() {
  if (!dom.reqEstadosList) return;
  if (reqEstadoDraft.length === 0) {
    dom.reqEstadosList.innerHTML = '<span class="req-estados-empty">Sin estados configurados. Agrega uno o restaura la lista por defecto.</span>';
    return;
  }
  dom.reqEstadosList.innerHTML = reqEstadoDraft.map((e, i) => `
    <span class="req-estado-chip">
      <span class="req-estado-chip-label">${escapeHtml(e)}</span>
      <button type="button" class="req-estado-chip-x" data-index="${i}" title="Quitar estado" aria-label="Quitar ${escapeHtml(e)}">&times;</button>
    </span>`).join('');
  dom.reqEstadosList.querySelectorAll('.req-estado-chip-x').forEach(btn => {
    btn.addEventListener('click', () => removeReqEstado(parseInt(btn.dataset.index, 10)));
  });
}

function addReqEstado() {
  const val = normalizeReqEstado(dom.reqEstadoInput.value);
  if (!val) { showToast('Escribe el nombre de un estado', 'error'); return; }
  if (reqEstadoDraft.includes(val)) { showToast('Ese estado ya existe', 'error'); return; }
  reqEstadoDraft.push(val);
  // El nuevo estado se agrega al final del flujo por defecto
  if (!reqFlowDraft.includes(val)) reqFlowDraft.push(val);
  dom.reqEstadoInput.value = '';
  renderReqEstadosEditor();
  renderReqFlowEditor();
  dom.reqEstadoInput.focus();
}

function removeReqEstado(index) {
  const removed = reqEstadoDraft[index];
  reqEstadoDraft.splice(index, 1);
  if (removed) reqFlowDraft = reqFlowDraft.filter(s => s !== removed);
  renderReqEstadosEditor();
  renderReqFlowEditor();
}

function resetReqEstados() {
  reqEstadoDraft = [...REQ_ESTADO_OPTIONS];
  reqFlowDraft = [...REQ_FLOW_DEFAULT_ORDER];
  renderReqEstadosEditor();
  renderReqFlowEditor();
  showToast('Lista de estados restaurada', 'success');
}

// ---- Editor de flujo secuencial de estados ----
function renderReqFlowEditor() {
  if (!dom.reqFlowList) return;
  if (reqFlowDraft.length === 0) {
    dom.reqFlowList.innerHTML = '<span class="req-estados-empty">Sin estados en el flujo. Restaura el orden por defecto.</span>';
    return;
  }
  dom.reqFlowList.innerHTML = reqFlowDraft.map((e, i) => `
    <div class="req-flow-item">
      <span class="req-flow-num">${i + 1}</span>
      <span class="req-flow-label">${escapeHtml(e)}</span>
      <span class="req-flow-actions">
        <button type="button" class="req-flow-btn" data-flow="up" data-index="${i}" title="Mover arriba" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
        <button type="button" class="req-flow-btn" data-flow="down" data-index="${i}" title="Mover abajo" ${i === reqFlowDraft.length - 1 ? 'disabled' : ''}>&darr;</button>
      </span>
    </div>`).join('');
  dom.reqFlowList.querySelectorAll('.req-flow-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index, 10);
      if (btn.dataset.flow === 'up' && i > 0) {
        [reqFlowDraft[i - 1], reqFlowDraft[i]] = [reqFlowDraft[i], reqFlowDraft[i - 1]];
      } else if (btn.dataset.flow === 'down' && i < reqFlowDraft.length - 1) {
        [reqFlowDraft[i + 1], reqFlowDraft[i]] = [reqFlowDraft[i], reqFlowDraft[i + 1]];
      }
      renderReqFlowEditor();
    });
  });
}

function resetReqFlow() {
  reqFlowDraft = [...REQ_FLOW_DEFAULT_ORDER];
  renderReqFlowEditor();
  showToast('Orden del flujo restaurado', 'success');
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
    req_estados: reqEstadoDraft,
    req_flow_enabled: dom.reqFlowEnabled ? dom.reqFlowEnabled.checked : false,
    req_flow_order: reqFlowDraft,
    tramite_url: dom.tramiteUrl ? dom.tramiteUrl.value.trim() : '',
  };
  dom.settingsSave.disabled = true;
  dom.settingsSave.innerHTML = 'Guardando...';
  try {
    await saveSettings(data);
    // Confirma los borradores de estados y flujo como lista activa
    reqEstadoOptions = [...reqEstadoDraft];
    reqFlowEnabled = dom.reqFlowEnabled ? dom.reqFlowEnabled.checked : false;
    reqFlowOrder = [...reqFlowDraft];
    tramiteUrl = dom.tramiteUrl ? dom.tramiteUrl.value.trim() : '';
    showToast('Configuración guardada', 'success');
    closeSettings();
    // Refresca la vista de requerimientos por si estaba abierta
    if (currentView === 'req') renderRequirements();
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