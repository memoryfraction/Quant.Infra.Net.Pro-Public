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

document.addEventListener("DOMContentLoaded", () => {
  const savedLang = localStorage.getItem("lang");
  const browserLang = navigator.language.startsWith("zh") ? "zh" : "en";
  window.setLang(savedLang || browserLang || DEFAULT_LANG);

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
