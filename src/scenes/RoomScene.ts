import Phaser from 'phaser';
import QRCode from 'qrcode';
import { game as gm } from '../core/GameManager';
import { audio } from '../core/AudioManager';
import { CHARACTER_ORDER, getCharacter } from '../../shared/characters';
import { MINIGAME_DEFINITIONS, getMinigame } from '../../shared/minigames';
import { estimateGameMinutes } from '../../shared/types';
import { kartTrackName } from '../../shared/kartTracks';
import { controllerUrlForRoom } from '../../shared/controllerUrl';
import { pads, type MenuAction } from '../input/GamepadManager';
import { showPairingPanel } from '../input/PairingPanel';
import { brand, esc, mountMenu, menuFocus, padHints, menuPortrait } from './partyMenu';
import { gameAccent, gameArtwork } from './gameArtwork';
export class RoomScene extends Phaser.Scene {
    private root!: HTMLDivElement;
    private lastKey = '';
    private selected: string | null = null;
    private focusRow = 0;
    private catalog = false;
    private catalogIndex = 0;
    private pendingSelection = false;
    constructor() { super('RoomScene'); }
    create(): void {
        this.lastKey = '';
        this.focusRow = 0;
        this.catalog = false;
        this.pendingSelection = false;
        this.selected = this.current();
        this.cameras.main.setBackgroundColor('#0d1222');
        this.root = mountMenu(this, `<main class="pm-page"><header class="pm-header">${brand}<div class="pm-top-note"><span id="pm-target"></span><button id="pm-back" class="pm-plain">← Nuova serata</button></div></header><div class="pm-room"><section class="pm-room-main"><div class="pm-room-heading"><div><div class="pm-eyebrow">Scegliete la prossima sfida</div><h1>Che si gioca?</h1><p>Lascia decidere al rullo, oppure scegli il tuo preferito.</p></div><span id="pm-library-count" class="pm-muted"></span></div><button class="pm-feature" id="pm-feature" aria-label="Apri il catalogo dei minigiochi"></button><div class="pm-library-title"><b>La vostra sala giochi</b><button class="pm-plain" id="pm-catalog-open">Vedi tutti ↗</button></div><div class="pm-card-strip" id="pm-games" aria-label="Scegli un minigioco"></div><div class="pm-room-start"><span class="pm-start-copy" id="pm-start-help"></span><button class="pm-primary" id="pm-start"><span>Inizia la serata</span><span>▶</span></button></div></section><aside class="pm-room-side"><div class="pm-room-code"><div><small>LA VOSTRA STANZA</small><b>${esc(gm.roomCode || '?????')}</b></div><i class="pm-dot"></i></div><div class="pm-qr-area"><img id="pm-qr" alt="QR per entrare nella stanza"><p>Inquadra il QR.<br>Scegli chi essere.<br>Preparati a perdere.</p></div><div class="pm-room-url" id="pm-room-url"></div><div class="pm-roster-title"><b>LA COMPAGNIA</b><span id="pm-player-count"></span></div><div id="pm-roster" class="pm-roster"></div><button id="pm-pair" class="pm-plain">🎮 Collega i controller</button></aside></div><footer class="pm-footer"><span>${padHints('scorri / naviga')}</span><span id="pm-device-count"></span></footer></main><section class="pm-catalog" id="pm-catalog" hidden role="dialog" aria-modal="true" aria-labelledby="pm-catalog-title"><div class="pm-catalog-box"><header class="pm-catalog-header"><div><div class="pm-eyebrow">Tutti i giochi della serata</div><h2 id="pm-catalog-title">Scegli la tua sfida.</h2></div><button class="pm-plain" id="pm-catalog-close" aria-label="Chiudi catalogo">✕</button></header><div class="pm-catalog-grid" id="pm-catalog-grid"></div><p class="pm-catalog-help">Stick / croce direzionale per navigare · A / ✕ oppure Invio per scegliere · B / ◯ per tornare</p></div></section>`, (a, s) => this.action(a, s));
        const click = (id: string, fn: () => void) => this.root.querySelector<HTMLButtonElement>(id)!.onclick = fn;
        click('#pm-back', () => this.abandon());
        click('#pm-feature', () => this.openCatalog());
        click('#pm-catalog-open', () => this.openCatalog());
        click('#pm-catalog-close', () => this.closeCatalog());
        click('#pm-start', () => this.tryStart());
        click('#pm-pair', () => showPairingPanel());
        this.root.querySelector('#pm-catalog')!.addEventListener('click', e => { if (e.target === e.currentTarget)
            this.closeCatalog(); });
        this.root.addEventListener('focusin', e => { const el = e.target as HTMLElement; if (el.dataset.catalog)
            this.catalogIndex = Number(el.dataset.catalog);
        else if (el.id === 'pm-start')
            this.focusRow = 2;
        else if (el.id === 'pm-catalog-open')
            this.focusRow = 1;
        else if (el.id === 'pm-feature' || el.dataset.game)
            this.focusRow = 0; });
        void this.setupQR(gm.roomCode);
        this.drawCards();
        this.update();
    }
    private options(): (string | null)[] { const st = gm.state; if (!st)
        return [null]; const games = MINIGAME_DEFINITIONS.filter(d => d.enabled !== false && st.playerCount >= d.minPlayers && st.playerCount <= d.maxPlayers).map(d => d.id); return [null, ...games, ...(games.includes('kart3d') ? ['kart3d:arcobaleno', 'kart3d:sydney', 'kart3d:primo'] : [])]; }
    private current(): string | null { const st = gm.state; return st?.selectedMinigameId === 'kart3d' && st.selectedKartTrackId && st.selectedKartTrackId !== 'litorale' ? `kart3d:${st.selectedKartTrackId}` : st?.selectedMinigameId ?? null; }
    private definition(id: string | null) { return id ? getMinigame(id.startsWith('kart3d:') ? 'kart3d' : id) : undefined; }
    private name(id: string | null): string { return id?.startsWith('kart3d:') ? kartTrackName(id.slice(7) as 'arcobaleno' | 'sydney' | 'primo') : this.definition(id)?.name ?? 'Il rullo decide'; }
    private category(id: string | null): string { return this.definition(id)?.category ?? 'TUTTA LA SERATA'; }
    private card(id: string | null, i: number, catalog = false): string { const def = this.definition(id); return `<button class="pm-mini-card" style="--game-accent:${gameAccent(def)}" ${catalog ? 'data-catalog' : 'data-game'}="${i}" aria-pressed="${id === this.selected}"><div class="pm-art">${gameArtwork(def)}</div><strong>${esc(this.name(id))}</strong><small>${esc(this.category(id))}</small></button>`; }
    private drawCards(): void {
        const opts = this.options();
        this.root.querySelector('#pm-games')!.innerHTML = opts.map((id, i) => this.card(id, i)).join('');
        this.root.querySelectorAll<HTMLButtonElement>('[data-game]').forEach(b => b.onclick = () => { this.focusRow = 0; this.choose(opts[Number(b.dataset.game)]); });
        this.root.querySelector('#pm-catalog-grid')!.innerHTML = opts.map((id, i) => this.card(id, i, true)).join('');
        this.root.querySelectorAll<HTMLButtonElement>('[data-catalog]').forEach(b => b.onclick = () => { this.choose(opts[Number(b.dataset.catalog)]); this.closeCatalog(); });
        this.root.querySelector('#pm-library-count')!.textContent = `${opts.length - 1} scelte`;
        this.renderSelection(false);
    }
    private choose(id: string | null): void {
        if (!this.options().includes(id))
            return;
        this.selected = id;
        this.pendingSelection = true;
        audio.ui('move');
        gm.selectMinigame(id?.startsWith('kart3d:') ? 'kart3d' : id, id === 'kart3d:primo' ? 'primo' : id === 'kart3d:sydney' ? 'sydney' : id === 'kart3d:arcobaleno' ? 'arcobaleno' : 'litorale');
        this.renderSelection(true);
    }
    private renderSelection(scroll: boolean): void {
        const id = this.selected, def = this.definition(id), feature = this.root.querySelector<HTMLElement>('#pm-feature')!;
        feature.style.setProperty('--game-accent', gameAccent(def));
        feature.innerHTML = `<div class="pm-feature-copy"><span class="pm-tag">${esc(this.category(id))}</span><h2>${esc(this.name(id))}</h2><p>${esc(def?.description ?? 'Un gioco diverso a ogni giro. Sfide, sorprese e nessun alibi: fatevi trovare pronti.')}</p><div class="pm-feature-meta"><span>${def?.inputMode === 'PHONE_TEXT' ? '📱 Telefono' : '🎮 Pad o telefono'}</span><span>${id ? 'Scelta libera' : 'Senza ripetizioni nel giro'}</span></div></div><div class="pm-art">${gameArtwork(def)}</div>`;
        const opts = this.options(), index = Math.max(0, opts.indexOf(id));
        this.root.querySelectorAll<HTMLElement>('[data-game],[data-catalog]').forEach(el => el.setAttribute('aria-pressed', String(Number(el.dataset.game ?? el.dataset.catalog) === index)));
        if (scroll)
            this.root.querySelector<HTMLElement>(`[data-game="${index}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
    private openCatalog(): void { this.catalog = true; this.root.querySelector<HTMLElement>('.pm-page')!.inert = true; this.catalogIndex = Math.max(0, this.options().indexOf(this.selected)); this.root.querySelector<HTMLElement>('#pm-catalog')!.hidden = false; this.catalogFocus(); }
    private closeCatalog(): void { this.catalog = false; this.root.querySelector<HTMLElement>('.pm-page')!.inert = false; this.root.querySelector<HTMLElement>('#pm-catalog')!.hidden = true; this.focus(); }
    private catalogFocus(): void { menuFocus(this.root, `[data-catalog="${this.catalogIndex}"]`); this.root.querySelector<HTMLElement>(`[data-catalog="${this.catalogIndex}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    private focus(): void { menuFocus(this.root, this.focusRow === 0 ? '#pm-feature' : this.focusRow === 1 ? '#pm-catalog-open' : '#pm-start'); }
    private action(a: MenuAction, source: 'pad' | 'keyboard'): void {
        if (this.catalog) {
            const opts = this.options();
            if (a === 'back') {
                this.closeCatalog();
                return;
            }
            if (a === 'confirm' || a === 'start') {
                this.choose(opts[this.catalogIndex]);
                this.closeCatalog();
                return;
            }
            const columns = getComputedStyle(this.root.querySelector('#pm-catalog-grid')!).gridTemplateColumns.split(' ').length;
            const delta = a === 'left' || a === 'previous' ? -1 : a === 'right' || a === 'next' ? 1 : a === 'up' ? -columns : columns;
            this.catalogIndex = (this.catalogIndex + delta + opts.length) % opts.length;
            this.catalogFocus();
            audio.ui('move');
            return;
        }
        if (a === 'back') {
            this.abandon();
            return;
        }
        if (a === 'start') {
            this.tryStart();
            return;
        }
        if (a === 'up' || a === 'down') {
            this.focusRow = (this.focusRow + (a === 'up' ? 2 : 1)) % 3;
            this.focus();
            return;
        }
        if (a === 'left' || a === 'right' || a === 'previous' || a === 'next') {
            const opts = this.options(), i = Math.max(0, opts.indexOf(this.selected)), d = a === 'left' || a === 'previous' ? -1 : 1;
            this.choose(opts[(i + d + opts.length) % opts.length]);
            return;
        }
        if (a === 'confirm') {
            if (this.focusRow === 2)
                this.tryStart();
            else
                this.openCatalog();
        }
    }
    private tryStart(): void { const st = gm.state; if (st && st.players.length >= 1 && st.players.every(p => p.connected && p.ready && p.characterId)) {
        audio.ui('confirm');
        gm.startGame();
    }
    else {
        this.root.querySelector('#pm-start-help')!.textContent = 'Entra dal telefono e aspetta che tutti siano pronti.';
        audio.ui('cancel');
    } }
    private abandon(): void { audio.ui('cancel'); gm.backToLobby(); this.scene.start('LobbyScene'); }
    private async setupQR(code: string): Promise<void> {
        let ips: string[] = [];
        if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname))
            try {
                const origin = import.meta.env.DEV ? (import.meta.env.VITE_SERVER_URL?.trim() || `http://${location.hostname}:3001`) : location.origin;
                const res = await fetch(new URL('/api/network', origin), { signal: AbortSignal.timeout(3000) });
                if (res.ok) {
                    const data = await res.json() as {
                        ips?: unknown;
                    };
                    if (Array.isArray(data.ips))
                        ips = data.ips.filter((x): x is string => typeof x === 'string');
                }
            }
            catch { /* same-origin fallback */ }
        const url = controllerUrlForRoom(location.origin, code, ips);
        try {
            const qr = await QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: '#101728', light: '#ffffff' } });
            if (!this.root.isConnected || gm.roomCode !== code)
                return;
            this.root.querySelector<HTMLImageElement>('#pm-qr')!.src = qr;
            this.root.querySelector('#pm-room-url')!.textContent = url.replace(/^https?:\/\//, '');
        }
        catch {
            if (this.root.isConnected)
                this.root.querySelector('#pm-room-url')!.textContent = url;
        }
    }
    update(): void {
        const st = gm.state;
        if (!st || !this.root)
            return;
        const key = JSON.stringify([st.playerCount, st.selectedMinigameId, st.selectedKartTrackId, st.targetScore, st.players.map(p => [p.id, p.characterId, p.ready, p.connected, p.displayName, pads.slotOf(p.id)?.state])]);
        if (key === this.lastKey)
            return;
        this.lastKey = key;
        const actual = this.current();
        if (actual === this.selected)
            this.pendingSelection = false;
        else if (!this.pendingSelection) {
            this.selected = actual;
            this.renderSelection(false);
        }
        this.root.querySelector('#pm-target')!.textContent = `${st.targetScore} punti · circa ${estimateGameMinutes(st.targetScore)} min`;
        this.root.querySelector('#pm-player-count')!.textContent = `${st.players.length} / ${st.playerCount}`;
        const withPad = st.players.filter(p => pads.slotOf(p.id)?.state === 'paired').length;
        this.root.querySelector('#pm-device-count')!.textContent = withPad ? `${withPad} pad · ${st.players.length - withPad} telefoni` : 'Gioca con pad o telefono';
        const rows = Array.from({ length: st.playerCount }, (_, i) => {
            const p = st.players[i];
            if (!p)
                return `<div class="pm-player pm-empty">${menuPortrait(CHARACTER_ORDER[i % CHARACTER_ORDER.length], 30)}<div><b>Posto ${i + 1}</b><small>Un amico… o un bot al via</small></div></div>`;
            const c = p.characterId ? getCharacter(p.characterId) : null;
            return `<div class="pm-player">${menuPortrait(p.characterId ?? CHARACTER_ORDER[i % CHARACTER_ORDER.length], 30)}<div><b>${esc(p.displayName)}</b><small>${esc(c?.roleTitle ?? 'Sceglie il personaggio')}${pads.slotOf(p.id)?.state === 'paired' ? ' · Pad' : ''}</small></div><span class="pm-ready${!p.connected?' pm-offline':!p.ready?' pm-waiting':''}">${!p.connected ? 'Offline' : p.ready ? 'Pronto' : 'Attendi'}</span></div>`;
        });
        this.root.querySelector('#pm-roster')!.innerHTML = rows.join('');
        const can = st.players.length >= 1 && st.players.every(p => p.connected && p.ready && p.characterId);
        this.root.querySelector<HTMLButtonElement>('#pm-start')!.disabled = !can;
        this.root.querySelector('#pm-start-help')!.textContent = can ? (st.players.length === 1 ? `Si parte con ${st.playerCount - 1} bot. Gli amici possono ancora entrare.` : 'La compagnia è pronta. Si parte?') : 'Inquadra il QR e scegli il personaggio sul telefono.';
    }
}
