// Chrome and web preview share the same DB interface and data shape.
const listeners = new Set();
const isExtension = Boolean(globalThis.chrome?.storage?.local);

export const storage = isExtension
    ? chrome.storage.local
    : {
          async get(defaults) {
              const keys = Array.isArray(defaults) ? defaults : Object.keys(defaults);
              const result = Array.isArray(defaults) ? {} : { ...defaults };
              for (const key of keys) {
                  const raw = localStorage.getItem(key);
                  if (raw !== null) result[key] = JSON.parse(raw);
              }
              return result;
          },
          async set(values) {
              const changes = {};
              for (const [key, value] of Object.entries(values)) {
                  const oldValue = JSON.parse(localStorage.getItem(key) ?? "null");
                  localStorage.setItem(key, JSON.stringify(value));
                  changes[key] = { oldValue, newValue: value };
              }
              for (const listener of listeners) listener(changes);
          },
      };

if (isExtension) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") for (const listener of listeners) listener(changes);
    });
} else {
    window.addEventListener("storage", (event) => {
        if (event.storageArea !== localStorage) return;
        const changes = event.key ? { [event.key]: { newValue: event.newValue } } : {};
        for (const listener of listeners) listener(changes);
    });
}

export function subscribeStorage(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

// All read/modify/write operations use the same lock, including map planning.
let writeQueue = Promise.resolve();
export function withWriteLock(action) {
    if (globalThis.navigator?.locks) return navigator.locks.request("webprg-bookmarkmap-data", action);
    const next = writeQueue.then(action, action);
    writeQueue = next.catch(() => {});
    return next;
}
