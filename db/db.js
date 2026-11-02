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

export function subscribe(listener) {
    return subscribeStorage((changes) => {
        if (Object.keys(changes).length === 0 || BOOKMARK_DB_KEY in changes || CATEGORY_DB_KEY in changes) listener();
    });
}
