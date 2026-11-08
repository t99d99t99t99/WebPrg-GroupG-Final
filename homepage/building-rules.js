// Pure appearance rules: bookmark family and variation, visit-count growth, disrepair.
const BUILDING_DIR = "../assets/Isometric City/Buildings/";

export const BUILDING_FAMILIES = [
    { id: "blue-homes", name: "도심 주택", stages: [["house_small_blue"], ["house_medium_blue"], ["house_tall_blue"]] },
    {
        id: "light-brick-homes",
        name: "밝은 벽돌 주택",
        stages: [["house_small_brickred"], ["house_medium_brickwhite"], ["house_tall_brickwhite"]],
    },
    {
        id: "garden-homes",
        name: "정원 주택",
        stages: [["house_small_yellow"], ["house_medium_white"], ["house_tall_green"]],
    },
    { id: "food-market", name: "먹거리 상점", stages: [["fruitstand"], ["cafe", "icecream"], ["pizza"]] },
    { id: "service-market", name: "생활 상점", stages: [["clinic"], ["autoshop"], ["gunshop"]] },
];

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

export function buildingTexture(clickCount = 0, bookmarkId = "", damaged = false) {
    const stage = clickCount >= 15 ? 2 : clickCount >= 5 ? 1 : 0;
    const identity = identityHash(bookmarkId);
    const family = BUILDING_FAMILIES[identity % BUILDING_FAMILIES.length];
    const variation = Math.floor(identity / BUILDING_FAMILIES.length);
    const variant = variation % 2 === 0 ? "a" : "b";
    const pool = family.stages[stage];
    const form = pool[Math.floor(variation / 2) % pool.length];
    return {
        src: `${BUILDING_DIR}bld_${form}_${variant}${damaged ? "_damaged" : ""}.png`,
        size: ["small", "medium", "tall"][stage],
        family: family.id,
        variant,
        damaged,
    };
}
