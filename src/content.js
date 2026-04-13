(function () {
  "use strict";

  if (globalThis.__rashnuContentBooted) {
    return;
  }
  globalThis.__rashnuContentBooted = true;

  const extractor = globalThis.RashnuListingExtractor;
  const logger = globalThis.RashnuLogger;
  const mutationObserver = new MutationObserver(handleDomMutation);
  const RASHNU_MUTATION_IGNORE_SELECTOR =
    '[data-rashnu-guide-badge], [data-rashnu-highlight], [data-rashnu-transient-highlight], #rashnu-selection-style, #rashnu-guide-style, [data-rashnu-role]';
  const LOCATION_POLL_INTERVAL_MS = 800;
  const LOCATION_POLL_FALLBACK_WINDOW_MS = 10000;
  let observedElements = new WeakSet();
  let sourceIdToRecord = new Map();
  let rowState = new Map();
  let guideSequenceBySourceId = new Map();
  let nextGuideNumber = 1;
  let intersectionObserver = null;
  let debugEnabled = false;
  let selectionModeEnabled = false;
  let guideNumbersEnabled = false;
  let panelActive = false;
  let highlightedElement = null;
  let bootAttempts = 0;
  let syncTimer = null;
  let pageContext = null;
  let currentPageKey = "";
  let refreshRevision = 0;
  let focusedSourceId = null;
  let runtimeListenerBound = false;
  let storageListenerBound = false;
  let transientHighlightElement = null;
  let transientHighlightTimer = null;
  let lastPageContextSignature = "";
  let lastSyncSignature = "";
  let navigationListenersBound = false;
  let lastKnownHref = location.href;
  let locationPollTimer = null;
  let navigationRescanTimer = null;
  let navigationRescanAttempts = 0;
  let navigationRescanNonce = 0;
  let navigationEpoch = 0;
  let listingNavigationResetUntil = 0;
  let locationPollFallbackTimer = null;
  let locationChangeHandler = null;

  boot().catch(() => {});

  async function boot() {
    logger.info("content", "boot");
    await startWhenReady();
  }

  async function startWhenReady() {
    bootAttempts += 1;
    ensureNavigationListeners();
    pageContext = getCurrentPageContext({ forceRefresh: true });
    await syncSettings();
    await notifyPageState(pageContext);

    if (!pageContext.isSupported) {
      if (bootAttempts < 12) {
        window.setTimeout(() => {
          startWhenReady().catch(() => {});
        }, 800);
      }
      logger.debug("content", "unsupported_page", {
        site: pageContext.site,
        pageUrl: pageContext.pageUrl
      });
      return;
    }

    logger.info("content", "supported_page", {
      site: pageContext.site,
      pageUrl: pageContext.pageUrl
    });

    ensureRuntimeListener();

    ensureStorageListener();

    intersectionObserver = new IntersectionObserver(handleIntersection, {
      root: null,
      threshold: 0.2
    });

    refreshCards();
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async function syncSettings() {
    const stored = await chrome.storage.local.get([
      "rashnuDebugEnabled",
      "rashnuSelectionModeEnabled",
      "rashnuGuideNumbersEnabled",
      "rashnuPanelActive"
    ]);
    debugEnabled = Boolean(stored.rashnuDebugEnabled);
    selectionModeEnabled = Boolean(stored.rashnuSelectionModeEnabled);
    guideNumbersEnabled = Boolean(stored.rashnuGuideNumbersEnabled);
    panelActive = Boolean(stored.rashnuPanelActive);
    ensureHighlightStyle();
    ensureGuideStyle();
    if (!selectionModeEnabled || !panelActive) {
      clearHighlightedElement();
    }
    if (panelActive) {
      renderGuideBadges();
      scheduleLocationPollingFallback("sync_settings");
    } else {
      clearGuideBadges();
      focusedSourceId = null;
      stopLocationPollingFallback();
    }
  }

  function getCurrentPageContext(options = {}) {
    pageContext = extractor.getPageContext(options);
    return pageContext;
  }

  async function notifyPageState(context = null) {
    const nextContext = context || getCurrentPageContext();
    resetLocalStateIfNeeded(nextContext);
    const signature = JSON.stringify({
      pageKey: currentPageKey,
      pageUrl: nextContext.pageUrl,
      site: nextContext.site,
      mode: nextContext.mode,
      isSupported: nextContext.isSupported
    });
    if (signature === lastPageContextSignature) {
      return;
    }
    lastPageContextSignature = signature;
    logger.debug("content", "page_context", nextContext);
    await safeSendMessage({
      type: "RASHNU_PAGE_CONTEXT",
      payload: {
        ...nextContext,
        pageKey: currentPageKey
      }
    });
  }

  async function refreshCards(context = null) {
    const revision = ++refreshRevision;
    const nextContext = context || getCurrentPageContext();
    resetLocalStateIfNeeded(nextContext);
    if (!panelActive) {
      clearGuideBadges();
      clearHighlightedElement();
      return;
    }
    if (!nextContext.isSupported) {
      return;
    }

    const records = await Promise.resolve(extractor.scanPageItems(nextContext));
    if (revision !== refreshRevision) {
      return;
    }
    const visibleRecordCount = records.reduce((count, record) => count + (computeRecordVisibility(record) ? 1 : 0), 0);
    logger.debug("content", "scan_snapshot", {
      pageKey: currentPageKey,
      mode: nextContext.mode,
      site: nextContext.site,
      extractedCount: records.length,
      visibleRecordCount,
      sourceSample: records.slice(0, 6).map((record) => record?.item?.sourceId || "")
    });
    pruneStaleRows(records, nextContext);
    logger.debug("content", "refresh_cards", {
      mode: nextContext.mode,
      site: nextContext.site,
      count: records.length
    });

    for (const record of records) {
      const stableGuideNumber = assignStableGuideNumber(record.item.sourceId);
      record.item = {
        ...record.item,
        guideNumber: stableGuideNumber,
        position: stableGuideNumber - 1
      };
      const existing = sourceIdToRecord.get(record.item.sourceId);
      if (!existing) {
        sourceIdToRecord.set(record.item.sourceId, record);
        rowState.set(record.item.sourceId, {
          item: record.item,
          isVisible: computeRecordVisibility(record),
          lastSeenAt: record.item.seenAt
        });
      } else {
        existing.element = record.element;
        existing.item = mergeItemSnapshot(existing.item, record.item);
        const row = rowState.get(record.item.sourceId);
        if (row) {
          row.item = existing.item;
          row.isVisible = computeRecordVisibility(existing, row.isVisible);
        }
      }

      if (record.element && !observedElements.has(record.element)) {
        observedElements.add(record.element);
        intersectionObserver.observe(record.element);
        bindSelectionListeners(record.element, record.item.sourceId);
      }
    }

    renderGuideBadges();

    if (nextContext.mode === "detail" && records[0]?.item?.sourceId) {
      const row = rowState.get(records[0].item.sourceId);
      if (row) {
        row.lastSeenAt = Date.now();
        if (selectionModeEnabled) {
          if (focusedSourceId && focusedSourceId !== records[0].item.sourceId) {
            scheduleSync();
            return;
          }
          focusedSourceId = records[0].item.sourceId;
          setHighlightedElement(records[0].element);
          safeSendMessage({
            type: "RASHNU_ITEM_FOCUS",
            payload: {
              pageKey: currentPageKey,
              pageUrl: nextContext?.pageUrl || location.href,
              mode: nextContext?.mode || "unsupported",
              site: nextContext?.site || "unsupported",
              item: {
                ...row.item,
                seenAt: Date.now()
              }
            }
          });
        }
      }
    }

    scheduleSync();
  }

  function pruneStaleRows(records, context) {
    const inNavigationResetWindow = context?.mode === "listing" && Date.now() < listingNavigationResetUntil;
    const effectiveRecords =
      inNavigationResetWindow
        ? records.filter((record) => {
            const element = record?.element;
            if (!(element instanceof Element)) {
              return true;
            }
            const rect = element.getBoundingClientRect();
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
            return rect.bottom > 8 && rect.right > 0 && (viewportWidth <= 0 || rect.left < viewportWidth);
          })
        : records;
    const recordsForReset = effectiveRecords.length ? effectiveRecords : records;

    if (inNavigationResetWindow) {
      logger.debug("content", "navigation_reset_window_snapshot", {
        pageKey: currentPageKey,
        totalRecords: records.length,
        effectiveRecords: recordsForReset.length
      });
    }

    const nextSourceIds = new Set();
    for (const record of recordsForReset) {
      const sourceId = record?.item?.sourceId;
      if (sourceId) {
        nextSourceIds.add(sourceId);
      }
    }

    if (!nextSourceIds.size) {
      if (context?.mode === "listing") {
        clearTrackedRows();
      }
      return;
    }

    if (context?.mode === "listing") {
      // Listing guide numbers should always mirror current DOM order and restart from 1.
      const rebuiltGuideSequence = new Map();
      let sequence = 1;
      for (const record of recordsForReset) {
        const sourceId = String(record?.item?.sourceId || "");
        if (!sourceId || rebuiltGuideSequence.has(sourceId)) {
          continue;
        }
        rebuiltGuideSequence.set(sourceId, sequence);
        sequence += 1;
      }
      guideSequenceBySourceId = rebuiltGuideSequence;
      nextGuideNumber = sequence;
      logger.debug("content", "guide_sequence_rebuilt", {
        pageKey: currentPageKey,
        rebuiltCount: rebuiltGuideSequence.size,
        nextGuideNumber,
        guideDiagnostics: computeGuideDiagnostics(
          Array.from(rebuiltGuideSequence.entries()).map(([sourceId, guideNumber]) => ({
            sourceId,
            guideNumber
          }))
        )
      });
    }

    const removedSourceIds = [];
    for (const [sourceId, record] of sourceIdToRecord.entries()) {
      if (nextSourceIds.has(sourceId)) {
        continue;
      }
      removedSourceIds.push(sourceId);
      untrackRecord(sourceId, record);
    }

    if (focusedSourceId && !nextSourceIds.has(focusedSourceId)) {
      focusedSourceId = null;
      clearHighlightedElement();
    }

    if (removedSourceIds.length) {
      logger.debug("content", "stale_rows_pruned", {
        removed: removedSourceIds.length
      });
    }
  }

  function clearTrackedRows() {
    const removedCount = sourceIdToRecord.size;
    if (!removedCount) {
      return;
    }
    for (const [sourceId, record] of sourceIdToRecord.entries()) {
      untrackRecord(sourceId, record);
    }
    guideSequenceBySourceId = new Map();
    nextGuideNumber = 1;
    focusedSourceId = null;
    clearHighlightedElement();
    logger.debug("content", "tracked_rows_cleared", {
      removed: removedCount
    });
  }

  function untrackRecord(sourceId, record) {
    if (record?.element && intersectionObserver) {
      try {
        intersectionObserver.unobserve(record.element);
      } catch (_error) {}
    }
    sourceIdToRecord.delete(sourceId);
    rowState.delete(sourceId);
    guideSequenceBySourceId.delete(sourceId);
  }

  function handleIntersection(entries) {
    for (const entry of entries) {
      const record = findRecordByElement(entry.target);
      if (!record) {
        continue;
      }
      const row = rowState.get(record.item.sourceId);
      if (!row) {
        continue;
      }

      row.isVisible = entry.isIntersecting;
      row.lastSeenAt = Date.now();
    }

    scheduleSync();
  }

  function findRecordByElement(element) {
    for (const record of sourceIdToRecord.values()) {
      if (record.element === element) {
        return record;
      }
    }
    return null;
  }

  function bindSelectionListeners(element, sourceId) {
    const handleEnter = () => {
      if (!selectionModeEnabled || !panelActive) {
        return;
      }
      const row = rowState.get(sourceId);
      if (!row) {
        return;
      }
      focusedSourceId = sourceId;
      setHighlightedElement(element);
      safeSendMessage({
        type: "RASHNU_ITEM_FOCUS",
        payload: {
          pageKey: currentPageKey,
          pageUrl: pageContext?.pageUrl || location.href,
          mode: pageContext?.mode || "unsupported",
          site: pageContext?.site || "unsupported",
          item: {
            ...row.item,
            seenAt: Date.now()
          }
        }
      });
      logger.debug("content", "item_focus", {
        sourceId,
        title: row.item.title
      });
    };

    element.addEventListener("mouseenter", handleEnter, true);
    element.addEventListener("focusin", handleEnter, true);
    element.addEventListener(
      "mouseleave",
      () => {
        if (highlightedElement === element) {
          clearHighlightedElement();
        }
      },
      true
    );
    element.addEventListener(
      "focusout",
      () => {
        if (highlightedElement === element) {
          clearHighlightedElement();
        }
      },
      true
    );
  }

  function scheduleSync() {
    if (!panelActive) {
      return;
    }
    if (syncTimer) {
      return;
    }

    syncTimer = window.setTimeout(async () => {
      syncTimer = null;
      const rows = collectSyncRows().map((row) => ({
        item: {
          ...row.item
        },
        isVisible: row.isVisible,
        lastSeenAt: row.lastSeenAt || row.item.seenAt
      }));
      const activeRecord = computeActiveVisibleRecord();
      const syncSignature = JSON.stringify({
        pageKey: currentPageKey,
        activeGuideNumber: activeRecord?.item?.guideNumber || null,
        activeSourceId: activeRecord?.item?.sourceId || null,
        selectionModeEnabled,
        focusedSourceId,
        rows: rows.map((row) => ({
          sourceId: row.item.sourceId,
          guideNumber: row.item.guideNumber || null,
          title: row.item.title || "",
          price: row.item.displayPriceText || "",
          originalPrice: row.item.displayOriginalPriceText || "",
          discountPercent: row.item.displayDiscountPercent || "",
          imageUrl: row.item.imageUrl || "",
          isVisible: Boolean(row.isVisible)
        }))
      });

      if (syncSignature === lastSyncSignature) {
        return;
      }
      lastSyncSignature = syncSignature;

      await safeSendMessage({
        type: "RASHNU_SYNC_ITEMS",
        payload: {
          pageKey: currentPageKey,
          pageUrl: pageContext?.pageUrl || location.href,
          site: pageContext?.site || "unsupported",
          mode: pageContext?.mode || "unsupported",
          activeGuideNumber: activeRecord?.item?.guideNumber || null,
          activeSourceId: activeRecord?.item?.sourceId || null,
          rows
        }
      });
      const guideDiagnostics = computeGuideDiagnostics(
        rows.map((row) => ({
          sourceId: row.item.sourceId,
          guideNumber: row.item.guideNumber
        }))
      );
      if (guideDiagnostics.count && (!guideDiagnostics.startsAtOne || !guideDiagnostics.isContiguous)) {
        logger.warn("content", "guide_sequence_anomaly", {
          pageKey: currentPageKey,
          diagnostics: guideDiagnostics
        });
      }
      logger.debug("content", "sync_sent", {
        pageKey: currentPageKey,
        site: pageContext?.site || "unsupported",
        rows: rows.length,
        trackedRows: rowState.size,
        guideDiagnostics
      });
    }, 250);
  }

  function collectSyncRows() {
    const trackedRows = Array.from(rowState.values());
    return trackedRows.sort((left, right) => {
      const leftGuide = Number.isFinite(left.item?.guideNumber) ? left.item.guideNumber : Number.MAX_SAFE_INTEGER;
      const rightGuide = Number.isFinite(right.item?.guideNumber) ? right.item.guideNumber : Number.MAX_SAFE_INTEGER;
      if (leftGuide !== rightGuide) {
        return leftGuide - rightGuide;
      }
      return String(left.item?.sourceId || "").localeCompare(String(right.item?.sourceId || ""));
    });
  }

  function assignStableGuideNumber(sourceId) {
    const normalizedSourceId = String(sourceId || "");
    if (!normalizedSourceId) {
      const fallback = nextGuideNumber;
      nextGuideNumber += 1;
      return fallback;
    }
    const existing = guideSequenceBySourceId.get(normalizedSourceId);
    if (Number.isFinite(existing) && existing > 0) {
      return existing;
    }
    const assigned = nextGuideNumber;
    nextGuideNumber += 1;
    guideSequenceBySourceId.set(normalizedSourceId, assigned);
    return assigned;
  }

  function computeGuideDiagnostics(items) {
    const guideNumbers = [];
    const seenGuideNumbers = new Set();
    const seenSourceIds = new Set();
    let duplicateGuideCount = 0;
    let duplicateSourceCount = 0;

    for (const item of items || []) {
      const sourceId = String(item?.sourceId || "");
      if (sourceId) {
        if (seenSourceIds.has(sourceId)) {
          duplicateSourceCount += 1;
        } else {
          seenSourceIds.add(sourceId);
        }
      }
      const guideNumber = Number(item?.guideNumber);
      if (!Number.isFinite(guideNumber)) {
        continue;
      }
      guideNumbers.push(guideNumber);
      if (seenGuideNumbers.has(guideNumber)) {
        duplicateGuideCount += 1;
      } else {
        seenGuideNumbers.add(guideNumber);
      }
    }

    if (!guideNumbers.length) {
      return {
        count: 0,
        min: null,
        max: null,
        startsAtOne: false,
        isContiguous: false,
        duplicateGuideCount,
        duplicateSourceCount
      };
    }

    const sorted = [...guideNumbers].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    let isContiguous = true;
    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index] === sorted[index - 1]) {
        continue;
      }
      if (sorted[index] !== sorted[index - 1] + 1) {
        isContiguous = false;
        break;
      }
    }

    return {
      count: sorted.length,
      min,
      max,
      startsAtOne: min === 1,
      isContiguous,
      duplicateGuideCount,
      duplicateSourceCount
    };
  }

  function handleDomMutation(mutations) {
    if (!panelActive) {
      return;
    }
    if (!shouldRefreshForMutations(mutations)) {
      logger.debug("content", "mutation_ignored", {
        count: Array.isArray(mutations) ? mutations.length : 0
      });
      return;
    }
    window.clearTimeout(handleDomMutation._timerId);
    handleDomMutation._timerId = window.setTimeout(async () => {
      extractor.invalidatePageContextCache();
      scheduleLocationPollingFallback("dom_mutation", 4000);
      const nextContext = getCurrentPageContext({ forceRefresh: true });
      await notifyPageState(nextContext);
      refreshCards(nextContext);
    }, 300);
  }

  async function handleForcedRescan() {
    listingNavigationResetUntil = Date.now() + 7000;
    resetLocalState();
    extractor.invalidatePageContextCache();
    pageContext = getCurrentPageContext({ forceRefresh: true });
    await syncSettings();
    await notifyPageState(pageContext);
    if (panelActive) {
      refreshCards(pageContext);
    }
  }

  async function handleSoftRescan() {
    listingNavigationResetUntil = Date.now() + 7000;
    extractor.invalidatePageContextCache();
    pageContext = getCurrentPageContext({ forceRefresh: true });
    await syncSettings();
    await notifyPageState(pageContext);
    if (panelActive) {
      refreshCards(pageContext);
    }
  }

  function handleScrollToItem(sourceId) {
    const record = sourceId ? sourceIdToRecord.get(sourceId) : null;
    if (!record?.element) {
      return false;
    }
    record.element.scrollIntoView({
      block: "center",
      behavior: "smooth"
    });
    pulseHighlightElement(record.element);
    return true;
  }

  function ensureRuntimeListener() {
    if (runtimeListenerBound) {
      return;
    }
    runtimeListenerBound = true;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "RASHNU_FORCE_RESCAN") {
        handleForcedRescan().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true;
      }
      if (message?.type === "RASHNU_SOFT_RESCAN") {
        handleSoftRescan().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
        return true;
      }
      if (message?.type === "RASHNU_SCROLL_TO_ITEM") {
        sendResponse({
          ok: handleScrollToItem(message.payload?.sourceId)
        });
        return false;
      }
      return false;
    });
  }

  function ensureNavigationListeners() {
    if (navigationListenersBound) {
      return;
    }
    navigationListenersBound = true;

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    locationChangeHandler = (force = false, source = "unknown") => {
      if (!force && lastKnownHref === location.href) {
        return;
      }
      lastKnownHref = location.href;
      listingNavigationResetUntil = Date.now() + 7000;
      navigationEpoch += 1;
      extractor.invalidatePageContextCache();
      resetLocalState();
      const nextContext = getCurrentPageContext({ forceRefresh: true });
      notifyPageState(nextContext)
        .then(() => sendEmptySyncSnapshot(nextContext))
        .catch(() => {});
      logger.debug("content", "navigation_reset", {
        source,
        href: location.href,
        navigationEpoch
      });
      scheduleLocationPollingFallback("navigation");
      if (panelActive) {
        scheduleNavigationRescan();
      }
    };

    history.pushState = function patchedPushState(...args) {
      const result = originalPushState.apply(this, args);
      locationChangeHandler(true, "pushState");
      return result;
    };

    history.replaceState = function patchedReplaceState(...args) {
      const result = originalReplaceState.apply(this, args);
      locationChangeHandler(true, "replaceState");
      return result;
    };

    window.addEventListener("popstate", () => locationChangeHandler(true, "popstate"), true);
    window.addEventListener("hashchange", () => locationChangeHandler(true, "hashchange"), true);
    window.addEventListener(
      "pageshow",
      (event) => {
        if (event?.persisted) {
          locationChangeHandler(true, "pageshow.persisted");
          return;
        }
        if (lastKnownHref !== location.href) {
          locationChangeHandler(true, "pageshow.href_changed");
          return;
        }
        if (panelActive) {
          scheduleLocationPollingFallback("pageshow");
          scheduleNavigationRescan();
        }
      },
      true
    );
  }

  function scheduleNavigationRescan() {
    navigationRescanNonce += 1;
    const nonce = navigationRescanNonce;
    navigationRescanAttempts = 0;
    if (navigationRescanTimer) {
      window.clearTimeout(navigationRescanTimer);
      navigationRescanTimer = null;
    }

    const runAttempt = async () => {
      if (nonce !== navigationRescanNonce) {
        return;
      }
      navigationRescanAttempts += 1;
      const nextContext = getCurrentPageContext({
        forceRefresh: navigationRescanAttempts === 1
      });
      await notifyPageState(nextContext);
      if (!panelActive) {
        navigationRescanTimer = null;
        return;
      }
      await refreshCards(nextContext);
      const hasRows = rowState.size > 0;
      const shouldContinue = navigationRescanAttempts < 8 && (!pageContext?.isSupported || !hasRows);
      if (!shouldContinue) {
        navigationRescanTimer = null;
        return;
      }
      navigationRescanTimer = window.setTimeout(() => {
        runAttempt().catch(() => {});
      }, 280);
    };

    navigationRescanTimer = window.setTimeout(() => {
      runAttempt().catch(() => {});
    }, 220);
  }

  function ensureStorageListener() {
    if (storageListenerBound) {
      return;
    }
    storageListenerBound = true;
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(changes, "rashnuDebugEnabled")) {
        debugEnabled = Boolean(changes.rashnuDebugEnabled.newValue);
      }
      if (Object.prototype.hasOwnProperty.call(changes, "rashnuSelectionModeEnabled")) {
        selectionModeEnabled = Boolean(changes.rashnuSelectionModeEnabled.newValue);
        if (!selectionModeEnabled) {
          clearHighlightedElement();
          focusedSourceId = null;
        } else {
          ensureHighlightStyle();
        }
        scheduleSync();
      }
      if (Object.prototype.hasOwnProperty.call(changes, "rashnuGuideNumbersEnabled")) {
        guideNumbersEnabled = Boolean(changes.rashnuGuideNumbersEnabled.newValue);
        ensureGuideStyle();
        if (panelActive) {
          renderGuideBadges();
        } else {
          clearGuideBadges();
        }
      }
      if (Object.prototype.hasOwnProperty.call(changes, "rashnuPanelActive")) {
        panelActive = Boolean(changes.rashnuPanelActive.newValue);
        if (!panelActive) {
          stopLocationPollingFallback();
          clearGuideBadges();
          clearHighlightedElement();
          focusedSourceId = null;
          resetLocalState();
          notifyPageState(getCurrentPageContext()).catch(() => {});
          return;
        }
        scheduleLocationPollingFallback("panel_active");
        notifyPageState(getCurrentPageContext({ forceRefresh: true })).catch(() => {});
        scheduleNavigationRescan();
      }
    });
  }

  function buildPageKey(context) {
    return `${context.site}|${context.mode}|${context.pageUrl}|${navigationEpoch}`;
  }

  function resetLocalStateIfNeeded(context) {
    const nextPageKey = buildPageKey(context);
    if (nextPageKey === currentPageKey) {
      return;
    }
    currentPageKey = nextPageKey;
    resetLocalState();
  }

  function resetLocalState() {
    if (syncTimer) {
      window.clearTimeout(syncTimer);
      syncTimer = null;
    }
    clearHighlightedElement();
    clearGuideBadges();
    sourceIdToRecord = new Map();
    rowState = new Map();
    guideSequenceBySourceId = new Map();
    nextGuideNumber = 1;
    observedElements = new WeakSet();
    focusedSourceId = null;
    lastPageContextSignature = "";
    lastSyncSignature = "";
    refreshRevision += 1;
    logger.debug("content", "local_state_reset", {
      pageKey: currentPageKey,
      href: location.href
    });
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = new IntersectionObserver(handleIntersection, {
        root: null,
        threshold: 0.2
      });
    }
  }

  function stopLocationPollingFallback() {
    if (locationPollFallbackTimer) {
      window.clearTimeout(locationPollFallbackTimer);
      locationPollFallbackTimer = null;
    }
    if (locationPollTimer) {
      window.clearInterval(locationPollTimer);
      locationPollTimer = null;
    }
  }

  function scheduleLocationPollingFallback(_reason, durationMs = LOCATION_POLL_FALLBACK_WINDOW_MS) {
    if (!panelActive || typeof locationChangeHandler !== "function") {
      stopLocationPollingFallback();
      return;
    }
    if (!locationPollTimer) {
      locationPollTimer = window.setInterval(() => {
        locationChangeHandler(false, "location_poll");
      }, LOCATION_POLL_INTERVAL_MS);
    }
    if (locationPollFallbackTimer) {
      window.clearTimeout(locationPollFallbackTimer);
    }
    // Keep polling as a limited fallback while the panel is active; history events remain the primary signal.
    locationPollFallbackTimer = window.setTimeout(() => {
      stopLocationPollingFallback();
    }, durationMs);
  }

  function ensureHighlightStyle() {
    if (document.getElementById("rashnu-selection-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "rashnu-selection-style";
    style.textContent = `
      [data-rashnu-highlight="true"] {
        outline: 2px solid #ff8c42 !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 0 4px rgba(255, 140, 66, 0.18) !important;
      }
      [data-rashnu-transient-highlight="true"] {
        outline: 2px solid #6fb7ff !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 5px rgba(111, 183, 255, 0.2) !important;
        animation: rashnu-pulse-highlight 1200ms ease;
      }
      @keyframes rashnu-pulse-highlight {
        0% { box-shadow: 0 0 0 0 rgba(111, 183, 255, 0.32); }
        70% { box-shadow: 0 0 0 8px rgba(111, 183, 255, 0); }
        100% { box-shadow: 0 0 0 0 rgba(111, 183, 255, 0); }
      }
    `;
    document.documentElement.appendChild(style);
  }

  function setHighlightedElement(element) {
    if (!selectionModeEnabled || !(element instanceof HTMLElement)) {
      return;
    }
    ensureHighlightStyle();
    if (highlightedElement && highlightedElement !== element) {
      highlightedElement.removeAttribute("data-rashnu-highlight");
    }
    highlightedElement = element;
    highlightedElement.setAttribute("data-rashnu-highlight", "true");
  }

  function clearHighlightedElement() {
    if (!highlightedElement) {
      return;
    }
    highlightedElement.removeAttribute("data-rashnu-highlight");
    highlightedElement = null;
  }

  function pulseHighlightElement(element, duration = 1400) {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    if (transientHighlightElement && transientHighlightElement !== element) {
      transientHighlightElement.removeAttribute("data-rashnu-transient-highlight");
    }
    transientHighlightElement = element;
    transientHighlightElement.setAttribute("data-rashnu-transient-highlight", "true");
    window.clearTimeout(transientHighlightTimer);
    transientHighlightTimer = window.setTimeout(() => {
      transientHighlightElement?.removeAttribute("data-rashnu-transient-highlight");
      transientHighlightElement = null;
    }, duration);
  }

  function ensureGuideStyle() {
    if (document.getElementById("rashnu-guide-style")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "rashnu-guide-style";
    style.textContent = `
      .rashnu-guide-badge {
        position: absolute;
        inset-inline-start: 8px;
        inset-block-start: 8px;
        z-index: 2147483647;
        display: inline-flex;
        min-width: 26px;
        height: 26px;
        align-items: center;
        justify-content: center;
        padding: 0 8px;
        border-radius: 999px;
        background: rgba(17, 19, 23, 0.92);
        border: 1px solid rgba(255, 140, 66, 0.5);
        color: #ffb36b;
        font: 700 12px/1 "SF Pro Display", "Segoe UI", Tahoma, sans-serif;
        box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
        pointer-events: auto;
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
      }
      .rashnu-guide-badge:hover {
        transform: translateY(-1px);
        border-color: rgba(111, 183, 255, 0.72);
        background: rgba(17, 19, 23, 0.98);
      }
    `;
    document.documentElement.appendChild(style);
  }

  function renderGuideBadges() {
    clearGuideBadges();
    if (!guideNumbersEnabled || !panelActive) {
      return;
    }

    for (const record of sourceIdToRecord.values()) {
      if (!(record.element instanceof HTMLElement)) {
        continue;
      }
      ensureElementPositioning(record.element);
      const badge = document.createElement("span");
      badge.className = "rashnu-guide-badge";
      badge.setAttribute("data-rashnu-guide-badge", "true");
      badge.setAttribute("data-source-id", record.item.sourceId);
      badge.textContent = String(record.item.guideNumber || (record.item.position || 0) + 1);
      badge.addEventListener("mouseenter", () => {
        pulseHighlightElement(record.element, 700);
        safeSendMessage({
          type: "RASHNU_GUIDE_BADGE_HOVER",
          payload: {
            sourceId: record.item.sourceId
          }
        });
      });
      badge.addEventListener("mouseleave", () => {
        safeSendMessage({
          type: "RASHNU_GUIDE_BADGE_HOVER",
          payload: {
            sourceId: null
          }
        });
      });
      badge.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        pulseHighlightElement(record.element);
        safeSendMessage({
          type: "RASHNU_GUIDE_BADGE_CLICK",
          payload: {
            sourceId: record.item.sourceId
          }
        });
      });
      record.element.appendChild(badge);
    }
  }

  function clearGuideBadges() {
    document.querySelectorAll("[data-rashnu-guide-badge='true']").forEach((node) => {
      node.remove();
    });
    document.querySelectorAll("[data-rashnu-guide-owner='true']").forEach((element) => {
      if (!(element instanceof HTMLElement)) {
        return;
      }
      const previous = element.getAttribute("data-rashnu-prev-position");
      if (previous != null) {
        element.style.position = previous;
      } else {
        element.style.removeProperty("position");
      }
      element.removeAttribute("data-rashnu-prev-position");
      element.removeAttribute("data-rashnu-guide-owner");
    });
  }

  async function sendEmptySyncSnapshot(context) {
    if (!panelActive) {
      return;
    }
    const snapshot = context || extractor.getPageContext();
    const snapshotPageKey = buildPageKey(snapshot);
    await safeSendMessage({
      type: "RASHNU_SYNC_ITEMS",
      payload: {
        pageKey: snapshotPageKey,
        pageUrl: snapshot?.pageUrl || location.href,
        site: snapshot?.site || "unsupported",
        mode: snapshot?.mode || "unsupported",
        activeGuideNumber: null,
        activeSourceId: null,
        rows: []
      }
    });
    logger.debug("content", "sync_cleared", {
      site: snapshot?.site || "unsupported",
      mode: snapshot?.mode || "unsupported"
    });
  }

  function ensureElementPositioning(element) {
    if (!(element instanceof HTMLElement)) {
      return;
    }
    if (element.getAttribute("data-rashnu-guide-owner") === "true") {
      return;
    }
    const computed = window.getComputedStyle(element).position;
    if (computed === "static") {
      element.setAttribute("data-rashnu-prev-position", element.style.position || "");
      element.style.position = "relative";
      element.setAttribute("data-rashnu-guide-owner", "true");
    }
  }

  async function safeSendMessage(message) {
    if (!globalThis.chrome?.runtime?.id) {
      return null;
    }
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (_error) {
      return null;
    }
  }

  function computeRecordVisibility(record, fallbackValue) {
    if (!record?.element) {
      if (typeof fallbackValue === "boolean") {
        return fallbackValue;
      }
      return pageContext?.mode === "detail" && record?.item?.detailRole === "main";
    }
    return computeElementVisibility(record.element);
  }

  function computeElementVisibility(element) {
    if (!(element instanceof Element)) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return false;
    }
    const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    return visibleWidth > 24 && visibleHeight > 24;
  }

  function computeActiveVisibleRecord() {
    const candidates = Array.from(rowState.values())
      .map((row) => {
        if (!row.isVisible) {
          return null;
        }
        const record = sourceIdToRecord.get(row.item.sourceId);
        if (!record?.element) {
          return null;
        }
        const rect = record.element.getBoundingClientRect();
        return {
          record,
          top: Math.max(rect.top, 0),
          guideNumber: Number.isFinite(row.item.guideNumber) ? row.item.guideNumber : Number.MAX_SAFE_INTEGER
        };
      })
      .filter(Boolean);

    if (!candidates.length) {
      if (pageContext?.mode === "detail") {
        return Array.from(sourceIdToRecord.values()).find((record) => record.item?.detailRole === "main") || null;
      }
      return null;
    }

    candidates.sort((left, right) => {
      if (left.top !== right.top) {
        return left.top - right.top;
      }
      return left.guideNumber - right.guideNumber;
    });

    return candidates[0].record || null;
  }

  function mergeItemSnapshot(previousItem, nextItem) {
    const merged = {
      ...previousItem,
      ...nextItem
    };
    const preserveFields = [
      "title",
      "imageUrl",
      "displayPriceText",
      "displayPriceValue",
      "displayOriginalPriceText",
      "displayOriginalPriceValue",
      "displayDiscountPercent",
      "sourcePriceText",
      "sourcePriceValue",
      "sourceOriginalPriceText",
      "sourceOriginalPriceValue",
      "sourceDiscountPercent"
    ];

    for (const field of preserveFields) {
      if (hasMeaningfulValue(previousItem?.[field]) && !hasMeaningfulValue(nextItem?.[field])) {
        merged[field] = previousItem[field];
      }
    }

    return merged;
  }

  function hasMeaningfulValue(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) && value > 0;
    }
    if (typeof value === "string") {
      const normalized = value.trim();
      return normalized !== "" && normalized !== "نامشخص" && normalized.toLowerCase() !== "unknown";
    }
    return Boolean(value);
  }

  function shouldRefreshForMutations(mutations) {
    if (!Array.isArray(mutations) || !mutations.length) {
      return false;
    }

    for (const mutation of mutations) {
      if (isRashnuNode(mutation.target)) {
        continue;
      }
      if (hasMeaningfulMutationNodes(mutation.addedNodes) || hasMeaningfulMutationNodes(mutation.removedNodes)) {
        return true;
      }
    }

    return false;
  }

  function hasMeaningfulMutationNodes(nodeList) {
    for (const node of Array.from(nodeList || [])) {
      if (isRashnuNode(node)) {
        continue;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        continue;
      }
      if (!(node instanceof Element)) {
        continue;
      }
      if (node.matches?.("script, style, noscript")) {
        continue;
      }
      if (node.querySelector?.(RASHNU_MUTATION_IGNORE_SELECTOR)) {
        const hasExternalNodes = Array.from(node.children || []).some((child) => !isRashnuNode(child));
        if (!hasExternalNodes) {
          continue;
        }
      }
      if (isMeaningfulProductMutation(node)) {
        return true;
      }
    }
    return false;
  }

  function isRashnuNode(node) {
    if (!node) {
      return false;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return isRashnuNode(node.parentElement);
    }
    if (!(node instanceof Element)) {
      return false;
    }
    return Boolean(node.matches?.(RASHNU_MUTATION_IGNORE_SELECTOR) || node.closest?.(RASHNU_MUTATION_IGNORE_SELECTOR));
  }

  function isMeaningfulProductMutation(node) {
    const selectors = [
      'a[href*="/product/"]',
      'a[href*="/p/"]',
      'a[href^="/product/"]',
      'a[href^="/p/"]',
      "article",
      "li",
      "[data-testid*='price']",
      "h1",
      "img"
    ];
    return selectors.some((selector) => node.matches?.(selector) || node.querySelector?.(selector));
  }
})();
