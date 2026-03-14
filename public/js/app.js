'use strict';

/* ================================================================
   SajiloKhata — Frontend Application
   Vanilla JS SPA: Auth, Products, Customers, Suppliers,
   Transactions (with Basket), Expenses, Baki Ledger, Reports
   ================================================================ */

const API = '/api';

// ── Persistent state ──────────────────────────────────────────────
const state = {
  token:     null,
  user:      null,
  basket:    [],         // { product_id, product_name, quantity, unit_price }
  products:  [],         // cache for basket select
  customers: [],
  suppliers: [],
  currentSection: 'dashboard',
  lowStockNotified: new Set(),
  lang: localStorage.getItem('sk_lang') || 'en',
  confirmResolver: null,
  healthTimer: null,
};

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

function esc(str) {
  // Prevent XSS when inserting dynamic content via innerHTML
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

function setButtonBusy(button, busy, idleLabel, busyLabel = 'Processing...') {
  if (!button) return;
  if (busy) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = `<div class="spinner"></div><span>${esc(busyLabel)}</span>`;
    return;
  }
  button.disabled = false;
  button.removeAttribute('aria-busy');
  button.innerHTML = `<span>${esc(idleLabel)}</span>`;
}

function fmtCurrency(n) {
  return 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isAdmin() {
  return state.user?.role === 'Admin';
}

function ensureAdminAction(actionLabel = 'perform this action') {
  if (isAdmin()) return true;
  showToast(`Admin permission required to ${actionLabel}.`, 'error');
  return false;
}

// ── Toast ─────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '❌';
  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span>${esc(message)}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ── API helper ────────────────────────────────────────────────────
async function api(method, path, body) {
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (state.token) opts.headers['Authorization'] = `Bearer ${state.token}`;
    if (body)        opts.body = JSON.stringify(body);

    const res = await fetch(API + path, opts);
    const data = await res.json().catch(() => ({ success: false, message: 'Invalid server response.' }));

    if (res.status === 401) {
      handleLogout();
      return { success: false, message: 'Session expired.' };
    }

    if (res.status === 403 && !data.message) {
      return { success: false, message: 'You do not have permission to perform this action.' };
    }

    if (res.status >= 500 && !data.message) {
      return { success: false, message: 'Server error. Please try again shortly.' };
    }

    if (!res.ok && !data.message) {
      return { success: false, message: `Request failed with status ${res.status}.` };
    }

    return data;
  } catch {
    return { success: false, message: 'Network error. Please check your connection.' };
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════

function switchAuthTab(tab) {
  document.getElementById('login-form').style.display    = tab === 'login'  ? 'block' : 'none';
  document.getElementById('signup-form').style.display   = tab === 'signup' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'signup'));
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  setButtonBusy(btn, true, 'Login', 'Signing in...');

  const data = await api('POST', '/auth/login', { username, password });
  setButtonBusy(btn, false, 'Login');

  if (data.success) {
    const token = data.data?.token;
    const user = data.data?.user;
    if (!token || !user) {
      showToast('Login response is incomplete. Please try again.', 'error');
      return;
    }

    state.token = token;
    state.user  = user;
    localStorage.setItem('sk_token', token);
    localStorage.setItem('sk_user',  JSON.stringify(user));
    bootApp();
  } else {
    showToast(data.message || 'Login failed.', 'error');
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const btn      = document.getElementById('signup-btn');
  const username = document.getElementById('signup-username').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm  = document.getElementById('signup-confirm').value;

  if (password !== confirm) {
    showToast('Passwords do not match.', 'error'); return;
  }

  setButtonBusy(btn, true, 'Create Account', 'Creating account...');

  const data = await api('POST', '/auth/signup', { username, password });

  if (data.success) {
    // Auto-login immediately after signup
    const loginData = await api('POST', '/auth/login', { username, password });
    setButtonBusy(btn, false, 'Create Account');

    if (loginData.success) {
      const token = loginData.data?.token;
      const user = loginData.data?.user;
      if (!token || !user) {
        showToast('Login response is incomplete. Please log in manually.', 'warning');
        switchAuthTab('login');
        return;
      }

      state.token = token;
      state.user  = user;
      localStorage.setItem('sk_token', token);
      localStorage.setItem('sk_user',  JSON.stringify(user));
      showToast('Welcome to SajiloKhata! 🎉', 'success');
      bootApp();
    } else {
      showToast('Account created! Please log in.', 'success');
      switchAuthTab('login');
      document.getElementById('login-username').value = username;
    }
  } else {
    setButtonBusy(btn, false, 'Create Account');
    showToast(data.message || 'Signup failed.', 'error');
  }
}

function handleLogout() {
  if (state.healthTimer) {
    clearInterval(state.healthTimer);
    state.healthTimer = null;
  }

  state.token   = null;
  state.user    = null;
  state.basket  = [];
  localStorage.removeItem('sk_token');
  localStorage.removeItem('sk_user');

  // Return user to public homepage after logout for a professional flow.
  window.location.href = '/';
}

// ── Bootstrap session ─────────────────────────────────────────────
function bootApp() {
  document.getElementById('auth-page').style.display = 'none';
  document.getElementById('app').style.display       = 'flex';

  const name = state.user?.username || 'User';
  const role = state.user?.role || 'Staff';
  document.getElementById('user-display-name').textContent = name;
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();
  document.getElementById('user-role').textContent = role;

  const langSwitch = document.getElementById('language-switch');
  if (langSwitch) langSwitch.value = state.lang;
  if (window.SK_I18N && typeof window.SK_I18N.applyLanguage === 'function') {
    window.SK_I18N.applyLanguage(state.lang);
  }

  applyRolePermissions();

  // Preload caches
  loadProducts();
  loadCustomers();
  loadSuppliers();

  // Resolve initial section from URL hash on every app boot path.
  routeToSection(getSectionFromHash(), true);

  startHealthMonitor();
}

function setHealthPill(kind, text) {
  const pill = document.getElementById('system-health-pill');
  if (!pill) return;

  pill.classList.remove('ok', 'warn', 'err');
  if (kind) pill.classList.add(kind);
  pill.textContent = text;
}

async function loadSystemHealth() {
  const data = await api('GET', '/health');
  if (!data.success) {
    setHealthPill('err', 'System: Issue');
    return;
  }

  const dbOk = data.data?.database === 'connected';
  const uptime = Number(data.data?.uptime_seconds || 0);
  const uptimeMins = Math.floor(uptime / 60);

  if (dbOk) {
    setHealthPill('ok', `System: Healthy (${uptimeMins}m)`);
  } else {
    setHealthPill('warn', 'System: Degraded');
  }
}

function startHealthMonitor() {
  if (state.healthTimer) {
    clearInterval(state.healthTimer);
    state.healthTimer = null;
  }

  setHealthPill('warn', 'System: Checking...');
  loadSystemHealth();
  state.healthTimer = setInterval(loadSystemHealth, 30000);
}

function applyRolePermissions() {
  const hiddenForStaff = ['.admin-only', '.admin-only-mobile', '.admin-only-section', '.admin-only-action'];
  hiddenForStaff.forEach((selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.classList.toggle('is-hidden', !isAdmin());
    });
  });

  const nav = document.querySelector('.sidebar-nav');
  if (nav) {
    const children = Array.from(nav.children);
    children.forEach((node, index) => {
      if (!node.classList.contains('nav-section-label')) return;

      let hasVisibleItem = false;
      for (let i = index + 1; i < children.length; i += 1) {
        const next = children[i];
        if (next.classList.contains('nav-section-label')) break;
        if (next.classList.contains('nav-item') && !next.classList.contains('is-hidden')) {
          hasVisibleItem = true;
          break;
        }
      }

      node.classList.toggle('is-hidden', !hasVisibleItem);
    });
  }

  if (!isAdmin() && ['expenses', 'baki', 'reports'].includes(state.currentSection)) {
    const dashboardNav = document.querySelector('[data-section="dashboard"]');
    navigateTo('dashboard', dashboardNav);
  }
}

// ═══════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════

const sectionTitles = {
  'dashboard':       'Dashboard',
  'products':        'Products',
  'customers':       'Customers',
  'suppliers':       'Suppliers',
  'new-transaction': 'New Transaction',
  'transactions':    'Transaction History',
  'expenses':        'Expenses',
  'baki':            'Baki Ledger',
  'reports':         'Reports',
};

const defaultSection = 'dashboard';

function normalizeSection(section) {
  const cleaned = String(section || '').replace(/^#/, '').trim();
  return cleaned || defaultSection;
}

function getSectionFromHash() {
  return normalizeSection(window.location.hash);
}

function getNavForSection(section) {
  return document.querySelector(`[data-section="${section}"]`);
}

function updateHash(section, replace = false) {
  const nextHash = `#${section}`;
  if (window.location.hash !== nextHash) {
    if (replace) {
      history.replaceState(null, '', nextHash);
    } else {
      history.pushState(null, '', nextHash);
    }
  }
}

function routeToSection(section, replace = false) {
  const target = normalizeSection(section);
  const nav = getNavForSection(target);
  navigateTo(target, nav, replace);
}

function navigateTo(section, el, replaceHistory = false) {
  const targetSection = document.getElementById(`section-${section}`);
  if (!targetSection || targetSection.classList.contains('is-hidden')) {
    showToast('You do not have permission to access this section.', 'warning');
    if (section !== defaultSection) {
      const fallbackNav = getNavForSection(defaultSection);
      navigateTo(defaultSection, fallbackNav, true);
    }
    return;
  }

  state.currentSection = section;
  updateHash(section, replaceHistory);

  // Hide all, show target
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  targetSection.classList.add('active');

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el?.classList.add('active');

  // Update topbar title
  document.getElementById('topbar-title').textContent = sectionTitles[section] || section;
  document.querySelectorAll('.mobile-nav-item').forEach((n) => {
    n.classList.toggle('active', n.getAttribute('onclick')?.includes(`'${section}'`));
  });

  // Trigger data load
  switch (section) {
    case 'dashboard':       loadDashboard();      break;
    case 'products':        loadProducts();       break;
    case 'customers':       loadCustomers();      break;
    case 'suppliers':       loadSuppliers();      break;
    case 'new-transaction': initTransactionForm();break;
    case 'transactions':    loadTransactions();   break;
    case 'expenses':        loadExpenses();       break;
    case 'baki':            loadBaki();           break;
  }

  closeSidebar();
}

// ── Sidebar toggle (mobile) ───────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════════════

function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function confirmAction(message, title = 'Confirm Action', confirmText = 'Confirm') {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  const acceptEl = document.getElementById('confirm-accept');

  titleEl.textContent = title;
  msgEl.textContent = message;
  acceptEl.textContent = confirmText;

  modal.classList.add('open');
  return new Promise((resolve) => {
    state.confirmResolver = resolve;
  });
}

function resolveConfirm(accepted) {
  if (typeof state.confirmResolver === 'function') {
    const resolve = state.confirmResolver;
    state.confirmResolver = null;
    resolve(accepted);
  }
  document.getElementById('confirm-modal').classList.remove('open');
}

function closeConfirmModal() {
  if (typeof state.confirmResolver === 'function') {
    const resolve = state.confirmResolver;
    state.confirmResolver = null;
    resolve(false);
  }
  document.getElementById('confirm-modal').classList.remove('open');
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target !== overlay) return;
    if (overlay.id === 'confirm-modal') {
      closeConfirmModal();
      return;
    }
    overlay.classList.remove('open');
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  if (document.getElementById('confirm-modal')?.classList.contains('open')) {
    closeConfirmModal();
    return;
  }

  const openModal = document.querySelector('.modal-overlay.open');
  if (openModal) {
    openModal.classList.remove('open');
  }
  closeSidebar();
});

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════

async function loadDashboard() {
  const [txData, prodData, plData, bakiSummary] = await Promise.all([
    api('GET', '/transactions?limit=10'),
    api('GET', '/products'),
    isAdmin() ? api('GET', '/reports/profit-loss') : Promise.resolve({ success: false }),
    isAdmin() ? api('GET', '/baki/summary') : Promise.resolve({ success: false }),
  ]);

  // Stats
  if (plData.success) {
    const d = plData.data;
    document.getElementById('stat-revenue').textContent    = fmtCurrency(d.total_sales);
    document.getElementById('stat-net-profit').textContent = fmtCurrency(d.net_profit);
  }

  // Products count & low stock
  if (prodData.success) {
    document.getElementById('stat-products').textContent = prodData.data.length;
    state.products = prodData.data;
    const lowStockData = await api('GET', '/products/low-stock');
    renderLowStock(lowStockData.success ? lowStockData.data : prodData.data.filter((p) => p.stock_quantity <= 10));
  }

  if (!isAdmin()) {
    document.getElementById('stat-revenue').textContent = 'Restricted';
    document.getElementById('stat-net-profit').textContent = 'Restricted';
    document.getElementById('stat-baki').textContent = 'Restricted';
    document.getElementById('baki-badge').style.display = 'none';
  }

  // Outstanding baki total
  if (bakiSummary.success) {
    const total = bakiSummary.data.reduce((s, r) => s + Number(r.total_outstanding), 0);
    document.getElementById('stat-baki').textContent = fmtCurrency(total);

    // Badge
    const badge = document.getElementById('baki-badge');
    if (bakiSummary.data.length > 0) {
      badge.style.display = 'inline';
      badge.textContent   = bakiSummary.data.length;
    }
  }

  // Recent transactions table
  if (txData.success) {
    const tbody = document.getElementById('dashboard-tx-body');
    if (txData.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📋</div><p>No transactions yet</p></div></td></tr>';
    } else {
      tbody.innerHTML = txData.data.map(t => `
        <tr>
          <td>#${esc(t.transaction_id)}</td>
          <td><span class="badge ${t.transaction_type === 'Sale' ? 'badge-success' : 'badge-info'}">${esc(t.transaction_type)}</span></td>
          <td><span class="badge ${t.payment_type === 'Cash' ? 'badge-primary' : 'badge-warning'}">${esc(t.payment_type)}</span></td>
          <td>${fmtCurrency(t.total_amount)}</td>
          <td>${fmtDate(t.transaction_date)}</td>
        </tr>
      `).join('');
    }
  }
}

function renderLowStock(products) {
  const low = products;
  const el  = document.getElementById('low-stock-list');
  if (low.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>All stock levels healthy</p></div>';
    return;
  }
  el.innerHTML = low.map(p => `
    <div class="basket-item">
      <div>
        <div class="item-name">${esc(p.product_name)}</div>
        <div class="item-price">${esc(p.unit_price)} / ${esc(p.unit_label || 'Unit')}</div>
      </div>
      <span class="badge ${p.stock_quantity === 0 ? 'badge-danger' : 'badge-warning'}">
        ${esc(p.stock_quantity)} left (threshold ${esc(p.low_stock_threshold || 10)})
      </span>
    </div>
  `).join('');

  low.forEach((p) => {
    if (!state.lowStockNotified.has(p.product_id)) {
      showToast(`Low stock alert: ${p.product_name} (${p.stock_quantity})`, 'error');
      state.lowStockNotified.add(p.product_id);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════

async function loadProducts() {
  const data = await api('GET', '/products');
  state.products = data.success ? data.data : [];
  renderProductsTable(state.products);
  refreshBasketProductSelect();
}

function renderProductsTable(products) {
  const tbody = document.getElementById('products-tbody');
  const tableHeadAction = tbody.closest('table')?.querySelector('thead th:last-child');
  if (tableHeadAction) tableHeadAction.classList.toggle('is-hidden', !isAdmin());
  if (!products.length) {
    const colspan = isAdmin() ? 9 : 8;
    tbody.innerHTML = `<tr><td colspan="${colspan}"><div class="empty-state"><div class="empty-icon">📦</div><p>No products yet. Add your first product.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td>#${esc(p.product_id)}</td>
      <td><strong>${esc(p.product_name)}</strong></td>
      <td>${esc(p.description || '—')}</td>
      <td>${esc(p.unit_label || 'Unit')}</td>
      <td>${fmtCurrency(p.unit_price)}</td>
      <td><span class="badge ${p.stock_quantity === 0 ? 'badge-danger' : p.stock_quantity <= 10 ? 'badge-warning' : 'badge-success'}">${esc(p.stock_quantity)}</span></td>
      <td>${esc(p.low_stock_threshold ?? 10)}</td>
      <td>${fmtDate(p.last_updated)}</td>
      ${isAdmin() ? `<td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="editProduct(${esc(p.product_id)})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${esc(p.product_id)})">🗑️</button>
      </td>` : ''}
    </tr>
  `).join('');
}

function openProductModal(product = null) {
  document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'Add Product';
  document.getElementById('product-edit-id').value   = product?.product_id || '';
  document.getElementById('product-name').value      = product?.product_name || '';
  document.getElementById('product-desc').value      = product?.description || '';
  document.getElementById('product-price').value     = product?.unit_price || '';
  document.getElementById('product-stock').value     = product?.stock_quantity ?? 0;
  document.getElementById('product-unit').value      = product?.unit_label || 'Unit';
  document.getElementById('product-threshold').value = product?.low_stock_threshold ?? 10;
  openModal('product-modal');
}

async function editProduct(id) {
  const p = state.products.find(x => x.product_id === id);
  if (p) openProductModal(p);
}

async function saveProduct() {
  if (!ensureAdminAction('save products')) return;
  const id    = document.getElementById('product-edit-id').value;
  const body  = {
    product_name:   document.getElementById('product-name').value.trim(),
    description:    document.getElementById('product-desc').value.trim() || null,
    unit_price:     parseFloat(document.getElementById('product-price').value),
    stock_quantity: parseInt(document.getElementById('product-stock').value, 10),
    unit_label:     document.getElementById('product-unit').value,
    low_stock_threshold: parseInt(document.getElementById('product-threshold').value, 10),
  };

  const data = id
    ? await api('PUT', `/products/${id}`, body)
    : await api('POST', '/products', body);

  if (data.success) {
    showToast(data.message, 'success');
    closeModal('product-modal');
    loadProducts();
  } else {
    showToast(data.message || 'Failed.', 'error');
  }
}

async function deleteProduct(id) {
  if (!ensureAdminAction('delete products')) return;
  const ok = await confirmAction('Delete this product? This cannot be undone.', 'Delete Product', 'Delete');
  if (!ok) return;
  const data = await api('DELETE', `/products/${id}`);
  if (data.success) { showToast('Product deleted.', 'success'); loadProducts(); }
  else showToast(data.message || 'Failed.', 'error');
}

// ═══════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════

async function loadCustomers() {
  const data = await api('GET', '/customers');
  state.customers = data.success ? data.data : [];
  renderPartyTable('customers-tbody', state.customers, 'customer');
}

function renderPartyTable(tbodyId, items, type) {
  const tbody   = document.getElementById(tbodyId);
  const tableHeadAction = tbody.closest('table')?.querySelector('thead th:last-child');
  if (tableHeadAction) tableHeadAction.classList.toggle('is-hidden', !isAdmin());
  const idField = `${type}_id`;
  const nameField = `${type}_name`;
  const icon = type === 'customer' ? '👤' : '🏭';
  if (!items.length) {
    const colspan = isAdmin() ? 6 : 5;
    tbody.innerHTML = `<tr><td colspan="${colspan}"><div class="empty-state"><div class="empty-icon">${icon}</div><p>No ${type}s yet.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(p => `
    <tr>
      <td>#${esc(p[idField])}</td>
      <td><strong>${esc(p[nameField])}</strong></td>
      <td>${esc(p.contact_number || '—')}</td>
      <td>${esc(p.address || '—')}</td>
      <td>${fmtDate(p.created_at)}</td>
      ${isAdmin() ? `<td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="edit${cap(type)}(${esc(p[idField])})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="delete${cap(type)}(${esc(p[idField])})">🗑️</button>
      </td>` : ''}
    </tr>
  `).join('');
}

function cap(s) { return s[0].toUpperCase() + s.slice(1); }

function openCustomerModal(c = null) {
  document.getElementById('customer-modal-title').textContent = c ? 'Edit Customer' : 'Add Customer';
  document.getElementById('customer-edit-id').value   = c?.customer_id || '';
  document.getElementById('customer-name').value      = c?.customer_name || '';
  document.getElementById('customer-contact').value   = c?.contact_number || '';
  document.getElementById('customer-address').value   = c?.address || '';
  openModal('customer-modal');
}

function editCustomer(id) {
  const c = state.customers.find(x => x.customer_id === id);
  if (c) openCustomerModal(c);
}

async function saveCustomer() {
  if (!ensureAdminAction('save customers')) return;
  const id   = document.getElementById('customer-edit-id').value;
  const body = {
    customer_name:  document.getElementById('customer-name').value.trim(),
    contact_number: document.getElementById('customer-contact').value.trim() || null,
    address:        document.getElementById('customer-address').value.trim() || null,
  };
  const data = id ? await api('PUT', `/customers/${id}`, body) : await api('POST', '/customers', body);
  if (data.success) { showToast(data.message, 'success'); closeModal('customer-modal'); loadCustomers(); }
  else showToast(data.message || 'Failed.', 'error');
}

async function deleteCustomer(id) {
  if (!ensureAdminAction('delete customers')) return;
  const ok = await confirmAction('Delete this customer record?', 'Delete Customer', 'Delete');
  if (!ok) return;
  const data = await api('DELETE', `/customers/${id}`);
  if (data.success) { showToast('Customer deleted.', 'success'); loadCustomers(); }
  else showToast(data.message || 'Failed.', 'error');
}

// ═══════════════════════════════════════════════════════════════
// SUPPLIERS
// ═══════════════════════════════════════════════════════════════

async function loadSuppliers() {
  const data = await api('GET', '/suppliers');
  state.suppliers = data.success ? data.data : [];
  renderPartyTable('suppliers-tbody', state.suppliers, 'supplier');
}

function openSupplierModal(s = null) {
  document.getElementById('supplier-modal-title').textContent = s ? 'Edit Supplier' : 'Add Supplier';
  document.getElementById('supplier-edit-id').value   = s?.supplier_id || '';
  document.getElementById('supplier-name').value      = s?.supplier_name || '';
  document.getElementById('supplier-contact').value   = s?.contact_number || '';
  document.getElementById('supplier-address').value   = s?.address || '';
  openModal('supplier-modal');
}

function editSupplier(id) {
  const s = state.suppliers.find(x => x.supplier_id === id);
  if (s) openSupplierModal(s);
}

async function saveSupplier() {
  if (!ensureAdminAction('save suppliers')) return;
  const id   = document.getElementById('supplier-edit-id').value;
  const body = {
    supplier_name:  document.getElementById('supplier-name').value.trim(),
    contact_number: document.getElementById('supplier-contact').value.trim() || null,
    address:        document.getElementById('supplier-address').value.trim() || null,
  };
  const data = id ? await api('PUT', `/suppliers/${id}`, body) : await api('POST', '/suppliers', body);
  if (data.success) { showToast(data.message, 'success'); closeModal('supplier-modal'); loadSuppliers(); }
  else showToast(data.message || 'Failed.', 'error');
}

async function deleteSupplier(id) {
  if (!ensureAdminAction('delete suppliers')) return;
  const ok = await confirmAction('Delete this supplier record?', 'Delete Supplier', 'Delete');
  if (!ok) return;
  const data = await api('DELETE', `/suppliers/${id}`);
  if (data.success) { showToast('Supplier deleted.', 'success'); loadSuppliers(); }
  else showToast(data.message || 'Failed.', 'error');
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTIONS (with Basket)
// ═══════════════════════════════════════════════════════════════

function initTransactionForm() {
  refreshBasketProductSelect();
  onTxTypeChange();
}

function refreshBasketProductSelect() {
  const sel = document.getElementById('basket-product');
  sel.innerHTML = '<option value="">Select product...</option>' +
    state.products.map(p =>
      `<option value="${esc(p.product_id)}" data-price="${esc(p.unit_price)}">${esc(p.product_name)} (Stock: ${esc(p.stock_quantity)} ${esc(p.unit_label || 'Unit')})</option>`
    ).join('');
}

function onTxTypeChange() {
  const type = document.getElementById('tx-type').value;
  const refSel = document.getElementById('tx-reference');
  const label  = document.getElementById('ref-label');

  if (type === 'Sale') {
    label.textContent = 'Customer *';
    refSel.innerHTML  = '<option value="">Select customer...</option>' +
      state.customers.map(c =>
        `<option value="${esc(c.customer_id)}">${esc(c.customer_name)}</option>`
      ).join('');
  } else if (type === 'Purchase') {
    label.textContent = 'Supplier *';
    refSel.innerHTML  = '<option value="">Select supplier...</option>' +
      state.suppliers.map(s =>
        `<option value="${esc(s.supplier_id)}">${esc(s.supplier_name)}</option>`
      ).join('');
  } else {
    label.textContent = 'Customer / Supplier *';
    refSel.innerHTML  = '<option value="">Select type first...</option>';
  }
}

function onPaymentTypeChange() {
  const payment = document.getElementById('tx-payment').value;
  const dueDateGroup = document.getElementById('due-date-group');
  dueDateGroup.style.display = payment === 'Baki' ? 'block' : 'none';
  if (payment === 'Baki') {
    // Default due date to 30 days from now
    const d = new Date();
    d.setDate(d.getDate() + 30);
    document.getElementById('tx-due-date').value = d.toISOString().split('T')[0];
  }
}

function addToBasket() {
  const sel   = document.getElementById('basket-product');
  const qty   = parseInt(document.getElementById('basket-qty').value, 10);
  const price = parseFloat(document.getElementById('basket-price').value);

  const productId = parseInt(sel.value, 10);
  if (!productId) { showToast('Select a product first.', 'error'); return; }
  if (!qty || qty <= 0) { showToast('Quantity must be positive.', 'error'); return; }

  const opt     = sel.options[sel.selectedIndex];
  const autoPrice = parseFloat(opt.dataset.price);
  const unitPrice = isNaN(price) ? autoPrice : price;

  const product = state.products.find(p => p.product_id === productId);
  const name    = product ? product.product_name : 'Unknown';

  // Merge if already in basket
  const existing = state.basket.find(b => b.product_id === productId);
  if (existing) {
    existing.quantity   += qty;
    existing.unit_price  = unitPrice;
  } else {
    state.basket.push({ product_id: productId, product_name: name, quantity: qty, unit_price: unitPrice });
  }

  document.getElementById('basket-qty').value   = 1;
  document.getElementById('basket-price').value = '';
  renderBasket();
}

function removeFromBasket(idx) {
  state.basket.splice(idx, 1);
  renderBasket();
}

function renderBasket() {
  const container = document.getElementById('basket-items');
  const totalEl   = document.getElementById('basket-total');

  if (state.basket.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:1rem"><p>Basket is empty</p></div>';
    totalEl.style.display = 'none';
    return;
  }

  let total = 0;
  container.innerHTML = state.basket.map((item, idx) => {
    const lineTotal = item.unit_price * item.quantity;
    total += lineTotal;
    return `
      <div class="basket-item">
        <div>
          <div class="item-name">${esc(item.product_name)}</div>
          <div class="item-price">${esc(item.quantity)} × ${fmtCurrency(item.unit_price)} = ${fmtCurrency(lineTotal)}</div>
        </div>
        <button class="btn btn-danger btn-sm btn-icon" onclick="removeFromBasket(${idx})">✕</button>
      </div>
    `;
  }).join('');

  totalEl.style.display = 'block';
  totalEl.textContent   = `Total: ${fmtCurrency(total)}`;
}

function clearBasket() {
  state.basket = [];
  renderBasket();
}

async function submitTransaction(e) {
  e.preventDefault();
  if (state.basket.length === 0) {
    showToast('Add at least one product to the basket.', 'error'); return;
  }

  const type     = document.getElementById('tx-type').value;
  const payment  = document.getElementById('tx-payment').value;
  const refId    = parseInt(document.getElementById('tx-reference').value, 10);
  const dueDate  = document.getElementById('tx-due-date').value || null;

  if (!type || !payment || !refId) {
    showToast('Fill in all transaction details.', 'error'); return;
  }

  const btn = document.getElementById('tx-submit-btn');
  setButtonBusy(btn, true, 'Submit Transaction', 'Submitting...');

  const body = {
    transaction_type: type,
    payment_type:     payment,
    reference_id:     refId,
    items:            state.basket.map(b => ({
      product_id: b.product_id,
      quantity:   b.quantity,
      unit_price: b.unit_price,
    })),
    due_date: dueDate,
  };

  const data = await api('POST', '/transactions', body);
  setButtonBusy(btn, false, '✅ Submit Transaction');

  if (data.success) {
    const totalAmount = data.data?.total_amount ?? 0;
    showToast(`${type} of ${fmtCurrency(totalAmount)} recorded!`, 'success');
    clearBasket();
    document.getElementById('transaction-form').reset();
    document.getElementById('due-date-group').style.display = 'none';
    // Refresh product cache (stock changed)
    loadProducts();
    loadDashboard();
  } else {
    showToast(data.message || 'Transaction failed.', 'error');
  }
}

// ── Transaction History ────────────────────────────────────────────
async function loadTransactions() {
  const type    = document.getElementById('filter-tx-type')?.value    || '';
  const payment = document.getElementById('filter-tx-payment')?.value || '';
  const from    = document.getElementById('filter-tx-from')?.value    || '';
  const to      = document.getElementById('filter-tx-to')?.value      || '';

  const params = new URLSearchParams();
  if (type)    params.set('type',    type);
  if (payment) params.set('payment', payment);
  if (from)    params.set('from',    from);
  if (to)      params.set('to',      to);
  params.set('limit', '100');

  const tbody = document.getElementById('transactions-tbody');
  tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">⏳</div><p>Loading transactions...</p></div></td></tr>';

  const data = await api('GET', `/transactions?${params.toString()}`);

  if (!data.success || !data.data.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><p>No transactions found.</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = data.data.map(t => `
    <tr>
      <td>#${esc(t.transaction_id)}</td>
      <td><span class="badge ${t.transaction_type === 'Sale' ? 'badge-success' : 'badge-info'}">${esc(t.transaction_type)}</span></td>
      <td><span class="badge ${t.payment_type === 'Cash' ? 'badge-primary' : 'badge-warning'}">${esc(t.payment_type)}</span></td>
      <td><strong>${fmtCurrency(t.total_amount)}</strong></td>
      <td>${esc(t.reference_id || '—')}</td>
      <td>${fmtDate(t.transaction_date)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="downloadInvoice(${esc(t.transaction_id)})">🧾 Invoice</button>
        ${state.user?.role === 'Admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteTransaction(${esc(t.transaction_id)})">🗑️</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function downloadInvoice(id) {
  try {
    const res = await fetch(`/api/transactions/${id}/invoice`, {
      headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
    });

    if (res.status === 401) {
      showToast('Session expired. Please login again.', 'error');
      handleLogout();
      return;
    }

    if (!res.ok) {
      const errorPayload = await res.json().catch(() => null);
      showToast(errorPayload?.message || 'Unable to download invoice.', 'error');
      return;
    }

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename=([^;]+)/i);
    const filename = filenameMatch ? filenameMatch[1].replace(/"/g, '').trim() : `invoice-${id}.pdf`;
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    showToast('Unable to download invoice.', 'error');
  }
}

async function deleteTransaction(id) {
  const ok = await confirmAction('Delete this transaction and rollback stock?', 'Delete Transaction', 'Delete');
  if (!ok) return;
  const data = await api('DELETE', `/transactions/${id}`);
  if (data.success) {
    showToast(data.message || 'Transaction deleted.', 'success');
    loadTransactions();
    loadDashboard();
  } else {
    showToast(data.message || 'Delete failed.', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPENSES
// ═══════════════════════════════════════════════════════════════

async function loadExpenses() {
  const tbody = document.getElementById('expenses-tbody');
  if (!isAdmin()) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🔒</div><p>Admin access required.</p></div></td></tr>';
    return;
  }

  const data  = await api('GET', '/expenses');
  if (!data.success || !data.data.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">💸</div><p>No expenses yet.</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = data.data.map(ex => `
    <tr>
      <td>#${esc(ex.expense_id)}</td>
      <td><span class="badge badge-info">${esc(ex.category || 'General')}</span></td>
      <td>${esc(ex.description)}</td>
      <td>${esc(ex.payment_method || 'Cash')}</td>
      <td><strong>${fmtCurrency(ex.amount)}</strong></td>
      <td>${fmtDate(ex.expense_date)}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteExpense(${esc(ex.expense_id)})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

async function saveExpense() {
  if (!ensureAdminAction('save expenses')) return;
  const body = {
    description: document.getElementById('expense-desc').value.trim(),
    amount:      parseFloat(document.getElementById('expense-amount').value),
    category:    document.getElementById('expense-category').value,
    payment_method: document.getElementById('expense-payment').value,
    vendor_name: document.getElementById('expense-vendor').value.trim() || null,
    reference_no: document.getElementById('expense-reference').value.trim() || null,
    notes: document.getElementById('expense-notes').value.trim() || null,
  };
  const data = await api('POST', '/expenses', body);
  if (data.success) {
    showToast('Expense recorded.', 'success');
    closeModal('expense-modal');
    document.getElementById('expense-desc').value   = '';
    document.getElementById('expense-amount').value = '';
    document.getElementById('expense-vendor').value = '';
    document.getElementById('expense-reference').value = '';
    document.getElementById('expense-notes').value = '';
    loadExpenses();
  } else {
    showToast(data.message || 'Failed.', 'error');
  }
}

async function deleteExpense(id) {
  if (!ensureAdminAction('delete expenses')) return;
  const ok = await confirmAction('Delete this expense entry?', 'Delete Expense', 'Delete');
  if (!ok) return;
  const data = await api('DELETE', `/expenses/${id}`);
  if (data.success) { showToast('Expense deleted.', 'success'); loadExpenses(); }
  else showToast(data.message || 'Failed.', 'error');
}

// ═══════════════════════════════════════════════════════════════
// BAKI LEDGER
// ═══════════════════════════════════════════════════════════════

async function loadBaki() {
  const tbody = document.getElementById('baki-tbody');
  if (!isAdmin()) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🔒</div><p>Admin access required.</p></div></td></tr>';
    return;
  }

  const type   = document.getElementById('filter-baki-type')?.value   || '';
  const status = document.getElementById('filter-baki-status')?.value || '';

  const params = new URLSearchParams();
  if (type)   params.set('type',   type);
  if (status) params.set('status', status);

  const data  = await api('GET', `/baki?${params.toString()}`);

  if (!data.success || !data.data.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🏦</div><p>No baki records found.</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = data.data.map(b => `
    <tr>
      <td>#${esc(b.baki_id)}</td>
      <td><span class="badge ${b.ledger_type === 'Customer_Debit' ? 'badge-warning' : 'badge-info'}">${esc(b.ledger_type.replace('_', ' '))}</span></td>
      <td>${esc(b.entity_name || b.entity_id)}</td>
      <td><strong>${fmtCurrency(b.amount)}</strong></td>
      <td><span class="badge ${b.status === 'Paid' ? 'badge-success' : b.status === 'Partially Paid' ? 'badge-warning' : 'badge-danger'}">${esc(b.status)}</span></td>
      <td>${b.due_date ? fmtDate(b.due_date) : '—'}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openBakiStatusModal(${esc(b.baki_id)}, '${esc(b.status)}')">⚙️ Update</button>
        ${b.ledger_type === 'Customer_Debit' && b.status !== 'Paid' ? `<button class="btn btn-success btn-sm" onclick="openBakiReminder(${esc(b.baki_id)})">📩 Remind</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function openBakiReminder(id) {
  if (!ensureAdminAction('send baki reminders')) return;
  const data = await api('GET', `/baki/reminder/${id}`);
  if (!data.success) {
    showToast(data.message || 'Unable to generate reminder.', 'error');
    return;
  }
  window.open(data.data.whatsapp_url, '_blank');
}

function openBakiStatusModal(id, currentStatus) {
  document.getElementById('baki-edit-id').value = id;
  document.getElementById('baki-status-select').value = currentStatus;
  openModal('baki-modal');
}

async function updateBakiStatus() {
  if (!ensureAdminAction('update baki status')) return;
  const id     = document.getElementById('baki-edit-id').value;
  const status = document.getElementById('baki-status-select').value;
  const data   = await api('PATCH', `/baki/${id}`, { status });
  if (data.success) {
    showToast('Baki status updated.', 'success');
    closeModal('baki-modal');
    loadBaki();
  } else {
    showToast(data.message || 'Failed.', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════════════════

async function loadAllReports() {
  if (!isAdmin()) {
    showToast('Admin access required for reports.', 'warning');
    return;
  }

  const from = document.getElementById('report-from').value || '';
  const to   = document.getElementById('report-to').value   || '';

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to)   params.set('to',   to);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const [plData, cfData, invData, ledData, trendData, pieData, riskData] = await Promise.all([
    api('GET', `/reports/profit-loss${qs}`),
    api('GET', `/reports/cash-flow${qs}`),
    api('GET', `/reports/inventory`),
    api('GET', `/reports/ledger${qs}`),
    api('GET', `/reports/sales-trend`),
    api('GET', `/reports/stock-value-pie`),
    api('GET', `/reports/customer-risk`),
  ]);

  const cashFlowTransactions = cfData.data?.transactions || cfData.transactions || [];
  const cashFlowExpenses = cfData.data?.expenses || cfData.expenses || [];
  const inventorySummary = invData.meta?.summary || invData.summary || {};

  // P&L
  const plEl = document.getElementById('pl-content');
  if (plData.success) {
    const d = plData.data;
    const isProfit = d.net_profit >= 0;
    plEl.innerHTML = `
      <div class="pl-row"><span class="pl-label">Total Sales Revenue</span><span class="pl-value positive">${fmtCurrency(d.total_sales)}</span></div>
      <div class="pl-row"><span class="pl-label">(-) Total Purchases (COGS)</span><span class="pl-value negative">- ${fmtCurrency(d.total_purchases)}</span></div>
      <div class="pl-row"><span class="pl-label">Gross Profit</span><span class="pl-value ${d.gross_profit >= 0 ? 'positive' : 'negative'}">${fmtCurrency(d.gross_profit)}</span></div>
      <div class="pl-row"><span class="pl-label">(-) Total Expenses</span><span class="pl-value negative">- ${fmtCurrency(d.total_expenses)}</span></div>
      <div class="pl-row total"><span class="pl-label">Net Profit / (Loss)</span><span class="pl-value ${isProfit ? 'positive' : 'negative'}">${fmtCurrency(d.net_profit)}</span></div>
    `;
  } else {
    plEl.innerHTML = '<div class="empty-state"><p>Could not load P&L data.</p></div>';
  }

  // Cash Flow
  const cfEl = document.getElementById('cashflow-content');
  if (cfData.success) {
    if (!cashFlowTransactions.length && !cashFlowExpenses.length) {
      cfEl.innerHTML = '<div class="empty-state"><p>No cash flow data in this period.</p></div>';
    } else {
      const rows = cashFlowTransactions.map(r => `
        <div class="pl-row">
          <span class="pl-label">${esc(r.flow_date)} — Cash In</span>
          <span class="pl-value positive">${fmtCurrency(r.cash_in)}</span>
        </div>
        <div class="pl-row">
          <span class="pl-label">${esc(r.flow_date)} — Purchase Out</span>
          <span class="pl-value negative">- ${fmtCurrency(r.cash_out_purchases)}</span>
        </div>
      `).join('');
      const expRows = cashFlowExpenses.map(r => `
        <div class="pl-row">
          <span class="pl-label">${esc(r.flow_date)} — Expenses</span>
          <span class="pl-value negative">- ${fmtCurrency(r.cash_out_expenses)}</span>
        </div>
      `).join('');
      cfEl.innerHTML = rows + expRows;
    }
  }

  // Inventory
  const invEl = document.getElementById('inventory-report-content');
  if (invData.success) {
    const s = {
      total_products: Number(inventorySummary.total_products || 0),
      total_units: Number(inventorySummary.total_units || 0),
      total_stock_value: Number(inventorySummary.total_stock_value || 0),
    };
    invEl.innerHTML = `
      <div class="stats-grid" style="margin-bottom:1rem">
        <div class="stat-card" style="--stat-color:var(--clr-primary)">
          <div class="stat-value">${esc(s.total_products)}</div>
          <div class="stat-label">Total Products</div>
        </div>
        <div class="stat-card" style="--stat-color:var(--clr-accent)">
          <div class="stat-value">${esc(s.total_units)}</div>
          <div class="stat-label">Total Units</div>
        </div>
        <div class="stat-card" style="--stat-color:var(--clr-success)">
          <div class="stat-value">${fmtCurrency(s.total_stock_value)}</div>
          <div class="stat-label">Stock Valuation</div>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Product</th><th>Unit Price</th><th>Stock</th><th>Value</th></tr></thead>
          <tbody>
            ${invData.data.map(p => `
              <tr>
                <td>${esc(p.product_name)}</td>
                <td>${fmtCurrency(p.unit_price)}</td>
                <td><span class="badge ${p.stock_quantity === 0 ? 'badge-danger' : p.stock_quantity <= 10 ? 'badge-warning' : 'badge-success'}">${esc(p.stock_quantity)}</span></td>
                <td>${fmtCurrency(p.stock_value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  // Ledger
  const ledEl = document.getElementById('ledger-content');
  if (ledData.success && ledData.data.length) {
    ledEl.innerHTML = `
      <table>
        <thead><tr><th>TX#</th><th>Type</th><th>Payment</th><th>Amount</th><th>Entity</th><th>Baki Status</th><th>Date</th></tr></thead>
        <tbody>
          ${ledData.data.map(r => `
            <tr>
              <td>#${esc(r.transaction_id)}</td>
              <td><span class="badge ${r.transaction_type === 'Sale' ? 'badge-success' : 'badge-info'}">${esc(r.transaction_type)}</span></td>
              <td><span class="badge ${r.payment_type === 'Cash' ? 'badge-primary' : 'badge-warning'}">${esc(r.payment_type)}</span></td>
              <td><strong>${fmtCurrency(r.total_amount)}</strong></td>
              <td>${esc(r.entity_name || '—')}</td>
              <td>${r.baki_status ? `<span class="badge ${r.baki_status === 'Paid' ? 'badge-success' : r.baki_status === 'Partially Paid' ? 'badge-warning' : 'badge-danger'}">${esc(r.baki_status)}</span>` : '—'}</td>
              <td>${fmtDate(r.transaction_date)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } else {
    ledEl.innerHTML = '<div class="empty-state"><p>No ledger data in this period.</p></div>';
  }

  renderSalesTrendChart(trendData.success ? trendData.data : []);
  renderStockPieChart(pieData.success ? pieData.data : []);
  renderRiskProfile(riskData.success ? riskData.data : []);
}

function renderSalesTrendChart(data) {
  const canvas = document.getElementById('sales-trend-chart');
  if (!canvas) return;
  prepareCanvas(canvas);
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  if (!data.length) {
    drawChartEmptyState(ctx, w, h, 'No sales trend data');
    return;
  }

  const values = data.map((r) => Number(r.total_sales || 0));
  const labels = data.map((r) => String(r.sale_date).slice(5));
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const pad = { top: 22, right: 18, bottom: 30, left: 42 };
  const gw = w - pad.left - pad.right;
  const gh = h - pad.top - pad.bottom;

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, h - pad.bottom);
  ctx.lineTo(w - pad.right, h - pad.bottom);
  ctx.stroke();

  const range = maxVal - minVal || 1;
  const points = values.map((v, i) => {
    const x = pad.left + (i * gw) / Math.max(values.length - 1, 1);
    const y = pad.top + (1 - (v - minVal) / range) * gh;
    return { x, y, v };
  });

  const area = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
  area.addColorStop(0, 'rgba(30,64,175,0.28)');
  area.addColorStop(1, 'rgba(30,64,175,0.02)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, h - pad.bottom);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, h - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = area;
  ctx.fill();

  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = '#1E40AF';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#1E40AF';
  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#64748B';
  ctx.font = '11px Manrope';
  ctx.textAlign = 'center';
  const labelStep = Math.ceil(labels.length / 4);
  labels.forEach((lbl, i) => {
    if (i % labelStep === 0 || i === labels.length - 1) {
      ctx.fillText(lbl, points[i].x, h - 10);
    }
  });

  ctx.textAlign = 'right';
  ctx.fillText(fmtCurrency(maxVal), pad.left - 6, pad.top + 6);
  ctx.fillText(fmtCurrency(minVal), pad.left - 6, h - pad.bottom + 4);
}

function renderStockPieChart(data) {
  const canvas = document.getElementById('stock-value-chart');
  if (!canvas) return;
  prepareCanvas(canvas);
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  if (!data.length) {
    drawChartEmptyState(ctx, w, h, 'No stock value data');
    return;
  }

  const values = data.map((r) => Number(r.stock_value || 0));
  const labels = data.map((r) => r.product_name);
  const total = values.reduce((sum, v) => sum + v, 0);
  if (!total) {
    drawChartEmptyState(ctx, w, h, 'No stock value data');
    return;
  }

  const colors = ['#1E40AF', '#10B981', '#F59E0B', '#0EA5E9', '#EF4444', '#14B8A6', '#F97316', '#A855F7'];
  const cx = 68;
  const cy = h / 2;
  const radius = 56;
  const innerRadius = 28;

  let start = -Math.PI / 2;
  values.forEach((v, i) => {
    const angle = (v / total) * Math.PI * 2;
    const end = start + angle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    start = end;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  ctx.fillStyle = '#1E293B';
  ctx.font = '700 12px Manrope';
  ctx.textAlign = 'center';
  ctx.fillText('Stock', cx, cy - 2);
  ctx.fillStyle = '#64748B';
  ctx.font = '10px Manrope';
  ctx.fillText('Value', cx, cy + 12);

  const legendX = 146;
  let legendY = 22;
  ctx.textAlign = 'left';
  labels.slice(0, 5).forEach((label, i) => {
    const pct = ((values[i] / total) * 100).toFixed(1);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(legendX, legendY - 8, 10, 10);
    ctx.fillStyle = '#334155';
    ctx.font = '10px Manrope';
    const safeLabel = String(label).length > 16 ? `${String(label).slice(0, 16)}...` : label;
    ctx.fillText(`${safeLabel} (${pct}%)`, legendX + 16, legendY);
    legendY += 18;
  });
}

function drawChartEmptyState(ctx, width, height, text) {
  ctx.fillStyle = '#64748B';
  ctx.font = '12px Manrope';
  ctx.textAlign = 'center';
  ctx.fillText(text, width / 2, height / 2);
}

function prepareCanvas(canvas) {
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 180;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

function renderRiskProfile(rows) {
  const host = document.getElementById('risk-profile-content');
  if (!host) return;
  if (!rows.length) {
    host.innerHTML = '<div class="empty-state"><p>No credit risk records.</p></div>';
    return;
  }

  host.innerHTML = `
    <table>
      <thead><tr><th>Customer</th><th>Outstanding</th><th>Max Age (days)</th><th>Open Entries</th><th>Risk Score</th></tr></thead>
      <tbody>
        ${rows.map((r) => `
          <tr>
            <td>${esc(r.customer_name || r.entity_name)}</td>
            <td>${fmtCurrency(r.total_outstanding)}</td>
            <td>${esc(r.max_age_days)}</td>
            <td>${esc(r.open_entries)}</td>
            <td><span class="badge ${Number(r.risk_score) > 5000 ? 'badge-danger' : Number(r.risk_score) > 2000 ? 'badge-warning' : 'badge-success'}">${esc(r.risk_score)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function switchLanguage(lang) {
  state.lang = lang;
  localStorage.setItem('sk_lang', lang);
  if (window.SK_I18N && typeof window.SK_I18N.applyLanguage === 'function') {
    window.SK_I18N.applyLanguage(lang);
  }
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

(function init() {
  const savedToken = localStorage.getItem('sk_token');
  const savedUser  = localStorage.getItem('sk_user');

  window.addEventListener('hashchange', () => {
    if (!state.token) return;
    routeToSection(getSectionFromHash(), true);
  });

  window.addEventListener('popstate', () => {
    if (!state.token) return;
    routeToSection(getSectionFromHash(), true);
  });

  if (savedToken && savedUser) {
    try {
      state.token = savedToken;
      state.user  = JSON.parse(savedUser);
      bootApp();
    } catch {
      handleLogout();
    }
  }
})();
