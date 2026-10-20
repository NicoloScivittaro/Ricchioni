"""Optimize only supplied runtime GLB copies; preserve geometry, rigs, original metadata and alpha."""
import pathlib,json,struct,io
from PIL import Image,ImageEnhance,ImageOps,ImageFilter
import numpy as np
root=pathlib.Path(__file__).resolve().parents[1];out=root/'public/assets/backrooms';report=[];credits=[]
for p in out.glob('*.glb'):
 source=pathlib.Path.home()/'Downloads'/p.name;b=source.read_bytes();n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);binary=b[28+n:];images={};sizes=[]
 for im in g.get('images',[]):
  if 'bufferView'not in im:continue
  vi=im['bufferView'];v=g['bufferViews'][vi];data=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];pic=Image.open(io.BytesIO(data));old=pic.size
  pic.thumbnail((1024,1024),Image.Resampling.LANCZOS);buf=io.BytesIO();alpha='A'in pic.getbands() or 'transparency'in pic.info
  if alpha:pic.convert('RGBA').save(buf,format='PNG',optimize=True);im['mimeType']='image/png'
  else:pic.convert('RGB').save(buf,format='JPEG',quality=88,optimize=True);im['mimeType']='image/jpeg'
  images[vi]=buf.getvalue();sizes.append({'original':old,'runtime':pic.size})
 if p.stem=='original_backrooms':
  for idx,key,box,brightness in [(2,'wall',(.845,.29,.965,.64),2.1),(3,'carpet',(.18,.68,.70,.90),2.0)]:
   v=g['bufferViews'][g['images'][idx]['bufferView']];raw=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];pic=Image.open(io.BytesIO(raw)).convert('RGB');w,h=pic.size
   crop=pic.crop(tuple(int(t*(w if j%2==0 else h))for j,t in enumerate(box))).resize((256,256),Image.Resampling.LANCZOS);
   if key=='wall':
    # Remove baked large-scale lighting before repeating the authored wallpaper pattern.
    a=np.array(crop).astype(float);illum=np.array(crop.filter(ImageFilter.GaussianBlur(14))).astype(float)
    crop=Image.fromarray(np.clip((a+1)/(illum+1)*illum.mean(axis=(0,1)),0,255).astype('uint8'))
   crop=ImageEnhance.Brightness(crop).enhance(brightness)
   if key=='carpet':
    a=np.array(crop).astype(float);a+=np.random.default_rng(174).normal(0,3,a.shape[:2])[:,:,None];crop=Image.fromarray(np.clip(a,0,255).astype('uint8'))
   tile=Image.new('RGB',(512,512));tile.paste(crop,(0,0));tile.paste(ImageOps.mirror(crop),(256,0));tile.paste(ImageOps.flip(crop),(0,256));tile.paste(ImageOps.flip(ImageOps.mirror(crop)),(256,256));tile.save(out/f'original-{key}-tile.jpg',quality=92)
 packed=bytearray()
 for i,v in enumerate(g.get('bufferViews',[])):
  data=images.get(i,binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]);packed.extend(b'\0'*((-len(packed))%4));v['byteOffset']=len(packed);v['byteLength']=len(data);packed.extend(data)
 g['buffers'][0]['byteLength']=len(packed);packed.extend(b'\0'*((-len(packed))%4));j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);result=struct.pack('<4sII',b'glTF',2,28+len(j)+len(packed))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(packed),0x004e4942)+packed;p.write_bytes(result)
 extra=g['asset'].get('extras',{});credits.append(f"- **{extra.get('title',p.stem)}** — {extra.get('author','See original GLB metadata')}. {extra.get('license','See original metadata')}.\n  {extra.get('source','')}\n  Original file: `{p.name}`. Runtime textures limited to 1024px; geometry/rig retained.")
 row={'file':p.name,'originalBytes':len(b),'runtimeBytes':len(result),'textures':sizes};report.append(row);print(p.name,round(len(b)/1048576,2),'->',round(len(result)/1048576,2),'MiB')
(out/'CREDITS.md').write_text('# Backrooms asset credits\n\n'+'\n\n'.join(credits)+'\n\nThe modular wallpaper/carpet tiles are derived from the Original Backrooms texture atlas; baked wall illumination is normalized for tiling. Original downloads are unchanged. No commercial rights or publication authorization inferred.\n',encoding='utf8');(root/'docs/agent-work/backrooms-2/optimization.json').write_text(json.dumps(report,indent=2),encoding='utf8')
