import { Color3, Constants, DynamicTexture, Matrix, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import { Control, Rectangle, TextBlock } from '@babylonjs/gui';
import { hudPanel, hudText } from '../hud/hudKit';
import type { SoccerHud } from './soccerHud';
import { CHARGE_TIME, TEAM_COLOR } from './soccerTypes';
import type { SoccerBall, SoccerPlayer } from './soccerTypes';

/** Solo presentazione. Oggetti limitati al roster, nessuna scrittura in fisica/punteggi/abilità. */
export class SoccerReadability {
  private players = new Map<string, { ring: Mesh; team: Mesh; anchor: Mesh; box: Rectangle; name: TextBlock;
    power: Rectangle; fill: Rectangle; status: TextBlock }>();
  private ballRing: Mesh;
  private ballShadow: Mesh;
  private ballAnchor: Mesh;
  private ballLabel: TextBlock;
  private possession: TextBlock;
  constructor(private scene: Scene, hud: SoccerHud, players: SoccerPlayer[], ballMesh: Mesh) {
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
    for (const p of players) {
      const personal = ring(`soccerIdentity:${p.id}`, 2.1, .13, mat(`soccerPersonal:${p.id}`, p.color));
      const team = ring(`soccerTeam:${p.id}`, 2.65, .07, teams[p.team]);
      const anchor = new Mesh(`soccerLabel:${p.id}`, scene);
      const box = hudPanel(`soccerName:${p.id}`, '118px', '52px', p.color);
      box.cornerRadius = 7; hud.adt.addControl(box); box.linkWithMesh(anchor);
      const name = hudText('identity', p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name, 16, p.color);
      name.top = '-13px'; name.height = '20px'; name.outlineWidth = 0; box.addControl(name);
      const status = hudText('team', p.team === 'red' ? '▲ ROSSI' : '● BLU', 12, TEAM_COLOR[p.team]);
      status.top = '5px'; status.height = '18px'; status.outlineWidth = 0; box.addControl(status);
      const power = new Rectangle('chargeTrack'); power.width = '96px'; power.height = '5px';
      power.top = '20px'; power.thickness = 0; power.background = '#475569'; box.addControl(power);
      const fill = new Rectangle('chargeFill'); fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      fill.height = '100%'; fill.thickness = 0; fill.background = '#22d3ee'; power.addControl(fill);
      this.players.set(p.id, { ring: personal, team, anchor, box, name, power, fill, status });
    }
    this.ballShadow = MeshBuilder.CreateDisc('soccerBallShadow', { radius: .65, tessellation: 24 }, scene);
    this.ballShadow.rotation.x = Math.PI / 2;
    const shadow = mat('soccerShadowMat', '#080b0e'); shadow.alpha = .55; shadow.backFaceCulling = false;
    this.ballShadow.material = shadow; this.ballShadow.isPickable = false;
    this.ballRing = ring('soccerBallIndicator', 1.6, .085, mat('soccerBallIndicatorMat', '#fde047', true));
    this.ballRing.renderingGroupId = 1;
    // Mantieni il depth buffer della scena: solo l'indicatore della palla è visibile attraverso corpi.
    scene.setRenderingAutoClearDepthStencil(1, false);
    this.ballAnchor = new Mesh('soccerBallLabelAnchor', scene);
    this.ballLabel = hudText('soccerBallLabel', 'PALLA', 12, '#fde047');
    this.ballLabel.width = '62px'; this.ballLabel.height = '20px'; this.ballLabel.linkOffsetY = 17;
    hud.adt.addControl(this.ballLabel); this.ballLabel.linkWithMesh(this.ballAnchor);
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
  }
  update(players: SoccerPlayer[], ball: SoccerBall, active: boolean, aimColor: string): void {
    const owner = active ? players.find(p => p.id === ball.ownerId && p.alive && p.hasBall) : undefined;
    this.possession.text = !active ? '' : owner ? `PALLA: ${owner.name}  ·  ${owner.team === 'red' ? '▲ ROSSI →' : '← ● BLU'}${owner.charging ? '  ·  RILASCIA PER TIRARE' : ''}` : 'PALLA LIBERA';
    for (const p of players) {
      const v = this.players.get(p.id)!;
      v.ring.position.set(p.x, .055, p.z); v.team.position.set(p.x, .04, p.z);
      v.anchor.position.set(p.x, 3.1 + p.y, p.z);
      v.box.isVisible = p.alive; v.ring.isVisible = v.team.isVisible = p.alive;
      const hasBall = p === owner, charge = hasBall && p.charging;
      v.box.color = hasBall ? '#fde047' : p.color; v.box.thickness = hasBall ? 3 : 2;
      v.status.text = charge ? `${Math.round(Math.min(1, p.chargeTime / CHARGE_TIME) * 100)}% · RILASCIA` : `${hasBall ? 'PALLA · ' : ''}${p.team === 'red' ? '▲ ROSSI' : '● BLU'}`;
      v.status.color = charge ? aimColor : hasBall ? '#fde047' : TEAM_COLOR[p.team];
      v.power.isVisible = !!charge; v.fill.width = `${Math.min(1, p.chargeTime / CHARGE_TIME) * 100}%`; v.fill.background = aimColor;
    }
    // Risolvi le sovrapposizioni in pixel, non in metri: funziona anche al cambio di risoluzione/zoom.
    const camera = this.scene.activeCamera!;
    const engine = this.scene.getEngine(), h = engine.getRenderHeight(), scale = h / 720;
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), h);
    const placed: { x: number; y: number }[] = [];
    for (const p of [...players].sort((a, b) => a.id.localeCompare(b.id))) {
      if (!p.alive) continue;
      const v = this.players.get(p.id)!;
      const point = Vector3.Project(v.anchor.position, Matrix.Identity(), this.scene.getTransformMatrix(), viewport);
      const base = Math.max(188 * scale, Math.min(h - 120 * scale, point.y));
      let y = base;
      for (let tries = 0; tries <= players.length * 2; tries++) {
        const candidate = base + (tries % 2 ? -1 : 1) * Math.ceil(tries / 2) * 56 * scale;
        if (candidate < 188 * scale || candidate > h - 120 * scale) continue;
        if (placed.some(q => Math.abs(q.x - point.x) < 126 * scale && Math.abs(q.y - candidate) < 56 * scale)) continue;
        y = candidate;
        break;
      }
      v.box.linkOffsetY = (y - point.y) / scale;
      placed.push({ x: point.x, y });
    }
    this.ballRing.position.set(ball.x, .09, ball.z); this.ballShadow.position.set(ball.x, .025, ball.z);
    this.ballAnchor.position.set(ball.x, .55, ball.z); this.ballLabel.isVisible = active && !owner;
  }
}
