"""Texture-preserving spatial atlas batches for Terminal's local FPS renderer.
Repeat UVs stay in a shader; no geometry subdivision, no enormous global merge.
Hero aircraft/sign textures keep up to 1024; remaining source colours up to 512.
"""
from pathlib import Path
from collections import defaultdict
import numpy as np,json,copy,io,math
from PIL import Image
from prepare_arena import ROOT,read,access,world,Packed
OUT=ROOT/'docs/agent-work/terminal-2-2';OUT.mkdir(exist_ok=True)

def run():
 d,b=read();out=Packed(d);out.d['materials']=[];out.d['images']=[];out.d['textures']=[];out.d['extensionsUsed']=[]
 # Deterministic substitutions from available source textures, documented as
 # replacements, never as recovered original material descriptors.
 mats=copy.deepcopy(d['materials']);byname={m['name']:m for m in d['materials']};substitutions={}
 for m in mats:
  name=m['name'];alternate=None;tint=[1,1,1,1]
  # Some descriptors exist but their colour IWI is absent. These targeted
  # mechanical/plastic surfaces need a real recovered texture too.
  repairs={'ch_trim_stainlessteel_1':('metal_aluminum01',[.67,.7,.73,1]),
   'me_trim_metalplate_1':('metal_aluminum01',[.48,.52,.56,1]),
   'me_metal_grey_01':('metal_aluminum01',[.55,.58,.61,1]),
   'ch_countertop_sidetrim':('metal_aluminum01',[.62,.65,.68,1]),
   'ap_compartment_trim':('mtl_airplane_window_clean',[.82,.84,.85,1]),
   'ap_compartment_side_trim':('mtl_airplane_window_clean',[.75,.78,.8,1]),
   'ap_interior_plastic_trim':('mtl_airplane_window_clean',[.8,.82,.83,1]),
   'ap_interior_plastic_tile':('mtl_airplane_window_clean',[.7,.73,.75,1]),
   'icbm_missilebody':('metal_aluminum01',[.54,.58,.62,1]),
   'icbm_braidedhose':('metal_aluminum01',[.26,.28,.3,1])}
  if name in repairs and 'baseColorTexture'not in m['pbrMetallicRoughness']:
   alternate,tint=repairs[name]
   m['pbrMetallicRoughness']=copy.deepcopy(byname[alternate]['pbrMetallicRoughness']);m['pbrMetallicRoughness']['baseColorFactor']=tint;substitutions[name]=alternate
   continue
  if 'missingSourceMaterial'not in m.get('extras',{}):continue
  if 'wall'in name:alternate='office_whitewall_01';tint=[.88,.83,.71,1]if'tan'in name else[.6,.72,.81,1]if'blue'in name else[.8,.8,.79,1]
  elif any(s in name for s in ['floor','tile','carpet']):alternate='marble_floor_tiles_02'if'carpet'not in name else'ap_interior_plastic_tile';tint=[.52,.3,.24,1]if'red'in name else[.78,.78,.72,1]
  elif any(s in name for s in ['metal','chrome','beam','stairs','panel']):alternate='metal_aluminum01'
  elif any(s in name for s in ['concrete','ceiling','plaster']):alternate='concrete_grey02'
  # Targeted repairs on playable interior surfaces, using already recovered textures.
  if name in ('me_office_ceiling_tiles','me_office_ceiling_tiles_black'):
   alternate='concrete_grey02';tint=[.72,.74,.75,1]if name.endswith('tiles')else[.32,.34,.35,1]
  if name=='ap_interior_carpet':alternate='ap_interior_plastic_tile';tint=[.38,.42,.45,1]
  if name.startswith(('me_decal_','icbm_decal_','ch_dec_','me_dec_'))or name in ('me_office_ceiling_light_2_effect','me_ground_drygrass_dec','kh_tarmac_trim1','me_oilstain'):
   m['alphaMode']='BLEND';m['pbrMetallicRoughness']['baseColorFactor']=[.65,.64,.6,.16];alternate=None
  if name in ('com_glass_clear','window_stain'):
   m['alphaMode']='BLEND';m['pbrMetallicRoughness']['baseColorFactor']=[.65,.79,.84,.22]
  if alternate:m['pbrMetallicRoughness']=copy.deepcopy(byname[alternate]['pbrMetallicRoughness']);m['pbrMetallicRoughness']['baseColorFactor']=tint;substitutions[name]=alternate
 # Reuse the recovered aluminium on the small visible boarding-step repair.
 texture=byname['metal_aluminum01']['pbrMetallicRoughness']['baseColorTexture']['index'];source=d['textures'][texture]['source'];view=d['bufferViews'][d['images'][source]['bufferView']]
 boarding=Image.open(io.BytesIO(b[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])).convert('RGB');boarding.thumbnail((512,512),Image.Resampling.LANCZOS);boarding.save(ROOT/'public/assets/fps/terminal/boarding-metal.jpg',quality=90)
 images={};records={};pools=defaultdict(list)
 for i,m in enumerate(mats):
  p=m.get('pbrMetallicRoughness',{});tex=p.get('baseColorTexture',{}).get('index');imageindex=d['textures'][tex]['source']if tex is not None else None
  mode=m.get('alphaMode','OPAQUE');role='MULTIPLY'if'multiply'in m.get('extras',{}).get('sourceTechset','')else mode if mode=='BLEND'else'MASK'if mode=='MASK'else'OPAQUE'
  name=m['name'];hero=any(s in name for s in ['727','cockpit','airplane','aluminum01','sign','bookstore','aircraft','ap_door','ap_windows'])
  size=1024 if hero else 512;key=(imageindex,size,role)
  if key not in images:
   if imageindex is None:im=Image.new('RGBA',(8,8),(255,255,255,255))
   else:
    v=d['bufferViews'][d['images'][imageindex]['bufferView']];im=Image.open(io.BytesIO(b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGBA')
   images[key]=im;pools[(size,role)].append(key)
  records[i]={'key':key,'color':p.get('baseColorFactor',[1,1,1,1]),'repairDisplayUV':name in ('sign_russian_airport_01','sign_russian_airport_02','airport_departure_sign'),'flag':(2 if'KHR_materials_unlit'in m.get('extensions',{})else 0)+(.5 if mode=='MASK'else 0)}
 atlas={};layouts=[];pad=8
 for (size,mode),keys in pools.items():
  capacity=4 if size==1024 else 8;stride=size+pad*2
  for start in range(0,len(keys),capacity*capacity):
   subset=keys[start:start+capacity*capacity]
   # A mostly empty last atlas wastes VRAM and cache bandwidth in all five views.
   grid=min(capacity,2**math.ceil(math.log2(max(1,math.ceil(math.sqrt(len(subset)))))))
   canvas=Image.new('RGBA',(grid*stride,grid*stride),(255,255,255,0 if mode!='OPAQUE'else 255));atlasid=len(layouts)
   for tile,key in enumerate(subset):
    im=images[key].resize((size,size),Image.Resampling.LANCZOS);x=(tile%grid)*stride;y=(tile//grid)*stride
    # Repeat gutters on all sides, keeping distant mip samples within the tile.
    arr=np.array(im);arr=np.pad(arr,((pad,pad),(pad,pad),(0,0)),mode='wrap');canvas.paste(Image.fromarray(arr),(x,y));atlas[key]=(atlasid,tile)
   blob=io.BytesIO()
   if mode=='OPAQUE':canvas.convert('RGB').save(blob,format='JPEG',quality=91);mime='image/jpeg'
   else:canvas.save(blob,format='PNG',compress_level=5);mime='image/png'
   vi=out.view(blob.getvalue());out.d['images'].append({'bufferView':vi,'mimeType':mime,'name':f'terminal-atlas-{atlasid}'});out.d['textures'].append({'source':atlasid,'sampler':0})
   layout={'grid':grid,'size':size,'padding':pad,'mode':mode,'tiles':len(subset)};layouts.append(layout)
   out.d['materials'].append({'name':f'terminal-atlas-{atlasid}','doubleSided':True,'alphaMode':'BLEND'if mode=='MULTIPLY'else mode,'pbrMetallicRoughness':{'baseColorTexture':{'index':atlasid},'metallicFactor':0,'roughnessFactor':.9},'extras':{'terminalAtlas':layout}})
 def attrs(pr,positions=None,verts=None):
  data={k:access(d,b,a)for k,a in pr['attributes'].items()};count=len(data['POSITION']);rec=records[pr['material']];ai,tile=atlas[rec['key']]
  colors=data.get('COLOR_0',np.ones((count,4))).copy()*rec['color'];colors[:,3]=rec['color'][3]
  # These source map display quads have both axes reversed. Reflect within
  # each authored UV rectangle, retaining its crop in the original sign sheet.
  if rec['repairDisplayUV']and positions is not None:
   uv=data['TEXCOORD_0'];fixed=uv.copy()
   for tri in access(d,b,pr['indices']).reshape(-1,3):
    region=uv[tri];fixed[tri]=region.min(0)+region.max(0)-region
   data['TEXCOORD_0']=fixed
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
