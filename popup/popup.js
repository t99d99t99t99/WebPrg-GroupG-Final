import { Bookmark } from "../db/bookmark.js";
import { Category, isGeneralCategory } from "../db/category.js";
import { bookmarks, categories } from "../db/db.js";
import { applyPreparedWallMask } from "../homepage/building-appearance.js";
import { assignCategoryColors, colors, wallColorAdjustments } from "../homepage/category-colors.js";
import { BUILDING_DESIGNS } from "../shared/building-designs.js";
import { categorySelect } from "../shared/category-select.js";
import { createColorPicker } from "../shared/color-picker.js";
import { siteIconUrlForPage } from "../shared/site-icons.js";
import { bookmarkNameError, categoryError as getCategoryError, webUrl } from "../shared/validation.js";

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
let selectedDesign = 0;
let draftColor = colors[crypto.getRandomValues(new Uint32Array(1))[0] % colors.length];

function showStatus(message) {
    status.textContent = message;
    if (message) status.scrollIntoView({ block: "nearest" });
}

function showFieldError(input, messageElement, message) {
    input.setAttribute("aria-invalid", String(Boolean(message)));
    messageElement.textContent = message;
    messageElement.hidden = !message;
}

function validateBookmarkName() {
    const error = bookmarkNameError(bookmarkName.value);
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

function selectedColor() {
    return creatingCategory
        ? draftColor
        : (savedCategories.find((item) => item.id === categoryPicker.value)?.color ?? colors[0]);
}

function updateDesignColors(color = selectedColor()) {
    const adjustments = wallColorAdjustments(color, "small");
    for (const button of $("buildingDesigns").children) {
        button.style.setProperty("--wall-color", color);
        button.style.setProperty("--light-color", adjustments.lightColor);
        button.style.setProperty("--light-opacity", String(adjustments.lightOpacity));
        button.style.setProperty("--light-mode", adjustments.lightMode);
    }
}

function updateColor() {
    const color = selectedColor();
    $("categoryColor").disabled = !creatingCategory;
    $("categoryColor").style.backgroundColor = color;
    if (!colorPicker.isOpen) colorPicker.setColor(color);
    updateDesignColors(color);
}

function renderDesigns() {
    const host = $("buildingDesigns");
    const start = Math.min(Math.max(0, selectedDesign - 1), BUILDING_DESIGNS.length - 3);
    host.replaceChildren();
    for (let index = start; index < start + 3; index++) {
        const design = BUILDING_DESIGNS[index];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "building-design";
        button.setAttribute("aria-label", design.name);
        button.setAttribute("aria-pressed", String(index === selectedDesign));
        const image = document.createElement("img");
        image.src = design.src;
        image.alt = "";
        const preview = document.createElement("span");
        preview.className = "building-preview";
        preview.setAttribute("aria-hidden", "true");
        const tint = document.createElement("span");
        tint.className = "preview-wall-tint";
        const light = document.createElement("span");
        light.className = "preview-wall-light";
        applyPreparedWallMask(image, tint, light);
        preview.append(image, tint, light);
        button.append(preview);
        button.addEventListener("click", () => {
            selectedDesign = index;
            renderDesigns();
            host.querySelector('[aria-pressed="true"]')?.focus();
        });
        host.append(button);
    }
    $("previousDesign").hidden = selectedDesign === 0;
    $("nextDesign").hidden = selectedDesign === BUILDING_DESIGNS.length - 1;
    updateDesignColors();
}

async function loadCategories(selectedId = "") {
    savedCategories = assignCategoryColors(await categories.get()).categories;
    categoryPicker.setItems(savedCategories, selectedId || savedCategories.find(isGeneralCategory)?.id);
    updateColor();
}

const categoryPicker = categorySelect(categoryHost, {
    label: "카테고리 선택",
    placeholder: "카테고리 선택",
    onChange() {
        updateColor();
        showCategorySelectionError("");
        showStatus("");
    },
});

const colorPicker = createColorPicker($("popup-color-picker"), {
    onChange(color) {
        draftColor = color;
        updateColor();
    },
    onError: showStatus,
});
$("categoryColor").addEventListener("click", () => {
    if (!creatingCategory) return;
    if (colorPicker.isOpen) colorPicker.close();
    else colorPicker.open(draftColor, $("categoryColor"));
});
document.querySelector(".popup-content").addEventListener("scroll", () => colorPicker.close());

function setCategoryMode(createNew) {
    colorPicker.close();
    creatingCategory = createNew;
    categoryHost.hidden = createNew;
    newCategoryButton.hidden = createNew;
    newCategoryFields.hidden = !createNew;
    showCategorySelectionError("");
    updateColor();
    if (!createNew) {
        showFieldError(newCategoryName, $("newCategoryNameError"), "");
    }
    showStatus("");
    if (createNew) {
        newCategoryName.focus();
        newCategoryName.setSelectionRange(newCategoryName.value.length, newCategoryName.value.length);
    } else categoryPicker.trigger.focus();
}

async function initialize() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;
        bookmarkName.value = tab?.title ?? "";
        bookmarkName.title = bookmarkName.value;
        await loadCategories();
    } catch (error) {
        showStatus("현재 페이지 또는 카테고리 목록을 불러오지 못했습니다.");
        console.error(error);
    }
}

newCategoryButton.addEventListener("click", () => setCategoryMode(true));
existingCategoryButton.addEventListener("click", () => setCategoryMode(false));
bookmarkName.addEventListener("input", () => {
    bookmarkName.title = bookmarkName.value;
    if (bookmarkName.hasAttribute("aria-invalid")) validateBookmarkName();
    showStatus("");
});
newCategoryName.addEventListener("input", () => {
    if (newCategoryName.hasAttribute("aria-invalid")) validateNewCategory();
    showStatus("");
});
bookmarkMemo.addEventListener("input", () => {
    showStatus("");
});
for (const [id, direction] of [
    ["previousDesign", -1],
    ["nextDesign", 1],
]) {
    $(id).addEventListener("click", () => {
        selectedDesign = Math.max(0, Math.min(BUILDING_DESIGNS.length - 1, selectedDesign + direction));
        renderDesigns();
        if ($(id).hidden) $("buildingDesigns").querySelector('[aria-pressed="true"]')?.focus();
    });
}
$("cancelButton").addEventListener("click", () => window.close());

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showStatus("");

    const validName = validateBookmarkName();
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
    if (!validName || !validCategory) return;

    if (!webUrl(currentTab?.url)) {
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
            const category = new Category(crypto.randomUUID(), newCategoryName.value.trim());
            category.color = draftColor;
            selectedCategory = await categories.add(category);
            await loadCategories(selectedCategory.id);
            setCategoryMode(false);
        } else {
            selectedCategory = await categories.get(categoryPicker.value);
            if (!selectedCategory) {
                showCategorySelectionError("카테고리가 변경되었습니다. 다시 선택해 주세요.");
                await loadCategories();
                categoryPicker.trigger.focus();
                return;
            }
            if (!selectedCategory.color) {
                const assigned = assignCategoryColors(await categories.get()).categories;
                selectedCategory = await categories.edit(selectedCategory.id, {
                    color: assigned.find((item) => item.id === selectedCategory.id).color,
                    customColor: false,
                });
            }
        }

        const bookmark = new Bookmark(
            crypto.randomUUID(),
            currentTab.url,
            bookmarkName.value.trim(),
            selectedCategory.id,
            bookmarkMemo.value,
            webUrl(currentTab.favIconUrl)?.href ?? siteIconUrlForPage(currentTab.url),
        );
        bookmark.buildingDesign = BUILDING_DESIGNS[selectedDesign].id;
        await bookmarks.add(bookmark);
        window.close();
    } catch (error) {
        showStatus(error.message || "저장하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.");
        console.error(error);
    } finally {
        saveButton.disabled = false;
    }
});

renderDesigns();
initialize();
