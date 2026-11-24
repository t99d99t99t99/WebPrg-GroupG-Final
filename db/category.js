import { categoryError } from "../shared/validation.js";
import { storage, withWriteLock } from "./storage.js";

export const GENERAL_CATEGORY_NAME = "카테고리 일반";

export function isGeneralCategory(category) {
    return category?.isGeneral === true;
}

export function generalCategoryLast(categories) {
    return [...categories].sort((a, b) => Number(isGeneralCategory(a)) - Number(isGeneralCategory(b)));
}

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
                this.categories = generalCategoryLast(Array.isArray(data[_key]) ? data[_key] : []);
                return this.categories;
            });
    }

    async get(...args) {
        await this.ready;
        const data = await storage.get({ [this.key]: [] });
        this.categories = generalCategoryLast(Array.isArray(data[this.key]) ? data[this.key] : []);
        if (args.length > 0) {
            return this.categories.find((category) => category.id === args[0]);
        }
        return this.categories;
    }

    async add(newCategory) {
        await this.ready;
        return withWriteLock(async () => {
            const categories = await this.get();
            if (!newCategory || newCategory.id == null || !newCategory.name) {
                throw new TypeError("카테고리를 저장하려면 ID와 이름이 필요합니다.");
            }

            if (newCategory.name.trim() === GENERAL_CATEGORY_NAME)
                throw new Error("카테고리 일반은 이미 존재하는 기본 카테고리입니다.");
            const error = categoryError(newCategory.name, categories);
            if (error) throw new Error(error);

            const category = {
                id: newCategory.id,
                name: newCategory.name.trim(),
                createdAt: newCategory.createdAt ?? Date.now(),
            };
            if (newCategory.color !== undefined) {
                if (typeof newCategory.color !== "string" || !/^#[\da-f]{6}$/i.test(newCategory.color)) {
                    throw new TypeError("카테고리 색상은 #으로 시작하는 6자리 색상 코드여야 합니다.");
                }
                if (newCategory.customColor !== undefined && typeof newCategory.customColor !== "boolean")
                    throw new TypeError("색상 지정 여부는 참 또는 거짓이어야 합니다.");
                category.color = newCategory.color;
                category.customColor = newCategory.customColor ?? true;
            }
            categories.push(category);
            await storage.set({ [this.key]: generalCategoryLast(categories) });
            return category;
        });
    }

    async remove(id) {
        await this.ready;
        return withWriteLock(async () => {
            const category = await this.get(id);
            if (!category) return false;
            if (isGeneralCategory(category)) throw new Error("카테고리 일반은 삭제할 수 없습니다.");

            this.categories = this.categories.filter((item) => item.id !== id);
            await storage.set({ [this.key]: this.categories });
            return category;
        });
    }

    async edit(id, changes) {
        await this.ready;
        return withWriteLock(async () => {
            const category = await this.get(id);
            if (!category) return false;
            if (!changes || typeof changes !== "object") {
                throw new TypeError("카테고리 변경 내용이 올바르지 않습니다.");
            }

            if (changes.name !== undefined) {
                if (isGeneralCategory(category)) throw new Error("카테고리 일반은 이름을 변경할 수 없습니다.");
                if (typeof changes.name === "string" && changes.name.trim() === GENERAL_CATEGORY_NAME)
                    throw new Error("카테고리 일반은 이미 존재하는 기본 카테고리입니다.");
                const error = categoryError(changes.name, this.categories, id);
                if (error) throw new Error(error);
                category.name = changes.name.trim();
            }
            if (changes.color !== undefined) {
                if (typeof changes.color !== "string" || !/^#[\da-f]{6}$/i.test(changes.color)) {
                    throw new TypeError("카테고리 색상은 #으로 시작하는 6자리 색상 코드여야 합니다.");
                }
                if (changes.customColor !== undefined && typeof changes.customColor !== "boolean")
                    throw new TypeError("색상 지정 여부는 참 또는 거짓이어야 합니다.");
                category.color = changes.color;
                category.customColor = changes.customColor ?? true;
            }
            await storage.set({ [this.key]: this.categories });
            return category;
        });
    }
    async reorder(ids) {
        await this.ready;
        return withWriteLock(async () => {
            const saved = await this.get();
            const ordered = [...new Set(ids)].map((id) => saved.find((item) => item.id === id)).filter(Boolean);
            for (const item of saved) if (!ordered.includes(item)) ordered.push(item);
            await storage.set({ [this.key]: generalCategoryLast(ordered) });
        });
    }
}
