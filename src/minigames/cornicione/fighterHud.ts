import { Control, Image as GuiImage, Rectangle, StackPanel, TextBlock } from '@babylonjs/gui';
import type { Scene } from '@babylonjs/core';
import { GameHud, hudPanel, hudText } from '../hud/hudKit';
import { UI } from '../../core/uiTokens';
import { CHAR_ICONS, iconDataUrl } from '../../../shared/charIcons';
import { stateLabel } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';

/**
 * HUD di BOTTE SUL CORNICIONE sul kit comune (hud/hudKit.ts). In basso una scheda per giocatore:
 *   ritratto · NOME CORTO · vite (♥♥♥)    PERCENTUALE grande    ⚡ stato abilita'
 * La percentuale cambia a fasce (0-50 chiara, 50-100 piu' calda, 100-150 pericolo, 150+ avviso forte) e NON si affida solo al
 * colore: sopra il 100 il contorno si ispessisce, sopra il 150 compare l'icona ⚠ e il numero pulsa. Chi e' fuori dal quadro ma ancora
 * vivo ha un indicatore sul bordo (ritratto + freccia + percentuale).
 */

export interface FighterCardInfo {
  id: string;
  /** nome corto (GOBLIN, BUTTAFUORI...) */
  label: string;
  characterId: string | null;
  color: string;
}

/** Fasce della percentuale (stesse per HUD, indicatori e test). */
export function percentTier(p: number): 0 | 1 | 2 | 3 {
  return p >= 150 ? 3 : p >= 100 ? 2 : p >= 50 ? 1 : 0;
}
const TIER_COLOR = ['#ffffff', '#ffd66b', '#ff9b4a', '#ff4d4d'] as const;

interface Card {
  box: Rectangle;
  hearts: TextBlock;
  pct: TextBlock;
  status: TextBlock;
  tier: 0 | 1 | 2 | 3;
  out: boolean;
}

interface Indicator {
  box: Rectangle;
  arrow: TextBlock;
  pct: TextBlock;
}

export class FighterHud extends GameHud {
  private cards = new Map<string, Card>();
  private indicators = new Map<string, Indicator>();
  private comboText: TextBlock;
  private comboTimer = 0;
  private pulse = 0;
  private scene: Scene;

  constructor(scene: Scene, title = '🧱 BOTTE SUL CORNICIONE') {
    super(scene, 'cornicioneHud', title);
    this.scene = scene;
    this.feed.top = '178px'; // sotto gli annunci
    this.comboText = hudText('combo', '', UI.size.L, UI.color.accent);
    this.comboText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.comboText.top = `${UI.safe.y + 240}px`;
    this.comboText.height = '60px';
    this.adt.addControl(this.comboText);
    scene.onBeforeRenderObservable.add(() => {
      const dt = scene.getEngine().getDeltaTime();
      this.pulse += dt;
      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.comboText.text = '';
      }
      // sopra il 150% il numero pulsa
      const k = 1 + Math.sin(this.pulse * 0.012) * 0.08;
      for (const c of this.cards.values()) if (c.tier === 3 && !c.out) c.pct.scaleX = c.pct.scaleY = k;
    });
  }

  /** Annuncio grande ma in ALTO: non copre i personaggi che stanno combattendo al centro. */
  announce(text: string, sub = '', color = '#fbbf24', ms = 1400, size = 84): void {
    this.banner(text, sub, color, ms, size, -265);
    this.bannerBox.height = '170px';
  }

  setTimer(sec: number): void {
    const s = Math.max(0, Math.ceil(sec));
    this.setRight(`⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, s <= 15 ? UI.color.danger : UI.color.accent);
  }

  buildCards(list: FighterCardInfo[]): void {
    const row = new StackPanel('fighterCards');
    row.isVertical = false;
    row.height = '108px';
    row.top = `${-UI.safe.y + 4}px`;
    row.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    const w = Math.min(238, Math.floor((1280 - UI.safe.x * 2) / Math.max(1, list.length)) - 8);
    for (const p of list) {
      const box = hudPanel(`fc_${p.id}`, `${w}px`, '100px', p.color);
      box.thickness = 3;
      box.paddingLeft = '4px';
      box.paddingRight = '4px';
      // posizioni esplicite dall'alto (niente scostamenti dal centro: i testi non si sovrappongono)
      const place = (c: Control, h: 'L' | 'R', left: number, top: number, cw: number, ch: number): void => {
        c.horizontalAlignment = h === 'L' ? Control.HORIZONTAL_ALIGNMENT_LEFT : Control.HORIZONTAL_ALIGNMENT_RIGHT;
        c.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        c.left = `${h === 'L' ? left : -left}px`;
        c.top = `${top}px`;
        c.width = `${cw}px`;
        c.height = `${ch}px`;
      };
      const src = p.characterId ? iconDataUrl(CHAR_ICONS[p.characterId]) : '';
      if (src) {
        const icon = new GuiImage(`fcIcon_${p.id}`, src);
        place(icon, 'L', 8, 6, 36, 36);
        box.addControl(icon);
      }
      const name = hudText(`fcName_${p.id}`, p.label, UI.size.XS + 1, p.color);
      place(name, 'L', 50, 8, w - 62, 20);
      name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      name.outlineWidth = 2;
      box.addControl(name);
      const hearts = hudText(`fcHearts_${p.id}`, '♥♥♥', UI.size.S, '#ff6b81');
      place(hearts, 'L', 10, 40, Math.floor(w * 0.4), 24);
      hearts.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      hearts.outlineWidth = 2;
      box.addControl(hearts);
      const pct = hudText(`fcPct_${p.id}`, '0%', UI.size.L, TIER_COLOR[0]);
      place(pct, 'R', 8, 30, Math.floor(w * 0.55), 46);
      pct.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      box.addControl(pct);
      const status = hudText(`fcStatus_${p.id}`, '', UI.size.XS + 1, UI.color.textDim, false);
      place(status, 'L', 10, 72, w - 24, 22);
      status.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      status.outlineWidth = 0;
      box.addControl(status);
      row.addControl(box);
      this.cards.set(p.id, { box, hearts, pct, status, tier: 0, out: false });
    }
    this.adt.addControl(row);

    // indicatori fuori dal quadro (uno per giocatore, nascosti finche' non servono)
    for (const p of list) {
      const box = new Rectangle(`ind_${p.id}`);
      box.width = '92px';
      box.height = '58px';
      box.thickness = 3;
      box.color = p.color;
      box.background = 'rgba(11,11,20,0.85)';
      box.cornerRadius = 14;
      box.isVisible = false;
      box.isHitTestVisible = false;
      const src = p.characterId ? iconDataUrl(CHAR_ICONS[p.characterId]) : '';
      if (src) {
        const icon = new GuiImage(`indIcon_${p.id}`, src);
        icon.width = '30px';
        icon.height = '30px';
        icon.left = '-26px';
        icon.top = '-9px';
        box.addControl(icon);
      }
      const arrow = hudText(`indArrow_${p.id}`, '▲', UI.size.M, p.color);
      arrow.left = '24px';
      arrow.top = '-9px';
      arrow.width = '34px';
      arrow.height = '34px';
      arrow.outlineWidth = 2;
      box.addControl(arrow);
      const pct = hudText(`indPct_${p.id}`, '0%', UI.size.S, TIER_COLOR[0]);
      pct.top = '16px';
      pct.height = '24px';
      pct.outlineWidth = 2;
      box.addControl(pct);
      this.adt.addControl(box);
      this.indicators.set(p.id, { box, arrow, pct });
    }
  }

  setFighter(id: string, lives: number, percent: number, status: AbilityStatus | null, state: { dead: boolean; out: boolean }): void {
    const c = this.cards.get(id);
    if (!c) return;
    const n = Math.max(0, lives);
    c.hearts.text = n > 0 ? '♥'.repeat(n) : '✕ FUORI';
    c.hearts.color = n > 0 ? '#ff6b81' : UI.color.danger;
    const p = Math.round(percent);
    const tier = percentTier(p);
    c.pct.text = `${tier === 3 ? '⚠ ' : ''}${p}%`;
    c.pct.color = TIER_COLOR[tier];
    c.pct.outlineWidth = tier >= 2 ? UI.outline.thick : UI.outline.thin;
    if (tier !== 3) c.pct.scaleX = c.pct.scaleY = 1;
    c.tier = tier;
    c.out = state.out;
    c.box.alpha = state.out ? 0.5 : state.dead ? 0.75 : 1;
    if (state.out) {
      c.status.text = '';
    } else if (status) {
      const color = status.state === 'READY' ? UI.color.success : status.state === 'ACTIVE' ? UI.color.accent : status.state === 'COOLDOWN' ? UI.color.textDim : UI.color.muted;
      const mark = status.state === 'COOLDOWN' ? '⌛' : status.state === 'SPENT' ? '✕' : '⚡';
      c.status.text = `${mark} ${stateLabel(status)}`;
      c.status.color = color;
    }
  }

  /** Indicatore sul bordo per chi e' vivo ma fuori dal quadro. (nx, ny) in 0..1 gia' limitati al bordo; angle = verso dove sta davvero. */
  setIndicator(id: string, show: boolean, nx = 0.5, ny = 0.5, angle = 0, percent = 0): void {
    const ind = this.indicators.get(id);
    if (!ind) return;
    if (ind.box.isVisible !== show) ind.box.isVisible = show;
    if (!show) return;
    ind.box.left = `${(nx - 0.5) * 100}%`;
    ind.box.top = `${(ny - 0.5) * 100}%`;
    ind.arrow.rotation = angle;
    ind.pct.text = `${Math.round(percent)}%`;
    ind.pct.color = TIER_COLOR[percentTier(percent)];
  }

  /** Contatore combo (solo visivo: non da' punti). */
  showCombo(label: string, hits: number): void {
    this.comboText.text = `${label} · ${hits} COLPI`;
    this.comboTimer = 1100;
  }

  override dispose(): void {
    this.cards.clear();
    this.indicators.clear();
    super.dispose();
    void this.scene;
  }
}
