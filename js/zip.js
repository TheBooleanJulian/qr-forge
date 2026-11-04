/* QR Forge ZIP writer (stored, no compression) and CRC32. PNGs are already compressed. */
(function(){
const QF=globalThis.QF=globalThis.QF||{};

let T=null;
function crc32(u8){
  if(!T){T=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;T[n]=c>>>0;}}
  let c=0xFFFFFFFF;
  for(let i=0;i<u8.length;i++)c=T[(c^u8[i])&0xFF]^(c>>>8);
  return(c^0xFFFFFFFF)>>>0;
}
/* files: [{name:string, data:Uint8Array}] -> Uint8Array */
function zip(files){
  const enc=new TextEncoder(),d=new Date();
  const time=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1);
  const date=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  const parts=[],central=[];let off=0;
  const u16=v=>[v&255,(v>>8)&255],u32=v=>[v&255,(v>>8)&255,(v>>16)&255,(v>>>24)&255];
  for(const f of files){
    const name=enc.encode(f.name),crc=crc32(f.data),size=f.data.length;
    const head=new Uint8Array([0x50,0x4b,3,4,...u16(20),...u16(0x0800),...u16(0),...u16(time),...u16(date),...u32(crc),...u32(size),...u32(size),...u16(name.length),...u16(0)]);
    parts.push(head,name,f.data);
    central.push(new Uint8Array([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(time),...u16(date),...u32(crc),...u32(size),...u32(size),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),name);
    off+=head.length+name.length+size;
  }
  let csize=0;central.forEach(c=>csize+=c.length);
  const eocd=new Uint8Array([0x50,0x4b,5,6,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(csize),...u32(off),...u16(0)]);
  const all=parts.concat(central,[eocd]);
  let total=0;all.forEach(p=>total+=p.length);
  const out=new Uint8Array(total);let o=0;all.forEach(p=>{out.set(p,o);o+=p.length;});
  return out;
}
Object.assign(QF,{crc32,zip});
})();
