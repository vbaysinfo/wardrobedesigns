import { useMemo, useState } from "react";
import {
  accessories,
  colorCombos,
  getLaminate,
  getModel,
  handleFinishes,
  handleStyles,
  laminateCategories,
  laminateFinishes,
  laminates,
  modelCategories,
  models,
  shutterStyles,
} from "../data/catalog";
import { WardrobeSVG } from "../engine/WardrobeSVG";
import { getThumbnail } from "../engine/textures";
import { applyCombo, applyLaminate, applyShutterStyle, toggleAccessory } from "../state/actions";
import { hasLoft, resolveDoor, SURFACES, switchModel } from "../state/design";
import type { Design, Surface } from "../state/types";
import { Icon, type IconName } from "./Icons";
import { HandleThumb, ShutterThumb } from "./Thumbs";

type Tab = "model" | "shutter" | "laminate" | "handle" | "extras" | "combos";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "model", label: "Model", icon: "wardrobe" },
  { id: "shutter", label: "Shutters", icon: "shutter" },
  { id: "laminate", label: "Laminates", icon: "layers" },
  { id: "handle", label: "Handles", icon: "handle" },
  { id: "extras", label: "Extras", icon: "sparkle" },
  { id: "combos", label: "Combos", icon: "palette" },
];

interface Props {
  design: Design;
  selected: number[];
  onApply: (d: Design, label: string) => void;
  onClearSelection: () => void;
}

function ScopeBanner({ selected, onClear, note }: { selected: number[]; onClear: () => void; note?: string }) {
  if (!selected.length)
    return (
      <p className="scope">
        Applying to <strong>all shutters</strong>. Click a shutter in the preview to customise it individually.
      </p>
    );
  return (
    <p className="scope scope-active">
      Applying to <strong>shutter {selected.map((i) => i + 1).join(", ")}</strong>
      {note ? <> · {note}</> : null}
      <button className="link" onClick={onClear}>
        Apply to all
      </button>
    </p>
  );
}

export function LeftPanel({ design, selected, onApply, onClearSelection }: Props) {
  const [tab, setTab] = useState<Tab>("model");
  const model = getModel(design.modelId);

  return (
    <aside className="panel panel-left" aria-label="Design options">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "tab active" : "tab"} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={17} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      <div className="panel-body">
        {tab === "model" && <ModelTab design={design} onApply={onApply} />}
        {tab === "shutter" && <ShutterTab design={design} selected={selected} onApply={onApply} onClear={onClearSelection} />}
        {tab === "laminate" && <LaminateTab design={design} selected={selected} onApply={onApply} onClear={onClearSelection} />}
        {tab === "handle" && <HandleTab design={design} onApply={onApply} />}
        {tab === "extras" && (
          <section>
            <h3 className="section-title">Accessories</h3>
            <p className="hint">Items marked “visible” appear in the preview; others are added to the estimate.</p>
            <ul className="check-list">
              {accessories
                .filter((a) => !(a.hingedOnly && model.doorType === "sliding"))
                .map((a) => (
                  <li key={a.id}>
                    <label className="check">
                      <input type="checkbox" checked={design.accessories.includes(a.id)} onChange={() => onApply(toggleAccessory(design, a.id), `${design.accessories.includes(a.id) ? "Remove" : "Add"} ${a.name}`)} />
                      <span>
                        <strong>{a.name}</strong>
                        {a.visual && <em className="badge">visible</em>}
                        <small>{a.description}</small>
                      </span>
                    </label>
                  </li>
                ))}
            </ul>
          </section>
        )}
        {tab === "combos" && (
          <section>
            <h3 className="section-title">Colour combinations</h3>
            <p className="hint">Curated laminate pairings. Applying one resets individual shutter overrides.</p>
            <div className="combo-grid">
              {colorCombos.map((c) => (
                <button key={c.id} className="combo" onClick={() => onApply(applyCombo(design, c.id), `Combo: ${c.name}`)}>
                  <span className="combo-swatches">
                    {[c.front, c.secondary, c.carcass].map((code, i) => (
                      <span key={i} style={{ backgroundImage: `url(${getThumbnail(getLaminate(code))})` }} />
                    ))}
                  </span>
                  <strong>{c.name}</strong>
                  <small>
                    {getLaminate(c.front).name} · {getLaminate(c.secondary).name}
                  </small>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}

function ModelTab({ design, onApply }: { design: Design; onApply: Props["onApply"] }) {
  const [category, setCategory] = useState("All");
  // Plain templates are previewed with the user's current materials; curated ones show their own look.
  const previews = useMemo(
    () => models.map((m) => ({ m, d: switchModel(design, m.id) })),
    [design.materials, design.handle, design.accessories],
  );
  const current = getModel(design.modelId);
  const groups = (category === "All" ? modelCategories : [category]).map((c) => ({
    category: c,
    items: previews.filter(({ m }) => m.category === c),
  }));
  return (
    <section>
      <h3 className="section-title">Wardrobe type</h3>
      <div className="chips">
        {["All", ...modelCategories].map((c) => (
          <button key={c} className={category === c ? "chip active" : "chip"} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <p className="scope">
        <strong>{current.name}</strong> · {current.description}
      </p>
      {groups.map((g) => (
        <div key={g.category} className="model-group">
          {category === "All" && <h4 className="group-title">{g.category}</h4>}
          <div className="model-grid">
            {g.items.map(({ m, d }) => (
              <button
                key={m.id}
                className={m.id === design.modelId ? "model-card active" : "model-card"}
                onClick={() => m.id !== design.modelId && onApply(switchModel(design, m.id), `Model: ${m.name}`)}
                aria-pressed={m.id === design.modelId}
                title={m.description}
              >
                <WardrobeSVG design={d} bare className="model-thumb" />
                <strong>{m.name}</strong>
                <small>
                  {m.defaults.width} × {m.defaults.height + m.defaults.loftHeight} mm
                </small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function ShutterTab({ design, selected, onApply, onClear }: { design: Design; selected: number[]; onApply: Props["onApply"]; onClear: () => void }) {
  const current = selected.length === 1 ? resolveDoor(design, selected[0]).style : selected.length ? null : design.shutterStyle;
  const front = getLaminate(design.materials.front).color;
  const accent = getLaminate(design.materials.secondary).color;
  return (
    <section>
      <h3 className="section-title">Shutter style</h3>
      <ScopeBanner selected={selected} onClear={onClear} />
      <div className="card-grid">
        {shutterStyles.map((s) => (
          <button
            key={s.id}
            className={current === s.id ? "opt-card active" : "opt-card"}
            onClick={() => onApply(applyShutterStyle(design, selected, s.id), `Shutter style: ${s.name}`)}
            title={s.description}
          >
            <ShutterThumb style={s.id} color={front} accent={accent} />
            <strong>{s.name}</strong>
          </button>
        ))}
      </div>
      <p className="hint">Two-colour shutters use the <em>Accent</em> laminate for the upper panel. Loft and drawer fronts follow the main style where it suits them.</p>
    </section>
  );
}

function LaminateTab({ design, selected, onApply, onClear }: { design: Design; selected: number[]; onApply: Props["onApply"]; onClear: () => void }) {
  const model = getModel(design.modelId);
  const [surface, setSurface] = useState<Surface>("front");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [finish, setFinish] = useState("All");

  const surfaces = SURFACES.filter((s) => {
    if (s.key === "loft") return hasLoft(design, model);
    if (s.key === "drawer") return Boolean(model.drawers);
    return true;
  });
  const activeSurface = surfaces.some((s) => s.key === surface) ? surface : "front";
  const perDoor = selected.length > 0 && (activeSurface === "front" || activeSurface === "secondary");

  let current: string | null = design.materials[activeSurface];
  if (perDoor) {
    const codes = new Set(selected.map((i) => (activeSurface === "front" ? resolveDoor(design, i).laminate : resolveDoor(design, i).secondary)));
    current = codes.size === 1 ? [...codes][0] : null;
  }

  const q = query.trim().toLowerCase();
  const list = laminates.filter(
    (l) =>
      (category === "All" || l.category === category) &&
      (finish === "All" || l.finish === finish) &&
      (!q || l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q) || l.category.toLowerCase().includes(q)),
  );

  return (
    <section>
      <h3 className="section-title">Laminate catalogue</h3>
      <div className="segmented" role="radiogroup" aria-label="Surface">
        {surfaces.map((s) => (
          <button key={s.key} role="radio" aria-checked={activeSurface === s.key} className={activeSurface === s.key ? "active" : ""} onClick={() => setSurface(s.key)} title={s.hint}>
            {s.label}
          </button>
        ))}
      </div>
      {activeSurface === "front" || activeSurface === "secondary" ? (
        <ScopeBanner selected={selected} onClear={onClear} />
      ) : (
        <p className="scope">{surfaces.find((s) => s.key === activeSurface)?.hint}.</p>
      )}
      <label className="search">
        <Icon name="search" size={16} />
        <input type="search" placeholder="Search name or code…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search laminates" />
      </label>
      <div className="chips">
        {["All", ...laminateCategories].map((c) => (
          <button key={c} className={category === c ? "chip active" : "chip"} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="chips">
        {["All", ...laminateFinishes].map((f) => (
          <button key={f} className={finish === f ? "chip chip-sm active" : "chip chip-sm"} onClick={() => setFinish(f)}>
            {f === "All" ? "Any finish" : f}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="empty">No laminates match your search.</p>
      ) : (
        <div className="swatch-grid">
          {list.map((l) => (
            <button
              key={l.code}
              className={current === l.code ? "swatch active" : "swatch"}
              onClick={() => onApply(applyLaminate(design, selected, activeSurface, l.code), `${SURFACES.find((s) => s.key === activeSurface)?.label}: ${l.name}`)}
              title={`${l.name} · ${l.code} · ${l.finish}`}
            >
              <span className={`swatch-img finish-${l.finish.toLowerCase().replace(/\s+/g, "-")}`} style={{ backgroundImage: `url(${getThumbnail(l)})` }} />
              <strong>{l.name}</strong>
              <small>
                {l.code} · {l.finish}
              </small>
              <small className="price">₹{l.pricePerSqft}/sq.ft</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function HandleTab({ design, onApply }: { design: Design; onApply: Props["onApply"] }) {
  const finish = handleFinishes.find((f) => f.id === design.handle.finish) ?? handleFinishes[0];
  return (
    <section>
      <h3 className="section-title">Handle style</h3>
      <div className="card-grid">
        {handleStyles.map((h) => (
          <button
            key={h.id}
            className={design.handle.style === h.id ? "opt-card active" : "opt-card"}
            onClick={() => onApply({ ...design, handle: { ...design.handle, style: h.id } }, `Handle: ${h.name}`)}
            title={h.description}
          >
            <HandleThumb style={h.id} finish={finish} />
            <strong>{h.name}</strong>
          </button>
        ))}
      </div>
      <h3 className="section-title">Finish</h3>
      <div className="finish-row">
        {handleFinishes.map((f) => (
          <button
            key={f.id}
            className={design.handle.finish === f.id ? "finish active" : "finish"}
            onClick={() => onApply({ ...design, handle: { ...design.handle, finish: f.id } }, `Handle finish: ${f.name}`)}
            disabled={design.handle.style === "none"}
          >
            <span style={{ background: `linear-gradient(135deg, ${f.colors[0]}, ${f.colors[1]} 55%, ${f.colors[2]})` }} />
            {f.name}
          </button>
        ))}
      </div>
      <p className="hint">Handles are placed on the opening edge of each shutter at a consistent height. Glass shutters use the finish for their aluminium profile.</p>
    </section>
  );
}
