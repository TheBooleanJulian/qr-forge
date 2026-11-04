/* QR Forge scene builder.
   Turns settings + a QR module matrix into a neutral list of shapes ("scene").
   The canvas, SVG and PDF writers all draw the same scene, so styling lives in one place. */
(function(){
const QF=globalThis.QF=globalThis.QF||{};

/* Wraps the qrcode-generator library. Throws if the URL does not fit at this error-correction level. */
function makeMatrix(url,ec){
  const q=globalThis.qrcode(0,ec);q.addData(url);q.make();
  const n=q.getModuleCount();
  return{n,version:(n-17)/4,isDark:(r,c)=>q.isDark(r,c)};
}
/* Centre coordinates of alignment patterns for a QR version (ISO 18004). */
function alignPositions(v){
  if(v<2)return[];
  const num=Math.floor(v/7)+2,last=4*v+10;
  const step=v===32?26:2*Math.ceil((4*v+4)/(2*num-2));
  const p=[6];for(let i=num-2;i>=0;i--)p.push(last-i*step);
  return p;
}
function alignCenters(n){
  const pos=alignPositions((n-17)/4),out=[];
  pos.forEach(r=>pos.forEach(c=>{
    const nearFinder=(r<9&&c<9)||(r<9&&c>n-10)||(r>n-10&&c<9);
    if(!nearFinder)out.push([r,c]);
  }));
  return out;
}
const solid=c=>({type:'solid',c});

/* Gradient geometry shared by every writer. */
function gradGeom(f){
  const b=f.box,cx=b.x+b.s/2,cy=b.y+b.s/2;
  if(f.type==='radial')return{cx,cy,r:b.s/2*1.4143};
  const a=f.angle*Math.PI/180,half=(Math.abs(Math.cos(a))+Math.abs(Math.sin(a)))*b.s/2;
  return{x1:cx-Math.cos(a)*half,y1:cy-Math.sin(a)*half,x2:cx+Math.cos(a)*half,y2:cy+Math.sin(a)*half};
}

/* opts: {transp, label:false (drop label/frame), logo:{img,src}, noLogo} */
function build(S,mx,opts){
  const o=opts||{};
  const T=o.transp!==undefined?o.transp:S.transp;
  const wantText=o.label!==false;
  const frame=wantText?S.frame:'none';
  const lbl=wantText?S.lbl:false;
  const framed=frame!=='none';
  const n=mx.n;
  const sz=S.sz,fp=framed?S.framePad:0;
  const bandH=framed?Math.round(Math.max(30,sz*.13)):0;
  const lH=(!framed&&lbl)?(S.lblSz*1.6+16):0;
  const W=sz+2*fp,H=framed?sz+2*fp+bandH:sz+lH;
  const items=[],fills={};
  const hasLogo=!!S.iconB64&&!o.noLogo;

  /* geometry of the code */
  const cs=(sz-2*S.pad)/(n+2*S.qZ),area=cs*n,ox=fp+S.pad+S.qZ*cs,oy=ox;
  const box={x:ox,y:oy,s:area};
  fills.main=S.gradMode==='none'?solid(S.fg):{type:S.gradMode,stops:S.stops.slice(),angle:S.gAng,box};
  fills.out=S.finOut?solid(S.finOut):fills.main;
  fills.in=S.finIn?solid(S.finIn):fills.main;
  fills.bg=solid(S.bg);fills.frame=solid(S.frameC);fills.lbl=solid(S.lblC);fills.ftxt=solid(S.frameTxtC);

  /* backgrounds */
  if(framed){
    items.push({k:'rrect',x:0,y:0,w:W,h:H,r:S.frameRad,f:'frame'});
    items.push({k:'rrect',x:fp,y:fp,w:sz,h:sz,r:Math.min(S.bRd,sz/2),f:'bg'});
  }else if(!T){
    items.push({k:'rrect',x:0,y:0,w:W,h:H,r:S.bRd,f:'bg'});
  }
  const bgPainted=framed||!T;

  /* centre icon */
  let iconPct=S.iSz,iconClamped=false;
  const bpFactor=S.iClear==='padded'?1.26:1;
  if(hasLogo&&S.protect){
    /* keep the icon box clear of the three finder patterns (8 modules from each corner) */
    const maxPct=Math.max(5,((n-16)/n)*100/bpFactor);
    if(iconPct>maxPct){iconPct=Math.floor(maxPct);iconClamped=true;}
  }
  const isz=area*(iconPct/100);
  const ix=ox+(area-isz)/2,iy=oy+(area-isz)/2;
  const bp=S.iClear==='padded'?isz*.13:0;
  const hole=hasLogo?{x:ix-bp,y:iy-bp,w:isz+bp*2,h:isz+bp*2}:null;
  const hits=(x,y)=>hole&&x<hole.x+hole.w&&x+cs>hole.x&&y<hole.y+hole.h&&y+cs>hole.y;

  /* function patterns */
  const inFinder=(r,c)=>(r<7&&c<7)||(r<7&&c>=n-7)||(r>=n-7&&c<7);
  const align=new Set();
  alignCenters(n).forEach(([r,c])=>{for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++)align.add((r+a)*1000+(c+b));});
  const isTiming=(r,c)=>(r===6&&c>=8&&c<=n-9)||(c===6&&r>=8&&r<=n-9);
  const isAlign=(r,c)=>align.has(r*1000+c);

  let covered=0,touchF=false,touchA=false,touchT=false;
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
    const dx=ox+c*cs,dy=oy+r*cs;
    const inHole=hits(dx,dy);
    if(inHole){
      covered++;
      if(inFinder(r,c))touchF=true;
      if(isAlign(r,c))touchA=true;
      if(isTiming(r,c))touchT=true;
    }
    if(inFinder(r,c)||!mx.isDark(r,c)||inHole)continue;
    const fn=S.protect&&(isTiming(r,c)||isAlign(r,c));
    if(S.dots==='dots'&&!fn)items.push({k:'circle',cx:dx+cs/2,cy:dy+cs/2,r:cs*.44,f:'main'});
    else if(S.dots==='square')items.push({k:'rect',x:dx,y:dy,w:cs,h:cs,f:'main'});
    else items.push({k:'rrect',x:dx+cs*.05,y:dy+cs*.05,w:cs*.9,h:cs*.9,r:cs*.3,f:'main'});   // inset scales with module size
  }

  /* finder patterns */
  [[0,0],[0,n-7],[n-7,0]].forEach(([r0,c0])=>{
    const x=ox+c0*cs,y=oy+r0*cs;
    const r7=S.crn==='square'?0:S.crn==='rounded'?cs*1.3:cs*3.5;
    const es=S.eye==='match'?S.crn:S.eye;
    const r3=es==='square'?0:es==='rounded'?cs*.65:cs*1.5;
    items.push({k:'ring',f:'out',
      outer:{x,y,w:7*cs,h:7*cs,r:r7},
      inner:{x:x+cs,y:y+cs,w:5*cs,h:5*cs,r:Math.max(0,r7-cs*.5)}});
    items.push({k:'rrect',x:x+2*cs,y:y+2*cs,w:3*cs,h:3*cs,r:r3,f:'in'});
  });

  /* icon plate and image */
  if(hasLogo){
    if(S.iClear==='padded'&&bgPainted)items.push({k:'rrect',x:hole.x,y:hole.y,w:hole.w,h:hole.h,r:hole.w*.2,f:'bg'});
    if(o.logo&&o.logo.img)items.push({k:'logo',x:ix,y:iy,w:isz,h:isz,r:isz*.15,img:o.logo.img,src:o.logo.src});
  }

  /* text: frame band or plain label. y is the alphabetic baseline. */
  if(framed){
    const size=Math.round(bandH*.42);
    const text=(QF.frameLabel(S)||'').toUpperCase();
    if(text)items.push({k:'text',text,x:W/2,y:fp+sz+(bandH+fp)/2+size*.35,size,font:S.frameFont,weight:600,align:'center',f:'ftxt',spacing:.08});
  }else if(lbl&&S.lblTxt){
    const x=S.lblAl==='left'?S.pad:S.lblAl==='right'?W-S.pad:W/2;
    items.push({k:'text',text:S.lblTxt,x,y:sz+S.lblSz*.15+S.lblSz*.8,size:S.lblSz,font:S.lblFont,weight:500,align:S.lblAl,f:'lbl'});
  }

  return{W,H,items,fills,transp:T,
    meta:{n,version:mx.version,cs,area,ox,oy,iconPct,iconClamped,hasLogo,
      coverage:covered/(n*n),touchFinder:touchF,touchAlign:touchA,touchTiming:touchT,bgPainted,framed}};
}

Object.assign(QF,{makeMatrix,alignPositions,alignCenters,gradGeom,buildScene:build});
})();
