import { storage } from "./storage.js";

export class Bookmark {
    constructor(_id, _url, _name, _category) {
        this.id = _id;
        this.url = _url;
        this.name = _name;
        this.category = _category;
        this.savedAt = Date.now();
        this.clickCount = 0;
    }
}

export class BookmarkDB {
    constructor(_key, initialized = Promise.resolve()) {
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
        const bookmarks = await this.get();
        if (!newBookmark || newBookmark.id == null || !newBookmark.url || !newBookmark.name) {
            throw new TypeError("A bookmark with an id, URL, and name is required.");
        }

        const bookmark = {
            id: newBookmark.id,
            url: newBookmark.url,
            name: newBookmark.name,
            category: newBookmark.category,
            savedAt: newBookmark.savedAt ?? Date.now(),
            clickCount:
                Number.isInteger(newBookmark.clickCount) && newBookmark.clickCount >= 0 ? newBookmark.clickCount : 0,
        };
        bookmarks.push(bookmark);
        await storage.set({ [this.key]: bookmarks });
        return bookmark;
    }

    async remove(id) {
        const bookmark = await this.get(id);
        if (!bookmark) return false;

        this.bookmarks = this.bookmarks.filter((item) => item.id !== id);
        await storage.set({ [this.key]: this.bookmarks });
        return bookmark;
    }

    async edit(id, changes) {
        const bookmark = await this.get(id);
        if (!bookmark) return false;
        if (!changes || typeof changes !== "object") {
            throw new TypeError("Bookmark changes must be an object.");
        }

        // A building's cell belongs to its old category's area; the map assigns a new one.
        if (changes.category !== undefined && changes.category !== bookmark.category) delete bookmark.cell;
        for (const field of ["url", "name", "category"]) {
            if (changes[field] !== undefined) bookmark[field] = changes[field];
        }
        await storage.set({ [this.key]: this.bookmarks });
        return bookmark;
    }

    async incrementClickCount(id) {
        const bookmark = await this.get(id);
        if (!bookmark) return false;

        const currentCount =
            Number.isInteger(bookmark.clickCount) && bookmark.clickCount >= 0 ? bookmark.clickCount : 0;
        bookmark.clickCount = currentCount + 1;
        await storage.set({ [this.key]: this.bookmarks });
        return bookmark.clickCount;
    }
}
