// Cache the solid building silhouette; translucent shadows are not hover targets.
const appearances = new Map();
const visualBounds = new WeakMap();

export function buildingVisualBounds(image) {
    return visualBounds.get(image) ?? { left: 0, right: 1, top: 0, bottom: 1 };
}

async function readAppearance(image) {
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const left = [];
    const right = [];
    let minX = canvas.width,
        maxX = 0,
        minY = canvas.height,
        maxY = 0;
    const point = (x, y) => `${(x / canvas.width) * 100}% ${(y / canvas.height) * 100}%`;
    for (let y = 0; y < canvas.height; y++) {
        let first = -1;
        let last = -1;
        for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            // Include visible shadow pixels for spacing, but not for hit testing.
            if (data[i + 3] >= 8) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x + 1);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y + 1);
            }
            if (data[i + 3] < 128) continue;
            if (first === -1) first = x;
            last = x;
        }
        if (first === -1) continue;
        left.push(point(first, y), point(first, y + 1));
        right.push(point(last + 1, y), point(last + 1, y + 1));
    }
    if (!left.length) throw new Error("건물 윤곽을 찾을 수 없습니다.");
    return {
        hitShape: `polygon(${[...left, ...right.reverse()].join(",")})`,
        bounds: {
            left: minX / canvas.width,
            right: maxX / canvas.width,
            top: minY / canvas.height,
            bottom: maxY / canvas.height,
        },
    };
}

export async function prepareBuildingAppearance(image, hitArea) {
    let appearance = appearances.get(image.src);
    if (!appearance) {
        appearance = readAppearance(image);
        appearances.set(image.src, appearance);
    }
    try {
        const { hitShape, bounds } = await appearance;
        visualBounds.set(image, bounds);
        hitArea.style.clipPath = hitShape;
        hitArea.style.pointerEvents = "auto";
    } catch (error) {
        appearances.delete(image.src);
        throw error;
    }
}

// Load the prepared wall mask paired with this exact asset.
export function applyPreparedWallMask(image, tint, light) {
    const maskPath = `../assets/wall-mask-buildings/wall-mask-${image.src.split("/").pop()}`;
    const maskUrl = `url("${maskPath}")`;
    for (const layer of [tint, light]) {
        layer.style.setProperty("--wall-mask", maskUrl);
        layer.style.setProperty("-webkit-mask-image", maskUrl);
    }
}
