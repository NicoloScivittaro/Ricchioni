/** Art baked into an EXISTING texture, once at creation. No new GPU resource or frame work. */
export function paintSurfaceDetail(c: CanvasRenderingContext2D, w: number, h: number, kind: 'stone' | 'wood' | 'turf' | 'sand', seed = 17): void {
  c.save();
  let state = seed >>> 0 || 1;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  // Periodic tonal wash: endpoints match so repeating surfaces remain seamless.
  const wash = c.createLinearGradient(0, 0, w, 0);
  wash.addColorStop(0, 'rgba(9,22,35,0.025)');
  wash.addColorStop(.25, 'rgba(255,244,219,0.07)');
  wash.addColorStop(.5, 'rgba(9,22,35,0.045)');
  wash.addColorStop(.75, 'rgba(255,244,219,0.07)');
  wash.addColorStop(1, 'rgba(9,22,35,0.025)');
  c.fillStyle = wash; c.fillRect(0, 0, w, h);
  const count = Math.min(900, Math.ceil(w * h / 700));
  for (let i = 0; i < count; i++) {
    const x = random() * w, y = random() * h;
    c.fillStyle = i % 2 ? 'rgba(255,248,226,0.09)' : 'rgba(16,26,32,0.055)';
    if (kind === 'wood') c.fillRect(x, y, 8 + random() * 26, .7);
    else if (kind === 'turf') c.fillRect(x, y, .8, 2 + random() * 3);
    else if (kind === 'sand') { c.beginPath(); c.ellipse(x,y,2+random()*8,.6,-.15,0,Math.PI*2);c.fill(); }
    else c.fillRect(x, y, 1 + random() * 2, 1);
  }
  c.restore();
}

/** Recess/bevel painted inside existing window and tile artwork, never geometry. */
export function paintRecess(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lip = 2): void {
  c.save();
  c.fillStyle = 'rgba(9,18,30,0.24)'; c.fillRect(x, y, w, lip); c.fillRect(x, y, lip, h);
  c.fillStyle = 'rgba(255,242,210,0.3)'; c.fillRect(x, y+h-lip, w, lip); c.fillRect(x+w-lip, y, lip, h);
  c.restore();
}
