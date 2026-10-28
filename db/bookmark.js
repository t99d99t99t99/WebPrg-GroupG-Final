export class Bookmark {
    constructor(_id, _url, _name, _category) {
        this.id = _id;
        this.url = _url;
        this.name = _name;
        this.category = _category;
        this.savedAt = Date.now();
    }
}

export class BookmarkDB {
    constructor(_key) {
        this.key = _key;
        this.bookmarks = [];
        // Wait for the initial read so an early mutation cannot overwrite
        // bookmarks already saved in chrome.storage.local.
        this.ready = chrome.storage.local.get({ [_key]: [] }).then((data) => {
            this.bookmarks = Array.isArray(data[_key]) ? data[_key] : [];
            return this.bookmarks;
        });
    }

    async get(...args) {
        await this.ready;
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
        };
        bookmarks.push(bookmark);
        await chrome.storage.local.set({ [this.key]: bookmarks });
        return bookmark;
    }

    async remove(id) {
        const bookmark = await this.get(id);
        if (!bookmark) return false;

        this.bookmarks = this.bookmarks.filter((item) => item.id !== id);
        await chrome.storage.local.set({ [this.key]: this.bookmarks });
        return bookmark;
    }

    async edit(id, changes) {
        const bookmark = await this.get(id);
        if (!bookmark) return false;
        if (!changes || typeof changes !== "object") {
            throw new TypeError("Bookmark changes must be an object.");
        }

        for (const field of ["url", "name", "category"]) {
            if (changes[field] !== undefined) bookmark[field] = changes[field];
        }
        await chrome.storage.local.set({ [this.key]: this.bookmarks });
        return bookmark;
    }
}
