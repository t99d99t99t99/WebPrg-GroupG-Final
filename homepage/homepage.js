import { bookmarks, categories } from "../db/db.js";

const categoryList = document.getElementById("categoryList");
const selectAllButton = document.getElementById("selectAllButton");
const deselectAllButton = document.getElementById("deselectAllButton");
const deleteSelectedButton = document.getElementById("deleteSelectedButton");
const editDialog = document.getElementById("editDialog");
const editForm = document.getElementById("editForm");
const editName = document.getElementById("editName");
const editUrl = document.getElementById("editUrl");
const cancelEditButton = document.getElementById("cancelEditButton");

let editingBookmarkId;

function makeElement(tagName, text) {
    const element = document.createElement(tagName);
    if (text !== undefined) element.textContent = text;
    return element;
}

function appendBookmark(section, bookmark) {
    const item = makeElement("li");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bookmark-checkbox";
    checkbox.value = bookmark.id;
    checkbox.setAttribute("aria-label", `선택: ${bookmark.name}`);

    const link = makeElement("a", bookmark.name);
    link.href = bookmark.url;

    const editButton = makeElement("button", "✎");
    editButton.type = "button";
    editButton.className = "edit-bookmark-button";
    editButton.setAttribute("aria-label", `${bookmark.name} 수정`);
    editButton.title = "북마크 수정";
    editButton.addEventListener("click", () => openEditor(bookmark));

    item.append(checkbox, link, editButton);
    section.append(item);
}

function appendCategory(title, categoryBookmarks) {
    const section = makeElement("section", undefined);
    section.className = "category-section";
    section.append(makeElement("h2", title));

    if (categoryBookmarks.length === 0) {
        section.append(makeElement("p", "북마크가 없습니다."));
    } else {
        const list = makeElement("ul");
        for (const bookmark of categoryBookmarks) appendBookmark(list, bookmark);
        section.append(list);
    }

    categoryList.append(section);
}

async function render() {
    categoryList.replaceChildren();

    try {
        const [savedCategories, savedBookmarks] = await Promise.all([
            categories.get(),
            bookmarks.get(),
        ]);
        const assignedBookmarkIds = new Set();

        for (const category of savedCategories) {
            const categoryBookmarks = savedBookmarks.filter(
                (bookmark) => String(bookmark.category) === String(category.id),
            );
            for (const bookmark of categoryBookmarks) assignedBookmarkIds.add(bookmark.id);
            appendCategory(category.name, categoryBookmarks);
        }

        const uncategorized = savedBookmarks.filter(
            (bookmark) => !assignedBookmarkIds.has(bookmark.id),
        );
        if (uncategorized.length > 0) appendCategory("분류 없음", uncategorized);
        if (savedCategories.length === 0 && savedBookmarks.length === 0) {
            categoryList.append(makeElement("p", "저장된 북마크가 없습니다."));
        }
    } catch (error) {
        categoryList.append(makeElement("p", "북마크를 불러오지 못했습니다."));
        console.error(error);
    }
}

function openEditor(bookmark) {
    editingBookmarkId = bookmark.id;
    editName.value = bookmark.name;
    editUrl.value = bookmark.url;
    editDialog.showModal();
}

selectAllButton.addEventListener("click", () => {
    document.querySelectorAll(".bookmark-checkbox").forEach((checkbox) => {
        checkbox.checked = true;
    });
});

deselectAllButton.addEventListener("click", () => {
    document.querySelectorAll(".bookmark-checkbox").forEach((checkbox) => {
        checkbox.checked = false;
    });
});

deleteSelectedButton.addEventListener("click", async () => {
    const selectedIds = Array.from(document.querySelectorAll(".bookmark-checkbox:checked"))
        .map((checkbox) => checkbox.value);
    const savedBookmarks = await bookmarks.get();

    for (const id of selectedIds) {
        const bookmark = savedBookmarks.find((item) => String(item.id) === id);
        if (bookmark) await bookmarks.remove(bookmark.id);
    }
    await render();
});

editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await bookmarks.edit(editingBookmarkId, {
        name: editName.value.trim(),
        url: editUrl.value.trim(),
    });
    editDialog.close();
    await render();
});

cancelEditButton.addEventListener("click", () => editDialog.close());

render();
