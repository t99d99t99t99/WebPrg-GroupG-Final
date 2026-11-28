// Moving one building to where it is dropped (pure functions).
//
// A building goes onto a land cell: an empty cell, a swap within its own land, or, in
// another land, the occupied cell with that building pushed to the nearest empty cell.
// A full land grows only through its expansion slots (the road cells along each edge):
// the land gains one row/column on that side, the building takes the slot, and every
// other area beyond that line shifts one cell away. The edited layout is normalised with
// layout.js `planCity`, so the preview, the saved result and later renders all agree.

import { planCity, TILE_HEIGHT, TILE_WIDTH } from "./layout.js";

const same = (a, b) => a && b && a.x === b.x && a.y === b.y;
const inside = (area, cell) =>
    area && cell.x >= area.x && cell.x < area.x + area.w && cell.y >= area.y && cell.y < area.y + area.h;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Grid position (fractional) under a world-pixel point (inverse of layout.js `project`).
export function gridAt(left, top) {
    const a = top / (TILE_HEIGHT / 2);
    const b = left / (TILE_WIDTH / 2);
    return { x: (a + b) / 2, y: (a - b) / 2 };
}

// Saved state as the map last drew it: categories with their areas (and `picketCell`, where the
// name picket stands), bookmarks with their cells.
export function snapshotFromGroups(groups) {
    return {
        categories: groups
            .filter((group) => group.category.id !== "uncategorized")
            .map((group) => ({ ...group.category, area: group.area, picketCell: group.picket ?? null })),
        bookmarks: groups.flatMap((group) =>
            group.items.map((bookmark) => ({ ...bookmark, cell: group.cells.get(bookmark.id) })),
        ),
    };
}

// Fields that decide the layout. If storage still matches this, a move planned on the
// snapshot gives the same result when saved.
export function layoutFingerprint(categories, bookmarks) {
    const known = new Set(categories.map((category) => String(category.id)));
    return JSON.stringify([
        categories.map(({ id, area }) => [id, area?.x, area?.y, area?.w, area?.h]),
        bookmarks
            .map(({ id, category, cell }) => [
                String(id),
                String(category),
                known.has(String(category)) ? [cell?.x, cell?.y] : null,
            ])
            .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
    ]);
}

function cellsOf(area) {
    const list = [];
    for (let y = area.y; y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) list.push({ x, y });
    return list;
}

const membersOf = (bookmarks, categoryId) => bookmarks.filter((item) => String(item.category) === String(categoryId));

// Sides as grid directions. "line" is the grid line where the new row/column goes.
const SIDES = {
    "x+": { axis: "x", step: 1 },
    "x-": { axis: "x", step: -1 },
    "y+": { axis: "y", step: 1 },
    "y-": { axis: "y", step: -1 },
};

/**
 * Expansion slots of a land: the road cells right outside each edge (corners excluded).
 * @returns {{cell: {x:number,y:number}, side: string}[]}
 */
export function slotsOf(area) {
    const { x, y, w, h } = area;
    const slots = [];
    for (let i = 0; i < h; i++) {
        slots.push({ cell: { x: x + w, y: y + i }, side: "x+" });
        slots.push({ cell: { x: x - 1, y: y + i }, side: "x-" });
    }
    for (let i = 0; i < w; i++) {
        slots.push({ cell: { x: x + i, y: y + h }, side: "y+" });
        slots.push({ cell: { x: x + i, y: y - 1 }, side: "y-" });
    }
    return slots;
}

/**
 * What dropping `bookmarkId` at grid point `point` means, or null when it cannot go there.
 * - Own land: an empty cell is a move, a building's cell a swap.
 * - Other land: an empty cell is taken; an occupied cell pushes its building to the nearest
 *   empty cell. The name picket's cell counts as taken there, so a land filled by its buildings
 *   and its picket is full: the result is `{type: "full", categoryId}`, which cannot be dropped
 *   on but lets the caller offer that land's expansion slots.
 * - `expandId`: the land whose slots are offered; a slot cell gives an "insert" move.
 *   Any other road cell gives null.
 */
export function resolveDrop(snapshot, bookmarkId, point, expandId = null) {
    const bookmark = snapshot.bookmarks.find((item) => item.id === bookmarkId);
    if (!bookmark) return null;
    const cell = { x: Math.floor(point.x), y: Math.floor(point.y) };
    const own = String(bookmark.category);

    const land = snapshot.categories.find((category) => inside(category.area, cell));
    if (land) {
        const categoryId = land.id;
        const taken = membersOf(snapshot.bookmarks, categoryId);
        const occupant = taken.find((item) => same(item.cell, cell));
        if (occupant?.id === bookmark.id) return null;
        if (String(categoryId) === own) {
            return occupant
                ? { type: "swap", bookmarkId, categoryId, cell, partner: occupant.id }
                : { type: "place", bookmarkId, categoryId, cell };
        }
        const free = cellsOf(land.area).filter(
            (spot) => !taken.some((item) => same(item.cell, spot)) && !same(land.picketCell, spot),
        );
        if (!free.length) return { type: "full", categoryId };
        if (!occupant) return { type: "place", bookmarkId, categoryId, cell };
        free.sort((a, b) => distance(a, cell) - distance(b, cell));
        return { type: "push", bookmarkId, categoryId, cell, partner: occupant.id, to: free[0] };
    }

    if (expandId === null) return null;
    const target = snapshot.categories.find((category) => String(category.id) === String(expandId));
    const slot = target && slotsOf(target.area).find((item) => same(item.cell, cell));
    if (!slot) return null;
    return { type: "insert", bookmarkId, categoryId: target.id, cell, side: slot.side };
}

// Grows the target land by one row/column on `move.side` so the slot `move.cell` becomes
// part of it. Every other area wholly beyond that line moves one cell away (with its
// buildings) so nothing overlaps; planCity then pulls areas back where there is room.
function insertLine(categories, bookmarks, move) {
    const { axis, step } = SIDES[move.side];
    const size = axis === "x" ? "w" : "h";
    const target = categories.find((item) => String(item.id) === String(move.categoryId));
    const area = target.area;
    const shift = (spot, by) => ({ ...spot, [axis]: spot[axis] + by });
    const far = area[axis] + area[size]; // first coordinate past the land
    const shiftedIds = new Set();
    const nextCategories = categories.map((category) => {
        if (category === target) {
            const grown = { ...area, [size]: area[size] + 1 };
            if (step < 0) grown[axis] -= 1;
            return { ...category, area: grown };
        }
        const a = category.area;
        if (!a) return category;
        const beyond = step > 0 ? a[axis] >= far : a[axis] + a[size] <= area[axis];
        if (!beyond) return category;
        shiftedIds.add(String(category.id));
        return { ...category, area: shift(a, step) };
    });
    const nextBookmarks = bookmarks.map((item) => {
        if (item.id === move.bookmarkId) return { ...item, category: move.categoryId, cell: { ...move.cell } };
        if (item.cell && shiftedIds.has(String(item.category))) return { ...item, cell: shift(item.cell, step) };
        return item;
    });
    return { categories: nextCategories, bookmarks: nextBookmarks };
}

// The layout with the move applied, before planCity normalises it.
export function applyMove(categories, bookmarks, move) {
    if (move.type === "insert") return insertLine(categories, bookmarks, move);
    const moving = bookmarks.find((item) => item.id === move.bookmarkId);
    return {
        categories,
        bookmarks: bookmarks.map((item) => {
            if (item.id === move.bookmarkId) return { ...item, category: move.categoryId, cell: { ...move.cell } };
            if (move.type === "swap" && item.id === move.partner) return { ...item, cell: { ...moving.cell } };
            if (move.type === "push" && item.id === move.partner) return { ...item, cell: { ...move.to } };
            return item;
        }),
    };
}

/**
 * Plans the city after a move. Returns the edited arrays, the plan, the building's final
 * cell, and how many other buildings and areas end up somewhere else than before.
 */
export function planMove(categories, bookmarks, move) {
    const edited = applyMove(categories, bookmarks, move);
    // The land the building went into and the land it left stay where they are (the one it
    // left only loses an emptied line); other lands may be pulled back toward the middle to
    // close gaps the move opened.
    const source = bookmarks.find((item) => item.id === move.bookmarkId)?.category;
    const pinned = [move.categoryId, source].filter((id) => id !== undefined);
    const plan = planCity(edited.categories, edited.bookmarks, { pinned, compactAll: true });
    const finalCells = new Map();
    for (const group of plan.groups) for (const [id, spot] of group.cells) finalCells.set(id, spot);
    const finalAreas = new Map(plan.groups.map((group) => [String(group.category.id), group.area]));
    const startAreas = new Map(categories.map((category) => [String(category.id), category.area]));
    // A building counts as moved only if its place inside its land changed; a whole land
    // sliding over by one cell is reported as a land change instead.
    let othersMoved = 0;
    for (const item of bookmarks) {
        if (item.id === move.bookmarkId) continue;
        const from = startAreas.get(String(item.category));
        const to = finalAreas.get(String(item.category));
        const after = finalCells.get(item.id);
        if (!from || !to || !item.cell || !after) continue;
        // In the target land, any building that was pushed counts; elsewhere, compare positions
        // relative to the land so a land sliding over is not counted per building.
        const sameSpot =
            String(item.category) === String(move.categoryId)
                ? same(item.cell, after)
                : item.cell.x - from.x === after.x - to.x && item.cell.y - from.y === after.y - to.y;
        if (!sameSpot) othersMoved++;
    }
    let areasChanged = 0;
    for (const category of categories) {
        const before = category.area;
        const after = finalAreas.get(String(category.id));
        if (
            !before ||
            !after ||
            before.x !== after.x ||
            before.y !== after.y ||
            before.w !== after.w ||
            before.h !== after.h
        )
            areasChanged++;
    }
    return {
        move,
        edited,
        plan,
        cell: finalCells.get(move.bookmarkId) ?? null,
        othersMoved,
        areasChanged,
    };
}
