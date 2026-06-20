//==================================================================
// module setup
//==================================================================

const MODULE_ID = "stars-bonus-stuff";
const CHAT_SHOWCASE_BUILD = "chat-showcase-2026-05-25-61";
const SHOWCASE_STYLE_ID = `${MODULE_ID}-chat-showcase-styles`;
const CHAT_SHOWCASE_PREVIEW_OVERLAY_ID = `${MODULE_ID}-chat-showcase-preview`;
const ACTOR_REVEAL_TEMPLATE_PATH = "modules/stars-bonus-stuff/templates/actor-reveal-sheet.html";
const CUTSCENE_MANAGER_TEMPLATE_PATH = "modules/stars-bonus-stuff/templates/cutscene-manager.html";
const ACTOR_REVEAL_FALLBACK_IMG = "systems/sotc/assets/Raw Ruina Assets/Pages/default skill icon.png";
const ACTOR_REVEAL_ITEM_FLAG = "revealedToOthers";
const ACTOR_REVEAL_MASK_TEXT = "?????";
const ROLL_DIALOG_CHARGE_ICON_PATH = "systems/sotc/assets/statuses/Charge.png";
const SKILL_ROLL_DIALOG_CONTEXT_TTL_MS = 10000;
const STATUS_ICON_TOKEN_PATTERN = /\{\s*(?:"([^"]+)"|'([^']+)'|([^{}]+))\s*\}/g;
const STATUS_ICON_ASSET_BASE = "systems/sotc/assets/statuses";
const STATUS_ICON_ASSET_FALLBACK = `${STATUS_ICON_ASSET_BASE}/Default.png`;
const STATUS_ICON_PACK_ID = "sotc.default-statuses";
const LIGHT_DISPLAY_SETTING_KEY = "enabled";
const CHAT_CARDS_SETTING_KEY = "chatCardsEnabled";
const PREVIEW_SHEETS_SETTING_KEY = "previewSheetsEnabled";
const TOKEN_BARS_SETTING_KEY = "tokenBarsEnabled";
const STATUS_ICON_REPLACEMENT_SETTING_KEY = "statusIconReplacementEnabled";
const CUTSCENE_ENABLED_SETTING_KEY = "cutscenesEnabled";
const SILLY_FEATURES_SETTING_KEY = "sillyFeaturesEnabled";
const CUTSCENE_SETTING_KEY = "cutscenes";
const CUTSCENE_STORAGE_SETTING_KEY = "cutsceneStorage";
const CUTSCENE_STORAGE_VERSION = 1;
const CUTSCENE_MANAGER_APP_ID = `${MODULE_ID}-cutscene-manager`;
const CUTSCENE_CONTROL_NAME = `${MODULE_ID}-cutscenes`;
const CUTSCENE_OVERLAY_ID = `${MODULE_ID}-cutscene-overlay`;
const CUTSCENE_SOCKET_NAMESPACE = `module.${MODULE_ID}`;
const CUTSCENE_DEFAULT_NAME = "Untitled Cutscene";
const CUTSCENE_SOCKET_CACHE_LIMIT = 100;
const CUTSCENE_IMAGE_FADE_MS = 320;
const actorRevealSheetApps = new Map();
const statusIconPackLookup = new Map();
const blackJackData = new Map();
const suits = ["♠", "♥", "♦", "♣"];
const values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
let statusIconPackLookupPromise = null;
const processedCutsceneSocketIds = [];
const processedCutsceneSocketLookup = new Set();
let cutsceneSaveQueue = Promise.resolve();
let cutsceneOverlayImageTransitionId = 0;
let cutsceneManagerApp = null;
let activeCutsceneState = null;
let cutsceneOverlayRoot = null;
let chatShowcasePreviewRoot = null;
const pendingSkillRollDialogContexts = [];

//==================================================================
// hp / stagger bar 
//==================================================================

const TOKEN_BAR_LABEL_FONT = "EXCELSIOR SANS";
const TOKEN_BAR_ASSET_W = { background: 225, fill: 129 };
const TOKEN_BAR_ASSET_H = { background: 220, fill: 134 };
const TOKEN_BAR_LAYER = {
  behind: -10,
  backgroundMask: 980,
  background: 981,
  fillMask: 982,
  fill: 983,
  label: 984
};
const TOKEN_BAR_FILL_ANIMATION = {
  strength: 0.23,
  coarseScaleX: 10,
  coarseScaleY: 6.5,
  fineScaleX: 28,
  fineScaleY: 20,
  primarySpeed: 0.3,
  secondarySpeed: 1
};
const TOKEN_BAR_REVEAL = {
  valueStep: 17,
  featherWidth: 3
};
const BAR_TEXTURE_PATHS = {
  tokenBarBehind: "modules/stars-bonus-stuff/img/behind.webp",
  tokenBarBackground: "modules/stars-bonus-stuff/img/bg.webp",
  tokenBarHealth: "modules/stars-bonus-stuff/img/hpfill.webp",
  tokenBarStagger: "modules/stars-bonus-stuff/img/staggerfill.webp",
  tokenBarRevealHealth: "modules/stars-bonus-stuff/img/revealH.webp",
  tokenBarRevealStagger: "modules/stars-bonus-stuff/img/revealS.webp"
};
const TOKEN_BAR_GEOMETRY = {
  backgroundScale: 1.45,
  backgroundOffsetY: 0.02,
  backgroundMaskLift: 0.078,
  overlayLiftY: 0.36, // 0.36 for 7 ploygon token 0.25 for cirlce
  backgroundHorizontalStretch: 1,
  fillOffsetX: 0.23,
  fillScaleX: 0.98,
  fillScaleY: 0.96,
  fillY: 0.217,
  labelOffsetX: 0.52,
  labelY: -0.14
};
const TOKEN_BAR_FILL_PATH_POINTS = {
  health: [[0.08, 0.18], [0.22, 0.18], [0.36, 0.5], [0.53, 0.86]],
  stagger: [[0.92, 0.18], [0.78, 0.18], [0.64, 0.5], [0.47, 0.86]]
};

Hooks.once("init", () => {
  registerFeatureToggleSetting(LIGHT_DISPLAY_SETTING_KEY, {
    name: "Enable Light Display",
    hint: "Add visual for character's light.",
    default: true,
    onChange: handleLightDisplaySettingChange
  });

  registerFeatureToggleSetting(CHAT_CARDS_SETTING_KEY, {
    name: "Enable Chat Skill Cards",
    hint: "Print Cards into chat when revealed or rolled.",
    default: true,
    onChange: handleChatCardsSettingChange
  });

  registerFeatureToggleSetting(PREVIEW_SHEETS_SETTING_KEY, {
    name: "Enable Enemy Preview Sheet",
    hint: "Give partially revealable preview sheets to characters you do not control. Also allows you to revealed parts of the characters you control.",
    default: true,
    onChange: handlePreviewSheetsSettingChange
  });

  registerFeatureToggleSetting(TOKEN_BARS_SETTING_KEY, {
    name: "Enable HP/Stagger Token Bars",
    hint: "Custom HP and Stagger token bars. (Need to set up Token resource bars to be HP and stagger)",
    default: true,
    onChange: handleTokenBarsSettingChange
  });

  registerFeatureToggleSetting(STATUS_ICON_REPLACEMENT_SETTING_KEY, {
    name: "Skill Text Formatting",
    hint: "Replace Ailments with their icons written {\"Ailment Name / Path\"}. Also supports colored text like {color:red}text{/color}.",
    default: true,
    onChange: handleStatusIconReplacementSettingChange
  });

  registerFeatureToggleSetting(CUTSCENE_ENABLED_SETTING_KEY, {
    name: "Enable Cutscenes",
    hint: "Gives the DM the ability to create basic image slideshow cutscenes.",
    default: true,
    onChange: handleCutsceneFeatureSettingChange
  });

  registerFeatureToggleSetting(SILLY_FEATURES_SETTING_KEY, {
    name: "Silly Features",
    hint: "Enable the blackjack slash command and other joke features.",
    default: true,
    onChange: handleSillyFeaturesSettingChange
  });

  game.settings.register(MODULE_ID, CUTSCENE_SETTING_KEY, {
    name: "Cutscenes",
    scope: "world",
    config: false,
    type: Object,
    default: { version: 1, entries: [] }
  });

  game.settings.register(MODULE_ID, CUTSCENE_STORAGE_SETTING_KEY, {
    name: "Cutscene Storage",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
});

Hooks.once("setup", () => {
  installActorRevealSheets();
});

Hooks.once("ready", () => {
  globalThis.__SBS_CHAT_SHOWCASE_BUILD = CHAT_SHOWCASE_BUILD;
  injectShowcaseStyles();
  primeStatusIconPackLookup();
  installSkillRollDialogContextCapture();
  installCustomTokenBars();
  installCutsceneSocket();
  Promise.all([preloadCustomBarTextures(), ensureCustomFontLoaded()]).then(() => refreshVisibleTokenBars());
  requestAnimationFrame(refreshVisibleTokenBars);
  console.info(`[${MODULE_ID}] loaded ${CHAT_SHOWCASE_BUILD}`);
});

function ensureCustomFontLoaded() {
  const fontUrl = 'modules/stars-bonus-stuff/fonts/ExcelsiorSans.ttf';

  if (typeof FontFace === 'function') {
    try {
      const face = new FontFace(TOKEN_BAR_LABEL_FONT, `url('${fontUrl}')`, { weight: '700', style: 'normal' });
      return face.load().then(loadedFace => {
        try { document.fonts.add(loadedFace); } catch (e) { /* best-effort */ }
        return document?.fonts?.ready?.then?.(() => {
          console.info(`[${MODULE_ID}] ${TOKEN_BAR_LABEL_FONT} font loaded via FontFace`);
          return true;
        }) ?? true;
      }).catch(err => {
        console.warn(`[${MODULE_ID}] FontFace load failed, falling back to document.fonts.load`, err);
        if (document?.fonts?.load) {
          return document.fonts.load(`700 16px "${TOKEN_BAR_LABEL_FONT}"`).then(() => document.fonts.ready).then(() => true).catch(() => false);
        }
        return false;
      });
    } catch (err) {
      console.warn(`[${MODULE_ID}] FontFace load threw`, err);
    }
  }

  if (document?.fonts?.load) {
    return document.fonts.load(`700 16px "${TOKEN_BAR_LABEL_FONT}"`).then(() => document.fonts.ready).then(() => {
      console.info(`[${MODULE_ID}] ${TOKEN_BAR_LABEL_FONT} font loaded via document.fonts.load`);
      return true;
    }).catch(err => {
      console.warn(`[${MODULE_ID}] failed to load ${TOKEN_BAR_LABEL_FONT}`, err);
      return false;
    });
  }

  return Promise.resolve(false);
}

function registerFeatureToggleSetting(key, { name, hint, default: defaultValue, onChange }) {
  game.settings.register(MODULE_ID, key, {
    name,
    hint,
    scope: "world",
    config: true,
    type: Boolean,
    default: defaultValue,
    onChange
  });
}

function featureSettingEnabled(key) {
  return Boolean(game.settings.get(MODULE_ID, key));
}

function lightOverlayEnabled() {
  return featureSettingEnabled(LIGHT_DISPLAY_SETTING_KEY);
}

function chatCardsEnabled() {
  return featureSettingEnabled(CHAT_CARDS_SETTING_KEY);
}

function previewSheetsEnabled() {
  return featureSettingEnabled(PREVIEW_SHEETS_SETTING_KEY);
}

function customTokenBarsEnabled() {
  return featureSettingEnabled(TOKEN_BARS_SETTING_KEY);
}

function statusIconReplacementEnabled() {
  return featureSettingEnabled(STATUS_ICON_REPLACEMENT_SETTING_KEY);
}

function cutscenesFeatureEnabled() {
  return featureSettingEnabled(CUTSCENE_ENABLED_SETTING_KEY);
}

function sillyFeaturesEnabled() {
  return featureSettingEnabled(SILLY_FEATURES_SETTING_KEY);
}

function rerenderChatLog() {
  ui?.chat?.render?.(false);
}

function handleChatCardsSettingChange(enabled) {
  if (!enabled) {
    closeChatShowcasePreview();
  }

  rerenderChatLog();
}

function rerenderOpenActorSheets() {
  if (!ui?.windows) return;

  for (const app of Object.values(ui.windows)) {
    if (!app?.rendered) continue;

    const template = String(app?.options?.template ?? app?.template ?? "").toLowerCase();
    if (!template.includes("actor-sheet.html")) continue;
    app.render(false);
  }
}

function rerenderAllRevealSheets() {
  for (const app of actorRevealSheetApps.values()) {
    if (!app?.rendered) continue;
    app.render(false);
  }
}

async function closeAllRevealSheets() {
  const apps = [...actorRevealSheetApps.values()];
  actorRevealSheetApps.clear();

  for (const app of apps) {
    if (!app) continue;
    await app.close();
  }
}

function handleLightDisplaySettingChange(enabled) {
  if (enabled) {
    rerenderActiveCombatLights();
    return;
  }

  cleanAllMarkers();
}

function handlePreviewSheetsSettingChange(enabled) {
  if (!enabled) {
    closeAllRevealSheets();
  }

  refreshActorRevealTokenInteractions();
  rerenderOpenActorSheets();
}

function handleTokenBarsSettingChange() {
  refreshVisibleTokenBars();
}

function handleStatusIconReplacementSettingChange() {
  rerenderChatLog();
  rerenderOpenSkillSheets();
  rerenderAllRevealSheets();
}

function handleCutsceneFeatureSettingChange(enabled) {
  if (!enabled) {
    closeCutsceneOverlay();
    cutsceneManagerApp?.close();
  }

  ui?.controls?.render?.(true);
}

function handleSillyFeaturesSettingChange(enabled) {
  if (!enabled) {
    blackJackData.clear();
  }
}

function getActorRevealSheetKey(actor, tokenDocument) {
  const source = tokenDocument?.uuid ?? actor?.uuid ?? `actor-${foundry.utils.randomID()}`;
  return `sbs-reveal-sheet-${String(source).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function getActorRevealItemImage(item) {
  return item?.img && item.img !== "icons/svg/item-bag.svg"
    ? item.img
    : ACTOR_REVEAL_FALLBACK_IMG;
}

function toRevealList(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.map(value => String(value ?? "").trim()).filter(Boolean);
  }

  if (rawValue && typeof rawValue === "object") {
    return Object.values(rawValue).map(value => String(value ?? "").trim()).filter(Boolean);
  }

  if (rawValue === undefined || rawValue === null || rawValue === "") return [];
  return [String(rawValue).trim()].filter(Boolean);
}

function getRevealDiceRows(rawDice) {
  return Array.isArray(rawDice) ? rawDice : Object.values(rawDice ?? {});
}

function formatRevealDieLabel(type) {
  const normalized = String(type ?? "").trim();
  if (!normalized) return "Die";

  return normalized
    .split(/[-_\s]+/)
    .map(part => part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : "")
    .join(" ");
}

function formatRevealDieTypeClass(type) {
  const normalized = String(type ?? "").trim().toLowerCase();
  return normalized ? normalized.replace(/[^a-z0-9_-]+/g, "-") : "slash";
}

function normalizeStatusTokenName(value) {
  return String(value ?? "")
    .replace(/\\(["'])/g, "$1")
    .replace(/^(["'])+|(["'])+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeInlineMarkupValue(value) {
  return String(value ?? "")
    .replace(/\\(["'])/g, "$1")
    .replace(/^(?:["'])+|(?:["'])+$/g, "")
    .trim();
}

function sanitizeInlineColor(value) {
  const color = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!color) return "";
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
  if (/^[a-z][a-z0-9-]*$/i.test(color)) return color;
  if (/^(?:rgb|rgba|hsl|hsla)\(\s*[-\d.%\s,]+\)$/i.test(color)) return color;
  return "";
}

function isExplicitInlineColorValue(value) {
  return /^(#|(?:rgb|rgba|hsl|hsla)\()/i.test(String(value ?? "").trim());
}

function parseInlineColorToken(value) {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return null;

  if (/^\/color$/i.test(rawValue) || /^color\s*:\s*(?:default|reset)$/i.test(rawValue)) {
    return { type: "close" };
  }

  const openMatch = rawValue.match(/^(color\s*:\s*)?([\s\S]+)$/i);
  if (!openMatch) return null;

  const hasExplicitPrefix = Boolean(openMatch[1]);
  const colorCandidate = String(openMatch[2] ?? "").trim();
  if (!hasExplicitPrefix && !isExplicitInlineColorValue(colorCandidate)) {
    return null;
  }

  const color = sanitizeInlineColor(colorCandidate);
  if (!color) return null;

  return { type: "open", color };
}

function getStatusIconFallbackData(value) {
  const trimmed = String(value ?? "")
    .replace(/\\(["'])/g, "$1")
    .replace(/^(["'])+|(["'])+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed) return null;

  return {
    name: trimmed,
    img: `${STATUS_ICON_ASSET_BASE}/${trimmed}.png`
  };
}

function getStatusIconSources(statusSource) {
  const sources = [];

  for (const candidate of Array.isArray(statusSource) ? statusSource : [statusSource]) {
    const actor = candidate?.actor ?? candidate?.parent ?? candidate;
    if (!actor?.items) continue;
    if (sources.some(existing => existing === actor || existing.id === actor.id)) continue;
    sources.push(actor);
  }

  return sources;
}

function addStatusItemToLookup(lookup, item) {
  if (item?.type !== "status") return;
  if (!item?.img || item.img === "icons/svg/item-bag.svg") return;

  const key = normalizeStatusTokenName(item.name);
  if (!key || lookup.has(key)) return;
  lookup.set(key, {
    name: String(item.name ?? "").trim(),
    img: item.img
  });
}

function rerenderOpenSkillSheets() {
  if (!ui?.windows) return;

  for (const app of Object.values(ui.windows)) {
    if (!app?.rendered) continue;

    const item = app?.item ?? app?.object ?? null;
    if (!item || !["skill", "ego"].includes(item.type)) continue;
    app.render(false);
  }
}

function primeStatusIconPackLookup() {
  if (statusIconPackLookupPromise) return statusIconPackLookupPromise;

  statusIconPackLookupPromise = (async () => {
    const pack = game.packs?.get(STATUS_ICON_PACK_ID);
    if (!pack) return false;

    const statuses = await pack.getDocuments();
    statusIconPackLookup.clear();

    for (const item of statuses ?? []) {
      addStatusItemToLookup(statusIconPackLookup, item);
    }

    return statusIconPackLookup.size > 0;
  })().then(loaded => {
    if (loaded) rerenderOpenSkillSheets();
    return loaded;
  }).catch(error => {
    console.warn(`[${MODULE_ID}] failed to prime status icon pack lookup`, error);
    statusIconPackLookupPromise = null;
    return false;
  });

  return statusIconPackLookupPromise;
}

function getStatusIconLookup(statusSource) {
  const lookup = new Map();

  for (const actor of getStatusIconSources(statusSource)) {
    for (const item of actor.items ?? []) {
      addStatusItemToLookup(lookup, item);
    }
  }

  for (const item of game.items ?? []) {
    addStatusItemToLookup(lookup, item);
  }

  if (!statusIconPackLookup.size) {
    primeStatusIconPackLookup();
  }

  for (const [key, data] of statusIconPackLookup.entries()) {
    if (!lookup.has(key)) {
      lookup.set(key, data);
    }
  }

  return lookup;
}

function makeStatusIconHtml(statusData, tokenMarkup) {
  const title = escapeHtml(statusData?.name ?? "Status");
  const img = escapeHtml(statusData?.img ?? "");
  const markup = escapeHtml(String(tokenMarkup ?? statusData?.name ?? "").trim());
  return `<span class="sbs-status-inline-token" data-status-name="${title}" data-inline-markup="${markup}" title="${title}"><img class="sbs-status-inline-icon" src="${img}" alt="${title}" onerror="this.onerror=null;this.src='${STATUS_ICON_ASSET_FALLBACK}';"></span>`;
}

function makeColoredTextHtml(colorData, tokenMarkup) {
  const color = escapeHtml(colorData?.color ?? "");
  const text = escapeHtml(colorData?.text ?? "");
  const markup = String(tokenMarkup ?? "").trim();
  const markupAttr = markup ? ` data-inline-markup="${escapeHtml(markup)}"` : "";
  return `<span class="sbs-inline-color-text"${markupAttr} data-inline-color="${color}" style="--sbs-inline-color:${color};">${text}</span>`;
}

function makeInlineColorMarkerHtml(tokenMarkup) {
  const markup = escapeHtml(String(tokenMarkup ?? "").trim());
  return `<span class="sbs-inline-color-marker" data-inline-markup="${markup}" aria-hidden="true"></span>`;
}

function renderInlineTextSegment(text, activeColor) {
  const rawText = String(text ?? "");
  if (!rawText) return "";

  if (!activeColor) {
    return escapeHtml(rawText);
  }

  return makeColoredTextHtml({ color: activeColor, text: rawText });
}

function renderStatusTokenHtmlWithLookup(text, statusLookup) {
  const rawText = String(text ?? "");
  if (!rawText) return "";

  STATUS_ICON_TOKEN_PATTERN.lastIndex = 0;
  let html = "";
  let lastIndex = 0;
  let match;
  let activeColor = "";

  while ((match = STATUS_ICON_TOKEN_PATTERN.exec(rawText))) {
    html += renderInlineTextSegment(rawText.slice(lastIndex, match.index), activeColor);

    const tokenMarkup = String(match[1] ?? match[2] ?? match[3] ?? "").trim();
    const colorData = parseInlineColorToken(tokenMarkup);

    if (colorData?.type === "open") {
      activeColor = colorData.color;
      html += makeInlineColorMarkerHtml(tokenMarkup);
    } else if (colorData?.type === "close") {
      activeColor = "";
      html += makeInlineColorMarkerHtml(tokenMarkup);
    } else {
      const statusName = normalizeInlineMarkupValue(tokenMarkup);
      const statusData = statusLookup?.get(normalizeStatusTokenName(statusName)) ?? getStatusIconFallbackData(statusName);
      html += statusData ? makeStatusIconHtml(statusData, tokenMarkup) : escapeHtml(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  html += renderInlineTextSegment(rawText.slice(lastIndex), activeColor);
  return html;
}

function renderStatusTokenHtml(text, statusSource) {
  if (!statusIconReplacementEnabled()) {
    return escapeHtml(String(text ?? ""));
  }

  return renderStatusTokenHtmlWithLookup(text, getStatusIconLookup(statusSource));
}

function replaceStatusTokensInHtml(root, statusSource) {
  if (!statusIconReplacementEnabled()) return;
  if (!root?.ownerDocument) return;

  const statusLookup = getStatusIconLookup(statusSource);

  const hasStatusToken = value => {
    STATUS_ICON_TOKEN_PATTERN.lastIndex = 0;
    return STATUS_ICON_TOKEN_PATTERN.test(String(value ?? ""));
  };

  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node?.textContent || !hasStatusToken(node.textContent)) {
        return NodeFilter.FILTER_SKIP;
      }

      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_SKIP;
      if (parent.closest("textarea, input, select, option, script, style")) {
        return NodeFilter.FILTER_SKIP;
      }
      if (parent.closest(".sbs-status-inline-token")) {
        return NodeFilter.FILTER_SKIP;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const textNodes = [];
  let currentNode;
  while ((currentNode = walker.nextNode())) {
    textNodes.push(currentNode);
  }

  for (const textNode of textNodes) {
    const wrapper = root.ownerDocument.createElement("template");
    wrapper.innerHTML = renderStatusTokenHtmlWithLookup(textNode.textContent, statusLookup);
    textNode.replaceWith(wrapper.content);
  }
}

function renderStatusTokensInEnrichedHtml(html, statusSource) {
  const rawHtml = String(html ?? "");
  if (!rawHtml) return "";
  if (!statusIconReplacementEnabled()) return rawHtml;

  STATUS_ICON_TOKEN_PATTERN.lastIndex = 0;
  if (!STATUS_ICON_TOKEN_PATTERN.test(rawHtml)) return rawHtml;

  const container = document.createElement("div");
  container.innerHTML = rawHtml;
  replaceStatusTokensInHtml(container, statusSource);
  return container.innerHTML;
}

async function enrichRevealHtml(content, statusSource) {
  const rawContent = String(content ?? "").trim();
  if (!rawContent) return "";

  try {
    const enrichedHtml = await TextEditor.enrichHTML(rawContent, { async: true, secrets: false });
    return renderStatusTokensInEnrichedHtml(enrichedHtml, statusSource);
  } catch (error) {
    console.warn(`[${MODULE_ID}] failed to enrich reveal html`, error);
    return renderStatusTokenHtml(rawContent, statusSource);
  }
}

function getRevealUserLevel(document) {
  if (!document?.getUserLevel) return null;
  return Number(document.getUserLevel(game.user));
}

function getRevealSheetAccessState(token) {
  const actor = token?.actor ?? token?.document?.actor;
  const tokenDocument = token?.document ?? null;
  const actorDocument = tokenDocument?.baseActor ?? actor ?? null;
  if (!actor || !tokenDocument || game.user?.isGM || !previewSheetsEnabled()) {
    return { actor, actorDocument, tokenDocument, shouldOpen: false };
  }

  const noneLevel = Number(CONST?.DOCUMENT_OWNERSHIP_LEVELS?.NONE ?? 0);
  const actorLevel = getRevealUserLevel(actorDocument);
  const tokenLevel = getRevealUserLevel(tokenDocument);
  return {
    actor,
    actorDocument,
    tokenDocument,
    actorLevel,
    tokenLevel,
    shouldOpen: actorLevel === noneLevel && tokenLevel === noneLevel
  };
}

function getRevealActorItems(actor, type) {
  return actor?.items
    ?.filter(item => item.type === type)
    ?.sort((left, right) => Number(left.sort ?? 0) - Number(right.sort ?? 0))
    ?? [];
}

function getRevealPassives(actor) {
  return actor?.items
    ?.filter(item => item.type === "passive" && item.system?.type === "passive")
    ?.sort((left, right) => Number(left.sort ?? 0) - Number(right.sort ?? 0))
    ?? [];
}

function getRevealBiographyEntries(actor) {
  return actor?.items
    ?.filter(item => item.type === "passive" && item.system?.type === "biography")
    ?.sort((left, right) => Number(left.sort ?? 0) - Number(right.sort ?? 0))
    ?? [];
}

function isBiographyEntryItem(item) {
  return item?.type === "passive" && item.system?.type === "biography";
}

function isRevealableItem(item) {
  if (!item) return false;
  if (item.type === "skill" || item.type === "ego") return true;
  return (item.type === "passive" && item.system?.type === "passive") || isBiographyEntryItem(item);
}

function isItemRevealedToOthers(item) {
  if (!isRevealableItem(item)) return false;
  return Boolean(item.getFlag?.(MODULE_ID, ACTOR_REVEAL_ITEM_FLAG));
}

function getMaskedRevealHtml() {
  return `<p>${ACTOR_REVEAL_MASK_TEXT}</p>`;
}

async function buildRevealSkillData(item) {
  const statusSource = item?.parent ?? item?.actor ?? null;
  const lightCost = Number(item.system?.light_cost ?? 0);
  const weight = Number(item.system?.weight ?? 1);
  const emotionCost = Number(item.system?.emotion_cost ?? 0);
  const limitValue = Number(item.system?.limit?.value ?? 0);
  const limitMax = Number(item.system?.limit?.max ?? 0);
  const modules = toRevealList(item.system?.skill_modules?.mods ?? item.system?.skill_modules);

  const badges = [
    { label: "Light", value: lightCost }
  ];

  if (weight > 1) badges.push({ label: "Weight", value: weight });
  if (emotionCost > 0) badges.push({ label: "Emotion", value: emotionCost });
  if (limitMax > 0) badges.push({ label: "Limit", value: `${limitValue}/${limitMax}` });

  const dice = getRevealDiceRows(item.system?.dice?.die)
    .map(die => ({
      typeClass: formatRevealDieTypeClass(die?.type),
      label: formatRevealDieLabel(die?.type),
      formula: String(die?.formula ?? "").trim(),
      mods: toRevealList(die?.mods)
    }))
    .filter(die => die.formula || die.mods.length || die.label !== "Die");

  return {
    id: item.id,
    isEgo: false,
    name: item.name,
    img: getActorRevealItemImage(item),
    showcaseHTML: makeSkillShowcase(item),
    badges,
    modules,
    modulesText: modules.join("\n"),
    dice,
    descriptionHTML: await enrichRevealHtml(item.system?.description ?? "", statusSource),
    lightCost,
    weight,
    showWeight: weight > 1,
    emotionCost,
    showEmotion: emotionCost > 0,
    limitValue,
    limitMax,
    hasLimit: limitMax > 0
  };
}

async function buildRevealEgoData(item) {
  const revealSkill = await buildRevealSkillData(item);
  const risk = String(item.system?.risk ?? "").trim();
  const statusSource = item?.parent ?? item?.actor ?? null;

  return {
    ...revealSkill,
    isEgo: true,
    risk,
    hasRisk: Boolean(risk),
    passiveName: String(item.system?.passive_name ?? "").trim(),
    passiveHTML: await enrichRevealHtml(item.system?.passive ?? "", statusSource)
  };
}

async function buildRevealSkillSectionData(actor) {
  const skills = await Promise.all(
    getRevealActorItems(actor, "skill")
      .filter(isItemRevealedToOthers)
      .map(buildRevealSkillData)
  );
  const egos = await Promise.all(
    getRevealActorItems(actor, "ego")
      .filter(isItemRevealedToOthers)
      .map(buildRevealEgoData)
  );
  return [...skills, ...egos];
}

async function buildRevealPassiveData(item) {
  const isRevealed = isItemRevealedToOthers(item);
  const statusSource = item?.parent ?? item?.actor ?? null;
  return {
    id: item.id,
    name: isRevealed ? item.name : ACTOR_REVEAL_MASK_TEXT,
    detailsHTML: isRevealed
      ? await enrichRevealHtml(item.system?.details ?? "", statusSource)
      : getMaskedRevealHtml()
  };
}

async function buildRevealBiographySectionData(actor) {
  const rawBiography = String(actor?.system?.biography ?? "").trim();
  const hasBiographyText = Boolean(rawBiography);
  const biographyEntries = getRevealBiographyEntries(actor);

  return {
    hasBiographyText,
    biographyHTML: hasBiographyText
      ? await enrichRevealHtml(rawBiography, actor)
      : "",
    entries: await Promise.all(biographyEntries.map(buildRevealPassiveData))
  };
}

class SBSActorRevealSheet extends Application {
  constructor(actor, options = {}) {
    const appId = options.id ?? getActorRevealSheetKey(actor, options.tokenDocument);
    super(foundry.utils.mergeObject(options, { id: appId }, { inplace: false }));

    this.actor = actor;
    this.tokenDocument = options.tokenDocument ?? null;
    this.currentTab = options.initialTab === "ego" ? "skills" : (options.initialTab ?? "skills");
    this.appKey = appId;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sbs-reveal-sheet-app", "sotc", "sheet", "actor"],
      template: ACTOR_REVEAL_TEMPLATE_PATH,
      width: 920,
      height: 840,
      resizable: true
    });
  }

  get title() {
    return `${this.actor?.name ?? "Character"} - Revealed`;
  }

  async getData(options) {
    const actor = this.actor;
    return {
      actor: {
        name: actor?.name ?? "Unknown",
        img: actor?.img || ACTOR_REVEAL_FALLBACK_IMG,
        miniImg: actor?.system?.mini_img || actor?.img || ACTOR_REVEAL_FALLBACK_IMG,
        role: String(actor?.system?.role ?? "").trim()
      },
      isSkillsTab: this.currentTab === "skills",
      isPassivesTab: this.currentTab === "passives",
      isBiographyTab: this.currentTab === "biography",
      skills: await buildRevealSkillSectionData(actor),
      passives: await Promise.all(getRevealPassives(actor).map(buildRevealPassiveData)),
      biography: await buildRevealBiographySectionData(actor)
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    const root = html?.[0] ?? html;
    if (!root) return;

    for (const tabButton of root.querySelectorAll("[data-reveal-tab]")) {
      tabButton.addEventListener("click", event => {
        event.preventDefault();
        this.currentTab = event.currentTarget.dataset.revealTab || "skills";
        this.#syncTabView(root);
      });
    }

    this.#syncTabView(root);
  }

  async close(options) {
    actorRevealSheetApps.delete(this.appKey);
    return super.close(options);
  }

  #syncTabView(root) {
    for (const tabButton of root.querySelectorAll("[data-reveal-tab]")) {
      const isActive = tabButton.dataset.revealTab === this.currentTab;
      tabButton.classList.toggle("is-active", isActive);
      tabButton.classList.toggle("active", isActive);
    }

    for (const panel of root.querySelectorAll("[data-reveal-panel]")) {
      const isActive = panel.dataset.revealPanel === this.currentTab;
      panel.classList.toggle("is-active", isActive);
      panel.classList.toggle("active", isActive);
    }
  }
}

function openActorRevealSheet(token) {
  const { actor, tokenDocument, shouldOpen } = getRevealSheetAccessState(token);
  if (!shouldOpen || !actor) return null;

  const appKey = getActorRevealSheetKey(actor, tokenDocument);
  const existingApp = actorRevealSheetApps.get(appKey);
  if (existingApp?.rendered) {
    existingApp.bringToTop?.();
    return existingApp;
  }

  const revealSheet = new SBSActorRevealSheet(actor, {
    id: appKey,
    tokenDocument
  });
  actorRevealSheetApps.set(appKey, revealSheet);
  revealSheet.render(true);
  return revealSheet;
}

function canUseRevealSheetInteraction(token, user, fallback, event) {
  if (user === game.user && getRevealSheetAccessState(token).shouldOpen) {
    return true;
  }

  return fallback?.call(token, user, event) ?? false;
}

function refreshActorRevealTokenInteractions() {
  if (!canvas?.tokens) return;

  for (const token of canvas.tokens.placeables) {
    const permissions = token?.mouseInteractionManager?.permissions;
    const callbacks = token?.mouseInteractionManager?.callbacks;
    if (!permissions && !callbacks) continue;

    if (permissions) {
      const canControl = token?._sbsOriginalCanControl;
      const canView = token?._sbsOriginalCanView;

      if (typeof canControl === "function") {
        permissions.clickLeft = (user, event) => canControl.call(token, user, event);
      }

      if (typeof canView === "function") {
        permissions.clickLeft2 = (user, event) => canUseRevealSheetInteraction(token, user, canView, event);
      }
    }

    if (callbacks && typeof token._onClickLeft === "function") {
      callbacks.clickLeft = token._onClickLeft.bind(token);
    }

    if (callbacks && typeof token._onClickLeft2 === "function") {
      callbacks.clickLeft2 = token._onClickLeft2.bind(token);
    }
  }
}

function installActorRevealSheets() {
  const tokenClass = CONFIG.Token?.objectClass;
  const tokenPrototype = tokenClass?.prototype;
  if (!tokenPrototype) return;
  if (tokenPrototype._sbsRevealSheetInstalled) {
    refreshActorRevealTokenInteractions();
    return;
  }

  const originalOnClickLeft2 = typeof tokenPrototype._onClickLeft2 === "function"
    ? tokenPrototype._onClickLeft2
    : null;
  const originalCanControl = typeof tokenPrototype._canControl === "function"
    ? tokenPrototype._canControl
    : null;
  const originalCanView = typeof tokenPrototype._canView === "function"
    ? tokenPrototype._canView
    : null;

  tokenPrototype._sbsOriginalOnClickLeft2 = originalOnClickLeft2;
  tokenPrototype._sbsOriginalCanControl = originalCanControl;
  tokenPrototype._sbsOriginalCanView = originalCanView;
  tokenPrototype._sbsRevealSheetInstalled = true;

  tokenPrototype._onClickLeft2 = function(event) {
    const revealSheet = openActorRevealSheet(this);
    if (revealSheet) {
      return;
    }

    return originalOnClickLeft2?.call(this, event);
  };

  Hooks.on("canvasReady", refreshActorRevealTokenInteractions);
  Hooks.on("createToken", () => requestAnimationFrame(refreshActorRevealTokenInteractions));
  refreshActorRevealTokenInteractions();
}

function rerenderActorRevealSheets(actor) {
  if (!actor) return;

  for (const app of actorRevealSheetApps.values()) {
    if (!app?.rendered) continue;
    if (app.actor?.id !== actor.id) continue;
    app.render(false);
  }
}

function getActorSheetRevealToggleMarkup(item) {
  const isRevealed = isItemRevealedToOthers(item);
  const title = isRevealed ? "Hide from preview" : "Reveal in preview";
  const icon = isRevealed ? "fa-eye" : "fa-eye-slash";

  return `
    <a class="sbs-reveal-toggle" data-item-id="${item.id}" data-revealed="${isRevealed}" title="${title}" aria-label="${title}">
      <i class="fas ${icon}"></i>
    </a>
  `;
}

function attachActorSheetRevealToggles(app, html) {
  const actor = app?.actor;
  const root = html?.[0] ?? html;
  if (!actor || !root) return;

  if (!previewSheetsEnabled()) {
    for (const toggle of root.querySelectorAll(".sbs-reveal-toggle")) {
      toggle.remove();
    }
    return;
  }

  if (root.dataset.sbsRevealToggleBound === "true") return;
  root.dataset.sbsRevealToggleBound = "true";

  if (!actor.isOwner || !app.isEditable) return;

  const itemCards = root.querySelectorAll(".skill_card[data-item-id], .passive_card[data-item-id]");
  for (const card of itemCards) {
    const itemId = card.dataset.itemId;
    const item = actor.items.get(itemId);
    if (!isRevealableItem(item)) continue;

    const controls = card.querySelector(".edit_and_delete");
    if (!controls) continue;
    if (controls.querySelector(`.sbs-reveal-toggle[data-item-id="${item.id}"]`)) continue;

    controls.insertAdjacentHTML("afterbegin", getActorSheetRevealToggleMarkup(item));
  }

  for (const toggle of root.querySelectorAll(".sbs-reveal-toggle[data-item-id]")) {
    toggle.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();

      const item = actor.items.get(event.currentTarget.dataset.itemId);
      if (!item || !actor.isOwner) return;

      const nextState = !isItemRevealedToOthers(item);
      await item.setFlag(MODULE_ID, ACTOR_REVEAL_ITEM_FLAG, nextState);
      app.render(false);
    });
  }
}

function decorateSkillStatusTokens(app, html) {
  const item = app?.item ?? app?.object ?? null;
  if (!item || !["skill", "ego"].includes(item.type)) return;

  const root = getRenderedHtmlRoot(html);
  if (!root) return;

  const skillModsNode = root.querySelector(".skill_mods span");
  if (skillModsNode) {
    skillModsNode.textContent = getModsText(item);
  }

  const diceModValues = getDiceRows(item)
    .flatMap(die => arrayify(die?.mods).map(mod => String(mod ?? "").trim()));
  Array.from(root.querySelectorAll(".displayed_dice_mods span")).forEach((node, index) => {
    if (index < diceModValues.length) {
      node.textContent = diceModValues[index];
    }
  });

  const descriptionField = root.querySelector('textarea[name="system.description"]');
  if (descriptionField) {
    descriptionField.classList.remove("sbs-status-textarea-hidden");
    descriptionField.value = String(item.system?.description ?? descriptionField.value ?? "");
  }

  for (const container of root.querySelectorAll(".sbs-skill-description-host")) {
    container.classList.remove("sbs-skill-description-host");
  }

  for (const preview of root.querySelectorAll(".sbs-skill-description-preview")) {
    preview.remove();
  }

  for (const token of root.querySelectorAll(".sbs-status-inline-token, .sbs-inline-color-text, .sbs-inline-color-marker")) {
    const markup = String(token.dataset.inlineMarkup ?? "").trim();
    if (markup) {
      token.replaceWith(root.ownerDocument.createTextNode(`{${markup}}`));
      continue;
    }

    if (token.classList.contains("sbs-inline-color-text")) {
      token.replaceWith(root.ownerDocument.createTextNode(token.textContent ?? ""));
      continue;
    }

    const tokenName = String(
      token.dataset.statusName
      || token.getAttribute("title")
      || token.querySelector("img")?.getAttribute("alt")
      || "Status"
    ).trim();
    token.replaceWith(root.ownerDocument.createTextNode(`{"${tokenName}"}`));
  }
}

function isSkillSheetApplication(app) {
  const item = app?.item ?? app?.object ?? null;
  if (!item || !["skill", "ego"].includes(item.type)) return false;

  const template = String(app?.options?.template ?? app?.template ?? "").toLowerCase();
  const classes = Array.isArray(app?.options?.classes) ? app.options.classes : [];
  return template.includes("skill-sheet.html") || classes.includes("skill") || classes.includes("ego");
}

function scheduleSkillStatusDecoration(app, html) {
  if (!isSkillSheetApplication(app)) return;

  decorateSkillStatusTokens(app, html);

  requestAnimationFrame(() => {
    const root = getRenderedHtmlRoot(html);
    if (!root?.isConnected) return;
    decorateSkillStatusTokens(app, html);
  });
}

function getSkillRollDialogSheetClasses() {
  const sheetClasses = CONFIG.Actor?.sheetClasses?.character ?? {};
  const classes = [];
  const seen = new Set();

  for (const namespaceEntry of Object.values(sheetClasses)) {
    for (const sheetEntry of Object.values(namespaceEntry ?? {})) {
      const cls = sheetEntry?.cls ?? sheetEntry;
      if (!cls || seen.has(cls)) continue;
      seen.add(cls);

      if (typeof cls?.prototype?._onRollFullSkill === "function") {
        classes.push(cls);
      }
    }
  }

  return classes;
}

function queuePendingSkillRollDialogContext(actor, item) {
  if (!actor?.id || !item?.id) return;

  pendingSkillRollDialogContexts.push({
    actorId: actor.id,
    itemId: item.id,
    itemName: String(item.name ?? "").trim(),
    expiresAt: Date.now() + SKILL_ROLL_DIALOG_CONTEXT_TTL_MS
  });

  while (pendingSkillRollDialogContexts.length > 12) {
    pendingSkillRollDialogContexts.shift();
  }
}

function consumePendingSkillRollDialogContext(app) {
  const now = Date.now();
  const dialogTitle = String(app?.title ?? app?.options?.title ?? "").trim();

  for (let index = pendingSkillRollDialogContexts.length - 1; index >= 0; index -= 1) {
    if (Number(pendingSkillRollDialogContexts[index]?.expiresAt ?? 0) < now) {
      pendingSkillRollDialogContexts.splice(index, 1);
    }
  }

  if (!pendingSkillRollDialogContexts.length) return null;

  const exactMatchIndex = pendingSkillRollDialogContexts.findIndex(context => dialogTitle === `Roll Skill: ${context.itemName}`);
  const contextIndex = exactMatchIndex >= 0 ? exactMatchIndex : 0;
  const [context] = pendingSkillRollDialogContexts.splice(contextIndex, 1);
  return context ?? null;
}

function getSkillRollDialogContainer(app, html) {
  const root = getRenderedHtmlRoot(html);
  const appElement = app?.element;

  if (appElement instanceof HTMLElement) return appElement;
  if (appElement?.[0] instanceof HTMLElement) return appElement[0];
  return root?.closest?.(".dialog, .app.dialog") ?? root ?? null;
}

function attachSkillRollDialogContext(app, html) {
  const container = getSkillRollDialogContainer(app, html);
  if (!container) return null;

  const actorId = String(container.dataset.sbsActorId ?? "").trim();
  const itemId = String(container.dataset.sbsItemId ?? "").trim();
  if (actorId && itemId) {
    return { actorId, itemId };
  }

  const context = consumePendingSkillRollDialogContext(app);
  if (!context) return null;

  container.dataset.sbsActorId = context.actorId;
  container.dataset.sbsItemId = context.itemId;
  return context;
}

function resolveSkillRollDialogContext(app, html) {
  const root = getRenderedHtmlRoot(html);
  const container = getSkillRollDialogContainer(app, html);
  if (!root || !container) return { root: null, container: null, actor: null, item: null };

  attachSkillRollDialogContext(app, html);

  const actorId = String(container.dataset.sbsActorId ?? "").trim();
  const itemId = String(container.dataset.sbsItemId ?? "").trim();
  const actor = actorId ? game.actors?.get(actorId) ?? null : null;
  const item = actor && itemId ? actor.items?.get(itemId) ?? null : null;
  return { root, container, actor, item };
}

function captureSkillRollDialogContextFromActorSheet(app, html) {
  const root = getRenderedHtmlRoot(html);
  const actor = app?.actor ?? null;
  if (!root || !actor?.items) return;
  if (root.dataset.sbsChargeContextCaptureBound === "true") return;

  root.dataset.sbsChargeContextCaptureBound = "true";
  root.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest(".skill_roll-button") : null;
    if (!button || !root.contains(button)) return;

    const card = button.closest(".skill_card");
    const itemId = String(card?.dataset?.itemId ?? "").trim();
    const item = itemId ? actor.items.get(itemId) ?? null : null;
    if (!item) return;

    queuePendingSkillRollDialogContext(actor, item);
  }, true);
}

function normalizeStatusLookupName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getActorChargeStatusItem(actor) {
  if (!actor?.items) return null;

  const statuses = actor.items.filter(item => item.type === "status");
  const namedMatch = statuses.find(item => normalizeStatusLookupName(item.name) === "charge");
  if (namedMatch) return namedMatch;

  const partialNameMatch = statuses.find(item => /\bcharge\b/i.test(String(item.name ?? "")));
  if (partialNameMatch) return partialNameMatch;

  return statuses.find(item => {
    const imagePath = String(item.img ?? "").replace(/\\/g, "/").toLowerCase();
    return imagePath.includes("charge") && imagePath.endsWith(".png");
  }) ?? null;
}

function getActorChargeCount(actor) {
  const chargeItem = getActorChargeStatusItem(actor);
  return Math.max(0, Number(chargeItem?.system?.count ?? 0));
}

async function consumeActorCharge(actor, amount) {
  const spend = Math.max(0, Number(amount ?? 0));
  if (!actor || spend <= 0) return 0;

  const chargeItem = getActorChargeStatusItem(actor);
  if (!chargeItem) return 0;

  const currentCount = Math.max(0, Number(chargeItem.system?.count ?? 0));
  if (currentCount <= 0) return 0;

  const nextCount = Math.max(currentCount - spend, 0);
  if (nextCount === currentCount) return 0;

  await chargeItem.update({ "system.count": nextCount });
  return currentCount - nextCount;
}

function getSkillRollDialogDice(item) {
  const diceObject = item?.system?.dice?.die ?? {};
  return Array.isArray(diceObject) ? diceObject : Object.values(diceObject);
}

function parseSkillRollDieFormula(formula) {
  const match = String(formula ?? "").match(/^\s*(\d+)\s*d\s*(\d+)((?:\s*[+-]\s*\d+)*)\s*$/);
  if (!match) return null;

  const numDice = parseInt(match[1], 10);
  const dieSize = parseInt(match[2], 10);
  const modifierString = match[3] || "";
  const baseMod = modifierString
    .replace(/\s+/g, "")
    .split(/(?=[+-])/)
    .filter(part => part.length)
    .reduce((sum, part) => sum + parseInt(part, 10), 0);

  return { numDice, dieSize, baseMod };
}

function getSkillDieStatusModifier(actor, dieType) {
  const modifiers = actor?.system?.modifiers ?? {};
  let statusMod = Number(modifiers.all_mod ?? 0);

  if (["slash", "pierce", "blunt", "counter-slash", "counter-pierce", "counter-blunt"].includes(dieType)) {
    statusMod += Number(modifiers.off_mod ?? 0);
  }
  if (["block", "evade", "counter-block", "counter-evade"].includes(dieType)) {
    statusMod += Number(modifiers.def_mod ?? 0);
  }
  if (["slash", "counter-slash"].includes(dieType)) {
    statusMod += Number(modifiers.slash_mod ?? 0);
  }
  else if (["pierce", "counter-pierce"].includes(dieType)) {
    statusMod += Number(modifiers.pierce_mod ?? 0);
  }
  else if (["blunt", "counter-blunt"].includes(dieType)) {
    statusMod += Number(modifiers.blunt_mod ?? 0);
  }
  else if (["block", "counter-block"].includes(dieType)) {
    statusMod += Number(modifiers.block_mod ?? 0);
  }
  else if (["evade", "counter-evade"].includes(dieType)) {
    statusMod += Number(modifiers.evade_mod ?? 0);
  }

  return statusMod;
}

function buildSkillRollModifierDisplay(mod, statusMod) {
  let display = "";

  if (mod > 0) {
    display += ` + ${mod}`;
  } else if (mod < 0) {
    display += ` - ${-mod}`;
  }

  if (statusMod > 0) {
    display += ` + ${statusMod}`;
  } else if (statusMod < 0) {
    display += ` - ${-statusMod}`;
  }

  return display;
}

function buildSkillRollFormulaDisplay({ numDice, dieSize, baseMod, mod, statusMod, roll, paralysis, poise, chargeTotals }) {
  const modifierDisplay = `${buildSkillRollModifierDisplay(mod, statusMod)} = ${roll.total}`;

  if (paralysis) {
    return `<div style="display: flex;"><img src="systems/sotc/assets/statuses/Paralyze.png" title="Paralyze" style="height: 20px; width: 20px; vertical-align: middle; margin-right: 3px; border: none; filter: drop-shadow(1px 1px 2px black)">(${numDice}d${dieSize}) + ${baseMod}${modifierDisplay}</div>`;
  }

  if (poise) {
    return `<div style="display: flex;"><img src="systems/sotc/assets/statuses/Poise.png" title="Poise" style="height: 20px; width: 20px; vertical-align: middle; margin-right: 3px; border: none; filter: drop-shadow(1px 1px 2px black)">(${numDice}d${dieSize}) + ${baseMod}${modifierDisplay}</div>`;
  }

  if (Array.isArray(chargeTotals) && chargeTotals.length === 2) {
    return `<div style="display: flex;"><img src="${ROLL_DIALOG_CHARGE_ICON_PATH}" title="Charge" style="height: 20px; width: 20px; vertical-align: middle; margin-right: 3px; border: none; filter: drop-shadow(1px 1px 2px black)">${numDice}d${dieSize}(${chargeTotals[0]}, ${chargeTotals[1]}) + ${baseMod}${modifierDisplay}</div>`;
  }

  return `${numDice}d${dieSize} + ${baseMod}${modifierDisplay}`;
}

function buildSkillDieModuleLine(modules) {
  if (!modules.length) return "";
  return `<div style="margin-top: 4px; font-size: 12px;"><em>${modules.map(moduleText => `<div style="margin-left: 5px;">• ${moduleText}</div>`).join("")}</em></div>`;
}

function buildSkillDiePayload(actor, item, die) {
  return {
    dieType: die.type,
    actorId: actor.id,
    itemId: item.id,
    itemName: item.name,
    isOffensive: ["slash", "pierce", "blunt", "counter-slash", "counter-pierce", "counter-blunt"].includes(die.type),
    isDefensive: ["block", "evade", "counter-block", "counter-evade"].includes(die.type)
  };
}

async function rollSkillDialogDie({ actor, die, input, availableCharge }) {
  const index = String(input?.dataset?.dieIndex ?? "").trim();
  const mod = parseInt(input?.querySelector(`input[name="mod-${index}"]`)?.value, 10) || 0;
  const paralysis = Boolean(input?.querySelector(`input[name="paralysis-${index}"]`)?.checked);
  const poise = Boolean(input?.querySelector(`input[name="poise-${index}"]`)?.checked);
  const wantsCharge = Boolean(input?.querySelector(`input[name="charge-${index}"]`)?.checked);

  const parsedFormula = parseSkillRollDieFormula(die?.formula);
  if (!parsedFormula) {
    return {
      die,
      isError: true,
      message: `Invalid formula: <code>${escapeHtml(die?.formula ?? "")}</code>. Must be of the format XdY+Z`
    };
  }

  const { numDice, dieSize, baseMod } = parsedFormula;
  const statusMod = getSkillDieStatusModifier(actor, die?.type);
  const standardFormula = `${numDice}d${dieSize} + ${baseMod} + ${mod} + ${statusMod}`;
  let roll;
  let chargeTotals = null;
  let usedCharge = false;

  if (paralysis) {
    const total = numDice + baseMod + mod + statusMod;
    roll = await new Roll(`${total}`).roll({ async: true });
  } else if (poise) {
    const total = numDice * dieSize + baseMod + mod + statusMod;
    roll = await new Roll(`${total}`).roll({ async: true });
  } else if (wantsCharge && availableCharge > 0) {
    const firstRoll = await new Roll(standardFormula).roll({ async: true });
    const secondRoll = await new Roll(standardFormula).roll({ async: true });
    const totalModifier = baseMod + mod + statusMod;
    chargeTotals = [firstRoll.total - totalModifier, secondRoll.total - totalModifier];
    roll = firstRoll.total >= secondRoll.total ? firstRoll : secondRoll;
    usedCharge = true;
  } else {
    roll = await new Roll(standardFormula).roll({ async: true });
  }

  return {
    die,
    roll,
    formulaForDisplay: buildSkillRollFormulaDisplay({
      numDice,
      dieSize,
      baseMod,
      mod,
      statusMod,
      roll,
      paralysis,
      poise,
      chargeTotals
    }),
    mod,
    status_mod: statusMod,
    usedCharge,
    input,
    chargeInput: input?.querySelector(`input[name="charge-${index}"]`) ?? null,
    chargeIcon: input?.querySelector(`.toggle_icon[data-type="charge"][data-index="${index}"]`) ?? null
  };
}

async function applySkillRollResourceCosts(actor, item) {
  if (!actor || !item) return;

  const updates = {};

  const lightCost = Number(item.system?.light_cost ?? 0);
  if (lightCost > 0) {
    const currentLight = Number(foundry.utils.getProperty(actor.system, "light.value") ?? 0);
    updates["system.light.value"] = Math.max(currentLight - lightCost, 0);
  }

  const emotionCost = Number(item.system?.emotion_cost ?? 0);
  if (emotionCost > 0) {
    const currentEmotion = Number(foundry.utils.getProperty(actor.system, "emotion") ?? 0);
    updates["system.emotion"] = Math.max(currentEmotion - emotionCost, 0);
  }

  const maxUses = Number(item.system?.limit?.max ?? 0);
  if (maxUses > 0) {
    const currentUses = Number(item.system?.limit?.value ?? maxUses);
    await item.update({ "system.limit.value": Math.max(currentUses - 1, 0) });
  }

  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
  }
}

async function createSkillRollDeclarationMessage(actor, item) {
  const dice = getSkillRollDialogDice(item);
  const skillModules = item.system?.skill_modules?.mods;
  const lightCost = item.system?.light_cost;
  const lightCostLine = `<p><strong>Light Cost:</strong> ${lightCost}</p>`;
  const weight = item.system?.weight;
  const weightLine = weight > 1 ? `<p><strong>Attack Weight:</strong> ${weight}</p>` : "";
  const skillModulesLine = skillModules ? `<div class="skill-modules" style="white-space: pre-wrap;">${skillModules}</div>` : "";

  const diceSummaries = dice.map(die => {
    const icon = `systems/sotc/assets/dice types/${die.type}.png`;
    const colorClass = `die-color-${die.type}`;
    const formula = die.formula;
    const modules = Object.values(die.mods ?? {});
    const moduleLine = buildSkillDieModuleLine(modules);

    return `
      <div style="margin-bottom: 5px;">
        <span class="${colorClass}" style="vertical-align: middle; font-size: 16px; text-shadow: black 0.5px 0.5px">
          <div style="display: flex; gap: 4px;">
            <img src="${icon}" alt="${escapeHtml(die.type)}" title="${escapeHtml(die.type)}" style="height: 30px; width: 30px; vertical-align: middle; border: none;">
            <strong style="margin-top: 4px;">${escapeHtml(formula)}</strong>
          </div>
        </span>
        ${moduleLine}
      </div>
    `;
  }).join("");

  const messageContent = `
    <div class="skill-declaration">
      <h3>${escapeHtml(item.name)}</h3>
      ${lightCostLine}
      ${weightLine}
      ${skillModulesLine}
      <p><strong>Dice:</strong></p>
      ${diceSummaries}
    </div>
  `;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: messageContent,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });
}

function bindPatchedSkillRollDialogRoot(root, actor, item) {
  if (!root || root.dataset.sbsPatchedSkillRollDialogBound === "true") return;
  root.dataset.sbsPatchedSkillRollDialogBound = "true";

  decorateSkillRollDialogChargeToggle(root);

  root.querySelectorAll('.toggle_icon[data-type="paralysis"], .toggle_icon[data-type="poise"]').forEach(icon => {
    icon.addEventListener("click", () => {
      const index = icon.dataset.index;
      const type = icon.dataset.type;
      const otherType = type === "paralysis" ? "poise" : "paralysis";

      const currentIcon = icon;
      const otherIcon = root.querySelector(`.toggle_icon[data-type="${otherType}"][data-index="${index}"]`);
      const currentInput = root.querySelector(`input[name="${type}-${index}"]`);
      const otherInput = root.querySelector(`input[name="${otherType}-${index}"]`);
      if (!currentInput || !otherInput) return;

      const isSelected = currentInput.checked;

      currentInput.checked = false;
      otherInput.checked = false;
      currentIcon.classList.remove("selected");
      otherIcon?.classList.remove("selected");

      if (!isSelected) {
        currentInput.checked = true;
        currentIcon.classList.add("selected");
      }
    });
  });

  root.querySelectorAll(".dialog_individual_roll-button").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      const index = parseInt(button.dataset.index ?? "", 10);
      if (Number.isNaN(index)) return;
      void handleSkillRollDialogIndividualRoll(root, actor, item, index);
    });
  });
}

async function openPatchedSkillRollDialog(actor, item) {
  const diceArray = getSkillRollDialogDice(item);
  if (!diceArray.length) {
    return ui.notifications.warn("WHAT ARE YOU DOING!!! Your skill has no dice array!!! How'd you even manage that!!! Tell me about it...");
  }

  const dialogContent = await renderTemplate("systems/sotc/templates/skill-roll-dialog.html", {
    dice: diceArray
  });

  let dialog = null;
  dialog = new Dialog({
    title: `Roll Skill: ${item.name}`,
    content: dialogContent,
    buttons: {
      declare: {
        icon: '<i class="fas fa-exclamation-circle"></i>',
        label: "Reveal",
        callback: async () => {
          await createSkillRollDeclarationMessage(actor, item);
        }
      },
      roll: {
        icon: '<i class="fas fa-dice"></i>',
        label: "Roll",
        callback: async html => {
          const root = getRenderedHtmlRoot(html);
          if (!root) return;
          await handleSkillRollDialogFullRoll(dialog, root, actor, item);
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    },
    default: "declare",
    render: html => {
      const root = getRenderedHtmlRoot(html);
      if (!root) return;
      bindPatchedSkillRollDialogRoot(root, actor, item);
    }
  }, {
    classes: ["sotc_skill_roll_dialog"]
  });

  dialog._sbsHandledChargeRollDialog = true;
  dialog.render(true);
  return dialog;
}

async function createSkillRollSummaryChatMessage(actor, item, results) {
  const skillModules = item.system?.skill_modules?.mods;
  const lightCost = item.system?.light_cost;
  const lightCostLine = `<p><strong>Light Cost:</strong> ${lightCost}</p>`;
  const weight = item.system?.weight;
  const weightLine = weight > 1 ? `<p><strong>Attack Weight:</strong> ${weight}</p>` : "";
  const skillModulesLine = skillModules ? `<div class="skill-modules" style="white-space: pre-wrap;">${skillModules}</div>` : "";

  const diceSummaries = results.map(result => {
    if (result?.isError) {
      return `<div style="margin-bottom: 5px;"><strong>Error:</strong> ${result.message}</div>`;
    }

    const { die, roll, formulaForDisplay, mod, status_mod: statusMod } = result;
    const icon = `systems/sotc/assets/dice types/${die.type}.png`;
    const colorClass = `die-color-${die.type}`;
    const modules = Object.values(die.mods ?? {});
    const moduleLine = buildSkillDieModuleLine(modules);
    const payload = buildSkillDiePayload(actor, item, die);
    payload.total = roll.total;

    return `
      <div style="margin-bottom: 5px;">
        <span class="${colorClass}" style="vertical-align: middle; font-size: 16px;">
          <div style="display: flex; gap: 4px;">
            <img src="${icon}" alt="${escapeHtml(die.type)}" title="${escapeHtml(die.type)}" style="height: 30px; width: 30px; vertical-align: middle; border: none;">
            <strong style="text-shadow: black 0.5px 0.5px; margin-top: 4px;">${formulaForDisplay}</strong>
            <a class="reroll-die" data-formula="${escapeHtml(die.formula)}" data-type="${escapeHtml(die.type)}" title="Reroll die!"
              data-actor-id="${actor.id}"
              data-mod="${mod}"
              data-statmod="${statusMod}"
              data-color="die-color-${escapeHtml(die.type)}"
              data-modules='${escapeHtml(JSON.stringify(modules))}'
              data-itemname="${escapeHtml(item.name)}"
              style="width: 16px; height: 16px; color: black; margin-left: 8px; margin-top: 4px;">
              <i class="fas fa-rotate-left"></i>
            </a>
            <a class="resolve-die"
              title="Apply Die!"
              data-payload='${escapeHtml(JSON.stringify(payload))}'
              style="width: 16px; height: 16px; color: black; margin-left: 8px; margin-top: 4px;">
              <i class="fas fa-bolt"></i>
            </a>
          </div>
        </span>
        ${moduleLine}
      </div>
    `;
  }).join("");

  const flavor = `
    <div class="skill-roll-summary">
      <h3>${escapeHtml(item.name)}</h3>
      ${lightCostLine}
      ${weightLine}
      ${skillModulesLine}
      <p><strong>Dice Rolled:</strong></p>
      ${diceSummaries}
      <hr>
      <a class="toggle-roll-details" style="cursor: pointer; font-size: 12px; color: #888;">
        ⯈ Show Roll Details
      </a>
    </div>
  `;

  let chatMessageId;
  Hooks.once("renderChatMessage", (message, html) => {
    if (message.id !== chatMessageId) return;

    const diceRolls = html.find(".dice-roll");
    if (!diceRolls.length) return;

    const wrapper = $("<div class=\"roll-details-wrapper\" style=\"display: none;\"></div>");
    diceRolls.wrapAll(wrapper);

    const toggleLink = html.find(".toggle-roll-details");
    toggleLink.on("click", () => {
      const wasHidden = html.find(".roll-details-wrapper").is(":hidden");
      html.find(".roll-details-wrapper").toggle();
      toggleLink.html(wasHidden ? "⯆ Hide Roll Details" : "⯈ Show Roll Details");
      toggleLink.toggleClass("open", wasHidden);
    });
  });

  const validRolls = results.filter(result => result?.roll).map(result => result.roll);
  const chatMessage = await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    rolls: validRolls,
    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
    rollMode: game.settings.get("core", "rollMode"),
    sound: CONFIG.sounds.dice
  });

  chatMessageId = chatMessage.id;
  return chatMessage;
}

async function sendIndividualSkillDieMessage(actor, item, result) {
  const { die, roll, formulaForDisplay, mod, status_mod: statusMod } = result;
  const modules = Object.values(die.mods ?? {});
  const moduleLine = buildSkillDieModuleLine(modules);
  const payload = buildSkillDiePayload(actor, item, die);
  payload.total = roll.total;

  const icon = `systems/sotc/assets/dice types/${die.type}.png`;
  const colorClass = `die-color-${die.type}`;
  const flavor = `
    <div class="skill-die-roll">
      <h3>${escapeHtml(item.name)}</h3>
      <div style="margin-left:5px; margin-bottom:5px;">
        <span class="${colorClass}" style="margin-left: 5px; vertical-align: middle; font-size: 16px;">
          <div style="display: flex; gap: 4px;">
            <img src="${icon}" alt="${escapeHtml(die.type)}" style="height: 30px; width: 30px; vertical-align: middle; border: none;">
            <strong style="text-shadow: black 0.5px 0.5px; margin-top: 4px;">${formulaForDisplay}</strong>
            <a class="reroll-die" data-formula="${escapeHtml(die.formula)}" data-type="${escapeHtml(die.type)}" title="Reroll this die"
              data-actor-id="${actor.id}"
              data-mod="${mod}"
              data-statmod="${statusMod}"
              data-color="die-color-${escapeHtml(die.type)}"
              data-modules='${escapeHtml(JSON.stringify(modules))}'
              data-itemname="${escapeHtml(item.name)}"
              style="width: 16px; height: 16px; color: black; margin-left: 8px; margin-top: 4px;">
              <i class="fas fa-rotate-left"></i>
            </a>
            <a class="resolve-die"
              title="Apply Die!"
              data-payload='${escapeHtml(JSON.stringify(payload))}'
              style="width: 16px; height: 16px; color: black; margin-left: 8px; margin-top: 4px;">
              <i class="fas fa-bolt"></i>
            </a>
          </div>
        </span>
        ${moduleLine}
      </div>
    </div>
  `;

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor,
    rolls: [roll],
    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
    rollMode: game.settings.get("core", "rollMode"),
    sound: CONFIG.sounds.dice
  });
}

async function handleSkillRollDialogFullRoll(app, root, actor, item) {
  const dice = getSkillRollDialogDice(item);
  const results = [];
  let availableCharge = getActorChargeCount(actor);
  let spentCharge = 0;

  for (let index = 0; index < dice.length; index += 1) {
    const die = dice[index];
    const input = root.querySelector(`[data-die-index="${index}"]`);
    if (!input) continue;

    const result = await rollSkillDialogDie({
      actor,
      die,
      input,
      availableCharge
    });

    if (result.usedCharge) {
      availableCharge -= 1;
      spentCharge += 1;
    }

    results.push(result);
  }

  if (spentCharge > 0) {
    await consumeActorCharge(actor, spentCharge);
  }

  await applySkillRollResourceCosts(actor, item);
  await createSkillRollSummaryChatMessage(actor, item, results);
  await app.close();
}

async function handleSkillRollDialogIndividualRoll(root, actor, item, index) {
  const dice = getSkillRollDialogDice(item);
  const die = dice[index];
  if (!die) return;

  const input = root.querySelector(`[data-die-index="${index}"]`);
  if (!input) return;

  const result = await rollSkillDialogDie({
    actor,
    die,
    input,
    availableCharge: getActorChargeCount(actor)
  });

  if (result.isError) {
    ui.notifications.error(`Invalid formula: ${die.formula}`);
    return;
  }

  if (result.usedCharge) {
    await consumeActorCharge(actor, 1);
    if (result.chargeInput) result.chargeInput.checked = false;
    result.chargeIcon?.classList.remove("selected");
  }

  await sendIndividualSkillDieMessage(actor, item, result);
}

function bindSkillRollDialogChargeHandlers(app, html) {
  const { root, container, actor, item } = resolveSkillRollDialogContext(app, html);
  if (!isSkillRollDialogRoot(root) || !container || !actor || !item) return;

  if (container.dataset.sbsChargeHandlersBound === "true") return;
  container.dataset.sbsChargeHandlersBound = "true";

  const fullRollButton = container.querySelector('.dialog-button[data-button="roll"], button[data-button="roll"]');
  if (fullRollButton) {
    fullRollButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      void handleSkillRollDialogFullRoll(app, root, actor, item);
    }, true);
  }

  for (const button of root.querySelectorAll(".dialog_individual_roll-button")) {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const index = parseInt(button.dataset.index, 10);
      if (Number.isNaN(index)) return;
      void handleSkillRollDialogIndividualRoll(root, actor, item, index);
    }, true);
  }
}

function installSkillRollDialogContextCapture() {
  const sheetClasses = getSkillRollDialogSheetClasses();
  if (!sheetClasses.length) {
    console.warn(`[${MODULE_ID}] Unable to find a SotC actor sheet class to patch for Charge roll dialogs.`);
    return;
  }

  for (const sheetClass of sheetClasses) {
    const prototype = sheetClass?.prototype;
    if (!prototype || prototype._sbsChargeRollDialogPatched) continue;

    const originalOnRollFullSkill = prototype._onRollFullSkill;
    if (typeof originalOnRollFullSkill !== "function") continue;

    prototype._sbsOriginalOnRollFullSkill = originalOnRollFullSkill;

    prototype._onRollFullSkill = async function sbsOnRollFullSkill(event) {
      event.preventDefault();

      const button = event?.currentTarget;
      const card = button?.closest?.(".skill_card");
      const itemId = String(card?.dataset?.itemId ?? "").trim();
      const item = itemId ? this.actor?.items?.get(itemId) ?? null : null;

      if (!item) {
        return ui.notifications.warn("Oh buddy, I don't know if this is worse than the other error. Your item is missing??? Tell me about it...");
      }

      return openPatchedSkillRollDialog(this.actor, item);
    };

    prototype._sbsChargeRollDialogPatched = true;
  }
}

function isSkillRollDialogRoot(root) {
  if (!root) return false;
  if (!root.querySelector('.roll_dialog .roll_dialog_box[data-die-index]')) return false;
  return Boolean(root.querySelector('.toggle_icon[data-type="poise"], .toggle_icon[data-type="paralysis"]'));
}

function decorateSkillRollDialogChargeToggle(html) {
  const root = getRenderedHtmlRoot(html);
  if (!isSkillRollDialogRoot(root)) return;

  for (const rollBox of root.querySelectorAll('.roll_dialog_box[data-die-index]')) {
    const index = String(rollBox.dataset.dieIndex ?? '').trim();
    if (!index) continue;
    if (rollBox.querySelector(`.toggle_icon[data-type="charge"][data-index="${index}"]`)) continue;

    const referenceInput = rollBox.querySelector(`input[name="poise-${index}"], input[name="paralysis-${index}"]`);
    const poiseIcon = rollBox.querySelector(`.toggle_icon[data-type="poise"][data-index="${index}"]`);
    const referenceIcon = poiseIcon ?? rollBox.querySelector(`.toggle_icon[data-type="paralysis"][data-index="${index}"]`);
    if (!referenceIcon) continue;

    let chargeInput = rollBox.querySelector(`input[name="charge-${index}"]`);
    if (!chargeInput) {
      chargeInput = root.ownerDocument.createElement('input');
      chargeInput.className = 'hidden_toggle';
      chargeInput.type = 'checkbox';
      chargeInput.name = `charge-${index}`;
      chargeInput.id = `charge-${index}`;

      if (referenceInput) {
        referenceInput.insertAdjacentElement('afterend', chargeInput);
      } else {
        rollBox.insertBefore(chargeInput, referenceIcon);
      }
    }

    const chargeIcon = referenceIcon.cloneNode(false);
    chargeIcon.src = ROLL_DIALOG_CHARGE_ICON_PATH;
    chargeIcon.dataset.type = 'charge';
    chargeIcon.dataset.index = index;
    chargeIcon.alt = 'Charge';
    chargeIcon.title = 'Charge';
    chargeIcon.classList.remove('selected');

    chargeIcon.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();

      const nextState = !chargeInput.checked;
      chargeInput.checked = nextState;
      chargeIcon.classList.toggle('selected', nextState);
    });

    referenceIcon.insertAdjacentElement('afterend', chargeIcon);
  }
}

function scheduleSkillRollDialogChargeDecoration(app, html) {
  if (app?._sbsHandledChargeRollDialog) return;

  const root = getRenderedHtmlRoot(html);
  if (!isSkillRollDialogRoot(root)) return;

  decorateSkillRollDialogChargeToggle(html);
  bindSkillRollDialogChargeHandlers(app, html);

  requestAnimationFrame(() => {
    const liveRoot = getRenderedHtmlRoot(html);
    if (!liveRoot?.isConnected) return;
    decorateSkillRollDialogChargeToggle(html);
    bindSkillRollDialogChargeHandlers(app, html);
  });
}

function normalizeCutsceneName(value) {
  const nameText = String(value ?? "").trim();
  if (nameText) return nameText;
  return CUTSCENE_DEFAULT_NAME;
}

function getNextCutsceneName(cutscenes) {
  const usedNames = new Set();
  for (const cutscene of cutscenes) {
    const nameText = String(cutscene?.name ?? "").trim().toLowerCase();
    if (nameText) usedNames.add(nameText);
  }

  let nextNumber = 1;

  while (usedNames.has(`cutscene ${nextNumber}`)) {
    nextNumber += 1;
  }

  return `Cutscene ${nextNumber}`;
}

function normalizeCutsceneSlide(slide) {
  const pathStr = String(slide?.path ?? slide ?? "").trim();
  if (!pathStr) return null;

  return {
    id: String(slide?.id ?? foundry.utils.randomID()),
    path: pathStr
  };
}

function normalizeCutsceneScale(value) {
  const scaleNum = Number(value);
  if (!Number.isFinite(scaleNum)) return 1;

  const rounded = Math.round(scaleNum * 100) / 100;
  return Math.min(Math.max(rounded, 1), 3);
}

function normalizeCutsceneData(cutscene) {
  const slideList = [];
  for (const slide of arrayify(cutscene?.slides)) {
    const fixedSlide = normalizeCutsceneSlide(slide);
    if (fixedSlide) slideList.push(fixedSlide);
  }

  return {
    id: String(cutscene?.id ?? foundry.utils.randomID()),
    name: normalizeCutsceneName(cutscene?.name),
    scale: normalizeCutsceneScale(cutscene?.scale),
    slides: slideList
  };
}

function clampCutsceneSlideIndex(cutscene, slideIndex) {
  const maxSlides = Array.isArray(cutscene?.slides) ? cutscene.slides.length : 0;
  if (!maxSlides) return 0;

  const maybeIndex = Number(slideIndex);
  const safeIndex = Number.isFinite(maybeIndex) ? Math.trunc(maybeIndex) : 0;
  return Math.min(Math.max(safeIndex, 0), maxSlides - 1);
}

function buildCutsceneStoragePayload(cutscenes = []) {
  return {
    version: CUTSCENE_STORAGE_VERSION,
    entries: cutscenes.map(normalizeCutsceneData)
  };
}

function parseStoredCutsceneEntries(raw) {
  if (typeof raw === "string") {
    const savedText = raw.trim();
    if (!savedText) return null;

    try {
      return parseStoredCutsceneEntries(JSON.parse(savedText));
    } catch (error) {
      console.warn(`[${MODULE_ID}] Failed to parse saved cutscene data.`, error);
      return null;
    }
  }

  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.entries)) return raw.entries;
  return null;
}

function getStoredCutscenes() {
  const savedStuff = game.settings.get(MODULE_ID, CUTSCENE_STORAGE_SETTING_KEY);
  const savedEntries = parseStoredCutsceneEntries(savedStuff);
  if (savedEntries) {
    return savedEntries.map(normalizeCutsceneData);
  }

  const oldStuff = game.settings.get(MODULE_ID, CUTSCENE_SETTING_KEY);
  const oldEntries = parseStoredCutsceneEntries(oldStuff) ?? [];

  return oldEntries.map(normalizeCutsceneData);
}

async function saveStoredCutscenes(cutscenes) {
  const saveBlob = buildCutsceneStoragePayload(cutscenes);
  const savedEntries = saveBlob.entries;

  cutsceneSaveQueue = cutsceneSaveQueue
    .catch(() => undefined)
    .then(async () => {
      await game.settings.set(MODULE_ID, CUTSCENE_STORAGE_SETTING_KEY, JSON.stringify(saveBlob));

      try {
        await game.settings.set(MODULE_ID, CUTSCENE_SETTING_KEY, saveBlob);
      } catch (error) {
        console.warn(`[${MODULE_ID}] Failed to mirror cutscene data to the legacy setting.`, error);
      }
    });

  await cutsceneSaveQueue;
  return savedEntries;
}

function rememberCutsceneSocketId(socketId) {
  if (!socketId || processedCutsceneSocketLookup.has(socketId)) {
    return false;
  }

  processedCutsceneSocketLookup.add(socketId);
  processedCutsceneSocketIds.push(socketId);

  while (processedCutsceneSocketIds.length > CUTSCENE_SOCKET_CACHE_LIMIT) {
    const oldId = processedCutsceneSocketIds.shift();
    if (oldId) {
      processedCutsceneSocketLookup.delete(oldId);
    }
  }

  return true;
}

function getCutsceneOverlayElements() {
  const root = ensureCutsceneOverlayRoot();
  const imgList = Array.from(root.querySelectorAll("[data-cutscene-image]"));
  return {
    root,
    images: imgList,
    title: root.querySelector("[data-cutscene-title]"),
    counter: root.querySelector("[data-cutscene-counter]"),
    hint: root.querySelector("[data-cutscene-hint]"),
    closeButton: root.querySelector("[data-cutscene-action='close']")
  };
}

function resetCutsceneOverlayImages(imageElements) {
  for (const img of imageElements ?? []) {
    if (!img) continue;

    img.classList.remove("is-active");
    img.removeAttribute("src");
    img.alt = "Cutscene slide";
    img.removeAttribute("data-cutscene-path");
    img.removeAttribute("data-transition-id");
    img.onload = null;
    img.onerror = null;
  }
}

function transitionCutsceneOverlayImages(imageElements, slidePath, slideAlt) {
  const imgList = Array.isArray(imageElements) ? imageElements.filter(Boolean) : [];
  if (!imgList.length) return;

  let liveImg = null;
  for (const img of imgList) {
    if (img.classList.contains("is-active") && img.dataset.cutscenePath) {
      liveImg = img;
      break;
    }
  }

  if (!liveImg) {
    resetCutsceneOverlayImages(imgList);

    const firstImg = imgList[0];
    firstImg.dataset.cutscenePath = slidePath;
    firstImg.src = slidePath;
    firstImg.alt = slideAlt;
    firstImg.classList.add("is-active");
    return;
  }

  if (liveImg.dataset.cutscenePath === slidePath) {
    liveImg.alt = slideAlt;
    return;
  }

  let nextImg = null;
  for (const img of imgList) {
    if (img !== liveImg) {
      nextImg = img;
      break;
    }
  }
  if (!nextImg) nextImg = imgList[0];

  const swapId = String(++cutsceneOverlayImageTransitionId);

  nextImg.dataset.transitionId = swapId;
  nextImg.dataset.cutscenePath = slidePath;
  nextImg.alt = slideAlt;
  nextImg.onload = null;
  nextImg.onerror = null;

  const doneSwap = () => {
    if (nextImg.dataset.transitionId !== swapId) return;

    nextImg.classList.add("is-active");
    liveImg.classList.remove("is-active");

    window.setTimeout(() => {
      if (liveImg.classList.contains("is-active")) return;

      liveImg.removeAttribute("src");
      liveImg.alt = "Cutscene slide";
      liveImg.removeAttribute("data-cutscene-path");
      liveImg.removeAttribute("data-transition-id");
    }, CUTSCENE_IMAGE_FADE_MS);
  };

  nextImg.src = slidePath;
  if (nextImg.complete && nextImg.naturalWidth > 0) {
    requestAnimationFrame(doneSwap);
    return;
  }

  nextImg.onload = () => {
    nextImg.onload = null;
    nextImg.onerror = null;
    requestAnimationFrame(doneSwap);
  };

  nextImg.onerror = () => {
    nextImg.onload = null;
    nextImg.onerror = null;
    requestAnimationFrame(doneSwap);
  };
}

function ensureCutsceneOverlayRoot() {
  if (cutsceneOverlayRoot?.isConnected) return cutsceneOverlayRoot;

  const alreadyThere = document.getElementById(CUTSCENE_OVERLAY_ID);
  if (alreadyThere) {
    cutsceneOverlayRoot = alreadyThere;
    return alreadyThere;
  }

  const root = document.createElement("section");
  root.id = CUTSCENE_OVERLAY_ID;
  root.className = "sbs-cutscene-overlay";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="sbs-cutscene-overlay__shell">
      <header class="sbs-cutscene-overlay__header">
        <div class="sbs-cutscene-overlay__title-wrap">
          <h2 class="sbs-cutscene-overlay__title" data-cutscene-title></h2>
        </div>
        <div class="sbs-cutscene-overlay__meta">
          <div class="sbs-cutscene-overlay__counter" data-cutscene-counter></div>
          <button type="button" class="sbs-cutscene-overlay__close" data-cutscene-action="close">End</button>
        </div>
      </header>
      <div class="sbs-cutscene-overlay__stage">
        <img class="sbs-cutscene-overlay__image" data-cutscene-image alt="Cutscene slide">
        <img class="sbs-cutscene-overlay__image" data-cutscene-image alt="Cutscene slide">
      </div>
      <div class="sbs-cutscene-overlay__hint" data-cutscene-hint>
        Click, press Space, Enter, or Right Arrow to continue. Left Arrow goes back. Escape ends the cutscene.
      </div>
    </div>
  `;

  root.addEventListener("click", handleCutsceneOverlayClick);
  window.addEventListener("keydown", handleCutsceneOverlayKeydown, true);
  document.body.appendChild(root);

  cutsceneOverlayRoot = root;
  return root;
}

function renderCutsceneOverlay() {
  if (!cutsceneOverlayRoot && !activeCutsceneState) return;

  const overlayBits = getCutsceneOverlayElements();
  const rootEl = overlayBits.root;
  const imageEls = overlayBits.images;
  const titleEl = overlayBits.title;
  const counterEl = overlayBits.counter;
  const hintEl = overlayBits.hint;
  const closeBtn = overlayBits.closeButton;
  const isGM = Boolean(game.user?.isGM);

  rootEl.classList.toggle("is-gm", isGM);
  counterEl.hidden = !isGM;
  hintEl.hidden = !isGM;
  closeBtn.hidden = !isGM;

  if (!activeCutsceneState?.cutscene?.slides?.length) {
    rootEl.classList.remove("is-active");
    rootEl.setAttribute("aria-hidden", "true");
    rootEl.style.setProperty("--sbs-cutscene-scale", "1");
    titleEl.textContent = "";
    counterEl.textContent = "";
    resetCutsceneOverlayImages(imageEls);
    return;
  }

  const liveCutscene = activeCutsceneState.cutscene;
  const slideIndex = activeCutsceneState.slideIndex;
  const slide = liveCutscene.slides[slideIndex] ?? liveCutscene.slides[0];

  rootEl.classList.add("is-active");
  rootEl.setAttribute("aria-hidden", "false");
  rootEl.style.setProperty("--sbs-cutscene-scale", String(normalizeCutsceneScale(liveCutscene.scale)));
  titleEl.textContent = liveCutscene.name;
  counterEl.textContent = `${slideIndex + 1} / ${liveCutscene.slides.length}`;
  transitionCutsceneOverlayImages(imageEls, slide.path, `${liveCutscene.name} slide ${slideIndex + 1}`);
}

function applyCutsceneState(cutscene, slideIndex = 0) {
  if (!cutscenesFeatureEnabled()) {
    closeCutsceneOverlay();
    return;
  }

  const realCutscene = normalizeCutsceneData(cutscene);
  if (!realCutscene.slides.length) {
    closeCutsceneOverlay();
    return;
  }

  activeCutsceneState = {
    cutscene: realCutscene,
    slideIndex: clampCutsceneSlideIndex(realCutscene, slideIndex)
  };

  renderCutsceneOverlay();
  if (cutsceneManagerApp?.rendered) cutsceneManagerApp.render(false);
}

function closeCutsceneOverlay() {
  activeCutsceneState = null;
  renderCutsceneOverlay();
  cutsceneManagerApp?.rendered && cutsceneManagerApp.render(false);
}

function handleCutsceneSocketMessage(message) {
  if (!cutscenesFeatureEnabled()) {
    closeCutsceneOverlay();
    return;
  }

  if (!rememberCutsceneSocketId(message?.id)) return;

  switch (message?.action) {
    case "show-cutscene":
      applyCutsceneState(message.cutscene, message.slideIndex);
      break;
    case "close-cutscene":
      closeCutsceneOverlay();
      break;
    default:
      break;
  }
}

function installCutsceneSocket() {
  if (!game.socket) return;
  game.socket.on(CUTSCENE_SOCKET_NAMESPACE, handleCutsceneSocketMessage);
}

function emitCutsceneSocketMessage(action, data = {}) {
  if (!game.user?.isGM) return;

  const outMsg = {
    id: foundry.utils.randomID(),
    userId: game.user.id,
    action,
    ...data
  };

  handleCutsceneSocketMessage(outMsg);
  game.socket?.emit(CUTSCENE_SOCKET_NAMESPACE, outMsg);
}

function requestCutscenePlayback(cutscene, slideIndex = 0) {
  if (!game.user?.isGM || !cutscenesFeatureEnabled()) return;
  const realCutscene = normalizeCutsceneData(cutscene);
  if (!realCutscene.slides.length) {
    ui.notifications?.warn("Add at least one image before playing the cutscene.");
    return;
  }

  emitCutsceneSocketMessage("show-cutscene", {
    cutscene: realCutscene,
    slideIndex: clampCutsceneSlideIndex(realCutscene, slideIndex)
  });
}

function requestCutsceneAdvance() {
  if (!game.user?.isGM || !cutscenesFeatureEnabled() || !activeCutsceneState?.cutscene?.slides?.length) return;
  const nxt = activeCutsceneState.slideIndex + 1;
  if (nxt >= activeCutsceneState.cutscene.slides.length) {
    requestCutsceneClose();
    return;
  }

  requestCutscenePlayback(activeCutsceneState.cutscene, nxt);
}

function requestCutscenePrevious() {
  if (!game.user?.isGM || !cutscenesFeatureEnabled() || !activeCutsceneState?.cutscene?.slides?.length) return;
  const prev = activeCutsceneState.slideIndex - 1;
  if (prev < 0) return;

  requestCutscenePlayback(activeCutsceneState.cutscene, prev);
}

function requestCutsceneClose() {
  if (!game.user?.isGM || !cutscenesFeatureEnabled()) {
    closeCutsceneOverlay();
    return;
  }

  emitCutsceneSocketMessage("close-cutscene");
}

function handleCutsceneOverlayClick(event) {
  if (!activeCutsceneState) return;

  event.preventDefault();
  event.stopPropagation();

  if (!game.user?.isGM) return;
  const btn = event.target.closest("[data-cutscene-action]");
  if (btn?.dataset.cutsceneAction === "close") {
    requestCutsceneClose();
    return;
  }

  requestCutsceneAdvance();
}

function handleCutsceneOverlayKeydown(event) {
  if (!activeCutsceneState || !game.user?.isGM) return;

  if ([" ", "Enter", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    requestCutsceneAdvance();
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    event.stopPropagation();
    requestCutscenePrevious();
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    requestCutsceneClose();
  }
}

function openCutsceneImagePicker(currentPath, callback) {
  if (typeof FilePicker !== "function") {
    ui.notifications?.warn("The Foundry file picker is not available right now.");
    return;
  }
  const fp = new FilePicker({
    type: "image",
    current: currentPath || "",
    callback: path => callback?.(String(path ?? "").trim())
  });

  fp.render(true);
}

class SBSCutsceneManager extends Application {
  constructor(options = {}) {
    super(foundry.utils.mergeObject({ id: CUTSCENE_MANAGER_APP_ID }, options, { inplace: false }));

    this.cutscenes = getStoredCutscenes();
    this.selectedCutsceneId = this.cutscenes[0]?.id ?? null;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sbs-cutscene-manager-app", "sotc", "sheet"],
      template: CUTSCENE_MANAGER_TEMPLATE_PATH,
      width: 1080,
      height: 760,
      resizable: true
    });
  }

  get title() {
    return "Cutscene Manager";
  }

  getSelectedCutscene() {
    this.ensureSelectedCutscene();
    for (const cutscene of this.cutscenes) {
      if (cutscene.id === this.selectedCutsceneId) return cutscene;
    }

    return null;
  }

  ensureSelectedCutscene() {
    for (const cutscene of this.cutscenes) {
      if (cutscene.id === this.selectedCutsceneId) return;
    }

    this.selectedCutsceneId = this.cutscenes[0]?.id ?? null;
  }

  syncDraftFromDom() {
    const pickedCutscene = this.getSelectedCutscene();
    const rootEl = this.element?.[0] ?? null;
    if (!pickedCutscene || !rootEl) return;

    const nameBox = rootEl.querySelector('[name="cutscene-name"]');
    if (nameBox) {
      pickedCutscene.name = normalizeCutsceneName(nameBox.value);
    }

    const scaleBox = rootEl.querySelector('[name="cutscene-scale"]');
    if (scaleBox) {
      const nextScale = normalizeCutsceneScale(scaleBox.value);
      pickedCutscene.scale = nextScale;
      scaleBox.value = nextScale.toFixed(2);
    }
  }

  async persistCutscenes() {
    this.cutscenes = await saveStoredCutscenes(this.cutscenes);
    this.ensureSelectedCutscene();
  }

  async getData(options) {
    this.ensureSelectedCutscene();
    const pickedCutscene = this.getSelectedCutscene();
    const liveCutsceneId = activeCutsceneState?.cutscene?.id ?? "";
    const list = [];

    for (const cutscene of this.cutscenes) {
      list.push({
        id: cutscene.id,
        name: cutscene.name,
        slideCountLabel: `${cutscene.slides.length} slide${cutscene.slides.length === 1 ? "" : "s"}`,
        isSelected: cutscene.id === this.selectedCutsceneId,
        isActive: cutscene.id === liveCutsceneId
      });
    }

    let pickedData = null;
    if (pickedCutscene) {
      const slideList = [];
      for (let i = 0; i < pickedCutscene.slides.length; i++) {
        const slide = pickedCutscene.slides[i];
        slideList.push({
          id: slide.id,
          path: slide.path,
          displayIndex: i + 1,
          canMoveUp: i > 0,
          canMoveDown: i < pickedCutscene.slides.length - 1
        });
      }

      pickedData = {
        id: pickedCutscene.id,
        name: pickedCutscene.name,
        scale: normalizeCutsceneScale(pickedCutscene.scale),
        isActive: pickedCutscene.id === liveCutsceneId,
        hasSlides: pickedCutscene.slides.length > 0,
        slideCountLabel: `${pickedCutscene.slides.length} slide${pickedCutscene.slides.length === 1 ? "" : "s"}`,
        slides: slideList
      };
    }

    return {
      hasCutscenes: this.cutscenes.length > 0,
      hasSelectedCutscene: Boolean(pickedCutscene),
      activeCutsceneName: activeCutsceneState?.cutscene?.name ?? "",
      cutscenes: list,
      selectedCutscene: pickedData
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    const rootEl = html?.[0] ?? html;
    if (!rootEl) return;

    rootEl.addEventListener("click", event => this.onRootClick(event));

    const nameBox = rootEl.querySelector('[name="cutscene-name"]');
    if (nameBox) {
      nameBox.addEventListener("change", event => {
        this.renameSelectedCutscene(event.currentTarget.value);
      });

      nameBox.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.currentTarget.blur();
      });
    }

    const scaleBox = rootEl.querySelector('[name="cutscene-scale"]');
    if (scaleBox) {
      scaleBox.addEventListener("change", event => {
        this.updateSelectedCutsceneScale(event.currentTarget.value);
      });

      scaleBox.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        event.currentTarget.blur();
      });
    }
  }

  async onRootClick(event) {
    const clicked = event.target.closest("[data-action]");
    if (!clicked) return;

    event.preventDefault();
    this.syncDraftFromDom();

    const actionName = clicked.dataset.action;
    const cutsceneId = clicked.dataset.cutsceneId;
    const slideId = clicked.dataset.slideId;
    //if you're seeing this, help me
    if (actionName === "create-cutscene") {
      await this.createCutscene();
      return;
    }
    if (actionName === "select-cutscene") {
      await this.selectCutscene(cutsceneId);
      return;
    }
    if (actionName === "play-cutscene") {
      await this.playSelectedCutscene();
      return;
    }
    if (actionName === "stop-cutscene") {
      requestCutsceneClose();
      return;
    }
    if (actionName === "delete-cutscene") {
      await this.deleteSelectedCutscene();
      return;
    }
    if (actionName === "add-slide") {
      this.addSlide();
      return;
    }
    if (actionName === "change-slide-image") {
      this.changeSlideImage(slideId);
      return;
    }
    if (actionName === "move-slide-up") {
      await this.moveSlide(slideId, -1);
      return;
    }
    if (actionName === "move-slide-down") {
      await this.moveSlide(slideId, 1);
      return;
    }
    if (actionName === "remove-slide") {
      await this.removeSlide(slideId);
    }
  }

  async createCutscene() {
    const newCutscene = normalizeCutsceneData({
      id: foundry.utils.randomID(),
      name: getNextCutsceneName(this.cutscenes),
      slides: []
    });

    this.cutscenes.push(newCutscene);
    this.selectedCutsceneId = newCutscene.id;
    await this.persistCutscenes();
    this.render(false);
  }

  async selectCutscene(cutsceneId) {
    if (!this.cutscenes.some(cutscene => cutscene.id === cutsceneId)) return;
    this.selectedCutsceneId = cutsceneId;
    await this.persistCutscenes();
    this.render(false);
  }

  async renameSelectedCutscene(value) {
    const pickedCutscene = this.getSelectedCutscene();
    if (!pickedCutscene) return;

    pickedCutscene.name = normalizeCutsceneName(value);
    await this.persistCutscenes();
    this.render(false);
  }

  async updateSelectedCutsceneScale(value) {
    const pickedCutscene = this.getSelectedCutscene();
    if (!pickedCutscene) return;

    pickedCutscene.scale = normalizeCutsceneScale(value);
    await this.persistCutscenes();
    this.render(false);
  }

  addSlide() {
    const pickedCutscene = this.getSelectedCutscene();
    if (!pickedCutscene) return;

    openCutsceneImagePicker("", async path => {
      if (!path) return;
      pickedCutscene.slides.push({ id: foundry.utils.randomID(), path });
      await this.persistCutscenes();
      this.render(false);
    });
  }

  changeSlideImage(slideId) {
    const pickedCutscene = this.getSelectedCutscene();
    let pickedSlide = null;

    for (const slide of pickedCutscene?.slides ?? []) {
      if (slide.id === slideId) {
        pickedSlide = slide;
        break;
      }
    }
    if (!pickedSlide) return;

    openCutsceneImagePicker(pickedSlide.path, async path => {
      if (!path) return;
      pickedSlide.path = path;
      await this.persistCutscenes();
      this.render(false);
    });
  }

  async moveSlide(slideId, direction) {
    const pickedCutscene = this.getSelectedCutscene();
    if (!pickedCutscene) return;

    let currentIndex = -1;
    for (let i = 0; i < pickedCutscene.slides.length; i++) {
      if (pickedCutscene.slides[i].id === slideId) {
        currentIndex = i;
        break;
      }
    }
    if (currentIndex < 0) return;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= pickedCutscene.slides.length) return;

    const [slide] = pickedCutscene.slides.splice(currentIndex, 1);
    pickedCutscene.slides.splice(targetIndex, 0, slide);
    await this.persistCutscenes();
    this.render(false);
  }

  async removeSlide(slideId) {
    const pickedCutscene = this.getSelectedCutscene();
    if (!pickedCutscene) return;

    pickedCutscene.slides = pickedCutscene.slides.filter(slide => slide.id !== slideId);
    await this.persistCutscenes();
    this.render(false);
  }

  async deleteSelectedCutscene() {
    const pickedCutscene = this.getSelectedCutscene();
    if (!pickedCutscene) return;

    const shouldDelete = await Dialog.confirm({
      title: "Delete Cutscene",
      content: `<p>Delete <strong>${escapeHtml(pickedCutscene.name)}</strong>?</p>`
    });

    if (!shouldDelete) return;

    const deletedId = pickedCutscene.id;
    this.cutscenes = this.cutscenes.filter(cutscene => cutscene.id !== deletedId);
    if (activeCutsceneState?.cutscene?.id === deletedId) {
      requestCutsceneClose();
    }

    this.ensureSelectedCutscene();
    await this.persistCutscenes();
    this.render(false);
  }

  async playSelectedCutscene() {
    const pickedCutscene = this.getSelectedCutscene();
    if (!pickedCutscene) return;

    if (!pickedCutscene.slides.length) {
      ui.notifications?.warn("Add at least one image before playing the cutscene.");
      return;
    }

    await this.persistCutscenes();
    requestCutscenePlayback(pickedCutscene, 0);
  }

  async close(options) {
    this.syncDraftFromDom();

    try {
      await this.persistCutscenes();
    } catch (error) {
      console.error(`[${MODULE_ID}] Failed to save cutscenes.`, error);
      ui.notifications?.error("Cutscenes could not be saved. Check the browser console for details.");
      throw error;
    }

    const result = await super.close(options);
    cutsceneManagerApp = null;
    return result;
  }
}

function openCutsceneManager() {
  if (!game.user?.isGM) {
    ui.notifications?.warn("Only the GM can manage cutscenes.");
    return null;
  }

  if (!cutscenesFeatureEnabled()) {
    ui.notifications?.warn("Cutscenes are currently disabled in the module settings.");
    return null;
  }

  if (cutsceneManagerApp) {
    if (cutsceneManagerApp.rendered) {
      cutsceneManagerApp.bringToTop?.();
    } else {
      cutsceneManagerApp.render(true);
    }

    return cutsceneManagerApp;
  }

  cutsceneManagerApp = new SBSCutsceneManager();
  cutsceneManagerApp.render(true);
  return cutsceneManagerApp;
}

function makeCutsceneControlTool(name, title, icon, handler, order) {
  return {
    name,
    title,
    icon,
    order,
    button: true,
    visible: Boolean(game.user?.isGM),
    onClick: handler
  };
}

function addCutsceneToolsToRecordControl(control) {
  if (!control?.tools) return;

  const toolCount = Object.keys(control.tools).length;
  if (!control.tools.sbsCutsceneManager) {
    control.tools.sbsCutsceneManager = makeCutsceneControlTool(
      "sbsCutsceneManager",
      "Cutscenes",
      "fas fa-clapperboard",
      () => openCutsceneManager(),
      toolCount
    );
  }

  if (control.tools.sbsCutsceneStop) {
    delete control.tools.sbsCutsceneStop;
  }
}

function installCutsceneSceneControls(controls) {
  if (!game.user?.isGM || !cutscenesFeatureEnabled()) return;

  if (Array.isArray(controls)) {
    const existingControl = controls.find(control => control?.name === CUTSCENE_CONTROL_NAME);
    if (existingControl) {
      if (Array.isArray(existingControl.tools)) {
        existingControl.tools = existingControl.tools.filter(tool => tool?.name !== "stop-cutscene");
      }
      return;
    }

    controls.push({
      name: CUTSCENE_CONTROL_NAME,
      title: "Cutscenes",
      icon: "fas fa-clapperboard",
      layer: "tokens",
      visible: true,
      activeTool: "manage-cutscenes",
      tools: [
        makeCutsceneControlTool("manage-cutscenes", "Manage Cutscenes", "fas fa-photo-film", () => openCutsceneManager(), 0)
      ]
    });
    return;
  }

  addCutsceneToolsToRecordControl(controls?.tokens);
}

const textures = {
  empty: PIXI.Texture.from("modules/stars-bonus-stuff/img/LightSlotEmpty.webp"),
  full: PIXI.Texture.from("modules/stars-bonus-stuff/img/LightSlotFull.webp"),
  tokenBarBehind: PIXI.Texture.from(BAR_TEXTURE_PATHS.tokenBarBehind),
  tokenBarBackground: PIXI.Texture.from(BAR_TEXTURE_PATHS.tokenBarBackground),
  tokenBarHealth: PIXI.Texture.from(BAR_TEXTURE_PATHS.tokenBarHealth),
  tokenBarStagger: PIXI.Texture.from(BAR_TEXTURE_PATHS.tokenBarStagger),
  tokenBarRevealHealth: PIXI.Texture.from(BAR_TEXTURE_PATHS.tokenBarRevealHealth),
  tokenBarRevealStagger: PIXI.Texture.from(BAR_TEXTURE_PATHS.tokenBarRevealStagger)
};
let customBarTexturesPromise = null;
const animatedCustomBarFilters = new Set();
let customBarAnimationTicker = null;
const revealMaskTextureCache = new Map();

const TOKEN_BAR_FILL_FILTER_FRAGMENT = `
precision mediump float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform float uTime;
uniform float uStrength;
uniform float uCoarseScaleX;
uniform float uCoarseScaleY;
uniform float uFineScaleX;
uniform float uFineScaleY;
uniform float uPrimarySpeed;
uniform float uSecondarySpeed;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec4 color = texture2D(uSampler, vTextureCoord);
  if (color.a <= 0.0) {
    gl_FragColor = color;
    return;
  }

  vec2 uv = vTextureCoord;
  float coarse = noise(vec2(
    uv.x * uCoarseScaleX + uTime * uPrimarySpeed,
    uv.y * uCoarseScaleY + uTime * 0.18
  ));
  float fine = noise(vec2(
    uv.x * uFineScaleX - uTime * uSecondarySpeed,
    uv.y * uFineScaleY + uTime * 0.35
  ));
  float streak = smoothstep(0.48, 0.92, coarse);
  float brightness = mix(0.84, 1.0 + uStrength, streak) * (0.94 + (fine - 0.5) * 0.18);

  gl_FragColor = vec4(clamp(color.rgb * brightness, 0.0, 1.0), color.a);
}
`;

function createAnimatedFillFilter() {
  return new PIXI.Filter(undefined, TOKEN_BAR_FILL_FILTER_FRAGMENT, {
    uTime: Math.random() * 10,
    uStrength: TOKEN_BAR_FILL_ANIMATION.strength,
    uCoarseScaleX: TOKEN_BAR_FILL_ANIMATION.coarseScaleX,
    uCoarseScaleY: TOKEN_BAR_FILL_ANIMATION.coarseScaleY,
    uFineScaleX: TOKEN_BAR_FILL_ANIMATION.fineScaleX,
    uFineScaleY: TOKEN_BAR_FILL_ANIMATION.fineScaleY,
    uPrimarySpeed: TOKEN_BAR_FILL_ANIMATION.primarySpeed,
    uSecondarySpeed: TOKEN_BAR_FILL_ANIMATION.secondarySpeed
  });
}

function ensureCustomBarAnimationTicker() {
  if (customBarAnimationTicker) return;
  const ticker = canvas?.app?.ticker ?? PIXI.Ticker.shared;
  if (!ticker) return;

  customBarAnimationTicker = tick => {
    const elapsedSeconds = typeof tick === "number"
      ? tick / 60
      : Number(tick?.deltaMS ?? tick?.elapsedMS ?? 16.6667) / 1000;

    for (const filter of animatedCustomBarFilters) {
      filter.uniforms.uTime += elapsedSeconds;
    }
  };

  ticker.add(customBarAnimationTicker);
}

function registerAnimatedCustomBarFilter(filter) {
  if (!filter) return;
  animatedCustomBarFilters.add(filter);
  ensureCustomBarAnimationTicker();
}

function unregisterAnimatedCustomBarFilter(filter) {
  if (!filter) return;
  animatedCustomBarFilters.delete(filter);

  if (animatedCustomBarFilters.size) return;

  const ticker = canvas?.app?.ticker ?? PIXI.Ticker.shared;
  if (ticker && customBarAnimationTicker) {
    ticker.remove(customBarAnimationTicker);
  }
  customBarAnimationTicker = null;
}

function isTextureRenderable(texture) {
  const source = texture?.source ?? texture?.baseTexture;
  return Boolean(texture?.valid || source?.valid || (texture?.width > 1 && texture?.height > 1));
}

async function loadManagedTexture(path) {
  if (typeof globalThis.loadTexture === "function") {
    const loaded = await globalThis.loadTexture(path);
    if (loaded) return loaded;
  }

  if (globalThis.PIXI?.Assets?.load) {
    const loaded = await globalThis.PIXI.Assets.load(path);
    if (loaded instanceof PIXI.Texture) return loaded;
    if (loaded?.texture instanceof PIXI.Texture) return loaded.texture;
  }

  return PIXI.Texture.from(path);
}

function preloadCustomBarTextures() {
  if (customBarTexturesPromise) return customBarTexturesPromise;

  customBarTexturesPromise = Promise.all(Object.entries(BAR_TEXTURE_PATHS).map(async ([key, path]) => {
    const texture = await loadManagedTexture(path);
    if (texture) textures[key] = texture;
  })).then(() => true).catch(error => {
    console.warn(`[${MODULE_ID}] failed to preload custom bar textures`, error);
    customBarTexturesPromise = null;
    return false;
  });

  return customBarTexturesPromise;
}

function getLightData(actor) {
  const light = actor?.system?.light;

  const rawMax = Number(light?.max ?? light?.derived_light ?? 0);
  const max = Number.isFinite(rawMax) ? Math.max(0, Math.floor(rawMax)) : 0;

  const rawCurrent = Number(light?.value ?? 0);
  const current = Number.isFinite(rawCurrent)
    ? Math.max(0, Math.min(Math.floor(rawCurrent), max))
    : 0;

  return { current, max };
}

function getBarRatio(data) {
  const min = Number(data?.min ?? 0);
  const max = Math.max(0, Number(data?.max ?? 0) - min);
  const value = Math.max(0, Math.min(Number(data?.value ?? 0) - min, max));
  return max > 0 ? value / max : 0;
}

function getCustomBarSide(attribute) {
  const normalized = String(attribute ?? "").toLowerCase();
  if (/(^|\.)health(?:\.value)?$/.test(normalized)) return "health";
  if (/(^|\.)stagger(?:\.value)?$/.test(normalized)) return "stagger";
  return null;
}

function getBarResourceSnapshot(tokenDocument, attribute) {
  if (!tokenDocument?.actor || !attribute) return null;

  const normalized = String(attribute);
  const basePaths = [normalized];
  if (!normalized.startsWith("system.")) basePaths.push(`system.${normalized}`);
  if (normalized.startsWith("system.")) basePaths.push(normalized.replace(/^system\./, ""));

  let value;
  let max;

  for (const basePath of basePaths) {
    const valuePath = basePath.endsWith(".value") ? basePath : `${basePath}.value`;
    const maxPath = basePath.endsWith(".value")
      ? basePath.replace(/\.value$/, ".max")
      : `${basePath}.max`;

    value = Number(foundry.utils.getProperty(tokenDocument.actor, valuePath));
    max = Number(foundry.utils.getProperty(tokenDocument.actor, maxPath));
    if (Number.isFinite(value) && Number.isFinite(max)) break;
  }

  if (!Number.isFinite(value) || !Number.isFinite(max)) return null;

  return { value, max };
}

function getCustomBarContext(tokenCanvas, number, data) {
  const tokenDocument = tokenCanvas?.document;
  if (!tokenDocument) return null;

  const slotCandidates = [];
  if (typeof number === "string" && /^bar[12]$/.test(number)) {
    slotCandidates.push(number);
  }
  if (Number.isInteger(number)) {
    if (number >= 0 && number <= 1) slotCandidates.push(`bar${number + 1}`);
    if (number >= 1 && number <= 2) slotCandidates.push(`bar${number}`);
  }
  slotCandidates.push("bar1", "bar2");

  const seen = new Set();
  const candidates = slotCandidates
    .filter(slot => {
      if (seen.has(slot)) return false;
      seen.add(slot);
      return true;
    })
    .map(slot => {
      const attribute = tokenDocument?.[slot]?.attribute;
      return {
        slot,
        attribute,
        side: getCustomBarSide(attribute),
        snapshot: getBarResourceSnapshot(tokenDocument, attribute)
      };
    })
    .filter(candidate => candidate.side);

  if (!candidates.length) return null;

  const dataValue = Number(data?.value);
  const dataMax = Number(data?.max);
  const exactMatch = candidates.find(candidate => {
    if (!candidate.snapshot) return false;
    return candidate.snapshot.value === dataValue && candidate.snapshot.max === dataMax;
  });
  if (exactMatch) return exactMatch;

  if (typeof number === "string") {
    const keyed = candidates.find(candidate => candidate.slot === number);
    if (keyed) return keyed;
  }

  if (Number.isInteger(number)) {
    if (number >= 0 && number <= 1) {
      const zeroBased = candidates.find(candidate => candidate.slot === `bar${number + 1}`);
      if (zeroBased) return zeroBased;
    }
    if (number >= 1 && number <= 2) {
      const oneBased = candidates.find(candidate => candidate.slot === `bar${number}`);
      if (oneBased) return oneBased;
    }
  }

  return candidates[0];
}

function clearBarDisplay(bar) {
  bar.clear();
  for (const child of bar.removeChildren()) {
    child.destroy({ children: true });
  }
}

function cleanBarSprites(tokenCanvas) {
  if (tokenCanvas?._sbsCustomBarFrame) {
    cancelAnimationFrame(tokenCanvas._sbsCustomBarFrame);
    tokenCanvas._sbsCustomBarFrame = null;
  }
  if (tokenCanvas?._sbsAnimatedFilters) {
    for (const filter of tokenCanvas._sbsAnimatedFilters) {
      unregisterAnimatedCustomBarFilter(filter);
    }
    tokenCanvas._sbsAnimatedFilters = null;
  }
  if (!tokenCanvas?._sbsBarSprites) return;
  for (const sprite of tokenCanvas._sbsBarSprites) {
    sprite.removeFromParent?.();
    sprite.destroy({ children: true });
  }
  tokenCanvas._sbsBarSprites = null;
}

function getCustomBarAssignments(tokenCanvas) {
  if (!customTokenBarsEnabled()) return [];

  const tokenDocument = tokenCanvas?.document;
  if (!tokenDocument) return [];

  return ["bar1", "bar2"].map(slot => {
    const attribute = tokenDocument?.[slot]?.attribute;
    return {
      slot,
      attribute,
      side: getCustomBarSide(attribute),
      snapshot: getBarResourceSnapshot(tokenDocument, attribute)
    };
  }).filter(assignment => assignment.side);
}

function shouldShowCustomBars(tokenCanvas) {
  if (!tokenCanvas) return false;

  if (tokenCanvas.hover || tokenCanvas.controlled) return true;

  const displayBars = tokenCanvas?.document?.displayBars ?? tokenCanvas?.data?.displayBars;
  if (displayBars === undefined || displayBars === null) return false;

  const alwaysVisible = displayBars === CONST?.TOKEN_DISPLAY_MODES?.ALWAYS || displayBars === 0 || displayBars === "always";
  if (alwaysVisible) return true;

  const ownerVisible = displayBars === CONST?.TOKEN_DISPLAY_MODES?.OWNER || displayBars === 1 || displayBars === "owner";
  if (ownerVisible) {
    if (game.user?.isGM) return true;
    return Boolean(tokenCanvas?.document?.actor?.permission?.get(game.user.id) >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
  }

  return false;
}

function syncCustomBarVisibility(tokenCanvas) {
  if (!tokenCanvas?._sbsBarSprites) return;
  const visible = shouldShowCustomBars(tokenCanvas);
  for (const sprite of tokenCanvas._sbsBarSprites) {
    sprite.visible = visible;
  }
}

function createCustomBarLabel(value, side, centerX, tokenSize) {
  const TextThing = globalThis.PreciseText ?? PIXI.Text;
  const style = new PIXI.TextStyle({
    fill: side === "health" ? 0xeb6a3b : 0xf0e05c,
    fontFamily: [TOKEN_BAR_LABEL_FONT, "Arial Black", "sans-serif"],
    fontSize: Math.max(17, tokenSize * 0.29),
    fontWeight: "700",
    stroke: 0x220000,
    strokeThickness: Math.max(3, tokenSize * 0.03),
    dropShadow: true,
    dropShadowAlpha: 0.9,
    dropShadowBlur: 2,
    dropShadowColor: 0x000000,
    dropShadowDistance: 2
  });
  const lbl = new TextThing(String(Math.max(0, Math.floor(Number(value ?? 0)))), style);

  lbl.anchor?.set?.(side === "health" ? 1 : 0, 0.5);
  lbl.x = centerX + ((side === "health" ? -1 : 1) * tokenSize * TOKEN_BAR_GEOMETRY.labelOffsetX);
  return lbl;
}

function createRectMask(x, y, width, height) {
  const mask = new PIXI.Graphics();
  mask.beginFill(0xffffff);
  mask.drawRect(x, y, width, height);
  mask.endFill();
  return mask;
}

function getTextureSource(texture) {
  return texture?.source?.resource?.source
    ?? texture?.source?.source
    ?? texture?.baseTexture?.resource?.source
    ?? texture?.baseTexture?.resource
    ?? null;
}

function getTexSize(texture, fallbackWidth, fallbackHeight) {
  const imgSource = getTextureSource(texture);
  const width = Math.max(1, Math.round(
    texture?.orig?.width
    || texture?.frame?.width
    || texture?.width
    || imgSource?.naturalWidth
    || imgSource?.videoWidth
    || imgSource?.displayWidth
    || imgSource?.width
    || fallbackWidth
  ));
  const height = Math.max(1, Math.round(
    texture?.orig?.height
    || texture?.frame?.height
    || texture?.height
    || imgSource?.naturalHeight
    || imgSource?.videoHeight
    || imgSource?.displayHeight
    || imgSource?.height
    || fallbackHeight
  ));

  return { width, height };
}

function smooth01(value) {
  const value01 = Math.max(0, Math.min(1, value));
  return value01 * value01 * (3 - (2 * value01));
}

function getMidLum(luminances, opaqueMask, x, y, width, height) {
  const samples = [];

  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      const sampleX = x + offsetX;
      const sampleY = y + offsetY;
      if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) continue;

      const sampleIndex = (sampleY * width) + sampleX;
      if (!opaqueMask[sampleIndex]) continue;
      samples.push(luminances[sampleIndex]);
    }
  }

  if (!samples.length) return 0;
  samples.sort((left, right) => left - right);
  return samples[Math.floor(samples.length / 2)];
}

function makeBlurredLumMap(luminances, opaqueMask, width, height) {
  const blurred = luminances.slice();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width) + x;
      if (!opaqueMask[pixelIndex]) continue;
      blurred[pixelIndex] = getMidLum(luminances, opaqueMask, x, y, width, height);
    }
  }

  return blurred;
}

function grabMaskChunk(mask, opaqueMask, width, height, startIndex, targetValue, visited) {
  const component = [];
  const stack = [startIndex];
  visited[startIndex] = 1;

  while (stack.length) {
    const pixelIndex = stack.pop();
    component.push(pixelIndex);

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        if (offsetX === 0 && offsetY === 0) continue;

        const sampleX = x + offsetX;
        const sampleY = y + offsetY;
        if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) continue;

        const sampleIndex = (sampleY * width) + sampleX;
        if (visited[sampleIndex] || !opaqueMask[sampleIndex] || mask[sampleIndex] !== targetValue) continue;

        visited[sampleIndex] = 1;
        stack.push(sampleIndex);
      }
    }
  }

  return component;
}

function fillTinyMaskBits(mask, opaqueMask, width, height, targetValue, replacementValue, maxComponentSize) {
  const nextMask = mask.slice();
  const visited = new Uint8Array(mask.length);

  for (let pixelIndex = 0; pixelIndex < mask.length; pixelIndex++) {
    if (visited[pixelIndex] || !opaqueMask[pixelIndex] || mask[pixelIndex] !== targetValue) continue;

    const component = grabMaskChunk(mask, opaqueMask, width, height, pixelIndex, targetValue, visited);
    if (component.length > maxComponentSize) continue;

    for (const index of component) {
      nextMask[index] = replacementValue;
    }
  }

  return nextMask;
}

function countMaskNeighbors(mask, opaqueMask, x, y, width, height, targetValue) {
  let hits = 0;

  for (let offsetY = -1; offsetY <= 1; offsetY++) {
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      if (offsetX === 0 && offsetY === 0) continue;

      const sampleX = x + offsetX;
      const sampleY = y + offsetY;
      if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) continue;

      const sampleIndex = (sampleY * width) + sampleX;
      if (!opaqueMask[sampleIndex] || mask[sampleIndex] !== targetValue) continue;
      hits += 1;
    }
  }

  return hits;
}

function patchThinHoles(mask, opaqueMask, width, height, minimumVisibleNeighbors, passes) {
  let fixedMask = mask.slice();

  for (let pass = 0; pass < passes; pass++) {
    const nextMask = fixedMask.slice();
    let changed = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width) + x;
        if (!opaqueMask[pixelIndex] || fixedMask[pixelIndex]) continue;

        const neighborHits = countMaskNeighbors(fixedMask, opaqueMask, x, y, width, height, 1);
        if (neighborHits < minimumVisibleNeighbors) continue;

        nextMask[pixelIndex] = 1;
        changed = true;
      }
    }

    fixedMask = nextMask;
    if (!changed) break;
  }

  return fixedMask;
}

function cleanMaskBits(mask, opaqueMask, width, height) {
  const withoutTinySpecks = fillTinyMaskBits(mask, opaqueMask, width, height, 1, 0, 3);
  const withoutTinyHoles = fillTinyMaskBits(withoutTinySpecks, opaqueMask, width, height, 0, 1, 6);
  return patchThinHoles(withoutTinyHoles, opaqueMask, width, height, 7, 3);
}

function getFeatherAlpha(visibleMask, x, y, width, height, alpha, featherWidth) {
  if (featherWidth <= 0) return alpha;

  const scan = Math.max(1, Math.ceil(featherWidth));
  let edgeDist = Infinity;

  for (let offsetY = -scan; offsetY <= scan; offsetY++) {
    for (let offsetX = -scan; offsetX <= scan; offsetX++) {
      if (offsetX === 0 && offsetY === 0) continue;

      const sampleX = x + offsetX;
      const sampleY = y + offsetY;
      const sampleVisible = sampleX >= 0 && sampleX < width && sampleY >= 0 && sampleY < height
        ? visibleMask[(sampleY * width) + sampleX]
        : 0;

      if (sampleVisible) continue;

      const distance = Math.hypot(offsetX, offsetY);
      if (distance < edgeDist) {
        edgeDist = distance;
      }
    }
  }

  if (!Number.isFinite(edgeDist) || edgeDist > featherWidth) {
    return alpha;
  }

  const edgeRatio = smooth01(edgeDist / Math.max(featherWidth, 0.0001));
  const alphaRatio = 0.55 + (edgeRatio * 0.45);
  return Math.round(alpha * alphaRatio);
}

function getRevealThresholdByte(ratio) {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  if (clampedRatio <= 0) return 256;
  if (clampedRatio >= 1) return 0;

  const centeredThreshold = ((1 - clampedRatio) * 255) + (TOKEN_BAR_REVEAL.valueStep / 2);
  return Math.min(255, Math.max(1, Math.round(centeredThreshold)));
}

function makeRevealMaskTexture(side, ratio, targetWidth, targetHeight) {
  const cutoff = getRevealThresholdByte(ratio);
  if (cutoff <= 0) return null;

  const featherWidth = Math.max(0, Number(TOKEN_BAR_REVEAL.featherWidth) || 0);
  const maskTexSrc = side === "health" ? textures.tokenBarRevealHealth : textures.tokenBarRevealStagger;
  const srcEl = getTextureSource(maskTexSrc);
  if (!srcEl) return null;

  const w = Math.max(1, Math.round(targetWidth || TOKEN_BAR_ASSET_W.fill));
  const h = Math.max(1, Math.round(targetHeight || TOKEN_BAR_ASSET_H.fill));
  const cacheKey = `${side}:${cutoff}:${featherWidth}:${w}x${h}`;
  const cached = revealMaskTextureCache.get(cacheKey);
  if (cached) return cached;

  const canvasThing = document.createElement("canvas");
  canvasThing.width = w;
  canvasThing.height = h;

  const ctx = canvasThing.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(srcEl, 0, 0, w, h);

  const imgDat = ctx.getImageData(0, 0, w, h);
  const px = imgDat.data;
  const opaque = new Uint8Array(w * h);
  const luma = new Uint8Array(w * h);
  const vis = new Uint8Array(w * h);

  for (let i = 0; i < vis.length; i++) {
    const di = i * 4;
    const alpha = px[di + 3];
    if (alpha <= 0) continue;
    opaque[i] = 1;

    luma[i] = Math.round((px[di] * 299 + px[di + 1] * 587 + px[di + 2] * 114) / 1000);
  }

  const blurred = makeBlurredLumMap(luma, opaque, w, h);

  for (let i = 0; i < vis.length; i++) {
    if (!opaque[i]) continue;
    vis[i] = blurred[i] >= cutoff ? 1 : 0;
  }

  const cleaned = cleanMaskBits(vis, opaque, w, h);

  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const idx = (yy * w) + xx;
      const di = idx * 4;
      const alpha = px[di + 3];
      let revealAlpha = 0;

      if (alpha > 0 && cleaned[idx]) {
        revealAlpha = getFeatherAlpha(cleaned, xx, yy, w, h, alpha, featherWidth);
      }

      px[di] = 255;
      px[di + 1] = 255;
      px[di + 2] = 255;
      px[di + 3] = revealAlpha;
    }
  }

  ctx.putImageData(imgDat, 0, 0);

  const maskTex = PIXI.Texture.from(canvasThing);
  revealMaskTextureCache.set(cacheKey, maskTex);
  return maskTex;
}

function makeRevealMaskSprite(side, ratio, fill, fillTexture) {
  const size = getTexSize(fillTexture, TOKEN_BAR_ASSET_W.fill, TOKEN_BAR_ASSET_H.fill);
  const maskTexture = makeRevealMaskTexture(side, ratio, size.width, size.height);
  if (!maskTexture) return null;

  const maskSprite = new PIXI.Sprite(maskTexture);
  maskSprite.anchor.set(fill.anchor.x, fill.anchor.y);
  maskSprite.position.set(fill.x, fill.y);
  maskSprite.scale.set(fill.scale.x, fill.scale.y);
  maskSprite.angle = fill.angle;
  return maskSprite;
}

function drawBarsOverToken(tokenCanvas) {
  cleanBarSprites(tokenCanvas);

  const barList = getCustomBarAssignments(tokenCanvas);
  if (!barList.length) return;

  if (!isTextureRenderable(textures.tokenBarBackground)
    || !isTextureRenderable(textures.tokenBarBehind)
    || !isTextureRenderable(textures.tokenBarHealth)
    || !isTextureRenderable(textures.tokenBarStagger)
    || !isTextureRenderable(textures.tokenBarRevealHealth)
    || !isTextureRenderable(textures.tokenBarRevealStagger)) {
    preloadCustomBarTextures().then(loaded => {
      if (loaded) queueBarRedraw(tokenCanvas);
    });
  }

  const tokenSize = Math.max(tokenCanvas.w, tokenCanvas.h);
  const centerX = tokenCanvas.w / 2;
  const bgScale = (tokenSize * TOKEN_BAR_GEOMETRY.backgroundScale) / TOKEN_BAR_ASSET_W.background;
  const bgScaleX = bgScale * (TOKEN_BAR_GEOMETRY.backgroundHorizontalStretch ?? 1);
  const bgScaleY = bgScale;
  const bgWidth = TOKEN_BAR_ASSET_W.background * bgScaleX;
  const bgHeight = TOKEN_BAR_ASSET_H.background * bgScaleY;
  const overlayLift = bgHeight * TOKEN_BAR_GEOMETRY.overlayLiftY;
  const ringCenterY = tokenCanvas.h + (bgHeight * TOKEN_BAR_GEOMETRY.backgroundOffsetY) - overlayLift;
  const isVisible = shouldShowCustomBars(tokenCanvas);
  const pieces = [];
  const movingFilters = [];

  tokenCanvas.sortableChildren = true;

  const behind = new PIXI.Sprite(textures.tokenBarBehind);
  behind.anchor.set(0.5, 0.5);
  behind.scale.set(bgScaleX, bgScaleY);
  behind.x = centerX;
  behind.y = ringCenterY;
  behind.zIndex = TOKEN_BAR_LAYER.behind;
  behind.visible = isVisible;
  tokenCanvas.addChild(behind);
  pieces.push(behind);

  // only show the lower half
  const bg = new PIXI.Sprite(textures.tokenBarBackground);
  bg.anchor.set(0.5, 0.5);
  bg.scale.set(bgScaleX, bgScaleY);
  bg.x = centerX;
  bg.y = ringCenterY;
  bg.zIndex = TOKEN_BAR_LAYER.background;
  bg.visible = isVisible;
  const bgMaskLift = bgHeight * TOKEN_BAR_GEOMETRY.backgroundMaskLift;
  const bgMaskTop = tokenCanvas.h - bgMaskLift - overlayLift;
  const BG_MASK_LOWER_EXTEND_RATIO = 0.18; 
  const extraLower = Math.round(bgHeight * BG_MASK_LOWER_EXTEND_RATIO);
  const bgMask = createRectMask(
    centerX - bgWidth / 2,
    bgMaskTop,
    bgWidth,
    bgHeight / 2 + 2 + bgMaskLift + extraLower
  );
  bg.mask = bgMask;
  bgMask.zIndex = TOKEN_BAR_LAYER.backgroundMask;
  bgMask.visible = isVisible;
  tokenCanvas.addChild(bgMask);
  tokenCanvas.addChild(bg);
  pieces.push(bgMask);
  pieces.push(bg);

  for (const assignment of barList) {
    const side = assignment.side;
    const barData = assignment.snapshot ?? { value: 0, max: 1 };
    const ratio = getBarRatio(barData);
    const fillTexture = side === "health" ? textures.tokenBarHealth : textures.tokenBarStagger;
    const fillScaleX = bgScaleX * TOKEN_BAR_GEOMETRY.fillScaleX;
    const fillScaleY = bgScaleY * TOKEN_BAR_GEOMETRY.fillScaleY;

    if (ratio > 0) {
      const fill = new PIXI.Sprite(fillTexture);
      fill.anchor.set(0.5, 0.5);
      fill.scale.set(fillScaleX, fillScaleY);
      fill.x = centerX + ((side === "health" ? -1 : 1) * bgWidth * TOKEN_BAR_GEOMETRY.fillOffsetX);
      fill.y = tokenCanvas.h + (bgHeight * TOKEN_BAR_GEOMETRY.fillY) - overlayLift;
      fill.zIndex = TOKEN_BAR_LAYER.fill;
      const animatedFilter = createAnimatedFillFilter();
      fill.filters = [animatedFilter];
      fill.visible = isVisible;

      const fillMask = makeRevealMaskSprite(side, ratio, fill, fillTexture);

      if (fillMask) {
        fill.mask = fillMask;
        fillMask.zIndex = TOKEN_BAR_LAYER.fillMask;
        fillMask.visible = isVisible;
      }
      registerAnimatedCustomBarFilter(animatedFilter);
      movingFilters.push(animatedFilter);
      if (fillMask) {
        tokenCanvas.addChild(fillMask);
        pieces.push(fillMask);
      }
      tokenCanvas.addChild(fill);
      pieces.push(fill);
    }

    const label = createCustomBarLabel(barData.value ?? 0, side, centerX, tokenSize);
    label.y = tokenCanvas.h + (bgHeight * TOKEN_BAR_GEOMETRY.labelY) - overlayLift;
    label.zIndex = TOKEN_BAR_LAYER.label;
    label.visible = isVisible;
    tokenCanvas.addChild(label);
    pieces.push(label);
  }

  tokenCanvas._sbsBarSprites = pieces;
  tokenCanvas._sbsAnimatedFilters = movingFilters;
}

function queueBarRedraw(tokenCanvas) {
  if (!tokenCanvas) return;
  if (tokenCanvas._sbsCustomBarFrame) {
    cancelAnimationFrame(tokenCanvas._sbsCustomBarFrame);
  }

  tokenCanvas._sbsCustomBarFrame = requestAnimationFrame(() => {
    tokenCanvas._sbsCustomBarFrame = null;
    drawBarsOverToken(tokenCanvas);
  });
}

function installCustomTokenBars() {
  const tokenClass = CONFIG.Token?.objectClass;
  if (!tokenClass?.prototype) return;
  if (tokenClass.prototype._sbsOriginalDrawBar) return;

  tokenClass.prototype._sbsOriginalDrawBar = tokenClass.prototype._drawBar;
  tokenClass.prototype._drawBar = function(number, bar, data) {
    const assignments = getCustomBarAssignments(this);
    const context = getCustomBarContext(this, number, data);
    const side = context?.side;

    if (!side) {
      if (!assignments.length) {
        cleanBarSprites(this);
      }
      bar.visible = true;
      return this._sbsOriginalDrawBar(number, bar, data);
    }

    bar.visible = false;
    clearBarDisplay(bar);
    queueBarRedraw(this);
    return bar;
  };
}

function refreshVisibleTokenBars() {
  if (!canvas?.tokens) return;
  for (const token of canvas.tokens.placeables) {
    token.drawBars?.();
  }
}


//==================================================================
// light display
//==================================================================

function cleanTokenMarkers(tokenCanvas) {
  if (!tokenCanvas?._lightMarkers) return;
  tokenCanvas._lightMarkers.forEach(marker => marker.destroy({ children: true }));
  tokenCanvas._lightMarkers = [];
}

function cleanAllMarkers() {
  if (!canvas?.tokens) return;
  canvas.tokens.placeables.forEach(token => cleanTokenMarkers(token));
}

function createMarker(tokenCanvas, isFull) {
  const holder = new PIXI.Container();

  const icon = new PIXI.Sprite(isFull ? textures.full : textures.empty);
  icon.anchor.set(0.5);
  icon.scale.set(0.26);

  holder.addChild(icon);
  tokenCanvas.addChild(holder);

  return holder;
}

function renderTokenLights(tokenDoc, combat) {
  if (!lightOverlayEnabled()) return;
  if (!tokenDoc?.object || !combat?.active) return;
  const tokenCanvas = tokenDoc.object;
  const actor = tokenDoc.actor;
  if (!actor) return;

  const inFight = combat.combatants.some(combatant => combatant.tokenId === tokenDoc.id);
  if (!inFight) {
    cleanTokenMarkers(tokenCanvas);
    return;
  }

  const { current: cur, max: maxLights } = getLightData(actor);

  cleanTokenMarkers(tokenCanvas);
  tokenCanvas._lightMarkers = [];

  if (maxLights <= 0) return;

  for (let i = 0; i < maxLights; i++) {
    const isFull = i < cur;
    const marker = createMarker(tokenCanvas, isFull);

    marker.x = tokenCanvas.w / 2 + (i - (maxLights - 1) / 2) * 20;
    marker.y = -95;

    tokenCanvas._lightMarkers.push(marker);
  }
}

function rerenderActiveCombatLights() {
  if (!canvas?.tokens) return;

  const battle = game.combat;
  if (!battle?.active) {
    cleanAllMarkers();
    return;
  }

  const combatantTokenIds = new Set(battle.combatants.map(combatant => combatant.tokenId));

  canvas.tokens.placeables.forEach(token => {
    if (combatantTokenIds.has(token.id)) {
      renderTokenLights(token.document, battle);
    } else {
      cleanTokenMarkers(token);
    }
  });
}

Hooks.on("canvasReady", rerenderActiveCombatLights);
Hooks.on("canvasReady", refreshVisibleTokenBars);
Hooks.on("hoverToken", token => syncCustomBarVisibility(token));
Hooks.on("controlToken", token => syncCustomBarVisibility(token));
Hooks.on("createCombatant", rerenderActiveCombatLights);
Hooks.on("updateCombatant", rerenderActiveCombatLights);
Hooks.on("deleteCombatant", rerenderActiveCombatLights);
Hooks.on("deleteCombat", cleanAllMarkers);

Hooks.on("updateCombat", (combat, updates) => {
  if (updates.active === false) {
    cleanAllMarkers();
    return;
  }

  if ("active" in updates || "round" in updates || "turn" in updates) {
    rerenderActiveCombatLights();
  }
});

Hooks.on("updateActor", (actor, changes) => {
  if (!game.combat?.active) return;
  if (!changes.system?.light) return;
  rerenderActiveCombatLights();
});

Hooks.on("updateActor", (actor, changes) => {
  if (!changes.system?.health && !changes.system?.stagger) return;
  if (!canvas?.tokens) return;

  for (const token of canvas.tokens.placeables) {
    if (token.actor?.id === actor.id) {
      token.drawBars?.();
    }
  }
});

// token updates
Hooks.on("updateToken", (tokenDoc, changes) => {
  if (changes.bar1 || changes.bar2 || changes.displayBars !== undefined) {
    tokenDoc.object?.drawBars?.();
  }

  if (!game.combat?.active) return;

  const lightChanged =
    changes.delta?.system?.light !== undefined ||
    changes.actorData?.system?.light !== undefined;

  if (!lightChanged) return;

  renderTokenLights(tokenDoc, game.combat);
});

//==================================================================
// skill image chat
//==================================================================

function injectShowcaseStyles() {
  if (document.getElementById(SHOWCASE_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = SHOWCASE_STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: '${TOKEN_BAR_LABEL_FONT}';
      src: url('modules/stars-bonus-stuff/fonts/ExcelsiorSans.ttf') format('truetype');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }

    .sbs-reveal-sheet-app .window-content {
      padding: 0;
      overflow: hidden;
      background: #14100e;
    }

    .sbs-reveal-sheet {
      height: 100%;
      background-position: center;
      background-size: cover;
      color: #efc281;
    }

    .sbs-reveal-sheet .char_name,
    .sbs-reveal-sheet .char_role {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sbs-reveal-static-field {
      width: 100%;
      padding: 0 6px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: inherit;
      text-align: center;
    }

    .sbs-reveal-static-field--name {
      font-family: "skill_font", sans-serif;
      font-size: clamp(24px, 1.9vw, 34px);
      line-height: 1.1;
      text-shadow: black 1px 0 10px, black 1px 0 10px, black 1px 0 10px;
    }

    .sbs-reveal-body {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .sbs-reveal-sheet [data-reveal-panel] {
      display: none;
      height: 100%;
    }

    .sbs-reveal-sheet [data-reveal-panel].is-active,
    .sbs-reveal-sheet [data-reveal-panel].active {
      display: block;
    }

    .sbs-reveal-sheet .sheet-tabs.tabs {
      color: #efc281;
    }

    .sbs-reveal-sheet .sheet-tabs.tabs .item {
      color: inherit;
      cursor: pointer;
    }

    .sbs-reveal-sheet .sheet-tabs.tabs .item:hover {
      text-shadow: #fc0 1px 0 10px;
    }

    .sbs-reveal-sheet .sheet-tabs.tabs .item.is-active,
    .sbs-reveal-sheet .sheet-tabs.tabs .item.active {
      text-decoration: underline;
      text-shadow: none;
    }

    .sbs-reveal-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      color: rgba(239, 194, 129, 0.75);
      cursor: pointer;
      transition: color 120ms ease, transform 120ms ease, filter 120ms ease, opacity 120ms ease;
    }

    .sbs-reveal-toggle[data-revealed="true"] {
      color: #9ee06f;
      opacity: 1;
    }

    .sbs-reveal-toggle[data-revealed="false"] {
      opacity: 0.8;
    }

    .sbs-reveal-toggle:hover {
      transform: translateY(-1px);
      filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.55));
    }

    .sbs-status-inline-token {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: -0.12em;
      margin: 0 0.14em;
      line-height: 1;
      width: 1em;
      height: 1em;
      min-width: 1em;
      min-height: 1em;
      padding: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      overflow: visible;
      flex-shrink: 0;
    }

    .sbs-status-inline-icon {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      border: none;
      filter: brightness(1.18) saturate(1.18) drop-shadow(0 0 2px rgba(255, 255, 255, 0.35));
    }

    .sbs-status-inline-icon[src] {
      background: transparent;
    }

    .sbs-status-inline-token img {
      border: none;
    }

    .sbs-status-inline-token img[title] {
      color: inherit;
    }

    .sbs-inline-color-text {
      color: var(--sbs-inline-color, inherit);
      text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.9);
    }

    .sbs-inline-color-marker {
      display: none;
    }

    .sbs-skill-description-host {
      position: relative;
    }

    .sbs-skill-description-preview {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
      width: 90%;
      height: 75px;
      max-height: 75px;
      margin-top: 0;
      color: #efc281;
      font-family: "alt_skill_font", sans-serif;
      font-size: 13px;
      line-height: 1.15;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      overflow: hidden;
      display: block;
      padding: 2px 0;
      pointer-events: none;
    }

    .sbs-skill-description-preview.is-editing {
      display: none;
    }

    .sbs-skill-description-preview.is-empty {
      display: none;
    }

    .sbs-status-textarea-hidden {
      visibility: hidden;
      pointer-events: none;
    }

    .sbs-skill-description-preview .sbs-status-inline-token,
    .sbs-skill-description-preview .sbs-status-inline-icon,
    .sotc .skill .displayed_dice_mods .sbs-status-inline-token,
    .sotc .skill .displayed_dice_mods .sbs-status-inline-icon,
    .sotc .skill .skill_mods .sbs-status-inline-token,
    .sotc .skill .skill_mods .sbs-status-inline-icon {
      width: 1em;
      height: 1em;
      min-width: 1em;
      min-height: 1em;
    }

    .sbs-status-inline-icon[onerror] {
      border: none;
    }

    .sbs-skill-showcase-art-frame[data-sbs-chat-preview-trigger="true"] {
      cursor: zoom-in;
    }

    .sbs-skill-showcase-art-frame[data-sbs-chat-preview-trigger="true"]:focus-visible {
      outline: 2px solid rgba(239, 194, 129, 0.9);
      outline-offset: 2px;
    }

    .sbs-chat-showcase-preview {
      position: fixed;
      inset: 0;
      z-index: 100001;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: rgba(0, 0, 0, 0.86);
      backdrop-filter: blur(6px);
    }

    .sbs-chat-showcase-preview.is-active {
      display: flex;
    }

    .sbs-chat-showcase-preview__panel {
      width: min(96vw, 1180px);
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
      border: 1px solid rgba(239, 194, 129, 0.18);
      background: linear-gradient(180deg, rgba(18, 13, 11, 0.98), rgba(7, 5, 5, 0.98));
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
      overflow: auto;
    }

    .sbs-chat-showcase-preview__panel:focus {
      outline: none;
    }

    .sbs-chat-showcase-preview__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .sbs-chat-showcase-preview__title {
      color: #efc281;
      font-family: "skill_font", sans-serif;
      font-size: 18px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .sbs-chat-showcase-preview__close {
      min-height: 34px;
      padding: 6px 14px;
      border: 1px solid rgba(239, 194, 129, 0.24);
      background: rgba(16, 11, 9, 0.92);
      color: #efc281;
      font-family: "alt_skill_font", sans-serif;
      cursor: pointer;
    }

    .sbs-chat-showcase-preview__body {
      display: flex;
      align-items: flex-start;
      justify-content: center;
      min-height: 0;
    }

    .sbs-chat-showcase-preview__body .sbs-skill-showcase {
      width: 100%;
      max-width: 1080px;
      margin: 0 auto;
    }

    .sbs-chat-showcase-preview__body .sbs-skill-showcase .sbs-skill-showcase-right {
      top: 16%;
      bottom: 4%;
    }
    .sbs-chat-showcase-preview__body .sbs-skill-showcase .sbs-skill-showcase-description {
      bottom: 4%;
      height: 18%;
    }
    .sbs-chat-showcase-preview__body .sbs-skill-showcase .sbs-skill-showcase-mods {
      font-size: 2.3cqw;
    }
    .sbs-chat-showcase-preview__body .sbs-skill-showcase .sbs-skill-showcase-die-formula {
      font-size: 3.6cqw;
    }
    .sbs-chat-showcase-preview__body .sbs-skill-showcase .sbs-skill-showcase-die-mods {
      font-size: 2.1cqw;
    }
    .sbs-chat-showcase-preview__body .sbs-skill-showcase .sbs-skill-showcase-dice {
      padding: 6% 6% 4% 4%;
      gap: 6px;
      flex: 1 1 auto;
      overflow: auto;
    }
    .sbs-chat-showcase-preview__body .sbs-skill-showcase .sbs-skill-showcase-die-icon {
      width: 6.2cqw;
      height: 6.2cqw;
      margin-top: 0.5px;
    }
    .sbs-chat-showcase-preview__body .sbs-skill-showcase .sbs-skill-showcase-die {
      gap: 6px;
    }

    /* Reveal-sheet specific: lower the description so revealed cards sit visually lower */
    .sbs-reveal-showcase-entry .sbs-skill-showcase .sbs-skill-showcase-description {
      bottom: 4%;
      height: 18%;
    }

    .sbs-reveal-showcase-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      padding: 12px;
      align-items: start;
    }

    .sbs-reveal-showcase-entry {
      width: 100%;
      max-width: none;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .sbs-reveal-showcase-entry .sbs-skill-showcase {
      margin-bottom: 0;
    }

    .sbs-reveal-showcase-entry .sbs-skill-showcase-card {
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.42);
    }

    .sbs-reveal-showcase-entry--ego .sbs-skill-showcase {
      border-color: rgba(122, 81, 158, 0.6);
    }

    .sbs-reveal-risk-line {
      align-self: flex-start;
      padding: 2px 10px;
      border: 1px solid rgba(239, 194, 129, 0.3);
      background: rgba(0, 0, 0, 0.68);
      color: #efc281;
      font-family: "skill_font", sans-serif;
      font-size: 16px;
      text-transform: uppercase;
      text-shadow: rgba(0, 0, 0, 0.9) 0 0 6px;
    }

    .sbs-reveal-ego-extra {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .sbs-reveal-block {
      padding: 8px 10px;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(239, 194, 129, 0.16);
    }

    .sbs-reveal-copy-label {
      margin-bottom: 4px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #efc281;
    }

    .sbs-reveal-pre,
    .sbs-reveal-passive-name {
      white-space: pre-wrap;
      color: #efc281;
      font-family: "alt_skill_font", sans-serif;
    }

    .sbs-reveal-richtext {
      color: #efc281;
    }

    .sbs-reveal-richtext > :first-child {
      margin-top: 0;
    }

    .sbs-reveal-richtext > :last-child {
      margin-bottom: 0;
    }

    .sbs-reveal-passive-list {
      flex-direction: column;
      flex-wrap: nowrap;
      gap: 10px;
      padding: 10px 12px;
    }

    .sbs-reveal-biography-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
      min-height: 0;
      overflow: auto;
      padding: 12px;
    }

    .sbs-reveal-biography-copy {
      margin: 0;
    }

    .sbs-reveal-biography-entries {
      padding: 0;
    }

    .sbs-reveal-passive-card {
      margin: 0;
      padding: 12px 14px;
      background: rgba(0, 0, 0, 0.28);
      border: 1px solid rgba(239, 194, 129, 0.16);
      gap: 14px;
    }

    .sbs-reveal-passive-card .passive_left {
      width: 34%;
      gap: 8px;
    }

    .sbs-reveal-passive-card .passive_right {
      width: 66%;
      color: #efc281;
    }

    .sbs-reveal-passive-tag {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(239, 194, 129, 0.8);
    }

    .sbs-reveal-divider {
      width: calc(100% - 24px);
      margin: 0 auto;
      border: 1px solid white;
      opacity: 0.5;
    }

    .sbs-reveal-empty {
      width: calc(100% - 16px);
      margin: 10px auto 0;
      padding: 18px;
      border: 1px dashed rgba(239, 194, 129, 0.35);
      background: rgba(0, 0, 0, 0.28);
      color: rgba(239, 194, 129, 0.9);
      text-align: center;
    }

    .sbs-cutscene-manager-app .window-content {
      padding: 0;
      overflow: hidden;
      background:
        radial-gradient(circle at top left, rgba(114, 37, 22, 0.28), transparent 42%),
        linear-gradient(180deg, rgba(19, 14, 12, 0.98), rgba(7, 5, 5, 0.98));
      color: #efc281;
    }

    .sbs-cutscene-manager {
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr);
      gap: 18px;
      height: 100%;
      min-height: 0;
      padding: 14px;
    }

    .sbs-cutscene-sidebar,
    .sbs-cutscene-editor {
      min-height: 0;
      border: 1px solid rgba(239, 194, 129, 0.16);
      background: rgba(0, 0, 0, 0.42);
      box-shadow: 0 16px 30px rgba(0, 0, 0, 0.22);
    }

    .sbs-cutscene-sidebar {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 14px;
    }

    .sbs-cutscene-sidebar-header,
    .sbs-cutscene-editor-header,
    .sbs-cutscene-slide-toolbar,
    .sbs-cutscene-editor-actions,
    .sbs-cutscene-slide-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .sbs-cutscene-sidebar-header {
      justify-content: space-between;
    }

    .sbs-cutscene-heading,
    .sbs-cutscene-editor-heading {
      margin: 0;
      color: #efc281;
      font-family: "skill_font", sans-serif;
      font-size: 24px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .sbs-cutscene-editor-heading {
      font-size: 16px;
      font-family: "alt_skill_font", sans-serif;
      color: rgba(239, 194, 129, 0.82);
    }

    .sbs-cutscene-library,
    .sbs-cutscene-slide-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 0;
      overflow: auto;
      overflow-x: hidden;
    }

    .sbs-cutscene-library {
      padding-right: 4px;
    }

    .sbs-cutscene-button,
    .sbs-cutscene-list-item {
      box-sizing: border-box;
      border: 1px solid rgba(239, 194, 129, 0.2);
      background: rgba(16, 11, 9, 0.9);
      color: #efc281;
      cursor: pointer;
      transition: border-color 120ms ease, transform 120ms ease, background 120ms ease;
    }

    .sbs-cutscene-button {
      min-height: 32px;
      padding: 6px 12px;
      font-family: "alt_skill_font", sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .sbs-cutscene-button:hover,
    .sbs-cutscene-list-item:hover {
      border-color: rgba(239, 194, 129, 0.45);
      background: rgba(38, 23, 17, 0.94);
      transform: translateY(-1px);
    }

    .sbs-cutscene-button[disabled] {
      opacity: 0.45;
      cursor: default;
      transform: none;
    }

    .sbs-cutscene-list-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      width: 100%;
      min-width: 0;
      padding: 8px 10px;
      text-align: left;
    }

    .sbs-cutscene-list-item.is-selected {
      border-color: rgba(239, 194, 129, 0.72);
      background: linear-gradient(180deg, rgba(68, 35, 24, 0.96), rgba(21, 12, 9, 0.96));
    }

    .sbs-cutscene-list-item.is-active {
      box-shadow: inset 0 0 0 1px rgba(158, 224, 111, 0.5);
    }

    .sbs-cutscene-list-name {
      font-family: "skill_font", sans-serif;
      font-size: 16px;
      line-height: 1.05;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sbs-cutscene-list-meta,tokenBarBehindstagger

    .sbs-cutscene-status,
    .sbs-cutscene-caption,
    .sbs-cutscene-path {
      color: rgba(239, 194, 129, 0.74);
      font-family: "alt_skill_font", sans-serif;
      font-size: 13px;
      line-height: 1.25;
    }

    .sbs-cutscene-status {
      color: #9ee06f;
    }

    .sbs-cutscene-editor {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 16px;
    }

    .sbs-cutscene-editor-header {
      justify-content: space-between;
    }

    .sbs-cutscene-name-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: min(100%, 360px);
    }

    .sbs-cutscene-field-label {
      color: rgba(239, 194, 129, 0.74);
      font-family: "alt_skill_font", sans-serif;
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .sbs-cutscene-name-field input {
      height: 38px;
      border: 1px solid rgba(239, 194, 129, 0.2);
      background: rgba(12, 8, 7, 0.95);
      color: #efc281;
      font-family: "alt_skill_font", sans-serif;
      font-size: 16px;
      padding: 8px 10px;
    }

    .sbs-cutscene-name-field input:focus {
      outline: none;
      border-color: rgba(239, 194, 129, 0.55);
      box-shadow: 0 0 0 1px rgba(239, 194, 129, 0.2);
    }

    .sbs-cutscene-scale-field {
      width: 122px;
      min-width: 122px;
    }

    .sbs-cutscene-scale-field input {
      text-align: right;
    }

    .sbs-cutscene-slide-toolbar {
      justify-content: space-between;
    }

    .sbs-cutscene-slide-list {
      flex: 1;
      padding-right: 4px;
    }

    .sbs-cutscene-slide-card {
      display: grid;
      grid-template-columns: 180px minmax(0, 1fr);
      gap: 14px;
      padding: 12px;
      border: 1px solid rgba(239, 194, 129, 0.12);
      background: rgba(8, 6, 5, 0.7);
    }

    .sbs-cutscene-slide-preview {
      overflow: hidden;
      border: 1px solid rgba(239, 194, 129, 0.15);
      background: #050505;
      aspect-ratio: 16 / 9;
    }

    .sbs-cutscene-slide-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border: none;
      display: block;
    }

    .sbs-cutscene-slide-body {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }

    .sbs-cutscene-slide-title {
      color: #efc281;
      font-family: "skill_font", sans-serif;
      font-size: 20px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .sbs-cutscene-path {
      word-break: break-all;
    }

    .sbs-cutscene-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 180px;
      padding: 24px;
      border: 1px dashed rgba(239, 194, 129, 0.24);
      background: rgba(0, 0, 0, 0.26);
      color: rgba(239, 194, 129, 0.8);
      text-align: center;
    }

    .sbs-cutscene-overlay {
      position: fixed;
      inset: 0;
      z-index: 100000;
      display: none;
      background: rgba(0, 0, 0, 0.97);
      backdrop-filter: blur(4px);
    }

    .sbs-cutscene-overlay.is-active {
      display: block;
    }

    .sbs-cutscene-overlay__shell {
      display: flex;
      flex-direction: column;
      gap: 18px;
      width: 100%;
      height: 100%;
      padding: 18px 22px 24px;
    }

    .sbs-cutscene-overlay__header,
    .sbs-cutscene-overlay__meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .sbs-cutscene-overlay__eyebrow,
    .sbs-cutscene-overlay__counter,
    .sbs-cutscene-overlay__hint {
      color: rgba(239, 194, 129, 0.78);
      font-family: "alt_skill_font", sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .sbs-cutscene-overlay__eyebrow,
    .sbs-cutscene-overlay__counter {
      font-size: 12px;
    }

    .sbs-cutscene-overlay__title {
      margin: 4px 0 0;
      color: #f7dfb1;
      font-family: "skill_font", sans-serif;
      font-size: clamp(26px, 3vw, 42px);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .sbs-cutscene-overlay__close {
      min-height: 34px;
      padding: 6px 14px;
      border: 1px solid rgba(239, 194, 129, 0.28);
      background: rgba(16, 11, 9, 0.9);
      color: #efc281;
      font-family: "alt_skill_font", sans-serif;
      cursor: pointer;
    }

    .sbs-cutscene-overlay__stage {
      flex: 1;
      min-height: 0;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .sbs-cutscene-overlay__image {
      position: absolute;
      top: 50%;
      left: 50%;
      display: block;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border: none;
      opacity: 0;
      pointer-events: none;
      transition: opacity ${CUTSCENE_IMAGE_FADE_MS}ms ease;
      transform: translate(-50%, -50%) scale(var(--sbs-cutscene-scale, 1));
      transform-origin: center center;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
    }

    .sbs-cutscene-overlay__image.is-active {
      opacity: 1;
    }

    .sbs-cutscene-overlay__hint {
      text-align: center;
      font-size: 11px;
    }

    @media (max-width: 900px) {
      .sbs-reveal-showcase-list {
        grid-template-columns: minmax(0, 1fr);
      }

      .sbs-cutscene-manager {
        grid-template-columns: minmax(0, 1fr);
      }

      .sbs-cutscene-slide-card {
        grid-template-columns: minmax(0, 1fr);
      }

      .sbs-cutscene-overlay__header,
      .sbs-cutscene-overlay__meta {
        flex-direction: column;
        align-items: flex-start;
      }
    }

    .sbs-skill-showcase {
      margin-bottom: 10px;
      border: 1px solid #463221;
      border-radius: 6px;
      overflow: hidden;
      background: #090909;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
    }

    .sbs-skill-showcase-card {
      position: relative;
      width: 100%;
      aspect-ratio: 1898 / 1500;
      overflow: hidden;
      background: #3f3f3f url('systems/sotc/assets/sheets/Manual_Default_background.png') center/cover;
      color: #efc281;
      font-family: "skill_font", sans-serif;
      container-type: inline-size;
    }

    .sbs-skill-showcase-card img {
      border: none;
    }

    .sbs-skill-showcase-border {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 2;
      pointer-events: none;
    }

    .sbs-skill-showcase-weight-icon {
      position: absolute;
      top: 0.9%;
      right: 45.5%;
      left: auto;
      width: 18%;
      z-index: 3;
      pointer-events: none;
    }

    .sbs-skill-showcase-light,
    .sbs-skill-showcase-weight,
    .sbs-skill-showcase-emotion {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #000;
      text-align: center;
      z-index: 4;
    }

    .sbs-skill-showcase-light {
      top: 4.8%;
      left: 2.7%;
      width: 10.5%;
      height: 13.5%;
      font-size: 30px;
      font-size: 10.6cqw;
      text-shadow: rgba(255, 255, 255, 0.92) 0 0 6px, rgba(255, 255, 255, 0.92) 0 0 12px;
    }

    .sbs-skill-showcase-weight {
      top: 1.5%;
      left: 46.4%;
      width: 8%;
      height: 8%;
      font-size: 18px;
      font-size: 5.8cqw;
      text-shadow: rgba(255, 255, 255, 0.92) 0 0 6px, rgba(255, 255, 255, 0.92) 0 0 12px;
    }

    .sbs-skill-showcase-name {
      position: absolute;
      top: 22%;
      left: 10.1%;
      width: 32.2%;
      min-height: 5.6%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      transform: rotate(-11deg);
      transform-origin: center;
      color: #000;
      font-size: 10px;
      font-size: 3.35cqw;
      line-height: 0.95;
      text-align: center;
      text-shadow: rgba(255, 255, 255, 0.92) 0 0 6px, rgba(255, 255, 255, 0.92) 0 0 12px;
      z-index: 4;
      overflow: hidden;
      word-break: break-word;
    }

    .sbs-skill-showcase-art-frame {
      position: absolute;
      top: 21.8%;
      left: 0;
      width: 53%;
      height: 57%;
      overflow: hidden;
      z-index: 1;
    }

    .sbs-skill-showcase-art {
      width: 100%;
      height: auto;
      min-height: 100%;
      max-width: none;
      display: block;
    }

    .sbs-skill-showcase-emotion-icon {
      position: absolute;
      bottom: 7.5%;
      left: 3.4%;
      width: 18%;
      z-index: 3;
      pointer-events: none;
    }

    .sbs-skill-showcase-emotion {
      bottom: 7.7%;
      left: 6.8%;
      width: 8%;
      height: 10%;
      font-size: 19px;
      font-size: 6.1cqw;
      text-shadow: rgba(255, 255, 255, 0.92) 0 0 6px, rgba(255, 255, 255, 0.92) 0 0 12px;
    }

    .sbs-skill-showcase-description {
      position: absolute;
      left: 17%;
      bottom: 12%;
      width: 31%;
      height: 18%;
      overflow: hidden;
      font-family: "alt_skill_font", sans-serif;
      font-size: 9px;
      font-size: 3.05cqw;
      line-height: 1.15;
      color: #efc281;
      white-space: pre-wrap;
      z-index: 4;
    }

    .sbs-skill-showcase-right {
      position: absolute;
      top: 7%;
      right: 1.4%;
      bottom: 4%;
      width: 43%;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 4;
      overflow: visible;
    }

    .sbs-skill-showcase-limit {
      align-self: flex-end;
      min-height: 12px;
      color: #efc281;
      font-size: 10px;
      font-size: 2.9cqw;
      text-shadow: rgba(0, 0, 0, 0.9) 0 0 6px;
    }

    .sbs-skill-showcase-mods {
      width: 86%;
      align-self: center;
      min-height: 16%;
      overflow: hidden;
      color: #fff;
      font-family: "alt_skill_font", sans-serif;
      font-size: 8px;
      font-size: 2.5cqw;
      line-height: 1.2;
      white-space: pre-wrap;
      text-shadow: rgba(0, 0, 0, 0.9) 0 0 6px;
    }

    .sbs-skill-showcase-dice {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 4% 6% 4% 4%;
      flex: 1 1 auto;
      overflow: auto;
      transition: gap 120ms ease, font-size 120ms ease;
      transform-origin: top left;
    }

    .sbs-skill-showcase-dice.sbs-dice-compact {
      gap: 5px;
      font-size: 0.92em;
    }
    .sbs-skill-showcase-dice.sbs-dice-compact-tight {
      gap: 4px;
      font-size: 0.85em;
    }
    .sbs-skill-showcase-dice.sbs-dice-compact-super {
      gap: 2px;
      font-size: 0.78em;
      word-break: break-word;
    }

    .sbs-skill-showcase-die {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      color: #fff;
    }

    .sbs-skill-showcase-die-icon {
      width: 24px;
      height: 24px;
      width: 8.5cqw;
      height: 8.5cqw;
      flex: 0 0 auto;
      margin-top: 1px;
    }

    .sbs-skill-showcase-die-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .sbs-skill-showcase-die-formula {
      font-weight: bold;
      font-size: 12px;
      font-size: 3.9cqw;
      line-height: 1.15;
      text-shadow: rgba(0, 0, 0, 0.9) 0 0 6px;
    }

    .sbs-skill-showcase-die-mods {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-family: "alt_skill_font", sans-serif;
      font-size: 8px;
      font-size: 2.35cqw;
      line-height: 1.15;
      color: #efc281;
      text-shadow: rgba(0, 0, 0, 0.9) 0 0 6px;
    }
  `;

  document.head.appendChild(style);
}

const SKILL_CHAT_SELECTORS = [
  ".skill-declaration",
  ".skill-roll-summary",
  ".skill-die-roll"
];

function getRenderedHtmlRoot(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return null;
}

function cleanItemName(raw) {
  // messy param name to look more human
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSpeakerActors(message) {
  const speaker = message?.speaker;
  const actors = [];

  function addActor(actor) {
    if (!actor) return;
    if (actors.some(existing => existing === actor || existing.id === actor.id)) return;
    actors.push(actor);
  }

  addActor(message?.actor);
  addActor(canvas?.tokens?.get(speaker?.token)?.actor);
  addActor(game.scenes?.get(speaker?.scene)?.tokens?.get(speaker?.token)?.actor);
  addActor(game.actors?.get(speaker?.actor));

  return actors;
}

function findSkillItem(actor, itemName) {
  const cleanName = cleanItemName(itemName);
  if (!actor || !cleanName) return null;

  return actor.items.find(item => {
    const isSupportedType = item.type === "skill" || item.type === "ego";
    return isSupportedType && cleanItemName(item.name) === cleanName;
  }) ?? actor.items.find(item => {
    const isSupportedType = item.type === "skill" || item.type === "ego";
    return isSupportedType && cleanItemName(item.name).toLowerCase() === cleanName.toLowerCase();
  }) ?? null;
}

function pickSkillItem(message, itemName) {
  for (const actor of getSpeakerActors(message)) {
    const item = findSkillItem(actor, itemName);
    if (item) return { actor, item };
  }

  return { actor: null, item: null };
}

function debugSpeakerActors(message, itemName) {
  const cleanName = cleanItemName(itemName).toLowerCase();

  return getSpeakerActors(message).map(actor => ({
    actor: actor.name,
    actorId: actor.id,
    skillCount: actor.items.filter(item => item.type === "skill" || item.type === "ego").length,
    matches: actor.items
      .filter(item => (item.type === "skill" || item.type === "ego") && cleanItemName(item.name).toLowerCase() === cleanName)
      .map(item => ({ id: item.id, name: item.name, type: item.type }))
  }));
}

function pullSkillName(section) {
  const hName = cleanItemName(section.querySelector("h3")?.textContent);
  if (hName) return hName;

  const reName = cleanItemName(section.querySelector(".reroll-die")?.dataset.itemname);
  if (reName) return reName;

  const pl = section.querySelector(".resolve-die")?.dataset.payload;
  if (!pl) return "";

  try {
    const p = JSON.parse(pl);
    return cleanItemName(p?.itemName);
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function arrayify(rawValue) {
  if (Array.isArray(rawValue)) return rawValue;
  if (rawValue && typeof rawValue === "object") return Object.values(rawValue);
  if (rawValue === undefined || rawValue === null || rawValue === "") return [];
  return [rawValue];
}

function getModsText(item) {
  const modsRaw = item.system?.skill_modules?.mods ?? item.system?.skill_modules;
  return arrayify(modsRaw)
    .map(value => String(value ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

function getDiceRows(item) {
  const diceRaw = item.system?.dice?.die;
  return Array.isArray(diceRaw) ? diceRaw : Object.values(diceRaw ?? {});
}

function makeDiceHtml(item) {
  const dice = getDiceRows(item);
  const statusSource = item?.parent ?? item?.actor ?? null;

  return dice.map(die => {
    const dieType = escapeHtml(die?.type ?? "slash");
    const formula = escapeHtml(die?.formula ?? "");
    const modsBlock = arrayify(die?.mods)
      .map(mod => String(mod ?? "").trim())
      .filter(Boolean)
      .map(mod => `<div>${renderStatusTokenHtml(mod, statusSource)}</div>`)
      .join("");

    return `
      <div class="sbs-skill-showcase-die">
        <img class="sbs-skill-showcase-die-icon" src="systems/sotc/assets/dice types/${dieType}.png" alt="${dieType}">
        <div class="sbs-skill-showcase-die-body">
          <div class="sbs-skill-showcase-die-formula die-color-${dieType}">${formula}</div>
          ${modsBlock ? `<div class="sbs-skill-showcase-die-mods">${modsBlock}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function ensureChatShowcasePreviewRoot() {
  if (chatShowcasePreviewRoot?.isConnected) return chatShowcasePreviewRoot;

  const alreadyThere = document.getElementById(CHAT_SHOWCASE_PREVIEW_OVERLAY_ID);
  if (alreadyThere) {
    chatShowcasePreviewRoot = alreadyThere;
    return alreadyThere;
  }

  const root = document.createElement("section");
  root.id = CHAT_SHOWCASE_PREVIEW_OVERLAY_ID;
  root.className = "sbs-chat-showcase-preview";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="sbs-chat-showcase-preview__panel" data-chat-showcase-preview-panel tabindex="-1" role="dialog" aria-modal="true" aria-label="Skill preview">
      <div class="sbs-chat-showcase-preview__body" data-chat-showcase-preview-body></div>
    </div>
  `;

  root.addEventListener("click", event => {
    const clickedClose = event.target.closest?.("[data-chat-showcase-preview-close]");
    if (event.target !== root && !clickedClose) return;

    event.preventDefault();
    closeChatShowcasePreview();
  });

  window.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (!root.classList.contains("is-active")) return;

    event.preventDefault();
    event.stopPropagation();
    closeChatShowcasePreview();
  }, true);

  document.body.appendChild(root);
  chatShowcasePreviewRoot = root;
  return root;
}

function closeChatShowcasePreview() {
  let root = chatShowcasePreviewRoot?.isConnected
    ? chatShowcasePreviewRoot
    : document.getElementById(CHAT_SHOWCASE_PREVIEW_OVERLAY_ID);
  if (!root) return;

  chatShowcasePreviewRoot = root;
  root.classList.remove("is-active");
  root.setAttribute("aria-hidden", "true");

  const title = root.querySelector("[data-chat-showcase-preview-title]");
  if (title) {
    title.textContent = "";
  }

  const body = root.querySelector("[data-chat-showcase-preview-body]");
  body?.replaceChildren();
}

function openChatShowcasePreview(showcaseElement) {
  if (!chatCardsEnabled()) return;

  const showcase = showcaseElement?.closest?.(".sbs-skill-showcase") ?? showcaseElement;
  if (!(showcase instanceof HTMLElement)) return;

  const root = ensureChatShowcasePreviewRoot();
  const panel = root.querySelector("[data-chat-showcase-preview-panel]");
  const titleBox = root.querySelector("[data-chat-showcase-preview-title]");
  const bodyBox = root.querySelector("[data-chat-showcase-preview-body]");
  if (!bodyBox) return;

  const copy = showcase.cloneNode(true);
  bodyBox.replaceChildren(copy);

  // Allow the cloned preview to adjust its layout (text/dice fitting)
  scheduleAdjustSkillShowcaseLayout(bodyBox);

  if (titleBox) {
    const labelText = cleanItemName(showcase.querySelector(".sbs-skill-showcase-name")?.textContent);
    titleBox.textContent = labelText || "Skill Preview";
  }

  root.classList.add("is-active");
  root.setAttribute("aria-hidden", "false");
  panel?.focus?.();
}

function bindChatShowcasePreview(root) {
  if (!chatCardsEnabled()) return;

  for (const artBox of root.querySelectorAll(".sbs-skill-showcase-art-frame")) {
    if (artBox.dataset.sbsChatPreviewBound === "true") continue;

    artBox.dataset.sbsChatPreviewBound = "true";
    artBox.dataset.sbsChatPreviewTrigger = "true";
    artBox.tabIndex = 0;
    artBox.setAttribute("role", "button");

    const showcase = artBox.closest(".sbs-skill-showcase");
    const labelText = cleanItemName(showcase?.querySelector(".sbs-skill-showcase-name")?.textContent) || "skill preview";
    artBox.setAttribute("aria-label", `Open larger preview of ${labelText}`);

    artBox.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      openChatShowcasePreview(showcase);
    });

    artBox.addEventListener("keydown", event => {
      if (!["Enter", " "].includes(event.key)) return;

      event.preventDefault();
      event.stopPropagation();
      openChatShowcasePreview(showcase);
    });
  }
}

function makeSkillShowcase(item) {
  const fallbackArt = "systems/sotc/assets/Raw Ruina Assets/Pages/default skill icon.png";
  const statusSource = item?.parent ?? item?.actor ?? null;
  const art = item.img && item.img !== "icons/svg/item-bag.svg" ? item.img : fallbackArt;
  const artSrc = escapeHtml(art);
  const borderStyle = item.system?.border_style || (item.type === "ego" ? "ego" : "paperback");
  const borderImage = `systems/sotc/assets/sheets/skills/borders/${borderStyle}.png`;
  const weightIcon = item.system?.weight > 1
    ? "systems/sotc/assets/sheets/skills/SkillMass.png"
    : "systems/sotc/assets/sheets/skills/SkillNormal.png";
  const lightCost = Number(item.system?.light_cost ?? 0);
  const weight = Number(item.system?.weight ?? 1);
  const emotionCost = Number(item.system?.emotion_cost ?? 0);
  const limitValue = Number(item.system?.limit?.value ?? 0);
  const limitMax = Number(item.system?.limit?.max ?? 0);
  const limitLine = limitMax > 0 ? `Limit: ${limitValue}/${limitMax}` : "";
  const description = String(item.system?.description ?? "").trim() || "Description...";
  const modsRaw = getModsText(item);
  const diceBits = makeDiceHtml(item);
  const titleSafe = escapeHtml(item.name);
  const descHtml = renderStatusTokenHtml(description, statusSource);
  const modsRendered = renderStatusTokenHtml(modsRaw, statusSource);

  return `
    <div class="sbs-skill-showcase">
      <div class="sbs-skill-showcase-card">
        <img class="sbs-skill-showcase-border" src="${borderImage}" alt="${escapeHtml(borderStyle)} border">
        <img class="sbs-skill-showcase-weight-icon" src="${weightIcon}" alt="${weight > 1 ? "Mass attack" : "Normal attack"}">
        <div class="sbs-skill-showcase-light">${lightCost}</div>
        ${weight > 1 ? `<div class="sbs-skill-showcase-weight">${weight}</div>` : ""}
        <div class="sbs-skill-showcase-name">${titleSafe}</div>
        <div class="sbs-skill-showcase-art-frame">
          <img class="sbs-skill-showcase-art" src="${artSrc}" alt="${titleSafe}" title="${titleSafe}">
        </div>
        ${emotionCost > 0 ? `<img class="sbs-skill-showcase-emotion-icon" src="systems/sotc/assets/sheets/skills/SkillEmotionIcon.png" alt="Emotion cost">` : ""}
        ${emotionCost > 0 ? `<div class="sbs-skill-showcase-emotion">${emotionCost}</div>` : ""}
        <div class="sbs-skill-showcase-description">${descHtml}</div>
        <div class="sbs-skill-showcase-right">
          <div class="sbs-skill-showcase-limit">${escapeHtml(limitLine)}</div>
          <div class="sbs-skill-showcase-mods">${modsRendered}</div>
          <div class="sbs-skill-showcase-dice">${diceBits}</div>
        </div>
      </div>
    </div>
  `;
}

function adjustSkillShowcaseLayout(root) {
  try {
    const scope = root instanceof Element ? root : (root && root.nodeType ? root : document);
    const showcases = scope.querySelectorAll('.sbs-skill-showcase');

    for (const showcase of showcases) {
      const card = showcase.querySelector('.sbs-skill-showcase-card') || showcase;
      const right = card.querySelector('.sbs-skill-showcase-right');
      const mods = card.querySelector('.sbs-skill-showcase-mods');
      const dice = card.querySelector('.sbs-skill-showcase-dice');
      const description = card.querySelector('.sbs-skill-showcase-description');

      if (!right || !mods || !dice) continue;

      // Reset any previous inline styles/classes
      dice.style.marginTop = '';
      dice.style.maxHeight = '';
      dice.style.overflowY = '';
      dice.classList.remove('sbs-dice-compact', 'sbs-dice-compact-tight', 'sbs-dice-compact-super');

      if (description) {
        description.style.height = 'auto';
      }

      // Force a reflow so measurements are accurate
      const cardRect = card.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const modsRect = mods.getBoundingClientRect();
      const diceRect = dice.getBoundingClientRect();

      const marginPx = Math.max(6, Math.round(cardRect.height * 0.02));

      // Determine available vertical space for dice below the mods block
      const availableForDice = Math.max(0, (rightRect.bottom - modsRect.bottom) - marginPx);
      const diceContentHeight = dice.scrollHeight;
      if (diceContentHeight > availableForDice) {
        const levels = ['sbs-dice-compact', 'sbs-dice-compact-tight', 'sbs-dice-compact-super'];
        let fitted = false;
        for (const lvl of levels) {
          dice.classList.add(lvl);
          // reflow
          const h = dice.scrollHeight;
          if (h <= availableForDice) { fitted = true; break; }
        }

        if (!fitted) {
          dice.style.maxHeight = Math.max(availableForDice, 40) + 'px';
          dice.style.overflowY = 'auto';
        } else {
          dice.style.maxHeight = '';
          dice.style.overflowY = '';
        }
      } else {
        dice.style.maxHeight = '';
        dice.style.overflowY = '';
      }
    }
  } catch (err) {
    console.warn(`[${MODULE_ID}] adjustSkillShowcaseLayout error`, err);
  }
}

function scheduleAdjustSkillShowcaseLayout(root) {
  if (!root) return;
  const el = root instanceof Element ? root : (root && root.nodeType ? root : document);

  requestAnimationFrame(() => {
    adjustSkillShowcaseLayout(el);

    // Re-run after images load and after a small delay for late renders
    const imgs = el.querySelectorAll('img');
    let pending = 0;
    for (const img of imgs) {
      if (!img.complete) {
        pending++;
        img.addEventListener('load', () => { pending--; if (pending <= 0) adjustSkillShowcaseLayout(el); }, { once: true });
        img.addEventListener('error', () => { pending--; if (pending <= 0) adjustSkillShowcaseLayout(el); }, { once: true });
      }
    }

    setTimeout(() => adjustSkillShowcaseLayout(el), 250);
    setTimeout(() => adjustSkillShowcaseLayout(el), 900);
  });

  if (!window.__sbsSkillShowcaseResizeRegistered) {
    window.addEventListener('resize', () => adjustSkillShowcaseLayout(document));
    window.__sbsSkillShowcaseResizeRegistered = true;
  }
}

function enhanceSkillChatMessage(message, html) {
  const root = getRenderedHtmlRoot(html);
  if (!root) return;

  const hasSkillStuff = SKILL_CHAT_SELECTORS.some(selector => root.querySelector(selector));
  if (!hasSkillStuff) return;

  const actorsHere = getSpeakerActors(message);
  if (!chatCardsEnabled()) {
    replaceStatusTokensInHtml(root, actorsHere.length ? actorsHere : null);
    return;
  }

  if (!actorsHere.length) {
    console.info(`[${MODULE_ID}] showcase candidate without speaker actor`, {
      build: CHAT_SHOWCASE_BUILD,
      messageId: message?.id,
      speaker: message?.speaker,
      htmlType: html?.constructor?.name ?? typeof html
    });
    replaceStatusTokensInHtml(root, null);
    return;
  }

  for (const selector of SKILL_CHAT_SELECTORS) {
    const sections = root.querySelectorAll(selector);

    for (const section of sections) {
      if (section.dataset.sbsSkillShowcase === "true") continue;

      const skillName = pullSkillName(section);
      const { actor, item } = pickSkillItem(message, skillName);
      if (!item) {
        console.info(`[${MODULE_ID}] showcase candidate without matching item`, {
          build: CHAT_SHOWCASE_BUILD,
          speakerActors: debugSpeakerActors(message, skillName),
          itemName: skillName,
          selector
        });
        continue;
      }

      section.insertAdjacentHTML("afterbegin", makeSkillShowcase(item));
      section.dataset.sbsSkillShowcase = "true";
      console.info(`[${MODULE_ID}] showcase inserted`, {
        build: CHAT_SHOWCASE_BUILD,
        actor: actor.name,
        item: item.name,
        selector
      });
    }
  }

  replaceStatusTokensInHtml(root, actorsHere);
  bindChatShowcasePreview(root);
  // Adjust layout so mods/dice don't overlap and many dice can be compacted
  scheduleAdjustSkillShowcaseLayout(root);
}

Hooks.on("renderChatMessage", enhanceSkillChatMessage);
Hooks.on("renderActorSheet", attachActorSheetRevealToggles);
Hooks.on("renderSotCActorSheet", attachActorSheetRevealToggles);
Hooks.on("renderActorSheet", captureSkillRollDialogContextFromActorSheet);
Hooks.on("renderSotCActorSheet", captureSkillRollDialogContextFromActorSheet);
Hooks.on("renderItemSheet", scheduleSkillStatusDecoration);
Hooks.on("renderSotCSkillSheet", scheduleSkillStatusDecoration);
Hooks.on("renderDialog", scheduleSkillRollDialogChargeDecoration);
Hooks.on("renderApplication", scheduleSkillStatusDecoration);
Hooks.on("getSceneControlButtons", installCutsceneSceneControls);
Hooks.on("updateActor", (actor, changes) => {
  if (
    Object.prototype.hasOwnProperty.call(changes ?? {}, "name")
    || Object.prototype.hasOwnProperty.call(changes ?? {}, "img")
    || changes?.system?.mini_img !== undefined
    || changes?.system?.role !== undefined
    || changes?.system?.biography !== undefined
  ) {
    rerenderActorRevealSheets(actor);
  }
});
Hooks.on("updateItem", item => rerenderActorRevealSheets(item?.parent));
Hooks.on("createItem", item => rerenderActorRevealSheets(item?.parent));
Hooks.on("deleteItem", item => rerenderActorRevealSheets(item?.parent));

//==========================================================
//================== BLACJACK ==============================
//==========================================================

Hooks.on("chatMessage", (chatLog, messageText, chatData) => {
  if (messageText.trim().startsWith("/blackjack")) {
    if (!sillyFeaturesEnabled()) {
      ui.notifications?.warn("Silly Features are disabled in the module settings.");
      return false;
    }

    if(!blackJackData.has(game.user.id))
    {
      blackJackData.set(game.user.id, null);
    }

    if(messageText.includes("hit")) {

      const card = drawCard();
      blackJackData.get(game.user.id)[0].push(card);
      if(calculateHandScore(blackJackData.get(game.user.id)[0]) > 21)
      {
      ChatMessage.create({
            content: "You blew up, :( \n Your cards: " + blackJackData.get(game.user.id)[0].join(", ") + "total of " + calculateHandScore(blackJackData.get(game.user.id)[0]) ,
            whisper: [game.user.id],
            speaker: ChatMessage.getSpeaker({alias: "Ziv"})
        });
        blackJackData.set(game.user.id, null);
      }
      else if(calculateHandScore(blackJackData.get(game.user.id)[0]) === 21)
      {
      ChatMessage.create({
            content: "You got jack black, you won..... \n Your cards: " + blackJackData.get(game.user.id)[0].join(", ") + "\n(and no the house does not get to attempt to draw with you, skill issue on their part.)",
            whisper: [game.user.id],
            speaker: ChatMessage.getSpeaker({alias: "Ziv"})
        });
        blackJackData.set(game.user.id, null);
      }
      else
      {
        ChatMessage.create({
          content: "You got " + card + "\nYour cards: " + blackJackData.get(game.user.id)[0].join(", ") + " for a total of " + calculateHandScore(blackJackData.get(game.user.id)[0]) + "\nstand or hit again.",
          whisper: [game.user.id],
          speaker: ChatMessage.getSpeaker({alias: "Ziv"})
        });
      }

    }
    else if(messageText.includes("stand")) {
        while(calculateHandScore(blackJackData.get(game.user.id)[1]) < 17)
        {
          blackJackData.get(game.user.id)[1].push(drawCard());
        }
        if(calculateHandScore(blackJackData.get(game.user.id)[1]) > 21)
        {
            ChatMessage.create({
            content: "The house blew up, housing markets are even worse, but you win! \n Your cards: " + blackJackData.get(game.user.id)[0].join(", ") + "\n Dealer's cards: " + blackJackData.get(game.user.id)[1].join(", "),
            whisper: [game.user.id],
            speaker: ChatMessage.getSpeaker({alias: "Ziv"})
        });
        }
        else if(calculateHandScore(blackJackData.get(game.user.id)[1]) === 21)
        {
          ChatMessage.create({
            content: "At this point, it's just a skill issue on your side. \n Your cards: " + blackJackData.get(game.user.id)[0].join(", ") + "\n Dealer's cards: " + blackJackData.get(game.user.id)[1].join(", ") + "\n The house got jack black",
            whisper: [game.user.id],
            speaker: ChatMessage.getSpeaker({alias: "Ziv"})
        });
        }
        else if(calculateHandScore(blackJackData.get(game.user.id)[0]) > calculateHandScore(blackJackData.get(game.user.id)[1]))
        {          ChatMessage.create({
            content: "You win! \n Your cards: " + blackJackData.get(game.user.id)[0].join(", ") + " For a total of " + calculateHandScore(blackJackData.get(game.user.id)[0]) + "\n Dealer's cards: " + blackJackData.get(game.user.id)[1].join(", ") + " For a total of " + calculateHandScore(blackJackData.get(game.user.id)[1]),
            whisper: [game.user.id],
            speaker: ChatMessage.getSpeaker({alias: "Ziv"})
        });
        }
        else if(calculateHandScore(blackJackData.get(game.user.id)[0]) === calculateHandScore(blackJackData.get(game.user.id)[1]))
        {
          ChatMessage.create({
            content: "It's a tie! Wich I find so personally uninteresting i will not even show the cards.",
            whisper: [game.user.id],
            speaker: ChatMessage.getSpeaker({alias: "Ziv"})
        });
        }
        else
        {          ChatMessage.create({
            content: "House was better then you! \n Your cards: " + blackJackData.get(game.user.id)[0].join(", ") + " For a total of " + calculateHandScore(blackJackData.get(game.user.id)[0]) + "\n Dealer's cards: " + blackJackData.get(game.user.id)[1].join(", ") + " For a total of " + calculateHandScore(blackJackData.get(game.user.id)[1]),
            whisper: [game.user.id],
            speaker: ChatMessage.getSpeaker({alias: "Ziv"})
        });
        }
        blackJackData.set(game.user.id, null);
    }
    else
    {
      
      if(blackJackData.get(game.user.id) === null)
      {
        const cards = dealInitialCards(game.user.id);
      ChatMessage.create({
        content: "You WILL be playing blackjack NOW!!! \n Your cards: " + cards[0].join(", ") + " For a total of " + calculateHandScore(cards[0]) + "\n Dealer's visible card: " + cards[1][0] + "\n Type /blackjack hit to draw another card, or /blackjack stand to stand.",
        whisper: [game.user.id],
        speaker: ChatMessage.getSpeaker({alias: "Ziv"})
      });
      }
      else
      {
        const cards = blackJackData.get(game.user.id);
        ChatMessage.create({
        content: "YOU ARE already PLAYING BLACKJACK! \n Your cards: " + cards[0].join(", ") + " For a total of " + calculateHandScore(cards[0]) + "\n Dealer's visible card: " + cards[1][0] + "\n Type /blackjack hit to draw another card, or /blackjack stand to stand.",
        whisper: [game.user.id],
        speaker: ChatMessage.getSpeaker({alias: "Ziv"})
      });
      }

    }
    return false;
  }
});

function drawCard() {
  const suit = suits[Math.floor(Math.random() * suits.length)];
  const value = values[Math.floor(Math.random() * values.length)];
  return `${value}${suit}`;
}

function dealInitialCards(playerId) {
  const playerCards = [drawCard(), drawCard()];
  const dealerCards = [drawCard(), drawCard()];

    blackJackData.set(playerId, [playerCards, dealerCards]);
  return [playerCards, dealerCards];
}

function calculateHandScore(handArray) {
    let score = 0;
    let aceCount = 0;

    for (let cardStr of handArray) {
        const rank = cardStr.slice(0, -1);
        
        if (rank === "A") {
            score += 11;
            aceCount++;
        } else if (["J", "Q", "K"].includes(rank)) {
            score += 10;
        } else {
            score += parseInt(rank);
        }
    }

    while (score > 21 && aceCount > 0) {
        score -= 10;
        aceCount--;
    }

    return score;
}