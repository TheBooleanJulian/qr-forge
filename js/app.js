/* QR Forge UI wiring. Logic lives in the other modules; this file connects them to the page. */
(function(){
const QF=globalThis.QF;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={
  get(k){try{return localStorage.getItem(k);}catch{return null;}},
  set(k,v){try{localStorage.setItem(k,v);}catch{}}
};
const fontLabel=f=>f==='system-ui'?'System':f;

/* ---------- state ---------- */
const S=Object.assign(QF.sanitize({}),{sid:null});
let logo=null,logoKey='',lastScene=null,libCache=[];
const view={zoom:1,fit:true,bg:'grid',checker:true};
let rt=null;
const sched=()=>{clearTimeout(rt);rt=setTimeout(render,55);};
const designName=()=>{const e=libCache.find(x=>x.id===S.sid);return e?e.name:'';};

/* any manual edit turns the preset back into "custom" */
function touch(){S.preset='custom';$('preset').value='custom';}
function set(k,v){S[k]=v;touch();sched();}

/* ---------- status ---------- */
let stT=null;
function setStatus(m,ok,el){
  const e=el||$('st');e.textContent=m;e.className='status '+(ok?'ok':'bad');
  clearTimeout(stT);stT=setTimeout(()=>{e.textContent='';e.className='status';},3500);
}

/* ---------- matrix and logo ---------- */
let mxKey='',mxVal=null;
function matrix(url,ec){
  const k=ec+'|'+url;if(k===mxKey)return mxVal;
  mxVal=QF.makeMatrix(url,ec);mxKey=k;return mxVal;
}
function syncLogo(){
  if(!S.iconB64){logo=null;logoKey='';return;}
  const key=S.iconB64.length+':'+S.iconB64.slice(-40)+'|'+S.iInvert;
  if(key===logoKey)return;
  logoKey=key;
  QF.prepareLogo(S.iconB64,S.iInvert).then(l=>{if(logoKey===key){logo=l;sched();}}).catch(()=>{logo=null;});
}
const sceneFor=(over,o)=>QF.buildScene(Object.assign({},S,over||{}),matrix((over&&over.url)||S.url,S.ec),Object.assign({logo},o||{}));

/* ---------- render ---------- */
function layoutZoom(scene){
  const st=$('stage'),pad=64;
  if(view.fit){
    const z=Math.min((st.clientWidth-pad)/scene.W,(st.clientHeight-pad)/scene.H);
    view.zoom=Math.max(.2,Math.min(3,Math.floor(z*100)/100||1));
  }
  const dpr=window.devicePixelRatio||1;
  const rs=Math.max(1,Math.min(4,Math.ceil(view.zoom*dpr)));
  const cv=$('qrC');
  QF.sceneToCanvas(scene,rs,cv);
  cv.style.width=(scene.W*view.zoom)+'px';cv.style.height=(scene.H*view.zoom)+'px';cv.style.maxWidth='none';
  $('zVal').textContent=Math.round(view.zoom*100)+'%';
  $('dims').textContent=`${Math.round(scene.W)} × ${Math.round(scene.H)} px`;
}
function render(){
  const url=S.url.trim();
  if(!url){setBadge('failed','Failed','Enter a destination URL.');return;}
  let mx;
  try{mx=matrix(url,S.ec);}
  catch(e){setBadge('failed','Failed','The URL is too long for this error-correction level. Shorten it or choose a lower level.');setStatus('Could not encode this URL.',false);return;}
  syncLogo();
  const scene=QF.buildScene(S,mx,{logo});
  lastScene=scene;
  layoutZoom(scene);
  $('cwrap').classList.toggle('tr',scene.transp&&!scene.meta.bgPainted&&view.checker);
  $('cwrap').style.borderRadius=(scene.meta.framed?S.frameRad:S.bRd)*view.zoom+'px';
  validate(scene);
  if(!$('viewP').hidden)drawPrint();
}

/* ---------- validation display ---------- */
let vtok=0,vtimer=null,lastDecode=null;
const GLYPH={ok:'✓',warn:'!',fail:'x',info:'i'};
function setBadge(level,label,detail){
  const B={valid:['badge badge--success','✓ '],warning:['badge badge--warning','! '],failed:['badge badge--danger','x '],pending:['badge','… ']}[level];
  [$('vBadge'),$('vBadgeS')].forEach(b=>{b.hidden=false;b.className=B[0];b.textContent=B[1]+label;});
  if(detail!==undefined)$('vDetail').textContent=detail;
}
function validate(scene){
  const checks=QF.designChecks(S,scene);
  const tok=++vtok;lastDecode=null;
  paintChecks(checks,null);
  setBadge('pending','Checking','');
  clearTimeout(vtimer);
  vtimer=setTimeout(async()=>{
    try{
      const cv=QF.sceneToCanvas(scene,QF.decodeScale(scene));
      const dec=await QF.decodeRendered(cv,S.url.trim());
      if(tok!==vtok)return;
      lastDecode=dec;paintChecks(checks,dec);
    }catch(e){if(tok===vtok)paintChecks(checks,[]);}
  },250);
}
function paintChecks(checks,dec){
  const lines=checks.slice();
  if(dec){
    dec.forEach(d=>{
      if(d.status==='ok')lines.push({level:'ok',text:d.name+' decoded the rendered code and it matches the destination.'});
      else if(d.status==='mismatch')lines.push({level:'fail',text:d.name+' decoded different content: '+d.value});
      else if(d.status==='none')lines.push({level:'fail',text:d.name+' could not decode the rendered code.'});
      else lines.push({level:'info',text:d.name+' is unavailable in this browser.'});
    });
  }
  $('checks').innerHTML=lines.map(c=>`<li><span class="g ${c.level}" aria-hidden="true">${GLYPH[c.level]}</span><span>${esc(c.text)}</span></li>`).join('');
  const fixes=[...new Set(checks.filter(c=>c.fix).map(c=>c.fix))];
  const FL={contrast:'Fix contrast',ec:'Raise error correction',icon:'Shrink icon',quiet:'Add quiet zone'};
  $('fixes').innerHTML=fixes.map(f=>`<button class="btn btn--sm" type="button" data-fix="${f}">${FL[f]}</button>`).join('');
  if(dec){
    const o=QF.overallStatus(checks,dec);
    const used=dec.filter(d=>d.status!=='unavailable').map(d=>d.name).join(' + ');
    setBadge(o.level,o.label,o.text+(used?' ('+used+')':''));
  }
}
$('fixes').addEventListener('click',e=>{
  const b=e.target.closest('[data-fix]');if(!b||!lastScene)return;
  const p=QF.fixPatch(S,lastScene,b.dataset.fix);
  if(!Object.keys(p).length){setStatus('Nothing to change for a transparent background.',false);return;}
  Object.assign(S,p);touch();syncUI();sched();setStatus('Applied: '+b.textContent,true);
});

/* ---------- controls ---------- */
const SLIDERS=[['iSz','iSz','%'],['qSz','sz','px'],['qPd','pad','px'],['bRd','bRd','px'],['lblSz','lblSz','px'],['qZ','qZ',' mod'],['gAng','gAng','°'],['frameRad','frameRad','px'],['framePad','framePad','px']];
SLIDERS.forEach(([id,k,sfx])=>$(id).addEventListener('input',e=>{$(id+'V').textContent=e.target.value+sfx;set(k,+e.target.value);}));
const SEGS=[['dotSeg','dots'],['crnSeg','crn'],['eyeSeg','eye'],['clrSeg','iClear'],['ecSeg','ec'],['alSeg','lblAl'],['gmSeg','gradMode']];
const ecD={L:'L · 7% recovery — smallest QR',M:'M · 15% recovery — general use',Q:'Q · 25% recovery — recommended with an icon',H:'H · 30% recovery — best with an icon'};
SEGS.forEach(([id,k])=>$(id).querySelectorAll('.sbtn').forEach(b=>b.addEventListener('click',()=>{
  S[k]=b.dataset.v;touch();syncUI();sched();
})));
const COLORS=[['fgC','fgH','fg'],['bgC','bgH','bg'],['bgC2','bgH2','bg'],['lblC','lblCH','lblC'],['frameC','frameCH','frameC'],['frameTxtC','frameTxtCH','frameTxtC']];
COLORS.forEach(([id,hid,k])=>$(id).addEventListener('input',e=>{S[k]=e.target.value;touch();syncUI();sched();}));
['finOut','finIn'].forEach(k=>{
  $(k).addEventListener('input',e=>{S[k]=e.target.value;touch();syncUI();sched();});
});
document.querySelectorAll('[data-clear]').forEach(b=>b.addEventListener('click',()=>{S[b.dataset.clear]='';touch();syncUI();sched();}));
document.querySelectorAll('.tog[data-key]').forEach(t=>t.addEventListener('click',()=>{
  const k=t.dataset.key;S[k]=!S[k];touch();syncUI();sched();
}));
$('lblTxt').addEventListener('input',e=>{set('lblTxt',e.target.value);});
$('frameText').addEventListener('input',e=>{set('frameText',e.target.value);});
$('lblFont').addEventListener('change',e=>{S.lblFont=e.target.value;touch();loadFonts();sched();});
$('frameFont').addEventListener('change',e=>{S.frameFont=e.target.value;touch();loadFonts();sched();});
$('frame').addEventListener('change',e=>{S.frame=e.target.value;touch();syncUI();loadFonts();sched();});
$('urlIn').addEventListener('input',e=>{
  const v=e.target.value.trim();let ok=false;try{new URL(v);ok=true;}catch{}
  $('urlErr').style.display=ok||!v?'none':'block';
  e.target.setAttribute('aria-invalid',!ok&&!!v);
  if(ok||!v){S.url=v;sched();}
});
function loadFonts(){
  if(!document.fonts)return;
  const used=new Set([S.lblFont,S.frameFont]);
  used.forEach(f=>{if(f!=='system-ui'){document.fonts.load(`500 16px "${f}"`);document.fonts.load(`600 16px "${f}"`).then(sched).catch(()=>{});}});
}

/* stops */
function renderStops(){
  const el=$('stops');
  el.innerHTML=S.stops.map((c,i)=>`<div class="stoprow"><div class="csw"><input type="color" value="${c}" data-stop="${i}" aria-label="Gradient stop ${i+1}"><span class="chex">${c}</span></div>${S.stops.length>2?`<button class="iconbtn" type="button" data-rm="${i}" aria-label="Remove stop ${i+1}"><svg class="i" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`:''}</div>`).join('')+
    (S.stops.length<4?'<button class="btn btn--sm" type="button" id="addStop">Add stop</button>':'');
}
$('stops').addEventListener('input',e=>{
  const i=e.target.dataset.stop;if(i===undefined)return;
  S.stops[+i]=e.target.value;e.target.nextElementSibling.textContent=e.target.value;touch();sched();
});
$('stops').addEventListener('click',e=>{
  if(e.target.closest('#addStop')){S.stops.push(S.stops[S.stops.length-1]);touch();renderStops();sched();return;}
  const b=e.target.closest('[data-rm]');if(b){S.stops.splice(+b.dataset.rm,1);touch();renderStops();sched();}
});

/* presets */
QF.PRESETS.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.name;o.title=p.desc;$('preset').appendChild(o);});
{const o=document.createElement('option');o.value='custom';o.textContent='Custom';$('preset').insertBefore(o,$('preset').firstChild);}
$('preset').addEventListener('change',e=>{
  if(e.target.value==='custom')return;
  QF.applyPreset(S,e.target.value);syncUI();loadFonts();sched();
  const p=QF.PRESETS.find(x=>x.id===e.target.value);setStatus('Preset applied: '+p.name,true);
});
$('resetBtn').addEventListener('click',()=>{QF.resetDesign(S);syncUI();loadFonts();sched();setStatus('Design reset to defaults',true);});

/* font selects */
[$('lblFont'),$('frameFont')].forEach(sel=>QF.FONTS.forEach(f=>{const o=document.createElement('option');o.value=f;o.textContent=fontLabel(f);sel.appendChild(o);}));

function syncUI(){
  $('urlIn').value=S.url;
  SLIDERS.forEach(([id,k,sfx])=>{$(id).value=S[k];$(id+'V').textContent=S[k]+sfx;});
  SEGS.forEach(([id,k])=>$(id).querySelectorAll('.sbtn').forEach(b=>{const on=b.dataset.v===S[k];b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);}));
  COLORS.forEach(([id,hid,k])=>{$(id).value=S[k];$(hid).textContent=S[k];});
  ['finOut','finIn'].forEach(k=>{$(k).value=S[k]||S.fg;$(k+'H').textContent=S[k]||'match';});
  document.querySelectorAll('.tog[data-key]').forEach(t=>t.setAttribute('aria-checked',!!S[t.dataset.key]));
  $('lblTxt').value=S.lblTxt;$('frameText').value=S.frameText;
  $('lblFont').value=S.lblFont;$('frameFont').value=S.frameFont;$('frame').value=S.frame;
  $('preset').value=S.preset;
  $('ecDesc').textContent=ecD[S.ec];
  $('lblOpts').classList.toggle('on',S.lbl);
  $('frameOpts').classList.toggle('on',S.frame!=='none');
  $('frameText').hidden=S.frame!=='custom';
  $('solidRow').hidden=S.gradMode!=='none';
  $('gradOpts').classList.toggle('on',S.gradMode!=='none');
  $('angRow').hidden=S.gradMode!=='linear';
  $('trHint').hidden=!S.transp;
  renderStops();
  syncIconUI();
}

/* section open state */
const SECKEY='qrforge_sections';
let secState={};try{secState=JSON.parse(store.get(SECKEY)||'{}');}catch{}
document.querySelectorAll('details.sect').forEach(d=>{
  const k=d.dataset.sec;if(k in secState)d.open=!!secState[k];
  d.addEventListener('toggle',()=>{secState[k]=d.open;store.set(SECKEY,JSON.stringify(secState));});
});

/* ---------- icon ---------- */
const upZ=$('upZ');
let iconName='';
upZ.addEventListener('dragover',e=>{e.preventDefault();upZ.classList.add('drag');});
upZ.addEventListener('dragleave',()=>upZ.classList.remove('drag'));
upZ.addEventListener('drop',e=>{e.preventDefault();upZ.classList.remove('drag');const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))loadIcon(f);});
$('iconFile').addEventListener('change',e=>{if(e.target.files[0])loadIcon(e.target.files[0]);});
function loadIcon(file){
  if(file.size>8e6){setStatus('That image is too large. Use one under 8 MB.',false);return;}
  const r=new FileReader();
  r.onload=ev=>{
    const img=new Image();
    img.onload=()=>{S.iconB64=QF.compressImage(img);iconName=file.name;touch();syncUI();sched();};
    img.onerror=()=>setStatus('Could not read that image.',false);
    img.src=ev.target.result;
  };
  r.readAsDataURL(file);
}
function syncIconUI(){
  const has=!!S.iconB64;
  $('upP').classList.toggle('on',has);$('upH').style.display=has?'none':'';
  if(has){$('pThumb').src=S.iconB64;$('pName').textContent=iconName||'(saved icon)';}
}
$('clrIcon').addEventListener('click',e=>{e.stopPropagation();e.preventDefault();S.iconB64=null;iconName='';$('iconFile').value='';touch();syncUI();sched();});

/* ---------- tabs, theme, views ---------- */
function tab(t){
  $('vD').style.display=t==='D'?'':'none';
  $('vL').style.display=t==='L'?'':'none';
  [['tD','D'],['tL','L']].forEach(([id,v])=>{const on=t===v;$(id).setAttribute('aria-selected',on);$(id).tabIndex=on?0:-1;});
  if(t==='L')renderLib();
}
$('tD').addEventListener('click',()=>tab('D'));$('tL').addEventListener('click',()=>tab('L'));
document.querySelector('.ptabs').addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){const t=e.target.id==='tD'?'L':'D';tab(t);$('t'+t).focus();}
});
function showView(v){
  ['E','B','P'].forEach(x=>{
    $('view'+x).hidden=x!==v;
    const t=$('n'+x);t.setAttribute('aria-selected',x===v);t.tabIndex=x===v?0:-1;
  });
  if(v==='E')sched();
  if(v==='P'){initPrint();drawPrint();}
  if(v==='B')paintBatchDesign();
}
document.querySelectorAll('.ntab').forEach(t=>t.addEventListener('click',()=>showView(t.dataset.view)));
$('nE').parentElement.addEventListener('keydown',e=>{
  if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
  const ids=['E','B','P'],cur=ids.findIndex(x=>$('n'+x)===document.activeElement);if(cur<0)return;
  const nx=ids[(cur+(e.key==='ArrowRight'?1:2))%3];showView(nx);$('n'+nx).focus();
});
const root=document.documentElement;
const savedTheme=store.get('qrforge_theme');if(savedTheme==='dark'||savedTheme==='light')root.dataset.theme=savedTheme;
$('themeBtn').addEventListener('click',()=>{
  const cur=root.dataset.theme||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
  const next=cur==='dark'?'light':'dark';root.dataset.theme=next;store.set('qrforge_theme',next);
});

/* preview controls */
$('zIn').addEventListener('click',()=>{view.fit=false;view.zoom=Math.min(4,view.zoom*1.25);render();});
$('zOut').addEventListener('click',()=>{view.fit=false;view.zoom=Math.max(.25,view.zoom/1.25);render();});
$('zFit').addEventListener('click',()=>{view.fit=true;render();});
$('zReset').addEventListener('click',()=>{view.fit=false;view.zoom=1;render();});
$('pbgSeg').querySelectorAll('.sbtn').forEach(b=>b.addEventListener('click',()=>{
  view.bg=b.dataset.v;
  $('pbgSeg').querySelectorAll('.sbtn').forEach(x=>x.classList.toggle('on',x===b));
  $('stage').className='stage'+(view.bg==='grid'?'':' s-'+view.bg);
}));
$('checkTog').addEventListener('click',()=>{view.checker=!view.checker;$('checkTog').setAttribute('aria-checked',view.checker);render();});
let rzT=null;
window.addEventListener('resize',()=>{if(view.fit){clearTimeout(rzT);rzT=setTimeout(()=>{if(lastScene)layoutZoom(lastScene);},100);}});

/* ---------- dialogs ---------- */
let dlgDone=null;
function ask(o){
  return new Promise(res=>{
    $('dTitle').textContent=o.title;
    $('dMsg').hidden=!o.message;$('dMsg').textContent=o.message||'';
    const inp=$('dInput');inp.hidden=!o.input;inp.value=o.value||'';
    $('dYes').textContent=o.yes||'OK';
    $('dlg').classList.add('on');
    dlgDone=v=>{$('dlg').classList.remove('on');dlgDone=null;res(v);};
    setTimeout(()=>(o.input?inp:$('dYes')).focus(),50);
  });
}
$('dYes').addEventListener('click',()=>dlgDone&&dlgDone($('dInput').hidden?true:$('dInput').value.trim()||null));
$('dNo').addEventListener('click',()=>dlgDone&&dlgDone(null));
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(dlgDone)dlgDone(null);closeExport();}
  if(e.key==='Enter'&&dlgDone&&e.target.id==='dInput')$('dYes').click();
});

/* ---------- library ---------- */
const libView={q:'',sort:'modified',filter:'all',mode:'list'};
async function refreshLib(){libCache=await QF.store.list();$('libCnt').textContent=libCache.length;}
function thumb(){
  const s=$('qrC'),c=document.createElement('canvas'),k=80/Math.max(s.width,s.height);
  c.width=Math.max(1,Math.round(s.width*k));c.height=Math.max(1,Math.round(s.height*k));
  c.getContext('2d').drawImage(s,0,0,c.width,c.height);return c.toDataURL('image/png');
}
const fmtDate=t=>new Date(t).toLocaleDateString('en-SG',{day:'numeric',month:'short',year:'numeric'});
const snapshot=()=>{const o=Object.assign({},S);delete o.sid;return o;};
async function renderLib(){
  await refreshLib();
  const c=$('libList');c.className=libView.mode==='grid'?'grid':'';
  const list=QF.queryEntries(libCache,libView.q,libView.filter,libView.sort);
  if(!libCache.length){c.innerHTML='<div class="lib-empty">No saved QRs yet.<br>Design one, then choose<br><strong>Save QR</strong><br>or import a project file.</div>';return;}
  if(!list.length){c.innerHTML='<div class="lib-empty">No designs match.<br>Clear the search or filter.</div>';return;}
  c.innerHTML=list.map(e=>{
    const last=e.scanLog.length?new Date(e.scanLog[e.scanLog.length-1]).toLocaleDateString('en-SG',{day:'numeric',month:'short'}):'—';
    const id=esc(e.id);
    return`<div class="lcard${S.sid===e.id?' active':''}" data-id="${id}">
      <div class="lcard-top">
        <img class="lthumb" src="${esc(e.thumbnail)}" alt="">
        <div class="linfo">
          <div class="lname" title="${esc(e.name)}">${esc(e.name)}</div>
          <div class="lurl" title="${esc(e.settings.url)}">${esc(e.settings.url)}</div>
          <div class="ldate">Modified ${fmtDate(e.modified)}</div>
          <div class="lmeta">Created ${fmtDate(e.created)}</div>
        </div>
      </div>
      <div class="lbot">
        <div class="sctr"><span class="snum" id="sn_${id}">${e.scanCount}</span><span class="slbl">logged · last ${last}</span></div>
        <button class="xbtn" type="button" data-act="scan" title="Add one to the manual scan log" aria-label="Log a scan">+1</button>
      </div>
      <div class="lact">
        <button class="xbtn" type="button" data-act="edit">Edit</button>
        <button class="xbtn" type="button" data-act="export">Export</button>
        <button class="xbtn" type="button" data-act="dup">Duplicate</button>
        <button class="xbtn" type="button" data-act="rename">Rename</button>
        <button class="xbtn" type="button" data-act="json">JSON</button>
        <button class="xbtn del" type="button" data-act="del">Delete</button>
      </div>
    </div>`;
  }).join('');
}
$('libQ').addEventListener('input',e=>{libView.q=e.target.value;renderLib();});
$('libSort').addEventListener('change',e=>{libView.sort=e.target.value;renderLib();});
$('libFilter').addEventListener('change',e=>{libView.filter=e.target.value;renderLib();});
$('libView').querySelectorAll('.sbtn').forEach(b=>b.addEventListener('click',()=>{
  libView.mode=b.dataset.v;$('libView').querySelectorAll('.sbtn').forEach(x=>x.classList.toggle('on',x===b));renderLib();
}));
$('libList').addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const id=b.closest('.lcard').dataset.id,entry=libCache.find(x=>x.id===id);if(!entry)return;
  try{
    switch(b.dataset.act){
      case'edit':loadEntry(entry);break;
      case'export':loadEntry(entry);setTimeout(openExport,60);break;
      case'scan':{entry.scanCount++;entry.scanLog.push(Date.now());await QF.store.put(entry);const el=$('sn_'+id);if(el)el.textContent=entry.scanCount;setStatus('Scan logged — '+entry.scanCount+' total',true);break;}
      case'dup':{const d=QF.duplicateEntry(entry);await QF.store.put(d);await renderLib();setStatus('Duplicated as "'+d.name+'"',true);break;}
      case'rename':{const n=await ask({title:'Rename QR',input:true,value:entry.name,yes:'Rename'});if(n){entry.name=n.slice(0,60);entry.modified=Date.now();await QF.store.put(entry);syncPill();await renderLib();}break;}
      case'json':downloadProject(entry.name,Object.assign({},entry.settings),entry);break;
      case'del':{const ok=await ask({title:'Delete QR',message:'Delete "'+entry.name+'"? This cannot be undone.',yes:'Delete'});if(ok){await QF.store.remove(id);if(S.sid===id){S.sid=null;syncPill();}await renderLib();}break;}
    }
  }catch(err){setStatus(err.message,false);}
});
function loadEntry(e){
  Object.assign(S,QF.sanitize(e.settings),{sid:e.id});
  iconName='';mxKey='';logoKey='';
  syncUI();syncPill();tab('D');loadFonts();sched();showView('E');
  setStatus('Loaded "'+e.name+'"',true);
}
function syncPill(){
  const e=libCache.find(x=>x.id===S.sid);
  if(e){$('sPill').hidden=false;$('pillName').textContent=e.name;$('saveBtn').textContent='Update QR';}
  else{$('sPill').hidden=true;$('saveBtn').textContent='Save QR';}
}
$('saveBtn').addEventListener('click',async()=>{
  try{
    await refreshLib();
    const ex=libCache.find(e=>e.id===S.sid);
    if(ex){
      ex.settings=QF.sanitize(snapshot());ex.thumbnail=thumb();ex.modified=Date.now();
      await QF.store.put(ex);await renderLib();setStatus('QR updated',true);return;
    }
    const name=await ask({title:'Name this QR',input:true,value:(S.lbl&&S.lblTxt)||'My QR',yes:'Save'});
    if(!name)return;
    const entry=QF.newEntry(name,snapshot(),thumb());
    await QF.store.put(entry);S.sid=entry.id;
    await refreshLib();syncPill();await renderLib();setStatus('Saved as "'+entry.name+'"',true);
  }catch(err){setStatus(err.message,false);}
});

/* ---------- projects ---------- */
function downloadProject(name,settings,meta){
  const p=QF.makeProject(name||'Untitled',Object.assign({},settings),meta);
  QF.download(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}),QF.fileBase(name)+'.qrforge.json');
}
$('projBtn').addEventListener('click',()=>{downloadProject(designName()||'untitled',snapshot());setStatus('Project file downloaded',true);});
$('impBtn').addEventListener('click',()=>$('impFile').click());
$('impFile').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  if(f.size>QF.ICON_MAX*3){setStatus('That file is too large to be a project.',false);return;}
  const r=QF.parseProject(await f.text());
  if(!r.ok){setStatus(r.error,false);return;}
  try{
    const entry=QF.newEntry(r.name,r.settings,'');
    await QF.store.put(entry);
    await refreshLib();
    loadEntry(entry);
    setTimeout(async()=>{entry.thumbnail=thumb();await QF.store.put(entry);renderLib();},300);
    setStatus(r.warning?'Imported. '+r.warning:'Imported "'+r.name+'"',!r.warning);
  }catch(err){setStatus(err.message,false);}
});

/* ---------- export dialog ---------- */
const ex={fmt:'png',touchedName:false};
const EXT={png:'png',svg:'svg',pdf:'pdf'};
function openExport(){
  if(!lastScene){setStatus('Nothing to export yet.',false);return;}
  ex.touchedName=false;
  $('eName').value=QF.fileBase(designName());
  $('eTr').checked=S.transp;
  const hasText=(S.frame!=='none')||(S.lbl&&!!S.lblTxt);
  $('eLblRow').hidden=!hasText;$('eLbl').checked=true;
  const mm=$('eMm');if(!mm.dataset.set){mm.value=60;mm.dataset.set='1';}
  setFmt(ex.fmt);
  $('expModal').classList.add('on');$('eGo').focus();
}
function closeExport(){$('expModal').classList.remove('on');}
function setFmt(f){
  ex.fmt=f;
  $('eFmt').querySelectorAll('.sbtn').forEach(b=>b.classList.toggle('on',b.dataset.v===f));
  $('ePngF').hidden=f!=='png';$('ePdfF').hidden=f!=='pdf';
  $('eNote').textContent={png:'Raster image. Transparent backgrounds keep their alpha channel.',svg:'Real vector paths, editable in Illustrator, Figma or Inkscape. Label text stays live text, so convert it to outlines if the font may be missing.',pdf:'Print-ready vector PDF. The QR is drawn as shapes; label text uses Helvetica and non-Latin characters are replaced with "?".'}[f];
  updFile();
}
function updFile(){$('eFile').textContent=($('eName').value.trim()||'qr-forge')+'.'+EXT[ex.fmt];}
$('eFmt').querySelectorAll('.sbtn').forEach(b=>b.addEventListener('click',()=>setFmt(b.dataset.v)));
$('eName').addEventListener('input',updFile);
$('eRes').addEventListener('change',()=>{$('eW').hidden=$('eRes').value!=='custom';});
$('expBtn').addEventListener('click',openExport);
$('eCancel').addEventListener('click',closeExport);
$('expModal').addEventListener('click',e=>{if(e.target.id==='expModal')closeExport();});
$('eGo').addEventListener('click',async()=>{
  try{
    const scene=sceneFor(null,{transp:$('eTr').checked,label:$('eLbl').checked||$('eLblRow').hidden});
    const base=($('eName').value.trim()||QF.fileBase(designName())).replace(/[\\/:*?"<>|]+/g,'-');
    if(ex.fmt==='png'){
      const r=$('eRes').value;
      const w=r==='custom'?Math.max(50,Math.min(8000,+$('eW').value||scene.W)):scene.W*(+r);
      QF.download(await QF.pngBlob(scene,w),base+'.png');
    }else if(ex.fmt==='svg'){
      QF.download(QF.svgBlob(scene,designName()||'QR Forge'),base+'.svg');
    }else{
      const mm=Math.max(5,Math.min(400,+$('eMm').value||60)),mar=Math.max(0,Math.min(100,+$('eMar').value||0));
      QF.download(QF.pdfBlob(scene,{page:$('ePage').value,qrMm:mm,marginMm:mar,title:designName()||'QR Forge'}),base+'.pdf');
    }
    closeExport();setStatus('Exported '+ex.fmt.toUpperCase(),true);
  }catch(err){setStatus('Export failed: '+err.message,false);}
});
$('copyBtn').addEventListener('click',async()=>{
  const cv=$('qrC');
  try{
    const blob=await QF.toBlob(cv,'image/png');
    await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
    setStatus('Copied to clipboard',true);
  }catch{
    QF.download(await QF.toBlob(cv,'image/png'),QF.fileBase(designName())+'.png');
    setStatus('Clipboard unavailable — downloaded instead',true);
  }
});

/* ---------- batch ---------- */
const B={rows:null,header:true,records:[],built:false};
$('bDz').addEventListener('dragover',e=>{e.preventDefault();$('bDz').classList.add('drag');});
$('bDz').addEventListener('dragleave',()=>$('bDz').classList.remove('drag'));
$('bDz').addEventListener('drop',e=>{e.preventDefault();$('bDz').classList.remove('drag');if(e.dataTransfer.files[0])loadCSV(e.dataTransfer.files[0]);});
$('bFile').addEventListener('change',e=>{if(e.target.files[0])loadCSV(e.target.files[0]);e.target.value='';});
async function loadCSV(file){
  const info=$('bFileInfo');
  if(file.size>5e6){info.textContent='x That file is over 5 MB. Split it and try again.';return;}
  const r=QF.parseCSV(await file.text());
  if(r.error){info.textContent='x '+r.error;B.rows=null;$('bMap').hidden=true;return;}
  if(r.rows.length>1001){info.textContent='x The limit is 1000 rows per batch.';return;}
  B.rows=r.rows;info.textContent=`${file.name} · ${r.rows.length} rows · delimiter "${r.delimiter==='\t'?'tab':r.delimiter}"`;
  $('bHeader').checked=true;buildColumns();
}
function colNames(){
  const w=Math.max(...B.rows.map(r=>r.length));
  return Array.from({length:w},(_,i)=>$('bHeader').checked&&B.rows[0][i]?B.rows[0][i].trim():'Column '+(i+1));
}
function buildColumns(){
  const names=colNames();
  const opt=(v,t)=>`<option value="${v}">${esc(t)}</option>`;
  $('bUrl').innerHTML=names.map((n,i)=>opt(i,n)).join('');
  $('bName').innerHTML=opt(-1,'None')+names.map((n,i)=>opt(i,n)).join('');
  const data=B.rows.slice($('bHeader').checked?1:0);
  let u=names.findIndex(n=>/url|link|destination|website|address|href/i.test(n));
  if(u<0)u=names.findIndex((_,i)=>data.some(r=>/^https?:\/\//i.test((r[i]||'').trim())));
  $('bUrl').value=Math.max(0,u);
  const nm=names.findIndex((n,i)=>i!==+$('bUrl').value&&/name|title|label/i.test(n));
  $('bName').value=nm;
  $('bMap').hidden=false;$('bMap').style.display='flex';
  analyseBatch();
}
function analyseBatch(){
  if(!B.rows)return;
  const data=B.rows.slice($('bHeader').checked?1:0);
  B.records=QF.validateRows(data,+$('bUrl').value,+$('bName').value,{skipDuplicates:$('bSkipDup').checked});
  B.built=false;$('bZip').hidden=true;
  paintBatch();
}
['bHeader','bUrl','bName','bSkipDup'].forEach(id=>$(id).addEventListener('change',()=>{if(id==='bHeader')buildColumns();else analyseBatch();}));
$('bFmt').addEventListener('change',()=>{$('bSizeF').hidden=$('bFmt').value!=='png';});
const ST={ok:['badge badge--success','✓ Ready'],empty:['badge badge--danger','x Empty'],invalid:['badge badge--danger','x Invalid'],duplicate:['badge badge--warning','! Duplicate'],failed:['badge badge--danger','x Failed'],done:['badge badge--success','✓ Done']};
function paintBatch(){
  const rec=B.records;
  $('bEmpty').hidden=!!rec.length;$('bTableWrap').hidden=!rec.length;
  const inc=rec.filter(r=>r.include).length;
  $('bCount').hidden=!rec.length;$('bCount').textContent=`${inc} of ${rec.length} will be generated`;
  $('bBody').innerHTML=rec.map((r,i)=>{
    const st=r.state||(r.status==='duplicate'&&r.include?'ok':r.status);
    const [cls,lab]=ST[st]||ST.ok;
    return`<tr><td class="num">${r.row}</td><td>${esc(r.name)}</td><td>${esc(r.url)}</td>
      <td><span class="${cls}" title="${esc(r.msg)}">${lab}</span>${r.msg&&r.status!=='ok'?`<div class="sub">${esc(r.msg)}</div>`:''}</td>
      <td>${r.thumb?`<img src="${r.thumb}" alt="QR for ${esc(r.url)}">`:''}</td>
      <td>${r.thumb?`<button class="xbtn" type="button" data-dl="${i}">Download</button>`:''}</td></tr>`;
  }).join('');
}
function paintBatchDesign(){if(B.rows)paintBatch();}
const tick=()=>new Promise(r=>setTimeout(r,0));
$('bGen').addEventListener('click',async()=>{
  const todo=B.records.filter(r=>r.include);
  if(!todo.length){setStatus('No valid rows to generate.',false);return;}
  $('bGen').disabled=true;$('bProg').hidden=false;
  const stems=QF.fileStems(todo);
  for(let i=0;i<todo.length;i++){
    const r=todo[i];r.stem=stems[i];
    try{
      const sc=sceneFor({url:r.url});
      const t=QF.sceneToCanvas(sc,72/Math.max(sc.W,sc.H));
      r.thumb=t.toDataURL('image/png');r.state='done';
    }catch(e){r.state='failed';r.msg='Too long for the selected error-correction level.';r.thumb='';}
    $('bProg').firstElementChild.style.width=((i+1)/todo.length*100)+'%';
    if(i%10===9)await tick();
  }
  paintBatch();
  B.built=todo.some(r=>r.state==='done');$('bZip').hidden=!B.built;
  $('bGen').disabled=false;setTimeout(()=>{$('bProg').hidden=true;},800);
});
async function batchBlob(r){
  const sc=sceneFor({url:r.url});
  if($('bFmt').value==='svg')return QF.svgBlob(sc,r.name||r.url);
  return QF.pngBlob(sc,+$('bSize').value);
}
$('bBody').addEventListener('click',async e=>{
  const b=e.target.closest('[data-dl]');if(!b)return;
  const r=B.records[+b.dataset.dl];
  try{QF.download(await batchBlob(r),r.stem+'.'+$('bFmt').value);}catch(err){setStatus(err.message,false);}
});
$('bZip').addEventListener('click',async()=>{
  const items=B.records.filter(r=>r.state==='done');
  $('bZip').disabled=true;$('bProg').hidden=false;$('bProg').firstElementChild.style.width='0';
  try{
    const files=[];
    for(let i=0;i<items.length;i++){
      files.push({name:items[i].stem+'.'+$('bFmt').value,data:await QF.blobBytes(await batchBlob(items[i]))});
      $('bProg').firstElementChild.style.width=((i+1)/items.length*100)+'%';
      if(i%5===4)await tick();
    }
    QF.download(new Blob([QF.zip(files)],{type:'application/zip'}),'qr-forge_batch_'+QF.stamp()+'.zip');
  }catch(err){setStatus(err.message,false);}
  $('bZip').disabled=false;setTimeout(()=>{$('bProg').hidden=true;},800);
});

/* ---------- print ---------- */
let PL=null,printReady=false;
function initPrint(){
  if(printReady)return;printReady=true;
  const sel=$('pLayout');
  QF.PRINT_PRESETS.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=`${p.name} (${p.w}×${p.h} mm)`;sel.appendChild(o);});
  const c=document.createElement('option');c.value='custom';c.textContent='Custom size';sel.appendChild(c);
  PL=QF.sanitizeLayout(QF.PRINT_PRESETS[0]);writePrint();
  sel.addEventListener('change',()=>{
    const p=QF.PRINT_PRESETS.find(x=>x.id===sel.value);
    if(p){PL=QF.sanitizeLayout(p);writePrint();drawPrint();}
  });
  const NUM=['pW','pH','pM','pQ','pCols','pRows','pT1S','pT2S'];
  [...NUM,'pQX','pQY','pT1','pT2','pT1A','pT2A','pT1X','pT1Y','pT2X','pT2Y'].forEach(id=>$(id).addEventListener('input',()=>{
    PL=QF.sanitizeLayout(readPrint());
    ['pQX','pQY','pT1X','pT1Y','pT2X','pT2Y'].forEach(s=>{$(s+'V').textContent=$(s).value+'%';});
    if(['pW','pH'].includes(id))$('pLayout').value='custom';
    drawPrint();
  }));
  $('pPdf').addEventListener('click',()=>{
    try{
      const scene=sceneFor();
      const bytes=QF.printPDF(scene,PL,designName()||'QR Forge');
      QF.download(new Blob([bytes],{type:'application/pdf'}),QF.fileBase(designName())+'_print.pdf');
      setStatus('PDF exported at '+PL.w+' × '+PL.h+' mm',true,$('pSt'));
    }catch(err){setStatus('Export failed: '+err.message,false,$('pSt'));}
  });
}
function writePrint(){
  const m={pW:PL.w,pH:PL.h,pM:PL.margin,pQ:PL.qrMm,pCols:PL.cols,pRows:PL.rows,pQX:PL.qx,pQY:PL.qy,
    pT1:PL.t1.text,pT1S:PL.t1.size,pT1A:PL.t1.align,pT1X:PL.t1.x,pT1Y:PL.t1.y,
    pT2:PL.t2.text,pT2S:PL.t2.size,pT2A:PL.t2.align,pT2X:PL.t2.x,pT2Y:PL.t2.y};
  Object.entries(m).forEach(([id,v])=>{$(id).value=v;});
  ['pQX','pQY','pT1X','pT1Y','pT2X','pT2Y'].forEach(s=>{$(s+'V').textContent=$(s).value+'%';});
}
function readPrint(){
  const n=id=>parseFloat($(id).value);
  return{w:n('pW'),h:n('pH'),margin:n('pM'),qrMm:n('pQ'),qx:n('pQX'),qy:n('pQY'),cols:n('pCols'),rows:n('pRows'),
    t1:{text:$('pT1').value,size:n('pT1S'),x:n('pT1X'),y:n('pT1Y'),align:$('pT1A').value,bold:PL.t1.bold},
    t2:{text:$('pT2').value,size:n('pT2S'),x:n('pT2X'),y:n('pT2Y'),align:$('pT2A').value,bold:PL.t2.bold}};
}
function drawPrint(){
  if(!PL||$('viewP').hidden)return;
  try{
    const scene=sceneFor();
    QF.drawPage($('pCv'),scene,PL,900);
    $('pDims').textContent=`${PL.w} × ${PL.h} mm · QR ${PL.qrMm} mm`;
  }catch(e){}
}

/* ---------- init ---------- */
(async function init(){
  try{await refreshLib();}catch{}
  syncUI();syncPill();loadFonts();render();
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(sched);
})();
QF.app={S,render,set,syncUI,getScene:()=>lastScene};
})();
