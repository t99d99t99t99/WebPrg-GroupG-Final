import { BUILDING_FAMILIES, buildingDesignById } from "../shared/building-designs.js";

export { BUILDING_FAMILIES } from "../shared/building-designs.js";

// Pure appearance rules: bookmark family and variation, visit-count growth, disrepair.
const BUILDING_DIR = "../assets/Isometric City/Buildings/";

function identityHash(id) {
    return [...String(id)].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
}

// A building falls into disrepair after a week without a visit from the map.
// Bookmarks never visited count from when they were saved.
export const DAMAGE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function isDamaged(bookmark, now = Date.now()) {
    const lastSeen = Number.isFinite(bookmark.lastVisitedAt) ? bookmark.lastVisitedAt : bookmark.savedAt;
    return Number.isFinite(lastSeen) && now - lastSeen >= DAMAGE_AFTER_MS;
}

export function buildingTexture(clickCount = 0, bookmarkId = "", damaged = false, designId) {
    const design = buildingDesignById(designId);
    const stage = Math.max(clickCount >= 15 ? 2 : clickCount >= 5 ? 1 : 0, design?.stage ?? 0);
    const identity = identityHash(bookmarkId);
    const family = design
        ? BUILDING_FAMILIES.find((item) => item.id === design.family)
        : BUILDING_FAMILIES[identity % BUILDING_FAMILIES.length];
    const variation = Math.floor(identity / BUILDING_FAMILIES.length);
    const variant = design?.variant ?? (variation % 2 === 0 ? "a" : "b");
    const pool = family.stages[stage];
    const form = design && stage === design.stage ? design.form : pool[Math.floor(variation / 2) % pool.length];
    return {
        src: `${BUILDING_DIR}bld_${form}_${variant}${damaged ? "_damaged" : ""}.png`,
        size: ["small", "medium", "tall"][stage],
        family: family.id,
        variant,
        damaged,
    };
}
