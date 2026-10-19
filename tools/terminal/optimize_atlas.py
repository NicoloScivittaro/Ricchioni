"""Texture-preserving spatial atlas batches for Terminal's local FPS renderer.
Repeat UVs stay in a shader; no geometry subdivision, no enormous global merge.
Hero aircraft/sign textures keep up to 1024; remaining source colours up to 512.
"""
from pathlib import Path
from collections import defaultdict
import numpy as np,json,copy,io
from PIL import Image
from prepare_arena import ROOT,OUT,read,access,world,Packed

def run():
 d,b=read();out=Packed(d);out.d['materials']=[];out.d['images']=[];out.d['textures']=[];out.d['extensionsUsed']=[]
 # Deterministic substitutions from available source textures, documented as
 # replacements, never as recovered original material descriptors.
 mats=copy.deepcopy(d['materials']);byname={m['name']:m for m in d['materials']};substitutions={}
 for m in mats:
  name=m['name'];alternate=None;tint=[1,1,1,1]
  if 'missingSourceMaterial'not in m.get('extras',{}):continue
  if 'wall'in name:alternate='office_whitewall_01';tint=[.88,.83,.71,1]if'tan'in name else[.6,.72,.81,1]if'blue'in name else[.8,.8,.79,1]
  elif any(s in name for s in ['floor','tile','carpet']):alternate='marble_floor_tiles_02'if'carpet'not in name else'ap_interior_plastic_tile';tint=[.52,.3,.24,1]if'red'in name else[.78,.78,.72,1]
  elif any(s in name for s in ['metal','chrome','beam','stairs','panel']):alternate='metal_aluminum01'
  elif any(s in name for s in ['concrete','ceiling','plaster']):alternate='concrete_grey02'
  if alternate:m['pbrMetallicRoughness']=copy.deepcopy(byname[alternate]['pbrMetallicRoughness']);m['pbrMetallicRoughness']['baseColorFactor']=tint;substitutions[name]=alternate
 images={};records={};pools=defaultdict(list)
 for i,m in enumerate(mats):
  p=m.get('pbrMetallicRoughness',{});tex=p.get('baseColorTexture',{}).get('index');imageindex=d['textures'][tex]['source']if tex is not None else None
  mode=m.get('alphaMode','OPAQUE');role=mode if mode=='BLEND'else'MASK'if mode=='MASK'else'OPAQUE'
  name=m['name'];hero=any(s in name for s in ['727','cockpit','airplane','aluminum01','sign','bookstore','aircraft','ap_door','ap_windows'])
  size=1024 if hero else 512;key=(imageindex,size,role)
  if key not in images:
   if imageindex is None:im=Image.new('RGBA',(8,8),(255,255,255,255))
   else:
    v=d['bufferViews'][d['images'][imageindex]['bufferView']];im=Image.open(io.BytesIO(b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGBA')
   images[key]=im;pools[(size,role)].append(key)
  records[i]={'key':key,'color':p.get('baseColorFactor',[1,1,1,1]),'flag':(2 if'KHR_materials_unlit'in m.get('extensions',{})else 0)+(.5 if mode=='MASK'else 0)}
 atlas={};layouts=[];pad=8
 for (size,mode),keys in pools.items():
  grid=4 if size==1024 else 8;stride=size+pad*2
  for start in range(0,len(keys),grid*grid):
   subset=keys[start:start+grid*grid];canvas=Image.new('RGBA',(grid*stride,grid*stride),(255,255,255,0 if mode!='OPAQUE'else 255));atlasid=len(layouts)
   for tile,key in enumerate(subset):
    im=images[key].resize((size,size),Image.Resampling.LANCZOS);x=(tile%grid)*stride;y=(tile//grid)*stride
    # Repeat gutters on all sides, keeping distant mip samples within the tile.
    arr=np.array(im);arr=np.pad(arr,((pad,pad),(pad,pad),(0,0)),mode='wrap');canvas.paste(Image.fromarray(arr),(x,y));atlas[key]=(atlasid,tile)
   blob=io.BytesIO()
   if mode=='OPAQUE':canvas.convert('RGB').save(blob,format='JPEG',quality=91);mime='image/jpeg'
   else:canvas.save(blob,format='PNG',compress_level=5);mime='image/png'
   vi=out.view(blob.getvalue());out.d['images'].append({'bufferView':vi,'mimeType':mime,'name':f'terminal-atlas-{atlasid}'});out.d['textures'].append({'source':atlasid,'sampler':0})
   layout={'grid':grid,'size':size,'padding':pad,'mode':mode,'tiles':len(subset)};layouts.append(layout)
   out.d['materials'].append({'name':f'terminal-atlas-{atlasid}','doubleSided':True,'alphaMode':mode,'pbrMetallicRoughness':{'baseColorTexture':{'index':atlasid},'metallicFactor':0,'roughnessFactor':.9},'extras':{'terminalAtlas':layout}})
 def attrs(pr,positions=None,verts=None):
  data={k:access(d,b,a)for k,a in pr['attributes'].items()};count=len(data['POSITION']);rec=records[pr['material']];ai,tile=atlas[rec['key']]
  colors=data.get('COLOR_0',np.ones((count,4))).copy()*rec['color'];colors[:,3]=1
  data['COLOR_0']=colors;data['TEXCOORD_1']=np.tile([tile,rec['flag']],(count,1))
  if positions is not None:data['POSITION']=positions
  if verts is not None:data={k:v[verts]for k,v in data.items()}
  return ai,data
 def merge(parts):
  # All input surfaces carry the same standard attributes after padding colours.
  attributes={k:np.concatenate([a[k]for a,_ in parts])for k in parts[0][0]};ix=[];offset=0
  for a,i in parts:ix.append(i+offset);offset+=len(a['POSITION'])
  return{'attributes':{k:out.acc(v)for k,v in attributes.items()},'indices':out.acc(np.concatenate(ix),True),'mode':4}
 groups=defaultdict(list);meshcache={};root=np.array(d['nodes'][0]['translation']);models=0;tris=0
 for node in d['nodes']:
  if'mesh'not in node:continue
  mesh=d['meshes'][node['mesh']]
  if node['name'].startswith('map/'):
   for pr in mesh['primitives']:
    ps=world(d,b,node,pr);ix=access(d,b,pr['indices']).reshape(-1,3);ts=ps[ix];lo=ts.min(1);hi=ts.max(1);ix=ix[(hi[:,0]>-100)&(lo[:,0]<65)&(hi[:,2]>-95)&(lo[:,2]<110)]
    keys=np.floor(ps[ix].mean(1)[:,[0,2]]/16).astype(int)
    for key in np.unique(keys,axis=0):
     sub=ix[np.all(keys==key,axis=1)];verts,indices=np.unique(sub.flatten(),return_inverse=True);ai,a=attrs(pr,ps,verts);groups[(ai,*key)].append((a,indices));tris+=len(indices)//3
  else:
   ps=np.concatenate([world(d,b,node,pr)for pr in mesh['primitives']]);lo=ps.min(0);hi=ps.max(0)
   if hi[0]<-100 or lo[0]>65 or hi[2]<-95 or lo[2]>110:continue
   mi=node['mesh']
   if mi not in meshcache:
    batches=defaultdict(list)
    for pr in mesh['primitives']:
     ai,a=attrs(pr);batches[ai].append((a,access(d,b,pr['indices']).flatten()))
    prims=[]
    for ai,parts in batches.items():pr=merge(parts);pr['material']=ai;prims.append(pr)
    meshcache[mi]=len(out.d['meshes']);out.d['meshes'].append({'name':mesh['name'],'primitives':prims})
   nn=copy.deepcopy(node);nn['mesh']=meshcache[mi];m=np.array(nn.get('matrix',np.eye(4).T.flatten())).reshape(4,4).T;m[:3,3]+=root;nn['matrix']=m.T.flatten().tolist();out.d['nodes'][0]['children'].append(len(out.d['nodes']));out.d['nodes'].append(nn);models+=1;tris+=sum(d['accessors'][p['indices']]['count']//3 for p in mesh['primitives'])
 for (ai,cx,cz),parts in groups.items():
  pr=merge(parts);pr['material']=ai;name=f'terminalZone/{cx}/{cz}/{ai}';out.d['meshes'].append({'name':name,'primitives':[pr]});out.d['nodes'][0]['children'].append(len(out.d['nodes']));out.d['nodes'].append({'name':name,'mesh':len(out.d['meshes'])-1})
 (ROOT/'public/assets/fps/terminal/atlas.json').write_text(json.dumps(layouts),encoding='utf8')
 size=out.save();report={'sourceBytes':114097536,'optimizedBytes':size,'spatialBatches':len(groups),'modelInstances':models,'trianglesWithInstances':tris,'atlasLayouts':layouts,'sharedMaterials':len(layouts),'spatialMeters':16,'originalConversionPreserved':True,'materialSubstitutions':substitutions};(OUT/'optimization.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report))
if __name__=='__main__':run()
