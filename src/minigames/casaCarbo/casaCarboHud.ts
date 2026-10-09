import { Control, Image as GuiImage, Rectangle, TextBlock } from '@babylonjs/gui';
import type { Scene, TransformNode } from '@babylonjs/core';
import { GameHud, hudPanel, hudText } from '../hud/hudKit';
import { UI } from '../../core/uiTokens';
import { CHAR_ICONS, iconDataUrl } from '../../../shared/charIcons';
import { stateLabel } from '../../../shared/abilityCatalog';
import type { AbilityStatus } from '../../../shared/abilityCatalog';

/**
 * HUD di CASA CARBO (kit comune hud/hudKit.ts):
 *  - in alto al centro: TIMER e barra CASA ASCIUTTA con la tacca del 75% (obiettivo comune)
 *  - a destra: classifica provvisoria dei contributi (icona, nome, punti, stato dell'abilita')
 *  - sopra ogni personaggio: livello del secchio e, quando serve, cosa sta facendo (CONTENGO, SBLOCCO 60%...)
 * Gli annunci del temporale usano il banner del kit, spostato in alto per non coprire la casa.
 */

export interface CCHudPlayer {
  id: string;
  label: string;
  characterId: string | null;
  color: string;
}

interface Row {
  box: Rectangle;
  pts: TextBlock;
  status: TextBlock;
  name: TextBlock;
}

interface Tag {
  root: Rectangle;
  fill: Rectangle;
  text: TextBlock;
}

export class CasaCarboHud extends GameHud {
  private timer: TextBlock;
  private dryText: TextBlock;
  private dryFill: Rectangle;
  private dryBar: Rectangle;
  private rows = new Map<string, Row>();
  private tags = new Map<string, Tag>();
  private sayBox: Rectangle;
  private sayWho: TextBlock;
  private sayText: TextBlock;
  private sayT = 0;
  private ending = false;

  constructor(scene: Scene) {
    super(scene, 'casaCarboHud', '🌧️ CASA CARBO');
    const top = hudPanel('ccTop', '280px', '86px', 'rgba(255,255,255,0.2)');
    top.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    top.top = `${UI.safe.y - 8}px`;
    this.adt.addControl(top);
    this.timer = hudText('ccTimer', '2:00', UI.size.L, UI.color.accent);
    this.timer.top = '-16px';
    this.timer.height = '46px';
    top.addControl(this.timer);
    this.dryBar = new Rectangle('ccDryBar');
    this.dryBar.width = '256px';
    this.dryBar.height = '20px';
    this.dryBar.top = '24px';
    this.dryBar.thickness = 2;
    this.dryBar.color = 'rgba(255,255,255,0.5)';
    this.dryBar.background = 'rgba(20,40,70,0.9)';
    this.dryBar.cornerRadius = 8;
    top.addControl(this.dryBar);
    this.dryFill = new Rectangle('ccDryFill');
    this.dryFill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.dryFill.width = '100%';
    this.dryFill.thickness = 0;
    this.dryFill.background = UI.color.success;
    this.dryBar.addControl(this.dryFill);
    const mark = new Rectangle('ccDryMark');
    mark.width = '3px';
    mark.height = '100%';
    mark.thickness = 0;
    mark.background = '#ffffff';
    mark.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    mark.left = `${Math.round(256 * 0.75) - 1}px`;
    this.dryBar.addControl(mark);
    this.dryText = hudText('ccDryText', 'ASCIUTTA 100%', UI.size.XS, UI.color.text);
    this.dryText.top = '24px';
    this.dryText.height = '22px';
    this.dryText.outlineWidth = 3;
    top.addControl(this.dryText);

    this.chip.isVisible = false; // il nome del gioco lo dice gia' la casa: spazio alla classifica
    this.feed.top = `${UI.safe.y + 92}px`;

    // battute del finale (vicino / Carbo): fumetto in basso, sopra il giardino, senza coprire banner e titoli
    this.sayBox = hudPanel('ccSay', '1040px', '104px', 'rgba(255,255,255,0.35)');
    this.sayBox.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    this.sayBox.top = `${-UI.safe.y}px`;
    this.sayBox.isVisible = false;
    this.adt.addControl(this.sayBox);
    this.sayWho = hudText('ccSayWho', '', UI.size.S, UI.color.textDim);
    this.sayWho.top = '-30px';
    this.sayWho.height = '28px';
    this.sayBox.addControl(this.sayWho);
    this.sayText = hudText('ccSayText', '', 34, UI.color.text);
    this.sayText.top = '12px';
    this.sayText.height = '60px';
    this.sayText.textWrapping = true;
    this.sayText.width = '1000px';
    this.sayBox.addControl(this.sayText);
    scene.onBeforeRenderObservable.add(() => {
      this.feed.isVisible = this.ending || !this.bannerBox.isVisible; // urgent announcements must not overlap the contribution feed
      if (this.sayT <= 0) return;
      this.sayT -= scene.getEngine().getDeltaTime();
      if (this.sayT <= 0) this.sayBox.isVisible = false;
    });
  }

  /** Battuta di un personaggio (finale): chi parla in piccolo, la frase grande, in basso. */
  say(who: string, text: string, color: string, ms = 2200): void {
    this.sayWho.text = who;
    this.sayText.text = text;
    this.sayText.color = color;
    this.sayBox.color = color;
    this.sayBox.isVisible = true;
    this.sayT = ms;
  }

  /** Finale: i titoli comici scendono sotto il banner dell'esito (che resta su fino alla fine). */
  endingLayout(): void {
    this.ending = true;
    this.feed.top = `${UI.safe.y + 200}px`;
  }

  /** Annuncio del temporale: in alto, sotto il timer (la casa resta visibile). */
  announce(text: string, sub = '', color = '#fbbf24', ms = 1600, size = 64): void {
    this.banner(text, sub, color, ms, Math.min(size, 34), -206);
    this.bannerBox.height = '90px';
    this.bannerText.top = '-14px';
    this.bannerSub.top = '20px';
    this.bannerSub.fontSize = UI.size.XS;
  }

  setTime(sec: number): void {
    const s = Math.max(0, Math.ceil(sec));
    this.timer.text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.timer.color = s <= 10 ? UI.color.danger : UI.color.accent;
  }

  setDry(f: number): void {
    const p = Math.round(f * 100);
    this.dryFill.width = `${Math.max(0, Math.min(100, p))}%`;
    this.dryFill.background = f >= 0.75 ? UI.color.success : f >= 0.6 ? UI.color.warning : UI.color.danger;
    this.dryText.text = `ASCIUTTA ${p}% · SERVE 75%`;
  }

  buildBoard(list: CCHudPlayer[]): void {
    for (const p of list) {
      const box = hudPanel(`ccRow_${p.id}`, '148px', '60px', p.color);
      box.thickness = 2;
      box.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
      box.top = `${UI.safe.y - 6}px`;
      const src = p.characterId ? iconDataUrl(CHAR_ICONS[p.characterId]) : '';
      if (src) {
        const icon = new GuiImage(`ccIcon_${p.id}`, src);
        icon.width = '24px';
        icon.height = '24px';
        icon.left = '5px';
        icon.top = '-10px';
        icon.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        box.addControl(icon);
      }
      const name = hudText(`ccName_${p.id}`, p.label, UI.size.XS, p.color);
      name.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      name.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      name.left = '32px';
      name.top = '-10px';
      name.width = '78px';
      name.height = '22px';
      name.outlineWidth = 2;
      box.addControl(name);
      const pts = hudText(`ccPts_${p.id}`, '0', 26, UI.color.text);
      pts.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      pts.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      pts.left = '-5px';
      pts.top = '-10px';
      pts.width = '40px';
      pts.height = '30px';
      box.addControl(pts);
      const status = hudText(`ccStatus_${p.id}`, '', 13, UI.color.textDim, false);
      status.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      status.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
      status.left = '6px';
      status.top = '15px';
      status.width = '138px';
      status.height = '18px';
      status.outlineWidth = 0;
      box.addControl(status);
      this.adt.addControl(box);
      this.rows.set(p.id, { box, pts, status, name });
    }
  }

  /** Classifica provvisoria: i chip si dispongono ai lati del timer in ordine di contributo (1° a sinistra vicino al timer). */
  setBoard(entries: { id: string; pts: number; status: AbilityStatus | null }[]): void {
    const SLOTS = [-216, 216, -366, 366, 516];
    const sorted = [...entries].sort((a, b) => b.pts - a.pts);
    sorted.forEach((e, i) => {
      const r = this.rows.get(e.id);
      if (r) r.box.left = `${SLOTS[i] ?? 0}px`;
    });
    for (const e of entries) {
      const r = this.rows.get(e.id);
      if (!r) continue;
      r.pts.text = `${Math.round(e.pts)}`;
      if (e.status) {
        const mark = e.status.state === 'SPENT' ? '✕' : e.status.state === 'COOLDOWN' ? '⌛' : '⚡';
        r.status.text = `${mark} ${stateLabel(e.status)}`;
        r.status.color = e.status.state === 'READY' ? UI.color.success : e.status.state === 'ACTIVE' || e.status.state === 'CHARGING' ? UI.color.accent : UI.color.muted;
      }
    }
  }

  /** Etichetta sopra il personaggio: livello del secchio (0..1, oltre 1 = secchio doppio di Ciro) e azione in corso. */
  attachTag(id: string, node: TransformNode, color: string): void {
    const root = new Rectangle(`ccTag_${id}`);
    root.width = '64px';
    root.height = '12px';
    root.thickness = 2;
    root.color = '#ffffff';
    root.background = 'rgba(10,20,40,0.75)';
    root.cornerRadius = 5;
    root.isVisible = false;
    this.adt.addControl(root);
    root.linkWithMesh(node);
    root.linkOffsetY = -86;
    const fill = new Rectangle(`ccTagFill_${id}`);
    fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    fill.thickness = 0;
    fill.background = '#4fb3ff';
    fill.width = '0%';
    root.addControl(fill);
    const text = hudText(`ccTagText_${id}`, '', UI.size.XS, color, true);
    text.resizeToFit = true;
    text.outlineWidth = 3;
    text.isVisible = false;
    this.adt.addControl(text);
    text.linkWithMesh(node);
    text.linkOffsetY = -108;
    this.tags.set(id, { root, fill, text });
  }

  setTag(id: string, bucket: number, label: string): void {
    const t = this.tags.get(id);
    if (!t) return;
    const show = bucket > 0.02;
    if (t.root.isVisible !== show) t.root.isVisible = show;
    if (show) {
      t.fill.width = `${Math.round(Math.min(1, bucket) * 100)}%`;
      t.fill.background = bucket > 1 ? '#f472b6' : '#4fb3ff';
      t.root.color = bucket > 1 ? '#f472b6' : '#ffffff';
    }
    t.text.isVisible = !!label;
    if (label) t.text.text = label;
  }
}
