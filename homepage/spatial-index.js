// World-coordinate buckets avoid reading every building's DOM rectangle on hover.
export class SpatialIndex {
    constructor(size = 128) {
        this.size = size;
        this.buckets = new Map();
    }
    keys(rect) {
        const result = [];
        for (let y = Math.floor(rect.top / this.size); y <= Math.floor(rect.bottom / this.size); y++)
            for (let x = Math.floor(rect.left / this.size); x <= Math.floor(rect.right / this.size); x++)
                result.push(`${x},${y}`);
        return result;
    }
    insert(rect, value) {
        const entry = { rect, value };
        for (const key of this.keys(rect)) {
            if (!this.buckets.has(key)) this.buckets.set(key, []);
            this.buckets.get(key).push(entry);
        }
    }
    search(rect) {
        const found = new Set();
        for (const key of this.keys(rect))
            for (const entry of this.buckets.get(key) ?? []) {
                const r = entry.rect;
                if (r.right >= rect.left && r.left <= rect.right && r.bottom >= rect.top && r.top <= rect.bottom)
                    found.add(entry);
            }
        return [...found];
    }
}
