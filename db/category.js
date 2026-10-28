export class Category {
    constructor(_id, _name) {
        this.id = _id;
        this.name = _name;
        this.createdAt = Date.now();
    }
}

export class CategoryDB {
    constructor(_key) {
        this.key = _key;
        this.categories = [];
        // chrome.storage.local.get is asynchronous; wait for it before any
        // mutation so an early add/remove cannot overwrite saved categories.
        this.ready = chrome.storage.local.get({ [_key]: [] }).then((data) => {
            this.categories = Array.isArray(data[_key]) ? data[_key] : [];
            return this.categories;
        });
    }

    async get(...args) {
        await this.ready;
        if (args.length > 0) {
            return this.categories.find((category) => category.id === args[0]);
        }
        return this.categories;
    }

    async add(newCategory) {
        const categories = await this.get();
        if (!newCategory || newCategory.id == null || !newCategory.name) {
            throw new TypeError("A category with an id and name is required.");
        }

        const category = {
            id: newCategory.id,
            name: newCategory.name,
            createdAt: newCategory.createdAt ?? Date.now(),
        };
        categories.push(category);
        await chrome.storage.local.set({ [this.key]: categories });
        return category;
    }

    async remove(id) {
        const category = await this.get(id);
        if (!category) return false;

        this.categories = this.categories.filter((item) => item.id !== id);
        await chrome.storage.local.set({ [this.key]: this.categories });
        return category;
    }

    async edit(id, changes) {
        const category = await this.get(id);
        if (!category) return false;
        if (!changes || typeof changes !== "object") {
            throw new TypeError("Category changes must be an object.");
        }

        if (changes.name !== undefined) category.name = changes.name;
        await chrome.storage.local.set({ [this.key]: this.categories });
        return category;
    }
}
