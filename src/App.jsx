import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

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

// ─── PDF Parser ─────────────────────────────────────────
function parsePdf(t){
  const d={bauvorhaben:"",ort_plz:"",datum:new Date().toLocaleDateString("de-DE"),dokNr:`VB-ISO-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-001`,version:"V1.0",bearbeiter:"",
    produkt:"eco260",verankerungsgrund:"ks_vollstein",wdvs_dicke:"",gebaeudehoehe:"",gelaendekategorie:"",druckfestigkeit:"12",rohdichte:"1.8",verankerungstiefe:"",dicke_klebschicht:"10",
    pflanze_botanisch:"",pflanze_deutsch:"",lastklasse:"3",seilfuehrung:"gitter",seilkreuztyp:"ohne",psi:"0.60",
    ws:"",nek:"",ned_z:"",ned_d:"",ved:"",vrd:"",LH:"0.9",LV:"0.9",stk_m2:"",
    nw_zug:"",nw_druck:"",nw_quer:"",nw_kombi:"",
    fassadenlaenge:"10",fassadenhoehe:"",windlastzone:"",geometrie_art:"",
    fassaden:[{name:"Fassade 1",breite:"10",hoehe:"6"}]};
  const f=(p)=>{const m=t.match(new RegExp(p,"im"));return m?m[1].trim():""};
  d.bauvorhaben=f("Bauvorhaben\\s+(.+?)(?:\\s{2,}|$)");
  d.ort_plz=f("Ort\\s*/\\s*PLZ\\s+(.+?)(?:\\s{2,}|$)");
  d.datum=f("Datum\\s+(\\d+\\.\\d+\\.\\d+)")||d.datum;
  d.verankerungsgrund=f("Verankerungsgrund\\s+(.+?)(?:\\s{2,}|$)");
  d.wdvs_dicke=f("WDVS-?Dicke\\s+([\\d.]+)");
  d.gebaeudehoehe=f("Geb[aä]udeh[oö]he\\s+([\\d.]+)");
  d.produkt=f("Produkt\\s+(.+?)(?:\\s{2,}|$)")||d.produkt;
  d.LH=f("horizontaler?\\s+Abstand\\s*\\(LH\\)\\s+([\\d.]+)");
  d.LV=f("vertikaler?\\s+Abstand\\s*\\(LV\\)\\s+([\\d.]+)");
  d.stk_m2=f("ISO-Bar\\s+ECO\\s+pro\\s+m.\\s+([\\d.]+)");
  d.nw_zug=f("Zug,\\s*N[^\\n]*(\\d+\\.?\\d*)\\s*$");
  d.nw_druck=f("Druck,\\s*N[^\\n]*(\\d+\\.?\\d*)\\s*$");
  d.nw_quer=f("Quer,\\s*V[^\\n]*(\\d+\\.?\\d*)\\s*$");
  d.nw_kombi=f("Kombination[^\\n]*(\\d+\\.?\\d*)\\s*$");
  d.lastklasse=f("Lastklasse\\s+(\\d)")||"3";
  d.psi=f("[ψΨ][^\\n]*(\\d+\\.\\d+)")||"0.60";
  d.ws=f("ws\\s*\\(Windsog\\)[^\\n]*(\\d+\\.?\\d*)");
  d.nek=f("Nek\\s*\\(Winddruck\\)[^\\n]*(\\d+\\.?\\d*)");
  d.ned_z=f("Ned,z\\s*\\(Zug\\)[^\\n]*(\\d+\\.?\\d*)");
  d.ned_d=f("Ned,d\\s*\\(Druck\\)[^\\n]*(\\d+\\.?\\d*)");
  d.ved=f("VEd\\s*\\(Quer\\)[^\\n]*(\\d+\\.?\\d*)");
  d.vrd=f("VRd\\s*\\(Quertrag\\.?\\)[^\\n]*(\\d+\\.?\\d*)");
  d.windlastzone=f("Windlastzone\\s+(.+?)\\s*$");
  d.gelaendekategorie=f("Gel[aä]ndekategorie\\s+(.+?)\\s*$");
  d.geometrie_art=f("Geometrie\\s*/\\s*Begr[uü]nungsart\\s+(.+?)\\s*$");
  d.fassadenhoehe=d.gebaeudehoehe||"3";
  return d;
}

// ─── Material calculator ────────────────────────────────
function calcMaterial(d){
  const lh=pf(d.LH)||.9,lv=pf(d.LV)||.9,fw=pf(d.fassadenlaenge)||10,fh=pf(d.fassadenhoehe)||10;
  const cols=Math.floor(fw/lh),rows=Math.floor(fh/lv);
  const pts=(cols+1)*(rows+1);
  const area=fw*fh;
  const seilV=(cols+1)*fh, seilH=(rows+1)*fw;
  const seilD=d.seilfuehrung==="diagonal"?cols*rows*Math.sqrt(lh*lh+lv*lv)*2:0;
  const seilGes=((d.seilfuehrung==="vertikal"?seilV:0)+(d.seilfuehrung==="horizontal"?seilH:0)
    +(d.seilfuehrung==="gitter"?seilV+seilH:0)+(d.seilfuehrung==="diagonal"?seilD:0));
  const kreuze90=d.seilfuehrung==="gitter"?(cols-1)*(rows-1):0;
  const kreuzeVar=d.seilfuehrung==="gitter"||d.seilfuehrung==="diagonal"?cols*rows*2:0;
  return {pts,area,cols:cols+1,rows:rows+1,seilV:seilV.toFixed(1),seilH:seilH.toFixed(1),seilD:seilD.toFixed(1),
    seilGes:seilGes.toFixed(1),kreuze90,kreuzeVar,
    sockel95:Math.round(pts*0.7),sockel150:Math.round(pts*0.3),endkappen:pts*2,
    stkM2:(pts/area).toFixed(2)};
}
function pf(v){return parseFloat(String(v).replace(",","."));}
function fm(v,d=2){return v?Number(v).toFixed(d).replace(".",","):"–";}

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

function RasterSVG({LH,LV,fW,fH,rasterType,seilkreuztyp="ohne",skInterval=1,size=300}){
  const lh=pf(LH)||.9,lv=pf(LV)||.9,fw=pf(fW)||3,fh=pf(fH)||3;
  const cols=Math.min(Math.max(1,Math.floor(fw/lh)),12),rows=Math.min(Math.max(1,Math.floor(fh/lv)),12);
  const pad=42,inner=size-2*pad,cell=Math.min(inner/cols,inner/rows);
  const gw=cell*cols,gh=cell*rows,ox=pad+(inner-gw)/2,oy=pad+(inner-gh)/2;
  const L=[];
  const BL="#1565C0";
  const a=(x1,y1,x2,y2,c="#AAA",w=.7)=>L.push({x1,y1,x2,y2,c,w});
  // Horizontal + vertical lines
  if(rasterType==="gitter"||rasterType==="vertikal")for(let c=0;c<=cols;c++)a(ox+c*cell,oy,ox+c*cell,oy+gh,"#AAA",.8);
  if(rasterType==="gitter"||rasterType==="horizontal")for(let r=0;r<=rows;r++)a(ox,oy+r*cell,ox+gw,oy+r*cell,"#AAA",.8);
  // Diagonal lines — ONLY for diagonal mode, NOT for gitter
  const hasDiag=rasterType==="diagonal";
  if(hasDiag)for(let c=0;c<cols;c++)for(let r=0;r<rows;r++){
    a(ox+c*cell,oy+r*cell,ox+(c+1)*cell,oy+(r+1)*cell,"#C0C0C0",.5);
    a(ox+(c+1)*cell,oy+r*cell,ox+c*cell,oy+(r+1)*cell,"#C0C0C0",.5);}
  // Anchor points (red circles at grid intersections)
  const pts=[];for(let c=0;c<=cols;c++)for(let r=0;r<=rows;r++)pts.push({x:ox+c*cell,y:oy+r*cell});
  // Seilkreuz positions (blue squares)
  const skPts=[];
  const ski=Math.max(1,Math.round(skInterval));
  if(seilkreuztyp&&seilkreuztyp!=="ohne"&&hasDiag){
    // Diagonal mode: Seilkreuze in cell centers (diagonal crossing)
    for(let c=0;c<cols;c++)for(let r=0;r<rows;r++){
      if(c%ski===0&&r%ski===0){
        skPts.push({x:ox+(c+0.5)*cell,y:oy+(r+0.5)*cell});}}}
  else if(seilkreuztyp&&seilkreuztyp!=="ohne"&&rasterType==="gitter"){
    // Gitter mode: Seilkreuze at interior 90° crossing points
    for(let c=1;c<cols;c++)for(let r=1;r<rows;r++){
      if((c-1)%ski===0&&(r-1)%ski===0){
        skPts.push({x:ox+c*cell,y:oy+r*cell});}}}
  const numAnker=pts.length;
  const numSK=skPts.length;
  const DH=(x1,x2,y,l)=><g key={`h${l}`}><line x1={x1} y1={y} x2={x2} y2={y} stroke={BK} strokeWidth=".5"/><line x1={x1} y1={y-3} x2={x1} y2={y+3} stroke={BK} strokeWidth=".5"/><line x1={x2} y1={y-3} x2={x2} y2={y+3} stroke={BK} strokeWidth=".5"/><text x={(x1+x2)/2} y={y+10} textAnchor="middle" fontSize="8" fill={BK} fontFamily="sans-serif">{l}</text></g>;
  const DV=(x,y1,y2,l)=><g key={`v${l}`}><line x1={x} y1={y1} x2={x} y2={y2} stroke={BK} strokeWidth=".5"/><line x1={x-3} y1={y1} x2={x+3} y2={y1} stroke={BK} strokeWidth=".5"/><line x1={x-3} y1={y2} x2={x+3} y2={y2} stroke={BK} strokeWidth=".5"/><text x={x-4} y={(y1+y2)/2} textAnchor="end" fontSize="8" fill={BK} fontFamily="sans-serif" transform={`rotate(-90,${x-4},${(y1+y2)/2})`}>{l}</text></g>;
  const sqSize=Math.max(3,Math.min(6,cell*0.18));
  return(<svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{maxWidth:size}}>
    {L.map((l,i)=><line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.c} strokeWidth={l.w}/>)}
    {skPts.map((p,i)=><rect key={`sk${i}`} x={p.x-sqSize} y={p.y-sqSize} width={sqSize*2} height={sqSize*2} fill={BL} rx={1}/>)}
    {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={Math.max(3,Math.min(5,cell*0.14))} fill={R}/>)}
    {DH(ox,ox+cell,oy+gh+12,`LH=${lh.toFixed(1).replace(".",",")}m`)}
    {gw>cell*1.2&&DH(ox,ox+gw,oy+gh+26,`${Math.min(fw,cols*lh).toFixed(1).replace(".",",")} m`)}
    {DV(ox-12,oy,oy+cell,`LV=${lv.toFixed(1).replace(".",",")}m`)}
    {gh>cell*1.2&&DV(ox-26,oy,oy+gh,`${Math.min(fh,rows*lv).toFixed(1).replace(".",",")} m`)}
    <text x={ox+gw/2} y={size-2} textAnchor="middle" fontSize="7.5" fill={GL} fontFamily="sans-serif">
      <tspan fill={R}>●</tspan> {numAnker} Anker{numSK>0&&<>{" "}<tspan fill={BL}>■</tspan> {numSK} Seilkreuze</>} = {numAnker+numSK} Punkte
    </text>
  </svg>);
}

function NwBar({label,value}){
  const v=pf(value)||0;const pct=Math.min(v,1.1)*100;
  const col=v<.5?GN:v<.8?AM:R;
  return(<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
    <div style={{width:140,fontSize:12,color:DK}}><Sub>{label}</Sub></div>
    <div style={{flex:1,height:18,background:"#ECECEC",borderRadius:3,position:"relative",border:`1px solid ${BD}`}}>
      <div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:col,borderRadius:3,transition:"width .3s"}}/>
      <span style={{position:"absolute",right:pct>55?5:"auto",left:pct<=55?`${Math.min(pct,100)}%`:"auto",marginLeft:pct<=55?5:0,top:"50%",transform:"translateY(-50%)",fontSize:11,fontWeight:700,color:pct>55?WH:BK}}>{v?v.toFixed(2):"–"}</span>
    </div>
    <span style={{fontSize:13,fontWeight:700,color:v&&v<=1?GN:v>1?R:GL,width:16}}>{v?(v<=1?"✓":"✗"):"–"}</span>
  </div>);
}

function Field({label,value,onChange,unit,half,ro,sel,opts}){
  return(<div style={{flex:half?"0 0 48%":"1 1 48%",minWidth:120,marginBottom:7}}>
    <label style={{fontSize:10,color:GY,display:"block",marginBottom:1}}><Sub>{label}</Sub></label>
    <div style={{display:"flex",border:`1px solid ${BD}`,borderRadius:4,background:ro?BG:WH}}>
      {sel?<select value={value} onChange={e=>onChange?.(e.target.value)} style={{flex:1,border:"none",padding:"6px 7px",fontSize:12,fontWeight:600,background:"transparent",outline:"none",fontFamily:"inherit",color:BK}}>
        {opts.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}</select>
      :<input value={value} onChange={e=>onChange?.(e.target.value)} readOnly={ro} style={{flex:1,border:"none",padding:"6px 7px",fontSize:12,fontWeight:600,background:"transparent",outline:"none",fontFamily:"inherit",color:BK,minWidth:0}}/>}
      {unit&&<span style={{padding:"0 7px",fontSize:9.5,color:GL,whiteSpace:"nowrap",alignSelf:"center"}}>{unit}</span>}
    </div></div>);
}

function Sec({title,children,accent,open:defOpen=true}){
  const[o,setO]=useState(defOpen);
  return(<div style={{border:`1px solid ${accent?RM:BD}`,borderRadius:5,marginBottom:10,background:WH}}>
    <div onClick={()=>setO(!o)} style={{padding:"7px 12px",borderBottom:o?`1px solid ${accent?RM:BD}`:"none",background:accent?RL:BG,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontWeight:700,fontSize:11,letterSpacing:.5,textTransform:"uppercase",color:accent?R:BK}}>{title}</span>
      <span style={{fontSize:9,color:GL}}>{o?"▼":"▶"}</span></div>
    {o&&<div style={{padding:"10px 12px"}}>{children}</div>}</div>);
}

function KV({l,v,b}){return(<div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}>
  <span style={{color:GY}}><Sub>{l}</Sub></span><span style={{fontWeight:b?700:600,color:BK,textAlign:"right"}}>{v||"–"}</span></div>);}

function PageHead({title,subtitle}){
  return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
    <span style={{fontWeight:900,fontSize:22,color:R}}>EJOT<sup style={{fontSize:7}}>®</sup></span>
    <div style={{textAlign:"right"}}><div style={{fontSize:16,fontWeight:700,color:BK}}>{title}</div>
      {subtitle&&<div style={{fontSize:10,color:GY}}>{subtitle}</div>}</div></div>);
}

// ─── PDF Section Components (reusable for on-screen + off-screen) ───
function PreviewSection({d,maxNw,mat}){
  return(<div style={{background:WH}}>
    <div style={{borderTop:`3px solid ${R}`,padding:"16px 24px"}}>
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
          <KV l="Produkt" v={d.produkt} b/><KV l="Verankerungsgrund" v={d.verankerungsgrund} b/>
          <KV l="WDVS-Dicke" v={d.wdvs_dicke?`${d.wdvs_dicke} mm`:""} b/>
          <KV l="Gebäudehöhe" v={d.gebaeudehoehe?`${d.gebaeudehoehe} m`:""} b/></div></div>
      <div style={{border:`1px solid ${RM}`,borderRadius:4,padding:12,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:8,color:R}}>Kernergebnisse</div>
        {[["Max. horizontaler Abstand (LH)",d.LH?`${d.LH} m`:"–"],["Max. vertikaler Abstand (LV)",d.LV?`${d.LV} m`:"–"],
          ["Erforderliche ISO-Bar ECO pro m²",d.stk_m2||"–"]].map(([k,v])=>
          <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:13}}>
            <span style={{color:DK}}>{k}</span><span style={{fontWeight:700,fontSize:14,color:BK}}>{v}</span></div>)}</div>
      <div style={{fontSize:9,color:GL,lineHeight:1.5,borderTop:`1px solid ${BD}`,paddingTop:6}}>
        Hinweis: Diese Vorbemessung dient als Orientierung und ersetzt keinen objektspezifischen statischen Nachweis.</div></div>
    <div style={{borderTop:`6px solid ${BG}`,padding:"16px 24px"}}>
      <PageHead title="Technische Übersicht" subtitle="Nachweise, Hinweise, schematische Darstellung"/>
      <div style={{display:"flex",gap:12,marginBottom:14}}>
        <div style={{flex:1,border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
          <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:3,color:BK}}>Nachweise (Ausnutzung)</div>
          {maxNw>.85&&<div style={{display:"inline-block",padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700,
            background:maxNw>1?"#FFEBEE":"#FFF3E0",color:maxNw>1?R:AM,marginBottom:6,border:`1px solid ${maxNw>1?R:AM}40`}}>
            {maxNw>1?"ÜBERSCHREITUNG":"GRENZBEREICH"} max: {maxNw.toFixed(2)}</div>}
          <NwBar label="Zug, N_Ed,z / N_Rd" value={d.nw_zug}/><NwBar label="Druck, N_Ed,d / N_Rd,d" value={d.nw_druck}/>
          <NwBar label="Quer, V_Ed / V_Rd" value={d.nw_quer}/><NwBar label="Kombination (max)" value={d.nw_kombi}/>
          <div style={{fontSize:8.5,color:GL,marginTop:8}}>Zulassungsbezug: Z-21.8-2083</div></div>
        <div style={{flex:1,border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
          <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:6,color:BK}}>Raster ({RASTER.find(r=>r.id===d.seilfuehrung)?.l})</div>
          <RasterSVG LH={d.LH} LV={d.LV} fW={d.fassadenlaenge||"3"} fH={d.fassadenhoehe||"3"} rasterType={d.seilfuehrung} seilkreuztyp={d.seilkreuztyp} size={240}/>
          <div style={{fontSize:8.5,color:GL,marginTop:4}}>Schematisch – ersetzt keine Ausführungsplanung.</div></div></div>
      <div style={{border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:6,color:BK}}>Lasten &amp; Widerstände</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 16px"}}>
          {[["Lastklasse",d.lastklasse],["ψ (Durchströmung)",d.psi],["w_s (Windsog) [kN/m²]",d.ws],["N_Ek (Winddruck) [kN/m²]",d.nek],
            ["N_Ed,z (Zug) [kN]",d.ned_z],["N_Ed,d (Druck) [kN]",d.ned_d],["V_Ed (Quer) [kN]",d.ved],["V_Rd (Quertrag.) [kN]",d.vrd]].map(([k,v])=>
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:`1px solid ${BG}`,fontSize:11.5}}>
              <span style={{color:GY}}><Sub>{k}</Sub></span><span style={{fontWeight:700,color:BK}}>{v||"–"}</span></div>)}</div></div></div>
    <div style={{borderTop:`1px solid ${BD}`,padding:"6px 24px",display:"flex",justifyContent:"space-between",fontSize:9,color:GL}}>
      <span>EJOT · ISO-Bar ECO · Vorbemessung</span><span>{d.dokNr}</span></div>
  </div>);
}

function AnlagenSection({d,usable}){
  return(<div style={{background:WH}}>
    <div style={{borderTop:`3px solid ${R}`,padding:"16px 24px"}}>
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
    <div style={{borderTop:`6px solid ${BG}`,padding:"16px 24px"}}>
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
    <div style={{borderTop:`6px solid ${BG}`,padding:"16px 24px"}}>
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
      </div></div>
    <div style={{borderTop:`1px solid ${BD}`,padding:"6px 24px",display:"flex",justifyContent:"space-between",fontSize:9,color:GL}}>
      <span>EJOT · ISO-Bar ECO · Anlagen</span><span>{d.dokNr}</span></div>
  </div>);
}

function MaterialSection({d,mat}){
  // Calculate per-facade totals
  const fassaden=d.fassaden||[{name:"Fassade 1",breite:d.fassadenlaenge||"10",hoehe:d.fassadenhoehe||"6"}];
  const lh=pf(d.LH)||.9,lv=pf(d.LV)||.9;
  let totalAnker=0,totalSK=0,totalArea=0;
  const facadeStats=fassaden.map(f=>{
    const fw=pf(f.breite)||0,fh=pf(f.hoehe)||0;
    const cols=Math.floor(fw/lh),rows=Math.floor(fh/lv);
    const anker=(cols+1)*(rows+1);
    let sk=0;
    if(d.seilkreuztyp&&d.seilkreuztyp!=="ohne"){
      if(d.seilfuehrung==="diagonal")sk=cols*rows;
      else if(d.seilfuehrung==="gitter")sk=Math.max(0,(cols-1))*Math.max(0,(rows-1));
    }
    totalAnker+=anker;totalSK+=sk;totalArea+=fw*fh;
    return{name:f.name,breite:fw,hoehe:fh,area:fw*fh,anker,sk,cols:cols+1,rows:rows+1};
  });
  const setInfo=SETS.find(s=>s.id===d.produkt);
  const skInfo=SEILKREUZE.find(s=>s.id===d.seilkreuztyp);
  return(<div style={{background:WH}}>
    <div style={{borderTop:`3px solid ${R}`,padding:"16px 24px"}}>
      <PageHead title="Materialbedarfsermittlung" subtitle="Überschlägige Mengenermittlung auf Basis der Vorbemessung"/>
      <div style={{borderTop:`1px solid ${R}`,marginBottom:12}}/>
      <div style={{display:"flex",gap:12,marginBottom:14}}>
        <div style={{flex:1,border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
          <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:8,color:BK}}>Eingangswerte</div>
          <KV l="Gesamtfläche" v={`${totalArea.toFixed(1)} m²`} b/>
          <KV l="Fassaden" v={`${fassaden.length} Stk.`}/>
          <KV l="LH / LV" v={`${d.LH||"–"} / ${d.LV||"–"} m`}/>
          <KV l="Seilführung" v={RASTER.find(r=>r.id===d.seilfuehrung)?.l}/>
          <KV l="Seilkreuztyp" v={skInfo?.l||"–"}/>
          {setInfo&&<KV l="SET Produkt" v={setInfo.l} b/>}</div>
        <div style={{flex:1}}>
          <RasterSVG LH={d.LH} LV={d.LV} fW={d.fassadenlaenge} fH={d.fassadenhoehe} rasterType={d.seilfuehrung} seilkreuztyp={d.seilkreuztyp} size={240}/></div></div>

      {/* Per-facade breakdown */}
      {fassaden.length>1&&<div style={{border:`1px solid ${BD}`,borderRadius:4,padding:12,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:8,color:BK}}>Aufschlüsselung je Fassade</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr>{["Fassade","B × H","Fläche","Anker","Seilkreuze","Gesamt"].map(h=>
            <th key={h} style={{background:BG,fontWeight:700,padding:"4px 8px",textAlign:"left",borderBottom:`1px solid ${BD}`,fontSize:10}}>{h}</th>)}</tr></thead>
          <tbody>
            {facadeStats.map((f,i)=><tr key={i}>
              <td style={{padding:"3px 8px",borderBottom:`1px solid ${BD}`,fontWeight:600}}>{f.name}</td>
              <td style={{padding:"3px 8px",borderBottom:`1px solid ${BD}`}}>{f.breite} × {f.hoehe} m</td>
              <td style={{padding:"3px 8px",borderBottom:`1px solid ${BD}`}}>{f.area.toFixed(1)} m²</td>
              <td style={{padding:"3px 8px",borderBottom:`1px solid ${BD}`,fontWeight:700,color:R}}>{f.anker}</td>
              <td style={{padding:"3px 8px",borderBottom:`1px solid ${BD}`,fontWeight:700,color:"#1565C0"}}>{f.sk}</td>
              <td style={{padding:"3px 8px",borderBottom:`1px solid ${BD}`,fontWeight:700}}>{f.anker+f.sk}</td></tr>)}
            <tr style={{background:BG}}>
              <td style={{padding:"4px 8px",fontWeight:700}} colSpan={2}>Gesamt</td>
              <td style={{padding:"4px 8px",fontWeight:700}}>{totalArea.toFixed(1)} m²</td>
              <td style={{padding:"4px 8px",fontWeight:700,color:R}}>{totalAnker}</td>
              <td style={{padding:"4px 8px",fontWeight:700,color:"#1565C0"}}>{totalSK}</td>
              <td style={{padding:"4px 8px",fontWeight:700}}>{totalAnker+totalSK}</td></tr>
          </tbody></table></div>}

      <div style={{border:`1px solid ${RM}`,borderRadius:4,padding:12,marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:8,color:R}}>Stückliste (überschlägig)</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
          <thead><tr>{["Pos.","Bezeichnung","Menge","Einheit","Hinweis"].map(h=>
            <th key={h} style={{background:BG,fontWeight:700,padding:"5px 8px",textAlign:"left",borderBottom:`1px solid ${BD}`,fontSize:10.5}}>{h}</th>)}</tr></thead>
          <tbody>
            {[
              ["1",setInfo?setInfo.l:"EJOT Iso-Bar ECO (Ankerpunkt)",String(totalAnker||mat.pts),"Stk",setInfo?`Art. ${setInfo.art}`:""],
              ["2",`Seil Edelstahl V4A ø4mm – vertikal`,mat.seilV,"m",`${mat.cols} Stränge × ${d.fassadenhoehe||"–"} m`],
              ["3",`Seil Edelstahl V4A ø4mm – horizontal`,mat.seilH,"m",`${mat.rows} Stränge × ${d.fassadenlaenge||"–"} m`],
              ...(d.seilfuehrung==="diagonal"?[["4","Seil Edelstahl V4A ø4mm – diagonal",mat.seilD,"m","2× pro Feld"]]:[]),
              ["5","Seil gesamt (alle Richtungen)",mat.seilGes,"m","inkl. Verschnitt ca. +10%"],
              ...(totalSK>0&&skInfo?[["6",`${skInfo.l}`,String(totalSK),"Stk",skInfo.art?`Art. ${skInfo.art}`:"alle Fassaden"]]:[]),
              ...(totalSK===0&&d.seilfuehrung==="gitter"?[["6","Seilkreuz 90° (Kreuzungspunkte)",String(mat.kreuze90),"Stk","nur bei Gitter"]]:[]),
              [totalSK>0?"7":"7","Abstandssockel 95mm",String(mat.sockel95),"Stk","ca. 70% der Punkte"],
              [totalSK>0?"8":"8","Abstandssockel 150mm",String(mat.sockel150),"Stk","ca. 30% der Punkte"],
              [totalSK>0?"9":"9","Endkappen / Seilhülsen",String(mat.endkappen),"Stk","2 pro Ankerpunkt"],
            ].map(([p,b,m,e,h],idx)=><tr key={idx}>
              <td style={{padding:"4px 8px",borderBottom:`1px solid ${BD}`,fontWeight:700,color:R,width:30}}>{idx+1}</td>
              <td style={{padding:"4px 8px",borderBottom:`1px solid ${BD}`}}>{b}</td>
              <td style={{padding:"4px 8px",borderBottom:`1px solid ${BD}`,fontWeight:700,textAlign:"right"}}>{m}</td>
              <td style={{padding:"4px 8px",borderBottom:`1px solid ${BD}`}}>{e}</td>
              <td style={{padding:"4px 8px",borderBottom:`1px solid ${BD}`,fontSize:10,color:GL}}>{h}</td></tr>)}
          </tbody></table></div>
      <div style={{padding:10,background:"#FFF8E1",borderRadius:4,border:`1px solid ${AM}40`,fontSize:9.5,color:DK}}>
        <strong style={{color:AM}}>⚠ Hinweis:</strong> Die Stückzahlen sind überschlägig. Für die Ausführung ist eine planbasierte Materialermittlung unter Berücksichtigung
        von Rand-/Eckbereichen, Fenster-/Türöffnungen und Systemdetails erforderlich.</div></div>
    <div style={{borderTop:`1px solid ${BD}`,padding:"6px 24px",display:"flex",justifyContent:"space-between",fontSize:9,color:GL}}>
      <span>EJOT · ISO-Bar ECO · Materialermittlung</span><span>{d.dokNr}</span></div>
  </div>);
}

// ═══════════════════════════════════════════════════════════
export default function App(){
  const[step,setStep]=useState("upload");
  const[d,setD]=useState({});
  const[pdfN,setPdfN]=useState("");
  const fRef=useRef(null);
  const setter=k=>v=>setD(x=>({...x,[k]:v}));
  const usable=useMemo(()=>FLL_PLANTS.filter(p=>p.lk!==null),[]);
  const mat=useMemo(()=>calcMaterial(d),[d.LH,d.LV,d.fassadenlaenge,d.fassadenhoehe,d.seilfuehrung]);
  const maxNw=Math.max(...[d.nw_zug,d.nw_druck,d.nw_quer,d.nw_kombi].map(v=>pf(v)||0),0);

  const selectPlant=bot=>{const p=FLL_PLANTS.find(x=>x.bot===bot);
    if(p)setD(x=>({...x,pflanze_botanisch:p.bot,pflanze_deutsch:p.de,lastklasse:p.lk?String(p.lk):x.lastklasse,
      psi:p.lk?FLL_LK[p.lk].psi.toFixed(2):x.psi}));else setter("pflanze_botanisch")(bot);};

  const handleFile=useCallback(async e=>{const f=e.target.files?.[0];if(!f)return;
    setPdfN(f.name);setD(parsePdf(await f.text()));setStep("edit");},[]);

  // ─── PDF EXPORT ───────────────────────────────────────
  const previewRef=useRef(null);
  const anlagenRef=useRef(null);
  const materialRef=useRef(null);
  const[exporting,setExporting]=useState(null);
  const[showExportMenu,setShowExportMenu]=useState(false);

  const exportPdf=useCallback(async(sectionId,ref,filename)=>{
    if(!ref.current)return;
    setExporting(sectionId);
    try{
      await new Promise(r=>setTimeout(r,300));
      const el=ref.current;
      const canvas=await html2canvas(el,{
        scale:2,useCORS:true,backgroundColor:"#FFFFFF",logging:false,windowWidth:920,
      });
      const imgW=canvas.width;
      const imgH=canvas.height;
      const pdfW=210;const margin=8;const contentW=pdfW-2*margin;
      const ratio=contentW/imgW;
      const contentH=imgH*ratio;
      const pdfH=297;
      const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
      const pageContentH=pdfH-2*margin;
      const totalPages=Math.ceil(contentH/pageContentH);
      for(let page=0;page<totalPages;page++){
        if(page>0)pdf.addPage();
        const srcY=page*pageContentH/ratio;
        const srcH=Math.min(pageContentH/ratio,imgH-srcY);
        const destH=srcH*ratio;
        const tmpCanvas=document.createElement("canvas");
        tmpCanvas.width=imgW;
        tmpCanvas.height=Math.round(srcH);
        const ctx=tmpCanvas.getContext("2d");
        ctx.drawImage(canvas,0,Math.round(srcY),imgW,Math.round(srcH),0,0,imgW,Math.round(srcH));
        const sliceData=tmpCanvas.toDataURL("image/png");
        pdf.addImage(sliceData,"PNG",margin,margin,contentW,destH);
      }
      pdf.save(filename);
    }catch(err){
      console.error("PDF export error:",err);
      alert("PDF-Export fehlgeschlagen: "+err.message);
    }finally{setExporting(null);}
  },[]);

  const exportAll=useCallback(async()=>{
    setExporting("all");setShowExportMenu(false);
    try{
      const sections=[
        {ref:previewRef,name:"Vorbemessung"},
        {ref:anlagenRef,name:"Anlagen"},
        {ref:materialRef,name:"Material"},
      ];
      for(const sec of sections){
        if(!sec.ref.current)continue;
        await exportPdf(sec.name,sec.ref,`EJOT_IsoBar_${sec.name}_${d.dokNr||"Report"}.pdf`);
        await new Promise(r=>setTimeout(r,500));
      }
    }finally{setExporting(null);}
  },[exportPdf,d.dokNr]);

  const handleExport=(which)=>{
    setShowExportMenu(false);
    const map={
      preview:{ref:previewRef,name:"Vorbemessung"},
      anlagen:{ref:anlagenRef,name:"Anlagen"},
      material:{ref:materialRef,name:"Material"},
    };
    const sec=map[which];
    if(sec)exportPdf(which,sec.ref,`EJOT_IsoBar_${sec.name}_${d.dokNr||"Report"}.pdf`);
  };

  useEffect(()=>{
    if(!showExportMenu)return;
    const handler=()=>setShowExportMenu(false);
    const t=setTimeout(()=>document.addEventListener("click",handler),10);
    return()=>{clearTimeout(t);document.removeEventListener("click",handler);};
  },[showExportMenu]);

  // ─── UPLOAD ─────────────────────────────────────────────
  if(step==="upload")return(
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:BG,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",maxWidth:480,padding:32}}>
        <div style={{marginBottom:16}}><span style={{fontWeight:900,fontSize:30,color:R}}>EJOT</span><sup style={{fontSize:9,color:BK}}>®</sup></div>
        <h1 style={{fontSize:18,fontWeight:700,color:BK,margin:"0 0 4px"}}>Iso-Bar ECO Report Generator</h1>
        <p style={{fontSize:12,color:GY,margin:"0 0 24px"}}>Statik-PDF hochladen → Werte prüfen → Report exportieren</p>
        <div onClick={()=>fRef.current?.click()} style={{border:`2px dashed ${BD}`,borderRadius:8,padding:"36px 20px",cursor:"pointer",background:WH,transition:"all .2s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=R;e.currentTarget.style.background=RL;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=BD;e.currentTarget.style.background=WH;}}>
          <div style={{fontSize:28,marginBottom:6}}>📄</div>
          <div style={{fontSize:12,fontWeight:600,color:BK}}>PDF-Datei auswählen</div>
          <div style={{fontSize:10,color:GL,marginTop:3}}>Vorbemessungs-PDF oder Statik-Ausgabe</div>
          <input ref={fRef} type="file" accept=".pdf,.txt" onChange={handleFile} style={{display:"none"}}/></div>
        <button onClick={()=>{setD(parsePdf(""));setStep("edit");}} style={{marginTop:10,padding:"5px 14px",fontSize:10,color:GY,background:"none",border:`1px solid ${BD}`,borderRadius:4,cursor:"pointer"}}>Ohne Datei starten</button>
      </div></div>);

  const tabs=[{id:"edit",l:"Bearbeiten"},{id:"preview",l:"Vorschau"},{id:"anlagen",l:"Anlagen"},{id:"material",l:"Material"}];

  // ─── MAIN ─────────────────────────────────────────────
  return(
    <div style={{fontFamily:"'Segoe UI',system-ui,sans-serif",background:BG,minHeight:"100vh"}}>
      <div style={{background:WH,borderBottom:`2px solid ${R}`,padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8}}>
          <span style={{fontWeight:900,fontSize:16,color:R}}>EJOT<sup style={{fontSize:6}}>®</sup></span>
          <span style={{fontSize:12,fontWeight:600,color:BK}}>Iso-Bar ECO</span>
          {pdfN&&<span style={{fontSize:9,color:GL}}>← {pdfN}</span>}</div>
        <div style={{display:"flex",gap:4}}>
          <button onClick={()=>setStep("upload")} style={{padding:"4px 10px",fontSize:10,border:`1px solid ${BD}`,borderRadius:4,background:WH,cursor:"pointer",color:DK}}>↩ Neu</button>
          {tabs.map(t=><button key={t.id} onClick={()=>setStep(t.id)} style={{padding:"4px 10px",fontSize:10,borderRadius:4,cursor:"pointer",fontWeight:step===t.id?700:400,
            border:step===t.id?`1px solid ${R}`:`1px solid ${BD}`,background:step===t.id?R:WH,color:step===t.id?WH:DK}}>{t.l}</button>)}
          <div style={{position:"relative",marginLeft:6}}>
            <button onClick={(e)=>{e.stopPropagation();setShowExportMenu(!showExportMenu);}} disabled={!!exporting}
              style={{padding:"4px 12px",fontSize:10,borderRadius:4,cursor:exporting?"wait":"pointer",fontWeight:700,
                border:`1px solid ${R}`,background:exporting?"#EEE":R,color:exporting?GY:WH,display:"flex",alignItems:"center",gap:4}}>
              {exporting?<><span style={{display:"inline-block",width:10,height:10,border:"2px solid #CCC",borderTopColor:R,borderRadius:"50%",animation:"spin 1s linear infinite"}}/>Exportiert...</>:<>⬇ PDF Export</>}
            </button>
            {showExportMenu&&!exporting&&<div style={{position:"absolute",right:0,top:"100%",marginTop:4,background:WH,border:`1px solid ${BD}`,borderRadius:6,
              boxShadow:"0 4px 16px rgba(0,0,0,.12)",zIndex:200,minWidth:220,padding:4,fontSize:11}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"6px 10px",fontWeight:700,fontSize:9.5,color:GL,textTransform:"uppercase",letterSpacing:.5}}>Einzeln exportieren</div>
              {[["preview","Vorbemessung (Seite 1+2)"],["anlagen","Anlagen (FLL, Pflanzen, System)"],["material","Materialbedarfsermittlung"]].map(([id,label])=>
                <button key={id} onClick={()=>handleExport(id)} style={{display:"block",width:"100%",padding:"7px 10px",background:"none",border:"none",
                  textAlign:"left",cursor:"pointer",borderRadius:4,fontSize:11,color:DK}}
                  onMouseEnter={e=>e.currentTarget.style.background=RL}
                  onMouseLeave={e=>e.currentTarget.style.background="none"}>{label}</button>)}
              <div style={{borderTop:`1px solid ${BD}`,margin:"4px 0"}}/>
              <button onClick={exportAll} style={{display:"block",width:"100%",padding:"7px 10px",background:"none",border:"none",
                textAlign:"left",cursor:"pointer",borderRadius:4,fontSize:11,fontWeight:700,color:R}}
                onMouseEnter={e=>e.currentTarget.style.background=RL}
                onMouseLeave={e=>e.currentTarget.style.background="none"}>⬇ Alle 3 PDFs exportieren</button>
            </div>}
          </div>
        </div></div>

      <div style={{maxWidth:920,margin:"0 auto",padding:"14px 10px"}}>

{/* ═══ EDIT ═══ */}
{step==="edit"&&<>
  <Sec title="Dokument"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <Field label="Dokument Nr." value={d.dokNr} onChange={setter("dokNr")}/>
    <Field label="Version" value={d.version} onChange={setter("version")} half/>
    <Field label="Bearbeiter" value={d.bearbeiter} onChange={setter("bearbeiter")}/>
    <Field label="Datum" value={d.datum} onChange={setter("datum")} half/></div></Sec>

  <Sec title="Projekt"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <Field label="Bauvorhaben" value={d.bauvorhaben} onChange={setter("bauvorhaben")}/>
    <Field label="Ort / PLZ" value={d.ort_plz} onChange={setter("ort_plz")}/></div></Sec>

  <Sec title="System"><div>
    <label style={{fontSize:10,color:GY,display:"block",marginBottom:2}}>SET Produkt</label>
    <select value={d.produkt} onChange={e=>{
      const s=SETS.find(x=>x.id===e.target.value);
      setD(x=>({...x,produkt:e.target.value}));
    }} style={{width:"100%",padding:"6px 7px",fontSize:12,fontWeight:600,border:`1px solid ${BD}`,borderRadius:4,background:WH,fontFamily:"inherit",marginBottom:8}}>
      {SETS.map(s=><option key={s.id} value={s.id}>{s.l} ({s.art})</option>)}</select>
    {(()=>{const s=SETS.find(x=>x.id===d.produkt);return s?<div style={{padding:"6px 10px",background:RL,borderRadius:4,border:`1px solid ${RM}`,marginBottom:10,fontSize:11,fontWeight:600,color:R}}>
      → {s.l} ({s.art}) {d.verankerungsgrund&&UNTERGRUENDE.find(u=>u.id===d.verankerungsgrund)?.typ==="beton"?`${s.nutzBeton}mm Nutzlänge`:`${s.nutzMW}mm MW`}
    </div>:null})()}
    <label style={{fontSize:10,color:GY,display:"block",marginBottom:2}}>Verankerungsgrund (gem. Z-21.8-2083)</label>
    <select value={d.verankerungsgrund} onChange={e=>{
      const u=UNTERGRUENDE.find(x=>x.id===e.target.value);
      if(u&&u.typ!=="custom")setD(x=>({...x,verankerungsgrund:e.target.value,druckfestigkeit:u.druckf,rohdichte:u.rohd}));
      else setter("verankerungsgrund")(e.target.value);
    }} style={{width:"100%",padding:"6px 7px",fontSize:12,fontWeight:600,border:`1px solid ${BD}`,borderRadius:4,background:WH,fontFamily:"inherit",marginBottom:8}}>
      {UNTERGRUENDE.map(u=><option key={u.id} value={u.id}>{u.l}</option>)}</select>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <Field label="WDVS-Dicke t_WDVS" value={d.wdvs_dicke} onChange={setter("wdvs_dicke")} unit="mm" half/>
      <Field label="Dicke Klebschicht t_tol" value={d.dicke_klebschicht} onChange={setter("dicke_klebschicht")} unit="mm" half/>
      <Field label="Verankerungstiefe h_ef,min" value={d.verankerungstiefe} onChange={setter("verankerungstiefe")} unit="mm" half/>
      <Field label="Gebäudehöhe h" value={d.gebaeudehoehe} onChange={setter("gebaeudehoehe")} unit="m" half/>
      <Field label="Druckfestigkeit σ" value={d.druckfestigkeit} onChange={setter("druckfestigkeit")} unit="N/mm²" half/>
      <Field label="Rohdichte ρ" value={d.rohdichte} onChange={setter("rohdichte")} unit="kg/dm³" half/>
      <Field label="Geländekategorie" value={d.gelaendekategorie} onChange={setter("gelaendekategorie")} half/>
      <Field label="Windlastzone" value={d.windlastzone} onChange={setter("windlastzone")} half/></div></div></Sec>

  <Sec title="Pflanze (FLL Tab. 15)">
    <div style={{marginBottom:8}}>
      <label style={{fontSize:10,color:GY}}>Pflanzenart auswählen (41 Arten mit Lastklasse)</label>
      <select value={d.pflanze_botanisch} onChange={e=>selectPlant(e.target.value)}
        style={{width:"100%",padding:"6px 7px",fontSize:12,fontWeight:600,border:`1px solid ${BD}`,borderRadius:4,background:WH,fontFamily:"inherit",marginTop:2}}>
        <option value="">– Manuell eingeben –</option>
        {usable.map(p=><option key={p.bot} value={p.bot}>{p.bot} ({p.de}) – LK {p.lk}</option>)}</select></div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <Field label="Pflanze (botanisch)" value={d.pflanze_botanisch} onChange={setter("pflanze_botanisch")}/>
      <Field label="Pflanze (deutsch)" value={d.pflanze_deutsch} onChange={setter("pflanze_deutsch")}/>
      <Field label="Lastklasse" value={d.lastklasse} onChange={setter("lastklasse")} half/>
      <Field label="ψ (Durchströmung)" value={d.psi} onChange={setter("psi")} half/></div></Sec>

  <Sec title="Windlasten & Schnittgrößen"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <Field label="w_s (Windsog)" value={d.ws} onChange={setter("ws")} unit="kN/m²" half/>
    <Field label="N_Ek (Winddruck)" value={d.nek} onChange={setter("nek")} unit="kN/m²" half/>
    <Field label="N_Ed,z (Zug)" value={d.ned_z} onChange={setter("ned_z")} unit="kN" half/>
    <Field label="N_Ed,d (Druck)" value={d.ned_d} onChange={setter("ned_d")} unit="kN" half/>
    <Field label="V_Ed (Querkraft)" value={d.ved} onChange={setter("ved")} unit="kN" half/>
    <Field label="V_Rd (Quertragfähigkeit)" value={d.vrd} onChange={setter("vrd")} unit="kN" half/></div></Sec>

  <Sec title="Kernergebnisse" accent><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <Field label="Max. Abstand LH" value={d.LH} onChange={setter("LH")} unit="m" half/>
    <Field label="Max. Abstand LV" value={d.LV} onChange={setter("LV")} unit="m" half/>
    <Field label="ISO-Bar ECO pro m²" value={d.stk_m2} onChange={setter("stk_m2")} unit="Stk" half/></div></Sec>

  <Sec title="Nachweise (≤ 1,0)" accent>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
      <Field label="N_Ed,z / N_Rd (Zug)" value={d.nw_zug} onChange={setter("nw_zug")} half/>
      <Field label="N_Ed,d / N_Rd,d (Druck)" value={d.nw_druck} onChange={setter("nw_druck")} half/>
      <Field label="V_Ed / V_Rd (Querkraft)" value={d.nw_quer} onChange={setter("nw_quer")} half/>
      <Field label="Kombination (max)" value={d.nw_kombi} onChange={setter("nw_kombi")} half/></div>
    {(pf(d.nw_zug)||pf(d.nw_druck)||pf(d.nw_quer)||pf(d.nw_kombi))>0&&<div style={{border:`1px solid ${BD}`,borderRadius:4,padding:12,background:BG}}>
      <div style={{fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:.5,marginBottom:8,color:BK}}>Ausnutzungsgrad</div>
      <NwBar label="Zug, N_Ed,z / N_Rd" value={d.nw_zug}/>
      <NwBar label="Druck, N_Ed,d / N_Rd,d" value={d.nw_druck}/>
      <NwBar label="Quer, V_Ed / V_Rd" value={d.nw_quer}/>
      <NwBar label="Kombination (max)" value={d.nw_kombi}/>
      {maxNw>0&&<div style={{marginTop:6,fontSize:10,fontWeight:700,color:maxNw<=1?GN:R}}>
        {maxNw<=1?"✓ Alle Nachweise erfüllt":`✗ Überschreitung! max: ${maxNw.toFixed(2)}`}</div>}
    </div>}</Sec>

  <Sec title="Raster & Seilkreuze">
    <label style={{fontSize:10,color:GY,marginBottom:3,display:"block"}}>Seilführung</label>
    <div style={{display:"flex",gap:5,marginBottom:10}}>
      {RASTER.map(r=><button key={r.id} onClick={()=>setter("seilfuehrung")(r.id)}
        style={{padding:"5px 12px",fontSize:10,borderRadius:4,cursor:"pointer",border:d.seilfuehrung===r.id?`2px solid ${R}`:`1px solid ${BD}`,
          background:d.seilfuehrung===r.id?RL:WH,color:d.seilfuehrung===r.id?R:DK,fontWeight:d.seilfuehrung===r.id?700:400}}>{r.l}</button>)}</div>
    <label style={{fontSize:10,color:GY,marginBottom:3,display:"block"}}>Seilkreuztyp</label>
    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:4}}>
      {SEILKREUZE.map(sk=><button key={sk.id} onClick={()=>setter("seilkreuztyp")(sk.id)}
        style={{padding:"5px 12px",fontSize:10,borderRadius:4,cursor:"pointer",border:d.seilkreuztyp===sk.id?`2px solid ${R}`:`1px solid ${BD}`,
          background:d.seilkreuztyp===sk.id?RL:WH,color:d.seilkreuztyp===sk.id?R:DK,fontWeight:d.seilkreuztyp===sk.id?700:400}}>
        {sk.l}{sk.art?<span style={{fontSize:8,color:GL,marginLeft:4}}>({sk.art})</span>:null}</button>)}</div>
    {d.seilkreuztyp&&d.seilkreuztyp!=="ohne"&&<div style={{padding:"5px 10px",background:"#E3F2FD",borderRadius:4,border:"1px solid #90CAF940",marginBottom:10,fontSize:10,color:"#1565C0"}}>
      {(d.seilfuehrung==="gitter"||d.seilfuehrung==="diagonal")?"Seilkreuz in Zellmitte (Kreuzung der Diagonalen)":"Seilkreuz an Gitter-Kreuzungspunkten (innere Knoten)"}</div>}
    <div style={{display:"flex",gap:12,marginBottom:10}}>
      <div style={{flex:1}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
          <Field label="Max. Abstand LH" value={d.LH} onChange={setter("LH")} unit="m" half/>
          <Field label="Max. Abstand LV" value={d.LV} onChange={setter("LV")} unit="m" half/></div>
        <Field label="ISO-Bar ECO pro m²" value={d.stk_m2} onChange={setter("stk_m2")} unit="Stk" half/></div>
      <div style={{flex:1,background:BG,borderRadius:5,padding:10,textAlign:"center"}}>
        <RasterSVG LH={d.LH} LV={d.LV} fW={d.fassadenlaenge} fH={d.fassadenhoehe} rasterType={d.seilfuehrung} seilkreuztyp={d.seilkreuztyp} size={280}/>
        <div style={{fontSize:9,color:GL,marginTop:4}}>Schematisch – {RASTER.find(r=>r.id===d.seilfuehrung)?.d}</div></div></div></Sec>

  <Sec title="Fassadenflächen">
    {(d.fassaden||[]).map((f,i)=><div key={i} style={{marginBottom:10}}>
      <div style={{display:"flex",gap:8,alignItems:"end",marginBottom:4}}>
        <div style={{flex:2,minWidth:140}}>
          <label style={{fontSize:10,color:GY,display:"block",marginBottom:1}}>Name</label>
          <input value={f.name} onChange={e=>{const fa=[...(d.fassaden||[])];fa[i]={...fa[i],name:e.target.value};setD(x=>({...x,fassaden:fa}));}}
            style={{width:"100%",padding:"6px 7px",fontSize:12,fontWeight:600,border:`1px solid ${BD}`,borderRadius:4,background:WH,fontFamily:"inherit"}}/></div>
        <div style={{flex:1}}>
          <label style={{fontSize:10,color:GY,display:"block",marginBottom:1}}>Breite</label>
          <div style={{display:"flex",border:`1px solid ${BD}`,borderRadius:4}}>
            <input value={f.breite} onChange={e=>{const fa=[...(d.fassaden||[])];fa[i]={...fa[i],breite:e.target.value};setD(x=>({...x,fassaden:fa,fassadenlaenge:fa[0]?.breite||x.fassadenlaenge}));}}
              style={{flex:1,border:"none",padding:"6px 7px",fontSize:12,fontWeight:600,background:"transparent",outline:"none",fontFamily:"inherit",minWidth:0}}/>
            <span style={{padding:"0 7px",fontSize:9.5,color:GL,alignSelf:"center"}}>m</span></div></div>
        <div style={{flex:1}}>
          <label style={{fontSize:10,color:GY,display:"block",marginBottom:1}}>Höhe</label>
          <div style={{display:"flex",border:`1px solid ${BD}`,borderRadius:4}}>
            <input value={f.hoehe} onChange={e=>{const fa=[...(d.fassaden||[])];fa[i]={...fa[i],hoehe:e.target.value};setD(x=>({...x,fassaden:fa,fassadenhoehe:fa[0]?.hoehe||x.fassadenhoehe}));}}
              style={{flex:1,border:"none",padding:"6px 7px",fontSize:12,fontWeight:600,background:"transparent",outline:"none",fontFamily:"inherit",minWidth:0}}/>
            <span style={{padding:"0 7px",fontSize:9.5,color:GL,alignSelf:"center"}}>m</span></div></div>
        {(d.fassaden||[]).length>1&&<button onClick={()=>{const fa=[...(d.fassaden||[])];fa.splice(i,1);setD(x=>({...x,fassaden:fa}));}}
          style={{padding:"6px 8px",fontSize:11,border:`1px solid ${BD}`,borderRadius:4,background:WH,cursor:"pointer",color:R,fontWeight:700}}>✕</button>}
      </div>
      {/* Raster preview per facade */}
      <div style={{background:BG,borderRadius:4,padding:10,textAlign:"center",maxWidth:400,margin:"0 auto"}}>
        <RasterSVG LH={d.LH} LV={d.LV} fW={f.breite||"3"} fH={f.hoehe||"3"} rasterType={d.seilfuehrung} seilkreuztyp={d.seilkreuztyp} size={340}/>
        <div style={{fontSize:9.5,color:DK,fontWeight:600,marginTop:2}}>{f.name}: {f.breite||"–"} × {f.hoehe||"–"} m = {((pf(f.breite)||0)*(pf(f.hoehe)||0)).toFixed(1)} m²</div>
      </div>
    </div>)}
    <button onClick={()=>setD(x=>({...x,fassaden:[...(x.fassaden||[]),{name:`Fassade ${(x.fassaden||[]).length+1}`,breite:"10",hoehe:"6"}]}))}
      style={{padding:"5px 14px",fontSize:10,border:`1px dashed ${BD}`,borderRadius:4,background:WH,cursor:"pointer",color:GY,marginTop:4}}>+ Fläche</button></Sec>
</>}

{/* ═══ PREVIEW ═══ */}
{step==="preview"&&<div style={{borderRadius:6,boxShadow:"0 1px 6px rgba(0,0,0,.06)",overflow:"hidden"}}>
  <PreviewSection d={d} maxNw={maxNw} mat={mat}/>
</div>}

{/* ═══ ANLAGEN ═══ */}
{step==="anlagen"&&<div style={{borderRadius:6,boxShadow:"0 1px 6px rgba(0,0,0,.06)",overflow:"hidden"}}>
  <AnlagenSection d={d} usable={usable}/>
</div>}

{/* ═══ MATERIAL ═══ */}
{step==="material"&&<div style={{borderRadius:6,boxShadow:"0 1px 6px rgba(0,0,0,.06)",overflow:"hidden"}}>
  <MaterialSection d={d} mat={mat}/>
</div>}
      </div>

{/* ═══ OFF-SCREEN PDF RENDER CONTAINERS ═══ */}
<div style={{position:"fixed",left:"-9999px",top:0,width:880,zIndex:-1,background:WH,fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
  <div ref={previewRef} style={{background:WH,width:880}}><PreviewSection d={d} maxNw={maxNw} mat={mat}/></div>
  <div ref={anlagenRef} style={{background:WH,width:880}}><AnlagenSection d={d} usable={usable}/></div>
  <div ref={materialRef} style={{background:WH,width:880}}><MaterialSection d={d} mat={mat}/></div>
</div>

</div>);
}
