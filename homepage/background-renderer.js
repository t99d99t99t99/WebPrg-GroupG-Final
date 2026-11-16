import { cellBounds, planBackground } from "./background.js";
import { project, TILE_HEIGHT, TILE_WIDTH } from "./layout.js";

const images = new Map();
const versions = new WeakMap();
function load(src) {
    if (!images.has(src)) {
        const promise = new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => {
                images.delete(src);
                reject(new Error("배경 이미지를 불러오지 못했습니다."));
            };
            image.src = src;
        });
        images.set(src, promise);
    }
    return images.get(src);
}

// Rasterise only at screen/design resolution, even when the world is zoomed far out.
export async function paintBackground(layer, { land, view, width, height }) {
    const version = (versions.get(layer) ?? 0) + 1;
    versions.set(layer, version);
    const { x, y, zoom } = view;
    const left = -x / zoom,
        top = -y / zoom;
    const bounds = cellBounds(left, top, (width - x) / zoom, (height - y) / zoom);
    const tiles = planBackground(land, bounds);
    const sources = [...new Set(tiles.map((tile) => tile.src))];
    const loaded = await Promise.all(sources.map(load));
    if (versions.get(layer) !== version || !layer.isConnected) return;
    const sprites = new Map(sources.map((src, i) => [src, loaded[i]]));
    const canvas = document.createElement("canvas");
    const resolution = Math.min(1, Math.sqrt(4_000_000 / (width * height)));
    canvas.width = Math.ceil(width * resolution);
    canvas.height = Math.ceil(height * resolution);
    canvas.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${width / zoom}px;height:${height / zoom}px;pointer-events:none`;
    canvas.setAttribute("aria-hidden", "true");
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.scale(resolution, resolution);
    for (const tile of tiles) {
        const p = project(tile.x, tile.y);
        context.drawImage(
            sprites.get(tile.src),
            (p.left - TILE_WIDTH / 2 - left) * zoom,
            (p.top - top) * zoom,
            TILE_WIDTH * zoom,
            TILE_HEIGHT * zoom,
        );
    }
    layer.replaceChildren(canvas);
}
