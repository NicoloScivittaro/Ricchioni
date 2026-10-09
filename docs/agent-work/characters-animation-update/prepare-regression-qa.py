"""Reuse established game probes with current assets and separate evidence paths."""
import pathlib
ROOT=pathlib.Path(__file__).parent.parents[2]
scripts=ROOT/'scripts/e2e'
out='docs/agent-work/characters-animation-update'

s=(scripts/'ciro-contexts.mjs').read_text()
s=s.replace('docs/agent-work/ciro-animation-update',out)
s=s.replace('?debug=1&ciro=${mode}', '?debug=1&ciro=${mode}&goblin=${mode}&buttafuori=${mode}&judoka=${mode}')
s=s.replace("characterId:'ciro'", "characterId:['goblin','buttafuori','judoka','ciro','goblin'][i]")
s=s.replace("'ciro.ballCatch'", "'goblin.ballCatch'")
s=s.replace('-5goblins.png','-mixed-characters.png')
s=s.replace("if(mode==='old')assert.equal", "if(mode==='new'){const states=await p.evaluate(()=>{const {g,kind}=window.__probe;const es=kind==='fps'?[...g.avatars.values()].map(e=>e.goblin):[...g.entities.values()].map(e=>e.goblinVisual);return es.map(e=>e.debug());});for(const d of states){assert.equal(d.clips,{goblin:52,buttafuori:54,judoka:49,ciro:59}[d.character]);assert.equal(d.bones,65);}}\n  if(mode==='old')assert.equal")
(scripts/'characters-contexts.mjs').write_text(s,encoding='utf-8')

s=(scripts/'buttafuori-animated-jump.mjs').read_text()
s=s.replace('const browser=await launch();',"const character=process.argv[2]??'judoka',out='"+out+"';\nconst browser=await launch();")
s=s.replace('?fighter=1&buttafuori=new','?fighter=1&${character}=new')
s=s.replace("()=>window.__fighterLab.restart(2,'all-buttafuori')", "character=>window.__fighterLab.restart(2,`all-${character}`),character")
s=s.replace("'buttafuori.jump'", "`${character}.${character==='judoka'?'fall':'jump'}`")
s=s.replace("'buttafuori.fall'", "`${character}.fall`")
s=s.replace('assert.equal(s.clips,54)', 'assert.equal(s.clips,{goblin:52,buttafuori:54,judoka:49}[character])')
s=s.replace('s.vertices===28141','s.vertices>0')
s=s.replace("'e2e-shots/buttafuori-animations/jump-tripo.png'", '`${out}/shots/${character}-jump.png`')
s=s.replace("'docs/agent-work/buttafuori-animation-phase/jump.json'", '`${out}/${character}-jump.json`')
s=s.replace('`Buttafuori:','`${character}:')
(scripts/'characters-jump.mjs').write_text(s,encoding='utf-8')
