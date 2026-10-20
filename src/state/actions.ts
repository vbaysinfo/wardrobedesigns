// Pure design edits. `selected` holds shutter indices; when it is empty an edit
// applies to every shutter (and clears per-shutter overrides for that property).
import { colorCombos, getAccessory, getModel } from "../data/catalog";
import { resizeDoors } from "./design";
import type { Design, Dimensions, DoorOverride, Surface } from "./types";

type DoorKey = keyof DoorOverride;

function setDoorProp(design: Design, selected: number[], key: DoorKey, value: string, globalValue: string): Design {
  const doors = design.doors.map((o, i) => {
    if (!selected.includes(i)) return o;
    const next = { ...o };
    if (value === globalValue) delete next[key];
    else next[key] = value;
    return next;
  });
  return { ...design, doors };
}

function clearDoorProp(doors: DoorOverride[], key: DoorKey) {
  return doors.map((o) => {
    const next = { ...o };
    delete next[key];
    return next;
  });
}

export function applyShutterStyle(design: Design, selected: number[], style: string): Design {
  if (selected.length) return setDoorProp(design, selected, "style", style, design.shutterStyle);
  return { ...design, shutterStyle: style, doors: clearDoorProp(design.doors, "style") };
}

export function applyLaminate(design: Design, selected: number[], surface: Surface, code: string): Design {
  if (selected.length && (surface === "front" || surface === "secondary")) {
    const key = surface === "front" ? "laminate" : "secondary";
    return setDoorProp(design, selected, key, code, design.materials[surface]);
  }
  const materials = { ...design.materials, [surface]: code };
  let doors = design.doors;
  if (surface === "front") doors = clearDoorProp(doors, "laminate");
  if (surface === "secondary") doors = clearDoorProp(doors, "secondary");
  return { ...design, materials, doors };
}

export function resetDoor(design: Design, index: number): Design {
  return { ...design, doors: design.doors.map((o, i) => (i === index ? {} : o)) };
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
  };
}
