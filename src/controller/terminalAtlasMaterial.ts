import type {Engine} from '@babylonjs/core';
import {Effect,Constants,Scene,ShaderMaterial,BaseTexture,Texture,Vector3,Vector4} from '@babylonjs/core';
export interface TerminalAtlas {grid?:number;size?:number;width?:number;height?:number;rects?:number[][];padding:number;mode:string}
const vertex=`precision highp float;
attribute vec3 position;attribute vec3 normal;attribute vec2 uv;attribute vec2 uv2;attribute vec4 color;
uniform mat4 viewProjection;uniform vec4 tileRects[64];
varying vec2 vUV;varying vec2 vTile;varying vec4 vRect;varying vec4 vColor;varying vec3 vNormal;
#include<instancesDeclaration>
void main(){
#include<instancesVertex>
 gl_Position=viewProjection*finalWorld*vec4(position,1.0);vUV=uv;vTile=uv2;vRect=tileRects[int(floor(uv2.x+0.1))];vColor=color;vNormal=normalize(mat3(finalWorld)*normal);
}`;
const fragment=`precision highp float;
uniform sampler2D atlas;uniform vec4 atlasInfo;uniform vec3 sunDirection;uniform float maxGradient;
varying vec2 vUV;varying vec2 vTile;varying vec4 vRect;varying vec4 vColor;varying vec3 vNormal;
void main(){
 vec2 tileUV=vRect.xy+fract(vUV)*vRect.zw;
 vec4 tex=texture2D(atlas,tileUV);
 // Quantize interpolated flags: 1.999999 must not wrap to an alpha cutoff > 1.
 float mode=mod(floor(vTile.y*2.0+0.5),4.0)*0.5;if(mode>0.1&&tex.a<mode)discard;
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
 const sample=`vec2 gx=dFdx(vUV)*vRect.zw,gy=dFdy(vUV)*vRect.zw;
 gx*=min(1.0,maxGradient/max(length(gx),0.0000001));gy*=min(1.0,maxGradient/max(length(gy),0.0000001));
 vec4 tex=textureGrad(atlas,tileUV,gx,gy);`;
 Effect.ShadersStore[shader+'VertexShader']=vertex;
 Effect.ShadersStore[shader+'FragmentShader']=gradients?fragment.replace('vec4 tex=texture2D(atlas,tileUV);',sample):fragment;
 if(texture instanceof Texture){texture.updateSamplingMode(gradients?Texture.TRILINEAR_SAMPLINGMODE:Texture.BILINEAR_SAMPLINGMODE);texture.anisotropicFilteringLevel=2;}
 const m=new ShaderMaterial(name,scene,shader,{attributes:['position','normal','uv','uv2','color'],uniforms:['world','viewProjection','atlasInfo','tileRects','sunDirection','maxGradient'],samplers:['atlas'],needAlphaBlending:layout.mode==='BLEND'||layout.mode==='MULTIPLY',needAlphaTesting:layout.mode==='MASK'});
 const grid=layout.grid??1,size=layout.size??1,stride=size+layout.padding*2;
 const width=layout.width??grid*stride,height=layout.height??grid*stride;
 const rects=layout.rects??Array.from({length:64},(_,i)=>[(i%grid+layout.padding/stride)/grid,(Math.floor(i/grid)+layout.padding/stride)/grid,size/stride/grid,size/stride/grid]);
 m.setArray4('tileRects',Array.from({length:64},(_,i)=>rects[i]??[0,0,0,0]).flat());
 m.setFloat('maxGradient',4/Math.max(width,height));m.setTexture('atlas',texture);m.setVector4('atlasInfo',new Vector4(0,0,0,layout.mode==='BLEND'||layout.mode==='MULTIPLY'?1:0));m.setVector3('sunDirection',new Vector3(.35,.9,-.25).normalize());m.backFaceCulling=false;m.disableDepthWrite=layout.mode==='BLEND'||layout.mode==='MULTIPLY';if(layout.mode==='MULTIPLY')m.alphaMode=Constants.ALPHA_MULTIPLY;if(layout.mode!=='OPAQUE'){m.zOffset=-.35;m.zOffsetUnits=-1;}return m;
}
