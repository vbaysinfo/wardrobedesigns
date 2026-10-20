import { useState } from "react";
import { getLaminate, getModel, getShutterStyle } from "../data/catalog";
import { designSummaryLines } from "../engine/export";
import { formatMoney, type Quote } from "../engine/quote";
import { getThumbnail } from "../engine/textures";
import { getAdvisories, validateDimensionInput } from "../engine/validate";
import { resetDoor, setDimension, setShutterCount } from "../state/actions";
import { hasLoft, resolveDoor } from "../state/design";
import type { Design, Dimensions } from "../state/types";
import { Icon } from "./Icons";

interface Props {
  design: Design;
  selected: number[];
  quote: Quote;
  currency: string;
  onApply: (d: Design, label: string) => void;
  onSelect: (index: number, additive: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onOpenPricing: () => void;
}

function DimInput({ design, field, label, onApply }: { design: Design; field: keyof Dimensions; label: string; onApply: Props["onApply"] }) {
  const model = getModel(design.modelId);
  const value = String(design.dims[field]);
  const [draft, setDraft] = useState<{ base: string; text: string } | null>(null);
  // Discard the draft when the committed value changes (undo, load, model switch).
  const text = draft && draft.base === value ? draft.text : value;
  const error = draft && draft.base === value ? validateDimensionInput(field, text) : null;
  const [lo, hi] = model.limits[field];

  const commit = () => {
    if (!draft || draft.base !== value) return;
    if (!validateDimensionInput(field, draft.text)) {
      const n = Math.round(Number(draft.text));
      if (n !== design.dims[field]) onApply(setDimension(design, field, n), `${label}: ${n} mm`);
      setDraft(null);
    }
  };

  return (
    <label className={error ? "field has-error" : "field"}>
      <span>{label}</span>
      <span className="input-unit">
        <input
          inputMode="numeric"
          value={text}
          onChange={(e) => setDraft({ base: value, text: e.target.value })}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setDraft(null);
          }}
          aria-invalid={Boolean(error)}
        />
        <em>mm</em>
      </span>
      <small className={error ? "error" : "range"}>{error ?? `Template range ${lo}–${hi}`}</small>
    </label>
  );
}

export function RightPanel(props: Props) {
  const { design, selected, quote, currency, onApply } = props;
  const model = getModel(design.modelId);
  const advisories = getAdvisories(design);
  const [cMin, cMax] = model.limits.shutterCount;
  const loft = hasLoft(design, model);

  return (
    <aside className="panel panel-right" aria-label="Configuration">
      <div className="panel-body">
        <section className="card">
          <h3 className="section-title">Dimensions</h3>
          <div className="dim-grid">
            <DimInput design={design} field="width" label="Width" onApply={onApply} />
            <DimInput design={design} field="height" label={loft ? "Height (excl. loft)" : "Height"} onApply={onApply} />
            <DimInput design={design} field="depth" label="Depth" onApply={onApply} />
            {model.loft !== "none" && (loft ? (
              <DimInput design={design} field="loftHeight" label="Loft height" onApply={onApply} />
            ) : null)}
          </div>
          {model.loft === "optional" && (
            <label className="check inline">
              <input
                type="checkbox"
                checked={loft}
                onChange={() => onApply(setDimension(design, "loftHeight", loft ? 0 : 600), loft ? "Remove loft" : "Add loft")}
              />
              <span>Add loft above wardrobe</span>
            </label>
          )}
          <div className="field">
            <span>{model.doorType === "sliding" ? "Sliding panels" : "Number of shutters"}</span>
            <div className="stepper">
              <button onClick={() => onApply(setShutterCount(design, design.shutterCount - 1), "Fewer shutters")} disabled={design.shutterCount <= cMin} aria-label="Fewer shutters">
                <Icon name="minus" size={16} />
              </button>
              <output>{design.shutterCount}</output>
              <button onClick={() => onApply(setShutterCount(design, design.shutterCount + 1), "More shutters")} disabled={design.shutterCount >= cMax} aria-label="More shutters">
                <Icon name="plus" size={16} />
              </button>
            </div>
            <small className="range">{cMin === cMax ? `Fixed at ${cMin} for this model` : `${cMin}–${cMax} for this model`}</small>
          </div>
          {advisories.length > 0 && (
            <ul className="advisories">
              {advisories.map((a, i) => (
                <li key={i} className={`adv adv-${a.level}`}>
                  <Icon name={a.level === "info" ? "info" : "alert"} size={15} />
                  <span>{a.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="note">
            <Icon name="info" size={14} /> The preview is a proportional visual estimate, not an engineering-accurate manufacturing drawing.
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <h3 className="section-title">Shutters</h3>
            <span className="head-actions">
              <button className="link" onClick={props.onSelectAll}>Select all</button>
              {selected.length > 0 && <button className="link" onClick={props.onClearSelection}>Clear</button>}
            </span>
          </div>
          <ul className="door-list">
            {design.doors.map((_, i) => {
              const r = resolveDoor(design, i);
              const lam = getLaminate(r.laminate);
              return (
                <li key={i} className={selected.includes(i) ? "selected" : ""}>
                  <button className="door-row" onClick={(e) => props.onSelect(i, e.shiftKey || e.metaKey || e.ctrlKey)} aria-pressed={selected.includes(i)}>
                    <span className="door-num">{i + 1}</span>
                    <span className="mini-swatch" style={{ backgroundImage: `url(${getThumbnail(lam)})` }} />
                    <span className="door-text">
                      <strong>{getShutterStyle(r.style).name}</strong>
                      <small>
                        {lam.name}
                        {r.style === "two-tone" ? ` + ${getLaminate(r.secondary).name}` : ""}
                      </small>
                    </span>
                    {r.overridden && <em className="badge">custom</em>}
                  </button>
                  {r.overridden && (
                    <button className="icon-btn" title="Reset this shutter to the overall design" onClick={() => onApply(resetDoor(design, i), `Reset shutter ${i + 1}`)}>
                      <Icon name="reset" size={15} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="hint">Tip: click shutters in the preview (Shift/Ctrl-click for several), then pick a style or laminate.</p>
        </section>

        <section className="card">
          <h3 className="section-title">Design summary</h3>
          <dl className="summary">
            {designSummaryLines(design).map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card quote">
          <div className="card-head">
            <h3 className="section-title">Estimated quotation</h3>
            <button className="btn btn-ghost btn-sm" onClick={props.onOpenPricing}>
              <Icon name="settings" size={15} /> Prices
            </button>
          </div>
          <table className="quote-table">
            <tbody>
              {quote.lines.map((l) => (
                <tr key={l.label}>
                  <td>
                    {l.label}
                    <small>{l.detail}</small>
                  </td>
                  <td>{formatMoney(l.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Subtotal</td>
                <td>{formatMoney(quote.subtotal, currency)}</td>
              </tr>
              {quote.discount > 0 && (
                <tr>
                  <td>Discount</td>
                  <td>−{formatMoney(quote.discount, currency)}</td>
                </tr>
              )}
              <tr>
                <td>GST</td>
                <td>{formatMoney(quote.gst, currency)}</td>
              </tr>
              <tr className="total">
                <td>Indicative total</td>
                <td>{formatMoney(quote.total, currency)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="disclaimer">
            This is an indicative estimate from sample rates you can edit. Areas are based on the visual layout, not a cutting list. Verify measurements, materials and pricing before manufacturing.
          </p>
        </section>
      </div>
    </aside>
  );
}
