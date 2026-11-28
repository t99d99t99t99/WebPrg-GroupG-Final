import { storage, withWriteLock } from "./storage.js";

// Map look settings shown in the settings panel. One object under one key; fields the panel adds
// later go next to these. Missing or unknown values fall back to the defaults below.
export const DECORATION_DENSITIES = ["low", "normal", "high"];
export const DEFAULT_EMPTY_SPACE_FILL = Object.freeze({
    mode: "tile",
    colorMode: "solid",
    solidColor: "#d7e9c8",
    gradientStart: "#d7e9c8",
    gradientEnd: "#b7d6f2",
    angle: 90,
    photoDataUrl: "",
});
// Every app the Google Service launcher can show, in the order "추가 앱" lists them. The launcher
// shows nine of them; the first nine are the default.
export const GOOGLE_LAUNCHER_APPS = Object.freeze([
    "account",
    "search",
    "maps",
    "play",
    "news",
    "gmail",
    "drive",
    "meet",
    "contacts",
    "youtube",
    "gemini",
    "calendar",
    "photos",
    "translate",
    "vids",
    "sheets",
    "docs",
    "slides",
    "one",
    "shopping",
    "store",
    "finance",
    "keep",
    "ad-center",
    "classroom",
    "chat",
    "earth",
]);
export const GOOGLE_LAUNCHER_SIZE = 9;
export const DEFAULT_SETTINGS = Object.freeze({
    decorationDensity: "normal",
    cityAnimation: true,
    openInNewTab: true,
    emptySpaceFill: DEFAULT_EMPTY_SPACE_FILL,
    googleLauncher: Object.freeze(GOOGLE_LAUNCHER_APPS.slice(0, GOOGLE_LAUNCHER_SIZE)),
});

const hexColor = (value) => typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
const fillValidators = {
    mode: (value) => ["none", "color", "photo", "tile"].includes(value),
    colorMode: (value) => ["solid", "gradient"].includes(value),
    solidColor: hexColor,
    gradientStart: hexColor,
    gradientEnd: hexColor,
    angle: (value) => Number.isInteger(value) && value >= 0 && value <= 360,
    photoDataUrl: (value) =>
        typeof value === "string" &&
        (value === "" || /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)),
};

const validators = {
    googleLauncher: (value) =>
        Array.isArray(value) &&
        value.length === GOOGLE_LAUNCHER_SIZE &&
        new Set(value).size === GOOGLE_LAUNCHER_SIZE &&
        value.every((id) => GOOGLE_LAUNCHER_APPS.includes(id)),
    decorationDensity: (value) => DECORATION_DENSITIES.includes(value),
    cityAnimation: (value) => typeof value === "boolean",
    openInNewTab: (value) => typeof value === "boolean",
    emptySpaceFill: (value) =>
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.entries(value).every(([field, item]) => fillValidators[field]?.(item)) &&
        Object.keys(fillValidators).every((field) => fillValidators[field](value[field])),
};

function withDefaults(saved) {
    const settings = { ...DEFAULT_SETTINGS, emptySpaceFill: { ...DEFAULT_EMPTY_SPACE_FILL } };
    if (saved && typeof saved === "object") {
        for (const [field, valid] of Object.entries(validators))
            if (valid(saved[field])) settings[field] = field === "emptySpaceFill" ? { ...saved[field] } : saved[field];
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
