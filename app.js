const CATALOG_URL = "data/heroes.json";
const HERO_ROOT = "assets/game/heroes/";
const WAKE_ROOT = "assets/game/wake/";
const TELEGRAM_PAYLOAD_LIMIT = 4096;

const HERO_DISPLAY = [
  { id: 55, name: "مختار", category: "infantry" },
  { id: 44, name: "محمد الفتاح", category: "infantry" },
  { id: 64, name: "ماوية", category: "infantry" },
  { id: 60, name: "زينب", category: "infantry" },
  { id: 33, name: "قلاوون", category: "infantry" },
  { id: 47, name: "أرطغل", category: "infantry" },
  { id: 63, name: "جوهر", category: "cavalry" },
  { id: 59, name: "بارون", category: "cavalry" },
  { id: 54, name: "إسكندر", category: "cavalry" },
  { id: 51, name: "بوراك", category: "cavalry" },
  { id: 48, name: "هارون", category: "cavalry" },
  { id: 42, name: "عبدالرحمن", category: "cavalry" },
  { id: 49, name: "حليمة", category: "ranged" },
  { id: 61, name: "أتيلا", category: "ranged" },
  { id: 43, name: "كوسم", category: "ranged" },
  { id: 69, name: "أورخان", category: "ranged" },
  { id: 65, name: "قايتباي", category: "ranged" },
  { id: 57, name: "خير الدين بربروس", category: "ranged" },
  { id: 52, name: "زرقاء", category: "ranged" },
  { id: 66, name: "برقوق", category: "siege" },
  { id: 62, name: "كافور", category: "siege" },
  { id: 56, name: "قطز", category: "siege" },
  { id: 53, name: "مالك", category: "siege" },
  { id: 41, name: "صلاح", category: "siege" },
  { id: 36, name: "زينب", category: "siege" },
  { id: 70, name: "نفرتيتي", category: "siege" },
];

const FORM_KEYS = [
  "name",
  "phone",
  "castle_level",
  "honor_badges",
  "science_power",
  "compensated_power",
  "zeroed_power",
  "reserve",
  "golden_seal",
  "blue_equipment",
  "purple_equipment",
  "bag_description",
  "additional_heroes",
  "legion_capacity",
  "firing_power",
];

const PUBLIC_FORM_KEYS = FORM_KEYS.filter(key => key !== "name" && key !== "phone");
const PUBLIC_FORM_ALIASES = {
  l: "castle_level",
  b: "honor_badges",
  s: "science_power",
  c: "compensated_power",
  z: "zeroed_power",
  r: "reserve",
  g: "golden_seal",
  e: "blue_equipment",
  u: "purple_equipment",
  k: "bag_description",
  x: "additional_heroes",
  q: "legion_capacity",
  i: "firing_power",
};
const PUBLIC_FIELD_PRESENTATION = {
  castle_level: { castleLevel: true },
  honor_badges: { unit: "شارة" },
  science_power: { unit: "مليون", scale: 1_000_000 },
  compensated_power: { unit: "مليون", scale: 1_000_000 },
  zeroed_power: { unit: "مليون", scale: 1_000_000 },
  reserve: { unit: "مليون", scale: 1_000_000 },
  golden_seal: { unit: "ختم" },
  blue_equipment: { unit: "قطعة" },
  purple_equipment: { unit: "قطعة" },
  bag_description: { text: true },
  additional_heroes: { text: true },
  legion_capacity: { unit: "ألف", scale: 1_000 },
  firing_power: { unit: "مليون", scale: 1_000_000 },
};
const MAX_PUBLIC_VIEW_TOKEN_LENGTH = 12000;

function formValueLimit(key) {
  return key === "bag_description" ? 600 : 500;
}

const query = new URLSearchParams(window.location.search);
const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const rawPublicViewToken = (fragment.get("view") || query.get("view") || "").trim();
const viewModeRequested = Boolean(rawPublicViewToken);
let publicViewData = null;
let publicViewError = "";
if (viewModeRequested) {
  try {
    publicViewData = decodePublicViewPayload(rawPublicViewToken);
  } catch {
    publicViewError = "رابط عرض القلعة غير صالح أو غير مكتمل.";
  }
}

const rawListingId = String(publicViewData?.ad || query.get("ad") || query.get("listing") || "").trim();
const listingId = /^\d{1,12}$/.test(rawListingId) ? rawListingId : "";
const rawDraftId = (query.get("draft") || "").trim();
const draftId = /^[A-Za-z0-9_-]{0,64}$/.test(rawDraftId) ? rawDraftId : "";
const storageKey = `belqess:castle:${listingId || "draft"}:form:v2`;
const legacyStorageKey = `belqess:castle:${listingId || "draft"}:heroes:v1`;

const telegram = window.Telegram?.WebApp;
const isTelegramContext = Boolean(telegram && telegram.platform && telegram.platform !== "unknown");

const ui = {
  form: document.getElementById("castleForm"),
  formFields: [...document.querySelectorAll("[data-form-key]")],
  pageTitle: document.getElementById("pageTitle"),
  listingBadge: document.getElementById("listingBadge"),
  welcomeEyebrow: document.getElementById("welcomeEyebrow"),
  welcomeTitle: document.getElementById("welcomeTitle"),
  welcomeText: document.getElementById("welcomeText"),
  viewPrice: document.getElementById("viewPrice"),
  viewPriceValue: document.getElementById("viewPriceValue"),
  ownerTitle: document.getElementById("ownerTitle"),
  ownerDescription: document.getElementById("ownerDescription"),
  powerDescription: document.getElementById("powerDescription"),
  equipmentDescription: document.getElementById("equipmentDescription"),
  detailsDescription: document.getElementById("detailsDescription"),
  bagDescriptionLabel: document.getElementById("bagDescriptionLabel"),
  categoryTitle: document.getElementById("categoryTitle"),
  selectedCount: document.getElementById("selectedCount"),
  heroCatalog: document.getElementById("heroCatalog"),
  loadingState: document.getElementById("loadingState"),
  categoryNav: document.getElementById("categoryNav"),
  heroesDescription: document.getElementById("heroesDescription"),
  editorHint: document.getElementById("editorHint"),
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
  viewMode: viewModeRequested,
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

function decodeBase64Url(token) {
  if (!token || token.length > MAX_PUBLIC_VIEW_TOKEN_LENGTH || !/^[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error("invalid-view-token");
  }
  const padded = token.replaceAll("-", "+").replaceAll("_", "/")
    + "=".repeat((4 - (token.length % 4)) % 4);
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (typeof TextDecoder === "function") return new TextDecoder().decode(bytes);
  const encodedBytes = [...bytes].map(byte => `%${byte.toString(16).padStart(2, "0")}`).join("");
  return decodeURIComponent(encodedBytes);
}

function normalizePublicForm(rawForm) {
  if (!rawForm || typeof rawForm !== "object" || Array.isArray(rawForm)) {
    throw new Error("invalid-public-form");
  }
  const expanded = {};
  for (const key of PUBLIC_FORM_KEYS) {
    if (rawForm[key] !== undefined) expanded[key] = rawForm[key];
  }
  for (const [alias, key] of Object.entries(PUBLIC_FORM_ALIASES)) {
    if (expanded[key] === undefined && rawForm[alias] !== undefined) expanded[key] = rawForm[alias];
  }
  return Object.fromEntries(
    PUBLIC_FORM_KEYS.map(key => [key, String(expanded[key] ?? "").slice(0, formValueLimit(key))])
  );
}

function decodePublicViewPayload(token) {
  const raw = JSON.parse(decodeBase64Url(token));
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || Number(raw.v) !== 1) {
    throw new Error("invalid-public-payload");
  }

  const ad = String(raw.ad ?? raw.a ?? "").trim();
  if (!/^\d{1,12}$/.test(ad)) throw new Error("invalid-public-ad");

  const numericPrice = Number(raw.price ?? raw.p);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) throw new Error("invalid-public-price");

  const rawHeroes = raw.heroes ?? raw.h;
  if (!Array.isArray(rawHeroes) || rawHeroes.length > HERO_DISPLAY.length) {
    throw new Error("invalid-public-heroes");
  }
  const allowedHeroIds = new Set(HERO_DISPLAY.map(hero => hero.id));
  const seenHeroIds = new Set();
  const heroes = rawHeroes.map(item => {
    const id = Number(Array.isArray(item) ? item[0] : item?.id ?? item?.heroId);
    const yellow = Number(Array.isArray(item) ? item[1] : item?.yellow ?? item?.y);
    const red = Number(Array.isArray(item) ? item[2] : item?.red ?? item?.r);
    if (!allowedHeroIds.has(id) || seenHeroIds.has(id) || !validMoonState({ yellow, red })) {
      throw new Error("invalid-public-hero");
    }
    seenHeroIds.add(id);
    return [id, yellow, red];
  });

  return {
    ad,
    price: numericPrice,
    form: normalizePublicForm(raw.form ?? raw.f),
    heroes,
  };
}

function formatPublicPrice(value) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}$`;
}

function formatPublicFieldValue(rawValue, scale = 1) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return "—";
  const normalized = raw.replaceAll(",", "");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) return "غير محدد";
  const scaled = scale > 1 && numeric >= scale ? numeric / scale : numeric;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(scaled);
}

function formatCastleLevel(rawValue) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return "—";
  const numeric = Number(raw);
  if (!Number.isInteger(numeric) || numeric < 0) return "غير محدد";
  if (numeric >= 31 && numeric <= 35) return `★ ${numeric - 30}`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numeric);
}

function describeCastleLevel(rawValue) {
  const raw = String(rawValue ?? "").trim();
  const numeric = Number(raw);
  if (!raw || !Number.isInteger(numeric) || numeric < 0) return "غير محدد";
  if (numeric <= 30 || numeric > 35) return `المستوى ${numeric}`;
  const stars = numeric - 30;
  if (stars === 1) return "نجمة واحدة";
  if (stars === 2) return "نجمتان";
  return `${stars} نجوم`;
}

function renderPublicWelcomeTitle(level) {
  const levelNode = document.createElement("bdi");
  levelNode.dir = "ltr";
  levelNode.className = "castle-level-inline";
  levelNode.textContent = level;
  ui.welcomeTitle.replaceChildren(
    document.createTextNode("قلعة مستوى "),
    levelNode,
    document.createTextNode(" — المواصفات والأبطال"),
  );
}

function renderPublicSpecifications() {
  for (const field of ui.formFields) {
    if (field.closest(".owner-private-field")) continue;
    const container = field.closest(".form-field, .equipment-field");
    if (!container) continue;

    const key = field.dataset.formKey;
    const presentation = PUBLIC_FIELD_PRESENTATION[key] || {};
    const rawValue = field.value.trim();
    const labelNode = container.querySelector(":scope > span:not(.equipment-swatch)");
    const label = labelNode?.textContent.replace("*", "").trim() || key;
    let output = container.querySelector(".public-field-value");
    if (!output) {
      output = document.createElement("output");
      output.className = "public-field-value";
      output.dataset.formOutput = key;
      container.append(output);
    }

    field.hidden = true;
    container.classList.add("public-spec-card");
    if (presentation.text && !rawValue) {
      container.hidden = true;
      continue;
    }
    container.hidden = false;

    const displayValue = presentation.text
      ? rawValue
      : presentation.castleLevel
        ? formatCastleLevel(rawValue)
        : formatPublicFieldValue(rawValue, presentation.scale);
    output.classList.toggle("is-text", Boolean(presentation.text));
    output.classList.toggle("is-empty", !rawValue);
    output.replaceChildren();

    const valueNode = document.createElement("span");
    valueNode.textContent = displayValue;
    output.append(valueNode);
    if (presentation.unit && rawValue) {
      const unitNode = document.createElement("small");
      unitNode.textContent = presentation.unit;
      output.append(unitNode);
    }
    const accessibleValue = presentation.castleLevel ? describeCastleLevel(rawValue) : displayValue;
    output.setAttribute("aria-label", `${label}: ${accessibleValue}${presentation.unit && rawValue ? ` ${presentation.unit}` : ""}`);
  }

  const level = formatCastleLevel(publicViewData?.form?.castle_level);
  if (level !== "غير محدد" && level !== "—") {
    renderPublicWelcomeTitle(level);
  }
}

function normalizeSelection(items) {
  if (!Array.isArray(items)) return new Map();
  const normalized = new Map();
  for (const item of items) {
    const heroId = Number(Array.isArray(item) ? item[0] : item?.id ?? item?.heroId);
    const yellow = Number(Array.isArray(item) ? item[1] : item?.yellow);
    const red = Number(Array.isArray(item) ? item[2] : item?.red);
    const values = { yellow, red };
    if (!state.heroById.has(heroId) || normalized.has(heroId) || !validMoonState(values)) continue;
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
  if (values?.red > 0 && hero.wake) return `${WAKE_ROOT}hero_icon_${hero.id}_wake.png`;
  return `${HERO_ROOT}hero_icon_${hero.id}.png`;
}

function moonMarkup(values, size = "mini") {
  const red = values?.red || 0;
  const yellow = values?.yellow || 0;
  const empty = Math.max(0, 5 - red - yellow);
  return [...Array(red).fill("red"), ...Array(yellow).fill("yellow"), ...Array(empty).fill("empty")]
    .map(color => `<span class="${size}-moon ${color}" aria-hidden="true"></span>`)
    .join("");
}

function moonSummary(values) {
  return `${values.yellow} أصفر، ${values.red} أحمر`;
}

function collectForm() {
  return Object.fromEntries(ui.formFields.map(field => [field.dataset.formKey, field.value.trim()]));
}

function normalizeForm(form) {
  if (!form || typeof form !== "object" || Array.isArray(form)) return {};
  return Object.fromEntries(FORM_KEYS.map(key => [key, String(form[key] ?? "").slice(0, formValueLimit(key))]));
}

function applyForm(form) {
  const normalized = normalizeForm(form);
  for (const field of ui.formFields) field.value = normalized[field.dataset.formKey] || "";
}

function renderCategories() {
  const visibleCategories = state.viewMode
    ? state.categories.filter(category => state.heroes.some(
      hero => hero.category === category.id && state.selected.has(hero.id)
    ))
    : state.categories;
  ui.categoryNav.hidden = visibleCategories.length === 0;
  ui.categoryNav.innerHTML = visibleCategories.map(category => {
    const count = state.heroes.filter(hero => (
      hero.category === category.id && (!state.viewMode || state.selected.has(hero.id))
    )).length;
    return `
      <button class="category-button" type="button" data-category="${escapeHtml(category.id)}" aria-pressed="${category.id === state.category}">
        <img src="${escapeHtml(category.icon)}" alt="" width="80" height="54">
        <span>${escapeHtml(category.label)}</span>
        <small>${count}</small>
      </button>
    `;
  }).join("");
}

function renderCatalog() {
  const category = state.categoryById.get(state.category);
  const categoryHeroes = category
    ? state.heroes.filter(hero => (
      hero.category === state.category && (!state.viewMode || state.selected.has(hero.id))
    ))
    : [];
  ui.categoryTitle.textContent = category?.label || "لا توجد فئة";
  ui.selectedCount.textContent = selectedLabel(state.selected.size);
  ui.saveCount.textContent = selectedLabel(state.selected.size);

  if (state.viewMode && categoryHeroes.length === 0) {
    ui.heroCatalog.innerHTML = '<div class="empty-heroes" role="status">لم تُحدّد أبطال لهذا الإعلان.</div>';
    return;
  }

  ui.heroCatalog.innerHTML = categoryHeroes
    .map(hero => {
      const values = state.selected.get(hero.id);
      const actionLabel = values ? `${hero.name}، تم اختياره، ${moonSummary(values)}` : `${hero.name}، اضغط للإضافة`;
      if (state.viewMode) {
        return `
          <article class="catalog-hero is-selected is-readonly" aria-label="${escapeHtml(actionLabel)}">
            <img src="${heroImage(hero, values)}" alt="صورة ${escapeHtml(hero.name)}" width="150" height="150" loading="lazy">
            <span class="catalog-name">${escapeHtml(hero.name)}</span>
            <span class="catalog-state" aria-label="${escapeHtml(moonSummary(values))}">${moonMarkup(values)}</span>
          </article>
        `;
      }
      return `
        <button class="catalog-hero${values ? " is-selected" : ""}" type="button" data-hero-id="${hero.id}" aria-label="${escapeHtml(actionLabel)}">
          ${values ? '<span class="selected-mark" aria-hidden="true">✓</span>' : ""}
          <img src="${heroImage(hero, values)}" alt="صورة ${escapeHtml(hero.name)}" width="150" height="150" loading="lazy">
          <span class="catalog-name">${escapeHtml(hero.name)}</span>
          <span class="catalog-state">${values ? moonMarkup(values) : "اضغط للإضافة"}</span>
        </button>
      `;
    }).join("");
}

function renderNumberOptions() {
  const makeOptions = (color, label) => Array.from({ length: 6 }, (_, value) => `
    <button class="number-option" type="button" data-moon-color="${color}" data-value="${value}" aria-label="${value} ${label}" aria-pressed="${state.draft[color] === value}">${value}</button>
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
    telegram.setHeaderColor?.("#051b24");
    telegram.setBackgroundColor?.("#03151c");
  } catch {
    // The form remains usable in regular browsers.
  }
}

function setupPublicView() {
  document.body.classList.add("view-mode");
  document.title = `بلقيس | عرض القلعة ${publicViewData?.ad || ""}`.trim();
  ui.pageTitle.textContent = "عرض القلعة";
  ui.welcomeEyebrow.textContent = publicViewData ? `إعلان رقم ${publicViewData.ad} من بلقيس` : "عرض قلعة من بلقيس";
  ui.welcomeTitle.textContent = "مواصفات القلعة وأبطالها";
  ui.welcomeText.hidden = true;
  ui.ownerTitle.textContent = "مواصفات القلعة";
  ui.ownerDescription.textContent = "المستوى وأهم بيانات الحساب";
  ui.powerDescription.textContent = "الأرقام الأساسية في لمحة واضحة";
  ui.equipmentDescription.textContent = "القطع المميزة حسب اللون";
  ui.detailsDescription.textContent = "محتويات الحقيبة وباقي التفاصيل المهمة للقلعة";
  ui.bagDescriptionLabel.textContent = "وصف الحقيبة";
  ui.heroesDescription.textContent = "تشكيلة الأبطال وحالة الأهلة لكل بطل";
  ui.editorHint.textContent = "اختر الفئة لمشاهدة أبطالها؛ وتظهر صورة الاستيقاظ عند وجود أهلة حمراء.";
  ui.viewPrice.hidden = !publicViewData;
  ui.viewPriceValue.textContent = publicViewData ? formatPublicPrice(publicViewData.price) : "";
  ui.listingBadge.textContent = publicViewData ? `الإعلان ${publicViewData.ad}` : "رابط غير صالح";
  ui.form.setAttribute("aria-label", "مواصفات إعلان القلعة");
  ui.modal.hidden = true;
  ui.saveAll.disabled = true;

  for (const privateField of document.querySelectorAll(".owner-private-field")) {
    privateField.hidden = true;
    privateField.setAttribute("aria-hidden", "true");
  }
  document.querySelector(".submit-card")?.setAttribute("hidden", "");

  for (const field of ui.formFields) {
    field.required = false;
    field.tabIndex = -1;
    field.setAttribute("aria-readonly", "true");
    if (field instanceof HTMLSelectElement) field.disabled = true;
    else field.readOnly = true;
  }
}

function haptic(kind = "selection") {
  if (!isTelegramContext) return;
  try {
    if (kind === "success") telegram?.HapticFeedback?.notificationOccurred("success");
    else if (kind === "error") telegram?.HapticFeedback?.notificationOccurred("error");
    else telegram?.HapticFeedback?.selectionChanged();
  } catch {
    // Haptics are optional.
  }
}

function setStatus(message, { error = false, success = false } = {}) {
  ui.saveStatus.textContent = message;
  ui.saveStatus.classList.toggle("is-error", error);
  ui.saveStatus.classList.toggle("is-success", success);
}

function markDirty(message = "يوجد تغييرات لم تُحفظ بعد.") {
  if (state.viewMode) return;
  state.dirty = true;
  setStatus(message);
}

function openHero(heroId, trigger) {
  if (state.viewMode) return;
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
  if (state.viewMode) return;
  const other = color === "yellow" ? "red" : "yellow";
  state.draft[color] = value;
  if (state.draft[color] + state.draft[other] > 5) state.draft[other] = 5 - value;
  renderDialog();
  haptic();
}

function saveCurrentHero() {
  if (state.viewMode) return;
  if (!state.heroById.has(state.editingId) || !validMoonState(state.draft)) return;
  state.selected.set(state.editingId, { ...state.draft });
  renderCatalog();
  closeDialog();
  markDirty("تم تحديث البطل. أكمل البيانات ثم احفظ الإعلان.");
  haptic("success");
}

function removeCurrentHero() {
  if (state.viewMode) return;
  if (!state.heroById.has(state.editingId)) return;
  state.selected.delete(state.editingId);
  renderCatalog();
  closeDialog();
  markDirty("أُزيل البطل من الاختيار.");
  haptic();
}

function saveLocalDraft(heroes, form) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ heroes, form }));
    return true;
  } catch {
    return false;
  }
}

function readLocalDraft() {
  try {
    const current = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    if (current && typeof current === "object") return current;
    const legacy = JSON.parse(window.localStorage.getItem(legacyStorageKey) || "[]");
    return { heroes: legacy, form: {} };
  } catch {
    return { heroes: [], form: {} };
  }
}

function buildPayload(heroes, form) {
  return {
    action: "save_castle_heroes",
    v: 1,
    ad: listingId,
    draft: draftId,
    form,
    heroes,
  };
}

async function loadAdvertisementData() {
  if (state.viewMode || !listingId || isTelegramContext || window.location.protocol === "file:") return false;
  try {
    const response = await window.fetch(`/api/ads/${encodeURIComponent(listingId)}/heroes`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return false;
    const payload = await response.json();
    state.selected = normalizeSelection(payload.heroes);
    if (payload.form) applyForm(payload.form);
    return true;
  } catch {
    return false;
  }
}

async function saveThroughApi(payload) {
  if (state.viewMode || !listingId || window.location.protocol === "file:") return { ok: false, reason: "draft" };
  try {
    const response = await window.fetch(`/api/ads/${encodeURIComponent(listingId)}/heroes`, {
      method: "PUT",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
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
  if (state.viewMode || !isTelegramContext || typeof telegram?.sendData !== "function") return false;
  const encoded = JSON.stringify(payload);
  if (new Blob([encoded]).size > TELEGRAM_PAYLOAD_LIMIT) throw new Error("telegram-payload-too-large");
  telegram.sendData(encoded);
  return true;
}

function validateForm() {
  if (ui.form.checkValidity()) return true;
  const invalid = ui.form.querySelector(":invalid");
  setStatus("أكمل الحقول المطلوبة وتأكد من القيم المكتوبة.", { error: true });
  invalid?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => invalid?.reportValidity(), 280);
  haptic("error");
  return false;
}

async function saveAllData() {
  if (state.viewMode) return;
  if (!validateForm()) return;
  const heroes = compactSelection();
  const form = collectForm();
  const payload = buildPayload(heroes, form);
  const localSaved = saveLocalDraft(heroes, form);

  ui.saveAll.disabled = true;
  setStatus("جاري حفظ بيانات الإعلان…");
  window.dispatchEvent(new CustomEvent("belqess:castle-saved", { detail: payload }));

  try {
    if (sendThroughTelegram(payload)) {
      state.dirty = false;
      setStatus("تم إرسال بيانات الإعلان إلى بوت بلقيس.", { success: true });
      haptic("success");
      return;
    }

    const apiResult = await saveThroughApi(payload);
    if (apiResult.ok) {
      state.dirty = false;
      setStatus(`تم حفظ بيانات الإعلان ${listingId}.`, { success: true });
      haptic("success");
      return;
    }

    state.dirty = false;
    if (!localSaved) setStatus("تعذّر حفظ بيانات الإعلان.", { error: true });
    else if (apiResult.reason === "missing") setStatus("حُفظت مسودة على الجهاز؛ رقم الإعلان غير موجود.", { error: true });
    else if (!listingId) setStatus("تم حفظ مسودة كاملة على هذا الجهاز.", { success: true });
    else setStatus("حُفظت مسودة على الجهاز؛ تعذّر الاتصال ببيانات الإعلان.", { error: true });
  } catch (error) {
    const message = error?.message === "telegram-payload-too-large"
      ? "النص المكتوب أطول من الحد المسموح؛ اختصر وصف الحقيبة أو الأبطال الإضافيين."
      : "تعذّر إرسال البيانات إلى Telegram.";
    setStatus(message, { error: true });
    haptic("error");
  } finally {
    ui.saveAll.disabled = false;
  }
}

function showLoadError() {
  const errorState = ui.errorTemplate.content.cloneNode(true);
  if (state.viewMode) {
    errorState.querySelector("strong").textContent = "تعذّر تحميل عرض القلعة";
    errorState.querySelector("span").textContent = publicViewError || "أعد فتح رابط الإعلان من بوت بلقيس.";
  }
  ui.loadingState.replaceWith(errorState);
  if (!state.viewMode) setStatus("تعذّر تحميل صور الأبطال.", { error: true });
}

async function initialize() {
  setupTelegram();
  if (state.viewMode) {
    setupPublicView();
    if (!publicViewData) {
      document.querySelectorAll(".form-section:not(.heroes-section)").forEach(section => { section.hidden = true; });
      ui.categoryNav.hidden = true;
      showLoadError();
      return;
    }
  } else {
    ui.listingBadge.textContent = listingId ? `الإعلان ${listingId}` : "وضع المعاينة";
    if (rawListingId && !listingId) setStatus("رقم الإعلان في الرابط غير صالح؛ سيُستخدم وضع المسودة.", { error: true });
  }

  try {
    const response = await window.fetch(CATALOG_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("catalog-not-found");
    const catalog = await response.json();
    if (!Array.isArray(catalog.categories) || !Array.isArray(catalog.heroes)) throw new Error("invalid-catalog");
    if (catalog.heroes.length !== 67 || catalog.heroes.some(hero => hero.id === 67)) throw new Error("unexpected-catalog");

    const catalogById = new Map(catalog.heroes.map(hero => [hero.id, hero]));
    state.categories = catalog.categories;
    state.categoryById = new Map(catalog.categories.map(category => [category.id, category]));
    state.heroes = HERO_DISPLAY.map(display => {
      const source = catalogById.get(display.id);
      if (!source || source.category !== display.category) throw new Error("hero-mapping-mismatch");
      return { ...source, canonicalName: source.name, name: display.name };
    });
    state.heroById = new Map(state.heroes.map(hero => [hero.id, hero]));

    let loadedFromAdvertisement = false;
    let localDraft = { heroes: [], form: {} };
    if (state.viewMode) {
      state.selected = normalizeSelection(publicViewData.heroes);
      if (state.selected.size !== publicViewData.heroes.length) throw new Error("invalid-public-selection");
      applyForm(publicViewData.form);
      renderPublicSpecifications();
      const firstSelectedHero = state.heroes.find(hero => state.selected.has(hero.id));
      if (firstSelectedHero) state.category = firstSelectedHero.category;
    } else {
      localDraft = readLocalDraft();
      state.selected = normalizeSelection(localDraft.heroes);
      applyForm(localDraft.form);
      loadedFromAdvertisement = await loadAdvertisementData();
    }
    renderCategories();
    renderCatalog();
    ui.loadingState.hidden = true;
    ui.saveAll.disabled = state.viewMode;

    if (state.viewMode) return;
    if (loadedFromAdvertisement) setStatus(`تم تحميل بيانات الإعلان ${listingId}.`);
    else if (state.selected.size || Object.values(normalizeForm(localDraft.form)).some(Boolean)) setStatus("تمت استعادة آخر مسودة محفوظة على هذا الجهاز.");
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
  ui.heroCatalog.scrollIntoView({ behavior: "smooth", block: "nearest" });
  haptic();
});

ui.heroCatalog.addEventListener("click", event => {
  const button = event.target.closest("[data-hero-id]");
  if (button) openHero(Number(button.dataset.heroId), button);
});

ui.modal.addEventListener("click", event => {
  if (state.viewMode) return;
  if (event.target === ui.modal) closeDialog();
  const button = event.target.closest("[data-moon-color]");
  if (button) chooseMoonValue(button.dataset.moonColor, Number(button.dataset.value));
});

ui.form.addEventListener("input", () => markDirty());
ui.form.addEventListener("change", () => markDirty());
ui.form.addEventListener("submit", event => {
  event.preventDefault();
  saveAllData();
});
ui.dialogClose.addEventListener("click", closeDialog);
ui.saveHero.addEventListener("click", saveCurrentHero);
ui.removeHero.addEventListener("click", removeCurrentHero);

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !ui.modal.hidden) closeDialog();
});

window.addEventListener("beforeunload", event => {
  if (!state.dirty || isTelegramContext) return;
  event.preventDefault();
  event.returnValue = "";
});

initialize();
