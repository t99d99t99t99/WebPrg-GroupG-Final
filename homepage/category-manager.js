import { categories, deleteCategory } from "../db/db.js";
import { categoryError } from "../shared/validation.js";

const $ = (id) => document.getElementById(id);
function node(tag, cls, text) {
    const result = document.createElement(tag);
    result.className = cls;
    if (text !== undefined) result.textContent = text;
    return result;
}
export function categoryManager({ openColorPicker, highlightCategory, toggleCategory, toast }) {
    let saved = [],
        editing = null,
        draft = "",
        dragging = null,
        deleting = null,
        draftColor = "#485b78",
        draftColorTouched = false;
    async function attempt(action) {
        try {
            await action();
        } catch (error) {
            toast(error.message || "카테고리를 저장하지 못했습니다.");
            console.error(error);
        }
    }
    function render(groups) {
        saved = groups.map((group) => group.category).filter((item) => item.id !== "uncategorized");
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
            color.setAttribute("aria-label", `${category.name || "새 카테고리"} 색상 변경`);
            color.disabled = category.id === "uncategorized";
            color.addEventListener("click", () =>
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
                ),
            );
            row.append(color);
            if (editing === category.id) {
                const form = node("form", "category-edit-form"),
                    wrap = node("div", "category-edit-input"),
                    input = node("input", "field");
                input.value = draft;
                input.setAttribute("aria-label", "카테고리 이름");
                input.autocomplete = "off";
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
                const second = node("button", "", category.id === "new" ? "취소" : "삭제");
                second.type = "button";
                second.addEventListener("click", () => {
                    if (category.id === "new") {
                        editing = null;
                        render(groups);
                        return;
                    }
                    deleting = category.id;
                    $("delete-name").textContent =
                        `‘${category.name}’ 카테고리와 북마크 ${groups.find((group) => group.category.id === category.id)?.items.length ?? 0}개가 함께 삭제됩니다.`;
                    $("delete-status").textContent = "";
                    $("category-delete").showModal();
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
                form.append(wrap, confirm, second, message);
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
                if (category.id !== "uncategorized") {
                    const edit = node("button", "icon-button");
                    edit.type = "button";
                    edit.setAttribute("aria-label", `${category.name} 수정`);
                    const icon = node("img", "");
                    icon.src = "../assets/ui/edit.svg";
                    icon.alt = "";
                    edit.append(icon);
                    edit.addEventListener("click", () => {
                        editing = category.id;
                        draft = category.name;
                        render(groups);
                        list.querySelector("input")?.focus();
                    });
                    row.append(edit);
                }
                row.draggable = category.id !== "uncategorized";
                row.addEventListener("dragstart", (event) => {
                    dragging = category.id;
                    event.dataTransfer.setData("text/plain", category.id);
                    event.dataTransfer.effectAllowed = "move";
                    row.classList.add("dragging");
                });
                row.addEventListener("dragend", () => {
                    dragging = null;
                    row.classList.remove("dragging");
                    for (const item of list.children) item.classList.remove("drop-target");
                });
                row.addEventListener("dragover", (event) => {
                    if (dragging && category.id !== "uncategorized") {
                        event.preventDefault();
                        row.classList.add("drop-target");
                    }
                });
                row.addEventListener("dragleave", () => row.classList.remove("drop-target"));
                async function move(id, target) {
                    const ids = saved.map((item) => item.id);
                    const from = ids.indexOf(id),
                        to = ids.indexOf(target);
                    if (from < 0 || to < 0 || from === to) return;
                    ids.splice(from, 1);
                    ids.splice(to, 0, id);
                    await attempt(() => categories.reorder(ids));
                }
                row.addEventListener("drop", (event) => {
                    event.preventDefault();
                    row.classList.remove("drop-target");
                    move(dragging, category.id);
                });
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
    };
}
