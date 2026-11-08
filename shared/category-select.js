// A shared four-row dropdown; native button keyboard behavior is preserved.
export function categorySelect(
    host,
    { label = "카테고리", placeholder = "카테고리를 선택해 주세요.", onChange = () => {} } = {},
) {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "field category-select-trigger";
    trigger.setAttribute("aria-label", label);
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const list = document.createElement("div");
    list.className = "category-options";
    list.id = `categories-${crypto.randomUUID()}`;
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", label);
    trigger.setAttribute("aria-controls", list.id);
    list.hidden = true;
    host.classList.add("category-select");
    host.append(trigger, list);
    let items = [],
        value = "";
    function close() {
        list.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
    }
    function open() {
        list.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
        (list.querySelector('[aria-selected="true"]') ?? list.firstElementChild)?.focus();
    }
    function select(id) {
        value = items.some((item) => item.id === id) ? id : "";
        trigger.textContent = items.find((item) => item.id === value)?.name ?? placeholder;
        trigger.classList.toggle("has-selection", Boolean(value));
        for (const option of list.children) option.setAttribute("aria-selected", String(option.dataset.id === value));
    }
    trigger.addEventListener("click", () => (list.hidden ? open() : close()));
    trigger.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            open();
        }
    });
    list.addEventListener("keydown", (event) => {
        const options = [...list.children],
            index = options.indexOf(document.activeElement);
        if (event.key === "Escape") {
            event.preventDefault();
            close();
            trigger.focus();
        } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const next =
                event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? options.length - 1
                      : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
            options[next]?.focus();
        }
    });
    document.addEventListener("pointerdown", (event) => {
        if (!host.contains(event.target)) close();
    });
    host.addEventListener("focusout", (event) => {
        if (!host.contains(event.relatedTarget)) close();
    });
    return {
        get value() {
            return value;
        },
        set value(id) {
            select(id);
        },
        trigger,
        close,
        setItems(next, selected = value) {
            items = next;
            list.replaceChildren();
            for (const item of items) {
                const option = document.createElement("button");
                option.type = "button";
                option.setAttribute("role", "option");
                option.tabIndex = -1;
                option.dataset.id = item.id;
                option.textContent = item.name;
                option.addEventListener("click", () => {
                    select(item.id);
                    close();
                    trigger.focus();
                    onChange(item.id);
                });
                list.append(option);
            }
            select(selected);
            close();
        },
    };
}
