import { isGeneralCategory } from "../db/category.js";
import { bookmarks, categories, deleteCategory, mergeCategory } from "../db/db.js";
import { bookmarkEmoji, bookmarkIconUrl } from "../shared/site-icons.js";
import { categoryError } from "../shared/validation.js";
import { buildingReorder } from "./building-reorder.js";
import { categoryReorder } from "./category-reorder.js";

const $ = (id) => document.getElementById(id);
function node(tag, cls, text) {
    const result = document.createElement(tag);
    result.className = cls;
    if (text !== undefined) result.textContent = text;
    return result;
}
const FALLBACK_ICON = "../assets/icons/icon32.png";
const SVG = "http://www.w3.org/2000/svg";
// Category icon (Figma ".Building Blocks/Category Color"): three stacked tiles in the category color,
// back 45%, middle 70%, front 100%. The color comes from the row's --zone-color (CSS color).
function categoryTiles() {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 24 32");
    svg.setAttribute("width", "24");
    svg.setAttribute("height", "32");
    svg.setAttribute("aria-hidden", "true");
    for (const [d, opacity] of [
        ["M2 13L12 8L22 13L12 18L2 13Z", "0.45"],
        ["M2 17L12 12L22 17L12 22L2 17Z", "0.7"],
        ["M2 21L12 16L22 21L12 26L2 21Z", "1"],
    ]) {
        const path = document.createElementNS(SVG, "path");
        path.setAttribute("d", d);
        path.setAttribute("fill", "currentColor");
        path.setAttribute("fill-opacity", opacity);
        svg.append(path);
    }
    return svg;
}
// How many leading characters (syllables) of the name match the query, ignoring case.
function prefixScore(name, query) {
    const a = [...name.normalize("NFC").toLowerCase()];
    const b = [...query.normalize("NFC").toLowerCase()];
    let count = 0;
    while (count < a.length && count < b.length && a[count] === b[count]) count++;
    return count;
}
export function categoryManager({
    openColorPicker,
    highlightCategory,
    toggleCategory,
    toast,
    hoverBuilding,
    selectBuilding,
}) {
    let saved = [],
        editing = null,
        draft = "",
        deleting = null,
        draftColor = "#485b78",
        draftColorTouched = false;
    let deferredRender = false;
    const sorter = categoryReorder($("category-list"), {
        async commit(ids, original) {
            const latest = (await categories.get()).map((category) => category.id);
            if (JSON.stringify(latest) !== JSON.stringify(original))
                throw new Error("카테고리 목록이 변경되어 이동을 취소했습니다. 다시 시도해 주세요.");
            await categories.reorder(ids);
        },
        error(cause) {
            console.error(cause);
            toast(cause.message || "카테고리 순서를 저장하지 못했습니다.");
        },
        // A category dropped on another one merges into it (Figma USER-MAIN-CATEGORY-001).
        async merge(fromId, toId) {
            const { from, to } = await mergeCategory(fromId, toId);
            toast(`‘${from.name}’ 카테고리를 ‘${to.name}’에 합쳤습니다.`);
        },
        finish() {
            if (deferredRender) {
                deferredRender = false;
                render(lastGroups);
            }
        },
    });
    const buildingSorter = buildingReorder($("category-list"), {
        commit: (ids) => bookmarks.reorder(ids),
        error(cause) {
            console.error(cause);
            toast(cause.message || "건물 순서를 저장하지 못했습니다.");
        },
    });
    async function attempt(action) {
        try {
            await action();
        } catch (error) {
            toast(error.message || "카테고리를 저장하지 못했습니다.");
            console.error(error);
        }
    }
    function askDelete(category, groups) {
        deleting = category.id;
        $("delete-name").textContent =
            `‘${category.name}’ 카테고리와 북마크 ${groups.find((group) => group.category.id === category.id)?.items.length ?? 0}개가 함께 삭제됩니다.`;
        $("delete-status").textContent = "";
        $("category-delete").showModal();
    }
    function iconButton(src, label, onClick) {
        const button = node("button", "icon-button");
        button.type = "button";
        button.setAttribute("aria-label", label);
        const icon = node("img", "");
        icon.src = src;
        icon.alt = "";
        button.append(icon);
        if (onClick) button.addEventListener("click", onClick);
        // Without an action (the general category) the button shows but does nothing.
        else button.disabled = true;
        return button;
    }
    // A building's row in the panel (Figma "Main / Building List Item"): its icon and name select it, the ≡
    // button (rows under a category only) reorders it. Hovering previews it on the map, clicking pins its card.
    function buildingRow(bookmark, category, sortable) {
        const row = node("div", "building-row");
        row.dataset.bookmark = bookmark.id;
        row.style.setProperty("--zone-color", category.color);
        const select = node("button", "building-row-select");
        select.type = "button";
        select.dataset.bookmark = bookmark.id;
        select.setAttribute("aria-pressed", "false");
        select.title = bookmark.name;
        const badge = node("span", "building-row-icon");
        const emoji = bookmarkEmoji(bookmark);
        badge.setAttribute("aria-hidden", "true");
        if (emoji) badge.textContent = emoji;
        else {
            const icon = node("img", "");
            icon.alt = "";
            icon.addEventListener("error", () => {
                if (icon.getAttribute("src") !== FALLBACK_ICON) icon.src = FALLBACK_ICON;
            });
            icon.src = bookmarkIconUrl(bookmark) || FALLBACK_ICON;
            badge.append(icon);
        }
        select.append(badge, node("span", "building-row-name", bookmark.name));
        select.addEventListener("click", () => selectBuilding(bookmark.id, row));
        select.addEventListener("focus", () => hoverBuilding(bookmark.id, row));
        select.addEventListener("blur", () => hoverBuilding(null, row));
        row.addEventListener("mouseenter", () => hoverBuilding(bookmark.id, row));
        row.addEventListener("mouseleave", () => hoverBuilding(null, row));
        row.append(select);
        if (sortable) {
            const handle = node("button", "building-row-handle");
            handle.type = "button";
            handle.setAttribute("aria-label", `${bookmark.name} 순서 변경 (위·아래 방향키)`);
            handle.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown");
            const grip = node("img", "");
            grip.src = "../assets/ui/reorder.svg";
            grip.alt = "";
            handle.append(grip);
            row.append(handle);
        }
        return row;
    }
    // Search: names whose first characters match the query, the longest match first.
    let query = "";
    function renderResults(groups) {
        const results = $("building-results");
        const searching = query.trim() !== "";
        results.hidden = !searching;
        $("category-list").hidden = searching;
        if (!searching) {
            results.replaceChildren();
            return;
        }
        const matches = groups
            .flatMap((group) =>
                group.items.map((bookmark) => ({
                    bookmark,
                    category: group.category,
                    score: prefixScore(bookmark.name, query.trim()),
                })),
            )
            .filter((match) => match.score > 0)
            .sort((a, b) => b.score - a.score || a.bookmark.name.localeCompare(b.bookmark.name, "ko"));
        results.replaceChildren(
            ...(matches.length
                ? matches.map(({ bookmark, category }) => buildingRow(bookmark, category, false))
                : [node("p", "building-results-empty", "일치하는 건물이 없습니다.")]),
        );
    }
    $("building-search").addEventListener("input", () => {
        query = $("building-search").value;
        renderResults(lastGroups);
    });
    $("building-search").addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !$("building-search").value) return;
        event.stopPropagation();
        $("building-search").value = "";
        query = "";
        renderResults(lastGroups);
    });
    // Editing a category opens its name field and its color picker together.
    function startEdit(category, groups) {
        editing = category.id;
        draft = category.name;
        render(groups);
        const list = $("category-list");
        const chip = list.querySelector(`[data-category="${category.id}"] .category-color`);
        if (chip) openColorPicker(category.id, chip, category.color, null);
        list.querySelector("input")?.focus();
    }
    function render(groups) {
        if (sorter.active || buildingSorter.active) {
            deferredRender = true;
            return;
        }
        saved = groups.map((group) => group.category);
        const list = $("category-list"),
            fragment = document.createDocumentFragment();
        const rows = [...groups.map((group) => group.category)];
        if (editing === "new") rows.unshift({ id: "new", name: "", color: draftColor });
        for (const category of rows) {
            const row = node("div", "category-row");
            row.dataset.category = category.id;
            row.style.setProperty("--zone-color", category.color);
            const color = node("button", "category-color");
            color.type = "button";
            color.append(categoryTiles());
            color.setAttribute("aria-label", `${category.name || "새 카테고리"} 색상 변경`);
            color.addEventListener("click", () => {
                if (category.id !== "new" && editing !== category.id && !isGeneralCategory(category)) {
                    startEdit(category, groups);
                    return;
                }
                openColorPicker(
                    category.id,
                    color,
                    category.id === "new" ? draftColor : category.color,
                    category.id === "new"
                        ? (value) => {
                              draftColor = value;
                              draftColorTouched = true;
                              row.style.setProperty("--zone-color", value);
                          }
                        : null,
                );
            });
            row.append(color);
            if (editing === category.id) {
                const form = node("form", "category-edit-form"),
                    wrap = node("div", "category-edit-input"),
                    input = node("input", "field");
                input.value = draft;
                input.setAttribute("aria-label", "카테고리 이름");
                input.autocomplete = "off";
                input.spellcheck = false;
                const message = node("p", "field-error");
                message.id = `category-error-${category.id}`;
                message.setAttribute("role", "status");
                input.setAttribute("aria-describedby", message.id);
                function validate() {
                    const error = categoryError(input.value, saved, category.id);
                    message.textContent = error;
                    input.setAttribute("aria-invalid", String(Boolean(error)));
                    return !error;
                }
                input.addEventListener("input", () => {
                    draft = input.value;
                    validate();
                });
                wrap.append(input);
                const confirm = node("button", "", category.id === "new" ? "생성" : "확인");
                confirm.type = "submit";
                const cancel = node("button", "", "취소");
                cancel.type = "button";
                cancel.addEventListener("click", () => {
                    editing = null;
                    render(groups);
                });
                form.addEventListener("submit", async (event) => {
                    event.preventDefault();
                    if (!validate()) {
                        input.focus();
                        return;
                    }
                    confirm.disabled = true;
                    await attempt(async () => {
                        const latest = await categories.get();
                        const error = categoryError(draft, latest, category.id);
                        if (error) throw new Error(error);
                        if (category.id === "new")
                            await categories.add({
                                id: crypto.randomUUID(),
                                name: draft.trim(),
                                color: draftColor,
                                customColor: draftColorTouched,
                            });
                        else await categories.edit(category.id, { name: draft.trim() });
                        editing = null;
                        render(
                            groups
                                .filter((group) => group.category.id !== "new")
                                .map((group) =>
                                    group.category.id === category.id
                                        ? { ...group, category: { ...group.category, name: draft.trim() } }
                                        : group,
                                ),
                        );
                    });
                    confirm.disabled = false;
                });
                form.append(wrap, confirm, cancel, message);
                row.append(form);
            } else {
                const filter = node("button", "category-filter");
                filter.type = "button";
                filter.setAttribute("aria-pressed", "false");
                filter.append(
                    node(
                        "span",
                        "category-name",
                        `${category.name} (${groups.find((group) => group.category.id === category.id)?.items.length ?? 0})`,
                    ),
                );
                filter.addEventListener("click", () => toggleCategory(category.id));
                row.append(filter);
                // The general category shows both buttons too, but they do nothing (it cannot be edited or deleted).
                const general = isGeneralCategory(category);
                const edit = iconButton(
                    "../assets/ui/edit.svg",
                    `${category.name} 수정`,
                    general ? null : () => startEdit(category, groups),
                );
                const remove = iconButton(
                    "../assets/ui/delete.svg",
                    `${category.name} 삭제`,
                    general ? null : () => askDelete(category, groups),
                );
                remove.classList.add("category-delete-button");
                row.append(edit, remove);
                // The category's buildings, shown under the row while the category is selected (homepage applyFilter).
                const items = groups.find((group) => group.category.id === category.id)?.items ?? [];
                if (items.length) {
                    const buildings = node("div", "building-list");
                    buildings.hidden = true;
                    buildings.setAttribute("role", "group");
                    buildings.setAttribute("aria-label", `${category.name} 건물 목록`);
                    // The expansion line sits on the list; the rows scroll inside it past 10 buildings.
                    const list = node("div", "building-items");
                    list.append(...items.map((bookmark) => buildingRow(bookmark, category, true)));
                    buildings.append(list);
                    row.append(buildings);
                }
                if (!isGeneralCategory(category)) row.dataset.sortable = "true";
                async function move(id, target) {
                    if ([id, target].some((key) => isGeneralCategory(saved.find((item) => item.id === key)))) return;
                    const ids = saved.map((item) => item.id);
                    const from = ids.indexOf(id),
                        to = ids.indexOf(target);
                    if (from < 0 || to < 0 || from === to) return;
                    ids.splice(from, 1);
                    ids.splice(to, 0, id);
                    await attempt(() => categories.reorder(ids));
                }
                filter.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
                filter.addEventListener("keydown", (event) => {
                    if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
                    event.preventDefault();
                    const index = saved.findIndex((item) => item.id === category.id);
                    const target = saved[index + (event.key === "ArrowUp" ? -1 : 1)];
                    if (target)
                        move(category.id, target.id).then(() =>
                            requestAnimationFrame(() =>
                                list.querySelector(`[data-category="${category.id}"] .category-filter`)?.focus(),
                            ),
                        );
                });
            }
            row.addEventListener("mouseenter", () => highlightCategory(category.id));
            row.addEventListener("mouseleave", () => highlightCategory(null));
            fragment.append(row);
        }
        const focused =
            list.contains(document.activeElement) && document.activeElement.matches("input")
                ? { start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd }
                : null;
        list.replaceChildren(fragment);
        if (focused) {
            const input = list.querySelector("input");
            input?.focus();
            input?.setSelectionRange(focused.start, focused.end);
        }
    }
    let lastGroups = [];
    $("add-category").addEventListener("click", () => {
        editing = "new";
        draft = "";
        draftColor = "#485b78";
        draftColorTouched = false;
        render(lastGroups);
        $("category-list").querySelector("input")?.focus();
    });
    $("cancel-delete").addEventListener("click", () => $("category-delete").close());
    $("confirm-delete").addEventListener("click", async () => {
        $("confirm-delete").disabled = true;
        try {
            await deleteCategory(deleting);
            editing = null;
            $("category-delete").close();
            toast("카테고리와 북마크를 삭제했습니다.");
        } catch (error) {
            $("delete-status").textContent = "삭제하지 못했습니다. 다시 시도해 주세요.";
            console.error(error);
        } finally {
            $("confirm-delete").disabled = false;
        }
    });
    return (groups) => {
        lastGroups = groups;
        render(groups);
        renderResults(groups);
    };
}
