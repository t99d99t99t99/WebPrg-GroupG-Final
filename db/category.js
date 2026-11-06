import { storage } from "./storage.js";

export class Category {
    constructor(_id, _name) {
        this.id = _id;
        this.name = _name;
        this.createdAt = Date.now();
    }
}

export class CategoryDB {
    constructor(_key, initialized = Promise.resolve()) {
        this.key = _key;
        this.categories = [];
        // chrome.storage.local.get is asynchronous; wait for it before any
        // mutation so an early add/remove cannot overwrite saved categories.
        this.ready = initialized
            .then(() => storage.get({ [_key]: [] }))
            .then((data) => {
                this.categories = Array.isArray(data[_key]) ? data[_key] : [];
                return this.categories;
            });
    }

    async get(...args) {
        await this.ready;
        const data = await storage.get({ [this.key]: [] });
        this.categories = Array.isArray(data[this.key]) ? data[this.key] : [];
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
        if (newCategory.color !== undefined) {
            if (typeof newCategory.color !== "string" || !/^#[\da-f]{6}$/i.test(newCategory.color)) {
                throw new TypeError("Category color must be a six-digit hex color.");
            }
            category.color = newCategory.color;
        }
        categories.push(category);
        await storage.set({ [this.key]: categories });
        return category;
    }

    async remove(id) {
        const category = await this.get(id);
        if (!category) return false;

        this.categories = this.categories.filter((item) => item.id !== id);
        await storage.set({ [this.key]: this.categories });
        return category;
    }

    async edit(id, changes) {
        const category = await this.get(id);
        if (!category) return false;
        if (!changes || typeof changes !== "object") {
            throw new TypeError("Category changes must be an object.");
        }

        if (changes.name !== undefined) category.name = changes.name;
        if (changes.color !== undefined) {
            if (typeof changes.color !== "string" || !/^#[\da-f]{6}$/i.test(changes.color)) {
                throw new TypeError("Category color must be a six-digit hex color.");
            }
            category.color = changes.color;
        }
        await storage.set({ [this.key]: this.categories });
        return category;
    }
}
