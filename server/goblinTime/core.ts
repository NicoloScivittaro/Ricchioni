import { randomUUID,createHash } from 'node:crypto';
import { Rng } from '../../shared/rng';
import { abilityFor } from '../../shared/abilityCatalog';
import { CARD_BY_ID, catalog, GT } from '../../shared/goblinTime/catalog';
import type { Card, Choice, Command, CommandAck, GameEvent, EventKind, Option, PrivateState, PublicState, Seat } from '../../shared/goblinTime/types';
import type { PlayerResult } from '../../shared/types';
import { eventLabel } from '../../shared/goblinTime/presentation';
import { effect, responseEligible, responseEffect, trapMatches, trapEffect, HANDLERS } from './effects';

export interface Player extends Seat {
  hand: string[]; turns: number; declaredAt: number | null; abilityUsed: boolean; trapHits: number; fiveSeconds: number;
  status: Partial<Record<'noResponse' | 'noDraw' | 'noDeclare' | 'hidden' | 'short' | 'publicDraw' | 'drawThree', number>>;
  noTarget: Map<string, number>; debts: { kind: 'discard' | 'give' | 'loan' | 'skip'; due: number; count: number; to?: string }[];
  info: { title: string; cards: string[] }[]; giftLock: Map<string, number>;
  resetLocked:boolean;signature?:string;lastCount:number;stolenBy:Map<string,number>;started:number;previousStart:number;
}
export interface Trap { id: string; owner: string; order: number; suspended: number | null; auxiliary?:boolean;releaseOwner?:string;releaseTurn?:number }
export interface Deposit { id: string; owner: string; due: number }
export interface Request { player: string; title: string; options: Option[]; min?: number; max?: number; ordered?: boolean; kind?: 'choice' | 'reaction'; eventId?: string }
export interface Work { requests: Request[]; seconds?: number }
export type Flow<T = void> = Generator<Work, T, Record<string, string[]>>;
interface Pending { id: string; requests: Request[]; answers: Record<string, string[]>; until: number; kind: 'choice' | 'reaction' }
class SecretRng extends Rng {private serial=0;constructor(private key:string){super(0);}override next():number{return createHash('sha256').update(this.key+':'+(++this.serial)).digest().readUInt32LE(0)/0x100000000;}}
export class GoblinGame {
  readonly matchId = randomUUID();
  readonly players: Player[];
  readonly rng: Rng;
  readonly total: number;
  readonly ids: Set<string>;
  deck: string[]; discard: string[] = []; temp: string[] = []; traps: Trap[] = []; deposits: Deposit[] = [];
  version = 0; clock = 0; turnIndex = 0; turnNumber = 0; direction = 1; mainUntil = 0; paused = false;
  winner: string | null = null; endReason: string | null = null; results: PlayerResult[] | null = null;
  phase: PublicState['phase'] = 'main'; resolving: string | null = null;
  log: PublicState['log'] = [];
  pending: Pending | null = null;
  private flow: Flow | null = null;
  private handEvents:GameEvent[]=[];
  private savedMain:{turn:number;remaining:number}|null=null;
  private counter = 0; private seen = new Map<string, CommandAck>(); private atomicDepth = 0;
  private source: string | undefined; private actor = ''; private eventDepth = 0; private eventCount = 0;
  private extra = false; private inExtra = false; private blackoutUntil = -1; private fastUntil = -1;
  private immunities = new Set<string>();
  private blackoutExempt=new Set<string>();private fastExempt=new Set<string>();
  immune(id:string):boolean{return this.immunities.has(id);}
  exclude(id:string):void {this.immunities.add(id);}
  private lastDraw: { player: string; kept: string; rejected: string; until: number } | null = null;
  constructor(readonly roundId: number, seats: Seat[], readonly mode: 'base' | 'personal' = 'base', seed:number|string = randomUUID(), readonly timing: { main: number; choice: number; reaction: number; limit: number } = GT) {
    if (seats.length < 2 || seats.length > 5 || new Set(seats.map(p => p.id)).size !== seats.length) throw Error('Servono 2–5 giocatori distinti');
    this.rng = new SecretRng(String(seed)); const cards = catalog(mode); this.ids = new Set(cards.map(c => c.id)); this.total = cards.length;
    for (const c of cards) if (!HANDLERS.has(c.id)) throw Error(`Handler assente ${c.id}`);
    this.deck = this.rng.shuffle([...this.ids]);
    this.players = seats.map(p => ({ ...p, hand: [], turns: 0, declaredAt: null, abilityUsed: false, trapHits: 0, fiveSeconds: 0, status: {}, noTarget: new Map(), debts: [], info: [], giftLock: new Map(),resetLocked:false,lastCount:2,stolenBy:new Map(),started:0,previousStart:0 }));
    for (const p of this.players) for (let i = 0; i < 2; i++) p.hand.push(this.deck.shift()!);
    this.run(this.startTurn());
  }
  get active(): Player { return this.players[this.turnIndex]; }
  player(id: string): Player { const p = this.players.find(p => p.id === id); if (!p) throw Error('Giocatore sconosciuto'); return p; }
  ordered(): Player[] { return this.players.map((_, i) => this.players[(this.turnIndex + i * this.direction + this.players.length * 5) % this.players.length]); }
  rivals(id: string): Player[] { return this.ordered().filter(p => p.id !== id); }
  status(p: Player, key: keyof Player['status']): boolean { return p.status[key] !== undefined && p.turns <= p.status[key]!; }
  setStatus(id: string, key: keyof Player['status'], nextTurns = 1): void { const p = this.player(id); p.status[key] = p.turns + nextTurns; }
  handOptions(id: string,includeLocked=false): Option[] { const p = this.player(id); return p.hand.filter(c => includeLocked||!p.giftLock.has(c) || p.turns > p.giftLock.get(c)!).map(c => this.cardOption(c)); }
  cardOption(id: string): Option { return { id, cardId: id, label: CARD_BY_ID[id].name }; }
  note(text: string, kind = 'effect', cardId?: string, from?: string, to?: string): void { this.log.push({ id: this.nextId(), text, kind, ...(cardId ? { cardId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }); if (this.log.length > 20) this.log.shift(); }
  private nextId(): string { return `${this.matchId}:${++this.counter}`; }
  private changed(): void { this.version++; this.checkDeclarations(); this.assertInvariants(); }
  checkDeclarations(): void { if (this.atomicDepth) return; for (const p of this.players) {const signature=[...p.hand].sort().join('|');if(p.signature!==signature)p.resetLocked=false;p.signature=signature;if(p.hand.length!==p.lastCount){p.resetLocked=false;this.handEvents.push(this.event('HandChanged',this.actor||p.id,p.id,{previousCount:p.lastCount,newCount:p.hand.length}));}p.lastCount=p.hand.length;if(p.hand.length !== 5)p.declaredAt = null;} }
  atomic(fn: () => void): void { this.atomicDepth++; try { fn(); } finally { this.atomicDepth--; this.checkDeclarations(); } }
  remove(id: string): void {
    let found = 0;
    for (const arr of [this.deck, this.discard, this.temp, ...this.players.map(p => p.hand)]) { const i = arr.indexOf(id); if (i >= 0) { arr.splice(i, 1); found++; } }
    const ti = this.traps.findIndex(t => t.id === id); if (ti >= 0) { this.traps.splice(ti, 1); found++; }
    const di = this.deposits.findIndex(t => t.id === id); if (di >= 0) { this.deposits.splice(di, 1); found++; }
    if (found !== 1) throw Error(`Carte non conservate: ${id}, zone ${found}`);
    this.checkDeclarations();
  }
  move(id: string, destination: string[] = this.discard): void { this.remove(id); destination.push(id); this.checkDeclarations(); }
  available(): void { if (!this.deck.length && this.discard.length) { this.deck = this.rng.shuffle(this.discard); this.discard = []; this.note('Scarti rimescolati: il mazzo riparte.', 'shuffle'); } }
  take(n = 1): string[] { const out: string[] = []; for (let i = 0; i < n; i++) { this.available(); if (!this.deck.length) break; const c = this.deck.shift()!; this.temp.push(c); out.push(c); } return out; }
  assertInvariants(): void {
    const all = [...this.deck, ...this.discard, ...this.temp, ...this.players.flatMap(p => p.hand), ...this.traps.map(t => t.id), ...this.deposits.map(t => t.id)];
    if (all.length !== this.total || new Set(all).size !== this.total || all.some(c => !this.ids.has(c))) throw Error('Invariante mazzo violato');
    for (const p of this.players) if (p.declaredAt !== null && p.hand.length !== 5) throw Error('Dichiarazione incoerente');
  }
  *ask(player: string, title: string, options: Option[], min = 1, max = min, ordered = false): Flow<string[]> {
    if (!options.length || max === 0) return [];
    const a = yield { requests: [{ player, title, options, min: Math.min(min, options.length), max: Math.min(max, options.length), ordered }], seconds: this.timing.choice };
    return a[player] ?? [];
  }
  *selectCard(id: string, title = 'Scegli una carta', n = 1): Flow<string[]> { const options=this.player(id).hand.map(c=>this.cardOption(c));return yield* this.ask(id, title, options, Math.min(n, options.length)); }
  *target(id: string, title = 'Scegli un rivale', valid: Player[] = this.rivals(id)): Flow<string | null> {
    const a = yield* this.ask(id, title, valid.map(p => ({ id: p.id, label: p.name }))); return a[0] ?? null;
  }
  *option(id: string, title: string, labels: string[]): Flow<string> { const a = yield* this.ask(id, title, labels.map(x => ({ id: x, label: x }))); return a[0] ?? labels[0]; }
  *simultaneous(title: string, seats: Player[], options: (p: Player) => Option[]): Flow<Record<string, string[]>> {
    const requests = seats.map(p => ({ player: p.id, title, options: options(p), min: 1, max: 1 })).filter(r => r.options.length);
    if (!requests.length) return {}; return yield { requests, seconds: this.timing.choice };
  }
  event(kind: EventKind, actor: string, target = actor, values: Partial<GameEvent> = {}): GameEvent { return { id: this.nextId(), kind, actor, target, source: this.source, depth: this.eventDepth, used: [], ...values }; }
  *flushHands():Flow {while(this.handEvents.length){const event=this.handEvents.shift()!;yield* this.trigger(event,'after');}}
  *before(e: GameEvent): Flow {
    yield* this.flushHands();
    if (++this.eventCount > 400) throw Error('Catena di eventi oltre il limite');
    if(e.kind!=='Action'&&this.immunities.has(e.target)&&CARD_BY_ID[e.source??'']?.type==='CATASTROFE') {e.cancel=true;return;}
    yield* this.reactions(e);
    if (!e.cancel) yield* this.trigger(e, 'before');
  }
  *after(e: GameEvent): Flow { if (!e.cancel) yield* this.trigger(e, 'after');yield* this.flushHands(); }
  *reactions(e: GameEvent): Flow {
    if (e.depth >= GT.chain) return;
    const requests: Request[] = [];
    for (const p of this.ordered()) {
      if(e.used.includes(p.id))continue;
      const cardsAllowed=!(this.turnNumber<=this.blackoutUntil&&!this.blackoutExempt.has(p.id))&&!this.status(p,'noResponse');
      const options = (cardsAllowed?p.hand:[]).filter(c => CARD_BY_ID[c].type === 'RISPOSTA' && responseEligible(c, p.id, e, this)).map(c => this.cardOption(c));
      if (this.abilityAvailable(p.id, e)) options.push({ id: 'ability', label: abilityFor('goblinTime', p.characterId)?.name ?? 'ABILITÀ' });
      if (options.length) requests.push({ player: p.id, title: `${eventLabel(e.kind)}: ${this.player(e.actor).name} → ${this.player(e.target).name}`, options: [{ id: 'pass', label: 'NON REAGIRE' }, ...options], kind: 'reaction', eventId: e.id, min: 1, max: 1 });
    }
    if (!requests.length) return;
    const answers = yield { requests, seconds: this.timing.reaction };
    for (const r of requests) {
      if(e.used.filter(x=>!x.startsWith('immune:')).length>=GT.chain)break;
      const id = answers[r.player]?.[0]; if (!id || id === 'pass' || e.used.includes(r.player)) continue;
      const p = this.player(r.player);
      if (e.cancel) break;
      if (id === 'ability') {
        if (!this.abilityAvailable(p.id, e)) continue;
        e.used.push(p.id); yield* this.ability(p.id, e); continue;
      }
      if (!p.hand.includes(id) || !responseEligible(id, p.id, e, this) || this.status(p, 'noResponse')) continue;
      e.used.push(p.id); this.move(id); this.note(`${p.name}: ${CARD_BY_ID[id].name}`, 'response', id, p.id, e.target); this.changed();
      const old = this.eventDepth; this.eventDepth = e.depth + 1;
      const responseEvent = this.event('Response', p.id, p.id, { response: id, copy: id === 'R11', depth: this.eventDepth, used: [...e.used], origin:e });
      yield* this.resolveResponse(id,p.id,e);if(e.cancel)e.cancelledBy=p.id;
      yield* this.reactions(responseEvent);yield* this.after(responseEvent);if(e.cancel&&e.kind!=='Action'&&!e.cancelNotified){e.cancelNotified=true;yield* this.after(this.event('Cancel',e.cancelledBy??p.id,e.target,{card:e.card??e.source,source:e.source,depth:e.depth+1}));}
      this.eventDepth = old;
    }
  }
  *resolveResponse(id:string,player:string,e:GameEvent):Flow {const old=this.source,oldActor=this.actor;this.source=id;this.actor=player;try{yield* responseEffect(id,player,e,this);}finally{this.source=old;this.actor=oldActor;}}
  *trigger(e: GameEvent, when: 'before' | 'after'): Flow {
    const traps = [...this.traps].sort((a, b) => a.order - b.order);
    for (const trap of traps) {
      if (e.cancel || !this.traps.includes(trap) || trap.suspended !== null || !trapMatches(trap.id, trap.owner, e, when, this)) continue;
      this.move(trap.id); this.player(trap.owner).trapHits++; this.note(`${this.player(trap.owner).name}: scatta ${CARD_BY_ID[trap.id].name}!`, 'trap', trap.id, trap.owner, e.target); this.changed();
      const te = this.event('Trap', trap.owner, e.target, { card: trap.id, depth: e.depth + 1, used: [...e.used] });
      yield* this.reactions(te);
      if (!te.cancel) {
        const src = this.source, old = this.eventDepth,oldActor=this.actor;this.actor=trap.owner; this.source = trap.id; this.eventDepth = Math.min(GT.chain, e.depth + 1);
        yield* trapEffect(trap.id, trap.owner, e, this); this.source = src; this.eventDepth = old;this.actor=oldActor;
      }
      yield* this.after(te);
    }
  }
  *draw(actor: string, target = actor, n = 1, publicCards = false): Flow<string[]> {
    const e = this.event('Draw', actor, target, { count: n, public: publicCards }); yield* this.before(e);
    if (e.cancel) return [];
    n = Math.max(0, (e.count ?? n) - (e.reduced ?? 0)); target = e.target;
    const cards = this.take(n); const out: string[] = [];
    for (const card of cards) {
      const gain = this.event('Gain', actor, target, { card, public: publicCards }); yield* this.before(gain);
      if (this.temp.includes(card)) { if (gain.cancel) this.move(card); else { this.move(card, this.player(gain.target).hand); out.push(card); } }
      if (publicCards && this.player(gain.target).hand.includes(card)) this.note(`Carte rivelate: ${CARD_BY_ID[card].name}`, 'reveal', card);
      yield* this.after(gain);
    }
    this.changed(); this.note(`${this.player(target).name} pesca ${out.length}.`, 'draw', undefined, actor, target);
    e.cards = out; yield* this.after(e); return out;
  }
  *discardCards(actor: string, target: string, cards: string[], forced = true): Flow<string[]> {
    const hand = this.player(target).hand; const legal = cards.filter(c => hand.includes(c)); if (!legal.length) return [];
    const e = this.event('Discard', actor, target, { cards: legal, count: legal.length, deferred: !forced }); yield* this.before(e);
    if (e.cancel) return [];
    target = e.target;
    const count = Math.max(0, legal.length - (e.reduced ?? 0));
    const chosen = target === this.player(target).id && target !== handOwner(this, hand) ? yield* this.selectCard(target, 'Scarto riflesso', count) : legal.slice(0, count);
    const out: string[] = [];
    for (const c of chosen) if (this.player(target).hand.includes(c)) { this.move(c); this.note(`${this.player(target).name} scarta ${CARD_BY_ID[c].name}.`, 'discard', c, actor, target); out.push(c); }
    this.changed(); e.cards = out; e.count = out.length; yield* this.after(e); return out;
  }
  *lose(actor: string, target: string, n = 1, random = false, forced = true): Flow {
    const options = this.player(target).hand;const cards:string[]=[];
    if(random) {for(let i=0;i<n;i++){const chosen=yield* this.randomCard(actor,target,options.filter(c=>!cards.includes(c)));if(chosen)cards.push(chosen);}}
    else cards.push(...yield* this.selectCard(target, `Scarta ${Math.min(n, options.length)} carta/e`, n));
    yield* this.discardCards(actor, target, cards, forced);
  }
  *steal(actor: string, target: string, n = 1, publicCard = false, chosen?: string): Flow<string[]> {
    if(actor===target)return [];
    const e = this.event('Steal', actor, target, { count: n, public: publicCard }); yield* this.before(e); if (e.cancel) return [];
    target = e.target; let cards:string[]=[];
    if(chosen&&this.player(target).hand.includes(chosen))cards=[chosen];
    else for(let i=0;i<n;i++){const c=yield* this.randomCard(actor,target,this.player(target).hand.filter(c=>!cards.includes(c)));if(c)cards.push(c);}
    if (e.chooseLoss) cards = yield* this.selectCard(target, 'Scegli cosa consegnare al ladro', n);
    const out: string[] = [];
    for (const c of cards) if (this.player(target).hand.includes(c)) { if (publicCard) this.note(`Furto pubblico: ${CARD_BY_ID[c].name}`, 'reveal', c); this.move(c, this.player(actor).hand); out.push(c); }
    if(out.length)this.player(target).stolenBy.set(actor,this.turnNumber);
    this.changed(); e.cards = out; e.count = out.length; this.note(`${this.player(actor).name} ruba ${out.length} a ${this.player(target).name}.`, 'steal', undefined, target, actor); yield* this.after(e); return out;
  }
  *give(actor: string, target: string, cards: string[], voluntary = true): Flow {
    const e = this.event('Transfer', actor, target, { cards: [...cards], count: cards.length, deferred: voluntary,effectActor:this.actor||actor }); yield* this.before(e); if (e.cancel) return;
    actor=e.actor;const pool=e.cards??cards;const selected = pool.slice(0, Math.max(0, pool.length - (e.reduced ?? 0)));
    for (const c of selected) if (this.player(actor).hand.includes(c) || this.temp.includes(c)) this.move(c, this.player(e.target).hand);
    this.changed(); this.note(`${this.player(actor).name} consegna ${selected.length} a ${this.player(e.target).name}.`, 'transfer', undefined, actor, e.target); e.cards = selected; yield* this.after(e);
  }
  *exchange(actor: string, a: string, b: string, ac: string, bc: string): Flow {
    const e = this.event('Exchange', actor, b, { cards: [ac, bc] }); yield* this.before(e); if (e.cancel) return;
    this.atomic(() => { if (this.player(a).hand.includes(ac) && this.player(b).hand.includes(bc)) { this.move(ac, this.temp); this.move(bc, this.player(a).hand); this.move(ac, this.player(b).hand); } }); this.changed(); yield* this.after(e);
  }
  *randomCard(actor:string,target:string,choices:string[]):Flow<string|null> {
    if(!choices.length)return null;
    const e=this.event('RandomTarget',actor,target,{cards:[...choices],card:this.rng.pick(choices)});yield* this.before(e);
    return e.cancel?null:e.card??null;
  }
  *reveal(actor: string, target: string, cards: string[], publicCards = false): Flow<boolean> {
    const e = this.event('Reveal', actor, target, { cards, public: publicCards }); yield* this.before(e); if (e.cancel) return false;
    if (e.public && !e.hide) for (const c of cards) this.note(`${this.player(target).name}: ${CARD_BY_ID[c].name}`, 'reveal', c);
    else this.player(actor).info.push({ title: `Carte osservate di ${this.player(target).name}`, cards: [...cards] });
    this.player(actor).info = this.player(actor).info.slice(-5); yield* this.after(e);return true;
  }
  *deposit(actor: string, target: string, card: string): Flow {
    const e = this.event('Deposit', actor, target, { card }); yield* this.before(e); if (e.cancel || !this.player(target).hand.includes(card)) return;
    this.remove(card); this.deposits.push({ id: card, owner: target, due: this.player(target).turns + 1 }); this.changed(); yield* this.after(e);
  }
  *arm(actor: string, card: string, extra = false): Flow {
    if (!this.player(actor).hand.includes(card)) return;
    const e = this.event('Arm', actor, actor, { card }); yield* this.before(e); if (e.cancel) { if(!e.keepArmedCard&&this.player(actor).hand.includes(card))this.move(card); return; }
    if(extra&&this.traps.some(t=>t.owner===actor&&t.auxiliary))return;
    if (!extra && this.traps.filter(t => t.owner === actor&&!t.auxiliary).length >= GT.traps) return;
    this.remove(card); this.traps.push({ id: card, owner: actor, order: ++this.counter, suspended: null,auxiliary:extra }); this.changed(); this.note(`${this.player(actor).name} arma una trappola coperta.`, 'arm', undefined, actor); yield* this.after(e);
  }
  *grantExtra(actor: string): Flow { if (this.inExtra) return; const e = this.event('Extra', actor); yield* this.before(e); if (!e.cancel) this.extra = true; yield* this.after(e); }
  blackout(turns: number): void { this.blackoutUntil = this.turnNumber + turns;this.blackoutExempt=new Set(this.immunities); }
  fastRound(): void { this.fastUntil = this.turnNumber + this.players.length;this.fastExempt=new Set(this.immunities); }
  *changeStatus(actor: string, target: string, key: keyof Player['status'], duration = 1): Flow { const e = this.event('Status', actor, target); yield* this.before(e); if (!e.cancel) this.setStatus(e.target, key, duration); yield* this.after(e); }
  *mainDraw(id: string): Flow {
    if(this.lastDraw?.player===id)this.lastDraw=null;
    const p = this.player(id); const cards = this.take(this.status(p, 'drawThree') ? 3 : 2); delete p.status.drawThree;
    if (!cards.length) return;
    if (this.status(p, 'publicDraw')) { for (const c of cards) this.note(`PESCA pubblica: ${CARD_BY_ID[c].name}`, 'reveal', c); delete p.status.publicDraw; }
    const keep = (yield* this.ask(id, 'PESCA: tieni una carta, le altre saranno scartate', cards.map(c => this.cardOption(c))))[0];
    const e = this.event('DrawChoice', id, id, { cards: [...cards], card: keep }); yield* this.before(e);
    if (this.temp.includes(keep)) this.move(keep, p.hand);
    for (const c of cards) if (this.temp.includes(c)) this.move(c);
    const rejected = cards.find(c => c !== keep && this.discard.includes(c));
    if (rejected&&p.characterId==='goblin') this.lastDraw = { player: id, kept: keep, rejected, until: this.clock + (abilityFor('goblinTime', 'goblin')?.p.window ?? 3) };
    this.changed(); yield* this.after(e);
    const drawn = this.event('Draw', id, id, { count: 1, cards: [keep], source: 'PESCA' }); yield* this.after(drawn);
    if(p.characterId==='goblin'&&this.abilityAvailable(id)){const answers=yield {requests:[{player:id,title:'N’CULO, NON ERA QUELLA! Vuoi cambiare la carta appena tenuta?',options:[{id:'confirm',label:'TIENI LA SCELTA'},{id:'ability',label:'SCAMBIA CON QUELLA SCARTATA'}],min:1,max:1}],seconds:abilityFor('goblinTime','goblin')!.p.window};if(answers[id]?.[0]==='ability'&&this.abilityAvailable(id))yield* this.ability(id);}
  }
  *applyCard(card: string, actor: string, target?: string): Flow {
    const old = this.source, oldActor = this.actor; this.source = card; this.actor = actor;
    try { yield* effect(card, actor, this, target); } finally { this.source = old; this.actor = oldActor; }
  }
  *play(id: string, card: string): Flow {
    this.move(card, this.temp); this.resolving = card; this.changed(); this.note(`${this.player(id).name} gioca ${CARD_BY_ID[card].name}.`, 'play', card, id);
    const e = this.event('Action', id, id, { card, source: card, lastCard:this.player(id).hand.length===0 });
    // Il bersaglio singolo viene scelto prima delle risposte; carte multi-bersaglio scelgono dentro il proprio handler.
    if (SINGLE_TARGET.has(card)) {
      const target = yield* this.target(id, 'Scegli il bersaglio', this.rivals(id).filter(p=>this.validTarget(card,p)).filter(p => !(p.noTarget.get(id) !== undefined && this.player(id).turns <= p.noTarget.get(id)!)));
      if (!target) { yield* this.mainDraw(id); this.move(card);this.resolving=null; return; } e.target = target;
    }
    yield* this.before(e);
    if (!e.cancel) yield* this.applyCard(card, id, SINGLE_TARGET.has(card)?e.target:undefined);
    else { this.note('Effetto annullato.', 'cancel', card); yield* this.after(this.event('Cancel', e.cancelledBy??id, e.target, { card })); }
    yield* this.after(e); if (this.temp.includes(card)) this.move(card); this.resolving = null;this.immunities.clear(); this.changed();
  }
  *enforceHands(): Flow { for (const p of this.ordered()) while (p.hand.length > GT.maxHand) { const cards = yield* this.selectCard(p.id, `Mano massima ${GT.maxHand}: scarta ${p.hand.length - GT.maxHand}`, p.hand.length - GT.maxHand); if (!cards.length) { const c = p.hand[0]; this.move(c); } else yield* this.discardCards(p.id, p.id, cards, false); } }
  *startTurn(): Flow {
    this.turnNumber++; const p = this.active; p.turns++;p.previousStart=p.started;p.started=this.turnNumber; p.info = [];
    for (const [c, until] of p.giftLock) if (p.turns > until) p.giftLock.delete(c);
    for (const t of this.traps) if (t.suspended !== null && (t.releaseOwner?t.releaseOwner===p.id&&p.turns>=(t.releaseTurn??Infinity):t.suspended <= this.turnNumber)) t.suspended = null;
    for (const d of [...this.deposits]) if (d.owner === p.id && d.due <= p.turns) {
      const e = this.event('Return', p.id, p.id, { card: d.id }); yield* this.before(e); if (!e.cancel && this.deposits.some(x => x.id === d.id)) this.move(d.id, p.hand); yield* this.after(e);
    }
    let skip = false;
    for (const d of [...p.debts]) if (d.due <= p.turns) {
      p.debts.splice(p.debts.indexOf(d), 1);
      if (d.kind === 'loan') { const cards = yield* this.selectCard(p.id, 'Restituisci il prestito al fondo del mazzo', d.count); for (const c of cards) this.move(c, this.deck); }
      else if (d.kind === 'skip') { const opt = p.hand.length ? yield* this.option(p.id, 'Paga il debito o rinuncia all’azione', ['SCARTA', 'SALTA']) : 'SALTA'; if (opt === 'SALTA') skip = true; else yield* this.lose(p.id, p.id); }
      else if (d.kind === 'give' && d.to) { if (!p.hand.length) yield* this.draw(p.id); const cards = yield* this.selectCard(p.id, 'Paga il bonifico dovuto', d.count); yield* this.give(p.id, d.to, cards, false); }
      else yield* this.lose(p.id, p.id, d.count);
    }
    const e = this.event('Start', p.id); yield* this.before(e); yield* this.after(e); yield* this.enforceHands();
    this.checkDeclarations();
    if (this.clock >= this.timing.limit) { this.finish(null); return; }
    if (p.declaredAt !== null && p.turns > p.declaredAt && p.hand.length === 5) { this.finish(p.id); return; }
    if (skip) { yield* this.endTurn(); return; }
    this.phase = 'main'; this.mainUntil = this.clock + (this.turnNumber <= this.fastUntil&&!this.fastExempt.has(p.id) || this.status(p, 'short') ? Math.min(4, this.timing.main) : this.timing.main); this.changed();
  }
  *endTurn(): Flow {
    yield* this.enforceHands(); const p = this.active; const e = this.event('End', p.id); yield* this.before(e); yield* this.after(e); yield* this.enforceHands();
    for (const key of Object.keys(p.status) as (keyof Player['status'])[]) if (p.status[key]! <= p.turns) delete p.status[key];
    for(const owner of this.players)for(const [id,until]of owner.noTarget)if(this.player(id).turns>=until&&id===p.id)owner.noTarget.delete(id);
    if (this.clock >= this.timing.limit) { this.finish(null); return; }
    if (this.extra && !this.inExtra) { this.extra = false; this.inExtra = true; }
    else { this.extra = false; this.inExtra = false; this.turnIndex = (this.turnIndex + this.direction + this.players.length) % this.players.length; }
    yield* this.startTurn();
  }
  *declare(id: string): Flow {
    const p = this.player(id); p.declaredAt = p.turns; this.note(`GOBLIN TIME! FERMATE STO INFAME! ${p.name}`, 'declare', undefined, id); this.changed();
    const e = this.event('Declare', id); yield* this.before(e); yield* this.after(e); yield* this.enforceHands(); this.changed();
  }
  abilityAvailable(id: string, e?: GameEvent): boolean {
    const p = this.player(id); if (p.abilityUsed) return false;
    switch (p.characterId) {
      case 'goblin': return !e && !!this.lastDraw && this.lastDraw.player === id && this.clock <= this.lastDraw.until && p.hand.includes(this.lastDraw.kept) && this.discard.includes(this.lastDraw.rejected);
      case 'dottore': return !e && this.phase === 'main' && !this.pending && p.declaredAt === null;
      case 'buttafuori': return !!e && e.kind === 'Steal' && e.target === id && e.actor !== id;
      case 'judoka': return !!e && e.kind === 'Transfer' && (e.target === id || e.actor === id);
      case 'ciro': return !!e && e.target === id && e.actor !== id && (e.kind === 'Discard' || e.kind === 'Steal') && e.count === 1 && !e.deferred;
      default: return false;
    }
  }
  *ability(id: string, e?: GameEvent): Flow {
    const p = this.player(id); p.abilityUsed = true; this.note(`${p.name}: ${abilityFor('goblinTime', p.characterId)?.name}`, 'ability', undefined, id); this.changed();
    if (p.characterId === 'goblin' && this.lastDraw) { this.move(this.lastDraw.kept); this.move(this.lastDraw.rejected, p.hand); this.lastDraw = null; }
    if (p.characterId === 'buttafuori' && e) { e.cancel = true; yield* this.lose(id, id,abilityFor('goblinTime','buttafuori')!.p.cost); }
    if (p.characterId === 'dottore') { const cards = this.take(abilityFor('goblinTime', 'dottore')!.p.peek); if (cards.length) { const keep = (yield* this.ask(id, 'M’HO SVEJATO: tieni una carta', cards.map(c => this.cardOption(c))))[0]; this.move(keep, p.hand);yield* this.flushHands(); const rest = cards.filter(c => c !== keep); const order = yield* this.ask(id, 'Ordina le carte rimaste: prima scelta in cima', rest.map(c => this.cardOption(c)), rest.length, rest.length, true); for (const c of [...order].reverse()) { this.remove(c); this.deck.unshift(c); } } }
    if (p.characterId === 'judoka' && e) { const target = yield* this.target(id, 'Cambia destinatario del trasferimento', this.ordered().filter(x => x.id !== e!.actor && x.id !== e!.target)); if (target) e.target = target; else { e.cancel = true; yield* this.draw(id,id,abilityFor('goblinTime','judoka')!.p.penalty); } }
    if (p.characterId === 'ciro' && e) { e.cancel = true; p.debts.push({ kind: 'discard', due: p.turns + 1, count: abilityFor('goblinTime','ciro')!.p.debt }); }
    yield* this.flushHands();this.changed();
  }
  private run(flow: Flow): void { this.savedMain={turn:this.turnNumber,remaining:Math.max(0,this.mainUntil-this.clock)};this.flow = flow; this.eventCount = 0; this.pump(); }
  private pump(answers: Record<string, string[]> = {}): void {
    if (!this.flow) return; const next = this.flow.next(answers); this.changed();
    if (next.done) {if(this.temp.length)throw Error('Zona temporanea non svuotata a fine transazione'); this.flow = null; this.pending = null; if (this.phase !== 'finished') {this.phase = 'main';if(this.savedMain?.turn===this.turnNumber)this.mainUntil=this.clock+this.savedMain.remaining;}this.savedMain=null; return; }
    const work = next.value; this.pending = { id: this.nextId(), requests: work.requests, answers: {}, until: this.clock + (work.seconds ?? this.timing.choice), kind: work.requests[0]?.kind ?? 'choice' }; this.phase = this.pending.kind; this.changed();
  }
  command(id: string, command: Command): CommandAck {
    if (!command || typeof command !== 'object') return { ok: false, error: 'Comando non valido' };
    if (command.matchId !== this.matchId || command.roundId !== this.roundId) return { ok: false, error: 'Partita precedente' };
    if (typeof command.requestId !== 'string' || command.requestId.length > 100 || command.requestId.length < 1) return { ok: false, error: 'ID richiesta non valido' };
    const key = `${id}:${command.requestId}`; const known = this.seen.get(key); if (known) return known;
    if (command.version !== this.version) return { ok: false, error: 'Stato aggiornato: riprova', version: this.version };
    if (this.paused || this.phase === 'finished') return { ok: false, error: this.paused ? 'Partita in pausa' : 'Partita conclusa' };
    const p = this.players.find(p => p.id === id); if (!p) return { ok: false, error: 'Non partecipante' };
    let ok = false;
    if (command.op === 'choose' && this.pending && command.choiceId === this.pending.id) {
      const request = this.pending.requests.find(r => r.player === id); const values = command.values;
      if (request && !this.pending.answers[id] && Array.isArray(values) && values.every(v => typeof v === 'string') && new Set(values).size === values.length && values.length >= (request.min ?? 1) && values.length <= (request.max ?? 1) && values.every(v => request.options.some(o => o.id === v))) {
        this.pending.answers[id] = [...values]; this.changed(); ok = true;
        if (this.pending.requests.every(r => this.pending!.answers[r.player])) { const a = this.pending.answers; this.pending = null; this.pump(a); }
      }
    } else if (!this.pending && this.phase === 'main') {
      if (command.op === 'declare' && this.canDeclare(p)) { this.run(this.declare(id)); ok = true; }
      else if (command.op === 'ability' && this.abilityAvailable(id)) { this.run(this.ability(id)); ok = true; }
      else if (id === this.active.id) {
        if (command.op === 'draw' && !this.status(p, 'noDraw')) { this.run(this.mainAction(id, 'draw')); ok = true; }
        if (command.op === 'play' && typeof command.cardId === 'string' && this.playable(p).includes(command.cardId)) { this.run(this.mainAction(id, 'play', command.cardId)); ok = true; }
        if (command.op === 'arm' && typeof command.cardId === 'string' && this.armable(p).includes(command.cardId)) { this.run(this.mainAction(id, 'arm', command.cardId)); ok = true; }
      }
    }
    const ack: CommandAck = ok ? { ok: true, version: this.version } : { ok: false, error: 'Scelta non valida o fuori tempo', version: this.version };
    if (ok) { this.seen.set(key, ack); if (this.seen.size > 1500) this.seen.delete(this.seen.keys().next().value!); } return ack;
  }
  *mainAction(id: string, op: 'draw' | 'play' | 'arm', card?: string): Flow { if (op === 'draw') yield* this.mainDraw(id); else if (op === 'play') yield* this.play(id, card!); else yield* this.arm(id, card!); yield* this.endTurn(); }
  private validTarget(card:string,p:Player):boolean {if(['A01','A02','A07','A10','A12','A14','A18','A40','PB01'].includes(card))return p.hand.length>0;if(card==='A23')return p.hand.length>=3;if(card==='PC02')return this.traps.some(t=>t.owner===p.id);return true;}
  playable(p: Player): string[] {
    return this.handOptions(p.id).map(o => o.id).filter(c => ['AZIONE', 'CATASTROFE'].includes(CARD_BY_ID[c].type) && this.requirements(c, p));
  }
  requirements(c: string, p: Player): boolean {
    if (['A02', 'A38', 'A39', 'PG01', 'PC02', 'PI01', 'PI02'].includes(c) && p.hand.length < 2) return false;
    if (c === 'PG01' && !this.discard.length) return false;
    if (c === 'A02' && !this.rivals(p.id).some(x => x.hand.length)) return false;
    if (c === 'PC02' && !this.traps.some(t => t.owner !== p.id)) return false;
    return true;
  }
  armable(p: Player): string[] { return this.traps.filter(t => t.owner === p.id&&!t.auxiliary).length >= GT.traps ? [] : this.handOptions(p.id).map(o => o.id).filter(c => CARD_BY_ID[c].type === 'TRAPPOLA'); }
  canDeclare(p: Player): boolean { return this.phase === 'main' && !this.pending && p.hand.length === 5 && p.declaredAt === null && !this.status(p, 'noDeclare')&&!p.resetLocked; }
  tick(dt: number): void {
    if (this.paused || this.phase === 'finished') return; if (!Number.isFinite(dt) || dt < 0) return;
    this.clock += dt; for (const p of this.players) if (p.hand.length === 5) p.fiveSeconds += dt;
    if (this.pending) {
      for (const r of this.pending.requests) if (this.player(r.player).bot && !this.pending.answers[r.player] && this.pending.until - this.clock < (this.pending.kind === 'reaction' ? this.timing.reaction - .3 : this.timing.choice - .3)) {this.command(r.player,{roundId:this.roundId,matchId:this.matchId,version:this.version,requestId:this.nextId(),op:'choose',choiceId:this.pending.id,values:this.botChoice(r)});return;}
      if (this.clock >= this.pending.until || this.pending.requests.every(r => this.pending!.answers[r.player])) {
        for (const r of this.pending.requests) if (!this.pending.answers[r.player]) this.pending.answers[r.player] = r.options.slice(0, r.min ?? 1).map(o => o.id);
        const answers = this.pending.answers; this.pending = null; this.pump(answers);
      }
      return;
    }
    if(this.clock>=this.timing.limit){this.finish(null);return;}
    for(const p of this.players)if(p.bot&&p.characterId==='goblin'&&p.hand.length!==5&&this.abilityAvailable(p.id)){this.botCommand(p.id,'ability');return;}
    for (const p of this.players) if (p.bot && this.canDeclare(p)) { this.botCommand(p.id,'declare'); return; }
    if (this.active.bot && this.clock >= this.mainUntil - this.timing.main + .6) { this.botMain(); return; }
    if (this.clock >= this.mainUntil) {
      if(this.turnNumber<=this.fastUntil&&!this.fastExempt.has(this.active.id)){this.run(this.endTurn());return;}
      if (!this.status(this.active, 'noDraw')) this.run(this.mainAction(this.active.id, 'draw'));
      else if (this.armable(this.active).length) this.run(this.mainAction(this.active.id, 'arm', this.armable(this.active)[0]));
      else if (this.playable(this.active).length) this.run(this.mainAction(this.active.id, 'play', this.playable(this.active)[0]));
      else this.run(this.endTurn());
    }
  }
  botChoice(r: Request): string[] {
    const p = this.player(r.player);
    if (r.kind === 'reaction') return [(p.hand.length === 5 || this.players.some(x=>x.id!==p.id&&x.declaredAt!==null)) && r.options.length > 1 ? r.options[1].id : 'pass'];
    const ranked = [...r.options].sort((a, b) => {
      if (a.cardId && b.cardId) return cardValue(b.cardId) - cardValue(a.cardId);
      const pa = this.players.find(p => p.id === a.id), pb = this.players.find(p => p.id === b.id);
      return (pb?.declaredAt !== null && pb ? 100 : 0) - (pa?.declaredAt !== null && pa ? 100 : 0);
    });
    if (/scarta|paga|restituisci/i.test(r.title)) ranked.reverse();
    return ranked.slice(0, r.min ?? 1).map(o => o.id);
  }
  private botCommand(id:string,op:Command['op'],cardId?:string):void{this.command(id,{roundId:this.roundId,matchId:this.matchId,version:this.version,requestId:this.nextId(),op,cardId});}
  private botMain(): void {
    const p = this.active, arms = this.armable(p), plays = this.playable(p);
    if(p.characterId==='dottore'&&p.hand.length<5&&this.abilityAvailable(p.id)){this.botCommand(p.id,'ability');return;}
    if (p.hand.length > 5 && arms.length) { this.botCommand(p.id,'arm',arms[0]); return; }
    const sabotage = this.rivals(p.id).some(x => x.declaredAt !== null);
    if ((sabotage || p.hand.length > 5 || this.status(p, 'noDraw')) && plays.length) { const priority=['A01','A03','A07','A25','A31','C09','C13','C15','A14','A06','A15','A04','A30','C04','C01','PC01','PC05','PI05'];const chosen=sabotage?priority.find(c=>plays.includes(c))??this.rng.pick(plays):this.rng.pick(plays);this.botCommand(p.id,'play',chosen); return; }
    if (p.hand.length === 5 && arms.length && p.declaredAt === null) { this.botCommand(p.id,'arm',arms[0]); return; }
    this.botCommand(p.id,'draw');
  }
  finish(winner: string | null): void {
    this.winner = winner; this.endReason = winner ? 'GOBLIN TIME riuscito' : 'Tempo scaduto — classifica di emergenza'; this.phase = 'finished'; this.pending = null;
    const ordered = [...this.players].sort((a, b) => (a.id === winner ? -1 : b.id === winner ? 1 : 0) || Math.abs(a.hand.length - 5) - Math.abs(b.hand.length - 5) || b.trapHits - a.trapHits || b.fiveSeconds - a.fiveSeconds || this.players.indexOf(a) - this.players.indexOf(b));
    this.results = ordered.map((p, i) => ({ playerId: p.id, placement: i + 1, score: p.trapHits, stats: [`${p.hand.length} carte in mano`, `${p.trapHits} trappole scattate`, p.id === winner ? 'GOBLIN TIME riuscito' : 'Classifica tecnica'] })); this.note(this.endReason, 'finish'); this.changed();
  }
  publicState(): PublicState {
    return { type: 'goblinPublic', roundId: this.roundId, matchId: this.matchId, version: this.version, mode: this.mode, phase: this.phase, turn: this.active.id, turnNumber: this.turnNumber,
      remaining: Math.max(0, (this.pending?.until ?? this.mainUntil) - this.clock), matchRemaining: Math.max(0, this.timing.limit - this.clock), deckCount: this.deck.length, discardCount: this.discard.length, discardTop: this.discard.slice(-3),
      players: this.players.map(p => ({ id: p.id, name: p.name, characterId: p.characterId, bot: p.bot, count: this.status(p, 'hidden') ? null : p.hand.length, traps: this.traps.filter(t => t.owner === p.id).length, declared: p.declaredAt !== null, abilityUsed: p.abilityUsed, debts: p.debts.length })),
      log: this.log.map(e => ({ ...e })), resolving: this.resolving, winner: this.winner, endReason: this.endReason, results: this.results?.map(r => ({ ...r })) ?? null, paused: this.paused,
      waitingFor:this.pending?.requests.filter(r=>!this.pending!.answers[r.player]).map(r=>r.player)??[],shortTurn:this.phase==='main'&&(this.turnNumber<=this.fastUntil&&!this.fastExempt.has(this.active.id)||this.status(this.active,'short')) };
  }
  privateState(id: string): PrivateState {
    const p = this.player(id); const request = this.pending?.requests.find(r => r.player === id && !this.pending!.answers[id]); const def = abilityFor('goblinTime', p.characterId);
    const choice: Choice | null = request && this.pending ? { id: this.pending.id, title: request.title, options: request.options.map(o => ({ ...o })), min: request.min ?? 1, max: request.max ?? 1, ordered: request.ordered, kind: request.kind ?? 'choice', eventId: request.eventId, remaining: Math.max(0, this.pending.until - this.clock) } : null;
    const main = this.phase === 'main' && !this.pending && !this.paused;
    return { type: 'goblinPrivate', roundId: this.roundId, matchId: this.matchId, version: this.version, playerId: id, hand: [...p.hand], traps: this.traps.filter(t => t.owner === id).map(t => ({ cardId: t.id, suspended: t.suspended !== null })), deposits: this.deposits.filter(d => d.owner === id).map(d => d.id),
      playable: main && this.active.id === id ? this.playable(p) : [], armable: main && this.active.id === id ? this.armable(p) : [], canDraw: main && this.active.id === id && !this.status(p, 'noDraw'), canDeclare: main && this.canDeclare(p), choice,
      ability: { name: def?.name ?? 'ABILITÀ', full: def?.full ?? '', used: p.abilityUsed, available: main && this.abilityAvailable(id) }, information: p.info.map(i => ({ title: i.title, cards: [...i.cards] })), table: this.publicState() };
  }
}
function handOwner(g: GoblinGame, hand: string[]): string { return g.players.find(p => p.hand === hand)!.id; }
function cardValue(c: string): number { return CARD_BY_ID[c].type === 'RISPOSTA' ? 4 : CARD_BY_ID[c].type === 'TRAPPOLA' ? 3 : CARD_BY_ID[c].type === 'AZIONE' ? 2 : 1; }
const SINGLE_TARGET = new Set(['A01','A02','A03','A04','A06','A07','A09','A10','A11','A12','A14','A15','A17','A18','A19','A22','A23','A25','A26','A28','A30','A33','A34','A36','A37','A39','A40','PB01','PC01','PC02','PI01','PI02']);
