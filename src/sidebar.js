(function () {
  "use strict";

  const MAX_ROWS = 30;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createSidebarTemplate() {
    return `
      <section id="rashnu-root" aria-live="polite">
        <div class="rashnu-shell">
          <header class="rashnu-header">
            <div>
              <h1>Rashnu</h1>
              <p>مقایسه سریع دیجیکالا با ترب</p>
            </div>
            <span class="rashnu-pill" data-rashnu-debug-badge hidden>Debug</span>
          </header>
          <div class="rashnu-summary" data-rashnu-summary>در حال بررسی محصولات قابل مشاهده...</div>
          <div class="rashnu-list" data-rashnu-list></div>
        </div>
      </section>
    `;
  }

  async function ensureSidebarRoot() {
    let root = document.getElementById("rashnu-root");
    if (root) {
      return root;
    }

    const host = document.createElement("div");
    host.id = "rashnu-host";

    try {
      const response = await fetch(chrome.runtime.getURL("src/sidebar.html"));
      host.innerHTML = response.ok ? await response.text() : createSidebarTemplate();
    } catch (_error) {
      host.innerHTML = createSidebarTemplate();
    }

    document.body.appendChild(host);
    root = host.querySelector("#rashnu-root");
    return root;
  }

  function render(state) {
    const root = document.getElementById("rashnu-root");
    if (!root) {
      return;
    }

    const summary = root.querySelector("[data-rashnu-summary]");
    const list = root.querySelector("[data-rashnu-list]");
    const debugBadge = root.querySelector("[data-rashnu-debug-badge]");
    debugBadge.hidden = !state.debugEnabled;
    summary.textContent = buildSummaryText(state);
    list.innerHTML = buildListMarkup(state);
  }

  function buildSummaryText(state) {
    if (state.errorMessage) {
      return state.errorMessage;
    }

    if (!state.hasCards) {
      return "در این صفحه هنوز کارت محصول قابل تشخیص پیدا نشد.";
    }

    if (!state.items.length) {
      return "در حال بررسی محصولات قابل مشاهده...";
    }

    const visibleCount = state.items.filter((item) => item.isVisible).length;
    return `${visibleCount} محصول روی صفحه دیده شده و ${state.items.length} مورد در نوار ثبت شده است.`;
  }

  function buildListMarkup(state) {
    const items = state.items.slice(0, MAX_ROWS);
    if (!items.length) {
      return "";
    }

    return items.map((entry) => buildCardMarkup(entry, state.debugEnabled)).join("");
  }

  function buildCardMarkup(entry, debugEnabled) {
    const status = entry.match?.status || "loading";
    const statusLabel = getStatusLabel(status);
    const digikalaPrice = entry.item.displayPriceText || "قیمت در کارت پیدا نشد";
    const torobPrice =
      entry.match?.torobPriceText ||
      (status === "loading" ? "در حال جستجو..." : "یافت نشد");
    const confidence =
      typeof entry.match?.confidence === "number"
        ? `${Math.round(entry.match.confidence * 100)}%`
        : "نامشخص";
    const torobTitle = entry.match?.matchedTitle || "بدون تطابق قطعی";
    const searchLink = globalThis.RashnuNormalize.buildTorobSearchUrl(
      entry.match?.query || entry.item.title
    );
    const openLink =
      entry.match?.torobUrl || entry.match?.moreInfoUrl || searchLink;
    const imageMarkup = entry.item.imageUrl
      ? `<img class="rashnu-thumb" src="${escapeHtml(entry.item.imageUrl)}" alt="">`
      : `<div class="rashnu-thumb rashnu-thumb--empty">بدون تصویر</div>`;
    const debugMarkup =
      debugEnabled && entry.match?.debug
        ? `<div class="rashnu-debug">${escapeHtml(JSON.stringify(entry.match.debug, null, 2))}</div>`
        : "";

    return `
      <article class="rashnu-card" data-visible="${entry.isVisible ? "true" : "false"}">
        <div class="rashnu-row">
          ${imageMarkup}
          <div class="rashnu-body">
            <span class="rashnu-status rashnu-status--${escapeHtml(status)}">${escapeHtml(
      statusLabel
    )}</span>
            <h2 class="rashnu-title">${escapeHtml(entry.item.title)}</h2>
            <div class="rashnu-price-grid">
              <div class="rashnu-price-box">
                <span class="rashnu-label">دیجیکالا</span>
                <span class="rashnu-value">${escapeHtml(digikalaPrice)}</span>
              </div>
              <div class="rashnu-price-box">
                <span class="rashnu-label">ترب</span>
                <span class="rashnu-value">${escapeHtml(torobPrice)}</span>
              </div>
            </div>
            <p class="rashnu-subtitle">${escapeHtml(torobTitle)}</p>
            <p class="rashnu-meta">اعتماد: ${escapeHtml(confidence)}${
      entry.match?.sellerCount ? ` | فروشنده: ${escapeHtml(entry.match.sellerCount)}` : ""
    }</p>
            <div class="rashnu-links">
              <a class="rashnu-link" href="${escapeHtml(openLink)}" target="_blank" rel="noreferrer">باز کردن در ترب</a>
              <a class="rashnu-link" href="${escapeHtml(searchLink)}" target="_blank" rel="noreferrer">جستجوی ترب</a>
            </div>
            ${debugMarkup}
          </div>
        </div>
      </article>
    `;
  }

  function getStatusLabel(status) {
    switch (status) {
      case "matched":
        return "تطابق خوب";
      case "low_confidence":
        return "نیاز به بررسی";
      case "not_found":
        return "پیدا نشد";
      case "error":
        return "خطای شبکه";
      default:
        return "در حال جستجو";
    }
  }

  globalThis.RashnuSidebar = {
    ensureSidebarRoot,
    render
  };
})();
