/**
 * PEPTIA AI Chatbot — script.js
 * 100% local · No external APIs · Vanilla JS
 * ─────────────────────────────────────────────
 * Sections:
 *  1. Config & state
 *  2. DOM refs
 *  3. Helpers (time, AED, escape, delay, normalize)
 *  4. Product loader (fetch JSON)
 *  5. Product finder (keyword + dosage + fuzzy)
 *  6. Intent matcher
 *  7. Response builders
 *  8. Message / typing / session
 *  9. Quick actions
 * 10. Open / close
 * 11. Event binding
 * 12. Init
 */

(function () {
  'use strict';

  /* ━━━━ 1. CONFIG & STATE ━━━━━━━━━━━━━━━━━━━━━━━ */
  const SESS_KEY = 'peptia_chat_v1';

  let isOpen = false;
  let isBusy = false;
  let productsLoaded = false;

  /* Safety guard: if shared.js failed to load, define a no-op Peptia to prevent crashes */
  if (typeof window.Peptia === 'undefined') {
    console.error('[PEPTIA Chat] shared.js not loaded — Peptia global missing.');
    window.Peptia = {
      getProducts: () => [],
      loadProducts: async () => [],
      toAED: (s) => Math.round(Number(s) * 0.98),
      getWhatsAppNumber: () => localStorage.getItem('whatsappNumber') || '201095673317',
      escapeHTML: (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
    };
  }

  /* ━━━━ 3. DOM REFS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const fab      = document.getElementById('chat-fab');
  const win      = document.getElementById('chat-window');
  const msgs     = document.getElementById('chat-messages');
  const inputEl  = document.getElementById('chat-input');
  const sendBtn  = document.getElementById('chat-send-btn');
  const closeBtn = document.getElementById('chat-close-btn');
  const clearBtn = document.getElementById('chat-clear-btn');
  const qaWrap   = document.getElementById('chat-quickactions');

  /* ━━━━ 4. HELPERS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

  const wait = ms => new Promise(r => setTimeout(r, ms));

  function nowTime() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  /* Normalise text for matching */
  function norm(s = '') {
    return s.toLowerCase()
      .replace(/[أإآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/\s+/g, ' ').trim();
  }

  /* Short display title (strip Arabic / pipe extras) */
  function shortTitle(title = '') {
    return title.split('|')[0].split('–')[0].split('-')[0].trim();
  }


  /* ━━━━ 6. PRODUCT FINDER ━━━━━━━━━━━━━━━━━━━━━━━━ */
  function findProduct(text) {
    const products = Peptia.getProducts();
    if (!products || !products.length) return null;
    const n = norm(text);

    /* A. Dosage pattern match — highest precision */
    const doseM = n.match(/\d+\.?\d*\s?mg/g);
    if (doseM) {
      const dose = doseM[0].replace(/\s/g, '');
      const hit = products.find(p => norm(p.title).includes(dose));
      if (hit) return hit;
    }

    /* B. Score words from short title against user text */
    let best = null, bestScore = 0;
    for (const p of products) {
      const t = norm(shortTitle(p.title));
      const words = t.split(/\s+/).filter(w => w.length >= 3);
      const score = words.filter(w => n.includes(w)).length;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    /* Lower threshold to 1 for partial / single-word product matches */
    if (bestScore >= 1) return best;

    /* C. Product-ID substring */
    const idHit = products.find(p => n.includes(norm(p.product_id)));
    if (idHit) return idHit;

    return null;
  }

  /* ━━━━ 7. INTENT MATCHER ━━━━━━━━━━━━━━━━━━━━━━━━ */
  const INTENTS = [
    { re: /^(hi|hello|hey|مرحبا|مرحب|السلام عليكم|هلا|أهلا|ahlan)/i, fn: intentGreet    },
    { re: /شكر|thank|تسلم|يعطيك/i,                                     fn: intentThanks   },
    { re: /product|منتج|عندكم|عندك|ماذا عندك|ايه عندك|show|list|all/i,fn: intentProducts },
    { re: /price|سعر|كم|بكام|اسعار|how much|cost|aed|درهم|ريال/i,     fn: intentPrices   },
    { re: /stock|متوفر|available|عندك|هل يوجد|موجود|في مخزون/i,        fn: intentStock    },
    { re: /delivery|ship|شحن|توصيل|how (to|do) order|كيف اطلب/i,       fn: intentDelivery },
    { re: /order|اطلب|اشتري|buy|whatsapp|واتساب|وتساب|contact|تواصل/i,fn: intentOrder    },
  ];

  function matchIntent(text) {
    for (const { re, fn } of INTENTS) if (re.test(text)) return fn;
    return null;
  }

  /* ━━━━ 8. RESPONSE BUILDERS ━━━━━━━━━━━━━━━━━━━━━ */

  function intentGreet() {
    return `Hey! 👋 Great to have you here.<br>
I'm the <strong>PEPTIA</strong> assistant — ask me about products, prices, stock, or how to order.`;
  }

  function intentThanks() {
    return `You're welcome! 💪<br>Let me know if there's anything else I can help with.`;
  }

  function intentProducts() {
    const products = Peptia.getProducts();
    if (!products || !products.length) return `<em>Product data not available right now.</em><br>${btnWA()}`;
    return `Here are all our current products 📦<br>${productList(products, true)}`;
  }

  function intentPrices() {
    const products = Peptia.getProducts();
    if (!products || !products.length) return `<em>Price data not available right now.</em><br>${btnWA()}`;
    const rows = products.map(p => {
      const hasOld = p.old_price_sar && p.old_price_sar !== p.current_price_sar;
      return `<li class="cpi">
        <strong>${shortTitle(p.title)}</strong>
        <span class="cpi-price">${Peptia.toAED(p.current_price_sar).toLocaleString()} AED</span>
        ${hasOld ? `<span class="cpi-old">${Peptia.toAED(p.old_price_sar).toLocaleString()} AED</span>` : ''}
      </li>`;
    }).join('');
    return `Current prices 💰<br><ul class="chat-list">${rows}</ul>`;
  }

  function intentStock() {
    const products = Peptia.getProducts();
    if (!products || !products.length) return `<em>Stock data not available right now.</em><br>${btnWA()}`;
    const rows = products.map(p => {
      const ok = p.availability === 'متوفر';
      return `<li class="cpi">
        <strong>${shortTitle(p.title)}</strong>
        <span class="${ok ? 'cpi-in' : 'cpi-out'}">${ok ? '✅ In Stock' : '❌ Out of Stock'}</span>
      </li>`;
    }).join('');
    return `Stock status 📊<br><ul class="chat-list">${rows}</ul>`;
  }

  function intentDelivery() {
    return `📦 <strong>How to Order</strong><br>
<ol class="chat-ol">
  <li>Browse and choose your product</li>
  <li>Click the WhatsApp button on the card</li>
  <li>Confirm details with our team</li>
  <li>Receive your order 🚀</li>
</ol><br>${btnWA('Hello PEPTIA, I need help with an order.')}`;
  }

  function intentOrder() {
    return `Ready to order? 💬<br>
Our team is standing by on WhatsApp to assist you.<br><br>${btnWA()}`;
  }

  function productDetail(p) {
    const ok = p.availability === 'متوفر';
    const name = shortTitle(p.title);
    const descHtml = p.description ? `<p style="margin: 0.4rem 0; font-size: 0.75rem; opacity: 0.9;">${Peptia.escapeHTML(p.description)}</p>` : '';
    const wa = ok ? btnWAProduct(name) : `<em class="cpi-out">Out of stock — contact us for restock updates.</em><br>${btnWA()}`;
    return `<strong>${name}</strong><br>${descHtml}
<ul class="chat-list">
  <li class="cpi">
    <span class="cpi-price">${Peptia.toAED(p.current_price_sar).toLocaleString()} AED</span>
    &nbsp;·&nbsp;
    <span class="${ok ? 'cpi-in' : 'cpi-out'}">${ok ? '✅ In Stock' : '❌ Out of Stock'}</span>
    ${p.discount_percent && String(p.discount_percent).trim()
      ? `<span class="cpi-badge">−${p.discount_percent}%</span>` : ''}
  </li>
</ul>${wa}`;
  }

  function productList(arr, showWA = false) {
    const rows = arr.map(p => {
      const ok = p.availability === 'متوفر';
      return `<li class="cpi">
        <strong>${shortTitle(p.title)}</strong>
        <span class="cpi-price">${Peptia.toAED(p.current_price_sar).toLocaleString()} AED</span>
        &nbsp;·&nbsp;
        <span class="${ok ? 'cpi-in' : 'cpi-out'}">${ok ? '✅ In Stock' : '❌ Out of Stock'}</span>
      </li>`;
    }).join('');
    return `<ul class="chat-list">${rows}</ul>${showWA ? btnWA() : ''}`;
  }

  function unknown() {
    return `I don't have this information right now.<br>
<em style="font-size:.71rem;opacity:.6">Contact us on WhatsApp and we'll help you.</em><br><br>${btnWA()}`;
  }

  /* WhatsApp button HTML */
  const WA_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>`;

  function btnWA(msg = 'Hello PEPTIA, I need assistance.') {
    return `<a class="chat-wa-btn" href="https://wa.me/${Peptia.getWhatsAppNumber()}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener noreferrer">${WA_ICON} Order via WhatsApp</a>`;
  }

  function btnWAProduct(name) {
    return btnWA(`Hello PEPTIA, I'd like to order: ${name}`);
  }

  /* ━━━━ 9. MESSAGING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function addMsg(html, role, save = true) {
    const t = nowTime();
    const wrap = document.createElement('div');
    wrap.className = `chat-msg chat-msg--${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerHTML = html;

    const ts = document.createElement('span');
    ts.className = 'chat-ts';
    ts.textContent = t;

    wrap.append(role === 'bot' ? bubble : ts, role === 'bot' ? ts : bubble);
    msgs.appendChild(wrap);
    scrollDown();
    if (save) persist(html, role, t);
  }

  function scrollDown() {
    requestAnimationFrame(() => { msgs.scrollTop = msgs.scrollHeight; });
  }

  /* Typing indicator */
  let typingEl = null;
  function showTyping() {
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'chat-msg chat-msg--bot';
    typingEl.id = 'chat-typing';
    typingEl.innerHTML = `<div class="chat-bubble chat-typing-dots"><span></span><span></span><span></span></div>`;
    msgs.appendChild(typingEl);
    scrollDown();
  }
  function hideTyping() {
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }

  /* ━━━━ 10. SESSION STORAGE ━━━━━━━━━━━━━━━━━━━━━━━ */
  function persist(html, role, t) {
    try {
      const h = JSON.parse(sessionStorage.getItem(SESS_KEY) || '[]');
      h.push({ html, role, t });
      sessionStorage.setItem(SESS_KEY, JSON.stringify(h.slice(-60)));
    } catch {}
  }

  function restore() {
    try {
      const h = JSON.parse(sessionStorage.getItem(SESS_KEY) || '[]');
      h.forEach(m => addMsg(m.html, m.role, false));
      return h.length > 0;
    } catch { return false; }
  }

  function clearChat() {
    sessionStorage.removeItem(SESS_KEY);
    msgs.innerHTML = '';
    welcome();
  }

  /* ━━━━ 11. WELCOME ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function welcome() {
    addMsg(
      `Hey 👋 Welcome to <strong>PEPTIA</strong>.<br>How can I help you today?`,
      'bot'
    );
  }

  /* ━━━━ 12. PROCESS USER INPUT ━━━━━━━━━━━━━━━━━━━━ */
  async function process(raw) {
    raw = raw.trim();
    if (!raw || isBusy) return;
    isBusy = true;

    addMsg(Peptia.escapeHTML(raw), 'user');
    showTyping();

    /* Ensure products are loaded before processing */
    if (!productsLoaded) {
      await Peptia.loadProducts();
      productsLoaded = true;
    }

    await wait(550 + Math.random() * 450);
    hideTyping();

    /* Specific product match first — only when query is NOT a general intent */
    const generalIntent = /^(hi|hello|hey|product|price|stock|delivery|order|thank|اطلب|عندكم|سعر|توصيل|متوفر)/i.test(raw.trim());
    if (!generalIntent) {
      const p = findProduct(raw);
      if (p) { addMsg(productDetail(p), 'bot'); isBusy = false; return; }
    }

    /* Intent match */
    const fn = matchIntent(raw);
    if (fn) { addMsg(fn(), 'bot'); isBusy = false; return; }

    /* Last resort: try product search even for general words */
    const p = findProduct(raw);
    if (p) { addMsg(productDetail(p), 'bot'); isBusy = false; return; }

    addMsg(unknown(), 'bot');
    isBusy = false;
  }

  /* ━━━━ 13. QUICK ACTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━ */
  const QUICK = {
    products:  intentProducts,
    prices:    intentPrices,
    stock:     intentStock,
    delivery:  intentDelivery,
    whatsapp:  intentOrder,
  };

  const QA_LABELS = {
    products: '📦 Products',
    prices:   '💰 Prices',
    stock:    '✅ Check Stock',
    delivery: '🚀 Delivery',
    whatsapp: '💬 Order via WhatsApp',
  };

  async function quickAction(key) {
    if (isBusy) return;
    isBusy = true;
    if (!isOpen) openChat();
    addMsg(QA_LABELS[key] || key, 'user');
    showTyping();
    /* Ensure products are available before any quick-action that needs them */
    if (!productsLoaded) {
      await Peptia.loadProducts();
      productsLoaded = true;
    }
    await wait(400);
    hideTyping();
    const fn = QUICK[key];
    if (fn) addMsg(fn(), 'bot');
    isBusy = false;
  }

  /* ━━━━ 14. OPEN / CLOSE ━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function openChat() {
    isOpen = true;
    win.classList.add('open');
    win.setAttribute('aria-hidden', 'false');
    fab.setAttribute('aria-expanded', 'true');
    fab.classList.add('chat-fab--open');
    requestAnimationFrame(() => inputEl.focus());
  }

  function closeChat() {
    isOpen = false;
    win.classList.remove('open');
    win.setAttribute('aria-hidden', 'true');
    fab.setAttribute('aria-expanded', 'false');
    fab.classList.remove('chat-fab--open');
  }

  /* ━━━━ 15. EVENT BINDING ━━━━━━━━━━━━━━━━━━━━━━━━━ */
  function bindEvents() {
    fab.addEventListener('click', () => isOpen ? closeChat() : openChat());
    closeBtn.addEventListener('click', closeChat);
    clearBtn.addEventListener('click', clearChat);

    function submit() {
      const v = inputEl.value.trim();
      if (!v) return;
      inputEl.value = '';
      process(v);
    }

    sendBtn.addEventListener('click', submit);
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });

    qaWrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-quick]');
      if (btn) quickAction(btn.dataset.quick);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen) closeChat();
    });
  }

  /* ━━━━ 16. INIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  async function init() {
    bindEvents();
    /* Load products in background so they're ready when user first types */
    Peptia.loadProducts().then(() => { productsLoaded = true; }).catch(() => {});
    if (!restore()) welcome();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();
