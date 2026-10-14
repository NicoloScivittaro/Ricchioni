import { writeFileSync } from 'node:fs';
import { NARRATOR_LINES } from '../src/audio/narrator/NarratorLines';
writeFileSync('docs/agent-work/narrator/catalog.json',JSON.stringify(NARRATOR_LINES,null,2));console.log(`${NARRATOR_LINES.length} battute esportate.`);
