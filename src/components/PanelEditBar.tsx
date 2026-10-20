// Floating editor shown on the 2D drawing for the selected panels (shutters,
// loft shutters or drawer fronts): laminate, accent and style, applied only to
// the selection.
import { useState } from "react";
import { getLaminate, laminates, shutterStyles } from "../data/catalog";
import { getThumbnail } from "../engine/textures";
import { applyLaminate, applyShutterStyle, resetPanels } from "../state/actions";
import { PART_LABEL, panelName, parsePanelKey, resolvePanel } from "../state/design";
import type { Design, Part } from "../state/types";
import { Icon } from "./Icons";

interface Props {
  design: Design;
  selected: string[];
  panelKeys: string[];
  onApply: (d: Design, label: string) => void;
  onSelect: (keys: string[]) => void;
}

const only = <T,>(values: T[]) => (new Set(values).size === 1 ? values[0] : null);

export function PanelEditBar({ design, selected, panelKeys, onApply, onSelect }: Props) {
  const [target, setTarget] = useState<"laminate" | "secondary">("laminate");
  const resolved = selected.map((k) => resolvePanel(design, k));
  const currentLam = only(resolved.map((r) => (target === "laminate" ? r.laminate : r.secondary)));
  const currentStyle = only(resolved.map((r) => r.style));
  const anyOverride = resolved.some((r) => r.overridden);
  const parts = [...new Set(selected.map((k) => parsePanelKey(k)?.part).filter(Boolean))] as Part[];
  const title = selected.length === 1 ? panelName(selected[0]) : `${selected.length} panels selected`;
  const showAccent = resolved.some((r) => r.style === "two-tone");
  const groups = (["door", "loft", "drawer"] as Part[]).filter((part) => panelKeys.some((k) => k.startsWith(part + ":")));

  return (
    <div className="edit-bar" role="dialog" aria-label={`Edit ${title}`} onClick={(e) => e.stopPropagation()}>
      <div className="edit-bar-head">
        <div>
          <strong>{title}</strong>
          <span className="edit-bar-sub">{selected.length > 1 ? selected.map(panelName).join(", ") : getLaminate(resolved[0].laminate).name}</span>
        </div>
        <button className="icon-btn" onClick={() => onSelect([])} aria-label="Close editor" title="Done (Esc)">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="edit-bar-row">
        <div className="mini-seg">
          <button className={target === "laminate" ? "active" : ""} onClick={() => setTarget("laminate")}>
            Laminate
          </button>
          {showAccent && (
            <button className={target === "secondary" ? "active" : ""} onClick={() => setTarget("secondary")}>
              Accent
            </button>
          )}
        </div>
        <select
          value={currentStyle ?? ""}
          onChange={(e) => onApply(applyShutterStyle(design, selected, e.target.value), `${title}: style`)}
          aria-label="Panel style"
        >
          {!currentStyle && <option value="">Mixed styles</option>}
          {shutterStyles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="edit-swatches" role="listbox" aria-label="Laminates">
        {laminates.map((l) => (
          <button
            key={l.code}
            role="option"
            aria-selected={currentLam === l.code}
            className={currentLam === l.code ? "active" : ""}
            title={`${l.name} · ${l.code} · ${l.finish}`}
            style={{ backgroundImage: `url(${getThumbnail(l)})` }}
            onClick={() => onApply(applyLaminate(design, selected, target === "laminate" ? "front" : "secondary", l.code), `${title}: ${l.name}`)}
          />
        ))}
      </div>

      <div className="edit-bar-actions">
        <span>Select:</span>
        {groups.map((part) => (
          <button key={part} className="chip chip-sm" onClick={() => onSelect(panelKeys.filter((k) => k.startsWith(part + ":")))}>
            All {PART_LABEL[part].toLowerCase()}s
          </button>
        ))}
        {anyOverride && (
          <button className="chip chip-sm" onClick={() => onApply(resetPanels(design, selected), `Reset ${title}`)} title="Back to the overall design">
            <Icon name="reset" size={12} /> Reset
          </button>
        )}
        {parts.length > 0 && <span className="edit-bar-hint">Shift-click to add panels</span>}
      </div>
    </div>
  );
}
