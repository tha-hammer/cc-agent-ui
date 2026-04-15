import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  // Unmount any rendered React trees BEFORE vitest tears down jsdom, so
  // React's deferred commit work doesn't try to read `window` after it's
  // gone and crash with "window is not defined".
  cleanup();
});

// Node 25 ships a built-in localStorage (activated via --localstorage-file) that
// pre-empts jsdom's fully-featured Storage implementation. The Node built-in is
// surfaced here as an empty object without setItem/getItem/clear, which breaks
// anything that actually writes to storage. Force jsdom's Storage back on by
// constructing real Storage instances and assigning them to `window` + the
// global. Also reinstate Storage.prototype so vi.spyOn(Storage.prototype, …)
// works across tests.

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

// If the current localStorage doesn't expose the real Storage API, install one.
const hasRealStorage = (s: any): boolean =>
  s && typeof s.setItem === 'function' && typeof s.getItem === 'function' && typeof s.clear === 'function';

if (typeof window !== 'undefined') {
  if (!hasRealStorage((window as any).localStorage)) {
    const storage = new MemoryStorage();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: storage,
    });
  }
  if (!hasRealStorage((window as any).sessionStorage)) {
    const storage = new MemoryStorage();
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: storage,
    });
  }
}

if (!hasRealStorage((globalThis as any).localStorage)) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: (typeof window !== 'undefined' && (window as any).localStorage) || new MemoryStorage(),
  });
}
if (!hasRealStorage((globalThis as any).sessionStorage)) {
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: (typeof window !== 'undefined' && (window as any).sessionStorage) || new MemoryStorage(),
  });
}

// Force `Storage` global to alias MemoryStorage so `Storage.prototype` is the
// SAME prototype object that `localStorage` / `sessionStorage` instances
// delegate to — this is what lets `vi.spyOn(Storage.prototype, 'getItem')`
// actually intercept reads/writes.
(globalThis as any).Storage = MemoryStorage;
if (typeof window !== 'undefined') {
  (window as any).Storage = MemoryStorage;
}
