import { Color3, Constants, DynamicTexture, Matrix, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { Control, Line, Rectangle, TextBlock } from '@babylonjs/gui';
import { hudText } from '../hud/hudKit';
import type { SoccerHud } from './soccerHud';
import { CHARGE_TIME, TEAM_COLOR, FIELD_HALF_W, GOAL_HALF_W, GOAL_DEPTH, BALL_RADIUS, PLAYER_RADIUS } from './soccerTypes';
import type { SoccerBall, SoccerPlayer } from './soccerTypes';

import { layoutSoccerLabels } from './soccerLabelLayout';
import type { LabelRect } from './soccerLabelLayout';

/** Solo presentazione. Oggetti limitati al roster, nessuna scrittura in fisica/punteggi/abilità. */
export class SoccerReadability {
  private players = new Map<string, { ring: Mesh; team: Mesh; anchor: Mesh; box: Rectangle; name: TextBlock;
    power: Rectangle; fill: Rectangle; leader: Line; width: number }>();
  private offsets = new Map<string,{dx:number;dy:number}>();
  private ballRing: Mesh;
  private ballShadow: Mesh;
  private possession: TextBlock;
  constructor(private scene: Scene, hud: SoccerHud, players: SoccerPlayer[], ballMesh: Mesh,
    playerNames: ReadonlyMap<string,string> = new Map()) {
    const mat = (name: string, color: string, overlay = false) => {
      const m = new StandardMaterial(name, scene);
      m.diffuseColor = m.emissiveColor = Color3.FromHexString(color);
      m.disableLighting = true;
      if (overlay) { m.depthFunction = Constants.ALWAYS; m.disableDepthWrite = true; }
      return m;
    };
    const ring = (name: string, diameter: number, thickness: number, m: StandardMaterial) => {
      const r = MeshBuilder.CreateTorus(name, { diameter, thickness, tessellation: 32 }, scene);
      r.material = m; r.isPickable = false;
      return r;
    };
    const teams = { red: mat('soccerRed', TEAM_COLOR.red), blue: mat('soccerBlue', TEAM_COLOR.blue) };
    const measure=document.createElement('canvas').getContext('2d')!;measure.font='700 14px Arial';
    for (const p of players) {
      const personal = ring(`soccerIdentity:${p.id}`, 1.25, .045, mat(`soccerPersonal:${p.id}`, p.color));
      const team = ring(`soccerTeam:${p.id}`, 1.55, .045, teams[p.team]);
      const anchor = new Mesh(`soccerLabel:${p.id}`, scene); anchor.isPickable=false;
      const playerName=playerNames.get(p.id)??p.name;
      const letters=Array.from(playerName);let text=playerName;
      while(measure.measureText(text).width>98 && letters.length>3) { letters.pop();text=letters.join('')+'…'; }
      const width=Math.max(44,Math.ceil(measure.measureText(text).width)+8);
      const box=new Rectangle(`soccerName:${p.id}`); box.width=`${width}px`; box.height='22px';
      box.thickness=0; box.background='transparent'; box.isHitTestVisible=false; box.zIndex=2;
      hud.adt.addControl(box); box.linkWithMesh(anchor);
      const name = hudText(`identity:${p.id}`, text, 14, TEAM_COLOR[p.team], false);
      name.fontFamily='Arial'; name.top='-2px'; name.height='18px'; name.outlineWidth=2;
      name.shadowBlur=0; name.shadowOffsetY=0; box.addControl(name);
      const power = new Rectangle('chargeTrack'); power.width='48px'; power.height='3px';
      power.top='9px'; power.thickness=0; power.background='#475569'; box.addControl(power);
      const fill = new Rectangle('chargeFill'); fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      fill.height='100%'; fill.thickness=0; fill.background='#22d3ee'; power.addControl(fill);
      const leader=new Line(`soccerLeader:${p.id}`);leader.lineWidth=1;leader.color=TEAM_COLOR[p.team];leader.alpha=.5;
      leader.horizontalAlignment=Control.HORIZONTAL_ALIGNMENT_LEFT;leader.verticalAlignment=Control.VERTICAL_ALIGNMENT_TOP;
      leader.isHitTestVisible=false;hud.adt.addControl(leader);
      this.players.set(p.id, { ring: personal, team, anchor, box, name, power, fill, leader, width });
    }
    this.ballShadow = MeshBuilder.CreateDisc('soccerBallShadow', { radius: .58, tessellation: 24 }, scene);
    this.ballShadow.rotation.x = Math.PI / 2;
    const shadow = mat('soccerShadowMat', '#080b0e'); shadow.alpha = .55; shadow.backFaceCulling = false;
    this.ballShadow.material = shadow; this.ballShadow.isPickable = false;
    this.ballRing = ring('soccerBallIndicator', 1.3, .045, mat('soccerBallIndicatorMat', '#fde047', true));
    this.ballRing.renderingGroupId = 1;
    // Mantieni il depth buffer della scena: solo l'indicatore della palla è visibile attraverso corpi.
    scene.setRenderingAutoClearDepthStencil(1, false);
    this.possession = hudText('soccerPossession', '', 17, '#fde047');
    this.possession.height = '24px'; this.possession.width = '600px';
    this.possession.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP; this.possession.top = '130px';
    // Stato squadra a 100px; feed più in basso solo nel Calcio.
    hud.adt.getControlByName('feed')!.top = '160px';
    hud.adt.addControl(this.possession);
    const direction = hudText('soccerDirections', '◀  GOL BLU       ·       GOL ROSSI  ▶', 16, '#f8fafc');
    direction.height = '24px'; direction.width = '470px'; direction.top = '-78px';
    direction.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM; hud.adt.addControl(direction);
    // Texture locale leggera: la sfera bianca aveva poco contrasto sul campo e sui corpi.
    const tex = new DynamicTexture('soccerBallPattern', { width: 256, height: 128 }, scene, false);
    const c = tex.getContext() as unknown as CanvasRenderingContext2D;
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#17202b';
    for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
      const x = col * 48 + (row % 2) * 24, y = row * 48;
      c.beginPath(); for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3; const px = x + Math.cos(a) * 12, py = y + Math.sin(a) * 12;
        if (i) c.lineTo(px, py); else c.moveTo(px, py);
      } c.closePath(); c.fill();
    }
    tex.update(); (ballMesh.material as StandardMaterial).diffuseTexture = tex;
    // Gli annunci del gol/countdown devono coprire anche le nuove targhette collegate ai giocatori.
    hud.adt.getControlByName('banner')!.zIndex = 20;
    hud.adt.getControlByName('countdown')!.zIndex = 20;
    scene.onBeforeRenderObservable.add(()=>this.placeLabels(players, ballMesh));
  }
  update(players: SoccerPlayer[], ball: SoccerBall, active: boolean, aimColor: string): void {
    const owner = active ? players.find(p => p.id === ball.ownerId && p.alive && p.hasBall) : undefined;
    this.possession.text = !active ? '' : owner ? `PALLA: ${owner.name}  ·  ${owner.team === 'red' ? '▲ ROSSI →' : '← ● BLU'}${owner.charging ? '  ·  RILASCIA PER TIRARE' : ''}` : 'PALLA LIBERA';
    for (const p of players) {
      const v = this.players.get(p.id)!;
      v.ring.position.set(p.x, .055, p.z); v.team.position.set(p.x, .04, p.z);
      v.anchor.position.set(p.x, 3.3 + p.y, p.z);
      v.box.isVisible = p.alive; v.ring.isVisible = v.team.isVisible = p.alive;
      const hasBall = p === owner, charge = hasBall && p.charging;
      v.power.isVisible = !!charge; v.fill.width = `${Math.min(1, p.chargeTime / CHARGE_TIME) * 100}%`; v.fill.background = aimColor;
    }
    this.ballRing.position.set(ball.x, .09, ball.z); this.ballShadow.position.set(ball.x, .025, ball.z);
  }

  private placeLabels(players: readonly SoccerPlayer[], ballMesh: Mesh): void {
    const camera=this.scene.activeCamera;if(!camera)return;
    this.scene.updateTransformMatrix();
    const engine=this.scene.getEngine(),h=engine.getRenderHeight(),scale=h/720;
    const viewport=camera.viewport.toGlobal(engine.getRenderWidth(),h);
    const identity=Matrix.Identity(),transform=this.scene.getTransformMatrix();
    const project=(x:number,y:number,z:number)=>{
      const p=Vector3.Project(new Vector3(x,y,z),identity,transform,viewport);
      return {x:p.x/scale,y:p.y/scale,depth:p.z};
    };
    const rect=(points:{x:number;y:number}[],padding=3):LabelRect=>{
      const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs)-padding,y=Math.min(...ys)-padding;
      return {x,y,w:Math.max(...xs)-x+padding,h:Math.max(...ys)-y+padding};
    };
    const protectedRects:LabelRect[]=[];
    // Protect the projected ball, including its small halo, even when it is possessed.
    protectedRects.push(rect([-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>project(
      ballMesh.position.x+x*(BALL_RADIUS+.12),ballMesh.position.y+y*BALL_RADIUS,ballMesh.position.z+z*(BALL_RADIUS+.12))))),5));
    for(const side of [-1,1]) protectedRects.push(rect([0,GOAL_DEPTH].flatMap(d=>[0,2.5].flatMap(y=>[-GOAL_HALF_W,GOAL_HALF_W].map(z=>project(side*(FIELD_HALF_W+d),y,z)))),4));
    for(const p of players) if(p.alive) protectedRects.push(rect([-PLAYER_RADIUS,PLAYER_RADIUS].flatMap(dx=>[.1,3.05+p.y].map(y=>project(p.x+dx,y,p.z))),2));
    const anchors=players.filter(p=>p.alive).map(p=>{
      const v=this.players.get(p.id)!,point=project(v.anchor.position.x,v.anchor.position.y,v.anchor.position.z);
      return {id:p.id,x:point.x,y:point.y-13,w:v.width,h:22,depth:point.depth};
    }).filter(a=>a.depth>0&&a.depth<1);
    for(const v of this.players.values()){v.box.isVisible=false;v.leader.isVisible=false;}
    const placements=layoutSoccerLabels(anchors,protectedRects,{x:10,y:188,w:engine.getRenderWidth()/scale-20,h:412},this.offsets);
    for(const placement of placements) {
      const v=this.players.get(placement.id)!,a=anchors.find(a=>a.id===placement.id)!;
      v.box.isVisible=placement.visible;if(!placement.visible)continue;
      this.offsets.set(placement.id,{dx:placement.dx,dy:placement.dy});
      v.box.linkOffsetX=placement.dx;v.box.linkOffsetY=placement.dy-13;
      v.leader.isVisible=Math.hypot(placement.dx,placement.dy)>18;
      v.leader.x1=`${a.x}px`;v.leader.y1=`${a.y+10}px`;
      v.leader.x2=`${a.x+placement.dx}px`;v.leader.y2=`${a.y+placement.dy+10}px`;
    }
  }
}
