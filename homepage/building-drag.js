// Long-press a building to pick it up, drag it, and drop it on a cell of any category.
// The map stays as it is while dragging. Over a full land, a gauge runs around its border for
// EXPAND_MS, then that land's expansion slots appear; only over a slot is the whole map redrawn
// as it will be after the drop. The move is saved only when released on a valid cell.

import { gridAt, planMove, resolveDrop, slotsOf } from "./building-move.js";
import { project, TILE_HEIGHT, TILE_WIDTH } from "./layout.js";

const HOLD_MS = 400; // Proposed value; adjust after user testing.
const MOVE_TOLERANCE = 6; // Moving the pressed pointer farther than this picks up at once.
const EXPAND_MS = 1000; // Time over a full land before its expansion slots appear.
const SVG = "http://www.w3.org/2000/svg";

/**
 * @param {object} options
 * @param {HTMLElement} options.world   transformed map layer (#world)
 * @param {HTMLElement} options.canvas  scaled page canvas (#canvas)
 * @param {HTMLElement} options.overlay layer for the drop marker, gauge and slots (inside #world)
 * @param {() => {snapshot: object, fingerprint: string} | null} options.getState
 * @param {() => void} options.onStart  called when a building is picked up
 * @param {(result: object | null, movingId: string) => void} options.preview
 *        draws the map after `result` (null: the current map)
 * @param {(info: {previewed: boolean}) => void} options.onEnd  called after the drag ends
 * @param {(result: object, fingerprint: string) => Promise<boolean>} options.commit
 * @param {(message: string) => void} options.toast
 */
export function createBuildingDrag({ world, canvas, overlay, getState, onStart, preview, onEnd, commit, toast }) {
    let press = null;
    let drag = null;
    let blockClickUntil = 0;

    // Map position under a pointer, in world pixels (both the page scale and the map zoom undone).
    function toWorld(clientX, clientY) {
        const origin = world.getBoundingClientRect();
        const pageScale = new DOMMatrixReadOnly(getComputedStyle(canvas).transform).a || 1;
        const zoom = new DOMMatrixReadOnly(getComputedStyle(world).transform).a || 1;
        const scale = pageScale * zoom;
        return { left: (clientX - origin.left) / scale, top: (clientY - origin.top) / scale };
    }

    // The building image is anchored at the bottom corner of its cell.
    const anchorOf = (cell) => project(cell.x + 1, cell.y + 1);

    function attach(link, wrapper, bookmark) {
        link.draggable = false;
        link.addEventListener("dragstart", (event) => event.preventDefault());
        link.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || drag) return;
            cancelPress();
            press = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                link,
                wrapper,
                bookmark,
                timer: setTimeout(pickUp, HOLD_MS),
                last: event,
            };
            wrapper.classList.add("drag-arming");
        });
    }

    function cancelPress() {
        if (!press) return;
        clearTimeout(press.timer);
        press.wrapper.classList.remove("drag-arming");
        press = null;
    }

    // Picks up the pressed building: after holding still for HOLD_MS, or as soon as the
    // pressed pointer moves farther than MOVE_TOLERANCE (a plain mouse drag).
    function pickUp() {
        const state = getState();
        if (!press || !state || !press.wrapper.isConnected) return cancelPress();
        const { pointerId, last, link, wrapper, bookmark } = press;
        const down = { clientX: press.x, clientY: press.y };
        cancelPress();
        const start = state.snapshot.bookmarks.find((item) => item.id === bookmark.id);
        if (!start?.cell) return;
        try {
            link.setPointerCapture(pointerId);
        } catch {
            // Capture is only a convenience: moves and the release are also heard on window.
        }
        onStart();
        // Keep the point where the building was grabbed under the pointer.
        const pointer = toWorld(down.clientX, down.clientY);
        const anchor = anchorOf(start.cell);
        const ghost = wrapper.cloneNode(true);
        ghost.classList.add("drag-ghost");
        ghost.classList.remove("focused-building", "is-new");
        ghost.removeAttribute("data-bookmark");
        for (const item of ghost.querySelectorAll("[href], [tabindex], .building-hit-area, .new-badge"))
            item.matches(".building-hit-area, .new-badge") ? item.remove() : item.removeAttribute("href");
        wrapper.parentElement.append(ghost);
        wrapper.classList.add("drag-source");
        const marker = document.createElement("div");
        marker.className = "drop-marker";
        marker.hidden = true;
        overlay.append(marker);
        document.body.classList.add("building-dragging");
        drag = {
            link,
            wrapper,
            bookmark,
            pointerId,
            ghost,
            marker,
            layer: wrapper.parentElement,
            previewed: false, // the screen shows a planned map
            redrawn: false, // the map was redrawn at least once and must be restored
            dropping: false,
            waitId: null, // full land the pointer rests on, waiting for EXPAND_MS
            waitTimer: 0,
            gauge: null, // border of that land, filling while waiting
            expandId: null, // land whose expansion slots are shown
            slots: [],
            client: null,
            state,
            grab: { left: pointer.left - anchor.left, top: pointer.top - anchor.top },
            moveKey: null,
            result: null,
            home: start.cell,
            homeKey: `${start.cell.x},${start.cell.y}`,
        };
        follow(last.clientX, last.clientY);
    }

    // Diamond over one grid cell in the overlay layer.
    function placeCell(node, cell) {
        const top = project(cell.x, cell.y);
        node.style.left = `${top.left - TILE_WIDTH / 2}px`;
        node.style.top = `${top.top}px`;
    }

    const categoryOf = (id) => drag.state.snapshot.categories.find((item) => String(item.id) === String(id));

    // Border of a land in world pixels, drawn from its top corner clockwise. The stroke is
    // dashed to its own length, so animating the offset fills it like a gauge.
    function createGauge(category) {
        const { x, y, w, h } = category.area;
        const corners = [project(x, y), project(x + w, y), project(x + w, y + h), project(x, y + h)];
        let length = 0;
        for (let i = 0; i < 4; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % 4];
            length += Math.hypot(b.left - a.left, b.top - a.top);
        }
        const svg = document.createElementNS(SVG, "svg");
        svg.setAttribute("class", "land-gauge");
        svg.setAttribute("aria-hidden", "true");
        const points = corners.map((point) => `${point.left},${point.top}`).join(" ");
        // A faint track under the stroke that fills.
        for (const part of ["track", "fill"]) {
            const polygon = document.createElementNS(SVG, "polygon");
            polygon.setAttribute("class", part);
            polygon.setAttribute("points", points);
            svg.append(polygon);
        }
        svg.style.setProperty("--gauge-color", category.color ?? "#485b78");
        svg.style.setProperty("--gauge-length", String(length));
        svg.style.setProperty("--gauge-time", `${EXPAND_MS}ms`);
        overlay.append(svg);
        return svg;
    }

    function stopWait() {
        clearTimeout(drag.waitTimer);
        drag.waitId = null;
        if (!drag.expandId) removeGauge();
    }

    function removeGauge() {
        drag.gauge?.remove();
        drag.gauge = null;
    }

    function openExpand(categoryId) {
        clearTimeout(drag.waitTimer);
        drag.waitId = null;
        const category = categoryOf(categoryId);
        if (!category) return removeGauge();
        drag.expandId = String(categoryId);
        drag.gauge?.classList.add("full");
        drag.slots = slotsOf(category.area).map(({ cell }) => {
            const slot = document.createElement("div");
            slot.className = "expand-slot";
            slot.dataset.cell = `${cell.x},${cell.y}`;
            slot.style.setProperty("--marker-color", category.color ?? "#485b78");
            placeCell(slot, cell);
            overlay.append(slot);
            return slot;
        });
        if (drag.client) follow(drag.client.x, drag.client.y);
    }

    // True when the grid point is on the land or on the one-cell road ring around it.
    function nearLand(categoryId, point) {
        const area = categoryOf(categoryId)?.area;
        if (!area) return false;
        const x = Math.floor(point.x);
        const y = Math.floor(point.y);
        return x >= area.x - 1 && x <= area.x + area.w && y >= area.y - 1 && y <= area.y + area.h;
    }

    function closeExpand() {
        for (const slot of drag.slots) slot.remove();
        drag.slots = [];
        drag.expandId = null;
        removeGauge();
    }

    function showGhost(left, top, zIndex, invalid) {
        drag.ghost.style.left = `${left}px`;
        drag.ghost.style.top = `${top}px`;
        drag.ghost.style.zIndex = String(zIndex);
        drag.ghost.classList.toggle("drag-invalid", invalid);
    }

    function follow(clientX, clientY) {
        drag.client = { x: clientX, y: clientY };
        const pointer = toWorld(clientX, clientY);
        const anchor = { left: pointer.left - drag.grab.left, top: pointer.top - drag.grab.top };
        // The grid point half a tile above the building's anchor (the centre of its base cell).
        const point = gridAt(anchor.left, anchor.top - TILE_HEIGHT / 2);
        const key = `${Math.floor(point.x)},${Math.floor(point.y)}`;
        let move = resolveDrop(drag.state.snapshot, drag.bookmark.id, point, drag.expandId);
        // The slots stay while the pointer is on that land or on the road ring around it.
        if (drag.expandId && !nearLand(drag.expandId, point)) {
            closeExpand();
            move = resolveDrop(drag.state.snapshot, drag.bookmark.id, point);
        }
        // Resting on a full land fills its border gauge; leaving it cancels the wait.
        if (move?.type === "full" && !drag.expandId) {
            if (drag.waitId !== String(move.categoryId)) {
                stopWait();
                const categoryId = move.categoryId;
                drag.waitId = String(categoryId);
                drag.gauge = createGauge(categoryOf(categoryId));
                drag.waitTimer = setTimeout(() => openExpand(categoryId), EXPAND_MS);
            }
        } else if (drag.waitId) stopWait();

        const droppable = Boolean(move) && move.type !== "full";
        const moveKey = droppable ? JSON.stringify(move) : "none";
        if (moveKey !== drag.moveKey) {
            drag.moveKey = moveKey;
            drag.result = droppable
                ? planMove(drag.state.snapshot.categories, drag.state.snapshot.bookmarks, move)
                : null;
            // Only growing a land changes the map enough to redraw it.
            const planned = drag.result?.cell && move.type === "insert" ? drag.result : null;
            if (planned || drag.previewed) {
                preview(planned, drag.bookmark.id);
                drag.previewed = Boolean(planned);
                drag.redrawn = true;
                drag.layer.append(drag.ghost); // redrawing replaced the buildings layer
            }
        }
        // While the planned map is shown, only the chosen slot stays: the others belong to
        // the current map and would sit on the wrong cells of the planned one.
        for (const slot of drag.slots) {
            const active = slot.dataset.cell === key;
            slot.classList.toggle("active", active);
            slot.hidden = drag.previewed && !active;
        }
        if (drag.gauge) drag.gauge.hidden = drag.previewed;

        const result = drag.result;
        const category = droppable && categoryOf(move.categoryId);
        if (result?.cell && category) {
            // Growing: the cell in the planned map. Otherwise: the cell under the pointer.
            const cell = move.type === "insert" ? result.cell : move.cell;
            const at = anchorOf(cell);
            showGhost(at.left, at.top, 1000 + cell.x + cell.y + 1, false);
            drag.marker.hidden = move.type === "insert"; // the slot is already marked
            placeCell(drag.marker, cell);
            drag.marker.style.setProperty("--marker-color", category.color ?? "#485b78");
        } else if (key === drag.homeKey) {
            // Back over its own cell: it will simply stay.
            const home = anchorOf(drag.home);
            showGhost(home.left, home.top, 1000 + drag.home.x + drag.home.y + 1, false);
            drag.marker.hidden = true;
        } else {
            // A full land (waiting or showing its slots) is not a wrong place, just not a cell.
            const waiting = move?.type === "full" || drag.expandId !== null;
            showGhost(anchor.left, anchor.top, 2999, !waiting);
            drag.marker.hidden = true;
        }
    }

    // `force` ends a drag that is waiting for its move to be saved.
    function finish(force = false) {
        if (!drag || (drag.dropping && !force)) return;
        const { link, pointerId, redrawn } = drag;
        closeExpand();
        stopWait();
        drag.ghost.remove();
        drag.marker.remove();
        drag.wrapper.classList.remove("drag-source");
        document.body.classList.remove("building-dragging");
        drag = null;
        try {
            link.releasePointerCapture(pointerId);
        } catch {
            // Already released.
        }
        // The click that follows pointerup must not open the site.
        blockClickUntil = performance.now() + 400;
        onEnd({ previewed: redrawn });
    }

    async function drop() {
        if (drag.dropping) return;
        // The click that follows this pointerup must not open the site. It fires before the
        // save below finishes, so block it now rather than in finish().
        blockClickUntil = performance.now() + 400;
        const { result, state, bookmark } = drag;
        const start = state.snapshot.bookmarks.find((item) => item.id === bookmark.id);
        const moved =
            result?.cell &&
            (String(result.move.categoryId) !== String(start.category) ||
                result.cell.x !== start.cell.x ||
                result.cell.y !== start.cell.y);
        // Nowhere to go: the building simply returns to its cell.
        if (!moved) return finish();
        // Keep the previewed map until the save is done, so it does not flash back first.
        drag.dropping = true;
        closeExpand();
        stopWait();
        drag.marker.hidden = true;
        try {
            const saved = await commit(result, state.fingerprint);
            if (!saved) toast("다른 곳에서 지도가 바뀌어 이동을 취소했습니다. 다시 시도해 주세요.");
        } catch (error) {
            console.error(error);
            toast("건물을 옮기지 못했습니다.");
        } finally {
            finish(true);
        }
    }

    window.addEventListener("pointermove", (event) => {
        // The button was released somewhere we did not hear (another window or tab): cancel.
        if ((event.buttons & 1) === 0 && event.pointerType === "mouse") {
            cancelPress();
            finish();
            return;
        }
        if (press && event.pointerId === press.pointerId) {
            press.last = event;
            if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE) pickUp();
        }
        if (drag && !drag.dropping && event.pointerId === drag.pointerId) follow(event.clientX, event.clientY);
    });
    window.addEventListener("pointerup", (event) => {
        if (press && event.pointerId === press.pointerId) cancelPress();
        if (drag && event.pointerId === drag.pointerId) drop();
    });
    window.addEventListener("pointercancel", () => {
        cancelPress();
        finish();
    });
    window.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Escape" && drag && !drag.dropping) {
                event.stopPropagation();
                finish();
            }
        },
        true,
    );
    // No visibilitychange cancel: some embedded browsers report brief hidden states during a
    // drag. A release in another tab is caught by the button check in pointermove instead.
    // No click opens a site while a building is held or being saved, nor right after.
    // Capture phase, so it runs before the building link's own click handler.
    window.addEventListener(
        "click",
        (event) => {
            if (drag || performance.now() < blockClickUntil) {
                event.preventDefault();
                event.stopPropagation();
            }
        },
        true,
    );

    return { attach, isDragging: () => Boolean(drag) };
}
