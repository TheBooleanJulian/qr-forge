/* QR Forge SVG writer: real vector paths from a scene. */
(function(){
const QF=globalThis.QF=globalThis.QF||{};

const f=v=>String(Math.round(v*1000)/1000);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function rrPath(x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  if(r<=0)return`M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`;
  return`M${f(x+r)} ${f(y)}h${f(w-2*r)}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r)}v${f(h-2*r)}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(r)}h${f(-(w-2*r))}a${f(r)} ${f(r)} 0 0 1 ${f(-r)} ${f(-r)}v${f(-(h-2*r))}a${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(-r)}z`;
}
const circlePath=(cx,cy,r)=>`M${f(cx-r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2*r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2*r)} 0z`;
const fontFamily=n=>n==='system-ui'?'system-ui,sans-serif':`'${n}',system-ui,sans-serif`;

function sceneToSVG(scene,opts){
  const o=opts||{};
  const defs=[],ids=new Map();
  let body='';
  const paint=id=>{
    const fl=scene.fills[id];
    if(fl.type==='solid')return fl.c;
    if(!ids.has(fl)){
      ids.set(fl,id);
      const g=QF.gradGeom(fl);
      const stops=fl.stops.map((c,i)=>`<stop offset="${f(i/(fl.stops.length-1))}" stop-color="${c}"/>`).join('');
      defs.push(fl.type==='radial'
        ?`<radialGradient id="g_${id}" gradientUnits="userSpaceOnUse" cx="${f(g.cx)}" cy="${f(g.cy)}" r="${f(g.r)}">${stops}</radialGradient>`
        :`<linearGradient id="g_${id}" gradientUnits="userSpaceOnUse" x1="${f(g.x1)}" y1="${f(g.y1)}" x2="${f(g.x2)}" y2="${f(g.y2)}">${stops}</linearGradient>`);
    }
    return`url(#g_${ids.get(fl)})`;
  };
  /* merge runs of shapes with the same fill into one path */
  let run=null;
  const flush=()=>{if(run){body+=`<path fill="${paint(run.f)}" d="${run.d}"/>`;run=null;}};
  let clipN=0;
  for(const it of scene.items){
    if(it.k==='rect'||it.k==='rrect'||it.k==='circle'){
      const d=it.k==='rect'?rrPath(it.x,it.y,it.w,it.h,0):it.k==='rrect'?rrPath(it.x,it.y,it.w,it.h,it.r):circlePath(it.cx,it.cy,it.r);
      if(run&&run.f===it.f)run.d+=d;else{flush();run={f:it.f,d};}
      continue;
    }
    flush();
    if(it.k==='ring'){
      body+=`<path fill="${paint(it.f)}" fill-rule="evenodd" d="${rrPath(it.outer.x,it.outer.y,it.outer.w,it.outer.h,it.outer.r)}${rrPath(it.inner.x,it.inner.y,it.inner.w,it.inner.h,it.inner.r)}"/>`;
    }else if(it.k==='text'){
      const anchor=it.align==='left'?'start':it.align==='right'?'end':'middle';
      body+=`<text x="${f(it.x)}" y="${f(it.y)}" fill="${paint(it.f)}" font-family="${esc(fontFamily(it.font))}" font-size="${f(it.size)}" font-weight="${it.weight}" text-anchor="${anchor}"${it.spacing?` letter-spacing="${f(it.spacing*it.size)}"`:''}>${esc(it.text)}</text>`;
    }else if(it.k==='logo'){
      const id='clip'+(clipN++);
      defs.push(`<clipPath id="${id}"><path d="${rrPath(it.x,it.y,it.w,it.h,it.r)}"/></clipPath>`);
      body+=`<image x="${f(it.x)}" y="${f(it.y)}" width="${f(it.w)}" height="${f(it.h)}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice" href="${it.src}" xlink:href="${it.src}"/>`;
    }
  }
  flush();
  const W=f(scene.W),H=f(scene.H);
  const title=o.title?`<title>${esc(o.title)}</title>`:'';
  return`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${title}${defs.length?`<defs>${defs.join('')}</defs>`:''}${body}</svg>\n`;
}

Object.assign(QF,{sceneToSVG});
})();
