import { bookmarks, categories, dismissNewBefore, subscribe, updateCity } from "../db/db.js";
import { categorySelect } from "../shared/category-select.js";
import { nameError, webUrl } from "../shared/validation.js";
import { clearBookmarkPreview, renderBookmarkPreview } from "./bookmark-preview.js";
import { prepareBuildingAppearance } from "./building-appearance.js";
import { assignBuildingFamilies, buildingTexture } from "./building-rules.js";
import { assignCategoryColors, colors } from "./category-colors.js";
import { categoryManager } from "./category-manager.js";
import { setGoogleAccount } from "./google-account.js";
import { planCity, planRoads, project, TILE_HEIGHT, TILE_WIDTH } from "./layout.js";

// Canvas region the city is fitted into (left of the category panel).
const MAP_AREA = { left: 24, top: 200, width: 1400, height: 800 };
const MAX_ZOOM = 1.7;

const $ = (id) => document.getElementById(id);
const tooltip = $("bookmark-tooltip");
const hoverBridge = $("bookmark-hover-bridge");
let activeBookmark;
let activeLink;
let hoverCorridor = [];
let toastTimer;
let renderVersion = 0;
let lastCityTiles = [];
let selectedCategory = null;
let pickerCategory = null;
let pickerColor = "#a6bce9";
let pickerHue = 220;
let colorSaveTimer;
let pendingColorChange = null;
let draftColorChange = null;

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function fitCanvas() {
    // Fill the window width; adapt the map and panel to the available height.
    const scale = innerWidth / 1920;
    const canvasHeight = Math.max(600, innerHeight / scale);
    $("canvas").style.transform = `scale(${scale})`;
    $("canvas").style.height = `${canvasHeight}px`;
    $("viewport").style.width = `${innerWidth}px`;
    $("viewport").style.height = `${canvasHeight * scale}px`;
    MAP_AREA.top = Math.min(200, canvasHeight * 0.18);
    MAP_AREA.height = Math.max(250, canvasHeight - MAP_AREA.top - 70);
    fitCity(lastCityTiles);
    hideTooltip();
}

function toast(message, tone = "default") {
    clearTimeout(toastTimer);
    $("toast").classList.toggle("toast-subtle", tone === "subtle");
    $("toast").textContent = message;
    $("toast").hidden = false;
    toastTimer = setTimeout(
        () => {
            $("toast").hidden = true;
        },
        tone === "subtle" ? 2200 : 3500,
    );
}

function safeUrl(raw) {
    try {
        const url = new URL(raw);
        return ["https:", "http:"].includes(url.protocol) ? url : null;
    } catch {
        return null;
    }
}

function hideTooltip() {
    tooltip.hidden = true;
    hoverBridge.hidden = true;
    hoverCorridor = [];
    clearBookmarkPreview(tooltip.querySelector(".page-preview"));
    if (activeLink) activeLink.removeAttribute("aria-describedby");
    activeLink = null;
    $("world").classList.remove("detail-focus");
    for (const item of $("buildings").children) item.classList.remove("focused-building");
}

function scheduleHide(event) {
    if ($("bookmark-editor").open) return;
    const next = event.relatedTarget;
    if (next && (tooltip.contains(next) || hoverBridge.contains(next) || activeLink?.contains(next))) return;
    if (event.type === "mouseleave" && inHoverCorridor(event.clientX, event.clientY)) return;
    hideTooltip();
}

function inHoverCorridor(x, y) {
    if (hoverCorridor.length !== 4) return false;
    let direction = 0;
    for (let i = 0; i < hoverCorridor.length; i++) {
        const a = hoverCorridor[i];
        const b = hoverCorridor[(i + 1) % hoverCorridor.length];
        const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
        if (Math.abs(cross) < 0.01) continue;
        if (direction && Math.sign(cross) !== direction) return false;
        direction = Math.sign(cross);
    }
    return true;
}

function positionHoverBridge() {
    if (!activeLink || tooltip.hidden) return;
    const anchor = activeLink.getBoundingClientRect();
    const card = tooltip.getBoundingClientRect();
    const center = anchor.left + anchor.width / 2;
    const cardOnLeft = card.left + card.width / 2 < center;
    const edge = cardOnLeft ? card.right + 1 : card.left - 1;
    const near = [
        { x: center, y: anchor.top - 12 },
        { x: center, y: anchor.bottom + 12 },
    ];
    const far = [
        { x: edge, y: card.top - 6 },
        { x: edge, y: card.bottom + 6 },
    ];
    hoverCorridor = cardOnLeft ? [far[0], near[0], near[1], far[1]] : [near[0], far[0], far[1], near[1]];
    const left = Math.min(center, edge);
    const right = Math.max(center, edge);
    const top = Math.min(near[0].y, far[0].y);
    const bottom = Math.max(near[1].y, far[1].y);
    const width = right - left;
    const height = bottom - top;
    hoverBridge.hidden = width <= 0 || height <= 0;
    if (hoverBridge.hidden) {
        hoverCorridor = [];
        return;
    }
    hoverBridge.style.left = `${left}px`;
    hoverBridge.style.top = `${top}px`;
    hoverBridge.style.width = `${width}px`;
    hoverBridge.style.height = `${height}px`;
    hoverBridge.style.clipPath = `polygon(${hoverCorridor.map((point) => `${((point.x - left) / width) * 100}% ${((point.y - top) / height) * 100}%`).join(",")})`;
}

function showTooltip(bookmark, category, link) {
    if (activeLink && activeLink !== link) activeLink.removeAttribute("aria-describedby");
    activeLink = link;
    activeBookmark = bookmark;
    $("world").classList.add("detail-focus");
    for (const item of $("buildings").children)
        item.classList.toggle("focused-building", item.dataset.bookmark === bookmark.id);
    const url = safeUrl(bookmark.url);
    $("tooltip-name").textContent = bookmark.name;
    $("tooltip-category").textContent = category.name;

    $("preview-domain").textContent = url?.hostname ?? "주소를 확인해 주세요";

    $("tooltip-memo").value = bookmark.memo || "";
    if (bookmark.isNew) {
        bookmark.isNew = false;
        link.closest(".building").classList.remove("is-new");
        link.querySelector(".new-badge")?.remove();
        bookmarks.edit(bookmark.id, { isNew: false }).catch((error) => {
            console.error(error);
            toast("새 북마크 표시를 저장하지 못했습니다.");
        });
    }
    $("copy-link").textContent = "링크 복사";
    tooltip.hidden = false;
    renderBookmarkPreview(tooltip.querySelector(".page-preview"), bookmark);
    link.setAttribute("aria-describedby", "bookmark-tooltip");
    const anchor = link.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    const zone = [...$("zones").children].find((item) => item.dataset.category === String(category.id));
    const area = zone?.querySelector("svg").getBoundingClientRect();
    const building = link.closest(".building").getBoundingClientRect();
    const preferRight = area && building.left + building.width / 2 > area.left + area.width / 2 + 0.5;
    const left = anchor.left - box.width - 16;
    const right = anchor.right + 16;
    const leftFits = left >= 12;
    const rightFits = right + box.width <= innerWidth - 12;
    let x = preferRight ? right : left;
    if (preferRight && !rightFits && leftFits) x = left;
    if (!preferRight && !leftFits && rightFits) x = right;
    const y = Math.max(12, Math.min(anchor.top, innerHeight - box.height - 12));
    tooltip.style.left = `${Math.max(12, Math.min(x, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${y}px`;
    positionHoverBridge();
}

function highlightCategory(id) {
    for (const zone of $("zones").children) zone.classList.toggle("active", zone.dataset.category === id);
}

function applyFilter() {
    for (const item of $("buildings").children) {
        item.classList.toggle("dimmed", selectedCategory !== null && item.dataset.category !== selectedCategory);
    }
    for (const label of $("building-labels").children) {
        label.classList.toggle("dimmed", selectedCategory !== null && label.dataset.category !== selectedCategory);
    }
    for (const row of $("category-list").children) {
        row.querySelector(".category-filter")?.setAttribute(
            "aria-pressed",
            String(row.dataset.category === selectedCategory),
        );
    }
    highlightCategory(selectedCategory);
}

function paintCategory(categoryId, color) {
    for (const zone of $("zones").children) {
        if (zone.dataset.category === String(categoryId)) zone.querySelector("polygon").setAttribute("stroke", color);
    }
    for (const row of $("category-list").children) {
        if (row.dataset.category === String(categoryId)) row.style.setProperty("--zone-color", color);
    }
}

function createBuilding(bookmark, category, cell, labels) {
    // Anchor the building's base at the bottom corner of its cell.
    const position = project(cell.x + 1, cell.y + 1);
    const texture = buildingTexture(bookmark.clickCount, category.buildingFamily, bookmark.id);
    const wrapper = element("div", "building");
    wrapper.dataset.bookmark = bookmark.id;
    wrapper.dataset.category = category.id;
    wrapper.dataset.houseSize = texture.size;
    wrapper.style.left = `${position.left}px`;
    wrapper.style.top = `${position.top}px`;
    wrapper.style.zIndex = String(1000 + cell.x + cell.y);
    const link = element("a", "building-link");
    const url = safeUrl(bookmark.url);
    if (url) link.href = url.href;
    else link.tabIndex = 0;
    link.setAttribute("aria-label", `${bookmark.name} · ${category.name} · 사이트 방문`);
    const image = element("img", "building-image");
    image.src = texture.src;
    image.alt = "";
    image.draggable = false;
    const hitArea = element("span", "building-hit-area");
    hitArea.setAttribute("aria-hidden", "true");
    const badge = element("span", "building-badge", bookmark.name);
    badge.setAttribute("aria-hidden", "true");
    badge.dataset.category = category.id;
    badge.style.left = `${position.left}px`;
    badge.style.top = `${position.top - 6}px`;
    labels.append(badge);
    prepareBuildingAppearance(image, hitArea).catch((error) => {
        console.error(error);
        toast("건물 표시를 불러오지 못했습니다. 새로고침해 주세요.");
    });
    link.append(image, hitArea);
    if (bookmark.isNew) {
        wrapper.classList.add("is-new");
        link.append(element("span", "new-badge", "NEW"));
    }
    wrapper.append(link);
    link.addEventListener("mouseenter", () => {
        highlightCategory(category.id);
        showTooltip(bookmark, category, link);
    });
    link.addEventListener("mouseleave", (event) => {
        highlightCategory(selectedCategory);
        scheduleHide(event);
    });
    link.addEventListener("focus", () => showTooltip(bookmark, category, link));
    link.addEventListener("blur", scheduleHide);
    link.addEventListener("click", (event) => {
        if (!url) {
            event.preventDefault();
            toast("올바른 웹페이지 주소가 아닙니다.");
            return;
        }

        const keepDefaultNavigation =
            event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (keepDefaultNavigation) {
            bookmarks.incrementClickCount(bookmark.id).catch((error) => console.error(error));
            return;
        }

        event.preventDefault();
        bookmarks
            .incrementClickCount(bookmark.id)
            .catch((error) => console.error(error))
            .finally(() => window.location.assign(url.href));
    });
    // Chrome sends a middle-button click as auxclick, not click.
    link.addEventListener("auxclick", (event) => {
        if (event.button === 1 && url)
            bookmarks.incrementClickCount(bookmark.id).catch((error) => console.error(error));
    });
    return wrapper;
}

function groundTile(x, y, src) {
    const { left, top } = project(x, y);
    const tile = element("img", "tile");
    tile.src = src;
    tile.alt = "";
    tile.style.left = `${left - TILE_WIDTH / 2}px`;
    tile.style.top = `${top}px`;
    return tile;
}

function categoryGrassTile(x, y, category) {
    const { left, top } = project(x, y);
    const tile = element("div", "category-grass-tile");
    tile.setAttribute("aria-hidden", "true");
    tile.dataset.category = String(category.id);
    tile.style.left = `${left - TILE_WIDTH / 2}px`;
    tile.style.top = `${top}px`;

    const image = element("img");
    image.src = "../assets/Isometric City/Roads and Grounds/tile_ground_grass.png";
    image.alt = "";
    tile.append(image);
    return tile;
}

// Coloured outline of a category area, shown when the category is highlighted.
function createZone(category, area, color) {
    const corners = [
        project(area.x, area.y),
        project(area.x + area.w, area.y),
        project(area.x + area.w, area.y + area.h),
        project(area.x, area.y + area.h),
    ];
    const left = corners[3].left;
    const top = corners[0].top;
    const zone = element("div", "zone");
    zone.dataset.category = String(category.id);
    zone.style.left = `${left}px`;
    zone.style.top = `${top}px`;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(corners[1].left - left));
    svg.setAttribute("height", String(corners[2].top - top));
    svg.setAttribute("aria-hidden", "true");
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", corners.map((point) => `${point.left - left},${point.top - top}`).join(" "));
    polygon.setAttribute("fill", "none");
    polygon.setAttribute("stroke", color);
    svg.append(polygon);
    zone.append(svg);
    return zone;
}

// Zoom the whole city so every tile fits the map region, like zooming out.
function fitCity(tiles) {
    lastCityTiles = tiles;
    if (!tiles.length) return;
    let minLeft = Infinity;
    let maxRight = -Infinity;
    let minTop = Infinity;
    let maxBottom = -Infinity;
    for (const { x, y } of tiles) {
        const { left, top } = project(x, y);
        minLeft = Math.min(minLeft, left - TILE_WIDTH / 2);
        maxRight = Math.max(maxRight, left + TILE_WIDTH / 2);
        minTop = Math.min(minTop, top);
        maxBottom = Math.max(maxBottom, top + TILE_HEIGHT);
    }
    minTop -= TILE_HEIGHT; // room for buildings and labels above the top row
    const width = maxRight - minLeft;
    const height = maxBottom - minTop;
    const zoom = Math.min(MAX_ZOOM, MAP_AREA.width / width, MAP_AREA.height / height);
    const x = MAP_AREA.left + (MAP_AREA.width - width * zoom) / 2 - minLeft * zoom;
    const y = MAP_AREA.top + (MAP_AREA.height - height * zoom) / 2 - minTop * zoom;
    const world = $("world");
    const first = !world.style.transform;
    world.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    if (first) {
        // Animate later zoom changes only, not the first placement on page load.
        void world.offsetWidth;
        world.classList.add("animated");
    }
}

// Plan positions and save what changed. The lock keeps several new tabs from planning at once.
async function arrangeCity() {
    return updateCity((savedCategories, savedBookmarks) => {
        const assigned = assignCategoryColors(savedCategories);
        const families = assignBuildingFamilies(assigned.categories);
        return {
            plan: planCity(families.categories, savedBookmarks),
            colors: assigned.changes,
            families: families.changes,
        };
    });
}
const renderCategories = categoryManager({
    openColorPicker,
    highlightCategory: (id) => highlightCategory(id ?? selectedCategory),
    toast,
    toggleCategory(id) {
        selectedCategory = selectedCategory === id ? null : id;
        applyFilter();
    },
});

async function render() {
    const version = ++renderVersion;
    try {
        const { groups, total } = await arrangeCity();
        if (version !== renderVersion) return;
        hideTooltip();
        const ground = document.createDocumentFragment();
        const zones = document.createDocumentFragment();
        const map = document.createDocumentFragment();
        const labels = document.createDocumentFragment();

        const tiles = [];
        groups.forEach(({ category: savedCategory, items, area, cells }, index) => {
            const category = { ...savedCategory, color: savedCategory.color ?? colors[index % colors.length] };
            const color = category.color;
            for (let y = area.y; y < area.y + area.h; y++) {
                for (let x = area.x; x < area.x + area.w; x++) {
                    ground.append(categoryGrassTile(x, y, category));
                }
            }
            zones.append(createZone(category, area, color));
            for (const bookmark of items) {
                map.append(createBuilding(bookmark, category, cells.get(bookmark.id), labels));
            }
        });
        for (const road of planRoads(groups.map((group) => group.area))) {
            ground.append(groundTile(road.x, road.y, road.tile));
            tiles.push(road);
        }
        fitCity(tiles);
        $("ground").replaceChildren(ground);
        $("zones").replaceChildren(zones);
        $("buildings").replaceChildren(map);
        $("building-labels").replaceChildren(labels);
        if (selectedCategory && !groups.some((group) => group.category.id === selectedCategory))
            selectedCategory = null;
        renderCategories(groups);
        if (activeBookmark && !groups.some((group) => group.items.some((item) => item.id === activeBookmark.id)))
            hideTooltip();
        $("map-status").textContent = total
            ? ""
            : "저장한 페이지가 아직 없습니다. 확장프로그램에서 첫 페이지를 저장해 보세요.";
        applyFilter();
    } catch (error) {
        if (version !== renderVersion) return;
        $("map-status").textContent = "북마크를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.";
        console.error(error);
    }
}

function openColorPicker(categoryId, trigger, color, onDraftChange = null) {
    draftColorChange = onDraftChange;
    if (pendingColorChange && pendingColorChange.categoryId !== categoryId) {
        clearTimeout(colorSaveTimer);
        persistPendingColor();
    }
    const picker = $("category-color-picker");
    if (pickerCategory === categoryId && !picker.hidden) {
        picker.hidden = true;
        return;
    }
    pickerCategory = categoryId;
    pickerColor = color;
    const [r, g, b] = color.match(/[\da-f]{2}/gi).map((part) => Number.parseInt(part, 16) / 255);
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        delta = max - min;
    pickerHue =
        delta === 0
            ? 0
            : max === r
              ? (((g - b) / delta) % 6) * 60
              : max === g
                ? ((b - r) / delta + 2) * 60
                : ((r - g) / delta + 4) * 60;
    if (pickerHue < 0) pickerHue += 360;
    picker.querySelector(".picker-hue").value = String(Math.round(pickerHue));
    const saturationField = picker.querySelector(".picker-saturation");
    saturationField.style.backgroundColor = `hsl(${pickerHue} 100% 50%)`;
    saturationField.querySelector(".picker-selector").style.left = `${(max === 0 ? 0 : delta / max) * 100}%`;
    saturationField.querySelector(".picker-selector").style.top = `${(1 - max) * 100}%`;
    picker.querySelector(".picker-hex").value = color.slice(1).toUpperCase();
    picker.style.setProperty("--picker-color", color);
    picker.hidden = false;
    positionColorPicker(trigger);
}

function positionColorPicker(trigger) {
    const picker = $("category-color-picker"),
        canvas = $("canvas");
    const bounds = canvas.getBoundingClientRect(),
        anchor = trigger.getBoundingClientRect();
    const scaleX = bounds.width / canvas.offsetWidth,
        scaleY = bounds.height / canvas.offsetHeight;
    picker.style.left = `${Math.max(8, (anchor.left - bounds.left) / scaleX - picker.offsetWidth - 10)}px`;
    picker.style.top = `${Math.max(8, (anchor.top - bounds.top + anchor.height / 2) / scaleY - picker.offsetHeight / 2)}px`;
}

function updatePickerColor(color) {
    if (!/^#[\da-f]{6}$/i.test(color)) return;
    pickerColor = color.toLowerCase();
    const picker = $("category-color-picker");
    picker.querySelector(".picker-hex").value = pickerColor.slice(1).toUpperCase();
    picker.querySelector(".picker-saturation").style.backgroundColor = `hsl(${pickerHue} 100% 50%)`;
    picker.style.setProperty("--picker-color", pickerColor);
    paintCategory(pickerCategory, pickerColor);
    if (draftColorChange) {
        draftColorChange(pickerColor);
        return;
    }
    pendingColorChange = { categoryId: pickerCategory, color: pickerColor };
    clearTimeout(colorSaveTimer);
    colorSaveTimer = setTimeout(persistPendingColor, 180);
}

async function persistPendingColor() {
    const change = pendingColorChange;
    pendingColorChange = null;
    if (!change) return;
    try {
        await categories.edit(change.categoryId, { color: change.color });
    } catch (error) {
        toast("카테고리 색상을 저장하지 못했습니다.");
        console.error(error);
    }
}

function hsvHex(hue, saturation, value) {
    const chroma = value * saturation,
        x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1)),
        m = value - chroma;
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
        .map((component) =>
            Math.round((component + m) * 255)
                .toString(16)
                .padStart(2, "0"),
        )
        .join("")}`;
}

function commitPickerField(event) {
    const field = event.currentTarget,
        rect = field.getBoundingClientRect();
    const saturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const value = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    setPickerPoint(field, saturation, value);
}

function setPickerPoint(field, saturation, value) {
    updatePickerColor(hsvHex(pickerHue, saturation, value));
    field.querySelector(".picker-selector").style.left = `${saturation * 100}%`;
    field.querySelector(".picker-selector").style.top = `${(1 - value) * 100}%`;
}

const saturationField = $("category-color-picker").querySelector(".picker-saturation");
let selectingColor = false;
saturationField.addEventListener("pointerdown", (event) => {
    selectingColor = true;
    saturationField.setPointerCapture(event.pointerId);
    commitPickerField(event);
});
saturationField.addEventListener("pointermove", (event) => {
    if (selectingColor) commitPickerField(event);
});
saturationField.addEventListener("pointerup", () => {
    selectingColor = false;
});
saturationField.addEventListener("keydown", (event) => {
    const selector = saturationField.querySelector(".picker-selector");
    let saturation = Number.parseFloat(selector.style.left) / 100;
    let value = 1 - Number.parseFloat(selector.style.top) / 100;
    if (event.key === "ArrowLeft") saturation -= 0.04;
    else if (event.key === "ArrowRight") saturation += 0.04;
    else if (event.key === "ArrowUp") value += 0.04;
    else if (event.key === "ArrowDown") value -= 0.04;
    else return;
    event.preventDefault();
    saturation = Math.max(0, Math.min(1, saturation));
    value = Math.max(0, Math.min(1, value));
    setPickerPoint(saturationField, saturation, value);
});
$("category-color-picker")
    .querySelector(".picker-hue")
    .addEventListener("input", (event) => {
        pickerHue = Number(event.currentTarget.value);
        saturationField.style.backgroundColor = `hsl(${pickerHue} 100% 50%)`;
        const selector = saturationField.querySelector(".picker-selector").getBoundingClientRect();
        const rect = saturationField.getBoundingClientRect();
        const saturation = Math.max(0, Math.min(1, (selector.left + selector.width / 2 - rect.left) / rect.width));
        const value = 1 - Math.max(0, Math.min(1, (selector.top + selector.height / 2 - rect.top) / rect.height));
        updatePickerColor(hsvHex(pickerHue, saturation, value));
    });
$("category-color-picker")
    .querySelector(".picker-hex")
    .addEventListener("change", (event) => {
        const value = event.currentTarget.value.trim();
        if (/^[\da-f]{6}$/i.test(value)) {
            const id = pickerCategory;
            const anchor = [...$("category-list").children]
                .find((row) => row.dataset.category === id)
                ?.querySelector(".category-color");
            $("category-color-picker").hidden = true;
            if (anchor) openColorPicker(id, anchor, `#${value}`, draftColorChange);
            updatePickerColor(`#${value}`);
        } else event.currentTarget.value = pickerColor.slice(1).toUpperCase();
    });
document.addEventListener("pointerdown", (event) => {
    const picker = $("category-color-picker");
    if (!picker.hidden && !picker.contains(event.target) && !event.target.closest(".category-color")) {
        picker.hidden = true;
        clearTimeout(colorSaveTimer);
        persistPendingColor();
    }
});

tooltip.addEventListener("mouseleave", scheduleHide);
document.addEventListener("mousemove", (event) => {
    if (!activeLink || tooltip.hidden || $("bookmark-editor").open) return;
    if (activeLink.contains(event.target) || tooltip.contains(event.target)) return;
    if (inHoverCorridor(event.clientX, event.clientY)) return;
    hideTooltip();
});
tooltip.addEventListener("focusout", (event) => {
    if (!tooltip.contains(event.relatedTarget)) scheduleHide(event);
});
$("copy-link").addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(activeBookmark.url);
        $("copy-link").textContent = "복사 완료";
        toast("클립보드에 복사되었습니다.", "subtle");
    } catch (error) {
        toast("링크를 복사하지 못했습니다. 다시 시도해 주세요.");
        console.error(error);
    }
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        hideTooltip();
        const picker = $("category-color-picker");
        if (!picker.hidden) {
            picker.hidden = true;
            clearTimeout(colorSaveTimer);
            persistPendingColor();
        }
    }
});
window.addEventListener("resize", fitCanvas);
// NEW stays until the user has seen it: bookmarks saved before this visit began are
// acknowledged when the user leaves, so a fresh tab still shows them.
let visibleSince = document.hidden ? null : Date.now();
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        if (visibleSince === null) return;
        const seenBefore = visibleSince;
        visibleSince = null;
        dismissNewBefore(seenBefore).catch((error) => console.error(error));
        return;
    }
    visibleSince = Date.now();
    render();
});
subscribe((changes) => {
    const keys = Object.keys(changes);
    const bookmarkChange = changes["webprg-bookmarkmap-bookmarks"];
    if (keys.length === 1 && bookmarkChange?.oldValue && bookmarkChange.newValue) {
        const mapFields = (items) => items.map(({ memo: _memo, isNew: _new, preview: _preview, ...item }) => item);
        if (JSON.stringify(mapFields(bookmarkChange.oldValue)) === JSON.stringify(mapFields(bookmarkChange.newValue))) {
            if (activeBookmark) {
                const updated = bookmarkChange.newValue.find((item) => item.id === activeBookmark.id);
                if (updated && document.activeElement !== $("tooltip-memo")) {
                    activeBookmark = updated;
                    $("tooltip-memo").value = updated.memo ?? "";
                }
            }
            return;
        }
    }
    render();
});
fitCanvas();
render();

let memoQueue = Promise.resolve();
$("tooltip-memo").addEventListener("input", (event) => {
    if (!activeBookmark) return;
    const id = activeBookmark.id,
        memo = event.currentTarget.value;
    activeBookmark.memo = memo;
    memoQueue = memoQueue
        .then(() => bookmarks.edit(id, { memo }))
        .catch((error) => {
            console.error(error);
            toast("메모를 저장하지 못했습니다.");
        });
});
$("apps-button").addEventListener("click", () => {
    const section = $("google-services");
    section.hidden = !section.hidden;
    $("apps-button").setAttribute("aria-expanded", String(!section.hidden));
});
const editSelect = categorySelect($("edit-category"));
let editingBookmark;
function closeEditor() {
    $("bookmark-editor").close();
    hideTooltip();
}
$("close-editor").addEventListener("click", closeEditor);
$("cancel-editor").addEventListener("click", closeEditor);
$("edit-bookmark").addEventListener("click", async () => {
    const id = activeBookmark?.id;
    try {
        editingBookmark = await bookmarks.get(id);
        if (!editingBookmark) {
            toast("삭제된 북마크입니다.");
            hideTooltip();
            return;
        }
        editSelect.setItems(await categories.get(), editingBookmark.category);
        $("edit-name").value = editingBookmark.name;
        $("edit-url").value = editingBookmark.url;
        for (const field of ["edit-name", "edit-url"]) $(field).removeAttribute("aria-invalid");
        for (const field of ["edit-name-error", "edit-url-error", "edit-status"]) $(field).textContent = "";
        const left = tooltip.style.left,
            top = tooltip.style.top;
        tooltip.hidden = true;
        clearBookmarkPreview(tooltip.querySelector(".page-preview"));
        $("bookmark-editor").style.left = left;
        $("bookmark-editor").style.top = top;
        $("bookmark-editor").showModal();
        const editorHeight = $("bookmark-editor").getBoundingClientRect().height;
        $("bookmark-editor").style.top =
            `${Math.max(12, Math.min(Number.parseFloat(top), innerHeight - editorHeight - 12))}px`;
    } catch (error) {
        toast("북마크를 불러오지 못했습니다.");
        console.error(error);
    }
});
// Popup-saved names and URLs may not follow the homepage rules, so only edited values are checked.
const nameChanged = () => $("edit-name").value.trim() !== editingBookmark?.name;
const urlChanged = () => $("edit-url").value.trim() !== editingBookmark?.url;
function validateEditor() {
    const nameMessage = nameChanged() ? nameError($("edit-name").value, 20, "북마크 이름") : "";
    const urlMessage = !urlChanged() || webUrl($("edit-url").value) ? "" : "http 또는 https 주소를 입력해 주세요.";
    $("edit-name-error").textContent = nameMessage;
    $("edit-url-error").textContent = urlMessage;
    $("edit-name").setAttribute("aria-invalid", String(Boolean(nameMessage)));
    $("edit-url").setAttribute("aria-invalid", String(Boolean(urlMessage)));
    return !nameMessage && !urlMessage;
}
$("edit-name").addEventListener("input", validateEditor);
$("edit-url").addEventListener("input", validateEditor);
$("edit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateEditor()) return;
    if (!editSelect.value) {
        $("edit-status").textContent = "카테고리를 선택해 주세요.";
        editSelect.trigger.focus();
        return;
    }
    $("save-editor").disabled = true;
    try {
        if (!(await categories.get(editSelect.value)))
            throw new Error("카테고리가 삭제되었습니다. 다시 선택해 주세요.");
        const changes = { category: editSelect.value };
        if (nameChanged()) changes.name = $("edit-name").value.trim();
        if (urlChanged()) changes.url = $("edit-url").value.trim();
        const result = await bookmarks.edit(editingBookmark.id, changes);
        if (!result) throw new Error("삭제된 북마크입니다.");
        closeEditor();
        toast("북마크를 수정했습니다.");
    } catch (error) {
        $("edit-status").textContent = error.message || "저장하지 못했습니다.";
        console.error(error);
    } finally {
        $("save-editor").disabled = false;
    }
});
$("bookmark-editor").addEventListener("close", hideTooltip);

$("picker-eyedropper").addEventListener("click", async () => {
    if (!globalThis.EyeDropper) {
        toast("이 브라우저에서는 화면 색상 추출을 지원하지 않습니다.");
        return;
    }
    try {
        const { sRGBHex } = await new EyeDropper().open();
        const trigger = [...$("category-list").children]
            .find((row) => row.dataset.category === pickerCategory)
            ?.querySelector(".category-color");
        if (trigger) {
            $("category-color-picker").hidden = true;
            openColorPicker(pickerCategory, trigger, sRGBHex, draftColorChange);
            updatePickerColor(sRGBHex);
        }
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error(error);
            toast("화면 색상을 가져오지 못했습니다.");
        }
    }
});

setGoogleAccount();
