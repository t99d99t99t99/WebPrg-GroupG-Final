import { storage, withWriteLock } from "./storage.js";

// Map look settings shown in the settings panel. One object under one key; fields the panel adds
// later go next to these. Missing or unknown values fall back to the defaults below.
export const DECORATION_DENSITIES = ["low", "normal", "high"];
export const DEFAULT_SETTINGS = Object.freeze({ decorationDensity: "normal" });

const validators = {
    decorationDensity: (value) => DECORATION_DENSITIES.includes(value),
};

function withDefaults(saved) {
    const settings = { ...DEFAULT_SETTINGS };
    if (saved && typeof saved === "object") {
        for (const [field, valid] of Object.entries(validators))
            if (valid(saved[field])) settings[field] = saved[field];
    }
    return settings;
}

export class SettingsDB {
    constructor(_key, initialized = Promise.resolve()) {
        this.key = _key;
        this.ready = initialized;
    }

    async get() {
        await this.ready;
        const data = await storage.get({ [this.key]: null });
        return withDefaults(data[this.key]);
    }

    // Saves the given fields (other saved fields stay) and returns the full settings.
    async edit(changes) {
        await this.ready;
        for (const [field, value] of Object.entries(changes ?? {})) {
            if (!validators[field]) throw new TypeError(`알 수 없는 설정입니다: ${field}`);
            if (!validators[field](value)) throw new TypeError(`올바르지 않은 설정값입니다: ${field}`);
        }
        return withWriteLock(async () => {
            const data = await storage.get({ [this.key]: null });
            const saved = data[this.key] && typeof data[this.key] === "object" ? data[this.key] : {};
            const next = { ...saved, ...changes };
            await storage.set({ [this.key]: next });
            return withDefaults(next);
        });
    }
}
