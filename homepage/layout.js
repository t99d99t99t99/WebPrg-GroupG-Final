// City layout on an isometric grid where one cell holds one building.
// A category owns a rectangle of cells (`area`), wrapped by a one-cell road ring
// that neighbours share. Areas and building cells are saved, so a plan keeps
// existing positions and only grows, shrinks, or moves what it has to.

export const TILE_WIDTH = 128;
export const TILE_HEIGHT = 64;

export const colors = ["#a6bce9", "#6aab92", "#e78674", "#e9b962", "#b69be0", "#7fc6d6"];

// Placeholder set of one-cell (128px wide) buildings; the final choice is made elsewhere.
const BUILDING_DIR = "../assets/Isometric City/Buildings/";
const buildingNames = [
    "bld_house_small_blue_a",
    "bld_house_small_red_a",
    "bld_house_small_yellow_a",
    "bld_house_medium_green_a",
    "bld_house_medium_white_a",
    "bld_house_tall_blue_a",
    "bld_house_tall_brickbrown_a",
    "bld_cafe_a",
    "bld_pizza_a",
    "bld_icecream_a",
    "bld_clinic_a",
];

export function buildingImage(id) {
    let hash = 0;
    for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    return `${BUILDING_DIR}${buildingNames[hash % buildingNames.length]}.png`;
}

// 2x2 -> 2x3 -> 3x3 -> 3x4 -> 4x4 ... returned as [short, long].
function shapeFor(count) {
    let short = 2;
    let long = 2;
    while (short * long < count) {
        if (short === long) long++;
        else short++;
    }
    return [short, long];
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

// Areas must keep at least one cell between them for the shared road.
function blocks(a, b) {
    return a.x < b.x + b.w + 1 && b.x < a.x + a.w + 1 && a.y < b.y + b.h + 1 && b.y < a.y + a.h + 1;
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
    const [short, long] = shapeFor(group.count);
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

function shrink(group) {
    const [short, long] = shapeFor(group.count);
    const old = group.area;
    const [w, h] = old.w >= old.h ? [long, short] : [short, long];
    // Keep the side nearest the middle; buildings outside are repacked later.
    const [cx, cy] = centerOf(old);
    group.area = {
        x: cx >= 0 ? old.x : old.x + old.w - w,
        y: cy >= 0 ? old.y : old.y + old.h - h,
        w,
        h,
    };
}

// After something shrank, pull areas toward the middle while there is room.
function compact(groups) {
    for (let moved = true, rounds = 0; moved && rounds < 100; rounds++) {
        moved = false;
        const order = [...groups].sort(
            (a, b) => screenDistance(...centerOf(a.area), 0, 0) - screenDistance(...centerOf(b.area), 0, 0),
        );
        for (const group of order) {
            const others = groups.filter((item) => item !== group).map((item) => item.area);
            const [cx, cy] = centerOf(group.area);
            const sx = -Math.sign(Math.round(cx));
            const sy = -Math.sign(Math.round(cy));
            for (const [dx, dy] of [
                [sx, sy],
                [sx, 0],
                [0, sy],
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

function placeBuildings(group) {
    const { area } = group;
    const taken = new Set();
    const cells = new Map();
    const waiting = [];
    for (const bookmark of group.items) {
        const saved = group.keepCells ? bookmark.cell : null;
        const cell = saved && { x: saved.x + group.dx, y: saved.y + group.dy };
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
    // New buildings take the first free cell.
    for (let y = area.y; y < area.y + area.h && waiting.length; y++) {
        for (let x = area.x; x < area.x + area.w && waiting.length; x++) {
            if (!taken.has(`${x},${y}`)) {
                taken.add(`${x},${y}`);
                cells.set(waiting.shift().id, { x, y });
            }
        }
    }
    return cells;
}

/**
 * Plans the whole city from saved data.
 * Returns the groups to draw and `changed`, the areas and cells that differ from storage.
 */
export function planCity(savedCategories, savedBookmarks) {
    const known = new Set(savedCategories.map((category) => String(category.id)));
    const groups = savedCategories.map((category) => {
        const items = savedBookmarks.filter((bookmark) => String(bookmark.category) === String(category.id));
        return { category, items, count: items.length, area: null, dx: 0, dy: 0, keepCells: true };
    });

    // 1. Keep saved areas that are still valid and do not collide.
    const placed = [];
    for (const group of groups) {
        const area = group.category.area;
        if (validArea(area) && isFree(area, placed.map((item) => item.area))) {
            group.area = { x: area.x, y: area.y, w: area.w, h: area.h };
            placed.push(group);
        }
    }

    // 2. Resize existing areas to fit their buildings.
    let shrank = false;
    for (const group of placed) {
        const [short, long] = shapeFor(group.count);
        const capacity = group.area.w * group.area.h;
        if (capacity < group.count) grow(group, placed);
        else if (short * long < capacity) {
            shrink(group);
            shrank = true;
        }
    }

    // 3. New categories go to the free spot closest to the middle.
    for (const group of groups) {
        if (group.area) continue;
        const [short, long] = shapeFor(group.count);
        const others = placed.map((item) => item.area);
        const options = [findSpot(long, short, others, 0, 0), findSpot(short, long, others, 0, 0)];
        options.sort((a, b) => screenDistance(...centerOf(a), 0, 0) - screenDistance(...centerOf(b), 0, 0));
        group.area = options[0];
        placed.push(group);
    }

    if (shrank) compact(placed);

    // Bookmarks whose category no longer exists. Not saved, so it is always placed last.
    const unassigned = savedBookmarks.filter((bookmark) => !known.has(String(bookmark.category)));
    if (unassigned.length) {
        const [short, long] = shapeFor(unassigned.length);
        groups.push({
            category: { id: "uncategorized", name: "분류 없음" },
            items: unassigned,
            count: unassigned.length,
            area: findSpot(long, short, placed.map((item) => item.area), 0, 0),
            dx: 0,
            dy: 0,
            keepCells: false,
        });
    }

    const changed = { areas: new Map(), cells: new Map() };
    for (const group of groups) {
        group.cells = placeBuildings(group);
        if (!group.keepCells) continue;
        const saved = group.category.area;
        const { x, y, w, h } = group.area;
        if (!saved || saved.x !== x || saved.y !== y || saved.w !== w || saved.h !== h)
            changed.areas.set(group.category.id, group.area);
        for (const bookmark of group.items) {
            const cell = group.cells.get(bookmark.id);
            if (bookmark.cell?.x !== cell.x || bookmark.cell?.y !== cell.y) changed.cells.set(bookmark.id, cell);
        }
    }
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
    return [...roads.values()].map(({ x, y, sides }) => {
        const name = roadTiles[order.filter((side) => sides.has(side)).join(",")];
        return { x, y, tile: `../assets/Isometric City/Roads and Grounds/tile_road_${name}_normal.png` };
    });
}

// Top vertex of grid point (x, y) in world pixels.
export function project(x, y) {
    return { left: ((x - y) * TILE_WIDTH) / 2, top: ((x + y) * TILE_HEIGHT) / 2 };
}
