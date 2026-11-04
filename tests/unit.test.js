/* Unit tests for the pure modules. Run: node --test tests/
   Browser-dependent code (canvas, real QR decoding) is covered by tests/decode.html. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
['core','scene','svg','pdf','zip','csv','validate','library','print','export'].forEach(m=>{
  try{require('../js/'+m+'.js');}catch(e){if(!/document|window|localStorage/.test(String(e)))throw e;}
});
const QF=globalThis.QF;
const fake=(n=25)=>({n,version:(n-17)/4,isDark:(r,c)=>((r*7+c*13)%3)===0});
const S0=()=>QF.sanitize({});

/* ---------- core ---------- */
test('sanitize clamps, whitelists and defaults',()=>{
  const s=QF.sanitize({url:'x'.repeat(5000),sz:99999,pad:-5,dots:'evil',fg:'red',bg:'#ABCDEF',lbl:'yes',stops:['#000'],iconB64:'javascript:alert(1)',frame:'<script>'});
  assert.equal(s.url.length,2000);assert.equal(s.sz,600);assert.equal(s.pad,0);
  assert.equal(s.dots,'rounded');assert.equal(s.fg,'#0d0f14');assert.equal(s.bg,'#abcdef');
  assert.equal(s.lbl,false);assert.deepEqual(s.stops,QF.DEFAULTS.stops);assert.equal(s.iconB64,null);assert.equal(s.frame,'none');
});
test('sanitize accepts non-objects',()=>{
  for(const v of [null,undefined,'str',42,[]])assert.equal(QF.sanitize(v).url,QF.DEFAULTS.url);
});
test('designs saved before the overhaul load with defaults for new settings',()=>{
  const old={url:'https://a.test',iconB64:null,iSz:22,iClear:'square',iInvert:false,dots:'dots',crn:'square',fg:'#112233',bg:'#ffffff',sz:380,pad:20,bRd:0,lbl:true,lblTxt:'Hi',lblSz:16,lblC:'#0d0f14',ec:'Q'};
  const s=QF.sanitize(old);
  assert.equal(s.dots,'dots');assert.equal(s.fg,'#112233');assert.equal(s.ec,'Q');
  assert.equal(s.gradMode,'none');assert.equal(s.frame,'none');assert.equal(s.qZ,0);assert.equal(s.protect,true);
});
test('first-overhaul gradient fields migrate',()=>{
  const s=QF.sanitize({grad:true,fg:'#000000',fg2:'#0a6e8a'});
  assert.equal(s.gradMode,'linear');assert.deepEqual(s.stops,['#000000','#0a6e8a']);
});
test('icon data URLs: only raster types, bounded size',()=>{
  const ok='data:image/png;base64,iVBORw0KGgo=';
  assert.equal(QF.sanitize({iconB64:ok}).iconB64,ok);
  assert.equal(QF.sanitize({iconB64:'data:image/svg+xml;base64,PHN2Zz4='}).iconB64,null);
  assert.equal(QF.sanitize({iconB64:'data:image/png;base64,'+'A'.repeat(QF.ICON_MAX)}).iconB64,null);
});
test('every preset yields a valid design',()=>{
  for(const p of QF.PRESETS){
    const s=S0();assert.ok(QF.applyPreset(s,p.id));
    const clean=QF.sanitize(s);
    for(const k of QF.APPEARANCE)assert.deepEqual(clean[k],s[k],p.id+':'+k);
    assert.equal(s.preset,p.id);
  }
});
test('reset restores defaults but keeps the URL',()=>{
  const s=S0();s.url='https://keep.me';s.fg='#ff0000';s.gradMode='radial';QF.resetDesign(s);
  assert.equal(s.url,'https://keep.me');assert.equal(s.fg,QF.DEFAULTS.fg);assert.equal(s.gradMode,'none');
});
test('contrast maths and auto-fix',()=>{
  assert.ok(Math.abs(QF.contrast('#000000','#ffffff')-21)<.01);
  assert.ok(QF.contrast('#00d4c8','#ffffff')<3);
  const fixed=QF.fixColor('#00d4c8','#ffffff',4.5);assert.ok(QF.contrast(fixed,'#ffffff')>=4.5);
  const light=QF.fixColor('#222222','#05060d',4.5);assert.ok(QF.contrast(light,'#05060d')>=4.5);
});

/* ---------- projects ---------- */
test('project round trip',()=>{
  const s=S0();s.url='https://x.test/a?b=1';s.fg='#123456';s.preset='corporate';s.iconB64='data:image/png;base64,iVBORw0KGgo=';
  const p=QF.makeProject('My QR',s);
  assert.equal(p.schema,QF.SCHEMA);assert.equal(p.app,'qr-forge');assert.equal(p.content.value,'https://x.test/a?b=1');
  const r=QF.parseProject(JSON.stringify(p));
  assert.ok(r.ok);assert.equal(r.name,'My QR');assert.equal(r.settings.fg,'#123456');assert.equal(r.settings.url,'https://x.test/a?b=1');assert.equal(r.settings.iconB64,s.iconB64);
});
test('project import rejects bad input',()=>{
  const bad=(t,re)=>{const r=QF.parseProject(t);assert.equal(r.ok,false);assert.match(r.error,re);};
  bad('',/empty/);bad('{nope',/valid JSON/);bad('{"app":"other"}',/not a QR Forge/);
  bad(JSON.stringify({app:'qr-forge',schema:99,content:{type:'url',value:'https://a.test'}}),/schema 99/);
  bad(JSON.stringify({app:'qr-forge',content:{type:'url',value:'https://a.test'}}),/schema/);
  bad(JSON.stringify({app:'qr-forge',schema:1,content:{type:'url',value:''}}),/destination/);
  bad('x'.repeat(2e6),/too large/);
});
test('project import drops hostile logos and clamps design',()=>{
  const r=QF.parseProject(JSON.stringify({app:'qr-forge',schema:1,name:'n',content:{type:'url',value:'https://a.test'},
    design:{sz:1e9,fg:'url(javascript:x)',frame:'x'},logo:{dataUrl:'data:image/svg+xml;base64,PHN2Zz4='}}));
  assert.ok(r.ok);assert.equal(r.settings.iconB64,null);assert.match(r.warning,/logo/);
  assert.equal(r.settings.sz,600);assert.equal(r.settings.fg,QF.DEFAULTS.fg);
});

/* ---------- scene ---------- */
test('alignment pattern positions follow ISO 18004',()=>{
  assert.deepEqual(QF.alignPositions(1),[]);
  assert.deepEqual(QF.alignPositions(2),[6,18]);
  assert.deepEqual(QF.alignPositions(7),[6,22,38]);
  assert.deepEqual(QF.alignPositions(32),[6,34,60,86,112,138]);
  assert.deepEqual(QF.alignPositions(40),[6,30,58,86,114,142,170]);
  assert.equal(QF.alignCenters(25).length,1);       // version 2: one pattern
  assert.equal(QF.alignCenters(45).length,6);       // version 7: 3x3 grid minus 3 finder corners
});
test('scene has three finder rings and matches settings',()=>{
  const sc=QF.buildScene(S0(),fake());
  assert.equal(sc.items.filter(i=>i.k==='ring').length,3);
  assert.equal(sc.W,380);assert.equal(sc.H,380);
  assert.ok(sc.items.some(i=>i.k==='rrect'&&i.f==='bg'));
});
test('transparent background drops the backing; frame always paints it',()=>{
  const s=S0();s.transp=true;
  assert.ok(!QF.buildScene(s,fake()).items.some(i=>i.f==='bg'));
  s.frame='scan-me';const sc=QF.buildScene(s,fake());
  assert.ok(sc.items.some(i=>i.f==='bg'));assert.ok(sc.H>sc.W);
  assert.equal(sc.items.find(i=>i.k==='text').text,'SCAN ME');
});
test('frame keeps the quiet zone and label can be dropped',()=>{
  const s=S0();s.frame='custom';s.frameText='hello';s.framePad=20;
  const sc=QF.buildScene(s,fake());
  assert.equal(sc.meta.ox,20+s.pad);                 // frame padding + QR padding, untouched
  const bare=QF.buildScene(s,fake(),{label:false});
  assert.equal(bare.W,380);assert.ok(!bare.items.some(i=>i.k==='text'));
});
test('icon clears modules and protect clamps size away from finders',()=>{
  const s=S0();s.iconB64='data:image/png;base64,iVBORw0KGgo=';s.iSz=35;
  const withIcon=QF.buildScene(s,fake(21));
  assert.ok(withIcon.meta.iconClamped);assert.ok(!withIcon.meta.touchFinder);
  s.protect=false;
  assert.ok(QF.buildScene(s,fake(21)).meta.touchFinder);
  const none=QF.buildScene(Object.assign(S0()),fake(21));
  const mods=sc=>sc.items.filter(i=>i.f==='main').length;
  assert.ok(mods(withIcon)<mods(none));
});
test('gradient fills carry geometry',()=>{
  const s=S0();s.gradMode='linear';s.gAng=0;
  const sc=QF.buildScene(s,fake());const g=QF.gradGeom(sc.fills.main);
  assert.ok(g.x2>g.x1);assert.ok(Math.abs(g.y1-g.y2)<1e-6);
  s.gradMode='radial';assert.ok(QF.gradGeom(QF.buildScene(s,fake()).fills.main).r>0);
});

/* ---------- svg ---------- */
function wellFormed(x){
  const stack=[];
  for(const m of x.replace(/<\?xml[^>]*\?>/,'').matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)){
    if(m[4])continue;
    if(m[1]){assert.equal(stack.pop(),m[2]);}else stack.push(m[2]);
  }
  assert.equal(stack.length,0);
}
test('svg is vector, well formed and sized to the scene',()=>{
  const s=S0();s.frame='scan-me';s.gradMode='radial';s.stops=['#000000','#112233','#334455'];
  const x=QF.sceneToSVG(QF.buildScene(s,fake()),{title:'a & b'});
  wellFormed(x);
  assert.match(x,/<svg[^>]+width="412" height="461"/);assert.match(x,/viewBox="0 0 412 461"/);assert.equal((x.match(/<radialGradient/g)||[]).length,1);
  assert.match(x,/<radialGradient/);assert.match(x,/stop-color="#112233"/);
  assert.match(x,/a &amp; b/);assert.ok(!/<image/.test(x));
  assert.match(x,/<path/);assert.match(x,/SCAN ME/);
});
test('svg merges runs of modules into few paths',()=>{
  const x=QF.sceneToSVG(QF.buildScene(S0(),fake()));
  assert.ok((x.match(/<path/g)||[]).length<20);
});

/* ---------- pdf ---------- */
function checkPdf(bytes){
  const t=Buffer.from(bytes).toString('latin1');
  assert.ok(t.startsWith('%PDF-1.4'));assert.ok(t.trimEnd().endsWith('%%EOF'));
  const sx=+t.match(/startxref\n(\d+)\n%%EOF/)[1];
  assert.equal(t.substr(sx,4),'xref');
  const m=t.substr(sx).match(/xref\n0 (\d+)\n/);const count=+m[1];
  const lines=t.substr(sx+m[0].length).split('\n').slice(0,count);
  lines.slice(1).forEach((l,i)=>{const off=+l.slice(0,10);assert.ok(t.substr(off).startsWith((i+1)+' 0 obj'),'object '+(i+1));});
  return t;
}
test('pdf is structurally valid with vector shapes and gradients',()=>{
  const s=S0();s.gradMode='linear';s.stops=['#000000','#0a6e8a','#123456'];s.lbl=true;
  const bytes=QF.qrPDF(QF.buildScene(s,fake()),{page:'A4',qrMm:60,marginMm:10,title:'T'});
  const t=checkPdf(bytes);
  assert.match(t,/\/MediaBox \[0 0 595\.276 841\.89\]/);
  assert.match(t,/\/ShadingType 2/);assert.match(t,/\/FunctionType 3/);assert.match(t,/ f\*?\n/);
  assert.ok(!/\/Subtype \/Image/.test(t));
});
test('pdf fit page and radial shading',()=>{
  const s=S0();s.gradMode='radial';
  const t=checkPdf(QF.qrPDF(QF.buildScene(s,fake()),{page:'fit',qrMm:50,marginMm:5,title:'x'}));
  assert.match(t,/\/ShadingType 3/);assert.match(t,/\/MediaBox \[0 0 170\.079 170\.079\]/);
});
test('pdf text widths use Helvetica metrics',()=>{
  const w=QF.PDF.textWidth('Hello',10,false,0);assert.ok(Math.abs(w-(722+556+222+222+556)*10/1000)<1e-9);
});

/* ---------- zip ---------- */
test('zip stores files with correct CRCs and opens in a real unzip tool',()=>{
  assert.equal(QF.crc32(Buffer.from('123456789')),0xCBF43926);
  const files=[{name:'a.txt',data:Buffer.from('hello')},{name:'dir/ü.bin',data:Uint8Array.from([0,1,2,3,255])}];
  const z=QF.zip(files);
  assert.equal(Buffer.from(z.subarray(0,4)).toString('hex'),'504b0304');
  const eocd=z.length-22;assert.equal(Buffer.from(z.subarray(eocd,eocd+4)).toString('hex'),'504b0506');
  assert.equal(new DataView(z.buffer,z.byteOffset).getUint16(eocd+10,true),2);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qfzip-'));
  const f=path.join(dir,'t.zip');fs.writeFileSync(f,z);
  const r=cp.spawnSync('tar',['-tf',f],{encoding:'utf8'});
  if(r.status===0){assert.match(r.stdout,/a\.txt/);assert.match(r.stdout,/ü\.bin/);}
  else console.log('# tar unavailable, skipped external unzip check');
  fs.rmSync(dir,{recursive:true,force:true});
});

/* ---------- csv ---------- */
test('csv parsing handles quotes, newlines, BOM and delimiters',()=>{
  const r=QF.parseCSV('﻿name,url\r\n"Smith, J","https://a.test/?q=""x"""\r\nB,"multi\nline"\r\n');
  assert.deepEqual(r.rows,[['name','url'],['Smith, J','https://a.test/?q="x"'],['B','multi\nline']]);
  assert.equal(QF.parseCSV('a;b\n1;2').delimiter,';');
  assert.equal(QF.parseCSV('a\tb\n1\t2').delimiter,'\t');
});
test('csv reports malformed input',()=>{
  assert.match(QF.parseCSV('a,b\n"open,1').error,/never closed/);
  assert.match(QF.parseCSV('a,b\nx"y,1').error,/Malformed/);
  assert.match(QF.parseCSV('\n\n').error,/no rows/);
});
test('batch row validation flags empty, invalid and duplicate rows',()=>{
  const rows=[['A','https://a.test'],['B',''],['C','not a url'],['D','https://a.test'],['E','mailto:x@y.test']];
  const v=QF.validateRows(rows,1,0,{skipDuplicates:true});
  assert.deepEqual(v.map(r=>r.status),['ok','empty','invalid','duplicate','ok']);
  assert.deepEqual(v.map(r=>r.include),[true,false,false,false,true]);
  assert.equal(QF.validateRows(rows,1,0,{skipDuplicates:false})[3].include,true);
});
test('batch file names are unique and safe',()=>{
  const s=QF.fileStems([{name:'Hello World!',url:'https://a'},{name:'Hello World!',url:'https://b'},{name:'',url:'https://x.test/p?q=1'},{name:'../../etc',url:'https://c'}]);
  assert.deepEqual(s,['hello-world','hello-world-2','x-test-p-q-1','etc']);
});

/* ---------- validation ---------- */
test('design checks flag low contrast and offer a fix that works',()=>{
  const s=S0();s.fg='#7fe3dd';const sc=QF.buildScene(s,fake());
  const c=QF.designChecks(s,sc).find(x=>x.id==='contrast');
  assert.equal(c.level,'fail');assert.equal(c.fix,'contrast');
  Object.assign(s,QF.fixPatch(s,sc,'contrast'));
  assert.equal(QF.designChecks(s,QF.buildScene(s,fake())).find(x=>x.id==='contrast').level,'ok');
});
test('gradient contrast uses the weakest stop',()=>{
  const s=S0();s.gradMode='linear';s.stops=['#000000','#f0f0f0'];
  assert.equal(QF.designChecks(s,QF.buildScene(s,fake())).find(x=>x.id==='contrast').level,'fail');
});
test('icon checks scale with error correction',()=>{
  const s=S0();s.iconB64='data:image/png;base64,iVBORw0KGgo=';s.iSz=35;s.ec='L';s.protect=false;
  const sc=QF.buildScene(s,fake(33));
  assert.equal(QF.designChecks(s,sc).find(x=>x.id==='icon').level,'fail');
  Object.assign(s,QF.fixPatch(s,sc,'icon'));
  const sc2=QF.buildScene(s,fake(33));
  assert.notEqual(QF.designChecks(s,sc2).find(x=>x.id==='icon').level,'fail');
});
test('overall status never reports Valid without a successful decode',()=>{
  const ok=[],bad=[{level:'warn'}];
  assert.equal(QF.overallStatus(ok,[{name:'a',status:'ok'}]).level,'valid');
  assert.equal(QF.overallStatus(bad,[{name:'a',status:'ok'}]).level,'warning');
  assert.equal(QF.overallStatus(ok,[{name:'a',status:'none'}]).level,'failed');
  assert.equal(QF.overallStatus(ok,[{name:'a',status:'mismatch'}]).level,'failed');
  assert.equal(QF.overallStatus(ok,[{name:'a',status:'unavailable'}]).level,'warning');
  assert.equal(QF.overallStatus(ok,[{name:'a',status:'none'},{name:'b',status:'ok'}]).level,'valid');
});

/* ---------- library ---------- */
test('library entries are normalised and queryable',()=>{
  const e=QF.normaliseEntry({id:'bad id!',name:'x'.repeat(100),settings:{url:'https://a.test',dots:'hax'},thumbnail:'javascript:1',created:5});
  assert.match(e.id,/^qr_/);assert.equal(e.name.length,60);assert.equal(e.settings.dots,'rounded');assert.equal(e.thumbnail,'');assert.equal(e.modified,5);
  const mk=(n,u,mod,extra)=>QF.normaliseEntry({id:n,name:n,settings:Object.assign({url:u},extra),created:mod,modified:mod,scanCount:mod});
  const list=[mk('beta','https://b.test',2,{gradMode:'linear'}),mk('alpha','https://a.test',3,{}),mk('gamma','https://c.test',1,{frame:'scan-me'})];
  assert.deepEqual(QF.queryEntries(list,'','all','name').map(x=>x.id),['alpha','beta','gamma']);
  assert.deepEqual(QF.queryEntries(list,'','all','modified').map(x=>x.id),['alpha','beta','gamma']);
  assert.deepEqual(QF.queryEntries(list,'c.test','all','name').map(x=>x.id),['gamma']);
  assert.deepEqual(QF.queryEntries(list,'','gradient','name').map(x=>x.id),['beta']);
  assert.deepEqual(QF.queryEntries(list,'','frame','name').map(x=>x.id),['gamma']);
});
test('library store round trip, duplicate and storage-full error',async()=>{
  const mem={};let full=false;
  globalThis.localStorage={getItem:k=>mem[k]??null,setItem:(k,v)=>{if(full)throw new Error('quota');mem[k]=v;}};
  const e=QF.newEntry('One',{url:'https://a.test'},'');
  await QF.store.put(e);
  assert.equal((await QF.store.list()).length,1);
  const d=QF.duplicateEntry(e);await QF.store.put(d);
  assert.equal((await QF.store.list()).length,2);assert.match(d.name,/^Copy of/);assert.notEqual(d.id,e.id);
  await QF.store.remove(e.id);assert.equal((await QF.store.list()).length,1);
  full=true;await assert.rejects(()=>QF.store.put(e),/storage is full/);
  mem.qrforge_v2='{broken';full=false;assert.deepEqual(await QF.store.list(),[]);
  delete globalThis.localStorage;
});

/* ---------- print ---------- */
test('print placements fit the page and repeat per cell',()=>{
  const L=QF.sanitizeLayout(Object.assign({},QF.PRINT_PRESETS[2],{cols:3,rows:2}));
  const p=QF.printPlacements(L,1);
  assert.equal(p.length,6);
  p.forEach(c=>{assert.ok(c.qr.x>=0&&c.qr.y>=0);assert.ok(c.qr.x+c.qr.w<=L.w+1e-6);assert.ok(c.qr.y+c.qr.w<=L.h+1e-6);});
});
test('print layouts are clamped',()=>{
  const L=QF.sanitizeLayout({w:-5,h:1e9,margin:999,qrMm:0,cols:99,rows:0,t1:{text:'x'.repeat(500),size:1e6,align:'bad'}});
  assert.equal(L.w,20);assert.equal(L.h,1000);assert.ok(L.margin<=9);assert.equal(L.cols,10);assert.equal(L.rows,1);
  assert.equal(L.t1.text.length,80);assert.equal(L.t1.size,200);assert.equal(L.t1.align,'center');
});
test('print pdf uses the exact page size in points',()=>{
  const L=QF.sanitizeLayout(QF.PRINT_PRESETS[0]);
  const t=checkPdf(QF.printPDF(QF.buildScene(S0(),fake()),L,'t'));
  assert.match(t,/\/MediaBox \[0 0 255\.118 155\.906\]/);   // 90 x 55 mm
  assert.match(t,/Your name/);
});

/* ---------- export names ---------- */
test('export file names follow qr-forge_[design-name]_[timestamp]',()=>{
  assert.match(QF.fileBase('My Design!'),/^qr-forge_my-design_\d{8}-\d{6}$/);
  assert.match(QF.fileBase(''),/^qr-forge_untitled_/);
});
