// Pure appearance rules: category family, bookmark variation, visit-count growth, disrepair.
const BUILDING_DIR = "../assets/Isometric City/Buildings/";

export const BUILDING_FAMILIES = [
    { id: "blue-homes", name: "도심 주택", stages: [["house_small_blue"], ["house_medium_blue"], ["house_tall_blue"]] },
    {
        id: "light-brick-homes",
        name: "밝은 벽돌 주택",
        stages: [["house_small_brickred"], ["house_medium_brickwhite"], ["house_tall_brickwhite"]],
    },
    {
        id: "warm-brick-homes",
        name: "갈색 벽돌 주택",
        stages: [["house_small_brickbrown"], ["house_medium_brown"], ["house_tall_brown", "house_tall_brickbrown"]],
    },
    {
        id: "garden-homes",
        name: "정원 주택",
        stages: [
            ["house_small_red", "house_small_yellow", "house_small_purple"],
            ["house_medium_green", "house_medium_white"],
            ["house_tall_green", "house_tall_purple"],
        ],
    },
    { id: "food-market", name: "먹거리 상점", stages: [["fruitstand"], ["cafe", "icecream"], ["pizza"]] },
    { id: "service-market", name: "생활 상점", stages: [["clinic"], ["autoshop"], ["gunshop"]] },
];

function identityHash(id) {
    return [...String(id)].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
}

export function assignBuildingFamilies(categories) {
    const usage = new Map(BUILDING_FAMILIES.map((family) => [family.id, 0]));
    for (const category of categories) {
        if (usage.has(category.buildingFamily))
            usage.set(category.buildingFamily, usage.get(category.buildingFamily) + 1);
    }
    const changes = new Map();
    const missing = categories
        .filter((category) => !usage.has(category.buildingFamily))
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || String(a.id).localeCompare(String(b.id), "en"));
    for (const category of missing) {
        const leastUsed = Math.min(...usage.values());
        const offset = identityHash(category.id) % BUILDING_FAMILIES.length;
        const ordered = BUILDING_FAMILIES.map(
            (_, index) => BUILDING_FAMILIES[(index + offset) % BUILDING_FAMILIES.length],
        );
        const id = ordered.find((family) => usage.get(family.id) === leastUsed).id;
        changes.set(category.id, id);
        usage.set(id, usage.get(id) + 1);
    }
    return {
        categories: categories.map((category) =>
            changes.has(category.id) ? { ...category, buildingFamily: changes.get(category.id) } : category,
        ),
        changes,
    };
}

// A building falls into disrepair after a week without a visit from the map.
// Bookmarks never visited count from when they were saved.
export const DAMAGE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function isDamaged(bookmark, now = Date.now()) {
    const lastSeen = Number.isFinite(bookmark.lastVisitedAt) ? bookmark.lastVisitedAt : bookmark.savedAt;
    return Number.isFinite(lastSeen) && now - lastSeen >= DAMAGE_AFTER_MS;
}

export function buildingTexture(clickCount = 0, familyId = "blue-homes", bookmarkId = "", damaged = false) {
    const stage = clickCount >= 15 ? 2 : clickCount >= 5 ? 1 : 0;
    const family = BUILDING_FAMILIES.find((item) => item.id === familyId) ?? BUILDING_FAMILIES[0];
    const identity = identityHash(bookmarkId);
    const variant = identity % 2 === 0 ? "a" : "b";
    const pool = family.stages[stage];
    const form = pool[Math.floor(identity / 2) % pool.length];
    return {
        src: `${BUILDING_DIR}bld_${form}_${variant}${damaged ? "_damaged" : ""}.png`,
        size: ["small", "medium", "tall"][stage],
        family: family.id,
        variant,
        damaged,
    };
}
