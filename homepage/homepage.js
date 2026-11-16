import {
    backfillMissingBookmarkIcons,
    bookmarks,
    categories,
    dismissNewBefore,
    importChromeBookmarks,
    moveBookmark,
    subscribe,
    updateCity,
} from "../db/db.js";
import { categorySelect } from "../shared/category-select.js";
import { createColorPicker } from "../shared/color-picker.js";
import { bookmarkIconUrl } from "../shared/site-icons.js";
import { bookmarkNameError, webUrl } from "../shared/validation.js";
import { cellBounds, planBackground } from "./background.js";
import { applyPreparedWallMask, prepareBuildingAppearance } from "./building-appearance.js";
import { createBuildingDrag } from "./building-drag.js";
import { layoutFingerprint, planMove, snapshotFromGroups } from "./building-move.js";
import { buildingTexture, isDamaged } from "./building-rules.js";
import { assignCategoryColors, colors, grassAppearanceForCategory, wallColorAdjustments } from "./category-colors.js";
import { categoryManager } from "./category-manager.js";
import { decorationsFor, yardFor } from "./decorations.js";
import { setGoogleAccount } from "./google-account.js";
import { planCity, planRoads, project, TILE_HEIGHT, TILE_WIDTH } from "./layout.js";
import { createTraffic } from "./traffic.js";

// Canvas region the city is fitted into (left of the category panel).
const MAP_AREA = { left: 24, top: 200, width: 1400, height: 800 };
const MAX_ZOOM = 1.7;

const $ = (id) => document.getElementById(id);
const tooltip = $("bookmark-tooltip");
const hoverBridge = $("bookmark-hover-bridge");
const traffic = createTraffic($("traffic"));
let activeBookmark;
let activeLink;
let hoverCorridor = [];
let toastTimer;
let renderVersion = 0;
let lastCityTiles = [];
let selectedCategory = null;
let pickerCategory = null;
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
    const designCanvasWidth = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue("--design-canvas-width"),
    );
    const scale = innerWidth / designCanvasWidth;
    const canvasHeight = Math.max(600, innerHeight / scale);
    document.documentElement.style.setProperty("--homepage-scale", String(scale));
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

// Hover card icon: the same address as the building's map icon (already loaded, so it shows
// at once). It is swapped in only after it loads, so no broken image shows; when it cannot
// load, the extension icon is shown.
const DEFAULT_SITE_ICON = "../assets/icons/icon32.png";
let tooltipIconLoad = null;
function showTooltipIcon(bookmark) {
    const icon = $("tooltip-icon");
    const src = bookmarkIconUrl(bookmark) || DEFAULT_SITE_ICON;
    tooltipIconLoad = null; // an earlier, slower load must not replace this one
    if (icon.getAttribute("src") === src) return;
    const loader = new Image();
    tooltipIconLoad = loader;
    loader.onload = () => {
        if (tooltipIconLoad === loader) icon.src = src;
    };
    loader.onerror = () => {
        if (tooltipIconLoad === loader) icon.src = DEFAULT_SITE_ICON;
    };
    loader.src = src;
}

function hideTooltip() {
    tooltip.hidden = true;
    hoverBridge.hidden = true;
    hoverCorridor = [];
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
    // No detail card while a building is being dragged (focus can return mid-drag).
    if (buildingDrag.isDragging()) return;
    if (activeLink && activeLink !== link) activeLink.removeAttribute("aria-describedby");
    activeLink = link;
    activeBookmark = bookmark;
    $("world").classList.add("detail-focus");
    for (const item of $("buildings").children)
        item.classList.toggle("focused-building", item.dataset.bookmark === bookmark.id);
    const url = safeUrl(bookmark.url);
    showTooltipIcon(bookmark);
    $("tooltip-name").textContent = bookmark.name;
    $("tooltip-name").title = bookmark.name;
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

// Only .zone outlines: #zones also holds the drag marker and expansion slots.
function highlightCategory(id) {
    for (const zone of $("zones").querySelectorAll(":scope > .zone"))
        zone.classList.toggle("active", zone.dataset.category === id);
}

function applyFilter() {
    for (const item of $("buildings").children) {
        item.classList.toggle("dimmed", selectedCategory !== null && item.dataset.category !== selectedCategory);
    }
    for (const icon of $("building-labels").children) {
        icon.classList.toggle("dimmed", selectedCategory !== null && icon.dataset.category !== selectedCategory);
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
        if (zone.dataset.category === String(categoryId)) zone.querySelector("polygon").setAttribute("fill", color);
    }
    for (const row of $("category-list").children) {
        if (row.dataset.category === String(categoryId)) row.style.setProperty("--zone-color", color);
    }
    for (const node of document.querySelectorAll("#buildings .building, #ground .category-grass-tile")) {
        if (node.dataset.category !== String(categoryId)) continue;
        if (node.matches(".category-grass-tile")) styleGrassTile(node, color);
        else
            applyWallColor(
                node.querySelector(".building-wall-tint"),
                node.querySelector(".building-wall-light"),
                color,
                node.dataset.houseSize,
            );
    }
}

function applyWallColor(tint, light, color, size) {
    tint.style.setProperty("--wall-color", color);
    const adjustments = wallColorAdjustments(color, size);
    light.style.setProperty("--light-color", adjustments.lightColor);
    light.style.setProperty("--light-opacity", String(adjustments.lightOpacity));
    light.style.setProperty("--light-mode", adjustments.lightMode);
}

function styleGrassTile(tile, categoryColor) {
    const appearance = grassAppearanceForCategory(categoryColor);
    tile.style.setProperty("--grass-color", appearance.color);
    tile.style.setProperty("--grass-light-color", appearance.lightColor);
    tile.style.setProperty("--grass-light-opacity", String(appearance.lightOpacity));
    tile.style.setProperty("--grass-light-mode", appearance.lightMode);
}

// `interactive` false draws a still copy for the drag preview: no links, no handlers.
function createBuilding(bookmark, category, cell, labels, interactive = true) {
    // Anchor the building's base at the bottom corner of its cell.
    const position = project(cell.x + 1, cell.y + 1);
    const damaged = isDamaged(bookmark);
    const texture = buildingTexture(bookmark.clickCount, bookmark.id, damaged, bookmark.buildingDesign);
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
    link.setAttribute(
        "aria-label",
        `${bookmark.name} · ${category.name}${damaged ? " · 7일 넘게 방문하지 않음" : ""} · 사이트 방문`,
    );
    const image = element("img", "building-image");
    image.src = texture.src;
    image.alt = "";
    image.draggable = false;
    const hitArea = element("span", "building-hit-area");
    hitArea.setAttribute("aria-hidden", "true");
    const tint = element("span", "building-wall-tint");
    const light = element("span", "building-wall-light");
    applyWallColor(tint, light, category.color, texture.size);
    const siteIcon = element("span", "building-icon");
    siteIcon.setAttribute("aria-hidden", "true");
    siteIcon.dataset.category = category.id;
    siteIcon.style.left = `${position.left}px`;
    siteIcon.style.top = `${position.top - 6}px`;
    const fallbackIcon = element("span", "building-icon-fallback", "🌐");
    siteIcon.append(fallbackIcon);
    const iconUrl = bookmarkIconUrl(bookmark);
    if (iconUrl) {
        const iconImage = element("img", "building-site-icon");
        iconImage.alt = "";
        iconImage.hidden = true;
        iconImage.addEventListener(
            "load",
            () => {
                iconImage.hidden = false;
                fallbackIcon.hidden = true;
            },
            { once: true },
        );
        iconImage.addEventListener("error", () => iconImage.remove(), { once: true });
        iconImage.src = iconUrl;
        siteIcon.append(iconImage);
    }
    labels.append(siteIcon);
    prepareBuildingAppearance(image, hitArea).catch((error) => {
        console.error(error);
        toast("건물 표시를 불러오지 못했습니다. 새로고침해 주세요.");
    });
    applyPreparedWallMask(image, tint, light);
    link.append(image, tint, light, hitArea);
    if (bookmark.isNew) {
        wrapper.classList.add("is-new");
        link.append(element("span", "new-badge", "NEW"));
    }
    wrapper.append(link);
    if (!interactive) {
        wrapper.classList.add("building-preview");
        link.removeAttribute("href");
        link.tabIndex = -1;
        return wrapper;
    }
    buildingDrag.attach(link, wrapper, bookmark);
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
    styleGrassTile(tile, category.color);
    tile.style.left = `${left - TILE_WIDTH / 2}px`;
    tile.style.top = `${top}px`;

    const image = element("img");
    image.src = "../assets/Isometric City/Roads and Grounds/tile_ground_grass.png";
    image.alt = "";
    const tint = element("span", "category-grass-tint");
    const light = element("span", "category-grass-light");
    tile.append(image, tint, light);
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
    polygon.setAttribute("fill", color);
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
    return { x, y, zoom };
}

// Lot ground under the whole canvas outside categories and roads. Kept apart from
// fitCity so the background never changes the zoom. Redrawn when the canvas resizes.
let backgroundLand = null;
let backgroundView = null;
function drawBackground(layer, land = backgroundLand) {
    if (!land || !backgroundView) return;
    const { x, y, zoom } = backgroundView;
    const canvas = $("canvas");
    const bounds = cellBounds(-x / zoom, -y / zoom, (canvas.offsetWidth - x) / zoom, (canvas.offsetHeight - y) / zoom);
    const tiles = document.createDocumentFragment();
    for (const tile of planBackground(land, bounds)) tiles.append(groundTile(tile.x, tile.y, tile.src));
    layer.replaceChildren(tiles);
}

// Plan positions and save what changed. The lock keeps several new tabs from planning at once.
async function arrangeCity() {
    return updateCity((savedCategories, savedBookmarks) => {
        const assigned = assignCategoryColors(savedCategories);
        return {
            plan: planCity(assigned.categories, savedBookmarks),
            colors: assigned.changes,
        };
    });
}
// Layout the map last drew, used to preview and check a building move.
let mapState = null;
let lastGroups = [];
let renderWaiting = false;

// Saves a dragged building. Cancels if storage no longer matches the map the drag started
// from, or if the saved result would differ from what the preview showed.
function commitMove(result, fingerprint) {
    return moveBookmark((savedCategories, savedBookmarks) => {
        if (layoutFingerprint(savedCategories, savedBookmarks) !== fingerprint) return null;
        const check = planMove(savedCategories, savedBookmarks, result.move);
        if (check.cell?.x !== result.cell.x || check.cell?.y !== result.cell.y) return null;
        // Save the edited layout plus whatever planCity adjusted on top of it.
        const { areas, cells } = check.plan.changed;
        return {
            categories: check.edited.categories.map((item) =>
                areas.has(item.id) ? { ...item, area: areas.get(item.id) } : item,
            ),
            bookmarks: check.edited.bookmarks.map((item) =>
                cells.has(item.id) ? { ...item, cell: cells.get(item.id) } : item,
            ),
        };
    });
}

const buildingDrag = createBuildingDrag({
    world: $("world"),
    canvas: $("canvas"),
    overlay: $("zones"),
    getState: () => mapState,
    onStart: hideTooltip,
    // While dragging, the whole map (lands, roads, background, buildings) is drawn as it
    // will be after the drop. The dragged building itself is the ghost, so it is left out;
    // with no valid drop the current map is shown with that building faded.
    preview(result, movingId) {
        drawCity(result ? result.plan.groups : lastGroups, { movingId, showMoving: !result });
        applyFilter();
    },
    onEnd({ previewed }) {
        // Changes that arrived while dragging, or a preview, are replaced by the saved map.
        if (renderWaiting || previewed) {
            renderWaiting = false;
            render();
        }
    },
    commit: commitMove,
    toast,
});

const renderCategories = categoryManager({
    openColorPicker,
    highlightCategory: (id) => highlightCategory(id ?? selectedCategory),
    toast,
    toggleCategory(id) {
        selectedCategory = selectedCategory === id ? null : id;
        applyFilter();
    },
});

// A tree, flower or rock standing on an empty land cell. Sorted in depth with the buildings.
function createDecoration({ x, y, src, flip = false, anchor = 0.92 }, categoryId) {
    const position = project(x, y);
    const image = element("img", "decoration");
    image.src = src;
    image.alt = "";
    image.draggable = false;
    image.dataset.category = String(categoryId);
    image.style.left = `${position.left}px`;
    image.style.top = `${position.top}px`;
    image.style.zIndex = String(1000 + Math.floor(x) + Math.floor(y));
    if (flip) image.style.setProperty("--decoration-flip", "-1");
    image.style.setProperty("--decoration-anchor", `${anchor * 100}%`);
    return image;
}

// The category's name on a wooden sign in its picket cell (layout.js keeps that cell empty).
// Decorative: the category list already names every category for screen readers.
function createPicket(cell, category) {
    const position = project(cell.x + 0.5, cell.y + 0.5);
    const picket = element("div", "category-picket");
    picket.setAttribute("aria-hidden", "true");
    picket.dataset.category = String(category.id);
    picket.style.left = `${position.left}px`;
    picket.style.top = `${position.top}px`;
    picket.style.zIndex = String(1000 + cell.x + cell.y);
    picket.style.setProperty("--zone-color", category.color);
    picket.append(element("span", "category-picket-board", category.name), element("span", "category-picket-post"));
    return picket;
}

// Draws the city from planned groups. `preview` ({movingId, showMoving}) draws a still
// copy for a building drag: the zoom, the category zones and the saved background stay.
function drawCity(groups, preview = null) {
    const ground = document.createDocumentFragment();
    const zones = document.createDocumentFragment();
    const map = document.createDocumentFragment();
    const labels = document.createDocumentFragment();

    const tiles = [];
    groups.forEach((group, index) => {
        const { category: savedCategory, items, area, cells } = group;
        const category = { ...savedCategory, color: savedCategory.color ?? colors[index % colors.length] };
        const color = category.color;
        for (let y = area.y; y < area.y + area.h; y++) {
            for (let x = area.x; x < area.x + area.w; x++) {
                ground.append(categoryGrassTile(x, y, category));
            }
        }
        if (!preview) zones.append(createZone(category, area, color));
        for (const bookmark of items) {
            const moving = preview && bookmark.id === preview.movingId;
            if (moving && !preview.showMoving) continue;
            const building = createBuilding(bookmark, category, cells.get(bookmark.id), labels, !preview);
            if (moving) building.classList.add("drag-source");
            map.append(building);
            const { src } = buildingTexture(bookmark.clickCount, bookmark.id, false, bookmark.buildingDesign);
            if (src.includes("/bld_house_"))
                for (const prop of yardFor(bookmark.id, cells.get(bookmark.id)))
                    map.append(createDecoration(prop, category.id));
        }
        for (const prop of decorationsFor(group)) map.append(createDecoration(prop, category.id));
        if (group.picket) map.append(createPicket(group.picket, category));
    });
    const roads = planRoads(groups.map((group) => group.area));
    for (const road of roads) {
        ground.append(groundTile(road.x, road.y, road.tile));
        tiles.push(road);
    }
    const land = new Set(tiles.map((road) => `${road.x},${road.y}`));
    for (const { area } of groups) {
        for (let y = area.y; y < area.y + area.h; y++) {
            for (let x = area.x; x < area.x + area.w; x++) land.add(`${x},${y}`);
        }
    }
    if (!preview) {
        backgroundView = fitCity(tiles) ?? null;
        backgroundLand = land;
        traffic.update(tiles);
    }
    const background = element("div", "background-tiles");
    drawBackground(background, land);
    ground.prepend(background);
    $("ground").replaceChildren(ground);
    if (!preview) $("zones").replaceChildren(zones);
    $("buildings").replaceChildren(map);
    $("building-labels").replaceChildren(labels);
}

async function render() {
    // Keep the map still under a dragged building; redraw when the drag ends.
    if (buildingDrag.isDragging()) {
        renderWaiting = true;
        return;
    }
    const version = ++renderVersion;
    try {
        const { groups, total } = await arrangeCity();
        if (version !== renderVersion) return;
        if (buildingDrag.isDragging()) {
            renderWaiting = true;
            return;
        }
        const snapshot = snapshotFromGroups(groups);
        mapState = { snapshot, fingerprint: layoutFingerprint(snapshot.categories, snapshot.bookmarks) };
        hideTooltip();
        lastGroups = groups;
        drawCity(groups);
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
    if (pendingColorChange && pendingColorChange.categoryId !== categoryId) {
        clearTimeout(colorSaveTimer);
        persistPendingColor();
    }
    if (pickerCategory === categoryId && colorPicker.isOpen) {
        colorPicker.close();
        return;
    }
    pickerCategory = categoryId;
    draftColorChange = onDraftChange;
    colorPicker.open(color, trigger);
}

function positionColorPicker(picker, trigger) {
    const canvas = $("canvas");
    const bounds = canvas.getBoundingClientRect(),
        anchor = trigger.getBoundingClientRect();
    const scaleX = bounds.width / canvas.offsetWidth,
        scaleY = bounds.height / canvas.offsetHeight;
    picker.style.left = `${Math.max(8, (anchor.left - bounds.left) / scaleX - picker.offsetWidth - 10)}px`;
    picker.style.top = `${Math.max(8, (anchor.top - bounds.top) / scaleY)}px`;
}

function updatePickerColor(color) {
    paintCategory(pickerCategory, color);
    if (draftColorChange) {
        draftColorChange(color);
        return;
    }
    pendingColorChange = { categoryId: pickerCategory, color };
    clearTimeout(colorSaveTimer);
    colorSaveTimer = setTimeout(persistPendingColor, 180);
}

const colorPicker = createColorPicker($("category-color-picker"), {
    onChange: updatePickerColor,
    onClose() {
        clearTimeout(colorSaveTimer);
        persistPendingColor();
    },
    onError: toast,
    position: positionColorPicker,
    // The name field of a category being edited keeps the picker open, so both can be used together.
    ignoreOutside: (target) => Boolean(target.closest(".category-color, .category-edit-input")),
});

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
// Bookmark delete: the card closes and a confirm dialog names what will be removed.
let deletingBookmark = null;
$("delete-bookmark").addEventListener("click", () => {
    if (!activeBookmark) return;
    deletingBookmark = { id: activeBookmark.id, name: activeBookmark.name };
    hideTooltip();
    $("bookmark-delete-name").textContent = `‘${deletingBookmark.name}’ 북마크가 삭제됩니다.`;
    $("bookmark-delete-status").textContent = "";
    $("bookmark-delete").showModal();
});
$("cancel-bookmark-delete").addEventListener("click", () => $("bookmark-delete").close());
$("confirm-bookmark-delete").addEventListener("click", async () => {
    $("confirm-bookmark-delete").disabled = true;
    try {
        const removed = await bookmarks.remove(deletingBookmark.id);
        $("bookmark-delete").close();
        toast(removed ? "북마크를 삭제했습니다." : "이미 삭제된 북마크입니다.");
    } catch (error) {
        $("bookmark-delete-status").textContent = "삭제하지 못했습니다. 다시 시도해 주세요.";
        console.error(error);
    } finally {
        $("confirm-bookmark-delete").disabled = false;
    }
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        hideTooltip();
        colorPicker.close();
    }
});
let backgroundFrame = 0;
window.addEventListener("resize", () => {
    fitCanvas();
    // A window drag fires many resize events; redraw the background once per frame.
    cancelAnimationFrame(backgroundFrame);
    backgroundFrame = requestAnimationFrame(() => {
        // During a drag the ground may show a planned map; the redraw after the drag fits it.
        const background = document.querySelector("#ground > .background-tiles");
        if (background && !buildingDrag.isDragging()) drawBackground(background);
    });
});
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
backfillMissingBookmarkIcons(true)
    .then(() => render())
    .catch((error) => {
        console.error(error);
        render();
    });

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
// Validate changed fields; preserve untouched names and URLs from stored data.
const nameChanged = () => $("edit-name").value.trim() !== editingBookmark?.name;
const urlChanged = () => $("edit-url").value.trim() !== editingBookmark?.url;
function validateEditor() {
    const nameMessage = nameChanged() ? bookmarkNameError($("edit-name").value) : "";
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

$("sync-bookmarks").addEventListener("click", async () => {
    const button = $("sync-bookmarks");
    if (!globalThis.chrome?.bookmarks?.getTree) {
        toast("확장 프로그램을 새로고침한 뒤 크롬 새 탭에서 동기화해 주세요.");
        return;
    }
    button.disabled = true;
    button.textContent = "동기화 중…";
    button.setAttribute("aria-busy", "true");
    try {
        const result = await importChromeBookmarks(await chrome.bookmarks.getTree());
        await backfillMissingBookmarkIcons();
        await render();
        toast(
            `북마크 ${result.bookmarks}개, 카테고리 ${result.categories}개를 가져왔습니다. 중복 ${result.duplicates}개, 지원하지 않는 주소 ${result.skipped}개는 건너뛰었습니다.`,
        );
    } catch (error) {
        toast("크롬 북마크를 가져오지 못했습니다. 확장 프로그램 권한을 확인한 뒤 다시 시도해 주세요.");
        console.error(error);
    } finally {
        button.disabled = false;
        button.textContent = "크롬 북마크 동기화";
        button.removeAttribute("aria-busy");
    }
});

setGoogleAccount();
