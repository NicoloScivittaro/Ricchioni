import { Matrix, Quaternion, TransformNode, Vector3 } from '@babylonjs/core';
import type { Bone } from '@babylonjs/core';
import { GoblinAnimator, GOBLIN_CLIPS } from './goblinAnimator';
import type { GoblinAnimationState } from './goblinAnimator';

type Target = { node: TransformNode | Bone; quat: Quaternion | null; pos: Vector3 };
type Joint = Target & { axes: Vector3[]; previous: Quaternion };

/** Temporary render poses for a skinned asset with NO embedded clips.
 * Only the semantic clock is reused; no Goblin animation tracks are retargeted.
 * Linked nodes are posed relative to their own bind, with model axes converted
 * to each joint's local space (including the glTF handedness conversion).
 */
export class ProceduralSkinAnimator {
  readonly controller: GoblinAnimator;
  readonly activeTracks = 0;
  sampleMs = 0;
  private joints = new Map<string, Joint>();
  private readonly timing = new Map(GOBLIN_CLIPS.map(c => [c.name.split('.')[1], c]));
  private clock = 0;

  constructor(targets: Map<string, Target>, inner: TransformNode, namespace: string) {
    // These ranges are timing templates, never authored clips of this asset.
    this.controller = new GoblinAnimator(GOBLIN_CLIPS.map(c => ({ ...c, name: `${namespace}.${c.name.split('.')[1]}` })), namespace);
    const inverse = Matrix.Invert(inner.computeWorldMatrix(true));
    for (const [name, target] of targets) {
      if (!target.quat) continue;
      const relative = target.node.computeWorldMatrix(true).multiply(inverse);
      const local = Matrix.Invert(relative);
      const sign = relative.determinant() < 0 ? -1 : 1;
      const axes = [Vector3.Right(), Vector3.Up(), Vector3.Forward()].map(v => Vector3.TransformNormal(v, local).normalize().scale(sign));
      this.joints.set(name.replace('mixamorig:', ''), { ...target, axes, previous: target.quat.clone() });
    }
  }

  update(dt: number, state: Readonly<GoblinAnimationState>): void {
    const start = performance.now();
    dt = Math.max(0, Math.min(.1, dt)); this.clock += dt;
    const sample = this.controller.update(dt, state);
    const name = sample.name.split('.')[1];
    const angles = new Map<string, [number, number, number]>();
    const set = (joint: string, x = 0, y = 0, z = 0): void => { angles.set(joint, [x, y, z]); };
    const air = state.grounded === false || state.falling;
    const moving = name === 'run' || name === 'dash';
    const swing = moving ? Math.sin(this.clock * (name === 'dash' ? 13 : 9) * sample.speed) : 0;
    const amount = moving ? .38 : 0;
    set('LeftUpLeg', swing * amount); set('RightUpLeg', -swing * amount);
    set('LeftLeg', -Math.max(0, -swing) * .48); set('RightLeg', -Math.max(0, swing) * .48);
    set('LeftArm', -swing * .22); set('RightArm', swing * .22);
    set('Spine', moving ? .07 : Math.sin(this.clock * 2) * .012);
    if (air) {
      set('LeftUpLeg', .22); set('RightUpLeg', .12);
      set('LeftLeg', -.32); set('RightLeg', -.24);
      set('LeftArm', -.12, 0, -.10); set('RightArm', -.12, 0, .10);
    }
    // Pose amplitude peaks in the already existing gameplay active interval.
    const attack = state.attack;
    const timing = this.timing.get(name);
    const progress = timing ? Math.max(0, Math.min(1, (sample.seconds - timing.from) / (timing.to - timing.from))) : 0;
    const contact = attack ? attack.startup + attack.active * .35 : 0;
    const total = attack ? attack.startup + attack.active + attack.recovery : 0;
    const envelope = attack
      ? Math.max(0, attack.elapsed <= contact ? attack.elapsed / Math.max(.001, contact) : (total - attack.elapsed) / Math.max(.001, total - contact))
      : Math.sin(Math.PI * progress);
    if (sample.priority >= 40 && sample.priority < 80) {
      const a = Math.max(0, envelope);
      if (/Kick|roundhouse/.test(name)) { set('RightUpLeg', .85 * a); set('RightLeg', -.18 * a); }
      else { set('RightArm', -.85 * a, 0, -.12 * a); set('RightForeArm', -.4 * a); set('Spine2', 0, -.10 * a); }
    }
    if (sample.priority === 80) { set('Spine', -.16); set('Head', -.12); }
    if (name === 'victory') { set('LeftArm', 0, 0, -1.45); set('RightArm', 0, 0, 1.45); }
    if (name === 'defeat' || name === 'ko') { set('Spine', .25); set('Head', .20); }
    if (name === 'dodge') { set('LeftUpLeg', .32); set('RightUpLeg', .32); set('LeftLeg', -.55); set('RightLeg', -.55); set('Spine', .2); }
    const blend = dt === 0 ? 1 : 1 - Math.exp(-dt / Math.max(.035, sample.blend));
    for (const [joint, target] of this.joints) {
      let rotation = target.quat!.clone();
      const pose = angles.get(joint);
      if (pose) for (let axis = 0; axis < 3; axis++) if (pose[axis]) rotation = rotation.multiply(Quaternion.RotationAxis(target.axes[axis], pose[axis]));
      Quaternion.SlerpToRef(target.previous, rotation, blend, target.previous);
      target.node.rotationQuaternion = target.previous.clone();
      // All translations remain at bind; gameplay owns the trajectory.
      target.node.position.copyFrom(target.pos);
    }
    this.sampleMs = performance.now() - start;
  }
}
