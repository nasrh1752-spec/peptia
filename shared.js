/**
 * PEPTIA Core Shared Logic
 * ─────────────────────────────────────────────
 * Single source of truth for Products, WhatsApp, and generic utilities.
 */

window.Peptia = (function () {
  'use strict';

  // Constants
  const PRODUCTS_DATA_VERSION = "3";
  const STORE_KEY  = 'peptia_products_v' + PRODUCTS_DATA_VERSION;
  const WA_KEY     = 'whatsappNumber';
  const WA_DEFAULT = '201095673317';
  const DATA_URL   = `retatrutide_products.json?v=${PRODUCTS_DATA_VERSION}`;
  const SAR_TO_AED = 0.98;

  // Clean up old local storage caches
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('peptia_products') && key !== STORE_KEY) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {
    console.error('[PEPTIA] Cache cleanup error', e);
  }

  // State
  let products = [];
  let isFetching = null;

  // Utilities
  function toAED(sar) {
    if (!sar) return '';
    return Math.round(Number(sar) * SAR_TO_AED);
  }

  function toSAR(aed) {
    if (!aed) return null;
    return Math.round(Number(aed) / SAR_TO_AED);
  }

  function getWhatsAppNumber() {
    return localStorage.getItem(WA_KEY) || WA_DEFAULT;
  }

  function showToast(msg, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3000);
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Data Loading
  async function loadProducts() {
    if (products.length > 0) return products;

    const cached = localStorage.getItem(STORE_KEY);
    if (cached) {
      try {
        products = JSON.parse(cached);
        return products;
      } catch (e) {
        console.error('[PEPTIA] Failed to parse localStorage products', e);
      }
    }
    
    if (isFetching) {
      return await isFetching;
    }

    isFetching = (async () => {
      // Fallback: Fetch JSON
      try {
        const res = await fetch(DATA_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        products = data.products || [];
        saveProducts(products); // cache it
        return products;
      } catch (e) {
        console.error('[PEPTIA] Error loading initial data:', e);
        return [];
      } finally {
        isFetching = null;
      }
    })();

    return await isFetching;
  }

  function saveProducts(newProducts) {
    products = newProducts;
    localStorage.setItem(STORE_KEY, JSON.stringify(products));
  }

  function getProducts() {
    return products;
  }

  return {
    constants: {
      WA_DEFAULT,
      DATA_URL,
      STORE_KEY
    },
    toAED,
    toSAR,
    getWhatsAppNumber,
    showToast,
    escapeHTML,
    loadProducts,
    saveProducts,
    getProducts
  };
})();
