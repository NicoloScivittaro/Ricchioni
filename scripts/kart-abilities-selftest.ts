/**
 * Self-test standalone delle abilità personaggio del kart 3D — come
 * scripts/quiz-selftest.ts, eseguibile con `npx tsx scripts/kart-abilities-selftest.ts`.
 * CharacterAbilities e kartPhysics.ts non hanno dipendenze da Babylon.js/Phaser
 * (solo KartEntity/ItemManager/BabylonKartGame le hanno, per il rendering),
 * quindi la logica delle 5 abilità si può pilotare direttamente, senza scena.
 */
import { createKartState } from '../src/minigames/kart-race/raceTypes';
import type { KartState } from '../src/minigames/kart-race/raceTypes';
import { stepKartPhysics, hitKart, respawnKart, DRIFT_MIN_SPEED } from '../src/minigames/kart-race/kartPhysics';
import type { KartInputSnapshot } from '../src/minigames/kart-race/kartPhysics';
import { CharacterAbilities } from '../src/minigames/kart-race/abilities';
import type { AbilityFeedback } from '../src/minigames/kart-race/abilities';
import type { PlayerId } from '../shared/types';

let failures = 0;
function assert(cond: boolean, label: string): void {
  if (cond) {
    console.log(`  ✅ ${label}`);
  } else {
    console.log(`  ❌ ${label}`);
    failures++;
  }
}

const flatHalfWidth = () => 8;
const flatAngle = () => 0;
const NEUTRAL_INPUT: KartInputSnapshot = { left: false, right: false, up: false, down: false, drift: false, item: false };

function collectFeedback(): { events: AbilityFeedback[]; onFeedback: (f: AbilityFeedback) => void } {
  const events: AbilityFeedback[] = [];
  return { events, onFeedback: (f) => events.push(f) };
}

console.log('=== TEST 1: GOBLIN — SO GUIDARE IO (drift boost potenziato, annullato da uno schianto) ===');
{
  const abilities = new CharacterAbilities();
  const k = createKartState('p0' as PlayerId, 'goblin', '#fff', '🍺');
  const { events, onFeedback } = collectFeedback();

  k.abilityMeter = 1;
  abilities.onAbilityPress(k, [k], onFeedback);
  assert(k.abilityActive && k.driftBoostMultiplier > 1, 'SO GUIDARE IO si attiva a barra piena e potenzia il drift boost');
  assert(events.some((e) => e.type === 'so_guidare_start'), 'evento di feedback di attivazione emesso');

  // Un colpo (stordimento) mentre l'abilità è attiva annulla subito il bonus.
  k.stunTimer = 0.2;
  abilities.update(0.016, k, [k], true, false, flatAngle, onFeedback);
  assert(!k.abilityActive && k.driftBoostMultiplier === 1, "uno schianto durante l'effetto annulla subito il bonus");
  assert(events.some((e) => e.type === 'so_guidare_fail'), '"EH SÌ, GUIDI BENISSIMO." mostrato dopo lo schianto');

  // Riattivazione + scadenza naturale senza schianto: il bonus si esaurisce da solo.
  k.abilityMeter = 1;
  abilities.onAbilityPress(k, [k], onFeedback);
  abilities.update(10, k, [k], false, false, flatAngle, onFeedback);
  assert(!k.abilityActive && k.driftBoostMultiplier === 1, 'la finestra scade naturalmente dopo la durata prevista');
}

console.log('\n=== TEST 2: BUTTAFUORI — RIBALTATO MA NON MORTO (recupero automatico, 1 volta a gara) ===');
{
  const abilities = new CharacterAbilities();
  const k = createKartState('p0' as PlayerId, 'buttafuori', '#fff', '🥊');
  k.lastValidCheckpointS = 42;
  k.distance = 5;
  k.speed = -3;
  const { events, onFeedback } = collectFeedback();

  assert(k.abilityCharges === 1, 'Buttafuori parte con 1 carica fissa (non legata alla barra)');
  abilities.update(0.016, k, [k], false, true, flatAngle, onFeedback); // respawnTriggeredThisFrame = true
  assert(k.abilityCharges === 0, 'la carica viene consumata automaticamente al recupero');
  assert(k.distance === 42 && k.speed >= 0, 'il kart torna subito in pista (respawn immediato, non dopo il countdown)');
  assert(k.boostTimer > 0, 'riceve un breve recovery boost');
  assert(events.some((e) => e.type === 'buttafuori_recovery'), '"RIBALTATO MA NON MORTO!" mostrato');

  // Con la carica esaurita, un secondo schianto grave non fa più nulla.
  const distanceBefore = k.distance;
  k.distance = 5;
  abilities.update(0.016, k, [k], false, true, flatAngle, onFeedback);
  assert(k.distance === 5, 'senza cariche residue un secondo schianto NON attiva più il recupero automatico');
  void distanceBefore;
}

console.log('\n=== TEST 3: DOTTORE — 20 KG IN UN MESE (leggerissimo: accelera meglio, deriva facile) ===');
{
  const abilities = new CharacterAbilities();
  const k = createKartState('p0' as PlayerId, 'dottore', '#fff', '🤦‍♂️');
  const { onFeedback } = collectFeedback();

  k.abilityMeter = 1;
  abilities.onAbilityPress(k, [k], onFeedback);
  assert(k.lightMode && k.accelMultiplier > 1 && k.driftChargeRateMultiplier > 1, '20 KG IN UN MESE attiva leggerezza + accelerazione + drift più facile');

  abilities.update(10, k, [k], false, false, flatAngle, onFeedback);
  assert(!k.lightMode && k.accelMultiplier === 1 && k.driftChargeRateMultiplier === 1, "l'effetto rientra da solo alla scadenza");
}

console.log("\n=== TEST 4: JUDOKA — MI SO' CADUTI GLI OCCHIALI! (rallenta i rivali, verifica il sorpasso) ===");
{
  const abilities = new CharacterAbilities();
  const attacker = createKartState('p0' as PlayerId, 'judoka', '#fff', '🥋');
  const rival = createKartState('p1' as PlayerId, null, '#000', '🎮');
  rival.distance = attacker.distance + 4; // rivale vicino, davanti
  const { events, onFeedback } = collectFeedback();

  attacker.abilityMeter = 1;
  abilities.onAbilityPress(attacker, [attacker, rival], onFeedback);
  assert(attacker.judokaPending, "l'attivazione mette Judoka in attesa dell'esito");
  assert(rival.speedCapMultiplier < 1 && rival.speedCapTimer > 0, 'il rivale vicino viene rallentato temporaneamente');
  assert(events.some((e) => e.type === 'judoka_activate'), 'annuncio di attivazione mostrato subito');

  // Caso A: Judoka lo supera davvero entro la finestra -> nessuna penalità.
  attacker.distance = rival.distance + 1;
  abilities.update(10, attacker, [attacker, rival], false, false, flatAngle, onFeedback);
  assert(!attacker.judokaPending, 'il tentativo si risolve dopo la finestra');
  assert(events.some((e) => e.type === 'judoka_success'), 'sorpasso riuscito: nessuna penalità');
  assert(attacker.stunTimer === 0, 'nessuna penalità se il sorpasso riesce');
}
{
  const abilities = new CharacterAbilities();
  const attacker = createKartState('p0' as PlayerId, 'judoka', '#fff', '🥋');
  const rival = createKartState('p1' as PlayerId, null, '#000', '🎮');
  rival.distance = attacker.distance + 4;
  const { events, onFeedback } = collectFeedback();

  attacker.abilityMeter = 1;
  abilities.onAbilityPress(attacker, [attacker, rival], onFeedback);
  // Caso B: NON lo supera -> piccola penalità.
  abilities.update(10, attacker, [attacker, rival], false, false, flatAngle, onFeedback);
  assert(events.some((e) => e.type === 'judoka_fail'), 'sorpasso fallito: evento di penalità emesso');
  assert(attacker.stunTimer > 0, 'nessun sorpasso riuscito -> piccola penalità applicata');
}

console.log('\n=== TEST 5: CIRO — PAGO DOPO (rimanda un colpo, poi il DEBITO viene riscosso) ===');
{
  const abilities = new CharacterAbilities();
  const k = createKartState('p0' as PlayerId, 'ciro', '#fff', '💸');
  k.invulnTimer = 0; // createKartState parte con una breve invulnerabilità da griglia di partenza, qui irrilevante
  const { events, onFeedback } = collectFeedback();

  abilities.setRaceTime(10);
  // Preme ABILITÀ poco prima del colpo (arma il rinvio).
  k.lastAbilityPressAt = 10;
  abilities.setRaceTime(10.2);
  const delayed = abilities.tryDelayHit(k, { stun: 1.3 }, onFeedback);
  assert(delayed, 'PAGO DOPO rimanda il colpo se ABILITÀ è stata premuta di recente');
  assert(k.debtPending && k.stunTimer === 0, "il colpo NON si sente subito: continua normalmente (DEBITO in sospeso)");
  assert(k.abilityCharges === 0, 'la carica viene consumata al rinvio');
  assert(events.some((e) => e.type === 'ciro_debt_start'), '"PAGO DOPO!" mostrato subito');

  abilities.update(4.1, k, [k], false, false, flatAngle, onFeedback);
  assert(!k.debtPending && k.stunTimer > 0, 'il DEBITO scade e la penalità viene applicata comunque, dopo qualche secondo');
  assert(events.some((e) => e.type === 'ciro_debt_due'), '"DEBITO RISCOSSO!" mostrato alla scadenza');
}
{
  // Senza aver premuto ABILITÀ in anticipo, il colpo non si può rimandare.
  const abilities = new CharacterAbilities();
  const k = createKartState('p0' as PlayerId, 'ciro', '#fff', '💸');
  const { onFeedback } = collectFeedback();
  abilities.setRaceTime(10);
  const delayed = abilities.tryDelayHit(k, { stun: 1.3 }, onFeedback);
  assert(!delayed, 'senza aver premuto ABILITÀ in anticipo il colpo non viene rimandato');
  assert(k.abilityCharges === 1, 'la carica non viene consumata se il rinvio non scatta');
}

console.log('\n=== TEST 6: la fisica di base resta invariata per un personaggio senza abilità attive ===');
{
  const k = createKartState('p0' as PlayerId, null, '#fff', '🎮');
  const input: KartInputSnapshot = { ...NEUTRAL_INPUT, up: true };
  for (let i = 0; i < 60; i++) stepKartPhysics(k, input, 1 / 60, flatHalfWidth, flatAngle, false);
  assert(k.speed > 0 && k.speed <= 62, `un kart neutro accelera normalmente entro il tetto massimo (velocità: ${k.speed.toFixed(1)})`);
}
{
  const k = createKartState('p0' as PlayerId, null, '#fff', '🎮');
  k.invulnTimer = 0;
  const hit = hitKart(k, 0.5);
  assert(hit && k.stunTimer === 0.5, 'hitKart senza scudo/invulnerabilità applica normalmente lo stordimento');
  const shielded = createKartState('p1' as PlayerId, null, '#fff', '🎮');
  shielded.shielded = true;
  shielded.invulnTimer = 0;
  const blocked = hitKart(shielded, 0.5);
  assert(!blocked && !shielded.shielded, 'uno scudo blocca il colpo e si consuma');
}
{
  const k = createKartState('p0' as PlayerId, null, '#fff', '🎮');
  k.lastValidCheckpointS = 12;
  k.speed = 30;
  respawnKart(k, flatAngle);
  assert(k.distance === 12 && k.speed === 0, 'respawnKart riporta il kart al checkpoint valido con velocità azzerata');
}
void DRIFT_MIN_SPEED;

console.log(`\n=== RISULTATO: ${failures === 0 ? 'TUTTI I TEST PASSATI ✅' : `${failures} TEST FALLITI ❌`} ===`);
process.exit(failures === 0 ? 0 : 1);
