// ─────────────────────────────────────────────────────────────────
// Interaktives 3D-Systemmodell des Wandaufbaus (nur Bildschirm, kein PDF).
//
// Reines CSS-3D (preserve-3d) ohne Zusatzbibliothek: Verankerungsgrund →
// Kleber/Altputz (t_tol) → Dämmung → Putz → Iso-Bar-Anker → Seilebene.
// Schichtdicken kommen aus dem Projekt (d); fehlende Werte werden für die
// Darstellung mit typischen Maßen ersetzt und in der Maßliste als "–" gezeigt.
// Schnittflächen (oben/rechts) tragen eine 45°-Schraffur wie im technischen
// Schnitt.  Drehen per Ziehen, Explosionsansicht per Regler.
//
// Runde Bauteile (Stab, Scheiben, Adapter) sind Facetten-Zylinder mit
// geschlossener Mantelfläche — gekreuzte Ebenen sahen aus schrägen
// Blickwinkeln durchsichtig aus.
// ─────────────────────────────────────────────────────────────────
import { Fragment, useEffect, useRef, useState } from "react";
import { parseNum } from "./num.js";
import { szeneSVGInner } from "./modellSzene.js";

const pf = parseNum;
const MONO = "'IBM Plex Mono',ui-monospace,Consolas,monospace";
const HATCH = "repeating-linear-gradient(45deg, rgba(20,25,30,.16) 0 1px, transparent 1px 7px)";

// Ein Quader aus sechs Flächen; Zentrum bei (x,y,z), Maße w×h×t (t = Tiefe in z).
// `cut` legt die Schraffur auf die Schnittflächen (oben + rechts).
function Quader({ x = 0, y = 0, z = 0, w, h, t, color, cut = false, dim = false, edge = "rgba(20,25,30,.22)" }) {
  const F = (fw, fh, rot, off, shade, hatch) => (
    <div style={{
      position: "absolute", left: -fw / 2, top: -fh / 2, width: fw, height: fh,
      transform: `${rot} translateZ(${off}px)`, backfaceVisibility: "hidden",
      background: hatch ? `${HATCH}, ${color}` : color,
      filter: `brightness(${shade})`, boxShadow: `inset 0 0 0 1px ${edge}`,
    }} />
  );
  return (
    <div style={{ position: "absolute", transformStyle: "preserve-3d", transform: `translate3d(${x}px,${y}px,${z}px)`, opacity: dim ? 0.25 : 1, transition: "opacity .2s, transform .25s ease-out" }}>
      {F(w, h, "", t / 2, 1, false)}
      {F(w, h, "rotateY(180deg)", t / 2, 0.72, false)}
      {F(t, h, "rotateY(90deg)", w / 2, 0.86, cut)}
      {F(t, h, "rotateY(-90deg)", w / 2, 0.78, false)}
      {F(w, t, "rotateX(90deg)", h / 2, 1.06, cut)}
      {F(w, t, "rotateX(-90deg)", h / 2, 0.7, false)}
    </div>
  );
}

// Seil als zwei gekreuzte, dünne Ebenen — bei 2 px Stärke unproblematisch.
function Seil({ x = 0, y = 0, z = 0, len, vertikal = true, rotZ = 0, dim = false }) {
  const pl = (rot) => (
    <div style={{
      position: "absolute", left: vertikal ? -1 : -len / 2, top: vertikal ? -len / 2 : -1,
      width: vertikal ? 2 : len, height: vertikal ? len : 2,
      transform: rot, background: "linear-gradient(180deg,#9AA1A8,#6E757D)", borderRadius: 1,
    }} />
  );
  return (
    <div style={{ position: "absolute", transformStyle: "preserve-3d", transform: `translate3d(${x}px,${y}px,${z}px) rotateZ(${rotZ}deg)`, opacity: dim ? 0.25 : 1, transition: "opacity .2s, transform .25s ease-out" }}>
      {pl("")}
      {pl(vertikal ? "rotateY(90deg)" : "rotateX(90deg)")}
    </div>
  );
}

// Massiver Facetten-Zylinder entlang z: n Mantelflächen (n=6 ergibt einen
// echten Sechskant), Beleuchtung je Facette über brightness.  `ring` legt
// eine Ring-Textur (Gewinde/Rippen) über die Grundfarbe, `endKappe` zeichnet
// die äußere Stirnfläche, `loecher` vier Querbohrungs-Punkte nahe dem
// äußeren Ende (dort läuft das Seil durch).
function Zyl({ x = 0, y = 0, z = 0, len, r, n = 10, farbe, ring = null, endKappe = null, loecher = false, dim = false }) {
  const a = Math.PI / n;
  const apo = r * Math.cos(a);
  const chord = 2 * r * Math.sin(a) + 0.4;        // minimale Überlappung gegen Fugen
  const faces = [];
  for (let i = 0; i < n; i++) {
    const ang = i * (360 / n);
    const lum = 0.66 + 0.55 * Math.max(0, Math.cos((ang + 35) * Math.PI / 180));
    faces.push(
      <div key={i} style={{ position: "absolute", left: -chord / 2, top: -len / 2, width: chord, height: len,
        transform: `rotateY(${ang}deg) translateZ(${apo}px)`, backfaceVisibility: "hidden",
        background: ring ? `${ring}, ${farbe}` : farbe, filter: `brightness(${lum})` }} />
    );
  }
  return (
    <div style={{ position: "absolute", transformStyle: "preserve-3d",
      transform: `translate3d(${x}px,${y}px,${z}px) rotateX(90deg)`, opacity: dim ? 0.25 : 1,
      transition: "opacity .2s, transform .25s ease-out" }}>
      {faces}
      {endKappe && <div style={{ position: "absolute", left: -r, top: -r, width: 2 * r, height: 2 * r,
        borderRadius: "50%", background: endKappe, transform: `rotateX(90deg) translateZ(${-len / 2}px)` }} />}
      {loecher && [0, 90, 180, 270].map((w) => (
        <div key={w} style={{ position: "absolute", left: -3, top: -3, width: 6, height: 6, borderRadius: "50%",
          background: "radial-gradient(circle, #26292D 0 55%, rgba(38,41,45,0) 72%)",
          transform: `translateY(${len / 2 - 6}px) rotateY(${w}deg) translateZ(${apo + 0.3}px)` }} />
      ))}
    </div>
  );
}

// Materialien des Iso-Bar ECO (nach Produktfoto).
const MAT = {
  rippenFarbe: "#EFE8D5",
  rippenRing: "repeating-linear-gradient(180deg, rgba(96,86,60,.42) 0 2px, rgba(0,0,0,0) 2px 5px)",
  stahl: "#C9CED3",
  gewindeRing: "repeating-linear-gradient(180deg, rgba(20,25,30,.4) 0 1px, rgba(0,0,0,0) 1px 2.6px)",
  dicht: "#26282B",
  // Stirnfläche des Adapters: Stahlrand, Senkung, dunkler Innensechskant
  kopfEnde: "radial-gradient(circle, #26292D 0 26%, #4E545B 26% 38%, #D7DBDF 38% 58%, #AEB4BB 58% 78%, #C9CED3 78% 100%)",
};

const SCHICHT_INFO = [
  { key: "wand",  l: "Verankerungsgrund", farbe: "#B8B4AD" },
  { key: "tol",   l: "Kleber + Altputz",  farbe: "#C9A86A" },
  { key: "daemm", l: "Dämmung (WDVS)",    farbe: "#EFE8D8" },
  { key: "putz",  l: "Putzschicht",       farbe: "#F4F1EA" },
  { key: "anker", l: "Iso-Bar ECO",       farbe: "#EDE7D6" },
  { key: "seil",  l: "Seilebene",         farbe: "#7A828A" },
];

export default function Facade3D({ d, setD }) {
  // ── Projektwerte (Darstellungs-Fallbacks nur fürs Modell) ──
  const wdvsMm = pf(d.vm_daemm) || pf(d.wdvs_dicke) || 0;
  const tolMm = pf(d.dicke_klebschicht) || 0;
  const putzMm = pf(d.vm_putz) || 0;
  const f0 = (d.fassaden || [])[0] || {};
  const lh = pf(f0.lh) || pf(d.LH) || 0.9;
  const lv = pf(f0.lv) || pf(d.LV) || 0.9;
  const projFuehrung = f0.seilfuehrung || d.seilfuehrung || "gitter";
  const isMW = d.vm_untergrund ? d.vm_untergrund === "mauerwerk" : !/beton/i.test(String(d.verankerungsgrund || "stein"));
  const produkt = String(d.produkt || "").replace(/\D/g, "");

  // ── Geometrie in Pixeln (Maßstab 0,42 px/mm; Anzeige gedeckelt) ──
  const S = 0.42;
  const g = {
    W: 340, H: 272, wand: 64,
    tol: Math.max(3, Math.min(40, (tolMm || 10) * S)),
    daemm: Math.max(30, Math.min(150, (wdvsMm || 200) * S)),
    putz: Math.max(3, Math.min(16, (putzMm || 10) * S)),
    luft: 46,
  };
  const cols = Math.max(2, Math.min(5, Math.round(3.4 / lh) + 1));
  const rows = Math.max(2, Math.min(4, Math.round(2.6 / lv) + 1));

  // ── Interaktion: Drehen, Zoom, Explosion, Hervorheben ──
  const [rot, setRot] = useState({ x: -16, y: -32 });
  const [zoom, setZoom] = useState(1);
  const [explode, setExplode] = useState(0);
  const [hi, setHi] = useState(null);
  // Seilfuehrung im Modell umschaltbar; null = Wert aus dem Projekt.
  const [fWahl, setFWahl] = useState(null);
  const fuehrung = fWahl || projFuehrung;
  const drag = useRef(null);
  const idle = useRef(true);

  // ── Ansicht exportieren: Shots fuer Anlage D im Report + PNG-Download ──
  const shots = Array.isArray(d.modell_shots) ? d.modell_shots : [];
  const shotJetzt = () => ({ rx: Math.round(rot.x), ry: Math.round(rot.y % 360), explode: +explode.toFixed(2), fuehrung });
  const shotAdd = () => setD && setD((x) => ({ ...x, modell_shots: [...(Array.isArray(x.modell_shots) ? x.modell_shots : []).slice(-3), shotJetzt()] }));
  const shotDel = (i) => setD && setD((x) => ({ ...x, modell_shots: (x.modell_shots || []).filter((_, j) => j !== i) }));
  const shotStandard = () => setD && setD((x) => ({ ...x, modell_shots: [
    { rx: -16, ry: -32, explode: 0, fuehrung },
    { rx: -2, ry: 0, explode: 0, fuehrung },
    { rx: -14, ry: -28, explode: 0.85, fuehrung },
  ] }));
  const pngDownload = () => {
    const { inner, vb } = szeneSVGInner(d, shotJetzt());
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="1600" height="1200">${inner}</svg>`;
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = 1600; c.height = 1200;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, 1600, 1200);
      ctx.drawImage(img, 0, 0, 1600, 1200);
      URL.revokeObjectURL(url);
      c.toBlob((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `EJOT_IsoBar_3D_${d.dokNr || "Modell"}.png`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }, "image/png");
    };
    img.src = url;
  };

  // Sanftes Eigendrehen bis zur ersten Interaktion (nicht bei reduced motion).
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf;
    const tick = () => { if (idle.current) setRot(r => ({ ...r, y: r.y + 0.12 })); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onDown = (e) => {
    idle.current = false;
    drag.current = { x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    setRot({ x: Math.max(-85, Math.min(20, drag.current.rx - dy * 0.4)), y: drag.current.ry + dx * 0.4 });
  };
  const onUp = () => { drag.current = null; };

  // ── Schicht-Positionen entlang z (0 = Vorderkante Verankerungsgrund) ──
  const gap = explode * 34;
  const zTol = g.tol / 2 + gap;
  const zDaemm = g.tol + g.daemm / 2 + gap * 2;
  const zPutz = g.tol + g.daemm + g.putz / 2 + gap * 3;
  const zSeil = g.tol + g.daemm + g.putz + g.luft + gap * 4;
  const dimOf = (k) => hi !== null && hi !== k;

  // Ankerraster auf der Fläche (Rand 34 px)
  const xs = Array.from({ length: cols }, (_, i) => -g.W / 2 + 34 + (i * (g.W - 68)) / (cols - 1));
  const ys = Array.from({ length: rows }, (_, i) => -g.H / 2 + 30 + (i * (g.H - 60)) / (rows - 1));
  // Anker-Geometrie (nach Produktfoto): Rippenstab bis Putzoberfläche, dort
  // Dichtscheibe + Edelstahl-Scheibe, Gewindestift, dann der Adapter:
  // kompakter Sechskant unten, langer Zylinder mit Querbohrung am Seil.
  const zPutzAussen = zPutz + g.putz / 2;
  const rodLen = zPutzAussen + 25;                 // von −24 (im Grund) bis +1 hinter dem Putz
  const stiftLen = (zSeil - 28) - (zPutzAussen + 5);
  const hatV = fuehrung === "gitter" || fuehrung === "vertikal";
  const hatH = fuehrung === "gitter" || fuehrung === "horizontal";
  const hatD = fuehrung === "diagonal";

  const wandFarbe = isMW
    ? "repeating-linear-gradient(180deg,#C3897B 0 14px,#EDE6DE 14px 16px), #C3897B"
    : "radial-gradient(rgba(20,25,30,.08) 1px, transparent 1.4px) 0 0/9px 9px, #B8B4AD";

  const mm = (v) => (v ? `${v} mm` : "–");
  const btn = { padding: "5px 10px", fontSize: 10.5, fontWeight: 600, border: "1px solid #3A424B", borderRadius: 5, background: "transparent", color: "#C9CFD6", cursor: "pointer" };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", background: "linear-gradient(160deg,#191E24,#232A32)", borderRadius: 10, overflow: "hidden", border: "1px solid #2C333B" }}>
      {/* ── Szene ── */}
      <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ flex: "1 1 460px", minWidth: 320, height: 470, position: "relative", cursor: drag.current ? "grabbing" : "grab", touchAction: "none", userSelect: "none" }}>
        <div style={{ position: "absolute", inset: 0, perspective: 1500, perspectiveOrigin: "50% 42%" }}>
          <div style={{ position: "absolute", left: "50%", top: "52%", transformStyle: "preserve-3d", transform: `scale(${zoom}) rotateX(${rot.x}deg) rotateY(${rot.y}deg)` }}>
            {/* Schichten */}
            <Quader w={g.W} h={g.H} t={g.wand} z={-g.wand / 2} color={wandFarbe} cut dim={dimOf("wand")} />
            <Quader w={g.W} h={g.H} t={g.tol} z={zTol} color="#C9A86A" cut dim={dimOf("tol")} />
            <Quader w={g.W} h={g.H} t={g.daemm} z={zDaemm} color="repeating-linear-gradient(180deg,#EFE8D8 0 11px,#E5DCC6 11px 13px), #EFE8D8" cut dim={dimOf("daemm")} />
            <Quader w={g.W} h={g.H} t={g.putz} z={zPutz} color="#F4F1EA" cut dim={dimOf("putz")} />
            {/* Anker an jedem Rasterpunkt: Rippenstab → Dichtscheibe → Gewindestift → Adapter */}
            {xs.map((x) => ys.map((y) => {
              const dim = dimOf("anker");
              return (
              <Fragment key={`${x}${y}`}>
                <Zyl x={x} y={y} z={rodLen / 2 - 24} len={rodLen} r={4.2} n={8} farbe={MAT.rippenFarbe} ring={MAT.rippenRing} dim={dim} />
                <Zyl x={x} y={y} z={zPutzAussen + 2} len={4} r={7} n={12} farbe={MAT.dicht} endKappe="radial-gradient(circle,#3A3D41 0 60%,#1B1C1E)" dim={dim} />
                <Zyl x={x} y={y} z={zPutzAussen + 4.5} len={2.5} r={5.5} n={12} farbe={MAT.stahl} endKappe="radial-gradient(circle,#DDE0E4 0 55%,#AEB4BB)" dim={dim} />
                <Zyl x={x} y={y} z={zPutzAussen + 5 + stiftLen / 2} len={stiftLen} r={2} n={6} farbe={MAT.stahl} ring={MAT.gewindeRing} dim={dim} />
                <Zyl x={x} y={y} z={zSeil - 23} len={10} r={9} n={6} farbe={MAT.stahl} dim={dim} />
                <Zyl x={x} y={y} z={zSeil - 6} len={24} r={5.8} n={10} farbe={MAT.stahl} endKappe={MAT.kopfEnde} loecher dim={dim} />
              </Fragment>
            );}))}
            {/* Seilebene */}
            {hatV && xs.map((x) => <Seil key={`v${x}`} x={x} z={zSeil} len={g.H - 24} vertikal dim={dimOf("seil")} />)}
            {hatH && ys.map((y) => <Seil key={`h${y}`} y={y} z={zSeil} len={g.W - 24} vertikal={false} dim={dimOf("seil")} />)}
            {/* Raute: beide Diagonalen jedes Ankerfelds — Seile laufen von
                Adapter zu Adapter statt frei durch den Raum. */}
            {hatD && xs.slice(0, -1).map((x, i) => ys.slice(0, -1).map((y, j) => {
              const x2 = xs[i + 1], y2 = ys[j + 1];
              const cx = (x + x2) / 2, cy = (y + y2) / 2;
              const len = Math.hypot(x2 - x, y2 - y);
              const ang = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI;
              return [ang, -ang].map((a) => (
                <Seil key={`d${i}-${j}-${a}`} x={cx} y={cy} z={zSeil} len={len} vertikal={false} rotZ={a} dim={dimOf("seil")} />
              ));
            }))}
          </div>
        </div>
        <div style={{ position: "absolute", left: 14, bottom: 10, fontFamily: MONO, fontSize: 9.5, color: "#7B838C", letterSpacing: 0.4 }}>
          ZIEHEN = DREHEN · SCHNITTFLÄCHEN SCHRAFFIERT
        </div>
      </div>

      {/* ── Plankopf: Maße, Schichten, Steuerung ── */}
      <div style={{ flex: "0 1 300px", minWidth: 260, borderLeft: "1px solid #2C333B", padding: "16px 18px", color: "#E7EAEE", display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.4, color: "#8B939C" }}>SYSTEMMODELL</div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.2 }}>Iso-Bar ECO{produkt ? ` ${produkt}` : ""} im Wandaufbau</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {SCHICHT_INFO.map((s) => (
            <div key={s.key} onMouseEnter={() => setHi(s.key)} onMouseLeave={() => setHi(null)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 7px", borderRadius: 5, cursor: "default", background: hi === s.key ? "rgba(200,16,46,.14)" : "transparent" }}>
              <span style={{ width: 11, height: 11, borderRadius: 2, background: s.farbe, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.25)" }} />
              <span style={{ flex: 1, fontSize: 11.5 }}>{s.l}</span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: "#B7BEC6" }}>
                {s.key === "wand" ? (isMW ? "Mauerwerk" : "Beton")
                  : s.key === "tol" ? mm(tolMm)
                  : s.key === "daemm" ? mm(wdvsMm)
                  : s.key === "putz" ? mm(putzMm)
                  : s.key === "anker" ? (produkt ? `ECO ${produkt}` : "–")
                  : `${lh.toFixed(2).replace(".", ",")} × ${lv.toFixed(2).replace(".", ",")} m`}
              </span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.2, color: "#8B939C", marginBottom: 5 }}>SEILFÜHRUNG</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {[["gitter","Gitter"],["vertikal","Vertikal"],["horizontal","Horizontal"],["diagonal","Raute"]].map(([id,l])=>{
              const akt = fuehrung === id;
              return (<button key={id} onClick={()=>setFWahl(id)}
                style={{ ...btn, padding: "4px 9px", borderColor: akt ? "#C8102E" : "#3A424B",
                  background: akt ? "rgba(200,16,46,.18)" : "transparent", color: akt ? "#FFB3BF" : "#C9CFD6" }}>{l}</button>);
            })}
          </div>
          {fWahl && fWahl !== projFuehrung && <div style={{ fontSize: 9, color: "#8B939C", marginTop: 4 }}>
            Nur Ansicht — im Projekt eingestellt: {projFuehrung}.
          </div>}
        </div>

        <label style={{ display: "block" }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.2, color: "#8B939C", marginBottom: 5 }}>EXPLOSIONSANSICHT</div>
          <input type="range" min="0" max="1" step="0.01" value={explode} onChange={(e) => setExplode(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#C8102E" }} />
        </label>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["Isometrie", -16, -32], ["Front", -2, 0], ["Seite", -6, -76]].map(([l, rx, ry]) => (
            <button key={l} style={btn} onClick={() => { idle.current = false; setRot({ x: rx, y: ry }); }}>{l}</button>
          ))}
          <button style={btn} onClick={() => setZoom(z => Math.min(1.5, z + 0.15))}>＋</button>
          <button style={btn} onClick={() => setZoom(z => Math.max(0.6, z - 0.15))}>－</button>
        </div>

        <div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.2, color: "#8B939C", marginBottom: 5 }}>ANSICHT EXPORTIEREN</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <button style={btn} title="Aktuelle Ansicht als Anlage D in den Report aufnehmen" onClick={shotAdd}>＋ In Report</button>
            <button style={btn} title="Isometrie, Front und Explosionsansicht als Anlage D aufnehmen" onClick={shotStandard}>Standard-Ansichten</button>
            <button style={btn} title="Aktuelle Ansicht als PNG-Datei speichern" onClick={pngDownload}>PNG ↓</button>
          </div>
          {shots.length > 0 && <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
            {shots.map((sh, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: MONO, fontSize: 9,
                padding: "2px 7px", borderRadius: 9, border: "1px solid #3A424B", color: "#B7BEC6" }}>
                Ansicht {i + 1}{sh.explode > 0.05 ? " · Expl." : ""}
                <button onClick={() => shotDel(i)} title="Ansicht entfernen"
                  style={{ border: "none", background: "none", color: "#8B939C", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>}
          <div style={{ fontSize: 9, color: "#7B838C", marginTop: 5 }}>
            Aufgenommene Ansichten erscheinen als „Anlage D – Systemmodell" im Anlagen-PDF.
          </div>
        </div>

        <div style={{ marginTop: "auto", fontSize: 9.5, color: "#7B838C", lineHeight: 1.5 }}>
          Schematische Darstellung mit Projektwerten — ersetzt weder Zulassungsdetails (Z-21.8-2083) noch die Ausführungsplanung.
        </div>
      </div>
    </div>
  );
}
