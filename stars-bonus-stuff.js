//==================================================================
// module setup
//==================================================================

const MODULE_ID = "stars-bonus-stuff";
const CHAT_SHOWCASE_BUILD = "chat-showcase-2026-05-22-54";
const SHOWCASE_STYLE_ID = `${MODULE_ID}-chat-showcase-styles`;

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
  strength: 0.1,
  coarseScaleX: 6.4,
  coarseScaleY: 4.6,
  fineScaleX: 18,
  fineScaleY: 14,
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
  backgroundScale: 1.4,
  backgroundOffsetY: 0.02,
  backgroundMaskLift: 0.078,
  overlayLiftY: 0.14,
  fillOffsetX: 0.23,
  fillScaleX: 0.98,
  fillScaleY: 0.96,
  fillY: 0.21,
  labelOffsetX: 0.52,
  labelY: -0.14
};
const TOKEN_BAR_FILL_PATH_POINTS = {
  health: [[0.08, 0.18], [0.22, 0.18], [0.36, 0.5], [0.53, 0.86]],
  stagger: [[0.92, 0.18], [0.78, 0.18], [0.64, 0.5], [0.47, 0.86]]
};

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "enabled", {
    name: "Enable Light Overlay",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", () => {
  globalThis.__SBS_CHAT_SHOWCASE_BUILD = CHAT_SHOWCASE_BUILD;
  injectShowcaseStyles();
  installCustomTokenBars();
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
  return Boolean(tokenCanvas?.hover || tokenCanvas?.controlled);
}

function syncCustomBarVisibility(tokenCanvas) {
  if (!tokenCanvas?._sbsBarSprites) return;
  const visible = shouldShowCustomBars(tokenCanvas);
  for (const sprite of tokenCanvas._sbsBarSprites) {
    sprite.visible = visible;
  }
}

function createCustomBarLabel(value, side, centerX, tokenSize) {
  const TextClass = globalThis.PreciseText ?? PIXI.Text;
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
  const label = new TextClass(String(Math.max(0, Math.floor(Number(value ?? 0)))), style);

  label.anchor?.set?.(side === "health" ? 1 : 0, 0.5);
  label.x = centerX + ((side === "health" ? -1 : 1) * tokenSize * TOKEN_BAR_GEOMETRY.labelOffsetX);
  return label;
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
  const maskTexSrc = side === "health"
    ? textures.tokenBarRevealHealth
    : textures.tokenBarRevealStagger;
  const imgSource = getTextureSource(maskTexSrc);
  if (!imgSource) return null;

  const width = Math.max(1, Math.round(targetWidth || TOKEN_BAR_ASSET_W.fill));
  const height = Math.max(1, Math.round(targetHeight || TOKEN_BAR_ASSET_H.fill));
  const cacheKey = `${side}:${cutoff}:${featherWidth}:${width}x${height}`;
  const cachedTexture = revealMaskTextureCache.get(cacheKey);
  if (cachedTexture) return cachedTexture;

  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width = width;
  tmpCanvas.height = height;

  const ctx = tmpCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(imgSource, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const rgba = imgData.data;
  const opaqueMask = new Uint8Array(width * height);
  const luma = new Uint8Array(width * height);
  const visibleMask = new Uint8Array(width * height);

  for (let pixelIndex = 0; pixelIndex < visibleMask.length; pixelIndex++) {
    const dataIndex = pixelIndex * 4;
    const alpha = rgba[dataIndex + 3];
    if (alpha <= 0) continue;
    opaqueMask[pixelIndex] = 1;

    luma[pixelIndex] = Math.round(
      (rgba[dataIndex] * 299 + rgba[dataIndex + 1] * 587 + rgba[dataIndex + 2] * 114) / 1000
    );
  }

  const smoothedLuma = makeBlurredLumMap(luma, opaqueMask, width, height);

  for (let pixelIndex = 0; pixelIndex < visibleMask.length; pixelIndex++) {
    if (!opaqueMask[pixelIndex]) continue;
    visibleMask[pixelIndex] = smoothedLuma[pixelIndex] >= cutoff ? 1 : 0;
  }

  const cleanedMask = cleanMaskBits(visibleMask, opaqueMask, width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width) + x;
      const dataIndex = pixelIndex * 4;
      const alpha = rgba[dataIndex + 3];
      let revealAlpha = 0;

      if (alpha > 0 && cleanedMask[pixelIndex]) {
        revealAlpha = getFeatherAlpha(cleanedMask, x, y, width, height, alpha, featherWidth);
      }

      rgba[dataIndex] = 255;
      rgba[dataIndex + 1] = 255;
      rgba[dataIndex + 2] = 255;
      rgba[dataIndex + 3] = revealAlpha;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const maskTex = PIXI.Texture.from(tmpCanvas);
  revealMaskTextureCache.set(cacheKey, maskTex);
  return maskTex;
}

function makeRevealMaskSprite(side, ratio, fill, fillTexture) {
  const { width, height } = getTexSize(
    fillTexture,
    TOKEN_BAR_ASSET_W.fill,
    TOKEN_BAR_ASSET_H.fill
  );
  const maskTex = makeRevealMaskTexture(side, ratio, width, height);
  if (!maskTex) return null;

  const mask = new PIXI.Sprite(maskTex);
  mask.anchor.set(fill.anchor.x, fill.anchor.y);
  mask.position.set(fill.x, fill.y);
  mask.scale.set(fill.scale.x, fill.scale.y);
  mask.angle = fill.angle;
  return mask;
}

function drawBarsOverToken(tokenCanvas) {
  cleanBarSprites(tokenCanvas);

  const bars = getCustomBarAssignments(tokenCanvas);
  if (!bars.length) return;

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
  const bgWidth = TOKEN_BAR_ASSET_W.background * bgScale;
  const bgHeight = TOKEN_BAR_ASSET_H.background * bgScale;
  const overlayLift = bgHeight * TOKEN_BAR_GEOMETRY.overlayLiftY;
  const ringCenterY = tokenCanvas.h + (bgHeight * TOKEN_BAR_GEOMETRY.backgroundOffsetY) - overlayLift;
  const isVisible = shouldShowCustomBars(tokenCanvas);
  const parts = [];
  const movingFilters = [];

  tokenCanvas.sortableChildren = true;

  const behind = new PIXI.Sprite(textures.tokenBarBehind);
  behind.anchor.set(0.5, 0.5);
  behind.scale.set(bgScale);
  behind.x = centerX;
  behind.y = ringCenterY;
  behind.zIndex = TOKEN_BAR_LAYER.behind;
  behind.visible = isVisible;
  tokenCanvas.addChild(behind);
  parts.push(behind);

  // only show the lower half
  const bg = new PIXI.Sprite(textures.tokenBarBackground);
  bg.anchor.set(0.5, 0.5);
  bg.scale.set(bgScale);
  bg.x = centerX;
  bg.y = ringCenterY;
  bg.zIndex = TOKEN_BAR_LAYER.background;
  bg.visible = isVisible;
  const bgMaskLift = bgHeight * TOKEN_BAR_GEOMETRY.backgroundMaskLift;
  const bgMask = createRectMask(
    centerX - bgWidth / 2,
    tokenCanvas.h - bgMaskLift - overlayLift,
    bgWidth,
    bgHeight / 2 + 2 + bgMaskLift
  );
  bg.mask = bgMask;
  bgMask.zIndex = TOKEN_BAR_LAYER.backgroundMask;
  bgMask.visible = isVisible;
  tokenCanvas.addChild(bgMask);
  tokenCanvas.addChild(bg);
  parts.push(bgMask);
  parts.push(bg);

  for (const assignment of bars) {
    const side = assignment.side;
    const barData = assignment.snapshot ?? { value: 0, max: 1 };
    const ratio = getBarRatio(barData);
    const fillTexture = side === "health" ? textures.tokenBarHealth : textures.tokenBarStagger;
    const fillScaleX = bgScale * TOKEN_BAR_GEOMETRY.fillScaleX;
    const fillScaleY = bgScale * TOKEN_BAR_GEOMETRY.fillScaleY;

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
        parts.push(fillMask);
      }
      tokenCanvas.addChild(fill);
      parts.push(fill);
    }

    const label = createCustomBarLabel(barData.value ?? 0, side, centerX, tokenSize);
    label.y = tokenCanvas.h + (bgHeight * TOKEN_BAR_GEOMETRY.labelY) - overlayLift;
    label.zIndex = TOKEN_BAR_LAYER.label;
    label.visible = isVisible;
    tokenCanvas.addChild(label);
    parts.push(label);
  }

  tokenCanvas._sbsBarSprites = parts;
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

function lightOverlayEnabled() {
  return game.settings.get(MODULE_ID, "enabled");
}

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
  const container = new PIXI.Container();

  const icon = new PIXI.Sprite(isFull ? textures.full : textures.empty);
  icon.anchor.set(0.5);
  icon.scale.set(0.26);

  container.addChild(icon);
  tokenCanvas.addChild(container);

  return container;
}

function renderTokenLights(tokenDoc, combat) {
  if (!lightOverlayEnabled()) return;
  if (!tokenDoc?.object || !combat?.active) return;

  const tokenCanvas = tokenDoc.object;
  const actor = tokenDoc.actor;
  if (!actor) return;

  const inCombat = combat.combatants.some(combatant => combatant.tokenId === tokenDoc.id);
  if (!inCombat) {
    cleanTokenMarkers(tokenCanvas);
    return;
  }

  const { current, max } = getLightData(actor);

  cleanTokenMarkers(tokenCanvas);
  tokenCanvas._lightMarkers = [];

  if (max <= 0) return;

  for (let i = 0; i < max; i++) {
    const isFull = i < current;
    const marker = createMarker(tokenCanvas, isFull);

    marker.x = tokenCanvas.w / 2 + (i - (max - 1) / 2) * 20;
    marker.y = -95;

    tokenCanvas._lightMarkers.push(marker);
  }
}

function rerenderActiveCombatLights() {
  if (!canvas?.tokens) return;

  const combat = game.combat;
  if (!combat?.active) {
    cleanAllMarkers();
    return;
  }

  const combatantTokenIds = new Set(combat.combatants.map(combatant => combatant.tokenId));

  canvas.tokens.placeables.forEach(token => {
    if (combatantTokenIds.has(token.id)) {
      renderTokenLights(token.document, combat);
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
      bottom: 7.2%;
      width: 31%;
      height: 14%;
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
      top: 3.2%;
      right: 1.4%;
      width: 43%;
      height: 92%;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 4;
      overflow: hidden;
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
      padding: 0 6% 4% 4%;
      overflow: hidden;
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

function cleanItemName(value) {
  return String(value ?? "")
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
  const titleName = cleanItemName(section.querySelector("h3")?.textContent);
  if (titleName) return titleName;

  const rerollItemName = cleanItemName(section.querySelector(".reroll-die")?.dataset.itemname);
  if (rerollItemName) return rerollItemName;

  const payload = section.querySelector(".resolve-die")?.dataset.payload;
  if (!payload) return "";

  try {
    const parsed = JSON.parse(payload);
    return cleanItemName(parsed?.itemName);
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

  return dice.map(die => {
    const dieType = escapeHtml(die?.type ?? "slash");
    const formula = escapeHtml(die?.formula ?? "");
    const extraLines = arrayify(die?.mods)
      .map(mod => String(mod ?? "").trim())
      .filter(Boolean)
      .map(mod => `<div>${escapeHtml(mod)}</div>`)
      .join("");

    return `
      <div class="sbs-skill-showcase-die">
        <img class="sbs-skill-showcase-die-icon" src="systems/sotc/assets/dice types/${dieType}.png" alt="${dieType}">
        <div class="sbs-skill-showcase-die-body">
          <div class="sbs-skill-showcase-die-formula die-color-${dieType}">${formula}</div>
          ${extraLines ? `<div class="sbs-skill-showcase-die-mods">${extraLines}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function makeSkillShowcase(item) {
  const fallbackArt = "systems/sotc/assets/Raw Ruina Assets/Pages/default skill icon.png";
  const art = item.img && item.img !== "icons/svg/item-bag.svg" ? item.img : fallbackArt;
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
  const modsText = getModsText(item);
  const diceHtml = makeDiceHtml(item);
  const safeName = escapeHtml(item.name);

  return `
    <div class="sbs-skill-showcase">
      <div class="sbs-skill-showcase-card">
        <img class="sbs-skill-showcase-border" src="${borderImage}" alt="${escapeHtml(borderStyle)} border">
        <img class="sbs-skill-showcase-weight-icon" src="${weightIcon}" alt="${weight > 1 ? "Mass attack" : "Normal attack"}">
        <div class="sbs-skill-showcase-light">${lightCost}</div>
        ${weight > 1 ? `<div class="sbs-skill-showcase-weight">${weight}</div>` : ""}
        <div class="sbs-skill-showcase-name">${safeName}</div>
        <div class="sbs-skill-showcase-art-frame">
          <img class="sbs-skill-showcase-art" src="${art}" alt="${safeName}" title="${safeName}">
        </div>
        ${emotionCost > 0 ? `<img class="sbs-skill-showcase-emotion-icon" src="systems/sotc/assets/sheets/skills/SkillEmotionIcon.png" alt="Emotion cost">` : ""}
        ${emotionCost > 0 ? `<div class="sbs-skill-showcase-emotion">${emotionCost}</div>` : ""}
        <div class="sbs-skill-showcase-description">${escapeHtml(description)}</div>
        <div class="sbs-skill-showcase-right">
          <div class="sbs-skill-showcase-limit">${escapeHtml(limitLine)}</div>
          <div class="sbs-skill-showcase-mods">${escapeHtml(modsText)}</div>
          <div class="sbs-skill-showcase-dice">${diceHtml}</div>
        </div>
      </div>
    </div>
  `;
}

function enhanceSkillChatMessage(message, html) {
  const root = getRenderedHtmlRoot(html);
  if (!root) return;

  const hasSkillStuff = SKILL_CHAT_SELECTORS.some(selector => root.querySelector(selector));
  if (!hasSkillStuff) return;

  const actorsHere = getSpeakerActors(message);
  if (!actorsHere.length) {
    console.info(`[${MODULE_ID}] showcase candidate without speaker actor`, {
      build: CHAT_SHOWCASE_BUILD,
      messageId: message?.id,
      speaker: message?.speaker,
      htmlType: html?.constructor?.name ?? typeof html
    });
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
}

Hooks.on("renderChatMessage", enhanceSkillChatMessage);