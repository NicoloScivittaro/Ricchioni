import Phaser from 'phaser';
import { pads, type MenuAction } from '../input/GamepadManager';
import { audio } from '../core/AudioManager';
import './partyMenu.css';
import { portraitCss } from '../../shared/characterPresentation';
export const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const brand = `<div class="pm-brand"><span class="pm-brand-mark">p<span>g</span></span><div>PARTY GAME<small>LA SERATA COMINCIA QUI</small></div></div>`;
export const padHints = (detail: string) => `<span class="pm-key">✥</span> ${detail} <span class="pm-key pm-a">A / ✕</span> scegli <span class="pm-key">MENU / OPTIONS</span> avvia <span class="pm-key">B / ◯</span> indietro`;
export function mountMenu(scene: Phaser.Scene, html: string, handle: (action: MenuAction, source: 'pad' | 'keyboard') => void): HTMLDivElement {
    const root = document.createElement('div');
    root.id = 'party-menu';
    root.innerHTML = html;
    document.body.appendChild(root);
    root.addEventListener('pointerdown', () => audio.unlock());
    const release = pads.bindMenu(a => { audio.unlock(); handle(a, 'pad'); });
    const onKey = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.altKey || e.metaKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName))
            return;
        if (document.getElementById('audio-settings'))
            return;
        if (document.getElementById('pad-root')?.classList.contains('open')) {
            if (e.key === 'Escape')
                pads.events.emit('menuDismissPairing');
            return;
        }
        const dialog = root.querySelector<HTMLElement>('#pm-catalog:not([hidden])');
        if (e.key === 'Tab' && dialog) {
            const items = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')], i = items.indexOf(document.activeElement as HTMLButtonElement);
            e.preventDefault();
            items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
            return;
        }
        const target = e.target as HTMLElement;
        if ((e.key === ' ' || (e.key === 'Enter' && target instanceof HTMLElement && target.matches('[data-game],[data-catalog],[data-delta],#pm-back,#pm-pair,#pm-catalog-open,#pm-catalog-close,#pm-feature'))) && target.tagName === 'BUTTON' && root.contains(target)) {
            e.preventDefault();
            if (!e.repeat)
                target.click();
            return;
        }
        const action: MenuAction | undefined = ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'start', ' ': 'confirm', Escape: 'back', Backspace: 'back', PageUp: 'previous', PageDown: 'next' } as Record<string, MenuAction>)[e.key];
        if (action) {
            e.preventDefault();
            if (e.repeat && ['start', 'confirm', 'back'].includes(action))
                return;
            audio.unlock();
            handle(action, 'keyboard');
        }
    };
    window.addEventListener('keydown', onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { release(); window.removeEventListener('keydown', onKey); root.remove(); });
    return root;
}
export function menuFocus(root: HTMLElement, selector: string): void {
    root.querySelectorAll('.pm-focused').forEach(el => el.classList.remove('pm-focused'));
    const el = root.querySelector<HTMLElement>(selector);
    el?.classList.add('pm-focused');
    el?.focus({ preventScroll: true });
}
export function menuPortrait(id: string | null | undefined, size = 36): string { return `<span class="pm-portrait" aria-hidden="true" style="${esc(portraitCss(id, size))}"></span>`; }
