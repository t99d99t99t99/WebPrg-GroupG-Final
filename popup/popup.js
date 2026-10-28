import { Bookmark } from "../db/bookmark.js";
import { Category } from "../db/category.js";
import { bookmarks, categories } from "../db/db.js";

const form = document.getElementById("bookmarkForm");
const categorySelect = document.getElementById("categorySelect");
const newCategoryButton = document.getElementById("newCategoryButton");
const newCategoryFields = document.getElementById("newCategoryFields");
const newCategoryName = document.getElementById("newCategoryName");
const saveCategoryButton = document.getElementById("saveCategoryButton");
const bookmarkName = document.getElementById("bookmarkName");
const status = document.getElementById("status");

let currentTab;

function showStatus(message) {
    status.textContent = message;
}

async function loadCategories(selectedId = "") {
    const savedCategories = await categories.get();
    categorySelect.replaceChildren(new Option("카테고리 없음", ""));

    for (const category of savedCategories) {
        categorySelect.add(new Option(category.name, category.id));
    }

    categorySelect.value = selectedId;
}

async function initialize() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;
        bookmarkName.placeholder = tab?.title ?? "";
        await loadCategories();
    } catch (error) {
        showStatus("현재 페이지 또는 카테고리 목록을 불러오지 못했습니다.");
        console.error(error);
    }
}

newCategoryButton.addEventListener("click", () => {
    newCategoryFields.hidden = !newCategoryFields.hidden;
    if (!newCategoryFields.hidden) newCategoryName.focus();
});

saveCategoryButton.addEventListener("click", async () => {
    const name = newCategoryName.value.trim();
    if (!name) {
        newCategoryName.focus();
        return;
    }

    try {
        const category = new Category(crypto.randomUUID(), name);
        await categories.add(category);
        await loadCategories(category.id);
        newCategoryName.value = "";
        newCategoryFields.hidden = true;
        showStatus("카테고리를 추가했습니다.");
    } catch (error) {
        showStatus("카테고리를 저장하지 못했습니다.");
        console.error(error);
    }
});

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = bookmarkName.value.trim() || currentTab?.title?.trim();

    if (!currentTab?.url || !name) {
        showStatus("페이지 주소와 북마크 이름이 필요합니다.");
        return;
    }

    try {
        const bookmark = new Bookmark(
            crypto.randomUUID(),
            currentTab.url,
            name,
            categorySelect.value || null,
        );
        await bookmarks.add(bookmark);
        showStatus("저장했습니다.");
    } catch (error) {
        showStatus("저장 중 오류가 발생했습니다.");
        console.error(error);
    }
});

initialize();
