import type { MinigameDefinition } from '../../shared/types';
/** Small original vector illustrations: no model downloads or textures in the menu. */
export function gameAccent(def?: MinigameDefinition): string {
    if (!def)
        return '#d4b3ff';
    if (def.id === 'backrooms')
        return '#e2cf78';
    if (def.id === 'fps')
        return '#ff997b';
    if (def.id === 'orda')
        return '#c7b577';
    return ({ SPORT: '#86e3bd', GUIDA: '#8cbfff', ARENA: '#ff997b', CULTURA: '#c3a6ff', MEMORIA: '#f0a7d3', RIFLESSI: '#f8db81', FORTUNA: '#f1c48b', SKILL: '#88d4e9', PUZZLE: '#a8c8ff' } as Record<string, string>)[def.category] ?? '#a7cfdb';
}
export function gameArtwork(def?: MinigameDefinition): string {
    const color = gameAccent(def), id = def?.id ?? 'random', cat = def?.category;
    let art = '';
    if (!def)
        art = `<g transform="translate(320 175) rotate(-18)"><circle r="119" fill="#151c35" stroke="${color}" stroke-width="3"/><circle r="92" fill="none" stroke="${color}" stroke-width="38" stroke-dasharray="39 9" opacity=".65"/><circle r="48" fill="#202845" stroke="${color}" stroke-width="2"/><path d="m-14-26 42 26-42 26z" fill="${color}"/><path d="m0-148-13-25h26z" fill="#ffdc96"/></g><circle cx="125" cy="96" r="8" fill="#f9d98b"/><path d="m488 248 10-19 10 19-10-6z" fill="#91e8cd"/>`;
    else if (id === 'orda')
        art = `<g stroke="${color}" stroke-width="3" fill="#243733"><path d="M130 270V120l190-80 190 80v150z"/><path d="M180 270V150h280v120"/><path d="M200 180h65v90h-65m175-90h65v90h-65"/></g><g fill="${color}"><circle cx="315" cy="149" r="20"/><path d="m291 175 45-3 12 78h-68z"/><path d="m293 183-35 36 13 13 39-28m21-18 34 24-5 14-36-19"/></g><g fill="#fa9974"><ellipse cx="234" cy="173" rx="6" ry="4"/><ellipse cx="249" cy="173" rx="6" ry="4"/><ellipse cx="393" cy="165" rx="6" ry="4"/><ellipse cx="408" cy="165" rx="6" ry="4"/></g><path d="M320 105v-25m0 171v35M252 193h-30m145 0h30" stroke="#f2d6a4" stroke-width="3"/>`;
    else if (id === 'backrooms')
        art = `<g fill="#2a2a23" stroke="${color}" stroke-width="3"><path d="M130 255V75h140v66h-64v114z"/><path d="M307 255V75h166v180h-66V141h-34v114z"/></g><g fill="${color}" opacity=".4"><path d="M155 88h90v9h-90zM323 88h132v9H323z"/></g><ellipse cx="294" cy="205" rx="8" ry="5" fill="#fff0b7"/><ellipse cx="319" cy="205" rx="8" ry="5" fill="#fff0b7"/><path d="M292 223q16 15 30 0" fill="none" stroke="#fff0b7" stroke-width="3"/>`;
    else if (cat === 'GUIDA')
        art = `<path d="M125 320 276 30h88l151 290" fill="#26334e" stroke="${color}" stroke-width="3"/><path d="M320 310V62" stroke="${color}" stroke-width="6" stroke-dasharray="26 21" opacity=".6"/><g transform="translate(320 200) rotate(-13)"><rect x="-65" y="-53" width="130" height="106" rx="30" fill="${color}"/><rect x="-45" y="-28" width="90" height="37" rx="15" fill="#1b2c43"/><path d="M-78-30v22m156-22v22m-156 45v22m156-22v22" stroke="#101728" stroke-width="18" stroke-linecap="round"/><path d="M-28 57v35m56-35v35" stroke="${color}" opacity=".6" stroke-width="5"/></g>`;
    else if (id === 'volleyball')
        art = `<g stroke="${color}" fill="none" stroke-width="3"><path d="M155 95v190m330-190v190M155 120h330v100H155m0-75h330m-330 25h330m-330 25h330"/><path d="M210 120v100m55-100v100m55-100v100m55-100v100m55-100v100" opacity=".5"/></g><circle cx="360" cy="95" r="48" fill="#f0e5c9"/><g stroke="#45536b" stroke-width="3" fill="none"><path d="M323 65q52 13 70 57M314 92q35 3 54 47M347 49q-25 25-26 63"/></g>`;
    else if (id === 'geofall')
        art = `<g transform="translate(320 160) rotate(-12)">${[-1, 0, 1].map((x, i) => `<rect x="${x * 108 - 45}" y="${i === 1 ? 15 : -20}" width="90" height="90" rx="12" fill="${i === 1 ? '#24304a' : color}" opacity=".8"/>`).join('')}<path d="M-38 139h76m-57 28h38" stroke="${color}" stroke-width="4" opacity=".5"/><circle cx="110" cy="-62" r="23" fill="#f1deba"/><path d="m100-35 25 5 10 60-23 2z" fill="#f1deba"/></g>`;
    else if (cat === 'SPORT' || id === 'minigolf')
        art = id === 'minigolf' ? `<g transform="translate(320 185) rotate(-12)"><rect x="-190" y="-84" width="380" height="168" rx="55" fill="#22443d" stroke="${color}" stroke-width="4"/><ellipse cx="95" cy="15" rx="17" ry="9" fill="#0b1720"/><path d="M95 15v-104l48 18-48 19" stroke="${color}" fill="${color}" stroke-width="3"/><path d="M-112 28Q-30-76 75 8" fill="none" stroke="#f1e4c8" stroke-width="3" stroke-dasharray="7 8"/><circle cx="-112" cy="28" r="18" fill="#f3ead7"/></g>` : `<g transform="translate(320 170) rotate(-12)"><rect x="-200" y="-105" width="400" height="210" rx="25" fill="#1d3d3a" stroke="${color}" stroke-width="4"/><path d="M0-105v210m-200-160h50v110h-50m400-110h-50v110h50" fill="none" stroke="${color}" stroke-width="3" opacity=".5"/><circle r="54" fill="none" stroke="${color}" stroke-width="3" opacity=".5"/></g><circle cx="340" cy="155" r="39" fill="#e6efd9"/><path d="m340 134 21 15-8 24h-26l-8-24z" fill="#263d3f"/>`;
    else if (id === 'trentuno' || cat === 'FORTUNA')
        art = `<g transform="translate(320 170)"><g transform="translate(-70 8) rotate(-19)"><rect x="-62" y="-96" width="124" height="192" rx="14" fill="#f3e7cc"/><rect x="-49" y="-83" width="98" height="166" rx="8" fill="#344d5a"/><path d="m0-45 30 45L0 45-30 0z" fill="none" stroke="${color}" stroke-width="3"/></g><g transform="translate(64 -5) rotate(13)"><rect x="-62" y="-96" width="124" height="192" rx="14" fill="#f3e7cc"/><text y="18" text-anchor="middle" fill="#273549" font-family="system-ui" font-weight="800" font-size="57">31</text><path d="M-32 45h64" stroke="#b6924a" stroke-width="3"/></g></g>`;
    else if (cat === 'ARENA' || id === 'fps' || id === 'cornicione')
        art = id === 'fps' ? `<g stroke="${color}" fill="none" stroke-width="4"><circle cx="320" cy="170" r="86"/><circle cx="320" cy="170" r="48" opacity=".5"/><path d="M320 45v55m0 140v55M195 170h55m140 0h55"/><path d="m102 283 58-59h80m298 59-58-59h-80" opacity=".4"/></g>` : `<ellipse cx="320" cy="255" rx="190" ry="36" fill="#25334d" stroke="${color}" stroke-width="3"/><g fill="${color}"><circle cx="260" cy="115" r="27"/><path d="m232 151 46-11 43 54-24 18-38-36-13 56h-33z"/><circle cx="392" cy="102" r="27" opacity=".6"/><path d="m372 136 43 15 15 75-30 4-19-58-39 13-14-26z" opacity=".6"/></g><path d="m319 103 19 24-9-39 26 12" fill="none" stroke="#ffd498" stroke-width="5"/>`;
    else if (cat === 'MEMORIA')
        art = `<g transform="translate(320 170) rotate(-10)">${[-1, 0, 1].flatMap((x) => [-1, 0].map(y => `<rect x="${x * 97 - 42}" y="${y * 97 - 35}" width="82" height="82" rx="16" fill="${x === 0 || y === 0 ? color : '#26334d'}" opacity="${x === 0 || y === 0 ? .8 : 1}"/>`)).join('')}</g>`;
    else
        art = `<g transform="translate(320 165) rotate(-10)"><rect x="-161" y="-94" width="322" height="188" rx="35" fill="#25324b" stroke="${color}" stroke-width="3"/><path d="m-95 92-14 43 68-43" fill="#25324b" stroke="${color}" stroke-width="3"/><text y="35" fill="${color}" font-size="112" font-family="system-ui" font-weight="800" text-anchor="middle">${cat === 'RIFLESSI' ? 'ϟ' : '?'}</text><path d="M-114-41h38m146 84h38" stroke="${color}" stroke-width="6" stroke-linecap="round" opacity=".4"/></g>`;
    return `<svg viewBox="0 0 640 340" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"><ellipse cx="320" cy="300" rx="200" ry="22" fill="#050a18" opacity=".3"/><g opacity=".16" fill="none" stroke="${color}"><circle cx="320" cy="170" r="150"/><circle cx="320" cy="170" r="190" stroke-dasharray="3 16"/></g>${art}</svg>`;
}
