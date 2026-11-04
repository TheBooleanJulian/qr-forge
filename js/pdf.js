/* QR Forge PDF writer: vector shapes, gradient shadings, Helvetica text and image XObjects.
   Hand-written (PDF 1.4, uncompressed) so no library is needed. Units are PDF points. */
(function(){
const QF=globalThis.QF=globalThis.QF||{};

/* Helvetica / Helvetica-Bold advance widths for ASCII 32..126 (per 1000 em). */
const HW=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HB=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

const n3=v=>(Math.round(v*1000)/1000).toString();
const hexRGB=h=>[1,3,5].map(i=>n3(parseInt(h.substr(i,2),16)/255)).join(' ');
const ascii=s=>String(s).replace(/[^\x20-\x7e]/g,'?');
const pdfStr=s=>'('+ascii(s).replace(/([\\()])/g,'\\$1')+')';
function textWidth(text,size,bold,spacing){
  const t=bold?HB:HW;let w=0;const s=ascii(text);
  for(let i=0;i<s.length;i++)w+=t[s.charCodeAt(i)-32];
  return w*size/1000+(spacing||0)*s.length;
}
const K=0.5522847498;
function rrOps(x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  if(r<=0)return`${n3(x)} ${n3(y)} ${n3(w)} ${n3(h)} re `;
  const k=r*K,X=x+w,Y=y+h;
  return`${n3(x+r)} ${n3(y)} m ${n3(X-r)} ${n3(y)} l ${n3(X-r+k)} ${n3(y)} ${n3(X)} ${n3(y+r-k)} ${n3(X)} ${n3(y+r)} c `+
    `${n3(X)} ${n3(Y-r)} l ${n3(X)} ${n3(Y-r+k)} ${n3(X-r+k)} ${n3(Y)} ${n3(X-r)} ${n3(Y)} c `+
    `${n3(x+r)} ${n3(Y)} l ${n3(x+r-k)} ${n3(Y)} ${n3(x)} ${n3(Y-r+k)} ${n3(x)} ${n3(Y-r)} c `+
    `${n3(x)} ${n3(y+r)} l ${n3(x)} ${n3(y+r-k)} ${n3(x+r-k)} ${n3(y)} ${n3(x+r)} ${n3(y)} c h `;
}
function circOps(cx,cy,r){
  const k=r*K;
  return`${n3(cx+r)} ${n3(cy)} m ${n3(cx+r)} ${n3(cy+k)} ${n3(cx+k)} ${n3(cy+r)} ${n3(cx)} ${n3(cy+r)} c `+
    `${n3(cx-k)} ${n3(cy+r)} ${n3(cx-r)} ${n3(cy+k)} ${n3(cx-r)} ${n3(cy)} c `+
    `${n3(cx-r)} ${n3(cy-k)} ${n3(cx-k)} ${n3(cy-r)} ${n3(cx)} ${n3(cy-r)} c `+
    `${n3(cx+k)} ${n3(cy-r)} ${n3(cx+r)} ${n3(cy-k)} ${n3(cx+r)} ${n3(cy)} c h `;
}

class PDFWriter{
  constructor(){this.objs=[];this.pages=[];this.meta={};this.helv=this._alloc();this.helvB=this._alloc();}
  _alloc(){this.objs.push(null);return this.objs.length;}   // object ids start at 1
  _set(id,parts){this.objs[id-1]=parts;}
  addPage(wPt,hPt){const p=new PDFPage(this,wPt,hPt);this.pages.push(p);return p;}
  finish(info){
    const enc=new TextEncoder();
    const catalog=this._alloc(),pagesId=this._alloc(),infoId=this._alloc();
    this._set(this.helv,['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']);
    this._set(this.helvB,['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>']);
    const kids=this.pages.map(p=>p._emit(pagesId));
    this._set(catalog,[`<< /Type /Catalog /Pages ${pagesId} 0 R >>`]);
    this._set(pagesId,[`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(k=>k+' 0 R').join(' ')}] >>`]);
    this._set(infoId,[`<< /Producer ${pdfStr('QR Forge')} /Title ${pdfStr((info&&info.title)||'QR Forge')} >>`]);
    const chunks=[],offsets=[];let pos=0;
    const push=u=>{chunks.push(u);pos+=u.length;};
    push(new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x34,0x0a,0x25,0xe2,0xe3,0xcf,0xd3,0x0a])); // %PDF-1.4 + binary marker
    this.objs.forEach((parts,i)=>{
      offsets.push(pos);
      push(enc.encode(`${i+1} 0 obj\n`));
      parts.forEach(p=>push(typeof p==='string'?enc.encode(p):p));
      push(enc.encode('\nendobj\n'));
    });
    const xref=pos;
    let x=`xref\n0 ${this.objs.length+1}\n0000000000 65535 f \n`;
    offsets.forEach(o=>{x+=String(o).padStart(10,'0')+' 00000 n \n';});
    x+=`trailer\n<< /Size ${this.objs.length+1} /Root ${catalog} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    push(enc.encode(x));
    const out=new Uint8Array(pos);let o=0;chunks.forEach(c=>{out.set(c,o);o+=c.length;});
    return out;
  }
}
class PDFPage{
  constructor(doc,w,h){this.doc=doc;this.w=w;this.h=h;this.ops=[];this.patterns=[];this.images=[];this.fonts={F1:doc.helv,F2:doc.helvB};}
  /* Fill with a solid colour (page coordinates, y up). */
  rect(x,y,w,h,hex){this.ops.push(`${hexRGB(hex)} rg ${n3(x)} ${n3(this.h-y-h)} ${n3(w)} ${n3(h)} re f\n`);}
  line(x1,y1,x2,y2,hex,wd){this.ops.push(`q ${hexRGB(hex)} RG ${n3(wd||.5)} w ${n3(x1)} ${n3(this.h-y1)} m ${n3(x2)} ${n3(this.h-y2)} l S Q\n`);}
  /* Plain text for print layouts. (x,y) is the baseline in points from the top-left. */
  text(text,x,y,size,hex,align,bold){
    const w=textWidth(text,size,bold,0);
    const X=align==='center'?x-w/2:align==='right'?x-w:x;
    this.ops.push(`BT ${hexRGB(hex)} rg /${bold?'F2':'F1'} ${n3(size)} Tf ${n3(X)} ${n3(this.h-y)} Td ${pdfStr(text)} Tj ET\n`);
  }
  /* Draw a scene with its top-left at (tx,ty) points and the given scale (points per scene unit). */
  scene(sc,tx,ty,s){
    const PH=this.h,M=[s,0,0,-s,tx,PH-ty];
    const o=[`q ${M.map(n3).join(' ')} cm\n`];
    const cur={};
    const fillOp=id=>{
      const fl=sc.fills[id];
      if(fl.type==='solid')return`${hexRGB(fl.c)} rg `;
      if(!cur[id]){
        const name='P'+(this.patterns.length+1);
        this.patterns.push({name,fl,M});cur[id]=name;
      }
      return`/Pattern cs /${cur[id]} scn `;
    };
    for(const it of sc.items){
      if(it.k==='rect'||it.k==='rrect')o.push(fillOp(it.f)+rrOps(it.x,it.y,it.w,it.h,it.k==='rect'?0:it.r)+'f\n');
      else if(it.k==='circle')o.push(fillOp(it.f)+circOps(it.cx,it.cy,it.r)+'f\n');
      else if(it.k==='ring')o.push(fillOp(it.f)+rrOps(it.outer.x,it.outer.y,it.outer.w,it.outer.h,it.outer.r)+rrOps(it.inner.x,it.inner.y,it.inner.w,it.inner.h,it.inner.r)+'f*\n');
      else if(it.k==='text'){
        const bold=it.weight>=600,size=it.size,sp=(it.spacing||0)*size;
        const w=textWidth(it.text,size,bold,sp);
        const X=it.align==='center'?it.x-w/2:it.align==='right'?it.x-w:it.x;
        o.push(`BT ${fillOp(it.f)}/${bold?'F2':'F1'} ${n3(size)} Tf ${n3(sp)} Tc 1 0 0 -1 ${n3(X)} ${n3(it.y)} Tm ${pdfStr(it.text)} Tj ET\n`);
      }else if(it.k==='logo'){
        const name='Im'+(this.images.length+1);
        this.images.push({name,px:QF.imagePixels(it.img)});
        o.push(`q ${rrOps(it.x,it.y,it.w,it.h,it.r)}W n ${n3(it.w)} 0 0 ${n3(-it.h)} ${n3(it.x)} ${n3(it.y+it.h)} cm /${name} Do Q\n`);
      }
    }
    o.push('Q\n');
    this.ops.push(o.join(''));
  }
  _emit(parentId){
    const d=this.doc;
    const res=[`/Font << /F1 ${this.fonts.F1} 0 R /F2 ${this.fonts.F2} 0 R >>`];
    if(this.patterns.length){
      const ps=this.patterns.map(p=>{
        const id=d._alloc();d._set(id,[patternDict(p)]);return`/${p.name} ${id} 0 R`;
      });
      res.push(`/Pattern << ${ps.join(' ')} >>`);
    }
    if(this.images.length){
      const xs=this.images.map(im=>{
        const sm=d._alloc(),id=d._alloc(),{w,h,rgb,alpha}=im.px;
        d._set(sm,[`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${alpha.length} >>\nstream\n`,alpha,'\nendstream']);
        d._set(id,[`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /SMask ${sm} 0 R /Length ${rgb.length} >>\nstream\n`,rgb,'\nendstream']);
        return`/${im.name} ${id} 0 R`;
      });
      res.push(`/XObject << ${xs.join(' ')} >>`);
    }
    const content=new TextEncoder().encode(this.ops.join(''));
    const cid=d._alloc(),pid=d._alloc();
    d._set(cid,[`<< /Length ${content.length} >>\nstream\n`,content,'\nendstream']);
    d._set(pid,[`<< /Type /Page /Parent ${parentId} 0 R /MediaBox [0 0 ${n3(this.w)} ${n3(this.h)}] /Contents ${cid} 0 R /Resources << ${res.join(' ')} >> >>`]);
    return pid;
  }
}
function patternDict(p){
  const fl=p.fl,box=fl.box;
  const stops=fl.stops;
  const seg=(a,b)=>`<< /FunctionType 2 /Domain [0 1] /C0 [${hexRGB(a)}] /C1 [${hexRGB(b)}] /N 1 >>`;
  let fn;
  if(stops.length===2)fn=seg(stops[0],stops[1]);
  else{
    const fns=[],bounds=[],enc=[];
    for(let i=0;i<stops.length-1;i++){fns.push(seg(stops[i],stops[i+1]));enc.push('0 1');if(i>0)bounds.push(n3(i/(stops.length-1)));}
    fn=`<< /FunctionType 3 /Domain [0 1] /Functions [${fns.join(' ')}] /Bounds [${bounds.join(' ')}] /Encode [${enc.join(' ')}] >>`;
  }
  const g=QF.gradGeom(fl);
  const sh=fl.type==='radial'
    ?`<< /ShadingType 3 /ColorSpace /DeviceRGB /Coords [${n3(g.cx)} ${n3(g.cy)} 0 ${n3(g.cx)} ${n3(g.cy)} ${n3(g.r)}] /Function ${fn} /Extend [true true] >>`
    :`<< /ShadingType 2 /ColorSpace /DeviceRGB /Coords [${n3(g.x1)} ${n3(g.y1)} ${n3(g.x2)} ${n3(g.y2)}] /Function ${fn} /Extend [true true] >>`;
  return`<< /Type /Pattern /PatternType 2 /Matrix [${p.M.map(n3).join(' ')}] /Shading ${sh} >>`;
}

const MM=72/25.4;
QF.PDF={PDFWriter,textWidth,MM};
/* Single-QR PDF: page = "fit" (QR plus margin) or a named size; QR centred at qrMm wide. */
const PAGES={A4:[210,297],A5:[148,210],A6:[105,148],Letter:[215.9,279.4]};
function qrPDF(scene,o){
  const qrW=o.qrMm*MM,s=qrW/scene.W,qrH=scene.H*s,m=o.marginMm*MM;
  let pw,ph;
  if(o.page==='fit'){pw=qrW+2*m;ph=qrH+2*m;}
  else{const p=PAGES[o.page]||PAGES.A4;pw=p[0]*MM;ph=p[1]*MM;}
  const doc=new PDFWriter(),pg=doc.addPage(pw,ph);
  pg.scene(scene,(pw-qrW)/2,(ph-qrH)/2,s);
  return doc.finish({title:o.title});
}
QF.PDF.PAGES=PAGES;QF.qrPDF=qrPDF;
})();
