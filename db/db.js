import { createDemoData } from "../demo/seed-data.js";
import { siteIconUrlForPage } from "../shared/site-icons.js";
import { webUrl } from "../shared/validation.js";
import { BookmarkDB } from "./bookmark.js";
import { CategoryDB, GENERAL_CATEGORY_NAME, generalCategoryLast, isGeneralCategory } from "./category.js";
import { SettingsDB } from "./settings.js";
import { storage, subscribeStorage, withWriteLock } from "./storage.js";

const BOOKMARK_DB_KEY = "webprg-bookmarkmap-bookmarks";
const CATEGORY_DB_KEY = "webprg-bookmarkmap-categories";
const ICON_BACKFILL_KEY = "webprg-bookmarkmap-icon-backfill-v1";
const SETTINGS_DB_KEY = "webprg-bookmarkmap-settings";

export async function backfillMissingBookmarkIcons(once = false) {
    await ready;
    if (!siteIconUrlForPage("https://example.com")) return 0;

    return withWriteLock(async () => {
        const data = await storage.get({ [BOOKMARK_DB_KEY]: [], [ICON_BACKFILL_KEY]: false });
        if (once && data[ICON_BACKFILL_KEY]) return 0;

        let updatedCount = 0;
        const updatedBookmarks = data[BOOKMARK_DB_KEY].map((bookmark) => {
            if (bookmark.iconUrl) return bookmark;
            const iconUrl = siteIconUrlForPage(bookmark.url);
            if (!iconUrl) return bookmark;
            updatedCount++;
            return { ...bookmark, iconUrl };
        });
        const changes = {};
        if (updatedCount) changes[BOOKMARK_DB_KEY] = updatedBookmarks;
        if (once) changes[ICON_BACKFILL_KEY] = true;
        if (Object.keys(changes).length) await storage.set(changes);
        return updatedCount;
    });
}

function assignUncategorized(data) {
    const savedCategories = data[CATEGORY_DB_KEY];
    const general = savedCategories.find(isGeneralCategory);
    if (!general) return false;
    const known = new Set(savedCategories.map((category) => String(category.id)));
    let changed = false;
    for (const bookmark of data[BOOKMARK_DB_KEY]) {
        if (known.has(String(bookmark.category))) continue;
        bookmark.category = general.id;
        delete bookmark.cell;
        changed = true;
    }
    return changed;
}

// Seed only a new demo installation; an existing empty array is also user data.
async function initializeDemo() {
    const existing = await storage.get([BOOKMARK_DB_KEY, CATEGORY_DB_KEY]);
    if (existing[BOOKMARK_DB_KEY] === undefined && existing[CATEGORY_DB_KEY] === undefined) {
        const demo = createDemoData();
        await storage.set({ [BOOKMARK_DB_KEY]: demo.bookmarks, [CATEGORY_DB_KEY]: demo.categories });
    }
    await withWriteLock(async () => {
        const data = await storage.get({ [CATEGORY_DB_KEY]: [], [BOOKMARK_DB_KEY]: [] });
        const saved = data[CATEGORY_DB_KEY];
        let general = saved.find(isGeneralCategory);
        if (!general) {
            general = saved.find((category) => category.name === GENERAL_CATEGORY_NAME);
            if (general) general.isGeneral = true;
            else {
                general = {
                    id: crypto.randomUUID(),
                    name: GENERAL_CATEGORY_NAME,
                    createdAt: Date.now(),
                    isGeneral: true,
                };
                saved.push(general);
            }
            await storage.set({ [CATEGORY_DB_KEY]: generalCategoryLast(saved) });
        } else if (general.name !== GENERAL_CATEGORY_NAME || saved.at(-1) !== general) {
            general.name = GENERAL_CATEGORY_NAME;
            await storage.set({ [CATEGORY_DB_KEY]: generalCategoryLast(saved) });
        }
        if (assignUncategorized(data)) await storage.set({ [BOOKMARK_DB_KEY]: data[BOOKMARK_DB_KEY] });
    });
}

export const ready = globalThis.navigator?.locks
    ? navigator.locks.request("webprg-bookmarkmap-initialize", initializeDemo)
    : initializeDemo();

export const bookmarks = new BookmarkDB(BOOKMARK_DB_KEY, ready, CATEGORY_DB_KEY);
export const categories = new CategoryDB(CATEGORY_DB_KEY, ready);
export const settings = new SettingsDB(SETTINGS_DB_KEY, ready);

export async function importChromeBookmarks(tree) {
    await ready;
    return withWriteLock(async () => {
        const data = await storage.get({ [BOOKMARK_DB_KEY]: [], [CATEGORY_DB_KEY]: [] });
        const savedCategories = data[CATEGORY_DB_KEY];
        const savedBookmarks = data[BOOKMARK_DB_KEY];
        const general = savedCategories.find(isGeneralCategory);
        if (!general) throw new Error("기본 카테고리를 찾지 못했습니다. 새로고침 후 다시 시도해 주세요.");
        const urls = new Set(savedBookmarks.map((bookmark) => webUrl(bookmark.url)?.href ?? bookmark.url));
        const result = { bookmarks: 0, categories: 0, duplicates: 0, skipped: 0 };

        function collect(node, category) {
            if (node.url !== undefined) {
                const url = webUrl(node.url);
                if (!url) {
                    result.skipped++;
                    return;
                }
                if (urls.has(url.href)) {
                    result.duplicates++;
                    return;
                }
                const iconUrl = siteIconUrlForPage(url.href);
                savedBookmarks.push({
                    id: crypto.randomUUID(),
                    url: url.href,
                    name: node.title?.trim() || url.hostname,
                    category: category.id,
                    savedAt: node.dateAdded ?? Date.now(),
                    lastVisitedAt: Date.now(),
                    clickCount: 0,
                    isNew: true,
                    ...(iconUrl ? { iconUrl } : {}),
                });
                urls.add(url.href);
                result.bookmarks++;
            } else {
                for (const child of node.children ?? []) collect(child, category);
            }
        }

        // Chrome's root children are system folders (bookmark bar, other, mobile).
        // Only user folders inside these containers become categories.
        for (const root of tree) {
            for (const container of root.children ?? []) {
                for (const node of container.children ?? []) {
                    if (node.url !== undefined) {
                        collect(node, general);
                        continue;
                    }
                    const name = node.title?.trim() || "이름 없는 폴더";
                    let category = savedCategories.find((item) => item.name === name);
                    if (!category) {
                        category = { id: crypto.randomUUID(), name, createdAt: Date.now() };
                        savedCategories.push(category);
                        result.categories++;
                    }
                    collect(node, category);
                }
            }
        }
        if (result.bookmarks || result.categories) {
            await storage.set({
                [CATEGORY_DB_KEY]: generalCategoryLast(savedCategories),
                [BOOKMARK_DB_KEY]: savedBookmarks,
            });
        }
        return result;
    });
}

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
        if (
            Object.keys(changes).length === 0 ||
            BOOKMARK_DB_KEY in changes ||
            CATEGORY_DB_KEY in changes ||
            SETTINGS_DB_KEY in changes
        )
            listener(changes);
    });
}

export async function updateCity(planner) {
    await ready;
    return withWriteLock(async () => {
        const data = await storage.get({ [BOOKMARK_DB_KEY]: [], [CATEGORY_DB_KEY]: [] });
        const reassigned = assignUncategorized(data);
        const result = planner(generalCategoryLast(data[CATEGORY_DB_KEY]), data[BOOKMARK_DB_KEY]);
        const { areas, cells } = result.plan.changed;
        const families = result.families ?? new Map();
        if (reassigned || areas.size || cells.size || result.colors.size || families.size) {
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
// Moves a building on the map. `update(categories, bookmarks)` reads the latest arrays inside
// the write lock and returns the arrays to save, or null to cancel (for example when another
// tab changed the layout since the drag started). Both arrays are saved in one write.
export async function moveBookmark(update) {
    await ready;
    return withWriteLock(async () => {
        const data = await storage.get({ [BOOKMARK_DB_KEY]: [], [CATEGORY_DB_KEY]: [] });
        const next = update(data[CATEGORY_DB_KEY], data[BOOKMARK_DB_KEY]);
        if (!next) return false;
        await storage.set({ [CATEGORY_DB_KEY]: next.categories, [BOOKMARK_DB_KEY]: next.bookmarks });
        return true;
    });
}
export async function deleteCategory(id) {
    await ready;
    return withWriteLock(async () => {
        const data = await storage.get({ [BOOKMARK_DB_KEY]: [], [CATEGORY_DB_KEY]: [] });
        if (isGeneralCategory(data[CATEGORY_DB_KEY].find((category) => category.id === id)))
            throw new Error("카테고리 일반은 삭제할 수 없습니다.");
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
