import { CARD_BY_ID } from './catalog';
export const TYPE_COLOR = {AZIONE:'#59a8ff',TRAPPOLA:'#ff737b',RISPOSTA:'#5ee3a2',CATASTROFE:'#c79aff'} as const;
export const htmlEscape=(text:string):string=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
/** Illustrazione locale e deterministica: combinazione univoca di soggetto, sigillo e composizione. */
export function cardArt(id:string):string {
  const c=CARD_BY_ID[id];if(!c)return '';
  let hash=0;for(const char of id)hash=(hash*31+char.charCodeAt(0))>>>0;
  const color=TYPE_COLOR[c.type];const n=parseInt(id.slice(-2),10);const family=c.characterId??(['goblin','buttafuori','dottore','judoka','ciro'][n%5]);
  const props=[
    '<path d="M126 22h55l-4 102-8-7-9 7-9-7-9 7-9-7z"/><path d="M137 44h31M137 57h20M137 70h30"/>',
    '<path d="M148 34v-9h15v9m-20 0h27v80h-27z"/><path d="M146 64h21"/>',
    '<path d="M130 87h55m-46 0 5 29h29l5-29M142 57q-10 11 0 22m14-29q-10 15 0 25"/>',
    '<path d="M127 93 138 51l21 16 20-16 10 42z"/><circle cx="158" cy="90" r="4"/>',
    '<circle cx="154" cy="76" r="34"/><path d="M154 52v24l16 11m-36-54-12 11m56-11 12 11"/>',
    '<path d="M129 45h52v72h-52zM138 64h34M138 79h34M139 99h12"/><path d="m160 103 6 6 18-25"/>',
    '<path d="m128 45 24-16 35 29-24 16zM136 91l40-8-16 29z"/><path d="M128 117h56"/>',
    '<circle cx="154" cy="76" r="30"/><path d="M165 58h-14q-14 8 2 17t2 18h-14M154 52v49"/>'
  ];
  const face=family==='goblin'?'<path d="m35 56-20-18 12 29m53-11 20-18-12 29"/>':family==='buttafuori'?'<path d="M30 63h20v13H30zm31 0h20v13H61M50 67h11"/>':family==='dottore'?'<circle cx="40" cy="67" r="12"/><circle cx="69" cy="67" r="12"/><path d="M52 67h5"/>':family==='judoka'?'<path d="m25 102 30 29 28-29m-28 29-16 12m16-12 17 12"/>':'<path d="M50 40V24m10 17 3-18M40 89q14 19 30 0"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 150" role="img" aria-label="${htmlEscape(c.name)}"><rect width="220" height="150" rx="12" fill="#101c2b"/><circle cx="110" cy="72" r="${52+hash%18}" fill="${color}" opacity=".08"/><g stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 143q8-39 42-39t43 39"/><rect x="26" y="43" width="57" height="56" rx="21"/>${face}<path d="M47 84q9 6 18 0"/><g transform="rotate(${hash%21-10} 155 78)">${props[n%props.length]}</g><path d="M94 82h22m-7-7 7 7-7 7" opacity=".5"/></g><text x="205" y="140" text-anchor="end" fill="${color}" font-family="Arial,sans-serif" font-size="12" font-weight="bold">${htmlEscape(id)}</text><circle cx="${12+hash%18}" cy="${10+hash%12}" r="4" fill="${color}"/><path d="M10 132h${14+hash%12}" stroke="${color}"/></svg>`;
}
