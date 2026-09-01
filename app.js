const CATALOG_URL = "data/heroes.json";
const HERO_ROOT = "assets/game/heroes/";
const WAKE_ROOT = "assets/game/wake/";
const TELEGRAM_PAYLOAD_LIMIT = 4096;

const query = new URLSearchParams(window.location.search);
const rawListingId = (query.get("ad") || query.get("listing") || "").trim();
const listingId = /^\d{1,12}$/.test(rawListingId) ? rawListingId : "";
const rawDraftId = (query.get("draft") || "").trim();
const draftId = /^[A-Za-z0-9_-]{0,64}$/.test(rawDraftId) ? rawDraftId : "";
const storageKey = `belqess:castle:${listingId || "draft"}:heroes:v1`;

const telegram = window.Telegram?.WebApp;
const isTelegramContext = Boolean(
  telegram && telegram.platform && telegram.platform !== "unknown",
);

const ui = {
  listingBadge: document.getElementById("listingBadge"),
  categoryTitle: document.getElementById("categoryTitle"),
  selectedCount: document.getElementById("selectedCount"),
  heroCatalog: document.getElementById("heroCatalog"),
  loadingState: document.getElementById("loadingState"),
  categoryNav: document.getElementById("categoryNav"),
  saveAll: document.getElementById("saveAll"),
  saveCount: document.getElementById("saveCount"),
  saveStatus: document.getElementById("saveStatus"),
  modal: document.getElementById("heroModal"),
  dialogClose: document.getElementById("dialogClose"),
  dialogHeroImage: document.getElementById("dialogHeroImage"),
  dialogHeroName: document.getElementById("dialogHeroName"),
  dialogCategory: document.getElementById("dialogCategory"),
  dialogMoons: document.getElementById("dialogMoons"),
  wakeBadge: document.getElementById("wakeBadge"),
  yellowOptions: document.getElementById("yellowOptions"),
  redOptions: document.getElementById("redOptions"),
  moonNote: document.getElementById("moonNote"),
  removeHero: document.getElementById("removeHero"),
  saveHero: document.getElementById("saveHero"),
  errorTemplate: document.getElementById("errorTemplate"),
};

const state = {
  categories: [],
  heroes: [],
  categoryById: new Map(),
  heroById: new Map(),
  category: "infantry",
  selected: new Map(),
  editingId: null,
  draft: { yellow: 5, red: 0 },
  dirty: false,
  returnFocus: null,
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selectedLabel(count) {
  if (count === 0) return "0 أبطال";
  if (count === 1) return "بطل واحد";
  if (count === 2) return "بطلان";
  if (count <= 10) return `${count} أبطال`;
  return `${count} بطلًا`;
}

function validMoonState(values) {
  return values
    && Number.isInteger(values.yellow)
    && Number.isInteger(values.red)
    && values.yellow >= 0
    && values.red >= 0
    && values.yellow <= 5
    && values.red <= 5
    && values.yellow + values.red <= 5;
}

function normalizeSelection(items) {
  if (!Array.isArray(items)) return new Map();
  const normalized = new Map();
  for (const item of items) {
    const heroId = Array.isArray(item) ? item[0] : item?.id ?? item?.heroId;
    const yellow = Array.isArray(item) ? item[1] : item?.yellow;
    const red = Array.isArray(item) ? item[2] : item?.red;
    const values = { yellow, red };
    if (!state.heroById.has(heroId) || normalized.has(heroId) || !validMoonState(values)) {
      continue;
    }
    normalized.set(heroId, values);
  }
  return normalized;
}

function compactSelection() {
  return [...state.selected.entries()]
    .sort(([firstId], [secondId]) => firstId - secondId)
    .map(([heroId, values]) => [heroId, values.yellow, values.red]);
}

function heroImage(hero, values) {
  if (values?.red > 0 && hero.wake) {
    return `${WAKE_ROOT}hero_icon_${hero.id}_wake.png`;
  }
  return `${HERO_ROOT}hero_icon_${hero.id}.png`;
}

function moonMarkup(values, size = "mini") {
  const red = values?.red || 0;
  const yellow = values?.yellow || 0;
  const empty = Math.max(0, 5 - red - yellow);
  return [
    ...Array(red).fill("red"),
    ...Array(yellow).fill("yellow"),
    ...Array(empty).fill("empty"),
  ].map(color => `<span class="${size}-moon ${color}" aria-hidden="true"></span>`).join("");
}

function moonSummary(values) {
  return `${values.yellow} أصفر، ${values.red} أحمر`;
}

function renderCategories() {
  ui.categoryNav.innerHTML = state.categories.map(category => `
    <button
      class="category-button"
      type="button"
      data-category="${escapeHtml(category.id)}"
      aria-pressed="${category.id === state.category}"
    >
      <img src="${escapeHtml(category.icon)}" alt="" width="80" height="54">
      <span>${escapeHtml(category.label)}</span>
    </button>
  `).join("");
}

function renderCatalog() {
  const category = state.categoryById.get(state.category);
  if (!category) return;

  ui.categoryTitle.textContent = category.label;
  ui.selectedCount.textContent = selectedLabel(state.selected.size);
  ui.saveCount.textContent = String(state.selected.size);

  ui.heroCatalog.innerHTML = state.heroes
    .filter(hero => hero.category === state.category)
    .map(hero => {
      const values = state.selected.get(hero.id);
      const actionLabel = values
        ? `${hero.name}، تم اختياره، ${moonSummary(values)}`
        : `${hero.name}، اضغط للإضافة`;
      return `
        <button
          class="catalog-hero${values ? " is-selected" : ""}"
          type="button"
          data-hero-id="${hero.id}"
          aria-label="${escapeHtml(actionLabel)}"
        >
          ${values ? '<span class="selected-mark" aria-hidden="true">✓</span>' : ""}
          <img
            src="${heroImage(hero, values)}"
            alt="صورة ${escapeHtml(hero.name)}"
            width="150"
            height="150"
            loading="lazy"
          >
          <span class="catalog-name">${escapeHtml(hero.name)}</span>
          <span class="catalog-state">
            ${values ? moonMarkup(values) : "اضغط للإضافة"}
          </span>
        </button>
      `;
    }).join("");
}

function renderNumberOptions() {
  const makeOptions = (color, label) => Array.from({ length: 6 }, (_, value) => `
    <button
      class="number-option"
      type="button"
      data-moon-color="${color}"
      data-value="${value}"
      aria-label="${value} ${label}"
      aria-pressed="${state.draft[color] === value}"
    >${value}</button>
  `).join("");
  ui.yellowOptions.innerHTML = makeOptions("yellow", "أهلة صفراء");
  ui.redOptions.innerHTML = makeOptions("red", "أهلة حمراء");
}

function renderDialog() {
  const hero = state.heroById.get(state.editingId);
  if (!hero) return;

  const category = state.categoryById.get(hero.category);
  const usesWakeImage = state.draft.red > 0 && hero.wake;
  ui.dialogHeroName.textContent = hero.name;
  ui.dialogHeroImage.src = heroImage(hero, state.draft);
  ui.dialogHeroImage.alt = `صورة ${hero.name}`;
  ui.dialogCategory.textContent = category.label;
  ui.dialogMoons.innerHTML = moonMarkup(state.draft, "preview");
  ui.wakeBadge.hidden = !usesWakeImage;
  ui.removeHero.hidden = !state.selected.has(hero.id);
  ui.moonNote.innerHTML = `إجمالي الأهلة: <strong>${state.draft.yellow + state.draft.red} من 5</strong>`;
  renderNumberOptions();
}

function setupTelegram() {
  if (!isTelegramContext) return;
  try {
    telegram.ready();
    telegram.expand();
    telegram.setHeaderColor?.("#041f27");
    telegram.setBackgroundColor?.("#02171d");
  } catch {
    // The page remains fully usable in regular browsers.
  }
}

function haptic(kind = "selection") {
  try {
    if (kind === "success") {
      telegram?.HapticFeedback?.notificationOccurred("success");
    } else {
      telegram?.HapticFeedback?.selectionChanged();
    }
  } catch {
    // Haptics are optional.
  }
}

function setStatus(message, { error = false } = {}) {
  ui.saveStatus.textContent = message;
  ui.saveStatus.classList.toggle("is-error", error);
}

function markDirty(message) {
  state.dirty = true;
  setStatus(message);
}

function openHero(heroId, trigger) {
  const hero = state.heroById.get(heroId);
  if (!hero) return;
  state.editingId = heroId;
  state.draft = { ...(state.selected.get(heroId) || { yellow: 5, red: 0 }) };
  state.returnFocus = trigger || null;
  renderDialog();
  ui.modal.hidden = false;
  document.body.classList.add("modal-open");
  window.requestAnimationFrame(() => ui.dialogClose.focus());
  haptic();
}

function closeDialog() {
  ui.modal.hidden = true;
  document.body.classList.remove("modal-open");
  state.editingId = null;
  state.returnFocus?.focus?.();
  state.returnFocus = null;
}

function chooseMoonValue(color, value) {
  const other = color === "yellow" ? "red" : "yellow";
  state.draft[color] = value;
  if (state.draft[color] + state.draft[other] > 5) {
    state.draft[other] = 5 - value;
  }
  renderDialog();
  haptic();
}

function saveCurrentHero() {
  if (!state.heroById.has(state.editingId) || !validMoonState(state.draft)) return;
  state.selected.set(state.editingId, { ...state.draft });
  renderCatalog();
  closeDialog();
  markDirty("تم تحديث البطل؛ احفظ جميع الأبطال عند الانتهاء.");
  haptic("success");
}

function removeCurrentHero() {
  if (!state.heroById.has(state.editingId)) return;
  state.selected.delete(state.editingId);
  renderCatalog();
  closeDialog();
  markDirty("أُزيل البطل من الاختيار؛ احفظ الجميع لتثبيت التغيير.");
  haptic();
}

function saveLocalDraft(selection) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(selection));
    return true;
  } catch {
    return false;
  }
}

function loadLocalDraft() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
    return normalizeSelection(saved);
  } catch {
    return new Map();
  }
}

function buildPayload(selection) {
  return {
    action: "save_castle_heroes",
    v: 1,
    ad: listingId,
    draft: draftId,
    heroes: selection,
  };
}

async function loadAdvertisementHeroes() {
  if (!listingId || isTelegramContext || window.location.protocol === "file:") return false;
  try {
    const response = await window.fetch(`/api/ads/${encodeURIComponent(listingId)}/heroes`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return false;
    const payload = await response.json();
    state.selected = normalizeSelection(payload.heroes);
    return true;
  } catch {
    return false;
  }
}

async function saveThroughApi(payload) {
  if (!listingId || window.location.protocol === "file:") {
    return { ok: false, reason: "draft" };
  }
  try {
    const response = await window.fetch(`/api/ads/${encodeURIComponent(listingId)}/heroes`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (response.ok) return { ok: true };
    if (response.status === 404) return { ok: false, reason: "missing" };
    return { ok: false, reason: "server" };
  } catch {
    return { ok: false, reason: "offline" };
  }
}

function sendThroughTelegram(payload) {
  if (!isTelegramContext || typeof telegram?.sendData !== "function") return false;
  const encoded = JSON.stringify(payload);
  const byteLength = new Blob([encoded]).size;
  if (byteLength > TELEGRAM_PAYLOAD_LIMIT) {
    throw new Error("telegram-payload-too-large");
  }
  telegram.sendData(encoded);
  return true;
}

async function saveAllHeroes() {
  const selection = compactSelection();
  const payload = buildPayload(selection);
  const localSaved = saveLocalDraft(selection);

  ui.saveAll.disabled = true;
  setStatus("جاري حفظ بيانات الأبطال…");
  window.dispatchEvent(new CustomEvent("belqess:heroes-saved", { detail: payload }));

  try {
    if (sendThroughTelegram(payload)) {
      state.dirty = false;
      setStatus(`تم إرسال ${selectedLabel(state.selected.size)} إلى الإعلان.`);
      haptic("success");
      return;
    }

    const apiResult = await saveThroughApi(payload);
    if (apiResult.ok) {
      state.dirty = false;
      setStatus(`تم حفظ ${selectedLabel(state.selected.size)} ضمن الإعلان ${listingId}.`);
      haptic("success");
      return;
    }

    state.dirty = false;
    if (!localSaved) {
      setStatus("تعذّر الحفظ محليًا أو داخل بيانات الإعلان.", { error: true });
    } else if (apiResult.reason === "missing") {
      setStatus("حُفظت مسودة محلية؛ رقم الإعلان غير موجود في قاعدة البيانات.", { error: true });
    } else if (!listingId) {
      setStatus("حُفظت مسودة محلية. افتح الصفحة مع رقم إعلان للحفظ النهائي.");
    } else {
      setStatus("حُفظت مسودة محلية؛ تعذّر الوصول إلى بيانات الإعلان.", { error: true });
    }
  } catch {
    setStatus("تعذّر إرسال بيانات الأبطال إلى Telegram.", { error: true });
  } finally {
    ui.saveAll.disabled = false;
  }
}

function showLoadError() {
  ui.loadingState.replaceWith(ui.errorTemplate.content.cloneNode(true));
  setStatus("تعذّر تحميل كتالوج الأبطال.", { error: true });
}

async function initialize() {
  setupTelegram();
  ui.listingBadge.textContent = listingId ? `الإعلان ${listingId}` : "وضع المعاينة";
  if (rawListingId && !listingId) {
    setStatus("رقم الإعلان في الرابط غير صالح؛ سيُستخدم وضع المسودة.", { error: true });
  }

  try {
    const response = await window.fetch(CATALOG_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("catalog-not-found");
    const catalog = await response.json();
    if (!Array.isArray(catalog.categories) || !Array.isArray(catalog.heroes)) {
      throw new Error("invalid-catalog");
    }

    state.categories = catalog.categories;
    state.heroes = catalog.heroes;
    state.categoryById = new Map(catalog.categories.map(category => [category.id, category]));
    state.heroById = new Map(catalog.heroes.map(hero => [hero.id, hero]));
    if (state.heroes.length !== 67 || state.heroById.has(67)) {
      throw new Error("unexpected-catalog");
    }

    state.selected = loadLocalDraft();
    const loadedFromAdvertisement = await loadAdvertisementHeroes();
    renderCategories();
    renderCatalog();
    ui.loadingState.hidden = true;
    ui.saveAll.disabled = false;

    if (loadedFromAdvertisement) {
      setStatus(`تم تحميل أبطال الإعلان ${listingId}.`);
    } else if (state.selected.size) {
      setStatus("تمت استعادة آخر مسودة محفوظة على هذا الجهاز.");
    }
  } catch {
    showLoadError();
  }
}

ui.categoryNav.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button || !state.categoryById.has(button.dataset.category)) return;
  state.category = button.dataset.category;
  renderCategories();
  renderCatalog();
  ui.heroCatalog.scrollIntoView({ behavior: "smooth", block: "start" });
  haptic();
});

ui.heroCatalog.addEventListener("click", event => {
  const button = event.target.closest("[data-hero-id]");
  if (button) openHero(Number(button.dataset.heroId), button);
});

ui.modal.addEventListener("click", event => {
  if (event.target === ui.modal) closeDialog();
  const button = event.target.closest("[data-moon-color]");
  if (button) {
    chooseMoonValue(button.dataset.moonColor, Number(button.dataset.value));
  }
});

ui.dialogClose.addEventListener("click", closeDialog);
ui.saveHero.addEventListener("click", saveCurrentHero);
ui.removeHero.addEventListener("click", removeCurrentHero);
ui.saveAll.addEventListener("click", saveAllHeroes);

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !ui.modal.hidden) closeDialog();
});

window.addEventListener("beforeunload", event => {
  if (!state.dirty || isTelegramContext) return;
  event.preventDefault();
  event.returnValue = "";
});

initialize();
