import { bookmarks, categories, ready, subscribe } from "../db/db.js";
import { buildings, getLayout, getPosition } from "./layout.js";

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

function showTooltip(bookmark, category, asset, link) {
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
    $("tooltip-image").src = `../assets/${asset}.png`;
    $("tooltip-image").className = `asset-${asset}`;
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

function createBuilding(bookmark, category, layout, slot, categoryIndex) {
    const position = getPosition(layout, slot);
    const asset = buildings[(categoryIndex * 2 + slot) % buildings.length];
    const wrapper = element("div", "building");
    wrapper.dataset.bookmark = bookmark.id;
    wrapper.dataset.category = category.id;
    wrapper.style.left = `${position.x}px`;
    wrapper.style.top = `${position.y}px`;
    wrapper.style.zIndex = String(Math.round(position.y));
    const link = element("a", "building-link");
    const url = safeUrl(bookmark.url);
    if (url) link.href = url.href;
    else link.tabIndex = 0;
    link.setAttribute("aria-label", `${bookmark.name} · ${category.name} · 사이트 방문`);
    const image = element("img", `building-image asset-${asset}`);
    image.src = `../assets/${asset}.png`;
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

async function render() {
    const version = ++renderVersion;
    try {
        await ready;
        const [savedCategories, savedBookmarks] = await Promise.all([categories.get(), bookmarks.get()]);
        if (version !== renderVersion) return;
        hideTooltip();
        const known = new Set(savedCategories.map((category) => String(category.id)));
        const unassigned = savedBookmarks.filter((bookmark) => !known.has(String(bookmark.category)));
        const groups = savedCategories.map((category) => ({
            category,
            items: savedBookmarks.filter((bookmark) => String(bookmark.category) === String(category.id)),
        }));
        if (unassigned.length) groups.push({ category: { id: "uncategorized", name: "분류 없음" }, items: unassigned });
        const zones = document.createDocumentFragment();
        const map = document.createDocumentFragment();
        const rows = document.createDocumentFragment();
        groups.forEach(({ category, items }, index) => {
            const layout = getLayout(index);
            const zone = element("div", "zone");
            zone.dataset.category = String(category.id);
            zone.style.left = `${layout.x}px`;
            zone.style.top = `${layout.y}px`;
            const floor = element("img");
            floor.src = `../assets/figma/${layout.floor}-zone.svg`;
            floor.alt = "";
            const label = element("span", "zone-label", category.name);
            label.style.left = `${layout.label[0]}px`;
            label.style.top = `${layout.label[1]}px`;
            zone.append(floor, label);
            zones.append(zone);
            items.forEach((bookmark, slot) => {
                map.append(createBuilding(bookmark, category, layout, slot, index));
            });
            const row = element("button", "category-row");
            row.type = "button";
            row.dataset.category = String(category.id);
            row.style.setProperty("--zone-color", layout.color);
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
        $("zones").replaceChildren(zones);
        $("buildings").replaceChildren(map);
        $("category-list").replaceChildren(rows);
        $("total-count").textContent = String(savedBookmarks.length).padStart(2, "0");
        $("map-status").textContent = savedBookmarks.length
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
