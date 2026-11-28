// Undeveloped-lot ground that fills the map outside categories and roads, in the tile kind
// chosen in the settings.
// Pure functions. Nothing here is saved: the background is recomputed from the
// current areas and roads on every render, so it follows any layout change.

import { TILE_HEIGHT, TILE_WIDTH } from "./layout.js";

const GROUND = "../assets/Isometric City/Roads and Grounds/tile_ground_";

// Stable pseudo-random value in [0, 1) per cell, so a cell keeps its tile across renders.
function hash(x, y) {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Mostly plain dirt, with a few fixed variations so the repetition is less visible.
function dirtTile(x, y) {
    const r = hash(x, y);
    if (r < 0.06) return "dirt_grasspatch";
    if (r < 0.11) return "dirt_drypatch";
    if (r < 0.13) return "dirt_puddle";
    if (r < 0.14) return "dirt_puddles";
    return "dirt";
}

function grassTile(x, y) {
    const r = hash(x, y);
    if (r < 0.03) return "grass_puddle_clean";
    if (r < 0.04) return "grass_puddles_clean";
    return "grass";
}

// Smooth noise in [0, 1): random values on a coarse lattice, blended between lattice points, so
// neighbouring cells get similar values and thresholds make round blobs instead of speckles.
function blobs(x, y, size, seed) {
    const gx = x / size,
        gy = y / size;
    const x0 = Math.floor(gx),
        y0 = Math.floor(gy);
    const ease = (t) => t * t * (3 - 2 * t);
    const fx = ease(gx - x0),
        fy = ease(gy - y0);
    const at = (dx, dy) => hash((x0 + dx) * 31 + seed, (y0 + dy) * 17 - seed);
    const top = at(0, 0) + (at(1, 0) - at(0, 0)) * fx;
    const bottom = at(0, 1) + (at(1, 1) - at(0, 1)) * fx;
    return top + (bottom - top) * fy;
}

// Grass shore tiles by the corners under water, read as N (top), E, S, W. A corner is under water
// only when all four cells around it are pond cells, so water never touches a land or road tile.
const SHORE = {
    N: "watercorner_N",
    E: "watercorner_E",
    S: "watercorner_S",
    W: "watercorner_W",
    NE: "water_NE",
    ES: "water_SE",
    SW: "water_SW",
    NW: "water_NW",
    NES: "wateredge_E",
    ESW: "wateredge_S",
    NSW: "wateredge_W",
    NEW: "wateredge_N",
};

// "섞기": grass with fields of dirt and ponds with grass shores.
function mixedTile(x, y, land) {
    const pond = (cx, cy) => !land.has(`${cx},${cy}`) && blobs(cx, cy, 5, 1) > 0.7;
    if (pond(x, y)) {
        // Corner points N (x, y), E (x+1, y), S (x+1, y+1), W (x, y+1); each touches the four cells
        // whose top-left corner is one step up and left of it.
        const wet = (px, py) => pond(px - 1, py - 1) && pond(px, py - 1) && pond(px - 1, py) && pond(px, py);
        const corners = [
            ["N", wet(x, y)],
            ["E", wet(x + 1, y)],
            ["S", wet(x + 1, y + 1)],
            ["W", wet(x, y + 1)],
        ]
            .filter(([, under]) => under)
            .map(([name]) => name)
            .join("");
        if (corners === "NESW" || corners === "NS" || corners === "EW") return "water";
        if (corners) return `grass_${SHORE[corners]}_clean`;
    }
    return blobs(x, y, 4, 2) > 0.68 ? dirtTile(x, y) : grassTile(x, y);
}

/**
 * Lot tiles for every cell in `bounds` that is not in `land`.
 * @param {Set<string>} land  "x,y" keys of category and road cells
 * @param {{minX:number,maxX:number,minY:number,maxY:number}} bounds
 * @param {"dirt"|"grass"|"water"|"mixed"} [kind]
 * @returns {{x:number,y:number,src:string}[]}
 */
export function planBackground(land, bounds, kind = "dirt") {
    const tileAt =
        {
            dirt: dirtTile,
            grass: grassTile,
            water: () => "water",
            mixed: (x, y) => mixedTile(x, y, land),
        }[kind] ?? dirtTile;
    const tiles = [];
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            if (!land.has(`${x},${y}`)) tiles.push({ x, y, src: `${GROUND}${tileAt(x, y)}.png` });
        }
    }
    return tiles;
}

// Grid cells covering a world-pixel rectangle (inverse of layout.js `project`), plus `pad` cells.
export function cellBounds(left, top, right, bottom, pad = 2) {
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    const toCell = (l, t) => [(t / halfH + l / halfW) / 2, (t / halfH - l / halfW) / 2];
    const corners = [toCell(left, top), toCell(right, top), toCell(left, bottom), toCell(right, bottom)];
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    return {
        minX: Math.floor(Math.min(...xs)) - pad,
        maxX: Math.ceil(Math.max(...xs)) + pad,
        minY: Math.floor(Math.min(...ys)) - pad,
        maxY: Math.ceil(Math.max(...ys)) + pad,
    };
}
