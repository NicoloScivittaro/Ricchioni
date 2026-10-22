// Ferro 2.1 asset step: re-encode the textures embedded in a GLB (ffmpeg), geometry/materials/metadata untouched.
// node tools/ferro/optimize-glb.mjs <in.glb> <out.glb> <maxSize> [extras-json]
// Images used as emissive or with alpha stay PNG; the others become high quality JPEG.
import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{tmpdir}from'node:os';
import{join}from'node:path';
const[input,output,max='1024',extra]=process.argv.slice(2);
const glb=readFileSync(input),jsonLength=glb.readUInt32LE(12),json=JSON.parse(glb.subarray(20,20+jsonLength).toString()),bin=glb.subarray(28+jsonLength);
const keepPng=new Set();for(const m of json.materials??[]){if(m.emissiveTexture)keepPng.add(json.textures[m.emissiveTexture.index].source);if(m.alphaMode&&m.alphaMode!=='OPAQUE'&&m.pbrMetallicRoughness?.baseColorTexture)keepPng.add(json.textures[m.pbrMetallicRoughness.baseColorTexture.index].source);}
const dir=mkdtempSync(join(tmpdir(),'ferro-glb-')),views=json.bufferViews.map((v,i)=>({view:v,data:bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength),i}));
try{
 for(const[index,image]of(json.images??[]).entries()){
  const entry=views[image.bufferView],png=keepPng.has(index),source=join(dir,`in${index}.${image.mimeType==='image/png'?'png':'jpg'}`),target=join(dir,`out${index}.${png?'png':'jpg'}`);
  writeFileSync(source,entry.data);
  execFileSync('ffmpeg',['-loglevel','error','-y','-i',source,'-vf',`scale='min(${max},iw)':'min(${max},ih)'`,...(png?['-compression_level','9']:['-q:v','3']),target]);
  const data=readFileSync(target);if(data.length<entry.data.length){entry.data=data;image.mimeType=png?'image/png':'image/jpeg';}
 }
 // Rebuild the single binary chunk with 4-byte aligned views.
 const parts=[];let offset=0;for(const entry of views){const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}entry.view.byteOffset=offset;entry.view.byteLength=entry.data.length;parts.push(entry.data);offset+=entry.data.length;}
 const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}json.buffers=[{byteLength:offset}];
 if(extra)json.asset.extras={...json.asset.extras,...JSON.parse(extra)};
 let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,0x20)]);
 const header=Buffer.alloc(12),jsonHeader=Buffer.alloc(8),binHeader=Buffer.alloc(8),total=12+8+text.length+8+offset;
 header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(total,8);jsonHeader.writeUInt32LE(text.length,0);jsonHeader.writeUInt32LE(0x4e4f534a,4);binHeader.writeUInt32LE(offset,0);binHeader.writeUInt32LE(0x004e4942,4);
 writeFileSync(output,Buffer.concat([header,jsonHeader,text,binHeader,...parts]));
 console.log(`${input} ${glb.length} -> ${output} ${total} bytes`);
}finally{rmSync(dir,{recursive:true,force:true});}
