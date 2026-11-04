/* QR Forge print composition: layout maths (pure) and vector PDF output. Dimensions are millimetres. */
(function(){
const QF=globalThis.QF=globalThis.QF||{};

const T=(text,size,x,y,align,bold)=>({text,size,x,y,align,bold});
/* x,y are percentages of the content area (page minus margin). QR x,y is its centre; text y is the baseline. */
const PRESETS=[
  {id:'card',name:'Business card',w:90,h:55,margin:4,qrMm:32,qx:80,qy:50,t1:T('Your name',14,2,42,'left',true),t2:T('yourwebsite.com',9,2,62,'left',false),cols:1,rows:1},
  {id:'flyer',name:'A4 flyer',w:210,h:297,margin:15,qrMm:110,qx:50,qy:50,t1:T('Scan to visit',40,50,12,'center',true),t2:T('yourwebsite.com',18,50,92,'center',false),cols:1,rows:1},
  {id:'sticker',name:'Sticker',w:50,h:50,margin:3,qrMm:40,qx:50,qy:50,t1:T('',10,50,10,'center',true),t2:T('',8,50,95,'center',false),cols:1,rows:1},
  {id:'label',name:'Product label',w:70,h:40,margin:3,qrMm:28,qx:22,qy:50,t1:T('Product name',11,48,40,'left',true),t2:T('SKU or website',8,48,62,'left',false),cols:1,rows:1},
  {id:'table',name:'Table display',w:148,h:210,margin:10,qrMm:90,qx:50,qy:46,t1:T('Scan to order',30,50,12,'center',true),t2:T('Table 1',22,50,90,'center',false),cols:1,rows:1},
  {id:'poster',name:'Poster (A3)',w:297,h:420,margin:20,qrMm:180,qx:50,qy:50,t1:T('Scan me',80,50,10,'center',true),t2:T('yourwebsite.com',30,50,93,'center',false),cols:1,rows:1}
];
const clone=p=>JSON.parse(JSON.stringify(p));
const clamp=(v,lo,hi,d)=>{v=Number(v);return Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):d;};

/* Keep a layout within sane limits. */
function sanitizeLayout(L){
  const o=clone(L);
  o.w=clamp(o.w,20,1000,90);o.h=clamp(o.h,20,1000,55);
  o.margin=clamp(o.margin,0,Math.min(o.w,o.h)/2-1,4);
  o.qrMm=clamp(o.qrMm,5,Math.max(o.w,o.h),30);
  o.qx=clamp(o.qx,0,100,50);o.qy=clamp(o.qy,0,100,50);
  o.cols=Math.round(clamp(o.cols,1,10,1));o.rows=Math.round(clamp(o.rows,1,10,1));
  ['t1','t2'].forEach(k=>{const t=o[k]||{};o[k]={text:String(t.text||'').slice(0,80),size:clamp(t.size,4,200,12),x:clamp(t.x,0,100,50),y:clamp(t.y,0,100,50),align:['left','center','right'].includes(t.align)?t.align:'center',bold:!!t.bold};});
  return o;
}
/* One placement per cell: {qr:{x,y,w}, texts:[{text,x,y,size,align,bold}]} in page mm. qr x,y = top-left. */
function placements(L,aspect){
  const cell=L.cols*L.rows>1?2:0;
  const aw=L.w-2*L.margin,ah=L.h-2*L.margin,cw=aw/L.cols,ch=ah/L.rows;
  const out=[];
  for(let r=0;r<L.rows;r++)for(let c=0;c<L.cols;c++){
    const x0=L.margin+c*cw+cell/2,y0=L.margin+r*ch+cell/2,w=cw-cell,h=ch-cell;
    let qw=Math.min(L.qrMm,w,h/aspect);
    const cx=x0+w*L.qx/100,cy=y0+h*L.qy/100;
    out.push({
      qr:{x:cx-qw/2,y:cy-qw*aspect/2,w:qw},
      texts:[L.t1,L.t2].filter(t=>t.text).map(t=>({text:t.text,x:x0+w*t.x/100,y:y0+h*t.y/100,size:t.size,align:t.align,bold:t.bold}))
    });
  }
  return out;
}
/* Vector PDF at the exact page size. */
function printPDF(scene,L,title){
  const MM=QF.PDF.MM,doc=new QF.PDF.PDFWriter(),pg=doc.addPage(L.w*MM,L.h*MM);
  placements(L,scene.H/scene.W).forEach(p=>{
    pg.scene(scene,p.qr.x*MM,p.qr.y*MM,p.qr.w*MM/scene.W);
    p.texts.forEach(t=>pg.text(t.text,t.x*MM,t.y*MM,t.size,'#000000',t.align,t.bold));
  });
  return doc.finish({title});
}
/* Draw the page on a canvas for the preview. */
function drawPage(cv,scene,L,maxPx){
  const k=Math.min(maxPx/L.w,maxPx/L.h);
  cv.width=Math.round(L.w*k);cv.height=Math.round(L.h*k);
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,cv.width,cv.height);
  placements(L,scene.H/scene.W).forEach(p=>{
    QF.drawScene(ctx,scene,p.qr.w*k/scene.W,p.qr.x*k,p.qr.y*k);
    p.texts.forEach(t=>{
      ctx.fillStyle='#000';ctx.textAlign=t.align;ctx.textBaseline='alphabetic';
      ctx.font=`${t.bold?'700':'400'} ${t.size*25.4/72*k}px Helvetica,Arial,sans-serif`;
      ctx.fillText(t.text,t.x*k,t.y*k);
    });
  });
}
Object.assign(QF,{PRINT_PRESETS:PRESETS,sanitizeLayout,printPlacements:placements,printPDF,drawPage});
})();
