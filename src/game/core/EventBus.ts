// ============================================================
// EventBus سبک برای ارتباط سیستم‌های بازی
// ============================================================

type Handler = (...args: unknown[]) => void;

export class EventBus {
  private map = new Map<string, Set<Handler>>();

  on(event: string, fn: Handler): () => void {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event)!.add(fn);
    return () => this.off(event, fn);
  }

  off(event: string, fn: Handler) {
    this.map.get(event)?.delete(fn);
  }

  emit(event: string, ...args: unknown[]) {
    this.map.get(event)?.forEach((fn) => {
      try {
        fn(...args);
      } catch (e) {
        console.error(`[EventBus] ${event}`, e);
      }
    });
  }

  clear() {
    this.map.clear();
  }
}
