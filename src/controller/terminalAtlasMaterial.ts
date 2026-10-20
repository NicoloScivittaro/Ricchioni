import type {Engine} from '@babylonjs/core';
import {Effect,Constants,Scene,ShaderMaterial,BaseTexture,Texture,Vector3,Vector4} from '@babylonjs/core';
export interface TerminalAtlas {grid:number;size:number;padding:number;mode:string}
const vertex=`precision highp float;
attribute vec3 position;attribute vec3 normal;attribute vec2 uv;attribute vec2 uv2;attribute vec4 color;
uniform mat4 viewProjection;
varying vec2 vUV;varying vec2 vTile;varying vec4 vColor;varying vec3 vNormal;
#include<instancesDeclaration>
void main(){
#include<instancesVertex>
 gl_Position=viewProjection*finalWorld*vec4(position,1.0);vUV=uv;vTile=uv2;vColor=color;vNormal=normalize(mat3(finalWorld)*normal);
}`;
const fragment=`precision highp float;
uniform sampler2D atlas;uniform vec4 atlasInfo;uniform vec3 sunDirection;uniform float maxGradient;
varying vec2 vUV;varying vec2 vTile;varying vec4 vColor;varying vec3 vNormal;
void main(){
 float grid=atlasInfo.x;float tile=floor(vTile.x+0.1);
 vec2 cell=vec2(mod(tile,grid),floor(tile/grid));
 vec2 tileUV=(cell+atlasInfo.y+fract(vUV)*atlasInfo.z)/grid;
 vec4 tex=texture2D(atlas,tileUV);
 float mode=mod(vTile.y,2.0);if(mode>0.1&&tex.a<mode)discard;
 vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;
 float light=vTile.y>1.5?1.0:0.64+0.25*max(0.0,dot(n,sunDirection))+0.07*max(n.y,0.0);
 gl_FragColor=vec4(tex.rgb*vColor.rgb*light,atlasInfo.w>0.5?tex.a*vColor.a:1.0);
}`;
/** Terminal-only, shared texture-atlas shader. Repeating source UVs are wrapped
 * inside each padded tile, so floors/walls keep their authored texture scale. */
export function terminalAtlasMaterial(scene:Scene,name:string,texture:BaseTexture,layout:TerminalAtlas):ShaderMaterial{
 const gradients=(scene.getEngine() as Engine).webGLVersion>=2;
 const shader=gradients?'terminalAtlasGrad':'terminalAtlasLegacy';
 // Derivatives must be computed BEFORE fract(): wrapping a source UV must not
 // switch mip level or sample an adjacent material in the atlas.
 const sample=`vec2 gx=dFdx(vUV)*atlasInfo.z/grid,gy=dFdy(vUV)*atlasInfo.z/grid;
 gx*=min(1.0,maxGradient/max(length(gx),0.0000001));gy*=min(1.0,maxGradient/max(length(gy),0.0000001));
 vec4 tex=textureGrad(atlas,tileUV,gx,gy);`;
 Effect.ShadersStore[shader+'VertexShader']=vertex;
 Effect.ShadersStore[shader+'FragmentShader']=gradients?fragment.replace('vec4 tex=texture2D(atlas,tileUV);',sample):fragment;
 if(texture instanceof Texture){texture.updateSamplingMode(gradients?Texture.TRILINEAR_SAMPLINGMODE:Texture.BILINEAR_SAMPLINGMODE);texture.anisotropicFilteringLevel=2;}
 const m=new ShaderMaterial(name,scene,shader,{attributes:['position','normal','uv','uv2','color'],uniforms:['world','viewProjection','atlasInfo','sunDirection','maxGradient'],samplers:['atlas'],needAlphaBlending:layout.mode==='BLEND'||layout.mode==='MULTIPLY',needAlphaTesting:layout.mode==='MASK'});
 const stride=layout.size+layout.padding*2;m.setFloat('maxGradient',4/(layout.grid*stride));m.setTexture('atlas',texture);m.setVector4('atlasInfo',new Vector4(layout.grid,layout.padding/stride,layout.size/stride,layout.mode==='BLEND'||layout.mode==='MULTIPLY'?1:0));m.setVector3('sunDirection',new Vector3(.35,.9,-.25).normalize());m.backFaceCulling=false;m.disableDepthWrite=layout.mode==='BLEND'||layout.mode==='MULTIPLY';if(layout.mode==='MULTIPLY')m.alphaMode=Constants.ALPHA_MULTIPLY;if(layout.mode!=='OPAQUE'){m.zOffset=-.35;m.zOffsetUnits=-1;}return m;
}
