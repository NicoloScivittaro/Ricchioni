import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
process.env.HOST_URL='http://localhost:5180/?quality=high';process.env.CTRL_URL='http://localhost:5180/controller.html';
const {launch,createRoomOnHost,addPhone,hostEval,sleep}=await import('./lib.mjs');
const {gameEval,until}=await import('./padmock.mjs');
const browser=await launch(),G=(p,f,a)=>gameEval(p,'kart3d',f,a);let result;
try{
 const {page,code}=await createRoomOnHost(browser,{targetKeyPresses:3}),phones=[];for(let i=0;i<5;i++)phones.push(await addPhone(browser,code,'CAM '+i,i));
 await hostEval(page,gm=>{gm.selectMinigame('kart3d','arcobaleno');gm.startGame();});await until(()=>G(page,g=>g.race.phase==='racing'),90000,'race');
 result=await G(page,g=>{
  g.paused=true;const id=g.order[0],k=g.karts.get(id),cam=g.cameraManager.rigs.get(id).camera,V=k?g.spline.positionAt(0).constructor:null,M=g.entities.get(id).root.getWorldMatrix().constructor;
  const Ray=g.scene.createPickingRay(0,0,M.Identity(),cam).constructor,issues=[];let samples=0;
  for(const count of [2,3,4,5]){
   g.cameraManager.applyLayout(g.order.slice(0,count));g.hud.layout(g.order.slice(0,count));
   for(let s=0;s<g.spline.totalLength;s+=22)for(const lateral of [-3.2,0,3.2]){
    const gap=g.rainbow.gapAt(s);Object.assign(k,{distance:s,lateral,heading:0,absHeading:g.trackAngleAt(s),flight:gap?'GLIDE':'DRIVE',glideStart:gap?.launch??s,glideEnd:gap?.landing??s,jumpHeight:g.spline.flightHeightAt(s),jumpVelocity:0});
    for(let i=0;i<110;i++)g.cameraManager.update(1/60,id,k,g.spline);
    const target=g.spline.worldPoint(s,lateral,.9);target.y+=k.jumpHeight;const direction=target.subtract(cam.position),length=direction.length(),ray=new Ray(cam.position.clone(),direction.normalize(),length-.5);
    const hit=g.scene.pickWithRay(ray,m=>m.isEnabled()&&(m.material?.name==='rainbowRoadTiles'||m.material?.name.startsWith('Nila_2')));
    samples++;if(hit?.hit)issues.push({count,s,lateral,distance:hit.distance,targetDistance:length,mesh:hit.pickedMesh.name});
   }
  }
  return {samples,issues};
 });
 console.log(JSON.stringify(result));assert.equal(result.issues.length,0,'road geometry never hides the kart from chase camera');
 await hostEval(page,gm=>gm.restartMatch());await sleep(800);await page.evaluate(()=>localStorage.removeItem('ricchioni.hostToken'));for(const ph of phones)await ph.ctx.close();
}finally{writeFileSync('docs/agent-work/glide-polish/camera-rays.json',JSON.stringify(result??{},null,2));await browser.close();}
