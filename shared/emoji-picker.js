import { EMOJIS } from "./emoji-data.js";

const CATEGORIES = [
    ["recent", "최근 사용", "clock"],
    ["people", "사람", "smile"],
    ["nature", "자연", "leaf"],
    ["food", "음식", "food"],
    ["activities", "활동", "soccer"],
    ["travel", "여행", "bicycle"],
    ["objects", "사물", "balloon"],
    ["symbols", "기호", "heart"],
    ["flags", "깃발", "flag"],
];
const FIRST_PEOPLE = Array.from(
    new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(
        "😀😁😂🤣😃😄😅😆😉😊😋😎😍😘🥰😗😙🥲😚🙂☺️🤗🤩🤔🫡😐🤨😑😶🫥",
    ),
    ({ segment }) => segment,
);
const peopleOrder = new Map(FIRST_PEOPLE.map((emoji, index) => [emoji, index]));

export function createEmojiPicker(host, { onChange = () => {}, onUseSiteIcon = () => {} } = {}) {
    function node(tag, className, text) {
        const result = document.createElement(tag);
        result.className = className;
        if (text !== undefined) result.textContent = text;
        return result;
    }
    host.classList.add("emoji-picker", "fade-popup");
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-label", "대표 아이콘 선택");
    host.hidden = true;
    const content = node("div", "emoji-picker-content");
    const searchLabel = node("label", "emoji-search");
    const search = node("input", "emoji-search-input");
    Object.assign(search, { type: "search", placeholder: "검색어를 입력하세요", autocomplete: "off" });
    search.setAttribute("aria-label", "이모지 검색");
    searchLabel.append(search);
    const toolbar = node("div", "emoji-picker-toolbar");
    const category = node("select", "emoji-category");
    category.setAttribute("aria-label", "이모지 분류");
    const categoryControl = node("span", "emoji-category-control");
    const categoryName = node("span", "emoji-category-name");
    categoryName.setAttribute("aria-hidden", "true");
    const categoryArrow = node("img", "emoji-category-arrow");
    categoryArrow.src = new URL("../assets/ui/emoji-chevron-down.svg", import.meta.url).href;
    categoryArrow.alt = "";
    categoryArrow.width = 16;
    categoryArrow.height = 16;
    categoryControl.append(categoryName, categoryArrow, category);
    const tabs = node("div", "emoji-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "이모지 분류");
    const grid = node("div", "emoji-grid");
    grid.id = `${host.id}-results`;
    grid.setAttribute("role", "tabpanel");
    const buttons = [];
    for (const [id, name, icon] of CATEGORIES) {
        const option = node("option", "", name);
        option.value = id;
        category.append(option);
        const button = node("button", "emoji-tab");
        button.type = "button";
        button.id = `${host.id}-${id}`;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-label", name);
        button.setAttribute("aria-controls", grid.id);
        button.title = name;
        const image = node("img", "");
        image.src = new URL(`../assets/ui/emoji-${icon}.svg`, import.meta.url).href;
        image.alt = "";
        image.width = icon === "bicycle" ? 17 : 18;
        image.height = icon === "bicycle" ? 14 : 18;
        button.append(image);
        button.addEventListener("click", () => selectCategory(id));
        tabs.append(button);
        buttons.push(button);
    }
    const siteIcon = node("button", "emoji-use-site", "사이트 아이콘 사용");
    siteIcon.type = "button";
    toolbar.append(categoryControl, siteIcon);
    content.append(searchLabel, toolbar, grid);
    host.replaceChildren(content, tabs);
    let anchor;
    let selected = "";
    let recent = [];
    category.value = "people";

    function render() {
        const query = search.value.trim().toLocaleLowerCase();
        const current = category.value;
        categoryName.textContent = category.selectedOptions[0].textContent;
        grid.setAttribute("aria-label", query ? "검색 결과" : category.selectedOptions[0].textContent);
        grid.setAttribute("aria-labelledby", buttons[CATEGORIES.findIndex(([id]) => id === current)].id);
        for (const [index, button] of buttons.entries()) {
            const active = CATEGORIES[index][0] === current;
            button.setAttribute("aria-selected", String(active));
            button.tabIndex = active ? 0 : -1;
        }
        const entries = EMOJIS.filter(([emoji, name, english, group]) =>
            query
                ? `${emoji} ${name} ${english}`.toLocaleLowerCase().includes(query)
                : current === "recent"
                  ? recent.includes(emoji)
                  : group === current,
        );
        if (!query && current === "people")
            entries.sort((a, b) => (peopleOrder.get(a[0]) ?? 100) - (peopleOrder.get(b[0]) ?? 100));
        if (!query && current === "recent") entries.sort((a, b) => recent.indexOf(a[0]) - recent.indexOf(b[0]));
        grid.replaceChildren();
        const focusEmoji = entries.some(([emoji]) => emoji === selected) ? selected : entries[0]?.[0];
        for (const [emoji, name] of entries) {
            const button = node("button", "emoji-choice", emoji);
            button.type = "button";
            button.tabIndex = emoji === focusEmoji ? 0 : -1;
            button.title = name;
            button.setAttribute("aria-label", name);
            button.setAttribute("aria-pressed", String(selected === emoji));
            button.addEventListener("click", () => {
                selected = emoji;
                recent = [emoji, ...recent.filter((value) => value !== emoji)].slice(0, 36);
                onChange(emoji);
                close(true);
            });
            grid.append(button);
        }
        if (!entries.length) {
            const message = node(
                "p",
                "emoji-empty",
                current === "recent" && !query ? "최근 사용한 이모지가 없습니다." : "검색 결과가 없습니다.",
            );
            message.setAttribute("role", "status");
            grid.append(message);
        }
        grid.scrollTop = 0;
    }
    function selectCategory(id) {
        category.value = id;
        search.value = "";
        render();
    }
    function close(restoreFocus = false) {
        if (host.hidden) return;
        host.hidden = true;
        anchor?.setAttribute("aria-expanded", "false");
        if (restoreFocus) anchor?.focus();
    }
    search.addEventListener("input", render);
    search.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            grid.querySelector('[tabindex="0"]')?.focus();
        }
    });
    category.addEventListener("change", () => selectCategory(category.value));
    siteIcon.addEventListener("click", () => {
        onUseSiteIcon();
        close(true);
    });
    tabs.addEventListener("keydown", (event) => {
        const index = buttons.indexOf(document.activeElement);
        if (index < 0) return;
        let next;
        if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
        else if (event.key === "ArrowLeft") next = (index + buttons.length - 1) % buttons.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = buttons.length - 1;
        else return;
        event.preventDefault();
        selectCategory(CATEGORIES[next][0]);
        buttons[next].focus();
    });
    grid.addEventListener("keydown", (event) => {
        const choices = [...grid.querySelectorAll("button")];
        const index = choices.indexOf(document.activeElement);
        if (index < 0) return;
        const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 9, ArrowUp: -9 };
        let next;
        if (event.key in moves) next = Math.max(0, Math.min(choices.length - 1, index + moves[event.key]));
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = choices.length - 1;
        else return;
        event.preventDefault();
        choices[index].tabIndex = -1;
        choices[next].tabIndex = 0;
        choices[next].focus();
    });
    host.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && event.target === search) event.preventDefault();
        if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close(true);
        }
    });
    document.addEventListener("pointerdown", (event) => {
        if (!host.hidden && !host.contains(event.target) && !anchor?.contains(event.target)) close();
    });
    document.addEventListener("focusin", (event) => {
        if (!host.hidden && !host.contains(event.target) && !anchor?.contains(event.target)) close();
    });
    window.addEventListener("resize", () => close());
    return {
        close,
        get isOpen() {
            return !host.hidden;
        },
        open(trigger, emoji = "") {
            if (anchor && anchor !== trigger) anchor.setAttribute("aria-expanded", "false");
            anchor = trigger;
            selected = emoji;
            search.value = "";
            render();
            host.hidden = false;
            anchor.setAttribute("aria-expanded", "true");
            const bounds = anchor.getBoundingClientRect();
            const margin = Number.parseFloat(getComputedStyle(host).getPropertyValue("--space-2"));
            host.style.left = `${Math.max(margin, Math.min(bounds.left, innerWidth - host.offsetWidth - margin))}px`;
            host.style.top = `${Math.max(margin, Math.min(bounds.bottom, innerHeight - host.offsetHeight - margin))}px`;
            search.focus();
        },
    };
}
