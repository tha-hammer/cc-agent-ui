import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// Same Node 25 localStorage workaround cc-agent-ui/tests/setup.ts uses.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, String(value)); }
}

const hasRealStorage = (s: unknown): boolean =>
  !!s && typeof (s as Storage).setItem === 'function' && typeof (s as Storage).getItem === 'function';

if (typeof window !== 'undefined') {
  if (!hasRealStorage((window as { localStorage?: unknown }).localStorage)) {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new MemoryStorage() });
  }
  if (!hasRealStorage((window as { sessionStorage?: unknown }).sessionStorage)) {
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: new MemoryStorage() });
  }
}
if (!hasRealStorage((globalThis as { localStorage?: unknown }).localStorage)) {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: (typeof window !== 'undefined' && (window as unknown as { localStorage: Storage }).localStorage) || new MemoryStorage(),
  });
}
if (!hasRealStorage((globalThis as { sessionStorage?: unknown }).sessionStorage)) {
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: (typeof window !== 'undefined' && (window as unknown as { sessionStorage: Storage }).sessionStorage) || new MemoryStorage(),
  });
}
(globalThis as { Storage?: unknown }).Storage = MemoryStorage;
if (typeof window !== 'undefined') {
  (window as unknown as { Storage: unknown }).Storage = MemoryStorage;
}
