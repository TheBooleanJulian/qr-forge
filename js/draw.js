/* QR Forge canvas renderer and image helpers (browser only). */
(function(){
const QF=globalThis.QF=globalThis.QF||{};

function rp(ctx,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  if(r<=0){ctx.rect(x,y,w,h);return;}
  ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}
const fontStack=f=>f==='system-ui'?'system-ui,sans-serif':`'${f}',system-ui,sans-serif`;

function style(ctx,f){
  if(f.type==='solid')return f.c;
  const g=QF.gradGeom(f);
  const gr=f.type==='radial'?ctx.createRadialGradient(g.cx,g.cy,0,g.cx,g.cy,g.r):ctx.createLinearGradient(g.x1,g.y1,g.x2,g.y2);
  f.stops.forEach((c,i)=>gr.addColorStop(i/(f.stops.length-1),c));
  return gr;
}

/* Draw a scene at (tx,ty) with a uniform scale. */
function drawScene(ctx,scene,scale,tx,ty){
  ctx.save();ctx.translate(tx||0,ty||0);ctx.scale(scale,scale);
  const cache={};
  const fs=id=>cache[id]||(cache[id]=style(ctx,scene.fills[id]));
  for(const it of scene.items){
    if(it.k==='logo'){
      ctx.save();ctx.beginPath();rp(ctx,it.x,it.y,it.w,it.h,it.r);ctx.clip();
      ctx.drawImage(it.img,it.x,it.y,it.w,it.h);ctx.restore();continue;
    }
    ctx.fillStyle=fs(it.f);
    if(it.k==='rect')ctx.fillRect(it.x,it.y,it.w,it.h);
    else if(it.k==='rrect'){ctx.beginPath();rp(ctx,it.x,it.y,it.w,it.h,it.r);ctx.fill();}
    else if(it.k==='circle'){ctx.beginPath();ctx.arc(it.cx,it.cy,it.r,0,Math.PI*2);ctx.fill();}
    else if(it.k==='ring'){
      ctx.beginPath();rp(ctx,it.outer.x,it.outer.y,it.outer.w,it.outer.h,it.outer.r);
      rp(ctx,it.inner.x,it.inner.y,it.inner.w,it.inner.h,it.inner.r);ctx.fill('evenodd');
    }else if(it.k==='text'){
      ctx.font=`${it.weight} ${it.size}px ${fontStack(it.font)}`;
      ctx.textAlign=it.align;ctx.textBaseline='alphabetic';
      if(it.spacing&&'letterSpacing' in ctx)ctx.letterSpacing=(it.spacing*it.size)+'px';
      ctx.fillText(it.text,it.x,it.y);
      if('letterSpacing' in ctx)ctx.letterSpacing='0px';
    }
  }
  ctx.restore();
}
function sceneToCanvas(scene,scale,canvas){
  const cv=canvas||document.createElement('canvas');
  cv.width=Math.max(1,Math.round(scene.W*scale));cv.height=Math.max(1,Math.round(scene.H*scale));
  const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
  drawScene(ctx,scene,cv.width/scene.W,0,0);
  return cv;
}
const toBlob=(cv,type)=>new Promise(res=>cv.toBlob(res,type||'image/png'));

/* ---------- images ---------- */
const imgCache=new Map();
function loadImage(src){
  if(imgCache.has(src))return imgCache.get(src);
  const p=new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Image failed to load'));i.src=src;});
  imgCache.set(src,p);
  if(imgCache.size>20)imgCache.delete(imgCache.keys().next().value);
  return p;
}
/* Returns {img,src}; src is a data URL of the (optionally inverted) icon. */
async function prepareLogo(b64,invert){
  if(!b64)return null;
  const img=await loadImage(b64);
  if(!invert)return{img,src:b64};
  const w=img.naturalWidth||200,h=img.naturalHeight||200;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const x=c.getContext('2d');x.drawImage(img,0,0);
  const d=x.getImageData(0,0,w,h);
  for(let i=0;i<d.data.length;i+=4){d.data[i]=255-d.data[i];d.data[i+1]=255-d.data[i+1];d.data[i+2]=255-d.data[i+2];}
  x.putImageData(d,0,0);
  const src=c.toDataURL('image/png');
  return{img:await loadImage(src),src};
}
/* Shrink an uploaded image so saved designs stay small. */
function compressImage(img,max){
  const m=max||256,s=Math.min(1,m/Math.max(img.naturalWidth||200,img.naturalHeight||200));
  const c=document.createElement('canvas');
  c.width=Math.round((img.naturalWidth||200)*s);c.height=Math.round((img.naturalHeight||200)*s);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/png');
}
/* Raw RGB and alpha planes for PDF embedding. */
function imagePixels(img){
  const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const x=c.getContext('2d');x.drawImage(img,0,0);
  const d=x.getImageData(0,0,w,h).data;
  const rgb=new Uint8Array(w*h*3),a=new Uint8Array(w*h);
  for(let i=0,j=0,k=0;i<d.length;i+=4,j+=3,k++){rgb[j]=d[i];rgb[j+1]=d[i+1];rgb[j+2]=d[i+2];a[k]=d[i+3];}
  return{w,h,rgb,alpha:a};
}

Object.assign(QF,{drawScene,sceneToCanvas,toBlob,loadImage,prepareLogo,compressImage,imagePixels,fontStack});
})();
