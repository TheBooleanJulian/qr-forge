/* QR Forge export helpers (browser): file names, PNG/SVG/PDF blobs, downloads. */
(function(){
const QF=globalThis.QF=globalThis.QF||{};

const pad2=n=>String(n).padStart(2,'0');
function stamp(d){d=d||new Date();return`${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;}
/* qr-forge_[design-name]_[timestamp] */
function fileBase(name){return`qr-forge_${QF.slug(name||'')||'untitled'}_${stamp()}`;}
const MAX_SIDE=8000,MAX_PIXELS=50e6;

async function pngBlob(scene,targetWidth){
  let s=targetWidth/scene.W;
  s=Math.min(s,MAX_SIDE/Math.max(scene.W,scene.H),Math.sqrt(MAX_PIXELS/(scene.W*scene.H)));
  const cv=QF.sceneToCanvas(scene,Math.max(.1,s));
  return QF.toBlob(cv,'image/png');
}
const svgBlob=(scene,title)=>new Blob([QF.sceneToSVG(scene,{title})],{type:'image/svg+xml'});
const pdfBlob=(scene,o)=>new Blob([QF.qrPDF(scene,o)],{type:'application/pdf'});

function download(blob,filename){
  const a=document.createElement('a'),url=URL.createObjectURL(blob);
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);
}
const blobBytes=async b=>new Uint8Array(await b.arrayBuffer());

Object.assign(QF,{stamp,fileBase,pngBlob,svgBlob,pdfBlob,download,blobBytes});
})();
