// Typed access to the local JSON catalogue. To add models, laminates, handles or
// accessories, edit the JSON files in this folder – no code changes are needed.
import modelsJson from "./models.json";
import laminatesJson from "./laminates.json";
import shutterStylesJson from "./shutterStyles.json";
import handlesJson from "./handles.json";
import accessoriesJson from "./accessories.json";
import combosJson from "./colorCombos.json";
import pricingJson from "./pricing.json";
import type {
  Accessory,
  ColorCombo,
  HandleFinish,
  HandleStyle,
  Laminate,
  PricingGeneral,
  ShutterStyle,
  WardrobeModel,
} from "../state/types";

export const models = modelsJson as WardrobeModel[];
export const laminates = laminatesJson as Laminate[];
export const shutterStyles = shutterStylesJson as ShutterStyle[];
export const handleStyles = handlesJson.styles as HandleStyle[];
export const handleFinishes = handlesJson.finishes as HandleFinish[];
export const accessories = accessoriesJson as Accessory[];
export const colorCombos = combosJson as ColorCombo[];
export const defaultPricing = pricingJson as PricingGeneral;

const byKey = <T,>(list: T[], key: (t: T) => string) => new Map(list.map((t) => [key(t), t]));

const modelMap = byKey(models, (m) => m.id);
const laminateMap = byKey(laminates, (l) => l.code);
const styleMap = byKey(shutterStyles, (s) => s.id);
const handleStyleMap = byKey(handleStyles, (h) => h.id);
const handleFinishMap = byKey(handleFinishes, (h) => h.id);
const accessoryMap = byKey(accessories, (a) => a.id);

export const getModel = (id: string) => modelMap.get(id) ?? models[0];
export const getLaminate = (code: string) => laminateMap.get(code) ?? laminates[0];
export const getShutterStyle = (id: string) => styleMap.get(id) ?? shutterStyles[0];
export const getHandleStyle = (id: string) => handleStyleMap.get(id) ?? handleStyles[0];
export const getHandleFinish = (id: string) => handleFinishMap.get(id) ?? handleFinishes[0];
export const getAccessory = (id: string) => accessoryMap.get(id);

export const hasModel = (id: unknown): id is string => typeof id === "string" && modelMap.has(id);
export const hasLaminate = (c: unknown): c is string => typeof c === "string" && laminateMap.has(c);
export const hasShutterStyle = (id: unknown): id is string => typeof id === "string" && styleMap.has(id);
export const hasHandleStyle = (id: unknown): id is string => typeof id === "string" && handleStyleMap.has(id);
export const hasHandleFinish = (id: unknown): id is string => typeof id === "string" && handleFinishMap.has(id);
export const hasAccessory = (id: unknown): id is string => typeof id === "string" && accessoryMap.has(id);

export const modelCategories = [...new Set(models.map((m) => m.category))];
export const laminateCategories = [...new Set(laminates.map((l) => l.category))];
export const laminateFinishes = [...new Set(laminates.map((l) => l.finish))];

/** Absolute input limits (mm) regardless of model; model limits are narrower. */
export const ABSOLUTE_LIMITS = {
  width: [300, 6000],
  height: [600, 3600],
  depth: [250, 1000],
  loftHeight: [0, 1200],
} as const;
