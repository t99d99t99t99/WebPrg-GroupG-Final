import { bookmarks, categories, ready, saveLayout, subscribe } from "../db/db.js";
import { buildingImage, colors, planCity, planRoads, project, TILE_HEIGHT, TILE_WIDTH } from "./layout.js";

// Canvas region the city is fitted into (left of the category panel, below search).
const MAP_AREA = { left: 40, top: 290, width: 1450, height: 860 };
const MAX_ZOOM = 1.5;

const $ = (id) => document.getElementById(id);
const tooltip = $("bookmark-tooltip");
let activeBookmark;
let activeLink;
let hideTimer;
let toastTimer;
let renderVersion = 0;
let selectedCategory = null;

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function fitCanvas() {
    // Keep the wireframe's complete composition visible at laptop sizes.
    const scale = Math.max(0.38, Math.min(innerWidth / 1995, innerHeight / 1280));
    $("canvas").style.transform = `scale(${scale})`;
    $("viewport").style.width = `${1995 * scale}px`;
    $("viewport").style.height = `${1280 * scale}px`;
    hideTooltip();
}

function toast(message) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").hidden = false;
    toastTimer = setTimeout(() => {
        $("toast").hidden = true;
    }, 3500);
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
    clearTimeout(hideTimer);
    tooltip.hidden = true;
    if (activeLink) activeLink.removeAttribute("aria-describedby");
    activeLink = null;
}

function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideTooltip, 160);
}

function showTooltip(bookmark, category, image, link) {
    clearTimeout(hideTimer);
    if (activeLink && activeLink !== link) activeLink.removeAttribute("aria-describedby");
    activeLink = link;
    activeBookmark = bookmark;
    const url = safeUrl(bookmark.url);
    $("tooltip-name").textContent = bookmark.name;
    $("tooltip-category").textContent = category.name;
    $("preview-title").textContent = bookmark.name;
    $("preview-domain").textContent = url?.hostname ?? "주소를 확인해 주세요";
    $("tooltip-url").textContent = bookmark.url;
    $("tooltip-memo").textContent = bookmark.memo || "메모가 없습니다.";
    $("tooltip-image").src = image;
    $("copy-link").textContent = "링크 복사";
    tooltip.hidden = false;
    link.setAttribute("aria-describedby", "bookmark-tooltip");
    const anchor = link.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    let x = anchor.right + 8;
    if (x + box.width > innerWidth - 12) x = anchor.left - box.width - 8;
    const y = Math.max(12, Math.min(anchor.top, innerHeight - box.height - 12));
    tooltip.style.left = `${Math.max(12, Math.min(x, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${y}px`;
}

function highlightCategory(id) {
    for (const zone of $("zones").children) zone.classList.toggle("active", zone.dataset.category === id);
}

function applyFilter() {
    for (const item of $("buildings").children) {
        item.classList.toggle("dimmed", selectedCategory !== null && item.dataset.category !== selectedCategory);
    }
    for (const row of $("category-list").children)
        row.setAttribute("aria-pressed", String(row.dataset.category === selectedCategory));
    highlightCategory(selectedCategory);
}

function createBuilding(bookmark, category, cell) {
    // Anchor the building's base at the bottom corner of its cell.
    const position = project(cell.x + 1, cell.y + 1);
    const asset = buildingImage(bookmark.id);
    const wrapper = element("div", "building");
    wrapper.dataset.bookmark = bookmark.id;
    wrapper.dataset.category = category.id;
    wrapper.style.left = `${position.left}px`;
    wrapper.style.top = `${position.top}px`;
    wrapper.style.zIndex = String(1000 + cell.x + cell.y);
    const link = element("a", "building-link");
    const url = safeUrl(bookmark.url);
    if (url) link.href = url.href;
    else link.tabIndex = 0;
    link.setAttribute("aria-label", `${bookmark.name} · ${category.name} · 사이트 방문`);
    const image = element("img", "building-image");
    image.src = asset;
    image.alt = "";
    image.draggable = false;
    const badge = element("span", "building-badge", bookmark.name.slice(0, 1));
    badge.setAttribute("aria-hidden", "true");
    const name = element("span", "building-name", bookmark.name);
    link.append(image, badge, name);
    wrapper.append(link);
    link.addEventListener("mouseenter", () => {
        highlightCategory(category.id);
        showTooltip(bookmark, category, asset, link);
    });
    link.addEventListener("mouseleave", () => {
        highlightCategory(selectedCategory);
        scheduleHide();
    });
    link.addEventListener("focus", () => showTooltip(bookmark, category, asset, link));
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
    const label = element("span", "zone-label", category.name);
    label.style.left = `${corners[0].left - left}px`;
    zone.append(svg, label);
    return zone;
}

// Zoom the whole city so every tile fits the map region, like zooming out.
function fitCity(tiles) {
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
    const run = async () => {
        await ready;
        const [savedCategories, savedBookmarks] = await Promise.all([categories.get(), bookmarks.get()]);
        const plan = planCity(savedCategories, savedBookmarks);
        if (plan.changed.areas.size || plan.changed.cells.size) {
            await saveLayout(plan.changed.areas, plan.changed.cells);
        }
        return { groups: plan.groups, total: savedBookmarks.length };
    };
    return globalThis.navigator?.locks ? navigator.locks.request("webprg-bookmarkmap-layout", run) : run();
}

async function render() {
    const version = ++renderVersion;
    try {
        const { groups, total } = await arrangeCity();
        if (version !== renderVersion) return;
        hideTooltip();
        const ground = document.createDocumentFragment();
        const zones = document.createDocumentFragment();
        const map = document.createDocumentFragment();
        const rows = document.createDocumentFragment();
        const tiles = [];
        groups.forEach(({ category, items, area, cells }, index) => {
            const color = colors[index % colors.length];
            for (let y = area.y; y < area.y + area.h; y++) {
                for (let x = area.x; x < area.x + area.w; x++) {
                    ground.append(groundTile(x, y, "../assets/Isometric City/Roads and Grounds/tile_ground_grass.png"));
                }
            }
            zones.append(createZone(category, area, color));
            for (const bookmark of items) {
                map.append(createBuilding(bookmark, category, cells.get(bookmark.id)));
            }
            const row = element("button", "category-row");
            row.type = "button";
            row.dataset.category = String(category.id);
            row.style.setProperty("--zone-color", color);
            row.setAttribute("aria-label", `${category.name}, 북마크 ${items.length}개, 구역 강조`);
            row.append(
                element("span", "category-color"),
                element("span", "category-name", category.name),
                element("span", "category-count", String(items.length).padStart(2, "0")),
            );
            row.addEventListener("mouseenter", () => highlightCategory(String(category.id)));
            row.addEventListener("mouseleave", () => highlightCategory(selectedCategory));
            row.addEventListener("click", () => {
                selectedCategory = selectedCategory === String(category.id) ? null : String(category.id);
                applyFilter();
            });
            rows.append(row);
        });
        for (const road of planRoads(groups.map((group) => group.area))) {
            ground.append(groundTile(road.x, road.y, road.tile));
            tiles.push(road);
        }
        fitCity(tiles);
        $("ground").replaceChildren(ground);
        $("zones").replaceChildren(zones);
        $("buildings").replaceChildren(map);
        $("category-list").replaceChildren(rows);
        $("total-count").textContent = String(total).padStart(2, "0");
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

tooltip.addEventListener("mouseenter", () => clearTimeout(hideTimer));
tooltip.addEventListener("mouseleave", scheduleHide);
tooltip.addEventListener("focusin", () => clearTimeout(hideTimer));
tooltip.addEventListener("focusout", (event) => {
    if (!tooltip.contains(event.relatedTarget)) scheduleHide();
});
$("copy-link").addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(activeBookmark.url);
        $("copy-link").textContent = "복사 완료";
        toast("원본 링크를 복사했습니다.");
    } catch (error) {
        toast("링크를 복사하지 못했습니다. 다시 시도해 주세요.");
        console.error(error);
    }
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideTooltip();
});
$("help-button").addEventListener("click", () =>
    toast("건물을 누르면 사이트로 이동합니다. 새 페이지는 크롬 툴바의 확장프로그램에서 저장하세요."),
);
window.addEventListener("resize", fitCanvas);
window.addEventListener("focus", render);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
});
subscribe(render);
fitCanvas();
render();
