// Pure design edits. `selected` holds panel keys ("door:0", "loft:1", "drawer:2");
// when it is empty an edit applies design-wide and clears per-panel overrides
// for that property.
import { colorCombos, getAccessory, getModel } from "../data/catalog";
import { overridesFor, parsePanelKey, resizeDoors, resolvePanel } from "./design";
import type { Design, Dimensions, DoorOverride, Part, Surface } from "./types";

type DoorKey = keyof DoorOverride;
const LIST: Record<Part, "doors" | "loftDoors" | "drawerFronts"> = { door: "doors", loft: "loftDoors", drawer: "drawerFronts" };

/** Set one override property on each selected panel (dropping it when it equals the panel's default). */
function setPanelProp(design: Design, selected: string[], key: DoorKey, value: string): Design {
  const next: Design = { ...design, doors: [...design.doors], loftDoors: [...design.loftDoors], drawerFronts: [...design.drawerFronts] };
  for (const sel of selected) {
    const k = parsePanelKey(sel);
    if (!k) continue;
    const list = next[LIST[k.part]];
    const o: DoorOverride = { ...(list[k.index] ?? {}) };
    delete o[key];
    list[k.index] = o;
    // Compare against what the panel shows without this override.
    const fallback = resolvePanel({ ...next }, sel);
    const base = key === "style" ? fallback.style : key === "laminate" ? fallback.laminate : fallback.secondary;
    if (value !== base) o[key] = value;
    for (let i = 0; i < k.index; i++) list[i] ??= {};
  }
  return next;
}

function clearProp(doors: DoorOverride[], key: DoorKey) {
  return doors.map((o) => {
    const next = { ...o };
    delete next[key];
    return next;
  });
}

export function applyShutterStyle(design: Design, selected: string[], style: string): Design {
  if (selected.length) return setPanelProp(design, selected, "style", style);
  return {
    ...design,
    shutterStyle: style,
    doors: clearProp(design.doors, "style"),
    loftDoors: clearProp(design.loftDoors, "style"),
    drawerFronts: clearProp(design.drawerFronts, "style"),
  };
}

export function applyLaminate(design: Design, selected: string[], surface: Surface, code: string): Design {
  if (selected.length && surface !== "carcass") {
    return setPanelProp(design, selected, surface === "secondary" ? "secondary" : "laminate", code);
  }
  const materials = { ...design.materials, [surface]: code };
  const next = { ...design, materials };
  if (surface === "front") next.doors = clearProp(design.doors, "laminate");
  if (surface === "loft") next.loftDoors = clearProp(design.loftDoors, "laminate");
  if (surface === "drawer") next.drawerFronts = clearProp(design.drawerFronts, "laminate");
  if (surface === "secondary") {
    next.doors = clearProp(design.doors, "secondary");
    next.loftDoors = clearProp(design.loftDoors, "secondary");
    next.drawerFronts = clearProp(design.drawerFronts, "secondary");
  }
  return next;
}

export function resetPanels(design: Design, keys: string[]): Design {
  const next: Design = { ...design, doors: [...design.doors], loftDoors: [...design.loftDoors], drawerFronts: [...design.drawerFronts] };
  for (const key of keys) {
    const k = parsePanelKey(key);
    if (k && overridesFor(next, k.part)[k.index]) next[LIST[k.part]][k.index] = {};
  }
  return next;
}

export function setDimension(design: Design, field: keyof Dimensions, value: number): Design {
  return { ...design, dims: { ...design.dims, [field]: value } };
}

export function setShutterCount(design: Design, count: number): Design {
  const [lo, hi] = getModel(design.modelId).limits.shutterCount;
  const n = Math.max(lo, Math.min(hi, Math.round(count)));
  return { ...design, shutterCount: n, doors: resizeDoors(design.doors, n) };
}

export function toggleAccessory(design: Design, id: string): Design {
  if (!getAccessory(id)) return design;
  const has = design.accessories.includes(id);
  return { ...design, accessories: has ? design.accessories.filter((a) => a !== id) : [...design.accessories, id] };
}

export function applyCombo(design: Design, comboId: string): Design {
  const c = colorCombos.find((x) => x.id === comboId);
  if (!c) return design;
  return {
    ...design,
    materials: { front: c.front, secondary: c.secondary, carcass: c.carcass, loft: c.loft, drawer: c.drawer },
    shutterStyle: c.shutterStyle ?? design.shutterStyle,
    handle: {
      style: c.handleStyle ?? design.handle.style,
      finish: c.handleFinish ?? design.handle.finish,
    },
    doors: design.doors.map(() => ({})),
    loftDoors: [],
    drawerFronts: [],
  };
}
