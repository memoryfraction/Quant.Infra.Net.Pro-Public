const DEFAULT_LANG = "en";
const I18N_VERSION = "20260627-static";

window.i18nData = window.i18nData || {};

function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

async function loadI18nFile(lang) {
  if (window.i18nData[lang]) return true;

  if (window.location.protocol === "file:") {
    console.warn(`[i18n] Missing embedded ${lang} data. External JSON fetch is disabled for file:// pages.`);
    return false;
  }

  try {
    const response = await fetch(`./i18n/${lang}.json?v=${I18N_VERSION}`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    window.i18nData[lang] = await response.json();
    return true;
  } catch (error) {
    console.warn(`[i18n] Failed to load ${lang}.json`, error);
    return false;
  }
}

window.setLang = async function setLang(lang) {
  let selectedLang = lang;
  if (!await loadI18nFile(selectedLang)) {
    selectedLang = DEFAULT_LANG;
    if (!await loadI18nFile(selectedLang)) return;
  }

  localStorage.setItem("lang", selectedLang);
  document.documentElement.lang = selectedLang === "zh" ? "zh-CN" : "en";

  const selector = document.getElementById("langSelect");
  if (selector) selector.value = selectedLang;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const value = getNestedValue(window.i18nData[selectedLang], element.dataset.i18n);
    if (value !== null) element.textContent = value;
  });

  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    const value = getNestedValue(window.i18nData[selectedLang], element.dataset.i18nHtml);
    if (value !== null) element.innerHTML = value;
  });

  document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    const value = getNestedValue(window.i18nData[selectedLang], element.dataset.i18nAlt);
    if (value !== null) element.alt = value;
  });
};

window.toggleMobileNav = function toggleMobileNav() {
  document.getElementById("navLinks")?.classList.toggle("open");
};

window.openGallery = function openGallery() {
  document.getElementById("galleryModal")?.classList.add("open");
  document.body.style.overflow = "hidden";
};

window.closeGallery = function closeGallery() {
  document.getElementById("galleryModal")?.classList.remove("open");
  document.body.style.overflow = "";
};

window.openLightbox = function openLightbox(src) {
  const image = document.getElementById("lightboxImg");
  if (image) image.src = src;
  document.getElementById("lightboxOverlay")?.classList.add("open");
  document.body.style.overflow = "hidden";
};

window.closeLightbox = function closeLightbox() {
  document.getElementById("lightboxOverlay")?.classList.remove("open");
  document.body.style.overflow = "";
};

function animateCountUp(element) {
  const target = Number.parseFloat(element.dataset.target);
  const suffix = element.dataset.suffix || "";
  const duration = 2000;
  const start = performance.now();

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = `${Math.round(target * eased)}${suffix}`;
    if (progress < 1) requestAnimationFrame(step);
    else element.textContent = `${target}${suffix}`;
  }

  requestAnimationFrame(step);
}

// ---------- i18n helpers ----------
const I18N_STORAGE_KEY = "lang";

// Language codes that ship with translated content (en, zh).
const SUPPORTED_LANGS = Object.keys(window.i18nData).length ? Object.keys(window.i18nData) : [DEFAULT_LANG, "en", "zh"];

function normalizeLang(lang) {
  const code = String(lang || "").toLowerCase().split("-")[0].split("_")[0];
  return SUPPORTED_LANGS.indexOf(code) !== -1 ? code : null;
}

// Parse an Accept-Language header like "en-US,en;q=0.9,zh-CN;q=0.8" into ranked tags.
function parseAcceptLanguage(header) {
  return String(header || "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 1 };
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.q - a.q);
}

// Pick the best supported language for a visitor without an explicit choice:
// 1) explicit Accept-Language match, 2) navigator.language, 3) DEFAULT_LANG.
function detectBrowserLanguage() {
  const candidates = [];
  if (typeof window !== "undefined" && window.navigator) {
    const al = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    candidates.push(al);
  }
  if (typeof navigator !== "undefined" && typeof navigator.languages === "object" && navigator.languages.length) {
    candidates.push.apply(candidates, navigator.languages.slice(1));
  }
  for (const raw of candidates) {
    const match = normalizeLang(raw);
    if (match) return match;
  }
  return DEFAULT_LANG;
}

// Return the language the visitor previously chose, or null when absent/invalid.
function savedLangInitial() {
  try {
    const saved = localStorage.getItem(I18N_STORAGE_KEY);
    return saved && SUPPORTED_LANGS.indexOf(saved) !== -1 ? saved : null;
  } catch (e) {
    return null;
  }
}
// Keep the language dropdown in sync with the supported languages, preserving the
// current selection when it is still valid. This is what lets new languages be added
// without touching the HTML.
function populateLangSelect(selected) {
  const select = document.getElementById("langSelect");
  if (!select) return;
  const labels = { en: "English", zh: "中文" };
  select.innerHTML = "";
  SUPPORTED_LANGS.forEach((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = labels[code] || code.toUpperCase();
    select.appendChild(option);
  });
  select.value = SUPPORTED_LANGS.indexOf(selected) !== -1 ? selected : SUPPORTED_LANGS[0];
}

document.addEventListener("DOMContentLoaded", () => {
  // Populate the language dropdown from the supported languages (future-proof).
  const saved = savedLangInitial();
  populateLangSelect(saved || detectBrowserLanguage());

  // Default to the saved choice, else the browser language.
  window.setLang(saved || detectBrowserLanguage());

  const img1 = document.getElementById("carouselImg1");
  const img2 = document.getElementById("carouselImg2");
  if (img1 && img2) {
    let showSecond = false;
    setInterval(() => {
      showSecond = !showSecond;
      img1.classList.toggle("hidden", showSecond);
      img2.classList.toggle("hidden", !showSecond);
    }, 4000);
  }

  // Language selector (was inline onchange, blocked by CSP script-src 'self')
  const langSelect = document.getElementById("langSelect");
  if (langSelect) {
    langSelect.addEventListener("change", (event) => {
      window.setLang(event.target.value);
    });
  }

  // Gallery trigger button (was inline onclick)
  document.querySelectorAll(".gallery-trigger").forEach((button) => {
    button.addEventListener("click", () => window.openGallery());
  });

  // Mobile nav toggle (was inline onclick)
  document.getElementById("mobileToggle")?.addEventListener("click", () => window.toggleMobileNav());

  // Gallery close button (was inline onclick)
  document.querySelector(".modal-close")?.addEventListener("click", () => window.closeGallery());

  // Gallery thumbnails -> lightbox (was inline onclick using this.src)
  document.querySelectorAll(".gallery-item img").forEach((img) => {
    img.addEventListener("click", () => window.openLightbox(img.src));
  });

  // Lightbox overlay -> close (was inline onclick)
  document.getElementById("lightboxOverlay")?.addEventListener("click", () => window.closeLightbox());

  document.getElementById("galleryModal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) window.closeGallery();
  });

  window.addEventListener("scroll", () => {
    document.getElementById("navbar")?.classList.toggle("scrolled", window.scrollY > 80);
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", () => {
      document.getElementById("navLinks")?.classList.remove("open");
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      entry.target.querySelectorAll(".stat-number[data-target]").forEach((element) => {
        if (!element.dataset.counted) {
          element.dataset.counted = "1";
          animateCountUp(element);
        }
      });
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.3 });

  document.querySelectorAll(".fade-in").forEach((element) => observer.observe(element));
});
