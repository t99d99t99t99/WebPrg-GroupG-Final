// Sorting the buildings listed under a category in the panel (Figma USER-MAIN-BUILD): drag a row (or its
// ≡ button) up or down, or press ArrowUp/ArrowDown on the ≡ button. `commit(ids)` saves the new order of
// that category's bookmark ids. One listener on the category list serves every building list in it.
export function buildingReorder(list, { commit, error }) {
    let drag = null;
    let suppressClick = false;

    const rowsOf = (items) => [...items.querySelectorAll(":scope > .building-row")];
    const idsOf = (items) => rowsOf(items).map((row) => row.dataset.bookmark);

    async function save(items, before) {
        try {
            await commit(idsOf(items));
        } catch (cause) {
            for (const row of before) items.append(row);
            error(cause);
        }
    }

    function update() {
        const d = drag;
        const delta = d.y - d.startY;
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
            row.classList.remove("building-sorting", "building-lifted");
        }
        document.body.classList.remove("building-sorting-active");
        if (!d.started) return;
        setTimeout(() => {
            suppressClick = false;
        }, 0);
        if (cancelled || d.from === d.to) return;
        const order = d.rows.filter((row) => row !== d.row);
        order.splice(d.to, 0, d.row);
        for (const row of order) d.items.append(row);
        save(d.items, d.rows);
    }

    list.addEventListener("pointerdown", (event) => {
        if (drag || event.button !== 0 || !event.isPrimary) return;
        const row = event.target.closest(".building-row");
        const items = row?.parentElement;
        if (!row || !items?.classList.contains("building-items")) return;
        const rows = rowsOf(items);
        if (rows.length < 2) return;
        drag = {
            row,
            rows,
            items,
            rects: rows.map((item) => item.getBoundingClientRect()),
            from: rows.indexOf(row),
            to: rows.indexOf(row),
            startY: event.clientY,
            y: event.clientY,
            pointer: event.pointerId,
            scale: row.getBoundingClientRect().height / row.offsetHeight,
            started: false,
        };
    });
    window.addEventListener(
        "pointermove",
        (event) => {
            if (!drag || event.pointerId !== drag.pointer) return;
            drag.y = event.clientY;
            if (!drag.started && Math.abs(drag.y - drag.startY) >= 5) {
                drag.started = true;
                suppressClick = true;
                try {
                    drag.row.setPointerCapture(event.pointerId);
                } catch {
                    // The pointer is gone already (window lost it); the drag still follows window events.
                }
                for (const row of drag.rows) row.classList.add("building-sorting");
                drag.row.classList.add("building-lifted");
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
    // Keyboard: ArrowUp/ArrowDown on the ≡ button moves its building by one.
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
