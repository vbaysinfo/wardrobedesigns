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
import type { Design, DoorOverride, Surface, WardrobeModel } from "./types";

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
  const list = ["soft-close"];
  if (model.decor.cornice) list.push("cornice");
  if (model.decor.plinth) list.push("plinth");
  return model.doorType === "sliding" ? list.filter((a) => a !== "soft-close") : list;
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
    materials: { ...DEFAULT_MATERIALS },
    doors: Array.from({ length: model.defaults.shutterCount }, () => ({})),
    handle: { style: model.doorType === "sliding" ? "profile" : "bar-long", finish: "black" },
    accessories: defaultAccessories(model),
  };
}

/** Switch model, keeping materials/handles but adopting the model's dimensions. */
export function switchModel(design: Design, modelId: string): Design {
  const model = getModel(modelId);
  const fresh = createDesign(model.id, design.name);
  return {
    ...fresh,
    materials: { ...design.materials },
    handle: { ...design.handle },
    accessories: [
      ...new Set([
        ...design.accessories.filter((a) => a !== "cornice" && a !== "plinth"),
        ...defaultAccessories(model).filter((a) => a !== "soft-close"),
      ]),
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

  const rawDoors = Array.isArray(raw.doors) ? raw.doors : [];
  const doors = resizeDoors([], shutterCount).map((_, i) => {
    const o = isObj(rawDoors[i]) ? rawDoors[i] : {};
    const door: DoorOverride = {};
    if (hasShutterStyle(o.style)) door.style = o.style;
    if (hasLaminate(o.laminate)) door.laminate = o.laminate;
    if (hasLaminate(o.secondary)) door.secondary = o.secondary;
    return door;
  });

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
    design: { name, modelId, dims, shutterCount, shutterStyle, materials, doors, handle, accessories },
    issues,
  };
}
