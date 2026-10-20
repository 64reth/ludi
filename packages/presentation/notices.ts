import type { Clock } from "./index";
import type { EventTone } from "../game-engine/events";
export type Notice = {
  id: string;
  round?: number;
  text: string;
  tone: EventTone;
  topic?: string;
};
export const noticeDuration = (tone: EventTone) =>
  ({ ordinary: 4000, war: 6000, significant: 8000, critical: 0 })[tone];
const clock: Clock = {
  now: () => Date.now(),
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};
export class NoticeQueue {
  private value: { current?: Notice; waiting: number; history: Notice[] } = {
    waiting: 0,
    history: [],
  };
  private pending: Notice[] = [];
  private seen = new Set<string>();
  private listeners = new Set<() => void>();
  private timer: unknown;
  private left = 0;
  private began = 0;
  private held = false;
  constructor(private time: Clock = clock) {}
  snapshot = () => this.value;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private emit() {
    this.value = { ...this.value, waiting: this.pending.length };
    for (const fn of this.listeners) fn();
  }
  private clear() {
    if (this.timer !== undefined) this.time.clear(this.timer);
    this.timer = undefined;
  }
  reset(items: Notice[] = []) {
    this.clear();
    this.pending = [];
    this.seen = new Set(items.map((n) => n.id));
    this.value = {
      waiting: 0,
      history: items.filter((n) => n.tone !== "ordinary").slice(-100),
    };
    const latest = items.filter((n) => n.tone !== "ordinary").at(-1);
    if (latest) this.show(latest);
    else this.emit();
  }
  receive(items: Notice[]) {
    for (const n of items) {
      if (this.seen.has(n.id)) continue;
      this.seen.add(n.id);
      if (this.seen.size > 600) this.seen = new Set([...this.seen].slice(-300));
      const repeat = this.value.history
        .slice(-6)
        .some(
          (h) =>
            h.text === n.text && h.topic === n.topic && h.round === n.round,
        );
      if (repeat && n.topic === "selection") continue;
      if (n.tone !== "ordinary")
        this.value = {
          ...this.value,
          history: [...this.value.history, n].slice(-100),
        };
      if (n.topic === "lock")
        this.pending = this.pending.filter((p) => p.topic !== "lock");
      if (n.topic === "lock" && this.value.current?.topic === "lock") {
        this.pending = this.pending.filter((p) => p.topic !== "lock");
        this.show(n);
        continue;
      }
      if (!this.value.current) {
        this.show(n);
        continue;
      }
      if (n.tone === "ordinary") {
        if (
          this.value.current.tone === "ordinary" &&
          !this.pending.some((p) => p.tone !== "ordinary")
        ) {
          this.pending = [n];
          this.emit();
        }
        continue;
      }
      this.pending = this.pending.filter((p) => p.tone !== "ordinary");
      this.pending.push(n);
      if (this.pending.length > 8) {
        const remove = this.pending.findIndex((p) => p.tone !== "critical");
        this.pending.splice(remove < 0 ? 0 : remove, 1);
      }
      this.emit();
    }
  }
  private show(n: Notice) {
    this.clear();
    this.value = { ...this.value, current: n };
    this.left = noticeDuration(n.tone);
    this.arm();
    this.emit();
  }
  private arm() {
    if (
      this.held ||
      !this.value.current ||
      noticeDuration(this.value.current.tone) === 0
    )
      return;
    this.began = this.time.now();
    this.timer = this.time.set(() => {
      this.timer = undefined;
      this.dismiss();
    }, this.left);
  }
  dismiss = () => {
    this.clear();
    const next = this.pending.shift();
    if (next) this.show(next);
    else {
      this.value = { ...this.value, current: undefined };
      this.emit();
    }
  };
  pause = (held: boolean) => {
    if (held === this.held) return;
    if (held) {
      if (this.timer !== undefined)
        this.left = Math.max(0, this.left - (this.time.now() - this.began));
      this.clear();
    }
    this.held = held;
    if (!held) this.arm();
  };
  dispose = () => {
    this.clear();
  };
}
