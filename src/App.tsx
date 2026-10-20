import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getModel } from "./data/catalog";
import { downloadPNG, exportJSON, parseImport, whatsappMessage } from "./engine/export";
import { computeQuote } from "./engine/quote";
import { Icon } from "./components/Icons";
import { LeftPanel } from "./components/LeftPanel";
import { Modal, PricingModal, SavedDesignsModal, ShareModal } from "./components/Modals";
import { Preview } from "./components/Preview";
import { PrintSummary } from "./components/PrintSummary";
import { RightPanel } from "./components/RightPanel";
import { createDesign } from "./state/design";
import {
  loadCurrentDesign,
  loadPrefs,
  loadPricing,
  loadSavedDesigns,
  newId,
  persistCurrentDesign,
  persistPrefs,
  persistPricing,
  persistSavedDesigns,
  storageAvailable,
  type Prefs,
} from "./state/storage";
import type { Design, PricingSettings, SavedDesign } from "./state/types";
import { useHistory } from "./state/useHistory";

interface Toast {
  id: number;
  text: string;
  kind: "ok" | "warn" | "error";
}

type ModalKind = "saved" | "pricing" | "share" | "about" | null;

const initialSaved = loadSavedDesigns();

export default function App() {
  const storageOk = useMemo(storageAvailable, []);
  const history = useHistory(() => loadCurrentDesign() ?? createDesign());
  const { design, apply } = history;
  const [before, setBefore] = useState<Design>(design);
  const [selected, setSelected] = useState<number[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [pricing, setPricing] = useState<PricingSettings>(loadPricing);
  const [saved, setSaved] = useState<SavedDesign[]>(initialSaved.designs);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const toast = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "ok" ? 3200 : 6000);
  }, []);

  useEffect(() => {
    if (!storageOk) toast("Browser storage is unavailable – designs and settings will not be remembered. Use Export JSON to keep your work.", "warn");
    initialSaved.warnings.forEach((w) => toast(w, "warn"));
  }, [storageOk, toast]);

  // Autosave the working design and settings.
  useEffect(() => {
    const t = setTimeout(() => persistCurrentDesign(design), 300);
    return () => clearTimeout(t);
  }, [design]);
  useEffect(() => void persistPrefs(prefs), [prefs]);
  useEffect(() => void persistPricing(pricing), [pricing]);

  // Drop selections that no longer exist (shutter count changed / undo).
  const validSelected = useMemo(() => selected.filter((i) => i < design.shutterCount), [selected, design.shutterCount]);

  const onDoorClick = useCallback((i: number, additive: boolean) => {
    setSelected((s) => {
      if (additive) return s.includes(i) ? s.filter((x) => x !== i) : [...s, i].sort((a, b) => a - b);
      return s.length === 1 && s[0] === i ? [] : [i];
    });
  }, []);

  const startFresh = (d: Design, id: string | null, label: string) => {
    apply(d, label);
    setBefore(d);
    setSelected([]);
    setCurrentId(id);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        history.redo();
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") setSelected([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const quote = useMemo(() => computeQuote(design, pricing), [design, pricing]);
  const currency = pricing.general.currency || "₹";

  // ---- save / load ---------------------------------------------------------
  const writeSaved = (list: SavedDesign[]) => {
    setSaved(list);
    if (!persistSavedDesigns(list)) {
      toast("Could not write to browser storage (it may be full or blocked). Export JSON to keep a copy.", "error");
      return false;
    }
    return true;
  };

  function save() {
    if (!storageOk) return toast("Browser storage is unavailable – use Export JSON instead.", "error");
    const now = new Date().toISOString();
    const existing = currentId ? saved.find((s) => s.id === currentId) : undefined;
    if (existing) {
      if (writeSaved(saved.map((s) => (s.id === existing.id ? { ...s, savedAt: now, design } : s)))) toast(`Saved “${design.name}”`);
    } else {
      const entry = { id: newId(), savedAt: now, design };
      if (writeSaved([...saved, entry])) {
        setCurrentId(entry.id);
        toast(`Saved “${design.name}” to this browser`);
      }
    }
  }

  const saveAsNew = () => {
    const entry = { id: newId(), savedAt: new Date().toISOString(), design };
    if (writeSaved([...saved, entry])) {
      setCurrentId(entry.id);
      toast(`Saved “${design.name}” as a new design`);
    }
  };

  const duplicate = (s: SavedDesign) => {
    const copy = { id: newId(), savedAt: new Date().toISOString(), design: { ...s.design, name: `${s.design.name} (copy)`.slice(0, 80) } };
    if (writeSaved([...saved, copy])) toast(`Duplicated “${s.design.name}”`);
  };

  const remove = (s: SavedDesign) => {
    if (writeSaved(saved.filter((x) => x.id !== s.id))) {
      if (currentId === s.id) setCurrentId(null);
      toast(`Deleted “${s.design.name}”`);
    }
  };

  // ---- export / import -----------------------------------------------------
  const caption = () => {
    const m = getModel(design.modelId);
    return `${m.name} · ${design.dims.width} × ${design.dims.height} × ${design.dims.depth} mm`;
  };

  const doPNG = async () => {
    setMenuOpen(false);
    if (!svgRef.current) return;
    try {
      await downloadPNG(svgRef.current, design, caption());
      toast("Preview downloaded as PNG");
    } catch (e) {
      toast(e instanceof Error ? e.message : "PNG export failed", "error");
    }
  };

  const onImportFile = async (file: File) => {
    try {
      if (file.size > 1_000_000) throw new Error("That file is too large to be a design export.");
      const res = parseImport(await file.text());
      startFresh(res.design, null, `Import ${res.design.name}`);
      if (res.pricing && window.confirm("This file also contains quotation prices. Replace your current price settings with them?")) {
        persistPricing(res.pricing as PricingSettings);
        setPricing(loadPricing());
      }
      toast(`Imported “${res.design.name}”`);
      res.issues.forEach((i) => toast(i, "warn"));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed", "error");
    }
  };

  const doPrint = () => {
    setMenuOpen(false);
    setTimeout(() => window.print(), 50);
  };

  const shareText = useMemo(() => whatsappMessage(design, quote, currency), [design, quote, currency]);

  const exportItems = [
    { icon: "image" as const, label: "Download PNG", run: doPNG },
    { icon: "json" as const, label: "Export JSON", run: () => (setMenuOpen(false), exportJSON(design, pricing), toast("Design exported as JSON")) },
    { icon: "upload" as const, label: "Import JSON", run: () => (setMenuOpen(false), fileRef.current?.click()) },
    { icon: "print" as const, label: "Print summary / PDF", run: doPrint },
    { icon: "whatsapp" as const, label: "Share on WhatsApp", run: () => (setMenuOpen(false), setModal("share")) },
  ];

  return (
    <>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Icon name="wardrobe" size={20} />
            </span>
            <span>
              <strong>Wardrobe Studio</strong>
              <small>Laminate &amp; Design Visualizer</small>
            </span>
          </div>
          <label className="name-field">
            <span className="sr-only">Design name</span>
            <input
              value={design.name}
              maxLength={80}
              onChange={(e) => history.replace({ ...design, name: e.target.value })}
              onBlur={(e) => !e.target.value.trim() && history.replace({ ...design, name: "Untitled design" })}
              placeholder="Design name"
              aria-label="Design name"
            />
          </label>
          <nav className="actions" aria-label="Design actions">
            <button className="icon-btn" onClick={history.undo} disabled={!history.canUndo} title={history.canUndo ? `Undo: ${history.undoLabel}` : "Undo"} aria-label="Undo">
              <Icon name="undo" />
            </button>
            <button className="icon-btn" onClick={history.redo} disabled={!history.canRedo} title={history.canRedo ? `Redo: ${history.redoLabel}` : "Redo"} aria-label="Redo">
              <Icon name="redo" />
            </button>
            <button
              className="icon-btn"
              title="Reset to default design"
              aria-label="Reset to default design"
              onClick={() => {
                if (window.confirm("Reset to the default design for this model? You can undo this.")) {
                  apply(createDesign(design.modelId, design.name), "Reset design");
                  setSelected([]);
                }
              }}
            >
              <Icon name="reset" />
            </button>
            <span className="divider" />
            <button className="btn btn-primary" onClick={save} title="Save to this browser (Ctrl+S)">
              <Icon name="save" size={16} />
              <span className="label">Save</span>
            </button>
            <button className="btn" onClick={() => setModal("saved")}>
              <Icon name="folder" size={16} />
              <span className="label">My designs</span>
              {saved.length > 0 && <em className="count">{saved.length}</em>}
            </button>
            <div className="menu-wrap">
              <button className="btn" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-haspopup="menu">
                <Icon name="download" size={16} />
                <span className="label">Export &amp; share</span>
              </button>
              {menuOpen && (
                <>
                  <div className="menu-scrim" onClick={() => setMenuOpen(false)} />
                  <div className="menu" role="menu">
                    {exportItems.map((it) => (
                      <button key={it.label} role="menuitem" onClick={it.run}>
                        <Icon name={it.icon} size={16} /> {it.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button className="icon-btn" onClick={() => setModal("about")} title="About & help" aria-label="About and help">
              <Icon name="info" />
            </button>
          </nav>
        </header>

        <main className="workspace">
          <Preview
            design={design}
            before={before}
            selected={validSelected}
            onDoorClick={onDoorClick}
            onBackgroundClick={() => setSelected([])}
            angle={prefs.angle}
            onAngle={(angle) => setPrefs((p) => ({ ...p, angle }))}
            showDims={prefs.showDims}
            onToggleDims={() => setPrefs((p) => ({ ...p, showDims: !p.showDims }))}
            onSetBefore={() => {
              setBefore(design);
              toast("Current design set as “before”");
            }}
            svgRef={svgRef}
          />
          <LeftPanel design={design} selected={validSelected} onApply={apply} onClearSelection={() => setSelected([])} />
          <RightPanel
            design={design}
            selected={validSelected}
            quote={quote}
            currency={currency}
            onApply={apply}
            onSelect={onDoorClick}
            onSelectAll={() => setSelected(design.doors.map((_, i) => i))}
            onClearSelection={() => setSelected([])}
            onOpenPricing={() => setModal("pricing")}
          />
        </main>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportFile(f);
          e.target.value = "";
        }}
      />

      {modal === "saved" && (
        <SavedDesignsModal
          designs={saved}
          currentId={currentId}
          storageOk={storageOk}
          onClose={() => setModal(null)}
          onLoad={(s) => {
            startFresh(s.design, s.id, `Load ${s.design.name}`);
            setModal(null);
            toast(`Loaded “${s.design.name}”`);
          }}
          onDuplicate={duplicate}
          onDelete={remove}
          onSaveNew={saveAsNew}
        />
      )}
      {modal === "pricing" && <PricingModal pricing={pricing} onChange={setPricing} onClose={() => setModal(null)} />}
      {modal === "share" && (
        <ShareModal message={shareText} number={prefs.whatsappNumber} onNumber={(n) => setPrefs((p) => ({ ...p, whatsappNumber: n.replace(/[^\d+ ]/g, "").slice(0, 18) }))} onClose={() => setModal(null)} />
      )}
      {modal === "about" && (
        <Modal title="About Wardrobe Studio" onClose={() => setModal(null)}>
          <div className="prose">
            <p>Design a wardrobe by choosing a model, shutter style, laminates and handles. Every change appears instantly in the preview.</p>
            <ul>
              <li><strong>Individual shutters:</strong> click a shutter in the preview (Shift/Ctrl-click for several), then choose a style or laminate.</li>
              <li><strong>Shortcuts:</strong> Ctrl+Z undo, Ctrl+Shift+Z / Ctrl+Y redo, Ctrl+S save, Esc clears the selection, Ctrl+scroll zooms.</li>
              <li><strong>Before / after:</strong> the comparison starts from the design you opened; use “Set current as before” to change it.</li>
            </ul>
            <p><strong>Your data stays on this device.</strong> Designs, prices and preferences are stored in this browser’s local storage. They are not uploaded or synchronised to other devices; export JSON files to back up or transfer designs.</p>
            <p><strong>Estimates only.</strong> Previews are proportional visual estimates, not manufacturing drawings, and quotations use editable sample rates. Verify everything before manufacturing.</p>
          </div>
        </Modal>
      )}

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>

      <PrintSummary design={design} quote={quote} currency={currency} />
    </>
  );
}
