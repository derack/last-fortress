// Small deterministic seamless PBR texture authoring. PNGs are embedded in the
// glTF so Android/Web builds never need extra texture requests.
const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n=0;n<256;n++) { let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1); table[n]=c>>>0; }
  return table;
})();
function pngCrc32(buf) {
  let c=0xffffffff;
  for(const b of buf) c=PNG_CRC_TABLE[(c^b)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
function pngChunk(type,data) {
  const name=Buffer.from(type), out=Buffer.alloc(12+data.length);
  out.writeUInt32BE(data.length,0); name.copy(out,4); data.copy(out,8);
  out.writeUInt32BE(pngCrc32(Buffer.concat([name,data])),8+data.length);
  return out;
}
function encodePng(width,height,rgba) {
  const rows=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++) {
    const off=y*(width*4+1); rows[off]=0;
    Buffer.from(rgba.buffer,rgba.byteOffset+y*width*4,width*4).copy(rows,off+1);
  }
  const header=Buffer.alloc(13);
  header.writeUInt32BE(width,0); header.writeUInt32BE(height,4);
  header[8]=8; header[9]=6; header[10]=0; header[11]=0; header[12]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',zlib.deflateSync(rows,{level:9})),pngChunk('IEND',Buffer.alloc(0))]);
}
function makePbrImages(baseColor,accent,style,category='enemies') {
  // Build-specific, seamless material atlases: each surface gets its own
  // albedo; normal/MR/AO maps are shared per character to keep memory bounded.
  // Desktop keeps richer textures; the mobile tier was raised from 192/96px to
  // 384/192px (4x texels per surface) after user feedback that units read as
  // blurry on Android. Emissive maps use a 128px mobile tier / 256px desktop.
  const mobileProfile = process.env.CAP_BUILD === '1' || process.env.ASSET_TEXTURE_PROFILE === 'mobile';
  const isLargeAsset = category === 'heroes' || category === 'bosses';
  // High-detail desktop/web tier: 640px hero/boss atlases and 256px standard
  // units. Mobile: 384px hero/boss + 192px standard — sharp enough at typical
  // phone viewing distance while staying within decoded-GPU memory budgets.
  const size = mobileProfile ? (isLargeAsset ? 384 : 192) : (isLargeAsset ? 640 : 256);
  const emissiveSize = mobileProfile ? 128 : 256;
  const albedos=Array.from({length:5},()=>new Uint8Array(size*size*4));
  const normal=new Uint8Array(size*size*4), mr=new Uint8Array(size*size*4);
  const ao=new Uint8Array(size*size*4), emissive=new Uint8Array(emissiveSize*emissiveSize*4);
  const tau=Math.PI*2;
  const periodic=(x,y,fx,fy,phase=0)=>
    Math.sin(x/size*tau*fx+phase)*Math.cos(y/size*tau*fy-phase*.7);
  const isMetal=/machine|tank|lord|warrior|hunter|ranger|brute|annihilator/i.test(style);
  const isStone=/golem|crystal|tank|giant/i.test(style);
  const isCloth=/cloth|wraith|mage|spirit|summoner/i.test(style);
  const heightAt=(x,y)=>{
    const broad=periodic(x,y,3,4,.7)*.52+periodic(x,y,5,3,1.8)*.28+periodic(x,y,8,7,2.4)*.14;
    const medium=periodic(x,y,17,13,1.2)*.045+periodic(x,y,23,19,.4)*.028;
    const micro=periodic(x,y,47,31,.9)*.012+periodic(x,y,61,53,2.1)*.008
      +periodic(x,y,83,71,1.1)*.004+periodic(x,y,97,89,2.7)*.003;
    const brushed=isMetal?Math.sin(y/size*tau*92+Math.sin(x/size*tau*7)*.12)*.026
      +Math.sin(y/size*tau*147+Math.sin(x/size*tau*11)*.08)*.009:0;
    const scales=isStone?Math.pow(Math.max(0,Math.cos(x/size*tau*11+Math.sin(y/size*tau*5)*.42)),18)*.11
      +Math.pow(Math.max(0,Math.cos(x/size*tau*19+Math.sin(y/size*tau*9)*.28)),22)*.035:0;
    const weave=isCloth?periodic(x,y,29,37,.3)*.05+periodic(x,y,59,53,1.4)*.018:0;
    return broad*.13+medium+micro+brushed+scales+weave;
  };
  const color=n=>Math.max(0,Math.min(255,Math.round(n)));
  const profileShade=(profile,x,y,h,broad,plate)=>{
    const scratch=Math.pow(Math.max(0,Math.sin(x/size*tau*37+Math.sin(y/size*tau*9)*.3)),18)
      *(.5+.5*Math.cos(y/size*tau*5));
    const fineScratch=Math.pow(Math.max(0,Math.sin(x/size*tau*113+Math.sin(y/size*tau*17)*.22)),22)
      *(.5+.5*Math.cos(y/size*tau*13));
    const brushed=.5+.5*Math.sin(y/size*tau*88+Math.sin(x/size*tau*5)*.12);
    const weave=(.5+.5*Math.sin(x/size*tau*36))*(.5+.5*Math.sin(y/size*tau*44));
    const seam=Math.pow(Math.max(0,Math.cos(x/size*tau*8+Math.sin(y/size*tau*3)*.25)),48);
    const cracks=Math.pow(Math.max(0,Math.sin((x+y)/size*tau*13+periodic(x,y,3,4,.2))),12);
    if(profile===0) return Math.max(.68,Math.min(1.16,.91+h*1.5+broad*.025+plate*.055-seam*.085+scratch*.045+fineScratch*.018));
    if(profile===1) return Math.max(.72,Math.min(1.2,.96+h*1.2+brushed*.055+scratch*.07+fineScratch*.025));
    if(profile===2) return Math.max(.68,Math.min(1.14,.88+h*1.4+weave*.045+periodic(x,y,23,29,.4)*.025+fineScratch*.012));
    if(profile===3) return Math.max(.78,Math.min(1.2,.96+h*.9+cracks*.09+periodic(x,y,5,7,.7)*.025));
    return Math.max(.68,Math.min(1.08,.83+h*1.6+scratch*.035-seam*.025));
  };
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const i=(y*size+x)*4, h=heightAt(x,y);
    const broad=periodic(x,y,3,4,.7)*.52+periodic(x,y,5,3,1.8)*.28+periodic(x,y,8,7,2.4)*.14;
    const plate=Math.pow(Math.max(0,Math.cos(x/size*tau*11+Math.sin(y/size*tau*5)*.42)),18);
    for(let profile=0;profile<5;profile++) {
      const shade=profileShade(profile,x,y,h,broad,plate);
      const o=albedos[profile];
      o[i]=o[i+1]=o[i+2]=color(shade*255);o[i+3]=255;
    }
    const dx=(heightAt((x+1)%size,y)-heightAt((x+size-1)%size,y))*.5;
    const dy=(heightAt(x,(y+1)%size)-heightAt(x,(y+size-1)%size))*.5;
    let nx=-dx*8,ny=-dy*8,nz=1,len=Math.hypot(nx,ny,nz);
    normal[i]=color((nx/len*.5+.5)*255);
    normal[i+1]=color((ny/len*.5+.5)*255);
    normal[i+2]=color((nz/len*.5+.5)*255);normal[i+3]=255;
    mr[i]=255;
    // glTF MR convention: G=roughness, B=metalness.
    mr[i+1]=color(Math.max(96,Math.min(248,(isMetal?112:isStone?198:226)+h*120+broad*8)));
    mr[i+2]=color(Math.max(0,Math.min(255,(isMetal?226:isStone?38:12)+plate*22+h*80)));
    mr[i+3]=255;
    // Seamless cavity shading; no border darkening, so repeated tiles do not show seams.
    const cavity=Math.max(.76,Math.min(1,.96-Math.max(0,.1-h)*.35+Math.abs(broad)*.025));
    ao[i]=ao[i+1]=ao[i+2]=color(cavity*255);ao[i+3]=255;
  }
  const accentRgb=[(accent>>16)&255,(accent>>8)&255,accent&255];
  for(let y=0;y<emissiveSize;y++) for(let x=0;x<emissiveSize;x++) {
    const i=(y*emissiveSize+x)*4;
    const pulse=.84+.16*(.5+.5*Math.sin(x/emissiveSize*tau*7+Math.sin(y/emissiveSize*tau*5)));
    for(let c=0;c<3;c++) emissive[i+c]=color((accentRgb[c]/255)*pulse*255);
    emissive[i+3]=255;
  }
  return [
    ...albedos.map(map=>encodePng(size,size,map)),
    encodePng(size,size,normal),encodePng(size,size,mr),
    encodePng(size,size,ao),encodePng(emissiveSize,emissiveSize,emissive)
  ];
}
