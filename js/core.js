/* QR Forge core: settings schema, presets, colour maths, project files.
   Pure logic, no DOM. Loaded as a classic script (browser) or require()d (tests). */
(function(){
const QF=globalThis.QF=globalThis.QF||{};

const SCHEMA=1;
const FONTS=['IBM Plex Sans','Chakra Petch','JetBrains Mono','system-ui'];
const FRAMES={
  'none':null,
  'scan-me':'Scan me',
  'scan-here':'Scan here',
  'visit-website':'Visit website',
  'view-portfolio':'View portfolio',
  'custom':null
};
const ENUM={
  iClear:['padded','square'],
  dots:['square','rounded','dots'],
  crn:['square','rounded','dot'],
  eye:['match','square','rounded','dot'],
  gradMode:['none','linear','radial'],
  ec:['L','M','Q','H'],
  lblAl:['left','center','right'],
  lblFont:FONTS,frameFont:FONTS,
  frame:Object.keys(FRAMES)
};
const RANGE={iSz:[10,35],sz:[200,600],pad:[0,60],bRd:[0,80],qZ:[0,8],lblSz:[10,32],gAng:[0,360],frameRad:[0,40],framePad:[8,40]};
const COLOR_KEYS=['fg','bg','lblC','frameC','frameTxtC'];

const DEFAULTS={
  url:'https://accurova.com',
  iSz:22,iClear:'square',iInvert:false,
  dots:'rounded',crn:'rounded',eye:'match',finOut:'',finIn:'',
  gradMode:'none',stops:['#0d0f14','#0a6e8a'],gAng:45,
  fg:'#0d0f14',bg:'#ffffff',transp:false,
  sz:380,pad:20,bRd:0,qZ:0,protect:true,ec:'H',
  lbl:false,lblTxt:'Scan to visit',lblSz:16,lblFont:'IBM Plex Sans',lblAl:'center',lblC:'#0d0f14',
  frame:'none',frameText:'Scan me',frameC:'#0d0f14',frameTxtC:'#ffffff',frameFont:'Chakra Petch',frameRad:16,framePad:16,
  preset:'custom'
};
/* Properties a preset owns. Canvas size, icon, error correction and URL are left alone. */
const APPEARANCE=['dots','crn','eye','finOut','finIn','gradMode','stops','gAng','fg','bg','transp','lbl','lblTxt','lblSz','lblFont','lblAl','lblC','frame','frameText','frameC','frameTxtC','frameFont','frameRad','framePad'];

const PRESETS=[
  {id:'minimal-black',name:'Minimal black',desc:'Conventional black on white.',
   patch:{dots:'square',crn:'square',eye:'square',fg:'#000000',bg:'#ffffff'}},
  {id:'corporate',name:'Corporate',desc:'Navy modules, soft corners.',
   patch:{dots:'square',crn:'rounded',eye:'rounded',fg:'#0b2545',bg:'#ffffff'}},
  {id:'rounded-modern',name:'Rounded modern',desc:'Rounded modules and finder patterns.',
   patch:{dots:'rounded',crn:'rounded',eye:'rounded',fg:'#111827',bg:'#ffffff'}},
  {id:'brand-accent',name:'Brand accent',desc:'Dark modules with turquoise finders.',
   patch:{dots:'rounded',crn:'rounded',eye:'dot',fg:'#0d0f14',bg:'#ffffff',finOut:'#00797a',finIn:'#00797a'}},
  {id:'inverted-dark',name:'Inverted dark',desc:'White modules on near-black. Some scanners cannot read inverted codes.',
   patch:{dots:'rounded',crn:'rounded',eye:'rounded',fg:'#ffffff',bg:'#0b0d12',lblC:'#ffffff'}},
  {id:'photography',name:'Photography portfolio',desc:'Warm paper, fine dots, quiet label.',
   patch:{dots:'dots',crn:'square',eye:'square',fg:'#1c1b1a',bg:'#f4efe6',lbl:true,lblTxt:'View portfolio',lblSz:14,lblFont:'Chakra Petch',lblC:'#1c1b1a'}}
];

/* ---------- Colour maths ---------- */
const HEX=/^#[0-9a-f]{6}$/i;
const isHex=v=>typeof v==='string'&&HEX.test(v);
function lum(hex){
  const v=[1,3,5].map(i=>parseInt(hex.substr(i,2),16)/255).map(c=>c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4));
  return .2126*v[0]+.7152*v[1]+.0722*v[2];
}
function contrast(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function mix(hex,target,t){
  const p=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16));
  const a=p(hex),b=p(target);
  return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*t).toString(16).padStart(2,'0')).join('');
}
/* Move `fg` toward black (light background) or white (dark background) until it reaches `min` contrast. */
function fixColor(fg,bg,min){
  const target=lum(bg)>.4?'#000000':'#ffffff';
  let out=fg;
  for(let t=0;t<=1.0001&&contrast(out,bg)<min;t+=.05)out=mix(fg,target,Math.min(1,t));
  return out;
}
/* Every colour that paints modules or finders, so contrast covers the weakest one. */
function moduleColors(S){
  const base=S.gradMode==='none'?[S.fg]:S.stops;
  return base.concat(S.finOut?[S.finOut]:[],S.finIn?[S.finIn]:[]);
}

/* ---------- Sanitising (never trust stored or imported data) ---------- */
const clamp=(v,[lo,hi],d)=>{v=Number(v);return Number.isFinite(v)?Math.min(hi,Math.max(lo,Math.round(v))):d;};
const cleanText=(v,max,d)=>typeof v==='string'?v.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,max):d;
const ICON_RE=/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
const ICON_MAX=600000;

function sanitize(raw){
  const r=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const o=Object.assign({},DEFAULTS,{stops:DEFAULTS.stops.slice()});
  o.url=cleanText(r.url,2000,DEFAULTS.url);
  for(const k of Object.keys(RANGE))o[k]=clamp(r[k],RANGE[k],DEFAULTS[k]);
  for(const k of Object.keys(ENUM))o[k]=ENUM[k].includes(r[k])?r[k]:DEFAULTS[k];
  for(const k of COLOR_KEYS)o[k]=isHex(r[k])?r[k].toLowerCase():DEFAULTS[k];
  for(const k of ['finOut','finIn'])o[k]=isHex(r[k])?r[k].toLowerCase():'';
  for(const k of ['iInvert','transp','lbl','protect'])o[k]=typeof r[k]==='boolean'?r[k]:DEFAULTS[k];
  o.lblTxt=cleanText(r.lblTxt,80,DEFAULTS.lblTxt);
  o.frameText=cleanText(r.frameText,40,DEFAULTS.frameText);
  if(Array.isArray(r.stops)&&r.stops.length>=2&&r.stops.length<=4&&r.stops.every(isHex))o.stops=r.stops.map(s=>s.toLowerCase());
  /* Designs saved by the first overhaul used grad/fg2. */
  if(r.gradMode===undefined&&r.grad===true&&isHex(r.fg2)){o.gradMode='linear';o.stops=[o.fg,r.fg2.toLowerCase()];}
  o.preset=typeof r.preset==='string'&&(r.preset==='custom'||PRESETS.some(p=>p.id===r.preset))?r.preset:'custom';
  o.iconB64=typeof r.iconB64==='string'&&r.iconB64.length<=ICON_MAX&&ICON_RE.test(r.iconB64)?r.iconB64:null;
  return o;
}

function applyPreset(S,id){
  const p=PRESETS.find(x=>x.id===id);if(!p)return false;
  APPEARANCE.forEach(k=>{S[k]=Array.isArray(DEFAULTS[k])?DEFAULTS[k].slice():DEFAULTS[k];});
  Object.entries(p.patch).forEach(([k,v])=>{S[k]=Array.isArray(v)?v.slice():v;});
  S.preset=id;return true;
}
function resetDesign(S){
  APPEARANCE.concat(['iSz','iClear','iInvert','sz','pad','bRd','qZ','protect','ec']).forEach(k=>{S[k]=Array.isArray(DEFAULTS[k])?DEFAULTS[k].slice():DEFAULTS[k];});
  S.preset='custom';
}
function frameLabel(S){return S.frame==='custom'?S.frameText:FRAMES[S.frame];}

/* ---------- Project files ---------- */
const PROJECT_MAX_BYTES=1500000;
function makeProject(name,S,meta){
  const d=Object.assign({},S);delete d.url;delete d.iconB64;delete d.sid;
  const logo=S.iconB64?{mime:S.iconB64.slice(5,S.iconB64.indexOf(';')),dataUrl:S.iconB64}:null;
  return{
    app:'qr-forge',schema:SCHEMA,
    name:cleanText(name,60,'Untitled'),
    created:(meta&&meta.created)||Date.now(),modified:(meta&&meta.modified)||Date.now(),
    preset:S.preset,
    content:{type:'url',value:S.url},
    design:d,logo
  };
}
/* Returns {ok:true,name,settings} or {ok:false,error}. */
function parseProject(text){
  if(typeof text!=='string'||!text.trim())return{ok:false,error:'The file is empty.'};
  if(text.length>PROJECT_MAX_BYTES)return{ok:false,error:'The file is too large to be a QR Forge project.'};
  let j;try{j=JSON.parse(text);}catch{return{ok:false,error:'The file is not valid JSON.'};}
  if(!j||typeof j!=='object'||Array.isArray(j)||j.app!=='qr-forge')return{ok:false,error:'This is not a QR Forge project file.'};
  if(!Number.isInteger(j.schema)||j.schema<1)return{ok:false,error:'The project has no valid schema version.'};
  if(j.schema>SCHEMA)return{ok:false,error:`This project uses schema ${j.schema}. This version of QR Forge reads schema ${SCHEMA}. Update QR Forge and try again.`};
  const c=j.content;
  if(!c||c.type!=='url'||typeof c.value!=='string'||!c.value.trim())return{ok:false,error:'The project has no destination URL.'};
  let logoDropped=false;
  const raw=Object.assign({},j.design&&typeof j.design==='object'?j.design:{},{url:c.value});
  if(j.logo&&typeof j.logo==='object'){
    raw.iconB64=j.logo.dataUrl;
  }
  const s=sanitize(raw);
  if(j.logo&&!s.iconB64)logoDropped=true;
  return{ok:true,name:cleanText(j.name,60,'Imported QR')||'Imported QR',settings:s,warning:logoDropped?'The logo was missing, too large or in an unsupported format, so it was left out.':''};
}

Object.assign(QF,{SCHEMA,FONTS,FRAMES,ENUM,RANGE,DEFAULTS,APPEARANCE,PRESETS,isHex,lum,contrast,mix,fixColor,moduleColors,sanitize,applyPreset,resetDesign,frameLabel,makeProject,parseProject,ICON_MAX});
})();
