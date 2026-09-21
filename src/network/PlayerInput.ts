interface ButtonState {
  pressed: boolean;
  justPressed: boolean;
  justReleased: boolean;
}

/**
 * Stato di input di un singolo giocatore, indipendente dal device.
 * I minigiochi leggono i controlId che hanno dichiarato nel controllerLayout
 * (es. 'answerA', 'accelerate', 'action'). Non sanno se l'input arriva da
 * smartphone, tastiera o gamepad.
 */
export class PlayerInput {
  /**
   * SONDA DI DEBUG (solo con ?debug=1 / dev, la installa il GamepadManager): registra cosa il MINIGIOCO legge davvero da qui.
   * In produzione e' null: il costo per lettura e' un solo controllo.
   */
  static probe: ((owner: string, kind: 'axis' | 'justPressed', control: string, value: unknown) => void) | null = null;

  constructor(private readonly owner = '') {}

  private buttons = new Map<string, ButtonState>();
  private axes = new Map<string, { x: number; y: number }>();
  private texts = new Map<string, string>();

  /** Testo libero (es. bluff di CULTURA O CAZZATA). */
  setText(id: string, text: string): void {
    this.texts.set(id, text);
  }

  text(id: string): string {
    return this.texts.get(id) ?? '';
  }

  /** Azzera un testo libero (es. all'inizio di ogni round, così non resta il testo del round prima). */
  clearText(id: string): void {
    this.texts.delete(id);
  }

  setDown(id: string): void {
    const b = this.ensure(id);
    if (!b.pressed) {
      b.pressed = true;
      b.justPressed = true;
    }
  }

  setUp(id: string): void {
    const b = this.ensure(id);
    if (b.pressed) {
      b.pressed = false;
      b.justReleased = true;
    }
  }

  tap(id: string): void {
    this.setDown(id);
    this.setUp(id);
  }

  setAxis(id: string, x: number, y: number): void {
    this.axes.set(id, { x, y });
  }

  pressed(id: string): boolean {
    return this.buttons.get(id)?.pressed ?? false;
  }

  justPressed(id: string): boolean {
    const v = this.buttons.get(id)?.justPressed ?? false;
    if (v && PlayerInput.probe) PlayerInput.probe(this.owner, 'justPressed', id, true);
    return v;
  }

  /** Lettura SENZA sonda (per l'overlay di debug: guardare non deve contare come "il gioco ha letto"). */
  peekAxis(id: string): { x: number; y: number } {
    return this.axes.get(id) ?? { x: 0, y: 0 };
  }

  peekPressed(id: string): boolean {
    return this.buttons.get(id)?.pressed ?? false;
  }

  justReleased(id: string): boolean {
    return this.buttons.get(id)?.justReleased ?? false;
  }

  axis(id: string): { x: number; y: number } {
    const v = this.axes.get(id) ?? { x: 0, y: 0 };
    if (PlayerInput.probe) PlayerInput.probe(this.owner, 'axis', id, v);
    return v;
  }

  /** Azione generica "primo tasto": comoda per giochi a un solo comando. */
  anyJustPressed(): string | null {
    for (const [id, b] of this.buttons) {
      if (b.justPressed) return id;
    }
    return null;
  }

  /** Da chiamare a fine frame per azzerare gli edge justPressed/justReleased. */
  clearFrame(): void {
    for (const b of this.buttons.values()) {
      b.justPressed = false;
      b.justReleased = false;
    }
  }

  /** Rilascia forzatamente tutti i tasti (es. il telefono si è disconnesso a metà pressione). */
  releaseAll(): void {
    for (const b of this.buttons.values()) {
      if (b.pressed) {
        b.pressed = false;
        b.justReleased = true;
      }
    }
    this.axes.clear();
  }

  private ensure(id: string): ButtonState {
    let b = this.buttons.get(id);
    if (!b) {
      b = { pressed: false, justPressed: false, justReleased: false };
      this.buttons.set(id, b);
    }
    return b;
  }
}
