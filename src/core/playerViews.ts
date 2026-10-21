/** View ownership follows people, independently of their input device or bot opponents. */
export function humanViewPlayers<T extends {bot?: boolean}>(players: readonly T[]): T[] {
  return players.filter(player => !player.bot);
}

export interface ViewportRect {x: number; y: number; w: number; h: number}

// Shared immutable layouts; no allocation for every HUD/frame. Babylon uses a bottom-left origin.
const LAYOUTS: readonly (readonly ViewportRect[])[] = [
  [],
  [{x:0,y:0,w:1,h:1}],
  [{x:0,y:0,w:.5,h:1},{x:.5,y:0,w:.5,h:1}],
  [{x:0,y:.5,w:.5,h:.5},{x:.5,y:.5,w:.5,h:.5},{x:0,y:0,w:1,h:.5}],
  [{x:0,y:.5,w:.5,h:.5},{x:.5,y:.5,w:.5,h:.5},{x:0,y:0,w:.5,h:.5},{x:.5,y:0,w:.5,h:.5}],
  [{x:0,y:.5,w:1/3,h:.5},{x:1/3,y:.5,w:1/3,h:.5},{x:2/3,y:.5,w:1/3,h:.5},{x:0,y:0,w:.5,h:.5},{x:.5,y:0,w:.5,h:.5}]
];

export function splitScreenLayout(count: number): readonly ViewportRect[] {
  return LAYOUTS[Math.max(0, Math.min(5, Math.trunc(count)))];
}
