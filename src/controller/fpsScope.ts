/** A single static overlay: no extra camera, render target or post-processing. */
export function scopeAlpha(scoped:boolean,ads:number,alive:boolean,reloading:boolean):number {
  return scoped&&alive&&!reloading?Math.max(0,Math.min(1,(ads-.55)/.35)):0;
}
export function scopeSvg(width:number,height:number):string {
  const w=Math.max(2,Math.round(width)),h=Math.max(2,Math.round(height));
  const x=w/2,y=h/2,r=Math.min(w,h)*.43;
  const lines=[`<path d="M${x-r},${y}H${x-8}M${x+8},${y}H${x+r}M${x},${y-r}V${y-8}M${x},${y+8}V${y+r}" stroke="#111a16" stroke-width="1.3"/>`];
  for(let i=-4;i<=4;i++)if(i){const a=i*r/6;lines.push(`<path d="M${x+a},${y-4}v8M${x-4},${y+a}h8" stroke="#101810" stroke-width="1.3"/>`);}
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><path fill="#030605" fill-rule="evenodd" d="M0 0H${w}V${h}H0Z M${x-r} ${y}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0Z"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#7c9188" stroke-width="3"/><circle cx="${x}" cy="${y}" r="${r-4}" fill="none" stroke="#14251e" stroke-width="2"/>${lines.join('')}<circle cx="${x}" cy="${y}" r="1.5" fill="#f34538"/><text x="${x}" y="${y+r*.77}" text-anchor="middle" fill="#8dafa0" font-family="Arial" font-size="${Math.max(11,r*.08)}" letter-spacing="2">4× · PRECISION</text></svg>`);
}
