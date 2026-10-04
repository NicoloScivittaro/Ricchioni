/**
 * SELFTEST MATEMATICO della mira col controller (M6.1, punto 7: "aim frame-rate independent"). Parte pura,
 * nessun browser: npx tsx scripts/fps-aim-selftest.ts
 *
 * Riproduce ESATTAMENTE la formula di src/minigames/fps/FpsScene.ts (rotazione = stick * curva * sensibilita' * dt,
 * mai "per fotogramma") usando le stesse funzioni pure (responseCurve, splitFrameDelta) e gli stessi valori di
 * AIM_CONFIG — se AIM_CONFIG cambia in FpsScene.ts, aggiornare qui (non importabile direttamente: FpsScene.ts
 * trascina GamepadManager, che tocca `window` al caricamento del modulo e non gira in Node puro).
 */
import { responseCurve } from '../src/input/padMath';
import { splitFrameDelta } from '../src/core/frameClock';

const AIM_CONFIG = {
  sensX: 2.6,
  sensY: 2.0,
  curveExponent: 1,
  maxTurnSpeed: 5.2,
  pitchClamp: 1.4
};

let fails = 0;
const ok = (cond: boolean, msg: string): void => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fails++;
};

/** Un secondo di simulazione a un dato frame-rate, stick TENUTO fermo (stessa deflessione ogni frame). */
function simulateOneSecond(fps: number, stickX: number, stickY: number, sens = 1): { yaw: number; pitch: number; frames: number } {
  const frameDt = 1 / fps;
  let yaw = 0;
  let pitch = 0;
  let elapsed = 0;
  let frames = 0;
  const mag = Math.hypot(stickX, stickY);
  const curved = mag > 0 ? responseCurve(mag, AIM_CONFIG.curveExponent) / mag : 0;
  const rateX = Math.max(-AIM_CONFIG.maxTurnSpeed, Math.min(AIM_CONFIG.maxTurnSpeed, stickX * curved * AIM_CONFIG.sensX * sens));
  const rateY = Math.max(-AIM_CONFIG.maxTurnSpeed, Math.min(AIM_CONFIG.maxTurnSpeed, stickY * curved * AIM_CONFIG.sensY * sens));
  // Esattamente come FpsScene.update(): ogni fotogramma viene spezzato in sotto-passi da splitFrameDelta, poi
  // si integra sub-passo per sub-passo — non un unico "dt di frame" sommato in blocco.
  while (elapsed < 1 - 1e-9) {
    frames++;
    for (const sub of splitFrameDelta(frameDt)) {
      yaw += rateX * sub;
      pitch = Math.max(-AIM_CONFIG.pitchClamp, Math.min(AIM_CONFIG.pitchClamp, pitch - rateY * sub));
    }
    elapsed += frameDt;
  }
  return { yaw, pitch, frames };
}

console.log('--- INDIPENDENZA DAL FRAME-RATE (stick tenuto fermo, 1s, deflessione piena) ---');
const r30 = simulateOneSecond(30, 1, 0);
const r60 = simulateOneSecond(60, 1, 0);
const r120 = simulateOneSecond(120, 1, 0);
console.log(`   30 FPS (${r30.frames} frame): yaw ${r30.yaw.toFixed(6)}`);
console.log(`   60 FPS (${r60.frames} frame): yaw ${r60.yaw.toFixed(6)}`);
console.log(`  120 FPS (${r120.frames} frame): yaw ${r120.yaw.toFixed(6)}`);
const TOL = 1e-9; // integrazione lineare su dt reale: l'accordo e' esatto a meno di arrotondamento in virgola mobile
ok(Math.abs(r30.yaw - r60.yaw) < TOL && Math.abs(r60.yaw - r120.yaw) < TOL, `stessa rotazione totale a 30/60/120 FPS (scarto max ${Math.max(Math.abs(r30.yaw - r60.yaw), Math.abs(r60.yaw - r120.yaw)).toExponential(2)})`);
ok(Math.abs(r60.yaw - AIM_CONFIG.sensX) < 1e-9, `il totale corrisponde a sensX (rotazione = stick * sensX * dt, integrata su 1s): ${r60.yaw.toFixed(4)} ≈ ${AIM_CONFIG.sensX}`);

console.log('\n--- STESSO TEST CON PITCH (stick in giu\', clamp incluso) ---');
const p30 = simulateOneSecond(30, 0, 1);
const p120 = simulateOneSecond(120, 0, 1);
ok(Math.abs(p30.pitch - p120.pitch) < TOL, `stesso pitch finale a 30 e 120 FPS (${p30.pitch.toFixed(6)} vs ${p120.pitch.toFixed(6)})`);
ok(p30.pitch === -AIM_CONFIG.pitchClamp, `il pitch resta bloccato al limite (clamp indipendente dal frame-rate): ${p30.pitch}`);

console.log('\n--- SENSIBILITA\' PER GIOCATORE (moltiplicatore gia\' esistente in GamepadManager, ora usato) ---');
const sLow = simulateOneSecond(60, 1, 0, 0.5);
const sHigh = simulateOneSecond(60, 1, 0, 2);
ok(Math.abs(sLow.yaw - AIM_CONFIG.sensX * 0.5) < 1e-9 && Math.abs(sHigh.yaw - AIM_CONFIG.sensX * 2) < 1e-9, `sensibilita' 0.5x/2x scala linearmente il risultato (${sLow.yaw.toFixed(3)} / ${sHigh.yaw.toFixed(3)})`);

console.log('\n--- CURVA DI RISPOSTA A EXPONENT=1 (default): nessun cambio rispetto a prima di M6.1 ---');
ok(AIM_CONFIG.curveExponent === 1, 'curveExponent di default e\' lineare (identita\'): la mira si comporta come prima di M6.1');
const half = simulateOneSecond(60, 0.5, 0);
ok(Math.abs(half.yaw - AIM_CONFIG.sensX * 0.5) < 1e-9, `a deflessione 0.5 (curva lineare) la rotazione e' esattamente meta': ${half.yaw.toFixed(4)}`);

process.exitCode = fails ? 1 : 0;
