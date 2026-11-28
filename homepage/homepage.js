import {
    backfillMissingBookmarkIcons,
    bookmarks,
    categories,
    dismissNewBefore,
    importChromeBookmarks,
    moveBookmark,
    saveCategoryPicket,
    settings,
    subscribe,
    updateCity,
} from "../db/db.js";
import { DEFAULT_SETTINGS } from "../db/settings.js";
import { buildingPicker } from "../shared/building-picker.js";
import { categorySelect } from "../shared/category-select.js";
import { createColorPicker } from "../shared/color-picker.js";
import { isBookmarkEmoji } from "../shared/emoji-data.js";
import { createEmojiPicker } from "../shared/emoji-picker.js";
import { bookmarkEmoji, bookmarkIconUrl } from "../shared/site-icons.js";
import { bookmarkNameError, categoryError, webUrl } from "../shared/validation.js";
import { BACKGROUND_OVERSCAN, paintBackground } from "./background-renderer.js";
import { applyPreparedWallMask, buildingVisualBounds, prepareBuildingAppearance } from "./building-appearance.js";
import { createBuildingDrag } from "./building-drag.js";
import { layoutFingerprint, planMove, snapshotFromGroups } from "./building-move.js";
import { buildingTexture, isDamaged } from "./building-rules.js";
import { assignCategoryColors, colors, grassAppearanceForCategory, wallColorAdjustments } from "./category-colors.js";
import { categoryManager } from "./category-manager.js";
import { decorationsFor, yardFor } from "./decorations.js";
import { setGoogleAccount } from "./google-account.js";
import { createGoogleLauncher } from "./google-launcher.js";
import { planCity, planRoads, project, setLandSpacing, TILE_HEIGHT, TILE_WIDTH } from "./layout.js";
import { createMapCamera } from "./map-camera.js";
import { createPicketDrag } from "./picket-drag.js";
import { createSettingsPanel } from "./settings-panel.js";
import { SpatialIndex } from "./spatial-index.js";
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
// A building row in the category panel that opened the detail card, and the bookmark whose card
// a click on such a row pinned (stays open until unpinned; see selectBuilding).
let panelAnchor = null;
let pinnedBookmark = null;
let pickerCategory = null;
let colorSaveTimer;
let pendingColorChange = null;
let draftColorChange = null;
let buildingIndex = new SpatialIndex();
let obstructedBuildings = new Set();
let drawnSignature = null;
// "지도 장식 밀도" from the saved settings, read on every render.
let decorationDensity = DEFAULT_SETTINGS.decorationDensity;
// "칸 여백" the last plan used; null until the first render.
let landSpacing = null;
let openInNewTab = DEFAULT_SETTINGS.openInNewTab;
let emptySpaceFill = { ...DEFAULT_SETTINGS.emptySpaceFill };
let emphasizedBuildings = new Set();
let emphasizedIcons = new Set();
let renderedGroups = new Map();
let editDesignPreview = null;
const buildingWorldRects = new WeakMap();

function setObstructedBuildings(next = new Set()) {
    for (const node of obstructedBuildings) if (!next.has(node)) node.classList.remove("popup-obstructed");
    for (const node of next) if (!obstructedBuildings.has(node)) node.classList.add("popup-obstructed");
    obstructedBuildings = next;
}

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
    const canvasHeight = Math.max(1, innerHeight / scale);
    document.documentElement.style.setProperty("--homepage-scale", String(scale));
    $("canvas").style.transform = `scale(${scale})`;
    $("canvas").style.height = `${canvasHeight}px`;
    $("viewport").style.width = `${innerWidth}px`;
    $("viewport").style.height = `${canvasHeight * scale}px`;
    MAP_AREA.top = Math.min(200, canvasHeight * 0.18);
    MAP_AREA.height = Math.max(250, canvasHeight - MAP_AREA.top - 70);
    backgroundView = fitCity(lastCityTiles) ?? backgroundView;
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

// The hover card uses the same emoji or favicon as the building's map icon.
const DEFAULT_SITE_ICON = "../assets/icons/icon32.png";
let tooltipIconLoad = null;
function showTooltipIcon(bookmark) {
    const icon = $("tooltip-icon");
    tooltipIconLoad = null; // an earlier, slower load must not replace this one
    const emoji = bookmarkEmoji(bookmark);
    if (emoji) {
        icon.textContent = emoji;
        return;
    }
    const src = bookmarkIconUrl(bookmark) || DEFAULT_SITE_ICON;
    if (icon.querySelector("img")?.getAttribute("src") === src) return;
    const image = element("img", "tooltip-site-image");
    image.alt = "";
    image.src = DEFAULT_SITE_ICON;
    icon.replaceChildren(image);
    if (src === DEFAULT_SITE_ICON) return;
    const loader = new Image();
    tooltipIconLoad = loader;
    loader.onload = () => {
        if (tooltipIconLoad === loader) image.src = src;
    };
    loader.onerror = () => {
        if (tooltipIconLoad === loader) image.src = DEFAULT_SITE_ICON;
    };
    loader.src = src;
}

function hideTooltip() {
    tooltip.hidden = true;
    hoverBridge.hidden = true;
    hoverCorridor = [];
    if (activeLink) activeLink.removeAttribute("aria-describedby");
    activeLink = null;
    setObstructedBuildings();
    for (const item of $("buildings").querySelectorAll(".focused-building")) item.classList.remove("focused-building");
    panelAnchor = null;
    pinnedBookmark = null;
    syncPanelRows();
    syncMapEmphasis();
}

function scheduleHide(event) {
    if ($("bookmark-editor").open) return;
    // A pinned card closes only when the pointer leaves the card itself (other rules: selectBuilding).
    if (pinnedBookmark !== null) {
        if (event.type === "mouseleave" && event.currentTarget === tooltip && !tooltip.contains(event.relatedTarget))
            hideTooltip();
        return;
    }
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
        setObstructedBuildings();
        return;
    }
    hoverBridge.style.left = `${left}px`;
    hoverBridge.style.top = `${top}px`;
    hoverBridge.style.width = `${width}px`;
    hoverBridge.style.height = `${height}px`;
    hoverBridge.style.clipPath = `polygon(${hoverCorridor.map((point) => `${((point.x - left) / width) * 100}% ${((point.y - top) / height) * 100}%`).join(",")})`;
    const origin = $("world").getBoundingClientRect();
    const canvas = $("canvas");
    const scale =
        (new DOMMatrixReadOnly(getComputedStyle($("world")).transform).a * canvas.getBoundingClientRect().width) /
        canvas.offsetWidth;
    const candidates = buildingIndex.search({
        left: (left - origin.left) / scale,
        right: (right - origin.left) / scale,
        top: (top - origin.top) / scale,
        bottom: (bottom - origin.top) / scale,
    });
    setObstructedBuildings(
        new Set(
            candidates
                .filter(
                    ({ rect, value }) =>
                        !value.contains(activeLink) &&
                        intersectsHoverCorridor({
                            left: origin.left + rect.left * scale,
                            right: origin.left + rect.right * scale,
                            top: origin.top + rect.top * scale,
                            bottom: origin.top + rect.bottom * scale,
                        }),
                )
                .map(({ value }) => value),
        ),
    );
}

function intersectsHoverCorridor(rect) {
    if (hoverCorridor.length !== 4) return false;
    const corners = [
        { x: rect.left, y: rect.top },
        { x: rect.right, y: rect.top },
        { x: rect.right, y: rect.bottom },
        { x: rect.left, y: rect.bottom },
    ];
    const axes = [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
    ];
    hoverCorridor.forEach((point, index) => {
        const next = hoverCorridor[(index + 1) % hoverCorridor.length];
        axes.push({ x: -(next.y - point.y), y: next.x - point.x });
    });
    return axes.every((axis) => {
        const a = corners.map((point) => point.x * axis.x + point.y * axis.y);
        const b = hoverCorridor.map((point) => point.x * axis.x + point.y * axis.y);
        return Math.max(...a) >= Math.min(...b) && Math.max(...b) >= Math.min(...a);
    });
}

function showTooltip(bookmark, category, link) {
    // No detail card while a building is being dragged (focus can return mid-drag).
    if (buildingDrag.isDragging() || picketDrag.isDragging() || camera.isInteracting()) return;
    if (activeLink && activeLink !== link) activeLink.removeAttribute("aria-describedby");
    activeLink = link;
    activeBookmark = bookmark;
    syncMapEmphasis();
    const focused = link.closest(".building");
    for (const item of $("buildings").querySelectorAll(".focused-building"))
        if (item !== focused) item.classList.remove("focused-building");
    focused.classList.add("focused-building");
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
    const image = link.querySelector(".building-image");
    const bounds = buildingVisualBounds(image);
    const worldStyle = getComputedStyle($("world"));
    const grow = Number.parseFloat(worldStyle.getPropertyValue("--hover-grow"));
    const rise = Number.parseFloat(worldStyle.getPropertyValue("--hover-rise"));
    const nativeWidth = image.naturalWidth || anchor.width;
    const canvasScale = anchor.height / (image.naturalHeight || anchor.height || 1);
    const visualWidth = nativeWidth * canvasScale * grow;
    const visualHeight = anchor.height * grow;
    const visualLeft = anchor.left + (nativeWidth * canvasScale - visualWidth) / 2;
    const visualTop = anchor.bottom - visualHeight - rise * canvasScale;
    const visible = {
        left: visualLeft + bounds.left * visualWidth,
        right: visualLeft + bounds.right * visualWidth,
        top: visualTop + bounds.top * visualHeight,
    };
    const box = tooltip.getBoundingClientRect();
    const zone = [...$("zones").children].find((item) => item.dataset.category === String(category.id));
    const area = zone?.querySelector("svg").getBoundingClientRect();
    const building = link.closest(".building").getBoundingClientRect();
    const preferRight = area && building.left + building.width / 2 > area.left + area.width / 2 + 0.5;
    const gap = Number.parseFloat(getComputedStyle(tooltip).getPropertyValue("--building-popup-gap"));
    const left = visible.left - box.width - gap;
    const right = visible.right + gap;
    const y = Math.max(12, Math.min(visible.top, innerHeight - box.height - 12));
    // The category panel sits at the top right; keep the card clear of it where they share rows.
    const panel = (
        document.querySelector(".category-panel:not([hidden])") ?? $("settings-panel")
    ).getBoundingClientRect();
    const besidePanel = panel.width && y < panel.bottom && y + box.height > panel.top;
    const rightEdge = besidePanel ? panel.left : innerWidth;
    const leftFits = left >= 12;
    const rightFits = right + box.width <= rightEdge - 12;
    let x = preferRight ? right : left;
    if (preferRight && !rightFits && leftFits) x = left;
    if (!preferRight && !leftFits && rightFits) x = right;
    tooltip.style.left = `${Math.max(12, Math.min(x, rightEdge - box.width - 12))}px`;
    tooltip.style.top = `${y}px`;
    positionHoverBridge();
}

// Only .zone outlines: #zones also holds the drag marker and expansion slots.
function highlightCategory(id) {
    for (const zone of $("zones").querySelectorAll(":scope > .zone"))
        zone.classList.toggle("active", zone.dataset.category === id);
}

function syncMapEmphasis() {
    const categoryFocus = !activeLink && selectedCategory !== null;
    $("world").classList.toggle("detail-focus", Boolean(activeLink) || selectedCategory !== null);
    $("world").classList.toggle("category-focus", categoryFocus);
    const icons = new Set(
        categoryFocus
            ? [...$("building-labels").querySelectorAll(".building-icon")].filter(
                  (icon) => icon.dataset.category === selectedCategory,
              )
            : [],
    );
    for (const icon of emphasizedIcons) if (!icons.has(icon)) icon.classList.remove("emphasized-icon");
    for (const icon of icons) if (!emphasizedIcons.has(icon)) icon.classList.add("emphasized-icon");
    emphasizedIcons = icons;
    const hoveredCategory = activeLink?.closest(".building").dataset.category;
    for (const row of $("category-list").children)
        row.querySelector(".category-filter")?.classList.toggle(
            "building-hovered",
            row.dataset.category === hoveredCategory,
        );
    const next = activeLink
        ? new Set([activeLink.closest(".building")])
        : new Set(
              selectedCategory === null
                  ? []
                  : [...$("buildings").querySelectorAll(":scope > .building")].filter(
                        (item) => item.dataset.category === selectedCategory,
                    ),
          );
    for (const item of emphasizedBuildings) if (!next.has(item)) item.classList.remove("emphasized-building");
    for (const item of next) if (!emphasizedBuildings.has(item)) item.classList.add("emphasized-building");
    emphasizedBuildings = next;
}

function applyFilter() {
    syncMapEmphasis();
    for (const row of $("category-list").children) {
        row.querySelector(".category-filter")?.setAttribute(
            "aria-pressed",
            String(row.dataset.category === selectedCategory),
        );
        // The selected category lists its buildings under its row.
        const buildings = row.querySelector(".building-list");
        if (buildings) buildings.hidden = row.dataset.category !== selectedCategory;
    }
    syncPanelRows();
    highlightCategory(selectedCategory);
}

function syncPanelRows() {
    for (const button of document.querySelectorAll(".category-panel .building-row-select"))
        button.setAttribute("aria-pressed", String(button.dataset.bookmark === String(pinnedBookmark)));
}

// Shows a building's detail card from its row in the category panel, as hovering the building does.
function showFromPanel(id, row) {
    const link = $("buildings").querySelector(`.building[data-bookmark="${CSS.escape(String(id))}"] .building-link`);
    for (const group of lastGroups) {
        const bookmark = group.items.find((item) => String(item.id) === String(id));
        if (!bookmark || !link) continue;
        panelAnchor = row;
        highlightCategory(group.category.id);
        showTooltip(bookmark, group.category, link);
        return true;
    }
    return false;
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
    // Same depth as a CSS variable, so an emphasized building can rise above the focus veil in order.
    wrapper.style.setProperty("--depth", String(1000 + cell.x + cell.y));
    const link = element("a", "building-link");
    const url = safeUrl(bookmark.url);
    if (url) link.href = url.href;
    else link.tabIndex = 0;
    link.target = openInNewTab ? "_blank" : "_self";
    link.rel = "noopener noreferrer";
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
    const fallbackIcon = element("span", "building-icon-fallback", bookmarkEmoji(bookmark) || "🌐");
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
    prepareBuildingAppearance(image, hitArea)
        .then(() => {
            if (interactive) {
                const rect = {
                    left: position.left - TILE_WIDTH / 2,
                    right: position.left - TILE_WIDTH / 2 + image.naturalWidth,
                    top: position.top - image.naturalHeight,
                    bottom: position.top,
                };
                buildingWorldRects.set(wrapper, rect);
                if (wrapper.isConnected) buildingIndex.insert(rect, wrapper);
            }
        })
        .catch((error) => {
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
        wrapper.classList.add("map-preview-building");
        link.removeAttribute("href");
        link.tabIndex = -1;
        return wrapper;
    }
    buildingDrag.attach(link, wrapper, bookmark);
    link.addEventListener("mouseenter", (event) => {
        if (pinnedBookmark !== null) return;
        if (activeLink && activeLink !== link && inHoverCorridor(event.clientX, event.clientY)) return;
        highlightCategory(category.id);
        showTooltip(bookmark, category, link);
    });
    link.addEventListener("mouseleave", (event) => {
        if (activeLink !== link) return;
        highlightCategory(selectedCategory);
        scheduleHide(event);
    });
    link.addEventListener("focus", () => {
        if (pinnedBookmark === null) showTooltip(bookmark, category, link);
    });
    link.addEventListener("blur", scheduleHide);
    link.addEventListener("click", (event) => {
        if (!url) {
            event.preventDefault();
            toast("올바른 웹페이지 주소가 아닙니다.");
            return;
        }

        const keepDefaultNavigation =
            openInNewTab || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
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
    // Round down to a crisp pixel-art zoom (see map-camera.js), so the city still fits.
    const zoom = camera.crispZoomAtMost(Math.min(MAX_ZOOM, MAP_AREA.width / width, MAP_AREA.height / height));
    const x = MAP_AREA.left + (MAP_AREA.width - width * zoom) / 2 - minLeft * zoom;
    const y = MAP_AREA.top + (MAP_AREA.height - height * zoom) / 2 - minTop * zoom;
    const world = $("world");
    const first = !world.style.transform;
    const view = camera.fit({ x, y, zoom }, { left: minLeft, top: minTop, right: maxRight, bottom: maxBottom });
    if (first) {
        // Animate later zoom changes only, not the first placement on page load.
        void world.offsetWidth;
        world.classList.add("animated");
    }
    return view;
}

// Lot ground under the whole canvas outside categories and roads. Kept apart from
// fitCity so the background never changes the zoom. Redrawn when the canvas resizes.
let backgroundLand = null;
let backgroundView = null;
let paintedView = null; // the view the background canvas was last painted for
function drawBackground(layer, land = backgroundLand) {
    if (!land || !backgroundView) return;
    paintedView = backgroundView;
    const canvas = $("canvas");
    paintBackground(layer, {
        land,
        view: backgroundView,
        width: canvas.offsetWidth,
        height: canvas.offsetHeight,
        pixelRatio: camera.pixelRatio(),
        fill: emptySpaceFill,
    }).catch((error) => {
        console.error(error);
        toast("배경을 불러오지 못했습니다. 새로고침해 주세요.");
    });
}

// Plan positions and save what changed. The lock keeps several new tabs from planning at once.
async function arrangeCity(refit = false) {
    return updateCity((savedCategories, savedBookmarks) => {
        const assigned = assignCategoryColors(savedCategories);
        return {
            plan: planCity(assigned.categories, savedBookmarks, { refit }),
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

const picketDrag = createPicketDrag({
    world: $("world"),
    canvas: $("canvas"),
    overlay: $("zones"),
    onStart: hideTooltip,
    // Changes that arrived while dragging (the saved move included) are drawn now.
    onEnd() {
        if (renderWaiting) {
            renderWaiting = false;
            render();
        }
    },
    commit: commitPicket,
    toast,
});

// Saves a dragged picket. Dropped on a building of its land, that building takes the picket's old
// cell in the same write; cancelled if the building is no longer where the drag saw it.
function commitPicket(categoryId, offset, swap) {
    if (!swap) return saveCategoryPicket(categoryId, offset);
    return moveBookmark((savedCategories, savedBookmarks) => {
        const bookmark = savedBookmarks.find((item) => item.id === swap.bookmarkId);
        const inPlace =
            bookmark &&
            String(bookmark.category) === String(categoryId) &&
            bookmark.cell?.x === swap.from.x &&
            bookmark.cell?.y === swap.from.y;
        if (!inPlace) return null;
        return {
            categories: savedCategories.map((category) =>
                category.id === categoryId ? { ...category, picket: { ...offset } } : category,
            ),
            bookmarks: savedBookmarks.map((item) =>
                item.id === swap.bookmarkId ? { ...item, cell: { ...swap.to } } : item,
            ),
        };
    });
}

let cameraBackgroundTimer;
const camera = createMapCamera({
    surface: $("city"),
    canvas: $("canvas"),
    world: $("world"),
    canStart: () =>
        !buildingDrag.isDragging() && !picketDrag.isDragging() && !document.querySelector(".drag-arming, dialog[open]"),
    onChange(view) {
        backgroundView = view;
        if (activeLink || !tooltip.hidden) hideTooltip();
        // Keep the cached background during a gesture and rasterise once the camera settles. Repaint
        // right away when the zoom changes (a zoom-out shows more than the canvas covers) or half of the
        // overscan is used up, so the unpainted area never comes into view.
        const repaint = () => {
            const background = document.querySelector("#ground > .background-tiles");
            if (background) drawBackground(background);
        };
        clearTimeout(cameraBackgroundTimer);
        if (
            paintedView &&
            (view.zoom !== paintedView.zoom ||
                Math.max(Math.abs(view.x - paintedView.x), Math.abs(view.y - paintedView.y)) > BACKGROUND_OVERSCAN / 2)
        )
            repaint();
        else cameraBackgroundTimer = setTimeout(repaint, 120);
    },
});

const renderCategories = categoryManager({
    openColorPicker,
    highlightCategory: (id) => highlightCategory(id ?? selectedCategory),
    toast,
    toggleCategory(id) {
        if (pinnedBookmark !== null) hideTooltip();
        selectedCategory = selectedCategory === id ? null : id;
        applyFilter();
    },
    onSearchChange: hideTooltip,
    // Hovering a building row previews it like hovering the building; nothing changes while a card is pinned.
    hoverBuilding(id, row) {
        if (pinnedBookmark !== null) return;
        if (id !== null) showFromPanel(id, row);
        else if (panelAnchor === row) {
            highlightCategory(selectedCategory);
            hideTooltip();
        }
    },
    // Clicking a row pins its card; clicking the same row again unpins. Another row, a category name, the
    // empty map, or leaving the card after entering it also unpins (scheduleHide, document click).
    selectBuilding(id, row) {
        if (String(pinnedBookmark) === String(id)) {
            hideTooltip();
            return;
        }
        if (!showFromPanel(id, row)) return;
        pinnedBookmark = id;
        syncPanelRows();
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
// The sign can be dragged to another empty cell of its land (picket-drag.js).
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

function groupRenderKey(group) {
    return JSON.stringify([
        decorationDensity,
        group.category,
        group.area,
        group.picket,
        group.items.map((bookmark) => [bookmark, group.cells.get(bookmark.id), isDamaged(bookmark)]),
    ]);
}

// Draws the city from planned groups. `preview` ({movingId, showMoving}) draws a still
// copy for a building drag: the zoom, the category zones and the saved background stay.
function drawCity(groups, preview = null) {
    if (preview) drawnSignature = null;
    buildingIndex = new SpatialIndex();
    setObstructedBuildings();
    const layers = Object.fromEntries(
        ["ground", "zones", "map", "labels"].map((key) => [key, document.createDocumentFragment()]),
    );
    const nextGroups = new Map();

    const tiles = [];
    groups.forEach((group, index) => {
        const key = groupRenderKey(group);
        const cached = !preview && renderedGroups.get(group.category.id);
        if (cached && cached.key === key) {
            for (const name of Object.keys(layers)) layers[name].append(...cached[name]);
            for (const node of cached.map) {
                const rect = buildingWorldRects.get(node);
                if (rect) buildingIndex.insert(rect, node);
            }
            nextGroups.set(group.category.id, cached);
            return;
        }
        const { ground, zones, map, labels } = Object.fromEntries(
            Object.keys(layers).map((name) => [name, document.createDocumentFragment()]),
        );
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
                for (const prop of yardFor(bookmark.id, cells.get(bookmark.id), decorationDensity))
                    map.append(createDecoration(prop, category.id));
        }
        for (const prop of decorationsFor(group, decorationDensity)) map.append(createDecoration(prop, category.id));
        if (group.picket) {
            const picket = createPicket(group.picket, category);
            // Only saved categories keep a picket position; the preview map is pictures only.
            if (!preview && group.category.id !== "uncategorized") picketDrag.attach(picket, group);
            map.append(picket);
        }
        const entry = { key };
        for (const [name, fragment] of Object.entries({ ground, zones, map, labels })) {
            entry[name] = [...fragment.childNodes];
            layers[name].append(fragment);
        }
        nextGroups.set(group.category.id, entry);
    });
    if (!preview) renderedGroups = nextGroups;
    const { ground, zones, map, labels } = layers;
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
    // Keep the map still under a dragged building or picket; redraw when the drag ends.
    if (buildingDrag.isDragging() || picketDrag.isDragging()) {
        renderWaiting = true;
        return;
    }
    const version = ++renderVersion;
    try {
        // "칸 여백" goes into the plan, so the settings come first. When it changed since the last
        // render, every land is resized to it at once.
        const mapSettings = await settings.get();
        const refit = landSpacing !== null && landSpacing !== mapSettings.landSpacing;
        landSpacing = mapSettings.landSpacing;
        setLandSpacing(landSpacing);
        const { groups, total } = await arrangeCity(refit);
        if (version !== renderVersion) return;
        decorationDensity = mapSettings.decorationDensity;
        openInNewTab = mapSettings.openInNewTab;
        emptySpaceFill = mapSettings.emptySpaceFill;
        traffic.setEnabled(mapSettings.cityAnimation);
        if (buildingDrag.isDragging() || picketDrag.isDragging()) {
            renderWaiting = true;
            return;
        }
        const snapshot = snapshotFromGroups(groups);
        mapState = { snapshot, fingerprint: layoutFingerprint(snapshot.categories, snapshot.bookmarks) };
        if (editDesignPreview)
            for (const group of groups)
                group.items = group.items.map((bookmark) =>
                    bookmark.id === editDesignPreview.id
                        ? { ...bookmark, buildingDesign: editDesignPreview.buildingDesign }
                        : bookmark,
                );
        hideTooltip();
        lastGroups = groups;
        // The photo data URL can be over 1MB; its length and both ends identify it without copying it.
        const { photoDataUrl: photo, ...fill } = emptySpaceFill;
        const signature = JSON.stringify([
            decorationDensity,
            fill,
            photo.length,
            photo.slice(0, 64),
            photo.slice(-64),
            groups
                .map((group) => ({
                    id: group.category.id,
                    category: group.category,
                    area: group.area,
                    picket: group.picket,
                    items: group.items
                        .map((bookmark) => ({
                            ...bookmark,
                            damaged: isDamaged(bookmark),
                            cell: group.cells.get(bookmark.id),
                        }))
                        .sort((a, b) => String(a.id).localeCompare(String(b.id))),
                }))
                .sort((a, b) => String(a.id).localeCompare(String(b.id))),
        ]);
        if (signature !== drawnSignature) {
            drawCity(groups);
            drawnSignature = signature;
        }
        if (selectedCategory && !groups.some((group) => group.category.id === selectedCategory))
            selectedCategory = null;
        renderCategories(groups);
        if (activeBookmark && !groups.some((group) => group.items.some((item) => item.id === activeBookmark.id)))
            hideTooltip();
        $("map-status").textContent = total
            ? ""
            : "저장한 페이지가 아직 없습니다. 확장프로그램에서 첫 페이지를 저장해 보세요.";
        if ($("bookmark-editor").open && editingBookmark) {
            activeLink = $("buildings").querySelector(
                `.building[data-bookmark="${CSS.escape(String(editingBookmark.id))}"] .building-link`,
            );
            activeLink?.closest(".building").classList.add("focused-building");
        }
        applyFilter();
        for (const link of $("buildings").querySelectorAll(".building-link"))
            link.target = openInNewTab ? "_blank" : "_self";
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
    // Figma USER-MAIN-CATEGORY-002: 16px (component/category-panel-overlay-gap) left of the category panel,
    // top level with the color chip; recomputed from both boxes each time it opens.
    const panel = trigger.closest(".category-panel")?.getBoundingClientRect() ?? anchor;
    const gap = Number.parseFloat(getComputedStyle(picker).getPropertyValue("--category-panel-overlay-gap"));
    picker.style.left = `${Math.max(8, (panel.left - bounds.left) / scaleX - picker.offsetWidth - gap)}px`;
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
document.addEventListener("click", (event) => {
    // A click outside the pinned card and the panel's rows unpins it (rows and category names handle their own).
    if (
        pinnedBookmark !== null &&
        !event.target.closest("#bookmark-tooltip, #bookmark-editor, .building-row, .category-filter")
    )
        hideTooltip();
    if (selectedCategory === null || event.defaultPrevented) return;
    const target = event.target;
    // Category controls retain their own selection/switching behavior.
    if (target.closest(".category-row")) return;
    const building = target.closest(".building");
    if (building?.dataset.category === selectedCategory) return;
    if (String(activeBookmark?.category) === selectedCategory && target.closest("#bookmark-tooltip, #bookmark-editor"))
        return;
    selectedCategory = null;
    applyFilter();
});
document.addEventListener("mousemove", (event) => {
    if (!activeLink || tooltip.hidden || $("bookmark-editor").open) return;
    if (pinnedBookmark !== null || panelAnchor?.contains(event.target)) return;
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
        // A favicon update from another tab (background.js) only refreshes the open card's icon;
        // the map icons pick it up on the next full render.
        const mapFields = (items) =>
            items.map(({ memo: _memo, isNew: _new, preview: _preview, iconUrl: _iconUrl, ...item }) => item);
        if (JSON.stringify(mapFields(bookmarkChange.oldValue)) === JSON.stringify(mapFields(bookmarkChange.newValue))) {
            if (activeBookmark) {
                const updated = bookmarkChange.newValue.find((item) => item.id === activeBookmark.id);
                if (updated && updated.iconUrl !== activeBookmark.iconUrl && !tooltip.hidden) {
                    activeBookmark.iconUrl = updated.iconUrl;
                    showTooltipIcon(activeBookmark);
                }
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
const googleLauncher = createGoogleLauncher({
    load: async () => (await settings.get()).googleLauncher,
    save: (ids) => settings.edit({ googleLauncher: ids }),
    onError: (message) => toast(message),
});
googleLauncher.refresh().catch(console.error);
function showGoogleServices(shown) {
    if (!shown) googleLauncher.cancel();
    $("google-services").hidden = !shown;
    $("apps-button").setAttribute("aria-expanded", String(shown));
}
$("apps-button").addEventListener("click", () => showGoogleServices($("google-services").hidden));
let editingBookmark;
let draftEditCategory = null;
let editCategories = [];
let initialDesign = null;
let editUseEmoji = false;
let editEmoji = "😊";
function renderEditIcon() {
    const preview = $("edit-icon-preview");
    preview.replaceChildren();
    if (editUseEmoji) {
        preview.textContent = editEmoji;
        return;
    }
    preview.textContent = "🌐";
    const src = bookmarkIconUrl({ ...editingBookmark, useEmoji: false });
    if (!src) return;
    const image = element("img", "editor-site-icon");
    image.alt = "";
    image.hidden = true;
    image.addEventListener(
        "load",
        () => {
            if (!image.isConnected) return;
            preview.replaceChildren(image);
            image.hidden = false;
        },
        { once: true },
    );
    image.addEventListener("error", () => image.remove(), { once: true });
    image.src = src;
    preview.append(image);
}
const editEmojiPicker = createEmojiPicker($("edit-emoji-picker"), {
    onChange(emoji) {
        editEmoji = emoji;
        editUseEmoji = true;
        renderEditIcon();
    },
    onUseSiteIcon() {
        editUseEmoji = false;
        renderEditIcon();
    },
    position(picker, trigger) {
        // The dialog is scaled with the homepage; convert viewport bounds to its local coordinates.
        const editor = $("bookmark-editor");
        const bounds = editor.getBoundingClientRect();
        const anchor = trigger.getBoundingClientRect();
        const scaleX = bounds.width / editor.offsetWidth;
        const scaleY = bounds.height / editor.offsetHeight;
        picker.style.left = `${Math.max(
            0,
            Math.min((anchor.left - bounds.left) / scaleX - editor.clientLeft, editor.clientWidth - picker.offsetWidth),
        )}px`;
        picker.style.top = `${Math.max(
            0,
            Math.min(
                (anchor.bottom - bounds.top) / scaleY - editor.clientTop,
                editor.clientHeight - picker.offsetHeight,
            ),
        )}px`;
    },
});
$("edit-icon").addEventListener("click", () => {
    if (editEmojiPicker.isOpen) editEmojiPicker.close();
    else editEmojiPicker.open($("edit-icon"), editUseEmoji ? editEmoji : "");
});
document.querySelector(".editor-content").addEventListener("scroll", () => editEmojiPicker.close());
const editDesign = buildingPicker({
    host: $("edit-designs"),
    previous: $("edit-previous-design"),
    next: $("edit-next-design"),
    onChange(buildingDesign) {
        if (!editingBookmark || !$("bookmark-editor").open) return;
        editDesignPreview = buildingDesign === initialDesign ? null : { id: editingBookmark.id, buildingDesign };
        render();
    },
});
// The design strip shows the walls in the color of the chosen category.
const paintEditDesign = (id) => {
    const color = editCategories.find((category) => category.id === id)?.color;
    if (color) editDesign.setColor(color);
};
const editSelect = categorySelect($("edit-category"), { onChange: paintEditDesign });
function setEditCategoryMode(create) {
    draftEditCategory = create
        ? {
              id: crypto.randomUUID(),
              color: colors.find((color) => !editCategories.some((item) => item.color === color)) ?? colors[0],
          }
        : null;
    $("edit-category").hidden = create;
    $("edit-new-category").hidden = create;
    $("edit-new-category-fields").hidden = !create;
    $("edit-category-label").textContent = create ? "새 카테고리 이름" : "카테고리";
    $("edit-new-category-error").textContent = "";
    $("edit-new-category-name").removeAttribute("aria-invalid");
    if (create) {
        $("edit-new-category-name").value = "일반";
        editDesign.setColor(draftEditCategory.color);
        $("edit-new-category-name").focus();
        $("edit-new-category-name").select();
    } else paintEditDesign(editSelect.value);
}
$("edit-new-category").addEventListener("click", () => setEditCategoryMode(true));
$("edit-existing-category").addEventListener("click", () => {
    setEditCategoryMode(false);
    editSelect.trigger.focus();
});
function closeEditor() {
    editEmojiPicker.close();
    $("bookmark-editor").close();
    hideTooltip();
}
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
        editCategories = assignCategoryColors(await categories.get()).categories;
        editSelect.setItems(editCategories, editingBookmark.category);
        setEditCategoryMode(false);
        // Start from the design the map draws now; bookmarks saved without one get it from their id.
        const { family, variant } = buildingTexture(0, editingBookmark.id, false, editingBookmark.buildingDesign);
        editDesign.select(editingBookmark.buildingDesign, { family, variant });
        initialDesign = editDesign.value;
        paintEditDesign(editingBookmark.category);
        $("edit-name").value = editingBookmark.name;
        $("edit-url").value = editingBookmark.url;
        editUseEmoji = Boolean(bookmarkEmoji(editingBookmark));
        editEmoji = isBookmarkEmoji(editingBookmark.emoji) ? editingBookmark.emoji : "😊";
        renderEditIcon();
        for (const field of ["edit-name", "edit-url"]) $(field).removeAttribute("aria-invalid");
        for (const field of ["edit-name-error", "edit-url-error", "edit-status"]) $(field).textContent = "";
        const left = tooltip.style.left,
            top = tooltip.style.top;
        tooltip.hidden = true;
        setObstructedBuildings();
        $("bookmark-editor").style.left = left;
        $("bookmark-editor").style.top = top;
        // The rest of the map fades further than for the detail card; the building stays sharp.
        $("world").classList.add("editor-focus");
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
    const categoryMessage = draftEditCategory ? categoryError($("edit-new-category-name").value, editCategories) : "";
    $("edit-new-category-error").textContent = categoryMessage;
    $("edit-new-category-name").setAttribute("aria-invalid", String(Boolean(categoryMessage)));
    $("edit-name-error").textContent = nameMessage;
    $("edit-url-error").textContent = urlMessage;
    $("edit-name").setAttribute("aria-invalid", String(Boolean(nameMessage)));
    $("edit-url").setAttribute("aria-invalid", String(Boolean(urlMessage)));
    return !nameMessage && !urlMessage && !categoryMessage;
}
$("edit-name").addEventListener("input", validateEditor);
$("edit-url").addEventListener("input", validateEditor);
$("edit-new-category-name").addEventListener("input", validateEditor);
$("edit-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if ($("save-editor").disabled) return;
    if (!validateEditor()) return;
    if (!draftEditCategory && !editSelect.value) {
        $("edit-status").textContent = "카테고리를 선택해 주세요.";
        editSelect.trigger.focus();
        return;
    }
    $("save-editor").disabled = true;
    $("cancel-editor").disabled = true;
    document.querySelector(".editor-content").inert = true;
    try {
        if (draftEditCategory) {
            const latest = await categories.get();
            const error = categoryError($("edit-new-category-name").value, latest);
            if (error) throw new Error(error);
            if (!(await bookmarks.get(editingBookmark.id))) throw new Error("삭제된 북마크입니다.");
            const created = await categories.add({
                ...draftEditCategory,
                name: $("edit-new-category-name").value.trim(),
                customColor: false,
            });
            editCategories = assignCategoryColors(await categories.get()).categories;
            editSelect.setItems(editCategories, created.id);
            setEditCategoryMode(false);
        }
        if (!(await categories.get(editSelect.value)))
            throw new Error("카테고리가 삭제되었습니다. 다시 선택해 주세요.");
        const changes = { category: editSelect.value };
        if (nameChanged()) changes.name = $("edit-name").value.trim();
        if (urlChanged()) changes.url = $("edit-url").value.trim();
        if (editDesign.value !== initialDesign) changes.buildingDesign = editDesign.value;
        if (editUseEmoji !== (editingBookmark.useEmoji === true)) changes.useEmoji = editUseEmoji;
        if (editEmoji !== editingBookmark.emoji && (editUseEmoji || editingBookmark.emoji !== undefined))
            changes.emoji = editEmoji;
        const result = await bookmarks.edit(editingBookmark.id, changes);
        if (!result) throw new Error("삭제된 북마크입니다.");
        closeEditor();
        toast("북마크를 수정했습니다.");
    } catch (error) {
        $("edit-status").textContent = error.message || "저장하지 못했습니다.";
        console.error(error);
    } finally {
        $("save-editor").disabled = false;
        $("cancel-editor").disabled = false;
        document.querySelector(".editor-content").inert = false;
    }
});
$("bookmark-editor").addEventListener("close", () => {
    const hadPreview = editDesignPreview !== null;
    editDesignPreview = null;
    editEmojiPicker.close();
    editingBookmark = null;
    draftEditCategory = null;
    $("world").classList.remove("editor-focus");
    hideTooltip();
    if (hadPreview) render();
});
$("bookmark-editor").addEventListener("cancel", async (event) => {
    if ($("save-editor").disabled) {
        event.preventDefault();
        return;
    }
    if (editEmojiPicker.isOpen) {
        event.preventDefault();
        editEmojiPicker.close(true);
        return;
    }
    if (!editDesignPreview) return;
    event.preventDefault();
    $("save-editor").disabled = true;
    $("cancel-editor").disabled = true;
    document.querySelector(".editor-content").inert = true;
    try {
        const result = await bookmarks.edit(editingBookmark.id, { buildingDesign: editDesignPreview.buildingDesign });
        if (!result) throw new Error("삭제된 북마크입니다.");
        closeEditor();
    } catch (error) {
        $("edit-status").textContent = "건물 디자인을 저장하지 못했습니다. 다시 시도해 주세요.";
        console.error(error);
    } finally {
        $("save-editor").disabled = false;
        $("cancel-editor").disabled = false;
        document.querySelector(".editor-content").inert = false;
    }
});

// Imports Chrome's bookmarks ("지금 동기화" and "크롬 북마크 자동 동기화") and redraws the map.
async function syncChromeBookmarks() {
    const result = await importChromeBookmarks(await chrome.bookmarks.getTree());
    await backfillMissingBookmarkIcons();
    await render();
    return result;
}

createSettingsPanel({
    // The settings panel takes the category panel's place while it is open (Figma USER-MAIN-OPTIONS).
    onOpen() {
        hideTooltip();
        showGoogleServices(false);
        colorPicker.close();
        document.querySelector(".category-panel").hidden = true;
    },
    onClose() {
        document.querySelector(".category-panel").hidden = false;
    },
    onSaved: render,
    onError: toast,
    async onReset() {
        clearTimeout(colorSaveTimer);
        pendingColorChange = null;
        selectedCategory = null;
        activeBookmark = null;
        renderedGroups.clear();
        drawnSignature = null;
        hideTooltip();
        await googleLauncher.refresh();
        await render();
        toast("모든 데이터를 초기화했습니다.");
    },
    async onSync() {
        if (!globalThis.chrome?.bookmarks?.getTree)
            throw new Error("확장 프로그램을 새로고침한 뒤 크롬 새 탭에서 동기화해 주세요.");
        try {
            const result = await syncChromeBookmarks();
            return `북마크 ${result.bookmarks}개, 카테고리 ${result.categories}개를 가져왔습니다. 중복 ${result.duplicates}개, 지원하지 않는 주소 ${result.skipped}개는 건너뛰었습니다.${result.removed ? ` 크롬에서 지운 북마크 ${result.removed}개는 삭제했습니다.` : ""}`;
        } catch (error) {
            throw new Error("크롬 북마크를 가져오지 못했습니다. 확장 프로그램 권한을 확인한 뒤 다시 시도해 주세요.", {
                cause: error,
            });
        }
    },
});

// "크롬 북마크 자동 동기화": bring in newly added Chrome bookmarks, and drop the ones deleted in
// Chrome, each time a new tab opens.
settings
    .get()
    .then((saved) => {
        if (saved.autoSyncBookmarks && globalThis.chrome?.bookmarks?.getTree) return syncChromeBookmarks();
    })
    .catch(console.error);

setGoogleAccount();
