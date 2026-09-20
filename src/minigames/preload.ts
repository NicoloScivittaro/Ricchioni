/**
 * PRECARICAMENTO INTELLIGENTE: appena il rullo ha scelto il prossimo minigioco 3D, il suo codice (motore
 * Babylon + scena) viene scaricato in background mentre girano rullo e intro (~10s), invece che al momento
 * del via. NON si caricano tutti i giochi 3D all'avvio: solo quello estratto. Il browser tiene il modulo in
 * cache, quindi il `import()` del wrapper dopo l'intro è istantaneo.
 */
const LOADERS: Record<string, () => Promise<unknown>> = {
  arena: () => import('./arena/BabylonArenaGame'),
  dodgeball: () => import('./dodgeball/BabylonDodgeballGame'),
  kart3d: () => import('./kart-race/BabylonKartGame'),
  soccer: () => import('./soccer/BabylonSoccerGame'),
  volleyball: () => import('./volleyball/BabylonVolleyballGame')
};

const started = new Set<string>();

export function preloadMinigame(id: string): void {
  const load = LOADERS[id];
  if (!load || started.has(id)) return;
  started.add(id);
  load().catch(() => started.delete(id)); // in caso di errore riproverà il wrapper (con RIPROVA/SALTA)
}
