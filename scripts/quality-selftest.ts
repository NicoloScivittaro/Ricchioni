/**
 * Self-test dell'AUTO-QUALITY (src/core/quality.ts) con motore/scena finti e orologio simulato: scende sotto ~24 FPS, sale sopra ~57 FPS
 * dopo un'attesa, NON fa altalena (un livello appena riconquistato che non regge viene bloccato) e con qualita' scelta a mano non cambia livello.
 *   npx tsx scripts/quality-selftest.ts
 */
import { applyQuality, getQualityLevel, setQualityLevel, isAutoQuality } from '../src/core/quality';

let t = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => t }, configurable: true });
const store = new Map<string, string>([['ricchioni.quality.auto', 'high']]); // sessione: si parte da HIGH
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };

let fails = 0;
const check = (c: boolean, m: string): void => {
  console.log(`${c ? '✅' : '❌'} ${m}`);
  if (!c) fails++;
};

function rig() {
  let fps = 60;
  let cb: () => void = () => undefined;
  const engine = { scale: 1, setHardwareScalingLevel(v: number) { this.scale = v; }, getHardwareScalingLevel() { return this.scale; }, getFps: () => fps };
  const scene = { shadowsEnabled: true, particlesEnabled: true, effectLayers: [{ isEnabled: true }], onBeforeRenderObservable: { add: (f: () => void) => void (cb = f) } };
  applyQuality(engine, scene);
  return {
    engine,
    scene,
    /** simula `sec` secondi a `f` FPS (frame a 60 Hz di orologio, FPS riportati = f) */
    run(f: number, sec: number) {
      fps = f;
      const n = Math.round(sec * 60);
      for (let i = 0; i < n; i++) {
        t += 1000 / 60;
        cb();
      }
    },
    label: () => `${getQualityLevel()} scala ${engine.scale} ombre ${scene.shadowsEnabled} particelle ${scene.particlesEnabled} glow ${scene.effectLayers[0].isEnabled}`
  };
}

console.log('\nAUTO-QUALITY — sessione che parte da HIGH\n');
check(isAutoQuality(), 'nessuna scelta manuale: auto-quality attiva');
let g = rig();
check(getQualityLevel() === 'high' && g.scene.effectLayers[0].isEnabled, 'parte da HIGH (glow acceso)');

// 1. FPS bassi: scende di un livello dopo 2 s, poi rispetta il cooldown
g.run(20, 1.5);
check(getQualityLevel() === 'high', 'sotto 24 FPS da 1.5 s: ancora HIGH (serve 2 s continui)');
g.run(20, 1.7);
check(getQualityLevel() === 'medium' && !g.scene.effectLayers[0].isEnabled && g.scene.shadowsEnabled, `dopo ~2 s scende a MEDIUM (glow spento, ombre accese) — ${g.label()}`);
g.run(20, 2);
check(getQualityLevel() === 'medium', 'nel cooldown (3 s) non scende ancora');
g.run(20, 3);
check(getQualityLevel() === 'low' && !g.scene.shadowsEnabled && !g.scene.particlesEnabled, `FPS ancora bassi: LOW (ombre/particelle spente) — ${g.label()}`);
g.run(20, 12);
check(g.engine.scale > 1.5 && g.engine.scale <= 2, `a LOW e ancora bassi sale la scala di rendering (${g.engine.scale})`);
check(store.get('ricchioni.quality.auto') === 'low', 'il livello raggiunto resta per i minigiochi successivi della sessione');

// 2. Fascia di mezzo (30-50 FPS): isteresi, nessuna azione
g = rig(); // nuovo minigioco: riparte da LOW (livello di sessione)
check(getQualityLevel() === 'low', 'nuovo minigioco: riparte da LOW (livello di sessione)');
g.run(40, 40);
check(getQualityLevel() === 'low' && g.engine.scale === 1.5, 'fra 24 e 57 FPS non cambia nulla per 40 s (isteresi)');

// 3. FPS alti stabili: sale dopo l'attesa, prima la risoluzione poi il livello
g.run(60, 7);
check(getQualityLevel() === 'low', '60 FPS da 7 s: ancora LOW (serve 8 s stabili)');
g.run(60, 2);
check(getQualityLevel() === 'medium', `dopo 8 s stabili sale a MEDIUM — ${g.label()}`);
g.run(60, 5);
check(getQualityLevel() === 'medium', 'nel cooldown non sale ancora');
g.run(60, 6);
check(getQualityLevel() === 'high' && g.scene.effectLayers[0].isEnabled, `poi HIGH (desktop) — ${g.label()}`);

// 4. Altalena: HIGH appena riconquistato non regge -> torna a MEDIUM e HIGH viene BLOCCATO
g.run(15, 3);
check(getQualityLevel() === 'medium', 'HIGH non regge: torna a MEDIUM');
g.run(60, 60);
check(getQualityLevel() === 'medium', 'anche con 60 FPS per 60 s NON riprova HIGH (bloccato per la sessione: niente altalena)');

// 5. Scelta manuale: il livello non cambia piu'
setQualityLevel('low');
check(!isAutoQuality(), 'setQualityLevel: da ora scelta manuale');
g = rig();
g.run(60, 40);
check(getQualityLevel() === 'low', 'a mano LOW: neppure con 60 FPS l\'auto-quality alza il livello');

console.log(fails ? `\n${fails} controlli FALLITI\n` : '\nTutto ok\n');
process.exit(fails ? 1 : 0);
