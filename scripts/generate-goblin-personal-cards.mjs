import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cards = JSON.parse(readFileSync(resolve(root, 'docs/goblin_time_25_carte_personaggi.json'), 'utf8'));
const base = JSON.parse(readFileSync(process.argv[2]?resolve(process.argv[2]):resolve(root,'docs/goblin_time_100_carte.json'), 'utf8'));
const names = ['Goblin', 'Boschi', 'Victor', 'Carbo', 'Ciro'];
const types = ['AZIONE', 'TRAPPOLA', 'RISPOSTA', 'CATASTROFE'];
if (cards.length !== 25 || base.length !== 100) throw new Error('Numero di carte inatteso');
const ids = new Set(base.map(c => c.id));
for (const c of cards) {
  if (ids.has(c.id)) throw new Error(`ID duplicato: ${c.id}`);
  ids.add(c.id);
  if (!types.includes(c.type) || !names.includes(c.characterName)) throw new Error(`Metadati non validi: ${c.id}`);
  for (const key of ['name', 'effect', 'shortEffect', 'quote', 'background', 'illustration', 'timing', 'characterId']) {
    if (typeof c[key] !== 'string' || !c[key].trim()) throw new Error(`Campo mancante ${c.id}.${key}`);
  }
}
for (const name of names) {
  const group = cards.filter(c => c.characterName === name);
  if (group.length !== 5) throw new Error(`Gruppo incompleto: ${name}`);
  for (const [type, count] of [['AZIONE', 2], ['TRAPPOLA', 1], ['RISPOSTA', 1], ['CATASTROFE', 1]]) {
    if (group.filter(c => c.type === type).length !== count) throw new Error(`Tipi non validi: ${name}`);
  }
}

const common = `# GOBLIN TIME — Le carte di noi cinque

25 nuove carte di design: cinque per Goblin, Boschi, Victor, Carbo e Ciro. Ogni gruppo contiene due AZIONI, una TRAPPOLA, una RISPOSTA e una CATASTROFE. Tutti possono pescare e usare qualsiasi carta: il personaggio raffigurato è il protagonista della gag, non un requisito per giocarla.

## Background usato

- **Goblin / Nicolò:** creatore del gioco, competitivo, poco sobrio, exploit e rimonte all'ultimo.
- **Boschi / Christian:** buttafuori, sicurezza, bisogno di capire e poi determinazione; non un truffatore.
- **Victor:** rilassato, sicuro di sé, risveglio improvviso, shaker e battuta dei 20 kg. Il soprannome Dottore non lo rende un medico o uno scienziato.
- **Carbo:** judoka tecnico, granita, contestazioni e regole di casa. «Angora che dici?» resta scritto così.
- **Ciro:** trattative, spicci mancanti, pagamenti rimandati, ripartizioni convenienti e clausole.

Fonti: [scheda del progetto](PARTY_GAME_PER_CHATGPT.md), [personaggi](../shared/characters.ts), [presentazione](../shared/characterPresentation.ts), [Cornicione](CORNICIONE.md). Le scene delle carte sono nuove gag, non fatti biografici aggiunti sugli amici.

## Compatibilità e stato

Il pacchetto è **implementato nella variante NOI CINQUE di GOBLIN TIME**. Dettagli e verifiche nel [report di implementazione](agent-work/goblin-time/REPORT.md). I due originali nei Download restano invariati. Il testo di implementazione allegato è stato usato come contesto delle regole; questa consegna riguarda le carte personalizzate.

Il mazzo base resta di 100 carte. Nella variante NOI CINQUE, il totale diventa **125**: 50 AZIONI, 30 TRAPPOLE, 25 RISPOSTE e 20 CATASTROFI, una copia per ID. Il motore usa il totale del catalogo attivo per gli invarianti. Per mantenere un mazzo da 100 occorrerà definire un elenco esplicito di sostituzioni, conservando il catalogo originale separato. Qui non viene applicata alcuna sostituzione.

Le abilità originali dei cinque personaggi restano separate dalle carte e non vengono modificate. I nuovi effetti hanno handler espliciti; questo JSON non viene interpretato a runtime dal gioco.

## Regole comuni del pacchetto

- Vittoria sempre con esattamente cinque carte e dichiarazione mantenuta fino al prossimo turno effettivo. Ogni uscita o entrata di carte va verificata: tornare a cinque non riattiva una dichiarazione annullata.
- Prima di risolvere una carta giocata, spostarla dalla mano alla zona di risoluzione. Non può pagare il proprio costo né recuperare sé stessa. Una RISPOSTA si consuma prima del suo effetto, anche quando questo viene annullato.
- Le scelte simultanee sono segrete fino alla chiusura. Se serve una seconda scelta di carte, resta privata; la TV vede solamente operazioni pubbliche e carte effettivamente rivelate. Le carte offerte sono visibili solo al destinatario finché un effetto non le rivela.
- Ordine di turno: giocatore attivo, poi gli altri nell'ordine corrente. Trappole concorrenti: ordine di armamento; ricontrollare il trigger e la disponibilità delle carte prima di ciascuna risoluzione. Una carta intercettata non può essere trasferita nuovamente da un effetto successivo.
- Le carte entrano prima nella zona di risoluzione, poi nei normali scarti; non si perdono né si duplicano. Per costi e scelte sono valide soltanto carte effettivamente presenti e non bloccate da altri effetti.
- Una sola attivazione per trappola, una RISPOSTA per giocatore e per evento, massimo quattro reazioni concatenate. Gli effetti del pacchetto generano gli stessi eventi di pescata, furto, scarto, trasferimento, deposito e ritorno previsti dal catalogo base.
- Una pescata di N carte prende al massimo N carte disponibili, rimescolando gli scarti quando necessario. Se non ci sono carte disponibili, la parte di pescata non avviene. Il limite di mano del catalogo base resta valido.
- I debiti sono separati dalla carta che li ha creati. Restituzioni da deposito, debiti, trappole e reazioni obbligatorie si risolvono prima del controllo vittoria. Una sospensione di turno rinvia anche il controllo al prossimo turno effettivo; la pausa sospende i timer.
- Timeout di scelta: prima opzione legale nell'ordine mostrato; per una carta, prima carta legale nella mano corrente; per un bersaglio, primo valido in ordine di turno. Nelle scelte di voto l'ordine è RIEMPI/SVUOTA oppure PAGO/SCAPPO. Per gli scarti facoltativi di PV02 la scelta automatica è zero. La selezione automatica rimane privata.
- Un effetto impossibile non inventa un bersaglio. I requisiti dichiarati impediscono la giocata; se il bersaglio diventa impossibile durante la risoluzione, saltare quella parte senza annullare trasferimenti già completati.

## Direzione grafica

Il tipo guida il colore: AZIONE blu, TRAPPOLA rosso, RISPOSTA verde, CATASTROFE viola. Una fascia secondaria usa il colore del personaggio: Goblin verde, Boschi rosso, Victor ciano, Carbo ambra, Ciro viola. Titolo, icona, battuta e scena distinguono ogni carta. L'anteprima HTML contiene simboli SVG originali e sintetici; le descrizioni delle illustrazioni indicano le scene complete per un eventuale passaggio artistico.

## Catalogo
`;
let md = common;
for (const name of names) {
  md += `\n### ${name}\n`;
  for (const c of cards.filter(c => c.characterName === name)) {
    md += `\n#### ${c.id} — ${c.name} · ${c.type}\n\n**In breve:** ${c.shortEffect}\n\n**Effetto:** ${c.effect}\n\n**Quando:** ${c.timing}\n\n**Battuta:** «${c.quote}»\n\n**Illustrazione:** ${c.illustration}\n`;
  }
}
md += `\n## Verifiche e limiti\n\nValidati: 25 ID nuovi univoci e senza collisioni con i 100 originali; cinque carte per personaggio; distribuzione 10/5/5/5; tutti i campi richiesti compilati. La verifica del catalogo non prova il motore: interazioni e invarianti sono coperti dai test del gioco; durata con persone e bilanciamento richiedono partite reali.\n\nDa verificare in particolare: PG03 con T02; PB02 con le trappole di PESCA; PC02 con T25; le offerte di PI01/PI02 con T10 e T14; debiti di PI03/PI05 prima della vittoria; consumo delle RISPOSTE e conteggio a cinque.\n`;
writeFileSync(resolve(root, 'docs/GOBLIN_TIME_25_CARTE_PERSONAGGI.md'), md, 'utf8');

const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const colors = { AZIONE: '#5aa8ff', TRAPPOLA: '#ff6e74', RISPOSTA: '#53df9e', CATASTROFE: '#c291ff' };
const accents = { Goblin: '#10b981', Boschi: '#ef4444', Victor: '#06b6d4', Carbo: '#f59e0b', Ciro: '#8b5cf6' };
const symbols = [
  '{ }', '90°', '×2', '↶', 'PATCH',
  'PASS', '1 / 3', 'STOP', '?', 'OUT',
  '1 / 4', '−20', '5 →', '◉', 'ZZZ',
  'ICE', 'IPPON', 'Ø', '§', '+ / −',
  '80 / 20', '€ 0', 'IBAN', '−1', '€ ?'
];
const faces = {
  Goblin: '<path d="M70 48 35 26 56 73M150 48 185 26 164 73"/><path d="M74 41q36-36 72 0"/><path d="m75 117 8 17 9-15m35 0 9 15 8-17"/>',
  Boschi: '<path d="M73 32h74M62 64h42v21H62zm54 0h42v21h-42M104 73h12"/><path d="M163 74v33h-14"/>',
  Victor: '<path d="m72 35 8-17 13 11 15-20 12 18 18-10 12 23"/><circle cx="88" cy="76" r="17"/><circle cx="132" cy="76" r="17"/><path d="M105 75h10m-29 0h7m34-1 10 2"/>',
  Carbo: '<path d="M74 33h71l-7-11H85z"/><path d="m78 140 32 30 32-30m-32 30-16 20m16-20 18 21"/><path d="M66 69h40v20H66zm50 0h40v20h-40M106 78h10"/>',
  Ciro: '<path d="M105 31V12m13 20 4-18"/><path d="M77 108q33 43 66 0M76 143q35 45 69 0"/><circle cx="110" cy="165" r="9"/>'
};
function art(c, i) {
  return `<svg viewBox="0 0 320 190" role="img" aria-label="${escape(c.illustration)}"><defs><linearGradient id="g${i}"><stop stop-color="${accents[c.characterName]}" stop-opacity=".32"/><stop offset="1" stop-color="${colors[c.type]}" stop-opacity=".08"/></linearGradient></defs><rect width="320" height="190" rx="14" fill="url(#g${i})"/><circle cx="106" cy="86" r="63" fill="none" stroke="${accents[c.characterName]}" stroke-opacity=".3" stroke-dasharray="4 9"/><g stroke="${accents[c.characterName]}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M45 185q6-57 65-57t65 57"/><rect x="64" y="34" width="92" height="95" rx="35" fill="#111d30"/>${faces[c.characterName]}<path d="M94 108q15 9 31 0"/></g><g transform="translate(190 33) rotate(${(i % 5 - 2) * 5} 48 60)"><rect width="98" height="130" rx="12" fill="#0d1727" stroke="${colors[c.type]}" stroke-width="2"/><path d="M12 16h74M12 111h74" stroke="${colors[c.type]}" opacity=".4"/><text x="49" y="72" text-anchor="middle" fill="${colors[c.type]}" font-family="Arial,sans-serif" font-size="${symbols[i].length > 4 ? 18 : 26}" font-weight="bold">${escape(symbols[i])}</text><text x="49" y="100" text-anchor="middle" fill="#9cacc3" font-family="Arial,sans-serif" font-size="10">${c.id}</text></g></svg>`;
}
const htmlCards = cards.map((c, i) => `<article data-person="${c.characterName}" data-type="${c.type}" style="--type:${colors[c.type]};--person:${accents[c.characterName]}"><div class="tag"><span>${c.type}</span><span>${c.id}</span></div><h2>${escape(c.name)}</h2>${art(c, i)}<div class="person">${c.characterName}</div><p class="short">${escape(c.shortEffect)}</p><blockquote>«${escape(c.quote)}»</blockquote><details><summary>Regola completa</summary><p>${escape(c.effect)}</p><p class="timing">${escape(c.timing)}</p><p class="timing">Scena proposta: ${escape(c.illustration)}</p></details></article>`).join('\n');
const html = `<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>GOBLIN TIME — Noi cinque</title><style>
*{box-sizing:border-box}body{margin:0;background:#090e19;color:#f1f5ff;font-family:system-ui,sans-serif}main{max-width:1450px;margin:auto;padding:40px 24px}.eyebrow{color:#9ade65;letter-spacing:.16em;font-size:12px;font-weight:800}h1{font-size:clamp(32px,5vw,64px);line-height:1.05;margin:16px 0}.intro{max-width:760px;color:#adbbd1;line-height:1.6}nav{display:flex;gap:12px;flex-wrap:wrap;margin:26px 0 30px}label{font-size:12px;color:#adbbd1;display:flex;gap:8px;align-items:center}select{background:#182339;color:white;border:1px solid #35445c;border-radius:8px;padding:10px;font:inherit}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:22px}article{border:1px solid #2b3c55;border-top:4px solid var(--type);border-radius:18px;background:linear-gradient(145deg,#1b283d,#111a2a);padding:18px;box-shadow:0 12px 28px #0003;display:flex;flex-direction:column}article[hidden]{display:none}.tag{display:flex;justify-content:space-between;color:var(--type);font-size:10px;font-weight:800;letter-spacing:.12em}h2{font-size:22px;line-height:1.15;min-height:52px;margin:16px 0}svg{width:100%;height:auto}.person{font-size:12px;font-weight:800;color:var(--person);margin:12px 0 0}.short{font-size:15px;line-height:1.5;min-height:92px;margin-bottom:12px}blockquote{margin:0 0 18px;color:#c1cee2;font-size:12px;font-style:italic;line-height:1.5}details{border-top:1px solid #304057;padding-top:12px;margin-top:auto;font-size:13px;line-height:1.6}summary{cursor:pointer;color:var(--type);font-weight:700}.timing{color:#a6b6ce}footer{font-size:12px;color:#a6b6ce;margin:30px 0;line-height:1.6}@media print{body{background:white;color:#182339}main{padding:0}nav,.intro,footer{display:none}.grid{grid-template-columns:repeat(3,1fr);gap:10px}article{break-inside:avoid;background:#f1f5fa;color:#142136;box-shadow:none}.short{min-height:0}h2{font-size:18px}blockquote{color:#445570}details{display:none}.eyebrow{color:#16283c}h1{font-size:24px}}
</style><main><div class="eyebrow">PARTY GAME · CATALOGO AGGIUNTIVO</div><h1>GOBLIN TIME<br>Le carte di noi cinque.</h1><p class="intro">25 carte ispirate al background dei personaggi. Tutti possono usare ogni carta. Apri la regola completa per leggere tempi, costi e conseguenze. Effetti implementati nel gioco; questa pagina mostra il catalogo delle carte.</p><nav><label>PERSONAGGIO <select id="person"><option value="">Tutti e cinque</option>${names.map(n => `<option>${n}</option>`).join('')}</select></label><label>TIPO <select id="type"><option value="">Tutti i tipi</option>${types.map(t => `<option>${t}</option>`).join('')}</select></label><span id="count" role="status" aria-live="polite"></span></nav><section class="grid">${htmlCards}</section><footer>100 carte originali conservate. Questo pacchetto contiene 25 nuove carte: la variante NOI CINQUE usa un mazzo e invarianti da 125. Le illustrazioni SVG sono simboli originali di anteprima; le scene dettagliate sono nelle regole complete.</footer></main><script>
const person=document.getElementById('person'),type=document.getElementById('type');function filter(){let n=0;document.querySelectorAll('article').forEach(c=>{c.hidden=!!((person.value&&c.dataset.person!==person.value)||(type.value&&c.dataset.type!==type.value));if(!c.hidden)n++});document.getElementById('count').textContent=n+' carte'}person.addEventListener('change',filter);type.addEventListener('change',filter);filter();
</script></html>`;
writeFileSync(resolve(root, 'docs/GOBLIN_TIME_CARTE_PERSONAGGI.html'), html, 'utf8');
console.log('Catalogo validato: 25 carte, 5 per personaggio, tipi 10/5/5/5, nessuna collisione con i 100 ID originali. Markdown e anteprima generati.');
