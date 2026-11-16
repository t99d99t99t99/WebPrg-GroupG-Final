// Undeveloped-lot ground that fills the map outside categories and roads.
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
function lotTile(x, y) {
    const r = hash(x, y);
    if (r < 0.06) return "dirt_grasspatch";
    if (r < 0.11) return "dirt_drypatch";
    if (r < 0.13) return "dirt_puddle";
    if (r < 0.14) return "dirt_puddles";
    return "dirt";
}

/**
 * Lot tiles for every cell in `bounds` that is not in `land`.
 * @param {Set<string>} land  "x,y" keys of category and road cells
 * @param {{minX:number,maxX:number,minY:number,maxY:number}} bounds
 * @returns {{x:number,y:number,src:string}[]}
 */
export function planBackground(land, bounds) {
    const tiles = [];
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            if (!land.has(`${x},${y}`)) tiles.push({ x, y, src: `${GROUND}${lotTile(x, y)}.png` });
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
