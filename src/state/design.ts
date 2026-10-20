// Design defaults, resolution helpers and sanitising of untrusted input
// (localStorage, imported JSON).
import {
  ABSOLUTE_LIMITS,
  getModel,
  hasAccessory,
  hasHandleFinish,
  hasHandleStyle,
  hasLaminate,
  hasModel,
  hasShutterStyle,
} from "../data/catalog";
import { computeLayout } from "../engine/layout";
import type { Design, DoorOverride, PanelKey, Part, Surface, WardrobeModel } from "./types";

export const SURFACES: { key: Surface; label: string; hint: string }[] = [
  { key: "front", label: "Shutters", hint: "Main shutter laminate" },
  { key: "secondary", label: "Accent", hint: "Second colour for two-colour shutters" },
  { key: "carcass", label: "Side panels", hint: "Exposed sides and body edges" },
  { key: "loft", label: "Loft", hint: "Loft shutters" },
  { key: "drawer", label: "Drawers", hint: "External drawer fronts" },
];

const DEFAULT_MATERIALS: Record<Surface, string> = {
  front: "WG-101",
  secondary: "SC-202",
  carcass: "SC-202",
  loft: "WG-101",
  drawer: "WG-101",
};

export function defaultAccessories(model: WardrobeModel): string[] {
  const list = ["soft-close", ...(model.defaultAccessories ?? [])];
  if (model.decor.cornice) list.push("cornice");
  if (model.decor.plinth && !model.decor.legs) list.push("plinth");
  return [...new Set(model.doorType === "sliding" ? list.filter((a) => a !== "soft-close") : list)];
}

function defaultDoors(model: WardrobeModel, count: number): DoorOverride[] {
  return resizeDoors(model.defaultDoors ?? [], count).map((o) => {
    const door: DoorOverride = {};
    if (hasShutterStyle(o.style)) door.style = o.style;
    if (hasLaminate(o.laminate)) door.laminate = o.laminate;
    if (hasLaminate(o.secondary)) door.secondary = o.secondary;
    return door;
  });
}

export function createDesign(modelId = "three-door", name = "My Wardrobe"): Design {
  const model = getModel(modelId);
  return {
    name,
    modelId: model.id,
    dims: {
      width: model.defaults.width,
      height: model.defaults.height,
      depth: model.defaults.depth,
      loftHeight: model.defaults.loftHeight,
    },
    shutterCount: model.defaults.shutterCount,
    shutterStyle: model.defaultShutterStyle,
    materials: { ...DEFAULT_MATERIALS, ...model.defaultMaterials },
    doors: defaultDoors(model, model.defaults.shutterCount),
    loftDoors: [],
    drawerFronts: [],
    handle: model.defaultHandle
      ? { ...model.defaultHandle }
      : { style: model.doorType === "sliding" ? "profile" : "bar-long", finish: "black" },
    accessories: defaultAccessories(model),
  };
}

/**
 * Switch model. Curated models (with their own default materials) bring their
 * signature look; plain templates keep the user's current materials and handle.
 */
export function switchModel(design: Design, modelId: string): Design {
  const model = getModel(modelId);
  const fresh = createDesign(model.id, design.name);
  const curated = Boolean(model.defaultMaterials);
  // Drop decor and the previous model's built-in extras; keep what the user added.
  const decorIds = new Set(["cornice", "plinth", ...(getModel(design.modelId).defaultAccessories ?? [])]);
  return {
    ...fresh,
    materials: curated ? fresh.materials : { ...design.materials },
    handle: curated && model.defaultHandle ? fresh.handle : { ...design.handle },
    accessories: [
      ...new Set([...design.accessories.filter((a) => !decorIds.has(a)), ...fresh.accessories]),
    ].filter((a) => !(model.doorType === "sliding" && a === "soft-close")),
  };
}

export function resizeDoors(doors: DoorOverride[], count: number): DoorOverride[] {
  return Array.from({ length: count }, (_, i) => ({ ...(doors[i] ?? {}) }));
}

export interface ResolvedDoor {
  style: string;
  laminate: string;
  secondary: string;
  overridden: boolean;
}

export function resolveDoor(design: Design, i: number): ResolvedDoor {
  const o = design.doors[i] ?? {};
  return {
    style: o.style ?? design.shutterStyle,
    laminate: o.laminate ?? design.materials.front,
    secondary: o.secondary ?? design.materials.secondary,
    overridden: Boolean(o.style || o.laminate || o.secondary),
  };
}

/** Default loft shutter style derived from the main style (some styles don't suit short panels). */
export function loftStyleFor(style: string): string {
  if (style === "arch" || style === "raised-panel") return "shaker";
  if (style === "mirror" || style === "mirror-arch" || style === "two-tone") return "plain";
  return style;
}

export function drawerStyleFor(design: Design, model = getModel(design.modelId)): string {
  return model.drawers?.style ?? (["fluted", "framed", "shaker"].includes(design.shutterStyle) ? design.shutterStyle : "plain");
}

export const PART_LABEL: Record<Part, string> = { door: "Shutter", loft: "Loft shutter", drawer: "Drawer" };

export const panelKey = (part: Part, index: number) => `${part}:${index}` as PanelKey;

export function parsePanelKey(key: string): { part: Part; index: number } | null {
  const m = /^(door|loft|drawer):(\d+)$/.exec(key);
  return m ? { part: m[1] as Part, index: Number(m[2]) } : null;
}

export function panelName(key: string): string {
  const k = parsePanelKey(key);
  return k ? `${PART_LABEL[k.part]} ${k.index + 1}` : key;
}

/** Short badge text drawn on the preview: 1, L1, D1. */
export function panelBadge(key: string): string {
  const k = parsePanelKey(key);
  if (!k) return "";
  return `${k.part === "door" ? "" : k.part === "loft" ? "L" : "D"}${k.index + 1}`;
}

export function overridesFor(design: Design, part: Part): DoorOverride[] {
  return part === "door" ? design.doors : part === "loft" ? design.loftDoors : design.drawerFronts;
}

/** Resolve any panel's effective style and laminates. */
export function resolvePanel(design: Design, key: string): ResolvedDoor {
  const k = parsePanelKey(key);
  if (!k || k.part === "door") return resolveDoor(design, k?.index ?? 0);
  const o = overridesFor(design, k.part)[k.index] ?? {};
  const loft = k.part === "loft";
  return {
    style: o.style ?? (loft ? loftStyleFor(design.shutterStyle) : drawerStyleFor(design)),
    laminate: o.laminate ?? (loft ? design.materials.loft : design.materials.drawer),
    secondary: o.secondary ?? design.materials.secondary,
    overridden: Boolean(o.style || o.laminate || o.secondary),
  };
}

/** Keys of every selectable panel in the design's current layout. */
export function allPanelKeys(design: Design): string[] {
  const L = computeLayout(design);
  return [
    ...L.doors.map((d) => panelKey("door", d.index)),
    ...(L.loft?.doors ?? []).map((d) => panelKey("loft", d.index)),
    ...L.drawers.map((_, i) => panelKey("drawer", i)),
  ];
}

export function hasLoft(design: Design, model = getModel(design.modelId)): boolean {
  return model.loft !== "none" && design.dims.loftHeight > 0;
}

const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, n));

function num(v: unknown, fallback: number, range: readonly [number, number]): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(clamp(n, range)) : fallback;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Turn any untrusted value into a valid Design. Unknown ids fall back to
 * defaults; `issues` lists everything that had to be repaired.
 */
export function sanitizeDesign(raw: unknown): { design: Design; issues: string[] } {
  const issues: string[] = [];
  if (!isObj(raw)) {
    return { design: createDesign(), issues: ["Design data was missing or not an object."] };
  }
  const modelId = hasModel(raw.modelId) ? raw.modelId : "three-door";
  if (modelId !== raw.modelId) issues.push(`Unknown wardrobe model "${String(raw.modelId)}" – using default.`);
  const model = getModel(modelId);
  const base = createDesign(modelId);

  const d = isObj(raw.dims) ? raw.dims : {};
  const dims = {
    width: num(d.width, base.dims.width, ABSOLUTE_LIMITS.width),
    height: num(d.height, base.dims.height, ABSOLUTE_LIMITS.height),
    depth: num(d.depth, base.dims.depth, ABSOLUTE_LIMITS.depth),
    loftHeight: model.loft === "none" ? 0 : num(d.loftHeight, base.dims.loftHeight, ABSOLUTE_LIMITS.loftHeight),
  };
  if (!isObj(raw.dims)) issues.push("Dimensions were missing – defaults applied.");

  const shutterCount = num(raw.shutterCount, base.shutterCount, model.limits.shutterCount);

  const mats = isObj(raw.materials) ? raw.materials : {};
  const materials = { ...base.materials };
  for (const key of Object.keys(materials) as Surface[]) {
    if (hasLaminate(mats[key])) materials[key] = mats[key] as string;
    else if (mats[key] !== undefined) issues.push(`Unknown laminate "${String(mats[key])}" on ${key} – replaced.`);
  }

  const overrides = (v: unknown, count: number): DoorOverride[] => {
    const arr = Array.isArray(v) ? v : [];
    return Array.from({ length: count }, (_, i) => {
      const o = isObj(arr[i]) ? arr[i] : {};
      const door: DoorOverride = {};
      if (hasShutterStyle(o.style)) door.style = o.style;
      if (hasLaminate(o.laminate)) door.laminate = o.laminate;
      if (hasLaminate(o.secondary)) door.secondary = o.secondary;
      return door;
    });
  };
  const doors = overrides(raw.doors, shutterCount);
  const loftDoors = overrides(raw.loftDoors, Math.min(Array.isArray(raw.loftDoors) ? raw.loftDoors.length : 0, 12));
  const drawerFronts = overrides(raw.drawerFronts, Math.min(Array.isArray(raw.drawerFronts) ? raw.drawerFronts.length : 0, 24));

  const h = isObj(raw.handle) ? raw.handle : {};
  const handle = {
    style: hasHandleStyle(h.style) ? h.style : base.handle.style,
    finish: hasHandleFinish(h.finish) ? h.finish : base.handle.finish,
  };

  const accessories = Array.isArray(raw.accessories)
    ? [...new Set(raw.accessories.filter(hasAccessory))]
    : base.accessories;

  const shutterStyle = hasShutterStyle(raw.shutterStyle) ? raw.shutterStyle : base.shutterStyle;
  if (raw.shutterStyle !== undefined && shutterStyle !== raw.shutterStyle)
    issues.push(`Unknown shutter style "${String(raw.shutterStyle)}" – replaced.`);

  const name =
    typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 80) : base.name;

  return {
    design: { name, modelId, dims, shutterCount, shutterStyle, materials, doors, loftDoors, drawerFronts, handle, accessories },
    issues,
  };
}
