// Keep the saved background small enough to share storage with bookmarks and settings.
// These are automatic encoding targets, not restrictions on the selected file's size.
const TARGET_BYTES = 1024 * 1024;
const MAX_SIDE = 2560;
const MAX_QUALITY = 0.9;
const MIN_QUALITY = 0.6;

function canvasFor(image, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 처리하지 못했습니다. 다시 시도해 주세요.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    return canvas;
}

function encode(canvas, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error("이미지를 압축하지 못했습니다. 다른 이미지를 선택해 주세요."));
            },
            "image/webp",
            quality,
        );
    });
}

function asDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
            reject(new Error("이미지를 읽지 못했습니다. 다시 선택해 주세요.", { cause: reader.error }));
        reader.readAsDataURL(blob);
    });
}

export async function prepareBackgroundImage(file, { signal } = {}) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error("JPG, PNG, WEBP 이미지를 선택해 주세요.");
    signal?.throwIfAborted();
    const bitmap = await createImageBitmap(file);
    let canvas;
    try {
        signal?.throwIfAborted();
        if (file.size <= TARGET_BYTES && Math.max(bitmap.width, bitmap.height) <= MAX_SIDE)
            return await asDataUrl(file);
        const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        canvas = canvasFor(
            bitmap,
            Math.max(1, Math.round(bitmap.width * scale)),
            Math.max(1, Math.round(bitmap.height * scale)),
        );
    } finally {
        bitmap.close();
    }
    try {
        while (true) {
            signal?.throwIfAborted();
            let blob = await encode(canvas, MAX_QUALITY);
            signal?.throwIfAborted();
            if (blob.size <= TARGET_BYTES) return await asDataUrl(blob);
            const small = await encode(canvas, MIN_QUALITY);
            signal?.throwIfAborted();
            if (small.size <= TARGET_BYTES) {
                // Find the best quality within the storage target before reducing resolution again.
                let low = MIN_QUALITY;
                let high = MAX_QUALITY;
                blob = small;
                for (let attempt = 0; attempt < 5; attempt++) {
                    const quality = (low + high) / 2;
                    const candidate = await encode(canvas, quality);
                    signal?.throwIfAborted();
                    if (candidate.size <= TARGET_BYTES) {
                        blob = candidate;
                        low = quality;
                    } else high = quality;
                }
                return await asDataUrl(blob);
            }
            if (canvas.width === 1 && canvas.height === 1)
                throw new Error("이미지를 압축하지 못했습니다. 다른 이미지를 선택해 주세요.");
            const scale = Math.max(0.5, Math.min(0.85, Math.sqrt(TARGET_BYTES / small.size) * 0.9));
            const resized = canvasFor(
                canvas,
                Math.max(1, Math.floor(canvas.width * scale)),
                Math.max(1, Math.floor(canvas.height * scale)),
            );
            canvas.width = 0;
            canvas.height = 0;
            canvas = resized;
        }
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
}
