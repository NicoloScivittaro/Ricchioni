/** Common ADS contract: authoritative simulation, TV and phone use these values. */
export const FPS_ADS = {
  transition: 0.18, zoom: 1.3, movement: 0.75, sensitivity: 0.65,
  precision: 1.35, recoil: 0.65, heatDecay: 3, recoilDecay: 5
} as const;
export function aimBlend(value: number, held: boolean, dt: number): number {
  return Math.max(0, Math.min(1, value + (held ? 1 : -1) * dt / FPS_ADS.transition));
}
export function aimMovement(ads: number): number { return 1 - ads * (1 - FPS_ADS.movement); }
export function aimSensitivity(ads: number): number { return 1 - ads * (1 - FPS_ADS.sensitivity); }
export function aimFov(base: number, ads: number): number {
  return 2 * Math.atan(Math.tan(base / 2) / (1 + ads * (FPS_ADS.zoom - 1)));
}
/** +35% precision means angular dispersion divided by 1.35, not extra damage. */
export function aimSpread(base: number, ads: number, moving: number, heat: number): number {
  const hip = Math.max(base, 0.006) * (1 + moving * 0.5 + heat * 0.6);
  const sight = base / FPS_ADS.precision * (1 + moving * 0.15 + heat * 0.25);
  return hip + (sight - hip) * ads;
}
export function aimGap(spread: number, ads: number): number {
  return (5 + spread * 220) * (1 - ads) + 2 * ads;
}
const KICKS: Record<string, [number, number]> = {
  mitraglia: [0.018, 0.005], spaccatutto: [0.055, 0.012], laser: [0.024, 0.002],
  raffica: [0.025, 0.006], bombarda: [0.06, 0.008], sparapiselli: [0.008, 0.004]
};
export function aimKick(weapon: string, ads: number, random: number): { pitch: number; yaw: number } {
  const [up, side] = KICKS[weapon] ?? KICKS.mitraglia;
  const factor = 1 - ads * (1 - FPS_ADS.recoil);
  return { pitch: up * factor, yaw: (random * 2 - 1) * side * factor };
}
