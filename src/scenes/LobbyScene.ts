import Phaser from 'phaser';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { MAX_PLAYERS, MIN_PLAYERS, SCORE_PRESETS, TARGET_SCORE_MAX, TARGET_SCORE_MIN, estimateGameMinutes } from '../../shared/types';
import { CHARACTER_ORDER } from '../../shared/characters';
import { brand, mountMenu, menuFocus, padHints, menuPortrait } from './partyMenu';
import { gameArtwork } from './gameArtwork';
import type { MenuAction } from '../input/GamepadManager';
export class LobbyScene extends Phaser.Scene {
    private count = 2;
    private presetIdx = 2;
    private customScore = 100;
    private creating = false;
    private focusRow = 0;
    private root!: HTMLDivElement;
    constructor() { super('LobbyScene'); }
    create(): void {
        this.creating = false;
        this.focusRow = 0;
        this.cameras.main.setBackgroundColor('#0d1222');
        this.root = mountMenu(this, `<main class="pm-page"><header class="pm-header">${brand}<div class="pm-top-note"><span><i class="pm-dot"></i>Una TV. Tutta la compagnia.</span></div></header><div class="pm-home"><section class="pm-home-copy"><div class="pm-eyebrow">Il divano è il vostro campo da gioco</div><h1>Stessa stanza.<br><em>Zero pietà.</em></h1><p>Scegliete chi essere. Al prossimo gioco ci pensa il rullo… oppure voi.</p><div class="pm-home-art">${gameArtwork()}</div><div class="pm-faces">${CHARACTER_ORDER.map(id => menuPortrait(id, 38)).join('')}<span>La solita compagnia.<br>Una nuova sfida ogni volta.</span></div></section><section class="pm-config"><h2>Prepara la serata</h2><p class="pm-config-sub">Due scelte, poi si gioca.</p><div data-row="0"><div class="pm-field-label">Posti in partita<small>Bot opzionali nella stanza · massimo 5 in tutto</small></div><div class="pm-player-count">${[2, 3, 4, 5].map(n => `<button data-count="${n}" aria-label="${n} posti in partita">${n}</button>`).join('')}</div></div><div class="pm-divider"></div><div data-row="1"><div class="pm-field-label">Quanto dura?<small id="pm-target-points"></small></div><div class="pm-stepper"><button id="pm-shorter" aria-label="Durata precedente">‹</button><div class="pm-step-value"><b id="pm-preset"></b><small id="pm-duration"></small></div><button id="pm-longer" aria-label="Durata successiva">›</button></div></div><button class="pm-primary" id="pm-create"><span>Crea la partita</span><span>↗</span></button><p class="pm-small-note">Telefoni o pad. Nessun download per gli amici.</p><div class="pm-error" id="pm-connect" role="status"></div></section></div><footer class="pm-footer"><span>${padHints('muovi / cambia')}</span><span>Mouse e tastiera sempre disponibili</span></footer></main>`, a => this.action(a));
        this.root.querySelectorAll<HTMLButtonElement>('[data-count]').forEach(b => b.onclick = () => { this.count = Number(b.dataset.count); this.focusRow = 0; audio.ui('move'); this.render(); });
        this.root.querySelector<HTMLButtonElement>('#pm-shorter')!.onclick = () => this.duration(-1);
        this.root.querySelector<HTMLButtonElement>('#pm-longer')!.onclick = () => this.duration(1);
        this.root.querySelector<HTMLButtonElement>('#pm-create')!.onclick = () => void this.start();
        const connection = (status: unknown) => { if (!this.root.isConnected)
            return; this.root.querySelector('#pm-connect')!.textContent = status === 'error' ? 'Connessione al server non disponibile. Riprova tra poco.' : ''; };
        const customKeys = (e: KeyboardEvent) => { if (this.presetIdx !== SCORE_PRESETS.length || !['+', '=', '-', '_'].includes(e.key) || document.getElementById('audio-settings'))
            return; e.preventDefault(); this.customScore = Math.max(TARGET_SCORE_MIN, Math.min(TARGET_SCORE_MAX, this.customScore + (['+', '='].includes(e.key) ? 10 : -10))); this.render(); };
        window.addEventListener('keydown', customKeys);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', customKeys));
        this.root.addEventListener('focusin', e => { const el = e.target as HTMLElement; if (el.closest('[data-row="0"]'))
            this.focusRow = 0;
        else if (el.closest('[data-row="1"]'))
            this.focusRow = 1;
        else if (el.id === 'pm-create')
            this.focusRow = 2; });
        const off = gm.events.on('connection', connection);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
        connection(gm.connected ? 'ok' : 'error');
        this.render();
    }
    private action(a: MenuAction): void {
        if (this.creating)
            return;
        if (a === 'start') {
            void this.start();
            return;
        }
        if (a === 'up' || a === 'down') {
            this.focusRow = (this.focusRow + (a === 'up' ? 2 : 1)) % 3;
            this.focus();
            return;
        }
        if (a === 'left' || a === 'right' || a === 'previous' || a === 'next') {
            const d = a === 'left' || a === 'previous' ? -1 : 1;
            if (this.focusRow === 1 && this.presetIdx === SCORE_PRESETS.length && (a === 'previous' || a === 'next')) {
                this.customScore = Math.max(TARGET_SCORE_MIN, Math.min(TARGET_SCORE_MAX, this.customScore + d * 10));
                this.render();
            }
            else if (this.focusRow === 1)
                this.duration(d);
            else if (this.focusRow === 0) {
                this.count = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, this.count + d));
                audio.ui('move');
                this.render();
            }
            return;
        }
        if (a === 'confirm') {
            if (this.focusRow === 2)
                void this.start();
            else {
                this.focusRow++;
                this.focus();
            }
        }
    }
    private duration(d: number): void { this.presetIdx = (this.presetIdx + d + SCORE_PRESETS.length + 1) % (SCORE_PRESETS.length + 1); this.focusRow = 1; audio.ui('move'); this.render(); }
    private target(): number { return SCORE_PRESETS[this.presetIdx]?.points ?? this.customScore; }
    private focus(): void { menuFocus(this.root, this.focusRow === 0 ? `[data-count="${this.count}"]` : this.focusRow === 1 ? '#pm-longer' : '#pm-create'); }
    private render(): void {
        this.root.querySelectorAll<HTMLButtonElement>('[data-count]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.count) === this.count)));
        this.root.querySelector('#pm-preset')!.textContent = SCORE_PRESETS[this.presetIdx]?.label ?? 'PERSONALIZZATA';
        this.root.querySelector('#pm-duration')!.textContent = `Circa ${estimateGameMinutes(this.target())} minuti${this.presetIdx === SCORE_PRESETS.length ? ' · LB/RB: ±10 punti' : ''}`;
        this.root.querySelector('#pm-target-points')!.textContent = `${this.target()} punti`;
        let custom = this.root.querySelector<HTMLElement>('#pm-custom');
        if (this.presetIdx === SCORE_PRESETS.length) {
            if (!custom) {
                custom = document.createElement('div');
                custom.id = 'pm-custom';
                custom.className = 'pm-small-note';
                custom.innerHTML = '<button class="pm-plain" data-delta="-10" aria-label="Dieci punti in meno">−10</button> <span></span> <button class="pm-plain" data-delta="10" aria-label="Dieci punti in più">+10</button>';
                this.root.querySelector('[data-row="1"]')!.appendChild(custom);
                custom.querySelectorAll<HTMLButtonElement>('button').forEach(b => b.onclick = () => { this.customScore = Math.max(TARGET_SCORE_MIN, Math.min(TARGET_SCORE_MAX, this.customScore + Number(b.dataset.delta))); this.render(); });
            }
            custom.querySelector('span')!.textContent = `${this.customScore} punti`;
        }
        else
            custom?.remove();
        this.focus();
    }
    private async start(): Promise<void> {
        if (this.creating)
            return;
        this.creating = true;
        audio.ui('confirm');
        const button = this.root.querySelector<HTMLButtonElement>('#pm-create')!;
        button.disabled = true;
        button.querySelector('span')!.textContent = 'Creo la stanza…';
        try {
            const ack = await gm.createRoom(this.count, this.target());
            if (!this.sys.isActive())
                return;
            if (ack.ok && ack.roomCode)
                this.scene.start('RoomScene');
            else
                throw new Error(ack.error ?? 'Non sono riuscito a creare la stanza.');
        }
        catch (error) {
            if (!this.root.isConnected)
                return;
            this.creating = false;
            button.disabled = false;
            button.querySelector('span')!.textContent = 'Crea la partita';
            this.root.querySelector('#pm-connect')!.textContent = String((error as Error).message);
        }
    }
}
