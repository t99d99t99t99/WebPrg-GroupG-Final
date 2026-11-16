// City layout on an isometric grid where one cell holds one building.
// A category owns a rectangle of cells (`area`), wrapped by a one-cell road ring
// that neighbours share. Areas and building cells are saved, so a plan keeps
// existing positions and only grows, shrinks, or moves what it has to.

export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;

// Land cells per building (the name picket included), so a land keeps some empty cells between buildings.
const MARGIN = 1.3;
// A land grows once buildings (and the picket) fill more than MAX_FILL of it, and shrinks once
// they fill less than MIN_FILL.
const MAX_FILL = 0.85;
const MIN_FILL = 0.45;

// 2x2 -> 2x3 -> 3x3 -> 3x4 -> 4x4 ... holding `count` cells, returned as [short, long].
function shapeFor(count) {
    let short = 2;
    let long = 2;
    while (short * long < count) {
        if (short === long) long++;
        else short++;
    }
    return [short, long];
}

// Land shape for `count` buildings, one picket cell and the margin.
function targetShape(count) {
    return shapeFor(Math.ceil((count + 1) * MARGIN));
}

// Grow only when the land gets crowded, and shrink only when far too many cells are empty, so adding
// or removing a bookmark or two does not resize a land and push its neighbours around.
function needsGrow(group) {
    return group.count + 1 > group.area.w * group.area.h * MAX_FILL;
}
function needsShrink(group) {
    const [short, long] = targetShape(group.count);
    const cells = group.area.w * group.area.h;
    return group.count + 1 < cells * MIN_FILL && short * long < cells;
}

// FNV-1a: a fixed pseudo-random number for a text, so random choices stay the same every render.
export function hashText(text) {
    let hash = 2166136261;
    for (const char of text) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 16777619);
    }
    // Mix the bits (MurmurHash3 finaliser): texts that differ only in the last character
    // would otherwise share their high bits and pick the same item.
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
    return hash >>> 0;
}

// Distance measured on screen, so the city spreads out from the middle.
// Vertical distance counts more because the map region is wider than tall.
const VERTICAL_WEIGHT = 1.6;
function screenDistance(ax, ay, bx, by) {
    const dc = ax - bx;
    const dr = ay - by;
    return Math.hypot(dc - dr, ((dc + dr) / 2) * VERTICAL_WEIGHT);
}

function centerOf(area) {
    return [area.x + area.w / 2, area.y + area.h / 2];
}

// Empty cells between two areas along each axis (0 or less when their ranges touch or overlap).
function gaps(a, b) {
    return [Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)), Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))];
}

// Areas must keep at least one cell between them for the shared road.
function overlaps(a, b) {
    const [gx, gy] = gaps(a, b);
    return gx < 1 && gy < 1;
}

// Two cells between facing sides put two road rings side by side, drawn as two parallel
// streets. Neighbours either share one road (one cell) or leave a lot strip (three or more).
function doubleRoad(a, b) {
    const [gx, gy] = gaps(a, b);
    return (gx === 2 && gy <= 1) || (gy === 2 && gx <= 1);
}

function blocks(a, b) {
    return overlaps(a, b) || doubleRoad(a, b);
}

function isFree(area, others) {
    return others.every((other) => !blocks(area, other));
}

// Closest free position for a w*h area to the point (nearX, nearY).
function findSpot(w, h, obstacles, nearX, nearY) {
    let minX = Math.floor(nearX) - w;
    let maxX = Math.ceil(nearX);
    let minY = Math.floor(nearY) - h;
    let maxY = Math.ceil(nearY);
    for (const area of obstacles) {
        minX = Math.min(minX, area.x - w - 1);
        maxX = Math.max(maxX, area.x + area.w + 1);
        minY = Math.min(minY, area.y - h - 1);
        maxY = Math.max(maxY, area.y + area.h + 1);
    }
    let best = null;
    let bestDistance = Infinity;
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            const area = { x, y, w, h };
            const distance = screenDistance(x + w / 2, y + h / 2, nearX, nearY);
            if (distance < bestDistance && isFree(area, obstacles)) {
                best = area;
                bestDistance = distance;
            }
        }
    }
    return best;
}

function validArea(area) {
    return (
        area &&
        [area.x, area.y, area.w, area.h].every(Number.isInteger) &&
        area.w >= 2 &&
        area.h >= 2 &&
        area.w * area.h <= 400
    );
}

function moveTo(group, area) {
    group.dx += area.x - group.area.x;
    group.dy += area.y - group.area.y;
    group.area = area;
}

function grow(group, groups) {
    const [short, long] = targetShape(group.count);
    const old = group.area;
    const others = groups.filter((item) => item !== group).map((item) => item.area);
    const candidates = [];
    for (const [w, h] of [
        [short, long],
        [long, short],
    ]) {
        if (w < old.w || h < old.h) continue;
        for (let x = old.x + old.w - w; x <= old.x; x++) {
            for (let y = old.y + old.h - h; y <= old.y; y++) candidates.push({ x, y, w, h });
        }
    }
    // Prefer growing away from the middle of the map.
    candidates.sort((a, b) => screenDistance(...centerOf(b), 0, 0) - screenDistance(...centerOf(a), 0, 0));
    const inPlace = candidates.find((area) => isFree(area, others));
    if (inPlace) {
        group.area = inPlace;
        return;
    }

    // Blocked: move exactly one area, either this one or the single neighbour in the way.
    const [oldX, oldY] = centerOf(old);
    let best = null;
    const sizes = candidates.length ? candidates.map((area) => [area.w, area.h]) : [[long, short]];
    for (const [w, h] of sizes) {
        const spot = findSpot(w, h, others, oldX, oldY);
        const cost = screenDistance(...centerOf(spot), oldX, oldY);
        if (!best || cost < best.cost) best = { cost, apply: () => moveTo(group, spot) };
    }
    for (const area of candidates) {
        const blockers = groups.filter((item) => item !== group && blocks(area, item.area));
        if (blockers.length !== 1) continue;
        const [blocker] = blockers;
        const rest = groups.filter((item) => item !== group && item !== blocker).map((item) => item.area);
        const spot = findSpot(blocker.area.w, blocker.area.h, [...rest, area], ...centerOf(blocker.area));
        const cost = screenDistance(...centerOf(spot), ...centerOf(blocker.area));
        if (cost < best.cost)
            best = {
                cost,
                apply: () => {
                    moveTo(blocker, spot);
                    group.area = area;
                },
            };
    }
    best.apply();
}

// Where a building of the group stands now: its saved cell, moved along with the area and
// with any line removed by dropEmptyLines.
function currentCell(group, bookmark) {
    const saved = group.keepCells ? bookmark.cell : null;
    if (!saved || !Number.isInteger(saved.x) || !Number.isInteger(saved.y)) return null;
    const extra = group.extra.get(bookmark.id) ?? { x: 0, y: 0 };
    return { x: saved.x + group.dx + extra.x, y: saved.y + group.dy + extra.y };
}

// Removes rows/columns that hold no building until the area fits `target` cells, so a land
// loses the line a building left instead of being cut elsewhere and repacked. A line inside
// the area closes from the side with fewer buildings; those buildings move one cell.
function dropEmptyLines(group, target) {
    const area = group.area;
    while (area.w * area.h > target) {
        const cells = [];
        for (const bookmark of group.items) {
            const cell = currentCell(group, bookmark);
            if (cell && cell.x >= area.x && cell.x < area.x + area.w && cell.y >= area.y && cell.y < area.y + area.h)
                cells.push({ bookmark, cell });
        }
        let best = null;
        for (const [axis, size] of [
            ["x", "w"],
            ["y", "h"],
        ]) {
            if (area[size] <= 2) continue;
            for (let at = area[axis]; at < area[axis] + area[size]; at++) {
                if (cells.some(({ cell }) => cell[axis] === at)) continue;
                const before = cells.filter(({ cell }) => cell[axis] < at);
                const after = cells.filter(({ cell }) => cell[axis] > at);
                const fromAfter = after.length <= before.length;
                const moving = fromAfter ? after : before;
                const w = area.w - (axis === "x" ? 1 : 0);
                const h = area.h - (axis === "y" ? 1 : 0);
                // Fewest buildings moved, then the squarer result, then the first line found.
                const cost = [moving.length, Math.abs(w - h)];
                if (!best || cost[0] < best.cost[0] || (cost[0] === best.cost[0] && cost[1] < best.cost[1]))
                    best = { axis, size, fromAfter, moving, cost };
            }
        }
        if (!best) return;
        const { axis, size, fromAfter, moving } = best;
        area[size] -= 1;
        if (!fromAfter) area[axis] += 1;
        for (const { bookmark } of moving) {
            const extra = group.extra.get(bookmark.id) ?? { x: 0, y: 0 };
            group.extra.set(bookmark.id, { ...extra, [axis]: extra[axis] + (fromAfter ? -1 : 1) });
        }
    }
}

function shrink(group) {
    const [short, long] = targetShape(group.count);
    dropEmptyLines(group, short * long);
    if (group.area.w * group.area.h <= short * long) return;
    const old = group.area;
    // Only a shape that fits inside the old area, so shrinking never reaches into a neighbour
    // (a building move can leave a long thin land that a squarer shape would stick out of).
    const fits = ([w, h]) => w <= old.w && h <= old.h;
    const shape = [old.w >= old.h ? [long, short] : [short, long], old.w >= old.h ? [short, long] : [long, short]].find(
        fits,
    );
    if (!shape) return;
    const [w, h] = shape;
    // Keep the side nearest the middle; buildings outside are repacked later.
    const [cx, cy] = centerOf(old);
    group.area = {
        x: cx >= 0 ? old.x : old.x + old.w - w,
        y: cy >= 0 ? old.y : old.y + old.h - h,
        w,
        h,
    };
}

// Pull areas toward the middle while there is room, so neighbours share one road instead of
// leaving a double road or a thin lot strip between them. Areas in `pinned` stay put.
function compact(groups, pinned) {
    for (let moved = true, rounds = 0; moved && rounds < 100; rounds++) {
        moved = false;
        const order = [...groups].sort(
            (a, b) => screenDistance(...centerOf(a.area), 0, 0) - screenDistance(...centerOf(b.area), 0, 0),
        );
        for (const group of order) {
            if (pinned.has(String(group.category.id))) continue;
            const others = groups.filter((item) => item !== group).map((item) => item.area);
            const [cx, cy] = centerOf(group.area);
            const sx = -Math.sign(Math.round(cx));
            const sy = -Math.sign(Math.round(cy));
            // Two steps when one would stop at a double road, so a lot strip can close to a shared road.
            for (const [dx, dy] of [
                [sx, sy],
                [sx, 0],
                [0, sy],
                [sx * 2, 0],
                [0, sy * 2],
            ]) {
                if (dx === 0 && dy === 0) continue;
                const area = { ...group.area, x: group.area.x + dx, y: group.area.y + dy };
                const closer =
                    screenDistance(...centerOf(area), 0, 0) < screenDistance(...centerOf(group.area), 0, 0) - 1e-9;
                if (closer && isFree(area, others)) {
                    moveTo(group, area);
                    moved = true;
                    break;
                }
            }
        }
    }
}

// Saved layouts (and a building move's shifted areas) may hold double roads. Move one area of
// each such pair: one cell closer to share the road, one cell away to leave a lot strip, or
// else the nearest free spot. The area farther from the middle moves; `pinned` ones stay put.
// When both are pinned, the one later in `pinned` may still shift one cell (a building move
// pins the land it went into first and the land it left second).
function fixDoubleRoads(groups, pinned) {
    const rank = (group) => pinned.indexOf(String(group.category.id));
    const away = (group) => screenDistance(...centerOf(group.area), 0, 0);
    const skip = new Set();
    for (let rounds = 0; rounds < 100; rounds++) {
        let pair = null;
        for (const a of groups)
            for (const b of groups)
                if (!pair && a !== b && doubleRoad(a.area, b.area) && !skip.has(`${a.category.id}|${b.category.id}`))
                    pair = [a, b];
        if (!pair) return;
        const [a, b] = pair;
        const [ra, rb] = [rank(a), rank(b)];
        let group = a;
        if (ra < 0 && rb < 0) group = away(a) >= away(b) ? a : b;
        else if (ra < 0 || rb < 0) group = ra < 0 ? a : b;
        else group = ra > rb ? a : b;
        const other = group === a ? b : a;
        const others = groups.filter((item) => item !== group).map((item) => item.area);
        const [gx] = gaps(group.area, other.area);
        const axis = gx === 2 ? "x" : "y";
        const size = axis === "x" ? "w" : "h";
        const toward = other.area[axis] > group.area[axis] + group.area[size] ? 1 : -1;
        const shifted = (by) => ({ ...group.area, [axis]: group.area[axis] + by });
        let spot = [shifted(toward), shifted(-toward)].find((area) => isFree(area, others));
        if (!spot && rank(group) < 0) spot = findSpot(group.area.w, group.area.h, others, ...centerOf(group.area));
        if (spot) moveTo(group, spot);
        else skip.add(`${a.category.id}|${b.category.id}`).add(`${b.category.id}|${a.category.id}`); // pinned and boxed in
    }
}

// `spread` places every building of the land anew (after the land changed size), so buildings
// stand apart across the whole land instead of keeping their old corner.
function placeBuildings(group, spread) {
    const { area } = group;
    const taken = new Set();
    const cells = new Map();
    const waiting = [];
    for (const bookmark of group.items) {
        const cell = spread ? null : currentCell(group, bookmark);
        const key = cell && `${cell.x},${cell.y}`;
        const inside =
            cell &&
            Number.isInteger(cell.x) &&
            Number.isInteger(cell.y) &&
            cell.x >= area.x &&
            cell.x < area.x + area.w &&
            cell.y >= area.y &&
            cell.y < area.y + area.h;
        if (inside && !taken.has(key)) {
            taken.add(key);
            cells.set(bookmark.id, cell);
        } else {
            waiting.push(bookmark);
        }
    }
    const free = [];
    for (let y = area.y; y < area.y + area.h; y++)
        for (let x = area.x; x < area.x + area.w; x++) if (!taken.has(`${x},${y}`)) free.push({ x, y });
    // The name picket takes the free cell nearest the land's front (bottom) corner.
    const front = { x: area.x + area.w - 1, y: area.y + area.h - 1 };
    const nearFront = (cell) => Math.abs(cell.x - front.x) + Math.abs(cell.y - front.y);
    let picket = null;
    for (const cell of free) if (!picket || nearFront(cell) < nearFront(picket)) picket = cell;
    const open = free.filter((cell) => cell !== picket);
    // New buildings prefer a free cell with no building beside it, then the checkerboard cells
    // (the picket's colour stays for decorations), then a cell picked by the bookmark id.
    const neighbours = (cell) =>
        [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ].filter(([dx, dy]) => taken.has(`${cell.x + dx},${cell.y + dy}`)).length;
    const offBoard = (cell) => (cell.x + cell.y + front.x + front.y + 1) % 2;
    for (const bookmark of waiting) {
        if (!open.length) {
            open.push(picket); // no room left: the picket gives way until the land grows
            picket = null;
        }
        const score = (cell) => [neighbours(cell), offBoard(cell), hashText(`${bookmark.id}:${cell.x},${cell.y}`)];
        let best = 0;
        for (let i = 1; i < open.length; i++) {
            const [a, b] = [score(open[i]), score(open[best])];
            if (a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])))) best = i;
        }
        const [cell] = open.splice(best, 1);
        taken.add(`${cell.x},${cell.y}`);
        cells.set(bookmark.id, cell);
    }
    group.picket = picket;
    return cells;
}

/**
 * Plans the whole city from saved data.
 * Returns the groups to draw and `changed`, the areas and cells that differ from storage.
 * Areas are pulled toward the middle only when one shrank, so a saved plan stays as it is.
 * A building move (building-move.js) passes `compactAll` to also close gaps the move opened,
 * and `pinned` (category ids) for the lands the building left and went into, so they stay put.
 * @param {object[]} savedCategories
 * @param {object[]} savedBookmarks
 * @param {{pinned?: Iterable<string>, compactAll?: boolean}} [options]
 */
export function planCity(savedCategories, savedBookmarks, { pinned = [], compactAll = false } = {}) {
    const byCategory = new Map();
    for (const bookmark of savedBookmarks) {
        const id = String(bookmark.category);
        if (!byCategory.has(id)) byCategory.set(id, []);
        byCategory.get(id).push(bookmark);
    }
    const groups = savedCategories.map((category) => {
        const items = byCategory.get(String(category.id)) ?? [];
        return { category, items, count: items.length, area: null, dx: 0, dy: 0, extra: new Map(), keepCells: true };
    });

    // 1. Keep saved areas that are still valid and do not collide. A double road is not a
    // collision here: fixDoubleRoads nudges such an area instead of sending it far away.
    const pinnedIds = [...pinned].map(String);
    const placed = [];
    for (const group of groups) {
        const area = group.category.area;
        if (validArea(area) && placed.every((item) => !overlaps(area, item.area))) {
            group.area = { x: area.x, y: area.y, w: area.w, h: area.h };
            placed.push(group);
        }
    }
    fixDoubleRoads(placed, pinnedIds);

    // 2. Resize existing areas to fit their buildings.
    let shrank = false;
    for (const group of placed) {
        if (needsGrow(group)) grow(group, placed);
        else if (needsShrink(group)) {
            shrink(group);
            shrank = true;
        }
    }

    // 3. New categories go to the free spot closest to the middle.
    for (const group of groups) {
        if (group.area) continue;
        const [short, long] = targetShape(group.count);
        const others = placed.map((item) => item.area);
        const options = [findSpot(long, short, others, 0, 0), findSpot(short, long, others, 0, 0)];
        options.sort((a, b) => screenDistance(...centerOf(a), 0, 0) - screenDistance(...centerOf(b), 0, 0));
        group.area = options[0];
        placed.push(group);
    }

    if (shrank || compactAll) compact(placed, new Set(pinnedIds));
    // A shrunk area can leave two cells to a neighbour it used to share a road with.
    fixDoubleRoads(placed, pinnedIds);

    const changed = { areas: new Map(), cells: new Map() };
    for (const group of groups) {
        const saved = group.category.area;
        // A land the plan resized spreads its buildings again; lands a building move pinned keep theirs.
        const resized = !saved || saved.w !== group.area.w || saved.h !== group.area.h;
        group.cells = placeBuildings(group, resized && !pinnedIds.includes(String(group.category.id)));
        if (!group.keepCells) continue;
        const { x, y, w, h } = group.area;
        if (!saved || saved.x !== x || saved.y !== y || saved.w !== w || saved.h !== h)
            changed.areas.set(group.category.id, group.area);
        for (const bookmark of group.items) {
            const cell = group.cells.get(bookmark.id);
            if (bookmark.cell?.x !== cell.x || bookmark.cell?.y !== cell.y) changed.cells.set(bookmark.id, cell);
        }
    }
    groups.sort((a, b) => Number(a.category.isGeneral === true) - Number(b.category.isGeneral === true));
    return { groups, changed };
}

// Road tile for each combination of connected edges (NW, NE, SE, SW).
const roadTiles = {
    "NW,SE": "straight_SE",
    "NE,SW": "straight_SW",
    "SE,SW": "corner_N",
    "NW,SW": "corner_E",
    "NW,NE": "corner_S",
    "NE,SE": "corner_W",
    SW: "end_NE",
    SE: "end_NW",
    NW: "end_SE",
    NE: "end_SW",
    "NW,NE,SE": "intersection_NE",
    "NW,NE,SW": "intersection_NW",
    "NE,SE,SW": "intersection_SE",
    "NW,SE,SW": "intersection_SW",
    "NW,NE,SE,SW": "xsing",
};

// Roads run around every area. Only cells on the same ring connect, so two
// parallel roads side by side stay separate streets.
export function planRoads(areas) {
    const roads = new Map();
    const link = (x, y, side) => {
        const key = `${x},${y}`;
        if (!roads.has(key)) roads.set(key, { x, y, sides: new Set() });
        if (side) roads.get(key).sides.add(side);
    };
    for (const { x, y, w, h } of areas) {
        const left = x - 1;
        const top = y - 1;
        const right = x + w;
        const bottom = y + h;
        for (let c = left; c <= right; c++) {
            for (const r of [top, bottom]) {
                if (c > left) link(c, r, "NW");
                if (c < right) link(c, r, "SE");
            }
        }
        for (let r = top; r <= bottom; r++) {
            for (const c of [left, right]) {
                if (r > top) link(c, r, "NE");
                if (r < bottom) link(c, r, "SW");
            }
        }
    }
    const order = ["NW", "NE", "SE", "SW"];
    // A straight road next to a junction gets a crosswalk ("pelican") on that end.
    const steps = { NW: [-1, 0], SE: [1, 0], NE: [0, -1], SW: [0, 1] };
    const opposite = { NW: "SE", SE: "NW", NE: "SW", SW: "NE" };
    const isJunction = (x, y, from) => {
        const road = roads.get(`${x},${y}`);
        return road && road.sides.size >= 3 && road.sides.has(from);
    };
    return [...roads.values()].map(({ x, y, sides }) => {
        let name = roadTiles[order.filter((side) => sides.has(side)).join(",")];
        if (name.startsWith("straight_")) {
            const end = [...sides].find((side) => isJunction(x + steps[side][0], y + steps[side][1], opposite[side]));
            if (end) name = `pelican_${end}`;
        }
        return { x, y, tile: `../assets/Isometric City/Roads and Grounds/tile_road_${name}_normal.png` };
    });
}

// Top vertex of grid point (x, y) in world pixels.
export function project(x, y) {
    return { left: ((x - y) * TILE_WIDTH) / 2, top: ((x + y) * TILE_HEIGHT) / 2 };
}
