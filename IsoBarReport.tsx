import { useState, useRef, useCallback, useMemo } from "react";

// ─── Colors (kept for SVG/charts where Tailwind can't reach) ─────────
const R="#C8102E",RL="#C8102E10",RM="#C8102E28",BK="#1A1A1A",DK="#333",GY="#666",GL="#999",BG="#F7F6F4",BD="#D8D6D4",WH="#FFF",GN="#2E7D32",GN2="#66BB6A",GN3="#AED581",AM="#E68A00";

// ─── Complete FLL Tabelle 15 (52 plants) ────────────────────────
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

const FORMS: Record<string,string>={"S":"Schlinger","RB":"Blattstielranker","RS":"Sprossranker","K":"Spreizklimmer","WK":"Wurzelkletterer","RH":"Haftscheibenranker"};
const FLL_LK: Record<number,{fl:number;sm:number;li:number;psi:number}>={1:{fl:6,sm:6,li:6,psi:.55},2:{fl:11,sm:14,li:13,psi:.60},3:{fl:15,sm:19,li:18,psi:.60},4:{fl:17,sm:26,li:20,psi:.65},5:{fl:24,sm:42,li:28,psi:.70}};
const RASTER=[{id:"gitter",l:"Gitterförmig",d:"H+V+Diag."},{id:"vertikal",l:"Vertikal",d:"Nur vertikal"},{id:"horizontal",l:"Horizontal",d:"Nur horizontal"},{id:"diagonal",l:"Diagonal",d:"Diagonalnetz"}];

// ─── PDF Parser ─────────────────────────────
function parsePdf(t: string) {
  const d: Record<string,string>={bauvorhaben:"",ort_plz:"",datum:new Date().toLocaleDateString("de-DE"),dokNr:`VB-ISO-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-001`,version:"V1.0",bearbeiter:"",
    produkt:"EJOT Iso-Bar ECO",verankerungsgrund:"",wdvs_dicke:"",gebaeudehoehe:"",gelaendekategorie:"",druckfestigkeit:"",rohdichte:"",verankerungstiefe:"",dicke_klebschicht:"10",
    pflanze_botanisch:"",pflanze_deutsch:"",lastklasse:"3",seilfuehrung:"gitter",psi:"0.60",
    ws:"",nek:"",ned_z:"",ned_d:"",ved:"",vrd:"",LH:"",LV:"",stk_m2:"",
    nw_zug:"",nw_druck:"",nw_quer:"",nw_kombi:"",
    fassadenlaenge:"10",fassadenhoehe:"",windlastzone:"",geometrie_art:""};
  const f=(p: string)=>{const m=t.match(new RegExp(p,"im"));return m?m[1].trim():""};
  d.bauvorhaben=f("Bauvorhaben\\s+(.+?)(?:\\s{2,}|$)");
  d.ort_plz=f("Ort\\s*/\\s*PLZ\\s+(.+?)(?:\\s{2,}|$)");
  d.datum=f("Datum\\s+(\\d+\\.\\d+\\.\\d+)")||d.datum;
  d.verankerungsgrund=f("Verankerungsgrund\\s+(.+?)(?:\\s{2,}|$)");
  d.wdvs_dicke=f("WDVS-?Dicke\\s+([\\d.]+)");
  d.gebaeudehoehe=f("Gebäudehöhe\\s+([\\d.]+)");
  d.produkt=f("Produkt\\s+(.+?)(?:\\s{2,}|$)")||d.produkt;
  d.LH=f("horizontaler?\\s+Abstand\\s*\\(LH\\)\\s+([\\d.]+)");
  d.LV=f("vertikaler?\\s+Abstand\\s*\\(LV\\)\\s+([\\d.]+)");
  d.stk_m2=f("ISO-Bar\\s+ECO\\s+pro\\s+m.\\s+([\\d.]+)");
  d.nw_zug=f("Zug,\\s*N[^\\n]*(\\d+\\.?\\d*)\\s*$");
  d.nw_druck=f("Druck,\\s*N[^\\n]*(\\d+\\.?\\d*)\\s*$");
  d.nw_quer=f("Quer,\\s*V[^\\n]*(\\d+\\.?\\d*)\\s*$");
  d.nw_kombi=f("Kombination[^\\n]*(\\d+\\.?\\d*)\\s*$");
  d.lastklasse=f("Lastklasse\\s+(\\d)")||"3";
  d.psi=f("[ψΨÈ][^\\n]*(\\d+\\.\\d+)")||"0.60";
  d.ws=f("ws\\s*\\(Windsog\\)[^\\n]*(\\d+\\.?\\d*)");
  d.nek=f("Nek\\s*\\(Winddruck\\)[^\\n]*(\\d+\\.?\\d*)");
  d.ned_z=f("Ned,z\\s*\\(Zug\\)[^\\n]*(\\d+\\.?\\d*)");
  d.ned_d=f("Ned,d\\s*\\(Druck\\)[^\\n]*(\\d+\\.?\\d*)");
  d.ved=f("VEd\\s*\\(Quer\\)[^\\n]*(\\d+\\.?\\d*)");
  d.vrd=f("VRd\\s*\\(Quertrag\\.?\\)[^\\n]*(\\d+\\.?\\d*)");
  d.windlastzone=f("Windlastzone\\s+(.+?)\\s*$");
  d.gelaendekategorie=f("Geländekategorie\\s+(.+?)\\s*$");
  d.geometrie_art=f("Geometrie\\s*/\\s*Begrünungsart\\s+(.+?)\\s*$");
  d.fassadenhoehe=d.gebaeudehoehe||"3";
  return d;
}

// ─── Material calculator ─────────────────────────────
function calcMaterial(d: Record<string,string>){
  const lh=pf(d.LH)||.9,lv=pf(d.LV)||.9,fw=pf(d.fassadenlaenge)||10,fh=pf(d.fassadenhoehe)||10;
  const cols=Math.floor(fw/lh),rows=Math.floor(fh/lv);
  const pts=(cols+1)*(rows+1);
  const area=fw*fh;
  const seilV=(cols+1)*fh, seilH=(rows+1)*fw;
  const seilD=d.seilfuehrung==="gitter"||d.seilfuehrung==="diagonal"?cols*rows*Math.sqrt(lh*lh+lv*lv)*2:0;
  const seilGes=((d.seilfuehrung==="vertikal"?seilV:0)+(d.seilfuehrung==="horizontal"?seilH:0)
    +(d.seilfuehrung==="gitter"?seilV+seilH+seilD:0)+(d.seilfuehrung==="diagonal"?seilD:0));
  const kreuze90=d.seilfuehrung==="gitter"?(cols-1)*(rows-1):0;
  const kreuzeVar=d.seilfuehrung==="gitter"||d.seilfuehrung==="diagonal"?cols*rows*2:0;
  return {pts,area,cols:cols+1,rows:rows+1,seilV:seilV.toFixed(1),seilH:seilH.toFixed(1),seilD:seilD.toFixed(1),
    seilGes:seilGes.toFixed(1),kreuze90,kreuzeVar,
    sockel95:Math.round(pts*0.7),sockel150:Math.round(pts*0.3),endkappen:pts*2,
    stkM2:(pts/area).toFixed(2)};
}
function pf(v: string | number | undefined){return parseFloat(String(v).replace(",","."));}

// ─── Sub-components ─────────────────────────────
function Sub({children: s}: {children: React.ReactNode}){
  if(typeof s!=="string")return <>{s}</>;
  const p: React.ReactNode[]=[];let i=0,k=0;
  while(i<s.length){const u=s.indexOf("_",i);if(u===-1){p.push(s.slice(i));break;}
    if(u>i)p.push(s.slice(i,u));let j=u+1,sub="";
    while(j<s.length&&/[A-Za-z0-9,.]/.test(s[j])){sub+=s[j];j++;}
    p.push(<sub key={k++}>{sub}</sub>);i=j;}
  return <>{p}</>;
}

function RasterSVG({LH,LV,fW,fH,rasterType,size=300}: {LH:string;LV:string;fW:string;fH:string;rasterType:string;size?:number}){
  const lh=pf(LH)||.9,lv=pf(LV)||.9,fw=pf(fW)||3,fh=pf(fH)||3;
  const cols=Math.min(Math.max(1,Math.floor(fw/lh)),7),rows=Math.min(Math.max(1,Math.floor(fh/lv)),7);
  const pad=42,inner=size-2*pad,cell=Math.min(inner/cols,inner/rows);
  const gw=cell*cols,gh=cell*rows,ox=pad+(inner-gw)/2,oy=pad+(inner-gh)/2;
  const L: {x1:number;y1:number;x2:number;y2:number;c:string;w:number}[]=[];
  const a=(x1:number,y1:number,x2:number,y2:number,c="#AAA",w=.7)=>L.push({x1,y1,x2,y2,c,w});
  if(rasterType==="gitter"||rasterType==="vertikal")for(let c=0;c<=cols;c++)a(ox+c*cell,oy,ox+c*cell,oy+gh,"#AAA",.8);
  if(rasterType==="gitter"||rasterType==="horizontal")for(let r=0;r<=rows;r++)a(ox,oy+r*cell,ox+gw,oy+r*cell,"#AAA",.8);
  if(rasterType==="gitter"||rasterType==="diagonal")for(let c=0;c<cols;c++)for(let r=0;r<rows;r++){
    a(ox+c*cell,oy+r*cell,ox+(c+1)*cell,oy+(r+1)*cell,"#D5D5D5",.4);
    a(ox+(c+1)*cell,oy+r*cell,ox+c*cell,oy+(r+1)*cell,"#D5D5D5",.4);}
  const pts: {x:number;y:number}[]=[];for(let c=0;c<=cols;c++)for(let r=0;r<=rows;r++)pts.push({x:ox+c*cell,y:oy+r*cell});
  const DH=(x1:number,x2:number,y:number,l:string)=><g key={`h${l}`}><line x1={x1}y1={y}x2={x2}y2={y}stroke={BK}strokeWidth=".5"/><line x1={x1}y1={y-3}x2={x1}y2={y+3}stroke={BK}strokeWidth=".5"/><line x1={x2}y1={y-3}x2={x2}y2={y+3}stroke={BK}strokeWidth=".5"/><text x={(x1+x2)/2}y={y+10}textAnchor="middle"fontSize="8"fill={BK}fontFamily="sans-serif">{l}</text></g>;
  const DV=(x:number,y1:number,y2:number,l:string)=><g key={`v${l}`}><line x1={x}y1={y1}x2={x}y2={y2}stroke={BK}strokeWidth=".5"/><line x1={x-3}y1={y1}x2={x+3}y2={y1}stroke={BK}strokeWidth=".5"/><line x1={x-3}y1={y2}x2={x+3}y2={y2}stroke={BK}strokeWidth=".5"/><text x={x-4}y={(y1+y2)/2}textAnchor="end"fontSize="8"fill={BK}fontFamily="sans-serif"transform={`rotate(-90,${x-4},${(y1+y2)/2})`}>{l}</text></g>;
  return(<svg viewBox={`0 0 ${size} ${size}`}width="100%"style={{maxWidth:size}}>
    {L.map((l,i)=><line key={i}x1={l.x1}y1={l.y1}x2={l.x2}y2={l.y2}stroke={l.c}strokeWidth={l.w}/>)}
    {pts.map((p,i)=><circle key={i}cx={p.x}cy={p.y}r={4.5}fill={R}/>)}
    {DH(ox,ox+cell,oy+gh+12,`LH=${lh.toFixed(1).replace(".",",")} m`)}
    {gw>cell*1.2&&DH(ox,ox+gw,oy+gh+26,`${Math.min(fw,cols*lh).toFixed(1).replace(".",",")} m`)}
    {DV(ox-12,oy,oy+cell,`LV=${lv.toFixed(1).replace(".",",")} m`)}
    {gh>cell*1.2&&DV(ox-26,oy,oy+gh,`${Math.min(fh,rows*lv).toFixed(1).replace(".",",")} m`)}
    <text x={ox+gw/2}y={size-2}textAnchor="middle"fontSize="7.5"fill={GL}fontFamily="sans-serif">Punkte: {cols+1}×{rows+1} = {(cols+1)*(rows+1)} Stk.</text>
  </svg>);
}

function NwBar({label,value}: {label:string;value:string}){
  const v=pf(value)||0;const pct=Math.min(v,1.1)*100;
  const col=v<.5?GN:v<.7?GN2:v<.95?GN3:v<=1?AM:R;
  return(<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
    <div style={{width:140,fontSize:12,color:DK}}><Sub>{label}</Sub></div>
    <div style={{flex:1,height:18,background:"#ECECEC",borderRadius:3,position:"relative",border:`1px solid ${BD}`}}>
      <div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:col,borderRadius:3,transition:"width .3s"}}/>
      <span style={{position:"absolute",right:pct>55?5:"auto",left:pct<=55?`${Math.min(pct,100)}%`:"auto",marginLeft:pct<=55?5:0,top:"50%",transform:"translateY(-50%)",fontSize:11,fontWeight:700,color:pct>55?WH:BK}}>{v?v.toFixed(2):"–"}</span>
    </div>
    <span style={{fontSize:13,fontWeight:700,color:v&&v<=1?GN:v>1?R:GL,width:16}}>{v?(v<=1?"✓":"✗"):"–"}</span>
  </div>);
}

function Field({label,value,onChange,unit,half,ro,sel,opts}: {label:string;value:string;onChange?:(v:string)=>void;unit?:string;half?:boolean;ro?:boolean;sel?:boolean;opts?:{v:string;l:string}[]|string[]}){
  return(<div style={{flex:half?"0 0 48%":"1 1 48%",minWidth:120,marginBottom:7}}>
    <label style={{fontSize:10,color:GY,display:"block",marginBottom:1}}><Sub>{label}</Sub></label>
    <div style={{display:"flex",border:`1px solid ${BD}`,borderRadius:4,background:ro?BG:WH}}>
      {sel?<select value={value}onChange={e=>onChange?.(e.target.value)}style={{flex:1,border:"none",padding:"6px 7px",fontSize:12,fontWeight:600,background:"transparent",outline:"none",fontFamily:"inherit",color:BK}}>
        {(opts||[]).map((o: any)=><option key={o.v??o}value={o.v??o}>{o.l??o}</option>)}</select>
      :<input value={value}onChange={e=>onChange?.(e.target.value)}readOnly={ro}style={{flex:1,border:"none",padding:"6px 7px",fontSize:12,fontWeight:600,background:"transparent",outline:"none",fontFamily:"inherit",color:BK,minWidth:0}}/>}
      {unit&&<span style={{padding:"0 7px",fontSize:9.5,color:GL,whiteSpace:"nowrap",alignSelf:"center"}}>{unit}</span>}
    </div></div>);
}

function Sec({title,children,accent,open:defOpen=true}: {title:string;children:React.ReactNode;accent?:boolean;open?:boolean}){
  const[o,setO]=useState(defOpen);
  return(<div style={{border:`1px solid ${accent?RM:BD}`,borderRadius:5,marginBottom:10,background:WH}}>
    <div onClick={()=>setO(!o)}style={{padding:"7px 12px",borderBottom:o?`1px solid ${accent?RM:BD}`:"none",background:accent?RL:BG,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontWeight:700,fontSize:11,letterSpacing:.5,textTransform:"uppercase",color:accent?R:BK}}>{title}</span>
      <span style={{fontSize:9,color:GL}}>{o?"▼":"▶"}</span></div>
    {o&&<div style={{padding:"10px 12px"}}>{children}</div>}</div>);
}

function KV({l,v,b}: {l:string;v:string;b?:boolean}){return(<div style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:12}}>
  <span style={{color:GY}}><Sub>{l}</Sub></span><span style={{fontWeight:b?700:600,color:BK,textAlign:"right"}}>{v||"–"}</span></div>);}

function PageHead({title,subtitle}: {title:string;subtitle?:string}){
  return(<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
    <span style={{fontWeight:900,fontSize:22,color:R}}>EJOT<sup style={{fontSize:7}}>®</sup></span>
    <div style={{textAlign:"right"}}><div style={{fontSize:16,fontWeight:700,color:BK}}>{title}</div>
      {subtitle&&<div style={{fontSize:10,color:GY}}>{subtitle}</div>}</div></div>);
}


// ═══════════════════════════════════════════════════════
// Main Component — exported as page for the EJOT platform
// ═══════════════════════════════════════════════════════
export function IsoBarReport(){
  const[step,setStep]=useState("upload");
  const[d,setD]=useState<Record<string,string>>({});
  const[pdfN,setPdfN]=useState("");
  const fRef=useRef<HTMLInputElement>(null);
  const s=(k:string)=>(v:string)=>setD(x=>({...x,[k]:v}));
  const usable=useMemo(()=>FLL_PLANTS.filter(p=>p.lk!==null),[]);
  const mat=useMemo(()=>calcMaterial(d),[d.LH,d.LV,d.fassadenlaenge,d.fassadenhoehe,d.seilfuehrung]);
  const maxNw=Math.max(...[d.nw_zug,d.nw_druck,d.nw_quer,d.nw_kombi].map(v=>pf(v)||0),0);

  const selectPlant=(bot:string)=>{const p=FLL_PLANTS.find(x=>x.bot===bot);
    if(p)setD(x=>({...x,pflanze_botanisch:p.bot,pflanze_deutsch:p.de,lastklasse:p.lk?String(p.lk):x.lastklasse,
      psi:p.lk?FLL_LK[p.lk].psi.toFixed(2):x.psi}));else s("pflanze_botanisch")(bot);};

  const handleFile=useCallback(async (e: React.ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(!f)return;
    setPdfN(f.name);setD(parsePdf(await f.text()));setStep("edit");},[]);

  // ─── UPLOAD ─────────────────────────────────────
  if(step==="upload")return(
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Iso-Bar ECO Report</h1>
      </div>
      <div className="flex items-center justify-center" style={{minHeight:"60vh"}}>
        <div style={{textAlign:"center",maxWidth:480,padding:32}}>
          <div style={{marginBottom:16}}><span style={{fontWeight:900,fontSize:30,color:R}}>EJOT</span><sup style={{fontSize:9}}>®</sup></div>
          <h2 style={{fontSize:18,fontWeight:700,margin:"0 0 4px"}}>Iso-Bar ECO Report Generator</h2>
          <p style={{fontSize:12,color:GL,margin:"0 0 24px"}}>Statik-PDF hochladen → Werte prüfen → Report exportieren</p>
          <div onClick={()=>fRef.current?.click()}style={{border:`2px dashed ${BD}`,borderRadius:8,padding:"36px 20px",cursor:"pointer",background:WH,transition:"all .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=R;e.currentTarget.style.background=RL;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=BD;e.currentTarget.style.background=WH;}}>
            <div style={{fontSize:28,marginBottom:6}}>📄</div>
            <div style={{fontSize:12,fontWeight:600,color:BK}}>PDF-Datei auswählen</div>
            <div style={{fontSize:10,color:GL,marginTop:3}}>Vorbemessungs-PDF oder Statik-Ausgabe</div>
            <input ref={fRef}type="file"accept=".pdf,.txt"onChange={handleFile}style={{display:"none"}}/></div>
          <button onClick={()=>{setD(parsePdf(""));setStep("edit");}}style={{marginTop:10,padding:"5px 14px",fontSize:10,color:GY,background:"none",border:`1px solid ${BD}`,borderRadius:4,cursor:"pointer"}}>Ohne Datei starten</button>
        </div>
      </div>
    </div>);

  const tabs=[{id:"edit",l:"Bearbeiten"},{id:"preview",l:"Vorschau"},{id:"anlagen",l:"Anlagen"},{id:"material",l:"Material"}];

  // ─── MAIN ─────────────────────────────────────
  return(
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Iso-Bar ECO Report</h1>
          {pdfN&&<span style={{fontSize:11,color:GL}}>← {pdfN}</span>}
        </div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          <button onClick={()=>setStep("upload")}style={{padding:"4px 10px",fontSize:10,border:`1px solid ${BD}`,borderRadius:4,background:WH,cursor:"pointer",color:DK}}>↩ Neu</button>
          {tabs.map(t=><button key={t.id}onClick={()=>setStep(t.id)}style={{padding:"4px 10px",fontSize:10,borderRadius:4,cursor:"pointer",fontWeight:step===t.id?700:400,
            border:step===t.id?`1px solid ${R}`:`1px solid ${BD}`,background:step===t.id?R:WH,color:step===t.id?WH:DK}}>{t.l}</button>)}
        </div>
      </div>

      <div style={{maxWidth:920,margin:"0 auto"}}>

{/* ═══ EDIT ═══ */}
{step==="edit"&&<>
  <Sec title="Dokument"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <Field label="Dokument Nr."value={d.dokNr}onChange={s("dokNr")}/>
    <Field label="Version"value={d.version}onChange={s("version")}half/>
    <Field label="Bearbeiter"value={d.bearbeiter}onChange={s("bearbeiter")}/>
    <Field label="Datum"value={d.datum}onChange={s("datum")}half/></div></Sec>

  <Sec title="Projekt"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <Field label="Bauvorhaben"value={d.bauvorhaben}onChange={s("bauvorhaben")}/>
    <Field label="Ort / PLZ"value={d.ort_plz}onChange={s("ort_plz")}/></div></Sec>

  <Sec title="System & Untergrund"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <Field label="Produkt"value={d.produkt}onChange={s("produkt")}/>
    <Field label="Verankerungsgrund"value={d.verankerungsgrund}onChange={s("verankerungsgrund")}/>
    <Field label="WDVS-Dicke t_WDVS"value={d.wdvs_dicke}onChange={s("wdvs_dicke")}unit="mm"half/>
    <Field label="Gebäudehöhe h"value={d.gebaeudehoehe}onChange={s("gebaeudehoehe")}unit="m"half/>
    <Field label="Druckfestigkeit σ"value={d.druckfestigkeit}onChange={s("druckfestigkeit")}unit="N/mm²"half/>
    <Field label="Verankerungstiefe h_ef,min"value={d.verankerungstiefe}onChange={s("verankerungstiefe")}unit="mm"half/>
    <Field label="Geländekategorie"value={d.gelaendekategorie}onChange={s("gelaendekategorie")}half/>
    <Field label="Windlastzone"value={d.windlastzone}onChange={s("windlastzone")}half/></div></Sec>

  <Sec title="Pflanze (FLL Tab. 15)">
    <div style={{marginBottom:8}}>
      <label style={{fontSize:10,color:GY}}>Pflanzenart auswählen (41 Arten mit Lastklasse)</label>
      <select value={d.pflanze_botanisch}onChange={e=>selectPlant(e.target.value)}
        style={{width:"100%",padding:"6px 7px",fontSize:12,fontWeight:600,border:`1px solid ${BD}`,borderRadius:4,background:WH,fontFamily:"inherit",marginTop:2}}>
        <option value="">– Manuell eingeben –</option>
        {usable.map(p=><option key={p.bot}value={p.bot}>{p.bot} ({p.de}) – LK {p.lk}</option>)}</select></div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      <Field label="Pflanze (botanisch)"value={d.pflanze_botanisch}onChange={s("pflanze_botanisch")}/>
      <Field label="Pflanze (deutsch)"value={d.pflanze_deutsch}onChange={s("pflanze_deutsch")}/>
      <Field label="Lastklasse"value={d.lastklasse}onChange={s("lastklasse")}half/>
      <Field label="ψ (Durchströmung)"value={d.psi}onChange={s("psi")}half/></div></Sec>

  <Sec title="Windlasten & Schnittgrößen"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <Field label="w_s (Windsog)"value={d.ws}onChange={s("ws")}unit="kN/m²"half/>
    <Field label="N_Ek (Winddruck)"value={d.nek}onChange={s("nek")}unit="kN/m²"half/>
    <Field label="N_Ed,z (Zug)"value={d.ned_z}onChange={s("ned_z")}unit="kN"half/>
    <Field label="N_Ed,d (Druck)"value={d.ned_d}onChange={s("ned_d")}unit="kN"half/>
    <Field label="V_Ed (Querkraft)"value={d.ved}onChange={s("ved")}unit="kN"half/>
    <Field label="V_Rd (Quertragfähigkeit)"value={d.vrd}onChange={s("vrd")}unit="kN"half/></div></Sec>

  <Sec title="Kernergebnisse"accent><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <Field label="Max. Abstand LH"value={d.LH}onChange={s("LH")}unit="m"half/>
    <Field label="Max. Abstand LV"value={d.LV}onChange={s("LV")}unit="m"half/>
    <Field label="ISO-Bar ECO pro m²"value={d.stk_m2}onChange={s("stk_m2")}unit="Stk"half/></div></Sec>

  <Sec title="Nachweise (≤ 1,0)"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
    <Field label="N_Ed,z / N_Rd (Zug)"value={d.nw_zug}onChange={s("nw_zug")}half/>
    <Field label="N_Ed,d / N_Rd,d (Druck)"value={d.nw_druck}onChange={s("nw_druck")}half/>
    <Field label="V_Ed / V_Rd (Querkraft)"value={d.nw_quer}onChange={s("nw_quer")}half/>
    <Field label="Kombination (max)"value={d.nw_kombi}onChange={s("nw_kombi")}half/></div></Sec>

  <Sec title="Fassade & Raster">
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
      <Field label="Fassadenlänge"value={d.fassadenlaenge}onChange={s("fassadenlaenge")}unit="m"half/>
      <Field label="Fassadenhöhe"value={d.fassadenhoehe}onChange={s("fassadenhoehe")}unit="m"half/></div>
    <label style={{fontSize:10,color:GY,marginBottom:3,display:"block"}}>Seilführung</label>
    <div style={{display:"flex",gap:5,marginBottom:10}}>
      {RASTER.map(r=><button key={r.id}onClick={()=>s("seilfuehrung")(r.id)}
        style={{padding:"5px 12px",fontSize:10,borderRadius:4,cursor:"pointer",border:d.seilfuehrung===r.id?`2px solid ${R}`:`1px solid ${BD}`,
          background:d.seilfuehrung===r.id?RL:WH,color:d.seilfuehrung===r.id?R:DK,fontWeight:d.seilfuehrung===r.id?700:400}}>{r.l}</button>)}</div>
    <div style={{background:BG,borderRadius:5,padding:10,textAlign:"center"}}>
      <RasterSVG LH={d.LH}LV={d.LV}fW={d.fassadenlaenge}fH={d.fassadenhoehe}rasterType={d.seilfuehrung}size={300}/>
      <div style={{fontSize:9,color:GL,marginTop:4}}>Schematisch – {RASTER.find(r=>r.id===d.seilfuehrung)?.d}</div></div></Sec>
</>}

{/* ═══ PREVIEW ═══ */}
{step==="preview"&&<div style={{background:WH,borderRadius:6,boxShadow:"0 1px 6px rgba(0,0,0,.06)",overflow:"hidden"}}>
  {/* Page 1 */}
  <div style={{borderTop:`3px solid ${R}`,padding:"16px 24px"}}>
    <PageHead title="Vorbemessung Fassadenbegrünung"subtitle="ISO-Bar ECO, Vorab-Auslegung (ohne Ausführungsplanung)"/>
    <div style={{borderTop:`1px solid ${R}`,paddingTop:3,fontSize:9.5,color:GY,marginBottom:14}}>
      Dokument: {d.dokNr||"–"} · Version: {d.version||"–"} · Datum: {d.datum}</div>
    <div style={{display:"flex",gap:12,marginBottom:14}}>
      <div style={{flex:1,border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:6,color:BK}}>Projekt</div>
        <KV l="Bauvorhaben"v={d.bauvorhaben}b/><KV l="Ort / PLZ"v={d.ort_plz}b/><KV l="Datum"v={d.datum}b/>
        <div style={{fontSize:8.5,color:GL,marginTop:5}}>Dok-Nr.: {d.dokNr} · Bearbeiter: {d.bearbeiter||"–"}</div></div>
      <div style={{flex:1,border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:6,color:BK}}>System</div>
        <KV l="Produkt"v={d.produkt}b/><KV l="Verankerungsgrund"v={d.verankerungsgrund}b/>
        <KV l="WDVS-Dicke"v={d.wdvs_dicke?`${d.wdvs_dicke} mm`:""}b/>
        <KV l="Gebäudehöhe"v={d.gebaeudehoehe?`${d.gebaeudehoehe} m`:""}b/></div></div>
    <div style={{border:`1px solid ${RM}`,borderRadius:4,padding:12,marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:8,color:R}}>Kernergebnisse</div>
      {[["Max. horizontaler Abstand (LH)",d.LH?`${d.LH} m`:"–"],["Max. vertikaler Abstand (LV)",d.LV?`${d.LV} m`:"–"],
        ["Erforderliche ISO-Bar ECO pro m²",d.stk_m2||"–"]].map(([k,v])=>
        <div key={k}style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:13}}>
          <span style={{color:DK}}>{k}</span><span style={{fontWeight:700,fontSize:14,color:BK}}>{v}</span></div>)}</div>
    <div style={{fontSize:9,color:GL,lineHeight:1.5,borderTop:`1px solid ${BD}`,paddingTop:6}}>
      Hinweis: Diese Vorbemessung dient als Orientierung und ersetzt keinen objektspezifischen statischen Nachweis.</div></div>

  {/* Page 2 */}
  <div style={{borderTop:`6px solid ${BG}`,padding:"16px 24px"}}>
    <PageHead title="Technische Übersicht"subtitle="Nachweise, Hinweise, schematische Darstellung"/>
    <div style={{display:"flex",gap:12,marginBottom:14}}>
      <div style={{flex:1,border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:3,color:BK}}>Nachweise (Ausnutzung)</div>
        {maxNw>.85&&<div style={{display:"inline-block",padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:700,
          background:maxNw>1?"#FFEBEE":"#FFF3E0",color:maxNw>1?R:AM,marginBottom:6,border:`1px solid ${maxNw>1?R:AM}40`}}>
          {maxNw>1?"ÜBERSCHREITUNG":"GRENZBEREICH"} max: {maxNw.toFixed(2)}</div>}
        <NwBar label="Zug, N_Ed,z / N_Rd"value={d.nw_zug}/><NwBar label="Druck, N_Ed,d / N_Rd,d"value={d.nw_druck}/>
        <NwBar label="Quer, V_Ed / V_Rd"value={d.nw_quer}/><NwBar label="Kombination (max)"value={d.nw_kombi}/>
        <div style={{fontSize:8.5,color:GL,marginTop:8}}>Zulassungsbezug: Z-21.8-2083</div></div>
      <div style={{flex:1.4,border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:6,color:BK}}>Raster ({RASTER.find(r=>r.id===d.seilfuehrung)?.l})</div>
        <RasterSVG LH={d.LH}LV={d.LV}fW={d.fassadenlaenge||"3"}fH={d.fassadenhoehe||"3"}rasterType={d.seilfuehrung}size={400}/>
        <div style={{fontSize:8.5,color:GL,marginTop:4}}>Schematisch – ersetzt keine Ausführungsplanung.</div></div></div>
    <div style={{border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
      <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:6,color:BK}}>Lasten & Widerstände</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 16px"}}>
        {[["Lastklasse",d.lastklasse],["ψ (Durchströmung)",d.psi],["w_s (Windsog) [kN/m²]",d.ws],["N_Ek (Winddruck) [kN/m²]",d.nek],
          ["N_Ed,z (Zug) [kN]",d.ned_z],["N_Ed,d (Druck) [kN]",d.ned_d],["V_Ed (Quer) [kN]",d.ved],["V_Rd (Quertrag.) [kN]",d.vrd]].map(([k,v])=>
          <div key={k}style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:`1px solid ${BG}`,fontSize:11.5}}>
            <span style={{color:GY}}><Sub>{k}</Sub></span><span style={{fontWeight:700,color:BK}}>{v||"–"}</span></div>)}</div></div></div>
  <div style={{borderTop:`1px solid ${BD}`,padding:"6px 24px",display:"flex",justifyContent:"space-between",fontSize:9,color:GL}}>
    <span>EJOT · ISO-Bar ECO · Vorbemessung</span><span>{d.dokNr}</span></div>
</div>}

{/* ═══ ANLAGEN ═══ */}
{step==="anlagen"&&<div style={{background:WH,borderRadius:6,boxShadow:"0 1px 6px rgba(0,0,0,.06)",overflow:"hidden"}}>
  {/* A: FLL Tabelle */}
  <div style={{borderTop:`3px solid ${R}`,padding:"16px 24px"}}>
    <PageHead title="Anlage A – FLL Tabelle 15"subtitle="Lastklassen & Gewichtsabschätzung (Auszug)"/>
    <div style={{borderTop:`1px solid ${R}`,marginBottom:12}}/>
    <div style={{overflowX:"auto"}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
      <thead><tr>{["LK","Flächig ≤2m","Schmal ≤1m","Linear ≤0,7m","ψ"].map(h=>
        <th key={h}style={{background:R,color:WH,fontWeight:700,padding:"5px 6px",fontSize:9.5,textAlign:"center"}}>{h}</th>)}</tr></thead>
      <tbody>{([1,2,3,4,5] as const).map(k=>{const a=String(k)===String(d.lastklasse);return(
        <tr key={k}style={{background:a?RL:"transparent"}}>
          <td style={{padding:"4px 6px",textAlign:"center",fontWeight:700,color:a?R:BK,borderBottom:`1px solid ${BD}`}}>LK {k}</td>
          <td style={{padding:"4px 6px",textAlign:"center",borderBottom:`1px solid ${BD}`}}>{FLL_LK[k].fl} kg/m²</td>
          <td style={{padding:"4px 6px",textAlign:"center",borderBottom:`1px solid ${BD}`}}>{FLL_LK[k].sm} kg/m²</td>
          <td style={{padding:"4px 6px",textAlign:"center",borderBottom:`1px solid ${BD}`}}>{FLL_LK[k].li} kg/m²</td>
          <td style={{padding:"4px 6px",textAlign:"center",borderBottom:`1px solid ${BD}`}}>{FLL_LK[k].psi.toFixed(2).replace(".",",")}</td></tr>);})}</tbody></table></div>
    <div style={{fontSize:8.5,color:GL,marginTop:6}}>Quelle: FLL-Richtlinie Fassadenbegrünung (2018), Tab. 15. LK {d.lastklasse} hervorgehoben.</div></div>

  {/* B: Pflanzenliste */}
  <div style={{borderTop:`6px solid ${BG}`,padding:"16px 24px"}}>
    <PageHead title="Anlage B – Pflanzenübersicht"subtitle={`FLL Tab. 15 – ${usable.length} Arten mit Lastklasse für Kletterhilfen`}/>
    <div style={{borderTop:`1px solid ${R}`,marginBottom:12}}/>
    <div style={{overflowX:"auto"}}>
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>
      <thead><tr>{["Botanische Bezeichnung","Form","Deutsch","h_max [m]","Trieb-Ø [cm]","Ges. [kg/Pfl]","fl [kg/m²]","sm [kg/m²]","li [kg/m]","LK"].map(h=>
        <th key={h}style={{background:DK,color:WH,fontWeight:700,padding:"4px 5px",fontSize:8.5,textAlign:"left",whiteSpace:"nowrap"}}><Sub>{h}</Sub></th>)}</tr></thead>
      <tbody>{usable.map(p=>{const a=p.bot===d.pflanze_botanisch;return(
        <tr key={p.bot}style={{background:a?RL:"transparent"}}>
          <td style={{padding:"3px 5px",fontStyle:"italic",borderBottom:`1px solid ${BD}`,fontWeight:a?700:400}}>{p.bot}</td>
          <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`}}>{FORMS[p.form]||p.form}</td>
          <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`}}>{p.de}</td>
          <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center"}}>{p.hMax}</td>
          <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center"}}>{p.trieb}</td>
          <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center"}}>{p.gesamt}</td>
          <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center"}}>{p.fl}</td>
          <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center"}}>{p.sm}</td>
          <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center"}}>{p.li}</td>
          <td style={{padding:"3px 5px",borderBottom:`1px solid ${BD}`,textAlign:"center",fontWeight:700,color:a?R:BK}}>{p.lk}</td></tr>);})}</tbody></table></div>
    {d.pflanze_botanisch&&(()=>{const p=FLL_PLANTS.find(x=>x.bot===d.pflanze_botanisch);if(!p)return null;return(
      <div style={{border:`1px solid ${RM}`,borderRadius:4,padding:12,marginTop:12,background:RL}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",color:R,marginBottom:6}}>Ausgewählte Pflanze</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"3px 14px"}}>
          <KV l="Botanisch"v={p.bot}b/><KV l="Deutsch"v={p.de}b/><KV l="LK"v={String(p.lk)}b/>
          <KV l="Form"v={FORMS[p.form]}b/><KV l="h_max"v={`${p.hMax} m`}b/><KV l="Gesamtgew."v={`${p.gesamt} kg/Pfl`}b/>
          <KV l="Flächig"v={p.fl?`${p.fl} kg/m²`:"–"}b/><KV l="Schmal"v={p.sm?`${p.sm} kg/m²`:"–"}b/><KV l="Linear"v={p.li?`${p.li} kg/m`:"–"}b/></div></div>);})()}
    <div style={{margin:"12px 0",padding:10,background:"#FFF8E1",borderRadius:4,border:`1px solid ${AM}40`}}>
      <div style={{fontSize:9.5,fontWeight:700,color:AM}}>⚠ Nicht geeignet an WDVS:</div>
      <div style={{fontSize:9,color:DK,marginTop:2}}>Selbstklimmer (WK/RH): {FLL_PLANTS.filter(p=>p.lk===null).map(p=>p.bot).join(", ")}</div></div></div>

  {/* C: Iso-Bar Systemschnitt */}
  <div style={{borderTop:`6px solid ${BG}`,padding:"16px 24px"}}>
    <PageHead title="Anlage C – Systemdetail"subtitle="ISO-Bar ECO, Schnittdarstellung"/>
    <div style={{borderTop:`1px solid ${R}`,marginBottom:12}}/>
    <div style={{border:`1px solid ${BD}`,borderRadius:4,padding:16}}>
      <svg viewBox="0 0 500 170"width="100%"style={{maxWidth:520}}>
        <defs><pattern id="ct"width="8"height="8"patternUnits="userSpaceOnUse"><path d="M0,4l2,-2M3,8l5,-5M7,8l1,-1"stroke="#999"strokeWidth=".5"fill="none"/></pattern>
          <pattern id="ins"width="5"height="5"patternUnits="userSpaceOnUse"><circle cx="2.5"cy="2.5"r=".8"fill="#DDD"/></pattern></defs>
        <rect x="10"y="15"width="130"height="140"fill="url(#ct)"stroke="#888"strokeWidth=".8"/>
        <text x="60"y="164"textAnchor="middle"fontSize="7"fill={GY}>Verankerungs-</text><text x="60"y="172"textAnchor="middle"fontSize="7"fill={GY}>grund</text>
        <rect x="148"y="15"width="120"height="140"fill="url(#ins)"stroke="#AAA"strokeWidth=".8"/>
        <rect x="80"y="82"width="220"height="6"fill="#999"stroke="#666"strokeWidth=".5"rx="1"/>
        {[...Array(12)].map((_,i)=><line key={i}x1={85+i*8}y1={81}x2={89+i*8}y2={89}stroke="#777"strokeWidth=".6"/>)}
        <rect x="268"y="15"width="8"height="140"fill="#E8E4E0"stroke="#BBB"strokeWidth=".5"/>
        <rect x="276"y="78"width="14"height="14"fill="#888"stroke="#666"strokeWidth=".5"rx="1"/>
        <rect x="290"y="80"width="16"height="10"fill="#777"stroke="#555"strokeWidth=".5"rx="2"/>
        <circle cx="320"cy="85"r="9"fill="none"stroke="#555"strokeWidth="1.5"/><line x1="306"y1="85"x2="311"y2="85"stroke="#555"strokeWidth="1.5"/>
        <text x="338"y="88"fontSize="7"fill={GY}><tspan>T</tspan><tspan dy="2"fontSize="5">inst</tspan></text>
        <line x1="80"y1="10"x2="140"y2="10"stroke={BK}strokeWidth=".5"/><text x="110"y="8"textAnchor="middle"fontSize="7"fill={BK}>h<tspan dy="2"fontSize="5">ef</tspan></text>
        <line x1="150"y1="6"x2="268"y2="6"stroke={BK}strokeWidth=".5"/><text x="209"y="4"textAnchor="middle"fontSize="7"fill={BK}>t<tspan dy="2"fontSize="5">WDVS</tspan></text>
        <line x1="148"y1="2"x2="276"y2="2"stroke={R}strokeWidth=".6"/><text x="212"y="0"textAnchor="middle"fontSize="7"fill={R}fontWeight="bold">e</text>
        <line x1="276"y1="10"x2="306"y2="10"stroke={BK}strokeWidth=".5"/><text x="291"y="8"textAnchor="middle"fontSize="7"fill={BK}>a</text>
        <text x="148"y="168"textAnchor="middle"fontSize="6"fill={GL}>US</text><text x="295"y="168"textAnchor="middle"fontSize="6"fill={GL}>AS</text>
      </svg>
      <div style={{fontSize:8.5,color:GL,marginTop:8}}>Maßgebend: Zulassung Z-21.8-2083, Montageanleitung, projektspezifische Planung.</div>
      {d.wdvs_dicke&&<div style={{display:"flex",gap:14,marginTop:8,flexWrap:"wrap"}}>
        {[["t_WDVS",`${d.wdvs_dicke} mm`],["t_tol",`${d.dicke_klebschicht||10} mm`],["h_ef,min",d.verankerungstiefe?`${d.verankerungstiefe} mm`:"–"],
          ["e",`${pf(d.wdvs_dicke)+(pf(d.dicke_klebschicht)||10)} mm`]].map(([k,v])=>
          <div key={k}style={{fontSize:10.5}}><span style={{color:GY}}><Sub>{k}</Sub>: </span><span style={{fontWeight:700}}>{v}</span></div>)}</div>}
    </div></div>
  <div style={{borderTop:`1px solid ${BD}`,padding:"6px 24px",display:"flex",justifyContent:"space-between",fontSize:9,color:GL}}>
    <span>EJOT · ISO-Bar ECO · Anlagen</span><span>{d.dokNr}</span></div>
</div>}

{/* ═══ MATERIAL ═══ */}
{step==="material"&&<div style={{background:WH,borderRadius:6,boxShadow:"0 1px 6px rgba(0,0,0,.06)",overflow:"hidden"}}>
  <div style={{borderTop:`3px solid ${R}`,padding:"16px 24px"}}>
    <PageHead title="Materialbedarfsermittlung"subtitle="Überschlägige Mengenermittlung auf Basis der Vorbemessung"/>
    <div style={{borderTop:`1px solid ${R}`,marginBottom:12}}/>
    <div style={{display:"flex",gap:12,marginBottom:14}}>
      <div style={{flex:1,border:`1px solid ${BD}`,borderRadius:4,padding:12}}>
        <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:8,color:BK}}>Eingangswerte</div>
        <KV l="Fassadenfläche"v={`${(pf(d.fassadenlaenge)*pf(d.fassadenhoehe)).toFixed(1)} m²`}b/>
        <KV l="Fassade (L × H)"v={`${d.fassadenlaenge||"–"} × ${d.fassadenhoehe||"–"} m`}/>
        <KV l="LH / LV"v={`${d.LH||"–"} / ${d.LV||"–"} m`}/>
        <KV l="Raster"v={`${mat.cols} × ${mat.rows} Punkte`}/>
        <KV l="Seilführung"v={RASTER.find(r=>r.id===d.seilfuehrung)?.l || ""}/></div>
      <div style={{flex:1.5}}>
        <RasterSVG LH={d.LH}LV={d.LV}fW={d.fassadenlaenge}fH={d.fassadenhoehe}rasterType={d.seilfuehrung}size={420}/></div></div>
    <div style={{border:`1px solid ${RM}`,borderRadius:4,padding:12,marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:10.5,textTransform:"uppercase",letterSpacing:.5,marginBottom:8,color:R}}>Stückliste (überschlägig)</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11.5}}>
        <thead><tr>{["Pos.","Bezeichnung","Menge","Einheit","Hinweis"].map(h=>
          <th key={h}style={{background:BG,fontWeight:700,padding:"5px 8px",textAlign:"left",borderBottom:`1px solid ${BD}`,fontSize:10.5}}>{h}</th>)}</tr></thead>
        <tbody>
          {[
            ["1","EJOT Iso-Bar ECO (Ankerpunkt)",String(mat.pts),"Stk",`${d.produkt}`],
            ["2",`Seil Edelstahl V4A ø4mm – vertikal`,mat.seilV,"m",`${mat.cols} Stränge × ${d.fassadenhoehe||"–"} m`],
            ["3",`Seil Edelstahl V4A ø4mm – horizontal`,mat.seilH,"m",`${mat.rows} Stränge × ${d.fassadenlaenge||"–"} m`],
            ...(d.seilfuehrung==="gitter"||d.seilfuehrung==="diagonal"?[["4","Seil Edelstahl V4A ø4mm – diagonal",mat.seilD,"m","2× pro Feld"]]:[] ),
            ["5","Seil gesamt (alle Richtungen)",mat.seilGes,"m","inkl. Verschnitt ca. +10%"],
            ["6","Seilkreuz 90° (Kreuzungspunkte)",String(mat.kreuze90),"Stk","nur bei Gitter"],
            ["7","Abstandssockel 95mm",String(mat.sockel95),"Stk","ca. 70% der Punkte"],
            ["8","Abstandssockel 150mm",String(mat.sockel150),"Stk","ca. 30% der Punkte"],
            ["9","Endkappen / Seilhülsen",String(mat.endkappen),"Stk","2 pro Ankerpunkt"],
          ].map(([p,b,m,e,h])=><tr key={p}>
            <td style={{padding:"4px 8px",borderBottom:`1px solid ${BD}`,fontWeight:700,color:R,width:30}}>{p}</td>
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
</div>}
      </div>
    </div>);
}
