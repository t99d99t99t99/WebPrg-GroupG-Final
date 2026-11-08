// Cache the solid building silhouette; translucent shadows are not hover targets.
const appearances = new Map();

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
    const point = (x, y) => `${(x / canvas.width) * 100}% ${(y / canvas.height) * 100}%`;
    for (let y = 0; y < canvas.height; y++) {
        let first = -1;
        let last = -1;
        for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            if (data[i + 3] < 128) continue;
            if (first === -1) first = x;
            last = x;
        }
        if (first === -1) continue;
        left.push(point(first, y), point(first, y + 1));
        right.push(point(last + 1, y), point(last + 1, y + 1));
    }
    if (!left.length) throw new Error("건물 윤곽을 찾을 수 없습니다.");
    return `polygon(${[...left, ...right.reverse()].join(",")})`;
}

export async function prepareBuildingAppearance(image, hitArea) {
    let appearance = appearances.get(image.src);
    if (!appearance) {
        appearance = readAppearance(image);
        appearances.set(image.src, appearance);
    }
    try {
        hitArea.style.clipPath = await appearance;
        hitArea.style.pointerEvents = "auto";
    } catch (error) {
        appearances.delete(image.src);
        throw error;
    }
}

// Load the prepared wall mask paired with this exact asset. The three original
// blue-house masks keep their existing filenames; every other sprite has a
// matching prebuilt mask in wall-mask-buildings/.
export function applyPreparedWallMask(image, tint, light) {
    const legacy = {
        "bld_house_small_blue_a.png": "../assets/wall-mask-house-small.png",
        "bld_house_medium_blue_a.png": "../assets/wall-mask-house-medium.png",
        "bld_house_tall_blue_a.png": "../assets/wall-mask-house-tall.png",
    }[image.src.split("/").pop()];
    const maskPath = legacy ?? `../assets/wall-mask-buildings/wall-mask-${image.src.split("/").pop()}`;
    const maskUrl = `url("${maskPath}")`;
    for (const layer of [tint, light]) {
        layer.style.setProperty("--wall-mask", maskUrl);
        layer.style.setProperty("-webkit-mask-image", maskUrl);
    }
}
