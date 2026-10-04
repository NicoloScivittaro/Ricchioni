import type { PadBinding, PadControl } from './padTypes';

/**
 * PROFILI DI INPUT PER MINIGIOCO. UNA SOLA FONTE per due usi: l'input vero e la schermata CONTROLLI. Ogni voce di `controls` dice
 * "questo controllo fisico fa questa azione", e da QUELLA lista si ricavano sia i binding che il gioco riceve (sticks/buttons/triggers)
 * sia le righe della schermata comandi: non puo' succedere che la TV dica "A = dash" mentre il codice usa B.
 *
 * `control` e' il controlId che il minigioco legge GIA' dal layout del telefono (ctx.input.get(id).axis('move') / justPressed('dash')):
 * stesso identico percorso, nessun nome nuovo, nessun minigioco legge mai navigator.getGamepads().
 *
 * Un minigioco compare qui solo quando il suo profilo e' stato implementato E provato: il registry (shared/minigames.ts, inputMode)
 * e questo file devono restare allineati (lo verifica scripts/pad-selftest.ts).
 */
export interface PadBindingDef {
  /** Azione logica (MOVE, DASH, ABILITY...). */
  action: string;
  /** Controllo fisico astratto o stick. */
  binding: PadBinding;
  /** controlId letto dal minigioco. */
  control: string;
  /** Testo mostrato nella schermata CONTROLLI. */
  label: string;
  /** Solo per LT/RT: il minigioco vuole il valore analogico 0..1 (asse) invece di un tasto. */
  analog?: boolean;
  /**
   * SOLO per controlli "a livello" tipo acceleratore/freno (mai per azioni one-shot: dash, tiro, item, abilità...): true
   * esenta questo tasto dal blocco-fino-al-rilascio quando la schermata CONTROLLI si chiude (o la pausa finisce). Tenerlo
   * premuto da prima del VIA funziona SUBITO al VIA, senza dover rilasciare e ripremere — il gioco stesso resta comunque
   * fermo fino al VIA (fase countdown), quindi non c'è nessun effetto anticipato: cambia solo QUANDO il tasto torna attivo.
   */
  holdThrough?: boolean;
}

export interface PadProfile {
  minigameId: string;
  /** Fonte unica (input + schermata comandi). */
  controls: PadBindingDef[];
  /** Ricavati da `controls`: stick analogici -> asse del minigioco (x/y con deadzone radiale e clamp). */
  sticks: { stick: 'LEFT' | 'RIGHT'; control: string }[];
  /** Ricavati da `controls`: tasti fisici -> tasto del minigioco (down/up veri: i bordi arrivano a justPressed/justReleased). */
  buttons: { from: PadControl; control: string }[];
  /** Ricavati da `controls`: grilletti analogici -> asse 0..1 (x = valore). */
  triggers: { from: 'LT' | 'RT'; control: string }[];
  /** Ricavati da `controls`: tasti marcati `holdThrough` (vedi PadBindingDef). Quasi sempre vuoto. */
  holdThroughControls: PadControl[];
}

export function defineProfile(minigameId: string, controls: PadBindingDef[]): PadProfile {
  const sticks: PadProfile['sticks'] = [];
  const buttons: PadProfile['buttons'] = [];
  const triggers: PadProfile['triggers'] = [];
  const holdThroughControls: PadControl[] = [];
  for (const c of controls) {
    if (c.binding === 'LEFT_STICK') sticks.push({ stick: 'LEFT', control: c.control });
    else if (c.binding === 'RIGHT_STICK') sticks.push({ stick: 'RIGHT', control: c.control });
    else if (c.analog && (c.binding === 'LT' || c.binding === 'RT')) triggers.push({ from: c.binding, control: c.control });
    else {
      buttons.push({ from: c.binding, control: c.control });
      if (c.holdThrough) holdThroughControls.push(c.binding);
    }
  }
  return { minigameId, controls, sticks, buttons, triggers, holdThroughControls };
}

export const PAD_PROFILES: Record<string, PadProfile> = {
  arena: defineProfile('arena', [
    { action: 'MOVE', binding: 'LEFT_STICK', control: 'move', label: 'MUOVITI' },
    { action: 'DASH', binding: 'PRIMARY', control: 'dash', label: 'DASH / SPINTA' },
    { action: 'ABILITY', binding: 'SECONDARY', control: 'ability', label: 'ABILITÀ' }
  ]),
  // Il lancio del Dodgeball e' ISTANTANEO (justPressed('throw'), come il tocco sul telefono) e la presa della palla e' automatica:
  // RT e' quindi un tasto (pressed/tenuto/rilasciato), non una carica analogica. Introdurre una carica cambierebbe il bilanciamento.
  dodgeball: defineProfile('dodgeball', [
    { action: 'MOVE', binding: 'LEFT_STICK', control: 'move', label: 'MUOVITI' },
    { action: 'THROW', binding: 'RT', control: 'throw', label: 'LANCIA' },
    { action: 'DODGE', binding: 'PRIMARY', control: 'dodge', label: 'SCHIVA' },
    { action: 'ABILITY', binding: 'SECONDARY', control: 'ability', label: 'ABILITÀ' }
  ]),
  // Il calcio ha UN solo comando di calcio: 'shoot' (tocco = tiro debole/passaggio, tenuto = carica, rilascio = calcia; la barra di carica
  // e la curva di potenza sono quelle del gioco, invariate). RT e A/✕ sono due modi di premere lo STESSO comando: il gioco non ha un
  // "passaggio" separato e crearne uno cambierebbe il gameplay. Il bordo (down/up) garantisce una sola pressione anche se il tasto resta giu'.
  soccer: defineProfile('soccer', [
    { action: 'MOVE', binding: 'LEFT_STICK', control: 'move', label: 'MUOVITI' },
    { action: 'SHOOT', binding: 'RT', control: 'shoot', label: 'CARICA E TIRA' },
    { action: 'PASS', binding: 'PRIMARY', control: 'shoot', label: 'PASSA (TOCCO BREVE)' },
    { action: 'TACKLE', binding: 'LEFT', control: 'dash', label: 'DASH / TACKLE' },
    { action: 'ABILITY', binding: 'TOP', control: 'ability', label: 'ABILITÀ' }
  ]),
  // Pallavolo: tutti e tre sono comandi a PRESSIONE (justPressed) e indipendenti: direzione + salto + colpo insieme funzionano (ogni tasto
  // e' il proprio evento nell'InputManager). Nessun ritardo aggiunto: il tasto arriva al gioco nello stesso fotogramma di polling.
  volleyball: defineProfile('volleyball', [
    { action: 'MOVE', binding: 'LEFT_STICK', control: 'move', label: 'MUOVITI' },
    { action: 'JUMP', binding: 'LEFT', control: 'jump', label: 'SALTA' },
    { action: 'HIT', binding: 'PRIMARY', control: 'hit', label: 'COLPISCI / SMASH' },
    { action: 'ABILITY', binding: 'SECONDARY', control: 'ability', label: 'ABILITÀ' }
  ]),
  // Kart: RT/LT sono TASTI (pressed/tenuto/rilasciato), come 'up'/'down' del telefono oggi — il gioco non ha un accel/frenata
  // analogici (accelerazione a valore fisso mentre il tasto e' giu'): introdurre una magnitudine cambierebbe la curva fisica,
  // quindi si adatta in modo compatibile ("RT+LT insieme": vince il throttle, identico a oggi con up/down). Lo STERZO invece
  // e' vero analogico: vedi kartPhysics.ts (stessa formula/costanti, solo la sorgente del valore e' continua). B/guarda-dietro
  // non esiste nel gioco: non va inventato qui.
  kart3d: defineProfile('kart3d', [
    { action: 'STEER', binding: 'LEFT_STICK', control: 'steer', label: 'STERZA' },
    // holdThrough: l'acceleratore/freno NON deve richiedere rilascia-e-ripremi al VIA se il giocatore lo tiene premuto da
    // prima (la gara resta comunque ferma fino al VIA: lo garantisce race.phase, non il blocco tasti). Drift/item/abilità
    // restano protetti come sempre: quelli SONO azioni one-shot e devono ripartire da zero dopo la schermata CONTROLLI.
    { action: 'THROTTLE', binding: 'RT', control: 'up', label: 'ACCELERA', holdThrough: true },
    { action: 'BRAKE', binding: 'LT', control: 'down', label: 'FRENA / RETROMARCIA', holdThrough: true },
    { action: 'DRIFT', binding: 'PRIMARY', control: 'drift', label: 'DRIFT' },
    { action: 'ITEM', binding: 'LEFT', control: 'item', label: 'USA ITEM' },
    { action: 'ABILITY', binding: 'TOP', control: 'ability', label: 'ABILITÀ' }
  ]),
  // Memoria: le 4 tessere sono per POSIZIONE fisica (alto/destra/basso/sinistra), non per lettera — il layout sulla TV e'
  // un diamante che ricalca i 4 face button. RB/R1 per l'abilita': i quattro face button sono gia' occupati dalle tessere.
  memory: defineProfile('memory', [
    { action: 'TOP', binding: 'TOP', control: 'c0', label: 'TESSERA IN ALTO' },
    { action: 'RIGHT', binding: 'SECONDARY', control: 'c1', label: 'TESSERA A DESTRA' },
    { action: 'BOTTOM', binding: 'PRIMARY', control: 'c2', label: 'TESSERA IN BASSO' },
    { action: 'LEFT', binding: 'LEFT', control: 'c3', label: 'TESSERA A SINISTRA' },
    { action: 'ABILITY', binding: 'RB', control: 'ability', label: 'ABILITÀ' }
  ]),
  // Botta al Volo: un solo comando di reazione (nessuna carica, nessun asse). La precisione e' quella del polling del
  // browser (vedi F3): nessuna correzione artificiale. Il blocco-fino-al-rilascio GIA' esistente (GamepadManager) e' cio'
  // che impedisce di "precaricare" il tasto durante la schermata CONTROLLI: chi lo tiene premuto da prima resta bloccato
  // finche' non lo rilascia davvero, esattamente come per dash/drift/item negli altri giochi — nessun codice nuovo per questo.
  reaction: defineProfile('reaction', [
    { action: 'REACTION', binding: 'PRIMARY', control: 'action', label: 'PREMI SOLO QUANDO VEDI VIA!' },
    { action: 'ABILITY', binding: 'RB', control: 'ability', label: 'ABILITÀ' }
  ]),
  // Quiz: le 4 risposte restano PUBBLICHE sulla TV (come sempre), quello che resta privato e' QUALE le stai
  // scorrendo — nessun cursore in TV ne' sul telefono, "selectPrev"/"selectNext" spostano solo un indice
  // locale nella scena (vedi QuizScene). CONFERMA chiama submitAnswer esattamente come un tocco sul telefono:
  // nessuna nuova regola di gioco, solo un modo diverso di scegliere l'indice da passargli.
  quiz: defineProfile('quiz', [
    { action: 'SELECT_PREV', binding: 'DPAD_LEFT', control: 'selectPrev', label: 'RISPOSTA PRECEDENTE' },
    { action: 'SELECT_NEXT', binding: 'DPAD_RIGHT', control: 'selectNext', label: 'RISPOSTA SUCCESSIVA' },
    { action: 'CONFIRM', binding: 'PRIMARY', control: 'confirm', label: 'CONFERMA RISPOSTA' },
    { action: 'ABILITY', binding: 'RB', control: 'ability', label: 'ABILITÀ' }
  ]),
  // Sparatoria: stick sinistro = 'move' (identico agli altri giochi, il gioco lo legge gia'). Lo stick destro e'
  // NUOVO (nessun altro gioco mira in prima persona): controlId separato 'lookStick', letto come VELOCITA' angolare
  // (integrata in yaw/pitch da FpsScene, vedi LOOK_SENS_*), mai come posizione assoluta — a differenza di 'look' del
  // telefono (touch-drag, posizione assoluta): i due controlId restano distinti apposta, non si tocca il telefono.
  // A = dash (stesso PRIMARY delle altre azioni "principale non di fuoco" del progetto: dodge/hit/dash...), il gioco
  // non ha un salto quindi non se ne aggiunge uno. X = ricarica. LT non serve ancora (nessuna mira secondaria in
  // M6): non e' nel profilo, non fa nulla. RB resta RISERVATO alle abilita' personaggio: non e' nel profilo.
  fps: defineProfile('fps', [
    { action: 'MOVE', binding: 'LEFT_STICK', control: 'move', label: 'MUOVITI' },
    { action: 'LOOK', binding: 'RIGHT_STICK', control: 'lookStick', label: 'MIRA / GUARDA' },
    { action: 'FIRE', binding: 'RT', control: 'fire', label: 'SPARA' },
    { action: 'DASH', binding: 'PRIMARY', control: 'dash', label: 'SCATTO' },
    { action: 'RELOAD', binding: 'LEFT', control: 'reload', label: 'RICARICA' }
  ])
};

export function profileFor(minigameId: string | null | undefined): PadProfile | null {
  return (minigameId && PAD_PROFILES[minigameId]) || null;
}
