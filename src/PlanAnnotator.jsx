// Interactive plan annotator.
//  - Multiple greening rectangles, windows, doors.  Multi-select via
//    Ctrl/Cmd or Shift; quick per-item delete via the × button that appears
//    when an item is hovered/selected in Auswählen-mode.
//  - Click-and-hold pan in Verschieben-mode (also middle-mouse pan in any
//    mode).  Ctrl + Mausrad zoomt (an Mausposition); ohne Strg scrollt das
//    Mausrad ganz normal.
//  - SVG getScreenCTM keeps coordinates correct under any scale/zoom.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeAnnotations, nid, pointInRect, selKey, unionBBox, pxPerMeter } from "./planUtils";

const R = "#C8102E", BK = "#1A1A1A", DK = "#333", GY = "#666", GL = "#999";
const BG = "#F7F6F4", BD = "#D8D6D4", WH = "#FFF";

// Marker colours (intuitive: greening=green, glass=blue, door=brown/orange)
const COL_FACADE = "#2E7D32";   // green for Begrünung
const COL_WINDOW = "#1565C0";   // blue for Fenster
const COL_DOOR   = "#8B5A2B";   // brown for Tür (was orange — wood-like reads better here)
const COL_SCALE  = "#7C0A1D";   // dark red for scale calibration line

const MODE_LABELS = {
  pan:    "Verschieben",
  select: "Auswählen",
  facade: "Begrünungsfläche",
  window: "Fenster",
  door:   "Tür",
  scale:  "Maßstab",
};
const MODE_HINTS = {
  pan:    "Klicken + halten, um den Plan zu verschieben. Strg + Mausrad zoomt.",
  select: "Klicken wählt aus. Strg/Shift-Klick = Mehrfachauswahl. × löscht einzeln, Mittelmaus pannt jederzeit.",
  facade: "Rechtecke um jede zu begrünende Wandfläche ziehen. Mehrere sind erlaubt.",
  window: "Rechtecke um Fenster ziehen. Anker und Bewuchs sparen diese aus.",
  door:   "Rechtecke um Türen ziehen. Anker und Bewuchs sparen diese aus.",
  scale:  "Strecke ziehen, deren tatsächliche Länge du kennst (z.B. eine Bemaßung im Plan). Danach Länge in Metern eingeben.",
};
const MODE_COLORS = {
  facade: COL_FACADE,
  window: COL_WINDOW,
  door:   COL_DOOR,
  scale:  COL_SCALE,
};

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 12;

function rectFromDrag(a, b) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

export default function PlanAnnotator({ plan, annotations, onChange, height = 480, facadeWidthM = 0, facadeHeightM = 0 }) {
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const rootRef = useRef(null);                // for hover-scoped shortcuts
  const [mode, setMode] = useState("facade");
  const [drag, setDrag] = useState(null);
  const [pan, setPan] = useState(null);       // {scrollX, scrollY, clientX, clientY}
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [hover, setHover] = useState(null);   // {kind, id}
  const [containerW, setContainerW] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState(false);   // mouse is over this annotator
  const [scaleDraft, setScaleDraft] = useState(null); // {p1,p2} awaiting meters input
  const [scaleInput, setScaleInput] = useState("");   // text in the meters textbox

  // ── Undo / redo stacks (track annotations only) ──
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  const ann = useMemo(() => normalizeAnnotations(annotations), [annotations]);

  // ── Resolve scale (pxPerM) — explicit calibration first, then fallback. ──
  const bbox = useMemo(() => unionBBox(ann.facades), [ann.facades]);
  const pxPerM = useMemo(() => pxPerMeter(ann, bbox, facadeWidthM, facadeHeightM),
    [ann, bbox, facadeWidthM, facadeHeightM]);
  const scaleSource = ann.scale ? "calibrated" : (pxPerM ? "derived" : "none");

  const fmtM = useCallback((px, dec = 1) => {
    if (!pxPerM || pxPerM <= 0 || !Number.isFinite(px)) return "";
    return (px / pxPerM).toFixed(dec).replace(".", ",") + " m";
  }, [pxPerM]);

  // commit() = push the current state to history, then forward to parent.
  // Use this for any USER edit.  Direct onChange (without history push) is
  // reserved for undo / redo so they don't pollute the stack.
  const commit = useCallback((next) => {
    setPast(p => {
      const last = p[p.length - 1];
      // dedupe consecutive identical snapshots so multi-edits in one frame
      // don't bloat history
      if (last && JSON.stringify(last) === JSON.stringify(ann)) return p;
      return [...p.slice(-49), ann];
    });
    setFuture([]);
    onChange(next);
  }, [ann, onChange]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [ann, ...f.slice(0, 49)]);
    onChange(prev);
    setSelectedKeys(new Set());
  }, [past, ann, onChange]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(f => f.slice(1));
    setPast(p => [...p, ann]);
    onChange(next);
    setSelectedKeys(new Set());
  }, [future, ann, onChange]);

  useEffect(() => {
    if (annotations && !Array.isArray(annotations.facades)) {
      onChange(ann);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fitScale = useMemo(() => {
    if (!plan) return 1;
    const sx = (containerW - 12) / plan.w;
    const sy = height / plan.h;
    return Math.max(0.05, Math.min(sx, sy));
  }, [plan, containerW, height]);
  const dispW = plan ? plan.w * fitScale * zoom : containerW;
  const dispH = plan ? plan.h * fitScale * zoom : height;

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setContainerW(w);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // After marking the first facade, auto-jump to "window" mode
  const autoJumpedRef = useRef(false);
  useEffect(() => {
    if (!autoJumpedRef.current && ann.facades.length === 1 && mode === "facade") {
      autoJumpedRef.current = true;
      const t = setTimeout(() => setMode("window"), 250);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ann.facades.length]);

  useEffect(() => { setSelectedKeys(new Set()); setHover(null); }, [mode]);

  // ── Pointer → plan-pixel coords via SVG CTM ──
  const pt = useCallback((e) => {
    const svg = svgRef.current;
    if (!svg || !svg.getScreenCTM) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const out = p.matrixTransform(ctm.inverse());
    return {
      x: Math.max(0, Math.min(plan?.w || 0, out.x)),
      y: Math.max(0, Math.min(plan?.h || 0, out.y)),
    };
  }, [plan]);

  // ── Hit test with slack (smaller items prioritized) ──
  const hitTest = useCallback((p) => {
    const eff = fitScale * zoom;
    const slack = Math.max(2, 8 / eff);
    for (const w of ann.windows) if (pointInRect(p, w, slack)) return { kind: "window", id: w.id };
    for (const d of ann.doors)   if (pointInRect(p, d, slack)) return { kind: "door",   id: d.id };
    for (const f of ann.facades) if (pointInRect(p, f, slack)) return { kind: "facade", id: f.id };
    return null;
  }, [ann, fitScale, zoom]);

  // ── Pan logic ──
  const startPan = (e) => {
    const cont = wrapRef.current;
    if (!cont) return;
    setPan({
      scrollX: cont.scrollLeft, scrollY: cont.scrollTop,
      clientX: e.clientX, clientY: e.clientY,
    });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const movePan = (e) => {
    if (!pan) return;
    const cont = wrapRef.current;
    if (!cont) return;
    cont.scrollLeft = pan.scrollX - (e.clientX - pan.clientX);
    cont.scrollTop  = pan.scrollY - (e.clientY - pan.clientY);
  };
  const endPan = (e) => {
    if (e) try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    setPan(null);
  };

  // ── Pointer event dispatcher ──
  const onDown = (e) => {
    if (!plan) return;
    // Middle mouse = always pan, regardless of mode
    if (e.button === 1 || mode === "pan") {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    const p = pt(e);
    if (mode === "select") {
      const hit = hitTest(p);
      const multi = e.shiftKey || e.ctrlKey || e.metaKey;
      setSelectedKeys(prev => {
        if (!hit) return multi ? prev : new Set();
        const k = selKey(hit);
        const next = new Set(multi ? prev : []);
        if (next.has(k)) next.delete(k); else next.add(k);
        return next;
      });
      return;
    }
    setDrag({ a: p, b: p });
  };
  const onMove = (e) => {
    if (pan) { movePan(e); return; }
    if (drag) { setDrag(d => ({ ...d, b: pt(e) })); return; }
    if (mode === "select") {
      const h = hitTest(pt(e));
      setHover(h);
    }
  };
  const onUp = (e) => {
    if (pan) { endPan(e); return; }
    if (e) { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }
    if (!drag) return;
    const dStart = drag.a, dEnd = drag.b;
    setDrag(null);
    // Scale-mode: drag defines a measurement line, then prompt for meters.
    if (mode === "scale") {
      const linePx = Math.hypot(dEnd.x - dStart.x, dEnd.y - dStart.y);
      if (linePx < 10) return;  // ignore tiny drags
      setScaleDraft({ p1: dStart, p2: dEnd });
      // suggest a starting value if a scale was already in place
      setScaleInput(ann.scale && ann.scale.m ? String(ann.scale.m) : "");
      return;
    }
    const r = rectFromDrag(dStart, dEnd);
    if (r.w < 8 || r.h < 8) return;
    const next = { ...ann };
    if (mode === "facade") next.facades = [...ann.facades, { ...r, id: nid() }];
    else if (mode === "window") next.windows = [...ann.windows, { ...r, id: nid() }];
    else if (mode === "door")   next.doors   = [...ann.doors,   { ...r, id: nid() }];
    commit(next);
  };

  // Commit the scale calibration from the draft + user-entered meters.
  const confirmScale = useCallback(() => {
    if (!scaleDraft) return;
    const m = parseFloat(String(scaleInput).replace(",", "."));
    if (!Number.isFinite(m) || m <= 0) return;
    commit({ ...ann, scale: { p1: scaleDraft.p1, p2: scaleDraft.p2, m } });
    setScaleDraft(null);
    setScaleInput("");
  }, [scaleDraft, scaleInput, ann, commit]);
  const cancelScale = () => { setScaleDraft(null); setScaleInput(""); };
  const clearScale = () => { commit({ ...ann, scale: null }); };

  // ── Wheel zoom (Ctrl + wheel) — preserves mouse position ──
  useEffect(() => {
    const cont = wrapRef.current;
    if (!cont) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;     // plain wheel keeps default scroll
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
      if (next === zoom) return;
      const ratio = next / zoom;
      const rect = cont.getBoundingClientRect();
      const mx = e.clientX - rect.left + cont.scrollLeft;
      const my = e.clientY - rect.top  + cont.scrollTop;
      setZoom(next);
      requestAnimationFrame(() => {
        cont.scrollLeft = mx * ratio - (e.clientX - rect.left);
        cont.scrollTop  = my * ratio - (e.clientY - rect.top);
      });
    };
    cont.addEventListener("wheel", onWheel, { passive: false });
    return () => cont.removeEventListener("wheel", onWheel);
  }, [zoom]);

  // ── Delete actions (all go through history) ──
  const deleteItem = useCallback((item) => {
    if (!item) return;
    const next = { ...ann };
    if (item.kind === "facade") next.facades = ann.facades.filter(r => r.id !== item.id);
    else if (item.kind === "window") next.windows = ann.windows.filter(r => r.id !== item.id);
    else if (item.kind === "door")   next.doors   = ann.doors.filter(r => r.id !== item.id);
    commit(next);
    setSelectedKeys(prev => { const n = new Set(prev); n.delete(selKey(item)); return n; });
    if (hover && hover.kind === item.kind && hover.id === item.id) setHover(null);
  }, [ann, commit, hover]);

  const deleteSelected = useCallback(() => {
    if (selectedKeys.size === 0) return;
    const keep = (kind) => (r) => !selectedKeys.has(selKey({ kind, id: r.id }));
    commit({
      facades: ann.facades.filter(keep("facade")),
      windows: ann.windows.filter(keep("window")),
      doors:   ann.doors.filter(keep("door")),
    });
    setSelectedKeys(new Set());
  }, [ann, selectedKeys, commit]);
  const deleteAll = () => {
    commit({ facades: [], windows: [], doors: [] });
    setSelectedKeys(new Set());
  };
  const selectAllOfKind = (kind) => {
    const list = kind === "facade" ? ann.facades : kind === "window" ? ann.windows : ann.doors;
    setSelectedKeys(prev => {
      const next = new Set(prev);
      for (const r of list) next.add(selKey({ kind, id: r.id }));
      return next;
    });
  };

  // ── Zoom buttons ──
  const zoomBy = (factor) => {
    const cont = wrapRef.current;
    if (!cont) { setZoom(z => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * factor))); return; }
    const cx = cont.scrollLeft + cont.clientWidth / 2;
    const cy = cont.scrollTop + cont.clientHeight / 2;
    const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
    if (next === zoom) return;
    const ratio = next / zoom;
    setZoom(next);
    requestAnimationFrame(() => {
      cont.scrollLeft = Math.max(0, cx * ratio - cont.clientWidth / 2);
      cont.scrollTop  = Math.max(0, cy * ratio - cont.clientHeight / 2);
    });
  };
  const zoomFit = () => {
    setZoom(1);
    if (wrapRef.current) { wrapRef.current.scrollLeft = 0; wrapRef.current.scrollTop = 0; }
  };
  const zoomReal = () => { setZoom(1 / fitScale); };

  // ── Keyboard shortcuts — only when this annotator is hovered.
  // Declared AFTER all the action functions so the dep-array doesn't hit
  // the temporal dead zone for deleteSelected / zoomBy / zoomFit / zoomReal. ──
  useEffect(() => {
    if (!hovered) return;
    const handler = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }

      if (k === "delete" || k === "backspace") {
        if (selectedKeys.size > 0) { e.preventDefault(); deleteSelected(); }
        return;
      }
      if (k === "escape") {
        if (drag) setDrag(null);
        else if (selectedKeys.size > 0) setSelectedKeys(new Set());
        return;
      }
      const modeMap = { v: "select", h: "pan", f: "facade", w: "window", t: "door", s: "scale" };
      if (modeMap[k] && !mod) { e.preventDefault(); setMode(modeMap[k]); return; }
      if (k === "+" || k === "=") { e.preventDefault(); zoomBy(1.25); return; }
      if (k === "-" || k === "_") { e.preventDefault(); zoomBy(1 / 1.25); return; }
      if (k === "0") { e.preventDefault(); zoomFit(); return; }
      if (k === "1") { e.preventDefault(); zoomReal(); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, undo, redo, deleteSelected, selectedKeys.size, drag, zoom]);

  if (!plan) return null;

  const dragRect = drag ? rectFromDrag(drag.a, drag.b) : null;
  const cursor = pan ? "grabbing" : mode === "pan" ? "grab" : mode === "select" ? "default" : "crosshair";
  const pctLabel = Math.round(zoom * fitScale * 100);
  const isSelected = (kind, id) => selectedKeys.has(selKey({ kind, id }));
  const baseStroke = Math.max(1.5, plan.w / 600);

  // Pixel-scale factor for the per-item × button so it stays a fixed screen size
  const screenPxToPlanPx = 1 / (fitScale * zoom);

  // The currently focused item for the × button: hover takes precedence;
  // otherwise show × on the single selected item.
  const focusItem = (() => {
    if (mode !== "select") return null;
    if (hover) return hover;
    if (selectedKeys.size === 1) {
      const k = [...selectedKeys][0];
      const [kind, id] = k.split(":");
      return { kind, id: kind === "facade" ? id : id };
    }
    return null;
  })();
  const focusRect = (() => {
    if (!focusItem) return null;
    const list = focusItem.kind === "facade" ? ann.facades : focusItem.kind === "window" ? ann.windows : ann.doors;
    return list.find(r => r.id === focusItem.id) || null;
  })();

  return (
    <div ref={rootRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      {/* Mode toolbar */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        {Object.keys(MODE_LABELS).map(m => (
          <button key={m} onClick={() => setMode(m)}
            style={{
              padding: "6px 12px", fontSize: 11, fontWeight: mode === m ? 700 : 600,
              border: `1.5px solid ${mode === m ? R : BD}`, borderRadius: 6, cursor: "pointer",
              background: mode === m ? `${R}12` : WH, color: mode === m ? R : DK,
              display: "flex", alignItems: "center", gap: 6,
            }}>
            {m === "pan"
              ? <span style={{ fontSize: 12 }}>✋</span>
              : m === "select"
                ? <span style={{ fontSize: 12 }}>▣</span>
                : m === "scale"
                  ? <span style={{ fontSize: 12 }}>📏</span>
                  : <span style={{
                      display: "inline-block", width: 10, height: 10, borderRadius: 2,
                      background: MODE_COLORS[m] || GY, opacity: 0.7,
                    }} />}
            {MODE_LABELS[m]}
            {m === "facade" && ann.facades.length > 0 && <span style={{ fontSize: 9, color: GL }}>· {ann.facades.length}</span>}
            {m === "window" && ann.windows.length > 0 && <span style={{ fontSize: 9, color: GL }}>· {ann.windows.length}</span>}
            {m === "door"   && ann.doors.length   > 0 && <span style={{ fontSize: 9, color: GL }}>· {ann.doors.length}</span>}
            {m === "scale"  && ann.scale && <span style={{ fontSize: 11, color: COL_SCALE }}>✓</span>}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {mode === "select" && (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => selectAllOfKind("facade")} disabled={ann.facades.length === 0}
              style={miniBtn(ann.facades.length > 0)}>Alle Flächen</button>
            <button onClick={() => selectAllOfKind("window")} disabled={ann.windows.length === 0}
              style={miniBtn(ann.windows.length > 0)}>Alle Fenster</button>
            <button onClick={() => selectAllOfKind("door")} disabled={ann.doors.length === 0}
              style={miniBtn(ann.doors.length > 0)}>Alle Türen</button>
          </div>
        )}
        <button onClick={undo} disabled={past.length === 0} title="Rückgängig (Strg+Z)"
          style={miniBtnPrim(past.length > 0)}>↶ Rückgängig</button>
        <button onClick={redo} disabled={future.length === 0} title="Wiederherstellen (Strg+Y)"
          style={miniBtnPrim(future.length > 0)}>↷ Wiederholen</button>
        <button onClick={deleteSelected} disabled={selectedKeys.size === 0} title="Auswahl löschen (Entf)"
          style={{
            padding: "6px 10px", fontSize: 11, fontWeight: 700,
            border: `1px solid ${selectedKeys.size > 0 ? R : BD}`, borderRadius: 6,
            cursor: selectedKeys.size > 0 ? "pointer" : "not-allowed",
            background: selectedKeys.size > 0 ? `${R}10` : WH,
            color: selectedKeys.size > 0 ? R : GL,
          }}>
          ✕ Löschen{selectedKeys.size > 1 && ` (${selectedKeys.size})`}
        </button>
        <button onClick={deleteAll}
          style={{
            padding: "6px 10px", fontSize: 11, fontWeight: 600,
            border: `1px solid ${BD}`, borderRadius: 6, cursor: "pointer",
            background: WH, color: GY,
          }}>↺ Reset</button>
      </div>

      {/* Zoom toolbar */}
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10.5, color: GY, fontWeight: 600, marginRight: 6 }}>Zoom:</span>
        <button onClick={() => zoomBy(1 / 1.4)} title="Verkleinern" style={zoomBtnStyle}>−</button>
        <div style={{ fontSize: 11, fontWeight: 700, color: DK, width: 50, textAlign: "center" }}>{pctLabel} %</div>
        <button onClick={() => zoomBy(1.4)} title="Vergrößern" style={zoomBtnStyle}>+</button>
        <button onClick={zoomFit} title="An Fenster anpassen"
          style={{ ...zoomBtnStyle, width: "auto", padding: "4px 10px" }}>Anpassen</button>
        <button onClick={zoomReal} title="Originalgröße 1:1"
          style={{ ...zoomBtnStyle, width: "auto", padding: "4px 10px" }}>1:1</button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: GL }}>
          Strg+Mausrad = zoomen · Mittelmaus oder Verschieben-Modus = pannen
        </span>
      </div>

      {/* Hint */}
      <div style={{ fontSize: 11, color: GY, marginBottom: 8, padding: "6px 10px", background: BG, borderRadius: 5 }}>
        <strong style={{ color: DK }}>{MODE_LABELS[mode]}:</strong> {MODE_HINTS[mode]}
      </div>

      {/* Scale-status banner */}
      <div style={{
        fontSize: 11, marginBottom: 8, padding: "6px 10px", borderRadius: 5,
        background: scaleSource === "calibrated" ? "#E8F5E9" : scaleSource === "derived" ? "#FFF8E1" : "#FFEBEE",
        border: `1px solid ${scaleSource === "calibrated" ? "#2E7D3240" : scaleSource === "derived" ? "#E68A0040" : "#C8102E40"}`,
        color: scaleSource === "calibrated" ? "#1B5E20" : scaleSource === "derived" ? "#7A4A00" : "#7C0A1D",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        <span>
          {scaleSource === "calibrated" && <>📏 <strong>Maßstab kalibriert:</strong> {ann.scale.m.toString().replace(".", ",")} m = {Math.hypot(ann.scale.p2.x - ann.scale.p1.x, ann.scale.p2.y - ann.scale.p1.y).toFixed(0)} px ({pxPerM.toFixed(1)} px/m). Alle Berechnungen verwenden diesen Maßstab.</>}
          {scaleSource === "derived" && <>⚠ <strong>Maßstab nicht kalibriert.</strong> Wird aus getippter Breite × Höhe ({facadeWidthM} × {facadeHeightM} m) und Bounding-Box der Begrünungsflächen abgeleitet ({pxPerM.toFixed(1)} px/m). <em>Für genaue Materialermittlung Maßstab im Plan kalibrieren.</em></>}
          {scaleSource === "none" && <>⚠ <strong>Kein Maßstab.</strong> Maße können erst angezeigt werden, wenn entweder die Fassade getippt ist und mind. eine Begrünungsfläche markiert wurde, oder ein Maßstab kalibriert wurde.</>}
        </span>
        {ann.scale && (
          <button onClick={clearScale} style={{ ...miniBtn(true), borderColor: COL_SCALE + "40", color: COL_SCALE }}>
            Maßstab löschen
          </button>
        )}
      </div>

      {/* Scale-calibration dialog (modal-ish, anchored above the plan box) */}
      {scaleDraft && (
        <div style={{
          padding: "10px 12px", marginBottom: 8,
          background: "#FFF", border: `2px solid ${COL_SCALE}`, borderRadius: 6,
          boxShadow: "0 4px 12px rgba(0,0,0,.12)",
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: COL_SCALE }}>📏 Maßstab kalibrieren</span>
          <span style={{ fontSize: 11, color: DK }}>Tatsächliche Länge der gezogenen Strecke:</span>
          <div style={{ display: "flex", border: `1px solid ${BD}`, borderRadius: 5, background: WH }}>
            <input
              autoFocus
              value={scaleInput}
              onChange={e => setScaleInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmScale(); else if (e.key === "Escape") cancelScale(); }}
              placeholder="z. B. 10,0"
              style={{ width: 90, border: "none", padding: "6px 8px", fontSize: 13, fontWeight: 700, outline: "none", fontFamily: "inherit", color: BK }}
            />
            <span style={{ padding: "0 10px", fontSize: 11, color: GY, alignSelf: "center" }}>m</span>
          </div>
          <button onClick={confirmScale}
            style={{ padding: "7px 14px", fontSize: 11, fontWeight: 700, border: `1px solid ${COL_SCALE}`, borderRadius: 5,
              background: COL_SCALE, color: WH, cursor: "pointer" }}>Übernehmen</button>
          <button onClick={cancelScale}
            style={{ padding: "7px 12px", fontSize: 11, fontWeight: 600, border: `1px solid ${BD}`, borderRadius: 5,
              background: WH, color: GY, cursor: "pointer" }}>Abbrechen</button>
        </div>
      )}

      {/* Plan + overlay (scrollable, pannable) */}
      <div ref={wrapRef}
        style={{
          width: "100%", height: height + 40, overflow: "auto",
          background: "#2A2A2A", borderRadius: 6, padding: 6, position: "relative",
          cursor: pan ? "grabbing" : "default",
        }}>
        <div style={{
          width: dispW, height: dispH,
          margin: dispW < (wrapRef.current?.clientWidth || 0) - 12 ? "0 auto" : 0,
          position: "relative", background: WH, boxShadow: "0 1px 6px rgba(0,0,0,.20)",
        }}>
          <img src={plan.dataUrl} alt="Fassadenplan"
            draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", userSelect: "none", pointerEvents: "none" }}
          />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${plan.w} ${plan.h}`}
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor, touchAction: "none", display: "block" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => { if (!drag && !pan) setHover(null); }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {/* Facade rects */}
            {ann.facades.map((r, i) => {
              const sel = isSelected("facade", r.id);
              const dim = pxPerM ? `${fmtM(r.w)} × ${fmtM(r.h)}` : null;
              const labelFs = Math.max(11, plan.w / 80);
              return (
                <g key={r.id}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h}
                    fill={`${COL_FACADE}1F`} stroke={COL_FACADE}
                    strokeWidth={baseStroke * 1.4} strokeDasharray="10,6"
                    vectorEffect="non-scaling-stroke"
                    opacity={sel ? 1 : 0.9} />
                  {sel && (
                    <rect x={r.x - 4} y={r.y - 4} width={r.w + 8} height={r.h + 8}
                      fill="none" stroke={COL_FACADE} strokeWidth="2"
                      strokeDasharray="3,3" vectorEffect="non-scaling-stroke" />
                  )}
                  <text x={r.x + 6} y={r.y + labelFs + 2}
                    fontSize={labelFs} fill={COL_FACADE}
                    fontWeight="700" pointerEvents="none">
                    🌿 Begrünung {ann.facades.length > 1 ? i + 1 : ""}
                  </text>
                  {dim && (
                    <text x={r.x + r.w / 2} y={r.y + r.h + labelFs + 4}
                      fontSize={labelFs * 0.95} fill={COL_FACADE} fontWeight="700"
                      textAnchor="middle" pointerEvents="none">{dim}</text>
                  )}
                </g>
              );
            })}
            {/* Windows */}
            {ann.windows.map((r) => {
              const sel = isSelected("window", r.id);
              const dim = pxPerM ? `${fmtM(r.w)} × ${fmtM(r.h)}` : null;
              const fs = Math.max(9, plan.w / 100);
              return (
                <g key={r.id}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h}
                    fill={`${COL_WINDOW}33`} stroke={COL_WINDOW}
                    strokeWidth={baseStroke} vectorEffect="non-scaling-stroke"
                    opacity={sel ? 1 : 0.9} />
                  {sel && (
                    <rect x={r.x - 4} y={r.y - 4} width={r.w + 8} height={r.h + 8}
                      fill="none" stroke={COL_WINDOW} strokeWidth="2"
                      strokeDasharray="3,3" vectorEffect="non-scaling-stroke" />
                  )}
                  <text x={r.x + 4} y={r.y + fs + 2} fontSize={fs}
                    fill={COL_WINDOW} fontWeight="700" pointerEvents="none">F</text>
                  {dim && r.w > 60 && (
                    <text x={r.x + r.w / 2} y={r.y + r.h - 3} fontSize={fs * 0.92}
                      fill={COL_WINDOW} fontWeight="600" textAnchor="middle" pointerEvents="none">{dim}</text>
                  )}
                </g>
              );
            })}
            {/* Doors */}
            {ann.doors.map((r) => {
              const sel = isSelected("door", r.id);
              const dim = pxPerM ? `${fmtM(r.w)} × ${fmtM(r.h)}` : null;
              const fs = Math.max(9, plan.w / 100);
              return (
                <g key={r.id}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h}
                    fill={`${COL_DOOR}33`} stroke={COL_DOOR}
                    strokeWidth={baseStroke} vectorEffect="non-scaling-stroke"
                    opacity={sel ? 1 : 0.9} />
                  {sel && (
                    <rect x={r.x - 4} y={r.y - 4} width={r.w + 8} height={r.h + 8}
                      fill="none" stroke={COL_DOOR} strokeWidth="2"
                      strokeDasharray="3,3" vectorEffect="non-scaling-stroke" />
                  )}
                  <text x={r.x + 4} y={r.y + fs + 2} fontSize={fs}
                    fill={COL_DOOR} fontWeight="700" pointerEvents="none">T</text>
                  {dim && r.w > 60 && (
                    <text x={r.x + r.w / 2} y={r.y + r.h - 3} fontSize={fs * 0.92}
                      fill={COL_DOOR} fontWeight="600" textAnchor="middle" pointerEvents="none">{dim}</text>
                  )}
                </g>
              );
            })}
            {/* Saved scale-calibration line */}
            {ann.scale && (() => {
              const { p1, p2, m } = ann.scale;
              const linePx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
              const fs = Math.max(11, plan.w / 90);
              const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
              return (
                <g pointerEvents="none">
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                    stroke={COL_SCALE} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <line x1={p1.x - 6} y1={p1.y - 6} x2={p1.x + 6} y2={p1.y + 6}
                    stroke={COL_SCALE} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <line x1={p1.x + 6} y1={p1.y - 6} x2={p1.x - 6} y2={p1.y + 6}
                    stroke={COL_SCALE} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <line x1={p2.x - 6} y1={p2.y - 6} x2={p2.x + 6} y2={p2.y + 6}
                    stroke={COL_SCALE} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <line x1={p2.x + 6} y1={p2.y - 6} x2={p2.x - 6} y2={p2.y + 6}
                    stroke={COL_SCALE} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <rect x={mx - fs * 2.2} y={my - fs * 0.95} width={fs * 4.4} height={fs * 1.6}
                    fill="white" stroke={COL_SCALE} strokeWidth="1" rx="3" />
                  <text x={mx} y={my + fs * 0.25} fontSize={fs} fontWeight="700"
                    fill={COL_SCALE} textAnchor="middle">📏 {String(m).replace(".", ",")} m</text>
                </g>
              );
            })()}
            {/* Scale-mode draft awaiting confirmation */}
            {scaleDraft && (
              <g pointerEvents="none">
                <line x1={scaleDraft.p1.x} y1={scaleDraft.p1.y} x2={scaleDraft.p2.x} y2={scaleDraft.p2.y}
                  stroke={COL_SCALE} strokeWidth="2" strokeDasharray="6,4" vectorEffect="non-scaling-stroke" />
              </g>
            )}
            {/* Drag preview */}
            {dragRect && (
              <rect x={dragRect.x} y={dragRect.y} width={dragRect.w} height={dragRect.h}
                fill={`${MODE_COLORS[mode] || R}22`} stroke={MODE_COLORS[mode] || R}
                strokeWidth={baseStroke} vectorEffect="non-scaling-stroke"
                strokeDasharray="6,4" pointerEvents="none" />
            )}
            {/* Per-item × delete button (top-right corner of focused rect) */}
            {focusRect && focusItem && (
              <g transform={`translate(${focusRect.x + focusRect.w}, ${focusRect.y}) scale(${screenPxToPlanPx})`}>
                <circle cx="0" cy="0" r="13" fill={R} stroke="white" strokeWidth="2"
                  onClick={(e) => { e.stopPropagation(); deleteItem(focusItem); }}
                  style={{ cursor: "pointer" }} />
                <line x1="-5" y1="-5" x2="5" y2="5" stroke="white" strokeWidth="2.5" pointerEvents="none" strokeLinecap="round" />
                <line x1="5" y1="-5" x2="-5" y2="5" stroke="white" strokeWidth="2.5" pointerEvents="none" strokeLinecap="round" />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Footer status + keyboard hint */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: GL, padding: "0 4px", gap: 12, flexWrap: "wrap" }}>
        <span>
          {ann.facades.length > 0 ? `✓ ${ann.facades.length} Begrünungsfläche${ann.facades.length === 1 ? "" : "n"}` : "○ keine Begrünungsfläche"} ·
          {" "}{ann.windows.length} Fenster · {ann.doors.length} Türen
          {selectedKeys.size > 0 && <span style={{ color: DK, marginLeft: 8 }}>· {selectedKeys.size} ausgewählt</span>}
        </span>
        <span style={{ fontSize: 9.5, color: GL }} title="Tastenkürzel (wirken, solange die Maus über dem Planbereich ist)">
          ⌨ <Kbd>V</Kbd> Ausw. · <Kbd>F</Kbd> Fläche · <Kbd>W</Kbd> Fenster · <Kbd>T</Kbd> Tür · <Kbd>S</Kbd> Maßstab · <Kbd>H</Kbd> Pan ·
          {" "}<Kbd>Entf</Kbd> · <Kbd>Strg+Z</Kbd>/<Kbd>Y</Kbd> · <Kbd>+</Kbd>/<Kbd>−</Kbd>/<Kbd>0</Kbd>/<Kbd>1</Kbd>
        </span>
      </div>
    </div>
  );
}

function Kbd({ children }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 5px",
      margin: "0 1px",
      fontSize: 9.5,
      fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
      background: "#F0EEE8",
      border: "1px solid #D8D6D4",
      borderBottomWidth: 2,
      borderRadius: 3,
      color: "#333",
      lineHeight: 1.2,
    }}>{children}</span>
  );
}

const zoomBtnStyle = {
  width: 28, height: 28, padding: 0,
  border: `1px solid ${BD}`, borderRadius: 5, cursor: "pointer",
  background: WH, color: DK, fontSize: 14, fontWeight: 700,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
function miniBtn(enabled) {
  return {
    padding: "5px 8px", fontSize: 10, fontWeight: 600,
    border: `1px solid ${BD}`, borderRadius: 5,
    cursor: enabled ? "pointer" : "not-allowed",
    background: WH, color: enabled ? DK : GL,
  };
}
function miniBtnPrim(enabled) {
  return {
    padding: "6px 10px", fontSize: 11, fontWeight: 600,
    border: `1px solid ${BD}`, borderRadius: 6,
    cursor: enabled ? "pointer" : "not-allowed",
    background: WH, color: enabled ? DK : GL,
  };
}
