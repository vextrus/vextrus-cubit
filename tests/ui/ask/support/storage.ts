/**
 * A tab store the suite holds — the `Storage` S-Ask keeps its thread in (I-403), in memory, so a
 * suite can seed a kept thread and read back what the screen wrote without a browser.
 */
export function memoryStorage(): Storage {
  const held = new Map<string, string>();
  return {
    get length() {
      return held.size;
    },
    clear: () => held.clear(),
    getItem: (key) => held.get(key) ?? null,
    key: (index) => [...held.keys()][index] ?? null,
    removeItem: (key) => void held.delete(key),
    setItem: (key, value) => void held.set(key, value),
  };
}
