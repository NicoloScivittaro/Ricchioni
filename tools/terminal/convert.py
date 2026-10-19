"""Terminal source -> glTF 2 GLB, without a game integration or proxy geometry.

Run from the repository root after extracting the two user archives as described
in README.md. numpy and Pillow are conversion-only, already installed locally.
"""
from pathlib import Path
from collections import Counter, defaultdict
import argparse
import hashlib
import io
import json
import struct
import time
from functools import lru_cache
import numpy as np
from PIL import Image
from iwmap import read_map, geometry, entity_matrix, transform
from cod4_assets import load_xmodel, load_surfs, load_material, load_iwi

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/agent-work/terminal-conversion'
RAW=OUT/'source/rar/mp_mw2_terminal_map_source_full/raw'
MAPROOTS=[OUT/'source/zip/map_source',OUT/'source/rar/mp_mw2_terminal_map_source_full/map_source']
SCALE=.0254
AXIS=np.array([[1.,0,0],[0,0,1],[0,-1,0]])  # proper rotation, determinant +1
C=np.eye(4);C[:3,:3]=AXIS*SCALE
CI=np.linalg.inv(C)
TOOLS={'caulk','caulk_outdoor','caulk_shadow','clip','clip_nosight','clip_slick','clip_missile','clip_player',
       'clipweap','nodraw','nodraw_notsolid','nodraw_decal','portal','portal_nodraw','hint','hintskip','skip','origin','trigger','lightgrid_volume',
       'light','lightmap_gray','shadow','shadowcaster','ai_nosight','mantle_on','mantle_over','ladder','sky','skyportal'}


@lru_cache(maxsize=None)
def technical(name):
    lowered=name.lower()
    if lowered in TOOLS or lowered.startswith(('clip_','clip_nosight_','mantle_','ladder_','sky_')):return True
    source=RAW/'materials'/name
    # CoD has invisible shadow-only surfaces inside some visual XModels. Their
    # actual techset distinguishes them from ordinary opaque/cutout geometry.
    return source.is_file() and load_material(source)['techset']=='shadowcaster'


def dump(name, obj):
    (OUT/name).write_text(json.dumps(obj,indent=2,ensure_ascii=True),encoding='utf8')


class GLB:
    def __init__(self):
        self.doc={'asset':{'version':'2.0','generator':'Terminal iwmap4/CoD4 static conversion'},'scene':0,'scenes':[{'nodes':[0]}],
                  'nodes':[{'name':'Terminal','children':[]}],'meshes':[],'materials':[],'textures':[],'images':[],
                  'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],
                  'bufferViews':[],'accessors':[],'buffers':[],'extensionsUsed':[]}
        self.bin=bytearray();self.texture_cache={};self.material_cache={};self.material_records={};self.texture_records={}
        self.missing_materials=set();self.missing_textures={};self.texture_errors={};self.geo_stats=Counter()

    def view(self, data, target=None):
        self.bin.extend(bytes((-len(self.bin))%4));start=len(self.bin);self.bin.extend(data)
        record={'buffer':0,'byteOffset':start,'byteLength':len(data)}
        if target:record['target']=target
        self.doc['bufferViews'].append(record);return len(self.doc['bufferViews'])-1

    def accessor(self, data, index=False):
        data=np.asarray(data,dtype='<u4'if index else'<f4')
        if not np.isfinite(data).all():raise ValueError('non-finite GLB accessor')
        dim=1 if data.ndim==1 else data.shape[1]
        record={'bufferView':self.view(data.tobytes(),34963 if index else 34962),'componentType':5125 if index else 5126,
                'count':len(data),'type':{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[dim]}
        if len(data):record.update(min=np.atleast_1d(data.min(axis=0)).tolist(),max=np.atleast_1d(data.max(axis=0)).tolist())
        self.doc['accessors'].append(record);return len(self.doc['accessors'])-1

    def texture(self, name, role):
        key=(name,role)
        if key in self.texture_cache:return self.texture_cache[key]
        path=RAW/'images'/(name+'.iwi')
        if not path.is_file():self.missing_textures[name]={'role':role,'path':str(path.relative_to(ROOT))};return None
        try:
            image=load_iwi(path)
            if role=='normal':
                pixels=np.asarray(image,dtype=np.float32)/255.
                # CoD DXT5 normal maps pack X in alpha and Y in green.
                x=pixels[:,:,3]*2-1;y=pixels[:,:,1]*2-1;z=np.sqrt(np.maximum(0,1-x*x-y*y))
                n=np.stack([x,-y,z],axis=-1);n/=np.maximum(np.linalg.norm(n,axis=-1,keepdims=True),1e-8)
                image=Image.fromarray(np.uint8(np.clip(n*.5+.5,0,1)*255),'RGB')
            blob=io.BytesIO();image.save(blob,format='PNG',compress_level=3)
            view=self.view(blob.getvalue());self.doc['images'].append({'bufferView':view,'mimeType':'image/png','name':name+'__'+role})
            self.doc['textures'].append({'source':len(self.doc['images'])-1,'sampler':0});index=len(self.doc['textures'])-1
            self.texture_cache[key]=index;self.texture_records[name]={'size':image.size,'sourceVersion':6,'role':role,'embedded':True}
            return index
        except Exception as error:
            self.texture_errors[name]={'role':role,'reason':str(error)};return None

    def material(self, name):
        if name in self.material_cache:return self.material_cache[name]
        record={'name':name,'pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':.78},'doubleSided':True}
        path=RAW/'materials'/name
        if not path.is_file():
            self.missing_materials.add(name);record['pbrMetallicRoughness']['baseColorFactor']=[.58,.6,.62,1]
            record['extras']={'missingSourceMaterial':name}
        else:
            source=load_material(path);self.material_records[name]=source;tech=source['techset']
            record['extras']={'sourceTechset':tech}
            if '_b0'in tech:record['alphaMode']='BLEND'
            elif '_t0'in tech:record.update(alphaMode='MASK',alphaCutoff=.5)
            if tech.startswith(('unlit','effect','2d')):
                record['extensions']={'KHR_materials_unlit':{}}
                if 'KHR_materials_unlit'not in self.doc['extensionsUsed']:self.doc['extensionsUsed'].append('KHR_materials_unlit')
            for texture in source['textures']:
                kind=texture['kind'];texname=texture['name']
                if kind=='colorMap':
                    i=self.texture(texname,'baseColor')
                    if i is not None:record['pbrMetallicRoughness']['baseColorTexture']={'index':i}
                elif kind=='normalMap'and texname!='$identitynormalmap':
                    i=self.texture(texname,'normal')
                    if i is not None:record['normalTexture']={'index':i}
                elif kind=='specularMap':
                    i=self.texture(texname,'specular')
                    if i is not None:
                        record.setdefault('extensions',{})['KHR_materials_specular']={'specularColorTexture':{'index':i}}
                        if 'KHR_materials_specular'not in self.doc['extensionsUsed']:self.doc['extensionsUsed'].append('KHR_materials_specular')
                else:
                    # Retain channel references; don't pretend a detail shader
                    # has a one-to-one core glTF PBR equivalent.
                    record['extras'].setdefault('untranslatedSourceChannels',[]).append(texture)
        self.doc['materials'].append(record);index=len(self.doc['materials'])-1;self.material_cache[name]=index;return index

    def mesh(self, name, surfaces, coordinates=True):
        primitives=[]
        for material,points,triangles,uv,normals,colors in surfaces:
            if technical(material):self.geo_stats['technicalTrianglesExcluded']+=len(triangles);continue
            points=np.asarray(points);triangles=np.asarray(triangles)
            tri=points[triangles]
            keep=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)>1e-8
            self.geo_stats['sourceDegenerateTrianglesExcluded']+=int((~keep).sum());triangles=triangles[keep]
            if not len(triangles):continue
            if coordinates:points=points@AXIS.T*SCALE;normals=normals@AXIS.T
            lengths=np.linalg.norm(normals,axis=1);normals=normals/np.maximum(lengths[:,None],1e-10)
            normals[lengths<1e-10]=[0,1,0]
            attributes={'POSITION':self.accessor(points),'NORMAL':self.accessor(normals),'TEXCOORD_0':self.accessor(uv)}
            if colors is not None:
                colors=np.clip(colors,0,1).copy();colors[:,3]=1  # source alpha is often a shader mask, not object opacity
                attributes['COLOR_0']=self.accessor(colors)
            primitives.append({'attributes':attributes,'indices':self.accessor(triangles.flatten(),True),'material':self.material(material),'mode':4})
            self.geo_stats['uniqueTriangles']+=len(triangles);self.geo_stats['uniqueVertices']+=len(points)
        if not primitives:return None
        self.doc['meshes'].append({'name':name,'primitives':primitives});return len(self.doc['meshes'])-1

    def node(self, name, mesh, matrix=None, extras=None):
        node={'name':name,'mesh':mesh}
        if matrix is not None:node['matrix']=matrix.T.flatten().tolist()
        if extras:node['extras']=extras
        self.doc['nodes'].append(node);index=len(self.doc['nodes'])-1;self.doc['nodes'][0]['children'].append(index);return index

    def save(self, path, extras):
        self.doc['nodes'][0]['extras']=extras
        self.doc['buffers']=[{'byteLength':len(self.bin)}]
        blob=json.dumps(self.doc,separators=(',',':'),ensure_ascii=True).encode();blob+=b' '*((-len(blob))%4)
        binary=bytes(self.bin);binary+=bytes((-len(binary))%4)
        total=12+8+len(blob)+8+len(binary)
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('wb')as f:
            f.write(struct.pack('<4sII',b'glTF',2,total));f.write(struct.pack('<I4s',len(blob),b'JSON'));f.write(blob)
            f.write(struct.pack('<I4s',len(binary),b'BIN\0'));f.write(binary)


class Conversion:
    def __init__(self):
        self.glb=GLB();self.maps={};self.mesh_cache={};self.geometry_cache={};self.chunks=defaultdict(list)
        self.stats=Counter();self.technical_materials=Counter();self.failures=[];self.missing_models={};self.prefabs={};self.model_records={};self.instances=[];self.prefab_instances=[]
        self.bounds_min=np.full(3,np.inf);self.bounds_max=np.full(3,-np.inf)

    def map_path(self,name):
        clean=name.replace('\\','/').removeprefix('map_source/')
        if '..'in Path(clean).parts or Path(clean).is_absolute():raise ValueError('invalid prefab path '+name)
        for root in MAPROOTS:
            path=root/clean
            if path.is_file():return path
        return None

    def bounds(self,points):
        self.bounds_min=np.minimum(self.bounds_min,points.min(axis=0));self.bounds_max=np.maximum(self.bounds_max,points.max(axis=0))

    def add_geometry(self,block,path,matrix,chain):
        planes=[l.split(')',3)[-1].split()[0]for l in block.lines if l.startswith('(')and l.count(')')>=3]
        if planes and all(technical(m)for m in planes):
            self.stats['technicalBrushInstancesExcluded']+=1
            for material in planes:self.technical_materials[material]+=1
            return
        key=(str(path),block.line)
        if key not in self.geometry_cache:
            self.geometry_cache[key]=geometry(block)
        surfaces=self.geometry_cache[key]
        kind=block.lines[0]if block.lines and block.lines[0]in['mesh','curve']else'brush'
        self.stats[kind+'Instances']+=1
        for material,p,tri,uv,norm,color in surfaces:
            if technical(material):self.technical_materials[material]+=len(tri);continue
            points=transform(p,matrix);normals=norm@np.linalg.inv(matrix[:3,:3]);normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-10)
            if np.linalg.det(matrix[:3,:3])<0:tri=tri[:,[0,2,1]]
            self.bounds(points)
            # Geometry is flattened by real source triangles, grouped spatially
            # by material. This does not synthesize replacement buildings.
            center=points.mean(axis=0);cell=(int(center[0]//2048),int(center[1]//2048))
            self.chunks[(material,*cell)].append((material,points,tri,uv,normals,color))
            self.stats['mapTrianglesBeforeDegenerates']+=len(tri)

    def add_model(self,props,matrix,chain):
        name=props['model'].replace('\\','/').removeprefix('xmodel/')
        if '..'in Path(name).parts or '/'in name:raise ValueError('invalid model reference '+name)
        world=matrix@entity_matrix(props);self.stats['modelInstancesRequested']+=1
        record={'model':name,'source':chain,'classname':props.get('classname'),'sourceTransform':world.tolist()}
        if name not in self.mesh_cache:
            source=RAW/'xmodel'/name
            if not source.is_file():
                self.mesh_cache[name]=None;self.missing_models[name]={'reason':'raw/xmodel file absent','instances':[]}
            else:
                try:
                    lods=load_xmodel(source);failures=[];selected=None
                    for lod in lods:
                        surf=RAW/'xmodelsurfs'/lod['name']
                        try:
                            surfaces=load_surfs(surf,lod['materials']);selected=lod;break
                        except Exception as error:failures.append(str(error))
                    if selected is None:raise ValueError('; '.join(failures))
                    self.mesh_cache[name]=self.glb.mesh('xmodel/'+name,surfaces)
                    points=np.concatenate([s[1]for s in surfaces]);self.model_records[name]={'lod':selected,'lodFallback':len(failures)>0,'lodFailures':failures,
                        'triangles':sum(len(s[2])for s in surfaces),'localBounds':[points.min(0).tolist(),points.max(0).tolist()],
                        'xmodelpartsPresent':(RAW/'xmodelparts'/selected['name']).is_file()}
                except Exception as error:
                    self.mesh_cache[name]=None;self.missing_models[name]={'reason':str(error),'instances':[]}
        mesh=self.mesh_cache[name]
        if mesh is None:
            self.missing_models.setdefault(name,{'reason':'no visible surfaces','instances':[]})['instances'].append(record);return
        bounds=np.array(self.model_records[name]['localBounds']);corners=np.array([[x,y,z]for x in bounds[:,0]for y in bounds[:,1]for z in bounds[:,2]])
        self.bounds(transform(corners,world));self.glb.node('model/'+name,mesh,C@world@CI,{'source':chain,'classname':props.get('classname')})
        self.stats['modelInstancesRecovered']+=1;self.stats['instancedModelTriangles']+=self.model_records[name]['triangles'];self.instances.append(record)

    def expand(self,name,matrix,chain=(),active=()):
        if name in active:raise ValueError('cyclic prefab: '+' -> '.join((*active,name)))
        path=self.map_path(name)
        if path is None:
            self.failures.append({'type':'missingPrefab','map':name,'instance':chain});return
        if name not in self.maps:self.maps[name]=read_map(path)
        if chain:
            self.stats['prefabInstances']+=1
            self.prefabs.setdefault(name,{'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'instances':0,'source':str(path.relative_to(ROOT))})['instances']+=1
            self.prefab_instances.append({'prefab':name,'source':'/'.join(chain),'sourceTransform':matrix.tolist()})
        for i,entity in enumerate(self.maps[name]):
            props=entity.properties();kind=props.get('classname','');where='/'.join((*chain,name+f':entity{i}'))
            if kind=='misc_prefab':
                self.expand(props['model'],matrix@entity_matrix(props),(*chain,name+f':entity{i}'),(*active,name));continue
            if kind in ['misc_model','dyn_model','script_model']and props.get('model'):
                self.add_model(props,matrix,where)
            if kind.startswith('trigger_'):
                self.stats['triggerVolumesExcluded']+=len(entity.children);continue
            # Brush coordinates are already expressed in the map's coordinate
            # system. Entity origin is a pivot, not another vertex translation.
            for block in entity.children:
                try:self.add_geometry(block,path,matrix,where)
                except Exception as error:self.failures.append({'type':'geometry','source':where,'line':block.line,'reason':str(error)})

    def finish(self,path):
        for (material,x,y),surfaces in self.chunks.items():
            points=[];normals=[];uv=[];colors=[];triangles=[];offset=0
            for _,p,t,u,n,c in surfaces:
                points.append(p);normals.append(n);uv.append(u);colors.append(c if c is not None else np.ones((len(p),4)));triangles.append(t+offset);offset+=len(p)
            merged=(material,np.concatenate(points),np.concatenate(triangles),np.concatenate(uv),np.concatenate(normals),np.concatenate(colors))
            mesh=self.glb.mesh(f'map/{material}/{x}/{y}',[merged])
            if mesh is not None:self.glb.node(f'map/{material}/{x}/{y}',mesh,extras={'source':'iwmap4 clipped brushes/mesh grids/Bezier curves'})
        center=np.array([(self.bounds_min[0]+self.bounds_max[0])/2,(self.bounds_min[1]+self.bounds_max[1])/2,0])
        origin=AXIS@center*SCALE;self.glb.doc['nodes'][0]['translation']=(-origin).tolist()
        missing=bool(self.missing_models or self.glb.missing_materials or self.glb.missing_textures or self.glb.texture_errors or self.failures)
        extras={'status':'partial'if missing else'geometry-converted','sourceUnitsToMeters':SCALE,'sourceAxis':'Z-up','gltfAxis':'Y-up, right handed',
                'sourceOriginOffset':center.tolist(),'missingModels':len(self.missing_models),'geometryFailures':len(self.failures),
                'noProxyGeometry':True,'gameplayIntegrated':False}
        self.glb.save(path,extras)
        report={**extras,'file':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sourceBounds':[self.bounds_min.tolist(),self.bounds_max.tolist()],
                'sizeMeters':((self.bounds_max-self.bounds_min)*SCALE).tolist(),'counts':dict(self.stats),'glbCounts':dict(self.glb.geo_stats),
                'prefabFilesRecovered':len(self.prefabs),'uniqueModelsRecovered':len(self.model_records),'uniqueModelsUnavailable':len(self.missing_models),
                'materialsReferenced':len(self.glb.material_cache),'materialsRecovered':len(self.glb.material_records),'materialsMissing':len(self.glb.missing_materials),
                'texturesEmbedded':len(self.glb.texture_cache),'texturesMissing':len(self.glb.missing_textures),'textureDecodeFailures':len(self.glb.texture_errors),
                'glbMeshes':len(self.glb.doc['meshes']),'glbNodes':len(self.glb.doc['nodes'])}
        dump('conversion.json',report);dump('prefabs.json',self.prefabs);dump('prefab-instances.json',self.prefab_instances);dump('models.json',self.model_records);dump('model-instances.json',self.instances)
        dump('missing-models.json',self.missing_models);dump('missing-materials.json',sorted(self.glb.missing_materials));dump('missing-textures.json',self.glb.missing_textures)
        dump('texture-errors.json',self.glb.texture_errors);dump('geometry-failures.json',self.failures);dump('materials.json',self.glb.material_records);dump('textures.json',self.glb.texture_records)
        dump('technical-exclusions.json',dict(self.technical_materials))
        return report


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='public/assets/fps/terminal/terminal.glb');args=parser.parse_args()
    start=time.monotonic();c=Conversion();c.expand('mp_mw2_terminal.map',np.eye(4));print(json.dumps({'expanded':dict(c.stats),'failures':len(c.failures)}),flush=True)
    report=c.finish(ROOT/args.out);report['seconds']=time.monotonic()-start;dump('conversion.json',report);print(json.dumps(report),flush=True)
