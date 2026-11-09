import { wallColorAdjustments } from "../../homepage/category-colors.js";
import { createMaskArchive } from "./mask-archive.js";
import { createMaskEditor } from "./mask-editor.js";

const BUILDING_FILES = [
    "bld_autoshop_a.png",
    "bld_autoshop_a_damaged.png",
    "bld_autoshop_b.png",
    "bld_autoshop_b_damaged.png",
    "bld_cafe_a.png",
    "bld_cafe_a_damaged.png",
    "bld_cafe_b.png",
    "bld_cafe_b_damaged.png",
    "bld_clinic_a.png",
    "bld_clinic_a_damaged.png",
    "bld_clinic_b.png",
    "bld_clinic_b_damaged.png",
    "bld_construction_b.png",
    "bld_contruction_a.png",
    "bld_fruitstand_a.png",
    "bld_fruitstand_a_damaged.png",
    "bld_fruitstand_b.png",
    "bld_fruitstand_b_damaged.png",
    "bld_gunshop_a.png",
    "bld_gunshop_a_damaged.png",
    "bld_gunshop_b.png",
    "bld_gunshop_b_damaged.png",
    "bld_house_medium_blue_a.png",
    "bld_house_medium_blue_a_damaged.png",
    "bld_house_medium_blue_b.png",
    "bld_house_medium_blue_b_damaged.png",
    "bld_house_medium_brickwhite_a.png",
    "bld_house_medium_brickwhite_a_damaged.png",
    "bld_house_medium_brickwhite_b.png",
    "bld_house_medium_brickwhite_b_damaged.png",
    "bld_house_medium_white_a.png",
    "bld_house_medium_white_a_damaged.png",
    "bld_house_medium_white_b.png",
    "bld_house_medium_white_b_damaged.png",
    "bld_house_small_blue_a.png",
    "bld_house_small_blue_a_damaged.png",
    "bld_house_small_blue_b.png",
    "bld_house_small_blue_b_damaged.png",
    "bld_house_small_brickred_a.png",
    "bld_house_small_brickred_a_damaged.png",
    "bld_house_small_brickred_b.png",
    "bld_house_small_brickred_b_damaged.png",
    "bld_house_small_yellow_a.png",
    "bld_house_small_yellow_a_damaged.png",
    "bld_house_small_yellow_b.png",
    "bld_house_small_yellow_b_damaged.png",
    "bld_house_tall_blue_a.png",
    "bld_house_tall_blue_a_damaged.png",
    "bld_house_tall_blue_b.png",
    "bld_house_tall_blue_b_damaged.png",
    "bld_house_tall_brickwhite_a.png",
    "bld_house_tall_brickwhite_a_damaged.png",
    "bld_house_tall_brickwhite_b.png",
    "bld_house_tall_brickwhite_b_damaged.png",
    "bld_house_tall_green_a.png",
    "bld_house_tall_green_a_damaged.png",
    "bld_house_tall_green_b.png",
    "bld_house_tall_green_b_damaged.png",
    "bld_icecream_a.png",
    "bld_icecream_a_damaged.png",
    "bld_icecream_b.png",
    "bld_icecream_b_damaged.png",
    "bld_pizza_a.png",
    "bld_pizza_a_damaged.png",
    "bld_pizza_b.png",
    "bld_pizza_b_damaged.png",
];

const assetGrid = document.getElementById("assetGrid");
const assetCount = document.getElementById("assetCount");
const assetSearch = document.getElementById("assetSearch");
const familyFilter = document.getElementById("familyFilter");
const maskChanges = document.getElementById("maskChanges");
const maskDownloadChanged = document.getElementById("maskDownloadChanged");
const maskDownloadAll = document.getElementById("maskDownloadAll");
const maskDownloadStatus = document.getElementById("maskDownloadStatus");
const maskStorageWarning = document.getElementById("maskStorageWarning");
const square = document.getElementById("colorSquare");
const handle = document.getElementById("colorHandle");
const hueRange = document.getElementById("hueRange");
const alphaRange = document.getElementById("alphaRange");
const alphaValue = document.getElementById("alphaValue");
const opacityInput = document.getElementById("opacityInput");
const hexInput = document.getElementById("hexInput");
const picker = document.querySelector(".picker");
const pickerDot = document.querySelector(".picker-dot");
const grassSaturationRange = document.getElementById("grassSaturationRange");
const grassSaturationValue = document.getElementById("grassSaturationValue");
const grassDarknessRange = document.getElementById("grassDarknessRange");
const grassDarknessValue = document.getElementById("grassDarknessValue");
const grassMinBrightnessRange = document.getElementById("grassMinBrightnessRange");
const grassMinBrightnessValue = document.getElementById("grassMinBrightnessValue");
const state = { hue: 218, saturation: 0.65, value: 0.87, alpha: 1 };

function familyFor(file) {
    if (file.includes("construction") || file.includes("contruction")) return "other";
    if (file.startsWith("bld_house_")) return "homes";
    if (/fruitstand|cafe|icecream|pizza/.test(file)) return "food-market";
    return "service-market";
}

function sizeFor(file) {
    if (file.includes("_small_") || file.includes("fruitstand") || file.includes("clinic")) return "small";
    if (file.includes("_medium_") || /cafe|icecream|autoshop/.test(file)) return "medium";
    if (file.includes("_tall_") || /pizza|gunshop/.test(file)) return "tall";
    return "small";
}

function readableName(file) {
    return file
        .replace(/^bld_/, "")
        .replace(/_a(?=(_damaged)?\.png$)/, " · A")
        .replace(/_b(?=(_damaged)?\.png$)/, " · B")
        .replace(/_damaged(?=\.png$)/, " · 파손")
        .replace(/\.png$/, "");
}

function createAssetCard(file) {
    const size = sizeFor(file);
    const family = familyFor(file);
    const card = document.createElement("article");
    card.className = "asset-card";
    card.dataset.file = file.toLowerCase();
    card.dataset.family = family;
    card.dataset.size = size;

    const preview = document.createElement("div");
    preview.className = "asset-preview";
    const sprite = document.createElement("div");
    sprite.className = "asset-sprite";
    sprite.dataset.houseSize = size;
    const maskPath = `../../assets/wall-mask-buildings/wall-mask-${file}`;
    sprite.style.setProperty("--wall-mask", `url("${maskEditor.getDraft(file) ?? maskPath}")`);

    const image = document.createElement("img");
    image.src = `../../assets/Isometric%20City/Buildings/${file}`;
    image.alt = `${readableName(file)} 원본 건물`;
    image.loading = "lazy";
    image.draggable = false;
    const tint = document.createElement("span");
    tint.className = "wall-tint";
    tint.setAttribute("aria-hidden", "true");
    const light = document.createElement("span");
    light.className = "wall-light";
    light.setAttribute("aria-hidden", "true");
    sprite.append(image, tint, light);
    preview.append(sprite);

    const caption = document.createElement("div");
    caption.className = "asset-caption";
    const title = document.createElement("strong");
    title.textContent = readableName(file);
    const meta = document.createElement("span");
    meta.textContent = family === "other" ? "공사 에셋 · 벽면 없음" : `${familyLabel(family)} · ${sizeLabel(size)}`;
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn btn-sm asset-edit";
    edit.textContent = "마스크 편집";
    edit.setAttribute("aria-label", `${readableName(file)} 마스크 편집`);
    edit.addEventListener("click", () => maskEditor.open({ file, sprite, imageUrl: image.src, maskPath }));
    caption.append(title, meta, edit);
    card.append(preview, caption);
    return card;
}

function familyLabel(family) {
    return { homes: "주택 계열", "food-market": "먹거리 상점", "service-market": "생활 상점", other: "기타 에셋" }[
        family
    ];
}

function sizeLabel(size) {
    return { small: "1단계", medium: "2단계", tall: "3단계" }[size];
}

let changedMasks = 0;
let downloadingMasks = false;
function updateMaskDownloads(count) {
    changedMasks = count;
    maskChanges.textContent = `변경된 마스크 ${count}개`;
    maskDownloadChanged.disabled = downloadingMasks || count === 0;
    maskDownloadAll.disabled = downloadingMasks;
}

const maskEditor = createMaskEditor({
    files: BUILDING_FILES,
    onChange: updateMaskDownloads,
    onStorageError: (message) => {
        maskStorageWarning.textContent = message;
    },
});
for (const file of BUILDING_FILES) assetGrid.append(createAssetCard(file));
const cards = [...assetGrid.children];

async function downloadMasks(changedOnly) {
    if (downloadingMasks) return;
    const files = changedOnly ? BUILDING_FILES.filter((file) => maskEditor.isChanged(file)) : BUILDING_FILES;
    if (!files.length) return;
    downloadingMasks = true;
    updateMaskDownloads(changedMasks);
    maskDownloadStatus.textContent = `마스크 ${files.length}개를 준비하고 있습니다.`;
    try {
        const entries = await Promise.all(
            files.map(async (file) => {
                const url = maskEditor.getDraft(file) ?? `../../assets/wall-mask-buildings/wall-mask-${file}`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`마스크를 불러오지 못했습니다: ${file}`);
                return { name: `wall-mask-${file}`, bytes: new Uint8Array(await response.arrayBuffer()) };
            }),
        );
        const url = URL.createObjectURL(createMaskArchive(entries));
        const link = document.createElement("a");
        link.href = url;
        link.download = changedOnly ? "changed-wall-masks.zip" : "all-wall-masks.zip";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        maskDownloadStatus.textContent = `마스크 ${files.length}개 다운로드를 요청했습니다.`;
    } catch (error) {
        console.error(error);
        maskDownloadStatus.textContent = "마스크를 다운로드하지 못했습니다. 다시 시도해 주세요.";
    } finally {
        downloadingMasks = false;
        updateMaskDownloads(changedMasks);
    }
}

maskDownloadChanged.addEventListener("click", () => downloadMasks(true));
maskDownloadAll.addEventListener("click", () => downloadMasks(false));

function filterAssets() {
    const query = assetSearch.value.trim().toLowerCase();
    const family = familyFilter.value;
    let visible = 0;
    for (const card of cards) {
        const matches = card.dataset.file.includes(query) && (family === "all" || card.dataset.family === family);
        card.hidden = !matches;
        if (matches) visible++;
    }
    assetCount.textContent = `${visible} / ${cards.length}개`;
}

const grassTint = document.querySelector(".grass-demo-tint");
const grassLight = document.querySelector(".grass-demo-light");

function toHex(value) {
    return Math.round(value).toString(16).padStart(2, "0").toUpperCase();
}

function hsvToRgb(h, s, v) {
    const chroma = v * s;
    const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - chroma;
    let rgb;
    if (h < 60) rgb = [chroma, x, 0];
    else if (h < 120) rgb = [x, chroma, 0];
    else if (h < 180) rgb = [0, chroma, x];
    else if (h < 240) rgb = [0, x, chroma];
    else if (h < 300) rgb = [x, 0, chroma];
    else rgb = [chroma, 0, x];
    return rgb.map((channel) => Math.round((channel + m) * 255));
}

function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let hue = 0;
    if (delta !== 0) {
        if (max === r) hue = 60 * (((g - b) / delta) % 6);
        else if (max === g) hue = 60 * ((b - r) / delta + 2);
        else hue = 60 * ((r - g) / delta + 4);
    }
    if (hue < 0) hue += 360;
    return { hue, saturation: max === 0 ? 0 : delta / max, value: max };
}

function parseHex(value) {
    const cleaned = value.trim().replace(/^#/, "");
    if (!/^[\da-f]{6}$/i.test(cleaned)) return null;
    return [0, 2, 4].map((offset) => Number.parseInt(cleaned.slice(offset, offset + 2), 16));
}

function grassColorFromHexRgb(rgb) {
    const channels = rgb.map((channel) => channel / 255);
    const sourceBrightness = Math.max(...channels);
    const darkness = Number(grassDarknessRange.value) / 100;
    const brightness = Math.max(1 - (1 - sourceBrightness) * darkness, Number(grassMinBrightnessRange.value) / 100);
    if (sourceBrightness === 0) {
        const gray = Math.round(brightness * 255);
        return [gray, gray, gray];
    }
    const darkColorProgress = Math.min(1, sourceBrightness / 0.28);
    const darkColorWeight = darkColorProgress * darkColorProgress * (3 - 2 * darkColorProgress);
    const saturation = (Number(grassSaturationRange.value) / 100) * darkColorWeight;
    const brightnessScale = brightness / sourceBrightness;
    return channels.map((channel) => {
        const desaturated = sourceBrightness + (channel - sourceBrightness) * saturation;
        return Math.round(Math.min(1, Math.max(0, desaturated * brightnessScale)) * 255);
    });
}

function updateWallColor(hex) {
    for (const sprite of document.querySelectorAll(".asset-sprite")) {
        const tint = sprite.querySelector(".wall-tint");
        const light = sprite.querySelector(".wall-light");
        const adjustments = wallColorAdjustments(hex, sprite.dataset.houseSize);
        tint.style.setProperty("--wall-color", hex);
        tint.style.setProperty("--wall-alpha", String(state.alpha));
        light.style.setProperty("--wall-light-color", adjustments.lightColor);
        light.style.setProperty("--wall-light-mode", adjustments.lightMode);
        light.style.setProperty("--wall-light-alpha", String(adjustments.lightOpacity * state.alpha));
    }
}

function updateGrassColor(hex, rgb) {
    const targetLuminance = (0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]) / 255;
    const baseLuminance = 0.584;
    grassTint.style.setProperty("--grass-color", hex);
    grassTint.style.setProperty("--grass-alpha", String(state.alpha));
    if (targetLuminance < baseLuminance) {
        grassLight.style.setProperty("--grass-light-color", "#000");
        grassLight.style.setProperty("--grass-light-mode", "multiply");
        grassLight.style.setProperty(
            "--grass-light-alpha",
            String((1 - targetLuminance / baseLuminance) * state.alpha),
        );
    } else {
        grassLight.style.setProperty("--grass-light-color", "#fff");
        grassLight.style.setProperty("--grass-light-mode", "screen");
        grassLight.style.setProperty(
            "--grass-light-alpha",
            String(((targetLuminance - baseLuminance) / (1 - baseLuminance)) * state.alpha),
        );
    }
}

function updateColor() {
    const rgb = hsvToRgb(state.hue, state.saturation, state.value);
    const hex = `#${rgb.map(toHex).join("")}`;
    hexInput.value = hex;
    const grassRgb = grassColorFromHexRgb(rgb);
    const grassHex = `#${grassRgb.map(toHex).join("")}`;
    const rgba = `rgba(${rgb.join(", ")}, ${state.alpha})`;
    const squareRect = square.getBoundingClientRect();
    picker.style.setProperty("--picker-hue", String(state.hue));
    picker.style.setProperty("--picker-color", hex);
    pickerDot.style.backgroundColor = rgba;
    updateWallColor(hex);
    updateGrassColor(grassHex, grassRgb);
    handle.style.left = `${state.saturation * squareRect.width}px`;
    handle.style.top = `${(1 - state.value) * squareRect.height}px`;
    hueRange.value = String(Math.round(state.hue));
    alphaRange.value = String(Math.round(state.alpha * 100));
    alphaValue.value = `${Math.round(state.alpha * 100)}%`;
    alphaValue.textContent = `${Math.round(state.alpha * 100)}%`;
    opacityInput.value = String(Math.round(state.alpha * 100));
    grassSaturationValue.value = `${grassSaturationRange.value}%`;
    grassSaturationValue.textContent = `${grassSaturationRange.value}%`;
    grassDarknessValue.value = `${grassDarknessRange.value}%`;
    grassDarknessValue.textContent = `${grassDarknessRange.value}%`;
    grassMinBrightnessValue.value = `${grassMinBrightnessRange.value}%`;
    grassMinBrightnessValue.textContent = `${grassMinBrightnessRange.value}%`;
    square.setAttribute(
        "aria-valuetext",
        `채도 ${Math.round(state.saturation * 100)}%, 밝기 ${Math.round(state.value * 100)}%`,
    );
    square.setAttribute("aria-valuenow", String(Math.round(state.value * 100)));
}

function setSquareFromPointer(event) {
    const rect = square.getBoundingClientRect();
    state.saturation = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    state.value = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    updateColor();
}

square.addEventListener("pointerdown", (event) => {
    square.setPointerCapture(event.pointerId);
    setSquareFromPointer(event);
});
square.addEventListener("pointermove", (event) => {
    if (square.hasPointerCapture(event.pointerId)) setSquareFromPointer(event);
});
square.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    if (event.key === "ArrowLeft") state.saturation = Math.max(0, state.saturation - step);
    else if (event.key === "ArrowRight") state.saturation = Math.min(1, state.saturation + step);
    else if (event.key === "ArrowUp") state.value = Math.min(1, state.value + step);
    else if (event.key === "ArrowDown") state.value = Math.max(0, state.value - step);
    else return;
    event.preventDefault();
    updateColor();
});
hueRange.addEventListener("input", () => {
    state.hue = Number(hueRange.value);
    updateColor();
});
alphaRange.addEventListener("input", () => {
    state.alpha = Number(alphaRange.value) / 100;
    updateColor();
});
opacityInput.addEventListener("change", () => {
    const value = Number(opacityInput.value);
    state.alpha = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 100)) / 100;
    updateColor();
});
hexInput.addEventListener("change", () => {
    const rgb = parseHex(hexInput.value);
    if (!rgb) {
        updateColor();
        return;
    }
    Object.assign(state, rgbToHsv(...rgb));
    updateColor();
});
grassSaturationRange.addEventListener("input", updateColor);
grassDarknessRange.addEventListener("input", updateColor);
grassMinBrightnessRange.addEventListener("input", updateColor);
assetSearch.addEventListener("input", filterAssets);
familyFilter.addEventListener("change", filterAssets);
document.getElementById("previewMode").addEventListener("change", (event) => {
    document.body.classList.toggle("show-mask", event.target.value === "mask");
    document.body.classList.toggle("show-original", event.target.value === "original");
});
window.addEventListener("resize", updateColor);
filterAssets();
updateColor();
