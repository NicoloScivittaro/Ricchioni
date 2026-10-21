import assert from 'node:assert/strict';
import {NullEngine,Scene,StandardMaterial,Color3} from '@babylonjs/core';
import {detailedWheel} from '../src/minigames/kart-race/kartCoachwork';
const engine=new NullEngine(),scene=new Scene(engine);
try {
 const rubber=new StandardMaterial('rubber',scene),metal=new StandardMaterial('metal',scene);
 rubber.diffuseColor=new Color3(.045,.05,.065);rubber.specularColor=new Color3(.08,.08,.09);
 metal.diffuseColor=new Color3(.55,.62,.69);metal.specularColor=new Color3(.9,.95,1);
 const original=detailedWheel(scene,.7,rubber,metal,metal),optimized=detailedWheel(scene,.7,rubber,metal,metal,true);
 assert.ok(original.subMeshes!.length>1,'original path still has its separate materials');
 assert.equal(optimized.subMeshes!.length,1);
 assert.equal(optimized.getTotalVertices(),original.getTotalVertices());
 assert.equal(optimized.getTotalIndices(),original.getTotalIndices());
 // Multi-material merging can reorder vertices. Compare geometric records and
 // triangles rather than assuming the same buffer order.
 const records=(mesh:typeof original)=>{
  const p=mesh.getVerticesData('position')!,n=mesh.getVerticesData('normal')!,uv=mesh.getVerticesData('uv')!;
  return Array.from({length:mesh.getTotalVertices()},(_,i)=>[...p.slice(i*3,i*3+3),...n.slice(i*3,i*3+3),...uv.slice(i*2,i*2+2)].map(v=>v.toFixed(5)).join(','));
 };
 const a=records(original),b=records(optimized);
 assert.deepEqual([...a].sort(),[...b].sort(),'positions, normals and UVs stay identical');
 const triangles=(mesh:typeof original,r:string[])=>{const ix=mesh.getIndices()!;return Array.from({length:ix.length/3},(_,i)=>[r[ix[i*3]],r[ix[i*3+1]],r[ix[i*3+2]]].sort().join('|')).sort();};
 assert.deepEqual(triangles(original,a),triangles(optimized,b),'triangle topology preserved');
 const colors=optimized.getVerticesData('color')!,surface=optimized.getVerticesData('uv2')!;
 assert.ok(colors.some(v=>Math.abs(v-.045)<1e-6),'rubber colour preserved');
 assert.ok(colors.some(v=>Math.abs(v-.55)<1e-6),'metal colour preserved');
 assert.ok(surface.some(v=>Math.abs(v-.09)<1e-6)&&surface.some(v=>Math.abs(v-1)<1e-6),'rubber/metal gloss remains distinct');
 console.log(`PASS: wheel submissions ${original.subMeshes!.length} → 1; all ${original.getTotalVertices()} vertices, normals, UVs, indices and rubber/metal response retained. Other tracks keep the default path.`);
}finally{scene.dispose();engine.dispose();}
