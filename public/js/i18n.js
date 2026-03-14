/* SajiloKhata i18n runtime */
(function () {
  const dictionaries = {};

  async function load(lang) {
    if (dictionaries[lang]) return dictionaries[lang];
    const res = await fetch(`/i18n/${lang}.json`);
    const data = await res.json();
    dictionaries[lang] = data;
    return data;
  }

  function applyStaticUI(dict) {
    const map = [
      ['.nav-item[data-section="dashboard"]', dict.dashboard],
      ['.nav-item[data-section="products"]', dict.products],
      ['.nav-item[data-section="customers"]', dict.customers],
      ['.nav-item[data-section="suppliers"]', dict.suppliers],
      ['.nav-item[data-section="new-transaction"]', dict.new_transaction],
      ['.nav-item[data-section="transactions"]', dict.transaction_history],
      ['.nav-item[data-section="expenses"]', dict.expenses],
      ['.nav-item[data-section="baki"]', dict.baki_ledger],
      ['.nav-item[data-section="reports"]', dict.reports],
      ['#section-dashboard .page-header h2', dict.dashboard],
      ['#section-dashboard .page-header p', dict.real_time_overview],
      ['#section-reports .card .card-title', dict.profit_loss]
    ];

    map.forEach(([selector, text]) => {
      const el = document.querySelector(selector);
      if (!el || !text) return;
      const icon = el.querySelector('.nav-icon');
      if (icon) {
        const labelNode = Array.from(el.childNodes).find((node) => {
          return node.nodeType === Node.TEXT_NODE && node.textContent.trim();
        });

        if (labelNode) {
          labelNode.textContent = ` ${text} `;
        } else {
          el.appendChild(document.createTextNode(` ${text} `));
        }
      } else {
        el.textContent = text;
      }
    });
  }

  async function applyLanguage(lang) {
    try {
      const dict = await load(lang);
      applyStaticUI(dict);
    } catch (_) {
      // Silent fail keeps app usable.
    }
  }

  window.SK_I18N = { applyLanguage };
})();
