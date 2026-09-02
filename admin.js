/**
 * ═══════════════════════════════════════════════════════════════
 * PEPTIA ADMIN — AUTH MODULE
 * ═══════════════════════════════════════════════════════════════
 * Client-side login barrier using SHA-256 via Web Crypto API.
 * No plaintext password is stored anywhere in this file.
 *
 * ── HOW TO CHANGE CREDENTIALS ─────────────────────────────────
 * 1. Open your browser DevTools console (F12).
 * 2. Run this snippet to generate a new hash:
 *
 *    (async () => {
 *      const buf = await crypto.subtle.digest('SHA-256',
 *        new TextEncoder().encode('your-new-password'));
 *      console.log([...new Uint8Array(buf)]
 *        .map(b => b.toString(16).padStart(2,'0')).join(''));
 *    })();
 *
 * 3. Copy the printed hash into ADMIN_AUTH.passwordHash below.
 * 4. Update ADMIN_AUTH.username as needed.
 *
 * ── DEFAULT CREDENTIALS ───────────────────────────────────────
 *   Username : admin
 *   Password : admin
 *   ⚠️  CHANGE BEFORE PRODUCTION USE.
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  /* ━━━━ 1. CONFIGURATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Replace values below to set your own credentials.
     NEVER store the plaintext password here.
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const ADMIN_AUTH = {
    username:     'admin',
    // SHA-256 hash of "admin" — generated via Web Crypto API
    passwordHash: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'
  };

  const SESSION_KEY = 'peptia_admin_auth'; // sessionStorage key

  /* ━━━━ 2. DOM REFS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const loginScreen  = document.getElementById('login-screen');
  const loginCard    = document.getElementById('login-card');
  const loginForm    = document.getElementById('login-form');
  const loginUser    = document.getElementById('login-username');
  const loginPass    = document.getElementById('login-password');
  const loginError   = document.getElementById('login-error');
  const loginBtnEl   = document.getElementById('login-btn');
  const loginBtnText = document.getElementById('login-btn-text');
  const loginSpinner = document.getElementById('login-spinner');
  const btnLogout    = document.getElementById('btn-logout');
  const eyeToggle    = document.getElementById('login-eye-toggle');
  const eyeShow      = document.getElementById('eye-icon-show');
  const eyeHide      = document.getElementById('eye-icon-hide');

  /* ━━━━ 3. SHA-256 via Web Crypto API ━━━━━━━━━━━━━━━ */
  async function sha256(str) {
    const encoded = new TextEncoder().encode(str);
    const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
    return [...new Uint8Array(hashBuf)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /* ━━━━ 4. SESSION HELPERS ━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function isAuthenticated() {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  }

  function grantAccess() {
    sessionStorage.setItem(SESSION_KEY, '1');
    showDashboard();
  }

  function revokeAccess() {
    sessionStorage.removeItem(SESSION_KEY);
    showLoginScreen();
  }

  /* ━━━━ 5. UI: SHOW / HIDE ━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function showLoginScreen() {
    document.body.classList.add('auth-pending');
    loginScreen.setAttribute('aria-hidden', 'false');

    /* Reset card animation so it plays again on logout → login */
    if (loginCard) {
      loginCard.style.animation = 'none';
      void loginCard.offsetHeight; // force reflow
      loginCard.style.animation  = '';
    }

    clearError();
    loginUser.value = '';
    loginPass.value = '';
    setLoading(false);
    setTimeout(() => loginUser.focus(), 60);
  }

  function showDashboard() {
    document.body.classList.remove('auth-pending');
    loginScreen.setAttribute('aria-hidden', 'true');
  }

  /* ━━━━ 6. LOGIN FORM HANDLER ━━━━━━━━━━━━━━━━━━━━━━ */
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const user = (loginUser.value || '').trim();
      const pass  = loginPass.value || '';

      if (!user || !pass) {
        showError('Please enter your username and password.');
        return;
      }

      setLoading(true);
      clearError();

      try {
        const hashed = await sha256(pass);

        /* Read credentials from localStorage (updated via Security Settings)
           with fallback to the hardcoded ADMIN_AUTH defaults.              */
        const activeUser = localStorage.getItem('adminUsername')     || ADMIN_AUTH.username;
        const activeHash = localStorage.getItem('adminPasswordHash') || ADMIN_AUTH.passwordHash;

        /* Timing-safe: always check both fields regardless of which is wrong */
        const usernameOk = user === activeUser;
        const passwordOk = hashed === activeHash;

        if (usernameOk && passwordOk) {
          grantAccess();
        } else {
          setLoading(false);
          showError('Invalid username or password.');
          shakeCard();
          loginPass.value = '';
          loginPass.focus();
        }
      } catch (err) {
        setLoading(false);
        showError('Authentication error. Please try again.');
        console.error('[PEPTIA Auth]', err);
      }
    });
  }

  /* ━━━━ 7. LOGOUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (btnLogout) {
    btnLogout.addEventListener('click', () => revokeAccess());
  }

  /* ━━━━ 8. PASSWORD VISIBILITY TOGGLE ━━━━━━━━━━━━━━ */
  if (eyeToggle) {
    eyeToggle.addEventListener('click', () => {
      const isHidden = loginPass.type === 'password';
      loginPass.type  = isHidden ? 'text' : 'password';
      eyeShow.hidden  = isHidden;
      eyeHide.hidden  = !isHidden;
    });
  }

  /* ━━━━ 9. UI HELPERS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function setLoading(on) {
    if (!loginBtnEl) return;
    loginBtnEl.disabled = on;
    if (loginBtnText) loginBtnText.textContent = on ? 'VERIFYING...' : 'LOGIN';
    if (loginSpinner) loginSpinner.hidden = !on;
  }

  function showError(msg) {
    if (!loginError) return;
    loginError.textContent = msg;
    loginError.classList.add('is-visible');
  }

  function clearError() {
    if (!loginError) return;
    loginError.textContent = '';
    loginError.classList.remove('is-visible');
  }

  function shakeCard() {
    if (!loginCard) return;
    loginCard.classList.remove('shake');
    void loginCard.offsetWidth; // force reflow
    loginCard.classList.add('shake');
    loginCard.addEventListener('animationend', () => loginCard.classList.remove('shake'), { once: true });
  }

  /* ━━━━ 10. INIT: CHECK SESSION ON LOAD ━━━━━━━━━━━━ */
  if (isAuthenticated()) {
    showDashboard();
  } else {
    showLoginScreen();
  }

})();

/**
 * PEPTIA Admin Dashboard Logic
 * Uses localStorage as the primary data source to sync with the main website.
 */

(function () {
  'use strict';

  /* ━━━━ 1. CONFIG & STATE ━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const STORE_KEY = Peptia.constants.STORE_KEY || 'peptia_products';
  const DATA_URL  = Peptia.constants.DATA_URL || 'retatrutide_products.json'; // relative to site root
  let products = [];
  let currentEditId = null;

  /* ━━━━ 2. DOM REFS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const tbody = document.getElementById('products-tbody');
  const searchInput = document.getElementById('search-input');
  const filterStock = document.getElementById('filter-stock');
  
  const statTotal = document.getElementById('stat-total');
  const statIn = document.getElementById('stat-instock');
  const statOut = document.getElementById('stat-outstock');

  const modal = document.getElementById('modal-product');
  const form = document.getElementById('product-form');
  const modalTitle = document.getElementById('modal-title');
  const btnAdd = document.getElementById('btn-add-product');
  const btnClose = document.getElementById('btn-close-modal');
  const btnCancel = document.getElementById('btn-cancel-modal');
  const btnSaveModal = document.getElementById('btn-save-product');

  const modalDelete = document.getElementById('modal-delete');
  const btnCloseDelete = document.getElementById('btn-close-delete');
  const btnCancelDelete = document.getElementById('btn-cancel-delete');
  const btnConfirmDelete = document.getElementById('btn-confirm-delete');
  let currentDeleteId = null;

  const btnExport = document.getElementById('btn-export');
  const inputImport = document.getElementById('import-json');

  const fId = document.getElementById('p-id');
  const fTitle = document.getElementById('p-title');
  const fDesc = document.getElementById('p-description');
  const fCat = document.getElementById('p-category');
  const fPrice = document.getElementById('p-price');
  const fOldPrice = document.getElementById('p-oldprice');
  const fStock = document.getElementById('p-stock');
  const fDiscount = document.getElementById('p-discount');
  const fImage = document.getElementById('p-image');
  const fImageB64 = document.getElementById('p-image-b64');
  const imgPreview = document.getElementById('image-preview');

  /* ━━━━ 3. UTILS & TOASTS ━━━━━━━━━━━━━━━━━━━━━━━━ */
  // Removed showToast, toSAR, toAED (using Peptia core)

  /* ━━━━ 4. DATA INIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  async function initData() {
    try {
      products = await Peptia.loadProducts();
      render();
    } catch (e) {
      Peptia.showToast('Error loading initial data', 'error');
    }
  }

  function saveData() {
    Peptia.saveProducts(products);
    updateStats();
  }

  /* ━━━━ 5. RENDER TABLE ━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function render() {
    const q = searchInput.value.toLowerCase().trim();
    const stockFilter = filterStock.value;

    const filtered = products.filter(p => {
      const matchSearch = p.title.toLowerCase().includes(q) || p.product_id.toLowerCase().includes(q);
      const matchStock = stockFilter === 'all' || p.availability === stockFilter;
      return matchSearch && matchStock;
    });

    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);padding:2rem;">No products found.</td></tr>`;
    }

    filtered.forEach(p => {
      const isOk = p.availability === 'متوفر';
      const tr = document.createElement('tr');
      
      // Fallback image handling
      const imgSrc = p.image_url || 'https://via.placeholder.com/60?text=No+Image';

      tr.innerHTML = `
        <td class="td-img"><img src="${imgSrc}" alt="Img"></td>
        <td>
          <div class="td-name">${p.title.split('|')[0].split('–')[0]}</div>
          <span class="td-id">#${p.product_id}</span>
        </td>
        <td><span class="td-cat">${p.category || 'N/A'}</span></td>
        <td class="td-price">${Peptia.toAED(p.current_price_sar).toLocaleString()}</td>
        <td>
          <span class="${isOk ? 'td-stock-in' : 'td-stock-out'}">
            ${isOk ? 'IN STOCK' : 'OUT OF STOCK'}
          </span>
        </td>
        <td class="td-actions">
          <button class="btn-action-edit btn-edit" data-id="${p.product_id}" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> EDIT
          </button>
          <button class="btn-action-delete btn-delete" data-id="${p.product_id}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg> DELETE
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    updateStats();
  }

  function updateStats() {
    statTotal.textContent = products.length;
    statIn.textContent = products.filter(p => p.availability === 'متوفر').length;
    statOut.textContent = products.filter(p => p.availability !== 'متوفر').length;
  }

  /* ━━━━ 6. MODAL & FORMS ━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function openModal(editId = null) {
    currentEditId = editId;
    modalTitle.textContent = editId ? 'Edit Product' : 'Add Product';
    btnSaveModal.textContent = editId ? 'SAVE CHANGES' : 'ADD PRODUCT';
    
    if (editId) {
      const p = products.find(x => String(x.product_id) === String(editId));
      if (p) {
        fId.value = p.product_id;
        fTitle.value = p.title;
        fDesc.value = p.description || '';
        fCat.value = p.category || '';
        fPrice.value = p.current_price_sar ? Peptia.toAED(p.current_price_sar) : '';
        fOldPrice.value = p.old_price_sar ? Peptia.toAED(p.old_price_sar) : '';
        fStock.value = p.availability === 'متوفر' ? 'متوفر' : 'غير متوفر';
        fDiscount.value = p.discount_percent || '';
        fImageB64.value = p.image_url || '';
        imgPreview.innerHTML = p.image_url ? `<img src="${p.image_url}" />` : `<span>No image</span>`;
      }
    } else {
      form.reset();
      fId.value = 'PID-' + Math.floor(Math.random() * 1000000);
      fImageB64.value = '';
      imgPreview.innerHTML = `<span>No image selected</span>`;
      fStock.value = 'متوفر';
      fCat.value = 'Retatrutide ريتاتويد';
      fDesc.value = '';
    }

    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    form.reset();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const id = fId.value.trim();
    if (!id) return Peptia.showToast('Product ID is required', 'error');

    const newProd = {
      product_id: id,
      title: fTitle.value.trim(),
      description: fDesc.value.trim(),
      category: fCat.value.trim(),
      current_price_sar: Peptia.toSAR(fPrice.value.trim()),
      old_price_sar: Peptia.toSAR(fOldPrice.value.trim()),
      discount_percent: fDiscount.value.trim() ? Number(fDiscount.value.trim()) : null,
      availability: fStock.value,
      image_url: fImageB64.value,
      local_image_file: "", // Prevent undefined image errors
      card_text: fTitle.value.trim() // Simplified card text
    };

    if (currentEditId) {
      const idx = products.findIndex(x => String(x.product_id) === String(currentEditId));
      if (idx !== -1) products[idx] = { ...products[idx], ...newProd };
      Peptia.showToast('Product updated successfully');
    } else {
      if (products.find(x => String(x.product_id) === String(id))) return Peptia.showToast('Product ID already exists', 'error');
      products.unshift(newProd); // Add to top
      Peptia.showToast('Product added successfully');
    }

    saveData();
    render();
    closeModal();
  });

  /* ━━━━ 7. FILE TO BASE64 ━━━━━━━━━━━━━━━━━━━━━━━━ */
  fImage.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check size (< 2MB to prevent quota issues ideally)
    if (file.size > 2 * 1024 * 1024) {
      Peptia.showToast('Image is very large. Consider compressing to save LocalStorage quota.', 'error');
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      fImageB64.value = ev.target.result;
      imgPreview.innerHTML = `<img src="${ev.target.result}" />`;
    };
    reader.readAsDataURL(file);
  });

  /* ━━━━ 8. DELETE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  tbody.addEventListener('click', (e) => {
    const btnDel = e.target.closest('.btn-delete');
    const btnEdit = e.target.closest('.btn-edit');

    if (btnDel) {
      currentDeleteId = btnDel.dataset.id;
      modalDelete.setAttribute('aria-hidden', 'false');
    }

    if (btnEdit) {
      openModal(btnEdit.dataset.id);
    }
  });

  /* ━━━━ 9. EXPORT & IMPORT ━━━━━━━━━━━━━━━━━━━━━━━ */
  btnExport.addEventListener('click', () => {
    const wrapper = {
      source: "Admin Dashboard Export",
      currency: "SAR",
      product_count: products.length,
      products: products
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(wrapper, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "retatrutide_products.json");
    dlAnchorElem.click();
    Peptia.showToast('JSON Exported Successfully');
  });

  inputImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        if (json.products && Array.isArray(json.products)) {
          products = json.products;
          saveData();
          render();
          Peptia.showToast('JSON Imported Successfully');
        } else {
          throw new Error('Invalid JSON structure');
        }
      } catch (err) {
        Peptia.showToast('Failed to import JSON', 'error');
      }
      inputImport.value = ''; // Reset
    };
    reader.readAsText(file);
  });

  /* ━━━━ 10. EVENTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  btnAdd.addEventListener('click', () => openModal(null));
  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
  
  function closeDeleteModal() {
    modalDelete.setAttribute('aria-hidden', 'true');
    currentDeleteId = null;
  }
  btnCloseDelete.addEventListener('click', closeDeleteModal);
  btnCancelDelete.addEventListener('click', closeDeleteModal);
  btnConfirmDelete.addEventListener('click', () => {
    if (currentDeleteId) {
      products = products.filter(p => String(p.product_id) !== String(currentDeleteId));
      saveData();
      render();
      Peptia.showToast('Product deleted successfully');
      closeDeleteModal();
    }
  });

  searchInput.addEventListener('input', render);
  filterStock.addEventListener('change', render);

  /* INIT */
  initData();

})();

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   WHATSAPP SETTINGS MODULE
   Completely isolated — does not touch any product logic.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
(function () {
  'use strict';

  const WA_KEY      = 'whatsappNumber';                   // must match shared.js & index.html
  const WA_DEFAULT  = Peptia.constants.WA_DEFAULT;         // single source of truth — shared.js

  /* ── DOM refs ── */
  const navProductsLink  = document.getElementById('nav-products-link');
  const navSettingsLink  = document.getElementById('nav-settings-link');
  const productsPanel    = document.querySelector('main.main:not(#settings-panel)');
  const settingsPanel    = document.getElementById('settings-panel');
  const waInput          = document.getElementById('wa-number-input');
  const btnSaveWA        = document.getElementById('btn-save-wa');
  const waCurrentDisplay = document.getElementById('wa-current-display');
  const waTestLink       = document.getElementById('wa-test-link');

  if (!navSettingsLink || !settingsPanel || !waInput) return; // guard

  /* ── Normalize: strip everything except digits ── */
  function normalizeWA(raw) {
    return raw.replace(/[\s+\-().]/g, '');
  }

  /* ── Validate: must be 7–15 digits ── */
  function validateWA(num) {
    return /^\d{7,15}$/.test(num);
  }

  /* ── Update live preview ── */
  function updatePreview(num) {
    if (waCurrentDisplay) waCurrentDisplay.textContent = num;
    if (waTestLink) {
      waTestLink.href = `https://wa.me/${num}`;
    }
  }

  /* ── Load current value into the input ── */
  function loadCurrentNumber() {
    const current = localStorage.getItem(WA_KEY) || WA_DEFAULT;
    waInput.value = current;
    updatePreview(current);
  }

  /* ── Save handler ── */
  function saveWANumber() {
    const raw        = waInput.value.trim();
    const normalized = normalizeWA(raw);

    if (!normalized) {
      Peptia.showToast('Please enter a WhatsApp number.', 'error');
      waInput.focus();
      return;
    }

    if (!validateWA(normalized)) {
      Peptia.showToast('Invalid number — must be 7–15 digits with country code (no + or spaces).', 'error');
      waInput.focus();
      return;
    }

    localStorage.setItem(WA_KEY, normalized);
    waInput.value = normalized;
    updatePreview(normalized);
    Peptia.showToast('WhatsApp number updated successfully ✓');

    /* Animate the save button briefly */
    btnSaveWA.disabled = true;
    btnSaveWA.style.background = '#10b981';
    setTimeout(() => {
      btnSaveWA.disabled = false;
      btnSaveWA.style.background = '';
    }, 1500);
  }

  /* ── Toast reuse ── */
  // Removed showWAToast (using Peptia core)

  /* ── Tab switching ── */
  function showProducts() {
    if (productsPanel) productsPanel.style.display = '';
    settingsPanel.style.display = 'none';
    navProductsLink.classList.add('active');
    navSettingsLink.classList.remove('active');
  }

  function showSettings() {
    if (productsPanel) productsPanel.style.display = 'none';
    settingsPanel.style.display = '';
    navSettingsLink.classList.add('active');
    navProductsLink.classList.remove('active');
    loadCurrentNumber();
  }

  navProductsLink.addEventListener('click', (e) => { e.preventDefault(); showProducts(); });
  navSettingsLink.addEventListener('click', (e) => { e.preventDefault(); showSettings(); });

  /* ── Save button ── */
  btnSaveWA.addEventListener('click', saveWANumber);

  /* ── Allow pressing Enter in the input ── */
  waInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveWANumber(); }
  });

  /* ── Init: pre-fill without switching panel ── */
  loadCurrentNumber();

})();

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ADMIN SECURITY SETTINGS MODULE
   Completely isolated — does not touch product or WA logic.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
(function () {
  'use strict';

  /* ── Fallback defaults (must match ADMIN_AUTH in auth module) ── */
  const DEFAULT_USERNAME = 'admin';
  const LS_USER_KEY      = 'adminUsername';
  const LS_HASH_KEY      = 'adminPasswordHash';
  const MIN_PASS_LEN     = 8;

  /* ── DOM refs ── */
  const secUsernameInput   = document.getElementById('sec-username');
  const secPasswordInput   = document.getElementById('sec-password');
  const secConfirmInput    = document.getElementById('sec-confirm');
  const btnSaveCreds       = document.getElementById('btn-save-credentials');
  const secCurrentDisplay  = document.getElementById('sec-current-username');
  const secEyeToggle       = document.getElementById('sec-eye-toggle');
  const secEyeShow         = document.getElementById('sec-eye-show');
  const secEyeHide         = document.getElementById('sec-eye-hide');

  if (!btnSaveCreds || !secUsernameInput) return; // guard

  /* ── SHA-256 helper (same implementation as auth module) ── */
  async function sha256(str) {
    const encoded = new TextEncoder().encode(str);
    const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
    return [...new Uint8Array(hashBuf)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /* ── Read active username (from LS or fallback) ── */
  function getActiveUsername() {
    return localStorage.getItem(LS_USER_KEY) || DEFAULT_USERNAME;
  }

  /* ── Update current-username display badge ── */
  function refreshUsernameDisplay() {
    if (secCurrentDisplay) {
      secCurrentDisplay.textContent = getActiveUsername();
    }
  }

  /* ── Toast reuse ── */
  // Removed showSecToast (using Peptia core)

  /* ── Password eye toggle ── */
  if (secEyeToggle) {
    secEyeToggle.addEventListener('click', () => {
      const visible = secPasswordInput.type === 'text';
      secPasswordInput.type = visible ? 'password' : 'text';
      secEyeShow.hidden = !visible;
      secEyeHide.hidden = visible;
    });
  }

  /* ── Save handler ── */
  btnSaveCreds.addEventListener('click', async () => {
    const newUser    = (secUsernameInput.value  || '').trim();
    const newPass    = secPasswordInput.value   || '';
    const confirmPass = secConfirmInput.value   || '';

    const wantsUsername = newUser.length  > 0;
    const wantsPassword = newPass.length  > 0 || confirmPass.length > 0;

    /* Must change at least one thing */
    if (!wantsUsername && !wantsPassword) {
      Peptia.showToast('Enter a new username, new password, or both.', 'error');
      secUsernameInput.focus();
      return;
    }

    /* ── Validate username ── */
    if (wantsUsername && newUser.length < 3) {
      Peptia.showToast('Username must be at least 3 characters.', 'error');
      secUsernameInput.focus();
      return;
    }

    /* ── Validate password ── */
    if (wantsPassword) {
      if (newPass.length < MIN_PASS_LEN) {
        Peptia.showToast(`Password must be at least ${MIN_PASS_LEN} characters.`, 'error');
        secPasswordInput.focus();
        return;
      }
      if (newPass !== confirmPass) {
        Peptia.showToast('Passwords do not match.', 'error');
        secConfirmInput.focus();
        return;
      }
    }

    /* ── Apply changes ── */
    btnSaveCreds.disabled = true;
    const originalText    = btnSaveCreds.querySelector('span') ?
      btnSaveCreds.querySelector('span').textContent : 'SAVE CREDENTIALS';

    try {
      if (wantsUsername) {
        localStorage.setItem(LS_USER_KEY, newUser);
      }

      if (wantsPassword) {
        const hash = await sha256(newPass);
        localStorage.setItem(LS_HASH_KEY, hash);
      }

      /* Update UI — keep session alive (do NOT log out) */
      refreshUsernameDisplay();
      secUsernameInput.value  = '';
      secPasswordInput.value  = '';
      secConfirmInput.value   = '';
      if (secEyeShow) { secEyeShow.hidden = false; secPasswordInput.type = 'password'; }
      if (secEyeHide) { secEyeHide.hidden = true; }

      Peptia.showToast('Admin credentials updated successfully ✓');

      /* Flash button green briefly */
      btnSaveCreds.style.background = '#10b981';
      setTimeout(() => { btnSaveCreds.style.background = ''; btnSaveCreds.disabled = false; }, 1600);

    } catch (err) {
      btnSaveCreds.disabled = false;
      Peptia.showToast('Failed to update credentials. Please try again.', 'error');
      console.error('[PEPTIA Security]', err);
    }
  });

  /* ── Init: show current username when settings panel opens ── */
  refreshUsernameDisplay();

  /* Also refresh whenever the settings panel becomes visible */
  const settingsPanel = document.getElementById('settings-panel');
  if (settingsPanel) {
    new MutationObserver(() => {
      if (settingsPanel.style.display !== 'none') refreshUsernameDisplay();
    }).observe(settingsPanel, { attributes: true, attributeFilter: ['style'] });
  }

})();
