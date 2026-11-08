import { createDemoData } from "../demo/seed-data.js";
import { BookmarkDB } from "./bookmark.js";
import { CategoryDB } from "./category.js";
import { storage, subscribeStorage, withWriteLock } from "./storage.js";

const BOOKMARK_DB_KEY = "webprg-bookmarkmap-bookmarks";
const CATEGORY_DB_KEY = "webprg-bookmarkmap-categories";

// Seed only a new demo installation; an existing empty array is also user data.
async function initializeDemo() {
    const existing = await storage.get([BOOKMARK_DB_KEY, CATEGORY_DB_KEY]);
    if (existing[BOOKMARK_DB_KEY] === undefined && existing[CATEGORY_DB_KEY] === undefined) {
        const demo = createDemoData();
        await storage.set({ [BOOKMARK_DB_KEY]: demo.bookmarks, [CATEGORY_DB_KEY]: demo.categories });
    }
}

export const ready = globalThis.navigator?.locks
    ? navigator.locks.request("webprg-bookmarkmap-initialize", initializeDemo)
    : initializeDemo();

export const bookmarks = new BookmarkDB(BOOKMARK_DB_KEY, ready, CATEGORY_DB_KEY);
export const categories = new CategoryDB(CATEGORY_DB_KEY, ready);

// Saves planned map positions (category `area`, bookmark `cell`) in one write so
// both arrays stay in step. Only the given ids change; other fields are kept.
export async function saveLayout(areas, cells) {
    await ready;
    return withWriteLock(async () => {
        await ready;
        const data = await storage.get({ [BOOKMARK_DB_KEY]: [], [CATEGORY_DB_KEY]: [] });
        const savedCategories = data[CATEGORY_DB_KEY].map((category) =>
            areas.has(category.id) ? { ...category, area: areas.get(category.id) } : category,
        );
        const savedBookmarks = data[BOOKMARK_DB_KEY].map((bookmark) =>
            cells.has(bookmark.id) ? { ...bookmark, cell: cells.get(bookmark.id) } : bookmark,
        );
        await storage.set({ [BOOKMARK_DB_KEY]: savedBookmarks, [CATEGORY_DB_KEY]: savedCategories });
    });
}

export async function saveCategoryColors(colors) {
    await ready;
    return withWriteLock(async () => {
        await ready;
        const data = await storage.get({ [CATEGORY_DB_KEY]: [] });
        const savedCategories = data[CATEGORY_DB_KEY].map((category) =>
            colors.has(category.id) ? { ...category, color: colors.get(category.id) } : category,
        );
        await storage.set({ [CATEGORY_DB_KEY]: savedCategories });
    });
}

export function subscribe(listener) {
    return subscribeStorage((changes) => {
        if (Object.keys(changes).length === 0 || BOOKMARK_DB_KEY in changes || CATEGORY_DB_KEY in changes)
            listener(changes);
    });
}

export async function updateCity(planner) {
    await ready;
    return withWriteLock(async () => {
        const data = await storage.get({ [BOOKMARK_DB_KEY]: [], [CATEGORY_DB_KEY]: [] });
        const result = planner(data[CATEGORY_DB_KEY], data[BOOKMARK_DB_KEY]);
        const { areas, cells } = result.plan.changed;
        const families = result.families ?? new Map();
        if (areas.size || cells.size || result.colors.size || families.size) {
            await storage.set({
                [CATEGORY_DB_KEY]: data[CATEGORY_DB_KEY].map((item) => ({
                    ...item,
                    ...(areas.has(item.id) ? { area: areas.get(item.id) } : {}),
                    ...(result.colors.has(item.id) ? { color: result.colors.get(item.id) } : {}),
                    ...(families.has(item.id) ? { buildingFamily: families.get(item.id) } : {}),
                })),
                [BOOKMARK_DB_KEY]: data[BOOKMARK_DB_KEY].map((item) =>
                    cells.has(item.id) ? { ...item, cell: cells.get(item.id) } : item,
                ),
            });
        }
        return { groups: result.plan.groups, total: data[BOOKMARK_DB_KEY].length };
    });
}
export async function deleteCategory(id) {
    await ready;
    return withWriteLock(async () => {
        const data = await storage.get({ [BOOKMARK_DB_KEY]: [], [CATEGORY_DB_KEY]: [] });
        await storage.set({
            [CATEGORY_DB_KEY]: data[CATEGORY_DB_KEY].filter((item) => item.id !== id),
            [BOOKMARK_DB_KEY]: data[BOOKMARK_DB_KEY].filter((item) => item.category !== id),
        });
    });
}
// A page re-entry acknowledges only bookmarks saved before that entry.
export async function dismissNewBefore(time) {
    await ready;
    return withWriteLock(async () => {
        const data = await storage.get({ [BOOKMARK_DB_KEY]: [] });
        if (!data[BOOKMARK_DB_KEY].some((item) => item.isNew && item.savedAt < time)) return;
        await storage.set({
            [BOOKMARK_DB_KEY]: data[BOOKMARK_DB_KEY].map((item) =>
                item.isNew && item.savedAt < time ? { ...item, isNew: false } : item,
            ),
        });
    });
}
