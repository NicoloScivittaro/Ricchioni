import{mkdirSync,writeFileSync}from'node:fs';
import{DECK,SUITS,SUIT_DISPLAY,RANK_DISPLAY}from'../shared/trentuno/deck';
const dir='public/trentuno';mkdirSync(dir,{recursive:true});
const gold='#b89b5e',ink='#162936',cream='#fffdf4';
// Italian suit emblems are original vectors; their silhouettes remain legible in corners.
const emblems={
 DENARI:`<circle r="19" fill="#d6aa4c" stroke="#805623" stroke-width="2"/><circle r="14.5" fill="#f1d589" stroke="#a47a31" stroke-width="1.3"/>${Array.from({length:8},(_,i)=>`<ellipse cy="-8" rx="2.5" ry="4.2" fill="#a27128" transform="rotate(${i*45})"/>`).join('')}<circle r="4" fill="#f8e4ac" stroke="#966623" stroke-width="1.5"/><circle r="17" fill="none" stroke="#fff0bf" stroke-dasharray="1 3" stroke-width="1"/>`,
 COPPE:`<path d="M-13-12H-19V-6Q-19 3-9 4M13-12H19V-6Q19 3 9 4" fill="none" stroke="#ad7c36" stroke-width="3"/><path d="M-14-16H14L11-3Q9 5 0 7Q-9 5-11-3Z" fill="#b64a52" stroke="#762c35" stroke-width="1.7"/><path d="M-11-12H11L9-5H-9Z" fill="#e4b85f"/><path d="M0 6V16M-9 19Q0 12 9 19Z" fill="#c39743" stroke="#875e29" stroke-width="3"/><path d="M-15-17H15" stroke="#e6c278" stroke-width="3"/><path d="M-7-1Q-5 3-1 3" fill="none" stroke="#f1c5a0" stroke-width="1.8"/>`,
 SPADE:`<g transform="rotate(22)"><path d="M0-22-5-12-3 7H3L5-12Z" fill="#a9c1c7" stroke="#274c60" stroke-width="1.6"/><path d="M0-18V7" stroke="#f5faf4" stroke-width="1.6"/><path d="M-10 8Q0 4 10 8L10 11Q0 8-10 11Z" fill="#c69b4e" stroke="#805c2a" stroke-width="1.5"/><path d="M-2 10H2V19H-2Z" fill="#9b4650" stroke="#63353b" stroke-width="1.5"/><circle cy="21" r="3" fill="#d8b35f" stroke="#805c2a" stroke-width="1.3"/></g>`,
 BASTONI:`<g transform="rotate(25)"><path d="M-4 19-5 4-7-14Q-8-22 0-21Q8-21 6-13L4 2 3 19Q-1 23-4 19Z" fill="#95643e" stroke="#543c29" stroke-width="1.8"/><path d="M-2-16 0-4-1 17M2-13 2-7" fill="none" stroke="#d6ae70" stroke-width="1.5"/><path d="M4-7Q15-15 15-3Q10 0 4-3M-5 6Q-17-2-15 11Q-10 14-4 10" fill="#5c7c42" stroke="#365332" stroke-width="1.3"/><path d="M-4-9 0-7M0 5 4 3" stroke="#543c29" stroke-width="2"/></g>`
};
function suit(s:typeof SUITS[number],x:number,y:number,size:number,rotate=0){return `<g data-suit="${s}" transform="translate(${x} ${y}) rotate(${rotate}) scale(${size/46})">${emblems[s]}</g>`;}
const defs=`<defs><linearGradient id="paper" x2="1" y2="1"><stop stop-color="${cream}"/><stop offset="1" stop-color="#ede8d9"/></linearGradient><linearGradient id="foil" x2="1" y2="1"><stop stop-color="#e6ce8b"/><stop offset=".5" stop-color="${gold}"/><stop offset="1" stop-color="#dfc583"/></linearGradient><pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M1 1h1M4 4h1" stroke="#a89570" opacity=".10" stroke-width=".6"/></pattern><clipPath id="portrait"><rect x="49" y="66" width="142" height="204" rx="30"/></clipPath></defs>`;
const wrap=(body:string,title:string)=>`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="336" viewBox="0 0 240 336"><title>${title}</title>${defs}${body}</svg>`;
function frame(){return `<rect x="3" y="3" width="234" height="330" rx="17" fill="url(#paper)" stroke="#d7cbb1" stroke-width="2"/><rect x="8" y="8" width="224" height="320" rx="13" fill="url(#grain)"/><rect x="13" y="13" width="214" height="310" rx="10" fill="none" stroke="${gold}" stroke-width=".7"/><path d="M55 21H185M55 315H185" stroke="#c4b385" stroke-width=".6"/>`;}
function corners(s:typeof SUITS[number],rank:string){const half=`<text x="31" y="46" fill="${SUIT_DISPLAY[s].color}" text-anchor="middle" font-family="Georgia,serif" font-size="30" font-weight="bold">${rank}</text>${suit(s,31,65,23)}`;return half+`<g transform="rotate(180 120 168)">${half}</g>`;}
function horseman(s:typeof SUITS[number]){
 const accent=SUIT_DISPLAY[s].color;
 return `<g data-figure="cavallo"><path d="M60 245H182M67 248H174" stroke="${gold}" stroke-width="1.2"/>
 <path d="M92 189 87 215 80 239H88L103 216 109 194M144 190 154 215 167 238H175L162 210 160 182" fill="#b4a084" stroke="${ink}" stroke-width="2.5"/>
 <path d="M84 167Q63 164 65 196L59 208Q75 204 76 181L89 179" fill="${ink}"/>
 <path d="M85 169Q106 157 139 169L153 152 157 131 165 139 175 145 182 162 177 168 162 163Q165 182 157 195Q137 205 102 195L98 216 99 241H91L88 214 90 190Q76 181 85 169Z" fill="#e1cba8" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
 <path d="M153 152 157 131 165 139 162 150 157 168 148 176" fill="${ink}"/><path d="M164 138 168 128 171 144" fill="#d5bb94" stroke="${ink}" stroke-width="2"/>
 <circle cx="172" cy="151" r="2" fill="${ink}"/><path d="M173 159 180 158M163 147 162 160 178 165M162 157 135 157" fill="none" stroke="#8f4d3e" stroke-width="2"/>
 <path d="M105 169Q125 164 143 174L140 193 110 193Z" fill="${accent}" stroke="${gold}" stroke-width="2"/><path d="M114 179H134M118 184H130" stroke="#ead4a0"/>
 <path d="M120 147 134 162 126 179 139 194 134 199 116 184 119 168 107 157" fill="${ink}" stroke="#526578" stroke-width="2"/>
 <path d="M110 127 126 126 139 148 132 155 119 143 120 160 104 158Z" fill="${accent}" stroke="${ink}" stroke-width="2"/>
 <path d="M109 132 117 148M111 157 118 157" stroke="${gold}" stroke-width="3"/><path d="M134 149 145 155 141 160 130 154" fill="#ead6b2" stroke="${ink}" stroke-width="1.5"/>
 <path d="M108 107Q122 97 129 110L127 121 119 129 110 120Z" fill="#ead6b2" stroke="${ink}" stroke-width="2"/><path d="M105 110Q105 93 119 94Q132 96 133 110L120 105 108 113Z" fill="#8da1a7" stroke="${ink}" stroke-width="2"/><path d="M109 96Q101 82 113 78Q112 87 118 94" fill="${accent}"/><path d="M121 112h4M119 118h6" stroke="${ink}" stroke-width="1.5"/>
 <path d="M142 142V100" stroke="${gold}" stroke-width="3"/>${suit(s,81,113,32)}
 <path d="M88 240H100M165 239H176M79 239H89" stroke="${ink}" stroke-width="3"/></g>`;
}
function royal(s:typeof SUITS[number],rank:string){
 const accent=SUIT_DISPLAY[s].color,king=rank==='R',robe=king?ink:accent;
 const crown=king?`<path d="M94 103 89 81 107 89 120 69 133 89 151 81 146 103Z" fill="url(#foil)" stroke="${ink}" stroke-width="2"/><path d="M96 105H144" stroke="${accent}" stroke-width="5"/>`:`<path d="M90 103Q100 77 132 84L151 100 127 99 114 109Z" fill="${ink}"/><path d="M108 88Q95 65 86 75Q102 76 98 92" fill="${accent}"/>`;
 const hair=`<path d="M97 109Q102 96 142 110L144 128 134 113 104 118 100 130Z" fill="${ink}"/>`;
 const beard=king?`<path d="M105 133 113 137 120 135 128 137 136 132 132 150 120 157 108 147Z" fill="${ink}"/><path d="M112 143 120 148 128 142" fill="none" stroke="#d5b36c"/>`:'';
 const face=`${hair}<path d="M102 111Q120 103 138 111L135 132Q120 151 105 132Z" fill="#ead6b2" stroke="${ink}" stroke-width="1.8"/><path d="M106 119h8m12 0h8m-14 2-3 9h7m-9 6h12" fill="none" stroke="${ink}" stroke-width="1.5"/>${beard}${crown}`;
 const half=`<path d="M70 177 80 150 104 140 120 151 136 140 160 150 172 177Z" fill="${robe}" stroke="${ink}" stroke-width="2"/><path d="M85 150 112 169 108 181M155 150 128 169 132 181" fill="none" stroke="url(#foil)" stroke-width="7"/><path d="M103 148 120 160 137 148" fill="none" stroke="#ead6b2" stroke-width="8"/>${face}<path d="M158 108V180" stroke="url(#foil)" stroke-width="5"/>${suit(s,158,111,23)}<path d="M151 148q12-8 15 3l-4 12-12-4Z" fill="#ead6b2" stroke="${ink}" stroke-width="1.5"/>`;
 const art=rank==='C'?horseman(s):`${half}<g transform="rotate(180 120 168)">${half}</g><path d="M54 168H186" stroke="url(#foil)" stroke-width="3"/>`;
 return `<rect x="49" y="66" width="142" height="204" rx="30" fill="#eee7d5" stroke="url(#foil)" stroke-width="2"/><g clip-path="url(#portrait)"><path d="M50 66 191 270M49 270 191 66" stroke="${accent}" opacity=".12" stroke-width="30"/>${art}</g><text x="120" y="288" fill="${accent}" text-anchor="middle" font-family="Georgia,serif" font-size="11" letter-spacing="2">${rank==='C'?'CAVALLO':king?'RE':'FANTE'}</text>`;
}
for(const c of DECK){let art='';const n=Number(c.rank);
 if(['F','C','R'].includes(c.rank))art=royal(c.suit,c.rank);
 else if(c.rank==='A')art=`<path d="M76 123 120 98 164 123V213L120 238 76 213Z" fill="none" stroke="url(#foil)" stroke-width="1.3"/>${suit(c.suit,120,168,87)}<text x="120" y="270" fill="${gold}" font-family="Georgia" font-size="9" letter-spacing="3" text-anchor="middle">PARTY GAME</text>`;
 else {const pts=n<=3?Array.from({length:n},(_,i)=>[120,n===2?105+i*126:99+i*69]):Array.from({length:n},(_,i)=>i===n-1&&n%2?[120,168]:[i%2?157:83,105+Math.floor(i/2)*(n<6?126:63)]);art=pts.map(([x,y])=>suit(c.suit,x,y,n<4?42:35,y>168?180:0)).join('');}
 writeFileSync(`${dir}/${c.id}.svg`,wrap(frame()+corners(c.suit,RANK_DISPLAY[c.rank])+art,c.name));
}
// One constant, non-identifying back; both halves exactly rotationally symmetric.
const motif=`<path d="M64 83 120 34 176 83 120 132Z" fill="none" stroke="url(#foil)" stroke-width="1.4"/><path d="M74 83 120 44 166 83 120 122Z" fill="none" stroke="#567b8a"/><path d="M93 84 77 66 96 71Q120 51 144 71L163 66 147 84 143 102 97 102Z" fill="url(#foil)"/><path d="M103 80 115 84 104 89M137 80 125 84 136 89" fill="#122e40"/><text x="120" y="146" font-size="12" fill="#dec992" font-family="Georgia" letter-spacing="3" text-anchor="middle">GLI INFAMI</text>`;
const lattice=Array.from({length:13},(_,i)=>`<path d="M${-180+i*36} 15l306 306M${-66+i*36} 15l-306 306" stroke="#59768a" opacity=".18" stroke-width=".8"/>`).join('');
writeFileSync(`${dir}/back.svg`,wrap(`<rect x="3" y="3" width="234" height="330" rx="17" fill="#102c3c" stroke="#d4c08d" stroke-width="2"/><rect x="13" y="13" width="214" height="310" rx="10" fill="none" stroke="url(#foil)"/>${lattice}${motif}<g transform="rotate(180 120 168)">${motif}</g><circle cx="120" cy="168" r="15" fill="#102c3c" stroke="url(#foil)"/><path d="M111 168h18M120 159v18" stroke="${gold}"/>`,'Dorso · 31 degli Infami'));
writeFileSync(`${dir}/atlas.html`,`<!doctype html><html lang="it"><meta charset="utf-8"><title>31 · il nuovo mazzo</title><style>body{margin:30px;background:#102b32;color:#e9d6a2;font:16px Georgia}h1{margin:0}p{color:#adc5c2}section{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:12px}img{width:100%;filter:drop-shadow(0 5px 6px #0008)}h2{display:flex;align-items:center;gap:8px;font-size:18px;margin-top:22px}</style><h1>31 DEGLI INFAMI</h1><p>40 carte · quattro semi · Asso · 2–7 · Fante · Cavallo · Re · valori e regole conservati</p>${SUITS.map(s=>`<h2><svg width="24" height="24" viewBox="-24 -24 48 48" aria-hidden="true">${emblems[s]}</svg> ${SUIT_DISPLAY[s].name.toUpperCase()}</h2><section>${DECK.filter(c=>c.suit===s).map(c=>`<img src="${c.id}.svg" alt="${c.name}">`).join('')}</section>`).join('')}</html>`);
console.log('40 SVG premium e dorso comune generati.');
