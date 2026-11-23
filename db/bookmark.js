import { buildingDesignById } from "../shared/building-designs.js";
import { isBookmarkEmoji } from "../shared/emoji-data.js";
import { isSiteIconUrl } from "../shared/site-icons.js";
import { bookmarkNameError, webUrl } from "../shared/validation.js";
import { storage, withWriteLock } from "./storage.js";

export class Bookmark {
    constructor(_id, _url, _name, _category, _memo = "", _iconUrl = "", _useEmoji = false, _emoji = "😊") {
        this.id = _id;
        this.url = _url;
        this.name = _name;
        this.category = _category;
        this.savedAt = Date.now();
        this.clickCount = 0;
        this.memo = _memo;
        this.iconUrl = _iconUrl;
        this.useEmoji = _useEmoji;
        this.emoji = _emoji;
    }
}

export class BookmarkDB {
    constructor(_key, initialized = Promise.resolve(), categoryKey) {
        this.categoryKey = categoryKey;
        this.key = _key;
        this.bookmarks = [];
        // Wait for the initial read so an early mutation cannot overwrite
        // bookmarks already saved in chrome.storage.local.
        this.ready = initialized
            .then(() => storage.get({ [_key]: [] }))
            .then((data) => {
                this.bookmarks = Array.isArray(data[_key]) ? data[_key] : [];
                return this.bookmarks;
            });
    }

    async get(...args) {
        await this.ready;
        const data = await storage.get({ [this.key]: [] });
        this.bookmarks = Array.isArray(data[this.key]) ? data[this.key] : [];
        if (args.length > 0) {
            return this.bookmarks.find((bookmark) => bookmark.id === args[0]);
        }
        return this.bookmarks;
    }

    async add(newBookmark) {
        await this.ready;
        return withWriteLock(async () => {
            const bookmarks = await this.get();
            if (!newBookmark || newBookmark.id == null || !newBookmark.url || !newBookmark.name) {
                throw new TypeError("A bookmark with an id, URL, and name is required.");
            }
            const error = bookmarkNameError(newBookmark.name);
            if (error) throw new Error(error);
            if (this.categoryKey) {
                const data = await storage.get({ [this.categoryKey]: [] });
                if (!data[this.categoryKey].some((category) => category.id === newBookmark.category))
                    throw new Error("카테고리가 삭제되었습니다. 다시 선택해 주세요.");
            }

            const bookmark = {
                id: newBookmark.id,
                url: newBookmark.url,
                name: newBookmark.name,
                category: newBookmark.category,
                savedAt: newBookmark.savedAt ?? Date.now(),
                clickCount:
                    Number.isInteger(newBookmark.clickCount) && newBookmark.clickCount >= 0
                        ? newBookmark.clickCount
                        : 0,
            };
            if (newBookmark.memo !== undefined && typeof newBookmark.memo !== "string")
                throw new Error("메모는 문자열로 입력해 주세요.");
            if (newBookmark.memo) bookmark.memo = newBookmark.memo;
            if (newBookmark.buildingDesign !== undefined) {
                if (!buildingDesignById(newBookmark.buildingDesign))
                    throw new Error("건물 디자인을 다시 선택해 주세요.");
                bookmark.buildingDesign = newBookmark.buildingDesign;
            }
            if (newBookmark.iconUrl !== undefined) {
                if (!isSiteIconUrl(newBookmark.iconUrl)) throw new Error("아이콘 주소를 확인해 주세요.");
                bookmark.iconUrl = newBookmark.iconUrl;
            }
            validateEmojiFields(newBookmark);
            bookmark.useEmoji = newBookmark.useEmoji ?? false;
            bookmark.emoji = newBookmark.emoji ?? "😊";
            bookmark.isNew = newBookmark.isNew ?? true;
            bookmarks.push(bookmark);
            await storage.set({ [this.key]: bookmarks });
            return bookmark;
        });
    }

    async remove(id) {
        await this.ready;
        return withWriteLock(async () => {
            const bookmark = await this.get(id);
            if (!bookmark) return false;

            this.bookmarks = this.bookmarks.filter((item) => item.id !== id);
            await storage.set({ [this.key]: this.bookmarks });
            return bookmark;
        });
    }

    async edit(id, changes) {
        await this.ready;
        return withWriteLock(async () => {
            const bookmark = await this.get(id);
            if (!bookmark) return false;
            if (!changes || typeof changes !== "object") {
                throw new TypeError("Bookmark changes must be an object.");
            }
            validateEmojiFields(changes);

            if (changes.name !== undefined) {
                const error = bookmarkNameError(changes.name);
                if (error) throw new Error(error);
            }
            if (changes.url !== undefined && !webUrl(changes.url))
                throw new Error("http 또는 https 주소를 입력해 주세요.");
            if (changes.iconUrl !== undefined && !isSiteIconUrl(changes.iconUrl))
                throw new Error("아이콘 주소를 확인해 주세요.");
            if (changes.memo !== undefined && typeof changes.memo !== "string")
                throw new Error("메모는 문자열로 입력해 주세요.");
            if (changes.buildingDesign !== undefined && !buildingDesignById(changes.buildingDesign))
                throw new Error("건물 디자인을 다시 선택해 주세요.");
            if (changes.category !== undefined && this.categoryKey) {
                const data = await storage.get({ [this.categoryKey]: [] });
                if (!data[this.categoryKey].some((item) => item.id === changes.category))
                    throw new Error("카테고리가 삭제되었습니다. 다시 선택해 주세요.");
            }
            // A building's cell belongs to its old category's area; the map assigns a new one.
            if (changes.category !== undefined && changes.category !== bookmark.category) delete bookmark.cell;
            for (const field of [
                "url",
                "name",
                "category",
                "memo",
                "isNew",
                "iconUrl",
                "buildingDesign",
                "useEmoji",
                "emoji",
            ]) {
                if (changes[field] !== undefined) bookmark[field] = changes[field];
            }
            await storage.set({ [this.key]: this.bookmarks });
            return bookmark;
        });
    }

    async incrementClickCount(id) {
        await this.ready;
        return withWriteLock(async () => {
            const bookmark = await this.get(id);
            if (!bookmark) return false;

            const currentCount =
                Number.isInteger(bookmark.clickCount) && bookmark.clickCount >= 0 ? bookmark.clickCount : 0;
            bookmark.clickCount = currentCount + 1;
            bookmark.lastVisitedAt = Date.now();
            await storage.set({ [this.key]: this.bookmarks });
            return bookmark.clickCount;
        });
    }

    // Puts the given bookmarks in this order, in the array slots they already take (the category
    // panel lists a category's buildings in array order). Other bookmarks and all fields stay as they are.
    async reorder(ids) {
        await this.ready;
        return withWriteLock(async () => {
            const saved = await this.get();
            const wanted = [...new Set(ids.map(String))];
            const slots = saved.flatMap((item, index) => (wanted.includes(String(item.id)) ? [index] : []));
            const ordered = wanted.map((id) => saved.find((item) => String(item.id) === id)).filter(Boolean);
            if (ordered.length !== slots.length) throw new Error("북마크 목록이 바뀌었습니다. 다시 시도해 주세요.");
            const next = [...saved];
            slots.forEach((slot, index) => {
                next[slot] = ordered[index];
            });
            await storage.set({ [this.key]: next });
        });
    }
}

function validateEmojiFields(bookmark) {
    if (bookmark.useEmoji !== undefined && typeof bookmark.useEmoji !== "boolean")
        throw new Error("이모지 사용 여부는 참 또는 거짓으로 지정해 주세요.");
    if (bookmark.emoji !== undefined && !isBookmarkEmoji(bookmark.emoji))
        throw new Error("대표 아이콘으로 사용할 이모지를 다시 선택해 주세요.");
}
