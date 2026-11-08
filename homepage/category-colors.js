// Category palette and color assignment for categories without a saved color.
export const colors = ["#a1baee", "#65b093", "#f0806b", "#f3bc58", "#b596e5", "#78cadd"];

function hueOf(hex) {
    const values = hex.match(/[\da-f]{2}/gi)?.map((part) => Number.parseInt(part, 16) / 255);
    if (!values || values.length < 3) return null;
    const [r, g, b] = values;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (!delta) return 0;
    const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    return (hue * 60 + 360) % 360;
}

function hslOf(hex) {
    const values = hex.match(/[\da-f]{2}/gi)?.map((part) => Number.parseInt(part, 16) / 255);
    const [r, g, b] = values ?? [];
    if (values?.length < 3) return null;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const delta = max - min;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    return { hue: hueOf(hex), saturation, lightness };
}

function toHex({ hue, saturation, lightness }) {
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = lightness - chroma / 2;
    const [r, g, b] =
        hue < 60
            ? [chroma, x, 0]
            : hue < 120
              ? [x, chroma, 0]
              : hue < 180
                ? [0, chroma, x]
                : hue < 240
                  ? [0, x, chroma]
                  : hue < 300
                    ? [x, 0, chroma]
                    : [chroma, 0, x];
    return `#${[r, g, b]
        .map((value) =>
            Math.round((value + m) * 255)
                .toString(16)
                .padStart(2, "0"),
        )
        .join("")}`;
}

export function assignCategoryColors(categories) {
    const missing = categories.filter((category) => !/^#[\da-f]{6}$/i.test(category.color ?? ""));
    if (!missing.length) return { categories, changes: new Map() };
    const changes = new Map();
    if (missing.length === categories.length) {
        missing.forEach((category, index) => {
            changes.set(category.id, colors[index % colors.length]);
        });
    } else {
        const legacy = colors.map(hslOf).filter(Boolean);
        const saturation = legacy.reduce((sum, item) => sum + item.saturation, 0) / legacy.length;
        const lightness = legacy.reduce((sum, item) => sum + item.lightness, 0) / legacy.length;
        const usedHues = categories
            .filter((category) => category.color)
            .map((category) => hueOf(category.color))
            .filter(Number.isFinite);
        for (const category of missing) {
            let bestHue = 0;
            let bestDistance = -1;
            for (let hue = 0; hue < 360; hue++) {
                const distance = usedHues.length
                    ? Math.min(...usedHues.map((used) => Math.min(Math.abs(hue - used), 360 - Math.abs(hue - used))))
                    : 180;
                if (distance > bestDistance) {
                    bestDistance = distance;
                    bestHue = hue;
                }
            }
            usedHues.push(bestHue);
            changes.set(category.id, toHex({ hue: bestHue, saturation, lightness }));
        }
    }
    return {
        categories: categories.map((category) => ({ ...category, color: changes.get(category.id) ?? category.color })),
        changes,
    };
}
