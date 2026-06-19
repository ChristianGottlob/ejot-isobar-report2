import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { extractPdfText, buildDocument, loadPlanImage, FIELD_LABELS } from "./pdfExtract";
import RealisticFacade from "./RealisticFacade";
import RasterOverlay from "./RasterOverlay";
import PlanAnnotator from "./PlanAnnotator";
import { normalizeAnnotations, unionBBox, pointInRect, pointInAny, greeningAreaPx, lineInsideLengthPx, pxPerMeter, rectIntersectionArea } from "./planUtils";
import { loadDocument, saveDocument, clearDocument } from "./idbStore";

// ─── Colors ─────────────────────────────────────────────
const R="#C8102E",RL="#C8102E10",RM="#C8102E28",BK="#1A1A1A",DK="#333",GY="#666",GL="#999",BG="#F7F6F4",BD="#D8D6D4",WH="#FFF",GN="#2E7D32",AM="#E68A00";

// ─── Complete FLL Tabelle 15 (52 plants) ────────────────
const FLL_PLANTS=[
{bot:"Actinidia arguta",form:"S",de:"Scharfzähniger Strahlengriffel",hMax:8,trieb:15,fl:11,sm:14,li:13,lk:2,gesamt:340},
{bot:"Actinidia deliciosa",form:"S",de:"Kiwi",hMax:10,trieb:20,fl:15,sm:19,li:18,lk:3,gesamt:580},
{bot:"Actinidia kolomikta",form:"S",de:"Buntblättriger Strahlengriffel",hMax:4,trieb:3,fl:5,sm:4,li:4,lk:1,gesamt:60},
{bot:"Akebia quinata",form:"S",de:"Fingerblättrige Akebie",hMax:8,trieb:5,fl:7,sm:6,li:8,lk:2,gesamt:190},
{bot:"Akebia trifoliata",form:"S",de:"Dreiblättrige Akebie",hMax:6,trieb:5,fl:7,sm:6,li:7,lk:2,gesamt:120},
{bot:"Aristolochia macrophylla",form:"S",de:"Pfeifenwinde",hMax:10,trieb:10,fl:8,sm:10,li:9,lk:2,gesamt:340},
{bot:"Aristolochia tomentosa",form:"S",de:"Filzige Pfeifenwinde",hMax:6,trieb:5,fl:6,sm:6,li:6,lk:2,gesamt:120},
{bot:"Campsis radicans",form:"WK",de:"Trompetenblume",hMax:10,trieb:20,fl:null,sm:null,li:null,lk:null,gesamt:510},
{bot:"Campsis x tagliabuana",form:"WK",de:"Große Trompetenblume",hMax:5,trieb:10,fl:null,sm:null,li:null,lk:null,gesamt:140},
{bot:"Celastrus orbiculatus",form:"S",de:"Rundblättriger Baumwürger",hMax:14,trieb:16,fl:11,sm:15,li:13,lk:4,gesamt:700},
{bot:"Celastrus scandens",form:"S",de:"Amerikanischer Baumwürger",hMax:10,trieb:10,fl:8,sm:10,li:10,lk:2,gesamt:340},
{bot:"Clematis-Hybriden (groß)",form:"RB",de:"Großblumige Waldrebe",hMax:6,trieb:3,fl:5,sm:4,li:5,lk:1,gesamt:100},
{bot:"Clematis alpina",form:"RB",de:"Alpen-Waldrebe",hMax:3,trieb:3,fl:5,sm:5,li:5,lk:1,gesamt:40},
{bot:"Clematis macropetala",form:"RB",de:"Großblütige Waldrebe",hMax:4,trieb:5,fl:6,sm:6,li:6,lk:1,gesamt:70},
{bot:"Clematis montana",form:"RB",de:"Berg-Waldrebe",hMax:10,trieb:5,fl:6,sm:6,li:7,lk:2,gesamt:250},
{bot:"Clematis orientalis",form:"RB",de:"Orientalische Waldrebe",hMax:7,trieb:5,fl:6,sm:6,li:7,lk:2,gesamt:150},
{bot:"Clematis tangutica",form:"RB",de:"Gold-Waldrebe",hMax:6,trieb:5,fl:6,sm:6,li:6,lk:2,gesamt:120},
{bot:"Clematis terniflora",form:"RB",de:"Rispen-Waldrebe",hMax:10,trieb:5,fl:6,sm:6,li:7,lk:2,gesamt:250},
{bot:"Clematis vitalba",form:"RB",de:"Gewöhnliche Waldrebe",hMax:14,trieb:15,fl:10,sm:14,li:12,lk:3,gesamt:670},
{bot:"Clematis viticella",form:"RB",de:"Italienische Waldrebe",hMax:4,trieb:3,fl:5,sm:4,li:4,lk:1,gesamt:60},
{bot:"Euonymus fortunei",form:"WK",de:"Kletter-Spindelstrauch",hMax:6,trieb:10,fl:null,sm:null,li:null,lk:null,gesamt:170},
{bot:"Fallopia baldschuanica",form:"S",de:"Schlingknöterich",hMax:15,trieb:10,fl:8,sm:10,li:10,lk:3,gesamt:610},
{bot:"Hedera colchica",form:"WK",de:"Kolchischer Efeu",hMax:8,trieb:15,fl:null,sm:null,li:null,lk:null,gesamt:320},
{bot:"Hedera helix",form:"WK",de:"Gemeiner Efeu",hMax:25,trieb:30,fl:null,sm:null,li:null,lk:null,gesamt:2230},
{bot:"Hedera hibernica",form:"WK",de:"Irischer Efeu",hMax:20,trieb:30,fl:null,sm:null,li:null,lk:null,gesamt:1640},
{bot:"Humulus lupulus",form:"S",de:"Hopfen",hMax:6,trieb:1,fl:5,sm:3,li:4,lk:1,gesamt:80},
{bot:"Hydrangea anomala ssp. petiolaris",form:"WK",de:"Kletterhortensie",hMax:15,trieb:10,fl:null,sm:null,li:null,lk:null,gesamt:610},
{bot:"Jasminum nudiflorum",form:"K",de:"Winter-Jasmin",hMax:5,trieb:3,fl:6,sm:5,li:5,lk:1,gesamt:80},
{bot:"Lonicera x brownii",form:"S",de:"Browns Geißblatt",hMax:5,trieb:2,fl:5,sm:4,li:4,lk:1,gesamt:70},
{bot:"Lonicera caprifolium",form:"S",de:"Jelängerjelieber",hMax:6,trieb:2,fl:5,sm:4,li:4,lk:1,gesamt:90},
{bot:"Lonicera x heckrottii",form:"S",de:"Heckrotts Geißblatt",hMax:4,trieb:2,fl:5,sm:4,li:4,lk:1,gesamt:50},
{bot:"Lonicera henryi",form:"S",de:"Henrys Geißblatt",hMax:8,trieb:4,fl:6,sm:6,li:7,lk:2,gesamt:160},
{bot:"Lonicera japonica",form:"S",de:"Japanisches Geißblatt",hMax:5,trieb:2,fl:5,sm:4,li:4,lk:1,gesamt:70},
{bot:"Lonicera periclymenum",form:"S",de:"Wald-Geißblatt",hMax:6,trieb:2,fl:5,sm:4,li:4,lk:1,gesamt:90},
{bot:"Lonicera x tellmanniana",form:"S",de:"Tellmanns Geißblatt",hMax:6,trieb:2,fl:5,sm:4,li:4,lk:1,gesamt:90},
{bot:"Menispermum",form:"S",de:"Mondsame",hMax:6,trieb:3,fl:6,sm:4,li:5,lk:1,gesamt:100},
{bot:"Parthenocissus inserta",form:"RS",de:"Fünfblättrige Jungfernrebe",hMax:8,trieb:20,fl:13,sm:18,li:15,lk:3,gesamt:390},
{bot:"Parthenocissus quinquefolia",form:"RH",de:"Selbstkl. Jungfernrebe",hMax:15,trieb:20,fl:null,sm:null,li:null,lk:null,gesamt:800},
{bot:"Parthenocissus tricuspidata",form:"RH",de:"Dreilappige Jungfernrebe",hMax:20,trieb:30,fl:null,sm:null,li:null,lk:null,gesamt:1510},
{bot:"Periploca graeca",form:"S",de:"Baumschlinge",hMax:10,trieb:15,fl:10,sm:14,li:12,lk:3,gesamt:430},
{bot:"Rosa [Climber]",form:"K",de:"Kletterrose",hMax:12,trieb:20,fl:12,sm:18,li:14,lk:3,gesamt:640},
{bot:"Rubus",form:"K",de:"Brombeere / Himbeere",hMax:4,trieb:4,fl:6,sm:5,li:6,lk:1,gesamt:60},
{bot:"Schisandra chinensis",form:"S",de:"Chin. Spaltkörbchen",hMax:6,trieb:8,fl:7,sm:8,li:8,lk:2,gesamt:150},
{bot:"Schizophragma hydrangeoides",form:"WK",de:"Spalthortensie",hMax:12,trieb:5,fl:null,sm:null,li:null,lk:null,gesamt:330},
{bot:"Schizophragma integrifolium",form:"WK",de:"Ganzblättr. Spalthortensie",hMax:8,trieb:5,fl:null,sm:null,li:null,lk:null,gesamt:180},
{bot:"Vitis amurensis",form:"RS",de:"Amur-Rebe",hMax:6,trieb:8,fl:8,sm:9,li:10,lk:2,gesamt:160},
{bot:"Vitis coignetiae",form:"RS",de:"Scharlach-Rebe",hMax:12,trieb:30,fl:17,sm:26,li:20,lk:4,gesamt:890},
{bot:"Vitis riparia",form:"RS",de:"Ufer-Rebe",hMax:12,trieb:20,fl:13,sm:18,li:15,lk:3,gesamt:680},
{bot:"Vitis vinifera",form:"RS",de:"Weinrebe",hMax:10,trieb:12,fl:11,sm:12,li:13,lk:3,gesamt:420},
{bot:"Wisteria brachybotris",form:"S",de:"Seidenakazie",hMax:10,trieb:15,fl:10,sm:14,li:12,lk:3,gesamt:430},
{bot:"Wisteria floribunda",form:"S",de:"Japanischer Blauregen",hMax:12,trieb:25,fl:14,sm:22,li:17,lk:4,gesamt:740},
{bot:"Wisteria sinensis",form:"S",de:"Chin. Blauregen",hMax:30,trieb:50,fl:24,sm:42,li:28,lk:5,gesamt:3920},
];
const FORMS={"S":"Schlinger","RB":"Blattstielranker","RS":"Sprossranker","K":"Spreizklimmer","WK":"Wurzelkletterer","RH":"Haftscheibenranker"};
const FLL_LK={1:{fl:6,sm:6,li:6,psi:.55},2:{fl:11,sm:14,li:13,psi:.60},3:{fl:15,sm:19,li:18,psi:.60},4:{fl:17,sm:26,li:20,psi:.65},5:{fl:24,sm:42,li:28,psi:.70}};
const RASTER=[{id:"gitter",l:"Gitter",d:"H+V+Diag."},{id:"vertikal",l:"Vertikal",d:"Nur vertikal"},{id:"horizontal",l:"Horizontal",d:"Nur horizontal"},{id:"diagonal",l:"Diagonal",d:"Diagonalnetz"}];

// ─── SET Products ───────────────────────────────────────
const SETS=[
  {id:"eco200",l:"SET EJOT Iso-Bar ECO 200",art:"8779200110",nutzBeton:160,nutzMW:120,len:200},
  {id:"eco260",l:"SET EJOT Iso-Bar ECO 260",art:"8779260110",nutzBeton:220,nutzMW:180,len:260},
  {id:"eco320",l:"SET EJOT Iso-Bar ECO 320",art:"8779320110",nutzBeton:280,nutzMW:240,len:320},
  {id:"eco380",l:"SET EJOT Iso-Bar ECO 380",art:"8779380110",nutzBeton:340,nutzMW:300,len:380},
];

// ─── Seilkreuze ─────────────────────────────────────────
const SEILKREUZE=[
  {id:"ohne",l:"Ohne Seilkreuze",art:""},
  {id:"sk90a4",l:"Seilkreuz 90° - A4",art:"8779888006"},
  {id:"skverst",l:"Seilkreuz verstellbar - A4",art:"8779888003"},
  {id:"sk90k",l:"Seilkreuz 90° - Kunststoff",art:"8779888002"},
];

// ─── Verankerungsgründe (gem. Z-21.8-2083) ──────────────
const UNTERGRUENDE=[
  {id:"beton_c2025",l:"Beton C20/25",typ:"beton",druckf:"20",rohd:"2.4",nrk:"5.0",vrk:"3.0",gamma:"1.8"},
  {id:"beton_c2530",l:"Beton C25/30",typ:"beton",druckf:"25",rohd:"2.4",nrk:"5.0",vrk:"3.0",gamma:"1.8"},
  {id:"beton_c3037",l:"Beton C30/37",typ:"beton",druckf:"30",rohd:"2.4",nrk:"5.0",vrk:"3.0",gamma:"1.8"},
  {id:"beton_c5060",l:"Beton C50/60",typ:"beton",druckf:"50",rohd:"2.4",nrk:"5.0",vrk:"3.0",gamma:"1.8"},
  {id:"ks_vollstein",l:"Kalksand-Vollstein KS",typ:"mw",druckf:"12",rohd:"1.8",nrk:"3.1",vrk:"1.3",gamma:"2.5"},
  {id:"vollziegel",l:"Vollziegel Mz",typ:"mw",druckf:"12",rohd:"1.9",nrk:"2.2",vrk:"0.5",gamma:"2.5"},
  {id:"lbv",l:"Leichtbetonvollstein V",typ:"mw",druckf:"2",rohd:"0.65",nrk:"1.2",vrk:"1.2",gamma:"2.5"},
  {id:"hbl",l:"Hohlblock Leichtbeton Hbl",typ:"mw",druckf:"2",rohd:"0.5",nrk:"0.8",vrk:"1.2",gamma:"2.5"},
  {id:"ksl",l:"Kalksandlochstein KSL",typ:"mw",druckf:"12",rohd:"1.5",nrk:"1.9",vrk:"1.3",gamma:"2.5"},
  {id:"hlz1",l:"Hochlochziegel I Hlz",typ:"mw",druckf:"12",rohd:"0.9",nrk:"1.9",vrk:"0.5",gamma:"2.5"},
  {id:"hlz2",l:"Hochlochziegel II Hlz",typ:"mw",druckf:"24",rohd:"1.07",nrk:"3.2",vrk:"0.5",gamma:"2.5"},
  {id:"pp",l:"Porenbeton PP",typ:"mw",druckf:"4",rohd:"0.5",nrk:"3.3",vrk:"0.7",gamma:"2.0"},
  {id:"naturstein",l:"Naturstein (ohne Zulassung)",typ:"natur",druckf:"",rohd:"",nrk:"",vrk:"",gamma:""},
  {id:"custom",l:"– Manuell –",typ:"custom",druckf:"",rohd:"",nrk:"",vrk:"",gamma:""},
];

// ─── New enumerated option catalogs (more dropdowns) ────
const WINDLASTZONEN=[
  {v:"1",l:"WZ 1 – Binnenland (v_b,0 = 22,5 m/s)"},
  {v:"2",l:"WZ 2 – Binnenland-Küste (v_b,0 = 25,0 m/s)"},
  {v:"3",l:"WZ 3 – Küstennah (v_b,0 = 27,5 m/s)"},
  {v:"4",l:"WZ 4 – Küste / Inseln (v_b,0 = 30,0 m/s)"},
];
const GELAENDEKATEGORIEN=[
  {v:"I",  l:"GK I – Offene See, Seen"},
  {v:"II", l:"GK II – Offenes Gelände, vereinzelte Hindernisse"},
  {v:"III",l:"GK III – Vorstadt, Wald, dichte Bebauung"},
  {v:"IV", l:"GK IV – Stadtgebiete mit ≥15 % bebauter Fläche"},
  {v:"BV", l:"Bin/Vorland-Mischprofil (BVII)"},
];
const VERSIONEN=[
  {v:"V1.0",l:"V1.0 – Erstausgabe"},
  {v:"V1.1",l:"V1.1 – kleine Korrektur"},
  {v:"V2.0",l:"V2.0 – nach Statik"},
  {v:"V2.1",l:"V2.1 – Revision Material"},
  {v:"V3.0",l:"V3.0 – Ausführungsfreigabe"},
];
const LASTKLASSEN=[
  {v:"1",l:"LK 1 – sehr leicht"},
  {v:"2",l:"LK 2 – leicht"},
  {v:"3",l:"LK 3 – mittel (Standard)"},
  {v:"4",l:"LK 4 – schwer"},
  {v:"5",l:"LK 5 – sehr schwer"},
];
const WDVS_DICKEN=[
  {v:"",l:"– keine WDVS-Anwendung –"},
  {v:"60",l:"60 mm"},{v:"80",l:"80 mm"},{v:"100",l:"100 mm"},
  {v:"120",l:"120 mm"},{v:"140",l:"140 mm"},{v:"160",l:"160 mm"},
  {v:"180",l:"180 mm"},{v:"200",l:"200 mm"},{v:"220",l:"220 mm"},
  {v:"240",l:"240 mm"},{v:"260",l:"260 mm"},{v:"280",l:"280 mm"},{v:"300",l:"300 mm"},
];
const KLEBSCHICHT_DICKEN=[
  {v:"5",l:"5 mm"},{v:"8",l:"8 mm"},{v:"10",l:"10 mm (Standard)"},
  {v:"15",l:"15 mm"},{v:"20",l:"20 mm"},{v:"25",l:"25 mm"},
];
const GEOMETRIE_ARTEN=[
  {v:"flaechig",l:"Flächige Begrünung (≤ 2 m breit)"},
  {v:"schmal",  l:"Schmal flächig (≤ 1 m)"},
  {v:"linear",  l:"Linear (≤ 0,7 m)"},
];
const FOLIAGE_MATURITY=[
  {v:"young",l:"Jung (1–3 Jahre)"},
  {v:"mature",l:"Etabliert (4–7 Jahre)"},
  {v:"dense",l:"Dicht ausgewachsen (8+ Jahre)"},
];
// Höhe der ersten (untersten) Ankerlage über dem Boden.  Die unterste Reihe
// sitzt auf diesem Startversatz; das Raster läuft im LV-Abstand nach oben.
// "0" = kein Versatz (bisheriges Verhalten, Raster über die volle Höhe).
const LAGE1_HOEHEN=[
  {v:"0",   l:"kein Versatz (0 m)"},
  {v:"0.5", l:"0,50 m"},
  {v:"0.75",l:"0,75 m"},
  {v:"1",   l:"1,00 m"},
  {v:"1.25",l:"1,25 m"},
  {v:"1.5", l:"1,50 m"},
  {v:"2",   l:"2,00 m"},
];

// Endkappen / Seilhülsen werden je SEILENDE gesetzt — einmal am Anfang und
// einmal am Ende jedes gespannten Seils, NICHT pro Ankerpunkt.
//   vertikal:   (Spalten+1) Seile   → je 2 Enden
//   horizontal: (Reihen+1) Seile    → je 2 Enden
//   diagonal:   beide Richtungen, grob (Spalten+Reihen) Seile → je 2 Enden
function endcaps(hasV,hasH,hasD,colsCells,rowsCells){
  const c=Math.max(0,colsCells),r=Math.max(0,rowsCells);
  let ends=0;
  if(hasV) ends+=(c+1)*2;
  if(hasH) ends+=(r+1)*2;
  if(hasD) ends+=(c+r)*2;
  return ends;
}

// ─── Material calculator ────────────────────────────────
function calcMaterial(d){
  const f0=(d.fassaden||[])[0]||{};
  const lh=pf(f0.lh||d.LH)||.9,lv=pf(f0.lv||d.LV)||.9;
  const fw=pf(f0.breite||d.fassadenlaenge)||10,fh=pf(f0.hoehe||d.fassadenhoehe)||10;
  const off=pf(f0.lage1||d.Lage1)||0;            // Startversatz der untersten Lage
  const fhEff=Math.max(0,fh-off);                // begrünte/berankte Höhe oberhalb des Versatzes
  const cols=Math.floor(fw/lh),rows=Math.floor(fhEff/lv);
  const pts=(cols+1)*(rows+1);
  const area=fw*fhEff;
  const rt=f0.seilfuehrung||d.seilfuehrung||"gitter";
  const hasV=rt==="gitter"||rt==="vertikal";
  const hasH=rt==="gitter"||rt==="horizontal";
  const hasD=rt==="diagonal";
  const seilV=hasV?(cols+1)*fhEff:0;
  const seilH=hasH?(rows+1)*fw:0;
  const seilD=hasD?cols*rows*Math.sqrt(lh*lh+lv*lv)*2:0;
  const seilGes=seilV+seilH+seilD;
  const kreuze90=rt==="gitter"?(cols-1)*(rows-1):0;
  return {pts,area,cols:cols+1,rows:rows+1,
    seilV:seilV.toFixed(1),seilH:seilH.toFixed(1),seilD:seilD.toFixed(1),
    seilGes:(seilGes*1.1).toFixed(1),kreuze90,hasV,hasH,hasD,
    endkappen:endcaps(hasV,hasH,hasD,cols,rows),
    stkM2:area>0?(pts/area).toFixed(2):"0.00"};
}
function pf(v){return parseFloat(String(v).replace(",","."));}
function fm(v,d=2){return v?Number(v).toFixed(d).replace(".",","):"–";}

// ── German number formatting via Intl (handles thousands separator + decimal comma)
const _NF0 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const _NF1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const _NF2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtInt(n)   { return Number.isFinite(n) ? _NF0.format(Math.round(n)) : "–"; }
function fmtArea(n)  { return Number.isFinite(n) ? _NF1.format(n) + " m²" : "–"; }
function fmtLen(n)   { return Number.isFinite(n) ? _NF1.format(n) + " m"  : "–"; }
function fmtDec(n, d = 2) { return Number.isFinite(n) ? (d === 1 ? _NF1 : d === 0 ? _NF0 : _NF2).format(n) : "–"; }

// ── Per-facade material stats ─────────────────────────────
// Returns:  {name, breite, hoehe, area_brutto, area_excl, area,
//            anker, sk, cols, rows, sV, sH, sD, fromPlan, rects[]}
// `rects` is the per-greening-rectangle breakdown — when the user marks N
// areas on the plan we get N sub-rows; each gets its OWN anchor grid placed
// inside that rectangle.  Aggregating bbox-wide (the previous behaviour)
// silently dropped anchors that fell in the gaps between disjoint rects.
function calcFacadeStats(f, d) {
  const lh_m = pf(f.lh) || pf(d.LH) || 0.9;
  const lv_m = pf(f.lv) || pf(d.LV) || 0.9;
  const raster = f.seilfuehrung || d.seilfuehrung || "gitter";
  const sk = f.seilkreuztyp || d.seilkreuztyp || "ohne";
  const fw_m = pf(f.breite) || 0;
  const fh_m = pf(f.hoehe) || 0;
  // Höhe der ersten Lage (Startversatz unten): die unterste Ankerreihe sitzt
  // auf dieser Höhe, das Raster läuft im LV-Abstand bis zur Oberkante.
  const off_m = pf(f.lage1) || pf(d.Lage1) || 0;

  const ann = normalizeAnnotations(f.annotations);
  const havePlan = !!(f.plan && ann.facades.length > 0);

  const hasV = raster === "gitter" || raster === "vertikal";
  const hasH = raster === "gitter" || raster === "horizontal";
  const hasD = raster === "diagonal";

  if (!havePlan) {
    const fhEff = Math.max(0, fh_m - off_m);                 // berankte Höhe oberhalb des Versatzes
    const cols = Math.max(0, Math.floor(fw_m / lh_m));
    const rows = Math.max(0, Math.floor(fhEff / lv_m));
    const anker = (cols + 1) * (rows + 1);
    const sV = hasV ? (cols + 1) * fhEff : 0;
    const sH = hasH ? (rows + 1) * fw_m : 0;
    const sD = hasD ? cols * rows * Math.sqrt(lh_m * lh_m + lv_m * lv_m) * 2 : 0;
    let skCount = 0;
    if (sk !== "ohne") {
      if (raster === "gitter") skCount = cols * rows + cols * (rows + 1) + (cols + 1) * rows;
      else if (raster === "diagonal") skCount = cols * rows;
    }
    const single = {
      name: f.name,
      label: f.name,
      breite_m: fw_m, hoehe_m: fh_m,
      area_brutto: fw_m * fhEff,
      area_excl: 0,
      area: fw_m * fhEff,
      anker, sk: skCount,
      cols: cols + 1, rows: rows + 1,
      sV, sH, sD,
      endkappen: endcaps(hasV, hasH, hasD, cols, rows),
    };
    return {
      name: f.name, breite: fw_m, hoehe: fh_m,
      area_brutto: single.area_brutto,
      area_excl: 0,
      area: single.area,
      anker, sk: skCount,
      cols: cols + 1, rows: rows + 1,
      sV, sH, sD,
      endkappen: single.endkappen,
      fromPlan: false,
      rects: [single],
    };
  }

  // Plan-aware.  One anchor grid PER greening rect — placing the grid in
  // each rect avoids losing anchors to the gaps between disjoint rects.
  // Scale: prefer the user's explicit calibration; fall back to bbox vs
  // typed dimensions otherwise.
  const bbox = unionBBox(ann.facades);
  const pxM = pxPerMeter(ann, bbox, fw_m, fh_m);
  if (!pxM || pxM <= 0) {
    return {
      name: f.name, breite: fw_m, hoehe: fh_m,
      area_brutto: 0, area_excl: 0, area: 0,
      anker: 0, sk: 0, cols: 0, rows: 0,
      sV: 0, sH: 0, sD: 0, endkappen: 0,
      fromPlan: true,
      rects: [],
    };
  }
  const cellWpx = lh_m * pxM;
  const cellHpx = lv_m * pxM;
  const offPx   = off_m * pxM;                    // Startversatz der untersten Lage in Plan-Pixeln
  const exclusions = [...ann.windows, ...ann.doors];
  const diagPx = Math.sqrt(cellWpx * cellWpx + cellHpx * cellHpx);
  const diagM  = Math.sqrt(lh_m * lh_m + lv_m * lv_m);

  const rects = ann.facades.map((g, idx) => {
    const breite_m = g.w / pxM;
    const hoehe_m  = g.h / pxM;
    const effHpx   = Math.max(0, g.h - offPx);    // berankbare Höhe oberhalb des Versatzes
    const colsR = Math.max(0, Math.floor(breite_m / lh_m));
    const rowsR = Math.max(0, Math.floor(effHpx / cellHpx));
    const totalGridW = colsR * cellWpx;
    const totalGridH = rowsR * cellHpx;
    const ax0 = g.x + (g.w - totalGridW) / 2;
    // Mit Versatz: unterste Reihe sitzt offPx über dem Boden, Raster läuft nach
    // oben.  Ohne Versatz: wie bisher mittig in der Fläche.
    const ay0 = offPx > 0
      ? g.y + g.h - offPx - totalGridH
      : g.y + (g.h - totalGridH) / 2;
    const onlyHere = [g];

    let anker = 0;
    for (let c = 0; c <= colsR; c++) for (let r = 0; r <= rowsR; r++) {
      const p = { x: ax0 + c * cellWpx, y: ay0 + r * cellHpx };
      if (!pointInRect(p, g, 1)) continue;
      if (pointInAny(p, exclusions, -2)) continue;
      anker++;
    }

    let sV = 0, sH = 0, sD = 0;
    if (hasV) for (let c = 0; c <= colsR; c++) {
      sV += lineInsideLengthPx(ax0 + c * cellWpx, ay0, ax0 + c * cellWpx, ay0 + totalGridH,
                               onlyHere, exclusions) / pxM;
    }
    if (hasH) for (let r = 0; r <= rowsR; r++) {
      sH += lineInsideLengthPx(ax0, ay0 + r * cellHpx, ax0 + totalGridW, ay0 + r * cellHpx,
                               onlyHere, exclusions) / pxM;
    }
    if (hasD) {
      for (let c = 0; c < colsR; c++) for (let r = 0; r < rowsR; r++) {
        const l1 = lineInsideLengthPx(ax0 + c * cellWpx, ay0 + r * cellHpx,
                                       ax0 + (c + 1) * cellWpx, ay0 + (r + 1) * cellHpx,
                                       onlyHere, exclusions);
        const l2 = lineInsideLengthPx(ax0 + (c + 1) * cellWpx, ay0 + r * cellHpx,
                                       ax0 + c * cellWpx, ay0 + (r + 1) * cellHpx,
                                       onlyHere, exclusions);
        sD += ((l1 + l2) / diagPx) * diagM;
      }
    }

    let skR = 0;
    if (sk !== "ohne") {
      const skPts = [];
      if (raster === "gitter") {
        for (let c = 0; c < colsR; c++) for (let r = 0; r < rowsR; r++) skPts.push({ x: ax0 + (c + 0.5) * cellWpx, y: ay0 + (r + 0.5) * cellHpx });
        for (let c = 0; c < colsR; c++) for (let r = 0; r <= rowsR; r++) skPts.push({ x: ax0 + (c + 0.5) * cellWpx, y: ay0 + r * cellHpx });
        for (let c = 0; c <= colsR; c++) for (let r = 0; r < rowsR; r++) skPts.push({ x: ax0 + c * cellWpx, y: ay0 + (r + 0.5) * cellHpx });
      } else if (raster === "diagonal") {
        for (let c = 0; c < colsR; c++) for (let r = 0; r < rowsR; r++) skPts.push({ x: ax0 + (c + 0.5) * cellWpx, y: ay0 + (r + 0.5) * cellHpx });
      }
      skR = skPts.filter(p => pointInRect(p, g, 1) && !pointInAny(p, exclusions, -2)).length;
    }

    const area_brutto = breite_m * hoehe_m;
    let area_excl_px = 0;
    for (const e of exclusions) area_excl_px += rectIntersectionArea(g, e);
    const area_excl = area_excl_px / (pxM * pxM);
    // Der unberankte Bodenstreifen unterhalb der ersten Lage zählt nicht zur Begrünungsfläche.
    const baseStrip = offPx > 0 ? breite_m * Math.min(off_m, hoehe_m) : 0;
    const area = Math.max(0, area_brutto - area_excl - baseStrip);

    return {
      name: f.name + (ann.facades.length > 1 ? ` · Fläche ${idx + 1}` : ""),
      label: ann.facades.length > 1 ? `Fläche ${idx + 1}` : f.name,
      rectIndex: idx,
      breite_m, hoehe_m,
      area_brutto, area_excl, area,
      anker, sk: skR,
      cols: colsR + 1, rows: rowsR + 1,
      sV, sH, sD,
      endkappen: endcaps(hasV, hasH, hasD, colsR, rowsR),
    };
  });

  // Aggregate
  const sumKey = k => rects.reduce((s, r) => s + r[k], 0);
  return {
    name: f.name, breite: fw_m, hoehe: fh_m,
    area_brutto: sumKey("area_brutto"),
    area_excl:   sumKey("area_excl"),
    area:        sumKey("area"),
    anker:       sumKey("anker"),
    sk:          sumKey("sk"),
    sV:          sumKey("sV"),
    sH:          sumKey("sH"),
    sD:          sumKey("sD"),
    endkappen:   sumKey("endkappen"),
    cols: 0, rows: 0,
    fromPlan: true,
    rects,
  };
}

// ─── Components ─────────────────────────────────────────
function Sub({children:s}){
  if(typeof s!=="string")return s;
  const p=[];let i=0,k=0;
  while(i<s.length){const u=s.indexOf("_",i);if(u===-1){p.push(s.slice(i));break;}
    if(u>i)p.push(s.slice(i,u));let j=u+1,sub="";
    while(j<s.length&&/[A-Za-z0-9,.]/.test(s[j])){sub+=s[j];j++;}
    p.push(<sub key={k++}>{sub}</sub>);i=j;}
  return <>{p}</>;
}

function NwBar({label,value}){
  const v=pf(value)||0;const pct=Math.min(v,1.1)*100;
  const col=v<.5?GN:v<.8?AM:R;
  return(<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
    <div style={{width:160,fontSize:12,color:DK}}><Sub>{label}</Sub></div>
    <div style={{flex:1,height:18,background:"#ECECEC",borderRadius:9,position:"relative",overflow:"hidden",border:`1px solid ${BD}`}}>
      <div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:`linear-gradient(90deg, ${col}, ${col}dd)`,borderRadius:9,transition:"width .3s"}}/>
      <span style={{position:"absolute",right:pct>55?8:"auto",left:pct<=55?`${Math.min(pct,100)}%`:"auto",marginLeft:pct<=55?8:0,top:"50%",transform:"translateY(-50%)",fontSize:11,fontWeight:700,color:pct>55?WH:BK}}>{v?v.toFixed(2):"–"}</span>
    </div>
    <span style={{fontSize:14,fontWeight:700,color:v&&v<=1?GN:v>1?R:GL,width:18,textAlign:"center"}}>{v?(v<=1?"✓":"✗"):"–"}</span>
  </div>);
}

// Field: text / number / select / dropdown.  `sel` triggers <select>, `opts` is the option list.
function Field({label,value,onChange,unit,half,ro,sel,opts,hint,full}){
  const flex=full?"1 1 100%":half?"0 0 48%":"1 1 48%";
  return(<div style={{flex,minWidth:120,marginBottom:9}}>
    <label style={{fontSize:10.5,color:GY,display:"block",marginBottom:3,fontWeight:600,letterSpacing:.1}}><Sub>{label}</Sub></label>
    <div style={{display:"flex",border:`1px solid ${BD}`,borderRadius:5,background:ro?BG:WH,transition:"border-color .15s",position:"relative"}}
      onFocus={e=>e.currentTarget.style.borderColor=R}
      onBlur={e=>e.currentTarget.style.borderColor=BD}>
      {sel
        ? <select value={value??""} onChange={e=>onChange?.(e.target.value)} style={{flex:1,border:"none",padding:"7px 8px",fontSize:12,fontWeight:600,background:"transparent",outline:"none",fontFamily:"inherit",color:BK,cursor:"pointer",appearance:"none"}}>
            {opts.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}
          </select>
        : <input value={value??""} onChange={e=>onChange?.(e.target.value)} readOnly={ro} style={{flex:1,border:"none",padding:"7px 8px",fontSize:12,fontWeight:600,background:"transparent",outline:"none",fontFamily:"inherit",color:BK,minWidth:0}}/>
      }
      {unit&&<span style={{padding:"0 8px",fontSize:10,color:GL,whiteSpace:"nowrap",alignSelf:"center"}}>{unit}</span>}
      {sel&&<span style={{padding:"0 8px",alignSelf:"center",color:GL,fontSize:10,pointerEvents:"none"}}>▾</span>}
    </div>
    {hint&&<div style={{fontSize:9.5,color:GL,marginTop:2}}>{hint}</div>}
  </div>);
}

function Sec({title,children,accent,icon,open:defOpen=true,subtitle}){
  const[o,setO]=useState(defOpen);
  return(<div style={{border:`1px solid ${accent?RM:BD}`,borderRadius:8,marginBottom:12,background:WH,boxShadow:"0 1px 3px rgba(0,0,0,.04)",overflow:"hidden"}}>
    <div onClick={()=>setO(!o)} style={{padding:"10px 14px",borderBottom:o?`1px solid ${accent?RM:BD}`:"none",background:accent?`linear-gradient(90deg, ${RL}, ${WH})`:`linear-gradient(90deg, ${BG}, ${WH})`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        {icon&&<span style={{fontSize:13,color:accent?R:GY}}>{icon}</span>}
        <div>
          <div style={{fontWeight:700,fontSize:11.5,letterSpacing:.4,textTransform:"uppercase",color:accent?R:BK}}>{title}</div>
          {subtitle&&<div style={{fontSize:10,color:GL,fontWeight:500,marginTop:1}}>{subtitle}</div>}
        </div>
      </div>
      <span style={{fontSize:10,color:GL,transition:"transform .2s",transform:o?"rotate(0deg)":"rotate(-90deg)"}}>▼</span></div>
    {o&&<div style={{padding:"14px 16px"}}>{children}</div>}</div>);
}

function KV({l,v,b}){return(<div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}>
  <span style={{color:GY}}><Sub>{l}</Sub></span><span style={{fontWeight:b?700:600,color:BK,textAlign:"right"}}>{v||"–"}</span></div>);}

// Parse-feedback banner shown after a PDF upload.  Lists the missing fields
// in German and lets the user expand the raw extracted text so they can spot
// values manually — useful when the PDF's wording doesn't match our regex
// catalog.
function ParseFeedbackBanner({info,onClose}){
  const[showRaw,setShowRaw]=useState(false);
  const hitsTotal=Object.keys(FIELD_LABELS).length;
  const hitsCount=info.hits.length;
  const ok=hitsCount>0;
  const stripped=(info.rawText||"").trim();
  const preview=stripped.length>5000?stripped.slice(0,5000)+"\n…":stripped;
  const missLabels=info.misses.map(k=>FIELD_LABELS[k]||k);
  return(<div style={{maxWidth:980,margin:"12px auto 0",padding:"0 14px"}}>
    <div style={{padding:"10px 14px",background:ok?"#E8F5E9":"#FFF8E1",border:`1px solid ${ok?GN+"40":AM+"40"}`,borderRadius:8,fontSize:12}}>
      <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
        <span style={{fontSize:16,marginTop:1}}>{ok?"✓":"⚠"}</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,color:ok?GN:AM}}>
            {ok
              ? `${hitsCount} von ${hitsTotal} Feldern aus PDF erkannt (${info.rawLen.toLocaleString("de-DE")} Zeichen)`
              : "Keine Felder im PDF erkannt – bitte manuell eingeben."}
          </div>
          {missLabels.length>0&&<details style={{marginTop:4}}>
            <summary style={{cursor:"pointer",color:GY,fontSize:10.5,userSelect:"none"}}>
              {missLabels.length} fehlende Felder anzeigen
            </summary>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
              {missLabels.map(l=><span key={l} style={{padding:"2px 7px",background:WH,border:`1px solid ${BD}`,borderRadius:10,fontSize:10,color:DK}}>{l}</span>)}
            </div>
            <div style={{fontSize:10,color:GL,marginTop:6}}>
              Tipp: Wenn diese Werte im PDF stehen aber nicht erkannt wurden, kannst du sie unten manuell ergänzen. Der Rohtext unten zeigt was wir extrahiert haben.
            </div>
          </details>}
        </div>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>setShowRaw(!showRaw)} title={showRaw?"Rohtext ausblenden":"Roher PDF-Text anzeigen"}
            style={{padding:"3px 9px",fontSize:11,border:`1px solid ${BD}`,borderRadius:5,background:showRaw?BG:WH,cursor:"pointer",color:DK,fontWeight:600}}>
            📄 {showRaw?"Rohtext aus":"Rohtext"}
          </button>
          <button onClick={onClose} style={{padding:"3px 8px",fontSize:11,border:`1px solid ${BD}`,borderRadius:5,background:WH,cursor:"pointer",color:GY}}>×</button>
        </div>
      </div>
      {showRaw&&<div style={{marginTop:10,borderTop:`1px solid ${BD}`,paddingTop:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <span style={{fontWeight:700,fontSize:10.5,color:DK,textTransform:"uppercase",letterSpacing:.4}}>Roher PDF-Text</span>
          <button onClick={()=>{navigator.clipboard&&navigator.clipboard.writeText(stripped);}}
            style={{padding:"3px 8px",fontSize:10,border:`1px solid ${BD}`,borderRadius:4,background:WH,cursor:"pointer",color:GY,fontWeight:600}}>
            📋 Kopieren
          </button>
        </div>
        <pre style={{margin:0,padding:"8px 10px",background:"#FAFAF7",border:`1px solid ${BD}`,borderRadius:5,fontSize:10.5,fontFamily:"ui-monospace, Consolas, monospace",color:DK,maxHeight:280,overflow:"auto",whiteSpace:"pre-wrap",wordBreak:"break-word",lineHeight:1.4}}>{preview||"– kein Text extrahiert –"}</pre>
        <div style={{fontSize:9.5,color:GL,marginTop:4}}>
          Dies ist der Text, den der PDF-Parser aus deinem Dokument gelesen hat. Tab-Zeichen markieren Spalten.
          Wenn ein Wert hier steht aber oben nicht erkannt wurde, sag Bescheid welches Format dein PDF benutzt — dann ergänze ich das Pattern.
        </div>
      </div>}
    </div>
  </div>);
}

// Big-number stat tile for the headline summary card in MaterialSection
function Stat({label,value,unit,hint,accent,color,valueSize=22}){
  const c=color||(accent?R:BK);
  return(<div style={{padding:"2px 4px"}}>
    <div style={{fontSize:9.5,fontWeight:700,color:GY,textTransform:"uppercase",letterSpacing:.4,marginBottom:3}}>{label}</div>
    <div style={{display:"flex",alignItems:"baseline",gap:4,lineHeight:1}}>
      <span style={{fontSize:valueSize,fontWeight:800,color:c}}>{value}</span>
      {unit&&<span style={{fontSize:11,fontWeight:600,color:GY}}>{unit}</span>}
    </div>
    {hint&&<div style={{fontSize:9,color:GL,marginTop:3}}>{hint}</div>}
  </div>);
}

function PageHead({title,subtitle}){
  return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
    <span style={{fontWeight:900,fontSize:22,color:R}}>EJOT<sup style={{fontSize:7}}>®</sup></span>
    <div style={{textAlign:"right"}}><div style={{fontSize:16,fontWeight:700,color:BK}}>{title}</div>
      {subtitle&&<div style={{fontSize:10,color:GY}}>{subtitle}</div>}</div></div>);
}

// ─── Per-facade plan upload + annotator ─────────────────
function FacadePlanPanel({facade,onUpdate}){
  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState("");
  const inRef=useRef(null);

  const handle=useCallback(async e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    setLoading(true);setErr("");
    try{
      const plan=await loadPlanImage(file);
      onUpdate({plan,annotations:{facades:[],windows:[],doors:[]}});
    }catch(er){console.error(er);setErr(er.message||String(er));}
    finally{setLoading(false);if(inRef.current)inRef.current.value="";}
  },[onUpdate]);

  if(!facade.plan){
    return(<div style={{border:`1.5px dashed ${BD}`,borderRadius:8,padding:14,background:WH,textAlign:"center"}}>
      <div style={{fontSize:11.5,color:DK,fontWeight:600,marginBottom:6}}>
        Fassadenplan hochladen (optional)
      </div>
      <div style={{fontSize:10,color:GL,marginBottom:10}}>
        PDF (1 Seite) oder Bild · wird als Hintergrund für Vorschau & Rasterdarstellung verwendet
      </div>
      <input ref={inRef} type="file" accept="image/*,application/pdf" onChange={handle} style={{display:"none"}}/>
      <button onClick={()=>inRef.current?.click()} disabled={loading}
        style={{padding:"7px 16px",fontSize:11,fontWeight:700,border:`1px solid ${R}`,borderRadius:6,
          background:loading?BG:`linear-gradient(135deg, ${R}, #A40C24)`,color:loading?GY:WH,cursor:loading?"wait":"pointer",
          display:"inline-flex",alignItems:"center",gap:6}}>
        {loading
          ?<><span style={{display:"inline-block",width:10,height:10,border:`2px solid ${BD}`,borderTopColor:R,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>Plan wird geladen …</>
          :<>📐 Plan auswählen</>}
      </button>
      {err&&<div style={{marginTop:10,fontSize:11,color:R,background:"#FFEBEE",padding:"6px 10px",borderRadius:5,border:`1px solid ${R}40`}}>
        Fehler: {err}
      </div>}
    </div>);
  }
  return(<div style={{border:`1px solid ${BD}`,borderRadius:8,padding:12,background:WH}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
      <div style={{fontSize:11.5,fontWeight:700,color:DK,display:"flex",alignItems:"center",gap:8}}>
        <span style={{padding:"2px 8px",background:RL,color:R,borderRadius:10,fontSize:10}}>{facade.plan.kind==="pdf"?"PDF":"BILD"}</span>
        Plan annotieren
        {(facade.annotations?.facades?.length>0||facade.annotations?.facade)
          ?<span style={{color:GN,fontSize:10,fontWeight:600}}>✓ {facade.annotations?.facades?.length||1} Begrünungsfläche{(facade.annotations?.facades?.length||1)===1?"":"n"}</span>
          :<span style={{color:AM,fontSize:10,fontWeight:600}}>⚠ Begrünungsfläche fehlt noch</span>}
      </div>
      <div style={{display:"flex",gap:6}}>
        <input ref={inRef} type="file" accept="image/*,application/pdf" onChange={handle} style={{display:"none"}}/>
        <button onClick={()=>inRef.current?.click()} disabled={loading}
          style={{padding:"5px 10px",fontSize:10,fontWeight:600,border:`1px solid ${BD}`,borderRadius:5,background:WH,color:DK,cursor:"pointer"}}>
          ↺ Plan ersetzen
        </button>
        <button onClick={()=>onUpdate({plan:null,annotations:null})}
          style={{padding:"5px 10px",fontSize:10,fontWeight:600,border:`1px solid ${BD}`,borderRadius:5,background:WH,color:R,cursor:"pointer"}}>
          ✕ Plan entfernen
        </button>
      </div>
    </div>
    <PlanAnnotator plan={facade.plan} annotations={facade.annotations}
      onChange={a=>onUpdate({annotations:a})} height={460}
      facadeWidthM={pf(facade.breite)||0} facadeHeightM={pf(facade.hoehe)||0}/>
  </div>);
}

// ─── PDF Section Components (reusable for on-screen + off-screen) ───
// One-fassade visualization card used by both PreviewSection and MaterialSection
// when the project contains multiple facades.  Shows:
//   - Header: facade name + dimensions + raster type + Seilkreuztyp
//   - Plan-based realistic view (only if a plan + greening rect exist)
//   - Schematic view (always)
//   - A small stat row pulled from calcFacadeStats(f, d)
// Per-facade card for PreviewSection — foliage RealisticFacade.
// Same stacked layout philosophy as FacadeRasterCard.
function FacadeReportCard({d,facade,index,total,formCode,coverage,maturity}){
  const fRaster=facade.seilfuehrung||d.seilfuehrung||"gitter";
  const fSK=facade.seilkreuztyp||d.seilkreuztyp||"ohne";
  const fLH=facade.lh||d.LH||"0.9";
  const fLV=facade.lv||d.LV||"0.9";
  const fLage1=facade.lage1??d.Lage1??"0";
  const fW=facade.breite||"10";
  const fH=facade.hoehe||"6";
  const havePlan=!!(facade.plan&&facade.annotations&&(facade.annotations.facades||[]).length>0);
  const stats=calcFacadeStats(facade,d);
  const labelStyle={fontSize:10,fontWeight:700,color:GY,textTransform:"uppercase",letterSpacing:.4,marginBottom:6,display:"flex",justifyContent:"space-between"};
  return(<div data-pdf-page="facade" style={{border:`1px solid ${BD}`,borderRadius:6,padding:14,marginBottom:14,background:"#FAFAF8",pageBreakInside:"avoid",breakInside:"avoid"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${BD}`}}>
      <div>
        <span style={{fontWeight:800,fontSize:14,color:BK}}>
          {total>1?<span style={{color:GL,fontWeight:600}}>Fassade {index+1} · </span>:null}
          {facade.name||`Fassade ${index+1}`}
        </span>
        <span style={{fontSize:11,color:GY,marginLeft:8}}>· {fW} × {fH} m{(pf(fLage1)||0)>0?` · 1. Lage ${fm(pf(fLage1),2)} m`:""}</span>
      </div>
      <span style={{fontSize:10.5,color:GY,fontWeight:600}}>
        {RASTER.find(r=>r.id===fRaster)?.l}
        {fSK!=="ohne"&&<span style={{color:GL}}> + {SEILKREUZE.find(s=>s.id===fSK)?.l}</span>}
      </span>
    </div>
    {havePlan&&<div style={{marginBottom:14}}>
      <div style={labelStyle}>
        <span>📐 Vorschau im Plan</span>
        <span style={{fontWeight:500,color:GL,letterSpacing:0,textTransform:"none"}}>Bewuchs + Anker auf hochgeladenem Plan</span>
      </div>
      <div style={{display:"flex",justifyContent:"center"}}>
        <RealisticFacade fW={fW} fH={fH} LH={fLH} LV={fLV} rasterType={fRaster}
          lage1={fLage1} seilkreuztyp={fSK} coverage={coverage} maturity={maturity}
          formCode={formCode} size={820} maxHeight={640}
          plan={facade.plan} annotations={facade.annotations}/>
      </div>
    </div>}
    <div>
      <div style={labelStyle}>
        <span>🌿 Schematische Bewuchs-Vorschau</span>
        <span style={{fontWeight:500,color:GL,letterSpacing:0,textTransform:"none"}}>wie die Fassade aussehen kann</span>
      </div>
      <div style={{display:"flex",justifyContent:"center"}}>
        <RealisticFacade fW={fW} fH={fH} LH={fLH} LV={fLV} rasterType={fRaster}
          lage1={fLage1} seilkreuztyp={fSK} coverage={coverage} maturity={maturity}
          formCode={formCode} size={520} maxHeight={520} forceProcedural/>
      </div>
    </div>
    {/* Per-facade stat row */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginTop:12,paddingTop:10,borderTop:`1px solid ${BD}`,fontSize:11}}>
      <div><span style={{color:GY,fontWeight:600,fontSize:9.5,textTransform:"uppercase",letterSpacing:.4,display:"block",marginBottom:1}}>Netto-Fläche</span><span style={{fontWeight:700,color:BK,fontSize:12}}>{fmtArea(stats.area)}</span></div>
      <div><span style={{color:GY,fontWeight:600,fontSize:9.5,textTransform:"uppercase",letterSpacing:.4,display:"block",marginBottom:1}}>Iso-Bar ECO</span><span style={{fontWeight:700,color:R,fontSize:12}}>{fmtInt(stats.anker)} <span style={{fontSize:9.5,color:GY,fontWeight:600}}>Stk</span></span></div>
      {stats.sk>0&&<div><span style={{color:GY,fontWeight:600,fontSize:9.5,textTransform:"uppercase",letterSpacing:.4,display:"block",marginBottom:1}}>Seilkreuze</span><span style={{fontWeight:700,color:"#1565C0",fontSize:12}}>{fmtInt(stats.sk)} <span style={{fontSize:9.5,color:GY,fontWeight:600}}>Stk</span></span></div>}
      {(stats.sV+stats.sH+stats.sD)>0&&<div><span style={{color:GY,fontWeight:600,fontSize:9.5,textTransform:"uppercase",letterSpacing:.4,display:"block",marginBottom:1}}>Seil gesamt</span><span style={{fontWeight:700,color:BK,fontSize:12}}>{fmtLen((stats.sV+stats.sH+stats.sD)*1.1)}</span></div>}
      {stats.fromPlan&&<div><span style={{color:GY,fontWeight:600,fontSize:9.5,textTransform:"uppercase",letterSpacing:.4,display:"block",marginBottom:1}}>Quelle</span><span style={{fontWeight:700,color:R,fontSize:11}}>📐 Plan</span></div>}
    </div>
  </div>);
}

// Per-facade card for the MaterialSection — uses the technical RasterOverlay
// (CAD anchors + Seilkreuze) rather than the foliage RealisticFacade.
//
// Layout: stacked vertically (plan on top, schematic below) so each gets the
// FULL width and the Plan stays readable.  maxHeight props prevent narrow
// facades from blowing up into multi-page-tall strips.
// data-pdf-page makes the PDF exporter start a new page at this card.
function FacadeRasterCard({d,facade,index,total}){
  const fRaster=facade.seilfuehrung||d.seilfuehrung||"gitter";
  const fSK=facade.seilkreuztyp||d.seilkreuztyp||"ohne";
  const fLH=facade.lh||d.LH||"0.9";
  const fLV=facade.lv||d.LV||"0.9";
  const fLage1=facade.lage1??d.Lage1??"0";
  const fW=facade.breite||"10";
  const fH=facade.hoehe||"6";
  const havePlan=!!(facade.plan&&facade.annotations&&(facade.annotations.facades||[]).length>0);
  const stats=calcFacadeStats(facade,d);
  const labelStyle={fontSize:10,fontWeight:700,color:GY,textTransform:"uppercase",letterSpacing:.4,marginBottom:6,display:"flex",justifyContent:"space-between"};
  return(<div data-pdf-page="facade" style={{border:`1px solid ${BD}`,borderRadius:6,padding:14,marginBottom:14,background:"#FAFAF8",pageBreakInside:"avoid",breakInside:"avoid"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:12,paddingBottom:8,borderBottom:`1px solid ${BD}`}}>
      <div>
        <span style={{fontWeight:800,fontSize:14,color:BK}}>
          {total>1?<span style={{color:GL,fontWeight:600}}>Fassade {index+1} · </span>:null}
          {facade.name||`Fassade ${index+1}`}
        </span>
        <span style={{fontSize:11,color:GY,marginLeft:8}}>· {fW} × {fH} m · LH {fLH} / LV {fLV}{(pf(fLage1)||0)>0?` · 1. Lage ${fm(pf(fLage1),2)} m`:""}</span>
      </div>
      <span style={{fontSize:10.5,color:GY,fontWeight:600}}>
        {RASTER.find(r=>r.id===fRaster)?.l}
        {fSK!=="ohne"&&<span style={{color:GL}}> + {SEILKREUZE.find(s=>s.id===fSK)?.l}</span>}
      </span>
    </div>
    {havePlan&&<div style={{marginBottom:14}}>
      <div style={labelStyle}>
        <span>📐 Im Plan</span>
        <span style={{fontWeight:500,color:GL,letterSpacing:0,textTransform:"none"}}>Anker + Kabel auf dem hochgeladenen Plan</span>
      </div>
      <div style={{display:"flex",justifyContent:"center"}}>
        <RasterOverlay LH={fLH} LV={fLV} fW={fW} fH={fH} rasterType={fRaster}
          lage1={fLage1} seilkreuztyp={fSK} size={820} maxHeight={620}
          plan={facade.plan} annotations={facade.annotations}/>
      </div>
    </div>}
    <div>
      <div style={labelStyle}>
        <span>▦ Schematische Rasterdarstellung</span>
        <span style={{fontWeight:500,color:GL,letterSpacing:0,textTransform:"none"}}>Anker, Kabel{fSK!=="ohne"?" und Seilkreuze":""} im Detail</span>
      </div>
      <div style={{display:"flex",justifyContent:"center"}}>
        <RasterOverlay LH={fLH} LV={fLV} fW={fW} fH={fH} rasterType={fRaster}
          lage1={fLage1} seilkreuztyp={fSK} size={460} maxHeight={480} forceProcedural/>
      </div>
    </div>
    {/* Per-facade material subtotal */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginTop:12,paddingTop:10,borderTop:`1px solid ${BD}`,fontSize:11}}>
      <div><span style={{color:GY,fontWeight:600,fontSize:9.5,textTransform:"uppercase",letterSpacing:.4,display:"block",marginBottom:1}}>Brutto</span><span style={{fontWeight:700,color:BK,fontSize:11.5}}>{fmtArea(stats.area_brutto)}</span></div>
      {stats.area_excl>0&&<div><span style={{color:GY,fontWeight:600,fontSize:9.5,textTransform:"uppercase",letterSpacing:.4,display:"block",marginBottom:1}}>Aussparungen</span><span style={{fontWeight:700,color:AM,fontSize:11.5}}>− {fmtArea(stats.area_excl)}</span></div>}
      <div><span style={{color:GY,fontWeight:600,fontSize:9.5,textTransform:"uppercase",letterSpacing:.4,display:"block",marginBottom:1}}>Netto</span><span style={{fontWeight:700,color:BK,fontSize:11.5}}>{fmtArea(stats.area)}</span></div>
      <div><span style={{color:GY,fontWeight:600,fontSize:9.5,textTransform:"uppercase",letterSpacing:.4,display:"block",marginBottom:1}}>Iso-Bar ECO</span><span style={{fontWeight:700,color:R,fontSize:12}}>{fmtInt(stats.anker)} <span style={{fontSize:9.5,color:GY,fontWeight:600}}>Stk</span></span></div>
      {stats.sk>0&&<div><span style={{color:GY,fontWeight:600,fontSize:9.5,textTransform:"uppercase",letterSpacing:.4,display:"block",marginBottom:1}}>Seilkreuze</span><span style={{fontWeight:700,color:"#1565C0",fontSize:12}}>{fmtInt(stats.sk)} <span style={{fontSize:9.5,color:GY,fontWeight:600}}>Stk</span></span></div>}
      {(stats.sV+stats.sH+stats.sD)>0&&<div><span style={{color:GY,fontWeight:600,fontSize:9.5,textTransform:"uppercase",letterSpacing:.4,display:"block",marginBottom:1}}>Seil V+H+D</span><span style={{fontWeight:700,color:BK,fontSize:11.5}}>{fmtLen(stats.sV+stats.sH+stats.sD)}</span></div>}
      {stats.fromPlan&&<div><span style={{color:GY,fontWeight:600,fontSize:9.5,textTransform:"uppercase",letterSpacing:.4,display:"block",marginBottom:1}}>Quelle</span><span style={{fontWeight:700,color:R,fontSize:11}}>📐 Plan</span></div>}
    </div>
  </div>);
}

function PreviewSection({d,maxNw,mat,withRealistic=true}){
  const f0=(d.fassaden||[])[0]||{};
  const prvRaster=f0.seilfuehrung||d.seilfuehrung||"gitter";
  const prvSK=f0.seilkreuztyp||d.seilkreuztyp||"ohne";
  const prvLH=f0.lh||d.LH||"0.9";
  const prvLV=f0.lv||d.LV||"0.9";
  const prvLage1=f0.lage1??d.Lage1??"0";
  const prvW=f0.breite||d.fassadenlaenge||"3";
  const prvH=f0.hoehe||d.fassadenhoehe||"3";
  const prvPlan=f0.plan||null;
  const prvAnn=f0.annotations||null;
  const selectedPlant=FLL_PLANTS.find(p=>p.bot===d.pflanze_botanisch);
  const formCode=selectedPlant?selectedPlant.form:"S";
  const fassaden=d.fassaden||[];
  const cov=pf(d.coverage)||65;
  const maturityVal=d.maturity||"mature";
  const unannotatedPlans=fassaden.filter(f=>f.plan&&!(f.annotations?.facades?.length>0));
  return(<div style={{background:WH}}>
    {/* COVER PAGE: project info + kernergebnisse */}
    <div data-pdf-page="header" style={{borderTop:`3px solid ${R}`,padding:"16px 24px"}}>
      <PageHead title="Vorbemessung Fassadenbegrünung" subtitle="ISO-Bar ECO, Vorab-Auslegung (ohne Ausführungsplanung)"/>
      <div style={{borderTop:`1px solid ${R}`,paddingTop:3,fontSize:9.5,color:GY,marginBottom:14}}>
        Dokument: {d.dokNr||"–"} · Version: {d.version||"–"} · Datum: {d.datum}</div>
      <div style={{display:"flex",gap:12,marginBottom:14}}>
        <div style={{flex:1,border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
          <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:6,color:BK}}>Projekt</div>
          <KV l="Bauvorhaben" v={d.bauvorhaben} b/><KV l="Ort / PLZ" v={d.ort_plz} b/><KV l="Datum" v={d.datum} b/>
          <div style={{fontSize:8.5,color:GL,marginTop:5}}>Dok-Nr.: {d.dokNr} · Bearbeiter: {d.bearbeiter||"–"}</div></div>
        <div style={{flex:1,border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
          <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:6,color:BK}}>System</div>
          <KV l="Produkt" v={(SETS.find(s=>s.id===d.produkt)||{}).l||d.produkt} b/>
          <KV l="Artikelnummer" v={(SETS.find(s=>s.id===d.produkt)||{}).art||"–"}/>
          <KV l="Verankerungsgrund" v={(UNTERGRUENDE.find(u=>u.id===d.verankerungsgrund)||{}).l||d.verankerungsgrund} b/>
          <KV l="WDVS-Dicke" v={d.wdvs_dicke?`${d.wdvs_dicke} mm`:""} b/>
          <KV l="Gebäudehöhe" v={d.gebaeudehoehe?`${d.gebaeudehoehe} m`:""} b/></div></div>
      <div style={{border:`1px solid ${RM}`,borderRadius:4,padding:12,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:8,color:R}}>Kernergebnisse</div>
        {[["Produkt",(SETS.find(s=>s.id===d.produkt)||{}).l||d.produkt],
          ["Max. horizontaler Abstand (LH)",d.LH?`${d.LH} m`:"–"],["Max. vertikaler Abstand (LV)",d.LV?`${d.LV} m`:"–"],
          ["Erforderliche ISO-Bar ECO pro m²",d.stk_m2||"–"]].map(([k,v])=>
          <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:13}}>
            <span style={{color:DK}}>{k}</span><span style={{fontWeight:700,fontSize:14,color:BK}}>{v}</span></div>)}</div>
      {fassaden.length>1&&<div style={{padding:"8px 12px",background:"#E8F5E9",border:"1px solid #2E7D3240",borderRadius:5,fontSize:10.5,color:"#1B5E20",marginBottom:10}}>
        Diese Vorbemessung umfasst <strong>{fassaden.length} Fassaden</strong>{selectedPlant?` mit ${selectedPlant.de} (${selectedPlant.bot})`:""} — jede Fassade auf einer eigenen Seite ab Seite 2.
      </div>}
      {unannotatedPlans.length>0&&<div style={{padding:"6px 10px",background:"#FFF8E1",border:`1px solid ${AM}40`,borderRadius:5,fontSize:10.5,color:DK,marginBottom:10}}>
        ⓘ {unannotatedPlans.length} {unannotatedPlans.length===1?"Plan ist":"Pläne sind"} hochgeladen, aber noch keine Begrünungsfläche markiert.
      </div>}
      <div style={{fontSize:9,color:GL,lineHeight:1.5,borderTop:`1px solid ${BD}`,paddingTop:6}}>
        Hinweis: Diese Vorbemessung dient als Orientierung und ersetzt keinen objektspezifischen statischen Nachweis.</div>
    </div>

    {/* PER-FACADE PAGES — each FacadeReportCard already has data-pdf-page="facade" */}
    {withRealistic&&fassaden.map((f,i)=><FacadeReportCard key={i} d={d} facade={f} index={i} total={fassaden.length}
      formCode={formCode} coverage={cov} maturity={maturityVal}/>)}

    {/* TECHNICAL PAGE */}
    <div data-pdf-page="technical" style={{borderTop:`6px solid ${BG}`,padding:"16px 24px"}}>
      <PageHead title="Technische Übersicht" subtitle="Nachweise, Hinweise, schematische Darstellung"/>
      <div style={{display:"flex",gap:12,marginBottom:14}}>
        <div style={{flex:1,border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
          <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:3,color:BK}}>Nachweise (Ausnutzung)</div>
          {maxNw>.85&&<div style={{display:"inline-block",padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700,
            background:maxNw>1?"#FFEBEE":"#FFF3E0",color:maxNw>1?R:AM,marginBottom:6,border:`1px solid ${maxNw>1?R:AM}40`}}>
            {maxNw>1?"ÜBERSCHREITUNG":"GRENZBEREICH"} max: {maxNw.toFixed(2)}</div>}
          <NwBar label="Zug: N_d / F_Rd" value={d.nw_zug}/><NwBar label="Druck: N_Ed / F_Rd" value={d.nw_druck}/>
          <NwBar label="Quer: V_d / F_Rd" value={d.nw_quer}/><NwBar label="Quer/Zug: √(V_d²+N_d²) / F_Rd" value={d.nw_kombi}/>
          <div style={{fontSize:8.5,color:GL,marginTop:8}}>Zulassungsbezug: Z-21.8-2083</div></div>
        <div style={{flex:1.4,border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
          <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:6,color:BK}}>Raster ({RASTER.find(r=>r.id===prvRaster)?.l})</div>
          <RasterOverlay LH={prvLH} LV={prvLV} fW={prvW} fH={prvH} rasterType={prvRaster}
            lage1={prvLage1} seilkreuztyp={prvSK} size={420} plan={prvPlan} annotations={prvAnn}/>
          <div style={{fontSize:8.5,color:GL,marginTop:4}}>Schematisch – ersetzt keine Ausführungsplanung.</div></div></div>
      <div style={{border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:6,color:BK}}>Lasten &amp; Widerstände</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 16px"}}>
          {[["Lastklasse",d.lastklasse],["ψ (Durchströmung)",d.psi],["w_s (Windsog) [kN/m²]",d.ws],["N_Ek (Winddruck) [kN/m²]",d.nek],
            ["N_d (Zug) [kN]",d.ned_z],["N_Ed (Druck) [kN]",d.ned_d],["V_d (Quer) [kN]",d.ved],["F_Rd (Tragfähigkeit) [kN]",d.vrd]].map(([k,v])=>
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:`1px solid ${BG}`,fontSize:11.5}}>
              <span style={{color:GY}}><Sub>{k}</Sub></span><span style={{fontWeight:700,color:BK}}>{v||"–"}</span></div>)}</div></div>
      <div style={{borderTop:`1px solid ${BD}`,marginTop:14,padding:"6px 0 0",display:"flex",justifyContent:"space-between",fontSize:9,color:GL}}>
        <span>EJOT · ISO-Bar ECO · Vorbemessung</span><span>{d.dokNr}</span></div>
    </div>
  </div>);
}

function AnlagenSection({d,usable}){
  return(<div style={{background:WH}}>
    <div data-pdf-page="anlage-a" style={{borderTop:`3px solid ${R}`,padding:"16px 24px"}}>
      <PageHead title="Anlage A – FLL Tabelle 15" subtitle="Lastklassen & Gewichtsabschätzung (Auszug)"/>
      <div style={{borderTop:`1px solid ${R}`,marginBottom:12}}/>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
        <thead><tr>{["LK","Flächig ≤2m","Schmal ≤1m","Linear ≤0,7m","ψ"].map(h=>
          <th key={h} style={{background:R,color:WH,fontWeight:700,padding:"5px 6px",fontSize:9.5,textAlign:"center"}}>{h}</th>)}</tr></thead>
        <tbody>{[1,2,3,4,5].map(k=>{const act=String(k)===String(d.lastklasse);return(
          <tr key={k} style={{background:act?RL:"transparent"}}>
            <td style={{padding:"4px 6px",textAlign:"center",fontWeight:700,color:act?R:BK,borderBottom:`1px solid ${BD}`}}>LK {k}</td>
            <td style={{padding:"4px 6px",textAlign:"center",borderBottom:`1px solid ${BD}`}}>{FLL_LK[k].fl} kg/m²</td>
            <td style={{padding:"4px 6px",textAlign:"center",borderBottom:`1px solid ${BD}`}}>{FLL_LK[k].sm} kg/m²</td>
            <td style={{padding:"4px 6px",textAlign:"center",borderBottom:`1px solid ${BD}`}}>{FLL_LK[k].li} kg/m²</td>
            <td style={{padding:"4px 6px",textAlign:"center",borderBottom:`1px solid ${BD}`}}>{FLL_LK[k].psi.toFixed(2).replace(".",",")}</td></tr>);})}</tbody></table>
      <div style={{fontSize:8.5,color:GL,marginTop:6}}>Quelle: FLL-Richtlinie Fassadenbegrünung (2018), Tab. 15. LK {d.lastklasse} hervorgehoben.</div></div>
    <div data-pdf-page="anlage-b" style={{borderTop:`6px solid ${BG}`,padding:"16px 24px"}}>
      <PageHead title="Anlage B – Pflanzenübersicht" subtitle={`FLL Tab. 15 – ${usable.length} Arten mit Lastklasse für Kletterhilfen`}/>
      <div style={{borderTop:`1px solid ${R}`,marginBottom:12}}/>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>
        <thead><tr>{["Botanische Bezeichnung","Form","Deutsch","h_max [m]","Trieb-Ø [cm]","Ges. [kg/Pfl]","fl [kg/m²]","sm [kg/m²]","li [kg/m]","LK"].map(h=>
          <th key={h} style={{background:DK,color:WH,fontWeight:700,padding:"4px 5px",fontSize:8.5,textAlign:"left",whiteSpace:"nowrap"}}><Sub>{h}</Sub></th>)}</tr></thead>
        <tbody>{usable.map(p=>{const act=p.bot===d.pflanze_botanisch;return(
          <tr key={p.bot} style={{background:act?RL:"transparent"}}>
            <td style={{padding:"3px 5px",fontStyle:"italic",borderBottom:`1px solid ${BD}`,fontWeight:act?700:400}}>{p.bot}</td>
            <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`}}>{FORMS[p.form]||p.form}</td>
            <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`}}>{p.de}</td>
            <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center"}}>{p.hMax}</td>
            <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center"}}>{p.trieb}</td>
            <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center"}}>{p.gesamt}</td>
            <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center"}}>{p.fl}</td>
            <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center"}}>{p.sm}</td>
            <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center"}}>{p.li}</td>
            <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center",fontWeight:700,color:act?R:BK}}>{p.lk}</td></tr>);})}</tbody></table>
      {d.pflanze_botanisch&&(()=>{const p=FLL_PLANTS.find(x=>x.bot===d.pflanze_botanisch);if(!p)return null;return(
        <div style={{border:`1px solid ${RM}`,borderRadius:4,padding:12,marginTop:12,background:RL}}>
          <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",color:R,marginBottom:6}}>Ausgewählte Pflanze</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"3px 14px"}}>
            <KV l="Botanisch" v={p.bot} b/><KV l="Deutsch" v={p.de} b/><KV l="LK" v={String(p.lk)} b/>
            <KV l="Form" v={FORMS[p.form]} b/><KV l="h_max" v={`${p.hMax} m`} b/><KV l="Gesamtgew." v={`${p.gesamt} kg/Pfl`} b/>
            <KV l="Flächig" v={p.fl?`${p.fl} kg/m²`:"–"} b/><KV l="Schmal" v={p.sm?`${p.sm} kg/m²`:"–"} b/><KV l="Linear" v={p.li?`${p.li} kg/m`:"–"} b/></div></div>);})()}
      <div style={{margin:"12px 0",padding:10,background:"#FFF8E1",borderRadius:4,border:`1px solid ${AM}40`}}>
        <div style={{fontSize:9.5,fontWeight:700,color:AM}}>⚠ Nicht geeignet an WDVS:</div>
        <div style={{fontSize:9,color:DK,marginTop:2}}>Selbstklimmer (WK/RH): {FLL_PLANTS.filter(p=>p.lk===null).map(p=>p.bot).join(", ")}</div></div></div>
    <div data-pdf-page="anlage-c" style={{borderTop:`6px solid ${BG}`,padding:"16px 24px"}}>
      <PageHead title="Anlage C – Systemdetail" subtitle="ISO-Bar ECO, Schnittdarstellung"/>
      <div style={{borderTop:`1px solid ${R}`,marginBottom:12}}/>
      <div style={{border:`1px solid ${BD}`,borderRadius:4,padding:16}}>
        <svg viewBox="0 0 500 170" width="100%" style={{maxWidth:520}}>
          <defs><pattern id="ct" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0,4l2,-2M3,8l5,-5M7,8l1,-1" stroke="#999" strokeWidth=".5" fill="none"/></pattern>
            <pattern id="ins" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r=".8" fill="#DDD"/></pattern></defs>
          <rect x="10" y="15" width="130" height="140" fill="url(#ct)" stroke="#888" strokeWidth=".8"/>
          <text x="60" y="164" textAnchor="middle" fontSize="7" fill={GY}>Verankerungs-</text><text x="60" y="172" textAnchor="middle" fontSize="7" fill={GY}>grund</text>
          <rect x="148" y="15" width="120" height="140" fill="url(#ins)" stroke="#AAA" strokeWidth=".8"/>
          <rect x="80" y="82" width="220" height="6" fill="#999" stroke="#666" strokeWidth=".5" rx="1"/>
          {[...Array(12)].map((_,i)=><line key={i} x1={85+i*8} y1={81} x2={89+i*8} y2={89} stroke="#777" strokeWidth=".6"/>)}
          <rect x="268" y="15" width="8" height="140" fill="#E8E4E0" stroke="#BBB" strokeWidth=".5"/>
          <rect x="276" y="78" width="14" height="14" fill="#888" stroke="#666" strokeWidth=".5" rx="1"/>
          <rect x="290" y="80" width="16" height="10" fill="#777" stroke="#555" strokeWidth=".5" rx="2"/>
          <circle cx="320" cy="85" r="9" fill="none" stroke="#555" strokeWidth="1.5"/><line x1="306" y1="85" x2="311" y2="85" stroke="#555" strokeWidth="1.5"/>
          <text x="338" y="88" fontSize="7" fill={GY}><tspan>T</tspan><tspan dy="2" fontSize="5">inst</tspan></text>
          <line x1="80" y1="10" x2="140" y2="10" stroke={BK} strokeWidth=".5"/><text x="110" y="8" textAnchor="middle" fontSize="7" fill={BK}>h<tspan dy="2" fontSize="5">ef</tspan></text>
          <line x1="150" y1="6" x2="268" y2="6" stroke={BK} strokeWidth=".5"/><text x="209" y="4" textAnchor="middle" fontSize="7" fill={BK}>t<tspan dy="2" fontSize="5">WDVS</tspan></text>
          <line x1="148" y1="2" x2="276" y2="2" stroke={R} strokeWidth=".6"/><text x="212" y="0" textAnchor="middle" fontSize="7" fill={R} fontWeight="bold">e</text>
          <line x1="276" y1="10" x2="306" y2="10" stroke={BK} strokeWidth=".5"/><text x="291" y="8" textAnchor="middle" fontSize="7" fill={BK}>a</text>
          <text x="148" y="168" textAnchor="middle" fontSize="6" fill={GL}>US</text><text x="295" y="168" textAnchor="middle" fontSize="6" fill={GL}>AS</text>
        </svg>
        <div style={{fontSize:8.5,color:GL,marginTop:8}}>Maßgebend: Zulassung Z-21.8-2083, Montageanleitung, projektspezifische Planung.</div>
        {d.wdvs_dicke&&<div style={{display:"flex",gap:14,marginTop:8,flexWrap:"wrap"}}>
          {[["t_WDVS",`${d.wdvs_dicke} mm`],["t_tol",`${d.dicke_klebschicht||10} mm`],["h_ef,min",d.verankerungstiefe?`${d.verankerungstiefe} mm`:"–"],
            ["e",`${pf(d.wdvs_dicke)+(pf(d.dicke_klebschicht)||10)} mm`]].map(([k,v])=>
            <div key={k} style={{fontSize:10.5}}><span style={{color:GY}}><Sub>{k}</Sub>: </span><span style={{fontWeight:700}}>{v}</span></div>)}</div>}
      </div>
      <div style={{borderTop:`1px solid ${BD}`,marginTop:14,padding:"6px 0 0",display:"flex",justifyContent:"space-between",fontSize:9,color:GL}}>
        <span>EJOT · ISO-Bar ECO · Anlagen</span><span>{d.dokNr}</span></div>
    </div>
  </div>);
}

function MaterialSection({d,mat}){
  const fassaden=d.fassaden||[{name:"Fassade 1",breite:d.fassadenlaenge||"10",hoehe:d.fassadenhoehe||"6"}];
  const glh=pf(d.LH)||.9,glv=pf(d.LV)||.9;
  const f0=fassaden[0]||{};
  // matRaster/matSK/etc were only used by the single-facade preview that
  // has been replaced with the per-facade FacadeRasterCard loop below.
  const matSK=f0.seilkreuztyp||d.seilkreuztyp||"ohne";   // still needed for the Stückliste's skInfo lookup
  // Per-facade stats — plan-aware where annotations exist, simple formula otherwise.
  const facadeStats = fassaden.map(f => calcFacadeStats(f, d));
  const anyV = facadeStats.some(s => s.sV > 0);
  const anyH = facadeStats.some(s => s.sH > 0);
  const anyD = facadeStats.some(s => s.sD > 0);
  const anyFromPlan = facadeStats.some(s => s.fromPlan);
  const totalAnker = facadeStats.reduce((s, x) => s + x.anker, 0);
  const totalSK    = facadeStats.reduce((s, x) => s + x.sk, 0);
  const totalArea  = facadeStats.reduce((s, x) => s + x.area, 0);          // netto
  const totalAreaBrutto = facadeStats.reduce((s, x) => s + x.area_brutto, 0);
  const totalAreaExcl   = facadeStats.reduce((s, x) => s + x.area_excl, 0);
  const totalSeilV = facadeStats.reduce((s, x) => s + x.sV, 0);
  const totalSeilH = facadeStats.reduce((s, x) => s + x.sH, 0);
  const totalSeilD = facadeStats.reduce((s, x) => s + x.sD, 0);
  const totalEndkappen = facadeStats.reduce((s, x) => s + (x.endkappen || 0), 0); // je Seilende, nicht pro Anker
  const totalSeilGes = (totalSeilV + totalSeilH + totalSeilD) * 1.1;
  const setInfo=SETS.find(s=>s.id===d.produkt);
  const skInfo=SEILKREUZE.find(s=>s.id===matSK);
  const items=[];
  items.push([setInfo?setInfo.l:"EJOT Iso-Bar ECO (Ankerpunkt)",fmtInt(totalAnker),"Stk",setInfo?`Art. ${setInfo.art}`:""]);
  if(anyV) items.push([`Seil Edelstahl V4A ø4mm – vertikal`,fmtDec(totalSeilV,1),"m",`${fassaden.length>1?"alle Fassaden kumuliert":"vertikal"}`]);
  if(anyH) items.push([`Seil Edelstahl V4A ø4mm – horizontal`,fmtDec(totalSeilH,1),"m",`${fassaden.length>1?"alle Fassaden kumuliert":"horizontal"}`]);
  if(anyD) items.push(["Seil Edelstahl V4A ø4mm – diagonal",fmtDec(totalSeilD,1),"m","2× pro Feld"]);
  items.push(["Seil gesamt (alle Richtungen)",fmtDec(totalSeilGes,1),"m","inkl. Verschnitt ca. +10 %"]);
  if(totalSK>0&&skInfo) items.push([`${skInfo.l}`,fmtInt(totalSK),"Stk",skInfo.art?`Art. ${skInfo.art}`:"alle Fassaden"]);
  items.push(["Endkappen / Seilhülsen",fmtInt(totalEndkappen),"Stk","je Seilende (Anfang + Ende jedes Seils)"]);

  const showBreakdown=fassaden.length>1||anyFromPlan||facadeStats.some(f=>f.rects&&f.rects.length>1);
  return(<div style={{background:WH}}>
    {/* COVER PAGE: title + headline summary + Eingangswerte */}
    <div data-pdf-page="header" style={{borderTop:`3px solid ${R}`,padding:"16px 24px"}}>
      <PageHead title="Materialbedarfsermittlung" subtitle="Überschlägige Mengenermittlung auf Basis der Vorbemessung"/>
      <div style={{borderTop:`1px solid ${R}`,marginBottom:14}}/>

      {/* Headline-Summary: prominente Karte mit den Kernzahlen */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",
        gap:8,marginBottom:14,
        border:`1px solid ${RM}`,borderRadius:8,padding:"12px 14px",
        background:`linear-gradient(135deg, ${RL}, #FFFFFF)`,
      }}>
        <Stat label="Netto-Begrünung" value={fmtArea(totalArea)} accent/>
        <Stat label="Iso-Bar ECO" value={fmtInt(totalAnker)} unit="Stk" accent/>
        <Stat label="Seilkreuze" value={fmtInt(totalSK)} unit="Stk" color="#1565C0"/>
        <Stat label="Seil gesamt" value={fmtLen(totalSeilGes)} hint="inkl. +10 % Verschnitt"/>
        <Stat label="Endkappen" value={fmtInt(totalEndkappen)} unit="Stk" hint="je Seilende"/>
        {anyFromPlan&&<Stat label="Quelle" value="aus Plan" valueSize={14} color={R}/>}
      </div>

      {/* Eingangswerte — compact summary card (global totals; per-facade
          settings live in the per-facade cards on the following pages). */}
      <div style={{border:`1px solid ${BD}`,borderRadius:4,padding:12,marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
          <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,color:BK}}>Eingangswerte (Projekt-Gesamt)</div>
          {anyFromPlan&&<span style={{fontSize:9,fontWeight:700,color:R,background:RL,padding:"1px 6px",borderRadius:3}}>📐 aus Plan ermittelt</span>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"4px 18px"}}>
          {anyFromPlan&&totalAreaBrutto>0
            ? <>
                <KV l="Brutto-Fläche" v={fmtArea(totalAreaBrutto)}/>
                <KV l="Aussparungen (Fenster+Türen)" v={`− ${fmtArea(totalAreaExcl)}`}/>
                <KV l="Netto-Begrünungsfläche" v={fmtArea(totalArea)} b/>
              </>
            : <KV l="Gesamtfläche" v={fmtArea(totalArea)} b/>}
          <KV l="Fassaden" v={`${fassaden.length} Stk.`}/>
          {setInfo&&<KV l="SET Produkt" v={setInfo.l} b/>}
        </div>
      </div>

      {fassaden.length>1&&<div style={{padding:"8px 12px",background:"#E8F5E9",border:"1px solid #2E7D3240",borderRadius:5,fontSize:10.5,color:"#1B5E20"}}>
        Detaillierte Rasterdarstellung mit Plan und Schematik je Fassade auf den folgenden Seiten (eine Seite pro Fassade).
      </div>}
    </div>

    {/* PER-FACADE PAGES — each card has data-pdf-page="facade" */}
    {fassaden.map((f,i)=><FacadeRasterCard key={i} d={d} facade={f} index={i} total={fassaden.length}/>)}

    {showBreakdown&&<div data-pdf-page="breakdown" style={{borderTop:`6px solid ${BG}`,padding:"16px 24px"}}>
      <div style={{border:`1px solid ${BD}`,borderRadius:4,padding:12,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:8,color:BK,display:"flex",justifyContent:"space-between"}}>
          <span>Aufschlüsselung je Begrünungsfläche</span>
          {anyFromPlan&&<span style={{fontWeight:600,fontSize:9,color:GY,textTransform:"none",letterSpacing:0}}>📐 = aus Plan ermittelt</span>}
        </div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr>{["Fassade / Fläche","B × H [m]","Brutto","Aussp.","Netto","Anker","Seilkreuze","Seil V","Seil H","Seil D"].map(h=>
            <th key={h} style={{background:BG,fontWeight:700,padding:"4px 6px",textAlign:"left",borderBottom:`1px solid ${BD}`,fontSize:10}}>{h}</th>)}</tr></thead>
          <tbody>
            {facadeStats.flatMap((f,fi)=>{
              const showSubTotal = f.fromPlan && f.rects && f.rects.length > 1;
              const rows = (f.rects||[]).map((r,ri)=>{
                const rectLabel = f.rects.length > 1
                  ? <><span style={{color:GY}}>{f.name} ·</span> <span style={{fontWeight:700}}>{r.label}</span></>
                  : <span style={{fontWeight:600}}>{f.name}</span>;
                return(<tr key={`${fi}-${ri}`}>
                  <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`}}>
                    {f.fromPlan&&<span title="aus Plan" style={{marginRight:4}}>📐</span>}{rectLabel}
                  </td>
                  <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`}}>{fmtDec(r.breite_m,1)} × {fmtDec(r.hoehe_m,1)}</td>
                  <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`}}>{fmtArea(r.area_brutto)}</td>
                  <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,color:r.area_excl>0?AM:GL}}>{r.area_excl>0?`− ${fmtArea(r.area_excl)}`:"–"}</td>
                  <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,fontWeight:600}}>{fmtArea(r.area)}</td>
                  <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,fontWeight:700,color:R}}>{fmtInt(r.anker)}</td>
                  <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,fontWeight:700,color:"#1565C0"}}>{fmtInt(r.sk)}</td>
                  <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`}}>{r.sV>0?fmtDec(r.sV,1)+" m":"–"}</td>
                  <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`}}>{r.sH>0?fmtDec(r.sH,1)+" m":"–"}</td>
                  <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`}}>{r.sD>0?fmtDec(r.sD,1)+" m":"–"}</td></tr>);
              });
              if(showSubTotal) rows.push(<tr key={`${fi}-sub`} style={{background:"#F7F6F4"}}>
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,fontStyle:"italic",color:DK}}>Σ {f.name}</td>
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`}}></td>
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,fontWeight:600}}>{fmtArea(f.area_brutto)}</td>
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,color:AM}}>{f.area_excl>0?`− ${fmtArea(f.area_excl)}`:"–"}</td>
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,fontWeight:700}}>{fmtArea(f.area)}</td>
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,fontWeight:700,color:R}}>{fmtInt(f.anker)}</td>
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,fontWeight:700,color:"#1565C0"}}>{fmtInt(f.sk)}</td>
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,fontWeight:600}}>{f.sV>0?fmtDec(f.sV,1)+" m":"–"}</td>
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,fontWeight:600}}>{f.sH>0?fmtDec(f.sH,1)+" m":"–"}</td>
                <td style={{padding:"3px 6px",borderBottom:`1px solid ${BD}`,fontWeight:600}}>{f.sD>0?fmtDec(f.sD,1)+" m":"–"}</td></tr>);
              return rows;
            })}
            <tr style={{background:`linear-gradient(90deg, ${RL}, transparent)`}}>
              <td style={{padding:"5px 6px",fontWeight:700,fontSize:11.5}}>Gesamt</td>
              <td style={{padding:"5px 6px"}}></td>
              <td style={{padding:"5px 6px",fontWeight:700}}>{fmtArea(totalAreaBrutto)}</td>
              <td style={{padding:"5px 6px",fontWeight:700,color:AM}}>{totalAreaExcl>0?`− ${fmtArea(totalAreaExcl)}`:"–"}</td>
              <td style={{padding:"5px 6px",fontWeight:700}}>{fmtArea(totalArea)}</td>
              <td style={{padding:"5px 6px",fontWeight:700,color:R,fontSize:12}}>{fmtInt(totalAnker)}</td>
              <td style={{padding:"5px 6px",fontWeight:700,color:"#1565C0",fontSize:12}}>{fmtInt(totalSK)}</td>
              <td style={{padding:"5px 6px",fontWeight:700}}>{totalSeilV>0?fmtDec(totalSeilV,1)+" m":"–"}</td>
              <td style={{padding:"5px 6px",fontWeight:700}}>{totalSeilH>0?fmtDec(totalSeilH,1)+" m":"–"}</td>
              <td style={{padding:"5px 6px",fontWeight:700}}>{totalSeilD>0?fmtDec(totalSeilD,1)+" m":"–"}</td></tr>
          </tbody></table>
        {anyFromPlan&&<div style={{fontSize:9.5,color:GL,marginTop:6}}>
          Werte mit 📐 wurden aus den Plan-Annotationen ermittelt: Jede Begrünungsfläche bekommt ihr eigenes Ankerraster, gefiltert durch Fenster/Türen. Σ-Zeilen sind die Summe pro Fassade.
        </div>}
      </div>
    </div>}

    {/* STÜCKLISTE page (always last) */}
    <div data-pdf-page="stueckliste" style={{borderTop:`6px solid ${BG}`,padding:"16px 24px"}}>
      <div style={{border:`1px solid ${RM}`,borderRadius:4,padding:12,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:8,color:R}}>Stückliste (überschlägig)</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
          <thead><tr>{["Pos.","Bezeichnung","Menge","Einheit","Hinweis"].map(h=>
            <th key={h} style={{background:BG,fontWeight:700,padding:"5px 8px",textAlign:"left",borderBottom:`1px solid ${BD}`,fontSize:10.5}}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map(([b,m,e,h],idx)=><tr key={idx}>
              <td style={{padding:"4px 8px",borderBottom:`1px solid ${BD}`,fontWeight:700,color:R,width:30}}>{idx+1}</td>
              <td style={{padding:"4px 8px",borderBottom:`1px solid ${BD}`}}>{b}</td>
              <td style={{padding:"4px 8px",borderBottom:`1px solid ${BD}`,fontWeight:700,textAlign:"right"}}>{m}</td>
              <td style={{padding:"4px 8px",borderBottom:`1px solid ${BD}`}}>{e}</td>
              <td style={{padding:"4px 8px",borderBottom:`1px solid ${BD}`,fontSize:10,color:GL}}>{h}</td></tr>)}
          </tbody></table></div>
      <div style={{padding:10,background:"#FFF8E1",borderRadius:4,border:`1px solid ${AM}40`,fontSize:9.5,color:DK}}>
        <strong style={{color:AM}}>⚠ Hinweis:</strong> Die Stückzahlen sind überschlägig. Für die Ausführung ist eine planbasierte Materialermittlung unter Berücksichtigung
        von Rand-/Eckbereichen, Fenster-/Türöffnungen und Systemdetails erforderlich.</div>
      <div style={{borderTop:`1px solid ${BD}`,marginTop:14,padding:"6px 0 0",display:"flex",justifyContent:"space-between",fontSize:9,color:GL}}>
        <span>EJOT · ISO-Bar ECO · Materialermittlung</span><span>{d.dokNr}</span></div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════
// Has the user actually entered or imported anything?
function hasContent(d){
  if(!d) return false;
  if(d.bauvorhaben||d.ort_plz||d.bearbeiter) return true;
  if(Array.isArray(d.fassaden)){
    for(const f of d.fassaden){
      if(f.plan) return true;
      if(f.annotations&&(f.annotations.facades?.length>0||f.annotations.windows?.length>0||f.annotations.doors?.length>0)) return true;
    }
  }
  return false;
}

// Format "Gespeichert vor 7 s" / "vor 3 min" / "vor 2 h"
function fmtAgo(ts){
  if(!ts) return "";
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<3) return "Gerade gespeichert";
  if(s<60) return `Gespeichert vor ${s} s`;
  if(s<3600) return `Gespeichert vor ${Math.floor(s/60)} min`;
  return `Gespeichert vor ${Math.floor(s/3600)} h`;
}

export default function App(){
  const[step,setStep]=useState("upload");
  const[d,setD]=useState({});
  const[pdfN,setPdfN]=useState("");
  const[parseInfo,setParseInfo]=useState(null);   // {hits, misses, rawLen}
  const[parsing,setParsing]=useState(false);
  const[parseErr,setParseErr]=useState("");
  const[dragOver,setDragOver]=useState(false);
  const[restored,setRestored]=useState(false);    // banner shown after auto-restore
  const[lastSaved,setLastSaved]=useState(null);   // timestamp of last successful save
  const[saving,setSaving]=useState(false);        // a save is queued / in flight
  const[, forceTick]=useState(0);                 // re-render every 15s so fmtAgo stays fresh
  const fRef=useRef(null);
  const hydratedRef=useRef(false);                // skip auto-save until after initial hydrate
  const setter=k=>v=>setD(x=>({...x,[k]:v}));
  const usable=useMemo(()=>FLL_PLANTS.filter(p=>p.lk!==null),[]);
  const mat=useMemo(()=>calcMaterial(d),[d.LH,d.LV,d.Lage1,d.fassadenlaenge,d.fassadenhoehe,d.seilfuehrung,d.fassaden]);
  const maxNw=Math.max(...[d.nw_zug,d.nw_druck,d.nw_quer,d.nw_kombi].map(v=>pf(v)||0),0);

  const selectPlant=bot=>{const p=FLL_PLANTS.find(x=>x.bot===bot);
    if(p)setD(x=>({...x,pflanze_botanisch:p.bot,pflanze_deutsch:p.de,lastklasse:p.lk?String(p.lk):x.lastklasse,
      psi:p.lk?FLL_LK[p.lk].psi.toFixed(2):x.psi}));else setter("pflanze_botanisch")(bot);};

  const ingestFile=useCallback(async(file)=>{
    if(!file)return;
    setParsing(true); setParseErr(""); setParseInfo(null);
    try{
      setPdfN(file.name);
      const raw=await extractPdfText(file);
      const {document:doc,hits,misses,rawText}=buildDocument(raw);
      setD(doc);
      setParseInfo({hits,misses,rawLen:raw.length,rawText});
      setStep("edit");
    }catch(err){
      console.error("PDF parse error:",err);
      setParseErr(err.message||String(err));
    }finally{setParsing(false);}
  },[]);

  const handleFile=useCallback(e=>{const f=e.target.files?.[0];if(f)ingestFile(f);},[ingestFile]);
  const handleDrop=useCallback(e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer?.files?.[0];if(f)ingestFile(f);},[ingestFile]);

  // ─── AUTO-SAVE / RESTORE (IndexedDB) ─────────────────────
  // On mount: try to restore the last document.  If found and non-empty,
  // jump straight to the edit step and show a small banner.
  useEffect(()=>{(async()=>{
    const saved=await loadDocument();
    if(saved&&saved.d&&hasContent(saved.d)){
      setD(saved.d);
      setStep(saved.step==="upload"?"edit":(saved.step||"edit"));
      if(saved.pdfN) setPdfN(saved.pdfN);
      setLastSaved(saved.savedAt||Date.now());
      setRestored(true);
    }
    hydratedRef.current=true;
  })();},[]);
  // Debounced save: 1.2 s after the last change to {d, step, pdfN}.
  // The cleanup callback cancels the timer if another change comes in,
  // so we never write more often than once per debounce window.
  useEffect(()=>{
    if(!hydratedRef.current) return;
    if(step==="upload"||!hasContent(d)) return;
    setSaving(true);
    const handle=setTimeout(async()=>{
      const ok=await saveDocument({d,step,pdfN,savedAt:Date.now()});
      if(ok) setLastSaved(Date.now());
      setSaving(false);
    },1200);
    return()=>clearTimeout(handle);
  },[d,step,pdfN]);
  // Periodic re-render so "vor X s" stays current
  useEffect(()=>{const id=setInterval(()=>forceTick(t=>t+1),15000);return()=>clearInterval(id);},[]);

  // "Neu" — start fresh, confirm if there's unsaved work
  const startNew=useCallback(async()=>{
    if(hasContent(d)){
      const ok=window.confirm("Aktuelles Projekt wird zurückgesetzt.\n\nWeiter?");
      if(!ok) return;
    }
    await clearDocument();
    setD({});
    setPdfN("");
    setParseInfo(null);
    setParseErr("");
    setRestored(false);
    setLastSaved(null);
    setStep("upload");
  },[d]);

  // ─── PDF EXPORT ───────────────────────────────────────
  const previewRef=useRef(null);
  const anlagenRef=useRef(null);
  const materialRef=useRef(null);
  const[exporting,setExporting]=useState(null);
  const[showExportMenu,setShowExportMenu]=useState(false);

  // Capture-and-page-break export.
  //
  // If the section's root contains elements marked with `data-pdf-page`, we
  // treat EACH such element as its own PDF "page-group" (new PDF page,
  // followed by additional pages if it doesn't fit on one A4).  This gives
  // clean breaks between intro / per-facade / breakdown / Stückliste rather
  // than slicing the monolithic capture at arbitrary heights.
  //
  // If no `data-pdf-page` elements are present, falls back to the old
  // single-capture, auto-paginated behaviour.
  const exportPdf=useCallback(async(sectionId,ref,filename)=>{
    if(!ref.current)return;
    setExporting(sectionId);
    try{
      const root=ref.current;
      const outerWrapper=root.closest('[data-pdf-offscreen]');
      const origOuterStyle=outerWrapper?outerWrapper.style.cssText:"";
      const origParentStyle=root.parentElement.style.cssText;
      if(outerWrapper) outerWrapper.style.cssText="position:absolute;left:0;top:0;width:880px;z-index:9999;overflow:visible;pointer-events:none;";
      root.parentElement.style.cssText="width:880px;background:#FFF;font-family:'Segoe UI',system-ui,sans-serif;";
      root.style.width="880px";
      root.style.background="#FFF";
      await new Promise(r=>setTimeout(r,500));

      const pageEls=Array.from(root.querySelectorAll("[data-pdf-page]"));
      const captureTargets=pageEls.length>0?pageEls:[root];

      const pdfW=210,margin=6,contentW=pdfW-2*margin;
      const pdfH=297;
      const pageContentH=pdfH-2*margin;
      const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
      let firstPage=true;

      for(const el of captureTargets){
        const canvas=await html2canvas(el,{scale:3,useCORS:true,backgroundColor:"#FFFFFF",logging:false,windowWidth:920,imageTimeout:0,removeContainer:false,scrollX:0,scrollY:0});
        const imgW=canvas.width,imgH=canvas.height;
        const ratio=contentW/imgW;
        const contentH=imgH*ratio;
        const totalPages=Math.ceil(contentH/pageContentH);
        for(let page=0;page<totalPages;page++){
          if(!firstPage) pdf.addPage();
          firstPage=false;
          const srcY=page*pageContentH/ratio;
          const srcH=Math.min(pageContentH/ratio,imgH-srcY);
          const destH=srcH*ratio;
          const tmpCanvas=document.createElement("canvas");
          tmpCanvas.width=imgW;tmpCanvas.height=Math.round(srcH);
          const ctx=tmpCanvas.getContext("2d");
          ctx.drawImage(canvas,0,Math.round(srcY),imgW,Math.round(srcH),0,0,imgW,Math.round(srcH));
          const sliceData=tmpCanvas.toDataURL("image/png",0.92);
          pdf.addImage(sliceData,"PNG",margin,margin,contentW,destH,"","FAST");
        }
      }

      if(outerWrapper) outerWrapper.style.cssText=origOuterStyle;
      root.parentElement.style.cssText=origParentStyle;
      pdf.save(filename);
    }catch(err){console.error("PDF export error:",err);alert("PDF-Export fehlgeschlagen: "+err.message);}
    finally{setExporting(null);}
  },[]);

  const exportAll=useCallback(async()=>{
    setExporting("all");setShowExportMenu(false);
    try{
      const sections=[{ref:previewRef,name:"Vorbemessung"},{ref:anlagenRef,name:"Anlagen"},{ref:materialRef,name:"Material"}];
      for(const sec of sections){
        if(!sec.ref.current)continue;
        await exportPdf(sec.name,sec.ref,`EJOT_IsoBar_${sec.name}_${d.dokNr||"Report"}.pdf`);
        await new Promise(r=>setTimeout(r,500));
      }
    }finally{setExporting(null);}
  },[exportPdf,d.dokNr]);

  const handleExport=(which)=>{
    setShowExportMenu(false);
    const map={preview:{ref:previewRef,name:"Vorbemessung"},anlagen:{ref:anlagenRef,name:"Anlagen"},material:{ref:materialRef,name:"Material"}};
    const sec=map[which];
    if(sec)exportPdf(which,sec.ref,`EJOT_IsoBar_${sec.name}_${d.dokNr||"Report"}.pdf`);
  };

  // CSV export of the material list — for direct hand-off to Einkauf.
  // German Excel-friendly: ';' separator, BOM, comma decimal, dot thousands.
  const exportCsv=useCallback(()=>{
    setShowExportMenu(false);
    const fassaden=d.fassaden||[];
    const stats=fassaden.map(f=>calcFacadeStats(f,d));
    const tot={
      anker:stats.reduce((s,x)=>s+x.anker,0),
      sk:stats.reduce((s,x)=>s+x.sk,0),
      area:stats.reduce((s,x)=>s+x.area,0),
      sV:stats.reduce((s,x)=>s+x.sV,0),
      sH:stats.reduce((s,x)=>s+x.sH,0),
      sD:stats.reduce((s,x)=>s+x.sD,0),
      endkappen:stats.reduce((s,x)=>s+(x.endkappen||0),0),
    };
    const totalSeilGes=(tot.sV+tot.sH+tot.sD)*1.1;
    const setInfo=SETS.find(s=>s.id===d.produkt);
    const matSK=fassaden[0]?.seilkreuztyp||d.seilkreuztyp||"ohne";
    const skInfo=SEILKREUZE.find(s=>s.id===matSK);
    const rows=[];
    rows.push(["EJOT Iso-Bar ECO — Materialgrobplanung"]);
    rows.push([`Dokument: ${d.dokNr||"–"}`,`Version: ${d.version||"–"}`,`Datum: ${d.datum||""}`]);
    rows.push([`Bauvorhaben: ${d.bauvorhaben||"–"}`,`Ort: ${d.ort_plz||"–"}`,`Bearbeiter: ${d.bearbeiter||"–"}`]);
    rows.push([]);

    // Headline summary
    rows.push(["Position","Bezeichnung","Menge","Einheit","Artikelnummer","Hinweis"]);
    let p=1;
    rows.push([p++,setInfo?setInfo.l:"EJOT Iso-Bar ECO (Ankerpunkt)",fmtInt(tot.anker),"Stk",setInfo?.art||"",""]);
    if(tot.sV>0) rows.push([p++,"Seil Edelstahl V4A ø4mm – vertikal",fmtDec(tot.sV,1),"m","",""]);
    if(tot.sH>0) rows.push([p++,"Seil Edelstahl V4A ø4mm – horizontal",fmtDec(tot.sH,1),"m","",""]);
    if(tot.sD>0) rows.push([p++,"Seil Edelstahl V4A ø4mm – diagonal",fmtDec(tot.sD,1),"m","",""]);
    rows.push([p++,"Seil gesamt (alle Richtungen)",fmtDec(totalSeilGes,1),"m","","inkl. ca. +10 % Verschnitt"]);
    if(tot.sk>0&&skInfo) rows.push([p++,skInfo.l,fmtInt(tot.sk),"Stk",skInfo.art||"",""]);
    rows.push([p++,"Endkappen / Seilhülsen",fmtInt(tot.endkappen),"Stk","","je Seilende (Anfang + Ende jedes Seils)"]);
    rows.push([]);

    // Per-facade / per-greening-rect breakdown
    rows.push(["Aufschlüsselung je Begrünungsfläche"]);
    rows.push(["Fassade","Fläche","B [m]","H [m]","Brutto [m²]","Aussparung [m²]","Netto [m²]","Anker","Seilkreuze","Seil V [m]","Seil H [m]","Seil D [m]","aus Plan"]);
    stats.forEach(f=>{
      (f.rects||[]).forEach(r=>{
        rows.push([
          f.name, r.label,
          fmtDec(r.breite_m,2), fmtDec(r.hoehe_m,2),
          fmtDec(r.area_brutto,2), fmtDec(r.area_excl,2), fmtDec(r.area,2),
          r.anker, r.sk,
          fmtDec(r.sV,1), fmtDec(r.sH,1), fmtDec(r.sD,1),
          f.fromPlan?"ja":"nein",
        ]);
      });
    });
    rows.push([
      "Gesamt","","","",
      fmtDec(stats.reduce((s,x)=>s+x.area_brutto,0),2),
      fmtDec(stats.reduce((s,x)=>s+x.area_excl,0),2),
      fmtDec(tot.area,2),
      tot.anker, tot.sk,
      fmtDec(tot.sV,1), fmtDec(tot.sH,1), fmtDec(tot.sD,1),"",
    ]);

    const escape=(c)=>{const s=String(c??"");return /[";\n,]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
    const csv="﻿"+rows.map(r=>r.map(escape).join(";")).join("\r\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`EJOT_IsoBar_Materialliste_${d.dokNr||"Report"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  },[d]);

  useEffect(()=>{
    if(!showExportMenu)return;
    const handler=()=>setShowExportMenu(false);
    const t=setTimeout(()=>document.addEventListener("click",handler),10);
    return()=>{clearTimeout(t);document.removeEventListener("click",handler);};
  },[showExportMenu]);

  // ─── UPLOAD ─────────────────────────────────────────────
  if(step==="upload")return(
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:`linear-gradient(135deg, ${BG} 0%, #EDE9DD 100%)`,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{textAlign:"center",maxWidth:560,width:"100%"}}>
        <div style={{marginBottom:20,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <div style={{width:48,height:48,borderRadius:10,background:`linear-gradient(135deg, ${R}, #8E0B22)`,display:"flex",alignItems:"center",justifyContent:"center",color:WH,fontWeight:900,fontSize:18,boxShadow:"0 4px 12px rgba(200,16,46,.25)"}}>E</div>
          <div style={{textAlign:"left"}}>
            <div style={{fontWeight:900,fontSize:22,color:R,lineHeight:1}}>EJOT<sup style={{fontSize:9,color:BK}}>®</sup></div>
            <div style={{fontSize:11,color:GY,fontWeight:600,marginTop:2}}>Iso-Bar ECO · Report Generator</div>
          </div>
        </div>
        <h1 style={{fontSize:22,fontWeight:700,color:BK,margin:"0 0 6px"}}>Statik-PDF hochladen</h1>
        <p style={{fontSize:13,color:GY,margin:"0 0 28px",lineHeight:1.5}}>
          PDF einlesen → Werte automatisch extrahieren → Report exportieren.<br/>
          <span style={{fontSize:11,color:GL}}>Unterstützt Vorbemessungs-PDFs und Statik-Ausgaben.</span>
        </p>
        <div
          onClick={()=>fRef.current?.click()}
          onDragOver={e=>{e.preventDefault();setDragOver(true);}}
          onDragLeave={()=>setDragOver(false)}
          onDrop={handleDrop}
          style={{border:`2px dashed ${dragOver?R:BD}`,borderRadius:14,padding:"44px 24px",cursor:"pointer",background:dragOver?RL:WH,transition:"all .2s",boxShadow:dragOver?"0 8px 24px rgba(200,16,46,.12)":"0 2px 8px rgba(0,0,0,.04)"}}>
          {parsing?(<>
            <div style={{display:"inline-block",width:36,height:36,border:`3px solid ${BD}`,borderTopColor:R,borderRadius:"50%",animation:"spin 1s linear infinite",marginBottom:10}}/>
            <div style={{fontSize:14,fontWeight:600,color:BK}}>PDF wird analysiert …</div>
            <div style={{fontSize:11,color:GL,marginTop:4}}>{pdfN}</div>
          </>):(<>
            <div style={{fontSize:42,marginBottom:8}}>📄</div>
            <div style={{fontSize:14,fontWeight:600,color:BK}}>PDF hier ablegen oder klicken</div>
            <div style={{fontSize:11,color:GL,marginTop:4}}>Vorbemessungs-PDF, Statik-Ausgabe oder .txt</div>
          </>)}
          <input ref={fRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" onChange={handleFile} style={{display:"none"}}/>
        </div>
        {parseErr&&<div style={{marginTop:12,padding:"10px 14px",background:"#FFEBEE",border:`1px solid ${R}40`,borderRadius:8,fontSize:12,color:R}}>
          <strong>Fehler beim Lesen:</strong> {parseErr}
        </div>}
        <button onClick={()=>{const{document:doc}=buildDocument("");setD(doc);setStep("edit");}}
          style={{marginTop:18,padding:"8px 18px",fontSize:11,color:GY,background:WH,border:`1px solid ${BD}`,borderRadius:6,cursor:"pointer",fontWeight:600}}>
          Ohne Datei starten →
        </button>
        <div style={{marginTop:24,display:"flex",justifyContent:"center",gap:18,fontSize:10,color:GL}}>
          <span>● Z-21.8-2083</span><span>● FLL Tab. 15</span><span>● DIN 1991-1-4</span>
        </div>
      </div></div>);

  const tabs=[
    {id:"edit",l:"Bearbeiten",icon:"✎"},
    {id:"preview",l:"Vorschau",icon:"◐"},
    {id:"anlagen",l:"Anlagen",icon:"☰"},
    {id:"material",l:"Material",icon:"⚙"},
  ];

  // ─── MAIN ─────────────────────────────────────────────
  return(
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:BG,minHeight:"100vh"}}>
      {/* Top bar */}
      <div style={{background:WH,borderBottom:`1px solid ${BD}`,boxShadow:"0 2px 8px rgba(0,0,0,.05)",padding:"10px 18px 0",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        {/* tiny brand accent line at the very top of the page */}
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:`linear-gradient(90deg, ${R}, #8E0B22 60%, ${R})`}}/>
        <div style={{display:"flex",alignItems:"center",gap:12,paddingBottom:10}}>
          <div style={{width:34,height:34,borderRadius:8,background:`linear-gradient(135deg, ${R}, #8E0B22)`,display:"flex",alignItems:"center",justifyContent:"center",color:WH,fontWeight:900,fontSize:15,boxShadow:"0 2px 6px rgba(200,16,46,.30)"}}>E</div>
          <div>
            <div style={{fontWeight:900,fontSize:14,color:R,lineHeight:1}}>EJOT<sup style={{fontSize:6,color:BK}}>®</sup> Iso-Bar ECO</div>
            <div style={{fontSize:10,color:GY,marginTop:2,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span>{d.bauvorhaben||"Neues Projekt"} {d.ort_plz&&<>· {d.ort_plz}</>}</span>
              {pdfN&&<span style={{color:GL}}>← {pdfN}</span>}
              {(saving||lastSaved)&&<span title="Wird lokal in deinem Browser gespeichert (IndexedDB). Nichts wird hochgeladen."
                style={{display:"inline-flex",alignItems:"center",gap:4,padding:"1px 7px",borderRadius:10,background:saving?"#E3F2FD":"#E8F5E9",color:saving?"#1565C0":"#1B5E20",border:`1px solid ${saving?"#90CAF9":"#A5D6A7"}`,fontWeight:600,fontSize:9.5}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:saving?"#1565C0":"#2E7D32",boxShadow:saving?"":""}}/>
                {saving?"Speichert…":fmtAgo(lastSaved)}
              </span>}
            </div>
          </div>
        </div>
        {/* Tab strip + actions */}
        <div style={{display:"flex",gap:6,alignItems:"center",paddingBottom:10}}>
          <button onClick={startNew} title="Neues Projekt starten (aktuelles wird zurückgesetzt)"
            onMouseEnter={e=>{e.currentTarget.style.background=BG;e.currentTarget.style.borderColor=GL;}}
            onMouseLeave={e=>{e.currentTarget.style.background=WH;e.currentTarget.style.borderColor=BD;}}
            style={{padding:"6px 10px",fontSize:11,border:`1px solid ${BD}`,borderRadius:6,background:WH,cursor:"pointer",color:DK,fontWeight:600,display:"flex",alignItems:"center",gap:4,transition:"all .15s"}}>
            ↩ Neu
          </button>
          <div style={{display:"flex",gap:2,background:BG,padding:3,borderRadius:8,border:`1px solid ${BD}`}}>
            {tabs.map(t=>{const active=step===t.id;return(<button key={t.id} onClick={()=>setStep(t.id)}
              onMouseEnter={e=>{if(!active)e.currentTarget.style.background=`${R}08`;}}
              onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}
              style={{padding:"6px 12px",fontSize:11,borderRadius:6,cursor:"pointer",fontWeight:active?700:600,
                border:"none",background:active?WH:"transparent",color:active?R:DK,boxShadow:active?"0 1px 3px rgba(0,0,0,.08)":"none",display:"flex",alignItems:"center",gap:5,transition:"all .15s",position:"relative"}}>
              <span style={{fontSize:11,opacity:.7}}>{t.icon}</span>{t.l}
              {active&&<span style={{position:"absolute",bottom:-2,left:"50%",transform:"translateX(-50%)",width:14,height:2,background:R,borderRadius:1}}/>}
            </button>);})}
          </div>
          <div style={{position:"relative",marginLeft:6}}>
            <button onClick={(e)=>{e.stopPropagation();setShowExportMenu(!showExportMenu);}} disabled={!!exporting}
              style={{padding:"7px 14px",fontSize:11,borderRadius:6,cursor:exporting?"wait":"pointer",fontWeight:700,
                border:`1px solid ${R}`,background:exporting?"#EEE":`linear-gradient(135deg, ${R}, #A40C24)`,color:exporting?GY:WH,display:"flex",alignItems:"center",gap:6,boxShadow:exporting?"none":"0 1px 3px rgba(200,16,46,.25)"}}>
              {exporting?<><span style={{display:"inline-block",width:10,height:10,border:"2px solid #CCC",borderTopColor:R,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>Exportiert …</>:<>⬇ PDF Export</>}
            </button>
            {showExportMenu&&!exporting&&<div style={{position:"absolute",right:0,top:"100%",marginTop:6,background:WH,border:`1px solid ${BD}`,borderRadius:8,
              boxShadow:"0 8px 24px rgba(0,0,0,.14)",zIndex:200,minWidth:240,padding:5,fontSize:11}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"7px 11px",fontWeight:700,fontSize:9.5,color:GL,textTransform:"uppercase",letterSpacing:.5}}>Einzeln exportieren</div>
              {[["preview","Vorbemessung (Seite 1+2)"],["anlagen","Anlagen (FLL, Pflanzen, System)"],["material","Materialbedarfsermittlung"]].map(([id,label])=>
                <button key={id} onClick={()=>handleExport(id)} style={{display:"block",width:"100%",padding:"8px 11px",background:"none",border:"none",
                  textAlign:"left",cursor:"pointer",borderRadius:5,fontSize:11.5,color:DK}}
                  onMouseEnter={e=>e.currentTarget.style.background=BG}
                  onMouseLeave={e=>e.currentTarget.style.background="none"}>{label}</button>)}
              <div style={{borderTop:`1px solid ${BD}`,margin:"4px 0"}}/>
              <button onClick={exportAll} style={{display:"block",width:"100%",padding:"8px 11px",background:"none",border:"none",
                textAlign:"left",cursor:"pointer",borderRadius:5,fontSize:11.5,fontWeight:700,color:R}}
                onMouseEnter={e=>e.currentTarget.style.background=RL}
                onMouseLeave={e=>e.currentTarget.style.background="none"}>⬇ Alle 3 PDFs exportieren</button>
              <div style={{borderTop:`1px solid ${BD}`,margin:"4px 0"}}/>
              <div style={{padding:"7px 11px",fontWeight:700,fontSize:9.5,color:GL,textTransform:"uppercase",letterSpacing:.5}}>Daten</div>
              <button onClick={exportCsv} style={{width:"100%",padding:"8px 11px",background:"none",border:"none",
                textAlign:"left",cursor:"pointer",borderRadius:5,fontSize:11.5,fontWeight:600,color:DK,display:"flex",alignItems:"center",gap:8}}
                onMouseEnter={e=>e.currentTarget.style.background=BG}
                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                <span>📊</span>
                <span>Materialliste als CSV<br/><span style={{fontSize:9.5,color:GL,fontWeight:500}}>Excel-kompatibel (DE) · für Einkauf</span></span>
              </button>
            </div>}
          </div>
        </div>
      </div>

      {/* Restoration banner (shown once after auto-restore) */}
      {restored&&step!=="upload"&&<div style={{maxWidth:980,margin:"12px auto 0",padding:"0 14px"}}>
        <div style={{display:"flex",gap:10,alignItems:"center",padding:"10px 14px",background:"#E8F5E9",border:"1px solid #2E7D3240",borderRadius:8,fontSize:12}}>
          <span style={{fontSize:18}}>📂</span>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,color:"#1B5E20"}}>Letzte Sitzung wiederhergestellt</div>
            <div style={{color:GY,fontSize:10.5,marginTop:1}}>
              Alle deine Daten werden lokal in deinem Browser gespeichert (IndexedDB) — nichts wird hochgeladen.
              Mit "Neu" oben links startest du jederzeit von vorne.
            </div>
          </div>
          <button onClick={()=>setRestored(false)}
            style={{padding:"6px 10px",fontSize:11,border:"1px solid #2E7D3260",borderRadius:5,background:WH,cursor:"pointer",color:"#1B5E20",fontWeight:600}}>
            Verstanden
          </button>
        </div>
      </div>}

      {/* Parse-feedback banner (after upload) */}
      {parseInfo&&step==="edit"&&<ParseFeedbackBanner info={parseInfo} onClose={()=>setParseInfo(null)}/>}

      <div style={{maxWidth:980,margin:"0 auto",padding:"14px"}}>

{/* ═══ EDIT ═══ */}
{step==="edit"&&<>
  <Sec title="Dokument" icon="📋"><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
    <Field label="Dokument Nr." value={d.dokNr} onChange={setter("dokNr")} half/>
    <Field label="Version" value={d.version} onChange={setter("version")} sel opts={VERSIONEN} half/>
    <Field label="Bearbeiter" value={d.bearbeiter} onChange={setter("bearbeiter")} half/>
    <Field label="Datum" value={d.datum} onChange={setter("datum")} half/></div></Sec>

  <Sec title="Projekt" icon="🏢"><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
    <Field label="Bauvorhaben" value={d.bauvorhaben} onChange={setter("bauvorhaben")} half/>
    <Field label="Ort / PLZ" value={d.ort_plz} onChange={setter("ort_plz")} half/></div></Sec>

  <Sec title="System & Untergrund" icon="⚙">
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <Field label="SET Produkt" value={d.produkt} onChange={setter("produkt")} sel
        opts={SETS.map(s=>({v:s.id,l:`${s.l} (${s.art})`}))} full/>
    </div>
    {(()=>{const s=SETS.find(x=>x.id===d.produkt);return s?<div style={{padding:"7px 12px",background:RL,borderRadius:5,border:`1px solid ${RM}`,marginBottom:10,fontSize:11.5,fontWeight:600,color:R}}>
      → {s.l} ({s.art}) {d.verankerungsgrund&&UNTERGRUENDE.find(u=>u.id===d.verankerungsgrund)?.typ==="beton"?`· ${s.nutzBeton} mm Nutzlänge Beton`:`· ${s.nutzMW} mm Nutzlänge MW`}
    </div>:null})()}
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <Field label="Verankerungsgrund (gem. Z-21.8-2083)" value={d.verankerungsgrund} sel
        opts={UNTERGRUENDE.map(u=>({v:u.id,l:u.l}))}
        onChange={v=>{const u=UNTERGRUENDE.find(x=>x.id===v);
          if(u&&u.typ!=="custom")setD(x=>({...x,verankerungsgrund:v,druckfestigkeit:u.druckf,rohdichte:u.rohd}));
          else setter("verankerungsgrund")(v);}} full/>
      <Field label="WDVS-Dicke t_WDVS" value={d.wdvs_dicke} onChange={setter("wdvs_dicke")} sel opts={WDVS_DICKEN} half/>
      <Field label="Dicke Klebschicht t_tol" value={d.dicke_klebschicht} onChange={setter("dicke_klebschicht")} sel opts={KLEBSCHICHT_DICKEN} half/>
      <Field label="Verankerungstiefe h_ef,min" value={d.verankerungstiefe} onChange={setter("verankerungstiefe")} unit="mm" half/>
      <Field label="Gebäudehöhe h" value={d.gebaeudehoehe} onChange={setter("gebaeudehoehe")} unit="m" half/>
      <Field label="Druckfestigkeit σ" value={d.druckfestigkeit} onChange={setter("druckfestigkeit")} unit="N/mm²" half/>
      <Field label="Rohdichte ρ" value={d.rohdichte} onChange={setter("rohdichte")} unit="kg/dm³" half/>
      <Field label="Geländekategorie" value={d.gelaendekategorie} onChange={setter("gelaendekategorie")} sel opts={GELAENDEKATEGORIEN} half/>
      <Field label="Windlastzone" value={d.windlastzone} onChange={setter("windlastzone")} sel opts={WINDLASTZONEN} half/>
    </div>
  </Sec>

  <Sec title="Pflanze (FLL Tab. 15)" icon="🌿">
    <div style={{marginBottom:10}}>
      <label style={{fontSize:10.5,color:GY,fontWeight:600}}>Pflanzenart auswählen ({usable.length} Arten mit Lastklasse)</label>
      <select value={d.pflanze_botanisch||""} onChange={e=>selectPlant(e.target.value)}
        style={{width:"100%",padding:"7px 8px",fontSize:12,fontWeight:600,border:`1px solid ${BD}`,borderRadius:5,background:WH,fontFamily:"inherit",marginTop:3}}>
        <option value="">– Manuell eingeben –</option>
        {Object.entries(usable.reduce((acc,p)=>{const k=FORMS[p.form]||p.form;(acc[k]=acc[k]||[]).push(p);return acc;},{})).map(([k,arr])=>
          <optgroup key={k} label={k}>
            {arr.map(p=><option key={p.bot} value={p.bot}>{p.bot} · {p.de} – LK {p.lk}</option>)}
          </optgroup>)}
      </select>
    </div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <Field label="Pflanze (botanisch)" value={d.pflanze_botanisch} onChange={setter("pflanze_botanisch")} half/>
      <Field label="Pflanze (deutsch)" value={d.pflanze_deutsch} onChange={setter("pflanze_deutsch")} half/>
      <Field label="Lastklasse" value={String(d.lastklasse||"3")} onChange={setter("lastklasse")} sel opts={LASTKLASSEN} half/>
      <Field label="ψ (Durchströmung)" value={d.psi} onChange={setter("psi")} half hint="Standard nach FLL Tab. 15"/>
      <Field label="Geometrie/Begrünungsart" value={d.geometrie_art} onChange={setter("geometrie_art")} sel opts={[{v:"",l:"– bitte wählen –"},...GEOMETRIE_ARTEN]} full/>
    </div>
  </Sec>

  <Sec title="Vorschau-Darstellung" icon="🎨" subtitle="Beeinflusst die realistische Fassadenvorschau">
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <Field label="Bewuchsdichte (%)" value={d.coverage||"65"} onChange={setter("coverage")} unit="%" half/>
      <Field label="Bewuchsstadium" value={d.maturity||"mature"} onChange={setter("maturity")} sel opts={FOLIAGE_MATURITY} half/>
    </div>
    <div style={{fontSize:10.5,color:GL,marginTop:4}}>
      Fenster/Türen werden aus den Plan-Annotationen je Fassade übernommen (siehe "Fassadenflächen").
    </div>
  </Sec>

  <Sec title="Windlasten & Schnittgrößen" icon="🌬"><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
    <Field label="w_s (Windsog)" value={d.ws} onChange={setter("ws")} unit="kN/m²" half/>
    <Field label="N_Ek (Winddruck)" value={d.nek} onChange={setter("nek")} unit="kN/m²" half/>
    <Field label="N_d (Zug)" value={d.ned_z} onChange={setter("ned_z")} unit="kN" half hint="Zugkraft aus Windsog (N_d = LV·w_s·ψ·1,5)"/>
    <Field label="N_Ed (Druck)" value={d.ned_d} onChange={setter("ned_d")} unit="kN" half hint="Druckkraft aus Winddruck (N_Ed = N_Ek·LV·ψ·1,5)"/>
    <Field label="V_d (Querkraft)" value={d.ved} onChange={setter("ved")} unit="kN" half hint="Querkraft aus Eigenlast (V_d = LV·g·1,35)"/>
    <Field label="F_Rd (Bemessungswert Tragfähigkeit)" value={d.vrd} onChange={setter("vrd")} unit="kN" half hint="F_Rd = F_Rk / γ_M"/></div></Sec>

  <Sec title="Kernergebnisse" icon="◎" accent><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
    <Field label="Max. Abstand LH" value={d.LH} onChange={setter("LH")} unit="m" half/>
    <Field label="Max. Abstand LV" value={d.LV} onChange={setter("LV")} unit="m" half/>
    <Field label="ISO-Bar ECO pro m²" value={d.stk_m2} onChange={setter("stk_m2")} unit="Stk" half/></div></Sec>

  <Sec title="Nachweise (≤ 1,0)" icon="✓" accent>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
      <Field label="Zug: N_d / F_Rd" value={d.nw_zug} onChange={setter("nw_zug")} half/>
      <Field label="Druck: N_Ed / F_Rd" value={d.nw_druck} onChange={setter("nw_druck")} half/>
      <Field label="Quer: V_d / F_Rd" value={d.nw_quer} onChange={setter("nw_quer")} half/>
      <Field label="Quer/Zug: √(V_d²+N_d²) / F_Rd" value={d.nw_kombi} onChange={setter("nw_kombi")} half/></div>
    {(pf(d.nw_zug)||pf(d.nw_druck)||pf(d.nw_quer)||pf(d.nw_kombi))>0&&<div style={{border:`1px solid ${BD}`,borderRadius:6,padding:14,background:BG}}>
      <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:10,color:BK}}>Ausnutzungsgrad</div>
      <NwBar label="Zug: N_d / F_Rd" value={d.nw_zug}/>
      <NwBar label="Druck: N_Ed / F_Rd" value={d.nw_druck}/>
      <NwBar label="Quer: V_d / F_Rd" value={d.nw_quer}/>
      <NwBar label="Quer/Zug: √(V_d²+N_d²) / F_Rd" value={d.nw_kombi}/>
      {maxNw>0&&<div style={{marginTop:8,fontSize:11,fontWeight:700,color:maxNw<=1?GN:R}}>
        {maxNw<=1?"✓ Alle Nachweise erfüllt":`✗ Überschreitung! max: ${maxNw.toFixed(2)}`}</div>}
    </div>}</Sec>

  <Sec title="Fassadenflächen" icon="🏠" subtitle="Pro Fassade Raster, Maße und Seilkreuze festlegen">
    {(d.fassaden||[]).map((f,i)=>{
      const fRaster=f.seilfuehrung||d.seilfuehrung||"gitter";
      const fSK=f.seilkreuztyp||d.seilkreuztyp||"ohne";
      const fLH=f.lh||d.LH||"0.9";
      const fLV=f.lv||d.LV||"0.9";
      const updateF=(key,val)=>{const fa=[...(d.fassaden||[])];fa[i]={...fa[i],[key]:val};setD(x=>({...x,fassaden:fa,
        ...(i===0?{fassadenlaenge:fa[0].breite,fassadenhoehe:fa[0].hoehe}:{})}));};
      return(<div key={i} style={{border:`1px solid ${BD}`,borderRadius:8,padding:14,marginBottom:12,background:i%2===0?WH:"#FAFAF8"}}>
        <div style={{display:"flex",gap:10,alignItems:"end",marginBottom:10}}>
          <div style={{flex:2,minWidth:140}}>
            <label style={{fontSize:10.5,color:GY,display:"block",marginBottom:2,fontWeight:600}}>Name</label>
            <input value={f.name} onChange={e=>updateF("name",e.target.value)}
              style={{width:"100%",padding:"7px 8px",fontSize:12,fontWeight:700,border:`1px solid ${BD}`,borderRadius:5,background:WH,fontFamily:"inherit"}}/></div>
          <div style={{flex:1}}>
            <label style={{fontSize:10.5,color:GY,display:"block",marginBottom:2,fontWeight:600}}>Breite</label>
            <div style={{display:"flex",border:`1px solid ${BD}`,borderRadius:5,background:WH}}>
              <input value={f.breite} onChange={e=>updateF("breite",e.target.value)}
                style={{flex:1,border:"none",padding:"7px 8px",fontSize:12,fontWeight:600,background:"transparent",outline:"none",fontFamily:"inherit",minWidth:0}}/>
              <span style={{padding:"0 8px",fontSize:10,color:GL,alignSelf:"center"}}>m</span></div></div>
          <div style={{flex:1}}>
            <label style={{fontSize:10.5,color:GY,display:"block",marginBottom:2,fontWeight:600}}>Höhe</label>
            <div style={{display:"flex",border:`1px solid ${BD}`,borderRadius:5,background:WH}}>
              <input value={f.hoehe} onChange={e=>updateF("hoehe",e.target.value)}
                style={{flex:1,border:"none",padding:"7px 8px",fontSize:12,fontWeight:600,background:"transparent",outline:"none",fontFamily:"inherit",minWidth:0}}/>
              <span style={{padding:"0 8px",fontSize:10,color:GL,alignSelf:"center"}}>m</span></div></div>
          {(d.fassaden||[]).length>1&&<button onClick={()=>{const fa=[...(d.fassaden||[])];fa.splice(i,1);setD(x=>({...x,fassaden:fa}));}}
            style={{padding:"7px 10px",fontSize:12,border:`1px solid ${BD}`,borderRadius:5,background:WH,cursor:"pointer",color:R,fontWeight:700}}>✕</button>}
        </div>

        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:6}}>
          <div style={{flex:1,minWidth:240,display:"flex",flexDirection:"column",gap:8}}>
            <Field label="Seilführung" value={fRaster} onChange={v=>updateF("seilfuehrung",v)} sel
              opts={RASTER.map(r=>({v:r.id,l:`${r.l} – ${r.d}`}))}/>
            <Field label="Seilkreuztyp" value={fSK} onChange={v=>updateF("seilkreuztyp",v)} sel
              opts={SEILKREUZE.map(sk=>({v:sk.id,l:sk.art?`${sk.l} (${sk.art})`:sk.l}))}/>
            {fSK!=="ohne"&&<div style={{padding:"6px 10px",background:"#E3F2FD",borderRadius:5,border:"1px solid #90CAF940",fontSize:10.5,color:"#1565C0"}}>
              ⓘ Seilkreuze sitzen in der Zellmitte zwischen vier Ankern.</div>}
            <div style={{display:"flex",gap:10}}>
              <Field label="LH" value={f.lh||d.LH||"0.9"} onChange={v=>updateF("lh",v)} unit="m" half/>
              <Field label="LV" value={f.lv||d.LV||"0.9"} onChange={v=>updateF("lv",v)} unit="m" half/>
            </div>
            <Field label="Höhe 1. Lage (Startversatz unten)" value={f.lage1??d.Lage1??"0"} onChange={v=>updateF("lage1",v)} sel
              opts={LAGE1_HOEHEN} hint="Unterste Ankerreihe sitzt auf dieser Höhe; das Raster läuft im LV-Abstand nach oben."/>
          </div>
          <div style={{flex:1,minWidth:300,display:"flex",flexDirection:"column",gap:8}}>
            {/* Plan-based preview (when plan + annotations) — shows anchors/cables on the real plan */}
            {f.plan&&f.annotations&&(f.annotations.facades||[]).length>0&&<div style={{background:BG,borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9.5,fontWeight:700,color:GY,textTransform:"uppercase",letterSpacing:.4,marginBottom:4,textAlign:"left"}}>Live im Plan</div>
              <RasterOverlay LH={fLH} LV={fLV} fW={f.breite||"3"} fH={f.hoehe||"3"} rasterType={fRaster}
                lage1={f.lage1??d.Lage1??"0"} seilkreuztyp={fSK} size={340} plan={f.plan} annotations={f.annotations}/>
            </div>}
            {/* Schematic raster (always shown) — clear cable pattern + Seilkreuze, independent of plan */}
            <div style={{background:BG,borderRadius:8,padding:10,textAlign:"center"}}>
              <div style={{fontSize:9.5,fontWeight:700,color:GY,textTransform:"uppercase",letterSpacing:.4,marginBottom:4,textAlign:"left"}}>
                Schematische Rasterdarstellung
                <span style={{fontWeight:500,color:GL,marginLeft:6,textTransform:"none",letterSpacing:0}}>· {RASTER.find(rr=>rr.id===fRaster)?.l}{fSK!=="ohne"?` + ${SEILKREUZE.find(s=>s.id===fSK)?.l}`:""}</span>
              </div>
              <RasterOverlay LH={fLH} LV={fLV} fW={f.breite||"3"} fH={f.hoehe||"3"} rasterType={fRaster}
                lage1={f.lage1??d.Lage1??"0"} seilkreuztyp={fSK} size={340} forceProcedural/>
              <div style={{fontSize:10,color:DK,fontWeight:600,marginTop:4}}>{f.name}: {f.breite||"–"} × {f.hoehe||"–"} m = {((pf(f.breite)||0)*(pf(f.hoehe)||0)).toFixed(1)} m²</div>
            </div>
          </div>
        </div>

        {/* Plan upload + annotator */}
        <div style={{marginTop:12}}>
          <FacadePlanPanel facade={f} onUpdate={patch=>{
            const fa=[...(d.fassaden||[])];fa[i]={...fa[i],...patch};setD(x=>({...x,fassaden:fa}));
          }}/>
        </div>
      </div>);
    })}
    <button onClick={()=>setD(x=>({...x,fassaden:[...(x.fassaden||[]),{name:`Fassade ${(x.fassaden||[]).length+1}`,breite:"10",hoehe:"6",seilfuehrung:x.seilfuehrung||"gitter",seilkreuztyp:x.seilkreuztyp||"ohne"}]}))}
      style={{padding:"8px 16px",fontSize:11,border:`1px dashed ${BD}`,borderRadius:6,background:WH,cursor:"pointer",color:GY,marginTop:6,fontWeight:600}}>+ weitere Fassade</button></Sec>
</>}

{/* ═══ PREVIEW ═══ */}
{step==="preview"&&<div style={{borderRadius:8,boxShadow:"0 2px 12px rgba(0,0,0,.08)",overflow:"hidden"}}>
  <PreviewSection d={d} maxNw={maxNw} mat={mat}/>
</div>}

{/* ═══ ANLAGEN ═══ */}
{step==="anlagen"&&<div style={{borderRadius:8,boxShadow:"0 2px 12px rgba(0,0,0,.08)",overflow:"hidden"}}>
  <AnlagenSection d={d} usable={usable}/>
</div>}

{/* ═══ MATERIAL ═══ */}
{step==="material"&&<div style={{borderRadius:8,boxShadow:"0 2px 12px rgba(0,0,0,.08)",overflow:"hidden"}}>
  <MaterialSection d={d} mat={mat}/>
</div>}
      </div>

{/* ═══ OFF-SCREEN PDF RENDER CONTAINERS ═══ */}
<div data-pdf-offscreen="true" style={{position:"absolute",left:"-9999px",top:0,overflow:"visible",pointerEvents:"none"}}>
  <div style={{width:880,background:WH,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
    <div ref={previewRef} style={{background:WH,width:880,padding:0}}><PreviewSection d={d} maxNw={maxNw} mat={mat}/></div>
  </div>
  <div style={{width:880,background:WH,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
    <div ref={anlagenRef} style={{background:WH,width:880,padding:0}}><AnlagenSection d={d} usable={usable}/></div>
  </div>
  <div style={{width:880,background:WH,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
    <div ref={materialRef} style={{background:WH,width:880,padding:0}}><MaterialSection d={d} mat={mat}/></div>
  </div>
</div>

</div>);
}
