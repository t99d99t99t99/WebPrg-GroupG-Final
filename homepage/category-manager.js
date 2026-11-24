import { isGeneralCategory } from "../db/category.js";
import { bookmarks, categories, deleteCategory, mergeCategory } from "../db/db.js";
import { bookmarkEmoji, bookmarkIconUrl } from "../shared/site-icons.js";
import { categoryError } from "../shared/validation.js";
import { createBookmarkSearch, searchHighlightRanges } from "./bookmark-search.js";
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
function highlightText(host, field, tokens) {
    let offset = 0;
    for (const [start, end] of searchHighlightRanges(field, tokens)) {
        host.append(
            document.createTextNode(field.raw.slice(offset, start)),
            node("mark", "", field.raw.slice(start, end)),
        );
        offset = end;
    }
    host.append(document.createTextNode(field.raw.slice(offset)));
}
export function categoryManager({
    openColorPicker,
    highlightCategory,
    toggleCategory,
    toast,
    hoverBuilding,
    selectBuilding,
    onSearchChange = () => {},
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
            if (!(await confirmMerge(fromId, toId))) return;
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
    // Merging deletes the dragged category, so a drop asks first like the delete button does.
    function confirmMerge(fromId, toId) {
        const group = (id) => lastGroups.find((item) => item.category.id === id);
        const from = group(fromId);
        const to = group(toId);
        if (!from || !to) return Promise.resolve(false);
        $("merge-name").textContent =
            `‘${from.category.name}’의 북마크 ${from.items.length}개를 ‘${to.category.name}’(으)로 옮기고 ‘${from.category.name}’ 카테고리를 삭제합니다.`;
        const dialog = $("category-merge");
        return new Promise((resolve) => {
            const finish = (confirmed) => {
                $("confirm-merge").removeEventListener("click", onConfirm);
                $("cancel-merge").removeEventListener("click", onCancel);
                dialog.removeEventListener("close", onCancel);
                if (dialog.open) dialog.close();
                resolve(confirmed);
            };
            const onConfirm = () => finish(true);
            const onCancel = () => finish(false);
            $("confirm-merge").addEventListener("click", onConfirm);
            $("cancel-merge").addEventListener("click", onCancel);
            dialog.addEventListener("close", onCancel);
            dialog.showModal();
        });
    }
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
    function buildingRow(bookmark, category, sortable, match = null) {
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
        const name = node("span", "building-row-name");
        if (match) {
            row.classList.add("building-search-row");
            highlightText(name, match.entry.title, currentResult.tokens);
            const copy = node("span", "building-search-copy");
            const detail = node("span", "building-search-detail");
            detail.append(document.createTextNode(`${category.name} · `));
            highlightText(detail, match.entry.domain, currentResult.tokens);
            copy.append(name, detail);
            select.append(badge, copy);
            select.setAttribute("aria-label", `${bookmark.name} · ${category.name} · ${match.entry.domain.raw}`);
        } else select.append(badge, name);
        if (!match) name.textContent = bookmark.name;
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
    const search = createBookmarkSearch();
    const searchInput = $("building-search");
    const results = $("building-results");
    const searchStatus = $("building-search-status");
    const PAGE_SIZE = 50;
    let query = "";
    let composing = false;
    let searchFrame = 0;
    let currentResult = null;
    let shown = 0;
    let moreButton;
    function appendResults() {
        moreButton?.remove();
        const page = currentResult.matches.slice(shown, shown + PAGE_SIZE);
        const fragment = document.createDocumentFragment();
        for (const match of page) {
            const { bookmark, category } = match.entry;
            fragment.append(buildingRow(bookmark, category, false, match));
        }
        shown += page.length;
        results.append(fragment);
        searchStatus.textContent = `검색 결과 ${currentResult.matches.length}개 · ${shown}개 표시`;
        if (shown < currentResult.matches.length) {
            moreButton = node("button", "building-search-more", "검색 결과 더 보기");
            moreButton.type = "button";
            moreButton.addEventListener("click", () => {
                const index = shown;
                appendResults();
                results.querySelectorAll(".building-row-select")[index]?.focus();
            });
            results.append(moreButton);
        }
    }
    function renderResults(force = false) {
        const next = search.find(query);
        if (!force && currentResult === next) return;
        currentResult = next;
        const searching = Boolean(next.query);
        results.hidden = !searching;
        searchStatus.hidden = !searching;
        $("category-list").hidden = searching;
        if (results.contains(document.activeElement)) searchInput.focus();
        results.replaceChildren();
        moreButton = null;
        shown = 0;
        if (!searching) {
            searchStatus.textContent = "";
            return;
        }
        results.scrollTop = 0;
        if (next.matches.length) appendResults();
        else {
            searchStatus.textContent = "검색 결과 0개";
            results.append(node("p", "building-results-empty", "일치하는 건물이 없습니다."));
        }
    }
    function flushSearch() {
        cancelAnimationFrame(searchFrame);
        searchFrame = 0;
        query = searchInput.value;
        onSearchChange();
        if (!query.trim()) render(lastGroups);
        renderResults();
    }
    function queueSearch() {
        if (composing) return;
        cancelAnimationFrame(searchFrame);
        searchFrame = requestAnimationFrame(flushSearch);
    }
    searchInput.addEventListener("compositionstart", () => {
        composing = true;
        cancelAnimationFrame(searchFrame);
    });
    searchInput.addEventListener("compositionend", () => {
        composing = false;
        queueSearch();
    });
    searchInput.addEventListener("input", (event) => {
        if (!event.isComposing) queueSearch();
    });
    function searchKey(event) {
        if (composing || event.isComposing || event.keyCode === 229) return;
        if (event.key === "Escape" && searchInput.value) {
            event.preventDefault();
            event.stopPropagation();
            searchInput.value = "";
            flushSearch();
            searchInput.focus();
            return;
        }
        if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
        if (event.target === searchInput && searchFrame) flushSearch();
        if (!currentResult?.query) return;
        if (event.key === "Enter") {
            if (event.target !== searchInput) return; // Native Enter activates a focused result or more button.
            event.preventDefault();
            const first = results.querySelector(".building-row-select");
            first?.focus();
            first?.click();
            return;
        }
        if (event.target !== searchInput && !event.target.matches(".building-row-select")) return;
        event.preventDefault();
        let buttons = [...results.querySelectorAll(".building-row-select")];
        const index = buttons.indexOf(document.activeElement);
        let next = index + (event.key === "ArrowDown" ? 1 : -1);
        if (index < 0) next = event.key === "ArrowDown" ? 0 : buttons.length - 1;
        if (next < 0) {
            searchInput.focus();
            return;
        }
        if (next >= buttons.length && shown < currentResult.matches.length) {
            appendResults();
            buttons = [...results.querySelectorAll(".building-row-select")];
        }
        buttons[Math.min(next, buttons.length - 1)]?.focus();
    }
    searchInput.addEventListener("keydown", searchKey);
    results.addEventListener("keydown", searchKey);
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
        if (query.trim() && !editing) return;
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
        search.update(groups);
        render(groups);
        renderResults(true);
    };
}
