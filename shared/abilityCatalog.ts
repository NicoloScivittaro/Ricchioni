/**
 * CATALOGO DELLE ABILITA' — UNA SOLA FONTE per 5 personaggi x 10 minigiochi (50 combinazioni).
 *
 * Da qui nascono TUTTE le cose che parlano di un'abilita': nome, descrizione breve e completa, limiti (usi / ricarica), tipo e
 * impatto, e i NUMERI della meccanica (`p`). I giochi importano i numeri da qui (nessuna costante duplicata nel codice del gioco),
 * la schermata CONTROLLI sulla TV, la Companion Card del telefono e l'HUD leggono nome e testi da qui: se la durata passa da 5 a 6
 * secondi basta cambiare `p.duration` e la descrizione si rigenera da sola — niente "il codice fa 6, il telefono dice 8".
 *
 * Il TASTO non e' qui: vive in src/input/profiles.ts (la stessa fonte dell'input vero). Lo stato LIVE (PRONTA / ATTIVA / ...) non e'
 * qui: lo decide ogni gioco (unica autorita') e lo pubblica con AbilityStatus (src/core/abilityHub.ts) — il catalogo e' solo statico.
 */

export type AbilityGameId = 'arena' | 'dodgeball' | 'soccer' | 'volleyball' | 'kart3d' | 'fps' | 'memory' | 'reaction' | 'quiz' | 'cultura' | 'cornicione';
export type AbilityCharacterId = 'goblin' | 'buttafuori' | 'judoka' | 'dottore' | 'ciro';

/** I 6 tipi di abilita' del progetto: ogni voce ne ha UNO principale. */
export type AbilityKind = 'ACTIVE_TIMING' | 'LIMITED_RESOURCE' | 'RISK_REWARD' | 'REACTIVE' | 'INFORMATION' | 'RULE_BEND';
export type AbilityImpact = 'LOW' | 'MEDIUM' | 'HIGH';

export const ABILITY_KIND_LABEL: Record<AbilityKind, string> = {
  ACTIVE_TIMING: 'TIMING',
  LIMITED_RESOURCE: 'RISORSA LIMITATA',
  RISK_REWARD: 'RISCHIO / PREMIO',
  REACTIVE: 'REATTIVA',
  INFORMATION: 'INFORMAZIONE',
  RULE_BEND: 'REGOLA PIEGATA'
};

/** Stato PRESENTAZIONALE (mai una seconda simulazione): lo calcola il gioco dal suo stato vero. */
export type AbilityState = 'READY' | 'CHARGING' | 'ACTIVE' | 'COOLDOWN' | 'SPENT';

export interface AbilityStatus {
  state: AbilityState;
  /** secondi rimasti: durata residua se ACTIVE, ricarica residua se COOLDOWN */
  remaining?: number;
  /** usi ancora disponibili (solo se il gioco ha piu' cariche) */
  charges?: number;
  /** barra di carica 0..1 (solo CHARGING: Kart) */
  meter?: number;
  /** riga breve libera dal gioco ("ARMATA", "ESAURITA"...) — sostituisce l'etichetta standard */
  note?: string;
}

export interface AbilityDef {
  game: AbilityGameId;
  character: AbilityCharacterId;
  /** nome da urlare ("PAGO DOMANI") */
  name: string;
  kind: AbilityKind;
  impact: AbilityImpact;
  /** una riga: cosa fa (schermata CONTROLLI, HUD) */
  short: string;
  /** 2-4 righe: COSA FA · QUANDO PREMERE · LIMITE (Companion Card). Niente lore. */
  full: string;
  /** "1 uso" / "2 usi · ricarica 6 s" */
  limit: string;
  /** usi per round (0 = illimitati, solo ricarica) */
  charges: number;
  /** secondi di ricarica fra due usi (0 = nessuna) */
  cooldown: number;
  /** numeri della meccanica: il gioco legge SOLO da qui */
  p: Record<string, number>;
}

/** Secondi senza decimali superflui: 6 -> "6", 4.5 -> "4,5" (italiano). */
export const sec = (n: number): string => (Number.isInteger(n) ? String(n) : String(n).replace('.', ',')) + ' s';

function limitText(charges: number, cooldown: number): string {
  const uses = charges === 1 ? '1 uso' : charges > 1 ? `${charges} usi` : 'illimitata';
  return cooldown > 0 ? `${uses} · ricarica ${sec(cooldown)}` : uses;
}

function def(d: Omit<AbilityDef, 'limit'> & { limit?: string }): AbilityDef {
  return { ...d, limit: d.limit ?? limitText(d.charges, d.cooldown) };
}

const R: Record<string, Record<string, AbilityDef>> = {};
function add(d: AbilityDef): AbilityDef {
  (R[d.game] ??= {})[d.character] = d;
  return d;
}

// ============================================================================================================================
// ARENA DEL DISAGIO — sumo a spinte: dash, knockback, cadere dal bordo = fuori. Round da 45 s.
// ============================================================================================================================
const A = {
  goblin: add(
    def({
      game: 'arena',
      character: 'goblin',
      name: "N'CULO!",
      kind: 'ACTIVE_TIMING',
      impact: 'HIGH',
      charges: 2,
      cooldown: 6,
      p: { window: 0.45, reflect: 1.8, stun: 0.6, whiff: 0.7 },
      short: 'Parata a tempo: chi ti colpisce vola via.',
      full: ''
    })
  ),
  buttafuori: add(
    def({
      game: 'arena',
      character: 'buttafuori',
      name: "MO M'IMPEGNO",
      kind: 'REACTIVE',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      p: { duration: 4, resist: 0.25, speed: 0.8, pulseRadius: 4.5, pulseMax: 20 },
      short: 'Reggi le spinte, poi le restituisci.',
      full: ''
    })
  ),
  judoka: add(
    def({
      game: 'arena',
      character: 'judoka',
      name: 'IPPON',
      kind: 'ACTIVE_TIMING',
      impact: 'HIGH',
      charges: 2,
      cooldown: 8,
      p: { reach: 2.6, throw: 22, whiff: 0.6, stun: 0.9 },
      short: 'Afferri chi hai davanti e lo scaraventi.',
      full: ''
    })
  ),
  dottore: add(
    def({
      game: 'arena',
      character: 'dottore',
      name: "M'HO SVEJATO",
      kind: 'REACTIVE',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      p: { window: 4.5, stun: 0.6, drowsy: 1.5, drowsySpeed: 0.7 },
      short: 'Schivi da sveglio il primo scatto che ti punta.',
      full: ''
    })
  ),
  ciro: add(
    def({
      game: 'arena',
      character: 'ciro',
      name: 'PAGO DOMANI',
      kind: 'RISK_REWARD',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      p: { arm: 8, debt: 6 },
      short: 'Il bordo non ti elimina: lo paghi dopo.',
      full: ''
    })
  )
};
A.goblin.full = `Premi un attimo PRIMA dell'urto: per ${sec(A.goblin.p.window)} chi ti colpisce vola via con una spinta molto più forte e resta stordito. Se sbagli tempo, perdi ${sec(A.goblin.p.whiff)} e vai fuori equilibrio.`;
A.buttafuori.full = `Per ${sec(A.buttafuori.p.duration)} le spinte ti spostano appena. Quello che assorbi si accumula e alla fine lo restituisci in un'onda d'urto attorno a te. Più botte prendi, più forte torna.`;
A.judoka.full = `Premi quando un avversario è a un passo davanti a te: lo afferri e lo scaraventi via con una spinta enorme. Se non c'è nessuno a portata, perdi ${sec(A.judoka.p.whiff)} a vuoto.`;
A.dottore.full = `Per ${sec(A.dottore.p.window)} schivi in automatico il primo scatto diretto contro di te e chi ti ha attaccato inciampa. Se nessuno ti attacca, ti riaddormenti e per ${sec(A.dottore.p.drowsy)} sei lento.`;
A.ciro.full = `Premi prima di finire sul bordo (resta armata ${sec(A.ciro.p.arm)}). Se stai per cadere fuori, ti salvi ma hai un DEBITO di ${sec(A.ciro.p.debt)}: spingi un avversario prima che scada, o cadi davvero.`;

// ============================================================================================================================
// DODGEBALL DEI COGLIONI — palle, schivate, eliminazione. Round da 45 s. (Direzione gia' buona: numeri portati qui, effetto invariato.)
// ============================================================================================================================
const D = {
  goblin: add(
    def({
      game: 'dodgeball',
      character: 'goblin',
      name: "N'CULO, RIPIGLIATELA!",
      kind: 'ACTIVE_TIMING',
      impact: 'HIGH',
      charges: 2,
      cooldown: 7,
      p: { parry: 0.42 },
      short: 'Pari la palla a tempo e la rimandi indietro.',
      full: ''
    })
  ),
  buttafuori: add(
    def({
      game: 'dodgeball',
      character: 'buttafuori',
      name: 'OCCHIO DA POLIGONO',
      kind: 'INFORMATION',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      p: { aim: 5, speed: 1.6 },
      short: 'Mira laser e primo tiro velocissimo.',
      full: ''
    })
  ),
  judoka: add(
    def({
      game: 'dodgeball',
      character: 'judoka',
      name: 'CARICO E SCARICO',
      kind: 'RULE_BEND',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      p: { beep: 0.9, truck: 1.4, balls: 2 },
      short: 'Camion: raccogli due palle e le scarichi.',
      full: ''
    })
  ),
  dottore: add(
    def({
      game: 'dodgeball',
      character: 'dottore',
      name: 'TRE MESI DOPO',
      kind: 'INFORMATION',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      p: { vision: 6, dodgeCd: 0.3, invuln: 1.5 },
      short: 'Vedi le traiettorie e le schivate si ricaricano subito.',
      full: ''
    })
  ),
  ciro: add(
    def({
      game: 'dodgeball',
      character: 'ciro',
      name: 'PAGO DOMANI',
      kind: 'RISK_REWARD',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      p: { arm: 4, debt: 4 },
      short: 'Il colpo che ti elimina diventa un debito.',
      full: ''
    })
  )
};
D.goblin.full = `Premi quando la palla sta per colpirti: per ${sec(D.goblin.p.parry)} la pari e la rimandi più veloce a chi l'ha lanciata. Se sbagli il momento, vieni colpito normalmente.`;
D.buttafuori.full = `Per ${sec(D.buttafuori.p.aim)} vedi la linea esatta del tuo lancio (la vedono tutti). Il primo tiro parte ${D.buttafuori.p.speed.toString().replace('.', ',')}× più veloce e dritto. Usalo quando sai chi colpire.`;
D.judoka.full = `Dopo ${sec(D.judoka.p.beep)} di segnale acustico parti col camion per ${sec(D.judoka.p.truck)}: raccogli fino a ${D.judoka.p.balls} palle sulla strada. Poi le scarichi a raffica. Contro un muro ti stordisci.`;
D.dottore.full = `Per ${sec(D.dottore.p.vision)} vedi dove arriveranno le palle lanciate verso di te e la schivata si ricarica in un attimo (e ti protegge più a lungo). Usala quando il campo è pieno di palle.`;
D.ciro.full = `Premi prima di essere colpito (resta armata ${sec(D.ciro.p.arm)}): il colpo che ti eliminerebbe diventa un DEBITO di ${sec(D.ciro.p.debt)}. Colpisci un avversario prima che scada e sei salvo, altrimenti sei fuori.`;

// ============================================================================================================================
// CALCIO DEI DISAGIATI
// ============================================================================================================================
const S = {
  goblin: add(
    def({
      game: 'soccer',
      character: 'goblin',
      name: "N'CULO!",
      kind: 'ACTIVE_TIMING',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      p: { arm: 5, sweetFrom: 0.72, sweetTo: 0.95, curve: 1.0, power: 1.3, wobblePower: 0.55 },
      short: 'Tiro a giro: caricalo e lascialo nel punto giusto.',
      full: ''
    })
  ),
  buttafuori: add(
    def({
      game: 'soccer',
      character: 'buttafuori',
      name: 'TU QUA NON ENTRI',
      kind: 'REACTIVE',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      p: { duration: 4, speed: 0.8, tacklerStun: 0.9 },
      short: 'Per qualche secondo nessuno ti ruba la palla.',
      full: ''
    })
  ),
  judoka: add(
    def({
      game: 'soccer',
      character: 'judoka',
      name: 'IPPON',
      kind: 'ACTIVE_TIMING',
      impact: 'HIGH',
      charges: 2,
      cooldown: 10,
      p: { reach: 2.4, attempt: 5.5, stun: 1.2, whiff: 0.8, push: 14 },
      short: 'Presa sul portatore di palla: gliela strappi.',
      full: ''
    })
  ),
  dottore: add(
    def({
      game: 'soccer',
      character: 'dottore',
      name: "M'HO SVEJATO",
      kind: 'INFORMATION',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      p: { window: 5, minCharge: 0.4, power: 1.25, slow: 0.75, slowTime: 3 },
      short: 'Il prossimo tiro va dritto nell’angolo giusto.',
      full: ''
    })
  ),
  ciro: add(
    def({
      game: 'soccer',
      character: 'ciro',
      name: 'PAGO DOMANI',
      kind: 'RISK_REWARD',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      p: { arm: 6, debt: 5, tacklerStun: 0.8 },
      short: 'Il primo contrasto è rimandato: poi lo paghi.',
      full: ''
    })
  )
};
S.goblin.full = `Premi, poi carica un tiro per ${sec(S.goblin.p.arm)}: se lo lasci nella zona verde della barra diventa un tiro a giro fortissimo. Fuori dalla zona verde il tiro esce moscio. Una sola occasione.`;
S.buttafuori.full = `Per ${sec(S.buttafuori.p.duration)} chi prova a contrastarti rimbalza e resta fermo ${sec(S.buttafuori.p.tacklerStun)}. Corri più piano (${Math.round((1 - S.buttafuori.p.speed) * 100)}% in meno). Usala quando hai la palla e due avversari addosso.`;
S.judoka.full = `Premi quando sei a un passo da chi ha la palla: lo afferri, gli strappi la palla e lo butti a terra per ${sec(S.judoka.p.stun)}. Se ci provi da troppo lontano, perdi ${sec(S.judoka.p.whiff)}.`;
S.dottore.full = `Per ${sec(S.dottore.p.window)} il tuo prossimo TIRO (non il passaggio) va da solo verso l'angolo meno coperto, con più potenza; vedi dove andrà. Dopo sei lento per ${sec(S.dottore.p.slowTime)}: l'effetto passa.`;
S.ciro.full = `Premi con la palla: per ${sec(S.ciro.p.arm)} il primo contrasto che subisci non ti toglie palla e stordisce chi ti ha attaccato. Il conto arriva dopo ${sec(S.ciro.p.debt)}: passa o tira prima, o perdi la palla.`;

// ============================================================================================================================
// PALLAVOLO DEI DISAGIATI
// ============================================================================================================================
const V = {
  goblin: add(
    def({
      game: 'volleyball',
      character: 'goblin',
      name: 'JÄGER BOMB',
      kind: 'ACTIVE_TIMING',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      p: { arm: 6, power: 1.55 },
      short: 'Smash perfetto devastante: se sbagli, è sprecato.',
      full: ''
    })
  ),
  buttafuori: add(
    def({
      game: 'volleyball',
      character: 'buttafuori',
      name: 'MURO DEL POLIGONO',
      kind: 'REACTIVE',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      p: { duration: 6, reach: 1.35, netZone: 3.4, down: -2.2, speed: 0.85 },
      short: 'Muro a rete: la palla che tocchi in alto torna giù.',
      full: ''
    })
  ),
  judoka: add(
    def({
      game: 'volleyball',
      character: 'judoka',
      name: 'NO, ASPETTA!',
      kind: 'RULE_BEND',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      p: { freeze: 1.2, speed: 1.35 },
      short: 'Ferma la palla in aria: solo tu puoi muoverti.',
      full: ''
    })
  ),
  dottore: add(
    def({
      game: 'volleyball',
      character: 'dottore',
      name: "M'HO SVEJATO",
      kind: 'INFORMATION',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      p: { duration: 6, jump: 1.25, speed: 1.2, dizzy: 2, dizzySpeed: 0.85 },
      short: 'Salti e corri meglio, e il tuo smash va dove nessuno difende.',
      full: ''
    })
  ),
  ciro: add(
    def({
      game: 'volleyball',
      character: 'ciro',
      name: 'PAGO DOMANI',
      kind: 'RISK_REWARD',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      p: { arm: 8, debtPoints: 1 },
      short: 'La palla a terra non conta: ma se perdi lo scambio, vale doppio.',
      full: ''
    })
  )
};
V.goblin.full = `Premi, poi colpisci lo smash a mezz'aria nel momento giusto (${sec(V.goblin.p.arm)} di tempo): diventa una bomba ${V.goblin.p.power.toString().replace('.', ',')}× più forte. Colpisci male e l'abilità è sprecata.`;
V.buttafuori.full = `Per ${sec(V.buttafuori.p.duration)} sei un muro: vicino alla rete le tue braccia arrivano più lontano e la palla che colpisci in alto torna giù dall'altra parte, come uno smash.`;
V.judoka.full = `Premi con la palla in aria: la blocchi per ${sec(V.judoka.p.freeze)} e solo tu puoi muoverti, più veloce. Usala per rimontare un pallone impossibile.`;
V.dottore.full = `Per ${sec(V.dottore.p.duration)} salti e corri meglio, e il tuo prossimo smash va da solo dove nessuno difende. Poi ti gira la testa per ${sec(V.dottore.p.dizzy)}: scivoli.`;
V.ciro.full = `Premi (armata ${sec(V.ciro.p.arm)}): la prima palla che tocca terra nel tuo campo rimbalza e lo scambio continua. Ma se poi perdi lo scambio, l'avversario ne guadagna ${V.ciro.p.debtPoints + 1}.`;

// ============================================================================================================================
// KART (RIBALTATI) — gare da 170 s.
// ============================================================================================================================
const K = {
  goblin: add(
    def({
      game: 'kart3d',
      character: 'goblin',
      name: 'SO GUIDARE IO',
      kind: 'ACTIVE_TIMING',
      impact: 'HIGH',
      charges: 0,
      cooldown: 0,
      limit: 'a barra piena',
      p: { duration: 6, driftMult: 1.6 },
      short: 'Drift perfetti = turbo più forti, finché non sbatti.',
      full: ''
    })
  ),
  buttafuori: add(
    def({
      game: 'kart3d',
      character: 'buttafuori',
      name: 'RIBALTATO MA NON MORTO',
      kind: 'REACTIVE',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a gara',
      p: { window: 1.2, severeStun: 1, boost: 20, boostTime: 0.9 },
      short: 'Dopo uno schianto: premi e torni subito in pista.',
      full: ''
    })
  ),
  judoka: add(
    def({
      game: 'kart3d',
      character: 'judoka',
      name: 'CARICO E SCARICO',
      kind: 'RISK_REWARD',
      impact: 'HIGH',
      charges: 0,
      cooldown: 0,
      limit: 'a barra piena',
      p: { duration: 5, steer: 0.75, shove: 9, slow: 0.7, slowTime: 1.2 },
      short: 'Camion: spingi via chi tocchi, ma sterzi male.',
      full: ''
    })
  ),
  dottore: add(
    def({
      game: 'kart3d',
      character: 'dottore',
      name: '20 KG IN UN MESE',
      kind: 'RISK_REWARD',
      impact: 'HIGH',
      charges: 0,
      cooldown: 0,
      limit: 'a barra piena',
      p: { duration: 6, accel: 1.35, driftRate: 1.8 },
      short: 'Leggerissimo: accelera e drifta, ma voli se ti urtano.',
      full: ''
    })
  ),
  ciro: add(
    def({
      game: 'kart3d',
      character: 'ciro',
      name: 'PAGO DOPO',
      kind: 'REACTIVE',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a gara',
      p: { before: 0.5, after: 0.6, debt: 4 },
      short: 'Rimanda un colpo: lo paghi dopo qualche secondo.',
      full: ''
    })
  )
};
K.goblin.full = `Guida bene (drift puliti, sorpassi) per riempire la barra, poi premi: per ${sec(K.goblin.p.duration)} i mini-turbo dei drift sono ${K.goblin.p.driftMult.toString().replace('.', ',')}× più forti. Se sbatti o esci di pista, l'effetto finisce subito.`;
K.buttafuori.full = `Se fai uno schianto grave hai ${sec(K.buttafuori.p.window)} per premere: torni subito in pista con un boost. Se non premi, ti rialzi lentamente come tutti. Una volta a gara.`;
K.judoka.full = `Riempi la barra, poi premi: per ${sec(K.judoka.p.duration)} sei un camion. Chi tocchi viene spinto di lato e rallentato, tu non perdi velocità negli urti. Sterzi ${Math.round((1 - K.judoka.p.steer) * 100)}% peggio.`;
K.dottore.full = `Riempi la barra, poi premi: per ${sec(K.dottore.p.duration)} accelerazione e drift facilissimi. Ma sei leggerissimo: chi ti urta ti manda lontano.`;
K.ciro.full = `Premi appena prima (o subito dopo, entro ${sec(K.ciro.p.after)}) di essere colpito da un oggetto: l'effetto non arriva subito ma dopo ${sec(K.ciro.p.debt)} come DEBITO. Una volta a gara.`;

// ============================================================================================================================
// SPARATORIA DEI DISAGIATI (FPS) — prima abilita' vera: RB era riservato e non faceva niente.
// ============================================================================================================================
const F = {
  goblin: add(
    def({
      game: 'fps',
      character: 'goblin',
      name: "N'CULO!",
      kind: 'ACTIVE_TIMING',
      impact: 'MEDIUM',
      charges: 0,
      cooldown: 14,
      p: { from: 0.45, buff: 1.3, buffShots: 6, early: 0.4 },
      short: 'Ricarica perfetta: istantanea e più danno per qualche colpo.',
      full: ''
    })
  ),
  buttafuori: add(
    def({
      game: 'fps',
      character: 'buttafuori',
      name: 'TU QUA NON ENTRI',
      kind: 'REACTIVE',
      impact: 'HIGH',
      charges: 0,
      cooldown: 25,
      p: { duration: 4, taken: 0.4, speed: 0.85, heal: 0.4 },
      short: 'Giubbotto: subisci molto meno danno.',
      full: ''
    })
  ),
  judoka: add(
    def({
      game: 'fps',
      character: 'judoka',
      name: 'NO, ASPETTA!',
      kind: 'ACTIVE_TIMING',
      impact: 'HIGH',
      charges: 0,
      cooldown: 15,
      p: { range: 6, cone: 0.9, lock: 1.2, push: 6, ipponRange: 2.5, ipponStun: 1 },
      short: 'Spinta che interrompe: ricariche e spari bloccati.',
      full: ''
    })
  ),
  dottore: add(
    def({
      game: 'fps',
      character: 'dottore',
      name: "M'HO SVEJATO",
      kind: 'INFORMATION',
      impact: 'MEDIUM',
      charges: 0,
      cooldown: 22,
      p: { duration: 5, drowsy: 3, spreadMult: 2 },
      short: 'Vedi dove sono tutti. Poi ti gira la testa.',
      full: ''
    })
  ),
  ciro: add(
    def({
      game: 'fps',
      character: 'ciro',
      name: 'PAGO DOMANI',
      kind: 'RISK_REWARD',
      impact: 'HIGH',
      charges: 2,
      cooldown: 0,
      p: { arm: 8, debt: 5, heal: 50, speed: 1.15 },
      short: 'Non muori: ti serve una kill per saldare.',
      full: ''
    })
  )
};
F.goblin.full = `Ricarica, poi premi nella parte finale della ricarica (zona verde): finisce subito e per ${F.goblin.p.buffShots} colpi fai ${Math.round((F.goblin.p.buff - 1) * 100)}% di danno in più. Premi troppo presto e la ricarica si allunga di ${sec(F.goblin.p.early)}.`;
F.buttafuori.full = `Per ${sec(F.buttafuori.p.duration)} subisci il ${Math.round(F.buttafuori.p.taken * 100)}% del danno e corri un po' più piano. Alla fine recuperi il ${Math.round(F.buttafuori.p.heal * 100)}% della vita che hai assorbito.`;
F.judoka.full = `Spinta davanti a te (${F.judoka.p.range} metri): chi colpisci non può sparare né ricaricare per ${sec(F.judoka.p.lock)} ed è respinto. A meno di ${F.judoka.p.ipponRange} metri è IPPON: resta a terra ${sec(F.judoka.p.ipponStun)}.`;
F.dottore.full = `Per ${sec(F.dottore.p.duration)} vedi tutti gli avversari anche dietro i muri. Poi per ${sec(F.dottore.p.drowsy)} la mira ti trema: i colpi si disperdono il doppio.`;
F.ciro.full = `Premi (armata ${sec(F.ciro.p.arm)}): se stai per morire resti a 1 di vita per ${sec(F.ciro.p.debt)}, più veloce. Fai una kill e recuperi ${F.ciro.p.heal} di vita. Se scade, muori. ${F.ciro.charges} usi a partita.`;

// ============================================================================================================================
// MEMORIA DA UBRIACO — una volta a partita. (Effetti invariati: portati qui i numeri e le descrizioni.)
// ============================================================================================================================
const M = {
  goblin: add(
    def({
      game: 'memory',
      character: 'goblin',
      name: 'ANCORA UN GIRO',
      kind: 'INFORMATION',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { replayTile: 0.42 },
      short: 'Rivedi la sequenza, solo tu.',
      full: ''
    })
  ),
  buttafuori: add(
    def({
      game: 'memory',
      character: 'buttafuori',
      name: 'MO HO CAPITO',
      kind: 'REACTIVE',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { penaltyMs: 1000 },
      short: 'Il primo errore non ti elimina.',
      full: ''
    })
  ),
  judoka: add(
    def({
      game: 'memory',
      character: 'judoka',
      name: 'NO, ASPETTA!',
      kind: 'RULE_BEND',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { pause: 2 },
      short: 'Ferma il tuo tempo e riprendi dopo.',
      full: ''
    })
  ),
  dottore: add(
    def({
      game: 'memory',
      character: 'dottore',
      name: "M'HO SVEJATO",
      kind: 'INFORMATION',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { peekMs: 1200, penaltyMs: 800 },
      short: 'Sbirci la prossima casella giusta.',
      full: ''
    })
  ),
  ciro: add(
    def({
      game: 'memory',
      character: 'ciro',
      name: 'A RATE',
      kind: 'RISK_REWARD',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { pause: 2, creditMs: 1500 },
      short: 'Pausa a metà sequenza, con sconto sul tempo.',
      full: ''
    })
  )
};
M.goblin.full = `Premi mentre guardi la sequenza: la rivedi una seconda volta, solo tu, sul tuo schermo. Una volta a partita.`;
M.buttafuori.full = `Si attiva da sola: se sbagli una casella puoi correggerti e continuare, con ${(M.buttafuori.p.penaltyMs / 1000).toString().replace('.', ',')} s di penalità sul tuo tempo. Non serve premere. Una volta a partita.`;
M.judoka.full = `Premi mentre ripeti la sequenza: il tuo tempo si ferma per ${sec(M.judoka.p.pause)} e non puoi toccare. Poi riprendi da dove eri, senza replay. Una volta a partita.`;
M.dottore.full = `Premi mentre ripeti: vedi per un attimo la prossima casella giusta, solo tu. Costa ${(M.dottore.p.penaltyMs / 1000).toString().replace('.', ',')} s sul tuo tempo. Una volta a partita.`;
M.ciro.full = `Premi mentre ripeti: pausa di ${sec(M.ciro.p.pause)} e ${(M.ciro.p.creditMs / 1000).toString().replace('.', ',')} s in meno sul tuo tempo. Una volta a partita.`;

// ============================================================================================================================
// BOTTA AL VOLO — una volta a round. Mai anticipazioni del VIA: le abilita' manipolano errore, falso allarme e rischio.
// ============================================================================================================================
const T = {
  goblin: add(
    def({
      game: 'reaction',
      character: 'goblin',
      name: "N'CULO!",
      kind: 'RISK_REWARD',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a round',
      p: {},
      short: 'Annulla il finto VIA e riparte l’attesa.',
      full: ''
    })
  ),
  buttafuori: add(
    def({
      game: 'reaction',
      character: 'buttafuori',
      name: 'MO HO CAPITO',
      kind: 'REACTIVE',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a round',
      p: { penaltyMs: 120 },
      short: 'Falsa partenza? Hai una seconda chance.',
      full: ''
    })
  ),
  judoka: add(
    def({
      game: 'reaction',
      character: 'judoka',
      name: 'ASPETTA UN ATTIMO!',
      kind: 'RULE_BEND',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a round',
      p: { reset: 1 },
      short: 'Finto reset per tutti, poi nuovo timer.',
      full: ''
    })
  ),
  dottore: add(
    def({
      game: 'reaction',
      character: 'dottore',
      name: "M'HO SVEJATO",
      kind: 'INFORMATION',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { focus: 2 },
      short: 'Focus: se il VIA cade nella finestra, lo senti.',
      full: ''
    })
  ),
  ciro: add(
    def({
      game: 'reaction',
      character: 'ciro',
      name: 'ULTIMO SECONDO',
      kind: 'INFORMATION',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: {},
      short: 'In guardia: sai se qualcuno sbaglia o se è un falso allarme.',
      full: ''
    })
  )
};
T.goblin.full = `Premi durante l'attesa, appena compare un FINTO VIA: lo annulli e riparte un nuovo timer per tutti. Se premi troppo presto (senza finto VIA) sei ubriaco e perdi tempo. Una volta a round.`;
T.buttafuori.full = `Si attiva da solo: se parti troppo presto hai una seconda chance nello stesso round, con +${T.buttafuori.p.penaltyMs} ms sul tempo. Non serve premere. Una volta a round.`;
T.judoka.full = `Premi durante l'attesa: finto reset di ${sec(T.judoka.p.reset)} per TUTTI, poi nuovo timer casuale. Serve a rovinare il ritmo degli altri. Una volta a round.`;
T.dottore.full = `Premi durante l'attesa: apri un FOCUS di ${sec(T.dottore.p.focus)}. Se il VIA cade dentro, senti la vibrazione nello stesso istante della TV (nessuna anticipazione). Una volta a partita.`;
T.ciro.full = `Premi durante l'attesa: resti in guardia. Se parte un falso allarme o qualcuno sbaglia, il telefono ti dice NON È ANCORA FINITA. Non sai quando arriva il VIA. Una volta a partita.`;

// ============================================================================================================================
// CHI CAZZO LO SA? — una volta a partita. (Effetti invariati; numeri portati qui.)
// ============================================================================================================================
const Q = {
  goblin: add(
    def({
      game: 'quiz',
      character: 'goblin',
      name: "N'CULO!",
      kind: 'RULE_BEND',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: {},
      short: 'Rifiuti la domanda: ne arriva una nuova, per tutti.',
      full: ''
    })
  ),
  buttafuori: add(
    def({
      game: 'quiz',
      character: 'buttafuori',
      name: 'MO HO CAPITO',
      kind: 'REACTIVE',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { retry: 4, halfPoints: 0.5 },
      short: 'Se sbagli, riprovi per metà punti.',
      full: ''
    })
  ),
  judoka: add(
    def({
      game: 'quiz',
      character: 'judoka',
      name: 'NO, ASPETTA!',
      kind: 'RULE_BEND',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { extra: 3 },
      short: 'Dopo aver risposto, puoi ancora cambiare.',
      full: ''
    })
  ),
  dottore: add(
    def({
      game: 'quiz',
      character: 'dottore',
      name: "M'HO SVEJATO",
      kind: 'INFORMATION',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { points: 0.7 },
      short: 'Un indizio vero, in privato, per il 70% dei punti.',
      full: ''
    })
  ),
  ciro: add(
    def({
      game: 'quiz',
      character: 'ciro',
      name: 'ULTIMO GIORNO UTILE',
      kind: 'INFORMATION',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { extra: 4 },
      short: 'Aspetti la fine del tempo e vedi come hanno risposto.',
      full: ''
    })
  )
};
Q.goblin.full = `Premi prima di rispondere: la domanda viene rifiutata e ne arriva una nuova della stessa difficoltà, per tutti. Se la nuova è peggiore è un problema tuo. Una volta a partita.`;
Q.buttafuori.full = `Premi dopo aver sbagliato: hai ${sec(Q.buttafuori.p.retry)} per riprovare e, se indovini, prendi metà dei punti. Una volta a partita.`;
Q.judoka.full = `Premi dopo aver risposto: puoi cambiare risposta (+${sec(Q.judoka.p.extra)}). Una volta a partita.`;
Q.dottore.full = `Premi quando sei bloccato: un indizio vero, solo sul tuo telefono. Se poi indovini, vale il ${Math.round(Q.dottore.p.points * 100)}% dei punti. Una volta a partita.`;
Q.ciro.full = `Lascia scadere il timer, poi premi: vedi quanti hanno scelto A/B/C/D e hai altri ${sec(Q.ciro.p.extra)} per rispondere. Una volta a partita.`;

// ============================================================================================================================
// CULTURA O CAZZATA — abilita' di PERSONAGGIO (una volta a partita), distinte dai ruoli del round (Secchione, Avvocato) e da
// TE CONOSCO, COGLIONE (che e' di tutti). Si usano dal telefono nella fase di voto.
// ============================================================================================================================
const C = {
  goblin: add(
    def({
      game: 'cultura',
      character: 'goblin',
      name: "N'CULO!",
      kind: 'RISK_REWARD',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { bonus: 3, penalty: 2 },
      short: 'Raddoppi la puntata sul voto: o la vera, o ti costa.',
      full: ''
    })
  ),
  buttafuori: add(
    def({
      game: 'cultura',
      character: 'buttafuori',
      name: 'TU QUA NON ENTRI',
      kind: 'INFORMATION',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: {},
      short: 'Butti fuori una risposta falsa a caso, solo per te.',
      full: ''
    })
  ),
  judoka: add(
    def({
      game: 'cultura',
      character: 'judoka',
      name: 'NO, ASPETTA!',
      kind: 'RULE_BEND',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { extra: 6 },
      short: 'Ferma il voto: +6 secondi per tutti, non si chiude in anticipo.',
      full: ''
    })
  ),
  dottore: add(
    def({
      game: 'cultura',
      character: 'dottore',
      name: "M'HO SVEJATO",
      kind: 'INFORMATION',
      impact: 'MEDIUM',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { cost: 1 },
      short: 'Intuizione: iniziale e numero di parole della vera.',
      full: ''
    })
  ),
  ciro: add(
    def({
      game: 'cultura',
      character: 'ciro',
      name: 'ULTIMO GIORNO UTILE',
      kind: 'INFORMATION',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      limit: '1 uso a partita',
      p: { extra: 5 },
      short: 'Vedi quanti voti ha ogni risposta, in tempo reale.',
      full: ''
    })
  )
};
C.goblin.full = `Premi prima di votare: se scegli la risposta vera prendi +${C.goblin.p.bonus} punti in più. Se ti fai fregare da una cazzata perdi ${C.goblin.p.penalty} punti. Una volta a partita.`;
C.buttafuori.full = `Premi durante il voto: una risposta FALSA a caso sparisce dal tuo telefono. Non cancella mai quella vera. Una volta a partita.`;
C.judoka.full = `Premi durante il voto: il timer si allunga di ${sec(C.judoka.p.extra)} per tutti e il voto non si chiude in anticipo, nemmeno se tutti hanno già votato. Una volta a partita.`;
C.dottore.full = `Premi durante il voto: ti arriva solo un'intuizione sulla risposta vera (iniziale della parola principale e numero di parole). Costa ${C.dottore.p.cost} punto di "parcella". Una volta a partita.`;
C.ciro.full = `Premi durante il voto: vedi in tempo reale quanti voti ha preso ogni risposta (non chi li ha dati) e hai almeno ${sec(C.ciro.p.extra)} per scegliere. Una volta a partita.`;

// ============================================================================================================================
// BOTTE SUL CORNICIONE — platform fighter 2.5D: percentuale di danno, 3 vite, recovery e edge guard. Le abilita' valgono PER VITA
// (tornano pronte a ogni respawn). Nessuna differenza di statistiche fra i personaggi: l'unica differenza e' questa.
// ============================================================================================================================
const CO = {
  goblin: add(
    def({
      game: 'cornicione',
      character: 'goblin',
      name: 'RIMONTA AL 90°',
      kind: 'RISK_REWARD',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      limit: '1 uso per vita',
      p: { burst: 24, burstTime: 0.3, outX: 12.2, returnWindow: 2.5, followWindow: 1.2, followDmg: 9 },
      short: 'Fuori dal palco, in aria: scatto diagonale di recupero.',
      full: ''
    })
  ),
  buttafuori: add(
    def({
      game: 'cornicione',
      character: 'buttafuori',
      name: 'ULTIMO ACCESSO: 3 SETTIMANE FA',
      kind: 'RULE_BEND',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      limit: '1 uso per vita',
      p: { vanish: 1.1, dist: 4.5, telegraph: 0.45, lockDodge: 0.5 },
      short: 'Sparisci un attimo e riappari lì vicino: nessuno ti tocca.',
      full: ''
    })
  ),
  judoka: add(
    def({
      game: 'cornicione',
      character: 'judoka',
      name: 'ANGORA CHE DICI?',
      kind: 'REACTIVE',
      impact: 'HIGH',
      charges: 2,
      cooldown: 0,
      limit: '2 usi per vita',
      p: { window: 0.5, whiff: 0.55, freeze: 0.18, throwBase: 14, throwScale: 0.35, throwCap: 32, throwDmg: 8 },
      short: 'Postura di contrattacco: se ti colpiscono corpo a corpo, li proietti.',
      full: ''
    })
  ),
  dottore: add(
    def({
      game: 'cornicione',
      character: 'dottore',
      name: 'TAGLIO PESO EXPRESS',
      kind: 'RISK_REWARD',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      limit: '1 uso per vita',
      p: { duration: 5, knock: 1.9, airAccel: 1.6, airSpeed: 1.25, jump: 1.12, gravity: 0.6 },
      short: 'Leggerissimo per qualche secondo: agile, ma voli via molto di più.',
      full: ''
    })
  ),
  ciro: add(
    def({
      game: 'cornicione',
      character: 'ciro',
      name: 'BONIFICO IN LAVORAZIONE',
      kind: 'REACTIVE',
      impact: 'HIGH',
      charges: 1,
      cooldown: 0,
      limit: '1 uso per vita',
      p: { window: 0.6, pending: 2.5, debt: 25 },
      short: 'Sul punto di morire premi: il KO è rinviato, ma poi si paga.',
      full: ''
    })
  )
};
CO.goblin.full = `Premi in aria quando sei fuori dal palco, muovendo lo stick: scatto diagonale (non è un teletrasporto). Se rimetti piede sul palco entro ${sec(CO.goblin.p.returnWindow)} hai ${sec(CO.goblin.p.followWindow)} per un attacco aereo speciale. Se lo sprechi, per questa vita è finita. Non funziona mentre sei in stordimento.`;
CO.buttafuori.full = `Premi: per ${sec(CO.buttafuori.p.vanish)} sparisci, non colpisci e non puoi essere colpito. Lo stick sceglie dove riappari (a circa ${CO.buttafuori.p.dist} m): gli altri vedono il punto poco prima. Quando torni non puoi schivare per ${sec(CO.buttafuori.p.lockDodge)}. Una volta per vita.`;
CO.judoka.full = `Premi: per ${sec(CO.judoka.p.window)} sei in postura. Se in quel momento ti colpisce un attacco corpo a corpo, il colpo si annulla e lo afferri: lo stick sceglie dove lo scagli (sinistra, destra, giù); più forte era il colpo, più forte il lancio. Se non ti colpiscono resti scoperto ${sec(CO.judoka.p.whiff)}. Due usi per vita.`;
CO.dottore.full = `Premi: per ${sec(CO.dottore.p.duration)} sei più leggero: controllo aereo, salto e caduta molto migliori. Ma i colpi che prendi ti lanciano ${CO.dottore.p.knock}× più lontano: un colpo pesante a percentuale alta ti manda fuori. Una volta per vita.`;
CO.ciro.full = `Quando stai per finire fuori si apre per ${sec(CO.ciro.p.window)} la finestra "BONIFICO?": premi per rinviare il KO e avere ${sec(CO.ciro.p.pending)} per rientrare. Se rientri paghi +${CO.ciro.p.debt}% di danno; se no, sei fuori. Se non premi, il KO è normale e l'abilità resta.`;

/** Tutte le abilita' (55). */
export const ABILITY_CATALOG: readonly AbilityDef[] = Object.values(R).flatMap((byChar) => Object.values(byChar));

export function abilityFor(game: string | null | undefined, character: string | null | undefined): AbilityDef | null {
  if (!game || !character) return null;
  return R[game]?.[character] ?? null;
}

/** Parametro numerico della meccanica (lancia se manca: un refuso non deve diventare "undefined" a meta' partita). */
export function abilityParam(game: AbilityGameId, character: AbilityCharacterId, key: string): number {
  const v = R[game]?.[character]?.p[key];
  if (typeof v !== 'number') throw new Error(`abilityParam: ${game}/${character}/${key} non esiste`);
  return v;
}

/** Tutte le abilita' di un gioco, nell'ordine dei personaggi. */
export const CHARACTER_ORDER_ABILITY: AbilityCharacterId[] = ['goblin', 'buttafuori', 'judoka', 'dottore', 'ciro'];

/** Accesso tipizzato ai numeri: `AB.arena.goblin.p.window`. Letto dai giochi. */
export const AB = { arena: A, dodgeball: D, soccer: S, volleyball: V, kart3d: K, fps: F, memory: M, reaction: T, quiz: Q, cultura: C, cornicione: CO } as const;

/**
 * Tabella {personaggio: {name, desc}} di un gioco, nella forma che i vecchi file shared/<gioco>Abilities.ts esportavano. Quei file ora
 * sono facciate su questa funzione: ogni schermata che li usava (controller sul telefono, nome sopra il personaggio) legge dal catalogo.
 */
export function abilityTable(game: AbilityGameId): Record<string, { name: string; desc: string }> {
  const out: Record<string, { name: string; desc: string }> = {};
  for (const [cid, d] of Object.entries(R[game] ?? {})) out[cid] = { name: d.name, desc: d.full };
  return out;
}

/** Etichetta standard di uno stato (quando il gioco non ne da' una propria). */
export function stateLabel(s: AbilityStatus): string {
  if (s.note) return s.note;
  switch (s.state) {
    case 'READY':
      return s.charges && s.charges > 1 ? `PRONTA · ${s.charges} USI` : 'PRONTA';
    case 'CHARGING':
      return `IN CARICA ${Math.round((s.meter ?? 0) * 100)}%`;
    case 'ACTIVE':
      return s.remaining !== undefined ? `ATTIVA · ${s.remaining.toFixed(1).replace('.', ',')} s` : 'ATTIVA';
    case 'COOLDOWN':
      return s.remaining !== undefined ? `RICARICA · ${Math.ceil(s.remaining)} s` : 'IN RICARICA';
    case 'SPENT':
      return 'ESAURITA';
  }
}
