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

function fmtCurrency(n) {
  return 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Toast ─────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
    <span>${esc(message)}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ── API helper ────────────────────────────────────────────────────
async function api(method, path, body) {
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
  return data;
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

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';

  const data = await api('POST', '/auth/login', { username, password });
  btn.disabled = false;
  btn.innerHTML = '<span>Login</span>';

  if (data.success) {
    state.token = data.token;
    state.user  = data.user;
    localStorage.setItem('sk_token', data.token);
    localStorage.setItem('sk_user',  JSON.stringify(data.user));
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

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div>';

  const data = await api('POST', '/auth/signup', { username, password });
  btn.disabled = false;
  btn.innerHTML = '<span>Create Account</span>';

  if (data.success) {
    showToast('Account created! Please login.', 'success');
    switchAuthTab('login');
  } else {
    showToast(data.message || 'Signup failed.', 'error');
  }
}

function handleLogout() {
  state.token   = null;
  state.user    = null;
  state.basket  = [];
  localStorage.removeItem('sk_token');
  localStorage.removeItem('sk_user');
  document.getElementById('app').style.display       = 'none';
  document.getElementById('auth-page').style.display = 'flex';
  document.getElementById('login-username').value    = '';
  document.getElementById('login-password').value    = '';
  switchAuthTab('login');
}

// ── Bootstrap session ─────────────────────────────────────────────
function bootApp() {
  document.getElementById('auth-page').style.display = 'none';
  document.getElementById('app').style.display       = 'flex';

  const name = state.user?.username || 'User';
  document.getElementById('user-display-name').textContent = name;
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();

  // Preload caches
  loadProducts();
  loadCustomers();
  loadSuppliers();
  loadDashboard();
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

function navigateTo(section, el) {
  state.currentSection = section;

  // Hide all, show target
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${section}`)?.classList.add('active');

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el?.classList.add('active');

  // Update topbar title
  document.getElementById('topbar-title').textContent = sectionTitles[section] || section;

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

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════

async function loadDashboard() {
  const [plData, txData, bakiSummary] = await Promise.all([
    api('GET', '/reports/profit-loss'),
    api('GET', '/transactions?limit=10'),
    api('GET', '/baki/summary'),
  ]);

  // Stats
  if (plData.success) {
    const d = plData.data;
    document.getElementById('stat-revenue').textContent    = fmtCurrency(d.total_sales);
    document.getElementById('stat-net-profit').textContent = fmtCurrency(d.net_profit);
  }

  // Products count & low stock
  const prodData = await api('GET', '/products');
  if (prodData.success) {
    document.getElementById('stat-products').textContent = prodData.data.length;
    state.products = prodData.data;
    renderLowStock(prodData.data);
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
  const LOW = 10;
  const low = products.filter(p => p.stock_quantity <= LOW);
  const el  = document.getElementById('low-stock-list');
  if (low.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>All stock levels healthy</p></div>';
    return;
  }
  el.innerHTML = low.map(p => `
    <div class="basket-item">
      <div>
        <div class="item-name">${esc(p.product_name)}</div>
        <div class="item-price">${esc(p.unit_price)} / unit</div>
      </div>
      <span class="badge ${p.stock_quantity === 0 ? 'badge-danger' : 'badge-warning'}">
        ${esc(p.stock_quantity)} left
      </span>
    </div>
  `).join('');
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
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><p>No products yet. Add your first product.</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td>#${esc(p.product_id)}</td>
      <td><strong>${esc(p.product_name)}</strong></td>
      <td>${esc(p.description || '—')}</td>
      <td>${fmtCurrency(p.unit_price)}</td>
      <td><span class="badge ${p.stock_quantity === 0 ? 'badge-danger' : p.stock_quantity <= 10 ? 'badge-warning' : 'badge-success'}">${esc(p.stock_quantity)}</span></td>
      <td>${fmtDate(p.last_updated)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="editProduct(${esc(p.product_id)})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${esc(p.product_id)})">🗑️</button>
      </td>
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
  openModal('product-modal');
}

async function editProduct(id) {
  const p = state.products.find(x => x.product_id === id);
  if (p) openProductModal(p);
}

async function saveProduct() {
  const id    = document.getElementById('product-edit-id').value;
  const body  = {
    product_name:   document.getElementById('product-name').value.trim(),
    description:    document.getElementById('product-desc').value.trim() || null,
    unit_price:     parseFloat(document.getElementById('product-price').value),
    stock_quantity: parseInt(document.getElementById('product-stock').value, 10),
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
  if (!confirm('Delete this product? This cannot be undone.')) return;
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
  const idField = `${type}_id`;
  const nameField = `${type}_name`;
  const icon = type === 'customer' ? '👤' : '🏭';
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">${icon}</div><p>No ${type}s yet.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(p => `
    <tr>
      <td>#${esc(p[idField])}</td>
      <td><strong>${esc(p[nameField])}</strong></td>
      <td>${esc(p.contact_number || '—')}</td>
      <td>${esc(p.address || '—')}</td>
      <td>${fmtDate(p.created_at)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="edit${cap(type)}(${esc(p[idField])})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="delete${cap(type)}(${esc(p[idField])})">🗑️</button>
      </td>
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
  if (!confirm('Delete this customer?')) return;
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
  if (!confirm('Delete this supplier?')) return;
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
      `<option value="${esc(p.product_id)}" data-price="${esc(p.unit_price)}">${esc(p.product_name)} (Stock: ${esc(p.stock_quantity)})</option>`
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
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Processing...';

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
  btn.disabled = false;
  btn.innerHTML = '✅ Submit Transaction';

  if (data.success) {
    showToast(`${type} of ${fmtCurrency(data.total_amount)} recorded!`, 'success');
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

  const data = await api('GET', `/transactions?${params.toString()}`);
  const tbody = document.getElementById('transactions-tbody');

  if (!data.success || !data.data.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📋</div><p>No transactions found.</p></div></td></tr>';
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
    </tr>
  `).join('');
}

// ═══════════════════════════════════════════════════════════════
// EXPENSES
// ═══════════════════════════════════════════════════════════════

async function loadExpenses() {
  const data  = await api('GET', '/expenses');
  const tbody = document.getElementById('expenses-tbody');
  if (!data.success || !data.data.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💸</div><p>No expenses yet.</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = data.data.map(ex => `
    <tr>
      <td>#${esc(ex.expense_id)}</td>
      <td>${esc(ex.description)}</td>
      <td><strong>${fmtCurrency(ex.amount)}</strong></td>
      <td>${fmtDate(ex.expense_date)}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteExpense(${esc(ex.expense_id)})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

async function saveExpense() {
  const body = {
    description: document.getElementById('expense-desc').value.trim(),
    amount:      parseFloat(document.getElementById('expense-amount').value),
  };
  const data = await api('POST', '/expenses', body);
  if (data.success) {
    showToast('Expense recorded.', 'success');
    closeModal('expense-modal');
    document.getElementById('expense-desc').value   = '';
    document.getElementById('expense-amount').value = '';
    loadExpenses();
  } else {
    showToast(data.message || 'Failed.', 'error');
  }
}

async function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  const data = await api('DELETE', `/expenses/${id}`);
  if (data.success) { showToast('Expense deleted.', 'success'); loadExpenses(); }
  else showToast(data.message || 'Failed.', 'error');
}

// ═══════════════════════════════════════════════════════════════
// BAKI LEDGER
// ═══════════════════════════════════════════════════════════════

async function loadBaki() {
  const type   = document.getElementById('filter-baki-type')?.value   || '';
  const status = document.getElementById('filter-baki-status')?.value || '';

  const params = new URLSearchParams();
  if (type)   params.set('type',   type);
  if (status) params.set('status', status);

  const data  = await api('GET', `/baki?${params.toString()}`);
  const tbody = document.getElementById('baki-tbody');

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
      </td>
    </tr>
  `).join('');
}

function openBakiStatusModal(id, currentStatus) {
  document.getElementById('baki-edit-id').value = id;
  document.getElementById('baki-status-select').value = currentStatus;
  openModal('baki-modal');
}

async function updateBakiStatus() {
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
  const from = document.getElementById('report-from').value || '';
  const to   = document.getElementById('report-to').value   || '';

  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to)   params.set('to',   to);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const [plData, cfData, invData, ledData] = await Promise.all([
    api('GET', `/reports/profit-loss${qs}`),
    api('GET', `/reports/cash-flow${qs}`),
    api('GET', `/reports/inventory`),
    api('GET', `/reports/ledger${qs}`),
  ]);

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
    if (!cfData.transactions.length && !cfData.expenses.length) {
      cfEl.innerHTML = '<div class="empty-state"><p>No cash flow data in this period.</p></div>';
    } else {
      const rows = cfData.transactions.map(r => `
        <div class="pl-row">
          <span class="pl-label">${esc(r.flow_date)} — Cash In</span>
          <span class="pl-value positive">${fmtCurrency(r.cash_in)}</span>
        </div>
        <div class="pl-row">
          <span class="pl-label">${esc(r.flow_date)} — Purchase Out</span>
          <span class="pl-value negative">- ${fmtCurrency(r.cash_out_purchases)}</span>
        </div>
      `).join('');
      const expRows = cfData.expenses.map(r => `
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
    const s = invData.summary;
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
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════

(function init() {
  const savedToken = localStorage.getItem('sk_token');
  const savedUser  = localStorage.getItem('sk_user');

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
