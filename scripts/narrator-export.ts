import { readFileSync,writeFileSync } from 'node:fs';
import { NARRATOR_LINES } from '../src/audio/narrator/NarratorLines';
writeFileSync('docs/agent-work/narrator/catalog.json',JSON.stringify(NARRATOR_LINES.map(l=>({...l,...(JSON.parse(readFileSync('public/audio/narrator/manifest.json','utf8'))[l.id]??{duration:null})})),null,2));console.log(`${NARRATOR_LINES.length} battute esportate.`);
