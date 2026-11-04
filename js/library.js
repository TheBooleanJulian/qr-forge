/* QR Forge Library: storage adapter plus entry helpers.
   Everything goes through `QF.store`, an async interface, so a different backend
   (IndexedDB, or a synced account later) can replace the localStorage one without touching the UI. */
(function(){
const QF=globalThis.QF=globalThis.QF||{};

const KEY='qrforge_v2';           // unchanged, so existing saved designs keep working
const rid=()=>'qr_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

function normalise(e){
  if(!e||typeof e!=='object')return null;
  const created=Number.isFinite(e.created)?e.created:Date.now();
  return{
    id:typeof e.id==='string'&&/^[\w-]{1,40}$/.test(e.id)?e.id:rid(),
    name:typeof e.name==='string'?e.name.replace(/[\u0000-\u001f]/g,'').slice(0,60)||'Unnamed QR':'Unnamed QR',
    settings:QF.sanitize(e.settings),
    thumbnail:typeof e.thumbnail==='string'&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(e.thumbnail)&&e.thumbnail.length<60000?e.thumbnail:'',
    created,
    modified:Number.isFinite(e.modified)?e.modified:created,
    scanCount:Number.isFinite(e.scanCount)?e.scanCount:0,
    scanLog:Array.isArray(e.scanLog)?e.scanLog.filter(Number.isFinite).slice(-1000):[]
  };
}

/* localStorage backend. Methods return Promises. Throws a readable error when storage is full. */
const localStore={
  _read(){try{const j=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(j)?j.map(normalise).filter(Boolean):[];}catch{return[];}},
  _write(list){
    try{localStorage.setItem(KEY,JSON.stringify(list));}
    catch(e){throw new Error('Browser storage is full. Delete some saved QRs or remove large icons, then try again.');}
  },
  async list(){return this._read();},
  async get(id){return this._read().find(e=>e.id===id)||null;},
  async put(entry){
    const list=this._read(),i=list.findIndex(e=>e.id===entry.id);
    if(i>=0)list[i]=entry;else list.unshift(entry);
    this._write(list);return entry;
  },
  async remove(id){this._write(this._read().filter(e=>e.id!==id));}
};
QF.store=localStore;

function newEntry(name,settings,thumbnail){
  const now=Date.now();
  return normalise({id:rid(),name,settings,thumbnail,created:now,modified:now,scanCount:0,scanLog:[]});
}
function duplicateEntry(e){
  const now=Date.now();
  return Object.assign({},e,{id:rid(),name:('Copy of '+e.name).slice(0,60),created:now,modified:now,scanCount:0,scanLog:[],settings:Object.assign({},e.settings)});
}

/* Search, filter and sort a list of entries. q: text, filter: id, sort: id. */
function queryEntries(list,q,filter,sort){
  q=(q||'').trim().toLowerCase();
  let out=list.filter(e=>!q||e.name.toLowerCase().includes(q)||e.settings.url.toLowerCase().includes(q));
  const F={
    logo:e=>!!e.settings.iconB64,nologo:e=>!e.settings.iconB64,
    gradient:e=>e.settings.gradMode!=='none',frame:e=>e.settings.frame!=='none',
    transparent:e=>e.settings.transp
  };
  if(F[filter])out=out.filter(F[filter]);
  const S={
    modified:(a,b)=>b.modified-a.modified,created:(a,b)=>b.created-a.created,
    name:(a,b)=>a.name.localeCompare(b.name),scans:(a,b)=>b.scanCount-a.scanCount
  };
  return out.sort(S[sort]||S.modified);
}
Object.assign(QF,{newEntry,duplicateEntry,queryEntries,normaliseEntry:normalise});
})();
