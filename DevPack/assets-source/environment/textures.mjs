// Original seeded pixel patterns. No image downloads or generative-media service.
import { deflateSync } from 'node:zlib';
const crc32=(data)=>{let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const t=Buffer.from(type);const h=Buffer.alloc(4);h.writeUInt32BE(data.length);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([h,t,data,c]);};
export function texture(name,size) {
  const rgba=Buffer.alloc(size*(1+size*4));
  const noise=(x,y)=>{let n=Math.imul(x+91,374761393)^Math.imul(y+27,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const n=noise(x,y)-.5;let c;
    if(name==='plaster') c=[237,230,214].map(v=>v+n*9);
    else if(name==='stone') {const gap=x%64<2||y%32<2; const grain=noise(Math.floor(x/64),Math.floor(y/32))*13;
      c=(gap?[167,157,140]:[218+grain,208+grain,185+grain]).map(v=>v+n*10);}
    else if(name==='paving') {const tile=16,xx=x%tile,yy=y%tile;
      const wave=Math.sin(x/size*Math.PI*4)*size*.1;const stripe=(y+wave+size)%size<size*.16;
      const base=stripe?66:210; const shade=noise(Math.floor(x/tile),Math.floor(y/tile))*18;
      const gap=xx<1||yy<1;c=[base+shade,base+shade-3,base+shade-9].map(v=>v+n*15-(gap?26:0));}
    else if(name==='tile') {const xx=(x%64)/64-.5,yy=(y%64)/64-.5,r=Math.hypot(xx,yy);
      const blue=(Math.abs(Math.abs(xx)+Math.abs(yy)-.42)<.045)||(r<.11)||(Math.abs(xx)<.035&&Math.abs(yy)<.32)||(Math.abs(yy)<.035&&Math.abs(xx)<.32);
      c=(blue?[36,82,122]:[236,237,216]).map(v=>v+n*7);if(x%64<2||y%64<2)c=[191,189,171];}
    else if(name==='roof') {const row=Math.floor(y/32),xx=(x+row*8)%32;const ridge=17*Math.cos(xx/32*Math.PI*2);
      c=[181+ridge,91+ridge*.7,54+ridge*.5].map(v=>v+n*14-(y%32<2?22:0));}
    else {c=[80,83,80].map(v=>v+n*19);}
    const o=y*(1+size*4)+1+x*4;for(let i=0;i<3;i++)rgba[o+i]=Math.round(Math.max(0,Math.min(255,c[i])));rgba[o+3]=255;
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rgba,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
