// Sorting the buildings listed under a category in the panel (Figma USER-MAIN-BUILD): drag a row (or its
// drag handle) up or down, or press ArrowUp/ArrowDown on the handle. `commit(ids)` saves the new order of
// that category's bookmark ids. Dropping a row on another category's line calls `move(id, categoryId)`
// instead. `finish()` runs once a drag is over and saved. One listener on the category list serves every
// building list in it.
const EDGE = 28;
const SCROLL_STEP = 6;

export function buildingReorder(list, { commit, move, error, finish }) {
    let drag = null;
    let suppressClick = false;

    const rowsOf = (items) => [...items.querySelectorAll(":scope > .building-row:not(.building-drag-ghost)")];
    const idsOf = (items) => rowsOf(items).map((row) => row.dataset.bookmark);

    async function save(items, before) {
        try {
            await commit(idsOf(items));
        } catch (cause) {
            for (const row of before) items.append(row);
            error(cause);
        }
    }

    async function moveTo(id, categoryId) {
        try {
            await move(id, categoryId);
        } catch (cause) {
            error(cause);
        }
    }

    // Near the top or bottom edge, scroll the building list (when it scrolls) or else the category list.
    function edgeScroll(d) {
        const box = d.items.getBoundingClientRect();
        if (d.items.scrollHeight > d.items.clientHeight && d.x >= box.left && d.x <= box.right) {
            if (d.y >= box.top && d.y < box.top + EDGE && d.items.scrollTop > 0) {
                d.items.scrollTop -= SCROLL_STEP;
                return;
            }
            if (
                d.y <= box.bottom &&
                d.y > box.bottom - EDGE &&
                d.items.scrollTop < d.items.scrollHeight - d.items.clientHeight
            ) {
                d.items.scrollTop += SCROLL_STEP;
                return;
            }
        }
        const bounds = list.getBoundingClientRect();
        if (d.y < bounds.top + EDGE) list.scrollTop -= SCROLL_STEP;
        else if (d.y > bounds.bottom - EDGE) list.scrollTop += SCROLL_STEP;
    }

    // The other category whose line (not its open building list) is under the pointer.
    function moveTarget(d) {
        const bounds = list.getBoundingClientRect();
        if (d.x < bounds.left || d.x > bounds.right || d.y < bounds.top || d.y > bounds.bottom) return null;
        for (const category of list.querySelectorAll(":scope > .category-row")) {
            if (category === d.category || !category.dataset.category || category.dataset.category === "new") continue;
            if (category.querySelector(".category-edit-form")) continue;
            const rect = category.getBoundingClientRect();
            const open = category.querySelector(":scope > .building-list:not([hidden])");
            const bottom = open ? open.getBoundingClientRect().top : rect.bottom;
            if (d.y >= rect.top && d.y < bottom) return category;
        }
        return null;
    }

    // While over another category, a copy of the row follows the pointer up and down outside the (clipping)
    // building list; the row itself stays in place, faded. It keeps the row's x so the panel never cuts it.
    function placeGhost(d) {
        if (!d.ghost) {
            const ghost = d.row.cloneNode(true);
            ghost.classList.remove("building-sorting", "building-lifted", "building-moving");
            ghost.classList.add("building-drag-ghost");
            ghost.removeAttribute("data-bookmark");
            ghost.setAttribute("aria-hidden", "true");
            ghost.style.transform = "";
            ghost.style.width = `${d.row.offsetWidth}px`;
            d.items.append(ghost);
            d.ghost = ghost;
        }
        d.ghost.style.setProperty("--zone-color", d.target.style.getPropertyValue("--zone-color"));
        d.ghost.style.left = `${d.row.offsetLeft}px`;
        d.ghost.style.top = `${d.row.offsetTop - d.items.scrollTop + (d.y - d.startY) / d.scale + list.scrollTop - d.listTop}px`;
    }

    function update() {
        const d = drag;
        edgeScroll(d);
        const target = moveTarget(d);
        if (target !== d.target) {
            d.target?.classList.remove("building-move-target");
            target?.classList.add("building-move-target");
            d.target = target;
        }
        if (d.target) {
            for (const row of d.rows) row.style.transform = "";
            d.to = d.from;
            d.row.classList.add("building-moving");
            placeGhost(d);
            return;
        }
        d.ghost?.remove();
        d.ghost = null;
        d.row.classList.remove("building-moving");
        // Scrolling moves the rows under a still pointer, so it counts toward the drag distance.
        const scrolled = (d.items.scrollTop - d.itemsTop + list.scrollTop - d.listTop) * d.scale;
        const delta = d.y - d.startY + scrolled;
        const height = d.rects[d.from].height;
        const center = d.rects[d.from].top + height / 2 + delta;
        let to = 0;
        for (let i = 0; i < d.rows.length; i++)
            if (i !== d.from && center > d.rects[i].top + d.rects[i].height / 2) to++;
        d.to = to;
        d.rows.forEach((row, i) => {
            let shift = 0;
            if (i === d.from) shift = delta;
            else if (d.from < to && i > d.from && i <= to) shift = -height;
            else if (d.from > to && i >= to && i < d.from) shift = height;
            row.style.transform = shift ? `translateY(${shift / d.scale}px)` : "";
        });
    }

    function end(cancelled = false) {
        const d = drag;
        if (!d) return;
        drag = null;
        for (const row of d.rows) {
            row.style.transform = "";
            row.classList.remove("building-sorting", "building-lifted", "building-moving");
        }
        d.ghost?.remove();
        d.target?.classList.remove("building-move-target");
        d.category?.classList.remove("building-drag-source");
        document.body.classList.remove("building-sorting-active");
        if (!d.started) return;
        setTimeout(() => {
            suppressClick = false;
        }, 0);
        if (!cancelled && d.target) {
            moveTo(d.row.dataset.bookmark, d.target.dataset.category).finally(finish);
            return;
        }
        if (cancelled || d.from === d.to) {
            finish();
            return;
        }
        const order = d.rows.filter((row) => row !== d.row);
        order.splice(d.to, 0, d.row);
        for (const row of order) d.items.append(row);
        save(d.items, d.rows).finally(finish);
    }

    list.addEventListener("pointerdown", (event) => {
        if (drag || event.button !== 0 || !event.isPrimary) return;
        const row = event.target.closest(".building-row");
        const items = row?.parentElement;
        if (!row || !items?.classList.contains("building-items")) return;
        const rows = rowsOf(items);
        drag = {
            row,
            rows,
            items,
            category: row.closest(".category-row"),
            rects: rows.map((item) => item.getBoundingClientRect()),
            from: rows.indexOf(row),
            to: rows.indexOf(row),
            startX: event.clientX,
            startY: event.clientY,
            x: event.clientX,
            y: event.clientY,
            itemsTop: items.scrollTop,
            listTop: list.scrollTop,
            target: null,
            ghost: null,
            pointer: event.pointerId,
            scale: row.getBoundingClientRect().height / row.offsetHeight,
            started: false,
        };
    });
    window.addEventListener(
        "pointermove",
        (event) => {
            if (!drag || event.pointerId !== drag.pointer) return;
            drag.x = event.clientX;
            drag.y = event.clientY;
            if (!drag.started && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) >= 5) {
                drag.started = true;
                suppressClick = true;
                try {
                    drag.row.setPointerCapture(event.pointerId);
                } catch {
                    // The pointer is gone already (window lost it); the drag still follows window events.
                }
                for (const row of drag.rows) row.classList.add("building-sorting");
                drag.row.classList.add("building-lifted");
                drag.category?.classList.add("building-drag-source");
                document.body.classList.add("building-sorting-active");
            }
            if (drag.started) {
                event.preventDefault();
                update();
            }
        },
        { passive: false },
    );
    window.addEventListener("pointerup", (event) => {
        if (drag && event.pointerId === drag.pointer) end();
    });
    window.addEventListener("pointercancel", () => end(true));
    window.addEventListener("blur", () => end(true));
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && drag?.started) end(true);
    });
    // A drag ends with a click on the row; it must not also select the building.
    list.addEventListener(
        "click",
        (event) => {
            if (!suppressClick) return;
            suppressClick = false;
            event.preventDefault();
            event.stopImmediatePropagation();
        },
        true,
    );
    // Keyboard: ArrowUp/ArrowDown on the drag handle moves its building by one.
    list.addEventListener("keydown", (event) => {
        if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
        const handle = event.target.closest(".building-row-handle");
        const row = handle?.closest(".building-row");
        const items = row?.parentElement;
        if (!items?.classList.contains("building-items")) return;
        event.preventDefault();
        const before = rowsOf(items);
        const sibling = event.key === "ArrowUp" ? row.previousElementSibling : row.nextElementSibling;
        if (!sibling) return;
        if (event.key === "ArrowUp") items.insertBefore(row, sibling);
        else items.insertBefore(sibling, row);
        handle.focus();
        save(items, before);
    });

    return {
        get active() {
            return Boolean(drag?.started);
        },
    };
}
