// Undo/redo history for the working design.
import { useCallback, useReducer } from "react";
import type { Design } from "./types";

const LIMIT = 60;

interface Entry {
  design: Design;
  label: string;
}

interface State {
  past: Entry[];
  present: Design;
  presentLabel: string;
  future: Entry[];
}

type Action =
  | { type: "apply"; design: Design; label: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "replace"; design: Design };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "apply":
      if (JSON.stringify(a.design) === JSON.stringify(s.present)) return s;
      return {
        past: [...s.past, { design: s.present, label: s.presentLabel }].slice(-LIMIT),
        present: a.design,
        presentLabel: a.label,
        future: [],
      };
    case "undo": {
      const prev = s.past[s.past.length - 1];
      if (!prev) return s;
      return {
        past: s.past.slice(0, -1),
        present: prev.design,
        presentLabel: prev.label,
        future: [{ design: s.present, label: s.presentLabel }, ...s.future],
      };
    }
    case "redo": {
      const next = s.future[0];
      if (!next) return s;
      return {
        past: [...s.past, { design: s.present, label: s.presentLabel }],
        present: next.design,
        presentLabel: next.label,
        future: s.future.slice(1),
      };
    }
    case "replace":
      // Edit the current entry without adding an undo step (e.g. typing a name).
      return { ...s, present: a.design };
  }
}

export function useHistory(initial: () => Design) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    past: [],
    present: initial(),
    presentLabel: "",
    future: [],
  }));
  const apply = useCallback((design: Design, label: string) => dispatch({ type: "apply", design, label }), []);
  const replace = useCallback((design: Design) => dispatch({ type: "replace", design }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  return {
    design: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    undoLabel: state.presentLabel,
    redoLabel: state.future[0]?.label ?? "",
    apply,
    replace,
    undo,
    redo,
  };
}
