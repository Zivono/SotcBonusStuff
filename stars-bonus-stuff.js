const MODULE_ID = "stars-bonus-stuff";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "enabled", {
    name: "Enable Light Overlay",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });
});

function lightOverlayEnabled() {
  return game.settings.get(MODULE_ID, "enabled");
}

const textures = {
  empty: PIXI.Texture.from("modules/stars-bonus-stuff/img/LightSlotEmpty.webp"),
  full: PIXI.Texture.from("modules/stars-bonus-stuff/img/LightSlotFull.webp")
};

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

Hooks.on("updateToken", (tokenDoc, changes) => {
  if (!game.combat?.active) return;

  const lightChanged =
    changes.delta?.system?.light !== undefined ||
    changes.actorData?.system?.light !== undefined;

  if (!lightChanged) return;

  renderTokenLights(tokenDoc, game.combat);
});