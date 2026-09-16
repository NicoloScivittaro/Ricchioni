/** Generatore pseudo-casuale seedable (mulberry32), deterministico e condiviso. */
export class Rng {
  private state: number;

  constructor(seed = Math.floor(Math.random() * 0xffffffff)) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  weighted<T>(items: readonly { item: T; weight: number }[]): T {
    const total = items.reduce((s, x) => s + Math.max(0, x.weight), 0);
    if (total <= 0) return items[0].item;
    let r = this.next() * total;
    for (const x of items) {
      r -= Math.max(0, x.weight);
      if (r <= 0) return x.item;
    }
    return items[items.length - 1].item;
  }
}
