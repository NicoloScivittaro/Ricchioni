import { mkdirSync,writeFileSync } from 'node:fs';
import { DECK,SUITS,SUIT_CHARACTER } from '../shared/trentuno/deck';
const dir='public/trentuno';mkdirSync(dir,{recursive:true});
const colors={DENARI:'#aa771e',COPPE:'#76549c',SPADE:'#922f35',BASTONI:'#487248'};
const gold='#cfa653',ink='#263e35';
function symbol(suit:string,x:number,y:number,size:number,rotate=0):string{
 const shape=suit==='DENARI'?`<circle r="17" fill="#d9af50"/><circle r="12" fill="none" stroke="#81591b" stroke-width="2"/><path d="M-9 3 -9-7 -3-2 0-10 4-2 9-7 9 3Z" fill="#fff0bb"/><path d="M-7 7H7"/>`
 :suit==='COPPE'?`<path d="M-12-14H12L9 0Q7 8 0 8Q-7 8-9 0Z" fill="#b280bc"/><path d="M-12-10Q-23-10-18-1L-8 3M12-10Q23-10 18-1L8 3" fill="none"/><path d="M0 8V15M-9 16H9"/><path d="M-8-9H8M-6-4H6" stroke="#ffdf8c"/>`
 :suit==='SPADE'?`<path d="M0-20 6-9 3 10H-3L-6-9Z" fill="#d0d9d5"/><path d="M0-16V10" stroke="#536866"/><path d="M-10 9H10" stroke="#aa4342" stroke-width="5"/><path d="M0 11V21" stroke="#503726" stroke-width="5"/><circle cy="22" r="3" fill="#d5b05f"/>`
 :`<path d="M-5-19Q2-23 5-18L7 17Q2 22-4 18Z" fill="#b76d32"/><path d="M-1-13 3-6 -2 0 3 8 -1 15" fill="none" stroke="#e1b266"/><path d="M-4-7Q-20-19-14-3ZM5 5Q20-5 16 11Z" fill="#487e4a"/>`;
 return `<g transform="translate(${x} ${y}) rotate(${rotate}) scale(${size/40})" stroke="#4c492d" stroke-width="1.7" stroke-linejoin="round">${shape}</g>`;
}
function crown(x=0,y=-45,size=1):string{return `<g transform="translate(${x} ${y}) scale(${size})"><path d="M-29 3 -34-18 -16-8 0-29 16-8 34-18 29 3Z" fill="#d4ae54" stroke="#624519" stroke-width="3"/><path d="M-29 3H29V13H-29Z" fill="#e0bc6c" stroke="#624519" stroke-width="2"/><circle cy="-11" r="4" fill="#a53a39"/><circle cx="-20" cy="-8" r="3" fill="#467847"/><circle cx="20" cy="-8" r="3" fill="#467847"/></g>`;}
function face(char:string,x:number,y:number,scale=1,royal=false):string{
 const goblin=char==='goblin',ciro=char==='ciro',boschi=char==='buttafuori',carbo=char==='judoka',skin=goblin?'#91b85c':ciro?'#d9a06a':boschi?'#c99573':'#e7b68e';
 const hair=goblin?`<path d="M-30-30Q-40-52-20-46Q-16-57-3-49Q4-60 16-46Q38-48 32-28" fill="#29492a"/>`
 :ciro?`<path d="M-5-42Q-8-52-12-47M8-43Q8-55 14-48" fill="none" stroke-width="3"/>`
 :boschi?`<path d="M-31-26Q-33-45 0-47Q33-45 31-26L20-31H-20Z" fill="#352e29"/>`
 :`<path d="M-32-24Q-42-42-22-43L-25-50 -10-45 0-52 9-43 25-47 33-33 29-20 15-32 -5-27 -20-33Z" fill="#443427"/>`;
 const eyes=boschi?`<path d="M-30-11H30" stroke-width="4"/><path d="M-25-16H-3V-2Q-13 6-24-3ZM3-16H25L24-3Q13 6 3-2Z" fill="#172326"/><path d="M-20-13 -12-6M8-13 16-6" stroke="#7a9a92"/>`
 :`<ellipse cx="-13" cy="-8" rx="8" ry="10" fill="#f9f2d6"/><ellipse cx="13" cy="-8" rx="8" ry="10" fill="#f9f2d6"/><circle cx="-11" cy="-6" r="3.5" fill="#172620"/><circle cx="11" cy="-6" r="3.5" fill="#172620"/>${carbo||char==='dottore'?'<g fill="none" stroke="#40372c" stroke-width="3"><circle cx="-13" cy="-8" r="12"/><circle cx="13" cy="-8" r="12"/><path d="M-1-8H1"/></g>':''}${char==='dottore'?'<path d="M-22-13H-4M4-13H22" stroke="#956e51" stroke-width="5"/>':'<path d="M-25-22 -7-17M7-17 25-23" stroke-width="4"/>'}`;
 const mouth=goblin?`<path d="M-20 11Q1 33 23 8Q4 44-20 11Z" fill="#293a25"/><path d="M-14 13 -9 23 -3 18 3 24 7 16 16 13" fill="#fff1c8"/><path d="M3 23Q5 50 18 34L17 22Z" fill="#c45458"/><path d="M10 26V35"/>`
 :ciro?`<path d="M-27 11Q-19 43 0 42Q22 40 28 11L16 18 0 29 -16 18Z" fill="#4a3528"/><path d="M-14 12Q4 21 18 8" fill="none" stroke-width="3"/>`
 :boschi?`<path d="M-18 18H18" stroke-width="4"/><path d="M-13 11Q0 8 13 11" stroke-width="3"/>`
 :`<path d="M-14 14Q0 ${carbo?'8':'25'} 16 14" fill="none" stroke-width="3"/>`;
 return `<g transform="translate(${x} ${y}) scale(${scale})" stroke="#443c2a" stroke-width="2" stroke-linejoin="round">${goblin?'<path d="M-27-12 -53-25 -40 10 -26 8M27-12 53-25 40 10 26 8" fill="#82aa51"/>':''}<ellipse cy="-1" rx="32" ry="41" fill="${skin}"/>${hair}${eyes}<path d="M-2-2 -5 7 4 7" fill="none"/>${mouth}${royal?crown():''}</g>`;
}
function figure(suit:string,rank:string):string{
 const char=rank==='F'&&suit==='COPPE'||rank==='C'&&suit==='BASTONI'?'dottore':SUIT_CHARACTER[suit as keyof typeof SUIT_CHARACTER];
 const robe=char==='goblin'?'#476c38':char==='ciro'?'#755a89':char==='buttafuori'?'#343738':char==='judoka'?'#e5ddc6':'#a3b4a2';
 const horseback=rank==='C';
 const throne=rank==='R'?`<path d="M48 261V131Q110 101 172 131V261Z" fill="#3b6750" stroke="${gold}" stroke-width="5"/><path d="M53 124 62 113 75 124M145 124 158 113 167 124" fill="${gold}"/>`:'';
 const horse=horseback?`<g stroke="#55402c" stroke-width="3"><path d="M48 247Q37 210 72 209H133L137 168 157 143 171 148 177 167 166 189 158 218 149 239 158 276H141L129 246H79L71 277H54L61 247Z" fill="${suit==='SPADE'?'#77827b':'#bc936b'}"/><path d="M143 154 151 149 158 166 145 175M140 204Q164 215 156 225" fill="none"/><circle cx="166" cy="161" r="3"/><path d="M55 218Q27 214 33 243" fill="none" stroke="#433526" stroke-width="6"/></g>`:'';
 const body=`<path d="M79 160Q108 141 142 164L${horseback?'147 229 80 220':'153 269 66 269'}Z" fill="${robe}" stroke="#514333" stroke-width="3"/>${char==='judoka'?'<path d="M83 158 114 199 135 160 100 202M72 224H146M103 224 96 259M113 224 119 258" fill="none" stroke="#734a24" stroke-width="7"/>':char==='ciro'?'<path d="M90 162Q109 193 131 162" fill="none" stroke="#ddb056" stroke-width="6"/>':char==='dottore'?'<path d="M73 211Q107 249 148 210" fill="none" stroke="#819081" stroke-width="3"/>':'<path d="M103 170V258" stroke="#d0a85a" stroke-width="3"/>'}<path d="M79 170 57 206 68 220 93 193M139 174 165 199 154 214 128 194" fill="${robe}" stroke="#514333" stroke-width="3"/>`;
 const props=char==='dottore'?`<path d="M155 186H174L170 218H157Z" fill="#d9e1ce" stroke="#466448" stroke-width="2"/><path d="M158 181H174" stroke="#37614d" stroke-width="6"/>`:symbol(suit,162,199,44,suit==='SPADE'?-15:0);
 const cameo=char==='dottore'?SUIT_CHARACTER[suit as keyof typeof SUIT_CHARACTER]:'dottore';
 return `${throne}${horse}${body}${face(char,110,125,rank==='R'?1.04:.93,rank==='R')}${props}<circle cx="46" cy="276" r="22" fill="#d9ca9c" stroke="${gold}" stroke-width="2"/>${face(cameo,46,276,.43)}<path d="M81 284H156" stroke="${gold}"/><text x="117" y="302" font-size="10" fill="${ink}" text-anchor="middle" font-family="Georgia">${rank==='F'?'IL COMPARE':rank==='C'?'IL CAVALIERE':'IL RE DEL TAVOLO'}</text>`;
}
function wear():string{return Array.from({length:22},(_,i)=>{const x=15+(i*37)%190,y=22+(i*61)%295;return `<circle cx="${x}" cy="${y}" r=".8" fill="#927951" opacity=".16"/><circle cx="${220-x}" cy="${340-y}" r=".8" fill="#927951" opacity=".16"/>`;}).join('');}
function frame():string{return `<rect x="3" y="3" width="214" height="334" rx="15" fill="url(#paper)" stroke="#b69a56" stroke-width="5"/><rect x="12" y="12" width="196" height="316" rx="10" fill="none" stroke="#40634b" stroke-width="1.5"/><rect x="17" y="17" width="186" height="306" rx="7" fill="none" stroke="#c8ad71"/>${[[20,20,0],[200,320,180],[200,20,90],[20,320,270]].map(([x,y,a])=>`<path d="M0 23Q17 23 9 9Q23 17 23 0M2 15Q11 11 15 2" transform="translate(${x} ${y}) rotate(${a})" fill="none" stroke="${gold}" stroke-width="2"/>`).join('')}${wear()}`;}
const defs=`<defs><radialGradient id="paper"><stop stop-color="#fff6dd"/><stop offset="1" stop-color="#e5d4a8"/></radialGradient><radialGradient id="felt"><stop stop-color="#175a46"/><stop offset="1" stop-color="#092f28"/></radialGradient></defs>`;
const wrap=(body:string)=>`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="340" viewBox="0 0 220 340">${defs}${body}</svg>`;
const corners=(rank:string,suit:string)=>`<g fill="${colors[suit as keyof typeof colors]}" font-family="Georgia,serif" font-weight="bold" text-anchor="middle"><text x="36" y="56" font-size="31">${rank}</text>${symbol(suit,36,77,26)}<g transform="rotate(180 110 170)"><text x="36" y="56" font-size="31">${rank}</text>${symbol(suit,36,77,26)}</g></g>`;
for(const c of DECK){
 let body:string;
 if(['F','C','R'].includes(c.rank))body=figure(c.suit,c.rank);
 else if(c.rank==='A')body=`<path d="M65 137Q110 93 155 137L163 190Q110 240 57 190Z" fill="#e5d4a2" stroke="${gold}" stroke-width="3"/>${symbol(c.suit,110,172,91)}${face(SUIT_CHARACTER[c.suit],110,269,.47)}${crown(110,115,.48)}`;
 else {const n=Number(c.rank),positions:{x:number;y:number}[]=n===2?[{x:110,y:117},{x:110,y:232}]:n===3?[{x:110,y:112},{x:110,y:170},{x:110,y:232}]:Array.from({length:n},(_,i)=>({x:i===n-1&&n%2?110:i%2?144:76,y:i===n-1&&n%2?170:110+Math.floor(i/2)*(n<=5?123:62)}));body=positions.map((p,i)=>symbol(c.suit,p.x,p.y,n<=3?52:n>=6?36:43,p.y>180?180:0)).join('')+face(SUIT_CHARACTER[c.suit],110,280,.31);}
 writeFileSync(`${dir}/${c.id}.svg`,wrap(frame()+corners(c.rank,c.suit)+body));
}
// Due metà identiche ruotate: testo, goblin, semi e usura conservano la simmetria 180°.
const half=`<text x="110" y="47" fill="#e5c575" font-family="Georgia" font-size="16" font-weight="bold" text-anchor="middle">31 DEGLI INFAMI</text><path d="M47 64Q110 47 173 64M58 71Q110 55 162 71" fill="none" stroke="${gold}"/>${face('goblin',110,132,.66,true)}${symbol('DENARI',46,103,24)}${symbol('COPPE',174,103,24)}${symbol('SPADE',46,143,24)}${symbol('BASTONI',174,143,24)}<path d="M70 170H150" stroke="${gold}"/>`;
writeFileSync(`${dir}/back.svg`,wrap(frame().replace('url(#paper)','url(#felt)')+half+`<g transform="rotate(180 110 170)">${half}</g>`));
writeFileSync(`${dir}/atlas.html`,`<!doctype html><html lang="it"><meta charset="utf-8"><title>31 DEGLI INFAMI · il mazzo completo</title><style>body{background:#092f28;color:#efcf83;font-family:Georgia;margin:32px}h1{font-size:36px;margin:0}p{color:#bfbfa1}section{display:grid;grid-template-columns:repeat(10,1fr);gap:12px;margin:12px 0 26px}img{width:100%;filter:drop-shadow(0 4px 5px #0008)}h2{font-size:18px;margin:20px 0 0}.back{position:absolute;right:36px;top:18px;width:62px}</style><h1>31 DEGLI INFAMI</h1><p>40 carte originali · A, 2–7, Fante, Cavallo, Re · PARTY GAME</p><img class="back" src="back.svg" alt="Dorso comune">${SUITS.map(s=>`<h2>${s}</h2><section>${DECK.filter(c=>c.suit===s).map(c=>`<img src="${c.id}.svg" alt="${c.name}">`).join('')}</section>`).join('')}</html>`);
console.log('40 carte SVG, dorso simmetrico e galleria creati.');
