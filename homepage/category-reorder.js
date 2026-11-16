// Pointer sorting keeps the original layout as slots until the drop is committed.
export function categoryReorder(list, { commit, error, finish }) {
    let drag = null;
    let frame = 0;
    let suppressClick = false;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

    function update() {
        const d = drag;
        if (!d || d.settling) return;
        const bounds = list.getBoundingClientRect();
        const edge = 28;
        const scroll = d.y < bounds.top + edge ? -6 : d.y > bounds.bottom - edge ? 6 : 0;
        if (scroll) list.scrollTop += scroll;
        const delta = d.y - d.startY + (list.scrollTop - d.scrollTop) * d.scale;
        const center = d.rects[d.from].top + d.rects[d.from].height / 2 + delta;
        let to = 0;
        for (let i = 0; i < d.rows.length; i++) {
            if (i !== d.from && center > d.rects[i].top + d.rects[i].height / 2) to++;
        }
        d.to = to;
        d.delta = delta;
        const order = d.rows.filter((row) => row !== d.row);
        order.splice(to, 0, d.row);
        let top = d.rects[0].top;
        for (const row of order) {
            const index = d.rows.indexOf(row);
            const shift = top - d.rects[index].top;
            row.style.transform = `translateY(${(row === d.row ? delta : shift) / d.scale}px)`;
            top += d.rects[index].height + d.gap;
        }
    }
    function tick() {
        if (!drag || drag.settling || !drag.started) return;
        update();
        frame = requestAnimationFrame(tick);
    }
    function clean(d) {
        cancelAnimationFrame(frame);
        for (const row of d.rows) {
            row.style.transform = "";
            row.classList.remove("category-sorting", "category-lifted");
        }
        document.body.classList.remove("category-dragging");
        drag = null;
        finish();
    }
    async function end(cancelled = false) {
        const d = drag;
        if (!d || d.settling) return;
        d.settling = true;
        if (cancelled)
            setTimeout(() => {
                suppressClick = false;
            }, 0);
        cancelAnimationFrame(frame);
        if (!d.started) {
            clean(d);
            return;
        }
        const before = d.row.getBoundingClientRect().top;
        const order = [...d.rows];
        if (!cancelled) {
            order.splice(d.from, 1);
            order.splice(d.to, 0, d.row);
        }
        // Reinsert only the sortable rows; the fixed general category stays put.
        const after = d.rows.at(-1).nextSibling;
        for (const row of order) list.insertBefore(row, after);
        for (const row of d.rows) {
            row.style.transform = "";
            row.classList.remove("category-sorting");
        }
        const offset = (before - d.row.getBoundingClientRect().top) / d.scale;
        const animation = d.row.animate([{ transform: `translateY(${offset}px)` }, { transform: "translateY(0)" }], {
            duration: reducedMotion.matches ? 0 : 320,
            easing: "cubic-bezier(.34,1.56,.64,1)",
        });
        try {
            await animation.finished;
            if (!cancelled && d.from !== d.to) {
                await commit(
                    [...list.children].map((row) => row.dataset.category),
                    d.original,
                );
            }
        } catch (cause) {
            for (const row of d.rows) list.insertBefore(row, after);
            error(cause);
        } finally {
            clean(d);
        }
    }
    list.addEventListener("pointerdown", (event) => {
        if (drag || event.button !== 0 || !event.isPrimary || list.querySelector("form")) return;
        const row = event.target.closest(".category-row[data-sortable]");
        if (!row || event.target.closest("button:not(.category-filter), input, form")) return;
        const rows = [...list.querySelectorAll(".category-row[data-sortable]")];
        const rects = rows.map((item) => item.getBoundingClientRect());
        drag = {
            row,
            scale: row.getBoundingClientRect().height / row.offsetHeight,
            rows,
            rects,
            from: rows.indexOf(row),
            to: rows.indexOf(row),
            startY: event.clientY,
            y: event.clientY,
            scrollTop: list.scrollTop,
            pointer: event.pointerId,
            started: false,
            settling: false,
            gap: rows.length > 1 ? rects[1].top - rects[0].bottom : 0,
            original: [...list.children].map((item) => item.dataset.category),
        };
    });
    window.addEventListener(
        "pointermove",
        (event) => {
            if (!drag || drag.settling || event.pointerId !== drag.pointer) return;
            drag.y = event.clientY;
            if (!drag.started && Math.abs(drag.y - drag.startY) >= 5) {
                drag.started = true;
                suppressClick = true;
                drag.row.setPointerCapture(event.pointerId);
                for (const row of drag.rows) row.classList.add("category-sorting");
                drag.row.classList.add("category-lifted");
                document.body.classList.add("category-dragging");
                tick();
            }
            if (drag.started) {
                event.preventDefault();
                update();
            }
        },
        { passive: false },
    );
    window.addEventListener("pointerup", (event) => {
        if (!drag || event.pointerId !== drag.pointer) return;
        if (drag.started) {
            drag.y = event.clientY;
            update();
        }
        end();
        setTimeout(() => {
            suppressClick = false;
        }, 0);
    });
    window.addEventListener("pointercancel", () => end(true));
    window.addEventListener("blur", () => end(true));
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") end(true);
    });
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
    return {
        get active() {
            return Boolean(drag);
        },
    };
}
