(function () {
  "use strict";

  const api = globalThis.UnitPriceNormalizer;
  if (!api) return;

  const DEFAULTS = { enabled: true, highlightBest: true, decimals: "smart" };
  const BADGE_CLASS = "upn-normalized-price";
  const BEST_CLASS = "upn-best-value";
  const PRODUCT_SELECTORS = [
    "[data-component-type='s-search-result']",
    "[data-asin]:not([data-asin=''])",
    "[data-item-id]",
    "[data-testid='list-view'] > div",
    "[data-testid='item-stack'] > div",
    "[itemtype*='schema.org/Product']",
    "[itemtype*='Product']",
    ".product-card",
    ".product-item",
    "article"
  ];
  const PRICE_SELECTORS = [
    ".a-price:not(.a-text-price)",
    "[data-testid='unified-global-product-price']",
    "[data-automation-id='product-price']",
    "[data-testid='price-wrap']",
    "[itemprop='price']",
    ".price-current",
    ".product-price",
    ".price"
  ];
  const TITLE_SELECTORS = [
    "h2",
    "h3",
    "[data-automation-id='product-title']",
    "[data-testid='product-title']",
    "[itemprop='name']",
    ".product-title",
    ".product-name"
  ];

  let settings = { ...DEFAULTS };
  let scanTimer = null;
  let lastStats = { found: 0, normalized: 0, unsupported: 0 };

  function visible(element) {
    if (!element || !element.isConnected) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  }

  function uniqueProductCards() {
    const cardsByPrice = new Map();
    const knownCards = [...document.querySelectorAll(PRODUCT_SELECTORS.join(","))].filter(visible);

    for (const card of knownCards) {
      const price = findPriceElement(card);
      if (!price) continue;
      const existing = cardsByPrice.get(price);
      // Prefer the innermost matching card when retailer markup is nested.
      if (!existing || existing.contains(card)) cardsByPrice.set(price, card);
    }

    // Generic fallback for stores that use ordinary list items or divs.
    const visiblePrices = [...document.querySelectorAll(PRICE_SELECTORS.join(","))].filter(visible);
    for (const price of visiblePrices) {
      if (cardsByPrice.has(price)) continue;
      let candidate = price.parentElement;
      for (let depth = 0; candidate && depth < 7; depth += 1, candidate = candidate.parentElement) {
        const hasTitle = Boolean(firstMatching(candidate, TITLE_SELECTORS));
        const text = candidate.textContent || "";
        if (hasTitle && text.length < 6000 && api.parseQuantity(text)) {
          cardsByPrice.set(price, candidate);
          break;
        }
      }
    }

    return [...new Set(cardsByPrice.values())];
  }

  function firstMatching(root, selectors) {
    for (const selector of selectors) {
      const found = root.querySelector(selector);
      if (found && visible(found)) return found;
    }
    return null;
  }

  function findPriceElement(card) {
    return firstMatching(card, PRICE_SELECTORS);
  }

  function getPrice(priceElement) {
    if (!priceElement) return null;
    const metadata = priceElement.getAttribute("content") || priceElement.getAttribute("data-price");
    if (metadata && Number(metadata) > 0) return Number(metadata);
    return api.parsePrice(priceElement.getAttribute("aria-label") || priceElement.textContent);
  }

  function productText(card) {
    const title = firstMatching(card, TITLE_SELECTORS);
    const titleText = title ? (title.getAttribute("aria-label") || title.textContent || "") : "";
    const ariaText = card.getAttribute("aria-label") || "";
    return `${titleText} ${ariaText} ${card.textContent || ""}`.replace(/\s+/g, " ").slice(0, 3000);
  }

  function removeBadges() {
    document.querySelectorAll(`.${BADGE_CLASS}`).forEach((badge) => badge.remove());
  }

  function makeBadge(result, price, quantity) {
    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.dataset.kind = result.kind;
    badge.dataset.value = String(result.value);
    badge.textContent = api.formatUnitPrice(result.value, result.unit, settings.decimals);
    const packageAmount = Number.isInteger(result.totalAmount) ? result.totalAmount : result.totalAmount.toFixed(1);
    badge.title = `$${price.toFixed(2)} ÷ ${packageAmount} ${result.unit} (${quantity.source})`;
    badge.setAttribute("aria-label", `Normalized price: ${badge.textContent}`);
    return badge;
  }

  function highlightBestValues(badges) {
    badges.forEach((badge) => badge.classList.remove(BEST_CLASS));
    if (!settings.highlightBest) return;
    for (const kind of ["mass", "volume"]) {
      const group = badges.filter((badge) => badge.dataset.kind === kind);
      if (group.length < 2) continue;
      const bestValue = Math.min(...group.map((badge) => Number(badge.dataset.value)));
      group.filter((badge) => Math.abs(Number(badge.dataset.value) - bestValue) < 1e-12)
        .forEach((badge) => {
          badge.classList.add(BEST_CLASS);
          badge.textContent += " · Best";
        });
    }
  }

  function scan() {
    removeBadges();
    if (!settings.enabled) {
      lastStats = { found: 0, normalized: 0, unsupported: 0 };
      return;
    }

    const cards = uniqueProductCards();
    const badges = [];
    let found = 0;
    let unsupported = 0;

    for (const card of cards) {
      const priceElement = findPriceElement(card);
      if (!priceElement) continue;
      found += 1;
      const price = getPrice(priceElement);
      const quantity = api.parseQuantity(productText(card));
      const result = api.normalize(price, quantity);
      if (!result) {
        unsupported += 1;
        continue;
      }

      const badge = makeBadge(result, price, quantity);
      priceElement.insertAdjacentElement("afterend", badge);
      badges.push(badge);
    }

    highlightBestValues(badges);
    lastStats = { found, normalized: badges.length, unsupported };
  }

  function scheduleScan(delay = 350) {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, delay);
  }

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    scan();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, change] of Object.entries(changes)) settings[key] = change.newValue;
    scheduleScan(0);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "UPN_RESCAN") {
      scan();
      sendResponse(lastStats);
    } else if (message?.type === "UPN_GET_STATS") {
      sendResponse(lastStats);
    }
  });

  new MutationObserver((mutations) => {
    if (mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE && !node.classList?.contains(BADGE_CLASS)))) {
      scheduleScan();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
