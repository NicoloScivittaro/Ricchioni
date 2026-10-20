import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { music } from '../core/music';
import { MINIGAME_DEFINITIONS, getMinigame } from '../../shared/minigames';
import type { MinigameDefinition } from '../../shared/types';
import { brand, esc, mountMenu, menuPortrait } from './partyMenu';
import { gameAccent, gameArtwork } from './gameArtwork';
const TARGET_INDEX = 22, SPIN_MS = 4000, SETTLE_MS = 500, START_DELAY_MS = 300;
/** Only presentation: the server-selected card always lands exactly under the pointer. */
export class RouletteScene extends Phaser.Scene {
    private root!: HTMLDivElement;
    constructor() { super('RouletteScene'); }
    create(): void {
        const pick = gm.pendingMinigame;
        if (!pick) {
            this.scene.start('RoomScene');
            return;
        }
        this.cameras.main.setBackgroundColor('#0d1222');
        const state = gm.state, count = Math.max(1, state?.players.length ?? 1), pickDef = getMinigame(pick.minigameId);
        let eligible = MINIGAME_DEFINITIONS.filter(d => d.enabled !== false && count >= d.minPlayers && count <= d.maxPlayers);
        if (pickDef && !eligible.some(d => d.id === pickDef.id))
            eligible = [...eligible, pickDef];
        if (!eligible.length && pickDef)
            eligible = [pickDef];
        eligible = Phaser.Utils.Array.Shuffle([...eligible]);
        const index = Math.max(0, eligible.findIndex(d => d.id === pick.minigameId)), n = Math.max(1, eligible.length), offset = ((index - TARGET_INDEX) % n + n) % n;
        const sequence: Array<MinigameDefinition | undefined> = Array.from({ length: TARGET_INDEX + 5 }, (_, i) => eligible[(i + offset) % n]);
        const players = [...(state?.players ?? [])].sort((a, b) => b.score - a.score);
        const standings = players.map(p => { return `<div class="pm-standing">${menuPortrait(p.characterId, 36)}<div><b>${esc(p.displayName)}</b><small>${!p.connected ? 'Offline' : `Mancano ${Math.max(0, (state?.targetScore ?? 0) - p.score)} punti`}</small></div><strong>${p.score}</strong></div>`; }).join('');
        this.root = mountMenu(this, `<main class="pm-page pm-reel-page"><header class="pm-header">${brand}<div class="pm-top-note"><span>ROUND ${state?.round ?? 1}</span><span class="pm-key">${state?.targetScore ?? '?'} PUNTI</span></div></header><section class="pm-reel-heading"><div class="pm-eyebrow">Il prossimo capitolo della serata</div><h1 id="pm-reel-title">Lascia fare al caso.</h1><p id="pm-reel-sub">Tutti pronti? Il rullo sta scegliendo.</p></section><div class="pm-reel-stage" id="pm-reel-stage"><div class="pm-reel-pointer"></div><div class="pm-reel-strip" id="pm-reel-strip">${sequence.map((d, i) => d ? `<article class="pm-reel-card" data-card="${i}" data-minigame="${esc(d.id)}" style="--game-accent:${gameAccent(d)}"><div class="pm-art">${gameArtwork(d)}</div><strong>${esc(d.id === pick.minigameId ? pick.name : d.name)}</strong><small>${esc(d.category)}</small></article>` : '').join('')}</div></div><div id="pm-reel-result" class="pm-reel-result" aria-live="polite"><p>Un altro gioco. Una nuova occasione per rifarvi.</p></div><section class="pm-standings" aria-label="Classifica della serata">${standings}</section><footer class="pm-footer"><span>La compagnia cambia gioco. I conti restano aperti.</span><button class="pm-plain" id="pm-reel-skip"><span class="pm-key pm-a">A / ✕</span> Continua <span class="pm-key">INVIO</span></button></footer></main>`, a => { if (a === 'confirm' || a === 'start')
            gm.skip(); });
        this.root.querySelector<HTMLButtonElement>('#pm-reel-skip')!.onclick = () => gm.skip();
        const stage = this.root.querySelector<HTMLElement>('#pm-reel-stage')!, strip = this.root.querySelector<HTMLElement>('#pm-reel-strip')!, cards = [...strip.querySelectorAll<HTMLElement>('.pm-reel-card')], pos = { p: 0 };
        let lastK = -1, lastTick = 0, tension = false;
        const apply = () => {
            const width = cards[0]?.getBoundingClientRect().width ?? 250;
            // offsetWidth ignores the selected card's scale, avoiding jitter during settling.
            const cardWidth = cards[0]?.offsetWidth ?? width, step = cardWidth + 20;
            strip.style.transform = `translate3d(${stage.clientWidth / 2 - cardWidth / 2 - pos.p * step}px,0,0)`;
            const k = Math.round(pos.p);
            if (k !== lastK) {
                cards[lastK]?.classList.remove('pm-current');
                cards[k]?.classList.add('pm-current');
                lastK = k;
                const now = this.time.now;
                if (now - lastTick > 35) {
                    const speed = 1000 / Math.max(35, now - lastTick);
                    lastTick = now;
                    audio.rouletteTick(Math.min(1, speed / 18));
                    if (speed < 6 && !tension) {
                        tension = true;
                        if (music.current() === 'roulette')
                            music.setLevel(2);
                    }
                }
            }
        };
        apply();
        const resize = () => apply();
        window.addEventListener('resize', resize);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('resize', resize));
        const reveal = () => {
            this.root.classList.add('pm-revealed');
            this.root.dataset.result = pick.minigameId;
            this.root.querySelector('#pm-reel-title')!.textContent = 'La prossima sfida è vostra.';
            this.root.querySelector('#pm-reel-sub')!.textContent = 'Preparatevi. Qui nessuno vi regala niente.';
            this.root.querySelector('#pm-reel-result')!.innerHTML = `<h2>${esc(pick.name)}</h2><p>${esc(pickDef?.description ?? '')}</p>${pick.modifierId && pick.modifierName ? `<span class="pm-modifier">${esc(pick.modifierName)}${pick.modifierDescription ? ` · ${esc(pick.modifierDescription)}` : ''}</span>` : ''}`;
            audio.rouletteClunk();
            gm.events.emit('narrator.game');
            music.stop(.25, 'roulette');
            audio.gameSting(pick.minigameId, pick.minigameId === 'fps' || pick.minigameId === 'kart3d');
        };
        this.time.delayedCall(250, () => gm.events.emit('narrator.roller'));
        this.time.delayedCall(START_DELAY_MS, () => this.tweens.add({ targets: pos, p: TARGET_INDEX + .2, duration: SPIN_MS, ease: 'Cubic.easeOut', onUpdate: apply, onComplete: () => this.tweens.add({ targets: pos, p: TARGET_INDEX, duration: SETTLE_MS, ease: 'Sine.easeInOut', onUpdate: apply, onComplete: () => { pos.p = TARGET_INDEX; apply(); reveal(); } }) }));
    }
}
