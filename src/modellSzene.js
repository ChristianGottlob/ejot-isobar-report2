// ─────────────────────────────────────────────────────────────────
// Snapshot-Renderer für das 3D-Systemmodell.
//
// Baut dieselbe Szene wie Facade3D (Geometrie bewusst gespiegelt — dort
// CSS-3D-Divs, hier reine Daten) und rendert sie als SVG-String:
// Rotation wie CSS `rotateX(rx) rotateY(ry)`, orthografische Projektion,
// Tiefensortierung (Maler-Algorithmus), Flächenhelligkeit über die Normale.
// Genutzt für Anlage D im Report/PDF und den PNG-Export im 3D-Tab.
// Ohne DOM-Abhängigkeit → mit node --test prüfbar.
// ─────────────────────────────────────────────────────────────────
import { parseNum } from "./num.js";

const pf = parseNum;

const F = {
  wandMW: "#C3897B", wandBeton: "#B8B4AD",
  tol: "#C9A86A", daemm: "#EDE5D2", putz: "#F4F1EA",
  rod: "#EFE8D5", dicht: "#26282B", stahl: "#C9CED3", seil: "#79828B",
};
// Aussenschicht-Varianten (Vorschau): Putz oder Klinker in drei Farbwelten
export const OBERFLAECHEN = {
  putz: { l: "Putz", farbe: F.putz },
  klinker_rot: { l: "Klinker rot", farbe: "#B5766A" },
  klinker_grau: { l: "Klinker grau", farbe: "#9B9FA3" },
  klinker_beige: { l: "Klinker beige", farbe: "#CDBEA3" },
};

// Hexfarbe × Faktor (0..~1.3)
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

// ── Szene: Liste aus Quads {q:[p×4], farbe} und Segmenten {s:[a,b], farbe, w} ──
export function bauSzene(d, { fuehrung = "gitter", explode = 0, oberflaeche = "putz" } = {}) {
  const wdvsMm = pf(d.vm_daemm) || pf(d.wdvs_dicke) || 0;
  const tolMm = pf(d.dicke_klebschicht) || 0;
  const putzMm = pf(d.vm_putz) || 0;
  const f0 = (d.fassaden || [])[0] || {};
  const lh = pf(f0.lh) || pf(d.LH) || 0.9;
  const lv = pf(f0.lv) || pf(d.LV) || 0.9;
  const isMW = d.vm_untergrund ? d.vm_untergrund === "mauerwerk" : !/beton/i.test(String(d.verankerungsgrund || "stein"));

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
  const gap = explode * 34;
  const zTol = g.tol / 2 + gap;
  const zDaemm = g.tol + g.daemm / 2 + gap * 2;
  const zPutz = g.tol + g.daemm + g.putz / 2 + gap * 3;
  const zSeil = g.tol + g.daemm + g.putz + g.luft + gap * 4;
  const zPutzAussen = zPutz + g.putz / 2;

  const prim = [];
  // Grosse Flaechen in Kacheln unterteilen: der Maler-Algorithmus sortiert
  // pro Polygon-Mittelpunkt — eine ungeteilte Wandfront verdeckte sonst die
  // Anker nahe der zum Betrachter gedrehten Kante (abgeschnittene Iso-Bars).
  const lerp = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
  const quadSub = (p00, p10, p11, p01, farbe) => {
    const du = Math.hypot(p10[0] - p00[0], p10[1] - p00[1], p10[2] - p00[2]);
    const dv = Math.hypot(p01[0] - p00[0], p01[1] - p00[1], p01[2] - p00[2]);
    const nu = Math.max(1, Math.min(6, Math.round(du / 70)));
    const nv = Math.max(1, Math.min(6, Math.round(dv / 70)));
    const pt = (u, v) => lerp(lerp(p00, p10, u), lerp(p01, p11, u), v);
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      prim.push({ q: [pt(i / nu, j / nv), pt((i + 1) / nu, j / nv), pt((i + 1) / nu, (j + 1) / nv), pt(i / nu, (j + 1) / nv)], farbe });
    }
  };
  // Quader: Zentrum (x,y,z), Maße w×h×t
  const quader = (x, y, z, w, h, t, farbe) => {
    const p = (dx, dy, dz) => [x + dx * w / 2, y + dy * h / 2, z + dz * t / 2];
    const q = (a, b, c2, e) => quadSub(a, b, c2, e, farbe);
    q(p(-1,-1, 1), p(1,-1, 1), p(1,1, 1), p(-1,1, 1));
    q(p(-1,-1,-1), p(1,-1,-1), p(1,1,-1), p(-1,1,-1));
    q(p(-1,-1,-1), p(-1,-1,1), p(-1,1,1), p(-1,1,-1));
    q(p( 1,-1,-1), p( 1,-1,1), p( 1,1,1), p( 1,1,-1));
    q(p(-1,-1,-1), p(1,-1,-1), p(1,-1,1), p(-1,-1,1));
    q(p(-1, 1,-1), p(1, 1,-1), p(1, 1,1), p(-1, 1,1));
  };
  // Facettenzylinder entlang z, Zentrum (x,y,zMitte), plus äußere Stirnfläche
  const zyl = (x, y, z, len, r, n, farbe, kappe = null) => {
    const ring = (zz) => Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [x + r * Math.cos(a), y + r * Math.sin(a), zz];
    });
    const r0 = ring(z - len / 2), r1 = ring(z + len / 2);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      prim.push({ q: [r0[i], r0[j], r1[j], r1[i]], farbe });
    }
    if (kappe) prim.push({ q: r1, farbe: kappe, poly: true });
  };
  const seg = (a, b, w = 2.2) => prim.push({ s: [a, b], farbe: F.seil, w });

  // Schichten
  quader(0, 0, -g.wand / 2, g.W, g.H, g.wand, isMW ? F.wandMW : F.wandBeton);
  quader(0, 0, zTol, g.W, g.H, g.tol, F.tol);
  quader(0, 0, zDaemm, g.W, g.H, g.daemm, F.daemm);
  quader(0, 0, zPutz, g.W, g.H, g.putz, (OBERFLAECHEN[oberflaeche] || OBERFLAECHEN.putz).farbe);

  // Ankerraster
  const xs = Array.from({ length: cols }, (_, i) => -g.W / 2 + 34 + (i * (g.W - 68)) / (cols - 1));
  const ys = Array.from({ length: rows }, (_, i) => -g.H / 2 + 30 + (i * (g.H - 60)) / (rows - 1));
  const rodLen = zPutzAussen + 25;
  const stiftLen = (zSeil - 28) - (zPutzAussen + 5);
  for (const x of xs) for (const y of ys) {
    zyl(x, y, rodLen / 2 - 24, rodLen, 4.2, 8, F.rod);
    zyl(x, y, zPutzAussen + 2, 4, 7, 10, F.dicht, F.dicht);
    zyl(x, y, zPutzAussen + 4.5, 2.5, 5.5, 10, F.stahl, F.stahl);
    zyl(x, y, zPutzAussen + 5 + stiftLen / 2, stiftLen, 2, 6, F.stahl);
    zyl(x, y, zSeil - 23, 10, 9, 6, F.stahl);
    zyl(x, y, zSeil - 6, 24, 5.8, 10, F.stahl, "#8F969E");
  }

  // Seilführung
  const hatV = fuehrung === "gitter" || fuehrung === "vertikal";
  const hatH = fuehrung === "gitter" || fuehrung === "horizontal";
  if (hatV) for (const x of xs) seg([x, -g.H / 2 + 12, zSeil], [x, g.H / 2 - 12, zSeil]);
  if (hatH) for (const y of ys) seg([-g.W / 2 + 12, y, zSeil], [g.W / 2 - 12, y, zSeil]);
  if (fuehrung === "diagonal") {
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      seg([xs[i], ys[j], zSeil], [xs[i + 1], ys[j + 1], zSeil]);
      seg([xs[i + 1], ys[j], zSeil], [xs[i], ys[j + 1], zSeil]);
    }
  }
  return prim;
}

// ── Rendern: SVG-Innencode + passende viewBox ──
export function szeneSVGInner(d, { rx = -16, ry = -32, explode = 0, fuehrung = "gitter", oberflaeche = "putz" } = {}) {
  const prim = bauSzene(d, { fuehrung, explode, oberflaeche });
  const a = rx * Math.PI / 180, b = ry * Math.PI / 180;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  // CSS `rotateX(rx) rotateY(ry)`: erst Ry, dann Rx auf den Punkt
  const rot = (p) => {
    const x1 = p[0] * cb + p[2] * sb, y1 = p[1], z1 = -p[0] * sb + p[2] * cb;
    return [x1, y1 * ca - z1 * sa, y1 * sa + z1 * ca];
  };
  const L = [-0.45, -0.5, 0.74];                       // Lichtrichtung (Ansichtsraum)

  const items = [];
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  const merk = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };

  for (const p of prim) {
    if (p.q) {
      const v = p.q.map(rot);
      const depth = v.reduce((s2, q) => s2 + q[2], 0) / v.length;
      // Normale im Ansichtsraum → Helligkeit (beidseitig)
      const u1 = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
      const u2 = [v[3][0] - v[0][0], v[3][1] - v[0][1], v[3][2] - v[0][2]];
      const n = [u1[1] * u2[2] - u1[2] * u2[1], u1[2] * u2[0] - u1[0] * u2[2], u1[0] * u2[1] - u1[1] * u2[0]];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      const dot = Math.abs((n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl);
      const lum = 0.62 + 0.42 * dot;
      const pts = v.map((q) => { merk(q[0], q[1]); return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" ");
      // Strich in Flaechenfarbe: versiegelt Antialiasing-Naehte der Kacheln,
      // ohne ein sichtbares Gitter auf die Flaechen zu zeichnen.
      const fillCol = shade(p.farbe, lum);
      items.push({ depth, str: `<polygon points="${pts}" fill="${fillCol}" stroke="${fillCol}" stroke-width="0.6"/>` });
    } else if (p.s) {
      const A = rot(p.s[0]), B = rot(p.s[1]);
      merk(A[0], A[1]); merk(B[0], B[1]);
      items.push({ depth: (A[2] + B[2]) / 2, str: `<line x1="${A[0].toFixed(1)}" y1="${A[1].toFixed(1)}" x2="${B[0].toFixed(1)}" y2="${B[1].toFixed(1)}" stroke="${p.farbe}" stroke-width="${p.w}" stroke-linecap="round"/>` });
    }
  }
  items.sort((x, y) => x.depth - y.depth);            // hinten zuerst
  const m = 18;
  const vb = `${(minX - m).toFixed(0)} ${(minY - m).toFixed(0)} ${(maxX - minX + 2 * m).toFixed(0)} ${(maxY - minY + 2 * m).toFixed(0)}`;
  return { inner: items.map((i) => i.str).join(""), vb };
}
