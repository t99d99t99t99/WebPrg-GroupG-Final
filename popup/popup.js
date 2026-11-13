import { Bookmark } from "../db/bookmark.js";
import { Category } from "../db/category.js";
import { bookmarks, categories } from "../db/db.js";
import { categorySelect } from "../shared/category-select.js";
import { categoryError as getCategoryError, nameError } from "../shared/validation.js";

const $ = (id) => document.getElementById(id);
const form = $("bookmarkForm");
const categoryHost = $("categorySelect");
const newCategoryButton = $("newCategoryButton");
const newCategoryFields = $("newCategoryFields");
const newCategoryName = $("newCategoryName");
const existingCategoryButton = $("existingCategoryButton");
const bookmarkName = $("bookmarkName");
const bookmarkMemo = $("bookmarkMemo");
const status = $("status");
const saveButton = $("saveButton");

let currentTab;
let savedCategories = [];
let creatingCategory = false;

function showStatus(message) {
    status.textContent = message;
}

function showFieldError(input, messageElement, message) {
    input.setAttribute("aria-invalid", String(Boolean(message)));
    messageElement.textContent = message;
    messageElement.hidden = !message;
}

function validateBookmarkName() {
    const error = nameError(bookmarkName.value, 20, "페이지 이름");
    showFieldError(bookmarkName, $("bookmarkNameError"), error);
    return !error;
}

function validateNewCategory() {
    const error = getCategoryError(newCategoryName.value, savedCategories);
    showFieldError(newCategoryName, $("newCategoryNameError"), error);
    return !error;
}

function showCategorySelectionError(message) {
    const error = $("categorySelectionError");
    const trigger = categoryPicker.trigger;
    trigger.setAttribute("aria-invalid", String(Boolean(message)));
    trigger.setAttribute("aria-describedby", error.id);
    error.textContent = message;
    error.hidden = !message;
}

function validateMemo() {
    const error = Array.from(bookmarkMemo.value).length > 50 ? "메모는 50자 이내로 입력해 주세요." : "";
    showFieldError(bookmarkMemo, $("bookmarkMemoError"), error);
    return !error;
}

async function loadCategories(selectedId = "") {
    savedCategories = await categories.get();
    categoryPicker.setItems(savedCategories, selectedId);
}

const categoryPicker = categorySelect(categoryHost, {
    label: "카테고리 선택",
    placeholder: "카테고리 선택",
    onChange() {
        showCategorySelectionError("");
        showStatus("");
    },
});

function setCategoryMode(createNew) {
    creatingCategory = createNew;
    categoryHost.hidden = createNew;
    newCategoryButton.hidden = createNew;
    newCategoryFields.hidden = !createNew;
    showCategorySelectionError("");
    if (!createNew) {
        showFieldError(newCategoryName, $("newCategoryNameError"), "");
    }
    showStatus("");
    if (createNew) newCategoryName.focus();
    else categoryPicker.trigger.focus();
}

async function initialize() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;
        bookmarkName.value = tab?.title ?? "";
        await loadCategories();
    } catch (error) {
        showStatus("현재 페이지 또는 카테고리 목록을 불러오지 못했습니다.");
        console.error(error);
    }
}

newCategoryButton.addEventListener("click", () => setCategoryMode(true));
existingCategoryButton.addEventListener("click", () => setCategoryMode(false));
bookmarkName.addEventListener("input", () => {
    if (bookmarkName.hasAttribute("aria-invalid")) validateBookmarkName();
    showStatus("");
});
newCategoryName.addEventListener("input", () => {
    if (newCategoryName.hasAttribute("aria-invalid")) validateNewCategory();
    showStatus("");
});
bookmarkMemo.addEventListener("input", () => {
    validateMemo();
    showStatus("");
});
$("cancelButton").addEventListener("click", () => window.close());

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showStatus("");

    const validName = validateBookmarkName();
    const validMemo = validateMemo();
    let validCategory = true;
    if (creatingCategory) validCategory = validateNewCategory();
    else if (!categoryPicker.value) {
        validCategory = false;
        showCategorySelectionError(
            savedCategories.length ? "카테고리를 선택해 주세요." : "카테고리를 만들거나 선택해 주세요.",
        );
    } else showCategorySelectionError("");

    if (!validName) bookmarkName.focus();
    else if (!validCategory) (creatingCategory ? newCategoryName : categoryPicker.trigger).focus();
    else if (!validMemo) bookmarkMemo.focus();
    if (!validName || !validCategory || !validMemo) return;

    if (!currentTab?.url) {
        showStatus("현재 페이지 주소를 북마크로 저장할 수 없습니다.");
        return;
    }

    saveButton.disabled = true;
    try {
        let selectedCategory;
        if (creatingCategory) {
            savedCategories = await categories.get();
            if (!validateNewCategory()) {
                newCategoryName.focus();
                return;
            }
            selectedCategory = await categories.add(new Category(crypto.randomUUID(), newCategoryName.value.trim()));
        } else {
            selectedCategory = await categories.get(categoryPicker.value);
            if (!selectedCategory) {
                showCategorySelectionError("카테고리가 변경되었습니다. 다시 선택해 주세요.");
                await loadCategories();
                categoryPicker.trigger.focus();
                return;
            }
        }

        const bookmark = new Bookmark(
            crypto.randomUUID(),
            currentTab.url,
            bookmarkName.value.trim(),
            selectedCategory.id,
            bookmarkMemo.value,
        );
        await bookmarks.add(bookmark);
        window.close();
    } catch (error) {
        showStatus("저장하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.");
        console.error(error);
    } finally {
        saveButton.disabled = false;
    }
});

initialize();
