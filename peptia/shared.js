/**
 * PEPTIA Core Shared Logic
 * ─────────────────────────────────────────────
 * Single source of truth for Products, WhatsApp, and generic utilities.
 */

window.Peptia = (function () {
  'use strict';

  // Constants
  const STORE_KEY  = 'peptia_products';
  const WA_KEY     = 'whatsappNumber';
  const WA_DEFAULT = '201095673317';
  const DATA_URL   = 'retatrutide_products.json';
  const SAR_TO_AED = 0.98;

  // State
  let products = [];

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
    const cached = localStorage.getItem(STORE_KEY);
    if (cached) {
      try {
        products = JSON.parse(cached);
        return products;
      } catch (e) {
        console.error('[PEPTIA] Failed to parse localStorage products', e);
      }
    }
    
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
    }
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
      DATA_URL
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
