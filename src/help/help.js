(function () {
  "use strict";

  const languageButton = document.querySelector('[data-action="toggle-language"]');
  const themeButton = document.querySelector('[data-action="cycle-theme"]');
  const heroBrandLink = document.querySelector('[data-role="hero-brand-link"]');
  const themeOrder = ["system", "dark", "light"];
  const translations = {
    fa: {
      languageButton: "FA / EN",
      themeLabel: "تم",
      switchLanguage: "تغییر زبان",
      cycleTheme: "تغییر تم",
      openRepository: "باز کردن گیت‌هاب Rashnu",
      heroSubtitle: "راهنمای استفاده از افزونه مقایسه قیمت Rashnu",
      whatTitle: "این افزونه چه کار می‌کند؟",
      whatBody: "Rashnu هنگام مرور صفحات لیست و جزئیات محصول در <strong>باسلام</strong>، <strong>دیجیکالا</strong>، <strong>ترب</strong>، <strong>تکنولایف</strong>، <strong>ایمالز</strong>، <strong>آمازون</strong> و <strong>eBay</strong>، نتیجه‌ی مقایسه را در پنل کناری نشان می‌دهد. <strong>دیوار</strong> به‌صورت منبع جست‌وجو (search-only) در تنظیمات و جست‌وجوی سراسری در دسترس است.",
      supportedTitle: "صفحه‌های پشتیبانی‌شده",
      supportedList: "<li>صفحات لیست و جست‌وجوی باسلام</li><li>صفحات جزئیات محصول باسلام</li><li>صفحات لیست و جست‌وجوی دیجیکالا</li><li>صفحات جزئیات محصول دیجیکالا</li><li>صفحات لیست و جست‌وجوی ترب</li><li>صفحات جزئیات محصول ترب</li><li>صفحات لیست و جست‌وجوی تکنولایف</li><li>صفحات جزئیات محصول تکنولایف</li><li>صفحات لیست و جست‌وجوی ایمالز</li><li>صفحات جزئیات محصول ایمالز</li><li>صفحات لیست و جست‌وجوی آمازون</li><li>صفحات جزئیات محصول آمازون</li><li>صفحات لیست و جست‌وجوی eBay</li><li>صفحات جزئیات محصول eBay</li><li>دیوار فقط برای جست‌وجو و تطبیق پشتیبانی می‌شود (بدون استخراج از صفحهٔ دیوار).</li>",
      featuresTitle: "ویژگی‌ها",
      featuresList: "<li>مقایسهٔ هم‌زمان قیمت بین چندین منبع در هر کارت</li><li><strong>رنگ مقایسه قیمت</strong>: کمترین قیمت هر کارت سبز و بیشترین قیمت قرمز کم‌رنگ می‌شود</li><li>نمایش درصد <strong>اعتماد</strong> برای هر نتیجهٔ منبع و وضعیت‌های تطبیق (در حال جست‌وجو، خوب، نیاز به بررسی، پیدا نشد، خطا)</li><li>نمایش قیمت اصلی و درصد تخفیف (در صورت موجود بودن)</li><li>مدیریت جداگانهٔ منابع فعال برای <strong>دکمه‌های جست‌وجو</strong> و <strong>نمایش قیمت</strong></li><li>شماره‌گذاری راهنما روی صفحه و داخل پنل</li><li>پرش بین پنل و آیتم واقعی صفحه (Locate) و بازبینی دستی هر آیتم (Reload)</li><li>همگام‌سازی خودکار با آیتم قابل مشاهدهٔ صفحه</li><li>نمای لیست یا گرید، به‌همراه نمای مینیمال و تغییر اندازهٔ نمایش</li><li>جست‌وجوی سراسری در حالت ساده/پیشرفته با فیلترهای include / exclude، شرط وضعیت، گروه‌بندی و ادغام موارد مشابه</li><li>پشتیبانی جست‌وجوی دیوار با انتخاب شهر مستقل</li><li>تغییر زبان (FA/EN) و تم (خودکار/تیره/روشن)</li>",
      globalSearchTitle: "جست‌وجوی سراسری Rashnu",
      globalSearchList: "<li>از دکمه‌ی ذره‌بین در هدر پنل برای باز کردن تب جست‌وجوی سراسری استفاده کنید.</li><li>از دکمه‌ی <strong>جست‌وجوی Rashnu</strong> داخل هر کارت برای باز کردن همان عنوان در جست‌وجوی سراسری استفاده کنید.</li><li>منابع فعال این صفحه را می‌توانید جدا از پنل انتخاب کنید (session-local) و از دکمه‌ی <strong>باز کردن جست‌وجوی همه منابع</strong> استفاده کنید.</li><li>در حالت پیشرفته، <strong>باید شامل شود</strong>، <strong>حذف واژه‌ها</strong>، شرط <strong>فقط نو / فقط کارکرده</strong>، <strong>حداکثر نتیجه برای هر منبع</strong>، <strong>گروه‌بندی</strong> و <strong>ادغام موارد مشابه</strong> در دسترس است.</li><li>پیش‌نمایش کوئری و پیشنهادهای جداگانه برای include و exclude بعد از جست‌وجو نمایش داده می‌شوند.</li><li>جدول نتیجه‌ها ستون‌های منبع، رتبه، عنوان، قیمت، قیمت اصلی، تخفیف، اعتماد و اقدام‌ها را نشان می‌دهد و مرتب‌سازی ستونی دارد.</li><li>برای دیوار، شهر انتخاب‌شده در پنل و تب جست‌وجوی سراسری مشترک است و فقط روی درخواست‌های دیوار اعمال می‌شود.</li><li>میانبرها: Cmd/Ctrl+K، O، S و کلیدهای عددی برای انتخاب سریع منبع‌ها.</li>",
      settingsTitle: "تنظیمات",
      settingsList: "<li><strong>انتخاب عنصر</strong>: فقط محصولی که روی آن hover یا focus می‌شود بررسی و نمایش داده می‌شود.</li><li><strong>همگام با دید صفحه</strong>: پنل سعی می‌کند آیتمی را برجسته کند که کاربر واقعاً در صفحه می‌بیند.</li><li><strong>نمای مینیمال</strong>: کارت‌ها فشرده‌تر می‌شوند و دکمه‌های هر آیتم به حالت آیکونی درمی‌آیند.</li><li><strong>شماره راهنما</strong>: کنار هر محصول روی سایت، یک شماره می‌افتد که همان شماره در Rashnu هم دیده می‌شود.</li><li><strong>رنگ مقایسه قیمت</strong>: رنگ‌بندی کمترین/بیشترین قیمت داخل هر کارت را روشن/خاموش می‌کند.</li><li><strong>منابع فعال</strong>: برای <strong>دکمه‌های جست‌وجو</strong> و <strong>نمایش قیمت</strong> می‌توانید انتخاب جداگانه داشته باشید.</li><li><strong>شهر دیوار</strong>: فقط روی جست‌وجوها و تطبیق‌های دیوار اثر می‌گذارد و استخراج صفحه‌ای برای دیوار فعال نمی‌کند.</li><li><strong>دیباگ</strong>: داده‌های تشخیصی و جزئیات بیشتری در پنل نشان می‌دهد.</li><li><strong>ثبت خودکار لاگ</strong>: فقط وقتی دیباگ روشن باشد فعال می‌شود و وقایع توسعه را به لاگ محلی می‌فرستد.</li><li><strong>خروجی لاگ / پاک کردن لاگ</strong>: لاگ‌های جلسهٔ فعلی را می‌توانید خروجی بگیرید یا پاک کنید.</li><li><strong>چیدمان</strong>: بین لیست و گرید جابه‌جا می‌شود.</li><li><strong>اندازه</strong>: مقیاس کلی پنل و کارت‌ها را کم یا زیاد می‌کند.</li><li><strong>هشدار آمازون و eBay</strong>: آمازون و eBay ممکن است ترافیک افزونه را به‌عنوان رفتار بات تشخیص دهند، بنابراین نتایج این دو منبع همیشه کاملاً قابل اتکا نیست.</li>",
      guideTitle: "کار با راهنما و انتخاب آیتم",
      guideList: "<li>با کلیک روی دکمه‌ی مکان‌یاب هر کارت، صفحه به همان محصول اسکرول می‌شود و هایلایت می‌گردد.</li><li>با hover روی شماره راهنمای روی سایت، آیتم متناظر در پنل برجسته می‌شود.</li><li>با کلیک روی شماره راهنما، پنل به همان آیتم اسکرول می‌کند.</li><li>دکمه‌ی <strong>Reload</strong> هر کارت همان آیتم را دوباره از صفحه/منابع بارگذاری می‌کند.</li><li>دکمه‌ی <strong>جست‌وجوی Rashnu</strong> روی هر کارت، تب جست‌وجوی سراسری را باز می‌کند و همان عنوان را برای شما جست‌وجو می‌کند.</li>",
      loggingTitle: "ثبت لاگ محلی",
      loggingBody1: "برای توسعه، Rashnu از helper محلی استفاده می‌کند و لاگ‌ها را در مسیر زیر می‌نویسد:",
      loggingBody2: "اگر helper فعال نباشد، افزونه همچنان کار می‌کند ولی لاگ فایل‌ها به‌روزرسانی نمی‌شوند.",
      licenseTitle: "مجوز و سازنده",
      licenseBody1: "این پروژه با مجوز <strong>MIT</strong> منتشر می‌شود.",
      licenseBody2: "Creator & Copyright: <strong>Ali Sinaee</strong>"
    },
    en: {
      languageButton: "EN / FA",
      themeLabel: "Theme",
      switchLanguage: "Switch language",
      cycleTheme: "Cycle theme",
      openRepository: "Open Rashnu GitHub repository",
      heroSubtitle: "Guide to using the Rashnu comparison extension",
      whatTitle: "What does this extension do?",
      whatBody: "Rashnu watches listing and product-detail pages on <strong>Basalam</strong>, <strong>Digikala</strong>, <strong>Torob</strong>, <strong>Technolife</strong>, <strong>Emalls</strong>, <strong>Amazon</strong>, and <strong>eBay</strong>, then shows cross-provider comparison results in the side panel. <strong>Divar</strong> is available as a search-only provider in settings and global search.",
      supportedTitle: "Supported pages",
      supportedList: "<li>Basalam listing and search pages</li><li>Basalam product detail pages</li><li>Digikala listing and search pages</li><li>Digikala product detail pages</li><li>Torob listing and search pages</li><li>Torob product detail pages</li><li>Technolife listing and search pages</li><li>Technolife product detail pages</li><li>Emalls listing and search pages</li><li>Emalls product detail pages</li><li>Amazon listing and search pages</li><li>Amazon product detail pages</li><li>eBay listing and search pages</li><li>eBay product detail pages</li><li>Divar is supported for search/matching only (no Divar page extraction).</li>",
      featuresTitle: "Features",
      featuresList: "<li>Cross-provider price comparison inside every item card</li><li><strong>Price Heat Colors</strong>: lowest price in each card is tinted green and highest price is tinted light red</li><li>Per-provider <strong>confidence</strong> percentages and match states (loading, matched, review, not found, error)</li><li>Original price and discount details when available</li><li>Separate active-provider controls for <strong>Search Buttons</strong> and <strong>Show Prices</strong></li><li>Guide numbers on the page and inside the panel</li><li>Locate item on page + reload a single item directly from the card</li><li>Auto-sync with the currently visible page item</li><li>List/grid layouts, minimal mode, and size scaling</li><li>Global search in simple/advanced modes with include/exclude, condition filter, grouping, and duplicate merge</li><li>Divar search support with a shared city selector</li><li>Language switch (FA/EN) and theme modes (System/Dark/Light)</li>",
      globalSearchTitle: "Rashnu Global Search",
      globalSearchList: "<li>Use the search icon in the panel header to open the global-search tab.</li><li>Use the <strong>Rashnu Search</strong> button on any item card to open global search for that exact title.</li><li>Provider selection on this page is session-local and does not overwrite side-panel provider settings.</li><li>Use <strong>Open All Provider Searches</strong> to open direct searches for all active providers.</li><li>Advanced mode includes <strong>Must Include</strong>, <strong>Exclude Words</strong>, <strong>New only / Used only</strong>, <strong>Max Results per Provider</strong>, <strong>Group By Provider</strong>, and <strong>Group Duplicates</strong>.</li><li>Query preview and separate include/exclude refinement suggestions are shown after searches.</li><li>The results table includes provider, rank, title, price, original price, discount, confidence, and action columns with sortable headers.</li><li>The Divar city selector is shared between the side panel and the global-search tab and only affects Divar requests.</li><li>Shortcuts: Cmd/Ctrl+K, O, S, and number keys for quick provider selection.</li>",
      settingsTitle: "Settings",
      settingsList: "<li><strong>Element Select</strong>: only the hovered or focused product is inspected and shown.</li><li><strong>Sync Page View</strong>: Rashnu tries to follow the product that is actually visible on the real page.</li><li><strong>Minimal View</strong>: cards become compact and item actions switch to icon buttons.</li><li><strong>Guide Numbers</strong>: every product on the site gets a number that also appears in Rashnu.</li><li><strong>Price Heat Colors</strong>: toggles lowest/highest price tinting inside each card.</li><li><strong>Active Providers</strong>: you can choose providers separately for <strong>Search Buttons</strong> and <strong>Show Prices</strong>.</li><li><strong>Divar City</strong>: only affects Divar searches and matches; it does not turn Divar pages into supported extraction pages.</li><li><strong>Debug</strong>: shows extra diagnostic details.</li><li><strong>Auto Logs</strong>: sends development events to the local helper only while Debug is enabled.</li><li><strong>Export Logs / Clear Logs</strong>: lets you export or clear logs for the current panel session.</li><li><strong>Layout</strong>: switches between list and grid.</li><li><strong>Size</strong>: changes panel/card scale.</li><li><strong>Amazon/eBay Warning</strong>: Amazon and eBay may detect extension traffic as bot activity, so results on these providers are not always fully reliable.</li>",
      guideTitle: "Guide numbers and item navigation",
      guideList: "<li>Click the locate button on a card to scroll the real page to that item and highlight it.</li><li>Hover a guide badge on the site to highlight the matching Rashnu row.</li><li>Click a guide badge on the site to scroll Rashnu to the matching item.</li><li>Use each card's <strong>Reload</strong> action to refresh just that item.</li><li>The <strong>Rashnu Search</strong> action on each card opens the global-search tab and immediately runs that item title there.</li>",
      loggingTitle: "Local logging",
      loggingBody1: "For development, Rashnu uses a local helper and writes logs to:",
      loggingBody2: "If the helper is not running, the extension still works, but repo log files are not updated.",
      licenseTitle: "License and creator",
      licenseBody1: "This project is released under the <strong>MIT</strong> license.",
      licenseBody2: "Creator & Copyright: <strong>Ali Sinaee</strong>"
    }
  };

  boot().catch(() => {});

  async function boot() {
    const stored = await chrome.storage.local.get(["rashnuLanguage", "rashnuThemeMode"]);
    const language = stored.rashnuLanguage === "en" ? "en" : "fa";
    const themeMode = themeOrder.includes(stored.rashnuThemeMode) ? stored.rashnuThemeMode : "system";
    applyLanguage(language);
    applyTheme(themeMode);

    languageButton?.addEventListener("click", async () => {
      const next = document.documentElement.lang === "en" ? "fa" : "en";
      await chrome.storage.local.set({ rashnuLanguage: next });
      applyLanguage(next);
    });

    themeButton?.addEventListener("click", async () => {
      const current = document.documentElement.dataset.themeMode || "system";
      const next = themeOrder[(themeOrder.indexOf(current) + 1) % themeOrder.length];
      await chrome.storage.local.set({ rashnuThemeMode: next });
      applyTheme(next);
    });
  }

  function applyLanguage(language) {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
    languageButton.textContent = translations[language].languageButton;
    setTitleAndAria(languageButton, translations[language].switchLanguage);
    setTitleAndAria(heroBrandLink, translations[language].openRepository);
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (key && translations[language][key]) {
        node.innerHTML = translations[language][key];
      }
    });
    document.querySelectorAll("[data-i18n-html]").forEach((node) => {
      const key = node.getAttribute("data-i18n-html");
      if (key && translations[language][key]) {
        node.innerHTML = translations[language][key];
      }
    });
    updateThemeButtonLabel(language);
  }

  function applyTheme(themeMode) {
    document.documentElement.dataset.themeMode = themeMode;
    document.documentElement.dataset.theme =
      themeMode === "system"
        ? (window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark")
        : themeMode;
    updateThemeButtonLabel(document.documentElement.lang === "en" ? "en" : "fa");
  }

  function updateThemeButtonLabel(language) {
    const themeMode = document.documentElement.dataset.themeMode || "system";
    const modeLabel =
      language === "en"
        ? { system: "System", dark: "Dark", light: "Light" }[themeMode]
        : { system: "خودکار", dark: "تیره", light: "روشن" }[themeMode];
    themeButton.textContent = `${translations[language].themeLabel}: ${modeLabel}`;
    setTitleAndAria(
      themeButton,
      `${translations[language].cycleTheme}: ${translations[language].themeLabel} ${modeLabel}`
    );
  }

  function setTitleAndAria(element, text) {
    if (!element || !text) {
      return;
    }
    element.title = text;
    element.setAttribute("aria-label", text);
  }
})();
