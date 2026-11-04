/* QR Forge validation: design heuristics (pure) and decoding of the final rendered image (browser). */
(function(){
const QF=globalThis.QF=globalThis.QF||{};
const REC={L:.07,M:.15,Q:.25,H:.30};
const EC_ORDER=['L','M','Q','H'];

/* ---- design checks. Each: {id, level:'ok'|'warn'|'fail'|'info', text, fix?:'contrast'|'ec'|'icon'|'quiet'} ---- */
function designChecks(S,scene){
  const out=[],m=scene.meta;
  const cols=QF.moduleColors(S);
  if(!m.bgPainted){
    out.push({id:'contrast',level:'warn',text:'Transparent background: contrast depends on the surface you place the code on. Use a light surface for dark modules.'});
  }else{
    const worst=Math.min(...cols.map(c=>QF.contrast(c,S.bg)));
    const txt='Contrast '+worst.toFixed(1)+':1'+(cols.length>1?' (weakest colour)':'');
    if(worst<3)out.push({id:'contrast',level:'fail',text:txt+'. Too low to scan reliably.',fix:'contrast'});
    else if(worst<4.5)out.push({id:'contrast',level:'warn',text:txt+'. Readable, but 4.5:1 or more scans faster in poor light.',fix:'contrast'});
    else out.push({id:'contrast',level:'ok',text:txt+'.'});
    if(cols.some(c=>QF.lum(c)>QF.lum(S.bg)))out.push({id:'invert',level:'warn',text:'Light modules on a dark background. Some scanners cannot read inverted codes.'});
  }
  if(m.framed){
    const c=QF.contrast(S.frameTxtC,S.frameC);
    if(c<4.5)out.push({id:'frame',level:'warn',text:'Frame text contrast is '+c.toFixed(1)+':1. Use a lighter or darker text colour.'});
  }else if(S.lbl&&S.lblTxt&&m.bgPainted){
    const c=QF.contrast(S.lblC,S.bg);
    if(c<4.5)out.push({id:'label',level:'warn',text:'Label contrast is '+c.toFixed(1)+':1. The label is decorative, but hard to read.'});
  }
  if(m.hasLogo){
    const rec=REC[S.ec],f=m.coverage;
    const pct=Math.round(f*100)+'% of the code is covered; error correction '+S.ec+' recovers up to '+Math.round(rec*100)+'%.';
    if(f>rec)out.push({id:'icon',level:'fail',text:pct+' Reduce the icon or raise error correction.',fix:'icon'});
    else if(f>rec*.6)out.push({id:'icon',level:'warn',text:pct+' This is close to the limit.',fix:'icon'});
    else out.push({id:'icon',level:'ok',text:'Icon covers '+Math.round(f*100)+'% of the code, within '+S.ec+' recovery.'});
    if(f>.2&&S.ec!=='H'&&S.ec!=='Q')out.push({id:'ec',level:'warn',text:'A centre icon works best with error correction Q or H.',fix:'ec'});
    if(m.iconClamped)out.push({id:'clamp',level:'info',text:'Icon reduced to '+m.iconPct+'% to keep it clear of the finder patterns. Turn off structure protection to override.'});
    if(m.touchFinder)out.push({id:'finder',level:'fail',text:'The icon overlaps a finder pattern. Scanners need those three corners intact.',fix:'icon'});
    if(m.touchTiming)out.push({id:'timing',level:'warn',text:'The icon covers part of a timing pattern. Reduce the icon size.',fix:'icon'});
    if(m.touchAlign)out.push({id:'align',level:'info',text:'The icon covers an alignment pattern. That is usually fine with Q or H error correction.'});
  }
  const q=m.cs?(S.pad/m.cs+S.qZ):0;
  const qt='Quiet zone '+q.toFixed(1)+' modules.';
  if(q<.5)out.push({id:'quiet',level:'fail',text:qt+' Too little empty space around the code. Add padding or quiet zone; the standard asks for 4.',fix:'quiet'});
  else if(q<1)out.push({id:'quiet',level:'warn',text:qt+' Below 1, some scanners miss the code. The standard asks for 4.',fix:'quiet'});
  else out.push({id:'quiet',level:'ok',text:qt+(q<4?' Phones read this, but the standard asks for 4 for print.':'')});
  if(m.cs<4)out.push({id:'size',level:'warn',text:'Modules are '+m.cs.toFixed(1)+' px. Increase the QR size or shorten the URL.'});
  return out;
}

/* ---- one-click fixes: return a settings patch ---- */
function fixPatch(S,scene,id){
  const m=scene.meta;
  if(id==='contrast'){
    const p={};
    const min=4.5;
    if(!S.transp||m.framed){
      if(S.gradMode==='none')p.fg=QF.fixColor(S.fg,S.bg,min);
      else p.stops=S.stops.map(c=>QF.fixColor(c,S.bg,min));
      if(S.finOut)p.finOut=QF.fixColor(S.finOut,S.bg,min);
      if(S.finIn)p.finIn=QF.fixColor(S.finIn,S.bg,min);
    }
    return p;
  }
  if(id==='ec'){const i=EC_ORDER.indexOf(S.ec);return{ec:EC_ORDER[Math.min(3,Math.max(i+1,2))]};}
  if(id==='icon'){
    /* shrink until coverage sits at or under 40% of what the error correction can recover */
    const bp=S.iClear==='padded'?1.26:1;
    const side=Math.sqrt(REC[S.ec]*.4)/bp;   // icon side as a fraction of the code
    return{iSz:Math.max(10,Math.min(S.iSz,Math.floor(side*100)-3))};
  }
  if(id==='quiet'){return{qZ:Math.min(8,Math.max(0,Math.ceil(4-S.pad/m.cs)))};}
  return{};
}

/* ---- decoding the rendered image (independent decoders) ---- */
let jsqrPromise=null;
function loadJsQR(){
  if(globalThis.jsQR)return Promise.resolve(globalThis.jsQR);
  if(jsqrPromise)return jsqrPromise;
  jsqrPromise=new Promise(res=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload=()=>res(globalThis.jsQR||null);s.onerror=()=>{jsqrPromise=null;res(null);};
    document.head.appendChild(s);
  });
  return jsqrPromise;
}
/* Render scale that gives roughly 5 px per module. jsQR's binariser works on small blocks and
   misreads very large modules, much as a camera image would be a modest number of pixels across. */
const decodeScale=scene=>Math.min(4,Math.max(.25,5/scene.meta.cs));
/* Composite onto an opaque white sheet, as a printed or on-screen code would sit. */
function flatten(cv,bg){
  const t=document.createElement('canvas');t.width=cv.width;t.height=cv.height;
  const x=t.getContext('2d');x.fillStyle=bg||'#ffffff';x.fillRect(0,0,t.width,t.height);x.drawImage(cv,0,0);
  return t;
}
/* Returns [{name, status:'ok'|'mismatch'|'none'|'unavailable', value}] */
async function decode(cv,expected){
  const flat=flatten(cv);
  const res=[];
  const jq=await loadJsQR();
  if(jq){
    const d=flat.getContext('2d').getImageData(0,0,flat.width,flat.height);
    const r=jq(d.data,d.width,d.height,{inversionAttempts:'attemptBoth'});
    res.push({name:'jsQR',value:r?r.data:null,status:!r?'none':r.data===expected?'ok':'mismatch'});
  }else res.push({name:'jsQR',status:'unavailable',value:null});
  if('BarcodeDetector' in globalThis){
    try{
      const det=new BarcodeDetector({formats:['qr_code']});
      const r=await det.detect(flat);
      const v=r[0]?r[0].rawValue:null;
      res.push({name:'BarcodeDetector',value:v,status:v===null?'none':v===expected?'ok':'mismatch'});
    }catch{res.push({name:'BarcodeDetector',status:'unavailable',value:null});}
  }
  return res;
}
/* Combine into the three statuses the brief asks for. */
function overall(checks,decoders){
  const ran=decoders.filter(d=>d.status!=='unavailable');
  const hit=ran.some(d=>d.status==='ok');
  const bad=ran.length>0&&!hit;
  const warn=checks.some(c=>c.level==='warn'||c.level==='fail');
  if(bad)return{level:'failed',label:'Failed',text:'Could not decode the rendered code'+(ran.some(d=>d.status==='mismatch')?' (wrong content)':'')+'.'};
  if(!ran.length)return{level:'warning',label:'Not tested',text:'No decoder available. Test with a phone before printing.'};
  if(warn)return{level:'warning',label:'Warning',text:'Decoded, but some design choices may reduce reliability.'};
  return{level:'valid',label:'Valid',text:'Decoded and matches the destination.'};
}

Object.assign(QF,{decodeScale,designChecks,fixPatch,decodeRendered:decode,overallStatus:overall,loadJsQR});
})();
