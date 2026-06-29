// Validierung des Österreich-Windmoduls (ÖNORM B 1991-1-4) gegen die
// Excel-Cache-Werte des Sheets 0_Input_AUT (Strabag BVH Franzensbrückenstraße 7).
//   Standort Wien ("Wien, alle übrige B.": vb,0 = 25,1 m/s, Ref-Seehöhe 542 müM),
//   Standort-Seehöhe 160 müM, GK III, L=24, B=14, h=25.

import { test } from "node:test";
import assert from "node:assert/strict";
import { windAUT, qbAUT, ceAUT, cpeA_AUT, findStadt } from "./de_at_wind.js";

const REL = 5e-3;
const near = (a, e, name) => {
  const tol = Math.max(Math.abs(e) * REL, 1e-6);
  assert.ok(Math.abs(a - e) <= tol, `${name}: ${a} ≠ ${e} (Δ ${Math.abs(a - e).toExponential(2)})`);
};

test("Städte-DB findet Wien (vb,0 = 25,1)", () => {
  const s = findStadt("Wien, alle übrige B.");
  assert.ok(s, "Stadt gefunden");
  near(s.vb0, 25.1, "vb,0");
  near(s.seehoehe, 542, "Seehöhe Ref");
});

test("qb = ρ/2·vb,0²  → 0,3938 kN/m²", () => {
  near(qbAUT(25.1), 0.3937562500000001, "qb");
});

test("ce(z) GK III, z=25 → 2,2827", () => {
  near(ceAUT(25, "III"), 2.2826569653712885, "ce(z)");
});

test("cpe,A beide Windrichtungen (−1,340 / −1,388)", () => {
  near(cpeA_AUT(25, 24, 14), -1.3402777777777777, "cpe,A dir1 (b=L)");
  near(cpeA_AUT(25, 14, 24), -1.3877551020408165, "cpe,A dir2 (b=B)");
});

test("windAUT: qp, we,s, we,d wie 0_Input_AUT", () => {
  const r = windAUT({
    vb0: 25.1, seehoehe: 160, seehoeheStadt: 542,
    gelaendekategorie: "III", gebaeudehoehe: 25, gebaeudelaenge: 24, gebaeudebreite: 14,
  });
  near(r.qb, 0.3937562500000001, "qb");
  near(r.ce, 2.2826569653712885, "ce(z)");
  near(r.qp, 0.8988104467209787, "qp");
  near(r.cpeA, -1.3877551020408165, "cpe,A maßgeblich");
  near(r.we_s, -1.2473287832046236, "we,s");
  near(r.we_d, 0.8988104467209787, "we,d");
  near(r.ws, 1.2473287832046236, "ws (Sog) → Engine");
  near(r.nek, 0.8988104467209787, "Nek (Druck) → Engine");
});

test("2. ÖNORM-Beispiel Mackgasse (GK III, z=12, L=30, B=15)", () => {
  // PDF "2026-05-28-001_STO_BVH Mackgasse": qb 0,394 · ce 1,85 · qp 0,726 ·
  // cpe,A −1,25/−1,28 · we,s −0,926 · we,d 0,726.
  const r = windAUT({
    vb0: 25.1, seehoehe: 265, seehoeheStadt: 260,
    gelaendekategorie: "III", gebaeudehoehe: 12, gebaeudelaenge: 30, gebaeudebreite: 15,
  });
  near(r.qb, 0.394, "qb"); near(r.ce, 1.85, "ce(z)"); near(r.qp, 0.726, "qp");
  near(r.cpeA1, -1.25, "cpe,A dir1"); near(r.cpeA2, -1.275, "cpe,A dir2");
  near(r.we_s, -0.926, "we,s"); near(r.we_d, 0.726, "we,d");
});
