import {Effect,Scene,ShaderMaterial,BaseTexture,Vector3,Vector4} from '@babylonjs/core';
export interface TerminalAtlas {grid:number;size:number;padding:number;mode:string}
const vertex=`precision highp float;
attribute vec3 position;attribute vec3 normal;attribute vec2 uv;attribute vec2 uv2;attribute vec4 color;
uniform mat4 viewProjection;
varying vec2 vUV;varying vec2 vTile;varying vec3 vColor;varying vec3 vNormal;
#include<instancesDeclaration>
void main(){
#include<instancesVertex>
 gl_Position=viewProjection*finalWorld*vec4(position,1.0);vUV=uv;vTile=uv2;vColor=color.rgb;vNormal=normalize(mat3(finalWorld)*normal);
}`;
const fragment=`precision highp float;
uniform sampler2D atlas;uniform vec4 atlasInfo;uniform vec3 sunDirection;
varying vec2 vUV;varying vec2 vTile;varying vec3 vColor;varying vec3 vNormal;
void main(){
 float grid=atlasInfo.x;float tile=floor(vTile.x+0.1);
 vec2 cell=vec2(mod(tile,grid),floor(tile/grid));
 vec2 tileUV=(cell+atlasInfo.y+fract(vUV)*atlasInfo.z)/grid;
 vec4 tex=texture2D(atlas,tileUV);
 float mode=mod(vTile.y,2.0);if(mode>0.1&&tex.a<mode)discard;
 vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
 float light=vTile.y>1.5?1.0:0.72+0.33*max(0.0,dot(n,sunDirection))+0.09*max(n.y,0.0);
 gl_FragColor=vec4(tex.rgb*vColor*light,atlasInfo.w>0.5?tex.a:1.0);
}`;
/** Terminal-only, shared texture-atlas shader. Repeating source UVs are wrapped
 * inside each padded tile, so floors/walls keep their authored texture scale. */
export function terminalAtlasMaterial(scene:Scene,name:string,texture:BaseTexture,layout:TerminalAtlas):ShaderMaterial{
 Effect.ShadersStore.terminalAtlasVertexShader=vertex;Effect.ShadersStore.terminalAtlasFragmentShader=fragment;
 const m=new ShaderMaterial(name,scene,'terminalAtlas',{attributes:['position','normal','uv','uv2','color'],uniforms:['world','viewProjection','atlasInfo','sunDirection'],samplers:['atlas'],needAlphaBlending:layout.mode==='BLEND',needAlphaTesting:layout.mode==='MASK'});
 const stride=layout.size+layout.padding*2;m.setTexture('atlas',texture);m.setVector4('atlasInfo',new Vector4(layout.grid,layout.padding/stride,layout.size/stride,layout.mode==='BLEND'?1:0));m.setVector3('sunDirection',new Vector3(.35,.9,-.25).normalize());m.backFaceCulling=false;return m;
}
