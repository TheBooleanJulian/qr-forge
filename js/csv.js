/* QR Forge CSV parsing and batch row validation. Pure logic. */
(function(){
const QF=globalThis.QF=globalThis.QF||{};

/* RFC 4180 style parser. Returns {rows, delimiter} or {error}. */
function parseCSV(text){
  if(typeof text!=='string')return{error:'No data.'};
  if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
  const first=text.split(/\r\n|\n|\r/,1)[0]||'';
  const cand=[',',';','\t'].map(d=>[d,first.split(d).length]).sort((a,b)=>b[1]-a[1])[0];
  const delim=cand[1]>1?cand[0]:',';
  const rows=[];let row=[],cell='',q=false,i=0;
  const endCell=()=>{row.push(cell);cell='';};
  const endRow=()=>{endCell();rows.push(row);row=[];};
  while(i<text.length){
    const ch=text[i];
    if(q){
      if(ch==='"'){if(text[i+1]==='"'){cell+='"';i+=2;continue;}q=false;i++;continue;}
      cell+=ch;i++;continue;
    }
    if(ch==='"'){
      if(cell!==''){return{error:`Malformed CSV: a quote appears inside an unquoted value (row ${rows.length+1}).`};}
      q=true;i++;continue;
    }
    if(ch===delim){endCell();i++;continue;}
    if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;endRow();i++;continue;}
    cell+=ch;i++;
  }
  if(q)return{error:'Malformed CSV: a quoted value is never closed.'};
  if(cell!==''||row.length)endRow();
  while(rows.length&&rows[rows.length-1].every(c=>c.trim()===''))rows.pop();
  if(!rows.length)return{error:'The CSV has no rows.'};
  return{rows,delimiter:delim};
}

function validUrl(v){
  if(typeof v!=='string'||v.length>2000)return false;
  try{new URL(v);return /^[a-z][a-z0-9+.-]*:/i.test(v);}catch{return false;}
}
/* rows: array of arrays (header already removed). Returns one record per row. */
function validateRows(rows,urlCol,nameCol,opts){
  const o=opts||{};const seen=new Map();
  return rows.map((r,i)=>{
    const url=(r[urlCol]||'').trim();
    const name=nameCol>=0?(r[nameCol]||'').trim():'';
    const rec={row:i+1,url,name,status:'ok',msg:''};
    if(!url){rec.status='empty';rec.msg='No destination.';}
    else if(!validUrl(url)){rec.status='invalid';rec.msg='Not a valid URL. Include https://.';}
    else if(seen.has(url)){rec.status='duplicate';rec.msg=`Same destination as row ${seen.get(url)}.`;}
    else seen.set(url,i+1);
    rec.include=rec.status==='ok'||(rec.status==='duplicate'&&o.skipDuplicates===false);
    return rec;
  });
}
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50);
/* Unique file stems for a batch. */
function fileStems(records){
  const used=new Set();
  return records.map(r=>{
    let base=slug(r.name)||slug(r.url.replace(/^[a-z]+:\/\//i,''))||'qr';
    let s=base,n=2;while(used.has(s))s=base+'-'+(n++);
    used.add(s);return s;
  });
}
Object.assign(QF,{parseCSV,validUrl,validateRows,fileStems,slug});
})();
