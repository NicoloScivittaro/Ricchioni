import { AdvancedDynamicTexture, Control, Image as GuiImage, Rectangle, StackPanel, TextBlock } from '@babylonjs/gui';
import type { Scene } from '@babylonjs/core';
import { UI } from '../../core/uiTokens';
import { popCountdown } from '../../core/countdownFx';
import { CHAR_ICONS, iconDataUrl } from '../../../shared/charIcons';
import { stateLabel } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';

/**
 * KIT HUD dei giochi 3D (Babylon GUI): gli stessi pezzi per Arena, Dodgeball, Calcio, Pallavolo (e in parte Kart/Sparatoria).
 *  - testi con i token del design system (display/body, contorno e ombra leggibili sul 3D)
 *  - CHIP del gioco in alto a sinistra (piccolo: il gioco e' la cosa importante, non il suo nome)
 *  - BARRA SQUADRE: ROSSI ▲ n — timer — n ● BLU (colore + parola + simbolo)
 *  - COUNTDOWN 3-2-1-VIA uguale in tutti i giochi (dimensione, contorno, animazione: countdownFx)
 *  - ANNUNCIO (GOOOL, KO, MATCH POINT): grande, breve, con riga del protagonista
 *  - FEED compatto (pillole con fondo, max 3)
 *  - STRISCIA GIOCATORI in basso: icona + nome + stato (chi e' fuori si vede barrato e spento)
 * Tutto dentro la SAFE AREA. Nessuna texture rigenerata a ogni frame: si cambiano solo testi e visibilita'.
 */

export function hudText(name: string, text: string, size: number, color: string, display = true): TextBlock {
  const t = new TextBlock(name, text);
  t.fontFamily = display ? UI.font.display : UI.font.body;
  t.fontWeight = display ? '900' : '700';
  t.fontSize = size;
  t.color = color;
  t.outlineColor = UI.outline.color;
  t.outlineWidth = size >= 40 ? UI.outline.thick : UI.outline.thin;
  t.shadowColor = UI.shadow.color;
  t.shadowBlur = UI.shadow.blur;
  t.shadowOffsetY = UI.shadow.y;
  return t;
}

export function hudPanel(name: string, w: string, h: string, border = 'rgba(255,255,255,0.18)'): Rectangle {
  const r = new Rectangle(name);
  r.width = w;
  r.height = h;
  r.thickness = 2;
  r.color = border;
  r.background = `rgba(11,11,20,${UI.color.panelAlpha})`;
  r.cornerRadius = UI.radius.m;
  r.isHitTestVisible = false;
  return r;
}

export interface HudPlayer {
  id: string;
  name: string;
  characterId: string | null;
  color: string;
  team?: 'red' | 'blue' | null;
}

export class GameHud {
  readonly adt: AdvancedDynamicTexture;
  private countdownText: TextBlock;
  protected feed: StackPanel;
  private feedTimers: number[] = [];
  protected bannerBox: Rectangle;
  protected bannerText: TextBlock;
  protected bannerSub: TextBlock;
  private bannerTimer = 0;
  private modifier: TextBlock;
  protected chip!: Rectangle;
  private right: TextBlock;
  private teamBar: { red: TextBlock; blue: TextBlock; timer: TextBlock; note: TextBlock } | null = null;
  private strip: Map<string, { box: Rectangle; name: TextBlock; status: TextBlock; icon: GuiImage | null }> = new Map();

  constructor(scene: Scene, id: string, gameTitle: string) {
    this.adt = AdvancedDynamicTexture.CreateFullscreenUI(id, true, scene);
    this.adt.idealHeight = 720;
    const S = UI.safe;

    // chip del gioco: piccolo, in alto a sinistra
    const chip = hudPanel('gameChip', '330px', '40px');
    this.chip = chip;
    chip.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    chip.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    chip.left = `${S.x}px`;
    chip.top = `${S.y}px`;
    chip.adaptWidthToChildren = true;
    const chipText = hudText('gameChipText', gameTitle, UI.size.XS + 2, UI.color.textDim);
    chipText.resizeToFit = true;
    chipText.paddingLeft = '14px';
    chipText.paddingRight = '14px';
    chipText.outlineWidth = 0;
    chip.addControl(chipText);
    this.adt.addControl(chip);

    // modificatore (sotto il chip): solo se c'e'
    this.modifier = hudText('modifier', '', UI.size.XS + 2, UI.color.warning);
    this.modifier.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.modifier.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.modifier.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.modifier.left = `${S.x + 4}px`;
    this.modifier.top = `${S.y + 46}px`;
    this.modifier.height = '26px';
    this.modifier.width = '520px';
    this.adt.addControl(this.modifier);

    // stato a destra (IN GARA 4/5, ecc.)
    this.right = hudText('rightStat', '', UI.size.M, UI.color.success);
    this.right.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.right.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.right.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    this.right.left = `${-S.x}px`;
    this.right.top = `${S.y}px`;
    this.right.width = '360px';
    this.right.height = '40px';
    this.adt.addControl(this.right);

    // feed: pillole compatte sotto la barra in alto
    this.feed = new StackPanel('feed');
    this.feed.isVertical = true;
    this.feed.top = '112px';
    this.feed.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    this.feed.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    this.adt.addControl(this.feed);

    // annuncio grande (GOOOL, KO, MATCH POINT)
    this.bannerBox = new Rectangle('banner');
    this.bannerBox.width = '100%';
    this.bannerBox.height = '190px';
    this.bannerBox.thickness = 0;
    this.bannerBox.background = 'rgba(11,11,20,0.55)';
    this.bannerBox.isVisible = false;
    this.bannerBox.isHitTestVisible = false;
    this.bannerText = hudText('bannerText', '', 104, UI.color.accent);
    this.bannerText.top = '-22px';
    this.bannerSub = hudText('bannerSub', '', UI.size.M, UI.color.text);
    this.bannerSub.top = '62px';
    this.bannerSub.height = '40px';
    this.bannerBox.addControl(this.bannerText);
    this.bannerBox.addControl(this.bannerSub);
    this.adt.addControl(this.bannerBox);

    // countdown: uguale in tutti i giochi
    this.countdownText = hudText('countdown', '', UI.size.XXL + 8, UI.color.accent);
    this.countdownText.outlineWidth = 8;
    this.adt.addControl(this.countdownText);

    scene.onBeforeRenderObservable.add(() => {
      if (this.bannerTimer <= 0) return;
      this.bannerTimer -= scene.getEngine().getDeltaTime();
      if (this.bannerTimer <= 0) this.bannerBox.isVisible = false;
      else if (this.bannerTimer < UI.motion.exit) this.bannerBox.alpha = this.bannerTimer / UI.motion.exit;
    });
  }

  setModifier(label: string | null): void {
    this.modifier.text = label ? `⚠ ${label}` : '';
  }

  /** Testo di stato in alto a destra (es. "IN GARA 4/5"). */
  setRight(text: string, color: string = UI.color.success): void {
    this.right.text = text;
    this.right.color = color;
  }

  setCountdown(text: string, color: string = UI.color.accent): void {
    this.countdownText.text = text;
    this.countdownText.color = text === 'VIA!' ? UI.color.success : color;
    if (text) popCountdown(this.countdownText, this.adt.getScene(), text === 'VIA!');
  }

  clearCountdown(): void {
    this.countdownText.text = '';
  }

  /** Annuncio grande e breve (non resta sullo schermo: max ~1.6 s). */
  banner(text: string, sub = '', color: string = UI.color.accent, ms = 1500, size = 104, top = 0): void {
    this.bannerText.fontSize = size;
    this.bannerBox.top = `${top}px`;
    this.bannerText.text = text;
    this.bannerText.color = color;
    this.bannerSub.text = sub;
    this.bannerBox.alpha = 1;
    this.bannerBox.isVisible = true;
    this.bannerTimer = ms;
    popCountdown(this.bannerText, this.adt.getScene(), false);
  }

  feedMessage(text: string, color: string = UI.color.text, ms = 2600): void {
    const pill = hudPanel('feedPill', '10px', '40px', 'rgba(255,255,255,0.12)');
    pill.adaptWidthToChildren = true;
    pill.paddingBottom = '6px';
    pill.height = '46px';
    const t = hudText('feedText', text, UI.size.S + 2, color);
    t.resizeToFit = true;
    t.paddingLeft = '16px';
    t.paddingRight = '16px';
    t.outlineWidth = 0;
    pill.addControl(t);
    this.feed.addControl(pill);
    while (this.feed.children.length > 3) {
      const first = this.feed.children[0];
      this.feed.removeControl(first);
      first.dispose();
    }
    this.feedTimers.push(
      window.setTimeout(() => {
        try {
          this.feed.removeControl(pill);
          pill.dispose();
        } catch {
          /* gia' rimosso */
        }
      }, ms)
    );
  }

  // ---------------------------------------------------------------- squadre

  /** Barra squadre compatta in alto al centro: ROSSI ▲ n — m:ss — n ● BLU (colore + parola + simbolo). */
  teamScoreBar(): void {
    const bar = new StackPanel('teamBar');
    bar.isVertical = false;
    bar.height = '64px';
    bar.top = `${UI.safe.y - 4}px`;
    bar.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    const side = (team: 'red' | 'blue'): TextBlock => {
      const p = hudPanel(`team_${team}`, '250px', '60px', UI.team[team].color);
      p.thickness = 3;
      p.background = team === 'red' ? 'rgba(80,16,20,0.9)' : 'rgba(16,30,80,0.9)';
      const t = hudText(`teamText_${team}`, '', UI.size.L - 4, UI.color.text);
      p.addControl(t);
      bar.addControl(p);
      return t;
    };
    const red = side('red');
    const mid = hudPanel('timerBox', '130px', '52px');
    const timer = hudText('timer', '', UI.size.M + 2, UI.color.accent);
    mid.addControl(timer);
    bar.addControl(mid);
    const blue = side('blue');
    this.adt.addControl(bar);
    const note = hudText('teamNote', '', UI.size.S, UI.color.danger);
    note.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    note.top = `${UI.safe.y + 64}px`;
    note.height = '30px';
    this.adt.addControl(note);
    this.teamBar = { red, blue, timer, note };
    this.feed.top = `${UI.safe.y + 100}px`;
    // con la barra squadre il nome del gioco scende sotto (niente scontro col punteggio di sinistra)
    this.chip.top = `${UI.safe.y + 72}px`;
    this.modifier.top = `${UI.safe.y + 118}px`;
    this.setScore(0, 0);
  }

  setScore(red: number, blue: number): void {
    if (!this.teamBar) return;
    this.teamBar.red.text = `${UI.team.red.label} ${UI.team.red.symbol}  ${red}`;
    this.teamBar.blue.text = `${blue}  ${UI.team.blue.symbol} ${UI.team.blue.label}`;
  }

  setTimer(seconds: number): void {
    if (!this.teamBar) return;
    const s = Math.max(0, Math.ceil(seconds));
    this.teamBar.timer.text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.teamBar.timer.color = s <= 10 ? UI.color.danger : UI.color.accent;
  }

  /** Riquadro centrale senza timer (es. Pallavolo: "A 5" = punti per vincere). */
  setCenter(text: string): void {
    if (!this.teamBar) return;
    this.teamBar.timer.text = text;
    this.teamBar.timer.color = UI.color.textDim;
  }

  /** Riga sotto la barra (MATCH POINT, GOLDEN GOAL, scambio...). */
  setNote(text: string, color: string = UI.color.danger): void {
    if (!this.teamBar) return;
    this.teamBar.note.text = text;
    this.teamBar.note.color = color;
  }

  // ---------------------------------------------------------------- striscia giocatori

  /** Striscia in basso: icona + nome + stato per ogni giocatore (solo giochi tutti-contro-tutti). */
  playerStrip(players: HudPlayer[]): void {
    const row = new StackPanel('playerStrip');
    row.isVertical = false;
    row.height = '56px';
    row.top = `${-UI.safe.y + 6}px`;
    row.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    const w = Math.min(230, Math.floor((1280 - UI.safe.x * 2) / Math.max(1, players.length)) - 10);
    for (const p of players) {
      const box = hudPanel(`ps_${p.id}`, `${w}px`, '52px', p.color);
      box.thickness = 2;
      box.paddingLeft = '5px';
      box.paddingRight = '5px';
      const src = p.characterId ? iconDataUrl(CHAR_ICONS[p.characterId]) : '';
      let icon: GuiImage | null = null;
      if (src) {
        icon = new GuiImage(`psIcon_${p.id}`, src);
        icon.width = '34px';
        icon.height = '34px';
        icon.left = '8px';
        icon.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        box.addControl(icon);
      }
      const name = hudText(`psName_${p.id}`, p.name.toUpperCase(), UI.size.XS + 2, p.color);
      name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      name.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      name.left = src ? '48px' : '10px';
      name.top = '-9px';
      name.width = `${w - (src ? 56 : 18)}px`;
      name.height = '22px';
      name.textWrapping = false;
      // nome lungo: si accorcia (una stima per carattere basta, niente misure a ogni frame)
      const maxChars = Math.max(4, Math.floor((w - (src ? 56 : 18)) / 12.5));
      if (p.name.length > maxChars) name.text = `${p.name.toUpperCase().slice(0, maxChars - 1)}…`;
      name.outlineWidth = 2;
      const status = hudText(`psStatus_${p.id}`, '', UI.size.XS, UI.color.textDim, false);
      status.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      status.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      status.left = name.left;
      status.top = '11px';
      status.width = name.width;
      status.height = '20px';
      status.outlineWidth = 0;
      box.addControl(name);
      box.addControl(status);
      row.addControl(box);
      this.strip.set(p.id, { box, name, status, icon });
    }
    this.adt.addControl(row);
  }

  setPlayerStatus(id: string, text: string, color: string = UI.color.textDim): void {
    const e = this.strip.get(id);
    if (!e) return;
    e.status.text = text;
    e.status.color = color;
  }

  /** Giocatore fuori: scheda spenta e barrata (forma + testo, non solo colore). */
  private out = new Set<string>();
  setPlayerOut(id: string, out: boolean, label = '✕ FUORI'): void {
    const e = this.strip.get(id);
    if (!e) return;
    if (out) this.out.add(id);
    else this.out.delete(id);
    e.box.alpha = out ? 0.55 : 1;
    if (out) this.setPlayerStatus(id, label, UI.color.danger);
  }

  /**
   * STATO DELL'ABILITA' del giocatore nella sua scheda (PRONTA / ATTIVA 4,2 s / RICARICA 6 s / ESAURITA): lo pubblica il gioco con
   * AbilityHub, qui si disegna soltanto. Simbolo + parola + colore, mai solo il colore. Un giocatore fuori mostra FUORI, non l'abilita'.
   */
  setAbility(id: string, s: AbilityStatus): void {
    if (this.out.has(id)) return;
    const color = s.state === 'READY' ? UI.color.success : s.state === 'ACTIVE' ? UI.color.accent : s.state === 'CHARGING' ? UI.color.info : s.state === 'COOLDOWN' ? UI.color.textDim : UI.color.muted;
    const mark = s.state === 'READY' ? '⚡' : s.state === 'ACTIVE' ? '⚡' : s.state === 'CHARGING' ? '⚡' : s.state === 'COOLDOWN' ? '⌛' : '✕';
    this.setPlayerStatus(id, `${mark} ${stateLabel(s)}`, color);
  }

  dispose(): void {
    for (const id of this.feedTimers) window.clearTimeout(id);
    this.feedTimers = [];
    this.adt.dispose();
  }
}
