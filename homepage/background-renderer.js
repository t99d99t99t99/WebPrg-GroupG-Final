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

function paintFill(context, fill, width, height, photoImage) {
    if (fill.mode === "none" || fill.mode === "tile") return;
    if (fill.mode === "photo") {
        if (!photoImage) return;
        const scale = Math.max(width / photoImage.width, height / photoImage.height);
        const imageWidth = photoImage.width * scale;
        const imageHeight = photoImage.height * scale;
        context.drawImage(photoImage, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
        return;
    }
    if (fill.colorMode === "gradient") {
        const angle = (fill.angle * Math.PI) / 180;
        const dx = Math.sin(angle);
        const dy = -Math.cos(angle);
        const reach = Math.abs(dx * width) / 2 + Math.abs(dy * height) / 2;
        const gradient = context.createLinearGradient(
            width / 2 - dx * reach,
            height / 2 - dy * reach,
            width / 2 + dx * reach,
            height / 2 + dy * reach,
        );
        gradient.addColorStop(0, fill.gradientStart);
        gradient.addColorStop(1, fill.gradientEnd);
        context.fillStyle = gradient;
    } else {
        context.fillStyle = fill.solidColor;
    }
    context.fillRect(0, 0, width, height);
}

// Rasterise only at screen/design resolution, even when the world is zoomed far out.
export async function paintBackground(layer, { land, view, width, height, fill, pixelRatio = 1 }) {
    const version = (versions.get(layer) ?? 0) + 1;
    versions.set(layer, version);
    const { x, y, zoom } = view;
    // Overscan keeps short camera gestures covered while the cached canvas follows the world.
    // A whole number of device pixels keeps the canvas edge, and so every tile, on the pixel grid.
    const padding = Math.round(256 * pixelRatio) / pixelRatio;
    const left = (-x - padding) / zoom,
        top = (-y - padding) / zoom;
    const paintWidth = width + padding * 2,
        paintHeight = height + padding * 2;
    const bounds = cellBounds(left, top, (width + padding - x) / zoom, (height + padding - y) / zoom);
    const tiles = fill.mode === "tile" ? planBackground(land, bounds) : [];
    const sources = [...new Set(tiles.map((tile) => tile.src))];
    const loaded = await Promise.all(sources.map(load));
    const photoImage = fill.mode === "photo" && fill.photoDataUrl ? await load(fill.photoDataUrl) : null;
    if (versions.get(layer) !== version || !layer.isConnected) return;
    const sprites = new Map(sources.map((src, i) => [src, loaded[i]]));
    const canvas = document.createElement("canvas");
    // One canvas pixel per device pixel, so tiles are as sharp as the map above them.
    // ponytail: capped at 16M pixels (about 64MB); larger screens fall back to a softer background.
    const resolution = Math.min(pixelRatio, Math.sqrt(16_000_000 / (paintWidth * paintHeight)));
    canvas.width = Math.ceil(paintWidth * resolution);
    canvas.height = Math.ceil(paintHeight * resolution);
    canvas.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${paintWidth / zoom}px;height:${paintHeight / zoom}px;pointer-events:none`;
    canvas.setAttribute("aria-hidden", "true");
    const context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.scale(resolution, resolution);
    paintFill(context, fill, paintWidth, paintHeight, photoImage);
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
