import { useEffect, useRef, useState, type ReactNode } from "react";
import { accessories, getModel, handleStyles, laminates, shutterStyles } from "../data/catalog";
import { WardrobeSVG } from "../engine/WardrobeSVG";
import { whatsappLink } from "../engine/export";
import { defaultPricingSettings } from "../engine/quote";
import type { PricingGeneral, PricingSettings, SavedDesign } from "../state/types";
import { Icon } from "./Icons";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={wide ? "modal wide" : "modal"} role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function SavedDesignsModal(props: {
  designs: SavedDesign[];
  currentId: string | null;
  storageOk: boolean;
  onClose: () => void;
  onLoad: (s: SavedDesign) => void;
  onDuplicate: (s: SavedDesign) => void;
  onDelete: (s: SavedDesign) => void;
  onSaveNew: () => void;
}) {
  const sorted = [...props.designs].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return (
    <Modal title="My saved designs" onClose={props.onClose} wide>
      <p className="note">
        <Icon name="info" size={14} /> Designs are saved in <strong>this browser on this device</strong> only. They are not synchronised across devices and are lost if you clear browser data — use <em>Export JSON</em> to keep a backup or move a design to another device.
      </p>
      {!props.storageOk && <p className="adv adv-error">Browser storage is unavailable (private mode or blocked), so designs cannot be saved here. You can still export JSON files.</p>}
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={props.onSaveNew} disabled={!props.storageOk}>
          <Icon name="plus" size={16} /> Save current as new
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="empty">No saved designs yet.</p>
      ) : (
        <ul className="saved-list">
          {sorted.map((s) => (
            <li key={s.id} className={s.id === props.currentId ? "current" : ""}>
              <WardrobeSVG design={s.design} bare className="saved-thumb" />
              <div className="saved-info">
                <strong>{s.design.name}</strong>
                <small>
                  {getModel(s.design.modelId).name} · {s.design.dims.width}×{s.design.dims.height} mm
                </small>
                <small>Saved {new Date(s.savedAt).toLocaleString()}</small>
                {s.id === props.currentId && <em className="badge">open</em>}
              </div>
              <div className="saved-actions">
                <button className="btn btn-sm" onClick={() => props.onLoad(s)}>
                  Load
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => props.onDuplicate(s)} disabled={!props.storageOk} title="Duplicate">
                  <Icon name="copy" size={15} />
                  <span className="sr-only">Duplicate</span>
                </button>
                <button
                  className="btn btn-ghost btn-sm danger"
                  onClick={() => window.confirm(`Delete “${s.design.name}”? This cannot be undone.`) && props.onDelete(s)}
                  title="Delete"
                >
                  <Icon name="trash" size={15} />
                  <span className="sr-only">Delete</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

const GENERAL_FIELDS: { key: keyof PricingGeneral; label: string; suffix: string }[] = [
  { key: "constructionPerSqft", label: "Wardrobe construction", suffix: "/ sq.ft of front" },
  { key: "loftPerSqft", label: "Loft construction", suffix: "/ sq.ft" },
  { key: "drawerEach", label: "External drawer", suffix: "each" },
  { key: "laminateWastagePct", label: "Laminate wastage", suffix: "%" },
  { key: "installationPerSqft", label: "Installation", suffix: "/ sq.ft" },
  { key: "otherCharges", label: "Other charges", suffix: "flat" },
  { key: "discountPct", label: "Discount", suffix: "%" },
  { key: "gstPct", label: "GST / tax", suffix: "%" },
];

function NumberCell({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [text, setText] = useState(String(value));
  const [base, setBase] = useState(value);
  if (base !== value) {
    setBase(value);
    setText(String(value));
  }
  const invalid = text.trim() === "" || !Number.isFinite(Number(text)) || Number(text) < 0;
  return (
    <input
      className={invalid ? "num invalid" : "num"}
      inputMode="decimal"
      aria-label={label}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= 0) onChange(n);
      }}
    />
  );
}

export function PricingModal({ pricing, onChange, onClose }: { pricing: PricingSettings; onChange: (p: PricingSettings) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"general" | "laminates" | "shutters" | "handles" | "accessories">("general");
  const c = pricing.general.currency;
  const setMap = (key: "laminates" | "shutters" | "handles" | "accessories", id: string, n: number) =>
    onChange({ ...pricing, [key]: { ...pricing[key], [id]: n } });

  const table = (key: "laminates" | "shutters" | "handles" | "accessories", rows: { id: string; name: string; unit: string }[]) => (
    <table className="price-table">
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.name}</td>
            <td>
              <span className="input-unit">
                <em>{c}</em>
                <NumberCell value={pricing[key][r.id] ?? 0} onChange={(n) => setMap(key, r.id, n)} label={`${r.name} price`} />
              </span>
            </td>
            <td className="unit">{r.unit}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <Modal title="Quotation price settings" onClose={onClose} wide>
      <p className="note">
        <Icon name="info" size={14} /> These are sample rates for an indicative estimate. Changes are saved in this browser automatically.
      </p>
      <div className="segmented wrap">
        {(["general", "laminates", "shutters", "handles", "accessories"] as const).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "general" && (
        <table className="price-table">
          <tbody>
            <tr>
              <td>Currency symbol</td>
              <td>
                <input className="num" value={c} maxLength={4} onChange={(e) => onChange({ ...pricing, general: { ...pricing.general, currency: e.target.value } })} aria-label="Currency symbol" />
              </td>
              <td />
            </tr>
            {GENERAL_FIELDS.map((f) => (
              <tr key={f.key}>
                <td>{f.key === "otherCharges" ? pricing.general.otherChargesLabel || f.label : f.label}</td>
                <td>
                  <span className="input-unit">
                    {!f.suffix.includes("%") && <em>{c}</em>}
                    <NumberCell value={pricing.general[f.key] as number} onChange={(n) => onChange({ ...pricing, general: { ...pricing.general, [f.key]: n } })} label={f.label} />
                  </span>
                </td>
                <td className="unit">{f.suffix}</td>
              </tr>
            ))}
            <tr>
              <td>Other charges label</td>
              <td colSpan={2}>
                <input className="text" value={pricing.general.otherChargesLabel} maxLength={40} onChange={(e) => onChange({ ...pricing, general: { ...pricing.general, otherChargesLabel: e.target.value } })} aria-label="Other charges label" />
              </td>
            </tr>
          </tbody>
        </table>
      )}
      {tab === "laminates" && table("laminates", laminates.map((l) => ({ id: l.code, name: `${l.name} (${l.code})`, unit: "/ sq.ft" })))}
      {tab === "shutters" && table("shutters", shutterStyles.map((s) => ({ id: s.id, name: s.name, unit: "/ sq.ft extra" })))}
      {tab === "handles" && table("handles", handleStyles.map((h) => ({ id: h.id, name: h.name, unit: "each (gold ×1.25)" })))}
      {tab === "accessories" &&
        table(
          "accessories",
          accessories.map((a) => ({ id: a.id, name: a.name, unit: a.unit === "each" ? "each" : a.unit === "perShutter" ? "per shutter" : "per metre width" })),
        )}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={() => window.confirm("Reset all prices to the sample values?") && onChange(defaultPricingSettings())}>
          <Icon name="reset" size={16} /> Reset to sample prices
        </button>
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

export function ShareModal({ message, number, onNumber, onClose }: { message: string; number: string; onNumber: (n: string) => void; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const digits = number.replace(/\D/g, "");
  const valid = digits === "" || (digits.length >= 10 && digits.length <= 15);
  return (
    <Modal title="Share on WhatsApp" onClose={onClose}>
      <label className="field">
        <span>WhatsApp number (optional)</span>
        <input value={number} onChange={(e) => onNumber(e.target.value)} placeholder="e.g. 919876543210" inputMode="tel" />
        <small className={valid ? "range" : "error"}>
          {valid ? "Include the country code, digits only. Leave empty to choose a contact in WhatsApp." : "Enter 10–15 digits including the country code."}
        </small>
      </label>
      <label className="field">
        <span>Message</span>
        <textarea readOnly value={message} rows={12} />
      </label>
      <div className="modal-actions">
        <button
          className="btn btn-ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(message);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={16} /> {copied ? "Copied" : "Copy text"}
        </button>
        <a className={valid ? "btn btn-whatsapp" : "btn btn-whatsapp disabled"} href={valid ? whatsappLink(digits, message) : undefined} target="_blank" rel="noopener noreferrer" aria-disabled={!valid}>
          <Icon name="whatsapp" size={16} /> Open WhatsApp
        </a>
      </div>
    </Modal>
  );
}
