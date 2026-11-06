import { createDemoData } from "../demo/seed-data.js";
import { BookmarkDB } from "./bookmark.js";
import { CategoryDB } from "./category.js";
import { storage, subscribeStorage } from "./storage.js";

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

export const bookmarks = new BookmarkDB(BOOKMARK_DB_KEY, ready);
export const categories = new CategoryDB(CATEGORY_DB_KEY, ready);

// Saves planned map positions (category `area`, bookmark `cell`) in one write so
// both arrays stay in step. Only the given ids change; other fields are kept.
export async function saveLayout(areas, cells) {
    await ready;
    const data = await storage.get({ [BOOKMARK_DB_KEY]: [], [CATEGORY_DB_KEY]: [] });
    const savedCategories = data[CATEGORY_DB_KEY].map((category) =>
        areas.has(category.id) ? { ...category, area: areas.get(category.id) } : category,
    );
    const savedBookmarks = data[BOOKMARK_DB_KEY].map((bookmark) =>
        cells.has(bookmark.id) ? { ...bookmark, cell: cells.get(bookmark.id) } : bookmark,
    );
    await storage.set({ [BOOKMARK_DB_KEY]: savedBookmarks, [CATEGORY_DB_KEY]: savedCategories });
}

export function subscribe(listener) {
    return subscribeStorage((changes) => {
        if (Object.keys(changes).length === 0 || BOOKMARK_DB_KEY in changes || CATEGORY_DB_KEY in changes) listener();
    });
}
